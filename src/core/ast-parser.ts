/**
 * AST Parser Utilities — src/core/ast-parser.ts
 *
 * Pure, synchronous functions for parsing TypeScript/JSX source code into
 * a Babel AST, regenerating code from an AST, and extracting a simplified
 * VisualLayer tree for the layer-tree UI.
 *
 * No imports from the project — zero risk of circular dependencies.
 * Runs in the Renderer Process (browser context, no Node.js required).
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
// Type-only imports (verbatimModuleSyntax: all type-only uses must use import type)
import type { File, JSXElement, JSXAttribute } from '@babel/types'
import type { NodePath } from '@babel/traverse'
// Value imports — runtime builder and guard functions from @babel/types.
// @babel/types is CJS; Vite's electron-renderer plugin synthesises named ESM
// exports from the CJS `exports` object, so named imports work directly.
import {
    jsxAttribute,
    jsxIdentifier,
    jsxText,
    stringLiteral,
    cloneNode,
    isJSXAttribute,
    isJSXIdentifier,
    isJSXText,
} from '@babel/types'

// ── CJS interop guards ────────────────────────────────────────────────────────
// @babel/traverse and @babel/generator are CommonJS modules. Vite normally
// handles the interop, but the actual export may be wrapped in a { default }
// envelope depending on how vite-plugin-electron-renderer resolves them.
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

const generate =
    typeof _generate === 'function'
        ? _generate
        : (_generate as unknown as { default: typeof _generate }).default

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A lightweight, serialisable snapshot of a single JSX element extracted
 * from the live AST. Used by the layer-tree UI and property inspector.
 * It is NOT a live reference — rebuilding it from the AST is cheap.
 */
