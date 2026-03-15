/**
 * NotificationCenter.test.tsx
 *
 * 10 tests covering the toast renderer that subscribes to the global
 * notification store. Tests verify rendering, severity styling, dismiss,
 * auto-dismiss, and action callbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useNotificationStore } from '../../../store/notificationStore'
import type { Notification } from '../../../store/notificationStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
    return {
        id: crypto.randomUUID(),
        type: 'info',
        title: 'Test Title',
        message: 'Test message body',
        severity: 'info',
        autoDismissMs: 0,
        timestamp: Date.now(),
        ...overrides,
    }
}

function seedStore(notifications: Notification[]) {
    useNotificationStore.setState({ notifications, history: [] })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('NotificationCenter', () => {
    // 1. Returns null when no notifications
    it('returns null when the notification list is empty', () => {
        seedStore([])
        const { container } = render(<NotificationCenter />)
        expect(container.firstChild).toBeNull()
    })

    // 2. Renders a toast card for each notification
    it('renders a toast card for each notification in the store', () => {
        seedStore([
            makeNotification({ id: 'n1', title: 'First' }),
            makeNotification({ id: 'n2', title: 'Second' }),
        ])
        render(<NotificationCenter />)
        expect(screen.getByText('First')).toBeDefined()
        expect(screen.getByText('Second')).toBeDefined()
    })

    // 3. Shows title and message text
    it('renders both title and message text inside each toast', () => {
        seedStore([makeNotification({ title: 'Hello', message: 'World message' })])
        render(<NotificationCenter />)
        expect(screen.getByText('Hello')).toBeDefined()
        expect(screen.getByText('World message')).toBeDefined()
    })

    // 4. Success severity uses emerald color class
    it('applies emerald color class for success severity', () => {
        seedStore([makeNotification({ severity: 'success', title: 'Done' })])
        render(<NotificationCenter />)
        // The left bar should have bg-emerald-500
        const bar = document.querySelector('.bg-emerald-500')
        expect(bar).not.toBeNull()
    })

    // 5. Warning severity uses amber color class
    it('applies amber color class for warning severity', () => {
        seedStore([makeNotification({ severity: 'warning', title: 'Warn' })])
        render(<NotificationCenter />)
        const bar = document.querySelector('.bg-amber-500')
        expect(bar).not.toBeNull()
    })

    // 6. Error severity uses red color class
    it('applies red color class for error severity', () => {
        seedStore([makeNotification({ severity: 'error', title: 'Err' })])
        render(<NotificationCenter />)
        const bar = document.querySelector('.bg-red-500')
        expect(bar).not.toBeNull()
    })

    // 7. Info severity uses indigo color class
    it('applies indigo color class for info severity', () => {
        seedStore([makeNotification({ severity: 'info', title: 'Info' })])
        render(<NotificationCenter />)
        const bar = document.querySelector('.bg-indigo-500')
        expect(bar).not.toBeNull()
    })

    // 8. Dismiss button calls the store dismiss action
    it('dismiss button removes the notification from the store', () => {
        const n = makeNotification({ id: 'dismiss-me', title: 'Removable' })
        seedStore([n])
        render(<NotificationCenter />)

        const dismissBtn = screen.getByLabelText('Dismiss notification')
        fireEvent.click(dismissBtn)

        const { notifications } = useNotificationStore.getState()
        expect(notifications.find((x) => x.id === 'dismiss-me')).toBeUndefined()
    })

    // 9. Auto-dismiss fires after autoDismissMs using fake timers
    it('auto-dismisses a notification after autoDismissMs elapses', () => {
        vi.useFakeTimers()
        const n = makeNotification({ id: 'auto-bye', autoDismissMs: 3000, title: 'AutoBye' })
        seedStore([n])
        render(<NotificationCenter />)

        expect(useNotificationStore.getState().notifications).toHaveLength(1)

        act(() => {
            vi.advanceTimersByTime(3001)
        })

        expect(useNotificationStore.getState().notifications).toHaveLength(0)
        vi.useRealTimers()
    })

    // 10. Action button calls the callback and dismisses
    it('action button invokes the callback and dismisses the notification', () => {
        const cb = vi.fn()
        const n = makeNotification({
            id: 'action-n',
            title: 'With Action',
            actionLabel: 'Undo',
            actionCallback: cb,
        })
        seedStore([n])
        render(<NotificationCenter />)

        const actionBtn = screen.getByText('Undo')
        fireEvent.click(actionBtn)

        expect(cb).toHaveBeenCalledOnce()
        expect(useNotificationStore.getState().notifications.find((x) => x.id === 'action-n')).toBeUndefined()
    })
})
