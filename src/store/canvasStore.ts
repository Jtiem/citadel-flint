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
import type { FileTreeNode, FlintPolicy, LinterWarning } from '../types/flint-api'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SaveState = 'idle' | 'editing' | 'saving' | 'saved'
export type CanvasMode = 'design' | 'interact'
export type RightTab = 'governance' | 'properties' | 'tokens'

/**
 * Tabs that are always visible regardless of workspace activity.
 * All other tabs unlock progressively as the user's workflow earns them.
 * See OPP-10 in UX-OPPORTUNITIES.md.
 */
export const DEFAULT_UNLOCKED_TABS: ReadonlySet<string> = new Set(['governance', 'properties'])

/** Left panel tabs that are always visible. */
export type LeftTab = 'layers' | 'components' | 'assets' | 'files'

/** Left panel tabs that are always visible. */
export const DEFAULT_UNLOCKED_LEFT_TABS: ReadonlySet<string> = new Set(['layers'])

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
    // --- Workspace & Files ---

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

    // --- Governance & Violations ---

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
    // --- Canvas Layout & UI ---

    /**
     * Current interaction mode for the Live Preview canvas.
     *   'design'   — IDE selection active; clicks select AST nodes.
     *   'interact' — Native events pass through; clicking tests the component.
     */
    canvasMode: CanvasMode
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
    // --- Figma & Sync ---

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
     *
     * Resets to 'desktop' on closeWorkspace.
     */
    previewBreakpoint: PreviewBreakpoint
    /**
     * Set of right-panel tab keys that have been unlocked via progressive
     * disclosure (OPP-10). Tabs not in this set are hidden from the tab bar.
     * Defaults to `DEFAULT_UNLOCKED_TABS` ('governance', 'properties').
     * Persists for the lifetime of the workspace — does NOT reset on closeWorkspace
     * because the user has earned those tabs.
     */
    unlockedTabs: Set<string>
    /**
     * Set of right-panel tab keys the user has already clicked at least once
     * since they were unlocked. Used to suppress the one-time "new" indicator
     * dot once a tab has been visited. Persists for the lifetime of the workspace.
     */
    seenTabs: Set<string>
    /**
     * Set of left-panel tab keys that have been unlocked via progressive
     * disclosure (OPP-11). Defaults to `DEFAULT_UNLOCKED_LEFT_TABS` ('layers').
     */
    unlockedLeftTabs: Set<string>
    /**
     * True once the user has activated a non-desktop preview breakpoint at
     * least once this session. Used by OPP-12 to gate the breakpoint chip.
     */
    hasUsedBreakpoint: boolean

    // ── Herald: IDE sync state (progressive disclosure) ─────────────────────
    /** True once the first flint:ide-file-selected event arrives this session. */
    ideSyncActive: boolean
    /** Timestamp (ms) of the last IDE file sync event. 0 = never received. */
    ideSyncLastEventAt: number
    /** Relative file name from the last IDE sync event (display only). */
    ideSyncLastFile: string | null

    // ── GLASS.1d: Violation scroll target ────────────────────────────────────
    /**
     * When non-null, GovernanceOverlay scrolls to the violation row for this
     * flint ID and resets the value to null. Set by ShieldOverlay badge click
     * to link the canvas badge to the authoritative violation list.
     */
    scrollToViolationId: string | null

    // ── GLASS.1e: Governance rule filter ──────────────────────────────────────
    /**
     * When non-null, GovernanceOverlay filters its violation list to only show
     * violations matching this type. Set by GovernanceDashboard when the user
     * clicks a top-violated-rules row. Cleared by setting to null.
     */
    governanceRuleFilter: LinterWarning['type'] | null

    // ── T5.2: LivePreview node size (persisted across sessions) ─────────────
    /**
     * Width of the LivePreview node on the XY canvas, in pixels.
     * Defaults to 900. Persisted to localStorage so the size survives reloads.
     */
    previewWidth: number
    /**
     * Height of the LivePreview node on the XY canvas, in pixels.
     * Defaults to 600. Persisted to localStorage so the size survives reloads.
     */
    previewHeight: number

    // ── GLASS.3.2: Panel collapse/expand state ──────────────────────────────
    /** Current width of the left panel. Default: 224 (w-56). */
    leftPanelWidth: number
    /** Current width of the right panel. Default: 288 (w-72). */
    rightPanelWidth: number
    /** True when the left panel is collapsed (width forced to 0). */
    leftPanelCollapsed: boolean
    /** True when the right panel is collapsed (width forced to 0). */
    rightPanelCollapsed: boolean
    /** Stored width to restore when expanding the left panel. */
    _leftPanelSavedWidth: number
    /** Stored width to restore when expanding the right panel. */
    _rightPanelSavedWidth: number
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
     * Unlocks a right-panel tab, adding it to `unlockedTabs`.
     * No-op if the tab is already unlocked.
     */
    unlockTab: (tab: string) => void
    /**
     * Records that a tab has been seen (clicked) by the user.
     * Clears the "new" dot for that tab.
     */
    markTabSeen: (tab: string) => void
    /**
     * Returns true when the tab is present in `unlockedTabs`.
     */
    isTabUnlocked: (tab: string) => boolean
    /**
     * Returns true when the tab has been unlocked but not yet seen (clicked).
     * Used to render the one-time "new" indigo dot indicator.
     */
    isTabNew: (tab: string) => boolean
    /**
     * Unlocks a left-panel tab, adding it to `unlockedLeftTabs`.
     */
    unlockLeftTab: (tab: string) => void
    /**
     * Returns true when the left-panel tab is present in `unlockedLeftTabs`.
     */
    isLeftTabUnlocked: (tab: string) => boolean
    /**
     * Records that the user has used a non-desktop breakpoint at least once.
     * Called by cyclePreviewBreakpoint and setPreviewBreakpoint when the
     * resulting breakpoint is not 'desktop'.
     */
    markBreakpointUsed: () => void
    /** Herald: record an IDE sync event (file path + timestamp). */
    recordIDESyncEvent: (filePath: string) => void
    // ── GLASS.1d: Violation scroll target ────────────────────────────────────
    /**
     * Sets the flint ID that GovernanceOverlay should scroll to.
     * Pass null to clear after the scroll completes.
     */
    setScrollToViolationId: (id: string | null) => void
    // ── GLASS.1e: Governance rule filter ──────────────────────────────────────
    /**
     * Filters the GovernanceOverlay violation list to a specific violation type.
     * Pass null to clear the filter and show all violations.
     */
    setGovernanceRuleFilter: (type: LinterWarning['type'] | null) => void
    // ── T5.2: LivePreview node size ────────────────────────────────────────────
    /**
     * Updates the LivePreview node dimensions and persists them to localStorage
     * so the size is restored on the next session.
     */
    setPreviewSize: (width: number, height: number) => void

    // ── GLASS.3.2: Panel collapse/expand actions ──────────────────────────────
    /** Sets the left panel width explicitly (e.g. from a resize drag). */
    setLeftPanelWidth: (w: number) => void
    /** Sets the right panel width explicitly (e.g. from a resize drag). */
    setRightPanelWidth: (w: number) => void
    /** Toggles the left panel between collapsed and expanded. */
    toggleLeftPanel: () => void
    /** Toggles the right panel between collapsed and expanded. */
    toggleRightPanel: () => void

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

