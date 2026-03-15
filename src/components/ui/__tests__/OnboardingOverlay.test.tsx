/**
 * OnboardingOverlay.test.tsx
 *
 * 8 tests for the OnboardingOverlay component. The overlay reads/writes
 * localStorage key "bridge-onboarding-complete" to track whether to show
 * the 3-step onboarding flow.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingOverlay } from '../OnboardingOverlay'

const STORAGE_KEY = 'bridge-onboarding-complete'

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('OnboardingOverlay', () => {
    // 1. Shows overlay when localStorage key is absent
    it('shows the overlay when the onboarding key is not set in localStorage', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        render(<OnboardingOverlay />)
        expect(screen.getByText('Your Canvas')).toBeDefined()
    })

    // 2. Does NOT show when key is already set
    it('does NOT render the overlay when the onboarding key is present', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true')
        const { container } = render(<OnboardingOverlay />)
        expect(container.firstChild).toBeNull()
    })

    // 3. Shows step 1 content initially
    it('shows step 1 "Your Canvas" content on initial render', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        render(<OnboardingOverlay />)
        expect(screen.getByText('Your Canvas')).toBeDefined()
        expect(screen.getByText(/infinite canvas/i)).toBeDefined()
    })

    // 4. Next button advances to step 2
    it('advances to step 2 when the Next button is clicked', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        render(<OnboardingOverlay />)
        fireEvent.click(screen.getByText('Next'))
        expect(screen.getByText('Inspect & Edit')).toBeDefined()
    })

    // 5. Next button advances to step 3
    it('advances to step 3 after clicking Next twice', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        render(<OnboardingOverlay />)
        fireEvent.click(screen.getByText('Next'))
        fireEvent.click(screen.getByText('Next'))
        expect(screen.getByText('Talk to Bridge')).toBeDefined()
    })

    // 6. "Got it" on last step sets localStorage and hides the overlay
    it('"Got it" on the last step writes localStorage key and hides the overlay', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        const { container } = render(<OnboardingOverlay />)
        // Advance to last step
        fireEvent.click(screen.getByText('Next'))
        fireEvent.click(screen.getByText('Next'))
        // Click "Got it"
        fireEvent.click(screen.getByText('Got it'))
        expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
        // Overlay should be gone
        expect(container.firstChild).toBeNull()
    })

    // 7. X button dismisses immediately and sets localStorage
    it('X button dismisses the overlay immediately and writes localStorage', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        const { container } = render(<OnboardingOverlay />)
        const skipBtn = screen.getByLabelText('Skip onboarding')
        fireEvent.click(skipBtn)
        expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
        expect(container.firstChild).toBeNull()
    })

    // 8. Shows correct step indicator dots (3 dots, active one is wider)
    it('renders the correct number of step indicator dots', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        render(<OnboardingOverlay />)
        // Each step renders one dot span with rounded-full class — 3 steps = 3 dots
        // Use a broader attribute selector to avoid CSS escaping issues
        const stepDots = document.querySelectorAll('[class*="rounded-full"][class*="bg-indigo-400"], [class*="rounded-full"][class*="bg-zinc-700"]')
        expect(stepDots.length).toBe(3)
    })
})
