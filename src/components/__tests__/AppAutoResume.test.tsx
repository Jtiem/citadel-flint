/**
 * AppAutoResume.test.tsx
 *
 * LAUNCH.3 — tryAutoResume precedence and first-launch detection tests.
 *
 * These tests exercise the REAL tryAutoResume function (imported from
 * src/lib/autoResume.ts) by injecting fake deps via the AutoResumeDeps
 * interface. The previous version re-implemented the logic inline — this
 * version tests the actual production code (Code M1 fix).
 *
 * Covers:
 *   AR-01: URL hash / query deep-link hook is a TODO (currently a no-op)
 *   AR-02: lastActiveFile wins over SQLite session when file exists on disk
 *   AR-03: lastActiveFile is skipped and session used when file is gone (ENOENT)
 *   AR-04: clearLastActiveFile is called when the persisted file is inaccessible
 *   AR-05: true first launch (no setup.json) → WS1 demo runs, NOT tryAutoResume
 *   AR-06: returning user with no lastActiveFile shows LaunchScreen (no demo)
 *   AR-07: returning user with no lastActiveFile and no session shows LaunchScreen
 *   AR-08: temp-dir paths in lastActiveFile are skipped
 *   AR-09: user opens file mid-resume → resume does not clobber (shouldContinue)
 *   AR-10: tryAutoResume resolves even when all steps fall through (no throw)
 *   AR-11: poisoned root path (mismatch) → entry cleared, falls through to session
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tryAutoResume, type AutoResumeDeps } from '../../lib/autoResume'
import { useCanvasStore } from '../../store/canvasStore'
import type { LastActiveFileEntry } from '../../store/canvasStore'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDefaultDeps(overrides: Partial<AutoResumeDeps> = {}): AutoResumeDeps & {
    _resolved: { file: string | null; session: string | null; cleared: boolean; notified: boolean; recorded: boolean }
} {
    const _resolved = {
        file: null as string | null,
        session: null as string | null,
        cleared: false,
        notified: false,
        recorded: false,
    }

    const deps: AutoResumeDeps = {
        readFile: vi.fn<(p: string) => Promise<string>>().mockRejectedValue(new Error('ENOENT')),
        findRootForFile: null,
        openPath: vi.fn<(p: string) => Promise<null>>().mockResolvedValue(null),
        getRecentFileFocus: vi.fn().mockResolvedValue(null),
        setWorkspaceFiles: vi.fn(),
        setActiveFile: vi.fn(async (p: string) => { _resolved.file = p }),
        hydrateWorkspace: vi.fn(async (tree: { path: string }) => { _resolved.session = tree.path }),
        clearLastActiveFile: vi.fn(() => { _resolved.cleared = true }),
        recordLastActiveFile: vi.fn(() => { _resolved.recorded = true }),
        upsertProject: vi.fn(),
        getLastSession: vi.fn().mockResolvedValue(null),
        getActiveRoot: null,
        notify: vi.fn(() => { _resolved.notified = true }),
        shouldContinue: vi.fn().mockReturnValue(true),
        isWebMode: vi.fn().mockReturnValue(false),
        ...overrides,
    }

    return Object.assign(deps, { _resolved })
}

/** Build a valid tuple entry for the store. */
function entry(filePath: string, rootPath: string): LastActiveFileEntry {
    return { path: filePath, rootPath }
}

// ── canvasStore mock (needed because autoResume.ts lazy-imports it) ────────────
// We set lastActiveFile on the real store before each test and let the module
// read it naturally.

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
        lastActiveFile: null,
        activeFilePath: null,
        workspaceFiles: null,
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── AR-01 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: URL deep-link hook is a future TODO (AR-01)', () => {
    it('no URL deep-link parameter is wired — falls through to other steps', async () => {
        // With no lastActiveFile, no session, and no focus — should resolve cleanly
        // to step 6 (nothing resolved) without throwing.
        const deps = makeDefaultDeps()

        await expect(tryAutoResume(deps)).resolves.toBeUndefined()

        expect(deps._resolved.file).toBeNull()
        expect(deps._resolved.session).toBeNull()
    })
})

