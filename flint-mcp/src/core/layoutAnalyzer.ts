// ---------------------------------------------------------------------------
// layoutAnalyzer — Figma layout properties → Tailwind CSS classes
// ---------------------------------------------------------------------------
// Reads Figma's auto-layout, padding, spacing, sizing, and corner radius
// properties and produces the exact Tailwind utility classes. This replaces
// the hardcoded "flex flex-col" that every frame previously received.
// ---------------------------------------------------------------------------

export interface LayoutClasses {
    display: string
    direction: string
    justify: string
    align: string
    gap: string
    padding: string
    width: string
    height: string
    wrap: string
    overflow: string
    borderRadius: string
}

// Tailwind spacing scale: px value → class suffix
const SPACING_SCALE: Array<[number, string]> = [
    [0, '0'], [1, 'px'], [2, '0.5'], [4, '1'], [6, '1.5'],
    [8, '2'], [10, '2.5'], [12, '3'], [14, '3.5'], [16, '4'],
    [20, '5'], [24, '6'], [28, '7'], [32, '8'], [36, '9'],
    [40, '10'], [44, '11'], [48, '12'], [56, '14'], [64, '16'],
    [80, '20'], [96, '24'],
]

// Tailwind border-radius scale: px value → class
const RADIUS_SCALE: Array<[number, string]> = [
    [0, 'rounded-none'], [2, 'rounded-sm'], [4, 'rounded'],
    [6, 'rounded-md'], [8, 'rounded-lg'], [12, 'rounded-xl'],
    [16, 'rounded-2xl'], [24, 'rounded-3xl'], [9999, 'rounded-full'],
]

/**
 * Map a pixel value to the nearest Tailwind spacing class suffix.
 * Returns the suffix (e.g., "4" for 16px) or "[Xpx]" for non-standard values.
 */
export function mapToSpacingScale(px: number): string {
    if (px <= 0) return '0'

    let closest = SPACING_SCALE[0]
    let minDiff = Math.abs(px - closest[0])

    for (const entry of SPACING_SCALE) {
        const diff = Math.abs(px - entry[0])
        if (diff < minDiff) {
            minDiff = diff
            closest = entry
        }
    }

    // If within 1px of a scale value, use the scale value
    if (minDiff <= 1) return closest[1]

    // Otherwise use arbitrary value
    return `[${Math.round(px)}px]`
}

/**
 * Map a pixel value to the nearest Tailwind border-radius class.
 */
export function mapToRadiusScale(px: number): string {
    if (px <= 0) return 'rounded-none'
    if (px >= 9999) return 'rounded-full'

    let closest = RADIUS_SCALE[0]
    let minDiff = Math.abs(px - closest[0])

    for (const entry of RADIUS_SCALE) {
        if (entry[0] >= 9999) continue // skip rounded-full for proximity check
        const diff = Math.abs(px - entry[0])
        if (diff < minDiff) {
            minDiff = diff
            closest = entry
        }
    }

    if (minDiff <= 1) return closest[1]
    return `rounded-[${Math.round(px)}px]`
}

/**
 * Build padding classes from individual sides.
 */
function buildPadding(top: number, right: number, bottom: number, left: number): string {
    if (top === 0 && right === 0 && bottom === 0 && left === 0) return ''

    // All sides equal
    if (top === right && right === bottom && bottom === left) {
        return `p-${mapToSpacingScale(top)}`
    }

    // Symmetric (top=bottom, left=right)
    if (top === bottom && left === right) {
        const parts: string[] = []
        if (left > 0) parts.push(`px-${mapToSpacingScale(left)}`)
        if (top > 0) parts.push(`py-${mapToSpacingScale(top)}`)
        return parts.join(' ')
    }

    // Individual sides
    const parts: string[] = []
    if (top > 0) parts.push(`pt-${mapToSpacingScale(top)}`)
    if (right > 0) parts.push(`pr-${mapToSpacingScale(right)}`)
    if (bottom > 0) parts.push(`pb-${mapToSpacingScale(bottom)}`)
    if (left > 0) parts.push(`pl-${mapToSpacingScale(left)}`)
    return parts.join(' ')
}