export interface VisualLayer {
    /** Synthetic ID: "<tagName>:<line>:<col>", e.g. "div:10:4" */
    id: string
    /** Element tag name, e.g. "div", "Button", "React.Fragment" */
    tagName: string
    /** 1-based source line of the opening tag */
    line: number
    /** The className prop value, if present on this element */
    className?: string
    /** The style prop value, if present (string literal or expression code), e.g. "color:red" or "{ color: 'red' }" */
    style?: string
    /** The id attribute value, if present (e.g. id="hero" → "hero") */
    idAttr?: string
    /** First non-whitespace direct text content (JSXText child), if any */
    textContent?: string
    /** Arbitrary read-only props (excluding className, style, id, and data-flint-id) */
    props?: Record<string, string | boolean>
    /** Nested child layers (mirrors JSX nesting) */
    children: VisualLayer[]
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Parses a TypeScript/JSX source string into a Babel File AST.
 * Returns null on parse failure so callers can gracefully preserve the
 * last valid state during live editing (syntax errors are expected).
 */
export function parseCodeToAST(code: string): File | null {
    try {
        return parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch {
        // Syntax errors are normal during live editing — return null
        // so the store can keep the last valid AST.
        return null
    }
}

/**
 * Regenerates source code from a Babel File AST.
 * Used by the property-editing pipeline after mutating AST nodes.
 */
export function generateCodeFromAST(ast: File): string {
    const result = generate(ast, {
        retainLines: false,
        comments: true,
    })
    return result.code
}

/**
 * Recursively walks an array of JSX children to find the first meaningful text.
 *
 *   • JSXText                → trimmed literal string
 *   • JSXExpressionContainer → Babel-generated code string wrapped in "{…}"
 *                              Identifiers  : "{monthlyPayment}"  → humanised by layerNaming
 *                              MemberExprs  : "{result.interest}" → "Result Interest"
 *                              Complex exprs: "{isEnrolled ? '…}" → shown verbatim
 *   • JSXElement             → recurse into its children
 *
 * The "{…}" wrapper is a sentinel that tells parseTextContent in layerNaming.ts
 * to attempt humanisation rather than treating the string as display text.
 */
function extractJSXText(children: JSXElement['children']): string | undefined {
    for (const child of children) {
        if (child.type === 'JSXText') {
            const trimmed = child.value.trim()
            if (trimmed.length > 0) return trimmed
        } else if (child.type === 'JSXExpressionContainer') {
            const expr = child.expression
            // JSXEmptyExpression is `{}` — no useful text to extract.
            if (expr.type === 'JSXEmptyExpression') continue
            // Use Babel's code generator to stringify the expression.
            // This handles Identifiers, MemberExpressions, ternaries, calls, etc.
            const code = generate(expr).code
            const truncated = code.length > 20 ? `${code.slice(0, 20)}…` : code
            return `{${truncated}}`
        } else if (child.type === 'JSXElement') {
            const nested = extractJSXText(child.children)
            if (nested !== undefined) return nested
        }
    }
    return undefined
}

/**
 * Traverses a Babel File AST and extracts a nested VisualLayer tree
 * mirroring the JSX element hierarchy. Only JSXElement nodes are included;
 * text content and expressions are skipped.
 * Also extracts the className attribute value when present.
 */
export function buildVisualTree(ast: File): VisualLayer[] {
    const roots: VisualLayer[] = []
    const stack: VisualLayer[] = []

    traverse(ast, {
        JSXElement: {
            enter(path: NodePath<JSXElement>) {
                const opening = path.node.openingElement
                const loc = path.node.loc

                let tagName: string
                if (opening.name.type === 'JSXIdentifier') {
                    tagName = opening.name.name
                } else if (opening.name.type === 'JSXMemberExpression') {
                    const obj =
                        opening.name.object.type === 'JSXIdentifier'
                            ? opening.name.object.name
                            : '?'
                    tagName = `${obj}.${opening.name.property.name}`
                } else {
                    tagName = 'unknown'
                }

                const line = loc?.start.line ?? 0
                const col = loc?.start.column ?? 0

                // Extract className, id, and data-flint-id FIRST — flintId must
                // be resolved before computing the stable layer id below.
                // Handles both StringLiteral (data-flint-id="x") and
                // JSXExpressionContainer (data-flint-id={"x"}) forms.
                let className: string | undefined
                let style: string | undefined
                let idAttr: string | undefined
                let flintId: string | undefined
                const props: Record<string, string | boolean> = {}
                for (const attr of opening.attributes) {
                    if (!isJSXAttribute(attr)) continue
                    // Extract the attribute name once to avoid TypeScript's
                    // control-flow narrowing compounding across repeated
                    // isJSXIdentifier calls in a single else-if chain.
                    const attrName = isJSXIdentifier(attr.name) ? attr.name.name : null
                    if (attr.value?.type === 'StringLiteral') {
                        if (attrName === 'className') {
                            className = attr.value.value
                        } else if (attrName === 'style') {
                            style = attr.value.value
                        } else if (attrName === 'id') {
                            idAttr = attr.value.value
                        } else if (attrName === 'data-flint-id') {
                            flintId = attr.value.value
                        } else if (attrName) {
                            props[attrName] = attr.value.value
                        }
                    } else if (attr.value?.type === 'JSXExpressionContainer') {
                        if (attrName === 'data-flint-id' && attr.value.expression.type === 'StringLiteral') {
                            flintId = attr.value.expression.value
                        } else if (attrName === 'style' && attr.value.expression.type !== 'JSXEmptyExpression') {
                            // Generate a compact code representation for object-style props,
                            // e.g. style={{ color: 'red' }} → "{ color: 'red' }"
                            style = generate(attr.value.expression).code
                        }
                    } else if (attr.value === null && attrName) {
                        // Support valueless boolean attributes, e.g. <input disabled />
                        props[attrName] = true
                    }
                }

                // Use the stable data-flint-id when present so the layer id
                // survives AST round-trips and drag-and-drop reorderings.
                // Fall back to the source-location-based synthetic id for
                // elements that were not injected through the component flint.
                const id = flintId ?? `${tagName}:${line}:${col}`

                // Extract the first meaningful text (literal or identifier expression),
                // searching recursively through nested elements when needed.
                const textContent = extractJSXText(path.node.children)

                const layer: VisualLayer = {
                    id,
                    tagName,
                    line,
                    ...(className !== undefined ? { className } : {}),
                    ...(style !== undefined ? { style } : {}),
                    ...(idAttr !== undefined ? { idAttr } : {}),
                    ...(textContent !== undefined ? { textContent } : {}),
                    ...(Object.keys(props).length > 0 ? { props } : {}),
                    children: [],
                }

                if (stack.length === 0) {
                    roots.push(layer)
                } else {
                    stack[stack.length - 1].children.push(layer)
                }

                stack.push(layer)
            },
            exit() {
                stack.pop()
            },
        },
    })

    return roots
}

/**
 * Mutates a Babel File AST in-place, updating or creating the `className`
 * JSX attribute on the element identified by `nodeId`.
 *
 * `nodeId` format: "<tagName>:<line>:<col>" — the synthetic ID produced by
 * buildVisualTree. We match on line and column so the operation is exact
 * even when multiple elements share a tag name.
 *
 * The caller is responsible for passing a freshly-parsed copy of the AST —
 * never the store's live `ast` reference — since this function mutates in-place.
 */
export function updateJSXClassName(
    ast: File,
    nodeId: string,
    className: string
): void {
    const parts = nodeId.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    // Structural IDs end with two numeric segments (line:col).
    // Flint IDs are short alphanumeric strings without that pattern.
    const isStructuralId = parts.length >= 2 && !isNaN(col) && !isNaN(line)

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const loc = path.node.loc
            let matched = false
            if (isStructuralId) {
                matched = loc?.start.line === line && loc.start.column === col
            } else {
                // Flint-id lookup: scan attributes for data-flint-id === nodeId.
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        isJSXAttribute(attr) &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-flint-id' &&
                        attr.value?.type === 'StringLiteral' &&
                        attr.value.value === nodeId
                    ) {
                        matched = true
                        break
                    }
                }
            }
            if (!matched) {
                return
            }