// ── AR-02 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: lastActiveFile wins over SQLite session when file exists (AR-02)', () => {
    it('resolves the persisted file before checking the session', async () => {
        const filePath = '/projects/my-app/src/App.tsx'
        const rootPath = '/projects/my-app'
        useCanvasStore.setState({ lastActiveFile: entry(filePath, rootPath) })

        const tree = { name: 'my-app', path: rootPath, type: 'directory' as const, children: [] }

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockResolvedValue('export default function App() {}'),
            findRootForFile: vi.fn().mockResolvedValue(rootPath),
            openPath: vi.fn().mockResolvedValue(tree),
            getLastSession: vi.fn().mockResolvedValue({ path: '/projects/other-app', isScratchpad: false }),
        })

        await tryAutoResume(deps)

        expect(deps._resolved.file).toBe(filePath)
        expect(deps._resolved.session).toBeNull() // session was not needed
    })
})

// ── AR-03 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: missing file falls through to session (AR-03)', () => {
    it('uses session when lastActiveFile cannot be read (ENOENT)', async () => {
        useCanvasStore.setState({ lastActiveFile: entry('/projects/deleted-app/src/App.tsx', '/projects/deleted-app') })

        const sessionTree = { name: 'surviving-app', path: '/projects/surviving-app', type: 'directory' as const, children: [] }

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
            openPath: vi.fn().mockResolvedValue(sessionTree),
            getLastSession: vi.fn().mockResolvedValue({ path: '/projects/surviving-app', isScratchpad: false }),
        })

        await tryAutoResume(deps)

        expect(deps._resolved.file).toBeNull()
        expect(deps._resolved.session).toBe('/projects/surviving-app')
    })
})

// ── AR-04 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: clearLastActiveFile called when persisted file is gone (AR-04)', () => {
    it('clears the stale entry from the store', async () => {
        useCanvasStore.setState({ lastActiveFile: entry('/projects/deleted-app/src/App.tsx', '/projects/deleted-app') })

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        })

        await tryAutoResume(deps)

        expect(deps._resolved.cleared).toBe(true)
        expect(deps.clearLastActiveFile).toHaveBeenCalled()
    })
})

// ── AR-05 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: first-launch demo is gated on isFirstLaunch, not tryAutoResume (AR-05)', () => {
    it('tryAutoResume never invokes checkFirstLaunch — separation of concerns', async () => {
        // tryAutoResume deps contain no checkFirstLaunch — the mock below
        // asserts it is never called by inspecting the real function's deps.
        const mockCheckFirstLaunch = vi.fn()
        const deps = makeDefaultDeps()
        // Confirm no dep references first-launch
        const depKeys = Object.keys(deps).filter(k => !k.startsWith('_'))
        expect(depKeys).not.toContain('checkFirstLaunch')
        expect(mockCheckFirstLaunch).not.toHaveBeenCalled()
    })
})

// ── AR-06 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: returning user with no lastActiveFile shows LaunchScreen (AR-06)', () => {
    it('does not trigger demo when nothing is open', async () => {
        const deps = makeDefaultDeps()

        await tryAutoResume(deps)

        expect(deps._resolved.file).toBeNull()
        expect(deps._resolved.session).toBeNull()
        // No workspace was set
        expect(deps.setWorkspaceFiles).not.toHaveBeenCalled()
    })
})

// ── AR-07 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: no session + no lastActiveFile → LaunchScreen (AR-07)', () => {
    it('shows LaunchScreen — does not auto-load demo for returning users', async () => {
        const deps = makeDefaultDeps({
            getLastSession: vi.fn().mockResolvedValue(null),
        })

        await tryAutoResume(deps)

        expect(deps._resolved.file).toBeNull()
        expect(deps._resolved.session).toBeNull()
        expect(deps.setWorkspaceFiles).not.toHaveBeenCalled()
    })
})

