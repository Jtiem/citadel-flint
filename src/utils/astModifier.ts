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
import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import { isAncestorOf } from '../../shared/ast-utils'

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
 *   Flint:     any other string   — matched by data-flint-id attribute value.
 *
 * Flint IDs are written by injectComponent and survive AST round-trips and
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
                // Flint-id lookup: scan attributes for data-flint-id === id.
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        attr.type === 'JSXAttribute' &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-flint-id' &&
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

    // Guard: ancestor-to-descendant moves cause data loss.
    // Removing an ancestor from the tree also removes the target (its descendant),
    // leaving the source node orphaned.
    if (isAncestorOf(src.node, tgt.node)) {
        throw new Error(
            `moveNode: cannot move "${sourceId}" inside its own descendant "${targetId}" — this would cause data loss`
        )
    }

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
        const wrapperAst = parse(`(<__flint__>${jsxSnippet}</__flint__>)`, {
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

    // Stamp a unique data-flint-id before inserting so the IPC flint can
    // select the element in the live preview.
    const flintId = Math.random().toString(36).slice(2, 9)
    newElement.openingElement.attributes.push(
        jsxAttribute(jsxIdentifier('data-flint-id'), stringLiteral(flintId))
    )

    const tgt = findNode(fileAST, targetNodeId)
    if (tgt === null) return fileAST
    if (tgt.node.openingElement.selfClosing) return fileAST

    tgt.node.children.push(newElement)
    return fileAST
}

// ── Cross-file move helpers (Phase F.2) ───────────────────────────────────────

/**
 * Finds the JSX element identified by `nodeId`, removes it from its
 * parent's children array, and returns the detached node.
 *
 * Returns null when:
 *   · `nodeId` is not found in the AST.
 *   · The matching element has no JSXElement parent (it is a root node
 *     and cannot be extracted without destroying the return statement).
 *
 * Mutates `fileAST` in-place. The returned node is detached from the AST
 * and can safely be inserted into a different AST via `insertNode`.
 */
export function extractNode(fileAST: File, nodeId: string): JSXElement | null {
    const found = findNode(fileAST, nodeId)
    if (found === null || found.parentChildren === null) return null

    const idx = found.parentChildren.indexOf(found.node)
    if (idx === -1) return null

    found.parentChildren.splice(idx, 1)
    return found.node
}

/**
 * Inserts `node` into `fileAST` at `position` relative to the JSX element
 * identified by `targetId`.
 *
 * Positions:
 *   'before'  — insert as a sibling immediately before the target element.
 *   'after'   — insert as a sibling immediately after the target element.
 *   'inside'  — append as the last child of the target element.
 *               Returns false when the target is self-closing.
 *
 * Returns true on success. Returns false when the target cannot be found,
 * when the operation is structurally invalid (self-closing + 'inside'), or
 * when 'before'/'after' is requested on a root element with no JSXElement
 * parent.
 *
 * Mutates `fileAST` in-place. The caller is responsible for passing a
 * freshly-parsed copy and calling generateCodeFromAST() afterwards.
 */
export function insertNode(
    fileAST: File,
    node: JSXElement,
    targetId: string,
    position: DropPosition
): boolean {
    const tgt = findNode(fileAST, targetId)
    if (tgt === null) return false

    if (position === 'inside') {
        if (tgt.node.openingElement.selfClosing) return false
        tgt.node.children.push(node)
        return true
    }

    // before / after: target must have a JSXElement parent.
    if (tgt.parentChildren === null) return false
    const tgtIdx = tgt.parentChildren.indexOf(tgt.node)
    if (tgtIdx === -1) return false

    const insertAt = position === 'before' ? tgtIdx : tgtIdx + 1
    tgt.parentChildren.splice(insertAt, 0, node)
    return true
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
 * @param nodeId       Stable node id (flint id or "tagName:line:col").
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

// ── CATALOG.1-3: renderer-side mirrors ────────────────────────────────────────
//
// Exact mirrors of flint-mcp/src/core/ast-modifier.ts (CATALOG.1-3 exports).
// All functions operate on Babel ASTs only — no Node.js APIs — and are safe
// to call in the sandboxed renderer process.
//
// ASTService.ts stubs these ops with a restoreCode inversion until the approval
// flow confirms execution; at that point the Electron main process re-applies
// them via the MCP engine. These mirrors exist so type-checked callers and
// future renderer-side execution paths share a single signature source.

function parseExpression(expressionStr: string): t.Expression {
    const wrapper = parse(`(${expressionStr})`, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    const stmt = wrapper.program.body[0]
    if (!t.isExpressionStatement(stmt)) throw new Error(`Could not parse expression: ${expressionStr}`)
    return stmt.expression
}

function parseStatementSnippet(snippet: string): t.Statement {
    const wrapper = parse(snippet, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    if (wrapper.program.body.length === 0) throw new Error(`Could not parse statement: ${snippet}`)
    return wrapper.program.body[0]
}

function findComponentBody(ast: File, componentName: string): t.BlockStatement | null {
    let body: t.BlockStatement | null = null
    traverse(ast, {
        FunctionDeclaration(path) {
            if (path.node.id?.name === componentName && path.node.body) {
                body = path.node.body
                path.stop()
            }
        },
        VariableDeclarator(path) {
            if (!t.isIdentifier(path.node.id, { name: componentName })) return
            const init = path.node.init
            if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return
            if (t.isBlockStatement(init.body)) {
                body = init.body
            } else {
                // Concise arrow: () => <expr> — promote to block form.
                const newBlock = t.blockStatement([t.returnStatement(init.body as t.Expression)])
                init.body = newBlock
                body = newBlock
            }
            path.stop()
        },
    })
    return body
}

/**
 * Adds an import declaration to the file. If the same module source is already
 * imported, merges new specifiers rather than creating a second declaration.
 * Inserts after the last existing import, or at the top if none exist.
 *
 * Throws if `importSnippet` is not a valid import statement.
 */
export function emitImport(ast: File, importSnippet: string): void {
    const parsed = parse(importSnippet, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    const newImport = parsed.program.body[0]
    if (!t.isImportDeclaration(newImport)) throw new Error(`Not a valid import: ${importSnippet}`)
    const source = newImport.source.value
    for (const node of ast.program.body) {
        if (t.isImportDeclaration(node) && node.source.value === source) {
            for (const spec of newImport.specifiers) {
                const exists = node.specifiers.some(ex => {
                    if (t.isImportSpecifier(spec) && t.isImportSpecifier(ex))
                        return (t.isIdentifier(spec.imported) ? spec.imported.name : '') ===
                               (t.isIdentifier(ex.imported) ? ex.imported.name : '')
                    if (t.isImportDefaultSpecifier(spec) && t.isImportDefaultSpecifier(ex)) return true
                    if (t.isImportNamespaceSpecifier(spec) && t.isImportNamespaceSpecifier(ex)) return true
                    return false
                })
                if (!exists) node.specifiers.push(spec)
            }
            return
        }
    }
    let lastIdx = -1
    for (let i = 0; i < ast.program.body.length; i++) {
        if (t.isImportDeclaration(ast.program.body[i])) lastIdx = i
    }
    ast.program.body.splice(lastIdx + 1, 0, newImport)
}

/**
 * Injects a hook call statement inside the named component's function body.
 * `position` controls placement:
 *   'first' — unshifted to the top (before all other statements).
 *   'last'  — inserted before the return statement (default).
 *
 * Throws if the component cannot be found or `hookStatement` is invalid.
 */
export function emitHook(
    ast: File,
    componentName: string,
    hookStatement: string,
    position: 'first' | 'last' = 'last'
): void {
    const body = findComponentBody(ast, componentName)
    if (!body) throw new Error(`Component not found: ${componentName}`)
    const stmt = parseStatementSnippet(hookStatement)
    if (position === 'first') {
        body.body.unshift(stmt)
    } else {
        let idx = 0
        for (let i = 0; i < body.body.length; i++) {
            if (t.isReturnStatement(body.body[i])) break
            idx = i + 1
        }
        body.body.splice(idx, 0, stmt)
    }
}

/**
 * Injects a handler function declaration inside the named component's body,
 * immediately before the return statement.
 *
 * Throws if the component cannot be found or `handlerCode` is invalid.
 */
export function emitHandler(ast: File, componentName: string, handlerCode: string): void {
    const body = findComponentBody(ast, componentName)
    if (!body) throw new Error(`Component not found: ${componentName}`)
    const stmt = parseStatementSnippet(handlerCode)
    let ri = body.body.findIndex(n => t.isReturnStatement(n))
    if (ri === -1) ri = body.body.length
    body.body.splice(ri, 0, stmt)
}

/**
 * Wires a handler expression to an event prop on the JSX element identified
 * by `nodeId` (data-flint-id). If the prop already exists, it is replaced.
 *
 * Throws if the node cannot be found or `expression` is invalid JS.
 */
export function emitCallback(
    ast: File,
    nodeId: string,
    propName: string,
    expression: string
): void {
    let found = false
    traverse(ast, {
        JSXOpeningElement(path) {
            const attrs = path.node.attributes
            const ba = attrs.find(a =>
                t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'data-flint-id' })
            )
            if (!ba || !t.isJSXAttribute(ba)) return
            if (!t.isStringLiteral(ba.value) || ba.value.value !== nodeId) return
            const pe = parseExpression(expression)
            const na = t.jsxAttribute(t.jsxIdentifier(propName), t.jsxExpressionContainer(pe))
            const ei = attrs.findIndex(a =>
                t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: propName })
            )
            if (ei >= 0) attrs[ei] = na
            else attrs.push(na)
            found = true
            path.stop()
        },
    })
    if (!found) throw new Error(`Node not found: ${nodeId}`)
}

/**
 * Wraps the JSX element identified by `nodeId` in a conditional rendering
 * expression:
 *   'and'     → {condition && <Element/>}
 *   'ternary' → {condition ? <Element/> : <Fallback/>}
 *
 * Silently no-ops when the element has no JSXElement parent.
 * Throws if the node cannot be found.
 */
export function emitConditional(
    ast: File,
    nodeId: string,
    condition: string,
    mode: 'and' | 'ternary',
    fallback?: string
): void {
    const found = findNode(ast, nodeId)
    if (!found) throw new Error(`Node not found: ${nodeId}`)
    if (!found.parentChildren) return
    const condExpr = parseExpression(condition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children = found.parentChildren as any[]
    const idx = children.indexOf(found.node)
    if (idx === -1) return
    let expr: t.Expression
    if (mode === 'ternary') {
        const fb = fallback && fallback !== 'null' ? parseExpression(fallback) : t.nullLiteral()
        expr = t.conditionalExpression(condExpr, found.node as unknown as t.Expression, fb)
    } else {
        expr = t.logicalExpression('&&', condExpr, found.node as unknown as t.Expression)
    }
    children[idx] = t.jsxExpressionContainer(expr)
}

/**
 * Wraps the JSX element identified by `nodeId` in an `array.map()` expression,
 * injecting a stable `key` prop (Commandment 3).
 *
 * `keyExpression` MUST reference a stable identifier — "index" or any
 * expression ending in ".index" is rejected.
 *
 * Silently no-ops when the element has no JSXElement parent.
 * Throws if the node cannot be found or the key expression is invalid.
 */
export function emitMap(
    ast: File,
    nodeId: string,
    arrayExpression: string,
    iteratorName: string,
    keyExpression: string
): void {
    if (keyExpression === 'index' || keyExpression.endsWith('.index'))
        throw new Error('emitMap: keyExpression must not be "index" (Commandment 3)')
    const found = findNode(ast, nodeId)
    if (!found) throw new Error(`Node not found: ${nodeId}`)
    if (!found.parentChildren) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children = found.parentChildren as any[]
    const idx = children.indexOf(found.node)
    if (idx === -1) return
    const keyAttr = t.jsxAttribute(
        t.jsxIdentifier('key'),
        t.jsxExpressionContainer(parseExpression(keyExpression))
    )
    const attrs = found.node.openingElement.attributes
    const eki = attrs.findIndex(a =>
        t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'key' })
    )
    if (eki >= 0) attrs[eki] = keyAttr
    else attrs.push(keyAttr)
    const ae = parseExpression(arrayExpression)
    const mc = t.callExpression(
        t.memberExpression(ae, t.identifier('map')),
        [t.arrowFunctionExpression([t.identifier(iteratorName)], found.node as unknown as t.Expression)]
    )
    children[idx] = t.jsxExpressionContainer(mc)
}

