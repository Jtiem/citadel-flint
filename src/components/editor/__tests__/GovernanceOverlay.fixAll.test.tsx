/**
 * GovernanceOverlay.fixAll.test.tsx — GLASS.1e
 *
 * Tests for the Fix All button and rule filter features added to GovernanceOverlay.
 *
 *   1. Fix All button shows correct count of auto-fixable violations
 *   2. Fix All button hidden (disabled state) when 0 auto-fixable
 *   3. Fix All button triggers batch fix action
 *   4. Rule filter shows only matching violations
 *   5. Clear filter button restores full list
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GovernanceOverlay } from '../../editor/GovernanceOverlay'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { LinterWarning } from '../../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'COL-001',
        type: 'color-drift',
        severity: 'amber',
        value: 4.5,
        message: "MITHRIL-COL-001: arbitrary '#ff0000' not in color token set",
        nearestToken: 'text-red-500',
        nearestTokenValue: '#ef4444',
        ...overrides,
    }
}

function seedWarnings(map: Map<string, LinterWarning>) {
    useEditorStore.setState({ linterWarnings: map })
}

function resetFilter() {
    useCanvasStore.setState({ governanceRuleFilter: null })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceOverlay — Fix All (GLASS.1e)', () => {
    // 1. Fix All button shows correct count of auto-fixable violations
    it('shows Fix All button with count of auto-fixable violations', () => {
        const map = new Map<string, LinterWarning>([
            ['node-1', makeWarning({ id: 'W1', nearestToken: 'text-red-500' })],
            ['node-2', makeWarning({ id: 'W2', nearestToken: 'text-blue-500', message: "MITHRIL-COL-002: arbitrary '#0000ff' not in color token set" })],
            ['node-3', makeWarning({ id: 'W3', nearestToken: null, nearestTokenValue: null })],
        ])
        seedWarnings(map)
        resetFilter()
        render(<GovernanceOverlay />)

        const fixAllBtn = screen.getByTestId('fix-all-button')
        expect(fixAllBtn).toBeDefined()
        // 2 out of 3 are auto-fixable (node-3 has no nearestToken)
        expect(fixAllBtn.textContent).toContain('2')
    })

    // 2. Fix All button disabled/hidden when 0 auto-fixable
    it('shows disabled state when zero violations are auto-fixable', () => {
        const map = new Map<string, LinterWarning>([
            ['node-a', makeWarning({ id: 'W1', nearestToken: null, nearestTokenValue: null })],
            ['node-b', makeWarning({ id: 'W2', nearestToken: null, nearestTokenValue: null })],
        ])
        seedWarnings(map)
        resetFilter()
        render(<GovernanceOverlay />)

        const disabledBadge = screen.getByTestId('fix-all-disabled')
        expect(disabledBadge).toBeDefined()
        expect(disabledBadge.textContent).toContain('No auto-fixable')
        // The active fix button should not exist
        expect(screen.queryByTestId('fix-all-button')).toBeNull()
    })

    // 3. Fix All button triggers batch fix action
    it('clicking Fix All calls applyBatch with all auto-fixable mutations', () => {
        const applyBatchSpy = vi.fn()

        const map = new Map<string, LinterWarning>([
            ['node-x', makeWarning({ id: 'W1', nearestToken: 'text-red-500', message: "MITHRIL-COL-001: arbitrary '#ff0000' not in color token set" })],
            ['node-y', makeWarning({ id: 'W2', nearestToken: 'bg-blue-600', message: "MITHRIL-COL-002: arbitrary '#2563eb' not in color token set" })],
        ])
        useEditorStore.setState({ linterWarnings: map, applyBatch: applyBatchSpy } as unknown as Record<string, unknown>)
        resetFilter()
        render(<GovernanceOverlay />)

        const fixAllBtn = screen.getByTestId('fix-all-button')
        fireEvent.click(fixAllBtn)

        expect(applyBatchSpy).toHaveBeenCalledOnce()
        const [mutations] = applyBatchSpy.mock.calls[0]
        expect(mutations).toHaveLength(2)
        expect(mutations[0].op).toBe('applyTokenFix')
        expect(mutations[0].nodeId).toBe('node-x')
        expect(mutations[1].op).toBe('applyTokenFix')
        expect(mutations[1].nodeId).toBe('node-y')
    })

    // 4. Completed fix shows result message
    it('shows result message after Fix All completes', () => {
        const applyBatchSpy = vi.fn()

        const map = new Map<string, LinterWarning>([
            ['node-z', makeWarning({ id: 'W1', nearestToken: 'text-red-500', message: "MITHRIL-COL-001: arbitrary '#ff0000' not in color token set" })],
        ])
        useEditorStore.setState({ linterWarnings: map, applyBatch: applyBatchSpy } as unknown as Record<string, unknown>)
        resetFilter()
        render(<GovernanceOverlay />)

        const fixAllBtn = screen.getByTestId('fix-all-button')
        fireEvent.click(fixAllBtn)

        const result = screen.getByTestId('fix-all-result')
        expect(result).toBeDefined()
        expect(result.textContent).toContain('Fixed 1 violation')
    })

    // 5. Rule filter shows only matching violations
    it('filters violations when governanceRuleFilter is set', () => {
        const map = new Map<string, LinterWarning>([
            ['node-1', makeWarning({ id: 'W1', type: 'color-drift' })],
            ['node-2', makeWarning({ id: 'W2', type: 'typography-drift', message: "MITHRIL-TYP-001: arbitrary 'Comic Sans'" })],
        ])
        seedWarnings(map)
        useCanvasStore.setState({ governanceRuleFilter: 'color-drift' })
        render(<GovernanceOverlay />)

        // Only color-drift should be visible
        expect(screen.getByText('Color Drift')).toBeDefined()
        expect(screen.queryByText('Typography Drift')).toBeNull()
    })

    // 6. Clear filter button restores full list
    it('clear filter button resets governanceRuleFilter to null', () => {
        const map = new Map<string, LinterWarning>([
            ['node-1', makeWarning({ id: 'W1', type: 'color-drift' })],
            ['node-2', makeWarning({ id: 'W2', type: 'typography-drift', message: "MITHRIL-TYP-001: arbitrary 'Comic Sans'" })],
        ])
        seedWarnings(map)
        useCanvasStore.setState({ governanceRuleFilter: 'color-drift' })
        render(<GovernanceOverlay />)

        const clearBtn = screen.getByTestId('clear-rule-filter')
        fireEvent.click(clearBtn)

        expect(useCanvasStore.getState().governanceRuleFilter).toBeNull()
    })
})
