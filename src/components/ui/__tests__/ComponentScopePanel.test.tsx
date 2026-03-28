/**
 * ComponentScopePanel.test.tsx — Phase CR.4 + EN.3 + EN.4
 *
 * Tests for the Component Scope editor panel.
 * Contract test cases:
 *   9–16  from CR.4-contract.md section 10 (preserved)
 *   EN3-1 through EN3-9 from EN.3/EN.4 spec (new)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { ComponentScopePanel } from '../ComponentScopePanel'
import type { ComponentScopeData } from '../../../types/flint-api'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_REGISTRY: ComponentScopeData = {
    registry: {},
    scope: null,
    registryAvailable: false,
}

const TWO_COMPONENTS: ComponentScopeData = {
    registry: {
        Button: {
            name: 'Button',
            props: { label: { type: 'string', required: true }, disabled: { type: 'boolean', required: false } },
            variants: ['primary', 'secondary'],
            consumedTokens: ['color.brand.primary'],
            description: 'A clickable button',
            // No usageExample — not enriched
        },
        Card: {
            name: 'Card',
            props: { title: { type: 'string', required: true } },
            variants: [],
            consumedTokens: [],
            description: 'A card container',
        },
    },
    scope: null,
    registryAvailable: true,
}

/** Registry where one component is fully enriched (description + usageExample). */
const ENRICHED_REGISTRY: ComponentScopeData = {
    registry: {
        Button: {
            name: 'Button',
            props: { label: { type: 'string', required: true } },
            variants: ['primary'],
            consumedTokens: [],
            description: 'A clickable button',
            usageExample: '<Button label="Click me" />',
        },
        Card: {
            name: 'Card',
            props: { title: { type: 'string', required: true } },
            variants: [],
            consumedTokens: [],
            description: 'A card container',
            // No usageExample — bare unless draft exists
        },
    },
    scope: null,
    registryAvailable: true,
}

const RESTRICTED_SCOPE: ComponentScopeData = {
    ...TWO_COMPONENTS,
    scope: ['Button'],
}

