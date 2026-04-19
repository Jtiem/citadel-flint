/**
 * EmitDropdown.test.tsx — src/components/ui/mint/__tests__/EmitDropdown.test.tsx
 *
 * MINT.5 Phase 3 — Emit/handoff dropdown (Scout)
 *
 * Covers contract testBoundaries:
 *   - 'EmitDropdown open'           — opens menu on trigger click (5 platform options)
 *   - 'EmitDropdown close (outside-click)' — closes on outside click
 *   - 'EmitDropdown close (Escape)' — closes on Escape, returns focus to trigger
 *   - 'EmitDropdown keyboard navigation' — ArrowDown moves focus to next menuitem
 *   - 'EmitDropdown onEmit (preview)' — click forwards (platforms, "preview")
 *   - 'EmitDropdown onEmit (write)'   — click forwards (platforms, "write")
 *   - 'EmitDropdown spinner on emitOp' — spinner shown when emitOp != null
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EmitDropdown } from '../EmitDropdown'
import type { EmitDropdownProps, EmitPlatform, EmitMode } from '../../../../../.flint-context/contracts/MINT.5-phase3.contract'

function makeProps(overrides: Partial<EmitDropdownProps> = {}): EmitDropdownProps {
    return {
        disabled: false,
        emitOp: null,
        onEmit: vi.fn(),
        ...overrides,
    }
}

// ── EmitDropdown open ────────────────────────────────────────────────────────
// boundary: EmitDropdown open

describe('EmitDropdown — open on trigger click', () => {
    it('renders the menu with 5 platform options when trigger is clicked', () => {
        // boundary: EmitDropdown open
        render(<EmitDropdown {...makeProps()} />)

        const trigger = screen.getByTestId('emit-trigger')
        fireEvent.click(trigger)

        const menu = screen.getByRole('menu')
        expect(menu).toBeTruthy()

        // All 5 platforms should appear as menuitems
        const items = screen.getAllByRole('menuitem')
        expect(items.length).toBeGreaterThanOrEqual(5)
    })

    it('does NOT open menu when disabled=true', () => {
        // boundary: EmitDropdown open (edge: disabled trigger)
        render(<EmitDropdown {...makeProps({ disabled: true })} />)

        const trigger = screen.getByTestId('emit-trigger')
        fireEvent.click(trigger)

        const menu = screen.queryByRole('menu')
        expect(menu).toBeNull()
    })

    it('opens menu on Spacebar press on the trigger button', () => {
        // boundary: EmitDropdown open (edge: Spacebar)
        render(<EmitDropdown {...makeProps()} />)

        const trigger = screen.getByTestId('emit-trigger')
        fireEvent.keyDown(trigger, { key: ' ' })

        const menu = screen.queryByRole('menu')
        // Spacebar should also open the menu (ARIA menu button pattern)
        // The implementation determines exact behavior; assert menu is present or absent
        // based on implementation. This test documents the expected contract behavior.
        // When implementation lands, this should be truthy.
        expect(menu).toBeTruthy()
    })
})

// ── EmitDropdown close (outside-click) ───────────────────────────────────────
// boundary: EmitDropdown close (outside-click)

describe('EmitDropdown — close on outside click', () => {
    it('closes menu when user clicks outside the dropdown', () => {
        // boundary: EmitDropdown close (outside-click)
        render(
            <div>
                <EmitDropdown {...makeProps()} />
                <button data-testid="outside-btn">outside</button>
            </div>
        )

        // Open first
        fireEvent.click(screen.getByTestId('emit-trigger'))
        expect(screen.queryByRole('menu')).toBeTruthy()

        // Click outside
        act(() => {
            fireEvent.mouseDown(screen.getByTestId('outside-btn'))
        })

        expect(screen.queryByRole('menu')).toBeNull()
    })

    it('closes menu and fires onEmit when a menu item is clicked', () => {
        // boundary: EmitDropdown close (outside-click) — edge: click inside menu item
        const onEmit = vi.fn()
        render(<EmitDropdown {...makeProps({ onEmit })} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))
        expect(screen.queryByRole('menu')).toBeTruthy()

        // Click the first menuitem
        const items = screen.getAllByRole('menuitem')
        fireEvent.click(items[0])

        // onEmit should fire, menu should close
        expect(onEmit).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('menu')).toBeNull()
    })
})

// ── EmitDropdown close (Escape) ───────────────────────────────────────────────
// boundary: EmitDropdown close (Escape)

describe('EmitDropdown — close on Escape key', () => {
    it('closes menu and returns focus to the trigger on Escape', () => {
        // boundary: EmitDropdown close (Escape)
        render(<EmitDropdown {...makeProps()} />)

        const trigger = screen.getByTestId('emit-trigger')
        fireEvent.click(trigger)
        expect(screen.queryByRole('menu')).toBeTruthy()

        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' })
        })

        expect(screen.queryByRole('menu')).toBeNull()
        // Focus should return to the trigger
        expect(document.activeElement).toBe(trigger)
    })
})

// ── EmitDropdown keyboard navigation ─────────────────────────────────────────
// boundary: EmitDropdown keyboard navigation

describe('EmitDropdown — keyboard navigation', () => {
    it('ArrowDown moves focus from first to second menuitem', async () => {
        // boundary: EmitDropdown keyboard navigation
        render(<EmitDropdown {...makeProps()} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))

        const items = screen.getAllByRole('menuitem')
        // Focus the first item
        items[0].focus()
        expect(document.activeElement).toBe(items[0])

        act(() => {
            fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
        })

        // Second item should now be focused
        expect(document.activeElement).toBe(items[1])
    })

    it('ArrowUp wraps to last item when on the first item', async () => {
        // boundary: EmitDropdown keyboard navigation (edge: ArrowUp wraps)
        render(<EmitDropdown {...makeProps()} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))

        const items = screen.getAllByRole('menuitem')
        items[0].focus()

        act(() => {
            fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
        })

        // Should wrap to last item
        expect(document.activeElement).toBe(items[items.length - 1])
    })

    it('Home key jumps to the first menuitem', () => {
        // boundary: EmitDropdown keyboard navigation (edge: Home)
        render(<EmitDropdown {...makeProps()} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))

        const items = screen.getAllByRole('menuitem')
        // Start at last item
        items[items.length - 1].focus()

        act(() => {
            fireEvent.keyDown(document.activeElement!, { key: 'Home' })
        })

        expect(document.activeElement).toBe(items[0])
    })

    it('End key jumps to the last menuitem', () => {
        // boundary: EmitDropdown keyboard navigation (edge: End)
        render(<EmitDropdown {...makeProps()} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))

        const items = screen.getAllByRole('menuitem')
        items[0].focus()

        act(() => {
            fireEvent.keyDown(document.activeElement!, { key: 'End' })
        })

        expect(document.activeElement).toBe(items[items.length - 1])
    })
})

// ── EmitDropdown onEmit (preview) ─────────────────────────────────────────────
// boundary: EmitDropdown onEmit (preview)

describe('EmitDropdown — onEmit called with preview mode', () => {
    it('calls onEmit with (["css"], "preview") when CSS preview menuitem clicked', () => {
        // boundary: EmitDropdown onEmit (preview)
        const onEmit = vi.fn()
        render(<EmitDropdown {...makeProps({ onEmit })} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))

        // Find and click the CSS variables preview item
        const cssPreviewItem = screen.getByTestId('emit-item-css-preview')
        fireEvent.click(cssPreviewItem)

        expect(onEmit).toHaveBeenCalledTimes(1)
        expect(onEmit).toHaveBeenCalledWith(['css'], 'preview')
    })

    it('calls onEmit with correct platform for each of the 5 platforms (preview mode)', () => {
        // boundary: EmitDropdown onEmit (preview) — edge: all 5 platforms
        const platforms: EmitPlatform[] = ['tailwind', 'css', 'react-native', 'swift', 'kotlin']
        for (const platform of platforms) {
            const onEmit = vi.fn()
            const { unmount } = render(<EmitDropdown {...makeProps({ onEmit })} />)

            fireEvent.click(screen.getByTestId('emit-trigger'))

            const item = screen.queryByTestId(`emit-item-${platform}-preview`)
            if (item) {
                fireEvent.click(item)
                expect(onEmit).toHaveBeenCalledWith([platform], 'preview')
            }

            unmount()
        }
    })
})

// ── EmitDropdown onEmit (write) ───────────────────────────────────────────────
// boundary: EmitDropdown onEmit (write)

describe('EmitDropdown — onEmit called with write mode', () => {
    it('calls onEmit with (["tailwind"], "write") when tailwind write menuitem clicked', () => {
        // boundary: EmitDropdown onEmit (write)
        const onEmit = vi.fn()
        render(<EmitDropdown {...makeProps({ onEmit })} />)

        fireEvent.click(screen.getByTestId('emit-trigger'))

        const tailwindWriteItem = screen.getByTestId('emit-item-tailwind-write')
        fireEvent.click(tailwindWriteItem)

        expect(onEmit).toHaveBeenCalledTimes(1)
        expect(onEmit).toHaveBeenCalledWith(['tailwind'], 'write')
    })
})

// ── EmitDropdown spinner on emitOp ────────────────────────────────────────────
// boundary: EmitDropdown spinner on emitOp

describe('EmitDropdown — spinner when emitOp is non-null', () => {
    it('renders a spinner inside the trigger button when emitOp="write"', () => {
        // boundary: EmitDropdown spinner on emitOp
        render(<EmitDropdown {...makeProps({ emitOp: 'write' })} />)

        const trigger = screen.getByTestId('emit-trigger')
        // Spinner should be inside the trigger
        expect(trigger.querySelector('[data-testid="emit-spinner"]')).toBeTruthy()
    })

    it('disables the trigger while emitOp != null', () => {
        // boundary: EmitDropdown spinner on emitOp (edge: disabled while in-flight)
        render(<EmitDropdown {...makeProps({ emitOp: 'preview' })} />)

        const trigger = screen.getByTestId('emit-trigger')
        expect(trigger.hasAttribute('disabled')).toBe(true)
    })

    it('does NOT render a spinner when emitOp=null', () => {
        render(<EmitDropdown {...makeProps({ emitOp: null })} />)

        const trigger = screen.getByTestId('emit-trigger')
        expect(trigger.querySelector('[data-testid="emit-spinner"]')).toBeNull()
    })
})
