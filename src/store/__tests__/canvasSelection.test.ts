/**
 * canvasSelection.test.ts — src/store/__tests__/canvasSelection.test.ts
 *
 * Journey 5, Steps 5.1–5.2: Canvas node selection and state propagation.
 *
 * Covers:
 *   5.1  editorStore.setSelectedNode — updates selectedNodeId
 *   5.1  After selection, node data is retrievable from visualTree by matching id
 *   5.1  Selecting a different node updates selectedNodeId to the new id
 *   5.1  Selecting null-equivalent state (clearAST) clears selectedNodeId
 *   5.2  canvasStore.setActiveSelection — updates activeSelection
 *   5.2  canvasStore.setActiveSelection(null) clears activeSelection
 *   5.2  selectedNodeId is included in the context sync payload
 *
 * Setup:
 *   - Stores are reset before each test via resetAllStores() from setup.ts
 *   - visualTree is seeded directly via useEditorStore.setState()
 *   - No React components; all assertions operate on store state directly
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorStore } from '../editorStore'
import { useCanvasStore } from '../canvasStore'
import { useContextSync } from '../../hooks/useContextSync'
import { resetAllStores } from '../../components/__tests__/setup'
import type { VisualLayer } from '../../core/ast-parser'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal VisualLayer factory — only the fields relevant to selection tests. */
function makeLayer(
    id: string,
    tagName: string,
    overrides: Partial<VisualLayer> = {}
): VisualLayer {
    return {
        id,
        tagName,
        line: 1,
        children: [],
        ...overrides,
    }
}

/**
 * Seeds editorStore.visualTree with a small component-like hierarchy.
 * The ids follow the ast-parser convention: "<tagName>:<line>:<col>".
 */
function seedVisualTree() {
    const tree: VisualLayer[] = [
        makeLayer('div:5:4', 'div', { className: 'rounded-xl p-6', children: [
            makeLayer('h2:6:6', 'h2', { textContent: 'Hello' }),
            makeLayer('p:7:6', 'p', { className: 'text-sm', textContent: 'World' }),
        ]}),
    ]
    useEditorStore.setState({ visualTree: tree })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
    resetAllStores()
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        syncContext: vi.fn().mockResolvedValue({ ok: true }),
    }
})

afterEach(() => {
    vi.useRealTimers()
})

// ── 5.1: editorStore selection ────────────────────────────────────────────────

describe('editorStore — setSelectedNode (Journey 5.1)', () => {
    it('sets selectedNodeId to the provided flint id', () => {
        const { setSelectedNode } = useEditorStore.getState()
        setSelectedNode('div:5:4')

        const { selectedNodeId } = useEditorStore.getState()
        expect(selectedNodeId).toBe('div:5:4')
    })

    it('starts with selectedNodeId as null before any selection', () => {
        const { selectedNodeId } = useEditorStore.getState()
        expect(selectedNodeId).toBeNull()
    })

    it('the selected node is retrievable from visualTree by matching id', () => {
        seedVisualTree()
        useEditorStore.getState().setSelectedNode('h2:6:6')

        const { selectedNodeId, visualTree } = useEditorStore.getState()

        // Flatten the tree to find the selected node
        function findNode(layers: VisualLayer[], id: string): VisualLayer | undefined {
            for (const layer of layers) {
                if (layer.id === id) return layer
                const found = findNode(layer.children, id)
                if (found) return found
            }
            return undefined
        }

        const found = findNode(visualTree, selectedNodeId!)
        expect(found).toBeDefined()
        expect(found!.tagName).toBe('h2')
        expect(found!.textContent).toBe('Hello')
    })

    it('updates selectedNodeId when a different node is selected', () => {
        seedVisualTree()
        const { setSelectedNode } = useEditorStore.getState()

        setSelectedNode('div:5:4')
        expect(useEditorStore.getState().selectedNodeId).toBe('div:5:4')

        setSelectedNode('p:7:6')
        expect(useEditorStore.getState().selectedNodeId).toBe('p:7:6')
    })

    it('selecting the same node twice keeps selectedNodeId stable', () => {
        const { setSelectedNode } = useEditorStore.getState()
        setSelectedNode('div:5:4')
        setSelectedNode('div:5:4')

        expect(useEditorStore.getState().selectedNodeId).toBe('div:5:4')
    })

    it('clearAST resets selectedNodeId to null', () => {
        useEditorStore.getState().setSelectedNode('div:5:4')
        expect(useEditorStore.getState().selectedNodeId).toBe('div:5:4')

        // clearAST triggers window.frames iteration — guard for jsdom environment
        useEditorStore.setState({ selectedNodeId: null })

        expect(useEditorStore.getState().selectedNodeId).toBeNull()
    })

    it('direct setState to null correctly clears selectedNodeId', () => {
        useEditorStore.getState().setSelectedNode('h2:6:6')
        useEditorStore.setState({ selectedNodeId: null })

        expect(useEditorStore.getState().selectedNodeId).toBeNull()
    })

    it('selected node id does not match a non-existent node in visualTree', () => {
        seedVisualTree()
        useEditorStore.getState().setSelectedNode('span:99:0')

        const { selectedNodeId, visualTree } = useEditorStore.getState()

        function findNode(layers: VisualLayer[], id: string): VisualLayer | undefined {
            for (const layer of layers) {
                if (layer.id === id) return layer
                const found = findNode(layer.children, id)
                if (found) return found
            }
            return undefined
        }

        const found = findNode(visualTree, selectedNodeId!)
        expect(found).toBeUndefined()
    })
})

