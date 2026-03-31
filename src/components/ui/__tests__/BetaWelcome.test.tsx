/**
 * BetaWelcome.test.tsx — FORGE.1f: Accessibility fixes for BetaWelcome
 *
 * BW-A11Y-01 — Hero heading is programmatically focusable (tabIndex=-1)
 * BW-A11Y-02 — Hero heading receives focus on mount
 * BW-A11Y-03 — onTryDemo callback is called when "Try the Demo Project" is clicked
 * BW-A11Y-04 — onSkip callback is called when the skip button is clicked
 * BW-A11Y-05 — Subtitle uses text-zinc-300 (high-contrast) class
 * BW-A11Y-06 — Product name heading does not use gradient text-transparent
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { BetaWelcome } from '../BetaWelcome'

describe('BetaWelcome', () => {

    // BW-A11Y-01: Hero heading has tabIndex={-1} so it can receive programmatic focus
    it('BW-A11Y-01: hero heading has tabIndex=-1 (programmatically focusable)', () => {
        render(<BetaWelcome onTryDemo={vi.fn()} onSkip={vi.fn()} />)
        const heading = screen.getByText(/Welcome to the .* Beta/i)
        expect(heading.getAttribute('tabindex')).toBe('-1')
    })

    // BW-A11Y-02: Hero heading receives focus on mount via useEffect + ref
    it('BW-A11Y-02: hero heading is focused on mount', () => {
        render(<BetaWelcome onTryDemo={vi.fn()} onSkip={vi.fn()} />)
        const heading = screen.getByText(/Welcome to the .* Beta/i)
        // jsdom calls focus() synchronously; document.activeElement reflects it
        expect(document.activeElement).toBe(heading)
    })

    // BW-A11Y-03: onTryDemo callback fires on primary CTA click
    it('BW-A11Y-03: clicking "Try the Demo Project" calls onTryDemo', () => {
        const onTryDemo = vi.fn()
        render(<BetaWelcome onTryDemo={onTryDemo} onSkip={vi.fn()} />)
        fireEvent.click(screen.getByText(/Try the Demo Project/i))
        expect(onTryDemo).toHaveBeenCalledOnce()
    })

    // BW-A11Y-04: onSkip callback fires on skip button click
    it('BW-A11Y-04: clicking the skip button calls onSkip', () => {
        const onSkip = vi.fn()
        render(<BetaWelcome onTryDemo={vi.fn()} onSkip={onSkip} />)
        fireEvent.click(screen.getByText(/Skip/i))
        expect(onSkip).toHaveBeenCalledOnce()
    })

    // BW-A11Y-05: Subtitle text uses a high-contrast color class (zinc-300 or better)
    it('BW-A11Y-05: subtitle paragraph uses a high-contrast text color class', () => {
        render(<BetaWelcome onTryDemo={vi.fn()} onSkip={vi.fn()} />)
        // The subtitle is the paragraph immediately below the hero heading
        const subtitle = screen.getByText(/catches design system drift/i)
        const classList = subtitle.className
        // zinc-300 (~8.6:1 on zinc-900), zinc-400 (~7.6:1) both pass WCAG AA
        // zinc-500 (~4.0:1) would fail — ensure we're using 300 or 400
        const passesContrast =
            classList.includes('text-zinc-300') ||
            classList.includes('text-zinc-200') ||
            classList.includes('text-zinc-100') ||
            classList.includes('text-white')
        expect(passesContrast).toBe(true)
    })

    // BW-A11Y-06: Product name <h1> does not use gradient text-transparent pattern
    it('BW-A11Y-06: the product name heading does not use text-transparent (gradient contrast failure)', () => {
        render(<BetaWelcome onTryDemo={vi.fn()} onSkip={vi.fn()} />)
        // Find the h1 element containing the brand name
        const h1s = document.querySelectorAll('h1')
        expect(h1s.length).toBeGreaterThan(0)
        h1s.forEach((h1) => {
            expect(h1.className).not.toContain('text-transparent')
        })
    })

    // BW-A11Y-07: Renders without crashing when optional props are omitted
    it('BW-A11Y-07: renders without crashing when buildId and daysRemaining are not provided', () => {
        expect(() =>
            render(<BetaWelcome onTryDemo={vi.fn()} onSkip={vi.fn()} />)
        ).not.toThrow()
    })

    // BW-A11Y-08: Beta badge renders when buildId is provided
    it('BW-A11Y-08: renders the beta badge when buildId is provided', () => {
        render(
            <BetaWelcome
                onTryDemo={vi.fn()}
                onSkip={vi.fn()}
                buildId="build-123"
                daysRemaining={14}
            />
        )
        expect(screen.getByText(/14d remaining/i)).toBeDefined()
    })
})
