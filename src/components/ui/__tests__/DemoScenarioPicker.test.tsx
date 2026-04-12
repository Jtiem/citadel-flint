/**
 * DemoScenarioPicker.test.tsx — FORGE.3c tests
 *
 * DSP-01: Renders all 4 scenario cards
 * DSP-02: Each card shows title, description, and time
 * DSP-03: Clicking a card calls onLoadDemo with correct demo name
 * DSP-04: Shows loading state on clicked card
 * DSP-05: Disables other cards while one is loading
 * DSP-06: Cards are keyboard accessible (button elements)
 * DSP-07: Loading state clears after onLoadDemo resolves
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DemoScenarioPicker, DEMO_SCENARIOS } from '../DemoScenarioPicker'

describe('DemoScenarioPicker', () => {
    // DSP-01: Renders all 4 scenario cards
    it('DSP-01: renders all scenario cards', () => {
        render(<DemoScenarioPicker onLoadDemo={vi.fn().mockResolvedValue(undefined)} />)
        expect(screen.getByTestId('demo-scenario-picker')).toBeTruthy()
        for (const scenario of DEMO_SCENARIOS) {
            expect(screen.getByTestId(`demo-scenario-${scenario.id}`)).toBeTruthy()
        }
    })

    // DSP-02: Each card shows title, description, and time
    it('DSP-02: each card shows title, description, and time', () => {
        render(<DemoScenarioPicker onLoadDemo={vi.fn().mockResolvedValue(undefined)} />)
        for (const scenario of DEMO_SCENARIOS) {
            const card = screen.getByTestId(`demo-scenario-${scenario.id}`)
            expect(card.textContent).toContain(scenario.title)
            expect(card.textContent).toContain(scenario.description)
            expect(card.textContent).toContain(scenario.time)
        }
    })

    // DSP-03: Clicking a card calls onLoadDemo with correct demo name
    it('DSP-03: calls onLoadDemo with correct demo name on click', async () => {
        const onLoadDemo = vi.fn().mockResolvedValue(undefined)
        render(<DemoScenarioPicker onLoadDemo={onLoadDemo} />)
        fireEvent.click(screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[0].id}`))
        await waitFor(() => {
            expect(onLoadDemo).toHaveBeenCalledWith(DEMO_SCENARIOS[0].demoName)
        })
    })

    // DSP-04: Shows loading state on clicked card
    it('DSP-04: shows loading spinner on the clicked card', async () => {
        let resolveLoad: () => void = () => {}
        const onLoadDemo = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveLoad = r }))
        render(<DemoScenarioPicker onLoadDemo={onLoadDemo} />)
        fireEvent.click(screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[0].id}`))
        // The card should have loading state — check for spinner via class
        await waitFor(() => {
            const card = screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[0].id}`)
            expect(card.className).toContain('indigo')
        })
        resolveLoad()
    })

    // DSP-05: Disables other cards while one is loading
    it('DSP-05: disables other cards while one is loading', async () => {
        let resolveLoad: () => void = () => {}
        const onLoadDemo = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveLoad = r }))
        render(<DemoScenarioPicker onLoadDemo={onLoadDemo} />)
        fireEvent.click(screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[0].id}`))
        await waitFor(() => {
            const otherCard = screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[1].id}`)
            expect(otherCard.hasAttribute('disabled')).toBe(true)
        })
        resolveLoad()
    })

    // DSP-06: Cards are keyboard accessible (button elements)
    it('DSP-06: all cards are button elements for keyboard access', () => {
        render(<DemoScenarioPicker onLoadDemo={vi.fn().mockResolvedValue(undefined)} />)
        for (const scenario of DEMO_SCENARIOS) {
            const card = screen.getByTestId(`demo-scenario-${scenario.id}`)
            expect(card.tagName.toLowerCase()).toBe('button')
        }
    })

    // DSP-07: Loading state clears after onLoadDemo resolves
    it('DSP-07: loading state clears after onLoadDemo resolves', async () => {
        const onLoadDemo = vi.fn().mockResolvedValue(undefined)
        render(<DemoScenarioPicker onLoadDemo={onLoadDemo} />)
        fireEvent.click(screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[0].id}`))
        await waitFor(() => {
            const card = screen.getByTestId(`demo-scenario-${DEMO_SCENARIOS[1].id}`)
            expect(card.hasAttribute('disabled')).toBe(false)
        })
    })
})
