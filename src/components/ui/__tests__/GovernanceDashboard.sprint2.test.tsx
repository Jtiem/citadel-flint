/**
 * GovernanceDashboard.sprint2.test.tsx
 *
 * Sprint 2B: Verify that GovernanceDashboard fires a "Governance data unavailable"
 * warning toast (at most once per mount) when the override count IPC call fails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useNotificationStore } from '../../../store/notificationStore'
import { useTokenStore } from '../../../store/tokenStore'

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — Sprint 2B toast on governance data failure', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useNotificationStore.setState({ notifications: [], history: [] })
        // Ensure baseline is not set
        ;(window.flintAPI as unknown as Record<string, unknown>).baseline = undefined
    })

    it('pushes a warning toast when getOverrideCount IPC fails on mount', async () => {
        // Make the override count call fail
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('DB unavailable'))

        render(<GovernanceDashboard />)

        await waitFor(() => {
            const { notifications } = useNotificationStore.getState()
            const govToast = notifications.find((n) => n.title === 'Governance data unavailable')
            expect(govToast).toBeDefined()
        })

        const { notifications } = useNotificationStore.getState()
        const govToast = notifications.find((n) => n.title === 'Governance data unavailable')!
        expect(govToast.severity).toBe('error')
        expect(govToast.message).toContain('MCP server')
    })

    it('fires the governance unavailable toast only once per mount, not on every override poll', async () => {
        // Fail every call
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('DB unavailable'))

        render(<GovernanceDashboard />)

        await waitFor(() => {
            const { notifications } = useNotificationStore.getState()
            expect(notifications.some((n) => n.title === 'Governance data unavailable')).toBe(true)
        })

        // Exactly one governance toast — not multiple
        const { notifications } = useNotificationStore.getState()
        const govToasts = notifications.filter((n) => n.title === 'Governance data unavailable')
        expect(govToasts).toHaveLength(1)
    })

    it('does NOT push a governance toast when getOverrideCount succeeds', async () => {
        // Default mock returns 0 — success path
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>)
            .mockResolvedValue(0)

        render(<GovernanceDashboard />)

        // Give the component time to settle
        await waitFor(() => {
            expect(window.flintAPI.governance.getOverrideCount).toHaveBeenCalled()
        })

        const { notifications } = useNotificationStore.getState()
        const govToast = notifications.find((n) => n.title === 'Governance data unavailable')
        expect(govToast).toBeUndefined()
    })
})
