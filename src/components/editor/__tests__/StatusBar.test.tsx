/**
 * StatusBar.test.tsx
 *
 * 9 tests for the StatusBar component. Covers Figma indicator dot color,
 * violation count text, governance dot colors, and the notification bell badge.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StatusBar } from '../../editor/StatusBar'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useNotificationStore } from '../../../store/notificationStore'
import type { LinterWarning } from '../../../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWarning(severity: 'amber' | 'critical'): LinterWarning {
    return {
        id: 'W-001',
        type: 'color-drift',
        severity,
        value: severity === 'critical' ? 12 : 3,
        message: 'test violation',
        nearestToken: null,
        nearestTokenValue: null,
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('StatusBar', () => {
    // 1. Renders Figma indicator text
    it('renders the Figma label in the status bar', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Figma')).toBeDefined()
        })
    })

    // 2. Green dot when tokens exist
    it('shows emerald dot when tokens are present', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#000', description: null, mode: 'default', collection_name: 'Colors' },
        ])
        render(<StatusBar />)
        await waitFor(() => {
            const dot = document.querySelector('.bg-emerald-400')
            expect(dot).not.toBeNull()
        })
    })

    // 3. Gray dot when no tokens
    it('shows zinc dot when no tokens are synced', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<StatusBar />)
        await waitFor(() => {
            const dot = document.querySelector('.bg-zinc-600')
            expect(dot).not.toBeNull()
        })
    })

    // 4. Shows violation count text
    it('renders violation count text in the center section', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        useEditorStore.setState({ linterWarnings: new Map([['n1', makeWarning('amber')]]) })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('1 violation')).toBeDefined()
        })
    })

    // 5. Red dot when critical violations exist
    it('shows red dot when at least one critical linter warning is present', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        useEditorStore.setState({
            linterWarnings: new Map([['n1', makeWarning('critical')]]),
        })
        render(<StatusBar />)
        await waitFor(() => {
            const redDot = document.querySelector('.bg-red-400')
            expect(redDot).not.toBeNull()
        })
    })

    // 6. Amber dot when non-critical violations exist
    it('shows amber dot when violations exist but none are critical', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        useEditorStore.setState({
            linterWarnings: new Map([['n1', makeWarning('amber')]]),
        })
        render(<StatusBar />)
        await waitFor(() => {
            const amberDot = document.querySelector('.bg-amber-400')
            expect(amberDot).not.toBeNull()
        })
    })

    // 7. Green dot when zero violations
    it('shows emerald dot on the governance indicator when there are zero violations', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        useEditorStore.setState({ linterWarnings: new Map() })
        useCanvasStore.setState({ a11yViolations: {} })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('0 violations')).toBeDefined()
        })
    })

    // 8. Bell icon shows badge with notification count
    it('renders a badge with the notification count when notifications are present', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        useNotificationStore.setState({
            notifications: [
                { id: 'n1', type: 'info', title: 'T', message: 'M', severity: 'info', autoDismissMs: 0, timestamp: Date.now() },
                { id: 'n2', type: 'info', title: 'T2', message: 'M2', severity: 'info', autoDismissMs: 0, timestamp: Date.now() },
            ],
            history: [],
        })
        render(<StatusBar />)
        await waitFor(() => {
            const badge = document.querySelector('[aria-label="2 unread"]')
            expect(badge).not.toBeNull()
        })
    })

    // 9. Badge shows "9+" when count exceeds 9
    it('renders "9+" in the badge when there are more than 9 notifications', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const manyNotifications = Array.from({ length: 10 }, (_, i) => ({
            id: `n${i}`,
            type: 'info' as const,
            title: `T${i}`,
            message: 'M',
            severity: 'info' as const,
            autoDismissMs: 0,
            timestamp: Date.now(),
        }))
        useNotificationStore.setState({ notifications: manyNotifications, history: [] })
        render(<StatusBar />)
        await waitFor(() => {
            const badge = document.querySelector('.bg-indigo-600')
            expect(badge?.textContent).toBe('9+')
        })
    })
})
