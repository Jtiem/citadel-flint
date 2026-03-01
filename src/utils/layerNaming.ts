/**
 * layerNaming — src/utils/layerNaming.ts
 *
 * Heuristic naming engine for the Layer Tree panel.
 *
 * Produces a human-readable name for each JSX node by applying a
 * priority waterfall rather than just showing the raw tag name:
 *
 *   1. Explicit React component name  (<Card> → "Card")
 *   2. id attribute                   (id="hero" → "#Hero")
 *   3. Text content                   (<h1>Welcome</h1> → "Welcome")
 *   4. Semantic class word            (.sidebar → "Sidebar")
 *   5. Semantic HTML tag              (<nav> → "Nav")
 *   6. Child inference                (sole <img> child → "Image Wrapper")
 *   7. Fallback                       → "Frame"
 *
 * Renderer Process only — no Node.js imports.
 */

import type { VisualLayer } from '../core/ast-parser'

export type LayerType = 'component' | 'element' | 'text'

export interface LayerName {
    /** Human-readable inferred name shown as the primary label */
    name: string
    /** Visual category used to pick the layer row icon */
    type: LayerType
    /** Raw JSX tag name shown as a secondary badge */
    tag: string
}

// ── Static look-ups ────────────────────────────────────────────────────────────

/** HTML elements whose primary role is holding text content */
const TEXT_TAGS = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'span', 'label', 'li', 'dt', 'dd',
    'caption', 'figcaption', 'blockquote',
    'cite', 'em', 'strong', 'code', 'small',
    'b', 'i', 'td', 'th', 'a',
])

/** Semantic HTML tags that map cleanly to a readable name */
const SEMANTIC_TAGS: Readonly<Record<string, string>> = {
    header: 'Header',
    footer: 'Footer',
    nav: 'Nav',
    main: 'Main',
    aside: 'Sidebar',
    section: 'Section',
    article: 'Article',
    form: 'Form',
    button: 'Button',
    input: 'Input',
    select: 'Select',
    textarea: 'Textarea',
    table: 'Table',
    figure: 'Figure',
    img: 'Image',
    video: 'Video',
    audio: 'Audio',
    ul: 'List',
    ol: 'List',
    dialog: 'Dialog',
    details: 'Details',
    summary: 'Summary',
    picture: 'Picture',
    canvas: 'Canvas',
    svg: 'SVG',
    iframe: 'Embedded Frame',
}

/**
 * Common single-word Tailwind utilities to filter out when scanning
 * className for a semantic word. Hyphened classes (bg-, text-, p-, etc.)
 * are filtered by regex; these single-word utilities are filtered by Set.
 */
const TAILWIND_SINGLES = new Set([
    'flex', 'grid', 'block', 'inline', 'hidden', 'table', 'contents',
    'static', 'fixed', 'absolute', 'relative', 'sticky',
    'visible', 'invisible', 'collapse', 'truncate',
    'italic', 'underline', 'uppercase', 'lowercase', 'capitalize',
    'antialiased', 'subpixel', 'container', 'group', 'peer',
    'grayscale', 'invert', 'blur', 'shadow', 'ring', 'outline',
    'overflow', 'rounded', 'border', 'aspect', 'grow', 'shrink',
    'basis', 'order', 'float', 'clear', 'contents', 'flow',
])

/** Tags that contain display text but serve an interactive/structural role (not 'text' type) */
const INTERACTIVE_TEXT_TAGS = new Set(['button', 'option', 'summary', 'legend'])

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
    return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

function truncate(s: string, maxLen: number): string {
    return s.length <= maxLen ? s : s.slice(0, maxLen).trimEnd() + '…'
}

/**
 * Converts the `textContent` string produced by `extractJSXText` into a
 * human-readable display name.
 *
 * Protocol:
 *   "{expr}" — the "{…}" wrapper is the sentinel that extractJSXText adds.
 *     • "{monthlyPayment}"  → "Monthly Payment"  (camelCase splitting)
 *     • "{result.interest}" → "Result Interest"  (dotted path, each part split)
 *     • "{isEnrolled ? '…}" → "{isEnrolled ? '…}" (complex: keep verbatim)
 *   "Submit form"           → "Submit form"       (literal text: capitalize only)
 */
function parseTextContent(s: string): string {
    if (s.startsWith('{') && s.endsWith('}')) {
        const inner = s.slice(1, -1)
        // Match simple identifiers and dotted member expressions (no spaces, operators, etc.)
        if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(inner)) {
            return inner
                .split('.')
                .flatMap((part) => part.replace(/([A-Z])/g, ' $1').trim().split(/\s+/))
                .filter(Boolean)
                .map(capitalize)
                .join(' ')
        }
        // Complex expression (ternary, call, arithmetic…) — show verbatim with braces
        return s
    }
    return capitalize(s)
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Returns the inferred display name, layer type, and raw tag for a VisualLayer.
 */
export function getLayerName(layer: VisualLayer): LayerName {
    const { tagName, className, idAttr, textContent, children } = layer
    const tag = tagName

    // 1. React component — PascalCase tag name
    if (/^[A-Z]/.test(tagName)) {
        return { name: tagName, type: 'component', tag }
    }

    // 2. id attribute  →  #Hero
    if (idAttr !== undefined && idAttr.trim().length > 0) {
        return { name: `#${capitalize(idAttr.trim())}`, type: 'element', tag }
    }

    const isTextTag = TEXT_TAGS.has(tagName)
    const isInteractiveTag = INTERACTIVE_TEXT_TAGS.has(tagName)

    // 3. Text content — covers text elements AND interactive tags like <button>
    //    textContent may be a literal string or a "{identifier}" marker (from
    //    extractJSXText in ast-parser) that parseTextContent will humanize.
    if ((isTextTag || isInteractiveTag) && textContent !== undefined && textContent.trim().length > 0) {
        const clean = parseTextContent(textContent.trim().replace(/\s+/g, ' '))
        return { name: truncate(clean, 24), type: isTextTag ? 'text' : 'element', tag }
    }

    // 4. Semantic class word  —  filter out Tailwind utilities, capitalize remainder
    if (className !== undefined) {
        const semanticWord = className
            .split(/\s+/)
            .find((cls) => {
                if (cls.length === 0) return false
                // Any class with a hyphen is a Tailwind utility (bg-, text-, p-, etc.)
                if (/^[a-z][a-z0-9]*-/.test(cls)) return false
                // Responsive/state variants: sm:, hover:, md:, etc.
                if (/^[a-z]+:/.test(cls)) return false
                // Single-word known Tailwind utilities
                if (TAILWIND_SINGLES.has(cls)) return false
                // Must be longer than 2 chars to be useful as a name
                return cls.length > 2
            })
        if (semanticWord !== undefined) {
            return { name: capitalize(semanticWord), type: 'element', tag }
        }
    }

    // 5. Semantic HTML tag
    const semanticName = SEMANTIC_TAGS[tagName]
    if (semanticName !== undefined) {
        return { name: semanticName, type: 'element', tag }
    }

    // 6. Child inference
    if (children.length === 1) {
        const only = children[0]
        if (only.tagName === 'img') {
            return { name: 'Image Wrapper', type: 'element', tag }
        }
        if (only.tagName === 'svg' || /[Ii]con/.test(only.tagName)) {
            return { name: 'Icon Wrapper', type: 'element', tag }
        }
    }

    // Text tag with no extractable text → at least type it correctly
    if (isTextTag) {
        return { name: capitalize(tagName), type: 'text', tag }
    }

    // 7. Fallback
    return { name: 'Frame', type: 'element', tag }
}