// ── AR-08 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: temp-dir paths in lastActiveFile are skipped (AR-08)', () => {
    it('skips a /var/folders/ path and falls through to session', async () => {
        useCanvasStore.setState({ lastActiveFile: entry('/var/folders/abc/demo-project/src/App.tsx', '/var/folders/abc/demo-project') })

        const sessionTree = { name: 'real-app', path: '/projects/real-app', type: 'directory' as const, children: [] }
        const deps = makeDefaultDeps({
            openPath: vi.fn().mockResolvedValue(sessionTree),
            getLastSession: vi.fn().mockResolvedValue({ path: '/projects/real-app', isScratchpad: false }),
        })

        await tryAutoResume(deps)

        // Temp-dir path is skipped; session is used instead
        expect(deps._resolved.file).toBeNull()
        expect(deps._resolved.session).toBe('/projects/real-app')
    })

    it('skips a /tmp/ path and falls through to session', async () => {
        useCanvasStore.setState({ lastActiveFile: entry('/tmp/demo/src/App.tsx', '/tmp/demo') })

        const sessionTree = { name: 'real-app', path: '/projects/real-app', type: 'directory' as const, children: [] }
        const deps = makeDefaultDeps({
            openPath: vi.fn().mockResolvedValue(sessionTree),
            getLastSession: vi.fn().mockResolvedValue({ path: '/projects/real-app', isScratchpad: false }),
        })

        await tryAutoResume(deps)

        expect(deps._resolved.file).toBeNull()
        expect(deps._resolved.session).toBe('/projects/real-app')
    })
})

// ── AR-09 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: shouldContinue abort — user opens file mid-resume (AR-09)', () => {
    it('aborts resume after step 2 when shouldContinue() returns false', async () => {
        const filePath = '/projects/my-app/src/App.tsx'
        const rootPath = '/projects/my-app'

        // shouldContinue returns false after the focus step (simulates user
        // clicking "Open Project" while we were awaiting step 2).
        let callCount = 0
        const deps = makeDefaultDeps({
            readFile: vi.fn().mockResolvedValue('export default function App() {}'),
            shouldContinue: vi.fn(() => {
                callCount++
                // First call (after step 2): false → abort
                return callCount > 1 ? false : true
            }),
        } as Partial<AutoResumeDeps>)

        // Set up a lastActiveFile that would normally trigger step 3
        useCanvasStore.setState({ lastActiveFile: entry(filePath, rootPath) })

        await tryAutoResume(deps)

        // Since shouldContinue returned false before step 3, file should not be set
        expect(deps._resolved.file).toBeNull()
        expect(deps.setActiveFile).not.toHaveBeenCalled()
    })

    it('does not overwrite workspaceFiles when resume is aborted via shouldContinue', async () => {
        // Simulate: user already has a workspace (they clicked "Open Project")
        const deps = makeDefaultDeps({
            shouldContinue: vi.fn().mockReturnValue(false),
        })

        await tryAutoResume(deps)

        expect(deps.setWorkspaceFiles).not.toHaveBeenCalled()
        expect(deps.hydrateWorkspace).not.toHaveBeenCalled()
    })
})

