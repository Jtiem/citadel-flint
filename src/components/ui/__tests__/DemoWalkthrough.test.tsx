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

    it('renders step 0 by default', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        expect(screen.getByText('These are violations')).toBeTruthy()
        expect(screen.getByText(/Step 1 of 3/i)).toBeTruthy()
    })

    it('advances to step 1 when Next is clicked', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
        expect(screen.getByText('Click Fix to resolve them')).toBeTruthy()
        expect(screen.getByText(/Step 2 of 3/i)).toBeTruthy()
    })

    it('advances to step 2 when Next is clicked twice', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
        expect(screen.getByText('The gate clears')).toBeTruthy()
        expect(screen.getByText(/Step 3 of 3/i)).toBeTruthy()
    })

    it('calls onDismiss and sets localStorage when Done is clicked on step 2', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        // Advance to step 2
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
        // Click Done
        fireEvent.click(screen.getByRole('button', { name: /Done/i }))
        expect(onDismiss).toHaveBeenCalledOnce()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('calls onDismiss and sets localStorage when Skip (X) is clicked', () => {
        const onDismiss = vi.fn()
        render(<DemoWalkthrough onDismiss={onDismiss} />)
        fireEvent.click(screen.getByRole('button', { name: /Skip walkthrough/i }))
        expect(onDismiss).toHaveBeenCalledOnce()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('does not render when localStorage flag is already set', () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        const onDismiss = vi.fn()
        const { container } = render(<DemoWalkthrough onDismiss={onDismiss} />)
        expect(container.firstChild).toBeNull()
    })
})
