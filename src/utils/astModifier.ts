/**
 * AST Modifier — src/utils/astModifier.ts
 *
 * Structural mutations on a Babel File AST for the drag-and-drop layer
 * reordering pipeline and component injection.
 *
 * moveNode() removes a source JSXElement from its parent and re-inserts it
 * relative to a target JSXElement. It mutates the provided AST in-place;
 * callers must pass a freshly-parsed copy (never the store's live ast) and
 * call generateCodeFromAST() afterwards.
 *
 * injectComponent() appends a new JSX element (parsed from a snippet string)
 * as the last child of the target node, and optionally prepends an import
 * declaration if one for that module is not already present.
 *
 * Node IDs use the same format produced by buildVisualTree in ast-parser.ts:
 * "<tagName>:<line>:<col>" — matched on source location, not tag name, so
 * multiple elements with the same tag are still uniquely addressable.
 *
 * No imports from the project — zero risk of circular dependencies.
 * Renderer Process only — no Node.js imports.
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import type {
    File,
    JSXElement,
    ImportDeclaration,
    ExpressionStatement,
} from '@babel/types'
import {
    isJSXElement,
    isImportDeclaration,
    jsxAttribute,
    jsxIdentifier,
    stringLiteral,
} from '@babel/types'
import type { NodePath } from '@babel/traverse'

// ── CJS interop ───────────────────────────────────────────────────────────────
// Same guard as ast-parser.ts — @babel/traverse is a CJS module.
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Types ─────────────────────────────────────────────────────────────────────

/** Where the dragged node lands relative to the drop target. */
export type DropPosition = 'before' | 'after' | 'inside'

interface FoundNode {
    node: JSXElement
    /**
     * The `children` array of the immediate JSXElement parent.
     * null when the parent is not a JSXElement (e.g. ReturnStatement),
     * meaning this is a top-level JSX root and cannot be repositioned via
     * before/after.
     */
    parentChildren: JSXElement['children'] | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Traverses the AST to find the JSXElement whose source location matches `id`.
 *
 * Supports two id formats:
 *   Structural: "tagName:line:col" — matched by source location.
 *   Bridge:     any other string   — matched by data-bridge-id attribute value.
 *
 * Bridge IDs are written by injectComponent and survive AST round-trips and
 * drag-and-drop reorderings, so they must be the preferred lookup key for
 * injected components.
 */
function findNode(ast: File, id: string): FoundNode | null {
    const parts = id.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    const isStructuralId = parts.length >= 2 && !isNaN(col) && !isNaN(line)

    let result: FoundNode | null = null

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            let matched = false

            if (isStructuralId) {
                const loc = path.node.loc
                matched = loc?.start.line === line && loc.start.column === col
            } else {
                // Bridge-id lookup: scan attributes for data-bridge-id === id.
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        attr.type === 'JSXAttribute' &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-bridge-id' &&
                        attr.value?.type === 'StringLiteral' &&
                        attr.value.value === id
                    ) {
                        matched = true
                        break
                    }
                }
            }

            if (!matched) return

            result = {
                node: path.node,
                parentChildren:
                    path.parent.type === 'JSXElement'
                        ? (path.parent as JSXElement).children
                        : null,
            }
            path.stop()
        },
    })

    return result
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Moves the JSX element identified by `sourceId` to a position relative to
 * the element identified by `targetId`.
 *
 * Positions:
 *   'before'  — insert as a sibling immediately before targetNode.
 *   'after'   — insert as a sibling immediately after targetNode.
 *   'inside'  — append as the last child of targetNode.
 *               Aborts silently when targetNode is self-closing.
 *
 * Returns the mutated `fileAST` on success, or the original unchanged AST
 * when either node cannot be found or the operation is not valid.
 *
 * The caller is responsible for passing a freshly-parsed copy of the AST and
 * for calling generateCodeFromAST() + parseCodeToAST() afterwards to obtain
 * a clean canonical AST with updated source locations.
 */
export function moveNode(
    fileAST: File,
    sourceId: string,
    targetId: string,
    position: DropPosition
): File {
    if (sourceId === targetId) return fileAST

    const src = findNode(fileAST, sourceId)
    const tgt = findNode(fileAST, targetId)
    if (src === null || tgt === null) return fileAST

    // Source must have a JSXElement parent to be extractable.
    if (src.parentChildren === null) return fileAST
    const srcIdx = src.parentChildren.indexOf(src.node)
    if (srcIdx === -1) return fileAST

    // Pre-validate target constraints before any mutation.
    if (position === 'inside') {
        // Self-closing elements cannot have children.
        if (tgt.node.openingElement.selfClosing) return fileAST
    } else {
        // before / after: target must also live inside a JSXElement parent.
        if (tgt.parentChildren === null) return fileAST
        if (tgt.parentChildren.indexOf(tgt.node) === -1) return fileAST
    }

    // ── Mutation ──────────────────────────────────────────────────────────────

    // Remove source from its parent.  If source and target share a parent,
    // this changes indices; indexOf(tgt.node) below is re-evaluated after
    // removal so it always reflects the current array state.
    src.parentChildren.splice(srcIdx, 1)

    if (position === 'inside') {
        tgt.node.children.push(src.node)
        return fileAST
    }

    // before / after — tgt.parentChildren validated as non-null above.
    if (tgt.parentChildren === null) {
        // Unreachable, but TypeScript needs the narrowing.
        src.parentChildren.splice(srcIdx, 0, src.node)
        return fileAST
    }

    const tgtIdx = tgt.parentChildren.indexOf(tgt.node)
    if (tgtIdx === -1) {
        // Target disappeared (edge case: source and target were the same parent
        // and the target was actually the removed node — guarded by sourceId !==
        // targetId above, but be safe).
        src.parentChildren.splice(srcIdx, 0, src.node)
        return fileAST
    }

    const insertAt = position === 'before' ? tgtIdx : tgtIdx + 1
    tgt.parentChildren.splice(insertAt, 0, src.node)

    return fileAST
}

