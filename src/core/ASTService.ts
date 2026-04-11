/**
 * ASTService — src/core/ASTService.ts
 *
 * Facade over ast-parser.ts that adds:
 *   Phase A — batch-mutation stub (ASTMutation + applyMutationBatch).
 *   Phase B — Import Synthesizer: given a JSX subtree being relocated,
 *             discovers which PascalCase components / Lucide icons it uses,
 *             finds their ImportDeclarations in the origin file's AST, and
 *             injects missing declarations into the target file's AST without
 *             creating duplicates (deduplicates at the specifier level).
 *   Phase D — Recovery Engine:
 *             applyMutationBatch: implemented (single parse→mutate→generate).
 *             InverseMutation: type for Command-Pattern undo/redo history.
 *             nodeExists: pre-flight zombie check before applying an undo.
 *             applyInversions: restore prior state from an InverseMutation[].
 *
 * All existing parser utilities are re-exported unchanged so callers can
 * migrate imports here incrementally without changing call-sites.
 *
 * Renderer Process only — no Node.js imports.
 */

export {
    parseCodeToAST,
    generateCodeFromAST,
    buildVisualTree,
    updateJSXClassName,
} from './ast-parser'
export type { VisualLayer } from './ast-parser'

// ── Local imports from ast-parser (used by the batch engine) ─────────────────
import { parseCodeToAST, generateCodeFromAST, updateJSXClassName, updateJSXTextContent } from './ast-parser'
// ── Structural mutation helpers ───────────────────────────────────────────────
import { moveNode, injectComponent, applyTokenFix } from '../utils/astModifier'
// ── @babel/traverse (CJS interop — same pattern as ast-parser.ts) ────────────
import _traverse from '@babel/traverse'
import type { NodePath } from '@babel/traverse'

const _tv =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Mutation Types ────────────────────────────────────────────────────────────

/** Updates the `className` JSX attribute on a target element. */
interface UpdateClassNameMutation {
    op: 'updateClassName'
    /** The `data-flint-id` or structural `"tag:line:col"` ID of the element. */
    nodeId: string
    /** Full Tailwind class string to set. */
    className: string
}

/** Moves a JSX element relative to another element in the tree. */
interface MoveNodeMutation {
    op: 'moveNode'
    /** `data-flint-id` of the element to move. */
    sourceId: string
    /** `data-flint-id` of the reference element. */
    targetId: string
    /** Insertion relationship relative to `targetId`. */
    position: 'before' | 'after' | 'inside'
}

/** Removes a JSX element (and all its children) from the tree. */
interface DeleteNodeMutation {
    op: 'deleteNode'
    /** `data-flint-id` of the element to remove. */
    nodeId: string
}

/** Sets an arbitrary JSX prop to a new serialised string or boolean value. */
interface UpdatePropMutation {
    op: 'updateProp'
    /** `data-flint-id` of the target element. */
    nodeId: string
    /** Prop name, e.g. `"aria-label"`, `"href"`, `"data-testid"`. */
    propName: string
    /** Value to set. Null deletes the attribute. */
    value: string | boolean | null
}

/** Updates the first direct JSXText child of a target element. */
interface UpdateTextContentMutation {
    op: 'updateTextContent'
    /** `data-flint-id` or structural `"tag:line:col"` ID of the element. */
    nodeId: string
    /** New text value to set. */
    text: string
}

/** Appends a new JSX element as the last child of a target node. */
interface InjectComponentMutation {
    op: 'injectComponent'
    /** `data-flint-id` of the target element to append into. */
    targetNodeId: string
    /** Raw JSX snippet, e.g. `'<Button>OK</Button>'`. */
    jsxSnippet: string
    /** Optional bare import statement to prepend, e.g. `"import { Button } from './Button'"`. */
    importSnippet?: string
}

/** Replaces a hardcoded Tailwind arbitrary-value class with a design-token class. */
interface ApplyTokenFixMutation {
    op: 'applyTokenFix'
    /** `data-flint-id` of the target element. */
    nodeId: string
    /** The exact hardcoded class to replace, e.g. `"bg-[#f3f3f3]"`. */
    hardcodedClass: string
    /** The token-derived replacement class, e.g. `"bg-brand-primary"`. */
    tokenClass: string
}

