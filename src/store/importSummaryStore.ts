/**
 * Import Summary Store — src/store/importSummaryStore.ts
 *
 * Zustand v5 store for Phase ING.2: Ingestion-Time Audit & Auto-Heal summary.
 *
 * This store holds the result of the IngestionAuditor.heal() pass that runs in
 * the main process after each Figma /ingest-ast call. The summary is pushed
 * from main -> renderer via the 'bridge:import-summary' IPC channel and received
 * by the useEffect listener in App.tsx (see contract Section 5.2).
 *
 * State:
 *   summary      — The IngestionSummary from the last heal pass, or null.
 *   isVisible    — Whether the ImportSummary toast/panel is currently shown.
 *   isPanelMode  — true = full panel; false = toast.
 *
 * Actions:
 *   setSummary        — Receives a new summary from IPC, makes it visible.
 *   dismiss           — Hides the UI and clears the summary.
 *   openPanel         — Escalates from toast to panel mode.
 *   removeTier2Item   — Removes a single tier-2 flag after successful snap.
 *   replaceWithPreHeal — Clears the summary after undo-all-heals.
 *
 * Derived selectors (as actions for Zustand selector pattern):
 *   hasTier2Items — true when there are unresolved tier-2 flags.
 *   isAllClean    — true when tier2 is empty and tier3Unknown is 0.
 *
 * Anti-pattern guard:
 *   This store does NOT call window.bridgeAPI. IPC calls happen in component
 *   useEffect hooks (App.tsx for onSummary, ImportSummary.tsx for snapToToken
 *   and undoAllHeals). Cross-store imports are also prohibited.
 *
 * Renderer process only — no Node.js imports.
 */

import { create } from 'zustand'
import type { IngestionSummary } from '../types/bridge-api'

// ── Store shape ────────────────────────────────────────────────────────────────

interface ImportSummaryState {
    /** Current import summary from the last heal pass. null = nothing in progress. */
    summary: IngestionSummary | null
    /** Whether the toast or panel is currently visible. */
    isVisible: boolean
    /** true = full panel variant; false = compact toast variant. */
    isPanelMode: boolean
}

interface ImportSummaryActions {
    /**
     * Receives a new IngestionSummary from the IPC push event.
     * Sets isVisible = true and determines whether to start in toast or panel
     * mode based on tier1 + tier2 count (> 10 = panel, else toast).
     */
    setSummary: (summary: IngestionSummary) => void

    /**
     * Dismisses the toast or panel and clears the summary.
     * The preHealCode inside the summary is also cleared here — it exists only
     * for the lifetime of the active import session (contract Section 11.3).
     */
    dismiss: () => void

    /**
     * Escalates from toast to full panel mode.
     * Called when the user clicks the "Review" button on the toast.
     */
    openPanel: () => void

    /**
     * Removes a single tier-2 flag after the user successfully snapped it to a
     * token via the import:snap-to-token IPC call.
     * If no tier-2 items remain and tier3Unknown is 0, the panel auto-closes.
     */
    removeTier2Item: (nodeId: string) => void

    /**
     * Clears the summary after the user has reverted all tier-1 heals.
     * Called by the "Undo all heals" handler in ImportSummary.tsx after the
     * import:undo-all-heals IPC call completes successfully.
     */
    replaceWithPreHeal: () => void

    /**
     * Derived selector: true when summary has at least one unresolved tier-2 flag.
     * Returning from getState().hasTier2Items() avoids stale closure issues.
     */
    hasTier2Items: () => boolean

    /**
     * Derived selector: true when all auto-fix opportunities are resolved —
     * tier2Flagged is empty and tier3Unknown is 0.
     */
    isAllClean: () => boolean
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useImportSummaryStore = create<ImportSummaryState & ImportSummaryActions>(
    (set, get) => ({
        // ── Initial state ─────────────────────────────────────────────────────
        summary: null,
        isVisible: false,
        isPanelMode: false,

        // ── Actions ───────────────────────────────────────────────────────────

        setSummary: (summary: IngestionSummary) => {
            // Auto-escalate to panel when the total item count exceeds 10
            // (contract Section 5.1: "Panel variant when user clicks Review or item count > 10")
            const totalItems = summary.tier1Fixed.length + summary.tier2Flagged.length
            const shouldUsePanel = totalItems > 10
            set({ summary, isVisible: true, isPanelMode: shouldUsePanel })
        },

        dismiss: () => {
            set({ summary: null, isVisible: false, isPanelMode: false })
        },

        openPanel: () => {
            set({ isPanelMode: true })
        },

        removeTier2Item: (nodeId: string) => {
            const current = get().summary
            if (!current) return

            const remaining = current.tier2Flagged.filter((f) => f.nodeId !== nodeId)
            const updated: IngestionSummary = { ...current, tier2Flagged: remaining }

            // Auto-close when all tier-2 items are resolved and no tier-3 remain
            // (contract Section 5.1: "Panel auto-closes when all tier-2 items are resolved")
            if (remaining.length === 0 && updated.tier3Unknown === 0) {
                set({ summary: null, isVisible: false, isPanelMode: false })
            } else {
                set({ summary: updated })
            }
        },

        replaceWithPreHeal: () => {
            set({ summary: null, isVisible: false, isPanelMode: false })
        },

        // ── Derived selectors ─────────────────────────────────────────────────

        hasTier2Items: () => {
            const s = get().summary
            return (s?.tier2Flagged.length ?? 0) > 0
        },

        isAllClean: () => {
            const s = get().summary
            if (!s) return true
            return s.tier2Flagged.length === 0 && s.tier3Unknown === 0
        },
    })
)

// ── Named selector hooks ───────────────────────────────────────────────────────

/**
 * Subscribes to the current IngestionSummary only.
 * Use in components that render the summary content to avoid re-rendering
 * on isPanelMode/isVisible state changes.
 */
export const useIngestionSummary = () =>
    useImportSummaryStore((s) => s.summary)

/**
 * Subscribes to the visibility state only.
 * Use in App.tsx or layout components to conditionally mount ImportSummary.
 */
export const useImportSummaryVisible = () =>
    useImportSummaryStore((s) => s.isVisible)
