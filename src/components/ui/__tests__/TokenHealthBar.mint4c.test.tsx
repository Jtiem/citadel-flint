/**
 * TokenHealthBar.mint4c.test.tsx — MINT.4c tests
 *
 * THB-01: Shows scale gap pill when scaleGapCount > 0
 * THB-02: Does not show scale gap pill when scaleGapCount is 0
 * THB-03: Shows correct singular gap count
 * THB-04: Shows correct plural gap count
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokenHealthBar } from '../TokenHealthBar'

describe('TokenHealthBar — MINT.4c scale gap pill', () => {
    const baseProps = {
        totalTokens: 50,
        syncStatuses: [] as ('synced' | 'local-only' | 'drifted' | 'figma-only')[],
        figmaConnected: false,
        usageFileCount: 10,
    }

    it('THB-01: shows scale gap pill when scaleGapCount > 0', () => {
        render(<TokenHealthBar {...baseProps} scaleGapCount={3} />)
        expect(screen.getByTestId('health-scale-gaps')).toBeTruthy()
    })

    it('THB-02: does not show scale gap pill when scaleGapCount is 0', () => {
        render(<TokenHealthBar {...baseProps} scaleGapCount={0} />)
        expect(screen.queryByTestId('health-scale-gaps')).toBeNull()
    })

    it('THB-03: shows singular gap count', () => {
        render(<TokenHealthBar {...baseProps} scaleGapCount={1} />)
        expect(screen.getByTestId('health-scale-gaps').textContent).toContain('1 scale gap')
        expect(screen.getByTestId('health-scale-gaps').textContent).not.toContain('1 scale gaps')
    })

    it('THB-04: shows plural gap count', () => {
        render(<TokenHealthBar {...baseProps} scaleGapCount={5} />)
        expect(screen.getByTestId('health-scale-gaps').textContent).toContain('5 scale gaps')
    })
})
