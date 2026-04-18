/**
 * TokenDriftRow.test.tsx — MINT.5 Phase 2 §2.2 test boundaries:
 *   - TokenDriftRow color       — renders swatches + ΔE chip for colors
 *   - TokenDriftRow dimension   — renders values, omits ΔE chip for non-colors
 *   - TokenDriftRow pullOne     — Pull button fires onPullOne with tokenPath
 *   - TokenDriftRow keyboard    — Enter/Space fires onSelect with tokenPath
 *   - TokenDriftRow a11y        — row has accessible name, Pull has token
 *     context in aria-label (not just "Pull")
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TokenDriftRow } from '../TokenDriftRow'
import type { TokenDrift } from '../../../../../.flint-context/contracts/MINT.5-phase1.contract'

const colorDrift: TokenDrift = {
    tokenName: 'colors.primary',
    localValue: '#ff0000',
    figmaValue: '#ee0000',
    deltaE: 3.2,
}

const dimensionDrift: TokenDrift = {
    tokenName: 'spacing.sm',
    localValue: '16px',
    figmaValue: '18px',
}

// ── Color token row ──────────────────────────────────────────────────────────

describe('TokenDriftRow — color token', () => {
    it('renders two color swatches (local + figma) as role=img', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const swatches = screen.getAllByRole('img', { name: /swatch/i })
        expect(swatches.length).toBe(2)
    })

    it('renders ΔE chip with formatted value', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const chip = screen.getByTestId('drift-delta-colors.primary')
        expect(chip.textContent).toMatch(/ΔE\s*3\.2/)
    })

    it('renders amber-tier ΔE chip when deltaE=3.2', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const chip = screen.getByTestId('drift-delta-colors.primary')
        expect(chip.className).toContain('amber')
    })

    it('renders critical-tier ΔE chip when deltaE > 4', () => {
        render(
            <TokenDriftRow
                drift={{ ...colorDrift, deltaE: 5.8 }}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const chip = screen.getByTestId('drift-delta-colors.primary')
        expect(chip.className).toContain('red')
    })
})

// ── Non-color token row ──────────────────────────────────────────────────────

describe('TokenDriftRow — non-color token (dimension)', () => {
    it('renders raw text values, no swatches', () => {
        render(
            <TokenDriftRow
                drift={dimensionDrift}
                tokenType="dimension"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        expect(screen.getByText('16px')).toBeTruthy()
        expect(screen.getByText('18px')).toBeTruthy()
        expect(screen.queryAllByRole('img', { name: /swatch/i }).length).toBe(0)
    })

    it('omits the ΔE chip for dimension tokens', () => {
        render(
            <TokenDriftRow
                drift={dimensionDrift}
                tokenType="dimension"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        expect(screen.queryByTestId('drift-delta-spacing.sm')).toBeNull()
        // Defensive text query (case-insensitive)
        expect(screen.queryByText(/ΔE/i)).toBeNull()
    })
})

// ── Pull-this button ─────────────────────────────────────────────────────────

describe('TokenDriftRow — Pull-this button', () => {
    it('fires onPullOne with the tokenName when clicked', () => {
        const onPullOne = vi.fn()
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={onPullOne}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const pullBtn = screen.getByTestId('drift-pull-colors.primary')
        fireEvent.click(pullBtn)
        expect(onPullOne).toHaveBeenCalledTimes(1)
        expect(onPullOne).toHaveBeenCalledWith('colors.primary')
    })

    it('does not fire onSelect when Pull button is clicked (stopPropagation)', () => {
        const onSelect = vi.fn()
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={onSelect}
                isPulling={false}
            />
        )
        const pullBtn = screen.getByTestId('drift-pull-colors.primary')
        fireEvent.click(pullBtn)
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('is disabled while isPulling=true', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={true}
            />
        )
        const pullBtn = screen.getByTestId('drift-pull-colors.primary') as HTMLButtonElement
        expect(pullBtn.disabled).toBe(true)
    })

    it('does not fire onPullOne while isPulling=true', () => {
        const onPullOne = vi.fn()
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={onPullOne}
                onSelect={vi.fn()}
                isPulling={true}
            />
        )
        const pullBtn = screen.getByTestId('drift-pull-colors.primary')
        fireEvent.click(pullBtn)
        expect(onPullOne).not.toHaveBeenCalled()
    })
})

// ── Keyboard activation ──────────────────────────────────────────────────────

describe('TokenDriftRow — keyboard navigation', () => {
    it('fires onSelect with tokenName when Enter pressed on row', () => {
        const onSelect = vi.fn()
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={onSelect}
                isPulling={false}
            />
        )
        const row = screen.getByRole('button', { name: /open detail for colors\.primary/i })
        fireEvent.keyDown(row, { key: 'Enter' })
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith('colors.primary')
    })

    it('fires onSelect when Space pressed on row', () => {
        const onSelect = vi.fn()
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={onSelect}
                isPulling={false}
            />
        )
        const row = screen.getByRole('button', { name: /open detail for colors\.primary/i })
        fireEvent.keyDown(row, { key: ' ' })
        expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('fires onSelect when row clicked (not Pull button)', () => {
        const onSelect = vi.fn()
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={onSelect}
                isPulling={false}
            />
        )
        const row = screen.getByRole('button', { name: /open detail for colors\.primary/i })
        fireEvent.click(row)
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith('colors.primary')
    })
})

// ── Accessibility ────────────────────────────────────────────────────────────

describe('TokenDriftRow — accessibility', () => {
    it('has role=button with accessible name referencing the token path', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const row = screen.getByRole('button', { name: /open detail for colors\.primary/i })
        expect(row).toBeTruthy()
    })

    it('Pull button aria-label includes the token name (not bare "Pull")', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const pullBtn = screen.getByLabelText(/pull colors\.primary from figma/i)
        expect(pullBtn).toBeTruthy()
    })

    it('row is keyboard-focusable (tabIndex=0)', () => {
        render(
            <TokenDriftRow
                drift={colorDrift}
                tokenType="color"
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                isPulling={false}
            />
        )
        const row = screen.getByRole('button', { name: /open detail for colors\.primary/i })
        expect(row.tabIndex).toBe(0)
    })
})
