/**
 * SmartInsert.test.tsx
 *
 * Phase CV2.5+: Smart Insert Context — Position-Aware Drop Targets
 *
 * Tests:
 *   SI-01 — Smart Insert panel renders when isCardDragOver and visualTree exists
 *   SI-02 — Panel does NOT render when no drag is active (no dragEnter yet)
 *   SI-03 — Panel does NOT render when visualTree is empty
 *   SI-04 — Panel shows node tagNames from visualTree
 *   SI-05 — Dropping on a specific node row calls applyBatch with correct targetNodeId
 *   SI-06 — Panel disappears when drag leaves the drop zone
 *   SI-07 — Maximum 10 nodes shown (truncation label for overflow)
 *   SI-08 — Truncation indicator is absent when tree has 10 or fewer nodes
 *   SI-09 — Panel header shows pending component name
 *   SI-10 — Dropping on the preview iframe fallback (not a panel row) still works
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LivePreview } from '../LivePreview'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { VisualLayer } from '../../../core/ast-parser'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Minimal DataTransfer stub for drag events. */
function makeDataTransfer(overrides: Partial<{
    types: string[]
    data: Record<string, string>
}> = {}): DataTransfer {
    const data: Record<string, string> = overrides.data ?? {}
    const types: string[] = overrides.types ?? Object.keys(data)
    return {
        types,
        getData: (type: string) => data[type] ?? '',
        setData: vi.fn(),
        clearData: vi.fn(),
        effectAllowed: 'copy',
        dropEffect: 'copy',
        items: [],
        files: [],
    } as unknown as DataTransfer
}

/** Serialized component card payload matching ComponentCardNode.onDragStart format. */
function makeCardPayload(overrides: Partial<{ name: string; importPath: string; filePath: string }> = {}) {
    return JSON.stringify({
        name: 'Button',
        importPath: '@/components/ui/Button',
        filePath: '/project/src/components/ui/Button.tsx',
        ...overrides,
    })
}

/** DataTransfer that carries a flint-component-card MIME with the default Button payload. */
function makeCardDT(payloadOverrides?: Partial<{ name: string; importPath: string; filePath: string }>) {
    const payload = makeCardPayload(payloadOverrides)
    return makeDataTransfer({
        types: ['application/flint-component-card'],
        data: { 'application/flint-component-card': payload },
    })
}

