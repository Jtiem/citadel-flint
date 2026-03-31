/**
 * LaunchScreen.test.tsx
 *
 * Tests for the FORGE.1a Three-Path LaunchScreen.
 *
 * Verifies:
 *   - Exactly 3 primary CTAs: "Try Flint", "Open My Project", "Audit a Folder"
 *   - No 4th primary CTA (new-project blank scratchpad, from-Figma, governance dashboard tiles)
 *   - Demo scenario picker opens/closes via "Try Flint" toggle
 *   - Scenario cards load demos when clicked
 *   - Recent projects visible with optional health grades
 *   - MCP connected banner shown when connected
 *   - "Open My Project" calls onOpenFolder
 *   - "Audit a Folder" calls onOpenFolder
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

describe('LaunchScreen — FORGE.1a Three-Path', () => {

    // ── 3 primary paths present ───────────────────────────────────────────────

    it('renders "Try Flint" primary CTA', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Try Flint')).toBeDefined()
        })
    })

    it('renders "Open My Project" primary CTA', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Open My Project')).toBeDefined()
        })
    })

    it('renders "Audit a Folder" secondary link', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Audit a Folder')).toBeDefined()
        })
    })

    // ── No 4th primary CTA ────────────────────────────────────────────────────

    it('does not render "New Project" blank scratchpad tile', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Try Flint')).toBeDefined()
        })
        expect(screen.queryByText('New Project')).toBeNull()
    })

    it('does not render "From Figma" tile as a primary option', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Try Flint')).toBeDefined()
        })
        expect(screen.queryByText('From Figma')).toBeNull()
    })

    it('does not render "Governance dashboard" tile as a primary option', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Try Flint')).toBeDefined()
        })
        expect(screen.queryByText('Governance dashboard')).toBeNull()
    })

    it('does not render "Connect codebase" tile as a primary option', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Try Flint')).toBeDefined()
        })
        expect(screen.queryByText('Connect codebase')).toBeNull()
    })

    // ── "Try Flint" opens scenario picker ─────────────────────────────────────

    it('clicking "Try Flint" reveals the demo scenario picker', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Try Flint'))
        fireEvent.click(screen.getByText('Try Flint'))
        await waitFor(() => {
            expect(screen.getByTestId('demo-scenario-picker')).toBeDefined()
        })
    })

    it('clicking "Try Flint" again collapses the scenario picker', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Try Flint'))
        fireEvent.click(screen.getByText('Try Flint'))
        await waitFor(() => screen.getByTestId('demo-scenario-picker'))
        fireEvent.click(screen.getByText('Try Flint'))
        await waitFor(() => {
            expect(screen.queryByTestId('demo-scenario-picker')).toBeNull()
        })
    })

    it('scenario picker shows 4 demo cards', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Try Flint'))
        fireEvent.click(screen.getByText('Try Flint'))
        await waitFor(() => {
            expect(screen.getByText('A11y Audit')).toBeDefined()
            expect(screen.getByText('Token Drift')).toBeDefined()
            expect(screen.getByText('DS Migration')).toBeDefined()
            expect(screen.getByText('Full App Scan')).toBeDefined()
        })
    })

    it('clicking a demo scenario calls onLoadDemo with the correct name', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Try Flint'))
        fireEvent.click(screen.getByText('Try Flint'))
        await waitFor(() => screen.getByText('A11y Audit'))
        fireEvent.click(screen.getByRole('button', { name: /Load A11y Audit demo/i }))
        await waitFor(() => {
            expect(props.onLoadDemo).toHaveBeenCalledWith('a11y-audit')
        })
    })

    it('"Try Flint" button has aria-expanded attribute', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Try Flint'))
        const btn = screen.getByTestId('try-flint-cta')
        expect(btn.getAttribute('aria-expanded')).toBe('false')
        fireEvent.click(btn)
        await waitFor(() => {
            expect(btn.getAttribute('aria-expanded')).toBe('true')
        })
    })

    // ── "Open My Project" calls onOpenFolder ─────────────────────────────────

    it('clicking "Open My Project" calls onOpenFolder', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Open My Project'))
        fireEvent.click(screen.getByText('Open My Project'))
        await waitFor(() => {
            expect(props.onOpenFolder).toHaveBeenCalled()
        })
    })

    // ── "Audit a Folder" calls onOpenFolder ───────────────────────────────────

    it('clicking "Audit a Folder" calls onOpenFolder', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Audit a Folder'))
        fireEvent.click(screen.getByText('Audit a Folder'))
        await waitFor(() => {
            expect(props.onOpenFolder).toHaveBeenCalled()
        })
    })

    // ── Recent projects ────────────────────────────────────────────────────────

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

    it('renders health grade badge when project has a healthGrade', async () => {
        const project = { ...makeProject({ name: 'Healthy App' }), healthGrade: 'A+' }
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('A+')).toBeDefined()
        })
    })

    it('does not render a grade badge when healthGrade is absent', async () => {
        const project = makeProject({ name: 'Gradeless App' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Gradeless App'))
        // No grade badge (no A-F text beside the project name)
        expect(screen.queryByLabelText(/Health grade/i)).toBeNull()
    })

    // ── MCP connected banner ───────────────────────────────────────────────────

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

    // ── Demo load error banner ─────────────────────────────────────────────────

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
            expect(screen.getByText('Try Flint')).toBeDefined()
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

    // ── Connect to IDE affordance ──────────────────────────────────────────────

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
            expect(screen.getByText('Try Flint')).toBeDefined()
        })
        expect(screen.queryByText('Connect to IDE')).toBeNull()
    })

    // ── A11y structural checks ─────────────────────────────────────────────────

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
