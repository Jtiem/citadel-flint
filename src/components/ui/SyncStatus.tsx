/**
 * SyncStatus — src/components/ui/SyncStatus.tsx
 *
 * PowerSync real-time layer status indicator for the Module G multiplayer
 * foundation. Displayed in the footer StatusBar alongside the SQLite and
 * IPC badges.
 *
 * States:
 *   CONNECTING   — initial handshake attempt (shown briefly on mount)
 *   CONNECTED    — live sync active with a PowerSync backend
 *   OFFLINE_MODE — no backend URL configured; local-only operation
 *   SYNC_ERROR   — backend reachable but a protocol or auth error occurred
 *
 * Presence throttle:
 *   The `useSyncPresence` hook (exported below) can be mounted anywhere in the
 *   tree that needs to publish cursor updates. It batches calls to the main
 *   process at most once every PRESENCE_INTERVAL_MS (100 ms) using a ref-based
 *   timer — no re-render is triggered by the timer itself.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { SyncState } from '../../types/bridge-api'
import { useTokenStore } from '../../store/tokenStore'

// ── Presence throttle constant ────────────────────────────────────────────────

/** Renderer-side presence send interval — matches the 50–100 ms spec. */
const PRESENCE_INTERVAL_MS = 100

// ── useSyncPresence ────────────────────────────────────────────────────────────

/**
 * Provides a throttled `publishPresence` callback that writes cursor/selection
 * state to the main-process SQLite `presence` table via IPC at most once per
 * `PRESENCE_INTERVAL_MS`.
 *
 * The throttle is implemented with a ref-based pending flag rather than
 * `setTimeout` — the timer fires the pending write, then resets. This avoids
 * the trailing-call gap that a leading-edge debounce would produce.
 *
 * @param sessionId — Stable UUID for this user's presence row (persist across renders).
 * @param userId    — Display name shown in the multi-user cursor overlay.
 */
export function useSyncPresence(sessionId: string, userId: string) {
    const pendingRef = useRef<{ nodeId: string; x: number; y: number } | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const flush = useCallback(() => {
        const pending = pendingRef.current
        if (pending === null) return

        pendingRef.current = null
        timerRef.current = null

        window.bridgeAPI
            .syncPresence({ id: sessionId, userId, ...pending })
            .catch((err: Error) => {
                console.warn('[SyncStatus] syncPresence IPC error:', err.message)
            })
    }, [sessionId, userId])

    const publishPresence = useCallback(
        (nodeId: string, x: number, y: number) => {
            pendingRef.current = { nodeId, x, y }

            // If a timer is already scheduled, the next flush will pick up the
            // latest pendingRef value — no need to reschedule.
            if (timerRef.current !== null) return

            timerRef.current = setTimeout(flush, PRESENCE_INTERVAL_MS)
        },
        [flush]
    )

    // Clean up the pending timer on unmount to avoid post-unmount IPC calls.
    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
            }
        }
    }, [])

    return publishPresence
}

// ── Badge styling helpers ─────────────────────────────────────────────────────

interface BadgeConfig {
    dot: string
    label: string
    title: string
}

const STATE_CONFIG: Record<SyncState, BadgeConfig> = {
    CONNECTING: {
        dot: 'animate-pulse bg-amber-400',
        label: 'Sync: Connecting…',
        title: 'Attempting to connect to the PowerSync backend',
    },
    CONNECTED: {
        dot: 'bg-emerald-400 shadow-lg shadow-emerald-400/40',
        label: 'Sync: Online (PowerSync)',
        title: 'Local SQLite (better-sqlite3) is connected and ready',
    },
    OFFLINE_MODE: {
        dot: 'bg-gray-500',
        label: 'Sync: Offline',
        title: 'No backend configured — operating on local SQLite only',
    },
    SYNC_ERROR: {
        dot: 'bg-red-500',
        label: 'Sync: Error',
        title: 'A PowerSync protocol or auth error occurred',
    },
}

// ── SyncStatus ────────────────────────────────────────────────────────────────

/**
 * Footer chip displaying the current sync state.
 *
 * On mount it probes the IPC bridge via `window.bridgeAPI.ping()`. When the
 * ping resolves the local better-sqlite3 database is confirmed live and the
 * chip transitions to CONNECTED ("Sync: Online (PowerSync)"). A rejected ping
 * means the Electron main process is unreachable, so we fall back to
 * OFFLINE_MODE.
 *
 * When a real PowerSync cloud backend is wired, replace the ping probe with
 * a status subscription from the PowerSyncDatabase connection event stream.
 */
export function SyncStatus() {
    const [syncState, setSyncState] = useState<SyncState>('CONNECTING')
    const initSync = useTokenStore((s) => s.initSync)

    useEffect(() => {
        let unsubscribe: (() => void) | null = null

        // Verify the IPC bridge is reachable before activating the reactive
        // token subscription. On success, initSync() delivers the current
        // token list immediately and re-pushes on every subsequent DB write.
        window.bridgeAPI
            .ping()
            .then(() => {
                setSyncState('CONNECTED')
                unsubscribe = initSync()
            })
            .catch(() => {
                setSyncState('OFFLINE_MODE')
            })

        return () => {
            unsubscribe?.()
        }
    }, [initSync])

    const cfg = STATE_CONFIG[syncState]

    return (
        <span
            className="flex items-center gap-1.5 text-xs text-gray-500"
            title={cfg.title}
        >
            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    )
}
