/**
 * useRemotePresence — src/hooks/useRemotePresence.ts
 *
 * Polls the main-process `presence` table at 5 Hz (every 200ms) and returns
 * the rows for every active user except the local session, enabling the Shield
 * overlay in LivePreview to render remote-cursor SVGs.
 *
 * "Active" is defined by the main-process query: rows whose `updated_at`
 * timestamp is within the last 30 seconds. Stale rows are naturally excluded.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useMemo } from 'react'
import type { PresenceRow } from '../types/flint-api'
import { presenceSessionId } from '../services/PresenceService'

const POLL_INTERVAL_MS = 200 // 5 reads/sec

/**
 * Returns an array of PresenceRow objects for remote users whose presence
 * was updated within the last 30 seconds. The local user's own row is always
 * filtered out using the stable `presenceSessionId`.
 */
export function useRemotePresence(): PresenceRow[] {
    const [rows, setRows] = useState<PresenceRow[]>([])

    useEffect(() => {
        const id = setInterval(() => {
            window.flintAPI
                .readPresence()
                .then((all) => {
                    setRows(all.filter((r) => r.id !== presenceSessionId))
                })
                .catch((err: Error) => {
                    console.warn('[useRemotePresence] poll error:', err.message)
                })
        }, POLL_INTERVAL_MS)

        return () => clearInterval(id)
    }, [])

    return rows
}

// ── Phase C.2: AST Conflict Arbiter ───────────────────────────────────────────

/**
 * Returns the Set of `locked_node_id` values currently held by remote users.
 * An empty string in `locked_node_id` means the user is idle (not dragging).
 * Only non-empty values are included so callers can use `.has(flintId)`.
 *
 * This is derived from `useRemotePresence` — no additional IPC calls.
 */
export function useLockedNodeIds(): Set<string> {
    const rows = useRemotePresence()
    return useMemo(
        () =>
            new Set(
                rows
                    .map((r) => r.node_id ?? '')
                    .filter((id) => id !== ''),
            ),
        [rows],
    )
}

/**
 * Returns `true` when `flintId` is currently locked by any remote user
 * (i.e. they have started dragging it). Returns `false` for null/empty IDs.
 *
 * @example
 * const isLocked = useIsNodeLocked(selectedNodeId)
 */
export function useIsNodeLocked(flintId: string | null | undefined): boolean {
    const lockedIds = useLockedNodeIds()
    if (!flintId) return false
    return lockedIds.has(flintId)
}