// ── Private helpers for injectComponent ───────────────────────────────────────

/**
 * Parses a bare import statement string (e.g. `import { Foo } from 'bar'`) and
 * returns the first ImportDeclaration node, or null on any error.
 */
function parseImportSnippet(importSnippet: string): ImportDeclaration | null {
    try {
        const ast = parse(importSnippet, {
            sourceType: 'module',
            plugins: ['typescript'],
        })
        const node = ast.program.body[0]
        return node !== undefined && isImportDeclaration(node) ? node : null
    } catch {
        return null
    }
}

/**
 * Parses a JSX snippet string (e.g. `<Button>OK</Button>`) by wrapping it in a
 * dummy element so the parser sees valid JSX, then extracts the first
 * JSXElement child. Returns null on any parse error.
 */
function parseJSXSnippet(jsxSnippet: string): JSXElement | null {
    try {
        // Wrap in a unique root tag that is extremely unlikely to collide with
        // real component names and won't confuse code-generation.
        const wrapperAst = parse(`(<__bridge__>${jsxSnippet}</__bridge__>)`, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
        const body0 = wrapperAst.program.body[0]
        if (body0 === undefined || body0.type !== 'ExpressionStatement') return null
        const expr = (body0 as ExpressionStatement).expression
        if (!isJSXElement(expr)) return null
        const child = expr.children.find(isJSXElement)
        return child ?? null
    } catch {
        return null
    }
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Appends a new JSX element (parsed from `jsxSnippet`) as the last child of
 * the JSXElement identified by `targetNodeId`, and optionally prepends an
 * import declaration to the file if one for the same module is not already
 * present.
 *
 * Silent abort conditions (returns the original AST unchanged):
 *   · `jsxSnippet` cannot be parsed as JSX.
 *   · `targetNodeId` resolves to a self-closing element.
 *   · `targetNodeId` does not match any node in the AST.
 *
 * The caller is responsible for passing a freshly-parsed copy of the AST and
 * for calling generateCodeFromAST() + parseCodeToAST() afterwards.
 */
export function injectComponent(
    fileAST: File,
    targetNodeId: string,
    jsxSnippet: string,
    importSnippet?: string
): File {
    // ── Part 1: Import injection ──────────────────────────────────────────────
    if (importSnippet !== undefined) {
        const importDecl = parseImportSnippet(importSnippet)
        if (importDecl !== null) {
            const importSource = importDecl.source.value
            const alreadyPresent = fileAST.program.body.some(
                (node) => isImportDeclaration(node) && node.source.value === importSource
            )
            if (!alreadyPresent) {
                fileAST.program.body.unshift(importDecl)
            }
        }
    }

    // ── Part 2: JSX injection ─────────────────────────────────────────────────
    const newElement = parseJSXSnippet(jsxSnippet)
    if (newElement === null) return fileAST

    // Stamp a unique data-bridge-id before inserting so the IPC bridge can
    // select the element in the live preview.
    const bridgeId = Math.random().toString(36).slice(2, 9)
    newElement.openingElement.attributes.push(
        jsxAttribute(jsxIdentifier('data-bridge-id'), stringLiteral(bridgeId))
    )

    const tgt = findNode(fileAST, targetNodeId)
    if (tgt === null) return fileAST
    if (tgt.node.openingElement.selfClosing) return fileAST

    tgt.node.children.push(newElement)
    return fileAST
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Surgically replaces a single hardcoded Tailwind arbitrary-value class
 * in the `className` attribute of the JSX element identified by `nodeId`,
 * substituting it with the supplied token-derived class.
 *
 * All other classes — including other arbitrary values, standard Tailwind
 * utilities, and variant prefixes — are left untouched.
 *
 * @param fileAST      A freshly-parsed copy of the File AST (never the live
 *                     store reference — this function mutates in-place).
 * @param nodeId       Stable node id (bridge id or "tagName:line:col").
 * @param hardcodedClass  The exact class token to remove, including any
 *                        variant chain (e.g. "hover:bg-[#f3f3f3]").
 * @param tokenClass   The replacement class, including the same variant chain
 *                     (e.g. "hover:bg-brand-primary").
 *
 * Returns the (mutated) fileAST unchanged if the node or className cannot
 * be found, or if `hardcodedClass` is not present in the className string.
 */
export function applyTokenFix(
    fileAST: File,
    nodeId: string,
    hardcodedClass: string,
    tokenClass: string
): File {
    const found = findNode(fileAST, nodeId)
    if (found === null) return fileAST

    for (const attr of found.node.openingElement.attributes) {
        if (
            attr.type !== 'JSXAttribute' ||
            attr.name.type !== 'JSXIdentifier' ||
            attr.name.name !== 'className' ||
            attr.value?.type !== 'StringLiteral'
        ) {
            continue
        }

        const classes = attr.value.value.split(/\s+/).filter(Boolean)
        const idx = classes.indexOf(hardcodedClass)
        if (idx === -1) break  // class not present — nothing to do

        classes[idx] = tokenClass
        attr.value.value = classes.join(' ')
        break
    }

    return fileAST
}