            const opening = path.node.openingElement
            const attrs = opening.attributes
            let found = false

            for (const attr of attrs) {
                if (
                    isJSXAttribute(attr) &&
                    isJSXIdentifier(attr.name, { name: 'className' })
                ) {
                    // Update existing className attribute value in-place
                    ; (attr as JSXAttribute).value = stringLiteral(className)
                    found = true
                    break
                }
            }

            if (!found) {
                // No className attribute present — create and append one
                attrs.push(
                    jsxAttribute(
                        jsxIdentifier('className'),
                        stringLiteral(className)
                    )
                )
            }

            // Stop traversal — we found and updated our target
            path.stop()
        },
    })
}

/**
 * Mutates a Babel File AST in-place, updating the text content of the
 * element identified by `nodeId`.
 *
 * `nodeId` format: "<tagName>:<line>:<col>" — the synthetic ID produced by
 * buildVisualTree. We match on line and column so the operation is exact
 * even when multiple elements share a tag name.
 *
 * The function:
 *   1. Finds the element by line:col (or flint-id)
 *   2. Iterates through the element's children
 *   3. Finds the first JSXText child with non-empty `value.trim()`
 *   4. Replaces its `value` with `newText`
 *   5. If none exists, pushes a new JSXText node to children
 *
 * The caller is responsible for passing a freshly-parsed copy of the AST —
 * never the store's live `ast` reference — since this function mutates in-place.
 */