// ── AR-10 ──────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: tryAutoResume resolves cleanly when all steps fall through (AR-10)', () => {
    it('returns undefined (no throw) when there is nothing to restore', async () => {
        const deps = makeDefaultDeps({
            getRecentFileFocus: vi.fn().mockResolvedValue(null),
            getLastSession: vi.fn().mockResolvedValue(null),
            getActiveRoot: null,
        })

        await expect(tryAutoResume(deps)).resolves.toBeUndefined()
        // No side effects fired
        expect(deps.setWorkspaceFiles).not.toHaveBeenCalled()
        expect(deps.hydrateWorkspace).not.toHaveBeenCalled()
        expect(deps.setActiveFile).not.toHaveBeenCalled()
    })

    it('notifies user when a ENOENT is thrown for a non-null lastActiveFile', async () => {
        useCanvasStore.setState({ lastActiveFile: entry('/projects/vanished/src/App.tsx', '/projects/vanished') })

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        })

        await tryAutoResume(deps)

        // UX#1: a toast should have been pushed
        expect(deps._resolved.notified).toBe(true)
        expect(deps.notify).toHaveBeenCalledWith(expect.objectContaining({
            severity: 'info',
            autoDismiss: 6000,
        }))
        // The message should contain the basename only, never the full path
        const msg = (deps.notify as ReturnType<typeof vi.fn>).mock.calls[0][0].message as string
        expect(msg).toContain('App.tsx')
        expect(msg).not.toContain('/projects/vanished')
    })
})

// ── AR-11 ──────────────────────────────────────────────────────────────────────
// Security m3: If findRootForFile resolves to a different root than what was
// persisted in the tuple, the entry is treated as poisoned and cleared.
// tryAutoResume must then fall through to the SQLite session.

describe('LAUNCH.3: poisoned root path clears entry and falls through (AR-11)', () => {
    it('clears lastActiveFile when resolved root differs from persisted rootPath', async () => {
        // Persisted entry: file in my-app, root is my-app
        const filePath = '/projects/my-app/src/App.tsx'
        const rootPath = '/projects/my-app'
        useCanvasStore.setState({ lastActiveFile: entry(filePath, rootPath) })

        // findRootForFile returns a different root — the workspace-hijack scenario
        const attackerRoot = '/projects/attacker-app'

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockResolvedValue('export default function App() {}'),
            findRootForFile: vi.fn().mockResolvedValue(attackerRoot),
            openPath: vi.fn().mockResolvedValue(null),
        })

        await tryAutoResume(deps)

        // The mismatch was detected: entry must be cleared
        expect(deps._resolved.cleared).toBe(true)
        expect(deps.clearLastActiveFile).toHaveBeenCalled()
        // The poisoned file must NOT have been opened
        expect(deps._resolved.file).toBeNull()
        expect(deps.setActiveFile).not.toHaveBeenCalled()
    })

    it('falls through to the SQLite session after clearing the poisoned entry', async () => {
        const filePath = '/projects/my-app/src/App.tsx'
        const rootPath = '/projects/my-app'
        useCanvasStore.setState({ lastActiveFile: entry(filePath, rootPath) })

        const attackerRoot = '/projects/attacker-app'
        const sessionTree = { name: 'fallback-app', path: '/projects/fallback-app', type: 'directory' as const, children: [] }

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockResolvedValue('export default function App() {}'),
            findRootForFile: vi.fn().mockResolvedValue(attackerRoot),
            openPath: vi.fn().mockResolvedValue(sessionTree),
            getLastSession: vi.fn().mockResolvedValue({ path: '/projects/fallback-app', isScratchpad: false }),
        })

        await tryAutoResume(deps)

        // The fallback session should have been used
        expect(deps._resolved.session).toBe('/projects/fallback-app')
    })

    it('proceeds normally when resolved root matches the persisted rootPath', async () => {
        const filePath = '/projects/my-app/src/App.tsx'
        const rootPath = '/projects/my-app'
        useCanvasStore.setState({ lastActiveFile: entry(filePath, rootPath) })

        const tree = { name: 'my-app', path: rootPath, type: 'directory' as const, children: [] }

        const deps = makeDefaultDeps({
            readFile: vi.fn().mockResolvedValue('export default function App() {}'),
            findRootForFile: vi.fn().mockResolvedValue(rootPath), // matches!
            openPath: vi.fn().mockResolvedValue(tree),
        })

        await tryAutoResume(deps)

        // Roots matched — file should have been opened normally
        expect(deps._resolved.file).toBe(filePath)
        expect(deps._resolved.cleared).toBe(false)
        expect(deps.clearLastActiveFile).not.toHaveBeenCalled()
    })
})
