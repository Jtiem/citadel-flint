/**
 * Canvas Store — src/store/canvasStore.ts
 *
 * Phase E additions:
 *   mithrilViolations — flint IDs whose current style has ΔE > 2.0 against
 *                       their closest design token.
 *   overridesExist    — true when the component_overrides DB table is non-empty.
 *   a11yViolations    — Record<flintId, string[]> from A11yLinter. Each key is
 *                       a data-flint-id (or fallback label) and each value is an
 *                       array of human-readable rule violation messages.
 *   canExport         — derived selector: false when any of the above are present.
 *                       This is the Export Gate (Commandments 5 + 6).
 *
 * triggerAutoSave is called by editorStore mutations and by setCode (debounced).
 * It enqueues an atomic write via window.flintAPI.saveFile (IPC → main process
 * → FileTransactionManager) and transitions saveState accordingly:
 *
 *   idle ──(change)──► editing ──(debounce fires)──► saving ──(write ok)──► saved ──(2s)──► idle
 *                                                              └──(write err)──► idle
 *
 * The module-level _saveTimer variable is safe because this is a singleton store.
 */

import { create } from 'zustand'
import type { FileTreeNode, FlintPolicy } from '../types/flint-api'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SaveState = 'idle' | 'editing' | 'saving' | 'saved'
export type CanvasMode = 'design' | 'interact'
export type RightTab = 'properties' | 'tokens' | 'activity' | 'health' | 'agents' | 'scope' | 'recovery'

/**
 * Responsive preview breakpoint for the LivePreview container.
 *   mobile  — 375 px (iPhone SE)
 *   tablet  — 768 px (iPad)
 *   desktop — full width (no constraint, current default)
 *
 * Cycling order (forward): mobile → tablet → desktop → mobile.
 * Controlled by Shift+scroll in preview mode and by the StatusBar chip.
 */
export type PreviewBreakpoint = 'mobile' | 'tablet' | 'desktop'

/** Pixel widths for each breakpoint. Desktop has no constraint (undefined). */
export const BREAKPOINT_WIDTHS: Record<PreviewBreakpoint, number | undefined> = {
    mobile: 375,
    tablet: 768,
    desktop: undefined,
}

/** Human-readable labels for the StatusBar chip. */
export const BREAKPOINT_LABELS: Record<PreviewBreakpoint, string> = {
    mobile: 'Mobile 375px',
    tablet: 'Tablet 768px',
    desktop: 'Desktop',
}

/** Forward cycling order. */
const BREAKPOINT_CYCLE: PreviewBreakpoint[] = ['mobile', 'tablet', 'desktop']

/**
 * The three canvas view modes. Only 'preview' is functional in CV2.1.
 * 'build' and 'govern' render placeholder panels until CV2.3/CV2.4.
 *
 *   preview — current behavior: single LivePreview iframe node on the canvas
 *   build   — component library cards (CV2.3 will implement)
 *   govern  — compliance map cards (CV2.4 will implement)
 *
 * Note: do not confuse with `canvasMode` ('design' | 'interact'), which controls
 * pointer-event behavior within the LivePreview iframe. `canvasView` controls
 * which top-level content the canvas area shows — these are orthogonal concerns.
 */
export type CanvasView = 'preview' | 'build' | 'govern'

/**
 * Bounding box for a single flint node as reported by the in-iframe
 * flint-init script via NODE_LAYOUT postMessage. All values are in
 * iframe-relative pixels (origin = top-left of the iframe).
 */
export interface NodeLayout {
    x: number
    y: number
    width: number
    height: number
}

// ── Store shape ────────────────────────────────────────────────────────────────