/**
 * A single declarative AST mutation operation.
 * The discriminant `op` field lets the batch executor switch safely
 * without type assertions.
 */
// ── CATALOG.1-3: Interactive UI mutation types ───────────────────────────────

interface EmitHookMutation { op: 'emitHook'; componentName: string; hookStatement: string; position?: 'first' | 'last' }
interface EmitHandlerMutation { op: 'emitHandler'; componentName: string; handlerCode: string }
interface EmitCallbackMutation { op: 'emitCallback'; nodeId: string; propName: string; expression: string }
interface EmitImportMutation { op: 'emitImport'; importSnippet: string }
interface EmitConditionalMutation { op: 'emitConditional'; nodeId: string; condition: string; mode: 'and' | 'ternary'; fallback?: string }
interface EmitMapMutation { op: 'emitMap'; nodeId: string; arrayExpression: string; iteratorName: string; keyExpression: string }
interface ComposeSlotMutation { op: 'composeSlot'; parentId: string; slotName: string; jsxSnippet: string; importSnippet?: string }

export type ASTMutation =
    | UpdateClassNameMutation
    | MoveNodeMutation
    | DeleteNodeMutation
    | UpdatePropMutation
    | UpdateTextContentMutation
    | InjectComponentMutation
    | ApplyTokenFixMutation
    | EmitHookMutation
    | EmitHandlerMutation
    | EmitCallbackMutation
    | EmitImportMutation
    | EmitConditionalMutation
    | EmitMapMutation
    | ComposeSlotMutation

// ── Side Effect Types ────────────────────────────────────────────────────────

/**
 * A deferred side effect produced by `applyMutationBatch`.
 * The batch engine is pure (parse → mutate → generate) and must not perform
 * IPC calls. Instead it returns side effect descriptors that the caller
 * (e.g. editorStore.applyBatch) executes after the batch completes.
 */
export type BatchSideEffect =
    | { type: 'clearOverride'; nodeId: string }

// ── Inverse Mutation Types (Phase D) ─────────────────────────────────────────

/**
 * Restores the entire source file to a known-good snapshot.
 * Used as the inverse of structural mutations (moveNode, deleteNode) where
 * surgical reversal would require position tracking across re-parses.
 */
interface RestoreCodeMutation {
    op: 'restoreCode'
    code: string
}

/**
 * An inverse mutation produced by `applyMutationBatch` for each applied
 * operation. Passing an `InverseMutation[]` to `applyInversions` reconstructs
 * the pre-batch source code.
 *
 * Property inverses (updateClassName / updateProp) carry the previous value.
 * Structural inverses (moveNode / deleteNode) carry a full code snapshot.
 */
export type InverseMutation =
    | UpdateClassNameMutation
    | UpdatePropMutation
    | UpdateTextContentMutation
    | RestoreCodeMutation

// ── Private helpers for the batch engine ─────────────────────────────────────

/**
 * Returns true when the JSX element at `path` matches `nodeId`.
 * Supports both flint IDs (data-flint-id attribute) and structural IDs
 * ("tagName:line:col" — matched by source location).
 */
function jsxMatchesId(
    path: NodePath<import('@babel/types').JSXElement>,
    nodeId: string
): boolean {
    const parts = nodeId.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    const isStructural = parts.length >= 2 && !isNaN(col) && !isNaN(line)

    if (isStructural) {
        const loc = path.node.loc
        return loc?.start.line === line && loc.start.column === col
    }

    for (const attr of path.node.openingElement.attributes) {
        if (
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'data-flint-id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === nodeId
        ) {
            return true
        }
    }
    return false
}

/**
 * Reads the current value of `propName` from the JSX element
 * identified by `nodeId`. Returns `null` when the element or prop is absent.
 */
function readCurrentPropValue(
    ast: import('@babel/types').File,
    nodeId: string,
    propName: string
): string | boolean | null {
    let value: string | boolean | null = null
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            if (!jsxMatchesId(path, nodeId)) return
            for (const attr of path.node.openingElement.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === propName
                ) {
                    if (attr.value?.type === 'StringLiteral') {
                        value = attr.value.value
                    } else if (attr.value === null) {
                        value = true
                    }
                    break
                }
            }
            path.stop()
        },
    })
    return value
}

