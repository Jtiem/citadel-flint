/**
 * SyncActionCluster.test.tsx — src/components/ui/__tests__/SyncActionCluster.test.tsx
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Purely presentational tests for the Pull / Push / Resolve cluster.
 * Covers the full disabled-state matrix plus loading + disconnected fallback.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncActionCluster } from '../mint/SyncActionCluster'
import type { SyncActionClusterProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<SyncActionClusterProps> = {}): SyncActionClusterProps {
    return {
        figmaConnected: true,
        driftCount: 0,
        pendingConflictCount: 0,
        localEditCount: 0,
        syncOp: null,
        onPull: vi.fn(),
        onPush: vi.fn(),
        onResolve: vi.fn(),
        onConnect: vi.fn(),
        ...overrides,
    }
}

describe('SyncActionCluster', () => {
    // ── Disconnected fallback ─────────────────────────────────────────────────

    it('renders the Connect CTA when Figma is disconnected and onConnect is provided', () => {
        const onConnect = vi.fn()
        render(<SyncActionCluster {...makeProps({ figmaConnected: false, onConnect })} />)

        expect(screen.getByTestId('sync-connect')).toBeDefined()
        expect(screen.queryByTestId('sync-pull')).toBeNull()
        expect(screen.queryByTestId('sync-push')).toBeNull()
        expect(screen.queryByTestId('sync-resolve')).toBeNull()
    })

    it('renders nothing when disconnected and onConnect prop is undefined', () => {
        const { container } = render(
            <SyncActionCluster {...makeProps({ figmaConnected: false, onConnect: undefined })} />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('fires onConnect exactly once when user clicks the Connect CTA', () => {
        const onConnect = vi.fn()
        render(<SyncActionCluster {...makeProps({ figmaConnected: false, onConnect })} />)

        fireEvent.click(screen.getByTestId('sync-connect'))
        expect(onConnect).toHaveBeenCalledTimes(1)
    })

    // ── Disabled-state matrix ─────────────────────────────────────────────────

    it('disables Pull when driftCount is 0 and sets aria-label "Up to date"', () => {
        render(<SyncActionCluster {...makeProps({ driftCount: 0 })} />)

        const pull = screen.getByTestId('sync-pull')
        expect(pull.hasAttribute('disabled')).toBe(true)
        expect(pull.getAttribute('aria-label')).toBe('Up to date')
    })

    it('enables Pull and shows the drift count when driftCount > 0', () => {
        render(<SyncActionCluster {...makeProps({ driftCount: 5 })} />)

        const pull = screen.getByTestId('sync-pull')
        expect(pull.hasAttribute('disabled')).toBe(false)
        expect(pull.getAttribute('aria-label')).toBe('Pull 5 from Figma')
    })

    it('disables Push when localEditCount is 0', () => {
        render(<SyncActionCluster {...makeProps({ localEditCount: 0 })} />)

        const push = screen.getByTestId('sync-push')
        expect(push.hasAttribute('disabled')).toBe(true)
    })

    it('enables Push when localEditCount > 0', () => {
        render(<SyncActionCluster {...makeProps({ localEditCount: 3 })} />)

        const push = screen.getByTestId('sync-push')
        expect(push.hasAttribute('disabled')).toBe(false)
    })

    it('disables Resolve when pendingConflictCount is 0', () => {
        render(<SyncActionCluster {...makeProps({ pendingConflictCount: 0 })} />)

        const resolve = screen.getByTestId('sync-resolve')
        expect(resolve.hasAttribute('disabled')).toBe(true)
    })

    it('enables Resolve and annotates the count when pendingConflictCount > 0', () => {
        render(<SyncActionCluster {...makeProps({ pendingConflictCount: 2 })} />)

        const resolve = screen.getByTestId('sync-resolve')
        expect(resolve.hasAttribute('disabled')).toBe(false)
        expect(resolve.textContent).toContain('Resolve')
        expect(resolve.textContent).toContain('(2)')
    })

    // ── Loading state ─────────────────────────────────────────────────────────

    it('shows the spinner on Pull and disables Push + Resolve when syncOp="pull"', () => {
        render(
            <SyncActionCluster
                {...makeProps({
                    driftCount: 3,
                    localEditCount: 2,
                    pendingConflictCount: 1,
                    syncOp: 'pull',
                })}
            />,
        )

        expect(screen.getByTestId('sync-pull-spinner')).toBeDefined()
        expect(screen.getByTestId('sync-pull').hasAttribute('disabled')).toBe(true)
        expect(screen.getByTestId('sync-push').hasAttribute('disabled')).toBe(true)
        expect(screen.getByTestId('sync-resolve').hasAttribute('disabled')).toBe(true)
    })

    it('shows the spinner on Push when syncOp="push"', () => {
        render(
            <SyncActionCluster
                {...makeProps({
                    driftCount: 3,
                    localEditCount: 2,
                    pendingConflictCount: 1,
                    syncOp: 'push',
                })}
            />,
        )

        expect(screen.getByTestId('sync-push-spinner')).toBeDefined()
        expect(screen.queryByTestId('sync-pull-spinner')).toBeNull()
    })

    it('shows the spinner on Resolve when syncOp="resolve"', () => {
        render(
            <SyncActionCluster
                {...makeProps({
                    driftCount: 3,
                    localEditCount: 2,
                    pendingConflictCount: 1,
                    syncOp: 'resolve',
                })}
            />,
        )

        expect(screen.getByTestId('sync-resolve-spinner')).toBeDefined()
    })

    // ── Callbacks ─────────────────────────────────────────────────────────────

    it('fires onPull exactly once when Pull is enabled and clicked', () => {
        const onPull = vi.fn()
        render(<SyncActionCluster {...makeProps({ driftCount: 1, onPull })} />)

        fireEvent.click(screen.getByTestId('sync-pull'))
        expect(onPull).toHaveBeenCalledTimes(1)
    })

    it('fires onPush exactly once when Push is enabled and clicked', () => {
        const onPush = vi.fn()
        render(<SyncActionCluster {...makeProps({ localEditCount: 1, onPush })} />)

        fireEvent.click(screen.getByTestId('sync-push'))
        expect(onPush).toHaveBeenCalledTimes(1)
    })

    it('fires onResolve exactly once when Resolve is enabled and clicked', () => {
        const onResolve = vi.fn()
        render(<SyncActionCluster {...makeProps({ pendingConflictCount: 1, onResolve })} />)

        fireEvent.click(screen.getByTestId('sync-resolve'))
        expect(onResolve).toHaveBeenCalledTimes(1)
    })

    it('does NOT fire onPull when Pull is disabled', () => {
        const onPull = vi.fn()
        render(<SyncActionCluster {...makeProps({ driftCount: 0, onPull })} />)

        fireEvent.click(screen.getByTestId('sync-pull'))
        expect(onPull).not.toHaveBeenCalled()
    })
})
