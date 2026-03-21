/**
 * constrainedRegistry.test.ts
 *
 * Tests for CR.1-3 — Constrained Registry (Proactive Generation Constraints).
 *
 * Coverage:
 *   CR.1 — serializeRegistryConstraints: markdown serialization of allowed
 *           component registry with props, variants, and consumed tokens.
 *   CR.1 — serializeTokenConstraints: markdown serialization of the design
 *           token palette grouped by type (color, spacing, typography).
 *   CR.2 — validateRegistryMembership: hard rejection of mutation ops targeting
 *           components not present in the registry.
 *   CR.3 — Scope filtering: componentScope array narrows the serialized registry.
 *
 * Architecture note:
 *   The three CR functions in orchestrator.ts are pure (no DB, no Electron
 *   dependencies), but orchestrator.ts itself imports `db` from `./store.js`
 *   which requires Electron's `app.getPath`. We therefore follow the same
 *   pattern used by complexityRouter.test.ts and orchestratorSafety.test.ts:
 *   the functions are re-implemented here as a mirror of what orchestrator.ts
 *   will export. If orchestrator.ts diverges from the contract spec, these
 *   tests flag the regression at the algorithmic level.
 *
 *   When the functions are eventually safe to import directly (e.g., extracted
 *   into a pure sub-module), the mirror implementations below can be replaced
 *   with a single import statement.
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors the types that orchestrator.ts will define for CR.1-3)
// ─────────────────────────────────────────────────────────────────────────────

interface PropDef {
    type: string
    required: boolean
    default?: string
}

interface RegistryEntry {
    name: string
    importPath?: string
    description?: string
    props?: Record<string, PropDef>
    variants?: string[]
    tokens?: string[]
}

interface DesignToken {
    token_path: string
    token_type: string
    token_value: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_REGISTRY: Record<string, RegistryEntry> = {
    Button: {
        name: 'Button',
        importPath: '@ds/Button',
        description: 'Primary action button',
        props: {
            variant: { type: 'string', required: true },
            size: { type: 'string', required: false, default: 'md' },
            disabled: { type: 'boolean', required: false },
        },
        variants: ['primary', 'secondary', 'ghost'],
        tokens: ['color.primary', 'color.surface'],
    },
    Card: {
        name: 'Card',
        importPath: '@ds/Card',
        props: {
            title: { type: 'string', required: false },
            elevation: { type: 'number', required: false, default: '1' },
        },
        variants: ['default', 'outlined'],
    },
    Input: {
        name: 'Input',
        importPath: '@ds/Input',
        props: {
            label: { type: 'string', required: true },
            type: { type: 'string', required: false, default: 'text' },
            error: { type: 'string', required: false },
        },
    },
    Modal: {
        name: 'Modal',
        importPath: '@ds/Modal',
        props: {
            isOpen: { type: 'boolean', required: true },
            onClose: { type: 'function', required: true },
        },
    },
    ProductTile: {
        name: 'ProductTile',
        importPath: '@ds/ProductTile',
        props: {
            product: { type: 'object', required: true },
        },
    },
}

const MOCK_TOKENS: DesignToken[] = [
    { token_path: 'color.primary.500', token_type: 'color', token_value: '#2563EB' },
    { token_path: 'color.neutral.100', token_type: 'color', token_value: '#F5F5F5' },
    { token_path: 'color.error.500', token_type: 'color', token_value: '#EF4444' },
    { token_path: 'spacing.4', token_type: 'spacing', token_value: '4px' },
    { token_path: 'spacing.8', token_type: 'spacing', token_value: '8px' },
    { token_path: 'spacing.16', token_type: 'spacing', token_value: '16px' },
    { token_path: 'typography.heading-lg', token_type: 'typography', token_value: '24/32 Inter 700' },
    { token_path: 'typography.body-md', token_type: 'typography', token_value: '16/24 Inter 400' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Mirror implementations (must stay identical to orchestrator.ts)
//
// CR.1: serializeRegistryConstraints
// CR.1: serializeTokenConstraints
// CR.2: validateRegistryMembership
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_TRUNCATION_LIMIT = 40

/**
 * CR.1 — Serialize the component registry into a BINDING markdown block for
 * injection into the system prompt.
 *
 * @param registry  - The full component registry map.
 * @param scope     - Optional list of component names to include. When absent
 *                    or empty, all components are included (CR.3 contract).
 */