/**
 * Reads the first non-empty JSXText child value from the element identified
 * by `nodeId`. Returns null when the element is absent or has no text child.
 */
function readCurrentTextContent(
    ast: import('@babel/types').File,
    nodeId: string
): string | null {
    let text: string | null = null
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            if (!jsxMatchesId(path, nodeId)) return
            for (const child of path.node.children) {
                if (child.type === 'JSXText') {
                    const trimmed = child.value.trim()
                    if (trimmed.length > 0) {
                        text = trimmed
                        break
                    }
                }
            }
            path.stop()
        },
    })
    return text
}

/**
 * Sets or creates `propName` to `value` as a StringLiteral on the JSX element
 * identified by `nodeId`. Mutates `ast` in-place.
 */
function applyUpdateProp(
    ast: import('@babel/types').File,
    nodeId: string,
    propName: string,
    value: string | boolean | null
): void {
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            if (!jsxMatchesId(path, nodeId)) return
            const opening = path.node.openingElement

            if (value === null) {
                opening.attributes = opening.attributes.filter(attr =>
                    !(attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier' && attr.name.name === propName)
                )
                path.stop()
                return
            }

            let found = false
            for (const attr of opening.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === propName
                ) {
                    ; (attr as import('@babel/types').JSXAttribute).value = typeof value === 'boolean' ? null : stringLiteral(value)
                    found = true
                    break
                }
            }
            if (!found) {
                opening.attributes.push(jsxAttr(jsxId(propName), typeof value === 'boolean' ? null : stringLiteral(value)))
            }
            path.stop()
        },
    })
}

/**
 * Removes the JSX element identified by `nodeId` from its parent's children
 * array. Mutates `ast` in-place. Silent no-op if the node is not found.
 */
function applyDeleteNode(
    ast: import('@babel/types').File,
    nodeId: string
): void {
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            if (!jsxMatchesId(path, nodeId)) return
            if (path.parent.type === 'JSXElement') {
                const children = (path.parent as import('@babel/types').JSXElement).children
                const idx = children.indexOf(path.node)
                if (idx !== -1) children.splice(idx, 1)
            }
            path.stop()
        },
    })
}

// ── Batch Mutation API (Phase D) ──────────────────────────────────────────────

/**
 * Applies an ordered batch of AST mutations to `code` in a **single**
 * parse → mutate → generate cycle, returning the new source and an
 * `InverseMutation[]` that reconstructs the pre-batch state when passed to
 * `applyInversions`.
 *
 * ### Inverse strategy
 * - `updateClassName` / `updateProp`: reads the current attribute value before
 *   mutation and stores it as a surgical reverse (old value → same prop).
 * - `moveNode` / `deleteNode`: stores a full code snapshot as `restoreCode`
 *   because structural changes cannot be inverted surgically without tracking
 *   positions across re-parses.
 *
 * If `code` cannot be parsed, returns the original code with an empty
 * inversions array (safe no-op).
 *
 * @param code      Raw TSX source string to mutate.
 * @param mutations Ordered list of operations applied left-to-right.
 * @returns         `{ code, inversions }` — mutated source and undo data.
 */