export function updateJSXTextContent(
    ast: File,
    nodeId: string,
    newText: string
): void {
    const parts = nodeId.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    // Structural IDs end with two numeric segments (line:col).
    // Flint IDs are short alphanumeric strings without that pattern.
    const isStructuralId = parts.length >= 2 && !isNaN(col) && !isNaN(line)

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const loc = path.node.loc
            let matched = false
            if (isStructuralId) {
                matched = loc?.start.line === line && loc.start.column === col
            } else {
                // Flint-id lookup: scan attributes for data-flint-id === nodeId.
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        isJSXAttribute(attr) &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-flint-id' &&
                        attr.value?.type === 'StringLiteral' &&
                        attr.value.value === nodeId
                    ) {
                        matched = true
                        break
                    }
                }
            }
            if (!matched) {
                return
            }

            const children = path.node.children
            let foundTextNode = false

            // Find the first JSXText child with non-empty trimmed content
            for (const child of children) {
                if (isJSXText(child)) {
                    const trimmed = child.value.trim()
                    if (trimmed.length > 0) {
                        // Replace the existing text content
                        child.value = newText
                        foundTextNode = true
                        break
                    }
                }
            }

            // If no existing JSXText with content was found, create a new one
            if (!foundTextNode) {
                children.push(jsxText(newText))
            }

            // Stop traversal — we found and updated our target
            path.stop()
        },
    })
}

/**
 * Surgically replaces the JSX element identified by `nodeId` in `liveAST`
 * with a deep clone of the matching element found in `historicAST`.
 *
 * This is the core of the Macro-Recovery Engine (Phase D.1). It allows a
 * single ruined component node to be reverted to its last-committed state
 * without a blanket `git checkout` that would discard all concurrent edits
 * in the file (Commandment 11 — Surgical Git Transplants).
 *
 * Both ASTs must be independently parsed from their respective source strings.
 * The function mutates `liveAST` in-place; callers are responsible for
 * regenerating code with `generateCodeFromAST` after calling this.
 *
 * Silent no-op when `nodeId` cannot be located in either AST.
 */
export function transplantNode(
    liveAST: File,
    historicAST: File,
    nodeId: string
): void {
    const parts = nodeId.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    const isStructuralId = parts.length >= 2 && !isNaN(col) && !isNaN(line)

    // ── Step 1: find and deep-clone the target node from historicAST ──────────
    let historicClone: JSXElement | null = null

    traverse(historicAST, {
        JSXElement(path: NodePath<JSXElement>) {
            const loc = path.node.loc
            let matched = false
            if (isStructuralId) {
                matched = loc?.start.line === line && loc.start.column === col
            } else {
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        isJSXAttribute(attr) &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-flint-id' &&
                        attr.value?.type === 'StringLiteral' &&
                        attr.value.value === nodeId
                    ) {
                        matched = true
                        break
                    }
                }
            }
            if (!matched) return
            // Deep-clone so the historic node is completely detached from historicAST.
            historicClone = cloneNode(path.node, true)
            path.stop()
        },
    })

    if (historicClone === null) return  // node absent from historic commit — abort

    // ── Step 2: locate the same node in liveAST and replace it in-place ──────
    const replacement = historicClone  // TypeScript: narrowed non-null above

    traverse(liveAST, {
        JSXElement(path: NodePath<JSXElement>) {
            const loc = path.node.loc
            let matched = false
            if (isStructuralId) {
                matched = loc?.start.line === line && loc.start.column === col
            } else {
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        isJSXAttribute(attr) &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-flint-id' &&
                        attr.value?.type === 'StringLiteral' &&
                        attr.value.value === nodeId
                    ) {
                        matched = true
                        break
                    }
                }
            }
            if (!matched) return
            path.replaceWith(replacement)
            path.stop()
        },
    })
}

/**
 * Traverses all JSXElement nodes in `ast` and injects a `data-flint-id`
 * attribute onto each element that does not already carry one.
 *
 * This makes the renderer self-sufficient for ID injection (Phase E.1 /
 * HANDOFF 7D). Calling this before `generateCodeFromAST` and passing the
 * result to the main-process `transformCode` IPC ensures flint IDs survive
 * even if the main-process Babel plugin fails or is bypassed.
 *
 * ID format: `"<tagName>:<1-based-line>:<0-based-col>"` — identical to the
 * format produced by `buildVisualTree` and the main-process plugin.
 *
 * Mutates `ast` in-place. Idempotent: elements that already carry a
 * `data-flint-id` attribute are skipped.
 */
