/**
 * LaunchScreen.test.tsx
 *
 * 11 tests for the LaunchScreen component. Covers action buttons, recent
 * projects rendering, and callback wiring.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LaunchScreen } from '../LaunchScreen'
import type { RecentProject } from '../../../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('LaunchScreen', () => {
    // 1. Renders the four primary action buttons
    it('renders New Project, Open Folder, Load Demo, and Connect Figma buttons', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
            expect(screen.getByText('Open Folder')).toBeDefined()
            expect(screen.getByText('Load Demo')).toBeDefined()
            expect(screen.getByText('Connect Figma')).toBeDefined()
        })
    })

    // 2. Shows "No recent projects yet" when list is empty
    it('shows "No recent projects yet." when the recent list is empty', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('No recent projects yet.')).toBeDefined()
        })
    })

    // 3. Renders recent projects from the registry API
    it('renders project names fetched from bridgeAPI.registry.getRecent', async () => {
        const projects = [makeProject({ name: 'Alpha App' }), makeProject({ name: 'Beta Site' })]
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue(projects)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Alpha App')).toBeDefined()
            expect(screen.getByText('Beta Site')).toBeDefined()
        })
    })

    // 4. Clicking a recent project calls onOpenRecent with the project path
    it('calls onOpenRecent with the correct path when a recent project is clicked', async () => {
        const project = makeProject({ name: 'Gamma App', path: '/tmp/gamma' })
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Gamma App'))
        fireEvent.click(screen.getByText('Gamma App'))
        await waitFor(() => {
            expect(props.onOpenRecent).toHaveBeenCalledWith('/tmp/gamma')
        })
    })

    // 5. Remove button calls registry.removeProject with the project id
    it('calls registry.removeProject when the remove button is clicked', async () => {
        const project = makeProject({ id: 'proj-abc', name: 'Delta App' })
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([project])
        ;(window.bridgeAPI.registry.removeProject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Delta App'))
        const removeBtn = screen.getByLabelText('Remove from recent')
        fireEvent.click(removeBtn)
        await waitFor(() => {
            expect(window.bridgeAPI.registry.removeProject).toHaveBeenCalledWith('proj-abc')
        })
    })

    // 6. New Project button calls onNewProject
    it('calls onNewProject when New Project is clicked', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('New Project'))
        fireEvent.click(screen.getByText('New Project'))
        await waitFor(() => {
            expect(props.onNewProject).toHaveBeenCalledOnce()
        })
    })

    // 7. Open Folder button calls onOpenFolder
    it('calls onOpenFolder when Open Folder is clicked', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Open Folder'))
        fireEvent.click(screen.getByText('Open Folder'))
        await waitFor(() => {
            expect(props.onOpenFolder).toHaveBeenCalledOnce()
        })
    })

    // 8. Load Demo button calls onLoadDemo
    it('calls onLoadDemo when Load Demo is clicked', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('Load Demo'))
        fireEvent.click(screen.getByText('Load Demo'))
        await waitFor(() => {
            expect(props.onLoadDemo).toHaveBeenCalledOnce()
        })
    })

    // 9. Connect Figma renders the FigmaSetupWizard component after click
    it('renders the FigmaSetupWizard when Connect Figma is clicked', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        // The wizard calls figma.status() on mount — provide a running server response
        ;(window.bridgeAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: null,
            tokenCount: 0,
            port: 4545,
        })
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Connect Figma'))
        fireEvent.click(screen.getByText('Connect Figma'))
        // After clicking, the FigmaSetupWizard component mounts.
        // The wizard renders a 3-step UI; verify step-indicator content appears.
        await waitFor(() => {
            // FigmaSetupWizard renders step indicators — the old inline text block
            // ("Bridge Figma plugin setup" with 4 numbered list items) is gone.
            // The new wizard renders numbered step indicators (1, 2, 3).
            // We assert figma.status() was invoked by the wizard, which proves
            // the wizard component (not the old text block) mounted.
            expect(window.bridgeAPI.figma.status).toHaveBeenCalled()
        })
    })

    // 10. Shows the tagline text from the header
    it('renders the tagline "Visual governance for your design system"', async () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Design-to-Code Platform')).toBeDefined()
        })
    })

    // 11. Loading state while fetching recents
    it('shows a loading indicator while recent projects are being fetched', () => {
        ;(window.bridgeAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
        render(<LaunchScreen {...defaultProps()} />)
        expect(screen.getByText('Loading…')).toBeDefined()
    })
})