export function applyMutationBatch(
    code: string,
    mutations: ASTMutation[]
): { code: string; inversions: InverseMutation[]; sideEffects: BatchSideEffect[] } {
    if (mutations.length === 0) return { code, inversions: [], sideEffects: [] }

    const ast = parseCodeToAST(code)
    if (ast === null) return { code, inversions: [], sideEffects: [] }

    const inversions: InverseMutation[] = []
    const sideEffects: BatchSideEffect[] = []

    for (const mutation of mutations) {
        switch (mutation.op) {
            case 'updateClassName': {
                const oldClassRaw = readCurrentPropValue(ast, mutation.nodeId, 'className')
                const oldClass = typeof oldClassRaw === 'string' ? oldClassRaw : ''
                inversions.push({
                    op: 'updateClassName',
                    nodeId: mutation.nodeId,
                    className: oldClass,
                })
                updateJSXClassName(ast, mutation.nodeId, mutation.className)
                break
            }

            case 'updateProp': {
                const oldValue =
                    readCurrentPropValue(ast, mutation.nodeId, mutation.propName)
                inversions.push({
                    op: 'updateProp',
                    nodeId: mutation.nodeId,
                    propName: mutation.propName,
                    value: oldValue,
                })
                applyUpdateProp(ast, mutation.nodeId, mutation.propName, mutation.value)
                break
            }

            case 'updateTextContent': {
                const oldText = readCurrentTextContent(ast, mutation.nodeId) ?? ''
                inversions.push({
                    op: 'updateTextContent',
                    nodeId: mutation.nodeId,
                    text: oldText,
                })
                updateJSXTextContent(ast, mutation.nodeId, mutation.text)
                break
            }

            case 'moveNode': {
                // Re-generate from the current in-flight AST state so accumulated
                // earlier mutations in this batch are included in the snapshot.
                inversions.push({ op: 'restoreCode', code: generateCodeFromAST(ast) })
                moveNode(ast, mutation.sourceId, mutation.targetId, mutation.position)
                break
            }

            case 'deleteNode': {
                inversions.push({ op: 'restoreCode', code: generateCodeFromAST(ast) })
                applyDeleteNode(ast, mutation.nodeId)
                // Garbage Collection (Phase E — Commandment 12):
                // Signal the caller to clear any dangling component_overrides row
                // for this flint ID, preventing a "Zombie" export lock.
                // The actual IPC call is executed by the caller (editorStore.applyBatch)
                // after the batch completes — not inside this pure engine.
                sideEffects.push({ type: 'clearOverride', nodeId: mutation.nodeId })
                break
            }

            case 'injectComponent': {
                // Structural inverse: snapshot the pre-mutation code so that
                // a single Cmd+Z restores both the import and the injected element
                // atomically (Commandment 12 — Atomic Queuing).
                inversions.push({ op: 'restoreCode', code: generateCodeFromAST(ast) })
                injectComponent(ast, mutation.targetNodeId, mutation.jsxSnippet, mutation.importSnippet)
                break
            }

            case 'applyTokenFix': {
                // Snapshot-based inverse: captures the full pre-fix source so the
                // token substitution can be reversed exactly, regardless of how
                // many classes surround the target token.
                inversions.push({ op: 'restoreCode', code: generateCodeFromAST(ast) })
                applyTokenFix(ast, mutation.nodeId, mutation.hardcodedClass, mutation.tokenClass)
                break
            }

            // CATALOG.1-3: Renderer-side stubs — mutations deferred to MCP engine
            case 'emitHook':
            case 'emitHandler':
            case 'emitCallback':
            case 'emitImport':
            case 'emitConditional':
            case 'emitMap':
            case 'composeSlot': {
                inversions.push({ op: 'restoreCode', code: generateCodeFromAST(ast) })
                console.warn(`[ASTService] ${mutation.op}: renderer-side stub — mutation deferred to MCP engine`)
                break
            }

            default: {
                const _exhaustive: never = mutation
                throw new Error(`Unhandled mutation op: ${(_exhaustive as any).op}`)
            }
        }
    }

    return { code: generateCodeFromAST(ast), inversions, sideEffects }
}

// ── Pre-flight Zombie Check (Phase D) ─────────────────────────────────────────

/**
 * Returns `true` when the JSX element identified by `flintId` (data-flint-id
 * attribute) still exists in `code`.
 *
 * Used before applying an undo to detect "zombie" nodes — elements that were
 * deleted by a later edit and can therefore no longer receive a surgical
 * property-level inverse.
 *
 * Always returns `false` when `code` cannot be parsed.
 */
export function nodeExists(code: string, flintId: string): boolean {
    const ast = parseCodeToAST(code)
    if (ast === null) return false

    let found = false
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            for (const attr of path.node.openingElement.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'data-flint-id' &&
                    attr.value?.type === 'StringLiteral' &&
                    attr.value.value === flintId
                ) {
                    found = true
                    path.stop()
                    break
                }
            }
        },
    })
    return found
}