/** Builds a minimal VisualLayer tree with the given tagNames at the top level. */
function makeVisualTree(tagNames: string[]): VisualLayer[] {
    return tagNames.map((tag, i) => ({
        id: `${tag}-node-${i}`,
        tagName: tag,
        line: i + 1,
        children: [],
    }))
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useCanvasStore.setState({
        canvasMode: 'design',
        autopilotEnabled: false,
        governedCode: null,
        governedFixCount: 0,
    } as Parameters<typeof useCanvasStore.setState>[0])

    useEditorStore.setState({
        rawCode: 'export default function App() { return <div /> }',
        visualTree: makeVisualTree(['header', 'main', 'footer']),
    } as unknown as Parameters<typeof useEditorStore.setState>[0])
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SmartInsert — CV2.5+ Smart Insert Panel', () => {

    // SI-01: Panel renders when card is dragged over and visualTree exists
    it('SI-01: smart insert panel renders when card drag enters with a non-empty visualTree', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        expect(screen.queryByTestId('smart-insert-panel')).toBeNull()

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })

        expect(screen.getByTestId('smart-insert-panel')).toBeDefined()
    })

    // SI-02: Panel does NOT render when no drag is active
    it('SI-02: panel does not render before any dragEnter', () => {
        render(<LivePreview />)
        expect(screen.queryByTestId('smart-insert-panel')).toBeNull()
    })

    // SI-03: Panel does NOT render when visualTree is empty
    it('SI-03: panel does not render when visualTree is empty, even with card drag', () => {
        useEditorStore.setState({
            visualTree: [],
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })

        expect(screen.queryByTestId('smart-insert-panel')).toBeNull()
    })

    // SI-04: Panel shows tagNames from the visual tree
    it('SI-04: panel shows all top-level node tag names from visualTree', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })

        // The tree has header, main, footer — each should appear in a node row
        const nodeList = screen.getByTestId('smart-insert-node-list')
        expect(nodeList.textContent).toContain('header')
        expect(nodeList.textContent).toContain('main')
        expect(nodeList.textContent).toContain('footer')
    })

    // SI-05: Dropping on a specific node row calls applyBatch with correct targetNodeId
    it('SI-05: dropping on a panel row calls applyBatch with the node id of that row', () => {
        const applyBatch = vi.fn()
        useEditorStore.setState({
            applyBatch,
            visualTree: makeVisualTree(['header', 'main', 'footer']),
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })

        // The 'main' node has id 'main-node-1' (from makeVisualTree)
        const mainNodeRow = screen.getByTestId('smart-insert-node-main-node-1')
        fireEvent.drop(mainNodeRow, { dataTransfer: makeCardDT() })

        expect(applyBatch).toHaveBeenCalledOnce()
        const [mutations] = applyBatch.mock.calls[0] as [Array<{
            op: string
            targetNodeId: string
            jsxSnippet: string
            importSnippet: string
        }>]
        expect(mutations[0].op).toBe('injectComponent')
        expect(mutations[0].targetNodeId).toBe('main-node-1')
        expect(mutations[0].jsxSnippet).toBe('<Button />')
        expect(mutations[0].importSnippet).toBe("import { Button } from '@/components/ui/Button';")
    })

    // SI-06: Panel disappears when drag leaves the drop zone
    it('SI-06: panel disappears when drag leaves the drop zone', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })
        expect(screen.getByTestId('smart-insert-panel')).toBeDefined()

        // Leave — relatedTarget outside the element (null simulates leaving to outside)
        fireEvent.dragLeave(dropZone, { relatedTarget: null })
        expect(screen.queryByTestId('smart-insert-panel')).toBeNull()
    })

    // SI-07: Maximum 10 nodes shown, truncation label appears for larger trees
    it('SI-07: shows maximum 10 nodes and displays a truncation label for overflow', () => {
        const tagNames = Array.from({ length: 13 }, (_, i) => `div${i}`)
        useEditorStore.setState({
            visualTree: makeVisualTree(tagNames),
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })

        // Should have exactly 10 node rows (data-testid starts with smart-insert-node-)
        const panel = screen.getByTestId('smart-insert-panel')
        const nodeRows = panel.querySelectorAll('[data-testid^="smart-insert-node-div"]')
        expect(nodeRows.length).toBe(10)

        // Truncation label should mention the remaining count (13 - 10 = 3)
        expect(panel.textContent).toContain('3 more')
    })

    // SI-08: No truncation label when tree has exactly 10 nodes
    it('SI-08: truncation label is absent when tree has 10 or fewer nodes', () => {
        const tagNames = Array.from({ length: 10 }, (_, i) => `div${i}`)
        useEditorStore.setState({
            visualTree: makeVisualTree(tagNames),
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })

        const panel = screen.getByTestId('smart-insert-panel')
        // "more" text only appears in the truncation indicator
        expect(panel.textContent).not.toContain('more')
    })

    // SI-09: Panel header shows the pending component name
    it('SI-09: panel header displays the pending component name from card payload', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        fireEvent.dragEnter(dropZone, {
            dataTransfer: makeCardDT({ name: 'AlertDialog', importPath: '@/ui/AlertDialog' }),
        })

        const panel = screen.getByTestId('smart-insert-panel')
        expect(panel.textContent).toContain('AlertDialog')
    })

    // SI-10: Fallback — dropping on the preview iframe itself (not a panel row) still inserts at root
    it('SI-10: dropping on the preview drop zone directly (not a panel row) inserts at root node', () => {
        const applyBatch = vi.fn()
        const tree = makeVisualTree(['header', 'main', 'footer'])
        useEditorStore.setState({
            applyBatch,
            visualTree: tree,
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        // Enter then drop on the drop zone itself (CV2.5 fallback path)
        fireEvent.dragEnter(dropZone, { dataTransfer: makeCardDT() })
        fireEvent.drop(dropZone, { dataTransfer: makeCardDT() })

        expect(applyBatch).toHaveBeenCalledOnce()
        const [mutations] = applyBatch.mock.calls[0] as [Array<{
            targetNodeId: string
        }>]
        // Root node is visualTree[0].id = 'header-node-0'
        expect(mutations[0].targetNodeId).toBe('header-node-0')
    })
})
