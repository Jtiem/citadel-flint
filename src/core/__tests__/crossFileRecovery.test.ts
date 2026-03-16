/**
 * crossFileRecovery.test.ts
 *
 * P2 Journey 6 advanced paths: cross-file undo and the recovery controller's
 * multi-file batch restore.
 *
 * Coverage:
 *   - applyCrossFileUndo: 2-file batch restore via saveFileBatch
 *   - Buffer eviction and reload after cross-file undo
 *   - Active editor sync when restored file is the active file
 *   - RedoPlan extraction and push to historyStore.future
 *   - Single-file undo pushes redo entry to future
 *   - Empty history is a silent no-op
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyUndo, applyRedo } from '../recoveryController'
import { useHistoryStore } from '../../store/historyStore'
import type { HistoryEntry } from '../../store/historyStore'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useASTBufferStore } from '../../store/astBufferStore'
import type { InverseMutation } from '../ASTService'
import { LanguageRegistry } from '../adapters/types'
import { ReactAdapter } from '../adapters/ReactAdapter'

// ── Adapter registration ─────────────────────────────────────────────────────

LanguageRegistry.register(['tsx', 'ts', 'jsx', 'js'], new ReactAdapter())

// ── IPC mocks ────────────────────────────────────────────────────────────────

const mockSaveFileBatch = vi.fn(async () => undefined)
const mockReadFile = vi.fn(async () => '')
const mockSaveFile = vi.fn(async () => undefined)

// The bridgeAPI mock is set in setup.ts but may not include saveFileBatch.
// Override it here.
beforeEach(() => {
    ;(window as any).bridgeAPI = {
        ...((window as any).bridgeAPI ?? {}),
        saveFileBatch: mockSaveFileBatch,
        readFile: mockReadFile,
        saveFile: mockSaveFile,
    }
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FILE_A = '/project/src/ComponentA.tsx'
const FILE_B = '/project/src/ComponentB.tsx'

const CODE_A_BEFORE = `export default function A() {
  return <div data-bridge-id="div:1:0" className="p-4">Hello</div>
}`

const CODE_A_AFTER = `export default function A() {
  return <div data-bridge-id="div:1:0" className="p-4"></div>
}`

const CODE_B_BEFORE = `export default function B() {
  return <section data-bridge-id="section:1:0">World</section>
}`

const CODE_B_AFTER = `export default function B() {
  return <section data-bridge-id="section:1:0"><div data-bridge-id="div:1:0" className="p-4">Hello</div>World</section>
}`

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStores(): void {
    useHistoryStore.getState().clear()
    useEditorStore.setState({
        rawCode: '',
        ast: null,
        visualTree: [],
        selectedNodeId: null,
        linterWarnings: new Map(),
    })
    useCanvasStore.setState({
        activeFilePath: null,
        saveState: 'idle' as const,
    })
}

function makeCrossFileUndoEntries(): HistoryEntry[] {
    const batchId = 'batch-xf-001'
    return [
        {
            filePath: FILE_A,
            batchId,
            inversions: [{ op: 'restoreCode', code: CODE_A_BEFORE } as InverseMutation],
            redoMutations: [],
            redoPlan: {
                type: 'crossFileMove' as const,
                sourceFilePath: FILE_A,
                targetFilePath: FILE_B,
                sourceNodeId: 'div:1:0',
                targetNodeId: 'section:1:0',
                position: 'lastChild' as const,
            },
        },
        {
            filePath: FILE_B,
            batchId,
            inversions: [{ op: 'restoreCode', code: CODE_B_BEFORE } as InverseMutation],
            redoMutations: [],
        },
    ]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyCrossFileUndo (J6.3)', () => {
    beforeEach(() => {
        resetStores()
        mockSaveFileBatch.mockClear()
        mockReadFile.mockClear()
        mockSaveFile.mockClear()
    })

    it('calls saveFileBatch with both restored files', async () => {
        const entries = makeCrossFileUndoEntries()
        // Push entries in reverse order (top of stack = last pushed)
        const historyStore = useHistoryStore.getState()
        historyStore.push(entries[1].inversions, [], FILE_B, entries[1].batchId)
        historyStore.push(entries[0].inversions, [], FILE_A, entries[0].batchId, entries[0].redoPlan)

        // Mock buffer store to avoid actual file reads
        const evictBuffer = vi.fn()
        const loadBuffer = vi.fn(async () => undefined)
        useASTBufferStore.setState({ buffers: new Map(), evictBuffer, loadBuffer } as any)

        await applyUndo()

        expect(mockSaveFileBatch).toHaveBeenCalledTimes(1)
        const batchArg = mockSaveFileBatch.mock.calls[0][0] as Record<string, string>
        expect(batchArg[FILE_A]).toBe(CODE_A_BEFORE)
        expect(batchArg[FILE_B]).toBe(CODE_B_BEFORE)
    })

    it('evicts and reloads affected buffers after restore', async () => {
        const entries = makeCrossFileUndoEntries()
        const historyStore = useHistoryStore.getState()
        historyStore.push(entries[1].inversions, [], FILE_B, entries[1].batchId)
        historyStore.push(entries[0].inversions, [], FILE_A, entries[0].batchId, entries[0].redoPlan)

        const evictBuffer = vi.fn()
        const loadBuffer = vi.fn(async () => undefined)
        useASTBufferStore.setState({ buffers: new Map(), evictBuffer, loadBuffer } as any)

        await applyUndo()

        expect(evictBuffer).toHaveBeenCalledWith(FILE_A)
        expect(evictBuffer).toHaveBeenCalledWith(FILE_B)
        expect(loadBuffer).toHaveBeenCalledWith(FILE_A)
        expect(loadBuffer).toHaveBeenCalledWith(FILE_B)
    })

    it('syncs active editor when active file is in the restore batch', async () => {
        const entries = makeCrossFileUndoEntries()
        const historyStore = useHistoryStore.getState()
        historyStore.push(entries[1].inversions, [], FILE_B, entries[1].batchId)
        historyStore.push(entries[0].inversions, [], FILE_A, entries[0].batchId, entries[0].redoPlan)

        // Set FILE_A as the active file
        useCanvasStore.setState({ activeFilePath: FILE_A })

        const evictBuffer = vi.fn()
        const loadBuffer = vi.fn(async () => undefined)
        useASTBufferStore.setState({ buffers: new Map(), evictBuffer, loadBuffer } as any)

        // Spy on syncCode
        const syncCode = vi.fn()
        useEditorStore.setState({ syncCode } as any)

        await applyUndo()

        expect(syncCode).toHaveBeenCalledWith(CODE_A_BEFORE)
    })

    it('does NOT sync editor when active file is not in the batch', async () => {
        const entries = makeCrossFileUndoEntries()
        const historyStore = useHistoryStore.getState()
        historyStore.push(entries[1].inversions, [], FILE_B, entries[1].batchId)
        historyStore.push(entries[0].inversions, [], FILE_A, entries[0].batchId, entries[0].redoPlan)

        // Active file is NOT in the batch
        useCanvasStore.setState({ activeFilePath: '/project/src/Other.tsx' })

        const syncCode = vi.fn()
        useEditorStore.setState({ syncCode } as any)

        const evictBuffer = vi.fn()
        const loadBuffer = vi.fn(async () => undefined)
        useASTBufferStore.setState({ buffers: new Map(), evictBuffer, loadBuffer } as any)

        await applyUndo()

        expect(syncCode).not.toHaveBeenCalled()
    })

    it('pushes RedoPlan to future for cross-file redo', async () => {
        const entries = makeCrossFileUndoEntries()
        const historyStore = useHistoryStore.getState()
        historyStore.push(entries[1].inversions, [], FILE_B, entries[1].batchId)
        historyStore.push(entries[0].inversions, [], FILE_A, entries[0].batchId, entries[0].redoPlan)

        const evictBuffer = vi.fn()
        const loadBuffer = vi.fn(async () => undefined)
        useASTBufferStore.setState({ buffers: new Map(), evictBuffer, loadBuffer } as any)

        await applyUndo()

        const future = useHistoryStore.getState().future
        expect(future.length).toBeGreaterThan(0)
        const redoEntry = future[future.length - 1]
        expect(redoEntry.redoPlan).toBeDefined()
        expect(redoEntry.redoPlan!.type).toBe('crossFileMove')
        expect(redoEntry.redoPlan!.sourceFilePath).toBe(FILE_A)
        expect(redoEntry.redoPlan!.targetFilePath).toBe(FILE_B)
    })

    it('silently no-ops when saveFileBatch rejects', async () => {
        const entries = makeCrossFileUndoEntries()
        const historyStore = useHistoryStore.getState()
        historyStore.push(entries[1].inversions, [], FILE_B, entries[1].batchId)
        historyStore.push(entries[0].inversions, [], FILE_A, entries[0].batchId, entries[0].redoPlan)

        mockSaveFileBatch.mockRejectedValueOnce(new Error('disk full'))

        const evictBuffer = vi.fn()
        const loadBuffer = vi.fn(async () => undefined)
        useASTBufferStore.setState({ buffers: new Map(), evictBuffer, loadBuffer } as any)

        // Should not throw
        await expect(applyUndo()).resolves.toBeUndefined()

        // Buffers should NOT be evicted since the save failed
        expect(evictBuffer).not.toHaveBeenCalled()
    })
})

describe('applyUndo — empty history (J6 guard)', () => {
    beforeEach(resetStores)

    it('is a silent no-op when past is empty', async () => {
        await expect(applyUndo()).resolves.toBeUndefined()
        expect(useHistoryStore.getState().future).toHaveLength(0)
    })
})

describe('applyRedo — empty future (J6 guard)', () => {
    beforeEach(resetStores)

    it('is a silent no-op when future is empty', async () => {
        await expect(applyRedo()).resolves.toBeUndefined()
        expect(useHistoryStore.getState().past).toHaveLength(0)
    })
})
