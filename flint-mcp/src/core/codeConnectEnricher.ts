/**
 * codeConnectEnricher.ts — flint-mcp/src/core/codeConnectEnricher.ts
 *
 * Converts Figma MCP Code Connect suggestions (from get_code_connect_suggestions)
 * into component type overrides that improve classification in the D2C pipeline.
 *
 * Code Connect suggestions represent designer-defined mappings between Figma
 * components and code components. They carry the highest classification priority
 * because they come from the design system owner.
 *
 * Pure, stateless module. No I/O.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeConnectSuggestion {
    nodeId: string
    componentName: string
    source: string   // file path
    label: string    // framework label
    confidence?: number
}

export interface EnrichmentResult {
    overrides: Map<string, string>  // nodeId -> componentType
    mappedCount: number
    unmappedCount: number
}

// ---------------------------------------------------------------------------
// Component name -> internal componentType vocabulary
// ---------------------------------------------------------------------------

/**
 * Maps well-known component names and their variants/aliases to Flint's
 * internal componentType vocabulary. Keys are lowercase for case-insensitive
 * matching. The map is intentionally broad to catch library-specific naming
 * conventions (e.g., MUI's "TextField", PrimeNG's "InputText").
 */
const COMPONENT_NAME_MAP: Record<string, string> = {
    // Button family
    'button': 'button',
    'btn': 'button',
    'iconbutton': 'button',

    // Input family
    'input': 'input',
    'textfield': 'input',
    'textinput': 'input',
    'inputtext': 'input',

    // Card family
    'card': 'card',

    // Select family
    'select': 'select',
    'dropdown': 'select',
    'combobox': 'select',

    // Avatar family
    'avatar': 'avatar',

    // Badge family
    'badge': 'badge',
    'chip': 'badge',
    'tag': 'badge',

    // Tabs family
    'tabs': 'tabs',
    'tabbar': 'tabs',
    'tablist': 'tabs',

    // Separator family
    'separator': 'separator',
    'divider': 'separator',
    'hr': 'separator',

    // Checkbox family
    'checkbox': 'checkbox',
    'check': 'checkbox',

    // Switch family
    'switch': 'switch',
    'toggle': 'switch',

    // Textarea family
    'textarea': 'textarea',
    'textareafield': 'textarea',

    // Label family
    'label': 'label',

    // Alert family
    'alert': 'alert',
    'banner': 'alert',
    'notification': 'alert',
    'message': 'alert',
}

/**
 * Ordered list of base names used for substring matching on variant-style
 * names like "Button/Primary" or "Card/Default". More specific entries
 * come first to prevent premature matches (e.g., "textarea" before "text").
 */
const SUBSTRING_MATCH_ORDER: string[] = [
    'textarea',
    'textfield',
    'textinput',
    'inputtext',
    'checkbox',
    'iconbutton',
    'tabbar',
    'tablist',
    'combobox',
    'dropdown',
    'notification',
    'banner',
    'button',
    'btn',
    'input',
    'card',
    'select',
    'avatar',
    'badge',
    'chip',
    'tag',
    'tabs',
    'separator',
    'divider',
    'switch',
    'toggle',
    'label',
    'alert',
    'message',
    'hr',
    'check',
]

// ---------------------------------------------------------------------------
// Default confidence threshold
// ---------------------------------------------------------------------------

const DEFAULT_MIN_CONFIDENCE = 0.5

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a component name to our internal componentType vocabulary.
 *
 * Strategy:
 *   1. Strip variant suffixes ("Button/Primary" -> "Button")
 *   2. Exact match (case-insensitive) against COMPONENT_NAME_MAP
 *   3. Substring match against the base name
 *   4. null if unrecognised
 */
export function resolveComponentType(componentName: string): string | null {
    if (!componentName || typeof componentName !== 'string') return null

    // Strip variant suffix: "Button/Primary" -> "Button"
    const baseName = componentName.split('/')[0].trim()
    const lower = baseName.toLowerCase()

    // Exact match
    if (COMPONENT_NAME_MAP[lower]) {
        return COMPONENT_NAME_MAP[lower]
    }

    // Substring match (for names like "PrimaryButton", "FormInput", etc.)
    for (const key of SUBSTRING_MATCH_ORDER) {
        if (lower.includes(key)) {
            return COMPONENT_NAME_MAP[key]
        }
    }

    return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert Code Connect suggestions into component type overrides.
 *
 * Maps each suggestion's `componentName` to Flint's internal componentType
 * vocabulary. Suggestions below the confidence threshold are skipped.
 * When multiple suggestions target the same nodeId, the last one wins.
 *
 * @param suggestions  Array of Code Connect suggestions from Figma MCP
 * @param library      Target library name (reserved for future per-library tuning)
 * @param minConfidence  Minimum confidence to accept (default 0.5)
 * @returns EnrichmentResult with a Map<nodeId, componentType> of overrides
 */
export function enrichFromCodeConnect(
    suggestions: CodeConnectSuggestion[],
    library: string,
    minConfidence: number = DEFAULT_MIN_CONFIDENCE,
): EnrichmentResult {
    const overrides = new Map<string, string>()
    let unmappedCount = 0

    if (!Array.isArray(suggestions)) {
        return { overrides, mappedCount: 0, unmappedCount: 0 }
    }

    for (const suggestion of suggestions) {
        // Validate required fields
        if (
            !suggestion ||
            typeof suggestion.nodeId !== 'string' ||
            !suggestion.nodeId ||
            typeof suggestion.componentName !== 'string' ||
            !suggestion.componentName
        ) {
            unmappedCount++
            continue
        }

        // Skip low-confidence suggestions
        if (
            typeof suggestion.confidence === 'number' &&
            suggestion.confidence < minConfidence
        ) {
            unmappedCount++
            continue
        }

        const componentType = resolveComponentType(suggestion.componentName)
        if (componentType) {
            overrides.set(suggestion.nodeId, componentType)
        } else {
            unmappedCount++
        }
    }

    return {
        overrides,
        mappedCount: overrides.size,
        unmappedCount,
    }
}
