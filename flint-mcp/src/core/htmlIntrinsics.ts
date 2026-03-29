/**
 * Canonical HTML intrinsic elements + React built-ins — CR-SEAL shared constant.
 *
 * These elements never require registry membership. Used by:
 *   - MithrilLinter.ts (visitRegistryUsage / REG-001)
 *   - hydroPaste.ts (validateGeneratedComponents)
 *   - electron/orchestrator.ts (validateRegistryMembership / CR.2)
 *
 * The orchestrator lives across a package boundary (electron/) and maintains
 * its own copy — keep both in sync when updating this set.
 */

/** Standard HTML elements that are valid JSX intrinsics. */
export const HTML_INTRINSIC_TAGS = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button',
    'img', 'input', 'textarea', 'select', 'option', 'form', 'label', 'ul',
    'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'nav',
    'header', 'footer', 'main', 'section', 'article', 'aside', 'figure',
    'figcaption', 'details', 'summary', 'dialog', 'svg', 'path', 'circle',
    'rect', 'line', 'polyline', 'polygon', 'video', 'audio', 'source',
    'canvas', 'pre', 'code', 'blockquote', 'hr', 'br', 'strong', 'em',
    'small', 'sub', 'sup', 'mark', 'del', 'ins', 'abbr', 'time',
])

/**
 * React built-in components with PascalCase names that should never be
 * flagged as unregistered. These are framework primitives, not user components.
 */
export const REACT_BUILTINS = new Set([
    'React',
    'Fragment',
    'Suspense',
    'StrictMode',
    'Profiler',
])

/**
 * Combined set: HTML intrinsics + React built-ins.
 * Use this for registry membership validation where both should be allowed.
 */
export const REGISTRY_PASSTHROUGH = new Set([
    ...HTML_INTRINSIC_TAGS,
    ...REACT_BUILTINS,
])
