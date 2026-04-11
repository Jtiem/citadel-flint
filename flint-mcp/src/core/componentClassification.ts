// ---------------------------------------------------------------------------
// componentClassification — Shared component name-to-type mapping
// ---------------------------------------------------------------------------
// Single source of truth for classifying Figma node names into UI component
// types. Used by hydroPaste.ts, figmaMcpParser.ts, and figmaJsxTransformer.ts.
//
// This is a leaf module: it imports nothing from the engine to avoid circular
// dependencies.
// ---------------------------------------------------------------------------

/**
 * Strict component type for the hydroPaste emitter pipeline.
 * These types map to library-specific component markup via emitNamedComponent.
 * Does NOT include structural/semantic types (card, nav, header, footer, label,
 * button, dialog) which are handled separately by classifyFrame/isLikelyButton.
 */
export type ComponentType =
    | 'input'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'switch'
    | 'avatar'
    | 'badge'
    | 'tabs'
    | 'separator'
    | 'alert'

/** Full result from classifyComponent — null when no keyword matched. */
export interface ComponentClassification {
    type: ComponentType
    /** Keywords that triggered this match */
    matchedKeywords: string[]
}

/**
 * Broad data-name type — superset of ComponentType.
 * Includes structural/semantic types used by figmaMcpParser and figmaJsxTransformer.
 */
export type DataNameType = ComponentType
    | 'button'
    | 'card'
    | 'label'
    | 'header'
    | 'footer'
    | 'nav'
    | 'dialog'

// ── Canonical mapping table ──────────────────────────────────────────────────
// Union of all mappings from hydroPaste, figmaMcpParser, and figmaJsxTransformer.

/**
 * Direct exact-match map: lowercased data-name → component type.
 * Used for both exact matching and as the source for substring scanning.
 */
export const COMPONENT_NAME_MAP: Record<string, DataNameType> = {
    // input family
    'input': 'input',
    'textfield': 'input',
    'text field': 'input',
    'text-field': 'input',
    'field': 'input',

    // textarea
    'textarea': 'textarea',
    'text area': 'textarea',
    'text-area': 'textarea',
    'multiline': 'textarea',

    // select / dropdown
    'select': 'select',
    'dropdown': 'select',
    'combobox': 'select',

    // button
    'button': 'button',
    'btn': 'button',

    // card
    'card': 'card',

    // avatar
    'avatar': 'avatar',
    'profile-pic': 'avatar',

    // badge / chip / tag
    'badge': 'badge',
    'chip': 'badge',
    'tag': 'badge',

    // tabs
    'tabs': 'tabs',
    'tab': 'tabs',
    '.tab item': 'tabs',

    // separator
    'separator': 'separator',
    'divider': 'separator',
    'hr': 'separator',

    // label
    'label': 'label',

    // header / footer / nav
    'header': 'header',
    'footer': 'footer',
    'nav': 'nav',
    'navbar': 'nav',
    'navigation': 'nav',

    // checkbox / switch
    'checkbox': 'checkbox',
    'check-box': 'checkbox',
    'switch': 'switch',
    'toggle': 'switch',

    // alert / dialog
    'alert': 'alert',
    'message': 'alert',
    'notification': 'alert',
    'toast': 'alert',
    'dialog': 'dialog',
    'modal': 'dialog',
}

/** Names to skip (decorative or structural). */
export const SKIP_NAMES = new Set([
    'icon', 'vector', 'shape', 'ellipse', 'rectangle', 'line', 'frame', 'group', 'auto layout',
])

/**
 * Ordered keys for substring matching.
 * More specific patterns come first to avoid false positives
 * (e.g. "textarea" before "input", "tab" guards against "table").
 */
const ORDERED_SUBSTRING_KEYS: Array<{ key: string; type: DataNameType; guard?: (lower: string) => boolean }> = [
    // textarea before input — "text-field" contains "field" but "text-area" / "textarea" is more specific
    { key: 'textarea', type: 'textarea' },
    { key: 'text-area', type: 'textarea' },
    { key: 'text area', type: 'textarea' },
    { key: 'multiline', type: 'textarea' },
    // input family (note: 'field' is intentionally omitted from substring matching
    // because it is too broad — "form field" should not match "input". The strict
    // classifyComponentName in hydroPaste uses 'field' directly.)
    { key: 'textfield', type: 'input' },
    { key: 'text field', type: 'input' },
    { key: 'text-field', type: 'input' },
    { key: 'input', type: 'input' },
    // checkbox before switch (both contain common letters)
    { key: 'checkbox', type: 'checkbox' },
    { key: 'check-box', type: 'checkbox' },
    // select
    { key: 'combobox', type: 'select' },
    { key: 'dropdown', type: 'select' },
    { key: 'select', type: 'select' },
    // button
    { key: 'button', type: 'button' },
    { key: 'btn', type: 'button' },
    // card
    { key: 'card', type: 'card' },
    // avatar
    { key: 'avatar', type: 'avatar' },
    { key: 'profile-pic', type: 'avatar' },
    // badge
    { key: 'badge', type: 'badge' },
    { key: 'chip', type: 'badge' },
    { key: 'tag', type: 'badge' },
    // tabs — but NOT "table"
    { key: 'tabs', type: 'tabs' },
    { key: 'tab', type: 'tabs', guard: (lower) => !lower.includes('table') },
    // separator
    { key: 'separator', type: 'separator' },
    { key: 'divider', type: 'separator' },
    // switch / toggle
    { key: 'switch', type: 'switch' },
    { key: 'toggle', type: 'switch' },
    // alert family
    { key: 'alert', type: 'alert' },
    { key: 'message', type: 'alert' },
    { key: 'notification', type: 'alert' },
    { key: 'toast', type: 'alert' },
    // dialog
    { key: 'dialog', type: 'dialog' },
    { key: 'modal', type: 'dialog' },
    // nav
    { key: 'navbar', type: 'nav' },
    { key: 'navigation', type: 'nav' },
    { key: 'nav', type: 'nav' },
    // header / footer
    { key: 'header', type: 'header' },
    { key: 'footer', type: 'footer' },
    // label
    { key: 'label', type: 'label' },
]

