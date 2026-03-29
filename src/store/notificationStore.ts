/**
 * Notification Store — src/store/notificationStore.ts
 *
 * Zustand v5 store for the global notification/toast system.
 * This is the universal feedback channel that replaces per-panel status messages.
 *
 * Rules:
 *   - Max 5 concurrent notifications. When pushing a 6th, the oldest
 *     auto-dismissible notification is silently removed first.
 *   - Dismissed notifications are moved to history (session-scoped).
 *   - clearAll() wipes active notifications but preserves history.
 */

import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
    id: string
    type: 'mutation' | 'undo' | 'violation' | 'sync' | 'error' | 'info'
    title: string
    message: string
    /**
     * Severity drives the auto-dismiss duration (see DEFAULT_DISMISS_MS) and
     * the visual color treatment of the toast.
     *
     * critical — persistent until manually dismissed (blocks export / hard stop)
     * error    — 8 000 ms (actionable, important, but not a hard blocker)
     * warning  — 5 000 ms
     * info     — 3 000 ms
     * success  — 3 000 ms
     */
    severity: 'critical' | 'success' | 'warning' | 'error' | 'info'
    /** Milliseconds before auto-dismiss. 0 = persistent until manually dismissed. */
    autoDismissMs: number
    actionLabel?: string
    actionCallback?: () => void
    timestamp: number
}

type NotificationInput = Omit<Notification, 'id' | 'timestamp'>

interface NotificationState {
    notifications: Notification[]
    /** Persists dismissed notifications for the session (read-only audit trail). */
    history: Notification[]

    /** Push a new notification. Generates id and timestamp automatically. */
    push: (n: NotificationInput) => void
    /** Remove a notification from the active list and move it to history. */
    dismiss: (id: string) => void
    /** Remove all active notifications, keeping history intact. */
    clearAll: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CONCURRENT = 5
const MAX_HISTORY = 200

/**
 * Default auto-dismiss durations by severity.
 *
 * Policy (S4.9):
 *   critical → 0 (persistent — hard blocker, never auto-dismiss)
 *   error    → 8 000 ms (important but not a hard stop)
 *   warning  → 5 000 ms
 *   info     → 3 000 ms
 *   success  → 3 000 ms
 *
 * Callers may still pass an explicit autoDismissMs to override.
 */
const DEFAULT_DISMISS_MS: Record<Notification['severity'], number> = {
    critical: 0,     // Persistent — hard blocker, must be manually dismissed
    error:    8000,
    warning:  5000,
    success:  3000,
    info:     3000,
}

/**
 * Minimum dismiss time for notifications with action buttons.
 * Undo/redo toasts need enough time for the user to read and click.
 */
const MIN_ACTION_DISMISS_MS = 5000

// ── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    history: [],

    push(n: NotificationInput) {
        // Derive the dismiss duration from the severity table.
        // A caller may still supply an explicit autoDismissMs — that takes
        // precedence as long as it is a finite number.
        let dismissMs =
            typeof n.autoDismissMs === 'number' && isFinite(n.autoDismissMs)
                ? n.autoDismissMs
                : DEFAULT_DISMISS_MS[n.severity]

        // Critical severity is always persistent regardless of what the caller set.
        if (n.severity === 'critical') {
            dismissMs = 0
        }

        // Undo / redo notifications (type === 'undo') need enough dwell time
        // for the user to see and act on the action button.
        if (n.type === 'undo') {
            dismissMs = MIN_ACTION_DISMISS_MS
        }

        // Any toast with an action button needs at least MIN_ACTION_DISMISS_MS
        // so users have time to click the action before it disappears.
        if (n.actionCallback && dismissMs > 0 && dismissMs < MIN_ACTION_DISMISS_MS) {
            dismissMs = MIN_ACTION_DISMISS_MS
        }

        const incoming: Notification = {
            ...n,
            autoDismissMs: dismissMs,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        }

        set((state) => {
            let current = [...state.notifications]

            // Enforce max-5 cap: if at limit, evict the oldest auto-dismissible
            // notification before adding the new one.
            if (current.length >= MAX_CONCURRENT) {
                const evictIdx = current.findIndex((t) => t.autoDismissMs > 0)
                if (evictIdx !== -1) {
                    current.splice(evictIdx, 1)
                } else {
                    // All remaining are persistent — evict the oldest regardless.
                    current.shift()
                }
            }

            // Prepend so newest renders at the logical "top" of the array.
            current = [incoming, ...current]

            const nextHistory = [...state.history, incoming]
            return {
                notifications: current,
                history: nextHistory.length > MAX_HISTORY ? nextHistory.slice(-MAX_HISTORY) : nextHistory,
            }
        })
    },

    dismiss(id: string) {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        }))
    },

    clearAll() {
        set((state) => {
            const alreadyInHistory = new Set(state.history.map((h) => h.id))
            const toArchive = state.notifications.filter(
                (n) => !alreadyInHistory.has(n.id)
            )
            return {
                notifications: [],
                history: [...state.history, ...toArchive],
            }
        })
    },
}))
