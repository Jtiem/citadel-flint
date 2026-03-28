/**
 * LaunchScreen.test.tsx
 *
 * Tests for the LAUNCH.2 context-aware entry system. Covers:
 *   - Primary CTA "New Project"
 *   - "Or connect something" section label
 *   - All four compact tiles
 *   - Inline expanded flows (folder step, Figma step)
 *   - "Skip — open canvas instead" link in expanded flows
 *   - Recent projects list
 *   - Recent project callback wiring
 *   - Remove-from-recent wiring
 *   - MCP connected banner
 *   - Tile toggle (clicking active tile collapses it)
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

describe('LaunchScreen', () => {
    // ── Primary CTA ──────────────────────────────────────────────────────────

    it('renders the "New Project" primary CTA button', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
        })
    })

    it('renders the CTA subtitle "Start building immediately. No setup required."', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Start building immediately. No setup required.')).toBeDefined()
        })
    })

    it('calls onNewProject when "New Project" is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('New Project'))
        fireEvent.click(screen.getByText('New Project'))
        await waitFor(() => {
            expect(props.onNewProject).toHaveBeenCalled()
        })
    })

    // ── Section label ────────────────────────────────────────────────────────

    it('renders the "Or connect something" section label', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Or connect something')).toBeDefined()
        })
    })

    // ── Four compact tiles ───────────────────────────────────────────────────

    it('renders all four compact tiles', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('From Figma')).toBeDefined()
            expect(screen.getByText('Connect codebase')).toBeDefined()
            expect(screen.getByText('Audit a folder')).toBeDefined()
            expect(screen.getByText('Governance dashboard')).toBeDefined()
        })
    })

    it('renders the tagline "AI governance for your design system" in the header', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('AI governance for your design system')).toBeDefined()
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

    it('shows full project path in recent projects list', async () => {
        const project = makeProject({ name: 'Delta App', path: '/Users/dev/delta' })
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('/Users/dev/delta')).toBeDefined()
        })
    })

    it('does not render recent projects section when list is empty', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.queryByText('Reopen a project')).toBeNull()
        })
    })

    // ── Recent project callbacks ──────────────────────────────────────────────

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
        const removeBtn = screen.getByLabelText('Remove from recent')
        fireEvent.click(removeBtn)
        await waitFor(() => {
            expect(window.flintAPI.registry.removeProject).toHaveBeenCalledWith('proj-abc')
        })
    })

    // ── Tile → folder step ────────────────────────────────────────────────────

    it('expands folder step when "Audit a folder" tile is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Audit a folder'))
        fireEvent.click(screen.getByText('Audit a folder'))
        await waitFor(() => {
            expect(screen.getByText('Which folder should Flint audit?')).toBeDefined()
        })
    })

    it('expands folder step when "Connect codebase" tile is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Connect codebase'))
        fireEvent.click(screen.getByText('Connect codebase'))
        await waitFor(() => {
            expect(screen.getByText('Where is your codebase?')).toBeDefined()
        })
    })

    it('expands folder step when "Governance dashboard" tile is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Governance dashboard'))
        fireEvent.click(screen.getByText('Governance dashboard'))
        await waitFor(() => {
            expect(screen.getByText('Which project is your IDE working on?')).toBeDefined()
        })
    })

    // ── Tile → Figma step ─────────────────────────────────────────────────────

    it('expands Figma step when "From Figma" tile is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('From Figma'))
        fireEvent.click(screen.getByText('From Figma'))
        await waitFor(() => {
            expect(screen.getByText('Connect your Figma file')).toBeDefined()
        })
    })

    // ── Skip link ─────────────────────────────────────────────────────────────

    it('shows "Skip — open canvas instead" link when folder step is expanded', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Audit a folder'))
        fireEvent.click(screen.getByText('Audit a folder'))
        await waitFor(() => {
            expect(screen.getByText('Skip — open canvas instead')).toBeDefined()
        })
    })

    it('shows "Skip — open canvas instead" link when Figma step is expanded', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('From Figma'))
        fireEvent.click(screen.getByText('From Figma'))
        await waitFor(() => {
            expect(screen.getByText('Skip — open canvas instead')).toBeDefined()
        })
    })

    it('calls onNewProject and collapses flow when "Skip — open canvas instead" is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Audit a folder'))
        fireEvent.click(screen.getByText('Audit a folder'))
        await waitFor(() => screen.getByText('Skip — open canvas instead'))
        fireEvent.click(screen.getByText('Skip — open canvas instead'))
        await waitFor(() => {
            expect(props.onNewProject).toHaveBeenCalled()
            // Expanded flow should be gone
            expect(screen.queryByText('Skip — open canvas instead')).toBeNull()
        })
    })

    // ── Tile toggle ───────────────────────────────────────────────────────────

    it('collapses expanded flow when the active tile is clicked again', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Audit a folder'))
        // First click: expand
        fireEvent.click(screen.getByText('Audit a folder'))
        await waitFor(() => {
            expect(screen.getByText('Which folder should Flint audit?')).toBeDefined()
        })
        // Second click: collapse
        fireEvent.click(screen.getByText('Audit a folder'))
        await waitFor(() => {
            expect(screen.queryByText('Which folder should Flint audit?')).toBeNull()
        })
    })

    // ── MCP connected banner ──────────────────────────────────────────────────

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

    // ── Footer escape hatch ───────────────────────────────────────────────────

    it('renders the "Open any folder..." footer escape hatch', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Open any folder...')).toBeDefined()
        })
    })

    it('calls onOpenFolder when "Open any folder..." is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Open any folder...'))
        fireEvent.click(screen.getByText('Open any folder...'))
        await waitFor(() => {
            expect(props.onOpenFolder).toHaveBeenCalled()
        })
    })
})
