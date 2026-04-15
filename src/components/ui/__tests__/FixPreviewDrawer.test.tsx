/**
 * FixPreviewDrawer.test.tsx — src/components/ui/__tests__/FixPreviewDrawer.test.tsx
 *
 * T35 — Coverage-gap tests for the FixPreviewDrawer (OPP-08 intent-first fix preview).
 *
 * Covers:
 *   - Single-item mode: renders diff preview for one item
 *   - Batch mode: renders ordered list of all proposed changes
 *   - Apply callback invoked on confirm
 *   - Cancel callback invoked on both dismiss buttons
 *   - "Always auto-fix" preference toggle + helper text
 *   - "Change in Settings →" button invokes onOpenSettings
 *   - Edge cases: empty items array, item with identical before/after, 25+ items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FixPreviewDrawer } from '../FixPreviewDrawer'
import type { FixableItem } from '../FixPreviewDrawer'

// ── Factories ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<FixableItem> = {}): FixableItem {
    return {
        nodeId: 'node-abc',
        label: 'MITHRIL-COL-001 — Button#cta',
        hardcodedClass: 'bg-[#3b82f6]',
        tokenClass: 'bg-blue-500',
        ...overrides,
    }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Clear localStorage between tests so fixMode defaults to 'preview'
    localStorage.clear()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('FixPreviewDrawer', () => {
    describe('single-item mode', () => {
        it('renders "Fix preview" region with correct accessible label', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByRole('region', { name: /fix preview/i })).toBeDefined()
        })

        it('shows item label text', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem({ label: 'MITHRIL-COL-001 — Button#cta' })]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByText('MITHRIL-COL-001 — Button#cta')).toBeDefined()
        })

        it('renders "Apply fix" button with correct aria-label', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByRole('button', { name: /^apply fix$/i })).toBeDefined()
        })

        it('shows removal line (−) for the hardcoded class', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem({ hardcodedClass: 'bg-[#3b82f6]', tokenClass: 'bg-blue-500' })]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            // DiffBlock renders removal lines containing the old class text
            expect(screen.getByText(/bg-\[#3b82f6\]/)).toBeDefined()
        })

        it('shows addition line (+) for the replacement token class', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem({ hardcodedClass: 'bg-[#3b82f6]', tokenClass: 'bg-blue-500' })]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByText(/bg-blue-500/)).toBeDefined()
        })
    })

    describe('batch mode (multiple items)', () => {
        it('renders "Batch fix preview — N changes" accessible label', () => {
            const items = [makeItem(), makeItem({ nodeId: 'node-def', label: 'MITHRIL-COL-002 — Card' })]
            render(
                <FixPreviewDrawer
                    items={items}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByRole('region', { name: /batch fix preview — 2 changes/i })).toBeDefined()
        })

        it('shows "Preview N fixes" header text', () => {
            const items = [makeItem(), makeItem({ nodeId: 'node-def' })]
            render(
                <FixPreviewDrawer
                    items={items}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByText('Preview 2 fixes')).toBeDefined()
        })

        it('renders numbered list items for each fix', () => {
            const items = [
                makeItem({ nodeId: 'n1', label: 'Fix A' }),
                makeItem({ nodeId: 'n2', label: 'Fix B' }),
                makeItem({ nodeId: 'n3', label: 'Fix C' }),
            ]
            render(
                <FixPreviewDrawer
                    items={items}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(document.querySelectorAll('ol li').length).toBe(3)
        })

        it('renders "Apply all (N)" button in batch mode', () => {
            const items = [makeItem(), makeItem({ nodeId: 'node-def' })]
            render(
                <FixPreviewDrawer
                    items={items}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(screen.getByRole('button', { name: /apply all 2 fixes/i })).toBeDefined()
        })
    })

    describe('callbacks', () => {
        it('calls onApply when the Apply fix button is clicked', () => {
            const onApply = vi.fn()
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={onApply}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByRole('button', { name: /^apply fix$/i }))
            expect(onApply).toHaveBeenCalledTimes(1)
        })

        it('calls onCancel when the action-bar Cancel button is clicked', () => {
            const onCancel = vi.fn()
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={onCancel}
                    onOpenSettings={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByRole('button', { name: /cancel and discard fix/i }))
            expect(onCancel).toHaveBeenCalledTimes(1)
        })

        it('calls onCancel when the header dismiss (X) button is clicked', () => {
            const onCancel = vi.fn()
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={onCancel}
                    onOpenSettings={vi.fn()}
                />,
            )
            fireEvent.click(screen.getByRole('button', { name: /dismiss fix preview/i }))
            expect(onCancel).toHaveBeenCalledTimes(1)
        })
    })

    describe('"Always auto-fix" preference', () => {
        it('checkbox is unchecked by default (fixMode defaults to preview)', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            const checkbox = screen.getByRole('checkbox', { name: /always auto-fix without preview/i })
            expect((checkbox as HTMLInputElement).checked).toBe(false)
        })

        it('checking the checkbox shows the auto-fix helper text', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            const checkbox = screen.getByRole('checkbox', { name: /always auto-fix without preview/i })
            fireEvent.click(checkbox)
            expect(screen.getByText(/Auto-fixes will apply immediately/i)).toBeDefined()
        })

        it('unchecking the checkbox hides the auto-fix helper text', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            const checkbox = screen.getByRole('checkbox', { name: /always auto-fix without preview/i })
            fireEvent.click(checkbox) // check
            fireEvent.click(checkbox) // uncheck
            expect(screen.queryByText(/Auto-fixes will apply immediately/i)).toBeNull()
        })

        it('clicking "Change in Settings →" calls onOpenSettings', () => {
            const onOpenSettings = vi.fn()
            render(
                <FixPreviewDrawer
                    items={[makeItem()]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={onOpenSettings}
                />,
            )
            // Enable auto-fix to reveal the Settings button
            const checkbox = screen.getByRole('checkbox', { name: /always auto-fix without preview/i })
            fireEvent.click(checkbox)

            fireEvent.click(screen.getByRole('button', { name: /open policy settings/i }))
            expect(onOpenSettings).toHaveBeenCalledTimes(1)
        })
    })

    describe('edge cases', () => {
        it('renders without crashing when items array is empty', () => {
            // Empty array: isBatch=false, items[0] is undefined → component renders empty body
            render(
                <FixPreviewDrawer
                    items={[]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            // The region still renders — no crash
            expect(screen.getByRole('region', { name: /fix preview/i })).toBeDefined()
        })

        it('renders when hardcodedClass and tokenClass are identical (empty diff)', () => {
            render(
                <FixPreviewDrawer
                    items={[makeItem({ hardcodedClass: 'bg-blue-500', tokenClass: 'bg-blue-500' })]}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            // No crash; at least one line of context should render
            expect(screen.getByRole('region', { name: /fix preview/i })).toBeDefined()
        })

        it('renders 25 batch items without crashing and shows correct count', () => {
            const items = Array.from({ length: 25 }, (_, i) =>
                makeItem({ nodeId: `node-${i}`, label: `Fix ${i}` }),
            )
            render(
                <FixPreviewDrawer
                    items={items}
                    onApply={vi.fn()}
                    onCancel={vi.fn()}
                    onOpenSettings={vi.fn()}
                />,
            )
            expect(document.querySelectorAll('ol li').length).toBe(25)
            expect(screen.getByRole('button', { name: /apply all 25 fixes/i })).toBeDefined()
        })
    })
})
