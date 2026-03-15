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
    severity: 'success' | 'warning' | 'error' | 'info'
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

// ── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    history: [],

    push(n: NotificationInput) {
        const incoming: Notification = {
            ...n,
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
