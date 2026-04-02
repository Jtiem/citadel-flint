/**
 * TokenDetailView.test.tsx
 *
 * MINT.3d: A11y Insights (motion tip, scale tip, mode switcher)
 * MINT.4c: Scale gap analysis
 * MINT.4e: Alias chain display
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TokenDetailView } from '../TokenDetailView'
import type { DesignToken } from '../../../../types/flint-api'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken & { aliasOf?: string; modes?: Record<string, string> }> = {}): DesignToken & { aliasOf?: string; modes?: Record<string, string> } {
    return {
        id: 1,
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#6366f1',
        description: null,
        mode: 'default',
        collection_name: 'Color Tokens',
        ...overrides,
    }
}

// ── Shared setup ──────────────────────────────────────────────────────────────

const onClose = vi.fn()

// ── Base rendering ────────────────────────────────────────────────────────────

describe('TokenDetailView — base', () => {
    it('renders the panel with data-testid', () => {
        render(<TokenDetailView token={makeToken()} onClose={onClose} />)
        expect(screen.getByTestId('token-detail-view')).toBeDefined()
    })

    it('calls onClose when X button is clicked', () => {
        const close = vi.fn()
        render(<TokenDetailView token={makeToken()} onClose={close} />)
        fireEvent.click(screen.getByLabelText('Close detail view'))
        expect(close).toHaveBeenCalledOnce()
    })

    it('calls onClose on Escape key', () => {
        const close = vi.fn()
        render(<TokenDetailView token={makeToken()} onClose={close} />)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(close).toHaveBeenCalledOnce()
    })

    it('renders color swatch for color tokens', () => {
        render(<TokenDetailView token={makeToken()} onClose={onClose} />)
        expect(screen.getByTestId('detail-swatch')).toBeDefined()
    })

    it('renders value display for non-color tokens', () => {
        const token = makeToken({ token_type: 'dimension', token_value: '16px', token_path: 'spacing.medium' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-value').textContent).toBe('16px')
    })
})

// ── MINT.4e: Alias chain ──────────────────────────────────────────────────────

describe('MINT.4e — alias chain', () => {
    it('shows alias chain when token has aliasOf', () => {
        const alias = makeToken({ aliasOf: 'color.primary.500' })
        render(<TokenDetailView token={alias} onClose={onClose} allTokens={[alias]} />)
        expect(screen.getByTestId('detail-alias-chain')).toBeDefined()
        expect(screen.getByTestId('detail-alias-chain').textContent).toContain('color.primary.500')
    })

    it('resolves multi-level alias chain', () => {
        const leaf = makeToken({ token_path: 'color.primary.500', token_value: '#6366f1', aliasOf: undefined })
        const mid = makeToken({ token_path: 'button.background', token_value: '#6366f1', aliasOf: 'color.primary.500' })
        const top = makeToken({ token_path: 'cta.bg', token_value: '#6366f1', aliasOf: 'button.background' })
        render(
            <TokenDetailView
                token={top}
                onClose={onClose}
                allTokens={[leaf, mid, top]}
            />,
        )
        const chainEl = screen.getByTestId('detail-alias-chain')
        expect(chainEl.textContent).toContain('cta.bg')
        expect(chainEl.textContent).toContain('button.background')
        expect(chainEl.textContent).toContain('color.primary.500')
    })

    it('does not show alias chain when no aliasOf', () => {
        render(<TokenDetailView token={makeToken()} onClose={onClose} />)
        expect(screen.queryByTestId('detail-alias-chain')).toBeNull()
    })

    it('shows alias chain without allTokens (2-segment fallback)', () => {
        const alias = makeToken({ aliasOf: 'color.brand.500' })
        render(<TokenDetailView token={alias} onClose={onClose} />)
        // aliasOf is present with no allTokens — should still show the chain
        const chainEl = screen.queryByTestId('detail-alias-chain')
        expect(chainEl).not.toBeNull()
        expect(chainEl!.textContent).toContain('color.brand.500')
    })
})

// ── MINT.4c: Scale gap analysis ───────────────────────────────────────────────

describe('MINT.4c — scale gap analysis', () => {
    const spacingTokens = [
        makeToken({ id: 1, token_path: 'spacing.xs', token_type: 'dimension', token_value: '4px' }),
        makeToken({ id: 2, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px' }),
        makeToken({ id: 3, token_path: 'spacing.md', token_type: 'dimension', token_value: '16px' }),
        makeToken({ id: 4, token_path: 'spacing.lg', token_type: 'dimension', token_value: '24px' }),
    ]

    it('shows scale context for a spacing token with neighbors', () => {
        render(
            <TokenDetailView
                token={spacingTokens[2]} // spacing.md = 16px
                onClose={onClose}
                allTokens={spacingTokens}
            />,
        )
        expect(screen.getByTestId('detail-scale-context')).toBeDefined()
        // prev = 8px, this = 16px, next = 24px
        expect(screen.getByTestId('detail-scale-context').textContent).toContain('8px')
        expect(screen.getByTestId('detail-scale-context').textContent).toContain('16px')
        expect(screen.getByTestId('detail-scale-context').textContent).toContain('24px')
    })

    it('shows "—" for prev when token is the smallest', () => {
        render(
            <TokenDetailView
                token={spacingTokens[0]} // spacing.xs = 4px
                onClose={onClose}
                allTokens={spacingTokens}
            />,
        )
        const ctx = screen.getByTestId('detail-scale-context')
        expect(ctx.textContent).toContain('—')
        expect(ctx.textContent).toContain('8px') // next
    })

    it('shows "—" for next when token is the largest', () => {
        render(
            <TokenDetailView
                token={spacingTokens[3]} // spacing.lg = 24px
                onClose={onClose}
                allTokens={spacingTokens}
            />,
        )
        const ctx = screen.getByTestId('detail-scale-context')
        expect(ctx.textContent).toContain('16px') // prev
        expect(ctx.textContent).toContain('—')
    })

    it('does not show scale context for color tokens', () => {
        render(<TokenDetailView token={makeToken()} onClose={onClose} allTokens={spacingTokens} />)
        expect(screen.queryByTestId('detail-scale-context')).toBeNull()
    })

    it('does not show scale context for non-scale dimension tokens', () => {
        const borderToken = makeToken({
            token_path: 'border.width',
            token_type: 'dimension',
            token_value: '2px',
        })
        render(
            <TokenDetailView
                token={borderToken}
                onClose={onClose}
                allTokens={[borderToken]}
            />,
        )
        expect(screen.queryByTestId('detail-scale-context')).toBeNull()
    })
})

// ── MINT.3d: A11y Insights ────────────────────────────────────────────────────

describe('MINT.3d — A11y insights', () => {
    it('shows motion tip for duration tokens', () => {
        const token = makeToken({ token_path: 'animation.duration.fast', token_type: 'dimension', token_value: '150ms' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-a11y-insights')).toBeDefined()
        expect(screen.getByTestId('detail-motion-tip')).toBeDefined()
        expect(screen.getByTestId('detail-motion-tip').textContent).toContain('prefers-reduced-motion')
    })

    it('shows motion tip for transition tokens', () => {
        const token = makeToken({ token_path: 'transition.ease', token_type: 'other', token_value: 'ease-in-out' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-motion-tip')).toBeDefined()
    })

    it('shows scale tip for spacing tokens', () => {
        const token = makeToken({ token_path: 'spacing.md', token_type: 'dimension', token_value: '16px' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-scale-tip')).toBeDefined()
        expect(screen.getByTestId('detail-scale-tip').textContent).toContain('WCAG 1.4.4')
    })

    it('shows scale tip for size tokens', () => {
        const token = makeToken({ token_path: 'icon.size.md', token_type: 'dimension', token_value: '24px' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-scale-tip')).toBeDefined()
    })

    it('shows scale tip for radius tokens', () => {
        const token = makeToken({ token_path: 'border.radius.lg', token_type: 'dimension', token_value: '8px' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-scale-tip')).toBeDefined()
    })

    it('does not show A11y insights for plain color tokens', () => {
        render(<TokenDetailView token={makeToken()} onClose={onClose} />)
        expect(screen.queryByTestId('detail-a11y-insights')).toBeNull()
    })

    it('shows mode-switcher when token has modes', () => {
        const token = makeToken({
            modes: { Light: '#ffffff', Dark: '#000000' },
        })
        render(<TokenDetailView token={token} onClose={onClose} />)
        expect(screen.getByTestId('detail-mode-switcher')).toBeDefined()
        expect(screen.getByText('Light')).toBeDefined()
        expect(screen.getByText('Dark')).toBeDefined()
    })

    it('mode switcher updates displayed value on click', () => {
        const token = makeToken({
            token_type: 'color',
            token_value: '#ffffff',
            modes: { Light: '#ffffff', Dark: '#000000' },
        })
        render(<TokenDetailView token={token} onClose={onClose} />)
        // Switch to Dark mode
        fireEvent.click(screen.getByText('Dark'))
        // Swatch aria-label updates
        expect(screen.getByTestId('detail-swatch').getAttribute('aria-label')).toContain('#000000')
    })

    it('does not show mode-switcher when token has no modes', () => {
        render(<TokenDetailView token={makeToken()} onClose={onClose} />)
        expect(screen.queryByTestId('detail-mode-switcher')).toBeNull()
    })

    it('details element is open by default when insights are present', () => {
        const token = makeToken({ token_path: 'animation.duration.base', token_type: 'dimension', token_value: '200ms' })
        render(<TokenDetailView token={token} onClose={onClose} />)
        const details = screen.getByTestId('detail-a11y-insights')
        expect((details as HTMLDetailsElement).open).toBe(true)
    })
})
