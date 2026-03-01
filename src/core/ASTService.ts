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
import { parseCodeToAST, generateCodeFromAST, updateJSXClassName } from './ast-parser'
// ── Structural mutation helpers ───────────────────────────────────────────────
import { moveNode } from '../utils/astModifier'
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
    /** The `data-bridge-id` or structural `"tag:line:col"` ID of the element. */
    nodeId: string
    /** Full Tailwind class string to set. */
    className: string
}

/** Moves a JSX element relative to another element in the tree. */
interface MoveNodeMutation {
    op: 'moveNode'
    /** `data-bridge-id` of the element to move. */
    sourceId: string
    /** `data-bridge-id` of the reference element. */
    targetId: string
    /** Insertion relationship relative to `targetId`. */
    position: 'before' | 'after' | 'inside'
}

/** Removes a JSX element (and all its children) from the tree. */
interface DeleteNodeMutation {
    op: 'deleteNode'
    /** `data-bridge-id` of the element to remove. */
    nodeId: string
}

/** Sets an arbitrary JSX prop to a new serialised string value. */
interface UpdatePropMutation {
    op: 'updateProp'
    /** `data-bridge-id` of the target element. */
    nodeId: string
    /** Prop name, e.g. `"aria-label"`, `"href"`, `"data-testid"`. */
    propName: string
    /** Serialised string value, e.g. `"true"`, `"#fff"`, a URL. */
    value: string
}

/**
 * A single declarative AST mutation operation.
 * The discriminant `op` field lets the batch executor switch safely
 * without type assertions.
 */
export type ASTMutation =
    | UpdateClassNameMutation
    | MoveNodeMutation
    | DeleteNodeMutation
    | UpdatePropMutation

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
    | RestoreCodeMutation

// ── Private helpers for the batch engine ─────────────────────────────────────

/**
 * Returns true when the JSX element at `path` matches `nodeId`.
 * Supports both bridge IDs (data-bridge-id attribute) and structural IDs
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
            attr.name.name === 'data-bridge-id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === nodeId
        ) {
            return true
        }
    }
    return false
}

/**
 * Reads the current StringLiteral value of `propName` from the JSX element
 * identified by `nodeId`. Returns `null` when the element or prop is absent.
 */
function readCurrentPropValue(
    ast: import('@babel/types').File,
    nodeId: string,
    propName: string
): string | null {
    let value: string | null = null
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            if (!jsxMatchesId(path, nodeId)) return
            for (const attr of path.node.openingElement.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === propName &&
                    attr.value?.type === 'StringLiteral'
                ) {
                    value = attr.value.value
                    break
                }
            }
            path.stop()
        },
    })
    return value
}

/**
 * Sets or creates `propName` to `value` as a StringLiteral on the JSX element
 * identified by `nodeId`. Mutates `ast` in-place.
 */
function applyUpdateProp(
    ast: import('@babel/types').File,
    nodeId: string,
    propName: string,
    value: string
): void {
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            if (!jsxMatchesId(path, nodeId)) return
            const attrs = path.node.openingElement.attributes
            let found = false
            for (const attr of attrs) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === propName
                ) {
                    ; (attr as import('@babel/types').JSXAttribute).value = stringLiteral(value)
                    found = true
                    break
                }
            }
            if (!found) {
                attrs.push(jsxAttr(jsxId(propName), stringLiteral(value)))
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
): { code: string; inversions: InverseMutation[] } {
    if (mutations.length === 0) return { code, inversions: [] }

    const ast = parseCodeToAST(code)
    if (ast === null) return { code, inversions: [] }

    const inversions: InverseMutation[] = []

    for (const mutation of mutations) {
        switch (mutation.op) {
            case 'updateClassName': {
                const oldClass = readCurrentPropValue(ast, mutation.nodeId, 'className') ?? ''
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
                    readCurrentPropValue(ast, mutation.nodeId, mutation.propName) ?? ''
                inversions.push({
                    op: 'updateProp',
                    nodeId: mutation.nodeId,
                    propName: mutation.propName,
                    value: oldValue,
                })
                applyUpdateProp(ast, mutation.nodeId, mutation.propName, mutation.value)
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
                // After a successful AST deletion, fire the IPC cleanup so the
                // main process can remove any dangling component_overrides row for
                // this bridge ID, preventing a "Zombie" export lock.
                // Optional-chained: degrades gracefully until the main-process
                // handler is registered. Guarded against headless test environments.
                if (typeof window !== 'undefined') {
                    void window.bridgeAPI.tokens.clearOverride?.(mutation.nodeId)
                }
                break
            }
        }
    }

    return { code: generateCodeFromAST(ast), inversions }
}

// ── Pre-flight Zombie Check (Phase D) ─────────────────────────────────────────

/**
 * Returns `true` when the JSX element identified by `bridgeId` (data-bridge-id
 * attribute) still exists in `code`.
 *
 * Used before applying an undo to detect "zombie" nodes — elements that were
 * deleted by a later edit and can therefore no longer receive a surgical
 * property-level inverse.
 *
 * Always returns `false` when `code` cannot be parsed.
 */
export function nodeExists(code: string, bridgeId: string): boolean {
    const ast = parseCodeToAST(code)
    if (ast === null) return false

    let found = false
    _tv(ast, {
        JSXElement(path: NodePath<import('@babel/types').JSXElement>) {
            for (const attr of path.node.openingElement.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'data-bridge-id' &&
                    attr.value?.type === 'StringLiteral' &&
                    attr.value.value === bridgeId
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
 * Callers should run `nodeExists()` on each bridge ID before calling this
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
