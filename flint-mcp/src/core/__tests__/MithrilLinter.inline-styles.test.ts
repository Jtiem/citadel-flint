/**
 * MithrilLinter — Inline Style Tests
 * flint-mcp/src/core/__tests__/MithrilLinter.inline-styles.test.ts
 *
 * Covers visitInlineStyles() and checkStyleProps() exhaustively:
 *
 *   Group A — checkStyleProps (language-agnostic core)
 *     A1  — color: hex not in token set → MITHRIL-IST-COL warning
 *     A2  — color: hex close to a token (ΔE ≤ 2.0) → no warning
 *     A3  — color: rgb() value not in token set → MITHRIL-IST-COL warning
 *     A4  — color: rgba() value not in token set → MITHRIL-IST-COL warning
 *     A5  — color: named color (e.g. 'red') → skipped (not statically evaluable)
 *     A6  — color: var() reference → skipped
 *     A7  — color: no color tokens registered → no warning
 *     A8  — color: MITHRIL-IST-COL 'off' → no warning
 *     A9  — color: MITHRIL-IST-COL 'advisory' → severity: 'advisory'
 *     A10 — typography: fontSize not in token set → MITHRIL-IST-TYP
 *     A11 — typography: fontSize matches token (px-normalised) → no warning
 *     A12 — typography: fontWeight not in token set → MITHRIL-IST-TYP
 *     A13 — typography: MITHRIL-IST-TYP 'off' → no warning
 *     A14 — spacing: marginTop not in dimension tokens → MITHRIL-IST-SPC
 *     A15 — spacing: marginBottom: 0 → skipped (0 always valid)
 *     A16 — spacing: borderRadius not in dimension tokens → MITHRIL-IST-SPC
 *     A17 — spacing: MITHRIL-IST-SPC 'off' → no warning
 *     A18 — shadow: boxShadow not in shadow tokens → MITHRIL-IST-SHD
 *     A19 — shadow: no shadow tokens registered → no warning
 *     A20 — shadow: MITHRIL-IST-SHD 'off' → no warning
 *     A21 — opacity: 0.5 not in opacity tokens → MITHRIL-IST-OPC
 *     A22 — opacity: 0 → skipped (always valid)
 *     A23 — opacity: 1 → skipped (always valid)
 *     A24 — opacity: no opacity tokens registered → no warning
 *     A25 — first-violation-wins: multiple bad props → only first emitted
 *
 *   Group B — visitInlineStyles (Babel JSX traversal)
 *     B1  — style={{ fontSize: '14px' }} on node with data-flint-id → warning
 *     B2  — style={{ fontSize: '14px' }} on node without data-flint-id → no warning
 *     B3  — style={myVar} (non-object expression) → no warning
 *     B4  — style={{ ...spread, color: '#ff0000' }} → spread skipped, color flagged
 *     B5  — style={{ color: tokens.colorPrimary }} (MemberExpression) → no warning
 *     B6  — style={{ opacity: 0.5 }} (NumericLiteral) → warning
 *     B7  — style={{ marginBottom: 0 }} (NumericLiteral zero) → no warning
 *     B8  — empty style={{}}} → no warning
 *     B9  — auditAll includes visitInlineStyles results
 *     B10 — style={{ color: '#ffffff' }} on node whose ΔE from white token ≤ threshold → no warning
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    checkStyleProps,
    visitInlineStyles,
    auditAll,
    type StylePropEntry,
} from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

/** Wrap JSX in a minimal exportable component so Babel parser accepts it. */
function jsxFile(jsx: string): File {
    return parseJSX(`export default function C() { return (${jsx}); }`)
}

const COLOR_TOKENS: DesignToken[] = [
    { id: 1, token_path: 'color.brand.primary', token_type: 'color', token_value: '#0066cc', description: null, collection_name: 'default', mode: 'default' },
    { id: 2, token_path: 'color.surface.base', token_type: 'color', token_value: '#ffffff', description: null, collection_name: 'default', mode: 'default' },
]

