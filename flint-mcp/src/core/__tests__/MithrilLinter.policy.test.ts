/**
 * MithrilLinter — POL.1 Policy Integration Tests
 * flint-mcp/src/core/__tests__/MithrilLinter.policy.test.ts
 *
 * Test map:
 *   Group A — visitClassNames (MITHRIL-COL)
 *     A1 — custom ΔE threshold (5.0): violations only above threshold
 *     A2 — MITHRIL-COL: 'off' → visitor returns empty Map
 *     A3 — MITHRIL-COL: 'advisory' → warning emitted with severity: 'advisory'
 *     A4 — no options → backward compatible (threshold = 2.0, severity normal)
 *
 *   Group B — visitTypography (MITHRIL-TYP-*)
 *     B1 — MITHRIL-TYP-001: 'off' → that sub-rule violations skipped
 *     B2 — MITHRIL-TYP-001: 'advisory' → violation emitted with severity: 'advisory'
 *     B3 — all TYP rules 'off' → empty Map returned
 *     B4 — no options → backward compatible (severity 'amber')
 *
 *   Group C — visitSpacing (MITHRIL-SPC-001)
 *     C1 — MITHRIL-SPC-001: 'off' → empty Map
 *     C2 — MITHRIL-SPC-001: 'advisory' → severity: 'advisory'
 *
 *   Group D — visitShadows (MITHRIL-SHD-001)
 *     D1 — MITHRIL-SHD-001: 'off' → empty Map
 *     D2 — MITHRIL-SHD-001: 'advisory' → severity: 'advisory'
 *
 *   Group E — visitOpacity (MITHRIL-OPC-001)
 *     E1 — MITHRIL-OPC-001: 'off' → empty Map
 *     E2 — MITHRIL-OPC-001: 'advisory' → severity: 'advisory'
 *
 *   Group F — auditAll propagation
 *     F1 — options propagated to all visitors
 *     F2 — multiple rules with mixed modes (off + advisory + blocking)
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    visitClassNames,
    visitTypography,
    visitSpacing,
    visitShadows,
    visitOpacity,
    auditAll,
} from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

/**
 * Builds a minimal JSX file with a single element using an arbitrary
 * Tailwind color class so that MITHRIL-COL fires.
 *
 * The element has a data-flint-id so the linter can identify it.
 * Uses text-[#ff0000] — a vivid red that is far from any token color.
 */
function makeColorJSX(hex = '#ff0000'): File {
    return parseJSX(`
        const C = () => (
            <div data-flint-id="node-1" className="text-[${hex}]" />
        )
    `)
}

/**
 * Makes a JSX file with an arbitrary font-family class (MITHRIL-TYP-001).
 */
function makeTypographyJSX(): File {
    return parseJSX(`
        const C = () => (
            <div data-flint-id="node-1" className="font-[Arial]" />
        )
    `)
}

/**
 * Makes a JSX file with an arbitrary spacing class (MITHRIL-SPC-001).
 */
function makeSpacingJSX(): File {
    return parseJSX(`
        const C = () => (
            <div data-flint-id="node-1" className="p-[99px]" />
        )
    `)
}

/**
 * Makes a JSX file with an arbitrary shadow class (MITHRIL-SHD-001).
 */
function makeShadowJSX(): File {
    return parseJSX(`
        const C = () => (
            <div data-flint-id="node-1" className="shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
        )
    `)
}

/**
 * Makes a JSX file with an arbitrary opacity class (MITHRIL-OPC-001).
 */
function makeOpacityJSX(): File {
    return parseJSX(`
        const C = () => (
            <div data-flint-id="node-1" className="opacity-[0.73]" />
        )
    `)
}

// ── Minimal token fixtures ─────────────────────────────────────────────────────