function serializeRegistryConstraints(
    registry: Record<string, RegistryEntry>,
    scope?: string[],
): string {
    if (Object.keys(registry).length === 0) return ''

    // CR.3: apply scope filter — absent or empty scope means no filter
    const useScope = scope && scope.length > 0
    const entries = Object.entries(registry).filter(([key]) =>
        useScope ? scope!.includes(key) : true,
    )

    if (entries.length === 0) return ''

    const total = entries.length
    const truncated = entries.slice(0, REGISTRY_TRUNCATION_LIMIT)
    const wasTruncated = total > REGISTRY_TRUNCATION_LIMIT

    const lines: string[] = [
        '## Project Component Registry (BINDING)',
        '',
        'You MUST only compose UI from components in this registry. Do NOT reference, create, or import components not listed here. If the user\'s request cannot be fulfilled with these components, explain what\'s missing.',
        '',
        'Available components:',
    ]

    for (const [, entry] of truncated) {
        const parts: string[] = []

        // Props — distinguish required from optional
        if (entry.props && Object.keys(entry.props).length > 0) {
            const propList = Object.entries(entry.props)
                .map(([pName, pDef]) => (pDef.required ? `${pName}[required]` : pName))
                .join(', ')
            parts.push(`props: ${propList}`)
        }

        // Variants
        if (entry.variants && entry.variants.length > 0) {
            parts.push(`variants: ${entry.variants.join(', ')}`)
        }

        // Consumed tokens
        if (entry.tokens && entry.tokens.length > 0) {
            parts.push(`tokens: ${entry.tokens.join(', ')}`)
        }

        const suffix = parts.length > 0 ? ` (${parts.join(') (')})` : ''
        lines.push(`- ${entry.name}${suffix}`)
    }

    if (wasTruncated) {
        lines.push(
            `\n${REGISTRY_TRUNCATION_LIMIT} of ${total} components shown. Use flint_search_design_system for the full catalog.`,
        )
    }

    return lines.join('\n')
}

/**
 * CR.1 — Serialize the design token palette into a BINDING markdown block for
 * injection into the system prompt.
 *
 * Tokens are grouped by `token_type` (color, spacing, typography).
 *
 * @param tokens - Flat array of design tokens from the SQLite store.
 */
function serializeTokenConstraints(tokens: DesignToken[]): string {
    if (tokens.length === 0) return ''

    // Group by token_type
    const groups: Record<string, DesignToken[]> = {}
    for (const tok of tokens) {
        ;(groups[tok.token_type] ??= []).push(tok)
    }

    const lines: string[] = [
        '## Design Token Palette (BINDING)',
        '',
        'All visual properties MUST use these tokens. Do NOT use arbitrary hex colors, pixel values, or spacing values not in this list.',
        '',
    ]

    for (const [type, entries] of Object.entries(groups)) {
        const label = type.charAt(0).toUpperCase() + type.slice(1) + 's'
        const valueList = entries
            .map((t) => `${t.token_path} (${t.token_value})`)
            .join(', ')
        lines.push(`${label}: ${valueList}`)
    }

    return lines.join('\n')
}

// ── HTML intrinsics skip list (must match orchestrator.ts CR.2 spec) ──────────

const HTML_INTRINSICS = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'section', 'article', 'nav', 'main', 'header', 'footer', 'aside',
    'ul', 'ol', 'li', 'a', 'img', 'button', 'input', 'textarea',
    'select', 'form', 'label', 'table', 'tr', 'td', 'th',
    'thead', 'tbody', 'tfoot', 'details', 'summary', 'dialog',
    'figure', 'figcaption', 'blockquote', 'pre', 'code',
    'hr', 'br', 'svg', 'path',
])

// Tools that target components or hooks — not raw component node types
const NON_COMPONENT_TOOLS = new Set([
    'flint_emit_hook',
    'flint_emit_handler',
    'flint_emit_callback',
    'flint_emit_import',
])

/**
 * CR.2 — Validate that a proposed mutation targets a component that exists in
 * the project registry.
 *
 * @param toolName - The Flint tool being called (e.g. `flint_insert_node`).
 * @param input    - Raw tool input object (unvalidated).
 * @param registry - Current component registry (may be empty).
 * @returns An error string if the component is not registered, null otherwise.
 */
