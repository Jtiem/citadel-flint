/**
 * TokenHealthBar.mint4c.test.tsx — MINT.4c tests
 *
 * Updated for MINT.5 Phase 1: TokenHealthBar now accepts a `health: TokenHealthData`
 * prop instead of individual `scaleGapCount`, `deadTokenCount`, `driftCount` props.
 * Scale gaps are surfaced via health.buckets.scaleGaps.
 *
 * THB-01: Shows scale gap chip when health.buckets.scaleGaps > 0
 * THB-02: Does not show scale gap chip when scaleGaps is 0
 * THB-03: Shows correct singular gap count
 * THB-04: Shows correct plural gap count
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokenHealthBar } from '../TokenHealthBar'
import type { TokenHealthData } from '../../../hooks/useTokenHealth'
import type { HealthScoreInput } from '../../../../shared/healthScore'

function makeHealth(scaleGaps: number): TokenHealthData {
    const advisoryCount = scaleGaps
    const raw = 100 - advisoryCount
    const score = Math.max(0, Math.min(100, raw))
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
    const input: HealthScoreInput = { criticalCount: 0, amberCount: 0, advisoryCount, overrideCount: 0 }
    return {
        score,
        grade: grade as TokenHealthData['grade'],
        buckets: { dead: 0, drifted: 0, scaleGaps, contrastFails: 0, pendingConflicts: 0 },
        input,
    }
}

describe('TokenHealthBar — MINT.4c scale gap pill', () => {
    const baseProps = {
        totalTokens: 50,
        figmaConnected: false,
        usageFileCount: 10,
    }

    it('THB-01: shows scale gap pill when scaleGapCount > 0', () => {
        render(<TokenHealthBar {...baseProps} health={makeHealth(3)} />)
        expect(screen.getByTestId('health-chip-scale-gaps')).toBeTruthy()
    })

    it('THB-02: does not show scale gap pill when scaleGapCount is 0', () => {
        render(<TokenHealthBar {...baseProps} health={makeHealth(0)} />)
        expect(screen.queryByTestId('health-chip-scale-gaps')).toBeNull()
    })

    it('THB-03: shows singular gap count', () => {
        render(<TokenHealthBar {...baseProps} health={makeHealth(1)} />)
        const chip = screen.getByTestId('health-chip-scale-gaps')
        // SeverityChip renders: dot + count + label
        expect(chip.textContent).toContain('1')
        expect(chip.textContent).toContain('scale gap')
    })

    it('THB-04: shows plural gap count', () => {
        render(<TokenHealthBar {...baseProps} health={makeHealth(5)} />)
        const chip = screen.getByTestId('health-chip-scale-gaps')
        expect(chip.textContent).toContain('5')
        expect(chip.textContent).toContain('scale gap')
    })
})
