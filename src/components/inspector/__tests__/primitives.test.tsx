/**
 * primitives.test.tsx
 *
 * ARIA accessibility tests for inspector primitive components.
 * Covers: Accordion, TokenAutocomplete, ColorPickerSwatch, PopoverPicker.
 *
 * CompactSelect uses a native <select> element which is natively accessible
 * and does not require ARIA additions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React, { useRef } from 'react'
import {
    Accordion,
    TokenAutocomplete,
    ColorPickerSwatch,
    PopoverPicker,
} from '../primitives'

// ── Accordion ─────────────────────────────────────────────────────────────────

describe('Accordion', () => {
    it('renders trigger button with aria-expanded=true when open by default', () => {
        render(
            <Accordion title="Section A">
                <span>content</span>
            </Accordion>
        )
        const btn = screen.getByRole('button', { name: /Section A/i })
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('renders trigger button with aria-expanded=false when defaultOpen=false', () => {
        render(
            <Accordion title="Closed" defaultOpen={false}>
                <span>hidden content</span>
            </Accordion>
        )
        const btn = screen.getByRole('button', { name: /Closed/i })
        expect(btn.getAttribute('aria-expanded')).toBe('false')
    })

    it('toggles aria-expanded when clicked', () => {
        render(
            <Accordion title="Toggle Me">
                <span>content</span>
            </Accordion>
        )
        const btn = screen.getByRole('button', { name: /Toggle Me/i })
        expect(btn.getAttribute('aria-expanded')).toBe('true')

        fireEvent.click(btn)
        expect(btn.getAttribute('aria-expanded')).toBe('false')

        fireEvent.click(btn)
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('trigger aria-controls matches the panel id', () => {
        render(
            <Accordion title="Linked">
                <span>panel content</span>
            </Accordion>
        )
        const btn = screen.getByRole('button', { name: /Linked/i })
        const panelId = btn.getAttribute('aria-controls')
        expect(panelId).toBeTruthy()

        const panel = document.getElementById(panelId!)
        expect(panel).not.toBeNull()
    })

    it('panel has role=region and is labelled by the trigger', () => {
        render(
            <Accordion title="Labelled Panel">
                <span>inside</span>
            </Accordion>
        )
        const region = screen.getByRole('region')
        expect(region).toBeDefined()

        const btn = screen.getByRole('button', { name: /Labelled Panel/i })
        const labelledBy = region.getAttribute('aria-labelledby')
        expect(labelledBy).toBe(btn.id)
    })

    it('panel is not in the DOM when closed', () => {
        render(
            <Accordion title="Hidden" defaultOpen={false}>
                <span>hidden content</span>
            </Accordion>
        )
        expect(screen.queryByRole('region')).toBeNull()
    })
})

// ── TokenAutocomplete ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
    { label: 'color.brand.primary', tailwindClass: 'bg-brand-primary', colorHex: '#0066ff' },
    { label: 'color.brand.secondary', tailwindClass: 'bg-brand-secondary', colorHex: '#7c3aed' },
]

describe('TokenAutocomplete', () => {
    it('renders the input with role=combobox', () => {
        render(
            <TokenAutocomplete
                suggestions={[]}
                value=""
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox')
        expect(input).toBeDefined()
    })

    it('input has aria-expanded=false when no value', () => {
        render(
            <TokenAutocomplete
                suggestions={[]}
                value=""
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox')
        expect(input.getAttribute('aria-expanded')).toBe('false')
    })

    it('input has aria-autocomplete=list', () => {
        render(
            <TokenAutocomplete
                suggestions={[]}
                value=""
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox')
        expect(input.getAttribute('aria-autocomplete')).toBe('list')
    })

    it('input has aria-controls pointing to the listbox', () => {
        render(
            <TokenAutocomplete
                suggestions={SUGGESTIONS}
                value="brand"
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox')
        const listboxId = input.getAttribute('aria-controls')
        expect(listboxId).toBeTruthy()
    })

    it('listbox appears with role=listbox when suggestions exist and value non-empty', async () => {
        render(
            <TokenAutocomplete
                suggestions={SUGGESTIONS}
                value="brand"
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeDefined()
        })
    })

    it('each suggestion has role=option and aria-selected', async () => {
        render(
            <TokenAutocomplete
                suggestions={SUGGESTIONS}
                value="brand"
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        await waitFor(() => {
            const options = screen.getAllByRole('option')
            expect(options).toHaveLength(2)
            options.forEach((opt) => {
                expect(opt.hasAttribute('aria-selected')).toBe(true)
            })
        })
    })

    it('aria-activedescendant is set when arrow-keying through options', async () => {
        render(
            <TokenAutocomplete
                suggestions={SUGGESTIONS}
                value="brand"
                onChange={vi.fn()}
                onCommit={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox')
        fireEvent.keyDown(input, { key: 'ArrowDown' })

        await waitFor(() => {
            const activeDescent = input.getAttribute('aria-activedescendant')
            expect(activeDescent).toBeTruthy()
        })
    })
})

// ── ColorPickerSwatch ─────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
    { id: 1, label: 'Brand Blue', value: '#0066ff', hex: '#0066ff' },
]

describe('ColorPickerSwatch', () => {
    it('renders trigger with aria-label describing the color', () => {
        render(
            <ColorPickerSwatch
                colorHex="#0066ff"
                activeTokenDisplay="Brand Blue"
                options={COLOR_OPTIONS}
                onSelect={vi.fn()}
            />
        )
        const trigger = screen.getByRole('button', { name: /Color: Brand Blue/i })
        expect(trigger).toBeDefined()
    })

    it('trigger has aria-expanded=false when closed', () => {
        render(
            <ColorPickerSwatch
                colorHex="#0066ff"
                activeTokenDisplay="Brand Blue"
                options={COLOR_OPTIONS}
                onSelect={vi.fn()}
            />
        )
        const trigger = screen.getByRole('button', { name: /Color:/i })
        expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('trigger has aria-expanded=true after click', () => {
        render(
            <ColorPickerSwatch
                colorHex="#0066ff"
                activeTokenDisplay="Brand Blue"
                options={COLOR_OPTIONS}
                onSelect={vi.fn()}
            />
        )
        const trigger = screen.getByRole('button', { name: /Color:/i })
        fireEvent.click(trigger)
        expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })

    it('trigger has aria-haspopup=dialog', () => {
        render(
            <ColorPickerSwatch
                colorHex=""
                activeTokenDisplay=""
                options={[]}
                onSelect={vi.fn()}
            />
        )
        const trigger = screen.getByRole('button', { name: /Color: none/i })
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    })
})

// ── PopoverPicker ─────────────────────────────────────────────────────────────

/**
 * PopoverPicker defers portal rendering until triggerRef.current is set
 * (it returns null if triggerRef.current is null). In jsdom the ref is
 * assigned on the first commit, so we need a controlled open/close cycle
 * after mount to trigger a re-render with the ref populated.
 */
function PopoverWrapper() {
    const ref = useRef<HTMLButtonElement>(null)
    const [isOpen, setIsOpen] = React.useState(false)
    return (
        <>
            <button ref={ref} type="button" onClick={() => setIsOpen(true)}>Trigger</button>
            <PopoverPicker isOpen={isOpen} onClose={() => setIsOpen(false)} triggerRef={ref}>
                <span>Popover content</span>
            </PopoverPicker>
        </>
    )
}

describe('PopoverPicker', () => {
    it('renders nothing before the trigger is clicked', () => {
        render(<PopoverWrapper />)
        expect(document.querySelector('[role="dialog"]')).toBeNull()
    })

    it('renders with role=dialog after the trigger opens the popover', async () => {
        render(<PopoverWrapper />)
        fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
        await waitFor(() => {
            const dialog = document.querySelector('[role="dialog"]')
            expect(dialog).not.toBeNull()
        })
    })
})
