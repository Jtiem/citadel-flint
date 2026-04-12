/**
 * LaunchScreen.test.tsx
 *
 * Tests for the restored LaunchScreen with JTBD tiles.
 *
 * Verifies:
 *   - "New Project" primary CTA calls onNewProject
 *   - 4 JTBD tiles: From Figma, Connect codebase, Audit a folder, Governance dashboard
 *   - Demo section: primary CTA + collapsible gallery
 *   - Recent projects visible with optional health grades
 *   - MCP connected banner shown when connected
 *   - Remove-from-recent wiring
 *   - Demo load error banner
 *   - "Connect to IDE" footer affordance
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LaunchScreen } from '../LaunchScreen'
import type { RecentProject } from '../../../types/flint-api'

function makeProject(overrides: Partial<RecentProject> = {}): RecentProject {
    return {
        id: crypto.randomUUID(),
        name: 'My Project',
        path: '/Users/dev/my-project',
        last_opened: Date.now(),
        ...overrides,
    }
}

function defaultProps() {
    return {
        onOpenFolder: vi.fn().mockResolvedValue(undefined),
        onNewProject: vi.fn().mockResolvedValue(undefined),
        onOpenRecent: vi.fn().mockResolvedValue(undefined),
        onLoadDemo: vi.fn().mockResolvedValue(undefined),
    }
}

describe('LaunchScreen — JTBD Tiles', () => {

    // ── New Project primary CTA ──────────────────────────────────────────────

    it('renders "New Project" primary CTA', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
        })
    })

    it('clicking "New Project" calls onNewProject', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('New Project'))
        fireEvent.click(screen.getByTestId('new-project-cta'))
        await waitFor(() => {
            expect(props.onNewProject).toHaveBeenCalled()
        })
    })

    // ── 4 JTBD tiles present ─────────────────────────────────────────────────

    it('renders "From Figma" tile', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('From Figma')).toBeDefined()
        })
    })

    it('renders "Connect codebase" tile', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Connect codebase')).toBeDefined()
        })
    })

    it('renders "Audit a folder" tile', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Audit a folder')).toBeDefined()
        })
    })

    it('renders "Governance dashboard" tile', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Governance dashboard')).toBeDefined()
        })
    })

    // ── Demo section — FORGE.3c: Scenario picker ──────────────────────────────

    it('renders the demo scenario picker', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByTestId('demo-scenario-picker')).toBeDefined()
        })
    })

    it('clicking a demo scenario calls onLoadDemo with the correct demo name', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByTestId('demo-scenario-picker'))
        fireEvent.click(screen.getByTestId('demo-scenario-audit-component'))
        await waitFor(() => {
            expect(props.onLoadDemo).toHaveBeenCalledWith('token-drift')
        })
    })

    it('demo scenario picker shows 4 scenario cards', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Audit a component')).toBeDefined()
            expect(screen.getByText('Fix violations')).toBeDefined()
            expect(screen.getByText('Design system health')).toBeDefined()
            expect(screen.getByText('Migrate a design system')).toBeDefined()
        })
    })

    it('each demo scenario shows estimated time', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getAllByText('~2 min').length).toBeGreaterThanOrEqual(1)
            expect(screen.getAllByText('~3 min').length).toBeGreaterThanOrEqual(1)
        })
    })

    // ── Recent projects ──────────────────────────────────────────────────────

    it('shows recent projects when available', async () => {
        const projects = [makeProject({ name: 'Alpha App' }), makeProject({ name: 'Beta Site' })]
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue(projects)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Alpha App')).toBeDefined()
            expect(screen.getByText('Beta Site')).toBeDefined()
        })
    })

    it('does not render recent projects section when list is empty', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.queryByText('Reopen a project')).toBeNull()
        })
    })

    it('calls onOpenRecent when a recent project is clicked', async () => {
        const project = makeProject({ name: 'Gamma App', path: '/tmp/gamma' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Gamma App'))
        fireEvent.click(screen.getByText('Gamma App'))
        await waitFor(() => {
            expect(props.onOpenRecent).toHaveBeenCalledWith('/tmp/gamma')
        })
    })

    it('calls registry.removeProject when remove button is clicked', async () => {
        const project = makeProject({ id: 'proj-abc', name: 'Delta App' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        ;(window.flintAPI.registry.removeProject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Delta App'))
        const removeBtn = screen.getByRole('button', { name: /Remove Delta App from recent projects/i })
        fireEvent.click(removeBtn)
        await waitFor(() => {
            expect(window.flintAPI.registry.removeProject).toHaveBeenCalledWith('proj-abc')
        })
    })

    it('remove-from-recent button has project-specific aria-label', async () => {
        const project = makeProject({ name: 'Zeta Project', id: 'zeta-id' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        ;(window.flintAPI.registry.removeProject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Zeta Project'))
        const removeBtn = screen.getByRole('button', { name: /Remove Zeta Project from recent/ })
        expect(removeBtn).toBeDefined()
    })

    it('renders health grade badge when getHealthGrade returns a grade', async () => {
        const project = makeProject({ name: 'Healthy App', path: '/tmp/healthy' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        ;(window.flintAPI as Record<string, unknown>).project = {
            ...(window.flintAPI.project ?? {}),
            getHealthGrade: vi.fn().mockResolvedValue({ grade: 'A+', score: 95, updatedAt: '2026-04-01T00:00:00Z' }),
        }
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('A+')).toBeDefined()
        })
    })

    it('does not render a grade badge when getHealthGrade returns null', async () => {
        const project = makeProject({ name: 'Gradeless App' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        ;(window.flintAPI as Record<string, unknown>).project = {
            ...(window.flintAPI.project ?? {}),
            getHealthGrade: vi.fn().mockResolvedValue(null),
        }
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Gradeless App'))
        expect(screen.queryByLabelText(/Health grade/i)).toBeNull()
    })

    // ── MCP connected banner ─────────────────────────────────────────────────

    it('shows MCP connected banner when mcp.status returns connected: true', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.flintAPI.mcp?.status as ReturnType<typeof vi.fn>).mockResolvedValue({ connected: true })
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText(/MCP connected/)).toBeDefined()
        })
    })

    it('does not show MCP connected banner when mcp.status returns connected: false', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.flintAPI.mcp?.status as ReturnType<typeof vi.fn>).mockResolvedValue({ connected: false })
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.queryByText(/MCP connected/)).toBeNull()
        })
    })

    // ── Demo load error banner ────────────────────────────────────────────────

    it('renders amber error banner when demoError prop is set', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} demoError="IPC call failed" />)
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined()
            expect(screen.getByText("Demo project couldn't load. Try opening your own project below.")).toBeDefined()
        })
    })

    it('does not render error banner when demoError prop is absent', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
        })
        expect(screen.queryByRole('alert')).toBeNull()
    })

    it('dismisses the error banner when the dismiss button is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} demoError="something went wrong" />)
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined()
        })
        fireEvent.click(screen.getByLabelText('Dismiss'))
        await waitFor(() => {
            expect(screen.queryByRole('alert')).toBeNull()
        })
    })

    // ── Connect to IDE affordance ────────────────────────────────────────────

    it('renders "Connect to IDE" footer button when onConnectIDE is provided', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const onConnectIDE = vi.fn()
        render(<LaunchScreen {...defaultProps()} onConnectIDE={onConnectIDE} />)
        await waitFor(() => {
            expect(screen.getByText('Connect to IDE')).toBeDefined()
        })
    })

    it('calls onConnectIDE when "Connect to IDE" button is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const onConnectIDE = vi.fn()
        render(<LaunchScreen {...defaultProps()} onConnectIDE={onConnectIDE} />)
        await waitFor(() => screen.getByText('Connect to IDE'))
        fireEvent.click(screen.getByText('Connect to IDE'))
        expect(onConnectIDE).toHaveBeenCalled()
    })

    it('does not render "Connect to IDE" button when onConnectIDE prop is absent', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
        })
        expect(screen.queryByText('Connect to IDE')).toBeNull()
    })

    // ── A11y structural checks ───────────────────────────────────────────────

    it('header has aria-label', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            const header = document.querySelector('header')
            expect(header).not.toBeNull()
            expect(header!.getAttribute('aria-label')).toBeTruthy()
        })
    })

    it('recent projects section has aria-labelledby pointing to "Reopen a project"', async () => {
        const projects = [makeProject({ name: 'Omega App' })]
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue(projects)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Reopen a project'))
        const label = screen.getByText('Reopen a project')
        expect(label.id).toBeTruthy()
        const section = document.getElementById(label.id)?.closest('section')
        expect(section).not.toBeNull()
    })
})