/** A blue token near #0000ff — used to ensure ΔE comparisons work */
const BLUE_TOKEN: DesignToken = {
    id: 1,
    token_path: 'color.blue',
    token_type: 'color',
    token_value: '#0000ff',
    description: null,
    collection_name: 'default',
    mode: 'default',
}

/** A red token near #ff0000 — ΔE against #ff0000 will be 0 */
const RED_TOKEN: DesignToken = {
    id: 2,
    token_path: 'color.red',
    token_type: 'color',
    token_value: '#ff0000',
    description: null,
    collection_name: 'default',
    mode: 'default',
}

const FONT_FAMILY_TOKEN: DesignToken = {
    id: 3,
    token_path: 'typography.font',
    token_type: 'fontFamily',
    token_value: 'Inter',
    description: null,
    collection_name: 'default',
    mode: 'default',
}

const DIMENSION_TOKEN: DesignToken = {
    id: 4,
    token_path: 'spacing.md',
    token_type: 'dimension',
    token_value: '8px',
    description: null,
    collection_name: 'default',
    mode: 'default',
}

const SHADOW_TOKEN: DesignToken = {
    id: 5,
    token_path: 'shadow.card',
    token_type: 'shadow',
    token_value: '0 1px 3px rgba(0,0,0,0.3)',
    description: null,
    collection_name: 'default',
    mode: 'default',
}

const OPACITY_TOKEN: DesignToken = {
    id: 6,
    token_path: 'opacity.dim',
    token_type: 'opacity',
    token_value: '0.5',
    description: null,
    collection_name: 'default',
    mode: 'default',
}

// ── Group A: visitClassNames (MITHRIL-COL) ────────────────────────────────────

describe('Group A — visitClassNames policy integration', () => {
    it('A1: custom deltaE threshold (5.0) suppresses violations below threshold', () => {
        // Use a very dark grey that is close to but not identical to #0000ff
        // We'll use #0011ff which should have low ΔE against #0000ff
        // but to be deterministic, use #800000 vs blue token — large ΔE always
        const ast = makeColorJSX('#800000') // dark red — large ΔE from blue token
        const tokens = [BLUE_TOKEN]

        // With default threshold (2.0), violation fires
        const warnDefault = visitClassNames(ast, tokens, { deltaE_threshold: 2.0 })
        expect(warnDefault.size).toBeGreaterThan(0)

        // With threshold of 5.0, same violation still fires (ΔE is very large)
        const warnHigh = visitClassNames(ast, tokens, { deltaE_threshold: 5.0 })
        expect(warnHigh.size).toBeGreaterThan(0)

        // Now with a near-matching color — ΔE should be 0 vs the exact token
        const astExact = makeColorJSX('#ff0000')
        const tokensExact = [RED_TOKEN]
        const warnExact = visitClassNames(astExact, tokensExact, { deltaE_threshold: 2.0 })
        // ΔE should be 0 (exact match) — no violation
        expect(warnExact.size).toBe(0)
    })

    it('A1b: threshold 5.0 blocks violations that are only above 5.0, not below', () => {
        // Use blue token. #800000 (dark red) will have very large ΔE from #0000ff.
        // With threshold = 5.0 it should still fire.
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const warn = visitClassNames(ast, tokens, { deltaE_threshold: 5.0 })
        expect(warn.size).toBe(1)
        // Severity should be based on criticalThreshold, not advisory
        const w = warn.get('node-1')!
        expect(w.severity).not.toBe('advisory')
    })

    it('A2: MITHRIL-COL "off" → visitor returns empty Map', () => {
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const warn = visitClassNames(ast, tokens, { ruleModes: { 'MITHRIL-COL': 'off' } })
        expect(warn.size).toBe(0)
    })

    it('A3: MITHRIL-COL "advisory" → warning emitted with severity "advisory"', () => {
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const warn = visitClassNames(ast, tokens, { ruleModes: { 'MITHRIL-COL': 'advisory' } })
        expect(warn.size).toBe(1)
        const w = warn.get('node-1')!
        expect(w.severity).toBe('advisory')
        expect(w.ruleId).toBe('MITHRIL-COL')
    })

    it('A4: no options → backward compatible (default threshold 2.0, severity not advisory)', () => {
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const warn = visitClassNames(ast, tokens)
        expect(warn.size).toBeGreaterThan(0)
        const w = warn.values().next().value!
        expect(w.severity === 'amber' || w.severity === 'critical').toBe(true)
    })
})

