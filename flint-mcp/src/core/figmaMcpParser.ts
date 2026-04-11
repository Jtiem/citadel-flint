// ---------------------------------------------------------------------------
// figmaMcpParser — Extract component hints from Figma MCP get_design_context
// ---------------------------------------------------------------------------
// The Figma MCP returns JSX with data-name and data-node-id attributes.
// This module parses those to identify component types (Input, Select, Card, etc.)
// and enriches the FigmaNode tree so the D2C emitters produce correct components.
// ---------------------------------------------------------------------------

import { parse as babelParse } from '@babel/parser'
import _babelTraverse from '@babel/traverse'
import * as t from '@babel/types'
import { classifyDataName as _classifyDataName } from './componentClassification.js'

// CJS/ESM interop
const babelTraverse = (typeof _babelTraverse === 'function' ? _babelTraverse : (_babelTraverse as unknown as { default: typeof _babelTraverse }).default) as typeof _babelTraverse

export interface ComponentHint {
    dataName: string
    componentType: string | null
}

/**
 * Classify a data-name string into a component type.
 * Delegates to the shared componentClassification module.
 */
export function classifyDataName(dataName: string): string | null {
    return _classifyDataName(dataName)
}

/**
 * Parse raw JSX from Figma MCP get_design_context.
 * Extracts data-name and data-node-id pairs using Babel AST traversal.
 *
 * Commandment 13: Uses Babel parser with JSX plugin instead of regex,
 * ensuring robust handling of multi-line elements and edge cases.
 */
export function parseFigmaMcpResponse(jsxCode: string): Map<string, ComponentHint> {
    const hints = new Map<string, ComponentHint>()
    if (!jsxCode) return hints

    // Wrap in a function so Babel can parse standalone JSX fragments
    const wrapped = `function _wrapper() { return (<>${jsxCode}</>); }`

    let ast: ReturnType<typeof babelParse>
    try {
        ast = babelParse(wrapped, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            errorRecovery: true,
        })
    } catch {
        // If Babel cannot parse at all, return empty hints rather than crashing
        return hints
    }

    babelTraverse(ast, {
        JSXOpeningElement(path) {
            const attrs = path.node.attributes
            let nodeId: string | null = null
            let dataName: string | null = null

            for (const attr of attrs) {
                if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue
                if (attr.name.name === 'data-node-id' && t.isStringLiteral(attr.value)) {
                    nodeId = attr.value.value
                }
                if (attr.name.name === 'data-name' && t.isStringLiteral(attr.value)) {
                    dataName = attr.value.value
                }
            }

            if (nodeId && dataName && !hints.has(nodeId)) {
                const componentType = classifyDataName(dataName)
                hints.set(nodeId, { dataName, componentType })
            }
        },
    })

    return hints
}

/**
 * Normalize a Figma node ID for lookup: strip leading "I" prefix and
 * take only the base segment (before semicolons for instance IDs).
 */
function normalizeNodeId(id: string): string {
    const stripped = id.startsWith('I') ? id.slice(1) : id
    return stripped.split(';')[0]
}

/**
 * Walk a FigmaNode tree and set componentType from hints.
 * Matches on node IDs (supports Figma's "I" prefix for instances).
 *
 * Performance: builds a normalized-ID lookup map from hints before walking,
 * reducing the inner loop from O(n*m) to O(n) with O(m) pre-processing.
 */
export function enrichFigmaNodes(
    nodes: Array<Record<string, unknown>>,
    hints: Map<string, ComponentHint>,
): void {
    // Pre-build a normalized-ID lookup map: normalizedBaseId → ComponentHint
    const normalizedHintMap = new Map<string, ComponentHint>()
    for (const [hintId, hint] of hints) {
        if (hint.componentType) {
            normalizedHintMap.set(normalizeNodeId(hintId), hint)
        }
    }

    function walk(node: Record<string, unknown>): void {
        const nodeId = node['id'] as string | undefined

        if (nodeId) {
            // Direct match first (O(1) lookup)
            if (hints.has(nodeId)) {
                const hint = hints.get(nodeId)!
                if (hint.componentType) {
                    node['componentType'] = hint.componentType
                }
            }

            // Normalized match via pre-built map (O(1) lookup instead of O(m) scan)
            if (!node['componentType']) {
                const normalizedId = normalizeNodeId(nodeId)
                const hint = normalizedHintMap.get(normalizedId)
                if (hint) {
                    node['componentType'] = hint.componentType
                }
            }
        }

        // Walk children
        const children = node['children'] as Array<Record<string, unknown>> | undefined
        if (children && Array.isArray(children)) {
            for (const child of children) {
                walk(child)
            }
        }
    }

    for (const node of nodes) {
        walk(node)
    }
}