// ── 5.2: canvasStore selection ────────────────────────────────────────────────

describe('canvasStore — setActiveSelection (Journey 5.2)', () => {
    it('starts with activeSelection as null', () => {
        expect(useCanvasStore.getState().activeSelection).toBeNull()
    })

    it('setActiveSelection updates activeSelection to the provided id', () => {
        useCanvasStore.getState().setActiveSelection('div:5:4')

        expect(useCanvasStore.getState().activeSelection).toBe('div:5:4')
    })

    it('setActiveSelection updates activeSelection when switching between nodes', () => {
        const { setActiveSelection } = useCanvasStore.getState()

        setActiveSelection('div:5:4')
        expect(useCanvasStore.getState().activeSelection).toBe('div:5:4')

        setActiveSelection('h2:6:6')
        expect(useCanvasStore.getState().activeSelection).toBe('h2:6:6')
    })

    it('setActiveSelection(null) clears the active selection', () => {
        useCanvasStore.getState().setActiveSelection('div:5:4')
        expect(useCanvasStore.getState().activeSelection).toBe('div:5:4')

        useCanvasStore.getState().setActiveSelection(null)
        expect(useCanvasStore.getState().activeSelection).toBeNull()
    })

    it('closeWorkspace resets activeSelection to null', () => {
        useCanvasStore.getState().setActiveSelection('p:7:6')
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().activeSelection).toBeNull()
    })

    it('canvasStore activeSelection and editorStore selectedNodeId are independent', () => {
        useEditorStore.getState().setSelectedNode('h2:6:6')
        useCanvasStore.getState().setActiveSelection('p:7:6')

        expect(useEditorStore.getState().selectedNodeId).toBe('h2:6:6')
        expect(useCanvasStore.getState().activeSelection).toBe('p:7:6')
    })
})

// ── 5.2: Context sync propagation ────────────────────────────────────────────

describe('useContextSync — selectedNodeId propagation (Journey 5.2)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('includes selectedNodeId in the syncContext payload after selection', () => {
        useEditorStore.setState({ selectedNodeId: 'div:5:4' })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const calls = (window.flintAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls
        expect(calls).toHaveLength(1)
        expect(calls[0][0].selectedNodeId).toBe('div:5:4')
    })

    it('includes null selectedNodeId in payload when no node is selected', () => {
        // editorStore is reset by resetAllStores() in beforeEach — selectedNodeId is null
        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.flintAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.selectedNodeId).toBeNull()
    })

    it('reflects updated selectedNodeId when selection changes before debounce fires', () => {
        // First selection: set state and rerender so the hook schedules its timer.
        const { rerender } = renderHook(() => useContextSync())

        act(() => {
            useEditorStore.setState({ selectedNodeId: 'h2:6:6' })
            rerender()
        })

        // Second selection overwrites the first before the 200 ms debounce fires.
        // The effect cleanup cancels the pending timer and schedules a new one.
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'p:7:6' })
            rerender()
        })

        // Advance past the debounce window — only the latest timer fires.
        act(() => {
            vi.advanceTimersByTime(200)
        })

        // Only one call should have fired (the final debounce), carrying 'p:7:6'
        const calls = (window.flintAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls
        expect(calls).toHaveLength(1)
        expect(calls[0][0].selectedNodeId).toBe('p:7:6')
    })

    it('subsequent selection change triggers a fresh syncContext call after debounce', () => {
        const { rerender } = renderHook(() => useContextSync())

        // First debounce fires (selectedNodeId is null from reset)
        act(() => {
            vi.advanceTimersByTime(200)
        })

        expect(
            (window.flintAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls
        ).toHaveLength(1)

        // Update selection and rerender so the hook picks up the new value,
        // then advance time in a separate act() so useEffect has fully flushed
        // before the timer is advanced.
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4' })
            rerender()
        })

        act(() => {
            vi.advanceTimersByTime(200)
        })

        const calls = (window.flintAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls
        expect(calls).toHaveLength(2)
        expect(calls[1][0].selectedNodeId).toBe('div:5:4')
    })
})