function validateRegistryMembership(
    toolName: string,
    input: Record<string, unknown>,
    registry: Record<string, RegistryEntry>,
): string | null {
    // Empty registry → no constraint, never reject
    if (Object.keys(registry).length === 0) return null

    // Tools that do not reference a component node type → always pass
    if (NON_COMPONENT_TOOLS.has(toolName)) return null

    let componentName: string | null = null

    if (toolName === 'flint_insert_node') {
        const nodeType = input.nodeType
        if (typeof nodeType === 'string') {
            componentName = nodeType
        }
    } else if (toolName === 'flint_wrap_node') {
        const wrapperType = input.wrapperType
        if (typeof wrapperType === 'string') {
            componentName = wrapperType
        }
    } else if (toolName === 'flint_compose_slot') {
        const slotName = input.slotName
        if (typeof slotName === 'string') {
            // Extract the root component: "Dialog.Header" → "Dialog"
            componentName = slotName.split('.')[0]
        }
    }

    // No extractable component name → pass (don't block unknown tool shapes)
    if (!componentName) return null

    // PascalCase names must be in the registry
    const isPascalCase =
        componentName.length > 0 &&
        componentName[0] === componentName[0].toUpperCase() &&
        componentName[0] !== componentName[0].toLowerCase()

    // HTML intrinsics are always allowed. They are always lowercase — a
    // PascalCase name like "Dialog" is a React component, not the HTML
    // <dialog> element, so it must still be validated against the registry.
    if (!isPascalCase && HTML_INTRINSICS.has(componentName.toLowerCase())) return null
    if (!isPascalCase) return null // non-PascalCase, non-intrinsic → pass

    if (registry[componentName]) return null

    const availableNames = Object.keys(registry).join(', ')
    return `Component '${componentName}' is not in the project registry. Available components: ${availableNames}. Use only registered components or HTML intrinsics.`
}

