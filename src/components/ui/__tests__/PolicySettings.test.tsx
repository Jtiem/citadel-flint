/**
 * PolicySettings.test.tsx
 *
 * POL.1 Group 1c — Unit tests for PolicySettings.tsx
 *
 * Test plan from contract section 13.4:
 *   - Renders without crash (default policy)
 *   - ΔE slider renders with default value
 *   - Slider change updates local state (does not call IPC until save)
 *   - Conformance dropdown renders 3 options (A / AA / AAA)
 *   - Per-rule mode selects render for all 9 Mithril rules
 *   - Per-rule mode selects render for all 10 A11y rules
 *   - Save button calls bridgeAPI.policy.set with the current draft
 *   - Reset button restores DEFAULT_POLICY_V2 values
 *   - Domain preset selection fills recommended fields
 *   - Cancel button calls onClose without saving
 *   - Escape key calls onClose
 *   - Backdrop click calls onClose
 *   - Loading state shown while policy is loading
 *   - Block-on-overrides toggle updates draft state
 *   - Severity floor dropdown renders 3 options
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { PolicySettings } from '../PolicySettings'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Default policy fixture ────────────────────────────────────────────────────

const DEFAULT_POLICY = {
    version: 2,
    domain: 'general',
    mithril: {
        deltaE_threshold: 2.0,
        deltaE_critical_threshold: 10.0,
        mode: 'blocking',
        ignore_patterns: ['**/node_modules/**'],
        rules: {},
    },
    a11y: {
        level: 'AA',
        mode: 'blocking',
        rules: {},
    },
    export_gate: {
        severity_floor: 'warning',
        block_on_overrides: true,
    },
    baseline: { enabled: false },
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Ensure cachedPolicy is null so the component falls through to IPC
    useCanvasStore.setState({ cachedPolicy: null })

    // Wire up policy mock (policy.set is new in Group 1B; may not exist in setup.ts yet)
    const existing = (window as unknown as { bridgeAPI: Record<string, unknown> }).bridgeAPI ?? {}
    ;(window as unknown as { bridgeAPI: Record<string, unknown> }).bridgeAPI = {
        ...existing,
        policy: {
            get: vi.fn().mockResolvedValue(DEFAULT_POLICY),
            set: vi.fn().mockResolvedValue(DEFAULT_POLICY),
        },
    }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderComponent(onClose = vi.fn()) {
    return render(<PolicySettings onClose={onClose} />)
}

// Wait for the loading spinner to disappear (policy loaded)
async function waitForLoaded() {
    await waitFor(() => {
        expect(screen.queryByText('Loading policy…')).toBeNull()
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PolicySettings', () => {

    describe('rendering', () => {
        it('renders without crashing', async () => {
            renderComponent()
            await waitForLoaded()
            expect(screen.getByRole('dialog')).toBeDefined()
        })

        it('renders the panel title', async () => {
            renderComponent()
            await waitForLoaded()
            expect(screen.getByText('Policy Settings')).toBeDefined()
        })

        it('shows loading state initially', () => {
            // Use a promise that never resolves so we stay in loading state
            const never = new Promise<typeof DEFAULT_POLICY>(() => undefined)
            const policyMock = {
                get: vi.fn().mockReturnValue(never),
                set: vi.fn(),
            }
            ;(window as unknown as { bridgeAPI: { policy: typeof policyMock } }).bridgeAPI.policy = policyMock

            renderComponent()
            expect(screen.getByText('Loading policy…')).toBeDefined()
        })
    })

    describe('ΔE Threshold Slider', () => {
        it('renders ΔE slider with default value of 2.0', async () => {
            renderComponent()
            await waitForLoaded()

            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            expect(slider).toBeDefined()
            expect((slider as HTMLInputElement).value).toBe('2')
        })

        it('renders ΔE Critical slider with default value of 10.0', async () => {
            renderComponent()
            await waitForLoaded()

            const slider = screen.getByRole('slider', { name: /ΔE Critical Threshold/i })
            expect(slider).toBeDefined()
            expect((slider as HTMLInputElement).value).toBe('10')
        })

        it('slider change updates the displayed value without calling IPC', async () => {
            renderComponent()
            await waitForLoaded()

            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            fireEvent.change(slider, { target: { value: '4.5' } })

            // The live value display should update
            await waitFor(() => {
                expect(screen.getByText('4.5')).toBeDefined()
            })

            // IPC must NOT have been called yet (Save not clicked)
            const policyApi = (window as unknown as { bridgeAPI: { policy: { set: ReturnType<typeof vi.fn> } } }).bridgeAPI.policy
            expect(policyApi.set).not.toHaveBeenCalled()
        })

        it('renders "Strict (0.5)" left label and "Lenient (20.0)" right label', async () => {
            renderComponent()
            await waitForLoaded()
            expect(screen.getByText('Strict (0.5)')).toBeDefined()
            expect(screen.getByText('Lenient (20.0)')).toBeDefined()
        })
    })

    describe('Conformance Level Dropdown', () => {
        it('renders 3 options: A, AA, AAA', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText('WCAG conformance level') as HTMLSelectElement
            expect(select).toBeDefined()
            expect(select.options.length).toBe(3)

            const optionValues = Array.from(select.options).map((o) => o.value)
            expect(optionValues).toContain('A')
            expect(optionValues).toContain('AA')
            expect(optionValues).toContain('AAA')
        })

        it('defaults to AA', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText('WCAG conformance level') as HTMLSelectElement
            expect(select.value).toBe('AA')
        })

        it('updates draft when changed', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText('WCAG conformance level')
            fireEvent.change(select, { target: { value: 'AAA' } })

            expect((screen.getByLabelText('WCAG conformance level') as HTMLSelectElement).value).toBe('AAA')
        })
    })

    describe('Per-rule mode toggles — Mithril', () => {
        const MITHRIL_RULE_IDS = [
            'MITHRIL-COL',
            'MITHRIL-TYP-001',
            'MITHRIL-TYP-002',
            'MITHRIL-TYP-003',
            'MITHRIL-TYP-004',
            'MITHRIL-TYP-005',
            'MITHRIL-SPC-001',
            'MITHRIL-SHD-001',
            'MITHRIL-OPC-001',
        ]

        it('renders a mode select for every Mithril rule', async () => {
            renderComponent()
            await waitForLoaded()

            // Each select has aria-label="<label> mode" (e.g. "Color Drift mode").
            // We verify the selects by matching the label text since rule IDs are
            // displayed as text nodes, not as aria-labels on the select elements.
            const MITHRIL_RULE_LABELS = [
                'Color Drift mode',
                'Font Family mode',
                'Font Weight mode',
                'Font Size mode',
                'Line Height mode',
                'Letter Spacing mode',
                'Spacing Scale mode',
                'Shadow Token mode',
                'Opacity Token mode',
            ]

            for (const label of MITHRIL_RULE_LABELS) {
                const select = screen.getByLabelText(label)
                expect(select).toBeDefined()
            }
        })

        it('renders all 9 rule IDs as text in the panel', async () => {
            renderComponent()
            await waitForLoaded()

            for (const ruleId of MITHRIL_RULE_IDS) {
                expect(screen.getByText(ruleId)).toBeDefined()
            }
        })

        it('changing MITHRIL-COL rule mode updates local state', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText(/Color Drift mode/i)
            fireEvent.change(select, { target: { value: 'advisory' } })

            expect((select as HTMLSelectElement).value).toBe('advisory')
        })
    })

    describe('Per-rule mode toggles — A11y', () => {
        const A11Y_RULE_IDS = [
            'A11Y-001',
            'A11Y-002',
            'A11Y-003',
            'A11Y-004',
            'A11Y-005',
            'A11Y-006',
            'A11Y-007',
            'A11Y-008',
            'A11Y-009',
            'A11Y-010',
        ]

        it('renders all 10 A11y rule IDs as text in the panel', async () => {
            renderComponent()
            await waitForLoaded()

            for (const ruleId of A11Y_RULE_IDS) {
                expect(screen.getByText(ruleId)).toBeDefined()
            }
        })

        it('renders a mode select for A11Y-001', async () => {
            renderComponent()
            await waitForLoaded()

            // The select for A11Y-001 has aria-label matching "Images must have alt text mode"
            const select = screen.getByLabelText(/Images must have alt text mode/i)
            expect(select).toBeDefined()
        })

        it('changing A11Y-007 rule mode updates local state', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText(/Focus visible mode/i)
            fireEvent.change(select, { target: { value: 'off' } })

            expect((select as HTMLSelectElement).value).toBe('off')
        })
    })

    describe('Export Gate Controls', () => {
        it('renders severity floor dropdown with 3 options', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText('Export gate severity floor') as HTMLSelectElement
            expect(select).toBeDefined()
            expect(select.options.length).toBe(3)

            const values = Array.from(select.options).map((o) => o.value)
            expect(values).toContain('critical')
            expect(values).toContain('warning')
            expect(values).toContain('info')
        })

        it('defaults severity floor to "warning"', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText('Export gate severity floor') as HTMLSelectElement
            expect(select.value).toBe('warning')
        })

        it('renders block-on-overrides toggle defaulting to ON', async () => {
            renderComponent()
            await waitForLoaded()

            const toggle = screen.getByRole('switch', { name: /Block export on overrides/i })
            expect(toggle).toBeDefined()
            expect(toggle.getAttribute('aria-checked')).toBe('true')
        })

        it('block-on-overrides toggle flips state when clicked', async () => {
            renderComponent()
            await waitForLoaded()

            const toggle = screen.getByRole('switch', { name: /Block export on overrides/i })
            expect(toggle.getAttribute('aria-checked')).toBe('true')

            fireEvent.click(toggle)
            expect(toggle.getAttribute('aria-checked')).toBe('false')
        })
    })

    describe('Domain Preset Picker', () => {
        it('renders a dropdown with 6 domain options', async () => {
            renderComponent()
            await waitForLoaded()

            const select = screen.getByLabelText('Industry domain preset') as HTMLSelectElement
            expect(select.options.length).toBe(6)

            const values = Array.from(select.options).map((o) => o.value)
            expect(values).toContain('general')
            expect(values).toContain('healthcare')
            expect(values).toContain('fintech')
            expect(values).toContain('e-commerce')
            expect(values).toContain('government')
            expect(values).toContain('enterprise-saas')
        })

        it('selecting "fintech" fills in stricter deltaE threshold (1.0)', async () => {
            renderComponent()
            await waitForLoaded()

            const domainSelect = screen.getByLabelText('Industry domain preset')
            fireEvent.change(domainSelect, { target: { value: 'fintech' } })

            // Fintech preset sets deltaE_threshold to 1.0
            await waitFor(() => {
                expect(screen.getByText('1.0')).toBeDefined()
            })

            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            expect((slider as HTMLInputElement).value).toBe('1')
        })

        it('selecting "healthcare" sets conformance level to AAA', async () => {
            renderComponent()
            await waitForLoaded()

            const domainSelect = screen.getByLabelText('Industry domain preset')
            fireEvent.change(domainSelect, { target: { value: 'healthcare' } })

            const levelSelect = screen.getByLabelText('WCAG conformance level') as HTMLSelectElement
            expect(levelSelect.value).toBe('AAA')
        })

        it('selecting "e-commerce" sets mithril mode to advisory', async () => {
            renderComponent()
            await waitForLoaded()

            const domainSelect = screen.getByLabelText('Industry domain preset')
            fireEvent.change(domainSelect, { target: { value: 'e-commerce' } })

            const mithrilMode = screen.getByLabelText('Mithril category mode') as HTMLSelectElement
            expect(mithrilMode.value).toBe('advisory')
        })
    })

    describe('Save button', () => {
        it('calls bridgeAPI.policy.set with the current draft on click', async () => {
            renderComponent()
            await waitForLoaded()

            const saveBtn = screen.getByRole('button', { name: /Save policy settings/i })
            fireEvent.click(saveBtn)

            await waitFor(() => {
                const policyApi = (window as unknown as {
                    bridgeAPI: { policy: { set: ReturnType<typeof vi.fn> } }
                }).bridgeAPI.policy
                expect(policyApi.set).toHaveBeenCalledTimes(1)
            })
        })

        it('passes deltaE_threshold to policy.set after slider change', async () => {
            renderComponent()
            await waitForLoaded()

            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            fireEvent.change(slider, { target: { value: '3.5' } })

            const saveBtn = screen.getByRole('button', { name: /Save policy settings/i })
            fireEvent.click(saveBtn)

            await waitFor(() => {
                const policyApi = (window as unknown as {
                    bridgeAPI: { policy: { set: ReturnType<typeof vi.fn> } }
                }).bridgeAPI.policy
                const calledWith = policyApi.set.mock.calls[0][0]
                expect(calledWith.mithril.deltaE_threshold).toBe(3.5)
            })
        })
    })

    describe('Reset to Defaults button', () => {
        it('reverts deltaE threshold to 2.0 after it was changed', async () => {
            renderComponent()
            await waitForLoaded()

            // Change the slider
            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            fireEvent.change(slider, { target: { value: '7.0' } })
            await waitFor(() => {
                expect(screen.getByText('7.0')).toBeDefined()
            })

            // Click reset
            const resetBtn = screen.getByRole('button', { name: /Reset to default policy/i })
            fireEvent.click(resetBtn)

            // Value should be back to 2.0
            await waitFor(() => {
                expect((slider as HTMLInputElement).value).toBe('2')
            })
        })

        it('reverts conformance level to AA', async () => {
            renderComponent()
            await waitForLoaded()

            const levelSelect = screen.getByLabelText('WCAG conformance level')
            fireEvent.change(levelSelect, { target: { value: 'AAA' } })
            expect((levelSelect as HTMLSelectElement).value).toBe('AAA')

            fireEvent.click(screen.getByRole('button', { name: /Reset to default policy/i }))

            await waitFor(() => {
                expect((levelSelect as HTMLSelectElement).value).toBe('AA')
            })
        })

        it('does NOT call policy.set (reset is local-only until Save)', async () => {
            renderComponent()
            await waitForLoaded()

            fireEvent.click(screen.getByRole('button', { name: /Reset to default policy/i }))

            const policyApi = (window as unknown as {
                bridgeAPI: { policy: { set: ReturnType<typeof vi.fn> } }
            }).bridgeAPI.policy
            expect(policyApi.set).not.toHaveBeenCalled()
        })
    })

    describe('Cancel button', () => {
        it('calls onClose without calling policy.set', async () => {
            const onClose = vi.fn()
            renderComponent(onClose)
            await waitForLoaded()

            fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))

            expect(onClose).toHaveBeenCalledTimes(1)
            const policyApi = (window as unknown as {
                bridgeAPI: { policy: { set: ReturnType<typeof vi.fn> } }
            }).bridgeAPI.policy
            expect(policyApi.set).not.toHaveBeenCalled()
        })
    })

    describe('Keyboard navigation', () => {
        it('calls onClose when Escape is pressed', async () => {
            const onClose = vi.fn()
            renderComponent(onClose)
            await waitForLoaded()

            fireEvent.keyDown(window, { key: 'Escape' })
            expect(onClose).toHaveBeenCalledTimes(1)
        })
    })

    describe('Backdrop click', () => {
        it('calls onClose when the backdrop is clicked', async () => {
            const onClose = vi.fn()
            renderComponent(onClose)
            await waitForLoaded()

            const backdrop = screen.getByTestId('policy-settings-backdrop')
            fireEvent.click(backdrop)
            expect(onClose).toHaveBeenCalledTimes(1)
        })
    })

    describe('Accessibility', () => {
        it('dialog has role="dialog" and aria-modal="true"', async () => {
            renderComponent()
            await waitForLoaded()

            const dialog = screen.getByRole('dialog')
            expect(dialog.getAttribute('aria-modal')).toBe('true')
        })

        it('dialog has aria-labelledby pointing to the title', async () => {
            renderComponent()
            await waitForLoaded()

            const dialog = screen.getByRole('dialog')
            const labelledBy = dialog.getAttribute('aria-labelledby')
            expect(labelledBy).toBeTruthy()

            const title = document.getElementById(labelledBy!)
            expect(title?.textContent).toContain('Policy Settings')
        })

        it('ΔE slider has aria-valuemin, aria-valuemax, aria-valuenow attributes', async () => {
            renderComponent()
            await waitForLoaded()

            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            expect(slider.getAttribute('aria-valuemin')).toBe('0.5')
            expect(slider.getAttribute('aria-valuemax')).toBe('20')
            expect(slider.getAttribute('aria-valuenow')).toBe('2')
        })

        it('close button has aria-label "Close policy settings"', async () => {
            renderComponent()
            await waitForLoaded()

            expect(screen.getByLabelText('Close policy settings')).toBeDefined()
        })

        it('Save button has aria-label "Save policy settings"', async () => {
            renderComponent()
            await waitForLoaded()

            expect(screen.getByLabelText('Save policy settings')).toBeDefined()
        })
    })

    describe('Policy loaded from cachedPolicy', () => {
        it('uses cachedPolicy when available without calling policy.get', async () => {
            const customPolicy = {
                ...DEFAULT_POLICY,
                mithril: {
                    ...DEFAULT_POLICY.mithril,
                    deltaE_threshold: 5.0,
                },
            }
            // Set cachedPolicy in canvasStore before render
            useCanvasStore.setState({ cachedPolicy: customPolicy as unknown as Parameters<typeof useCanvasStore.setState>[0]['cachedPolicy'] })

            renderComponent()
            await waitForLoaded()

            const slider = screen.getByRole('slider', { name: /ΔE Threshold/i })
            expect((slider as HTMLInputElement).value).toBe('5')

            // policy.get should not have been called since cachedPolicy was set
            const policyApi = (window as unknown as {
                bridgeAPI: { policy: { get: ReturnType<typeof vi.fn> } }
            }).bridgeAPI.policy
            expect(policyApi.get).not.toHaveBeenCalled()
        })
    })
})
