/**
 * Sync Staleness Store — src/store/syncStalenessStore.ts
 *
 * MINT.5 Phase 3 — Sync Staleness Banner (Envoy)
 *
 * Zustand slice tracking the per-session staleness dismissal state.
 *
 * State:
 *   dismissedAt — Unix ms timestamp of the last time the user dismissed the
 *                 staleness banner, or null if never dismissed this session.
 *
 * Actions:
 *   dismiss()        — Records the current timestamp as the dismissal time.
 *                      Called when the user clicks the banner's X button.
 *   clearDismissal() — Resets dismissedAt to null.
 *                      Called by useSyncStaleness when a fresh sync is detected
 *                      (staleSince advanced past the dismissal timestamp).
 *
 * Design notes:
 *   - NO localStorage persistence. Per-session by design — the user should be
 *     re-warned on the next session if the sync is still stale. Phase 4 may
 *     add a policy-gated opt-in for persistence if user signal warrants it.
 *   - NO cross-store imports. IPC calls go in hooks/components, never here.
 *   - Commandment C12 (Atomic Queuing): each action is a single `set` call.
 *
 * Contract: MINT.5-phase3.contract.ts / SyncStalenessStoreState
 * Owner: flint-state-architect
 * Renderer process only — no Node.js imports.
 */

import { create } from 'zustand'
import type { SyncStalenessStoreState } from '../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSyncStalenessStore = create<SyncStalenessStoreState>((set) => ({
    // Initial state: never dismissed.
    dismissedAt: null,

    /**
     * Marks the banner as dismissed for the current session by recording the
     * current Unix-ms timestamp. Calling dismiss() twice overwrites the
     * timestamp with the latest call (most-recent-dismiss semantics).
     */
    dismiss: () => set({ dismissedAt: Date.now() }),

    /**
     * Clears the dismissal, making the banner eligible to show again if the
     * staleness condition is still met. Called by useSyncStaleness when it
     * detects that a fresh sync has completed after the user last dismissed.
     */
    clearDismissal: () => set({ dismissedAt: null }),
}))

// ── Named selector hook ───────────────────────────────────────────────────────

/**
 * Stable selector hook for the `dismissedAt` field.
 * Use this in components that only need to read the dismissal timestamp.
 *
 * @example
 *   const dismissedAt = useSyncStalenessDismissedAt()
 *   const isDismissed = dismissedAt !== null
 */
export function useSyncStalenessDismissedAt(): number | null {
    return useSyncStalenessStore((s) => s.dismissedAt)
}