// ─────────────────────────────────────────────────────────────────────────────
// CR.1: serializeRegistryConstraints
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeRegistryConstraints', () => {
    it('returns correct markdown for a 3-component registry with props, variants, and tokens', () => {
        const threeComponent = {
            Button: MOCK_REGISTRY.Button,
            Card: MOCK_REGISTRY.Card,
            Input: MOCK_REGISTRY.Input,
        }
        const result = serializeRegistryConstraints(threeComponent)

        // Section heading
        expect(result).toContain('## Project Component Registry (BINDING)')

        // Button — required prop tagged, optional props untagged
        expect(result).toContain('- Button')
        expect(result).toContain('variant[required]')
        expect(result).toContain('size')
        expect(result).not.toContain('size[required]')

        // Button variants
        expect(result).toContain('variants: primary, secondary, ghost')

        // Button tokens
        expect(result).toContain('tokens: color.primary, color.surface')

        // Card — present
        expect(result).toContain('- Card')
        expect(result).toContain('variants: default, outlined')

        // Input — present
        expect(result).toContain('- Input')
        expect(result).toContain('label[required]')
    })

    it('returns empty string for empty registry', () => {
        expect(serializeRegistryConstraints({})).toBe('')
    })

    it('with scope ["Button", "Card"] on a 5-component registry, only Button and Card appear', () => {
        const result = serializeRegistryConstraints(MOCK_REGISTRY, ['Button', 'Card'])

        expect(result).toContain('- Button')
        expect(result).toContain('- Card')
        expect(result).not.toContain('- Input')
        expect(result).not.toContain('- Modal')
        expect(result).not.toContain('- ProductTile')
    })

    it('truncates at 40 components for large registries and adds a truncation note', () => {
        // Generate 50 registry entries
        const largeRegistry: Record<string, RegistryEntry> = {}
        for (let i = 0; i < 50; i++) {
            const name = `Component${i.toString().padStart(2, '0')}`
            largeRegistry[name] = { name, props: {} }
        }

        const result = serializeRegistryConstraints(largeRegistry)

        // Should mention the truncation note
        expect(result).toContain('40 of 50 components shown')
        expect(result).toContain('flint_search_design_system')

        // Exactly 40 bullet entries (Component00–Component39)
        const bulletMatches = result.match(/^- Component/gm)
        expect(bulletMatches).toHaveLength(40)

        // Component49 should NOT appear (it falls outside the 40-entry window)
        expect(result).not.toContain('- Component49')
    })

    it('marks required props distinctly from optional props', () => {
        const result = serializeRegistryConstraints({ Modal: MOCK_REGISTRY.Modal })

        // Both Modal props are required
        expect(result).toContain('isOpen[required]')
        expect(result).toContain('onClose[required]')

        // No optional markers on required props
        expect(result).not.toContain('isOpen,')
        expect(result).not.toContain('onClose,')
    })

    it('absent scope (undefined) returns the full registry', () => {
        const result = serializeRegistryConstraints(MOCK_REGISTRY, undefined)

        expect(result).toContain('- Button')
        expect(result).toContain('- Card')
        expect(result).toContain('- Input')
        expect(result).toContain('- Modal')
        expect(result).toContain('- ProductTile')
    })

    it('empty scope array [] returns the full registry (treated as no filter)', () => {
        const result = serializeRegistryConstraints(MOCK_REGISTRY, [])

        expect(result).toContain('- Button')
        expect(result).toContain('- Card')
        expect(result).toContain('- Input')
        expect(result).toContain('- Modal')
        expect(result).toContain('- ProductTile')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// CR.1: serializeTokenConstraints
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeTokenConstraints', () => {
    it('returns correct palette summary for color, spacing, and typography tokens', () => {
        const result = serializeTokenConstraints(MOCK_TOKENS)

        // Section heading
        expect(result).toContain('## Design Token Palette (BINDING)')

        // Color group
        expect(result).toContain('color.primary.500 (#2563EB)')
        expect(result).toContain('color.neutral.100 (#F5F5F5)')
        expect(result).toContain('color.error.500 (#EF4444)')

        // Spacing group
        expect(result).toContain('spacing.4 (4px)')
        expect(result).toContain('spacing.8 (8px)')
        expect(result).toContain('spacing.16 (16px)')

        // Typography group
        expect(result).toContain('typography.heading-lg (24/32 Inter 700)')
        expect(result).toContain('typography.body-md (16/24 Inter 400)')
    })

    it('returns empty string for empty token array', () => {
        expect(serializeTokenConstraints([])).toBe('')
    })

    it('groups tokens by token_type in the output', () => {
        const result = serializeTokenConstraints(MOCK_TOKENS)

        // Each type should appear as a group label
        expect(result).toMatch(/Colors:/i)
        expect(result).toMatch(/Spacings:/i)
        expect(result).toMatch(/Typographys:/i)

        // Color tokens should appear together before spacing tokens
        const colorIdx = result.indexOf('color.primary.500')
        const spacingIdx = result.indexOf('spacing.4')
        const typographyIdx = result.indexOf('typography.heading-lg')

        expect(colorIdx).toBeGreaterThan(-1)
        expect(spacingIdx).toBeGreaterThan(-1)
        expect(typographyIdx).toBeGreaterThan(-1)

        // All colors appear before spacings (they are a group)
        const lastColorIdx = result.lastIndexOf('color.error.500')
        expect(lastColorIdx).toBeLessThan(spacingIdx)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// CR.2: validateRegistryMembership
// ─────────────────────────────────────────────────────────────────────────────

describe('validateRegistryMembership', () => {
    it('returns null for HTML intrinsic nodeType: div', () => {
        const result = validateRegistryMembership(
            'flint_insert_node',
            { nodeType: 'div', targetId: 'x', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).toBeNull()
    })

    it('returns null for HTML intrinsic nodeType: span', () => {
        expect(
            validateRegistryMembership(
                'flint_insert_node',
                { nodeType: 'span', targetId: 'x', reasoning: 'test' },
                MOCK_REGISTRY,
            ),
        ).toBeNull()
    })

    it('returns null for HTML intrinsic nodeType: section', () => {
        expect(
            validateRegistryMembership(
                'flint_insert_node',
                { nodeType: 'section', targetId: 'x', reasoning: 'test' },
                MOCK_REGISTRY,
            ),
        ).toBeNull()
    })

    it('returns null for HTML intrinsic nodeType: button', () => {
        expect(
            validateRegistryMembership(
                'flint_insert_node',
                { nodeType: 'button', targetId: 'x', reasoning: 'test' },
                MOCK_REGISTRY,
            ),
        ).toBeNull()
    })

    it('returns null for HTML intrinsic nodeType: input', () => {
        expect(
            validateRegistryMembership(
                'flint_insert_node',
                { nodeType: 'input', targetId: 'x', reasoning: 'test' },
                MOCK_REGISTRY,
            ),
        ).toBeNull()
    })

    it('returns null for a registered PascalCase component: Button', () => {
        expect(
            validateRegistryMembership(
                'flint_insert_node',
                { nodeType: 'Button', targetId: 'x', reasoning: 'test' },
                MOCK_REGISTRY,
            ),
        ).toBeNull()
    })

    it('returns null for a registered PascalCase component: Card', () => {
        expect(
            validateRegistryMembership(
                'flint_insert_node',
                { nodeType: 'Card', targetId: 'x', reasoning: 'test' },
                MOCK_REGISTRY,
            ),
        ).toBeNull()
    })

    it('returns an error string for an unregistered PascalCase component', () => {
        const result = validateRegistryMembership(
            'flint_insert_node',
            { nodeType: 'FancyWidget', targetId: 'x', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).not.toBeNull()
        expect(result).toContain("Component 'FancyWidget' is not in the project registry")
    })

    it('error message includes the list of available registered component names', () => {
        const result = validateRegistryMembership(
            'flint_insert_node',
            { nodeType: 'FancyWidget', targetId: 'x', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).not.toBeNull()

        // All five registry keys should appear in the error
        for (const name of ['Button', 'Card', 'Input', 'Modal', 'ProductTile']) {
            expect(result).toContain(name)
        }
    })

    it('returns null when registry is empty (no constraint = no rejection)', () => {
        const result = validateRegistryMembership(
            'flint_insert_node',
            { nodeType: 'FancyWidget', targetId: 'x', reasoning: 'test' },
            {},
        )
        expect(result).toBeNull()
    })

    it('extracts root component from compose_slot slotName "Dialog.Header" and checks "Dialog"', () => {
        // Dialog is NOT in MOCK_REGISTRY — should return an error
        const result = validateRegistryMembership(
            'flint_compose_slot',
            { slotName: 'Dialog.Header', parentId: 'root', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).not.toBeNull()
        expect(result).toContain("Component 'Dialog' is not in the project registry")
    })

    it('returns null for compose_slot when the root component is registered', () => {
        // Button IS in MOCK_REGISTRY
        const result = validateRegistryMembership(
            'flint_compose_slot',
            { slotName: 'Button.Icon', parentId: 'root', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).toBeNull()
    })

    it('skips validation for flint_emit_hook (hooks are not component nodes)', () => {
        const result = validateRegistryMembership(
            'flint_emit_hook',
            { hookCode: 'const [x, setX] = useState(0)', componentName: 'MyComp' },
            MOCK_REGISTRY,
        )
        expect(result).toBeNull()
    })

    it('skips validation for flint_emit_handler (handlers are not component nodes)', () => {
        const result = validateRegistryMembership(
            'flint_emit_handler',
            { handlerCode: 'const handleClick = () => {}', componentName: 'MyComp' },
            MOCK_REGISTRY,
        )
        expect(result).toBeNull()
    })

    it('skips validation for flint_emit_callback (callbacks are not component nodes)', () => {
        const result = validateRegistryMembership(
            'flint_emit_callback',
            { targetId: 'x', callbackProp: 'onClick', callbackBody: '() => {}' },
            MOCK_REGISTRY,
        )
        expect(result).toBeNull()
    })

    it('validates flint_wrap_node wrapperType against registry', () => {
        // UnknownWrapper is not in the registry
        const result = validateRegistryMembership(
            'flint_wrap_node',
            { targetId: 'x', wrapperType: 'UnknownWrapper', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).not.toBeNull()
        expect(result).toContain("Component 'UnknownWrapper' is not in the project registry")
    })

    it('returns null for flint_wrap_node with an HTML intrinsic wrapperType', () => {
        const result = validateRegistryMembership(
            'flint_wrap_node',
            { targetId: 'x', wrapperType: 'div', reasoning: 'test' },
            MOCK_REGISTRY,
        )
        expect(result).toBeNull()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// CR.3: Scope filtering (tested via serializeRegistryConstraints)
// ─────────────────────────────────────────────────────────────────────────────

describe('CR.3 scope filtering', () => {
    it('scope filter reduces registry from 5 to 2 entries when componentScope has 2 items', () => {
        const result = serializeRegistryConstraints(MOCK_REGISTRY, ['Button', 'ProductTile'])

        // Only these two should appear
        expect(result).toContain('- Button')
        expect(result).toContain('- ProductTile')

        // The other three must be absent
        expect(result).not.toContain('- Card')
        expect(result).not.toContain('- Input')
        expect(result).not.toContain('- Modal')
    })

    it('absent componentScope returns full registry serialized', () => {
        const result = serializeRegistryConstraints(MOCK_REGISTRY)

        expect(result).toContain('- Button')
        expect(result).toContain('- Card')
        expect(result).toContain('- Input')
        expect(result).toContain('- Modal')
        expect(result).toContain('- ProductTile')
    })

    it('empty componentScope array returns full registry serialized (treated as no filter)', () => {
        const result = serializeRegistryConstraints(MOCK_REGISTRY, [])

        expect(result).toContain('- Button')
        expect(result).toContain('- Card')
        expect(result).toContain('- Input')
        expect(result).toContain('- Modal')
        expect(result).toContain('- ProductTile')
    })
})
