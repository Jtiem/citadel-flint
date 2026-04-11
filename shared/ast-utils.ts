/**
 * shared/ast-utils.ts — Pure AST utility functions
 *
 * Shared between src/utils/astModifier.ts (renderer) and
 * flint-mcp/src/core/ast-modifier.ts (Node.js MCP server).
 *
 * No environment-specific imports (no Node.js APIs, no window, no IPC).
 * Only depends on @babel/types which is available in both contexts.
 */

import type { File, JSXElement } from '@babel/types'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Where the dragged node lands relative to the drop target. */
export type DropPosition = 'before' | 'after' | 'inside'

export interface FoundNode {
    node: JSXElement
    /**
     * The `children` array of the immediate JSXElement parent.
     * null when the parent is not a JSXElement (e.g. ReturnStatement),
     * meaning this is a top-level JSX root and cannot be repositioned via
     * before/after.
     */
    parentChildren: JSXElement['children'] | null
}

// ── Node ID parsing ──────────────────────────────────────────────────────────

/**
 * Determines whether a node ID string is a structural ID ("tagName:line:col")
 * or a flint ID (data-flint-id attribute value).
 *
 * Structural IDs have at least 2 colon-separated segments where the last two
 * segments are valid integers (line and column numbers).
 */
export function isStructuralId(id: string): { structural: true; line: number; col: number } | { structural: false } {
    const parts = id.split(':')
    const col = parseInt(parts[parts.length - 1], 10)
    const line = parseInt(parts[parts.length - 2], 10)
    if (parts.length >= 2 && !isNaN(col) && !isNaN(line)) {
        return { structural: true, line, col }
    }
    return { structural: false }
}

/**
 * Checks whether a JSXElement matches a given node ID (structural or flint).
 *
 * Structural: matched by source location (line:col).
 * Flint: matched by data-flint-id attribute value.
 */
export function jsxElementMatchesId(element: JSXElement, id: string): boolean {
    const parsed = isStructuralId(id)
    if (parsed.structural) {
        const loc = element.loc
        return loc?.start.line === parsed.line && loc.start.column === parsed.col
    }
    // Flint-id lookup: scan attributes for data-flint-id === id.
    for (const attr of element.openingElement.attributes) {
        if (
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'data-flint-id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === id
        ) {
            return true
        }
    }
    return false
}

// ── Ancestor detection ───────────────────────────────────────────────────────

/**
 * Returns true if `candidateAncestor` is an ancestor of `target` in the
 * JSX tree. Walks the children of `candidateAncestor` recursively looking
 * for `target` by reference identity.
 *
 * Used to prevent ancestor-to-descendant moves which would cause data loss:
 * removing an ancestor from the tree also removes all its descendants,
 * including the intended move target.
 */
export function isAncestorOf(candidateAncestor: JSXElement, target: JSXElement): boolean {
    if (candidateAncestor === target) return false

    function walkChildren(children: JSXElement['children']): boolean {
        for (const child of children) {
            if (child.type !== 'JSXElement') continue
            if (child === target) return true
            if (walkChildren(child.children)) return true
        }
        return false
    }

    return walkChildren(candidateAncestor.children)
}
