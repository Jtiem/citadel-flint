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

import { useState, useEffect } from 'react'
import type { PresenceRow } from '../types/bridge-api'
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
            window.bridgeAPI
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
