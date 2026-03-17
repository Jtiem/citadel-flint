/**
 * projectOpenChain.test.ts — src/store/__tests__/projectOpenChain.test.ts
 *
 * Tests Journey 2 Steps 2.3-2.5: the complete project-open chain.
 *
 * Covers:
 *   - setActiveFile triggers Clean Slate Protocol (clears AST, history)
 *   - After load: rawCode, ast, and visualTree are populated
 *   - historyStore is cleared on file switch (no stale undo entries)
 *   - setWorkspaceFiles populates workspaceFiles
 *   - IPC read failure leaves ast null (graceful degradation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../canvasStore'
import { useEditorStore } from '../editorStore'
import { useHistoryStore } from '../historyStore'
import { LanguageRegistry } from '../../core/adapters/types'
import { ReactAdapter } from '../../core/adapters/ReactAdapter'
import type { FileTreeNode } from '../../types/bridge-api'

// ── Register the React adapter once so LanguageRegistry.getAdapter() works ──

const reactAdapter = new ReactAdapter()
LanguageRegistry.register(['ts', 'tsx', 'js', 'jsx'], reactAdapter)

// ── Mock TSX content used across tests ───────────────────────────────────────

const MOCK_FILE_PATH = '/project/src/components/Demo.tsx'
const MOCK_TSX_CONTENT =
    'export default function Demo() { return <div className="p-4">Hello</div> }'

// ── Reset helpers ─────────────────────────────────────────────────────────────

function resetStores() {
    useEditorStore.setState({
        rawCode: '',
        ast: null,
        visualTree: [],
        selectedNodeId: null,
        hoveredId: null,
        jumpToLine: null,
        linterWarnings: new Map(),
    })

    useCanvasStore.setState({
        dragSourceId: null,
        activeSelection: null,
        canvasMode: 'design' as const,
        nodeLayouts: {},
        mithrilViolations: [],
        a11yViolations: {},
        overridesExist: false,
        saveState: 'idle' as const,
        activeFilePath: null,
        workspaceFiles: null,
    })

    useHistoryStore.setState({
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
    })
}

// ── Global setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    resetStores()

    // Install a fresh bridgeAPI mock on each test so individual tests can
    // override readFile / saveFile without polluting neighbours.
    ;(globalThis as any).window = (globalThis as any).window ?? {}
    ;(window as any).bridgeAPI = {
        readFile: vi.fn().mockResolvedValue(MOCK_TSX_CONTENT),
        saveFile: vi.fn().mockResolvedValue(undefined),
    }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('setWorkspaceFiles', () => {
    it('stores the file tree when setWorkspaceFiles is called with a tree', () => {
        const tree: FileTreeNode = {
            name: 'src',
            path: '/project/src',
            type: 'directory',
            children: [
                { name: 'Demo.tsx', path: MOCK_FILE_PATH, type: 'file' },
            ],
        }

        useCanvasStore.getState().setWorkspaceFiles(tree)

        const { workspaceFiles } = useCanvasStore.getState()
        expect(workspaceFiles).not.toBeNull()
        expect(workspaceFiles!.path).toBe('/project/src')
        expect(workspaceFiles!.children).toHaveLength(1)
        expect(workspaceFiles!.children![0].path).toBe(MOCK_FILE_PATH)
    })

    it('clears workspaceFiles when setWorkspaceFiles is called with null', () => {
        const tree: FileTreeNode = {
            name: 'src',
            path: '/project/src',
            type: 'directory',
        }
        useCanvasStore.getState().setWorkspaceFiles(tree)
        expect(useCanvasStore.getState().workspaceFiles).not.toBeNull()

        useCanvasStore.getState().setWorkspaceFiles(null)
        expect(useCanvasStore.getState().workspaceFiles).toBeNull()
    })
})

describe('setActiveFile — Clean Slate Protocol', () => {
    it('calls clearAST before loading the new file (Ghost Layer prevention)', async () => {
        // Pre-seed the editor with stale data from a previous file.
        useEditorStore.setState({
            rawCode: 'previous code',
            ast: {} as unknown,     // non-null sentinel
            visualTree: [{ id: 'old-node', label: 'div', depth: 0, children: [] }],
        })

        // During setActiveFile there is a moment (after clearAST, before setCode)
        // when the editor must be empty. We capture that moment by observing
        // the state transition. We do this by wrapping readFile to sample state.
        let astDuringRead: unknown = 'NOT_SAMPLED'
        ;(window as any).bridgeAPI.readFile = vi.fn().mockImplementation(async () => {
            // At this point clearAST() has already been called but setCode()
            // has not yet been invoked — the editor should be blank.
            astDuringRead = useEditorStore.getState().ast
            return MOCK_TSX_CONTENT
        })

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        // AST was null during the read window — confirms clearAST ran first.
        expect(astDuringRead).toBeNull()
    })

    it('sets activeFilePath on the canvas store after setActiveFile', async () => {
        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect(useCanvasStore.getState().activeFilePath).toBe(MOCK_FILE_PATH)
    })

    it('calls window.bridgeAPI.readFile with the correct path', async () => {
        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect((window as any).bridgeAPI.readFile).toHaveBeenCalledWith(MOCK_FILE_PATH)
    })
})

describe('setActiveFile — post-load editor state', () => {
    it('populates editorStore.rawCode with file content after load', async () => {
        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect(useEditorStore.getState().rawCode).toBe(MOCK_TSX_CONTENT)
    })

    it('produces a non-null AST after loading valid TSX content', async () => {
        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect(useEditorStore.getState().ast).not.toBeNull()
    })

    it('populates visualTree with at least one layer after loading valid TSX', async () => {
        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        const { visualTree } = useEditorStore.getState()
        expect(visualTree.length).toBeGreaterThan(0)
    })

    it('sets a11yViolations on canvasStore after loading (audit runs on every parse)', async () => {
        // The file has a plain <div> — no a11y violations expected.
        // We only assert the shape, not specific rule results, because the
        // A11yLinter is tested independently in its own test file.
        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        const { a11yViolations } = useCanvasStore.getState()
        // Must be a plain object (never undefined / null after setCode runs).
        expect(a11yViolations).toBeDefined()
        expect(typeof a11yViolations).toBe('object')
    })
})

describe('setActiveFile — historyStore clean-slate', () => {
    it('clears undo history when switching to a new file', async () => {
        // Seed a fake undo entry as if a prior mutation had been applied.
        useHistoryStore.getState().push(
            [{ op: 'restoreCode', code: 'old code' }],
            []
        )
        expect(useHistoryStore.getState().canUndo).toBe(true)
        expect(useHistoryStore.getState().past).toHaveLength(1)

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        // setCode detects code !== previousCode and calls historyStore.clear().
        expect(useHistoryStore.getState().canUndo).toBe(false)
        expect(useHistoryStore.getState().past).toHaveLength(0)
    })

    it('clears redo history when switching to a new file', async () => {
        // Seed fake redo entries.
        useHistoryStore.setState({ future: [{ inversions: [], redoMutations: [] }], canRedo: true })
        expect(useHistoryStore.getState().canRedo).toBe(true)

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect(useHistoryStore.getState().canRedo).toBe(false)
        expect(useHistoryStore.getState().future).toHaveLength(0)
    })
})

describe('setActiveFile — IPC failure handling', () => {
    it('leaves ast null when readFile rejects (graceful degradation)', async () => {
        ;(window as any).bridgeAPI.readFile = vi.fn().mockRejectedValue(new Error('ENOENT: file not found'))

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        // The error is swallowed (console.error only) — ast stays null.
        expect(useEditorStore.getState().ast).toBeNull()
    })

    it('still sets activeFilePath even when readFile rejects', async () => {
        ;(window as any).bridgeAPI.readFile = vi.fn().mockRejectedValue(new Error('permission denied'))

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        // Path is committed before the read attempt, so it reflects intent.
        expect(useCanvasStore.getState().activeFilePath).toBe(MOCK_FILE_PATH)
    })

    it('rawCode stays empty string when readFile rejects', async () => {
        ;(window as any).bridgeAPI.readFile = vi.fn().mockRejectedValue(new Error('timeout'))

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect(useEditorStore.getState().rawCode).toBe('')
    })

    it('visualTree stays empty when readFile rejects', async () => {
        ;(window as any).bridgeAPI.readFile = vi.fn().mockRejectedValue(new Error('not found'))

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        expect(useEditorStore.getState().visualTree).toHaveLength(0)
    })
})

describe('setActiveFile — dirty-file flush before switch', () => {
    it('flushes unsaved changes to disk before switching files', async () => {
        const FIRST_FILE = '/project/src/First.tsx'
        const SECOND_FILE = '/project/src/Second.tsx'
        const UNSAVED_CODE = 'export default function First() { return <span>dirty</span> }'

        // Simulate an open file with unsaved changes in the editing state.
        useCanvasStore.setState({ activeFilePath: FIRST_FILE, saveState: 'editing' })
        useEditorStore.setState({ rawCode: UNSAVED_CODE })

        ;(window as any).bridgeAPI.saveFile = vi.fn().mockResolvedValue(undefined)
        ;(window as any).bridgeAPI.readFile = vi.fn().mockResolvedValue(MOCK_TSX_CONTENT)

        await useCanvasStore.getState().setActiveFile(SECOND_FILE)

        // Dirty flush should have called saveFile with the stale file's path and code.
        expect((window as any).bridgeAPI.saveFile).toHaveBeenCalledWith(FIRST_FILE, UNSAVED_CODE)
    })

    it('does NOT call saveFile when switching from a clean (idle) file', async () => {
        // saveState is 'idle' — no pending edits.
        useCanvasStore.setState({ activeFilePath: '/project/src/Clean.tsx', saveState: 'idle' })

        ;(window as any).bridgeAPI.saveFile = vi.fn().mockResolvedValue(undefined)
        ;(window as any).bridgeAPI.readFile = vi.fn().mockResolvedValue(MOCK_TSX_CONTENT)

        await useCanvasStore.getState().setActiveFile(MOCK_FILE_PATH)

        // No pre-switch flush needed — saveFile must not be invoked for old file.
        // (triggerAutoSave inside setCode may call it for the NEW file, so we
        //  only assert the specific first-argument path was not the old path.)
        const saveCalls = (window as any).bridgeAPI.saveFile.mock.calls as [string, string][]
        const oldFileFlush = saveCalls.find(([path]) => path === '/project/src/Clean.tsx')
        expect(oldFileFlush).toBeUndefined()
    })
})
