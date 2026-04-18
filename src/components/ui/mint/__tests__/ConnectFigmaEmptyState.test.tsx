/**
 * ConnectFigmaEmptyState.test.tsx — MINT.5 Phase 2 §2.3 test boundaries:
 *   - disconnected variant          — Connect CTA + Import link rendered
 *   - connected-no-tokens variant   — Pull CTA rendered, no Connect CTA
 *   - has-tokens variant            — returns null (suppressed)
 *   - CTAs fire their respective props
 *   - syncOp='connect' disables Connect button
 *   - syncOp='pull' disables Pull button
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectFigmaEmptyState } from '../ConnectFigmaEmptyState'

// ── Variant 1: disconnected ──────────────────────────────────────────────────

describe('ConnectFigmaEmptyState — disconnected variant', () => {
    it('renders the "Connect Figma" primary CTA', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const cta = screen.getByRole('button', { name: /connect figma/i })
        expect(cta).toBeTruthy()
    })

    it('renders the "Import tokens manually" secondary link', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const link = screen.getByTestId('connect-figma-import-link')
        expect(link.textContent).toMatch(/import tokens manually/i)
    })

    it('does not render the Pull CTA in disconnected variant', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        expect(screen.queryByTestId('connect-figma-pull-cta')).toBeNull()
    })

    it('fires onConnect when the Connect button is clicked', () => {
        const onConnect = vi.fn()
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp={null}
                onConnect={onConnect}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        fireEvent.click(screen.getByTestId('connect-figma-connect-cta'))
        expect(onConnect).toHaveBeenCalledTimes(1)
    })

    it('fires onOpenImport when the Import link is clicked', () => {
        const onOpenImport = vi.fn()
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={onOpenImport}
            />
        )
        fireEvent.click(screen.getByTestId('connect-figma-import-link'))
        expect(onOpenImport).toHaveBeenCalledTimes(1)
    })

    it('disables the Connect CTA when syncOp="connect"', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp="connect"
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const cta = screen.getByTestId('connect-figma-connect-cta') as HTMLButtonElement
        expect(cta.disabled).toBe(true)
    })
})

// ── Variant 2: connected, no tokens ──────────────────────────────────────────

describe('ConnectFigmaEmptyState — connected-no-tokens variant', () => {
    it('renders the "Pull tokens from Figma" primary CTA', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={true}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const cta = screen.getByRole('button', { name: /pull tokens from figma/i })
        expect(cta).toBeTruthy()
    })

    it('suppresses the Connect CTA in connected variant', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={true}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        expect(screen.queryByTestId('connect-figma-connect-cta')).toBeNull()
        expect(screen.queryByRole('button', { name: /^connect figma$/i })).toBeNull()
    })

    it('fires onPullFromFigma when the Pull CTA is clicked', () => {
        const onPullFromFigma = vi.fn()
        render(
            <ConnectFigmaEmptyState
                figmaConnected={true}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={onPullFromFigma}
                onOpenImport={vi.fn()}
            />
        )
        fireEvent.click(screen.getByTestId('connect-figma-pull-cta'))
        expect(onPullFromFigma).toHaveBeenCalledTimes(1)
    })

    it('disables the Pull CTA when syncOp="pull"', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={true}
                tokenCount={0}
                syncOp="pull"
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const cta = screen.getByTestId('connect-figma-pull-cta') as HTMLButtonElement
        expect(cta.disabled).toBe(true)
    })
})

// ── Variant 3: has tokens (component inactive) ────────────────────────────────

describe('ConnectFigmaEmptyState — has-tokens variant', () => {
    it('returns null when tokenCount > 0 (container empty)', () => {
        const { container } = render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={5}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('returns null even when connected and tokens exist', () => {
        const { container } = render(
            <ConnectFigmaEmptyState
                figmaConnected={true}
                tokenCount={3}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('does not fire any CTA prop when tokens exist', () => {
        const onConnect = vi.fn()
        const onPullFromFigma = vi.fn()
        const onOpenImport = vi.fn()
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={5}
                syncOp={null}
                onConnect={onConnect}
                onPullFromFigma={onPullFromFigma}
                onOpenImport={onOpenImport}
            />
        )
        // No CTAs to click — just assert they weren't called from render side effects
        expect(onConnect).not.toHaveBeenCalled()
        expect(onPullFromFigma).not.toHaveBeenCalled()
        expect(onOpenImport).not.toHaveBeenCalled()
    })
})

// ── Accessibility ────────────────────────────────────────────────────────────

describe('ConnectFigmaEmptyState — accessibility', () => {
    it('uses role=region with aria-labelledby in disconnected variant', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={false}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const region = screen.getByRole('region')
        const labelId = region.getAttribute('aria-labelledby')
        expect(labelId).toBeTruthy()
        const heading = document.getElementById(labelId as string)
        expect(heading).toBeTruthy()
        expect(heading?.tagName).toBe('H2')
    })

    it('uses role=region with aria-labelledby in connected variant', () => {
        render(
            <ConnectFigmaEmptyState
                figmaConnected={true}
                tokenCount={0}
                syncOp={null}
                onConnect={vi.fn()}
                onPullFromFigma={vi.fn()}
                onOpenImport={vi.fn()}
            />
        )
        const region = screen.getByRole('region')
        expect(region.getAttribute('aria-labelledby')).toBeTruthy()
    })
})
