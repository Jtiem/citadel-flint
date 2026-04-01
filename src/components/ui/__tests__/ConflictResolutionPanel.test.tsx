/**
 * ConflictResolutionPanel.test.tsx
 *
 * S7.3: Tests for the three-way diff conflict resolution UI.
 * Covers: empty state, conflict display, resolution actions, resolve-all.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ConflictResolutionPanel, type SyncConflict } from '../ConflictResolutionPanel'

const SAMPLE_CONFLICTS: SyncConflict[] = [
    {
        tokenPath: 'color.brand.primary',
        tokenType: 'color',
        baseValue: '#0066FF',
        localValue: '#0055EE',
        remoteValue: '#0077FF',
    },
    {
        tokenPath: 'spacing.md',
        tokenType: 'dimension',
        baseValue: '16px',
        localValue: '18px',
        remoteValue: '20px',
    },
]

describe('ConflictResolutionPanel', () => {
    beforeEach(() => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: JSON.stringify({ conflicts: [] }) }],
        })
    })

    it('renders the panel with data-testid', () => {
        render(<ConflictResolutionPanel conflicts={[]} />)
        expect(screen.getByTestId('conflict-resolution-panel')).toBeDefined()
    })

    it('shows empty state when no conflicts', () => {
        render(<ConflictResolutionPanel conflicts={[]} />)
        expect(screen.getByTestId('no-conflicts')).toBeDefined()
        expect(screen.getByText('No sync conflicts')).toBeDefined()
    })

    it('renders conflict items with three-way diff', () => {
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        expect(screen.getByTestId('conflict-color.brand.primary')).toBeDefined()
        expect(screen.getByTestId('conflict-spacing.md')).toBeDefined()
        // Check three columns exist
        expect(screen.getAllByText('Base').length).toBe(2) // one per conflict
        expect(screen.getAllByText('Local').length).toBe(2)
        expect(screen.getAllByText('Figma').length).toBe(2)
    })

    it('shows conflict count badge in header', () => {
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        expect(screen.getByText('2')).toBeDefined()
    })

    it('renders color swatches for color-type conflicts', () => {
        render(<ConflictResolutionPanel conflicts={[SAMPLE_CONFLICTS[0]]} />)
        // Should have 3 swatches: base, local, remote
        const swatches = document.querySelectorAll('span[style*="background-color"]')
        expect(swatches.length).toBe(3)
    })

    it('shows Resolve All buttons when multiple conflicts exist', () => {
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        expect(screen.getByTestId('resolve-all-local')).toBeDefined()
        expect(screen.getByTestId('resolve-all-remote')).toBeDefined()
    })

    it('does not show Resolve All buttons for single conflict', () => {
        render(<ConflictResolutionPanel conflicts={[SAMPLE_CONFLICTS[0]]} />)
        expect(screen.queryByTestId('resolve-all-local')).toBeNull()
    })

    it('calls flint_resolve_conflict when "Keep Local" is clicked', async () => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: '{}' }],
        })
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        const keepLocalBtn = screen.getByTestId('keep-local-color.brand.primary')
        fireEvent.click(keepLocalBtn)
        await waitFor(() => {
            expect(window.flintAPI.mcp!.callTool).toHaveBeenCalledWith('flint_resolve_conflict', {
                tokenPath: 'color.brand.primary',
                resolution: 'local',
            })
        })
    })

    it('calls flint_resolve_conflict when "Accept Figma" is clicked', async () => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: '{}' }],
        })
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        const acceptBtn = screen.getByTestId('accept-figma-color.brand.primary')
        fireEvent.click(acceptBtn)
        await waitFor(() => {
            expect(window.flintAPI.mcp!.callTool).toHaveBeenCalledWith('flint_resolve_conflict', {
                tokenPath: 'color.brand.primary',
                resolution: 'remote',
            })
        })
    })

    it('removes resolved conflict from the list', async () => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: '{}' }],
        })
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        fireEvent.click(screen.getByTestId('keep-local-color.brand.primary'))
        await waitFor(() => {
            expect(screen.queryByTestId('conflict-color.brand.primary')).toBeNull()
            expect(screen.getByTestId('conflict-spacing.md')).toBeDefined()
        })
    })

    it('calls flint_resolve_all when "Accept All Figma" is clicked', async () => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: '{}' }],
        })
        render(<ConflictResolutionPanel conflicts={SAMPLE_CONFLICTS} />)
        fireEvent.click(screen.getByTestId('resolve-all-remote'))
        await waitFor(() => {
            expect(window.flintAPI.mcp!.callTool).toHaveBeenCalledWith('flint_resolve_all', {
                resolution: 'remote',
            })
        })
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(<ConflictResolutionPanel conflicts={[]} onClose={onClose} />)
        const closeBtn = screen.getByLabelText('Close panel')
        fireEvent.click(closeBtn)
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
