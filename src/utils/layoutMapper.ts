/**
 * layoutMapper — src/utils/layoutMapper.ts
 *
 * Manages mutually exclusive Tailwind flexbox and sizing classes using a
 * 'managed-set' approach: only one class from each category can be active
 * at a time.
 *
 * updateLayoutClass strips the current category's class, optionally appends a
 * new value, and guarantees the base `flex` class is present whenever a
 * flex-related class is added.
 *
 * Renderer Process only — no Node.js imports.
 */

// ── Category definitions ───────────────────────────────────────────────────────

export type LayoutCategory =
    | 'flow'
    | 'alignment'
    | 'justification'
    | 'sizing-width'
    | 'sizing-height'

const LAYOUT_SETS: Readonly<Record<LayoutCategory, readonly string[]>> = {
    /**
     * Controls flex-direction + wrapping as a single mutually exclusive choice.
     * flex-row / flex-col set direction; flex-wrap implies row + wrapping.
     */
    flow: ['flex-row', 'flex-col', 'flex-wrap'],
    alignment: [
        'items-start',
        'items-center',
        'items-end',
        'items-stretch',
        'items-baseline',
    ],
    justification: [
        'justify-start',
        'justify-center',
        'justify-end',
        'justify-between',
        'justify-around',
    ],
    /** Width sizing shortcuts: hug content (w-fit) or fill container (w-full). */
    'sizing-width': ['w-fit', 'w-full'],
    /** Height sizing shortcuts: hug content (h-fit) or fill container (h-full). */
    'sizing-height': ['h-fit', 'h-full'],
}

/** Categories that require the base `flex` class when any value is added. */
const FLEX_REQUIRED = new Set<LayoutCategory>(['flow', 'alignment', 'justification'])

// ── Exports ────────────────────────────────────────────────────────────────────

/**
 * Removes any existing class from `category`, optionally adds `newValue`, and
 * ensures the base `flex` class is present when a flex-related class is added.
 *
 * Pass `newValue = ''` to clear the category without adding a replacement.
 */
export function updateLayoutClass(
    currentClass: string,
    category: LayoutCategory,
    newValue: string
): string {
    const categorySet = new Set(LAYOUT_SETS[category])
    const parts = currentClass.split(/\s+/).filter(Boolean)

    // Strip all existing classes from this category.
    const filtered = parts.filter((cls) => !categorySet.has(cls))

    // Append the new value when non-empty.
    if (newValue !== '') {
        filtered.push(newValue)
        // Guarantee the base flex class is present for flex-related categories.
        if (FLEX_REQUIRED.has(category) && !filtered.includes('flex')) {
            filtered.unshift('flex')
        }
    }

    return filtered.join(' ')
}

/**
 * Returns the active class from the given category that is present in
 * `className`, or `''` if none of the category's classes are active.
 */
export function getActiveLayoutClass(
    className: string,
    category: LayoutCategory
): string {
    const classList = new Set(className.split(/\s+/).filter(Boolean))
    for (const cls of LAYOUT_SETS[category]) {
        if (classList.has(cls)) return cls
    }
    return ''
}
