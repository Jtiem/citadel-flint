/**
 * AST Modifier — flint-mcp/src/core/ast-modifier.ts
 *
 * Babel AST mutation module for the Flint MCP server. All functions take a
 * Babel `File` AST as their first argument, mutate it in-place, and return
 * the same AST reference.
 *
 * Node IDs support two formats:
 *   Structural: "tagName:line:col" — matched by source location.
 *   Flint:     any other string   — matched by data-flint-id attribute value.
 *
 * All functions silently abort (return the original AST) when the target node
 * cannot be found or the requested operation is structurally invalid.
 *
 * No imports from the rest of the project — zero risk of circular dependencies.
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import type { File, JSXElement, ImportDeclaration, ExpressionStatement, Statement, BlockStatement, Expression } from '@babel/types'
import {
    isJSXElement,
    isImportDeclaration,
    isJSXMemberExpression,
    isJSXText,
    isJSXAttribute,
    isJSXIdentifier,
    isStringLiteral,
    isImportSpecifier,
    isImportDefaultSpecifier,
    isImportNamespaceSpecifier,
    isReturnStatement,
    isArrowFunctionExpression,
    isFunctionExpression,
    isBlockStatement,
    isIdentifier,
    isExpressionStatement,
    jsxAttribute,
    jsxIdentifier,
    jsxMemberExpression,
    stringLiteral,
    numericLiteral,
    booleanLiteral,
    jsxExpressionContainer,
    jsxText,
    jsxElement,
    jsxOpeningElement,
    jsxClosingElement,
    returnStatement,
    blockStatement,
} from '@babel/types'
import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
// Inline isAncestorOf to avoid cross-rootDir import from shared/
function isAncestorOf(ancestor: any, target: any): boolean {
    if (!ancestor || !target) return false;
    const children = ancestor.children ?? ancestor.body ?? [];
    for (const child of Array.isArray(children) ? children : []) {
        if (child === target) return true;
        if (isAncestorOf(child, target)) return true;
    }
    return false;
}

// ── CJS interop ───────────────────────────────────────────────────────────────
// @babel/traverse ships as CJS; ESM interop varies by bundler/runtime.
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

const generate =
    typeof (_generate as any).default === 'function'
        ? (_generate as any).default
        : _generate

// ── Types ─────────────────────────────────────────────────────────────────────

export type DropPosition = 'before' | 'after' | 'inside'

interface FoundNode {
    node: JSXElement
    /**
     * The `children` array of the immediate JSXElement parent.
     * null when the parent is not a JSXElement (e.g. ReturnStatement).
     */
    parentChildren: JSXElement['children'] | null
}

/**
 * Layout descriptor for assembleLayout. All fields are optional.
 */