// ── Inversion Applier (Phase D) ───────────────────────────────────────────────

/**
 * Restores `currentCode` to its pre-batch state by applying `inversions`.
 *
 * If any inversion is a `restoreCode` snapshot, the snapshot is returned
 * immediately (structural mutations win — the entire pre-batch source is
 * restored). Otherwise the property-level inverses are applied via
 * `applyMutationBatch` in a single parse→generate cycle.
 *
 * Callers should run `nodeExists()` on each flint ID before calling this
 * to detect and block zombie-node undos.
 */
export function applyInversions(
    currentCode: string,
    inversions: InverseMutation[]
): string {
    // Structural inverse wins: return the snapshot immediately.
    for (const inv of inversions) {
        if (inv.op === 'restoreCode') return inv.code
    }

    // All-property batch: apply surgical inverses in a single cycle.
    const result = applyMutationBatch(currentCode, inversions as ASTMutation[])
    return result.code
}

// ── Import Synthesizer (Phase B) ──────────────────────────────────────────────
//
// @babel/types is a CJS package. Vite's electron-renderer plugin synthesises
// named ESM exports from the CJS `exports` object, so named imports work here
// in the renderer process exactly as they do in ast-parser.ts and astModifier.ts.

import type { File, JSXElement, JSXFragment } from '@babel/types'
import {
    importDeclaration,
    importDefaultSpecifier,
    importSpecifier,
    identifier,
    stringLiteral,
    isImportDeclaration,
    importNamespaceSpecifier,
    jsxAttribute as jsxAttr,
    jsxIdentifier as jsxId,
} from '@babel/types'
import { dirname, resolvePath, relativePath } from '../utils/pathUtils'

/**
 * Internal record for a single imported binding found in an origin file.
 * Stores enough info to recreate the appropriate specifier node in the target.
 */
interface ImportEntry {
    /** The module path, e.g. `'lucide-react'` or `'./Button'`. */
    sourceModule: string
    /** How the binding is imported. */
    specifierType: 'default' | 'named' | 'namespace'
    /** The local binding name used in the file, e.g. `Bar` in `import { Foo as Bar }`. */
    localName: string
    /** The original exported name, e.g. `Foo` in `import { Foo as Bar }`. */
    importedName: string
}

/**
 * Recursively walks a JSXElement (and its JSX-element descendants) collecting
 * every PascalCase tag name and the root of every JSXMemberExpression tag.
 * Native HTML tags (all-lowercase) are excluded.
 */
function collectComponentNames(root: JSXElement): Set<string> {
    const names = new Set<string>()

    function walkChildren(children: JSXElement['children'] | JSXFragment['children']): void {
        for (const child of children) {
            if (child.type === 'JSXElement') {
                const { name } = child.openingElement
                if (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name)) {
                    names.add(name.name)
                } else if (
                    name.type === 'JSXMemberExpression' &&
                    name.object.type === 'JSXIdentifier' &&
                    /^[A-Z]/.test(name.object.name)
                ) {
                    names.add(name.object.name)
                }
                walkChildren(child.children)
            } else if (child.type === 'JSXFragment') {
                walkChildren(child.children)
            }
        }
    }

    // Register the root element itself
    const { name } = root.openingElement
    if (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name)) {
        names.add(name.name)
    } else if (
        name.type === 'JSXMemberExpression' &&
        name.object.type === 'JSXIdentifier' &&
        /^[A-Z]/.test(name.object.name)
    ) {
        names.add(name.object.name)
    }

    walkChildren(root.children)
    return names
}

/**
 * Scans all top-level ImportDeclarations in `ast` and builds a map from
 * each local binding name to its import metadata.
 */
