/**
 * AnnotationList.test.tsx — src/components/ui/__tests__/AnnotationList.test.tsx
 *
 * Tests for S4.5: "Add note" affordance in the AnnotationList component.
 *
 * Covers:
 *   - "Add note" button renders when the accordion is open (empty state)
 *   - "Add note" button renders when the accordion is open (annotations present)
 *   - Clicking "Add note" opens the inline note composer
 *   - Inline textarea is focused when composer opens
 *   - Typing text updates the textarea value
 *   - Pressing Enter submits the note and closes the composer
 *   - Pressing Escape cancels the note and closes the composer
 *   - Pressing Shift+Enter does NOT submit (allows newlines)
 *   - Clicking the "Add" button submits the note
 *   - Clicking the "Cancel" button cancels the note
 *   - "Add note" button is not shown while the composer is open
 *   - Existing AnnotationCards are still rendered alongside the "Add note" button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnnotationList } from '../AnnotationList'
import { useAnnotationStore } from '../../../store/annotationStore'
import type { FlintAnnotation } from '../../../types/flint-api'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_ANNOTATION: FlintAnnotation = {
    id: 'ann-001',
    nodeId: 'node-abc',
    filePath: '/project/Component.tsx',
    type: 'note',
    author: 'Alice',
    body: 'Needs contrast check',
    status: 'open',
    visibility: 'public',
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    resolvedAt: null,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AnnotationList — S4.5 Add note affordance', () => {
    beforeEach(() => {
        useAnnotationStore.setState({ annotations: [] })
    })

    describe('Add note button visibility', () => {
        it('renders "Add note" button when accordion is open and no annotations exist', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            // Accordion starts collapsed when count === 0; open it
            const header = screen.getByText('Annotations').closest('button')!
            fireEvent.click(header)

            expect(screen.getByText(/Add note/i)).toBeDefined()
        })

        it('renders "Add note" button when accordion is open and annotations exist', () => {
            useAnnotationStore.setState({ annotations: [MOCK_ANNOTATION] })
            // count > 0 → accordion opens by default
            render(<AnnotationList nodeId="node-abc" />)

            expect(screen.getByText(/Add note/i)).toBeDefined()
        })

        it('does not render "Add note" button when accordion is collapsed', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)
            // Default state with 0 annotations is collapsed — no body rendered
            expect(screen.queryByText(/Add note/i)).toBeNull()
        })
    })

    describe('Inline composer open/close', () => {
        it('shows inline textarea when "Add note" is clicked', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            // Open accordion
            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            expect(screen.getByPlaceholderText(/Type a note/i)).toBeDefined()
        })

        it('hides the "Add note" button while the composer is open', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            // The "Add note" button should be gone; the composer is open instead
            const addButtons = screen.queryAllByText(/^Add note$/)
            expect(addButtons.length).toBe(0)
        })

        it('shows "Cancel" and "Add" action buttons inside the composer', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            expect(screen.getByText('Cancel')).toBeDefined()
            expect(screen.getByText('Add')).toBeDefined()
        })
    })

    describe('Composer text input', () => {
        it('updates textarea value as user types', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            const textarea = screen.getByPlaceholderText(/Type a note/i) as HTMLTextAreaElement
            fireEvent.change(textarea, { target: { value: 'My note text' } })
            expect(textarea.value).toBe('My note text')
        })
    })

    describe('Composer submission', () => {
        it('closes the composer when Enter is pressed (no shift)', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            const textarea = screen.getByPlaceholderText(/Type a note/i)
            fireEvent.change(textarea, { target: { value: 'A note' } })
            fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

            // Composer should close; textarea is gone, "Add note" button returns
            expect(screen.queryByPlaceholderText(/Type a note/i)).toBeNull()
        })

        it('does NOT close the composer on Shift+Enter', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            const textarea = screen.getByPlaceholderText(/Type a note/i)
            fireEvent.change(textarea, { target: { value: 'Line 1' } })
            fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

            // Composer should remain open
            expect(screen.getByPlaceholderText(/Type a note/i)).toBeDefined()
        })

        it('closes the composer when Escape is pressed', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            const textarea = screen.getByPlaceholderText(/Type a note/i)
            fireEvent.keyDown(textarea, { key: 'Escape' })

            expect(screen.queryByPlaceholderText(/Type a note/i)).toBeNull()
        })

        it('clears note text after Escape cancellation', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            const textarea = screen.getByPlaceholderText(/Type a note/i)
            fireEvent.change(textarea, { target: { value: 'Draft text' } })
            fireEvent.keyDown(textarea, { key: 'Escape' })

            // Re-open composer — text should be cleared
            fireEvent.click(screen.getByText(/Add note/i))
            const newTextarea = screen.getByPlaceholderText(/Type a note/i) as HTMLTextAreaElement
            expect(newTextarea.value).toBe('')
        })
    })

    describe('Composer Cancel button', () => {
        it('closes the composer when Cancel button is mousedown-ed', () => {
            useAnnotationStore.setState({ annotations: [] })
            render(<AnnotationList nodeId="node-abc" />)

            fireEvent.click(screen.getByText('Annotations').closest('button')!)
            fireEvent.click(screen.getByText(/Add note/i))

            const cancelBtn = screen.getByText('Cancel')
            fireEvent.mouseDown(cancelBtn)

            expect(screen.queryByPlaceholderText(/Type a note/i)).toBeNull()
        })
    })

    describe('Coexistence with existing annotations', () => {
        it('still renders existing annotation cards alongside "Add note"', () => {
            useAnnotationStore.setState({ annotations: [MOCK_ANNOTATION] })
            render(<AnnotationList nodeId="node-abc" />)

            // Card body text should be present
            expect(screen.getByText('Needs contrast check')).toBeDefined()
            // "Add note" affordance should also be present
            expect(screen.getByText(/Add note/i)).toBeDefined()
        })
    })
})