export interface AssembleLayoutPayload {
    children?: Array<{ jsxSnippet: string; importSnippet?: string }>
    layout?: {
        display?: string
        direction?: string
        gap?: string
        alignItems?: string
        justifyContent?: string
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Traverses the AST to find the JSXElement whose structural id or Flint id
 * matches `id`.
 *
 * Structural id:  "tagName:line:col" — the last two colon-delimited segments
 *                 are parsed as column and line numbers.
 * Flint id:      any other string   — matched against the data-flint-id
 *                 JSX attribute value.
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

/**
 * Parses a bare import statement string and returns the first
 * ImportDeclaration node, or null on any error.
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
 * Parses a JSX snippet string by wrapping it in a dummy root element and
 * extracting the first JSXElement child. Returns null on any parse error.
 */
function parseJSXSnippet(jsxSnippet: string): JSXElement | null {
    try {
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

/**
 * Stamps a unique data-flint-id attribute on a JSXElement in-place.
 */
function stampFlintId(node: JSXElement): void {
    const flintId = Math.random().toString(36).slice(2, 9)
    node.openingElement.attributes.push(
        jsxAttribute(jsxIdentifier('data-flint-id'), stringLiteral(flintId))
    )
}

/**
 * Builds a Tailwind layout className string from a layout descriptor.
 * Only defined (non-empty) values produce classes.
 */
function buildLayoutClasses(layout: AssembleLayoutPayload['layout']): string {
    if (!layout) return ''
    const classes: string[] = []

    if (layout.display) classes.push(layout.display)

    if (layout.direction) {
        // direction can be 'row' | 'row-reverse' | 'col' | 'col-reverse'
        // Accept both 'column' and 'col' inputs.
        const dir = layout.direction.replace('column', 'col')
        classes.push(`flex-${dir}`)
    }

    if (layout.gap) {
        // Caller may pass a raw Tailwind class ('gap-4') or a bare value ('4').
        classes.push(layout.gap.startsWith('gap') ? layout.gap : `gap-${layout.gap}`)
    }

    if (layout.alignItems) {
        // Accept 'center', 'start', 'end', 'stretch', 'baseline' or prefixed.
        const ai = layout.alignItems.startsWith('items-')
            ? layout.alignItems
            : `items-${layout.alignItems}`
        classes.push(ai)
    }

    if (layout.justifyContent) {
        const jc = layout.justifyContent.startsWith('justify-')
            ? layout.justifyContent
            : `justify-${layout.justifyContent}`
        classes.push(jc)
    }

    return classes.join(' ')
}

// ── Exported mutation functions ───────────────────────────────────────────────

/**
 * Moves the JSX element identified by `sourceId` to a position relative to
 * the element identified by `targetId`.
 *
 * Positions:
 *   'before'  — insert as a sibling immediately before targetNode.
 *   'after'   — insert as a sibling immediately after targetNode.
 *   'inside'  — append as the last child of targetNode.
 *               Aborts silently when targetNode is self-closing.
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

    if (position === 'inside') {
        if (tgt.node.openingElement.selfClosing) return fileAST
    } else {
        if (tgt.parentChildren === null) return fileAST
        if (tgt.parentChildren.indexOf(tgt.node) === -1) return fileAST
    }

    src.parentChildren.splice(srcIdx, 1)

    if (position === 'inside') {
        tgt.node.children.push(src.node)
        return fileAST
    }

    if (tgt.parentChildren === null) {
        src.parentChildren.splice(srcIdx, 0, src.node)
        return fileAST
    }

    const tgtIdx = tgt.parentChildren.indexOf(tgt.node)
    if (tgtIdx === -1) {
        src.parentChildren.splice(srcIdx, 0, src.node)
        return fileAST
    }

    const insertAt = position === 'before' ? tgtIdx : tgtIdx + 1
    tgt.parentChildren.splice(insertAt, 0, src.node)

    return fileAST
}

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
 */
export function injectComponent(
    fileAST: File,
    targetNodeId: string,
    jsxSnippet: string,
    importSnippet?: string
): File {
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

    const newElement = parseJSXSnippet(jsxSnippet)
    if (newElement === null) return fileAST

    stampFlintId(newElement)

    const tgt = findNode(fileAST, targetNodeId)
    if (tgt === null) return fileAST
    if (tgt.node.openingElement.selfClosing) return fileAST

    tgt.node.children.push(newElement)
    return fileAST
}

/**
 * Surgically replaces a single hardcoded Tailwind class in the `className`
 * attribute of the JSX element identified by `nodeId`, substituting it with
 * the supplied token-derived class.
 *
 * All other classes are left untouched. Returns the original AST unchanged
 * if the node, className attribute, or hardcoded class cannot be found.
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
        if (idx === -1) break

        classes[idx] = tokenClass
        attr.value.value = classes.join(' ')
        break
    }

    return fileAST
}

/**
 * Removes the JSX element identified by `nodeId` from its parent's children
 * array. Silently aborts if the node is not found or has no JSXElement parent
 * (i.e. it is a root node that cannot be safely removed).
 */
export function deleteNode(fileAST: File, nodeId: string): File {
    const found = findNode(fileAST, nodeId)
    if (found === null) return fileAST
    if (found.parentChildren === null) return fileAST

    const idx = found.parentChildren.indexOf(found.node)
    if (idx === -1) return fileAST

    found.parentChildren.splice(idx, 1)
    return fileAST
}

/**
 * Finds or creates the JSX attribute with name `propName` on the element
 * identified by `nodeId` and sets its value to `value`.
 *
 * Value coercion:
 *   · boolean  → JSXExpressionContainer wrapping BooleanLiteral
 *   · number   → JSXExpressionContainer wrapping NumericLiteral
 *   · string   → StringLiteral
 *
 * Silently aborts if the node cannot be found.
 */
export function updateProp(
    fileAST: File,
    nodeId: string,
    propName: string,
    value: string | number | boolean
): File {
    const found = findNode(fileAST, nodeId)
    if (found === null) return fileAST

    const attrs = found.node.openingElement.attributes

    // Build the new attribute value node.
    let attrValue:
        | ReturnType<typeof stringLiteral>
        | ReturnType<typeof jsxExpressionContainer>

    if (typeof value === 'boolean') {
        attrValue = jsxExpressionContainer(booleanLiteral(value))
    } else if (typeof value === 'number') {
        attrValue = jsxExpressionContainer(numericLiteral(value))
    } else {
        attrValue = stringLiteral(value)
    }

    // Try to update an existing attribute.
    for (const attr of attrs) {
        if (
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === propName
        ) {
            attr.value = attrValue
            return fileAST
        }
    }

    // Attribute not found — create and append.
    attrs.push(jsxAttribute(jsxIdentifier(propName), attrValue))
    return fileAST
}

/**
 * Replaces the `className` attribute value on the element identified by
 * `nodeId` with `className`. If no className attribute exists, one is created.
 *
 * Silently aborts if the node cannot be found.
 */
export function updateClassName(
    fileAST: File,
    nodeId: string,
    className: string
): File {
    const found = findNode(fileAST, nodeId)
    if (found === null) return fileAST

    const attrs = found.node.openingElement.attributes

    for (const attr of attrs) {
        if (
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'className'
        ) {
            attr.value = stringLiteral(className)
            return fileAST
        }
    }

    // No className attribute yet — add one.
    attrs.push(jsxAttribute(jsxIdentifier('className'), stringLiteral(className)))
    return fileAST
}

/**
 * Replaces all JSXText children of the element identified by `nodeId` with a
 * single JSXText node containing `text`. Non-text children (JSXElement,
 * JSXExpressionContainer, etc.) are removed.
 *
 * Silently aborts if the node cannot be found or is self-closing.
 */
export function updateTextContent(fileAST: File, nodeId: string, text: string): File {
    const found = findNode(fileAST, nodeId)
    if (found === null) return fileAST
    if (found.node.openingElement.selfClosing) return fileAST

    // Replace all children with a single text node.
    found.node.children = [jsxText(text)]

    return fileAST
}

/**
 * Wraps the JSX element identified by `nodeId` in a new JSX element with the
 * tag name `wrapperElement`. The found node becomes the only child of the
 * new wrapper. The wrapper replaces the found node in its parent's children
 * array.
 *
 * Silently aborts if:
 *   · The node cannot be found.
 *   · The node has no JSXElement parent (root node cannot be re-parented).
 *   · `wrapperElement` is an empty string.
 */
export function wrapNode(
    fileAST: File,
    nodeId: string,
    wrapperElement: string
): File {
    if (!wrapperElement) return fileAST

    const found = findNode(fileAST, nodeId)
    if (found === null) return fileAST
    if (found.parentChildren === null) return fileAST

    const idx = found.parentChildren.indexOf(found.node)
    if (idx === -1) return fileAST

    const openTag = jsxOpeningElement(jsxIdentifier(wrapperElement), [], false)
    const closeTag = jsxClosingElement(jsxIdentifier(wrapperElement))
    const wrapper = jsxElement(openTag, closeTag, [found.node], false)

    found.parentChildren.splice(idx, 1, wrapper)

    return fileAST
}

/**
 * Assembles a layout on the element identified by `targetNodeId`.
 *
 * If `payload.children` is provided, each entry's `jsxSnippet` is parsed and
 * appended as a child of the target node (same logic as `injectComponent`).
 * If `importSnippet` is provided and not already present, it is prepended to
 * the file's import list.
 *
 * If `payload.layout` is provided, Tailwind layout classes are derived from
 * the layout descriptor and appended to (or create) the element's className
 * attribute.
 *
 * Silently aborts if the target node cannot be found.
 */
export function assembleLayout(
    fileAST: File,
    targetNodeId: string,
    payload: AssembleLayoutPayload
): File {
    const tgt = findNode(fileAST, targetNodeId)
    if (tgt === null) return fileAST

    // ── 1. Inject children ────────────────────────────────────────────────────
    if (payload.children && payload.children.length > 0) {
        for (const child of payload.children) {
            // Handle import for this child.
            if (child.importSnippet !== undefined) {
                const importDecl = parseImportSnippet(child.importSnippet)
                if (importDecl !== null) {
                    const importSource = importDecl.source.value
                    const alreadyPresent = fileAST.program.body.some(
                        (node) =>
                            isImportDeclaration(node) && node.source.value === importSource
                    )
                    if (!alreadyPresent) {
                        fileAST.program.body.unshift(importDecl)
                    }
                }
            }

            // Skip self-closing targets — they cannot receive children.
            if (tgt.node.openingElement.selfClosing) continue

            const newElement = parseJSXSnippet(child.jsxSnippet)
            if (newElement === null) continue

            stampFlintId(newElement)
            tgt.node.children.push(newElement)
        }
    }

    // ── 2. Apply layout classes ───────────────────────────────────────────────
    if (payload.layout) {
        const layoutClasses = buildLayoutClasses(payload.layout)
        if (layoutClasses) {
            const attrs = tgt.node.openingElement.attributes
            let applied = false

            for (const attr of attrs) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'className' &&
                    attr.value?.type === 'StringLiteral'
                ) {
                    const existing = attr.value.value.trim()
                    attr.value.value = existing ? `${existing} ${layoutClasses}` : layoutClasses
                    applied = true
                    break
                }
            }

            if (!applied) {
                attrs.push(
                    jsxAttribute(jsxIdentifier('className'), stringLiteral(layoutClasses))
                )
            }
        }
    }

    return fileAST
}

// ── CATALOG.1: Import + Hook + Handler + Callback ops ─────────────────────

function parseExpression(expressionStr: string): Expression {
    const wrapper = parse(`(${expressionStr})`, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    const stmt = wrapper.program.body[0]
    if (!t.isExpressionStatement(stmt)) throw new Error(`Could not parse expression: ${expressionStr}`)
    return stmt.expression
}

function parseStatementSnippet(code: string): Statement {
    const wrapper = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    if (wrapper.program.body.length === 0) throw new Error(`Could not parse statement: ${code}`)
    return wrapper.program.body[0]
}

function findComponentBody(ast: File, componentName: string): BlockStatement | null {
    let body: BlockStatement | null = null
    traverse(ast, {
        FunctionDeclaration(path) {
            if (path.node.id?.name === componentName && path.node.body) {
                body = path.node.body
                path.stop()
            }
        },
        VariableDeclarator(path) {
            if (t.isIdentifier(path.node.id, { name: componentName })) {
                const init = path.node.init
                if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                    if (t.isBlockStatement(init.body)) {
                        body = init.body
                    } else {
                        const ret = t.returnStatement(init.body as Expression)
                        init.body = t.blockStatement([ret])
                        body = init.body
                    }
                    path.stop()
                }
            }
        },
    })
    return body
}

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
                        return (t.isIdentifier(spec.imported) ? spec.imported.name : '') === (t.isIdentifier(ex.imported) ? ex.imported.name : '')
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

export function emitHook(ast: File, componentName: string, hookStatement: string, position: 'first' | 'last' = 'last'): void {
    const body = findComponentBody(ast, componentName)
    if (!body) throw new Error(`Component not found: ${componentName}`)
    const stmt = parseStatementSnippet(hookStatement)
    if (position === 'first') { body.body.unshift(stmt) }
    else {
        let idx = 0
        for (let i = 0; i < body.body.length; i++) { if (t.isReturnStatement(body.body[i])) break; idx = i + 1 }
        body.body.splice(idx, 0, stmt)
    }
}

export function emitHandler(ast: File, componentName: string, handlerCode: string): void {
    const body = findComponentBody(ast, componentName)
    if (!body) throw new Error(`Component not found: ${componentName}`)
    const stmt = parseStatementSnippet(handlerCode)
    let ri = body.body.findIndex(n => t.isReturnStatement(n))
    if (ri === -1) ri = body.body.length
    body.body.splice(ri, 0, stmt)
}

export function emitCallback(ast: File, nodeId: string, propName: string, expression: string): void {
    let found = false
    traverse(ast, {
        JSXOpeningElement(path) {
            const attrs = path.node.attributes
            const ba = attrs.find(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'data-flint-id' }))
            if (!ba || !t.isJSXAttribute(ba)) return
            if (!t.isStringLiteral(ba.value) || ba.value.value !== nodeId) return
            const pe = parseExpression(expression)
            const na = t.jsxAttribute(t.jsxIdentifier(propName), t.jsxExpressionContainer(pe))
            const ei = attrs.findIndex(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: propName }))
            if (ei >= 0) attrs[ei] = na; else attrs.push(na)
            found = true
            path.stop()
        },
    })
    if (!found) throw new Error(`Node not found: ${nodeId}`)
}

