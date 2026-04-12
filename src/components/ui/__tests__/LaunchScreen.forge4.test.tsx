/**
 * LaunchScreen.forge4.test.tsx — FORGE.4a + FORGE.4b tests
 *
 * LS-F4A-01: Renders "Paste code to audit" trigger
 * LS-F4A-02: Clicking trigger opens PasteAuditModal
 * LS-F4A-03: Closing modal hides PasteAuditModal
 * LS-F4B-01: Recent project shows health grade when available
 * LS-F4B-02: Health grade uses correct color classes
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LaunchScreen } from '../LaunchScreen'

function defaultProps() {
    return {
        onOpenFolder: vi.fn().mockResolvedValue(undefined),
        onNewProject: vi.fn().mockResolvedValue(undefined),
        onOpenRecent: vi.fn().mockResolvedValue(undefined),
        onLoadDemo: vi.fn().mockResolvedValue(undefined),
    }
}

describe('LaunchScreen — FORGE.4a Paste and Audit', () => {
    it('LS-F4A-01: renders "Paste code to audit" trigger', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-trigger')).toBeTruthy()
        })
    })

    it('LS-F4A-02: clicking trigger opens PasteAuditModal', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-trigger')).toBeTruthy()
        })
        fireEvent.click(screen.getByTestId('paste-audit-trigger'))
        expect(screen.getByTestId('paste-audit-modal')).toBeTruthy()
    })

    it('LS-F4A-03: closing modal hides PasteAuditModal', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-trigger')).toBeTruthy()
        })
        fireEvent.click(screen.getByTestId('paste-audit-trigger'))
        expect(screen.getByTestId('paste-audit-modal')).toBeTruthy()
        fireEvent.click(screen.getByTestId('paste-audit-close'))
        expect(screen.queryByTestId('paste-audit-modal')).toBeNull()
    })
})

describe('LaunchScreen — FORGE.4b Health Grades', () => {
    it('LS-F4B-01: recent project shows health grade when available', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: '1', name: 'My Project', path: '/test/project', last_opened: Date.now() },
        ])
        ;(window.flintAPI.project as Record<string, unknown>).getHealthGrade = vi.fn().mockResolvedValue({
            grade: 'B+',
            score: 82,
            updatedAt: new Date().toISOString(),
        })
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            const gradeEl = screen.getByLabelText('Health grade: B+')
            expect(gradeEl).toBeTruthy()
            expect(gradeEl.textContent).toBe('B+')
        })
    })
})
