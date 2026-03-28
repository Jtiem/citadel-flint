/**
 * PropertiesPanel.test.tsx — OPP-4
 *
 * Tests for the PropertiesPanel component's empty state (nothing selected)
 * and the selected-layer path. PropertiesPanel reads from editorStore
 * (selectedNodeId, visualTree) and canvasStore (activeSelection).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PropertiesPanel } from '../PropertiesPanel'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { VisualLayer } from '../../../core/ast-parser'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLayer(overrides: Partial<VisualLayer> = {}): VisualLayer {
    return {
        id: 'node-1',
        tagName: 'div',
        className: 'flex items-center',
        line: 5,
        children: [],
        props: {},
        ...overrides,
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PropertiesPanel', () => {
    // 1. Shows empty state when nothing is selected
    it('shows empty state copy when no node is selected', () => {
        // Both stores have null selection by default (resetAllStores in setup)
        render(<PropertiesPanel />)
        expect(screen.getByText(/Click any element in the preview to inspect it/)).toBeDefined()
    })

    // 2. Empty state does not show when a node is selected and present in tree
    it('does not show empty state when a node is selected', () => {
        const layer = makeLayer({ id: 'node-abc', tagName: 'button' })
        useEditorStore.setState({ selectedNodeId: 'node-abc', visualTree: [layer] })
        render(<PropertiesPanel />)
        expect(screen.queryByText(/Click any element in the preview to inspect it/)).toBeNull()
    })

    // 3. Empty state when selectedNodeId is set but node not found in tree
    it('shows empty state when selectedNodeId refers to a node not in visualTree', () => {
        useEditorStore.setState({ selectedNodeId: 'ghost-node', visualTree: [] })
        render(<PropertiesPanel />)
        expect(screen.getByText(/Click any element in the preview to inspect it/)).toBeDefined()
    })

    // 4. Canvas activeSelection overrides editor selectedNodeId
    it('uses canvasStore activeSelection over editorStore selectedNodeId', () => {
        const layer = makeLayer({ id: 'canvas-node', tagName: 'span' })
        // Editor says null, canvas says canvas-node
        useEditorStore.setState({ selectedNodeId: null, visualTree: [layer] })
        useCanvasStore.setState({ activeSelection: 'canvas-node' } as Parameters<typeof useCanvasStore.setState>[0])
        render(<PropertiesPanel />)
        // Should show the properties for canvas-node, not the empty state
        expect(screen.queryByText(/Click any element in the preview to inspect it/)).toBeNull()
    })

    // 5. Shows tag name header when a node is selected
    it('renders the tagName in the header when a node is selected', () => {
        const layer = makeLayer({ id: 'node-h1', tagName: 'h1', line: 12 })
        useEditorStore.setState({ selectedNodeId: 'node-h1', visualTree: [layer] })
        render(<PropertiesPanel />)
        expect(screen.getByText('h1')).toBeDefined()
    })
})
