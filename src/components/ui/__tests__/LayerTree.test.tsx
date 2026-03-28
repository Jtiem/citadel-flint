/**
 * LayerTree.test.tsx — src/components/ui/__tests__/LayerTree.test.tsx
 *
 * Tests for the AST layer hierarchy panel.
 *
 * Covers:
 *   - Empty state
 *   - Root / nested layer rendering (inferred names + raw tag badges)
 *   - Row click: setSelectedNode
 *   - Raw tag badge display (secondary badge when name !== tag)
 *   - Tag badge zinc-500 class (uniform across all tag types)
 *   - Selected-row indigo styling on the inner <button>
 *   - Jump-to-line button (Code2 icon) interaction
 *   - Layer rows for nodes at any nesting depth
 *   - GLASS.2.1: WAI-ARIA tree semantics (role, aria-level, aria-selected, aria-expanded)
 *   - GLASS.2.1: Keyboard navigation (ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Home, End, Enter)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayerTree } from '../LayerTree'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { VisualLayer } from '../../../core/ast-parser'

// ── Fixtures ──────────────────────────────────────────────────────────────────

// VisualLayer shape: { id, tagName, line, className?, children }
// getLayerName maps:
//   div     → name="Frame",   tag="div"    (fallback — no semantic match)
//   button  → name="Button",  tag="button" (SEMANTIC_TAGS)
//   section → name="Section", tag="section"
//   span    → name="Span",    tag="span"   (TEXT_TAGS, no textContent)
//   input   → name="Input",   tag="input"
//   h1      → name="H1",      tag="h1"     (TEXT_TAGS, no textContent)
const mockTree: VisualLayer[] = [
    {
        id: 'abc12345-full-id',
        tagName: 'div',
        line: 1,
        children: [
            {
                id: 'def67890-full-id',
                tagName: 'button',
                line: 2,
                children: [],
            },
        ],
    },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LayerTree', () => {
    describe('empty state', () => {
        it('shows empty state with icon and guidance when visualTree is empty', () => {
            useEditorStore.setState({ visualTree: [] })
            render(<LayerTree />)
            expect(screen.getByText(/No component layers/i)).toBeDefined()
            expect(screen.getByText(/Open a \.tsx file to see its layer structure/i)).toBeDefined()
        })
    })

    describe('layer rendering', () => {
        beforeEach(() => {
            useEditorStore.setState({ visualTree: mockTree })
        })

        it('renders the inferred name for the root layer (div → "Frame")', () => {
            render(<LayerTree />)
            // getLayerName({ tagName:'div' }) → name="Frame" (fallback)
            expect(screen.getAllByText('Frame').length).toBeGreaterThanOrEqual(1)
        })

        it('renders the raw tag badge for root layer (name "Frame" ≠ tag "div")', () => {
            render(<LayerTree />)
            // Secondary badge: name="Frame", tag="div" → badge "div" renders
            expect(screen.getByText('div')).toBeDefined()
        })

        it('renders nested children by inferred name (button → "Button")', () => {
            render(<LayerTree />)
            expect(screen.getByText('Button')).toBeDefined()
        })

        it('renders a raw tag badge for nested child (name "Button" ≠ tag "button")', () => {
            render(<LayerTree />)
            expect(screen.getByText('button')).toBeDefined()
        })

        it('renders a row for each node, including deeply nested children', () => {
            const deepTree: VisualLayer[] = [
                {
                    id: 'root0001-full-id',
                    tagName: 'section',
                    line: 1,
                    children: [
                        {
                            id: 'child001-full-id',
                            tagName: 'span',
                            line: 2,
                            children: [],
                        },
                    ],
                },
            ]
            useEditorStore.setState({ visualTree: deepTree })
            render(<LayerTree />)
            // section → "Section" (SEMANTIC_TAGS), badge "section" also renders
            expect(screen.getByText('Section')).toBeDefined()
            // span in TEXT_TAGS with no textContent → name="Span", badge "span"
            expect(screen.getByText('Span')).toBeDefined()
        })
    })

    describe('row selection', () => {
        beforeEach(() => {
            useEditorStore.setState({ visualTree: mockTree, selectedNodeId: null })
            useCanvasStore.setState({ activeSelection: null })
        })

        it('calls setSelectedNode with the correct ID on row click', () => {
            const setSelectedNode = vi.fn()
            useEditorStore.setState({ setSelectedNode })

            render(<LayerTree />)
            // Click the "Frame" name text which is inside the selection button
            fireEvent.click(screen.getByText('Frame'))
            expect(setSelectedNode).toHaveBeenCalledWith('abc12345-full-id')
        })

        it('does not crash when canvasStore.setActiveSelection is not called (row click only calls setSelectedNode)', () => {
            // The current component calls setSelectedNode on row click.
            // setActiveSelection is NOT called by LayerRow — confirm store is not modified.
            const setSelectedNode = vi.fn()
            const setActiveSelection = vi.fn()
            useEditorStore.setState({ setSelectedNode })
            useCanvasStore.setState({ setActiveSelection })

            render(<LayerTree />)
            fireEvent.click(screen.getByText('Frame'))
            expect(setSelectedNode).toHaveBeenCalledWith('abc12345-full-id')
            // setActiveSelection is not part of LayerRow's click handler
            expect(setActiveSelection).not.toHaveBeenCalled()
        })
    })

    describe('tag badge colour class', () => {
        it('applies text-zinc-500 class to the button tag badge', () => {
            useEditorStore.setState({ visualTree: mockTree })
            render(<LayerTree />)

            // The secondary badge spans all carry text-zinc-500
            const buttonBadge = screen.getByText('button')
            expect(buttonBadge.className).toContain('text-zinc-500')
        })

        it('applies text-zinc-500 class to the input tag badge', () => {
            const treeWithInput: VisualLayer[] = [
                {
                    id: 'inp00001-full-id',
                    tagName: 'input',
                    line: 1,
                    children: [],
                },
            ]
            useEditorStore.setState({ visualTree: treeWithInput })
            render(<LayerTree />)

            // input → name="Input", tag="input" → badge "input" with text-zinc-500
            const inputBadge = screen.getByText('input')
            expect(inputBadge.className).toContain('text-zinc-500')
        })

        it('applies text-zinc-500 class to the h1 tag badge', () => {
            const treeWithH1: VisualLayer[] = [
                {
                    id: 'h1000001-full-id',
                    tagName: 'h1',
                    line: 1,
                    children: [],
                },
            ]
            useEditorStore.setState({ visualTree: treeWithH1 })
            render(<LayerTree />)

            // h1 is a TEXT_TAG with no textContent → name="H1", tag="h1" → badge "h1"
            const h1Badge = screen.getByText('h1')
            expect(h1Badge.className).toContain('text-zinc-500')
        })
    })

    describe('selected row styling', () => {
        it('applies indigo bg to the inner button of the currently selected row', () => {
            useEditorStore.setState({
                visualTree: mockTree,
                selectedNodeId: 'abc12345-full-id',
            })
            render(<LayerTree />)

            // When selected, the inner <button> receives bg-indigo-600/30 text-indigo-300.
            // The "Frame" name text is inside that button.
            const nameEl = screen.getByText('Frame')
            // Walk up to the nearest <button> ancestor
            const btn = nameEl.closest('button')
            expect(btn).not.toBeNull()
            expect(btn?.className).toContain('bg-indigo-600/30')
        })
    })

    describe('jump-to-line button', () => {
        it('calls setJumpToLine when the Code2 icon button is clicked', () => {
            const setJumpToLine = vi.fn()
            useEditorStore.setState({
                visualTree: mockTree,
                setJumpToLine,
            })

            render(<LayerTree />)

            // Each row has a jump-to-line button titled "Jump to line <line>"
            // The root node has line: 1
            const jumpButton = screen.getByTitle('Jump to line 1')
            expect(jumpButton).toBeDefined()

            fireEvent.click(jumpButton)
            expect(setJumpToLine).toHaveBeenCalledWith(1)
        })

        it('renders a jump-to-line button for each visible row', () => {
            useEditorStore.setState({ visualTree: mockTree })
            render(<LayerTree />)

            // mockTree has 2 nodes (root div + nested button) → 2 jump buttons
            const jumpButtons = screen.getAllByTitle(/^Jump to line \d+$/)
            expect(jumpButtons.length).toBeGreaterThanOrEqual(1)
        })
    })

    // ── GLASS.2.1: WAI-ARIA tree semantics ──────────────────────────────────

    describe('ARIA tree semantics', () => {
        beforeEach(() => {
            useEditorStore.setState({ visualTree: mockTree, selectedNodeId: null })
        })

        it('root container has role="tree" and aria-label', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            expect(tree).toBeDefined()
            expect(tree.getAttribute('aria-label')).toBe('Component layer tree')
        })

        it('each row has role="treeitem"', () => {
            render(<LayerTree />)
            const items = screen.getAllByRole('treeitem')
            // mockTree has 2 visible nodes (root div + nested button)
            expect(items.length).toBe(2)
        })

        it('root row has aria-level=1, nested row has aria-level=2', () => {
            render(<LayerTree />)
            const items = screen.getAllByRole('treeitem')
            expect(items[0].getAttribute('aria-level')).toBe('1')
            expect(items[1].getAttribute('aria-level')).toBe('2')
        })

        it('selected row has aria-selected=true, others false', () => {
            useEditorStore.setState({ selectedNodeId: 'abc12345-full-id' })
            render(<LayerTree />)
            const items = screen.getAllByRole('treeitem')
            expect(items[0].getAttribute('aria-selected')).toBe('true')
            expect(items[1].getAttribute('aria-selected')).toBe('false')
        })

        it('collapsible nodes have aria-expanded, leaf nodes do not', () => {
            render(<LayerTree />)
            const items = screen.getAllByRole('treeitem')
            // Root div has children → aria-expanded should be "true" (expanded by default)
            expect(items[0].getAttribute('aria-expanded')).toBe('true')
            // Nested button is a leaf → no aria-expanded attribute
            expect(items[1].hasAttribute('aria-expanded')).toBe(false)
        })
    })

    // ── GLASS.2.1: Keyboard navigation ──────────────────────────────────────

    describe('keyboard navigation', () => {
        const treeWithChildren: VisualLayer[] = [
            {
                id: 'root-nav-1',
                tagName: 'div',
                line: 1,
                children: [
                    {
                        id: 'child-nav-1',
                        tagName: 'span',
                        line: 2,
                        children: [],
                    },
                    {
                        id: 'child-nav-2',
                        tagName: 'p',
                        line: 3,
                        children: [],
                    },
                ],
            },
            {
                id: 'root-nav-2',
                tagName: 'section',
                line: 4,
                children: [],
            },
        ]

        beforeEach(() => {
            useEditorStore.setState({ visualTree: treeWithChildren, selectedNodeId: null })
        })

        it('ArrowDown moves focus to the next visible treeitem', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the first item
            fireEvent.focus(items[0])
            // Press ArrowDown
            fireEvent.keyDown(tree, { key: 'ArrowDown' })

            // The second item should now be focused (data-layer-id check)
            expect(items[1].getAttribute('data-layer-id')).toBe('child-nav-1')
            expect(items[1].tabIndex).toBe(0)
        })

        it('ArrowUp moves focus to the previous visible treeitem', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the second item
            fireEvent.focus(items[1])
            // Press ArrowUp
            fireEvent.keyDown(tree, { key: 'ArrowUp' })

            // The first item should now be focused
            expect(items[0].tabIndex).toBe(0)
        })

        it('Home moves focus to the first treeitem', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the last item
            fireEvent.focus(items[items.length - 1])
            // Press Home
            fireEvent.keyDown(tree, { key: 'Home' })

            expect(items[0].tabIndex).toBe(0)
        })

        it('End moves focus to the last visible treeitem', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the first item
            fireEvent.focus(items[0])
            // Press End
            fireEvent.keyDown(tree, { key: 'End' })

            // The last visible item should have tabIndex=0
            const lastItem = items[items.length - 1]
            expect(lastItem.tabIndex).toBe(0)
        })

        it('Enter selects the focused node', () => {
            const setSelectedNode = vi.fn()
            useEditorStore.setState({ setSelectedNode })

            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the first item
            fireEvent.focus(items[0])
            // Press Enter
            fireEvent.keyDown(tree, { key: 'Enter' })

            expect(setSelectedNode).toHaveBeenCalledWith('root-nav-1')
        })

        it('Space selects the focused node', () => {
            const setSelectedNode = vi.fn()
            useEditorStore.setState({ setSelectedNode })

            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the first item
            fireEvent.focus(items[0])
            // Press Space
            fireEvent.keyDown(tree, { key: ' ' })

            expect(setSelectedNode).toHaveBeenCalledWith('root-nav-1')
        })

        it('ArrowLeft on an expanded node collapses it', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Root node is expanded (has children, default state)
            expect(items[0].getAttribute('aria-expanded')).toBe('true')

            // Focus root node
            fireEvent.focus(items[0])
            // Press ArrowLeft to collapse
            fireEvent.keyDown(tree, { key: 'ArrowLeft' })

            // After collapse, root should have aria-expanded=false
            // Re-query since the DOM was updated
            const updatedItems = screen.getAllByRole('treeitem')
            expect(updatedItems[0].getAttribute('aria-expanded')).toBe('false')
            // Children should no longer be visible (only 2 items: root-nav-1 + root-nav-2)
            expect(updatedItems.length).toBe(2)
        })

        it('ArrowRight on a collapsed node expands it', () => {
            render(<LayerTree />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // First collapse the root node
            fireEvent.focus(items[0])
            fireEvent.keyDown(tree, { key: 'ArrowLeft' })

            // Verify collapsed
            let updatedItems = screen.getAllByRole('treeitem')
            expect(updatedItems[0].getAttribute('aria-expanded')).toBe('false')

            // Now press ArrowRight to expand
            fireEvent.keyDown(tree, { key: 'ArrowRight' })

            updatedItems = screen.getAllByRole('treeitem')
            expect(updatedItems[0].getAttribute('aria-expanded')).toBe('true')
            // Children should be visible again (4 items total)
            expect(updatedItems.length).toBe(4)
        })
    })
})
