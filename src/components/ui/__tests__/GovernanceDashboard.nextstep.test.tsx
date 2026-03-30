/**
 * GovernanceDashboard.nextstep.test.tsx
 *
 * Tests for the "Next Step" coaching sentence (Sprint Clarity 2, Item 1).
 * Validates all 6 copy variants based on violation counts and score.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useTokenStore } from '../../../store/tokenStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'
import type { DesignToken, LinterWarning } from '../../../types/flint-api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(): DesignToken {
    return {
        id: 1,
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
    }
}

function makeMithrilWarnings(count: number): LinterWarning[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `m-${i}`,
        nodeId: `node-m-${i}`,
        type: 'color-drift' as const,
        severity: 'amber' as const,
        value: 5,
        message: `Color drift ${i}`,
        nearestToken: 'color.brand.primary',
        nearestTokenValue: '#1d4ed8',
    })) as LinterWarning[]
}

function makeA11yViolations(count: number): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (let i = 0; i < count; i++) {
        result[`a11y-node-${i}`] = [`Missing alt text ${i}`]
    }
    return result
}

function seedState(opts: {
    mithrilCount?: number
    a11yCount?: number
    overrideCount?: number
}) {
    const { mithrilCount = 0, a11yCount = 0, overrideCount = 0 } = opts
    useTokenStore.setState({ tokens: [makeToken()], isLoading: false, error: null })
    useEditorStore.setState({ linterWarnings: makeMithrilWarnings(mithrilCount) })
    useCanvasStore.setState({
        a11yViolations: makeA11yViolations(a11yCount),
        overridesExist: overrideCount > 0,
    })
    // Mock the override count IPC
    if (overrideCount > 0) {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(overrideCount)
    }
}

async function getNextStepText(): Promise<string> {
    // Score accordion defaults to open — just wait for the element to appear
    await waitFor(() => {
        expect(screen.getByTestId('next-step-prompt')).toBeDefined()
    })
    return screen.getByTestId('next-step-prompt').textContent ?? ''
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — Next Step coaching sentence', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useEditorStore.setState({ linterWarnings: [] })
        useCanvasStore.setState({ a11yViolations: {}, overridesExist: false })
        ;(window.flintAPI as Record<string, unknown>).baseline = undefined
    })

    it('shows "perfect" variant when score is 100', async () => {
        seedState({})
        render(<GovernanceDashboard />)
        const text = await getNextStepText()
        expect(text).toBe('Perfect score — your design system is fully in sync.')
    })

    it('shows "nearly-perfect" variant when score >= 90 with issues', async () => {
        // 1 mithril warning → score = 95
        seedState({ mithrilCount: 1 })
        render(<GovernanceDashboard />)
        const text = await getNextStepText()
        expect(text).toContain('Nearly perfect')
        expect(text).toContain("say 'fix it' in your IDE")
    })

    it('shows "a11y-dominant" variant when a11y > mithril', async () => {
        // 1 mithril (-5), 3 a11y (-30) → score = 65
        seedState({ mithrilCount: 1, a11yCount: 3 })
        render(<GovernanceDashboard />)
        const text = await getNextStepText()
        expect(text).toContain('3 accessibility gaps are pulling your score down')
    })

    it('shows "mithril-dominant" variant when mithril >= a11y', async () => {
        // 4 mithril (-20), 1 a11y (-10) → score = 70
        seedState({ mithrilCount: 4, a11yCount: 1 })
        render(<GovernanceDashboard />)
        const text = await getNextStepText()
        expect(text).toContain('4 color drifts are lowering your score')
    })

    it('shows "override-dominant" variant when overrides > mithril + a11y', async () => {
        // 0 mithril, 0 a11y, 5 overrides → overrideCount(5) > 0+0
        seedState({ overrideCount: 5 })
        render(<GovernanceDashboard />)
        // Wait for IPC override count to load
        await waitFor(() => {
            expect(screen.getByText('5 overrides')).toBeDefined()
        })
        const text = await getNextStepText()
        expect(text).toContain('rule overrides are active')
        expect(text).toContain('Governance panel')
    })

    it('shows "mithril-dominant" for equal mithril and a11y counts', async () => {
        // 2 mithril (-10), 2 a11y (-20) → score = 70, mithril >= a11y
        seedState({ mithrilCount: 2, a11yCount: 2 })
        render(<GovernanceDashboard />)
        const text = await getNextStepText()
        expect(text).toContain('color drifts are lowering your score')
    })
})
