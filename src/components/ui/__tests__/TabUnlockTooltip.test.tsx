import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabUnlockTooltip } from '../TabUnlockTooltip'

beforeEach(() => {
    localStorage.clear()
})

describe('TabUnlockTooltip', () => {
    it('renders tooltip text on first appearance', () => {
        render(
            <TabUnlockTooltip tooltipKey="tab-unlock-tokens" text="Tokens loaded — this tab shows your design tokens.">
                <button>Tokens</button>
            </TabUnlockTooltip>,
        )
        expect(screen.getByTestId('tab-unlock-tooltip')).toBeTruthy()
        expect(screen.getByText('Tokens loaded — this tab shows your design tokens.')).toBeTruthy()
    })

    it('renders the wrapped children', () => {
        render(
            <TabUnlockTooltip tooltipKey="tab-unlock-tokens" text="Narration">
                <button>Tokens</button>
            </TabUnlockTooltip>,
        )
        expect(screen.getByRole('button', { name: 'Tokens' })).toBeTruthy()
    })

    it('hides tooltip after dismiss click', () => {
        render(
            <TabUnlockTooltip tooltipKey="tab-unlock-tokens" text="Narration text">
                <button>Tokens</button>
            </TabUnlockTooltip>,
        )
        expect(screen.getByTestId('tab-unlock-tooltip')).toBeTruthy()
        fireEvent.click(screen.getByTestId('tab-unlock-tooltip-dismiss'))
        expect(screen.queryByTestId('tab-unlock-tooltip')).toBeNull()
    })

    it('persists dismissal to localStorage', () => {
        render(
            <TabUnlockTooltip tooltipKey="tab-unlock-tokens" text="Narration">
                <button>Tokens</button>
            </TabUnlockTooltip>,
        )
        fireEvent.click(screen.getByTestId('tab-unlock-tooltip-dismiss'))
        expect(localStorage.getItem('flint:tooltip:tab-unlock-tokens')).toBe('dismissed')
    })

    it('does not show tooltip when already dismissed in localStorage', () => {
        localStorage.setItem('flint:tooltip:tab-unlock-tokens', 'dismissed')
        render(
            <TabUnlockTooltip tooltipKey="tab-unlock-tokens" text="Narration">
                <button>Tokens</button>
            </TabUnlockTooltip>,
        )
        expect(screen.queryByTestId('tab-unlock-tooltip')).toBeNull()
    })
})
