/**
 * DemoWalkthrough.test.tsx
 *
 * FORGE.1b + FORGE.1c — Step 0 orientation + Step 4 project handoff.
 *
 * Total steps: 5 (0 through 4).
 *   Step 0: "Welcome to Glass" — no close button, single forward CTA
 *   Steps 1–3: violation → fix → gate clears loop
 *   Step 4: Handoff — "Open My Project" / "Try Another Demo" / "Keep Exploring"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DemoWalkthrough } from '../DemoWalkthrough'

const STORAGE_KEY = 'flint-demo-walkthrough-complete'

describe('DemoWalkthrough', () => {
    beforeEach(() => {
        localStorage.removeItem(STORAGE_KEY)
    })

    afterEach(() => {
        localStorage.removeItem(STORAGE_KEY)
        vi.restoreAllMocks()
    })

    // ── Step 0: Orientation ───────────────────────────────────────────────────

    it('renders Step 0 "Welcome to Glass" by default', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        expect(screen.getByText('Welcome to Glass')).toBeTruthy()
        expect(screen.getByText(/Step 1 of 5/i)).toBeTruthy()
    })

    it('Step 0 has no close (X) button', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        expect(screen.queryByRole('button', { name: /Close demo walkthrough/i })).toBeNull()
    })

    it('Step 0 body contains canvas orientation text', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        expect(screen.getByText(/This is your canvas/)).toBeTruthy()
    })

    it('Step 0 forward CTA is "Let\'s go →"', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        expect(screen.getByRole('button', { name: /Next step \(1 of 5\)/i })).toBeTruthy()
        expect(screen.getByText("Let's go →")).toBeTruthy()
    })

    // ── Navigation through Steps 1–3 ──────────────────────────────────────────

    it('advances to Step 1 when forward CTA is clicked on Step 0', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        expect(screen.getByText('These are drift items')).toBeTruthy()
        expect(screen.getByText(/Step 2 of 5/i)).toBeTruthy()
    })

    it('advances to Step 2 when Next is clicked on Step 1', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        // Step 0 → 1 → 2
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        expect(screen.getByText('Click Fix to resolve them')).toBeTruthy()
        expect(screen.getByText(/Step 3 of 5/i)).toBeTruthy()
    })

    it('advances to Step 3 when Next is clicked three times', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        expect(screen.getByText('The gate clears')).toBeTruthy()
        expect(screen.getByText(/Step 4 of 5/i)).toBeTruthy()
    })

    // ── Step 4: Handoff ───────────────────────────────────────────────────────

    it('shows handoff step after Step 3 is advanced', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        // Advance through all content steps (0→1→2→3→4)
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        expect(screen.getByText(/Nice work/i)).toBeTruthy()
        expect(screen.getByText(/Step 5 of 5/i)).toBeTruthy()
    })

    it('handoff step shows "Open My Project" button', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        expect(screen.getByTestId('handoff-open-project')).toBeTruthy()
        expect(screen.getByText('Open My Project')).toBeTruthy()
    })

    it('handoff step shows "Try Another Demo" button', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        expect(screen.getByTestId('handoff-try-another')).toBeTruthy()
        expect(screen.getByText('Try Another Demo')).toBeTruthy()
    })

    it('handoff step shows "Keep Exploring" button', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        expect(screen.getByTestId('handoff-keep-exploring')).toBeTruthy()
        expect(screen.getByText('Keep Exploring')).toBeTruthy()
    })

    it('"Open My Project" calls onProjectHandoff and onDismiss', () => {
        const onDismiss = vi.fn()
        const onProjectHandoff = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} onProjectHandoff={onProjectHandoff} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        fireEvent.click(screen.getByTestId('handoff-open-project'))
        expect(onProjectHandoff).toHaveBeenCalledOnce()
        expect(onDismiss).toHaveBeenCalledOnce()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('"Try Another Demo" resets to Step 0', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        fireEvent.click(screen.getByTestId('handoff-try-another'))
        expect(screen.getByText('Welcome to Glass')).toBeTruthy()
    })

    it('"Keep Exploring" dismisses the walkthrough', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        fireEvent.click(screen.getByTestId('handoff-keep-exploring'))
        expect(onDismiss).toHaveBeenCalledOnce()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    // ── Close button on Steps 1–3 ─────────────────────────────────────────────

    it('close (X) button appears on Step 1 (not Step 0)', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        // Step 0: no close button
        expect(screen.queryByRole('button', { name: /Close demo walkthrough/i })).toBeNull()
        // Advance to Step 1
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        expect(screen.getByRole('button', { name: /Close demo walkthrough/i })).toBeTruthy()
    })

    it('clicking close calls onDismiss and sets localStorage', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        // Advance to Step 1 (where close button exists)
        fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        fireEvent.click(screen.getByRole('button', { name: /Close demo walkthrough/i }))
        expect(onDismiss).toHaveBeenCalledOnce()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    // ── localStorage completed flag ────────────────────────────────────────────

    it('does not render when localStorage flag is already set', () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        const onDismiss = vi.fn()
        const { container } = render(<DemoWalkthrough onDismiss={onDismiss} />)
        expect(container.firstChild).toBeNull()
    })

    // ── A11y attributes ───────────────────────────────────────────────────────

    it('dialog has role="dialog" and aria-modal="true"', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeTruthy()
        expect(dialog.getAttribute('aria-modal')).toBe('true')
    })

    it('dialog has accessible label including step position', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        const label = dialog.getAttribute('aria-label') ?? ''
        expect(label).toContain('step 1 of 5')
    })

    it('active step indicator has aria-current="step"', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        const currentDot = document.querySelector('[aria-current="step"]')
        expect(currentDot).not.toBeNull()
    })

    it('step dots have aria-label with step position', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        const dot = document.querySelector('[aria-label="Step 1 of 5"]')
        expect(dot).not.toBeNull()
    })

    it('forward button has aria-label with step position', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        const nextBtn = screen.getByRole('button', { name: /Next step \(1 of 5\)/i })
        expect(nextBtn).toBeTruthy()
    })

    it('step indicator progress area has aria-label', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        const progress = screen.getByRole('tablist', { name: 'Walkthrough progress' })
        expect(progress).toBeTruthy()
    })

    it('handoff step dialog has aria-label including step 5 of 5', () => {
        render(<DemoWalkthrough onDismiss={vi.fn()} />)
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
        }
        const dialog = screen.getByRole('dialog')
        const label = dialog.getAttribute('aria-label') ?? ''
        expect(label).toContain('step 5 of 5')
    })
})