export function injectFlintIds(ast: File): void {
    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const opening = path.node.openingElement
            const loc = path.node.loc
            if (loc == null) return

            // Compute tag name (mirrors buildVisualTree tag-name logic)
            let tagName: string
            const nameNode = opening.name
            if (nameNode.type === 'JSXIdentifier') {
                tagName = nameNode.name
            } else if (nameNode.type === 'JSXMemberExpression') {
                const obj =
                    nameNode.object.type === 'JSXIdentifier'
                        ? nameNode.object.name
                        : '?'
                tagName = `${obj}.${nameNode.property.name}`
            } else {
                tagName = 'unknown'
            }

            const flintId = `${tagName}:${loc.start.line}:${loc.start.column}`

            // Idempotency guard — skip if already injected
            const alreadySet = opening.attributes.some(
                (attr) =>
                    isJSXAttribute(attr) &&
                    isJSXIdentifier(attr.name) &&
                    attr.name.name === 'data-flint-id'
            )
            if (alreadySet) return

            opening.attributes.push(
                jsxAttribute(jsxIdentifier('data-flint-id'), stringLiteral(flintId))
            )
        },
    })
}

/**
 * Mutates a Babel File AST in-place, setting or removing an arbitrary JSX
 * attribute on the element identified by `nodeId`.
 *
 * This generalises `updateJSXClassName` to cover any HTML/JSX attribute:
 * `href`, `src`, `disabled`, `variant`, `onClick`, etc. (Phase E.2 / HANDOFF 7B).
 *
 * `nodeId` format: "<tagName>:<line>:<col>" — or a stable data-flint-id.
 *
 * Value semantics:
 *   string       → `propName="value"` (StringLiteral attribute)
 *   true         → `propName` (valueless boolean attribute, e.g. `disabled`)
 *   false | null → attribute removed entirely
 *
 * The caller is responsible for passing a freshly-parsed copy of the AST.
 */
export function updateJSXProp(
    ast: File,
    nodeId: string,
    propName: string,
    value: string | boolean | null
): void {
    const parts = nodeId.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    const isStructuralId = parts.length >= 2 && !isNaN(col) && !isNaN(line)

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const loc = path.node.loc
            let matched = false
            if (isStructuralId) {
                matched = loc?.start.line === line && loc.start.column === col
            } else {
                for (const attr of path.node.openingElement.attributes) {
                    if (
                        isJSXAttribute(attr) &&
                        attr.name.type === 'JSXIdentifier' &&
                        attr.name.name === 'data-flint-id' &&
                        attr.value?.type === 'StringLiteral' &&
                        attr.value.value === nodeId
                    ) {
                        matched = true
                        break
                    }
                }
            }
            if (!matched) return

            const attrs = path.node.openingElement.attributes

            // Locate any existing attribute with the given name
            const existingIdx = attrs.findIndex(
                (attr) =>
                    isJSXAttribute(attr) &&
                    isJSXIdentifier(attr.name, { name: propName })
            )

            if (value === false || value === null) {
                // Remove the attribute entirely
                if (existingIdx !== -1) attrs.splice(existingIdx, 1)
            } else if (value === true) {
                // Valueless boolean attribute: <button disabled>
                const boolAttr = jsxAttribute(jsxIdentifier(propName), null)
                if (existingIdx !== -1) {
                    attrs[existingIdx] = boolAttr
                } else {
                    attrs.push(boolAttr)
                }
            } else {
                // String attribute: propName="value"
                const strAttr = jsxAttribute(jsxIdentifier(propName), stringLiteral(value))
                if (existingIdx !== -1) {
                    attrs[existingIdx] = strAttr
                } else {
                    attrs.push(strAttr)
                }
            }

            path.stop()
        },
    })
}
