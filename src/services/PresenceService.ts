/**
 * PresenceService — src/services/PresenceService.ts
 *
 * Module-level singleton for broadcasting the local user's presence
 * (cursor position + active drag element) to the main-process SQLite DB
 * via the Electron IPC flint.
 *
 * Two write modes:
 *   publishPresence()          — throttled at 100ms (max 10 writes/sec).
 *                                 Safe to call at 60fps; entirely decoupled
 *                                 from the local rAF update loop.
 *   publishPresenceImmediate() — bypasses the throttle for broadcast-lock
 *                                 events (drag start / drag end) where
 *                                 timeliness matters more than rate-limiting.
 *
 * Session identity (presenceSessionId / presenceUserId) is generated once
 * per page lifetime and exported for use in polling hooks that need to
 * filter out the local user's own row.
 *
 * Renderer Process only — no Node.js imports.
 */

// ── Session identity ───────────────────────────────────────────────────────

/** Stable UUID that uniquely identifies this user's presence row in SQLite. */
export const presenceSessionId: string = crypto.randomUUID()

/** Human-readable display handle shown in the remote-cursor overlay. */
export const presenceUserId: string =
    `User-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

// ── Throttle state ─────────────────────────────────────────────────────────

const THROTTLE_MS = 100 // 10 writes/sec maximum

let _pending: { x: number; y: number; nodeId: string } | null = null
let _timer: ReturnType<typeof setTimeout> | null = null

function _flush(): void {
    const p = _pending
    _pending = null
    _timer = null
    if (p === null) return
    window.flintAPI
        .syncPresence({
            id: presenceSessionId,
            userId: presenceUserId,
            nodeId: p.nodeId,
            x: p.x,
            y: p.y,
        })
        .catch((err: Error) => {
            console.warn('[PresenceService] syncPresence error:', err.message)
        })
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Queues a presence write for the next throttle window.
 * At most one IPC call fires per THROTTLE_MS interval.
 * Safe to call on every mousemove / rAF tick — the DB write is decoupled.
 */
export function publishPresence(x: number, y: number, nodeId: string): void {
    _pending = { x, y, nodeId }
    if (_timer !== null) return
    _timer = setTimeout(_flush, THROTTLE_MS)
}

/**
 * Writes presence to the DB immediately, bypassing the throttle queue.
 * Use for broadcast-lock transitions:
 *   drag start → publishPresenceImmediate(0, 0, dragSourceId)
 *   drag end   → publishPresenceImmediate(0, 0, '')
 *
 * Cancels any pending throttled write to prevent a stale follow-up flush.
 */
export function publishPresenceImmediate(x: number, y: number, nodeId: string): void {
    if (_timer !== null) {
        clearTimeout(_timer)
        _timer = null
    }
    _pending = null
    window.flintAPI
        .syncPresence({
            id: presenceSessionId,
            userId: presenceUserId,
            nodeId,
            x,
            y,
        })
        .catch((err: Error) => {
            console.warn('[PresenceService] syncPresence (immediate) error:', err.message)
        })
}