// ── CATALOG.2: Conditional + Map ops ──────────────────────────────────────

export function emitConditional(ast: File, nodeId: string, condition: string, mode: 'and' | 'ternary', fallback?: string): void {
    const found = findNode(ast, nodeId)
    if (!found) throw new Error(`Node not found: ${nodeId}`)
    if (!found.parentChildren) return
    const condExpr = parseExpression(condition)
    const children = found.parentChildren as any[]
    const idx = children.indexOf(found.node)
    if (idx === -1) return
    let expr: Expression
    if (mode === 'ternary') {
        const fb = fallback && fallback !== 'null' ? parseExpression(fallback) : t.nullLiteral()
        expr = t.conditionalExpression(condExpr, found.node as any, fb)
    } else { expr = t.logicalExpression('&&', condExpr, found.node as any) }
    children[idx] = t.jsxExpressionContainer(expr)
}

export function emitMap(ast: File, nodeId: string, arrayExpression: string, iteratorName: string, keyExpression: string): void {
    if (keyExpression === 'index' || keyExpression.endsWith('.index'))
        throw new Error('emitMap: keyExpression must not be "index" (Commandment 3)')
    const found = findNode(ast, nodeId)
    if (!found) throw new Error(`Node not found: ${nodeId}`)
    if (!found.parentChildren) return
    const children = found.parentChildren as any[]
    const idx = children.indexOf(found.node)
    if (idx === -1) return
    const keyAttr = t.jsxAttribute(t.jsxIdentifier('key'), t.jsxExpressionContainer(parseExpression(keyExpression)))
    const attrs = found.node.openingElement.attributes
    const eki = attrs.findIndex(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'key' }))
    if (eki >= 0) attrs[eki] = keyAttr; else attrs.push(keyAttr)
    const ae = parseExpression(arrayExpression)
    const mc = t.callExpression(t.memberExpression(ae, t.identifier('map')),
        [t.arrowFunctionExpression([t.identifier(iteratorName)], found.node as any)])
    children[idx] = t.jsxExpressionContainer(mc)
}

