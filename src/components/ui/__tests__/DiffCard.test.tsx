/**
 * DiffCard.test.tsx — src/components/ui/__tests__/DiffCard.test.tsx
 *
 * Tests for the DiffCard mutation approval component (Live Diff feature).
 *
 * Coverage:
 *  1. Renders tool name
 *  2. Renders AI reasoning text
 *  3. Renders before snippet when provided
 *  4. Renders after snippet / diff when computable
 *  5. Highlights additions in emerald (green)
 *  6. Highlights removals in red
 *  7. Renders risk tier badge (green / amber / red)
 *  8. Renders Accept and Reject buttons for pending calls
 *  9. Does not render action buttons for approved/rejected calls
 * 10. Calls onApprove when Accept is clicked
 * 11. Calls onReject when Reject is clicked
 * 12. Shows "Applied" status after approval
 * 13. Shows "Rejected" status after rejection
 *
 * Consensus badge tests (V.4):
 * 24. ConsensusBadge — disagree outcome renders amber badge
 * 25. ConsensusBadge — agree_reject outcome renders red badge
 * 26. ConsensusBadge — agree_approve outcome renders green badge
 * 27. ConsensusBadge — shows reasoning text when provided
 * 28. ConsensusBadge — not rendered when consensusOutcome is absent
 * 29. ConsensusBadge — unknown outcome renders nothing
 *
 * Utility function tests:
 * 14. diffLines — identical strings produce only context lines
 * 15. diffLines — addition detected
 * 16. diffLines — removal detected
 * 17. extractSnippet — returns null for missing targetId
 * 18. extractSnippet — finds anchor line correctly
 * 19. deriveAfterSnippet — flint_add_class appends class
 * 20. deriveAfterSnippet — flint_remove_class strips class
 * 21. deriveAfterSnippet — flint_update_props replaces prop value
 * 22. deriveAfterSnippet — flint_update_text replaces text content
 * 23. deriveAfterSnippet — flint_delete_node returns removal placeholder
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
    DiffCard,
    diffLines,
    extractSnippet,
    deriveAfterSnippet,
} from '../DiffCard'
import type { PendingToolCall } from '../../../store/orchestratorStore'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_SOURCE = `export default function Card() {
  return (
    <div data-flint-id="abc123" className="rounded bg-zinc-900 p-4">
      <h2>Hello</h2>
    </div>
  )
}`

function makeCall(overrides: Partial<PendingToolCall> = {}): PendingToolCall {
    return {
        id: 'tool-use-1',
        toolName: 'flint_add_class',
        input: {
            targetId: 'abc123',
            className: 'text-indigo-400',
            reasoning: 'Apply brand colour to heading',
        },
        status: 'pending',
        beforeSnapshot: BASE_SOURCE,
        ...overrides,
    }
}

// ── DiffCard rendering tests ──────────────────────────────────────────────────

describe('DiffCard', () => {
    it('renders the tool name', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.getByText('flint_add_class')).toBeDefined()
    })

    it('renders the AI reasoning text', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.getByText('Apply brand colour to heading')).toBeDefined()
    })

    it('renders the before snippet when a targetId is found in beforeSnapshot', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        // The diff or before section should contain the element's class string
        const container = document.body
        expect(container.textContent).toContain('rounded bg-zinc-900 p-4')
    })

    it('renders a diff section when before and after differ', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        // The "Diff" label is shown when diffResult is non-empty
        expect(screen.getByText('Diff')).toBeDefined()
    })

    it('highlights additions with emerald background class', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        // A line containing the new class should be rendered with addition styling.
        // We look for an element whose text includes the new class name.
        const container = document.body
        const additionLines = container.querySelectorAll('.bg-emerald-900\\/30')
        expect(additionLines.length).toBeGreaterThan(0)
    })

    it('highlights removals with red background class', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        // The original line (without the new class) should appear as a removal
        const container = document.body
        const removalLines = container.querySelectorAll('.bg-red-900\\/30')
        expect(removalLines.length).toBeGreaterThan(0)
    })

    it('renders a green risk badge by default for add-class mutations', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.getByText('Low risk')).toBeDefined()
    })

    it('renders an amber risk badge for wrap mutations via explicit prop', () => {
        render(
            <DiffCard
                call={makeCall({ toolName: 'flint_wrap_node' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="amber"
            />
        )
        expect(screen.getByText('Review')).toBeDefined()
    })

    it('renders a red risk badge when explicitly passed', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="red"
            />
        )
        expect(screen.getByText('High risk')).toBeDefined()
    })

    it('renders Accept and Reject buttons for pending calls', () => {
        render(
            <DiffCard
                call={makeCall({ status: 'pending' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.getByRole('button', { name: /accept mutation/i })).toBeDefined()
        expect(screen.getByRole('button', { name: /reject mutation/i })).toBeDefined()
    })

    it('does not render action buttons for approved calls', () => {
        render(
            <DiffCard
                call={makeCall({ status: 'approved' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.queryByRole('button', { name: /accept mutation/i })).toBeNull()
        expect(screen.queryByRole('button', { name: /reject mutation/i })).toBeNull()
    })

    it('calls onApprove with the call id when Accept is clicked', () => {
        const onApprove = vi.fn()
        render(
            <DiffCard
                call={makeCall({ id: 'tool-use-42' })}
                onApprove={onApprove}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        fireEvent.click(screen.getByRole('button', { name: /accept mutation/i }))
        expect(onApprove).toHaveBeenCalledWith('tool-use-42')
    })

    it('calls onReject with the call id when Reject is clicked', () => {
        const onReject = vi.fn()
        render(
            <DiffCard
                call={makeCall({ id: 'tool-use-99' })}
                onApprove={vi.fn()}
                onReject={onReject}
                riskTier="green"
            />
        )
        fireEvent.click(screen.getByRole('button', { name: /reject mutation/i }))
        expect(onReject).toHaveBeenCalledWith('tool-use-99')
    })

    it('shows "Applied" status text for approved calls', () => {
        render(
            <DiffCard
                call={makeCall({ status: 'approved' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.getByText('Applied')).toBeDefined()
    })

    it('shows "Rejected" status text for rejected calls', () => {
        render(
            <DiffCard
                call={makeCall({ status: 'rejected' })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.getByText('Rejected')).toBeDefined()
    })

    it('renders gracefully when beforeSnapshot is absent', () => {
        render(
            <DiffCard
                call={makeCall({ beforeSnapshot: undefined })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        // Should not throw; diff section should not appear
        expect(screen.queryByText('Diff')).toBeNull()
        expect(screen.getByText('flint_add_class')).toBeDefined()
    })

    it('renders gracefully when reasoning is absent', () => {
        render(
            <DiffCard
                call={makeCall({ input: { targetId: 'abc123', className: 'text-red-400' } })}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        // No reasoning paragraph — should still render cleanly
        expect(screen.getByText('flint_add_class')).toBeDefined()
    })

    // ── Consensus badge (V.4) ───────────────────────────────────────────────

    it('renders amber "Consensus: Disagreement" badge for disagree outcome', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
                consensusOutcome="disagree"
            />
        )
        expect(screen.getByText('Consensus: Disagreement')).toBeDefined()
    })

    it('renders red "Consensus: Both agents rejected" badge for agree_reject outcome', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
                consensusOutcome="agree_reject"
            />
        )
        expect(screen.getByText('Consensus: Both agents rejected')).toBeDefined()
    })

    it('renders green "Consensus: Approved" badge for agree_approve outcome', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
                consensusOutcome="agree_approve"
            />
        )
        expect(screen.getByText('Consensus: Approved')).toBeDefined()
    })

    it('renders consensusReasoning text beneath the badge', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
                consensusOutcome="disagree"
                consensusReasoning="Secondary model flagged accessibility violation"
            />
        )
        expect(screen.getByText('Secondary model flagged accessibility violation')).toBeDefined()
    })

    it('does not render consensus badge when consensusOutcome is absent', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
            />
        )
        expect(screen.queryByText(/Consensus:/)).toBeNull()
    })

    it('renders nothing for an unrecognised consensus outcome', () => {
        render(
            <DiffCard
                call={makeCall()}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                riskTier="green"
                consensusOutcome="unknown_outcome"
            />
        )
        expect(screen.queryByText(/Consensus:/)).toBeNull()
    })
})

// ── diffLines utility tests ───────────────────────────────────────────────────

describe('diffLines', () => {
    it('produces only context lines when before and after are identical', () => {
        const result = diffLines('hello\nworld', 'hello\nworld')
        expect(result.every((l) => l.kind === 'context')).toBe(true)
        expect(result).toHaveLength(2)
    })

    it('detects an addition', () => {
        const result = diffLines('line1', 'line1\nline2')
        const additions = result.filter((l) => l.kind === 'addition')
        expect(additions).toHaveLength(1)
        expect(additions[0].text).toBe('line2')
    })

    it('detects a removal', () => {
        const result = diffLines('line1\nline2', 'line1')
        const removals = result.filter((l) => l.kind === 'removal')
        expect(removals).toHaveLength(1)
        expect(removals[0].text).toBe('line2')
    })

    it('handles empty before string', () => {
        const result = diffLines('', 'only after')
        const additions = result.filter((l) => l.kind === 'addition')
        expect(additions.length).toBeGreaterThan(0)
    })

    it('handles empty after string', () => {
        const result = diffLines('only before', '')
        const removals = result.filter((l) => l.kind === 'removal')
        expect(removals.length).toBeGreaterThan(0)
    })
})

// ── extractSnippet utility tests ──────────────────────────────────────────────

describe('extractSnippet', () => {
    it('returns null when targetId is not found in source', () => {
        expect(extractSnippet(BASE_SOURCE, 'nonexistent-id')).toBeNull()
    })

    it('returns null when source is empty', () => {
        expect(extractSnippet('', 'abc123')).toBeNull()
    })

    it('finds and returns the anchor line containing the targetId', () => {
        const result = extractSnippet(BASE_SOURCE, 'abc123')
        expect(result).not.toBeNull()
        expect(result).toContain('data-flint-id="abc123"')
    })

    it('respects the maxLines cap', () => {
        const result = extractSnippet(BASE_SOURCE, 'abc123', 1)
        expect(result).not.toBeNull()
        // With maxLines=1 only the anchor line itself should be returned
        const lineCount = (result ?? '').split('\n').length
        expect(lineCount).toBeLessThanOrEqual(2)
    })
})

// ── deriveAfterSnippet utility tests ─────────────────────────────────────────

describe('deriveAfterSnippet', () => {
    const SNIPPET = '  <div data-flint-id="abc123" className="rounded bg-zinc-900">'

    it('flint_add_class appends the new class to the className attribute', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_add_class', {
            className: 'text-indigo-400',
        })
        expect(result).toContain('text-indigo-400')
        expect(result).toContain('rounded bg-zinc-900')
    })

    it('flint_remove_class strips the target class from the className attribute', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_remove_class', {
            className: 'bg-zinc-900',
        })
        expect(result).not.toContain('bg-zinc-900')
        expect(result).toContain('rounded')
    })

    it('flint_update_props replaces an existing prop value', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_update_props', {
            props: { className: 'p-8' },
        })
        expect(result).toContain('className="p-8"')
        expect(result).not.toContain('rounded bg-zinc-900')
    })

    it('flint_update_text replaces the text content between tags', () => {
        const snippet = '  <h2>Old text</h2>'
        const result = deriveAfterSnippet(snippet, 'flint_update_text', { text: 'New heading' })
        expect(result).toContain('New heading')
        expect(result).not.toContain('Old text')
    })

    it('flint_delete_node returns a removal placeholder string', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_delete_node', {})
        expect(result).toContain('removed')
    })

    it('flint_insert_node appends a new element after the before snippet', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_insert_node', {
            nodeType: 'span',
            children: 'Hello',
        })
        expect(result).toContain('<span>Hello</span>')
    })

    it('flint_wrap_node wraps the before snippet in the wrapper element', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_wrap_node', {
            wrapperType: 'section',
        })
        expect(result).toContain('<section>')
        expect(result).toContain('</section>')
    })

    it('returns the before snippet unchanged for unknown tool names', () => {
        const result = deriveAfterSnippet(SNIPPET, 'flint_unknown_op', {})
        expect(result).toBe(SNIPPET)
    })

    it('returns empty string when beforeSnippet is empty', () => {
        const result = deriveAfterSnippet('', 'flint_add_class', { className: 'foo' })
        expect(result).toBe('')
    })
})
