/**
 * T23 — FixAllCta tests
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FixAllCta } from '../FixAllCta'

describe('FixAllCta', () => {
    it('renders nothing when visible is false', () => {
        const { container } = render(
            <FixAllCta autoFixableCount={5} visible={false} onFixAll={vi.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders nothing when autoFixableCount is 0', () => {
        const { container } = render(
            <FixAllCta autoFixableCount={0} visible={true} onFixAll={vi.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the CTA when visible and autoFixableCount > 0', () => {
        render(<FixAllCta autoFixableCount={3} visible={true} onFixAll={vi.fn()} />)
        expect(screen.getByTestId('fix-all-autofixable-cta')).toBeInTheDocument()
    })

    it('shows plural "issues" for count > 1', () => {
        render(<FixAllCta autoFixableCount={3} visible={true} onFixAll={vi.fn()} />)
        expect(screen.getByTestId('fix-all-autofixable-cta')).toHaveTextContent('Fix 3 auto-fixable issues')
    })

    it('shows singular "issue" for count = 1', () => {
        render(<FixAllCta autoFixableCount={1} visible={true} onFixAll={vi.fn()} />)
        expect(screen.getByTestId('fix-all-autofixable-cta')).toHaveTextContent('Fix 1 auto-fixable issue')
    })

    it('calls onFixAll when the button is clicked', () => {
        const onFixAll = vi.fn()
        render(<FixAllCta autoFixableCount={2} visible={true} onFixAll={onFixAll} />)
        fireEvent.click(screen.getByTestId('fix-all-autofixable-cta'))
        expect(onFixAll).toHaveBeenCalledOnce()
    })

    it('renders the Wand2 icon (aria-hidden)', () => {
        render(<FixAllCta autoFixableCount={2} visible={true} onFixAll={vi.fn()} />)
        const btn = screen.getByTestId('fix-all-autofixable-cta')
        const icon = btn.querySelector('[aria-hidden="true"]')
        expect(icon).not.toBeNull()
    })
})
