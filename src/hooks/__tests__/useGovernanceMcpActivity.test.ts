/**
 * useGovernanceMcpActivity.test.ts
 *
 * Tests for H15: MCP activity log feed state.
 *
 * Boundaries:
 *   - Returns empty feed when notification history is empty
 *   - Returns false isStreaming (static for now)
 *   - Filters to mutation, violation, sync types only
 *   - Excludes error and other types
 *   - Caps feed at 20 most recent events (reversed)
 *   - Updates reactively when notification history changes
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGovernanceMcpActivity } from '../useGovernanceMcpActivity'
import { useNotificationStore, type Notification } from '../../store/notificationStore'

type NotificationType = 'mutation' | 'violation' | 'sync' | 'error' | 'info'

interface MockNotification {
    id: string
    type: NotificationType
    title: string
    message: string
    severity: 'info' | 'warning' | 'error'
    autoDismissMs?: number
}

function seedHistory(notifications: MockNotification[]) {
    useNotificationStore.setState({ history: notifications as unknown as Notification[] })
}

describe('useGovernanceMcpActivity', () => {
    it('returns empty feed when notification history is empty', () => {
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed).toEqual([])
    })

    it('returns isStreaming=false', () => {
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.isStreaming).toBe(false)
    })

    it('includes mutation type events in feed', () => {
        seedHistory([
            { id: '1', type: 'mutation', title: 'Fix applied', message: 'Token replaced', severity: 'info' },
        ])
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed.some((n: unknown) => (n as MockNotification).type === 'mutation')).toBe(true)
    })

    it('includes violation type events in feed', () => {
        seedHistory([
            { id: '2', type: 'violation', title: 'Violation found', message: 'Color drift detected', severity: 'warning' },
        ])
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed.some((n: unknown) => (n as MockNotification).type === 'violation')).toBe(true)
    })

    it('includes sync type events in feed', () => {
        seedHistory([
            { id: '3', type: 'sync', title: 'Token synced', message: 'Figma tokens pulled', severity: 'info' },
        ])
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed.some((n: unknown) => (n as MockNotification).type === 'sync')).toBe(true)
    })

    it('excludes error type events from feed', () => {
        seedHistory([
            { id: '4', type: 'error', title: 'Something failed', message: 'IPC error', severity: 'error' },
        ])
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed.every((n: unknown) => (n as MockNotification).type !== 'error')).toBe(true)
    })

    it('excludes events not matching the three allowed types', () => {
        seedHistory([
            { id: '5', type: 'info' as NotificationType, title: 'Info event', message: 'some info', severity: 'info' },
        ])
        const { result } = renderHook(() => useGovernanceMcpActivity())
        // 'info' type is not in the allowed set (mutation/violation/sync)
        expect(result.current.feed).toHaveLength(0)
    })

    it('caps feed at 20 events', () => {
        const notifications = Array.from({ length: 25 }, (_, i) => ({
            id: String(i),
            type: 'mutation' as NotificationType,
            title: `Fix ${i}`,
            message: `Applied fix ${i}`,
            severity: 'info' as const,
        }))
        seedHistory(notifications)

        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed).toHaveLength(20)
    })

    it('returns most recent 20 events in reverse order', () => {
        const notifications = Array.from({ length: 25 }, (_, i) => ({
            id: String(i),
            type: 'mutation' as NotificationType,
            title: `Fix ${i}`,
            message: `Applied fix ${i}`,
            severity: 'info' as const,
        }))
        seedHistory(notifications)

        const { result } = renderHook(() => useGovernanceMcpActivity())
        // .slice(-20).reverse() means last 20 items reversed: id 24 first, id 5 last
        expect((result.current.feed[0] as MockNotification).id).toBe('24')
        expect((result.current.feed[19] as MockNotification).id).toBe('5')
    })

    it('updates reactively when notification store history changes', () => {
        seedHistory([])
        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed).toHaveLength(0)

        act(() => {
            useNotificationStore.setState({
                history: [
                    { id: 'new-1', type: 'mutation', title: 'New fix', message: 'A fix was applied', severity: 'info', autoDismissMs: 0, timestamp: Date.now() },
                ],
            })
        })

        expect(result.current.feed).toHaveLength(1)
    })

    it('mixed types — only returns mutation/violation/sync', () => {
        seedHistory([
            { id: '1', type: 'mutation', title: 'Fix', message: '', severity: 'info' },
            { id: '2', type: 'error', title: 'Error', message: '', severity: 'error' },
            { id: '3', type: 'violation', title: 'Violation', message: '', severity: 'warning' },
            { id: '4', type: 'info' as NotificationType, title: 'Info', message: '', severity: 'info' },
            { id: '5', type: 'sync', title: 'Sync', message: '', severity: 'info' },
        ])

        const { result } = renderHook(() => useGovernanceMcpActivity())
        expect(result.current.feed).toHaveLength(3)
        const types = (result.current.feed as MockNotification[]).map((n) => n.type)
        expect(types).not.toContain('error')
        expect(types).not.toContain('info')
    })
})