function buildImportMap(ast: File): Map<string, ImportEntry> {
    const map = new Map<string, ImportEntry>()

    for (const node of ast.program.body) {
        if (!isImportDeclaration(node)) continue
        const sourceModule = node.source.value

        for (const spec of node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
                map.set(spec.local.name, {
                    sourceModule,
                    specifierType: 'default',
                    localName: spec.local.name,
                    importedName: spec.local.name,
                })
            } else if (spec.type === 'ImportNamespaceSpecifier') {
                map.set(spec.local.name, {
                    sourceModule,
                    specifierType: 'namespace',
                    localName: spec.local.name,
                    importedName: spec.local.name,
                })
            } else if (spec.type === 'ImportSpecifier') {
                // spec.imported may be Identifier or StringLiteral
                const importedName =
                    spec.imported.type === 'StringLiteral'
                        ? spec.imported.value
                        : spec.imported.name
                map.set(spec.local.name, {
                    sourceModule,
                    specifierType: 'named',
                    localName: spec.local.name,
                    importedName,
                })
            }
        }
    }

    return map
}

/**
 * Returns true if `targetAST` already imports `localName` from `sourceModule`.
 * Checks at the specifier level so partial imports (e.g. `import { A }` when
 * we need `B` from the same module) are handled correctly.
 */
function hasImport(targetAST: File, sourceModule: string, localName: string): boolean {
    for (const node of targetAST.program.body) {
        if (!isImportDeclaration(node)) continue
        if (node.source.value !== sourceModule) continue
        for (const spec of node.specifiers) {
            if (spec.local.name === localName) return true
        }
    }
    return false
}

/**
 * Synthesizes and injects ImportDeclarations into `targetAST` for all
 * PascalCase component names (custom components, Lucide icons, etc.) found
 * in `jsxNode` and its descendants.
 *
 * Algorithm:
 *   1. Collect every PascalCase JSX tag name used in the subtree.
 *   2. For each name, look up its ImportDeclaration in `originAST`.
 *   3. Skip if not found in origin (may be a global or built-in).
 *   4. Skip if already imported in `targetAST` (specifier-level deduplication).
 *   5. Otherwise inject a new ImportDeclaration after the last existing import
 *      in `targetAST`.
 *
 * Mutates `targetAST` in-place and returns it. Pass a freshly-parsed copy.
 *
 * @param originAST  Babel File AST of the file the element is moving FROM.
 * @param jsxNode    The JSX subtree being relocated.
 * @param targetAST  Babel File AST of the destination file (mutated in-place).
 * @param sourcePath Absolute path of the origin file.
 * @param targetPath Absolute path of the destination file.
 * @returns          The mutated `targetAST`.
 */
export function synthesizeImports(
    originAST: File,
    jsxNode: JSXElement,
    targetAST: File,
    sourcePath: string,
    targetPath: string,
): File {
    const neededNames = collectComponentNames(jsxNode)
    if (neededNames.size === 0) return targetAST

    const originImports = buildImportMap(originAST)

    // Locate insertion point: after the last existing import in targetAST.
    let lastImportIdx = -1
    for (let i = 0; i < targetAST.program.body.length; i++) {
        if (isImportDeclaration(targetAST.program.body[i])) lastImportIdx = i
    }

    for (const name of neededNames) {
        const entry = originImports.get(name)
        if (entry === undefined) continue  // not found in origin — skip

        let finalSourceModule = entry.sourceModule
        if (finalSourceModule.startsWith('.')) {
            // It's a relative import. Resolve it via absolute paths.
            const absImport = resolvePath(dirname(sourcePath), finalSourceModule)
            finalSourceModule = relativePath(dirname(targetPath), absImport)
        }

        if (hasImport(targetAST, finalSourceModule, entry.localName)) continue  // already present

        // Build the appropriate import specifier node
        let newDecl: ReturnType<typeof importDeclaration>
        if (entry.specifierType === 'default') {
            newDecl = importDeclaration(
                [importDefaultSpecifier(identifier(entry.localName))],
                stringLiteral(finalSourceModule),
            )
        } else if (entry.specifierType === 'namespace') {
            newDecl = importDeclaration(
                [importNamespaceSpecifier(identifier(entry.localName))],
                stringLiteral(finalSourceModule),
            )
        } else {
            // named — preserve the original imported name in case of aliasing
            newDecl = importDeclaration(
                [importSpecifier(identifier(entry.localName), identifier(entry.importedName))],
                stringLiteral(finalSourceModule),
            )
        }

        // Insert after the current last-import position, then advance the cursor.
        lastImportIdx += 1
        targetAST.program.body.splice(lastImportIdx, 0, newDecl)
    }

    return targetAST
}