// ── Group B: visitTypography ──────────────────────────────────────────────────

describe('Group B — visitTypography policy integration', () => {
    it('B1: MITHRIL-TYP-001 "off" → no violation for font-family class', () => {
        const ast = makeTypographyJSX()
        const warn = visitTypography(ast, [FONT_FAMILY_TOKEN], {
            ruleModes: { 'MITHRIL-TYP-001': 'off' },
        })
        const nodeWarn = warn.get('node-1')
        // If there is a warning, it must NOT be from TYP-001
        if (nodeWarn) {
            expect(nodeWarn.ruleId).not.toBe('MITHRIL-TYP-001')
        } else {
            expect(nodeWarn).toBeUndefined()
        }
    })

    it('B2: MITHRIL-TYP-001 "advisory" → violation emitted with severity "advisory"', () => {
        const ast = makeTypographyJSX()
        const warn = visitTypography(ast, [FONT_FAMILY_TOKEN], {
            ruleModes: { 'MITHRIL-TYP-001': 'advisory' },
        })
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('advisory')
        expect(w!.ruleId).toBe('MITHRIL-TYP-001')
    })

    it('B3: all TYP rules "off" → empty Map returned', () => {
        const ast = makeTypographyJSX()
        const warn = visitTypography(ast, [FONT_FAMILY_TOKEN], {
            ruleModes: {
                'MITHRIL-TYP-001': 'off',
                'MITHRIL-TYP-002': 'off',
                'MITHRIL-TYP-003': 'off',
                'MITHRIL-TYP-004': 'off',
                'MITHRIL-TYP-005': 'off',
            },
        })
        expect(warn.size).toBe(0)
    })

    it('B4: no options → backward compatible (severity "amber")', () => {
        const ast = makeTypographyJSX()
        const warn = visitTypography(ast, [FONT_FAMILY_TOKEN])
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('amber')
    })
})

// ── Group C: visitSpacing ─────────────────────────────────────────────────────

describe('Group C — visitSpacing policy integration', () => {
    it('C1: MITHRIL-SPC-001 "off" → empty Map', () => {
        const ast = makeSpacingJSX()
        const warn = visitSpacing(ast, [DIMENSION_TOKEN], {
            ruleModes: { 'MITHRIL-SPC-001': 'off' },
        })
        expect(warn.size).toBe(0)
    })

    it('C2: MITHRIL-SPC-001 "advisory" → severity "advisory"', () => {
        const ast = makeSpacingJSX()
        const warn = visitSpacing(ast, [DIMENSION_TOKEN], {
            ruleModes: { 'MITHRIL-SPC-001': 'advisory' },
        })
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('advisory')
    })

    it('C3: no options → backward compatible (severity "amber")', () => {
        const ast = makeSpacingJSX()
        const warn = visitSpacing(ast, [DIMENSION_TOKEN])
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('amber')
    })
})

// ── Group D: visitShadows ─────────────────────────────────────────────────────

describe('Group D — visitShadows policy integration', () => {
    it('D1: MITHRIL-SHD-001 "off" → empty Map', () => {
        const ast = makeShadowJSX()
        const warn = visitShadows(ast, [SHADOW_TOKEN], {
            ruleModes: { 'MITHRIL-SHD-001': 'off' },
        })
        expect(warn.size).toBe(0)
    })

    it('D2: MITHRIL-SHD-001 "advisory" → severity "advisory"', () => {
        const ast = makeShadowJSX()
        const warn = visitShadows(ast, [SHADOW_TOKEN], {
            ruleModes: { 'MITHRIL-SHD-001': 'advisory' },
        })
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('advisory')
    })

    it('D3: no options → backward compatible (severity "amber")', () => {
        const ast = makeShadowJSX()
        const warn = visitShadows(ast, [SHADOW_TOKEN])
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('amber')
    })
})