/**
 * Analyze a Figma node's layout properties and return Tailwind classes.
 */
export function analyzeLayout(node: Record<string, unknown>): LayoutClasses {
    const layoutMode = node['layoutMode'] as string | undefined
    const primaryAlign = node['primaryAxisAlignItems'] as string | undefined
    const counterAlign = node['counterAxisAlignItems'] as string | undefined
    const itemSpacing = node['itemSpacing'] as number | undefined
    const paddingTop = (node['paddingTop'] as number) ?? 0
    const paddingRight = (node['paddingRight'] as number) ?? 0
    const paddingBottom = (node['paddingBottom'] as number) ?? 0
    const paddingLeft = (node['paddingLeft'] as number) ?? 0
    const sizingH = node['layoutSizingHorizontal'] as string | undefined
    const sizingV = node['layoutSizingVertical'] as string | undefined
    const cornerRadius = node['cornerRadius'] as number | undefined
    const clipsContent = node['clipsContent'] as boolean | undefined
    const bbox = node['absoluteBoundingBox'] as { width?: number; height?: number } | undefined
    const layoutWrap = node['layoutWrap'] as string | undefined

    const result: LayoutClasses = {
        display: '',
        direction: '',
        justify: '',
        align: '',
        gap: '',
        padding: '',
        width: '',
        height: '',
        wrap: '',
        overflow: '',
        borderRadius: '',
    }

    // Display + direction
    if (layoutMode === 'HORIZONTAL') {
        result.display = 'flex'
        result.direction = 'flex-row'
    } else if (layoutMode === 'VERTICAL') {
        result.display = 'flex'
        result.direction = 'flex-col'
    }
    // NONE or absent = no flex layout (block default)

    // Justify content (primary axis)
    if (layoutMode && layoutMode !== 'NONE') {
        switch (primaryAlign) {
            case 'MIN': result.justify = 'justify-start'; break
            case 'CENTER': result.justify = 'justify-center'; break
            case 'MAX': result.justify = 'justify-end'; break
            case 'SPACE_BETWEEN': result.justify = 'justify-between'; break
        }
    }

    // Align items (counter axis)
    if (layoutMode && layoutMode !== 'NONE') {
        switch (counterAlign) {
            case 'MIN': result.align = 'items-start'; break
            case 'CENTER': result.align = 'items-center'; break
            case 'MAX': result.align = 'items-end'; break
        }
    }

    // Gap
    if (itemSpacing != null && itemSpacing > 0 && layoutMode && layoutMode !== 'NONE') {
        result.gap = `gap-${mapToSpacingScale(itemSpacing)}`
    }

    // Padding
    result.padding = buildPadding(paddingTop, paddingRight, paddingBottom, paddingLeft)

    // Width
    if (sizingH === 'FILL') {
        result.width = 'w-full'
    } else if (sizingH === 'FIXED' && bbox?.width) {
        result.width = `w-[${Math.round(bbox.width)}px]`
    }
    // HUG = auto (default, no class needed)

    // Height
    if (sizingV === 'FILL') {
        result.height = 'h-full'
    } else if (sizingV === 'FIXED' && bbox?.height) {
        result.height = `h-[${Math.round(bbox.height)}px]`
    }

    // Flex wrap
    if (layoutWrap === 'WRAP') {
        result.wrap = 'flex-wrap'
    }

    // Overflow
    if (clipsContent) {
        result.overflow = 'overflow-hidden'
    }

    // Border radius
    if (cornerRadius != null && cornerRadius > 0) {
        result.borderRadius = mapToRadiusScale(cornerRadius)
    }

    return result
}

/**
 * Join all non-empty layout classes into a single className string.
 */
export function layoutClassesToString(classes: LayoutClasses): string {
    return [
        classes.display,
        classes.direction,
        classes.justify,
        classes.align,
        classes.gap,
        classes.padding,
        classes.width,
        classes.height,
        classes.wrap,
        classes.overflow,
        classes.borderRadius,
    ].filter(Boolean).join(' ')
}
