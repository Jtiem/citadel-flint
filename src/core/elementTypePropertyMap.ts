/**
 * elementTypePropertyMap — src/core/elementTypePropertyMap.ts
 *
 * Pure-function registry that maps JSX element tag names to the set of
 * inspector sections that are relevant for that element type, and the
 * subset that should be auto-expanded on first render after selection.
 *
 * 24 intrinsic HTML tags are mapped across 5 categorical buckets.
 * Unknown tags (including capitalized custom component names) fall back
 * to the generic inspector: all non-specialised sections, all collapsed.
 *
 * No store, no IPC, no side effects.
 *
 * Renderer Process only — no Node.js imports.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * The 7 inspector section kinds surfaced to end users.
 * Matches the InspectorSection type in INSPECTOR.1.contract.ts.
 */
export type InspectorSection =
    | 'Typography'
    | 'Layout'
    | 'Appearance'
    | 'MediaProps'
    | 'FormProps'
    | 'A11y'
    | 'NodeProperties'

// ── Bucket definitions ─────────────────────────────────────────────────────────

/**
 * Text tags: headings, inline text, labels.
 * Relevant: Typography (auto-expanded), Layout, A11y, NodeProperties
 */
const TEXT_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'span', 'label', 'strong', 'em',
])

// FIX 7: marked as const for type safety and mutation prevention (Security LOW-2)
const TEXT_SECTIONS = ['Typography', 'Layout', 'A11y', 'NodeProperties'] as const satisfies readonly InspectorSection[]
const TEXT_AUTO_EXPAND = ['Typography'] as const satisfies readonly InspectorSection[]

/**
 * Container tags: structural layout elements.
 * Relevant: Layout (auto-expanded), Appearance, A11y, NodeProperties
 */
const CONTAINER_TAGS = new Set([
    'section', 'article', 'main', 'aside',
    'nav', 'div', 'header', 'footer',
])

const CONTAINER_SECTIONS = ['Layout', 'Appearance', 'A11y', 'NodeProperties'] as const satisfies readonly InspectorSection[]
const CONTAINER_AUTO_EXPAND = ['Layout'] as const satisfies readonly InspectorSection[]

/**
 * Media tags: images, video, vector.
 * Relevant: MediaProps (auto-expanded), Layout, A11y, NodeProperties
 */
const MEDIA_TAGS = new Set(['img', 'video', 'picture', 'svg'])

const MEDIA_SECTIONS = ['MediaProps', 'Layout', 'A11y', 'NodeProperties'] as const satisfies readonly InspectorSection[]
const MEDIA_AUTO_EXPAND = ['MediaProps'] as const satisfies readonly InspectorSection[]

/**
 * Interactive tags: clickable and navigable elements.
 * Relevant: Typography (auto-expanded), Layout, A11y, NodeProperties
 */
const INTERACTIVE_TAGS = new Set(['button', 'a'])

const INTERACTIVE_SECTIONS = ['Typography', 'Layout', 'A11y', 'NodeProperties'] as const satisfies readonly InspectorSection[]
const INTERACTIVE_AUTO_EXPAND = ['Typography'] as const satisfies readonly InspectorSection[]

/**
 * Form tags: data entry elements.
 * Relevant: FormProps (auto-expanded), Typography, A11y, NodeProperties
 */
const FORM_TAGS = new Set(['input', 'textarea', 'select'])

const FORM_SECTIONS = ['FormProps', 'Typography', 'A11y', 'NodeProperties'] as const satisfies readonly InspectorSection[]
const FORM_AUTO_EXPAND = ['FormProps'] as const satisfies readonly InspectorSection[]

/**
 * Generic fallback: all sections collapsed.
 * Per ODQ-4, ambiguous elements like <div> and <span> receive the full
 * inspector so no real controls are hidden. Unknown / capitalized custom
 * component names also fall here.
 *
 * FIX 6: Layout-first ordering — custom components are container-shaped
 * in the vast majority of cases, so Layout is the more likely first edit.
 */
const GENERIC_SECTIONS = [
    'Layout', 'Typography', 'Appearance', 'A11y', 'NodeProperties',
] as const satisfies readonly InspectorSection[]
const GENERIC_AUTO_EXPAND = [] as const satisfies readonly InspectorSection[]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

interface BucketEntry {
    sections: readonly InspectorSection[]
    autoExpand: readonly InspectorSection[]
}

function resolveBucket(tagName: string): BucketEntry {
    if (TEXT_TAGS.has(tagName))        return { sections: TEXT_SECTIONS,        autoExpand: TEXT_AUTO_EXPAND }
    if (CONTAINER_TAGS.has(tagName))   return { sections: CONTAINER_SECTIONS,   autoExpand: CONTAINER_AUTO_EXPAND }
    if (MEDIA_TAGS.has(tagName))       return { sections: MEDIA_SECTIONS,       autoExpand: MEDIA_AUTO_EXPAND }
    if (INTERACTIVE_TAGS.has(tagName)) return { sections: INTERACTIVE_SECTIONS, autoExpand: INTERACTIVE_AUTO_EXPAND }
    if (FORM_TAGS.has(tagName))        return { sections: FORM_SECTIONS,        autoExpand: FORM_AUTO_EXPAND }
    // Unknown tag (including capitalized custom components) → generic fallback
    return { sections: GENERIC_SECTIONS, autoExpand: GENERIC_AUTO_EXPAND }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of inspector sections relevant for `tagName`.
 *
 * For unknown or capitalized tags (custom components), returns the full
 * generic section list with all sections collapsed (per ODQ-4).
 */
export function getRelevantSections(tagName: string): readonly InspectorSection[] {
    return resolveBucket(tagName).sections
}

/**
 * Returns the subset of sections that should be auto-expanded on first
 * render after selection. Per ODQ-3, this is at most ONE section per
 * specialized tag. Generic / unknown tags return an empty array (user picks).
 */
export function getAutoExpandedSections(tagName: string): readonly InspectorSection[] {
    return resolveBucket(tagName).autoExpand
}