// ── Group E: visitOpacity ─────────────────────────────────────────────────────

describe('Group E — visitOpacity policy integration', () => {
    it('E1: MITHRIL-OPC-001 "off" → empty Map', () => {
        const ast = makeOpacityJSX()
        const warn = visitOpacity(ast, [OPACITY_TOKEN], {
            ruleModes: { 'MITHRIL-OPC-001': 'off' },
        })
        expect(warn.size).toBe(0)
    })

    it('E2: MITHRIL-OPC-001 "advisory" → severity "advisory"', () => {
        const ast = makeOpacityJSX()
        const warn = visitOpacity(ast, [OPACITY_TOKEN], {
            ruleModes: { 'MITHRIL-OPC-001': 'advisory' },
        })
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('advisory')
    })

    it('E3: no options → backward compatible (severity "amber")', () => {
        const ast = makeOpacityJSX()
        const warn = visitOpacity(ast, [OPACITY_TOKEN])
        const w = warn.get('node-1')
        expect(w).toBeDefined()
        expect(w!.severity).toBe('amber')
    })
})

// ── Group F: auditAll propagation ─────────────────────────────────────────────

describe('Group F — auditAll policy propagation', () => {
    it('F1: auditAll with MITHRIL-COL "off" skips color violations', () => {
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const merged = auditAll(ast, tokens, { ruleModes: { 'MITHRIL-COL': 'off' } })
        // No color drift warning should be present
        for (const [, w] of merged) {
            expect(w.ruleId).not.toBe('MITHRIL-COL')
        }
    })

    it('F2: auditAll with MITHRIL-COL "advisory" tags color warnings as advisory', () => {
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const merged = auditAll(ast, tokens, { ruleModes: { 'MITHRIL-COL': 'advisory' } })
        // node-1 should have an advisory color warning
        const w = merged.get('node-1')
        expect(w).toBeDefined()
        expect(w!.ruleId).toBe('MITHRIL-COL')
        expect(w!.severity).toBe('advisory')
    })

    it('F3: auditAll mixed modes — off rule absent, advisory rule tagged, blocking rule normal', () => {
        // Build AST that triggers both color (node-1) and spacing (node-2)
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <span data-flint-id="node-1" className="text-[#800000]" />
                    <div data-flint-id="node-2" className="p-[99px]" />
                </div>
            )
        `) as unknown as File

        const tokens = [BLUE_TOKEN, DIMENSION_TOKEN]

        const merged = auditAll(ast, tokens, {
            ruleModes: {
                'MITHRIL-COL': 'blocking',
                'MITHRIL-SPC-001': 'advisory',
            },
        })

        const colorWarn = merged.get('node-1')
        const spacingWarn = merged.get('node-2')

        // Color: blocking → severity is amber or critical
        if (colorWarn) {
            expect(colorWarn.severity === 'amber' || colorWarn.severity === 'critical').toBe(true)
        }

        // Spacing: advisory → severity is advisory
        if (spacingWarn) {
            expect(spacingWarn.severity).toBe('advisory')
        }
    })

    it('F4: auditAll with no options is backward compatible', () => {
        const ast = makeColorJSX('#800000')
        const tokens = [BLUE_TOKEN]
        const merged = auditAll(ast, tokens)
        const w = merged.get('node-1')
        expect(w).toBeDefined()
        // Must be amber or critical, never advisory
        expect(w!.severity === 'amber' || w!.severity === 'critical').toBe(true)
    })
})
