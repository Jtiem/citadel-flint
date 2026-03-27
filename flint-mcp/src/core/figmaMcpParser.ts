// ---------------------------------------------------------------------------
// figmaMcpParser — Extract component hints from Figma MCP get_design_context
// ---------------------------------------------------------------------------
// The Figma MCP returns JSX with data-name and data-node-id attributes.
// This module parses those to identify component types (Input, Select, Card, etc.)
// and enriches the FigmaNode tree so the D2C emitters produce correct components.
// ---------------------------------------------------------------------------

export interface ComponentHint {
    dataName: string
    componentType: string | null
}

// Map well-known Figma data-name values to component types
const DATA_NAME_MAP: Record<string, string> = {
    'input': 'input',
    'textfield': 'input',
    'text field': 'input',
    'select': 'select',
    'dropdown': 'select',
    'textarea': 'textarea',
    'text area': 'textarea',
    'button': 'button',
    'btn': 'button',
    'card': 'card',
    'avatar': 'avatar',
    'badge': 'badge',
    'chip': 'badge',
    'tabs': 'tabs',
    'tab': 'tabs',
    '.tab item': 'tabs',
    'separator': 'separator',
    'divider': 'separator',
    'label': 'label',
    'header': 'header',
    'footer': 'footer',
    'nav': 'nav',
    'navbar': 'nav',
    'navigation': 'nav',
    'checkbox': 'checkbox',
    'switch': 'switch',
    'toggle': 'switch',
    'alert': 'alert',
    'dialog': 'dialog',
    'modal': 'dialog',
}

// Names to ignore (decorative or structural)
const SKIP_NAMES = new Set(['icon', 'vector', 'shape', 'ellipse', 'rectangle', 'line', 'frame', 'group', 'auto layout'])

/**
 * Classify a data-name string into a component type.
 * Exact match first, then substring search, then null.
 */
export function classifyDataName(dataName: string): string | null {
    const lower = dataName.toLowerCase().trim()

    // Skip decorative/structural names
    if (SKIP_NAMES.has(lower)) return null

    // Exact match
    if (DATA_NAME_MAP[lower]) return DATA_NAME_MAP[lower]

    // Substring match — check if any key appears in the name
    // Order matters: check more specific first
    const orderedKeys = [
        'textarea', 'text area',  // before 'input'
        'textfield', 'text field',
        'checkbox',
        'dropdown',
        'input',
        'select',
        'button', 'btn',
        'card',
        'avatar',
        'badge', 'chip',
        'tabs', 'tab',
        'separator', 'divider',
        'switch', 'toggle',
        'alert',
        'dialog', 'modal',
        'navbar', 'navigation', 'nav',
        'header',
        'footer',
    ]

    for (const key of orderedKeys) {
        if (lower.includes(key)) return DATA_NAME_MAP[key]
    }

    return null
}

/**
 * Parse raw JSX from Figma MCP get_design_context.
 * Extracts data-name and data-node-id pairs.
 */
export function parseFigmaMcpResponse(jsxCode: string): Map<string, ComponentHint> {
    const hints = new Map<string, ComponentHint>()
    if (!jsxCode) return hints

    // Match data-node-id="..." and data-name="..." in any order within the same element
    // Strategy: find all opening tags with data-node-id, then extract data-name from same tag
    const tagRegex = /<[a-zA-Z][^>]*data-node-id="([^"]+)"[^>]*>/g
    const nameRegex = /data-name="([^"]+)"/

    let match: RegExpExecArray | null
    while ((match = tagRegex.exec(jsxCode)) !== null) {
        const fullTag = match[0]
        const nodeId = match[1]

        const nameMatch = fullTag.match(nameRegex)
        if (nameMatch) {
            const dataName = nameMatch[1]
            const componentType = classifyDataName(dataName)
            hints.set(nodeId, { dataName, componentType })
        }
    }

    // Also handle tags where data-name appears before data-node-id
    const reverseRegex = /<[a-zA-Z][^>]*data-name="([^"]+)"[^>]*data-node-id="([^"]+)"[^>]*>/g
    while ((match = reverseRegex.exec(jsxCode)) !== null) {
        const dataName = match[1]
        const nodeId = match[2]
        if (!hints.has(nodeId)) {
            const componentType = classifyDataName(dataName)
            hints.set(nodeId, { dataName, componentType })
        }
    }

    return hints
}

/**
 * Walk a FigmaNode tree and set componentType from hints.
 * Matches on node IDs (supports Figma's "I" prefix for instances).
 */
export function enrichFigmaNodes(
    nodes: Array<Record<string, unknown>>,
    hints: Map<string, ComponentHint>,
): void {
    function walk(node: Record<string, unknown>): void {
        // Try to match node ID against hints
        const nodeId = node['id'] as string | undefined
        const nodeName = node['name'] as string | undefined

        if (nodeId && hints.has(nodeId)) {
            const hint = hints.get(nodeId)!
            if (hint.componentType) {
                node['componentType'] = hint.componentType
            }
        }

        // Also try matching by data-node-id format (Figma uses "1234:5678")
        // The Figma MCP sometimes prefixes instance IDs with "I"
        if (nodeId) {
            // Try with and without "I" prefix
            for (const [hintId, hint] of hints) {
                const normalizedHintId = hintId.startsWith('I') ? hintId.slice(1) : hintId
                const normalizedNodeId = nodeId.startsWith('I') ? nodeId.slice(1) : nodeId

                // Match on the base ID (before semicolons for instance IDs)
                const baseHintId = normalizedHintId.split(';')[0]
                const baseNodeId = normalizedNodeId.split(';')[0]

                if (baseHintId === baseNodeId && hint.componentType && !node['componentType']) {
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
