/**
 * TokenDetailPanel.test.tsx — MINT.4d tests
 *
 * TDP-01: Renders with token path and value
 * TDP-02: Shows color swatch for color tokens
 * TDP-03: Does not show swatch for non-color tokens
 * TDP-04: Shows usage count and file list
 * TDP-05: Shows dead token warning when usage is 0
 * TDP-06: Shows drift information when drifted
 * TDP-07: Shows sync status
 * TDP-08: Shows contrast pairings
 * TDP-09: Shows provenance section
 * TDP-10: Clicking close button calls onClose
 * TDP-11: Pressing Escape calls onClose (via FocusTrap)
 * TDP-12: Shows dark mode counterpart when available
 * TDP-13: Tab from last focusable element wraps to first (FocusTrap)
 * TDP-14: Shift+Tab from first focusable element wraps to last (FocusTrap)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TokenDetailPanel } from '../TokenDetailPanel'
import type { DesignToken, ContrastPair } from '../../../types/flint-api'

const mockToken: DesignToken = {
    id: 1,
    token_path: 'color.brand.primary',
    token_type: 'color',
    token_value: '#0066FF',
    description: 'Primary brand color',
    mode: 'light',
    collection_name: 'Brand Tokens',
}

const mockDimensionToken: DesignToken = {
    id: 2,
    token_path: 'spacing.medium',
    token_type: 'dimension',
    token_value: '16px',
    description: null,
    mode: 'default',
    collection_name: 'Spacing',
}

describe('TokenDetailPanel — MINT.4d', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('TDP-01: renders with token path and value', () => {
        render(<TokenDetailPanel token={mockToken} onClose={vi.fn()} />)
        expect(screen.getByTestId('token-detail-path').textContent).toBe('color.brand.primary')
        expect(screen.getByTestId('token-detail-value').textContent).toBe('#0066FF')
    })

    it('TDP-02: shows color swatch for color tokens', () => {
        render(<TokenDetailPanel token={mockToken} onClose={vi.fn()} />)
        expect(screen.getByTestId('token-detail-swatch')).toBeTruthy()
    })

    it('TDP-03: does not show swatch for non-color tokens', () => {
        render(<TokenDetailPanel token={mockDimensionToken} onClose={vi.fn()} />)
        expect(screen.queryByTestId('token-detail-swatch')).toBeNull()
    })

    it('TDP-04: shows usage count and file list', () => {
        render(
            <TokenDetailPanel
                token={mockToken}
                onClose={vi.fn()}
                usageResult={{
                    tokenName: 'color.brand.primary',
                    cssVar: '--color-brand-primary',
                    usageCount: 3,
                    files: ['src/App.tsx', 'src/Button.tsx', 'src/Card.tsx'],
                }}
            />,
        )
        const usage = screen.getByTestId('token-detail-usage')
        expect(usage.textContent).toContain('3 files')
        const fileList = screen.getByTestId('token-detail-file-list')
        expect(fileList.children.length).toBe(3)
    })

    it('TDP-05: shows dead token warning when usage is 0', () => {
        render(
            <TokenDetailPanel
                token={mockToken}
                onClose={vi.fn()}
                usageResult={{
                    tokenName: 'color.brand.primary',
                    cssVar: '--color-brand-primary',
                    usageCount: 0,
                    files: [],
                }}
            />,
        )
        const usage = screen.getByTestId('token-detail-usage')
        expect(usage.textContent).toContain('dead token')
    })

    it('TDP-06: shows drift information when drifted', () => {
        render(
            <TokenDetailPanel
                token={mockToken}
                onClose={vi.fn()}
                drift={{
                    tokenName: 'color.brand.primary',
                    localValue: '#0066FF',
                    figmaValue: '#0055EE',
                }}
            />,
        )
        const drift = screen.getByTestId('token-detail-drift')
        expect(drift.textContent).toContain('#0066FF')
        expect(drift.textContent).toContain('#0055EE')
    })

    it('TDP-07: shows sync status', () => {
        render(
            <TokenDetailPanel
                token={mockToken}
                onClose={vi.fn()}
                syncStatus="synced"
            />,
        )
        const sync = screen.getByTestId('token-detail-sync')
        expect(sync.textContent).toContain('In sync')
    })

    it('TDP-08: shows contrast pairings', () => {
        const pairs: ContrastPair[] = [
            { fg: 'color.brand.primary', bg: 'color.surface.white', fgValue: '#0066FF', bgValue: '#FFFFFF', ratio: 4.8, passAA: true, passAAA: false },
        ]
        render(
            <TokenDetailPanel
                token={mockToken}
                onClose={vi.fn()}
                contrastPairs={pairs}
            />,
        )
        const contrast = screen.getByTestId('token-detail-contrast')
        expect(contrast.textContent).toContain('4.8:1')
        expect(contrast.textContent).toContain('AA')
    })

    it('TDP-09: shows provenance section', () => {
        render(<TokenDetailPanel token={mockToken} onClose={vi.fn()} />)
        const provenance = screen.getByTestId('token-detail-provenance')
        expect(provenance.textContent).toContain('Brand Tokens')
        expect(provenance.textContent).toContain('light')
        expect(provenance.textContent).toContain('color')
    })

    it('TDP-10: clicking close button calls onClose', () => {
        const onClose = vi.fn()
        render(<TokenDetailPanel token={mockToken} onClose={onClose} />)
        fireEvent.click(screen.getByTestId('token-detail-close'))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('TDP-11: pressing Escape calls onClose (via FocusTrap)', () => {
        const onClose = vi.fn()
        render(<TokenDetailPanel token={mockToken} onClose={onClose} />)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('TDP-12: shows dark mode counterpart when available', () => {
        const darkToken: DesignToken = {
            ...mockToken,
            id: 2,
            mode: 'dark',
            token_value: '#003399',
        }
        render(
            <TokenDetailPanel
                token={mockToken}
                onClose={vi.fn()}
                darkModeToken={darkToken}
            />,
        )
        expect(screen.getByTestId('token-detail-panel').textContent).toContain('#003399')
    })

    it('TDP-13: Tab from last focusable element wraps to first (FocusTrap)', async () => {
        render(<TokenDetailPanel token={mockToken} onClose={vi.fn()} />)

        // Flush the FocusTrap's initial focus timer
        await act(async () => {
            vi.advanceTimersByTime(1)
        })

        // The panel has focusable elements — get all of them from the trap container
        const trap = document.querySelector('[data-focus-trap]') as HTMLElement
        const focusable = Array.from(
            trap.querySelectorAll<HTMLElement>(
                'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
            ),
        )

        expect(focusable.length).toBeGreaterThan(0)

        // Focus the last element and Tab — should wrap to first
        const last = focusable[focusable.length - 1]
        last.focus()
        expect(document.activeElement).toBe(last)

        fireEvent.keyDown(document, { key: 'Tab' })
        expect(document.activeElement).toBe(focusable[0])
    })

    it('TDP-14: Shift+Tab from first focusable element wraps to last (FocusTrap)', async () => {
        render(<TokenDetailPanel token={mockToken} onClose={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(1)
        })

        const trap = document.querySelector('[data-focus-trap]') as HTMLElement
        const focusable = Array.from(
            trap.querySelectorAll<HTMLElement>(
                'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
            ),
        )

        expect(focusable.length).toBeGreaterThan(0)

        // Focus the first element and Shift+Tab — should wrap to last
        focusable[0].focus()
        expect(document.activeElement).toBe(focusable[0])

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(focusable[focusable.length - 1])
    })
})