// ── CATALOG.3: Compound Component Support ─────────────────────────────────────

/**
 * Parse a JSX snippet and return all top-level JSXElement children.
 * Wraps in a dummy element to handle multiple siblings.
 */
function parseJSXSnippetChildren(jsxSnippet: string): JSXElement[] {
    try {
        const wrapperAst = parse(`(<__flint__>${jsxSnippet}</__flint__>)`, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
        const stmt = wrapperAst.program.body[0]
        if (stmt === undefined || stmt.type !== 'ExpressionStatement') return []
        const expr = (stmt as ExpressionStatement).expression
        if (!isJSXElement(expr)) return []
        return expr.children.filter((c): c is JSXElement => isJSXElement(c))
    } catch {
        return []
    }
}

/**
 * composeSlot — Insert content into a compound component slot.
 * If the slot exists, appends children. If not, creates it.
 *
 * Example: composeSlot(ast, "dlg1", "Dialog.Header", "<h2>Title</h2>")
 * Creates <Dialog.Header><h2>Title</h2></Dialog.Header> inside the Dialog.
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

    // Parse slot name: "Dialog.Header" -> object="Dialog", property="Header"
    const dotIndex = slotName.indexOf('.')
    if (dotIndex === -1 || dotIndex === 0 || dotIndex === slotName.length - 1) {
        throw new Error(`composeSlot: invalid slot name "${slotName}" — must be "Component.Slot" format`)
    }
    const objectName = slotName.slice(0, dotIndex)
    const propertyName = slotName.slice(dotIndex + 1)

    // Parse the JSX snippet to inject
    const snippetNodes = parseJSXSnippetChildren(jsxSnippet)
    if (snippetNodes.length === 0) return

    // Handle optional import
    if (importSnippetStr) {
        const importAst = parse(importSnippetStr, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
        const importDecl = importAst.program.body[0]
        if (importDecl !== undefined && isImportDeclaration(importDecl)) {
            // Check if already imported
            const exists = ast.program.body.some(
                n => isImportDeclaration(n) && n.source.value === importDecl.source.value
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

    // Self-closing elements can't have children — convert if needed
    if (found.node.openingElement.selfClosing) {
        found.node.openingElement.selfClosing = false
        const closingName = found.node.openingElement.name
        found.node.closingElement = jsxClosingElement(closingName as any)
        found.node.children = []
    }

    // Search for existing slot element among parent's children
    const existingSlot = found.node.children.find((child): child is JSXElement => {
        if (!isJSXElement(child)) return false
        const name = child.openingElement.name
        return (
            isJSXMemberExpression(name) &&
            isJSXIdentifier(name.object) && name.object.name === objectName &&
            isJSXIdentifier(name.property) && name.property.name === propertyName
        )
    })

    if (existingSlot) {
        // Append children to existing slot
        for (const node of snippetNodes) {
            existingSlot.children.push(node)
        }
    } else {
        // Create new slot element
        const openMember = jsxMemberExpression(
            jsxIdentifier(objectName),
            jsxIdentifier(propertyName)
        )
        const closeMember = jsxMemberExpression(
            jsxIdentifier(objectName),
            jsxIdentifier(propertyName)
        )
        const opening = jsxOpeningElement(openMember, [], false)
        const closing = jsxClosingElement(closeMember)
        const slotElement = jsxElement(opening, closing, snippetNodes as any[], false)
        // Prepend — slots like Header typically come first
        found.node.children.unshift(slotElement)
    }
}
