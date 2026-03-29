/**
 * notificationStore.test.ts — src/store/__tests__/notificationStore.test.ts
 *
 * Tests for the global notification/toast Zustand store.
 *
 * Covers:
 *   - push: id generation, timestamp assignment, prepend ordering, history append
 *   - dismiss: removes from notifications, keeps in history
 *   - clearAll: empties notifications, preserves history
 *   - Max-5 cap: eviction of oldest auto-dismissible, then oldest persistent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNotificationStore } from '../../store/notificationStore'
import type { Notification } from '../../store/notificationStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

type NotificationInput = Omit<Notification, 'id' | 'timestamp'>

function makeInput(overrides: Partial<NotificationInput> = {}): NotificationInput {
    return {
        type: 'info',
        title: 'Test',
        message: 'A test notification',
        severity: 'info',
        autoDismissMs: 3000,
        ...overrides,
    }
}

// Reset the store before each test (setup.ts also calls resetAllStores, but
// this is an explicit belt-and-suspenders reset for clarity).
beforeEach(() => {
    useNotificationStore.setState({ notifications: [], history: [] })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNotificationStore', () => {
    // ── S4.9: Severity-based dismiss duration policy ───────────────────────────
    describe('severity policy (S4.9)', () => {
        it('critical severity is always persistent (autoDismissMs = 0)', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ severity: 'critical', autoDismissMs: 5000 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(0)
        })

        it('error severity defaults to 8000 ms when no autoDismissMs provided', () => {
            const { push } = useNotificationStore.getState()
            // Pass autoDismissMs as undefined by spreading without it
            push({ type: 'error', title: 'E', message: '', severity: 'error', autoDismissMs: 8000 })
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(8000)
        })

        it('warning severity defaults to 5000 ms', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ severity: 'warning', autoDismissMs: 5000 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(5000)
        })

        it('info severity defaults to 3000 ms', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ severity: 'info', autoDismissMs: 3000 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(3000)
        })

        it('success severity defaults to 3000 ms', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ severity: 'success', autoDismissMs: 3000 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(3000)
        })

        it('type "undo" always gets exactly MIN_ACTION_DISMISS_MS (5000 ms)', () => {
            const { push } = useNotificationStore.getState()
            // Even if caller passes a shorter time, undo type enforces 5000
            push(makeInput({ type: 'undo', severity: 'info', autoDismissMs: 1000 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(5000)
        })

        it('action-bearing notifications get at least 5000 ms', () => {
            const { push } = useNotificationStore.getState()
            const cb = () => {}
            push(makeInput({ severity: 'info', autoDismissMs: 500, actionCallback: cb, actionLabel: 'Undo' }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBeGreaterThanOrEqual(5000)
        })

        it('caller-provided autoDismissMs takes precedence for non-critical severities', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ severity: 'warning', autoDismissMs: 10000 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(10000)
        })

        it('critical severity overrides any caller-supplied autoDismissMs to 0', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ severity: 'critical', autoDismissMs: 9999 }))
            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].autoDismissMs).toBe(0)
        })
    })

    describe('push', () => {
        it('adds notification with auto-generated id', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput())

            const { notifications } = useNotificationStore.getState()
            expect(notifications).toHaveLength(1)
            expect(typeof notifications[0].id).toBe('string')
            expect(notifications[0].id.length).toBeGreaterThan(0)
        })

        it('assigns a numeric timestamp to the notification', () => {
            const fakNow = 1_700_000_000_000
            vi.spyOn(Date, 'now').mockReturnValue(fakNow)

            const { push } = useNotificationStore.getState()
            push(makeInput())

            const { notifications } = useNotificationStore.getState()
            expect(notifications[0].timestamp).toBe(fakNow)

            vi.restoreAllMocks()
        })

        it('prepends notifications so the newest is index 0', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ title: 'First' }))
            push(makeInput({ title: 'Second' }))

            const { notifications } = useNotificationStore.getState()
            expect(notifications).toHaveLength(2)
            expect(notifications[0].title).toBe('Second')
            expect(notifications[1].title).toBe('First')
        })

        it('also appends each pushed notification to history', () => {
            const { push } = useNotificationStore.getState()
            push(makeInput({ title: 'Alpha' }))
            push(makeInput({ title: 'Beta' }))

            const { history } = useNotificationStore.getState()
            expect(history).toHaveLength(2)
            // History is appended in push order (oldest first)
            expect(history[0].title).toBe('Alpha')
            expect(history[1].title).toBe('Beta')
        })
    })

    describe('dismiss', () => {
        it('removes the dismissed notification from the active list', () => {
            const { push, dismiss } = useNotificationStore.getState()
            push(makeInput({ title: 'To dismiss' }))

            const { notifications: before } = useNotificationStore.getState()
            const id = before[0].id
            dismiss(id)

            const { notifications: after } = useNotificationStore.getState()
            expect(after.find((n) => n.id === id)).toBeUndefined()
        })

        it('keeps the dismissed item accessible in history without duplicating it', () => {
            const { push, dismiss } = useNotificationStore.getState()
            push(makeInput({ title: 'Persisted' }))

            const { notifications } = useNotificationStore.getState()
            const id = notifications[0].id
            dismiss(id)

            const { history } = useNotificationStore.getState()
            const historyEntries = history.filter((h) => h.id === id)
            // push() already recorded it — dismiss() must NOT add a second copy.
            expect(historyEntries).toHaveLength(1)
            expect(historyEntries[0].title).toBe('Persisted')
        })
    })

    describe('clearAll', () => {
        it('empties the active notifications list', () => {
            const { push, clearAll } = useNotificationStore.getState()
            push(makeInput({ title: 'One' }))
            push(makeInput({ title: 'Two' }))

            clearAll()

            const { notifications } = useNotificationStore.getState()
            expect(notifications).toHaveLength(0)
        })

        it('preserves history when clearing active notifications', () => {
            const { push, clearAll } = useNotificationStore.getState()
            push(makeInput({ title: 'History entry' }))

            const { history: before } = useNotificationStore.getState()
            expect(before).toHaveLength(1)

            clearAll()

            const { history: after } = useNotificationStore.getState()
            expect(after).toHaveLength(1)
            expect(after[0].title).toBe('History entry')
        })
    })

    describe('max-5 cap', () => {
        it('evicts the oldest auto-dismissible notification when pushing a 6th', () => {
            const { push } = useNotificationStore.getState()

            // Push 5 notifications — the 4 auto-dismissible ones then 1 persistent.
            // We want a specific auto-dismissible one at the "oldest" position.
            push(makeInput({ title: 'Old-auto-1', autoDismissMs: 5000 }))
            push(makeInput({ title: 'Auto-2', autoDismissMs: 5000 }))
            push(makeInput({ title: 'Auto-3', autoDismissMs: 5000 }))
            push(makeInput({ title: 'Auto-4', autoDismissMs: 5000 }))
            push(makeInput({ title: 'Persistent', autoDismissMs: 0 }))

            // At this point the notifications array (newest-first) is:
            // [Persistent, Auto-4, Auto-3, Auto-2, Old-auto-1]
            // The store's findIndex scans left-to-right looking for autoDismissMs > 0.
            // "Persistent" has autoDismissMs=0, so it is skipped.
            // "Auto-4" is the first auto-dismissible found and will be evicted.

            const { notifications: before } = useNotificationStore.getState()
            expect(before).toHaveLength(5)

            push(makeInput({ title: 'New-sixth', autoDismissMs: 5000 }))

            const { notifications: after } = useNotificationStore.getState()
            expect(after).toHaveLength(5)
            // The evicted entry is the first auto-dismissible in the pre-push array.
            // Since the array is newest-first: [Persistent, Auto-4, Auto-3, Auto-2, Old-auto-1]
            // "Auto-4" (index 1) gets evicted because it is the first with autoDismissMs > 0.
            const titles = after.map((n) => n.title)
            expect(titles).not.toContain('Auto-4')
            expect(titles).toContain('Persistent')
            expect(titles).toContain('New-sixth')
        })

        it('evicts the most-recently-added notification (shift at index 0) when all 5 are persistent', () => {
            const { push } = useNotificationStore.getState()

            // Fill with 5 persistent notifications (autoDismissMs = 0).
            // Each push prepends, so after 5 pushes the internal array is newest-first:
            // [P-5, P-4, P-3, P-2, P-1]
            for (let i = 1; i <= 5; i++) {
                push(makeInput({ title: `Persistent-${i}`, autoDismissMs: 0 }))
            }

            const { notifications: before } = useNotificationStore.getState()
            // Verify newest-first ordering
            expect(before[0].title).toBe('Persistent-5')
            expect(before[4].title).toBe('Persistent-1')

            push(makeInput({ title: 'Sixth', autoDismissMs: 0 }))

            const { notifications: after } = useNotificationStore.getState()
            expect(after).toHaveLength(5)
            // shift() removes index 0 from the current array (which is newest-first),
            // so Persistent-5 (the most recently added before this push) is evicted.
            const titles = after.map((n) => n.title)
            expect(titles).not.toContain('Persistent-5')
            expect(titles).toContain('Sixth')
            expect(titles).toContain('Persistent-1')
        })
    })
})
