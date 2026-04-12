/**
 * Fluid Interpolator Tests — flint-mcp/src/core/__tests__/fluidInterpolator.test.ts
 *
 * P6: Tests for the Fluid Interpolator (MITHRIL-FLUID-001).
 *
 * Test inventory:
 *   1.  text-base lg:text-xl → suggests clamp for text-size
 *   2.  p-4 md:p-6 lg:p-8 → suggests clamp for padding across 3 breakpoints
 *   3.  text-sm sm:text-base lg:text-xl xl:text-2xl → 4 breakpoints, single suggestion
 *   4.  Only base class (no breakpoints) → no suggestion
 *   5.  Identical values across breakpoints → no suggestion
 *   6.  Custom arbitrary values (text-[13px]) → skipped
 *   7.  Very small delta (2px) → skipped (below MIN_DELTA_PX)
 *   8.  Multiple properties in one element → multiple suggestions
 *   9.  Empty JSX → no suggestions
 *  10.  Policy fluidSuggestions='off' → no warnings from visitor
 *  11.  computeClampExpression math (pure helper)
 *  12.  Per-rule mode MITHRIL-FLUID-001='off' → no warnings
 *  13.  auditAll integration emits advisory warnings
 *  14.  Suggestion severity is always 'advisory' and never fixable
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    findFluidOpportunities,
    visitFluidOpportunities,
    computeClampExpression,
} from '../fluidInterpolator.js'
import { auditAll } from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

function wrap(jsx: string): string {
    return `const C = () => (${jsx});`
}

const NO_TOKENS: DesignToken[] = []

describe('fluidInterpolator — findFluidOpportunities', () => {
    it('suggests clamp for text-base lg:text-xl', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="t1" className="text-base lg:text-xl">Hello</p>'),
        )
        const suggestions = findFluidOpportunities(ast)
        expect(suggestions).toHaveLength(1)
        expect(suggestions[0].property).toBe('text-size')
        expect(suggestions[0].values).toHaveLength(2)
        expect(suggestions[0].values.map((v) => v.px)).toEqual([16, 20])
        expect(suggestions[0].suggestedClamp).toMatch(/^clamp\(/)
        expect(suggestions[0].suggestedClamp).toContain('1rem')
        expect(suggestions[0].suggestedClamp).toContain('1.25rem')
        expect(suggestions[0].flintId).toBe('t1')
    })

    it('suggests clamp for padding across 3 breakpoints', () => {
        const ast = parseJSX(
            wrap('<div data-flint-id="d1" className="p-4 md:p-6 lg:p-8" />'),
        )
        const suggestions = findFluidOpportunities(ast)
        expect(suggestions).toHaveLength(1)
        expect(suggestions[0].property).toBe('padding')
        expect(suggestions[0].values).toHaveLength(3)
        // Smallest → largest
        const px = suggestions[0].values.map((v) => v.px)
        expect(px[0]).toBe(16)
        expect(px[px.length - 1]).toBe(32)
    })

    it('handles 4 breakpoints (text-sm sm:text-base lg:text-xl xl:text-2xl)', () => {
        const ast = parseJSX(
            wrap(
                '<h1 data-flint-id="h1" className="text-sm sm:text-base lg:text-xl xl:text-2xl">Title</h1>',
            ),
        )
        const suggestions = findFluidOpportunities(ast)
        expect(suggestions).toHaveLength(1)
        expect(suggestions[0].values).toHaveLength(4)
        // Min px (14 from text-sm) → Max px (24 from text-2xl)
        expect(suggestions[0].values[0].px).toBe(14)
        expect(
            suggestions[0].values[suggestions[0].values.length - 1].px,
        ).toBe(24)
    })

    it('returns no suggestions for a single breakpoint / base-only', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="p1" className="text-base">Only base</p>'),
        )
        expect(findFluidOpportunities(ast)).toHaveLength(0)
    })

    it('returns no suggestions when all breakpoint values are identical', () => {
        const ast = parseJSX(
            wrap('<div data-flint-id="d2" className="p-4 md:p-4 lg:p-4" />'),
        )
        expect(findFluidOpportunities(ast)).toHaveLength(0)
    })

    it('skips arbitrary custom values (non-standard Tailwind)', () => {
        const ast = parseJSX(
            wrap(
                '<p data-flint-id="p2" className="text-[13px] lg:text-[17px]">Custom</p>',
            ),
        )
        expect(findFluidOpportunities(ast)).toHaveLength(0)
    })

    it('skips when pixel delta is below MIN_DELTA_PX (2px)', () => {
        // text-base (16px) → text-lg (18px) = 2px delta
        const ast = parseJSX(
            wrap(
                '<p data-flint-id="p3" className="text-base lg:text-lg">Tiny delta</p>',
            ),
        )
        expect(findFluidOpportunities(ast)).toHaveLength(0)
    })

    it('emits multiple suggestions for multiple properties on one element', () => {
        const ast = parseJSX(
            wrap(
                '<div data-flint-id="m1" className="text-base lg:text-xl p-4 lg:p-8" />',
            ),
        )
        const suggestions = findFluidOpportunities(ast)
        expect(suggestions.length).toBeGreaterThanOrEqual(2)
        const properties = suggestions.map((s) => s.property).sort()
        expect(properties).toContain('text-size')
        expect(properties).toContain('padding')
    })

    it('returns no suggestions for an empty JSX component', () => {
        const ast = parseJSX(wrap('<></>'))
        expect(findFluidOpportunities(ast)).toHaveLength(0)
    })
})

describe('fluidInterpolator — visitFluidOpportunities (MithrilLinter visitor)', () => {
    it('emits no warnings when fluidSuggestions policy is "off"', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="t1" className="text-base lg:text-xl" />'),
        )
        const warnings = visitFluidOpportunities(ast, {
            fluidSuggestions: 'off',
        })
        expect(warnings.size).toBe(0)
    })

    it('emits no warnings when per-rule mode MITHRIL-FLUID-001 is "off"', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="t2" className="text-base lg:text-xl" />'),
        )
        const warnings = visitFluidOpportunities(ast, {
            ruleModes: { 'MITHRIL-FLUID-001': 'off' },
        })
        expect(warnings.size).toBe(0)
    })

    it('emits advisory warnings by default (never fixable)', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="t3" className="p-4 md:p-6 lg:p-8" />'),
        )
        const warnings = visitFluidOpportunities(ast)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.severity).toBe('advisory')
        expect(w.fixable).toBe(false)
        expect(w.ruleId).toBe('MITHRIL-FLUID-001')
        expect(w.type).toBe('fluid-suggestion')
        expect(w.message).toContain('clamp(')
    })
})

describe('fluidInterpolator — computeClampExpression (math)', () => {
    it('produces a well-formed clamp for text-base → text-xl between md and lg', () => {
        const expr = computeClampExpression(16, 20, 768, 1024)
        expect(expr.startsWith('clamp(')).toBe(true)
        expect(expr).toContain('1rem')
        expect(expr).toContain('1.25rem')
        expect(expr).toContain('vw')
    })

    it('produces a min-only clamp when values are equal', () => {
        const expr = computeClampExpression(16, 16, 768, 1024)
        expect(expr).toContain('1rem')
    })

    it('handles reversed order (max before min) gracefully', () => {
        const a = computeClampExpression(20, 16, 1024, 768)
        const b = computeClampExpression(16, 20, 768, 1024)
        expect(a).toBe(b)
    })
})

describe('fluidInterpolator — auditAll integration', () => {
    it('fluid advisories surface in the merged audit result', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="int1" className="text-base lg:text-xl" />'),
        )
        const merged = auditAll(ast, NO_TOKENS)
        const fluid = [...merged.values()].filter(
            (w) => w.ruleId === 'MITHRIL-FLUID-001',
        )
        expect(fluid.length).toBeGreaterThanOrEqual(1)
        expect(fluid[0].severity).toBe('advisory')
    })

    it('fluid advisories are suppressed when auditAll is called with fluidSuggestions: off', () => {
        const ast = parseJSX(
            wrap('<p data-flint-id="int2" className="text-base lg:text-xl" />'),
        )
        const merged = auditAll(ast, NO_TOKENS, { fluidSuggestions: 'off' })
        const fluid = [...merged.values()].filter(
            (w) => w.ruleId === 'MITHRIL-FLUID-001',
        )
        expect(fluid.length).toBe(0)
    })
})