// Sequence counter for setActiveFile — prevents interleaved async calls from
// showing wrong content. Each call increments, then checks after each await.
let _setActiveFileSeq = 0

// ── Panel width defaults ───────────────────────────────────────────────────────

const DEFAULT_LEFT_PANEL_WIDTH = 224
const DEFAULT_RIGHT_PANEL_WIDTH = 288

// ── T5.2: LivePreview size persistence ────────────────────────────────────────

const PREVIEW_SIZE_KEY = 'flint:previewSize'

function readPersistedPreviewSize(): { width: number; height: number } {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREVIEW_SIZE_KEY) : null
        if (raw) {
            const parsed = JSON.parse(raw) as unknown
            if (
                parsed !== null &&
                typeof parsed === 'object' &&
                'width' in parsed &&
                'height' in parsed &&
                typeof (parsed as Record<string, unknown>).width === 'number' &&
                typeof (parsed as Record<string, unknown>).height === 'number'
            ) {
                const { width, height } = parsed as { width: number; height: number }
                // Clamp to sane bounds: 300–3840 × 200–2160
                return {
                    width: Math.max(300, Math.min(3840, width)),
                    height: Math.max(200, Math.min(2160, height)),
                }
            }
        }
    } catch {
        // Silently ignore storage errors (private mode, etc.)
    }
    return { width: 900, height: 600 }
}

