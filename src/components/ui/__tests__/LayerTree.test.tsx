/**
 * LayerTree.test.tsx — src/components/ui/__tests__/LayerTree.test.tsx
 *
 * Tests for the AST layer hierarchy panel.
 *
 * Covers:
 *   - Empty state
 *   - Root / nested layer rendering
 *   - Row click: setSelectedNode + setActiveSelection
 *   - Truncated bridge-id display (#shortId)
 *   - Tag-colour mapping (button=emerald, input=amber, h1=rose)
 *   - Selected-row indigo styling
 *   - Jump-to-node button (Code2 icon) interaction
 *   - Layer rows for nodes with a label value set
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayerTree } from '../LayerTree'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { VisualLayer } from '../../../core/ast-parser'

// ── Fixtures ──────────────────────────────────────────────────────────────────

// VisualLayer shape: { id, label, className?, children, type? }
// The LayerRow component reads: const tagLabel = layer.type ?? layer.label
const mockTree: VisualLayer[] = [
    {
        id: 'abc12345-full-id',
        label: 'div',
        type: 'div',
        children: [
            {
                id: 'def67890-full-id',
                label: 'button',
                type: 'button',
                children: [],
            },
        ],
    },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LayerTree', () => {
    describe('empty state', () => {
        it('shows "No layers detected" when visualTree is empty', () => {
            useEditorStore.setState({ visualTree: [] })
            render(<LayerTree />)
            expect(screen.getByText(/No layers detected/i)).toBeDefined()
        })
    })

    describe('layer rendering', () => {
        beforeEach(() => {
            useEditorStore.setState({ visualTree: mockTree })
        })

        it('renders root layer tag names', () => {
            render(<LayerTree />)
            // The root `div` label should appear at least once
            expect(screen.getAllByText('div').length).toBeGreaterThanOrEqual(1)
        })

        it('renders nested children tag names', () => {
            render(<LayerTree />)
            expect(screen.getByText('button')).toBeDefined()
        })

        it('shows the truncated bridge-id as #<first-8-chars>', () => {
            render(<LayerTree />)
            // 'abc12345-full-id'.slice(0, 8) === 'abc12345'
            expect(screen.getByText('#abc12345')).toBeDefined()
        })

        it('renders a row for each node, including deeply nested children', () => {
            const deepTree: VisualLayer[] = [
                {
                    id: 'root0001-full-id',
                    label: 'section',
                    type: 'section',
                    children: [
                        {
                            id: 'child001-full-id',
                            label: 'span',
                            type: 'span',
                            children: [],
                        },
                    ],
                },
            ]
            useEditorStore.setState({ visualTree: deepTree })
            render(<LayerTree />)
            expect(screen.getByText('section')).toBeDefined()
            expect(screen.getByText('span')).toBeDefined()
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
            // Click the root div row (first occurrence)
            fireEvent.click(screen.getAllByText('div')[0])
            expect(setSelectedNode).toHaveBeenCalledWith('abc12345-full-id')
        })

        it('calls canvasStore.setActiveSelection with the correct ID on row click', () => {
            const setActiveSelection = vi.fn()
            useCanvasStore.setState({ setActiveSelection })

            render(<LayerTree />)
            fireEvent.click(screen.getAllByText('div')[0])
            expect(setActiveSelection).toHaveBeenCalledWith('abc12345-full-id')
        })
    })

    describe('tag colour classes', () => {
        it('applies emerald colour class to button tags', () => {
            useEditorStore.setState({ visualTree: mockTree })
            render(<LayerTree />)

            const buttonLabel = screen.getByText('button')
            expect(buttonLabel.className).toContain('text-emerald-400')
        })

        it('applies amber colour class to input tags', () => {
            const treeWithInput: VisualLayer[] = [
                {
                    id: 'inp00001-full-id',
                    label: 'input',
                    type: 'input',
                    children: [],
                },
            ]
            useEditorStore.setState({ visualTree: treeWithInput })
            render(<LayerTree />)

            const inputLabel = screen.getByText('input')
            expect(inputLabel.className).toContain('text-amber-400')
        })

        it('applies rose colour class to h1 tags', () => {
            const treeWithH1: VisualLayer[] = [
                {
                    id: 'h1000001-full-id',
                    label: 'h1',
                    type: 'h1',
                    children: [],
                },
            ]
            useEditorStore.setState({ visualTree: treeWithH1 })
            render(<LayerTree />)

            const h1Label = screen.getByText('h1')
            expect(h1Label.className).toContain('text-rose-400')
        })
    })

    describe('selected row styling', () => {
        it('applies indigo styling to the currently selected row', () => {
            useEditorStore.setState({
                visualTree: mockTree,
                selectedNodeId: 'abc12345-full-id',
            })
            render(<LayerTree />)

            const row = document.querySelector('[data-layer-id="abc12345-full-id"]')
            expect(row).not.toBeNull()
            expect(row?.className).toContain('bg-indigo-600/20')
        })
    })

    describe('jump-to-node button', () => {
        it('calls setSelectedNode when the Code2 icon button is clicked', () => {
            const setSelectedNode = vi.fn()
            useEditorStore.setState({
                visualTree: mockTree,
                setSelectedNode,
            })

            render(<LayerTree />)

            // All "Focus node in inspector" buttons (one per row)
            const jumpButtons = screen.getAllByTitle('Focus node in inspector')
            expect(jumpButtons.length).toBeGreaterThanOrEqual(1)

            // Click the first (root div) jump button
            fireEvent.click(jumpButtons[0])
            expect(setSelectedNode).toHaveBeenCalledWith('abc12345-full-id')
        })
    })
})