interface CanvasState {
    /** The data-flint-id of the element being dragged, or null when idle. */
    dragSourceId: string | null
    /** The data-flint-id of the element currently selected in the canvas, or null. */
    activeSelection: string | null
    /** Absolute path of the file loaded into the editor, or null when no file is open. */
    activeFilePath: string | null
    /** Current phase of the auto-save pipeline. */
    saveState: SaveState
    /** True when Governance Autopilot is active for the current file. */
    autopilotEnabled: boolean
    /** Post-fix governed source code, null when no fix available or autopilot off. */
    governedCode: string | null
    /** Count of violations fixable by applying the governed version. */
    governedFixCount: number
    /** Timestamp of the last autopilot result. */
    governedTimestamp: number | null
    /** True when the ⌘K command palette overlay is open. */
    commandPaletteOpen: boolean
    /**
     * Flint IDs of elements whose current style value produces a CIEDE2000 ΔE > 2.0
     * against the closest design token. Empty array = no violations.
     *
     * Set by PropertiesPanel after every className commit via MithrilLinter.
     */
    mithrilViolations: string[]
    /**
     * True when the `component_overrides` table contains at least one row.
     * Polled by the Export Gate; updated via setOverridesExist.
     */
    overridesExist: boolean
    /**
     * Recursive file tree returned by `window.flintAPI.openFolder()`.
     * Null when no project folder has been opened.
     */
    workspaceFiles: FileTreeNode | null
    /**
     * Set of absolute directory paths currently expanded in the FileExplorer.
     * A Set is used so each FileNode can check membership in O(1).
     * Always create a new Set reference on mutation so Zustand detects the change.
     */
    expandedFolders: Set<string>
    /**
     * Accessibility violations discovered by `A11yLinter.audit()` on the current AST.
     * Keyed by `data-flint-id` (or a positional fallback like `"img-3"`).
     * Each value is an array of human-readable rule messages (e.g. A11Y-001 …).
     * An empty object means the file passes all accessibility checks.
     */
    a11yViolations: Record<string, string[]>
    /**
     * Current interaction mode for the Live Preview canvas.
     *   'design'   — IDE selection active; clicks select AST nodes.
     *   'interact' — Native events pass through; clicking tests the component.
     */
    canvasMode: CanvasMode
    /**
     * Current canvas view mode (CV2.1).
     *   'preview' — Live Preview iframe (default, current behavior).
     *   'build'   — Component library cards (CV2.3 placeholder).
     *   'govern'  — Compliance map cards (CV2.4 placeholder).
     *
     * Resets to 'preview' on closeWorkspace so view state never bleeds
     * across projects. This field is renderer-only — not written to
     * .flint/context.json (the MCP server does not need to know the view).
     */
    canvasView: CanvasView
    /**
     * Bounding boxes for every flint node that has reported a NODE_LAYOUT
     * postMessage from the iframe. Keyed by data-flint-id.
     * Used by ShieldOverlay to position governance badges and heat tints.
     */
    nodeLayouts: Record<string, NodeLayout>
    /**
     * The currently active tab in the right inspector panel.
     * Stored here so ShieldOverlay can switch to 'properties' on badge click
     * without prop-drilling through LivePreview → ShieldOverlay.
     */
    rightTab: RightTab
    /**
     * Cached governance policy from `.flint/policy.json`.
     * Loaded via `policy:get` IPC on project open; null when no project is open
     * or the IPC surface is unavailable (e.g. Vitest).
     *
     * Used by canExport() to determine which violation categories block export.
     */
    cachedPolicy: FlintPolicy | null
    /**
     * Current responsive breakpoint for the Live Preview container.
     * Controls the maxWidth applied to the preview iframe wrapper.
     * Only meaningful when canvasView === 'preview'.
     *
     * Resets to 'desktop' on closeWorkspace.
     */
    previewBreakpoint: PreviewBreakpoint
}

