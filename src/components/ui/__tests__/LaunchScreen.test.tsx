/**
 * LaunchScreen.test.tsx
 *
 * Tests for the JTBD-driven LaunchScreen. Covers the three goal paths
 * (Prototype, Connect, Audit), recent projects, and callback wiring.
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
    it('renders the three JTBD goal cards', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Prototype from Figma')).toBeDefined()
            expect(screen.getByText('Connect my design system')).toBeDefined()
            expect(screen.getByText('Audit existing code')).toBeDefined()
        })
    })

    it('renders the "What brings you to Flint?" heading', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('What brings you to Flint?')).toBeDefined()
        })
    })

    it('renders the tagline "Design System Governance"', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Design System Governance')).toBeDefined()
        })
    })

    it('shows recent projects when available', async () => {
        const projects = [makeProject({ name: 'Alpha App' }), makeProject({ name: 'Beta Site' })]
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue(projects)
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText('Alpha App')).toBeDefined()
            expect(screen.getByText('Beta Site')).toBeDefined()
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

    it('calls registry.removeProject when remove is clicked', async () => {
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

    it('navigates to folder step when "Audit existing code" is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Audit existing code'))
        fireEvent.click(screen.getByText('Audit existing code'))
        await waitFor(() => {
            expect(screen.getByText('Which folder should Flint audit?')).toBeDefined()
        })
    })

    it('navigates to folder step when "Connect my design system" is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Connect my design system'))
        fireEvent.click(screen.getByText('Connect my design system'))
        await waitFor(() => {
            expect(screen.getByText('Where is your codebase?')).toBeDefined()
        })
    })

    it('navigates to Figma step when "Prototype from Figma" is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.flintAPI.figma?.status as ReturnType<typeof vi.fn>)?.mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 0, port: 4545,
        })
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Prototype from Figma'))
        fireEvent.click(screen.getByText('Prototype from Figma'))
        await waitFor(() => {
            expect(screen.getByText('Connect your Figma file')).toBeDefined()
        })
    })

    it('shows back button after selecting a path', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Audit existing code'))
        fireEvent.click(screen.getByText('Audit existing code'))
        await waitFor(() => {
            expect(screen.getByText('Back')).toBeDefined()
        })
    })

    it('returns to goal chooser when Back is clicked', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<LaunchScreen {...defaultProps()} />)
        await waitFor(() => screen.getByText('Audit existing code'))
        fireEvent.click(screen.getByText('Audit existing code'))
        await waitFor(() => screen.getByText('Back'))
        fireEvent.click(screen.getByText('Back'))
        await waitFor(() => {
            expect(screen.getByText('What brings you to Flint?')).toBeDefined()
        })
    })
})