const DIMENSION_TOKENS: DesignToken[] = [
    { id: 10, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8', description: null, collection_name: 'default', mode: 'default' },
    { id: 11, token_path: 'spacing.md', token_type: 'dimension', token_value: '16', description: null, collection_name: 'default', mode: 'default' },
    { id: 12, token_path: 'type.size.sm', token_type: 'dimension', token_value: '14', description: null, collection_name: 'default', mode: 'default' },
]

const FONT_WEIGHT_TOKENS: DesignToken[] = [
    { id: 20, token_path: 'type.weight.bold', token_type: 'fontWeight', token_value: '700', description: null, collection_name: 'default', mode: 'default' },
]

const SHADOW_TOKENS: DesignToken[] = [
    { id: 30, token_path: 'shadow.md', token_type: 'shadow', token_value: '0 2px 4px rgba(0,0,0,0.1)', description: null, collection_name: 'default', mode: 'default' },
]

const OPACITY_TOKENS: DesignToken[] = [
    { id: 40, token_path: 'opacity.disabled', token_type: 'opacity', token_value: '0.38', description: null, collection_name: 'default', mode: 'default' },
]

function entry(prop: string, stringValue: string | null, numericValue: number | null = null): StylePropEntry {
    return { prop, stringValue, numericValue }
}

// ── Group A: checkStyleProps ───────────────────────────────────────────────────

describe('checkStyleProps — color', () => {
    it('A1: hex not in token set → MITHRIL-IST-COL warning', () => {
        const result = checkStyleProps(
            [entry('color', '#ff0000')],
            'node-1',
            COLOR_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-COL')
        expect(result?.type).toBe('inline-style-drift')
        expect(result?.id).toBe('node-1')
        expect(result?.message).toContain('color: #ff0000')
    })

    it('A2: hex ΔE ≤ 2.0 from a token → no warning', () => {
        // Pure white #ffffff is color.surface.base — should be within threshold
        const result = checkStyleProps(
            [entry('color', '#ffffff')],
            'node-2',
            COLOR_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('A3: rgb() value not in token set → MITHRIL-IST-COL', () => {
        const result = checkStyleProps(
            [entry('backgroundColor', 'rgb(255, 0, 0)')],
            'node-3',
            COLOR_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('A4: rgba() value not in token set → MITHRIL-IST-COL', () => {
        const result = checkStyleProps(
            [entry('borderColor', 'rgba(255, 0, 0, 0.5)')],
            'node-4',
            COLOR_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('A5: named color → skipped (not statically evaluable)', () => {
        const result = checkStyleProps(
            [entry('color', 'red')],
            'node-5',
            COLOR_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('A6: var() reference → skipped', () => {
        const result = checkStyleProps(
            [entry('color', 'var(--color-primary)')],
            'node-6',
            COLOR_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('A7: no color tokens registered → no warning', () => {
        const result = checkStyleProps(
            [entry('color', '#ff0000')],
            'node-7',
            [], // empty token set
        )
        expect(result).toBeNull()
    })

    it('A8: MITHRIL-IST-COL off → no warning', () => {
        const result = checkStyleProps(
            [entry('color', '#ff0000')],
            'node-8',
            COLOR_TOKENS,
            { ruleModes: { 'MITHRIL-IST-COL': 'off' } },
        )
        expect(result).toBeNull()
    })

    it('A9: MITHRIL-IST-COL advisory → severity: advisory', () => {
        const result = checkStyleProps(
            [entry('color', '#ff0000')],
            'node-9',
            COLOR_TOKENS,
            { ruleModes: { 'MITHRIL-IST-COL': 'advisory' } },
        )
        expect(result?.severity).toBe('advisory')
    })
})

describe('checkStyleProps — typography', () => {
    const tokens = [...DIMENSION_TOKENS, ...FONT_WEIGHT_TOKENS]

    it('A10: fontSize not in token set → MITHRIL-IST-TYP', () => {
        const result = checkStyleProps(
            [entry('fontSize', '20px')],
            'node-10',
            tokens,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-TYP')
        expect(result?.message).toContain('fontSize')
    })

    it('A11: fontSize matches token via px-normalisation → no warning', () => {
        // token value is '14', fontSize is '14px' — should normalise and match
        const result = checkStyleProps(
            [entry('fontSize', '14px')],
            'node-11',
            tokens,
        )
        expect(result).toBeNull()
    })

    it('A12: fontWeight not in token set → MITHRIL-IST-TYP', () => {
        const result = checkStyleProps(
            [entry('fontWeight', '400')],
            'node-12',
            tokens,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-TYP')
    })

    it('A13: MITHRIL-IST-TYP off → no warning', () => {
        const result = checkStyleProps(
            [entry('fontSize', '20px')],
            'node-13',
            tokens,
            { ruleModes: { 'MITHRIL-IST-TYP': 'off' } },
        )
        expect(result).toBeNull()
    })
})

describe('checkStyleProps — spacing', () => {
    it('A14: marginTop not in dimension tokens → MITHRIL-IST-SPC', () => {
        const result = checkStyleProps(
            [entry('marginTop', '12px')],
            'node-14',
            DIMENSION_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-SPC')
    })

    it('A15: marginBottom: 0 (zero) → skipped', () => {
        const result = checkStyleProps(
            [{ prop: 'marginBottom', stringValue: null, numericValue: 0 }],
            'node-15',
            DIMENSION_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('A16: borderRadius not in dimension tokens → MITHRIL-IST-SPC', () => {
        const result = checkStyleProps(
            [entry('borderRadius', '6px')],
            'node-16',
            DIMENSION_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-SPC')
    })

    it('A17: MITHRIL-IST-SPC off → no warning', () => {
        const result = checkStyleProps(
            [entry('marginTop', '12px')],
            'node-17',
            DIMENSION_TOKENS,
            { ruleModes: { 'MITHRIL-IST-SPC': 'off' } },
        )
        expect(result).toBeNull()
    })
})

describe('checkStyleProps — shadow', () => {
    it('A18: boxShadow not in shadow tokens → MITHRIL-IST-SHD', () => {
        const result = checkStyleProps(
            [entry('boxShadow', '0 4px 8px rgba(0,0,0,0.2)')],
            'node-18',
            SHADOW_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-SHD')
    })

    it('A19: no shadow tokens registered → no warning', () => {
        const result = checkStyleProps(
            [entry('boxShadow', '0 4px 8px rgba(0,0,0,0.2)')],
            'node-19',
            [], // no tokens
        )
        expect(result).toBeNull()
    })

    it('A20: MITHRIL-IST-SHD off → no warning', () => {
        const result = checkStyleProps(
            [entry('boxShadow', '0 4px 8px rgba(0,0,0,0.2)')],
            'node-20',
            SHADOW_TOKENS,
            { ruleModes: { 'MITHRIL-IST-SHD': 'off' } },
        )
        expect(result).toBeNull()
    })
})

describe('checkStyleProps — opacity', () => {
    it('A21: opacity 0.5 not in opacity tokens → MITHRIL-IST-OPC', () => {
        const result = checkStyleProps(
            [{ prop: 'opacity', stringValue: null, numericValue: 0.5 }],
            'node-21',
            OPACITY_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-OPC')
    })

    it('A22: opacity 0 → skipped (always valid)', () => {
        const result = checkStyleProps(
            [{ prop: 'opacity', stringValue: null, numericValue: 0 }],
            'node-22',
            OPACITY_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('A23: opacity 1 → skipped (fully visible, always valid)', () => {
        const result = checkStyleProps(
            [{ prop: 'opacity', stringValue: null, numericValue: 1 }],
            'node-23',
            OPACITY_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('A24: no opacity tokens → no warning', () => {
        const result = checkStyleProps(
            [{ prop: 'opacity', stringValue: null, numericValue: 0.5 }],
            'node-24',
            [], // no tokens
        )
        expect(result).toBeNull()
    })
})

describe('checkStyleProps — first-violation-wins', () => {
    it('A25: multiple bad props → first violation only', () => {
        const result = checkStyleProps(
            [
                { prop: 'opacity', stringValue: null, numericValue: 0.5 },  // bad — 1st
                entry('marginTop', '12px'),                                   // bad — 2nd
            ],
            'node-25',
            [...OPACITY_TOKENS, ...DIMENSION_TOKENS],
        )
        expect(result).not.toBeNull()
        // First entry is opacity — should win
        expect(result?.ruleId).toBe('MITHRIL-IST-OPC')
    })
})

// ── Group B: visitInlineStyles (Babel JSX) ────────────────────────────────────

describe('visitInlineStyles — JSX traversal', () => {
    const tokens = [...COLOR_TOKENS, ...DIMENSION_TOKENS, ...FONT_WEIGHT_TOKENS]

    it('B1: style={{ fontSize: "14px" }} without a token match → warning', () => {
        // fontSize 20px is NOT in the token set (only 14 is)
        const ast = jsxFile(`<div data-flint-id="b1" style={{ fontSize: '20px' }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(1)
        expect(warnings.get('b1')?.ruleId).toBe('MITHRIL-IST-TYP')
    })

    it('B2: node without data-flint-id → no warning emitted', () => {
        const ast = jsxFile(`<div style={{ fontSize: '20px' }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('B3: style={myVar} (non-object) → no warning', () => {
        const ast = jsxFile(`<div data-flint-id="b3" style={myVar} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('B4: SpreadElement skipped; literal prop after spread still flagged', () => {
        const ast = jsxFile(`<div data-flint-id="b4" style={{ ...baseStyle, color: '#ff0000' }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(1)
        expect(warnings.get('b4')?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('B5: MemberExpression value (tokens.colorPrimary) → no warning', () => {
        const ast = jsxFile(`<div data-flint-id="b5" style={{ color: tokens.colorPrimary }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('B6: NumericLiteral opacity 0.5 → warning', () => {
        const withOpacity = [...tokens, ...OPACITY_TOKENS]
        const ast = jsxFile(`<div data-flint-id="b6" style={{ opacity: 0.5 }} />`)
        const { warnings } = visitInlineStyles(ast, withOpacity)
        expect(warnings.size).toBe(1)
        expect(warnings.get('b6')?.ruleId).toBe('MITHRIL-IST-OPC')
    })

    it('B7: NumericLiteral zero (marginBottom: 0) → no warning', () => {
        const ast = jsxFile(`<div data-flint-id="b7" style={{ marginBottom: 0 }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('B8: empty style={{}} → no warning', () => {
        const ast = jsxFile(`<div data-flint-id="b8" style={{}} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('B9: auditAll includes visitInlineStyles results', () => {
        const ast = jsxFile(`<div data-flint-id="b9" style={{ fontSize: '20px' }} />`)
        const result = auditAll(ast, tokens)
        const warning = result.get('b9')
        expect(warning).toBeDefined()
        expect(warning?.ruleId).toBe('MITHRIL-IST-TYP')
    })

    it('B10: color that matches a token within ΔE 2.0 → no warning', () => {
        // #ffffff is color.surface.base — should be within threshold
        const ast = jsxFile(`<div data-flint-id="b10" style={{ color: '#ffffff' }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    // Phase 1 — coverage stats
    it('B11: coverage tracks scanned and skipped props correctly', () => {
        const ast = jsxFile(`<div data-flint-id="b11" style={{ fontSize: '20px', color: tokens.primary }} />`)
        const { coverage } = visitInlineStyles(ast, tokens)
        // fontSize is a StringLiteral → scanned; tokens.primary is MemberExpression → skipped
        expect(coverage.inlinePropsScanned).toBe(1)
        expect(coverage.inlinePropsSkipped).toBe(1)
    })

    it('B12: coverage.inlineViolations counts warnings found', () => {
        const ast = jsxFile(`<div data-flint-id="b12" style={{ fontSize: '20px' }} />`)
        const { coverage } = visitInlineStyles(ast, tokens)
        expect(coverage.inlineViolations).toBe(1)
    })

    // Phase 3 — line numbers
    it('B13: warning includes line number from style attribute loc', () => {
        const ast = jsxFile(`<div data-flint-id="b13" style={{ fontSize: '20px' }} />`)
        const { warnings } = visitInlineStyles(ast, tokens)
        const w = warnings.get('b13')
        expect(w).toBeDefined()
        expect(typeof w?.line).toBe('number')
        expect((w?.line ?? 0) > 0).toBe(true)
    })
})
