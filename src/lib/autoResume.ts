/**
 * autoResume.ts — pure, injectable tryAutoResume function.
 *
 * Extracted from App.tsx (LAUNCH.3 review fix — Code M1) so the precedence
 * ladder can be exercised in tests without mounting the full App component.
 *
 * All I/O is injected through the `AutoResumeDeps` interface. The real
 * implementation in App.tsx wires real IPC / store calls; tests pass fakes.
 */

import type { FileTreeNode } from '../types/flint-api'
import { isTransientPath } from './pathGuards'

// ── Dependency interface ──────────────────────────────────────────────────────

export interface AutoResumeDeps {
    /** Read file content from disk — throws on ENOENT */
    readFile: (path: string) => Promise<string>
    /** Returns the project root for a file path, or null if not found */
    findRootForFile: ((path: string) => Promise<string | null>) | null
    /** Opens a project by root path and returns the file tree */
    openPath: (root: string) => Promise<FileTreeNode | null>
    /** Returns a recently focused file from the IDE (≤60s), or null */
    getRecentFileFocus: () => Promise<string | null>
    /** Sets the workspace tree in the canvas store */
    setWorkspaceFiles: (tree: FileTreeNode) => void
    /** Opens a specific file — called after workspace is set */
    setActiveFile: (path: string) => Promise<void>
    /** Hydrates the workspace and opens its primary file */
    hydrateWorkspace: (tree: FileTreeNode) => Promise<void>
    /** Clears the persisted lastActiveFile from store + localStorage */
    clearLastActiveFile: () => void
    /**
     * Persists a {path, rootPath} tuple to both Zustand state and localStorage.
     * Called after a successful setActiveFile + findRootForFile sequence.
     */
    recordLastActiveFile: (path: string, rootPath: string) => void
    /** Persists a project to the registry */
    upsertProject?: (entry: { name: string; path: string }) => void
    /** Retrieves the last SQLite session */
    getLastSession: () => Promise<{ path: string; isScratchpad: boolean } | null>
    /** Retrieves the active project root for web-mode (--project CLI flag) */
    getActiveRoot: (() => Promise<{ projectRoot: string } | null>) | null
    /** Pushes a notification to the global toast queue */
    notify: (opts: { message: string; severity: 'info' | 'warning' | 'error'; autoDismiss?: number }) => void
    /** Returns true when the user has already opened something — abort the resume */
    shouldContinue: () => boolean
    /** Returns true if we're running in web mode (globalThis.__FLINT_WEB__ is set) */
    isWebMode: () => boolean
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * tryAutoResume — attempts to restore the last open file/project on startup.
 *
 * Precedence ladder (first match wins):
 *   1. Deep-link via URL hash/query — Reserved for future implementation.
 *   2. Recent file:focus event (IDE → Glass fast path, ≤60s).
 *   3. lastActiveFile from localStorage — verified on disk before loading.
 *   4. Last saved session from SQLite.
 *   5. Web-mode active project root (--project CLI flag).
 *   6. Nothing resolved — caller should show LaunchScreen.
 */
export async function tryAutoResume(deps: AutoResumeDeps): Promise<void> {
    const {
        readFile,
        findRootForFile,
        openPath,
        getRecentFileFocus,
        setWorkspaceFiles,
        setActiveFile,
        hydrateWorkspace,
        clearLastActiveFile,
        recordLastActiveFile,
        upsertProject,
        getLastSession,
        getActiveRoot,
        notify,
        shouldContinue,
        isWebMode,
    } = deps

    // ── Step 1: Reserved for future deep-link support ─────────────────────────
    // Reserved for future deep-link support — intentionally unimplemented; no consumer exists yet.

    // ── Step 2: Recent file:focus event (IDE → Glass fast path) ──────────────
    // If Claude edited a file within the last 60 seconds, open that project
    // and file directly so the user never sees the LaunchScreen.
    try {
        const focusFile = await getRecentFileFocus()
        if (focusFile && findRootForFile) {
            const root = await findRootForFile(focusFile)
            if (root && !isTransientPath(root)) {
                const tree = await openPath(root)
                if (tree) {
                    upsertProject?.({ name: tree.name, path: tree.path })
                    setWorkspaceFiles(tree)
                    await setActiveFile(focusFile)
                    return
                }
            }
        }
    } catch (err) {
        console.warn('[Flint] tryAutoResume: file:focus fast path failed, continuing', (err as Error)?.message)
    }

    if (!shouldContinue()) return

    // ── Step 3: lastActiveFile from localStorage (LAUNCH.3) ───────────────────
    // We read the {path, rootPath} tuple from the store (already validated via
    // readPersistedLastActiveFile). Verify the file still exists AND that
    // findRootForFile returns the same root that was persisted (Security m3:
    // workspace-hijack guard via planted package.json ancestor).
    try {
        // Import store lazily to avoid a circular dependency at module load time.
        const { useCanvasStore } = await import('../store/canvasStore')
        const lastFile = useCanvasStore.getState().lastActiveFile
        console.log('[Flint] tryAutoResume: lastActiveFile =', lastFile)

        if (lastFile && !isTransientPath(lastFile.path)) {
            const content = await readFile(lastFile.path)
            if (typeof content === 'string') {
                if (!shouldContinue()) return

                if (findRootForFile) {
                    const root = await findRootForFile(lastFile.path)
                    if (root && !isTransientPath(root)) {
                        // Security m3: root-mismatch guard. If findRootForFile now
                        // returns a different root than what was persisted, the entry
                        // may be poisoned (planted package.json). Reject and clear.
                        if (root !== lastFile.rootPath) {
                            console.warn(
                                '[Flint] tryAutoResume: rootPath mismatch — persisted root differs ' +
                                'from resolved root; clearing lastActiveFile',
                            )
                            clearLastActiveFile()
                            // fall through to Step 4
                        } else {
                            const tree = await openPath(root)
                            if (tree) {
                                upsertProject?.({ name: tree.name, path: tree.path })
                                setWorkspaceFiles(tree)
                                await setActiveFile(lastFile.path)
                                recordLastActiveFile(lastFile.path, root)
                                return
                            }
                        }
                    } else {
                        // findRootForFile returned null — self-hosting signal or
                        // path outside any known project. Do NOT fall through to
                        // setActiveFile without a workspace; clear the entry.
                        clearLastActiveFile()
                        // fall through to Step 4
                    }
                } else {
                    // findRootForFile not available (older server) — open the
                    // file directly without a project tree rather than losing it.
                    await setActiveFile(lastFile.path)
                    return
                }
            }
        }
    } catch (err) {
        // File gone, IPC unavailable, or self-hosting guard threw.
        // Show a toast so the user knows why their file didn't reopen,
        // then clear the stale entry and continue.
        const code = (err as { code?: string })?.code ?? 'unknown'
        console.warn('[Flint] tryAutoResume: lastActiveFile no longer accessible:', code)

        // Retrieve lastFile for the toast basename — re-read from store.
        try {
            const { useCanvasStore } = await import('../store/canvasStore')
            const stale = useCanvasStore.getState().lastActiveFile
            if (stale) {
                const basename = stale.path.split('/').pop() ?? stale.path
                notify({
                    message: `Couldn't reopen ${basename} — the file has moved or been deleted.`,
                    severity: 'info',
                    autoDismiss: 6000,
                })
            }
        } catch { /* ignore — best-effort toast */ }

        clearLastActiveFile()
        // fall through to Step 4
    }

    if (!shouldContinue()) return

    // ── Step 4: Last saved session from SQLite (LAUNCH.2) ────────────────────
    try {
        const session = await getLastSession()
        if (session) {
            if (!session.isScratchpad && !isTransientPath(session.path)) {
                const tree = await openPath(session.path)
                if (tree) {
                    await hydrateWorkspace(tree)
                    return
                }
            }
        }
    } catch {
        // Path no longer valid — fall through
    }

    if (!shouldContinue()) return

    // ── Step 5: Web-mode active project root (--project CLI flag) ─────────────
    if (isWebMode() && getActiveRoot) {
        try {
            const activeRoot = await getActiveRoot()
            if (activeRoot?.projectRoot) {
                const tree = await openPath(activeRoot.projectRoot)
                if (tree) {
                    await hydrateWorkspace(tree)
                    return
                }
            }
        } catch {
            // No active root available — fall through to LaunchScreen
        }
    }

    // ── Step 6: Nothing resolved — show LaunchScreen ──────────────────────────
    // Correct empty state for a returning user with no open project.
    // The first-launch demo is handled exclusively by the WS1 effect in App.tsx,
    // which checks isFirstLaunch from ~/.flint/setup.json.
    console.log('[Flint] tryAutoResume: no file to restore — showing LaunchScreen')
}
