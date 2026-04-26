/**
 * DriftGroupSection.test.tsx — MINT.5 Phase 2 §2.2 test boundaries:
 *   - empty state renders placeholder when no drifts
 *   - groups drifted tokens by collection (correct headings + count)
 *   - each drift renders inside its matching collection section
 *   - currentPullingPath toggles isPulling on the matching row only
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DriftGroupSection } from '../DriftGroupSection'
import type { TokenDrift } from '../../../../../.flint-context/contracts/MINT.5-phase1.contract'

type TokenLookup = Map<
    string,
    { token_path: string; token_type: string; collection_name: string }
>

function buildTokensByPath(
    entries: Array<{ path: string; type: string; collection: string }>,
): TokenLookup {
    const map: TokenLookup = new Map()
    for (const e of entries) {
        map.set(e.path, {
            token_path: e.path,
            token_type: e.type,
            collection_name: e.collection,
        })
    }
    return map
}

// ── Empty state ───────────────────────────────────────────────────────────────

describe('DriftGroupSection — empty state', () => {
    it('renders the no-drift placeholder when driftedTokens=[]', () => {
        render(
            <DriftGroupSection
                driftedTokens={[]}
                tokensByPath={new Map()}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        expect(screen.getByTestId('drift-group-empty')).toBeTruthy()
        expect(screen.getByText(/no drift detected/i)).toBeTruthy()
        expect(screen.getByText(/your local tokens match figma/i)).toBeTruthy()
    })

    it('does not render the drift-group-section container when empty', () => {
        render(
            <DriftGroupSection
                driftedTokens={[]}
                tokensByPath={new Map()}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        expect(screen.queryByTestId('drift-group-section')).toBeNull()
    })
})

// ── Grouping by collection ───────────────────────────────────────────────────

describe('DriftGroupSection — grouping by collection', () => {
    const drifts: TokenDrift[] = [
        { tokenName: 'colors.primary',   localValue: '#f00', figmaValue: '#e00', deltaE: 3.2 },
        { tokenName: 'colors.secondary', localValue: '#0f0', figmaValue: '#0e0', deltaE: 2.1 },
        { tokenName: 'spacing.sm',       localValue: '16px', figmaValue: '18px' },
    ]
    const tokensByPath = buildTokensByPath([
        { path: 'colors.primary',   type: 'color',     collection: 'colors' },
        { path: 'colors.secondary', type: 'color',     collection: 'colors' },
        { path: 'spacing.sm',       type: 'dimension', collection: 'spacing' },
    ])

    it('renders one heading per distinct collection', () => {
        render(
            <DriftGroupSection
                driftedTokens={drifts}
                tokensByPath={tokensByPath}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        const headings = screen.getAllByRole('heading', { level: 3 })
        expect(headings.length).toBe(2)
        const headingText = headings.map(h => h.textContent)
        expect(headingText).toContain('colors')
        expect(headingText).toContain('spacing')
    })

    it('renders each drift row under its matching collection', () => {
        render(
            <DriftGroupSection
                driftedTokens={drifts}
                tokensByPath={tokensByPath}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        const colorsSection = screen.getByTestId('drift-group-colors')
        const spacingSection = screen.getByTestId('drift-group-spacing')

        expect(within(colorsSection).getByTestId('drift-row-colors.primary')).toBeTruthy()
        expect(within(colorsSection).getByTestId('drift-row-colors.secondary')).toBeTruthy()
        expect(within(spacingSection).getByTestId('drift-row-spacing.sm')).toBeTruthy()

        // Cross-section isolation
        expect(within(colorsSection).queryByTestId('drift-row-spacing.sm')).toBeNull()
        expect(within(spacingSection).queryByTestId('drift-row-colors.primary')).toBeNull()
    })

    it('orders collections alphabetically (colors before spacing)', () => {
        render(
            <DriftGroupSection
                driftedTokens={drifts}
                tokensByPath={tokensByPath}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        const headings = screen.getAllByRole('heading', { level: 3 })
        expect(headings[0].textContent).toBe('colors')
        expect(headings[1].textContent).toBe('spacing')
    })

    it('falls back to "Ungrouped" bucket when tokensByPath lookup is missing', () => {
        const orphanDrifts: TokenDrift[] = [
            { tokenName: 'missing.token', localValue: '1px', figmaValue: '2px' },
        ]
        render(
            <DriftGroupSection
                driftedTokens={orphanDrifts}
                tokensByPath={new Map()}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        const heading = screen.getByRole('heading', { level: 3 })
        expect(heading.textContent).toBe('Ungrouped')
        expect(screen.getByTestId('drift-row-missing.token')).toBeTruthy()
    })
})

// ── isPulling propagation ─────────────────────────────────────────────────────

describe('DriftGroupSection — isPulling propagation', () => {
    const drifts: TokenDrift[] = [
        { tokenName: 'colors.primary',   localValue: '#f00', figmaValue: '#e00', deltaE: 3.2 },
        { tokenName: 'colors.secondary', localValue: '#0f0', figmaValue: '#0e0', deltaE: 2.1 },
    ]
    const tokensByPath = buildTokensByPath([
        { path: 'colors.primary',   type: 'color', collection: 'colors' },
        { path: 'colors.secondary', type: 'color', collection: 'colors' },
    ])

    it('only the current row shows the pulling state', () => {
        render(
            <DriftGroupSection
                driftedTokens={drifts}
                tokensByPath={tokensByPath}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath="colors.primary"
            />
        )
        const pullingBtn = screen.getByTestId('drift-pull-colors.primary') as HTMLButtonElement
        const idleBtn    = screen.getByTestId('drift-pull-colors.secondary') as HTMLButtonElement

        expect(pullingBtn.disabled).toBe(true)
        expect(idleBtn.disabled).toBe(false)
    })

    it('no rows are pulling when currentPullingPath=null', () => {
        render(
            <DriftGroupSection
                driftedTokens={drifts}
                tokensByPath={tokensByPath}
                onPullOne={vi.fn()}
                onSelect={vi.fn()}
                currentPullingPath={null}
            />
        )
        const primary   = screen.getByTestId('drift-pull-colors.primary') as HTMLButtonElement
        const secondary = screen.getByTestId('drift-pull-colors.secondary') as HTMLButtonElement
        expect(primary.disabled).toBe(false)
        expect(secondary.disabled).toBe(false)
    })
})
