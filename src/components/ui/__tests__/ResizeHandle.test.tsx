/**
 * ResizeHandle.test.tsx
 *
 * T1.4: Verify that the ResizeHandle has z-50 applied so it renders above
 * React Flow's pane layer and pointer events reach the drag handle.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ResizeHandle } from '../ResizeHandle'

describe('ResizeHandle', () => {
    // T1.4 — z-index is z-50 (above React Flow's pane layer at z-4/z-5)
    it('T1.4: applies z-50 class so the handle renders above React Flow pane', () => {
        const onDrag = vi.fn()
        const { container } = render(<ResizeHandle onDrag={onDrag} />)
        const handle = container.firstElementChild as HTMLElement
        expect(handle).not.toBeNull()
        expect(handle.className).toContain('z-50')
    })

    // T1.4 — hit area is at least 24px wide (w-6 = 24px, meets WCAG 2.5.5)
    it('T1.4: hit area is at least 24px wide (w-6)', () => {
        const onDrag = vi.fn()
        const { container } = render(<ResizeHandle onDrag={onDrag} />)
        const handle = container.firstElementChild as HTMLElement
        expect(handle.className).toContain('w-6')
    })

    // T1.4 — mousedown starts drag (document listeners attached)
    it('T1.4: fires onDrag after mousedown+mousemove sequence', () => {
        const onDrag = vi.fn()
        const { container } = render(<ResizeHandle onDrag={onDrag} />)
        const handle = container.firstElementChild as HTMLElement

        // Simulate drag: mousedown on the handle then mousemove on document
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100 }))
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120 }))
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 120 }))

        // onDrag should have been called with delta 20 (120 - 100)
        expect(onDrag).toHaveBeenCalledWith(20)
    })
})
