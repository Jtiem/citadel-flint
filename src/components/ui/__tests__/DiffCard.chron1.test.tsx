/**
 * DiffCard.chron1.test.tsx — CHRON.1 Reason-on-Override (UX A+ pass)
 *
 * Test boundaries 1–8 from the CHRON.1 contract, updated for UX A+ fixes:
 *   - TB-3: Amber with empty input now calls onApprove(id, '') — not 'skipped'
 *   - New: copy differentiation (amber vs red placeholder text)
 *   - New: risk-tinted input borders
 *   - New: maxLength=500 on reason input
 *   - New: red-tier framing text shown above input
 *   - New: example reasons hint shown below red input
 *
 * Contract: .flint-context/contracts/CHRON.1.contract.ts
 * Implementation: src/components/ui/DiffCard.tsx
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiffCard } from '../DiffCard'
import type { PendingToolCall } from '../../../store/orchestratorStore'
import type {
    DiffCardOnApprove,
    ReasonRequirement,
} from '../../../../.flint-context/contracts/CHRON.1.contract'

// Type-level smoke check: imported contract types must compile.
// The Record wrapper exercises the types at module scope so TSC does not flag
// them as unused (TS6196) while still proving the contract import compiles.
export type _ChronContractSmoke = {
    onApprove: DiffCardOnApprove
    requirement: ReasonRequirement
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCall(overrides: Partial<PendingToolCall> = {}): PendingToolCall {
    return {
        id: 'tool-use-chron1',
        toolName: 'flint_add_class',
        input: {
            targetId: 'abc123',
            className: 'text-indigo-400',
            reasoning: 'Apply brand colour',
        },
        status: 'pending',
        beforeSnapshot: undefined,
        ...overrides,
    }
}

// ── CHRON.1: Risk-tiered reason input tests ───────────────────────────────────

describe('CHRON.1 — DiffCard reason input', () => {
    // ── TB-1: Green tier ────────────────────────────────────────────────────

    it('Green tier: no reason input rendered', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.queryByLabelText(/why is this change needed/i)).toBeNull()
    })

    // Edge case from TB-1: explicit green is the safe default when the orchestrator
    // cannot determine a tier (CHRON.1-repair / M2 forbids silent inference).
    it('Green tier: no reason input when riskTier is explicitly "green"', () => {
        render(
            <DiffCard
                call={makeCall({ toolName: 'flint_add_class' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.queryByLabelText(/why is this change needed/i)).toBeNull()
    })

    // ── TB-2: Amber tier — input rendered, Apply always enabled ────────────

    it('Amber tier: optional reason input is visible', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        expect(screen.getByLabelText(/why is this change needed/i)).toBeDefined()
    })

    it('Amber tier: Apply button is not disabled when reason input is empty', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        const applyBtn = screen.getByRole('button', { name: /accept mutation/i })
        expect((applyBtn as HTMLButtonElement).disabled).toBe(false)
    })

    // ── TB-3: Amber tier — empty input sends empty string (not 'skipped') ──

    it('Amber tier: empty input calls onApprove(id, "") — not "skipped" — when Apply clicked', () => {
        const onApprove = vi.fn()
        render(
            <DiffCard
                call={makeCall({ id: 'amber-skip' })}
                onApprove={onApprove}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        // Do not type anything — just click Apply
        fireEvent.click(screen.getByRole('button', { name: /accept mutation/i }))
        expect(onApprove).toHaveBeenCalledWith('amber-skip', '')
        // Must NOT send 'skipped'
        expect(onApprove).not.toHaveBeenCalledWith('amber-skip', 'skipped')
    })

    // ── TB-4: Amber tier — typed reason forwarded ───────────────────────────

    it('Amber tier: typed reason calls onApprove(id, "brand team approved") when Apply clicked', () => {
        const onApprove = vi.fn()
        render(
            <DiffCard
                call={makeCall({ id: 'amber-typed' })}
                onApprove={onApprove}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        fireEvent.change(screen.getByLabelText(/why is this change needed/i), {
            target: { value: 'brand team approved' },
        })
        fireEvent.click(screen.getByRole('button', { name: /accept mutation/i }))
        expect(onApprove).toHaveBeenCalledWith('amber-typed', 'brand team approved')
    })

    // ── TB-5: Red tier — Apply disabled until non-empty ─────────────────────

    it('Red tier: Apply button has disabled attribute when reason input is empty', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        const applyBtn = screen.getByRole('button', { name: /accept mutation/i })
        expect((applyBtn as HTMLButtonElement).disabled).toBe(true)
    })

    // ── TB-6: Red tier — Apply enables after valid text ─────────────────────

    it('Red tier: Apply button is enabled after typing "justified because X"', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        fireEvent.change(screen.getByLabelText(/why is this change needed/i), {
            target: { value: 'justified because X' },
        })
        const applyBtn = screen.getByRole('button', { name: /accept mutation/i })
        expect((applyBtn as HTMLButtonElement).disabled).toBe(false)
    })

    // ── TB-7: Red tier — typed reason sent to onApprove ─────────────────────

    it('Red tier: onApprove called with (id, "justified because X") when Apply clicked', () => {
        const onApprove = vi.fn()
        render(
            <DiffCard
                call={makeCall({ id: 'red-typed' })}
                onApprove={onApprove}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        fireEvent.change(screen.getByLabelText(/why is this change needed/i), {
            target: { value: 'justified because X' },
        })
        fireEvent.click(screen.getByRole('button', { name: /accept mutation/i }))
        expect(onApprove).toHaveBeenCalledWith('red-typed', 'justified because X')
    })

    // ── TB-8: Red tier — whitespace still disables Apply ────────────────────

    it('Red tier: Apply button has disabled attribute after typing "   " (whitespace only)', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        fireEvent.change(screen.getByLabelText(/why is this change needed/i), {
            target: { value: '   ' },
        })
        const applyBtn = screen.getByRole('button', { name: /accept mutation/i })
        expect((applyBtn as HTMLButtonElement).disabled).toBe(true)
    })
})

// ── CHRON.1 UX A+: Copy differentiation ──────────────────────────────────────

describe('CHRON.1 UX A+ — DiffCard copy differentiation', () => {
    it('Amber tier: placeholder says "optional, for teammates"', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i) as HTMLInputElement
        expect(input.placeholder).toContain('optional')
        expect(input.placeholder).toContain('teammates')
    })

    it('Red tier: placeholder says "Required: reason for this high-risk change"', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i) as HTMLInputElement
        expect(input.placeholder).toContain('Required')
        expect(input.placeholder).toContain('high-risk')
    })

    it('Amber placeholder does NOT contain "Required"', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i) as HTMLInputElement
        expect(input.placeholder).not.toContain('Required')
    })

    it('Red placeholder does NOT mention "teammates"', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i) as HTMLInputElement
        expect(input.placeholder).not.toContain('teammates')
    })
})

// ── CHRON.1 UX A+: Risk-tinted borders ───────────────────────────────────────

describe('CHRON.1 UX A+ — DiffCard risk-tinted input borders', () => {
    it('Red tier input has red border class', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i)
        expect(input.className).toContain('border-red-500')
    })

    it('Amber tier input has amber border class', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i)
        expect(input.className).toContain('border-amber-500')
    })

    it('Red tier input does NOT have the default neutral zinc border', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i)
        // Must not fall back to the old neutral border-zinc-700 style
        expect(input.className).not.toContain('border-zinc-700')
    })
})

// ── CHRON.1 UX A+: maxLength cap ─────────────────────────────────────────────

describe('CHRON.1 UX A+ — DiffCard reason input maxLength', () => {
    it('Amber tier input has maxLength=500', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i) as HTMLInputElement
        expect(input.maxLength).toBe(500)
    })

    it('Red tier input has maxLength=500', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        const input = screen.getByLabelText(/why is this change needed/i) as HTMLInputElement
        expect(input.maxLength).toBe(500)
    })
})

// ── CHRON.1 UX A+: Red-tier framing text ─────────────────────────────────────

describe('CHRON.1 UX A+ — DiffCard red-tier framing text', () => {
    it('Red tier shows framing text above the input', () => {
        render(
            <DiffCard
                call={makeCall({ toolName: 'flint_delete_node' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        // The framing text should be visible somewhere in the action area
        const allText = document.body.textContent ?? ''
        expect(allText).toContain("can't be easily undone")
    })

    it('flint_delete_node framing mentions "removes an element"', () => {
        render(
            <DiffCard
                call={makeCall({ toolName: 'flint_delete_node' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        expect(document.body.textContent).toContain('removes an element')
    })

    it('flint_wrap_node framing mentions "restructures the DOM"', () => {
        render(
            <DiffCard
                call={makeCall({ toolName: 'flint_wrap_node' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        expect(document.body.textContent).toContain('restructures the DOM')
    })

    it('Amber tier does NOT show red-tier framing text', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        expect(document.body.textContent).not.toContain("can't be easily undone")
    })

    it('Green tier does NOT show red-tier framing text', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(document.body.textContent).not.toContain("can't be easily undone")
    })
})

// ── CHRON.1 UX A+: Example reasons hint ──────────────────────────────────────

describe('CHRON.1 UX A+ — DiffCard example reasons hint (red tier)', () => {
    it('Red tier shows example reasons below the input', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        expect(document.body.textContent).toContain('Approved by brand team')
    })

    it('Amber tier does NOT show example reasons hint', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        expect(document.body.textContent).not.toContain('Approved by brand team')
    })
})