/**
 * Parses a JSX snippet and returns all top-level JSXElement children.
 * Used by composeSlot to support multi-element slot content.
 */
function parseJSXSnippetChildren(jsxSnippet: string): JSXElement[] {
    try {
        const wrapperAst = parse(`(<__flint__>${jsxSnippet}</__flint__>)`, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
        const body0 = wrapperAst.program.body[0]
        if (body0 === undefined || body0.type !== 'ExpressionStatement') return []
        const expr = (body0 as ExpressionStatement).expression
        if (!isJSXElement(expr)) return []
        return expr.children.filter((c): c is JSXElement => isJSXElement(c))
    } catch {
        return []
    }
}

/**
 * Inserts content into a compound component slot (e.g. Dialog.Header, Tabs.Panel).
 * If the named slot already exists among the parent's children, snippet nodes are
 * appended to it. If not, a new slot element is created and prepended.
 *
 * `slotName` must be in "Component.Slot" dot format.
 *
 * Throws if the parent node is not found or `slotName` is malformed.
 */
export function composeSlot(
    ast: File,
    parentId: string,
    slotName: string,
    jsxSnippet: string,
    importSnippetStr?: string
): void {
    const found = findNode(ast, parentId)
    if (!found) {
        throw new Error(`composeSlot: parent node not found for flint ID "${parentId}"`)
    }

    const dotIndex = slotName.indexOf('.')
    if (dotIndex === -1 || dotIndex === 0 || dotIndex === slotName.length - 1) {
        throw new Error(`composeSlot: invalid slot name "${slotName}" — must be "Component.Slot" format`)
    }
    const objectName = slotName.slice(0, dotIndex)
    const propertyName = slotName.slice(dotIndex + 1)

    const snippetNodes = parseJSXSnippetChildren(jsxSnippet)
    if (snippetNodes.length === 0) return

    if (importSnippetStr) {
        const importAst = parse(importSnippetStr, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
        const importDecl = importAst.program.body[0]
        if (importDecl !== undefined && isImportDeclaration(importDecl)) {
            const exists = ast.program.body.some(
                n => isImportDeclaration(n) &&
                     (n as ImportDeclaration).source.value === (importDecl as ImportDeclaration).source.value
            )
            if (!exists) {
                let lastImportIdx = -1
                for (let i = 0; i < ast.program.body.length; i++) {
                    if (isImportDeclaration(ast.program.body[i])) lastImportIdx = i
                }
                ast.program.body.splice(lastImportIdx + 1, 0, importDecl)
            }
        }
    }

    if (found.node.openingElement.selfClosing) {
        found.node.openingElement.selfClosing = false
        found.node.closingElement = t.jsxClosingElement(
            found.node.openingElement.name as unknown as t.JSXMemberExpression
        )
        found.node.children = []
    }

    const existingSlot = found.node.children.find((child): child is JSXElement => {
        if (!isJSXElement(child)) return false
        const name = child.openingElement.name
        return (
            t.isJSXMemberExpression(name) &&
            t.isJSXIdentifier(name.object) && name.object.name === objectName &&
            t.isJSXIdentifier(name.property) && name.property.name === propertyName
        )
    })

    if (existingSlot) {
        for (const node of snippetNodes) {
            existingSlot.children.push(node)
        }
    } else {
        const openMember = t.jsxMemberExpression(t.jsxIdentifier(objectName), t.jsxIdentifier(propertyName))
        const closeMember = t.jsxMemberExpression(t.jsxIdentifier(objectName), t.jsxIdentifier(propertyName))
        const opening = t.jsxOpeningElement(openMember, [], false)
        const closing = t.jsxClosingElement(closeMember)
        const slotElement = t.jsxElement(opening, closing, snippetNodes as unknown as JSXElement['children'], false)
        found.node.children.unshift(slotElement)
    }
}
