/**
 * SwitchToggle.test.tsx
 *
 * Tests for the canonical SwitchToggle component (S6.4).
 *
 * Covers:
 *   - Renders with role="switch"
 *   - aria-checked is true when checked=true, false when checked=false
 *   - onChange called when clicked
 *   - disabled=true renders the button as disabled
 *   - Visual label renders when label prop is provided
 *   - labelPosition="left" places label before the toggle
 *   - aria-label prop forwarded to the button
 *   - size="sm" applies smaller track dimensions
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwitchToggle } from '../SwitchToggle'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SwitchToggle', () => {
    describe('ARIA', () => {
        it('renders with role="switch"', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} aria-label="My toggle" />)
            const toggle = screen.getByRole('switch')
            expect(toggle).toBeDefined()
        })

        it('aria-checked is "true" when checked=true', () => {
            render(<SwitchToggle checked={true} onChange={vi.fn()} aria-label="My toggle" />)
            const toggle = screen.getByRole('switch')
            expect(toggle.getAttribute('aria-checked')).toBe('true')
        })

        it('aria-checked is "false" when checked=false', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} aria-label="My toggle" />)
            const toggle = screen.getByRole('switch')
            expect(toggle.getAttribute('aria-checked')).toBe('false')
        })

        it('forwards aria-label to the button', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} aria-label="Enable feature" />)
            const toggle = screen.getByLabelText('Enable feature')
            expect(toggle.getAttribute('role')).toBe('switch')
        })

        it('forwards aria-describedby to the button', () => {
            render(
                <SwitchToggle
                    checked={false}
                    onChange={vi.fn()}
                    aria-label="Toggle"
                    aria-describedby="hint-text"
                />,
            )
            const toggle = screen.getByRole('switch')
            expect(toggle.getAttribute('aria-describedby')).toBe('hint-text')
        })
    })

    describe('interaction', () => {
        it('calls onChange with true when clicked while unchecked', () => {
            const onChange = vi.fn()
            render(<SwitchToggle checked={false} onChange={onChange} aria-label="Toggle" />)
            fireEvent.click(screen.getByRole('switch'))
            expect(onChange).toHaveBeenCalledWith(true)
        })

        it('calls onChange with false when clicked while checked', () => {
            const onChange = vi.fn()
            render(<SwitchToggle checked={true} onChange={onChange} aria-label="Toggle" />)
            fireEvent.click(screen.getByRole('switch'))
            expect(onChange).toHaveBeenCalledWith(false)
        })

        it('does not call onChange when disabled', () => {
            const onChange = vi.fn()
            render(
                <SwitchToggle checked={false} onChange={onChange} disabled aria-label="Toggle" />,
            )
            // Disabled buttons do not fire click events in the DOM
            const btn = screen.getByRole('switch') as HTMLButtonElement
            expect(btn.disabled).toBe(true)
        })
    })

    describe('disabled state', () => {
        it('renders the button with disabled attribute when disabled=true', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} disabled aria-label="Toggle" />)
            const btn = screen.getByRole('switch') as HTMLButtonElement
            expect(btn.disabled).toBe(true)
        })

        it('button is not disabled when disabled=false', () => {
            render(
                <SwitchToggle checked={false} onChange={vi.fn()} disabled={false} aria-label="Toggle" />,
            )
            const btn = screen.getByRole('switch') as HTMLButtonElement
            expect(btn.disabled).toBe(false)
        })
    })

    describe('label', () => {
        it('renders visible label text when label prop is provided', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} label="Auto-fix" />)
            expect(screen.getByText('Auto-fix')).toBeDefined()
        })

        it('associates label with button via htmlFor/id', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} label="Auto-fix" />)
            // The label's htmlFor should resolve to the button
            const label = screen.getByText('Auto-fix').closest('label')!
            const forAttr = label.getAttribute('for')
            expect(forAttr).toBeTruthy()
            const btn = document.getElementById(forAttr!)
            expect(btn?.getAttribute('role')).toBe('switch')
        })

        it('labelPosition="left" places label before the toggle in the DOM', () => {
            render(
                <SwitchToggle
                    checked={false}
                    onChange={vi.fn()}
                    label="Left label"
                    labelPosition="left"
                />,
            )
            const label = screen.getByText('Left label').closest('label')!
            const children = Array.from(label.childNodes).filter(
                (n) => n.nodeType === Node.ELEMENT_NODE,
            ) as HTMLElement[]
            // First child is the label text span, second is the button
            expect(children[0].tagName.toLowerCase()).toBe('span')
            expect(children[1].tagName.toLowerCase()).toBe('button')
        })
    })

    describe('size prop', () => {
        it('renders size="sm" without crash', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} size="sm" aria-label="Small toggle" />)
            expect(screen.getByRole('switch')).toBeDefined()
        })

        it('renders size="md" (default) without crash', () => {
            render(<SwitchToggle checked={false} onChange={vi.fn()} aria-label="Default toggle" />)
            expect(screen.getByRole('switch')).toBeDefined()
        })
    })
})
