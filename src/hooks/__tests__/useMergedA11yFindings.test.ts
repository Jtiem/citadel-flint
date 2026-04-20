/**
 * useMergedA11yFindings.test.ts
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract test boundaries:
 *   - `useMergedA11yFindings dedup`
 *   - `useMergedA11yFindings no dedup different element`
 *   - `useMergedA11yFindings runtime-only`
 *   - `useMergedA11yFindings memoization`
 *
 * Both the pure `mergeA11yFindings` function and the memoized
 * `useMergedA11yFindings` hook are covered here; the former is the
 * authority for behavior, the latter is tested for memoization.
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    mergeA11yFindings,
    useMergedA11yFindings,
} from '../useMergedA11yFindings'
import type {
    A11yViolationDetail,
    RuntimeAuditResult,
} from '../../types/runtime-audit'

function makeDetail(
    overrides: Partial<A11yViolationDetail> = {},
): A11yViolationDetail {
    return {
        ruleId: 'A11Y-001',
        elementId: 'elem-1',
        message: 'image missing alt',
        severity: 'critical',
        wcag: 'WCAG 2.1 SC 1.1.1',
        fixable: false,
        ...overrides,
    }
}

function makeRuntime(
    overrides: Partial<RuntimeAuditResult> = {},
): RuntimeAuditResult {
    return {
        status: 'violations',
        timestamp: new Date().toISOString(),
        axeVersion: '4.10.3',
        nodeCount: 10,
        durationMs: 50,
        violations: [],
        ...overrides,
    }
}

// ── Contract boundary: dedup same element + same rule ────────────────────────

describe('mergeA11yFindings — dedup on matching (ruleId, elementId)', () => {
    it('collapses into single row with two authorities on match', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]
        const runtime = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged).toHaveLength(1)
        expect(merged[0].sourceAuthorities).toEqual([
            'WCAG 2.1 AA',
            'runtime-dom',
        ])
    })

    it('chip order is deterministic — AST first, runtime second', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-002', elementId: 'btn-3' })]
        const runtime = [makeDetail({ ruleId: 'A11Y-002', elementId: 'btn-3' })]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged[0].sourceAuthorities[0]).toBe('WCAG 2.1 AA')
        expect(merged[0].sourceAuthorities[1]).toBe('runtime-dom')
    })

    it('merged severity is the higher of the two', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1', severity: 'advisory' })]
        const runtime = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1', severity: 'critical' })]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged).toHaveLength(1)
        expect(merged[0].severity).toBe('critical')
    })
})

// ── Contract boundary: no dedup different element ────────────────────────────

describe('mergeA11yFindings — no dedup when elementIds differ', () => {
    it('two separate findings when elementIds differ', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]
        const runtime = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e2' })]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged).toHaveLength(2)
        expect(merged[0].sourceAuthorities).toEqual(['WCAG 2.1 AA'])
        expect(merged[1].sourceAuthorities).toEqual(['runtime-dom'])
    })

    it('two separate findings when ruleIds differ even if elementId matches', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]
        const runtime = [makeDetail({ ruleId: 'A11Y-002', elementId: 'e1' })]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged).toHaveLength(2)
    })
})

// ── Contract boundary: runtime-only ─────────────────────────────────────────

describe('mergeA11yFindings — runtime-only findings (RUNTIME-* prefix)', () => {
    it('preserves runtime-only findings with single authority', () => {
        const ast: A11yViolationDetail[] = []
        const runtime = [
            makeDetail({ ruleId: 'RUNTIME-frame-title', elementId: 'iframe-1' }),
        ]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged).toHaveLength(1)
        expect(merged[0].sourceAuthorities).toEqual(['runtime-dom'])
        expect(merged[0].ruleId).toBe('RUNTIME-frame-title')
    })
})

// ── Contract invariant: dedup-coverage ≥ 85% over 20-pair fixture ────────────

describe('mergeA11yFindings — dedup-coverage invariant (≥ 85% over 20 pairs)', () => {
    it('20 matched pairs → merged length matches AST length (100% coverage)', () => {
        // Build 20 AST+runtime pairs where every pair matches on (ruleId, elementId).
        const pairs = 20
        const ast: A11yViolationDetail[] = []
        const runtime: A11yViolationDetail[] = []
        for (let i = 0; i < pairs; i++) {
            ast.push(makeDetail({ ruleId: `A11Y-${String(i).padStart(3, '0')}`, elementId: `e-${i}` }))
            runtime.push(makeDetail({ ruleId: `A11Y-${String(i).padStart(3, '0')}`, elementId: `e-${i}` }))
        }

        const merged = mergeA11yFindings(ast, runtime)

        // All should collapse — 20 merged rows, each with 2 authorities.
        expect(merged).toHaveLength(pairs)
        const mergedCount = merged.filter(
            (m) => m.sourceAuthorities.length === 2,
        ).length
        // Coverage = mergedCount / pairs — contract threshold ≥ 0.85.
        expect(mergedCount / pairs).toBeGreaterThanOrEqual(0.85)
    })
})

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('mergeA11yFindings — edge cases', () => {
    it('empty inputs produce empty output', () => {
        expect(mergeA11yFindings([], [])).toEqual([])
    })

    it('AST-only inputs carry WCAG 2.1 AA authority', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]
        const merged = mergeA11yFindings(ast, [])

        expect(merged).toHaveLength(1)
        expect(merged[0].sourceAuthorities).toEqual(['WCAG 2.1 AA'])
    })

    it('IDs containing hyphens are not confused with separator', () => {
        // Pathological: the dedup key uses \u0001 so hyphens in IDs can never
        // cause a false merge even with a contrived ruleId+elementId overlap.
        const ast = [makeDetail({ ruleId: 'A11Y-001-extra', elementId: 'e-1' })]
        const runtime = [makeDetail({ ruleId: 'A11Y-001', elementId: 'extra-e-1' })]

        const merged = mergeA11yFindings(ast, runtime)

        expect(merged).toHaveLength(2)
    })
})

// ── Contract boundary: memoization ──────────────────────────────────────────

describe('useMergedA11yFindings — memoization', () => {
    it('returns the same array reference when inputs are unchanged', () => {
        const ast = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]
        const runtime = makeRuntime({
            violations: [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })],
        })

        const { result, rerender } = renderHook(
            ({ a, r }: { a: A11yViolationDetail[]; r: RuntimeAuditResult | null }) =>
                useMergedA11yFindings(a, r),
            {
                initialProps: { a: ast, r: runtime },
            },
        )

        const first = result.current
        rerender({ a: ast, r: runtime })
        const second = result.current

        expect(first).toBe(second)
    })

    it('returns a new reference when AST changes', () => {
        const ast1 = [makeDetail({ ruleId: 'A11Y-001', elementId: 'e1' })]
        const ast2 = [makeDetail({ ruleId: 'A11Y-002', elementId: 'e1' })]
        const runtime = makeRuntime()

        const { result, rerender } = renderHook(
            ({ a }: { a: A11yViolationDetail[] }) =>
                useMergedA11yFindings(a, runtime),
            { initialProps: { a: ast1 } },
        )

        const first = result.current
        rerender({ a: ast2 })
        const second = result.current

        expect(first).not.toBe(second)
    })
})