const SCOPE_WITH_UNREGISTERED: ComponentScopeData = {
    ...TWO_COMPONENTS,
    scope: ['Button', 'Phantom'],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockScope(data: ComponentScopeData) {
    ;(window.flintAPI.scope!.getRegistryAndScope as ReturnType<typeof vi.fn>).mockResolvedValue(data)
}

function mockScopeFail(message = 'IPC error') {
    ;(window.flintAPI.scope!.getRegistryAndScope as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error(message),
    )
}

/** Set up enrichment mock with drafts + stats. */
function mockEnrichment(
    drafts: Record<string, object> = {},
    stats = { bare: 0, draft: 0, enriched: 0, total: 2 },
) {
    ;(window.flintAPI.enrichment!.getDrafts as ReturnType<typeof vi.fn>).mockResolvedValue({
        drafts,
        enrichmentStats: stats,
    })
}

const SAMPLE_DRAFT = {
    description: 'AI-generated description for Card',
    usageExample: '<Card title="Example" />',
    compositionNotes: 'Often used inside Grid',
    a11yNotes: 'Ensure heading level is correct',
    confidence: 'high' as const,
    usageFileCount: 7,
    sourceFile: 'src/components/Card.tsx',
    generatedAt: '2026-01-01T00:00:00Z',
    generatedBy: 'flint-enrichment-v1',
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ComponentScopePanel', () => {
    beforeEach(() => {
        mockScope(TWO_COMPONENTS)
        mockEnrichment({}, { bare: 2, draft: 0, enriched: 0, total: 2 })
    })

    // ── Case 9: Loading spinner ──────────────────────────────────────────────
    it('renders loading spinner on mount before data arrives', () => {
        ;(window.flintAPI.scope!.getRegistryAndScope as ReturnType<typeof vi.fn>).mockReturnValue(
            new Promise(() => {}),
        )
        render(<ComponentScopePanel />)
        expect(screen.getByText('Loading component registry...')).toBeDefined()
    })

    // ── Case 10: Component list with metadata ────────────────────────────────
    it('renders component list with correct names and metadata after fetch', async () => {
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Button')).toBeDefined()
            expect(screen.getByText('Card')).toBeDefined()
        })
        expect(screen.getByText('2 props')).toBeDefined()
        expect(screen.getByText('2 variants')).toBeDefined()
        expect(screen.getByText('1 tokens')).toBeDefined()
    })

    // ── Case 11: Empty state when registryAvailable is false ─────────────────
    it('shows empty state when registryAvailable is false', async () => {
        mockScope(EMPTY_REGISTRY)
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText(/No components indexed yet/)).toBeDefined()
        })
        expect(screen.getByText('Reindex')).toBeDefined()
    })

    // ── Case 11b: Reindex button calls window.flintAPI.project.reindex ───────
    it('Reindex button in empty state calls project.reindex', async () => {
        mockScope(EMPTY_REGISTRY)
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Reindex')).toBeDefined()
        })
        fireEvent.click(screen.getByText('Reindex'))
        expect(window.flintAPI.project?.reindex).toBeDefined()
        // Verify the mock was invoked
        await waitFor(() => {
            expect(window.flintAPI.project!.reindex as ReturnType<typeof vi.fn>).toHaveBeenCalled()
        })
    })

    // ── Case 12: Toggle checkbox calls setScope with updated array ───────────
    it('toggling a component checkbox calls setScope with updated array', async () => {
        mockScope(RESTRICTED_SCOPE)
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Button')).toBeDefined()
        })

        const cardCheckbox = screen.getByLabelText('Card excluded')
        fireEvent.click(cardCheckbox)

        await waitFor(
            () => {
                const setScope = window.flintAPI.scope!.setScope as ReturnType<typeof vi.fn>
                expect(setScope).toHaveBeenCalled()
                const call = setScope.mock.calls[0][0] as { scope: string[] | null }
                expect(call.scope).toContain('Button')
                expect(call.scope).toContain('Card')
            },
            { timeout: 500 },
        )
    })

    // ── Case 13: "All Components" mode disables all checkboxes ───────────────
    it('"All Components" mode disables all checkboxes', async () => {
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Button')).toBeDefined()
        })
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
        checkboxes.forEach((cb) => {
            expect(cb.disabled).toBe(true)
        })
    })

    // ── Case 14: Switching "All" → "Restricted" seeds all component names ────
    it('switching from "All" to "Restricted" initializes scope with all component names', async () => {
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('All Components')).toBeDefined()
        })

        const restrictedBtn = screen.getByRole('button', { name: 'Restricted' })
        fireEvent.click(restrictedBtn)

        await waitFor(() => {
            const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
            const enabled = checkboxes.filter((cb) => !cb.disabled)
            expect(enabled.length).toBeGreaterThan(0)
            enabled.forEach((cb) => {
                expect(cb.checked).toBe(true)
            })
        })
    })

    // ── Case 15: Error state with retry button ────────────────────────────────
    it('shows error state with retry button on IPC failure', async () => {
        mockScopeFail('scope service unavailable')
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('scope service unavailable')).toBeDefined()
            expect(screen.getByText('Retry')).toBeDefined()
        })
    })

    // ── Case 16: Unregistered section ────────────────────────────────────────
    it('shows "Unregistered" section when scope contains names not in registry', async () => {
        mockScope(SCOPE_WITH_UNREGISTERED)
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Unregistered')).toBeDefined()
            expect(screen.getByText('Phantom')).toBeDefined()
        })
        const unknownBadges = screen.getAllByText('unknown')
        expect(unknownBadges.length).toBeGreaterThan(0)
    })

    // ── Additional: "All" → "Restricted" persists via setScope ───────────────
    it('switching to "Restricted" persists scope via setScope', async () => {
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('All Components')).toBeDefined()
        })

        const restrictedBtn = screen.getByRole('button', { name: 'Restricted' })
        fireEvent.click(restrictedBtn)

        await waitFor(
            () => {
                const setScope = window.flintAPI.scope!.setScope as ReturnType<typeof vi.fn>
                expect(setScope).toHaveBeenCalled()
            },
            { timeout: 500 },
        )
    })

    // ── Additional: Summary chips show correct counts ─────────────────────────
    it('shows correct In Registry, In Scope, and Excluded counts', async () => {
        mockScope(RESTRICTED_SCOPE)
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('In Registry')).toBeDefined()
            expect(screen.getByText('In Scope')).toBeDefined()
            expect(screen.getByText('Excluded')).toBeDefined()
        })
        const inRegistryLabel = screen.getByText('In Registry')
        const registryChip = inRegistryLabel.closest('div')
        expect(registryChip?.textContent).toContain('2')
        const inScopeLabel = screen.getByText('In Scope')
        const scopeChip = inScopeLabel.closest('div')
        expect(scopeChip?.textContent).toContain('1')
    })

    // ── Additional: "All" mode shows "All" in In Scope chip ──────────────────
    it('shows "All" in In Scope chip when in unrestricted mode', async () => {
        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('All')).toBeDefined()
        })
    })

    // ── EN3-1: Green dot for enriched component ────────────────────────────────
    it('renders green dot for components with both description and usageExample', async () => {
        mockScope(ENRICHED_REGISTRY)
        // Button has both description + usageExample → enriched (green)
        // Card has only description, no usageExample → bare (gray) unless draft
        mockEnrichment({}, { bare: 1, draft: 0, enriched: 1, total: 2 })

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Button')).toBeDefined()
        })

        // The enriched dot has aria-label "Enriched"
        const enrichedDots = screen
            .getAllByRole('generic', { hidden: true })
            .filter((el) => el.getAttribute('aria-label') === 'Enriched')
        expect(enrichedDots.length).toBeGreaterThan(0)
    })

    // ── EN3-2: Amber dot for component with pending draft ─────────────────────
    it('renders amber dot for components with pending enrichment drafts', async () => {
        mockScope(TWO_COMPONENTS)
        // Card has a draft
        mockEnrichment(
            { Card: SAMPLE_DRAFT },
            { bare: 1, draft: 1, enriched: 0, total: 2 },
        )

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Card')).toBeDefined()
        })

        const draftDots = screen
            .getAllByRole('generic', { hidden: true })
            .filter((el) => el.getAttribute('aria-label') === 'Draft pending review')
        expect(draftDots.length).toBeGreaterThan(0)
    })

    // ── EN3-3: Gray dot for bare component ────────────────────────────────────
    it('renders gray dot for bare components with no description and no draft', async () => {
        mockScope(TWO_COMPONENTS)
        // TWO_COMPONENTS: Button has description but no usageExample, Card has description
        // Neither has a usageExample → both are gray unless draft exists
        mockEnrichment({}, { bare: 2, draft: 0, enriched: 0, total: 2 })

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Button')).toBeDefined()
        })

        // Dots without description+usageExample and without drafts → gray aria-label
        const bareDots = screen
            .getAllByRole('generic', { hidden: true })
            .filter((el) => el.getAttribute('aria-label') === 'Bare — no description')
        expect(bareDots.length).toBeGreaterThan(0)
    })

    // ── EN3-4: Clicking amber row expands draft details ────────────────────────
    it('expands draft review panel on clicking Review button for draft component', async () => {
        mockScope(TWO_COMPONENTS)
        mockEnrichment(
            { Card: SAMPLE_DRAFT },
            { bare: 1, draft: 1, enriched: 0, total: 2 },
        )

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Card')).toBeDefined()
        })

        // Review button should be visible for Card
        const reviewBtn = screen.getByLabelText('Review draft for Card')
        fireEvent.click(reviewBtn)

        await waitFor(() => {
            // Draft description should be visible
            expect(screen.getByText('AI-generated description for Card')).toBeDefined()
            // Usage example
            expect(screen.getByText('<Card title="Example" />')).toBeDefined()
            // Composition notes
            expect(screen.getByText('Often used inside Grid')).toBeDefined()
            // A11y notes
            expect(screen.getByText('Ensure heading level is correct')).toBeDefined()
        })
    })

    // ── EN3-5: Approve button calls enrichment.approve with correct payload ───
    it('Approve button calls enrichment.approve with action "approve"', async () => {
        mockScope(TWO_COMPONENTS)
        mockEnrichment(
            { Card: SAMPLE_DRAFT },
            { bare: 1, draft: 1, enriched: 0, total: 2 },
        )

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Card')).toBeDefined()
        })

        // Expand draft
        const reviewBtn = screen.getByLabelText('Review draft for Card')
        fireEvent.click(reviewBtn)

        await waitFor(() => {
            expect(screen.getByText('Approve')).toBeDefined()
        })

        const approveBtn = screen.getByText('Approve')
        await act(async () => {
            fireEvent.click(approveBtn)
        })

        const approveFn = window.flintAPI.enrichment!.approve as ReturnType<typeof vi.fn>
        expect(approveFn).toHaveBeenCalledWith({
            componentName: 'Card',
            action: 'approve',
        })
    })

    // ── EN3-6: Dismiss button calls enrichment.approve with action "dismiss" ──
    it('Dismiss button calls enrichment.approve with action "dismiss"', async () => {
        mockScope(TWO_COMPONENTS)
        mockEnrichment(
            { Card: SAMPLE_DRAFT },
            { bare: 1, draft: 1, enriched: 0, total: 2 },
        )

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Card')).toBeDefined()
        })

        // Expand draft
        const reviewBtn = screen.getByLabelText('Review draft for Card')
        fireEvent.click(reviewBtn)

        await waitFor(() => {
            expect(screen.getByText('Dismiss')).toBeDefined()
        })

        const dismissBtn = screen.getByText('Dismiss')
        await act(async () => {
            fireEvent.click(dismissBtn)
        })

        const approveFn = window.flintAPI.enrichment!.approve as ReturnType<typeof vi.fn>
        expect(approveFn).toHaveBeenCalledWith({
            componentName: 'Card',
            action: 'dismiss',
        })
    })

    // ── EN3-7: Discovery banner shown when >50% are bare ─────────────────────
    it('shows discovery banner when more than 50% of components are bare', async () => {
        mockScope(TWO_COMPONENTS)
        // 2 bare out of 2 total → 100% bare → banner should appear
        mockEnrichment({}, { bare: 2, draft: 0, enriched: 0, total: 2 })

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByTestId('discovery-banner')).toBeDefined()
            expect(screen.getByText('Many components lack descriptions.')).toBeDefined()
        })
    })

    // ── EN3-8: Discovery banner hidden after dismiss ───────────────────────────
    it('hides discovery banner after clicking the dismiss (X) button', async () => {
        mockScope(TWO_COMPONENTS)
        mockEnrichment({}, { bare: 2, draft: 0, enriched: 0, total: 2 })

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByTestId('discovery-banner')).toBeDefined()
        })

        const closeBtn = screen.getByLabelText('Dismiss discovery banner')
        fireEvent.click(closeBtn)

        await waitFor(() => {
            expect(screen.queryByTestId('discovery-banner')).toBeNull()
        })
    })

    // ── EN3-9: Health metric shows correct percentage ─────────────────────────
    it('shows registry health metric with correct percentage', async () => {
        mockScope(ENRICHED_REGISTRY)
        // 1 enriched out of 2 total → 50%
        mockEnrichment({}, { bare: 1, draft: 0, enriched: 1, total: 2 })

        render(<ComponentScopePanel />)
        await waitFor(() => {
            expect(screen.getByText('Registry Health:')).toBeDefined()
        })

        const pctEl = screen.getByTestId('health-percentage')
        expect(pctEl.textContent).toBe('50%')

        // Should also show breakdown text
        expect(screen.getByText('1 enriched / 0 draft / 1 bare')).toBeDefined()
    })
})