const _initialPreviewSize = readPersistedPreviewSize()

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
    nodeLayouts: {},
    rightTab: 'properties' as RightTab,
    cachedPolicy: null,
    autopilotEnabled: false,
    governedCode: null,
    governedFixCount: 0,
    governedTimestamp: null,
    commandPaletteOpen: false,
    previewBreakpoint: 'desktop' as PreviewBreakpoint,
    unlockedTabs: new Set<string>(DEFAULT_UNLOCKED_TABS),
    seenTabs: new Set<string>(DEFAULT_UNLOCKED_TABS), // default tabs are pre-seen
    unlockedLeftTabs: new Set<string>(DEFAULT_UNLOCKED_LEFT_TABS),
    hasUsedBreakpoint: false,
    ideSyncActive: false,
    ideSyncLastEventAt: 0,
    ideSyncLastFile: null,

    // T5.2: LivePreview node size — restore from localStorage or use defaults
    previewWidth: _initialPreviewSize.width,
    previewHeight: _initialPreviewSize.height,

    // GLASS.1d: Violation scroll target
    scrollToViolationId: null,

    // GLASS.1e: Governance rule filter
    governanceRuleFilter: null,

    // GLASS.3.2: Panel collapse/expand defaults
    leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
    rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    _leftPanelSavedWidth: DEFAULT_LEFT_PANEL_WIDTH,
    _rightPanelSavedWidth: DEFAULT_RIGHT_PANEL_WIDTH,

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
        // Increment sequence counter — if another setActiveFile call arrives
        // while we're awaiting, our seq will be stale and we bail out.
        const seq = ++_setActiveFileSeq

        const { saveState, activeFilePath } = get()

        // ── Dirty-file flush ─────────────────────────────────────────────────
        // If the current file has uncommitted edits, save them before switching
        // so no work is lost. This is the "Atomic Write Check" from Task 4.
        if (saveState === 'editing' && activeFilePath &&
            !activeFilePath.startsWith('/var/folders/') && !activeFilePath.startsWith('/tmp/')) {
            if (_saveTimer !== null) {
                clearTimeout(_saveTimer)
                _saveTimer = null
            }
            // Lazy import to avoid a circular module dependency:
            // canvasStore ← editorStore ← canvasStore.
            const { useEditorStore } = await import('./editorStore')
            if (seq !== _setActiveFileSeq) return // superseded
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
        if (seq !== _setActiveFileSeq) return // superseded

        // ── Clean Slate Protocol (Mithril Rule) ──────────────────────────────
        // Wipe the AST and all layer-tree state BEFORE setting the new path.
        // This removes every data-flint-id overlay from the previous file
        // immediately, preventing "Ghost Layers".
        const { useEditorStore } = await import('./editorStore')
        if (seq !== _setActiveFileSeq) return // superseded
        useEditorStore.getState().clearAST()

        set({ activeFilePath: filePath, saveState: 'idle' })

        // ── Hydrate editor with new file content ─────────────────────────────
        try {
            const content = await window.flintAPI.readFile(filePath)
            if (seq !== _setActiveFileSeq) return // superseded — don't set stale content
            useEditorStore.getState().setCode(content)
        } catch (err) {
            console.error('[Flint] Failed to read file:', err)
        }
    },

    setMithrilViolations: (ids) => set({ mithrilViolations: ids }),
    setOverridesExist: (exists) => set({ overridesExist: exists }),
    setA11yViolations: (violations) => set({ a11yViolations: violations }),
    setCanvasMode: (mode) => set({ canvasMode: mode }),
    setPreviewBreakpoint: (breakpoint) => {
        set({ previewBreakpoint: breakpoint })
        if (breakpoint !== 'desktop') get().markBreakpointUsed()
    },
    cyclePreviewBreakpoint: (direction) => {
        const { previewBreakpoint } = get()
        const currentIndex = BREAKPOINT_CYCLE.indexOf(previewBreakpoint)
        const len = BREAKPOINT_CYCLE.length
        const nextIndex =
            direction === 'up'
                ? (currentIndex + 1) % len
                : (currentIndex - 1 + len) % len
        const next = BREAKPOINT_CYCLE[nextIndex]
        set({ previewBreakpoint: next })
        if (next !== 'desktop') get().markBreakpointUsed()
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

    unlockTab: (tab) =>
        set((state) => {
            if (state.unlockedTabs.has(tab)) return state
            return { unlockedTabs: new Set([...state.unlockedTabs, tab]) }
        }),

    markTabSeen: (tab) =>
        set((state) => {
            if (state.seenTabs.has(tab)) return state
            return { seenTabs: new Set([...state.seenTabs, tab]) }
        }),

    isTabUnlocked: (tab) => get().unlockedTabs.has(tab),

    isTabNew: (tab) => get().unlockedTabs.has(tab) && !get().seenTabs.has(tab),

    unlockLeftTab: (tab) =>
        set((state) => {
            if (state.unlockedLeftTabs.has(tab)) return state
            return { unlockedLeftTabs: new Set([...state.unlockedLeftTabs, tab]) }
        }),

    isLeftTabUnlocked: (tab) => get().unlockedLeftTabs.has(tab),

    markBreakpointUsed: () => set({ hasUsedBreakpoint: true }),
    recordIDESyncEvent: (filePath: string) => set({
        ideSyncActive: true,
        ideSyncLastEventAt: Date.now(),
        ideSyncLastFile: filePath.split('/').pop() ?? filePath,
    }),

    // GLASS.1d: Violation scroll target
    setScrollToViolationId: (id) => set({ scrollToViolationId: id }),

    // GLASS.1e: Governance rule filter
    setGovernanceRuleFilter: (type) => set({ governanceRuleFilter: type }),

    // ── T5.2: LivePreview node size ────────────────────────────────────────────
    setPreviewSize: (width, height) => {
        if (width === get().previewWidth && height === get().previewHeight) return
        set({ previewWidth: width, previewHeight: height })
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(PREVIEW_SIZE_KEY, JSON.stringify({ width, height }))
            }
        } catch {
            // Silently ignore storage errors
        }
    },

    // ── GLASS.3.2: Panel collapse/expand ────────────────────────────────────
    setLeftPanelWidth: (w) => set({ leftPanelWidth: w }),
    setRightPanelWidth: (w) => set({ rightPanelWidth: w }),

    toggleLeftPanel: () =>
        set((state) => {
            if (state.leftPanelCollapsed) {
                // Expand: restore saved width
                return {
                    leftPanelCollapsed: false,
                    leftPanelWidth: state._leftPanelSavedWidth,
                }
            }
            // Collapse: save current width, set to 0
            return {
                _leftPanelSavedWidth: state.leftPanelWidth,
                leftPanelCollapsed: true,
                leftPanelWidth: 0,
            }
        }),

    toggleRightPanel: () =>
        set((state) => {
            if (state.rightPanelCollapsed) {
                // Expand: restore saved width
                return {
                    rightPanelCollapsed: false,
                    rightPanelWidth: state._rightPanelSavedWidth,
                }
            }
            // Collapse: save current width, set to 0
            return {
                _rightPanelSavedWidth: state.rightPanelWidth,
                rightPanelCollapsed: true,
                rightPanelWidth: 0,
            }
        }),

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
            nodeLayouts: {},
            rightTab: 'properties',
            commandPaletteOpen: false,
            cachedPolicy: null,
            autopilotEnabled: false,
            governedCode: null,
            governedFixCount: 0,
            governedTimestamp: null,
            previewBreakpoint: 'desktop',
            scrollToViolationId: null,
            governanceRuleFilter: null,
            // GLASS.3.2: Reset panel collapse state
            leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
            rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
            leftPanelCollapsed: false,
            rightPanelCollapsed: false,
            _leftPanelSavedWidth: DEFAULT_LEFT_PANEL_WIDTH,
            _rightPanelSavedWidth: DEFAULT_RIGHT_PANEL_WIDTH,
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
            // Never auto-save into temp dirs — macOS cleans these up and the
            // subsequent ENOENT from atomicWrite floods the server log.
            if (filePath.startsWith('/var/folders/') || filePath.startsWith('/tmp/')) return

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
