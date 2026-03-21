/**
 * GovernanceOverlay.test.tsx
 *
 * 9 tests for the GovernanceOverlay component. The overlay reads
 * linterWarnings from editorStore and renders a violation list with
 * optional Auto-Fix buttons that dispatch applyTokenFix mutations.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GovernanceOverlay } from '../../editor/GovernanceOverlay'
import { useEditorStore } from '../../../store/editorStore'
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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceOverlay', () => {
    // 1. Shows "No Mithril violations" when the warning map is empty
    it('shows "No Mithril violations" message when linterWarnings is empty', () => {
        seedWarnings(new Map())
        render(<GovernanceOverlay />)
        expect(screen.getByText('No Mithril violations')).toBeDefined()
    })

    // 2. Renders violation rows for each warning
    it('renders a row for each entry in linterWarnings', () => {
        const map = new Map<string, LinterWarning>([
            ['node-1', makeWarning({ id: 'W1' })],
            ['node-2', makeWarning({ id: 'W2', type: 'typography-drift' })],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        // Each row shows the violation type label
        expect(screen.getByText('Color Drift')).toBeDefined()
        expect(screen.getByText('Typography Drift')).toBeDefined()
    })

    // 3. Shows Auto-Fix button only when nearestToken is non-null
    it('renders Auto-Fix button when warning.nearestToken is non-null', () => {
        const map = new Map<string, LinterWarning>([
            ['node-a', makeWarning({ nearestToken: 'text-red-500' })],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        expect(screen.getByText('Auto-Fix')).toBeDefined()
    })

    // 4. Auto-Fix button NOT shown when nearestToken is null
    it('does NOT render Auto-Fix button when warning.nearestToken is null', () => {
        const map = new Map<string, LinterWarning>([
            ['node-b', makeWarning({ nearestToken: null, nearestTokenValue: null })],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        expect(screen.queryByText('Auto-Fix')).toBeNull()
    })

    // 5. Click Auto-Fix calls applyBatch with correct applyTokenFix mutation
    it('clicking Auto-Fix calls editorStore.applyBatch with applyTokenFix op', () => {
        const applyBatchSpy = vi.fn()

        const map = new Map<string, LinterWarning>([
            [
                'node-c',
                makeWarning({
                    message: "MITHRIL-COL-001: arbitrary '#ff0000' not in color token set",
                    nearestToken: 'text-red-500',
                }),
            ],
        ])
        // Set both warnings and spy in one setState call so neither is lost
        useEditorStore.setState({ linterWarnings: map, applyBatch: applyBatchSpy } as any)
        render(<GovernanceOverlay />)

        const fixBtn = screen.getByText('Auto-Fix')
        fireEvent.click(fixBtn)

        expect(applyBatchSpy).toHaveBeenCalledOnce()
        const [mutations] = applyBatchSpy.mock.calls[0]
        expect(mutations[0].op).toBe('applyTokenFix')
        expect(mutations[0].nodeId).toBe('node-c')
        expect(mutations[0].hardcodedClass).toBe('#ff0000')
        expect(mutations[0].tokenClass).toBe('text-red-500')
    })

    // 6. Critical severity uses red styling
    it('applies red background class for critical severity violations', () => {
        const map = new Map<string, LinterWarning>([
            ['node-crit', makeWarning({ severity: 'critical' })],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        // The critical row renders with bg-red-900/10 class; use attribute substring match
        const critRow = document.querySelector('[class*="bg-red-900"]')
        expect(critRow).not.toBeNull()
    })

    // 7. Amber severity uses amber styling
    it('applies amber background class for amber severity violations', () => {
        const map = new Map<string, LinterWarning>([
            ['node-amber', makeWarning({ severity: 'amber' })],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        const amberRow = document.querySelector('[class*="bg-amber-900"]')
        expect(amberRow).not.toBeNull()
    })

    // 8. Shows the human-readable violation type label
    it('renders the correct violation type label for each warning type', () => {
        const map = new Map<string, LinterWarning>([
            ['n1', makeWarning({ type: 'spacing-drift' })],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        expect(screen.getByText('Spacing Drift')).toBeDefined()
    })

    // 9. Shows the node ID
    it('renders the node ID (prefixed with #) in each violation row', () => {
        const map = new Map<string, LinterWarning>([
            ['flint-node-xyz', makeWarning()],
        ])
        seedWarnings(map)
        render(<GovernanceOverlay />)
        expect(screen.getByText('#flint-node-xyz')).toBeDefined()
    })
})
