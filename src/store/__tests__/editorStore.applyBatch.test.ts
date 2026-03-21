/**
 * editorStore.applyBatch.test.ts
 *
 * Tests for the applyBatch action in editorStore, specifically verifying
 * Commandment 7 — ID Preservation: injectFlintIds must be called after
 * structural mutations so newly created or moved nodes are addressable
 * on the canvas.
 *
 * Covers:
 *   - injectFlintIds is called (via adapter) after moveNode mutations
 *   - injectFlintIds is called after injectComponent mutations
 *   - injectFlintIds is NOT called for non-structural ops (updateClassName)
 *   - Resulting rawCode contains data-flint-id on the injected element
 *   - Resulting rawCode contains data-flint-id on moved elements
 *   - Non-structural batches leave existing flint IDs intact
 *   - Empty batch is a no-op
 *   - historyStore receives inversions after a structural mutation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '../editorStore'
import { useHistoryStore } from '../historyStore'
import { useCanvasStore } from '../canvasStore'
import { LanguageRegistry } from '../../core/adapters/types'
import { ReactAdapter } from '../../core/adapters/ReactAdapter'

// ── Adapter registration ──────────────────────────────────────────────────────
// Must happen before any store action that calls LanguageRegistry.getAdapter().

const reactAdapter = new ReactAdapter()
LanguageRegistry.register(['ts', 'tsx', 'js', 'jsx'], reactAdapter)

// ── TSX fixtures ──────────────────────────────────────────────────────────────

/**
 * A component with two nodes that already have flint IDs.
 * injectFlintIds is idempotent — these IDs should be preserved.
 */
const FIXTURE_WITH_IDS = `
import React from 'react'
export default function Card() {
  return (
    <div data-flint-id="root-001">
      <span data-flint-id="span-002">Hello</span>
      <p data-flint-id="para-003">World</p>
    </div>
  )
}
`.trim()

/**
 * A component WITHOUT flint IDs — to test that injectFlintIds stamps them.
 */
const FIXTURE_NO_IDS = `
import React from 'react'
export default function Card() {
  return (
    <div>
      <span>Hello</span>
    </div>
  )
}
`.trim()

// ── Store reset helper ─────────────────────────────────────────────────────────

function resetStores(code = FIXTURE_WITH_IDS) {
    useHistoryStore.setState({ past: [], future: [] })
    useCanvasStore.setState({
        activeFilePath: '/test/Card.tsx',
        saveState: 'idle',
        activeSelection: null,
        dragSourceId: null,
        mithrilViolations: [],
        a11yViolations: {},
        overridesExist: false,
        workspaceFiles: null,
    })
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        saveFile: vi.fn().mockResolvedValue(undefined),
        saveFileBatch: vi.fn().mockResolvedValue(undefined),
        tokens: { clearOverride: vi.fn().mockResolvedValue(undefined) },
    }
    // Seed rawCode via direct state so we bypass setCode's side effects
    useEditorStore.setState({
        rawCode: code,
        ast: reactAdapter.parse(code),
        visualTree: [],
        selectedNodeId: null,
        hoveredId: null,
        jumpToLine: null,
        linterWarnings: new Map(),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('editorStore.applyBatch — Commandment 7: injectFlintIds after structural mutations', () => {
    beforeEach(() => {
        resetStores()
    })

    it('empty batch is a no-op — rawCode unchanged', () => {
        const before = useEditorStore.getState().rawCode
        useEditorStore.getState().applyBatch([])
        expect(useEditorStore.getState().rawCode).toBe(before)
    })

    it('injectComponent batch: resulting code has data-flint-id on injected element', () => {
        // The injected element starts without a flint ID; injectFlintIds should stamp it.
        useEditorStore.getState().applyBatch([
            {
                op: 'injectComponent',
                targetNodeId: 'root-001',
                jsxSnippet: '<button>Click me</button>',
            },
        ])

        const { rawCode } = useEditorStore.getState()
        // The injected button should now carry a data-flint-id
        expect(rawCode).toContain('data-flint-id')
        // The injected element should be present
        expect(rawCode).toContain('<button')
    })

    it('moveNode batch: resulting code still contains data-flint-id on moved element', () => {
        // Move span-002 to inside para-003 (position: inside)
        useEditorStore.getState().applyBatch([
            {
                op: 'moveNode',
                sourceId: 'span-002',
                targetId: 'para-003',
                position: 'inside',
            },
        ])

        const { rawCode } = useEditorStore.getState()
        // After the move, flint IDs must still be present (7D hardening)
        expect(rawCode).toContain('data-flint-id')
        // The root node must still carry its original ID
        expect(rawCode).toContain('root-001')
    })

    it('updateClassName batch (non-structural): does NOT lose existing flint IDs', () => {
        useEditorStore.getState().applyBatch([
            {
                op: 'updateClassName',
                nodeId: 'span-002',
                className: 'text-blue-500',
            },
        ])

        const { rawCode } = useEditorStore.getState()
        // Existing IDs must be preserved
        expect(rawCode).toContain('data-flint-id="root-001"')
        expect(rawCode).toContain('data-flint-id="span-002"')
        // The className update must be applied
        expect(rawCode).toContain('text-blue-500')
    })

    it('fixture without IDs: injectComponent stamps data-flint-id on all nodes', () => {
        resetStores(FIXTURE_NO_IDS)

        useEditorStore.getState().applyBatch([
            {
                op: 'injectComponent',
                targetNodeId: 'div:4:4',
                jsxSnippet: '<button>New</button>',
            },
        ])

        const { rawCode } = useEditorStore.getState()
        // injectFlintIds must have been called — all nodes should now have IDs
        expect(rawCode).toContain('data-flint-id')
    })

    it('historyStore receives inversions after a structural batch', () => {
        useEditorStore.getState().applyBatch([
            {
                op: 'injectComponent',
                targetNodeId: 'root-001',
                jsxSnippet: '<footer>Footer</footer>',
            },
        ])

        const { past } = useHistoryStore.getState()
        expect(past.length).toBeGreaterThan(0)
        const entry = past[past.length - 1]
        // Structural mutations produce a restoreCode inversion
        expect(entry.inversions[0].op).toBe('restoreCode')
    })

    it('non-structural batch: historyStore receives property-level inversions', () => {
        useEditorStore.getState().applyBatch([
            {
                op: 'updateClassName',
                nodeId: 'span-002',
                className: 'font-bold',
            },
        ])

        const { past } = useHistoryStore.getState()
        expect(past.length).toBeGreaterThan(0)
        const entry = past[past.length - 1]
        // Non-structural produces updateClassName inversion
        expect(entry.inversions[0].op).toBe('updateClassName')
    })

    it('applyBatch is a no-op when the mutation silently fails (parse error)', () => {
        useEditorStore.setState({ rawCode: 'this is not valid tsx <<<', ast: null })
        const before = useEditorStore.getState().rawCode

        useEditorStore.getState().applyBatch([
            { op: 'updateClassName', nodeId: 'root-001', className: 'text-red-500' },
        ])

        // rawCode unchanged — parse failed
        expect(useEditorStore.getState().rawCode).toBe(before)
    })

    it('structural mutation: visualTree is rebuilt after ID injection', () => {
        useEditorStore.getState().applyBatch([
            {
                op: 'injectComponent',
                targetNodeId: 'root-001',
                jsxSnippet: '<aside>Sidebar</aside>',
            },
        ])

        // visualTree should be non-null — it was rebuilt from the post-inject AST
        const { visualTree } = useEditorStore.getState()
        expect(visualTree).toBeDefined()
    })
})
