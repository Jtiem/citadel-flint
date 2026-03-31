/**
 * Modal.test.tsx
 *
 * Tests for the Modal primitive (S6.3).
 *
 * Covers:
 *   - Renders with role="dialog" and aria-modal="true"
 *   - aria-labelledby matches the title element's id
 *   - Escape key calls onClose (via FocusTrap)
 *   - Close button calls onClose
 *   - Renders children
 *   - Renders footer when provided
 *   - Does not render when isOpen=false
 *   - Backdrop div has aria-hidden="true"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Modal } from '../Modal'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush the setTimeout(0) used by FocusTrap's initial focus. */
async function flushFocusTimer() {
    await act(async () => {
        vi.advanceTimersByTime(1)
    })
}

function renderOpen(overrides?: Partial<Parameters<typeof Modal>[0]>) {
    const onClose = overrides?.onClose ?? vi.fn()
    const props = {
        isOpen: true,
        onClose,
        title: 'Test Modal',
        children: <p>Modal body content</p>,
        ...overrides,
    }
    const result = render(<Modal {...props} />)
    return { onClose, ...result }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Modal', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('visibility', () => {
        it('does not render when isOpen is false', () => {
            render(
                <Modal isOpen={false} onClose={vi.fn()} title="Hidden Modal">
                    <p>content</p>
                </Modal>,
            )
            expect(screen.queryByRole('dialog')).toBeNull()
        })

        it('renders the dialog when isOpen is true', async () => {
            renderOpen()
            await flushFocusTimer()
            expect(screen.getByRole('dialog')).toBeDefined()
        })
    })

    describe('ARIA attributes', () => {
        it('has role="dialog" and aria-modal="true"', async () => {
            renderOpen()
            await flushFocusTimer()
            const dialog = screen.getByRole('dialog')
            expect(dialog.getAttribute('aria-modal')).toBe('true')
        })

        it('aria-labelledby matches the title element id', async () => {
            renderOpen()
            await flushFocusTimer()
            const dialog = screen.getByRole('dialog')
            const labelledById = dialog.getAttribute('aria-labelledby')
            expect(labelledById).toBeTruthy()
            const titleEl = document.getElementById(labelledById!)
            expect(titleEl).toBeTruthy()
            expect(titleEl!.textContent).toBe('Test Modal')
        })

        it('uses the provided titleId for aria-labelledby', async () => {
            renderOpen({ titleId: 'my-custom-title' })
            await flushFocusTimer()
            const dialog = screen.getByRole('dialog')
            expect(dialog.getAttribute('aria-labelledby')).toBe('my-custom-title')
            const titleEl = document.getElementById('my-custom-title')
            expect(titleEl!.textContent).toBe('Test Modal')
        })

        it('backdrop div has aria-hidden="true"', async () => {
            renderOpen()
            await flushFocusTimer()
            // The backdrop is an absolute-positioned sibling inside the outer wrapper.
            // It is the first child of the outermost fixed div (before the FocusTrap).
            const dialog = screen.getByRole('dialog')
            // Walk up: dialog -> FocusTrap div -> outer wrapper
            const outerWrapper = dialog.parentElement?.parentElement
            const backdrop = outerWrapper?.querySelector('[aria-hidden="true"]')
            expect(backdrop?.getAttribute('aria-hidden')).toBe('true')
        })
    })

    describe('content', () => {
        it('renders children', async () => {
            renderOpen({ children: <p>My child content</p> })
            await flushFocusTimer()
            expect(screen.getByText('My child content')).toBeDefined()
        })

        it('renders footer when provided', async () => {
            renderOpen({ footer: <button>Save</button> })
            await flushFocusTimer()
            expect(screen.getByText('Save')).toBeDefined()
        })

        it('does not render footer slot when not provided', async () => {
            renderOpen()
            await flushFocusTimer()
            // No extra border-t element beyond the header border
            expect(screen.queryByText('Save')).toBeNull()
        })

        it('renders the title text in the header', async () => {
            renderOpen({ title: 'Governance Rules' })
            await flushFocusTimer()
            expect(screen.getByText('Governance Rules')).toBeDefined()
        })
    })

    describe('close behaviour', () => {
        it('close button calls onClose', async () => {
            const { onClose } = renderOpen()
            await flushFocusTimer()
            fireEvent.click(screen.getByLabelText('Close'))
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('Escape key calls onClose via FocusTrap', async () => {
            const { onClose } = renderOpen()
            await flushFocusTimer()
            fireEvent.keyDown(document, { key: 'Escape' })
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('close button is hidden when hideCloseButton=true', async () => {
            renderOpen({ hideCloseButton: true })
            await flushFocusTimer()
            expect(screen.queryByLabelText('Close')).toBeNull()
        })
    })

    describe('size prop', () => {
        it('applies max-w-md for size="sm"', async () => {
            renderOpen({ size: 'sm' })
            await flushFocusTimer()
            const dialog = screen.getByRole('dialog')
            expect(dialog.className).toContain('max-w-md')
        })

        it('applies max-w-xl for size="md" (default)', async () => {
            renderOpen()
            await flushFocusTimer()
            const dialog = screen.getByRole('dialog')
            expect(dialog.className).toContain('max-w-xl')
        })

        it('applies max-w-2xl for size="lg"', async () => {
            renderOpen({ size: 'lg' })
            await flushFocusTimer()
            const dialog = screen.getByRole('dialog')
            expect(dialog.className).toContain('max-w-2xl')
        })
    })

    describe('data-testid', () => {
        it('forwards data-testid to the dialog element', async () => {
            renderOpen({ 'data-testid': 'my-modal' })
            await flushFocusTimer()
            expect(screen.getByTestId('my-modal')).toBeDefined()
        })
    })
})