interface CanvasActions {
    /** Begin a drag — called on CANVAS_DRAG_START from the iframe. */
    startDrag: (sourceId: string) => void
    /** End or cancel a drag — called on Shield mouseUp / mouseLeave. */
    endDrag: () => void
    /** Set the canvas selection — called on CANVAS_CLICK from the iframe. */
    setActiveSelection: (id: string | null) => void
    /**
     * Opens `filePath` in the editor with the Clean Slate Protocol applied:
     *   1. If the current file has unsaved edits (saveState === 'editing'),
     *      the in-flight changes are flushed to disk before switching.
     *   2. `editorStore.clearAST()` wipes all prior AST / layer tree state so
     *      no "Ghost Layers" from the previous file survive the transition.
     *   3. The new file's content is read via IPC and fed to `editorStore.setCode`.
     *
     * Returns a Promise so callers can await the full load sequence.
     */
    setActiveFile: (filePath: string) => Promise<void>
    /**
     * Stores the recursive FileTreeNode tree returned by `openFolder()`.
     * Called by App.tsx after a successful folder open.
     */
    setWorkspaceFiles: (tree: FileTreeNode | null) => void
    /**
     * Toggles the expanded state of `folderPath` in `expandedFolders`.
     * Always creates a new Set so Zustand's equality check detects the change.
     */
    toggleFolder: (folderPath: string) => void
    /**
     * Enqueue an auto-save for `code` to `activeFilePath`.
     *
     * @param code       — New source content to persist.
     * @param debounceMs — If > 0, wait this many ms before saving (for Monaco
     *                     typing). Pass 0 (default) for immediate writes after
     *                     explicit AST mutations.
     *
     * No-op when `activeFilePath` is null (no file open).
     * Clears any pending debounced save before scheduling a new one.
     */
    triggerAutoSave: (code: string, debounceMs?: number) => void
    /**
     * Replaces the full set of active Mithril violation flint IDs.
     * Pass an empty array to clear all violations.
     */
    setMithrilViolations: (ids: string[]) => void
    /**
     * Updates the overridesExist flag. Call with `true` after detecting that
     * the component_overrides table is non-empty, `false` when it's clear.
     */
    setOverridesExist: (exists: boolean) => void
    /**
     * Replaces the full accessibility violations map produced by `A11yLinter.audit()`.
     * Pass an empty object `{}` to clear all violations.
     * Called from `editorStore.setCode` on every successful AST parse.
     */
    setA11yViolations: (violations: Record<string, string[]>) => void
    /**
     * Switches the canvas between 'design' (IDE selection active) and
     * 'interact' (native pointer events pass through to the iframe) mode.
     */
    setCanvasMode: (mode: CanvasMode) => void
    /**
     * Switches the canvas view mode (CV2.1). Called by:
     *   - CanvasViewToggle segmented control clicks
     *   - Cmd+1/2/3 keyboard shortcuts in App.tsx
     */
    setCanvasView: (view: CanvasView) => void
    /**
     * Records a single node's bounding box as reported by the iframe.
     * Called from ShieldOverlay when a NODE_LAYOUT postMessage arrives.
     */
    setNodeLayout: (id: string, layout: NodeLayout) => void
    /**
     * Switches the active right inspector tab. Called by ShieldOverlay when
     * the user clicks a violation badge (click-to-properties).
     */
    setRightTab: (tab: RightTab) => void
    /**
     * Loads the governance policy from the main process via `policy:get` IPC.
     * Caches the result in `cachedPolicy` for synchronous access by `canExport()`.
     * Call on project open and after any `flint_set_policy` MCP tool call.
     */
    loadPolicy: () => Promise<void>
    /**
     * Directly sets the cached policy (e.g. from a test or fallback).
     */
    setCachedPolicy: (policy: FlintPolicy | null) => void
    /**
     * Sets the preview breakpoint explicitly. Accepts 'mobile', 'tablet', or 'desktop'.
     */
    setPreviewBreakpoint: (breakpoint: PreviewBreakpoint) => void
    /**
     * Cycles the preview breakpoint in the requested direction.
     *   'up'   — mobile → tablet → desktop → mobile (forward cycle)
     *   'down' — desktop → tablet → mobile → desktop (reverse cycle)
     * No-op when canvasView !== 'preview'.
     */
    cyclePreviewBreakpoint: (direction: 'up' | 'down') => void
    /**
     * Toggles the Governance Autopilot on or off.
     */
    setAutopilotEnabled: (enabled: boolean) => void
    /**
     * Stores the governed source and fix count from the latest autopilot result.
     * Pass null for code to clear the governed state without touching the flag.
     */
    setGovernedResult: (code: string | null, fixCount: number) => void
    /**
     * Clears the governed result (code, count, timestamp) without disabling autopilot.
     * Called when the file changes or fixes are applied.
     */
    clearGovernedResult: () => void
    /** Opens or closes the ⌘K command palette. */
    setCommandPaletteOpen: (open: boolean) => void
    /**
     * Returns to the Launch Screen by nullifying all workspace state.
     * Cancels any pending auto-save timer before clearing state.
     */
    closeWorkspace: () => void
    /**
     * Export Gate selector (Phase E — Commandments 5 + 6).
     *
     * Returns `false` when ANY of the following are true:
     *   - One or more elements have a CIEDE2000 ΔE > 2.0 MithrilViolation.
     *   - The `component_overrides` table has at least one active row.
     *   - The `a11yViolations` map has at least one entry (Commandment 5).
     *
     * Returns `true` only when the file is fully clean and ready to export.
     */
    canExport: () => boolean
}