/** The strict set of component types used by hydroPaste's emitter pipeline. */
const STRICT_COMPONENT_TYPES = new Set<string>([
    'input', 'textarea', 'select', 'checkbox', 'switch',
    'avatar', 'badge', 'tabs', 'separator', 'alert',
])

// ---------------------------------------------------------------------------
// Strict component classification — used by hydroPaste
// ---------------------------------------------------------------------------

/**
 * Ordered substring keys for the strict hydroPaste classification.
 * This matches the ORIGINAL hydroPaste.classifyComponent behavior exactly,
 * collecting ALL matching keywords (not just the first).
 */
const STRICT_CLASSIFICATION_RULES: Array<{
    keywords: string[]
    type: ComponentType
    guard?: (lower: string) => boolean
}> = [
    { keywords: ['textarea', 'text-area', 'multiline'], type: 'textarea' },
    { keywords: ['input', 'field', 'textfield', 'text-field'], type: 'input' },
    { keywords: ['select', 'dropdown', 'combobox'], type: 'select' },
    { keywords: ['checkbox', 'check-box'], type: 'checkbox' },
    { keywords: ['switch', 'toggle'], type: 'switch' },
    { keywords: ['avatar', 'profile-pic'], type: 'avatar' },
    { keywords: ['badge', 'tag', 'chip'], type: 'badge' },
    { keywords: ['tab'], type: 'tabs', guard: (lower) => !lower.includes('table') },
    { keywords: ['separator', 'divider'], type: 'separator' },
    { keywords: ['alert', 'message', 'notification', 'toast'], type: 'alert' },
]

/**
 * Classify a Figma node name into a strict UI component type (hydroPaste pipeline).
 * Returns null when no keyword matches. Does NOT match structural types like
 * card, nav, header, footer, button, label, dialog — those are handled by
 * classifyFrame and isLikelyButton in hydroPaste.
 *
 * When `componentType` is provided (e.g. from Figma MCP data-name enrichment),
 * it is trusted as a high-confidence override.
 */
export function classifyComponentName(name: string, componentType?: string): ComponentClassification | null {
    // High-confidence path: componentType already set by upstream enrichment
    if (componentType) {
        return { type: componentType as ComponentType, matchedKeywords: [`data-name:${componentType}`] }
    }

    const lower = name.toLowerCase()

    // Exact match: "hr" → separator (substring would be too aggressive)
    if (lower === 'hr') {
        return { type: 'separator', matchedKeywords: ['hr'] }
    }

    // Evaluate rules in order — first match wins, but collect ALL matching keywords
    for (const rule of STRICT_CLASSIFICATION_RULES) {
        const matched: string[] = []
        for (const kw of rule.keywords) {
            if (kw === 'tab' && lower === 'tabs') {
                matched.push('tab')
            } else if (lower.includes(kw)) {
                matched.push(kw)
            }
        }
        if (matched.length > 0) {
            // Apply guard if present
            if (rule.guard && !rule.guard(lower)) continue
            return { type: rule.type, matchedKeywords: matched }
        }
    }

    return null
}

// ---------------------------------------------------------------------------
// Broad data-name classification — used by figmaMcpParser & figmaJsxTransformer
// ---------------------------------------------------------------------------

/**
 * Classify a data-name string into a component type (broad set).
 * Includes structural types like card, button, nav, header, footer, label, dialog.
 * Used by figmaMcpParser and figmaJsxTransformer for Figma MCP enrichment.
 */
export function classifyDataName(dataName: string): string | null {
    const lower = dataName.toLowerCase().trim()

    // Skip decorative/structural names
    if (SKIP_NAMES.has(lower)) return null

    // Exact match
    if (COMPONENT_NAME_MAP[lower]) return COMPONENT_NAME_MAP[lower]

    // Substring match — first match wins, order matters
    for (const entry of ORDERED_SUBSTRING_KEYS) {
        if (lower.includes(entry.key)) {
            // Apply guard if present (e.g. "tab" must not match "table")
            if (entry.guard && !entry.guard(lower)) continue
            return entry.type
        }
    }

    return null
}