// ── Module-level timer — singleton store, one timer is sufficient ──────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
    dragSourceId: null,
    activeSelection: null,
    activeFilePath: null,
    saveState: 'idle',
    mithrilViolations: [],
    overridesExist: false,
    a11yViolations: {},
    workspaceFiles: null,
    expandedFolders: new Set<string>(),
    canvasMode: 'design' as CanvasMode,
    canvasView: 'preview' as CanvasView,
    nodeLayouts: {},
    rightTab: 'properties' as RightTab,
    cachedPolicy: null,
    autopilotEnabled: false,
    governedCode: null,
    governedFixCount: 0,
    governedTimestamp: null,
    commandPaletteOpen: false,
    previewBreakpoint: 'desktop' as PreviewBreakpoint,

    startDrag: (sourceId) => set({ dragSourceId: sourceId }),
    endDrag: () => set({ dragSourceId: null }),
    setActiveSelection: (id) => set({ activeSelection: id }),

    setWorkspaceFiles: (tree) => set({ workspaceFiles: tree }),

    toggleFolder: (folderPath) =>
        set((state) => {
            const next = new Set(state.expandedFolders)
            if (next.has(folderPath)) {
                next.delete(folderPath)
            } else {
                next.add(folderPath)
            }
            return { expandedFolders: next }
        }),

    setActiveFile: async (filePath: string) => {
        const { saveState, activeFilePath } = get()

        // ── Dirty-file flush ─────────────────────────────────────────────────
        // If the current file has uncommitted edits, save them before switching
        // so no work is lost. This is the "Atomic Write Check" from Task 4.
        if (saveState === 'editing' && activeFilePath) {
            if (_saveTimer !== null) {
                clearTimeout(_saveTimer)
                _saveTimer = null
            }
            // Lazy import to avoid a circular module dependency:
            // canvasStore ← editorStore ← canvasStore.
            const { useEditorStore } = await import('./editorStore')
            const currentCode = useEditorStore.getState().rawCode
            if (currentCode) {
                try {
                    set({ saveState: 'saving' })
                    await window.flintAPI.saveFile(activeFilePath, currentCode)
                } catch (err) {
                    console.error('[Flint] Pre-switch save failed:', err)
                } finally {
                    set({ saveState: 'idle' })
                }
            }
        }

        // ── Clean Slate Protocol (Mithril Rule) ──────────────────────────────
        // Wipe the AST and all layer-tree state BEFORE setting the new path.
        // This removes every data-flint-id overlay from the previous file
        // immediately, preventing "Ghost Layers".
        const { useEditorStore } = await import('./editorStore')
        useEditorStore.getState().clearAST()

        set({ activeFilePath: filePath, saveState: 'idle' })

        // ── Hydrate editor with new file content ─────────────────────────────
        try {
            const content = await window.flintAPI.readFile(filePath)
            useEditorStore.getState().setCode(content)
        } catch (err) {
            console.error('[Flint] Failed to read file:', err)
        }
    },

    setMithrilViolations: (ids) => set({ mithrilViolations: ids }),
    setOverridesExist: (exists) => set({ overridesExist: exists }),
    setA11yViolations: (violations) => set({ a11yViolations: violations }),
    setCanvasMode: (mode) => set({ canvasMode: mode }),
    setCanvasView: (view) => set({ canvasView: view }),
    setPreviewBreakpoint: (breakpoint) => set({ previewBreakpoint: breakpoint }),
    cyclePreviewBreakpoint: (direction) => {
        const { previewBreakpoint } = get()
        const currentIndex = BREAKPOINT_CYCLE.indexOf(previewBreakpoint)
        const len = BREAKPOINT_CYCLE.length
        const nextIndex =
            direction === 'up'
                ? (currentIndex + 1) % len
                : (currentIndex - 1 + len) % len
        set({ previewBreakpoint: BREAKPOINT_CYCLE[nextIndex] })
    },
    setNodeLayout: (id, layout) =>
        set((state) => ({ nodeLayouts: { ...state.nodeLayouts, [id]: layout } })),
    setRightTab: (tab) => set({ rightTab: tab }),

    loadPolicy: async () => {
        try {
            const policy = await window.flintAPI.policy?.get()
            if (policy) {
                set({ cachedPolicy: policy })
            }
        } catch (err) {
            console.error('[Flint] Failed to load policy:', err)
        }
    },

    setCachedPolicy: (policy) => set({ cachedPolicy: policy }),

    setAutopilotEnabled: (enabled) => set({ autopilotEnabled: enabled }),

    setGovernedResult: (code, fixCount) =>
        set({ governedCode: code, governedFixCount: fixCount, governedTimestamp: Date.now() }),

    clearGovernedResult: () =>
        set({ governedCode: null, governedFixCount: 0, governedTimestamp: null }),

    setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

    closeWorkspace: () => {
        if (_saveTimer !== null) {
            clearTimeout(_saveTimer)
            _saveTimer = null
        }
        set({
            workspaceFiles: null,
            activeFilePath: null,
            activeSelection: null,
            dragSourceId: null,
            mithrilViolations: [],
            overridesExist: false,
            a11yViolations: {},
            saveState: 'idle',
            expandedFolders: new Set<string>(),
            canvasMode: 'design',
            canvasView: 'preview',
            nodeLayouts: {},
            rightTab: 'properties',
            commandPaletteOpen: false,
            cachedPolicy: null,
            autopilotEnabled: false,
            governedCode: null,
            governedFixCount: 0,
            governedTimestamp: null,
            previewBreakpoint: 'desktop',
        })
    },

    canExport: () => {
        const { mithrilViolations, overridesExist, a11yViolations, cachedPolicy } = get()
        const exportGate = cachedPolicy?.export_gate

        // When no policy is loaded, use the default behaviour: all gates active
        const blockOnMithril = exportGate?.block_on_mithril ?? true
        const blockOnA11y = exportGate?.block_on_a11y ?? true
        const blockOnOverrides = exportGate?.block_on_overrides ?? true

        // Additionally, if a category is in 'advisory' or 'off' mode, skip its gate
        const mithrilMode = cachedPolicy?.mithril?.mode ?? 'blocking'
        const a11yMode = cachedPolicy?.a11y?.mode ?? 'blocking'

        const mithrilBlocks = blockOnMithril && mithrilMode === 'blocking' && mithrilViolations.length > 0
        const a11yBlocks = blockOnA11y && a11yMode === 'blocking' && Object.keys(a11yViolations).length > 0
        const overridesBlock = blockOnOverrides && overridesExist

        return !mithrilBlocks && !a11yBlocks && !overridesBlock
    },

    triggerAutoSave: (code: string, debounceMs = 0) => {
        // No-op when no project is open
        if (!get().activeFilePath) return

        // Cancel any pending debounced save
        if (_saveTimer !== null) {
            clearTimeout(_saveTimer)
            _saveTimer = null
        }

        const doSave = () => {
            // Re-read filePath at call-time in case setActiveFile was called
            // between the debounce start and the timer firing.
            const filePath = get().activeFilePath
            if (!filePath) return

            set({ saveState: 'saving' })
            window.flintAPI
                .saveFile(filePath, code)
                .then(() => {
                    set({ saveState: 'saved' })
                    // Reset to idle 2 s after a successful save
                    _saveTimer = setTimeout(() => {
                        set({ saveState: 'idle' })
                        _saveTimer = null
                    }, 2000)
                })
                .catch((err: unknown) => {
                    console.error('[Flint] Auto-save failed:', err)
                    set({ saveState: 'idle' })
                })
        }

        if (debounceMs > 0) {
            set({ saveState: 'editing' })
            _saveTimer = setTimeout(doSave, debounceMs)
        } else {
            doSave()
        }
    },
}))
