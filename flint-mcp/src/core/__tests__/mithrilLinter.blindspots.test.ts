/**
 * MithrilLinter — Blind Spots Test Suite
 * flint-mcp/src/core/__tests__/mithrilLinter.blindspots.test.ts
 *
 * Covers the 17 identified blind spots in the AST extractor / Mithril linter:
 *
 *   Group P — parseCssColorToHex expansion
 *     P1  — named color 'red' → '#ff0000'
 *     P2  — named color 'white' → '#ffffff'
 *     P3  — named color 'transparent' (unknown) → null
 *     P4  — unknown name 'chartreuse' → null
 *     P5  — hsl(0, 100%, 50%) → '#ff0000'
 *     P6  — hsl(120, 100%, 50%) → approximately green
 *     P7  — hsl(240, 100%, 50%) → '#0000ff'
 *     P8  — hsla(0, 100%, 50%, 0.5) → '#ff0000' (alpha ignored)
 *     P9  — oklch(0.5 0.1 120) → null (unsupported modern space)
 *     P10 — var(--primary) → null
 *     P11 — CSS4 space-separated hsl (no commas) → parsed correctly
 *
 *   Group T — visitInlineStyles ternary handling
 *     T1  — ternary both branches are hardcoded colors far from any token → violation
 *     T2  — ternary both branches exactly match a token → no violation
 *     T3  — ternary consequent is literal, alternate is identifier → consequent extracted, dynamic counted
 *
 *   Group L — visitInlineStyles logical expression
 *     L1  — color: x || '#ff0000' where #ff0000 is not a token → violation
 *     L2  — color: x && tokenColor → no violation
 *     L3  — color: x || someVar (non-literal right) → dynamic counted, no violation
 *
 *   Group TL — visitInlineStyles static template literal
 *     TL1 — template literal with zero expressions → treated as string, produces violation
 *     TL2 — template literal with expressions → skippedDynamic incremented, no violation
 *
 *   Group V — Vue ternary in parseVueStyleBinding (via mithrilStylePlugin)
 *     V1  — ternary with both branches as string literals → two entries returned
 *     V2  — mixed literal + ternary in same binding → all entries present
 *
 *   Group A — Angular ternary in [style.*] (via mithrilStylePlugin)
 *     A1  — [style.color]="x ? '#ff0000' : '#0000ff'" → two entries pushed
 *
 *   Group C — coverage skippedDynamic
 *     C1  — color: someVariable (Identifier) → skippedDynamic incremented
 *     C2  — mixed ternary where one branch is a variable → skippedDynamic incremented
 *     C3  — SpreadElement → skippedDynamic incremented
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    parseCssColorToHex,
    checkStyleProps,
    visitInlineStyles,
    type StylePropEntry,
} from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'
import { createMithrilStylePlugin } from '../universal/plugins/mithrilStylePlugin.js'
import type { FlintNode } from '../universal/flintNode.js'
import type { LintContext } from '../universal/linterPlugin.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

function jsxFile(jsx: string): File {
    return parseJSX(`export default function C() { return (${jsx}); }`)
}

function entry(prop: string, stringValue: string | null, numericValue: number | null = null): StylePropEntry {
    return { prop, stringValue, numericValue }
}

// Token fixtures — two colors far from red/green/blue
const COLOR_TOKENS: DesignToken[] = [
    { id: 1, token_path: 'color.brand.primary', token_type: 'color', token_value: '#0066cc', description: null, collection_name: 'default', mode: 'default' },
    { id: 2, token_path: 'color.surface.base', token_type: 'color', token_value: '#ffffff', description: null, collection_name: 'default', mode: 'default' },
]

// Token with pure white so ternary-matches-token tests can use it
const WHITE_TOKEN: DesignToken = { id: 2, token_path: 'color.surface.base', token_type: 'color', token_value: '#ffffff', description: null, collection_name: 'default', mode: 'default' }
const BLUE_TOKEN: DesignToken = { id: 1, token_path: 'color.brand.primary', token_type: 'color', token_value: '#0066cc', description: null, collection_name: 'default', mode: 'default' }

// ── Group P: parseCssColorToHex ────────────────────────────────────────────────

describe('parseCssColorToHex — named colors', () => {
    it('P1: red → #ff0000', () => {
        expect(parseCssColorToHex('red')).toBe('#ff0000')
    })

    it('P2: white → #ffffff', () => {
        expect(parseCssColorToHex('white')).toBe('#ffffff')
    })

    it('P3: transparent → null (not in named color set)', () => {
        expect(parseCssColorToHex('transparent')).toBeNull()
    })

    it('P4: chartreuse (outside the 16 basic set) → null', () => {
        expect(parseCssColorToHex('chartreuse')).toBeNull()
    })

    it('P2b: case-insensitive named color RED → #ff0000', () => {
        expect(parseCssColorToHex('RED')).toBe('#ff0000')
    })

    it('P2c: whitespace-padded name → still resolved', () => {
        expect(parseCssColorToHex('  white  ')).toBe('#ffffff')
    })
})

describe('parseCssColorToHex — HSL', () => {
    it('P5: hsl(0, 100%, 50%) → #ff0000', () => {
        const result = parseCssColorToHex('hsl(0, 100%, 50%)')
        expect(result).not.toBeNull()
        // Convert back and verify hue: result must be pure red (#ff0000)
        expect(result?.toLowerCase()).toBe('#ff0000')
    })

    it('P6: hsl(120, 100%, 50%) → green-ish (hue 120°)', () => {
        const result = parseCssColorToHex('hsl(120, 100%, 50%)')
        expect(result).not.toBeNull()
        // Pure green at 120° 100% 50% is #00ff00 (lime)
        expect(result?.toLowerCase()).toBe('#00ff00')
    })

    it('P7: hsl(240, 100%, 50%) → #0000ff', () => {
        const result = parseCssColorToHex('hsl(240, 100%, 50%)')
        expect(result).not.toBeNull()
        expect(result?.toLowerCase()).toBe('#0000ff')
    })

    it('P8: hsla(0, 100%, 50%, 0.5) → #ff0000 (alpha ignored)', () => {
        const result = parseCssColorToHex('hsla(0, 100%, 50%, 0.5)')
        expect(result).not.toBeNull()
        expect(result?.toLowerCase()).toBe('#ff0000')
    })

    it('P11: CSS4 space-separated hsl(0 100% 50%) → #ff0000', () => {
        const result = parseCssColorToHex('hsl(0 100% 50%)')
        expect(result).not.toBeNull()
        expect(result?.toLowerCase()).toBe('#ff0000')
    })
})

describe('parseCssColorToHex — modern and dynamic formats', () => {
    it('P9: oklch(0.5 0.1 120) → null (unsupported modern space)', () => {
        expect(parseCssColorToHex('oklch(0.5 0.1 120)')).toBeNull()
    })

    it('P9b: oklab(0.5 0.1 0.1) → null (unsupported modern space)', () => {
        expect(parseCssColorToHex('oklab(0.5 0.1 0.1)')).toBeNull()
    })

    it('P10: var(--primary) → null', () => {
        expect(parseCssColorToHex('var(--primary)')).toBeNull()
    })

    it('P10b: var( --color-surface ) with whitespace → null', () => {
        expect(parseCssColorToHex('var( --color-surface )')).toBeNull()
    })
})

// ── Group T: visitInlineStyles — ternary handling ──────────────────────────────

describe('visitInlineStyles — ternary handling', () => {
    it('T1: both ternary branches are hardcoded colors far from any token → violation', () => {
        // #ff0000 and #aa0000 are both far from #0066cc and #ffffff
        const ast = jsxFile(
            `<div data-flint-id="t1" style={{ color: isActive ? '#ff0000' : '#aa0000' }} />`
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(1)
        expect(warnings.get('t1')?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('T2: both ternary branches exactly match a token → no violation', () => {
        // Both branches are within the token set or very close
        const tokens = [WHITE_TOKEN, BLUE_TOKEN]
        // #ffffff matches WHITE_TOKEN exactly; #0066cc matches BLUE_TOKEN exactly
        const ast = jsxFile(
            `<div data-flint-id="t2" style={{ color: isActive ? '#ffffff' : '#0066cc' }} />`
        )
        const { warnings } = visitInlineStyles(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('T3: ternary with one literal branch and one identifier → literal extracted, dynamic counted', () => {
        // consequent is a literal (#ff0000, bad), alternate is an Identifier (dynamic)
        const ast = jsxFile(
            `<div data-flint-id="t3" style={{ color: isActive ? '#ff0000' : someVar }} />`
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        // The literal branch #ff0000 should be extracted and should produce a violation
        expect(warnings.size).toBe(1)
        expect(warnings.get('t3')?.ruleId).toBe('MITHRIL-IST-COL')
        // The non-literal branch should have been counted as dynamic
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })
})

// ── Group L: visitInlineStyles — logical expression ───────────────────────────

describe('visitInlineStyles — logical expression', () => {
    it('L1: color: x || "#ff0000" — right operand not in tokens → violation', () => {
        const ast = jsxFile(
            `<div data-flint-id="l1" style={{ color: x || '#ff0000' }} />`
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(1)
        expect(warnings.get('l1')?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('L2: color: x && tokenColor — right operand matches token → no violation', () => {
        // #ffffff is color.surface.base — within threshold
        const ast = jsxFile(
            `<div data-flint-id="l2" style={{ color: x && '#ffffff' }} />`
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(0)
    })

    it('L3: color: x || someVar — non-literal right → skippedDynamic incremented', () => {
        const ast = jsxFile(
            `<div data-flint-id="l3" style={{ color: x || someVar }} />`
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(0)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })

    it('L4: nullish coalescing ?? with literal right → violation when bad', () => {
        const ast = jsxFile(
            `<div data-flint-id="l4" style={{ color: x ?? '#ff0000' }} />`
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(1)
        expect(warnings.get('l4')?.ruleId).toBe('MITHRIL-IST-COL')
    })
})

// ── Group TL: visitInlineStyles — static template literal ─────────────────────

describe('visitInlineStyles — template literal', () => {
    it('TL1: template literal with zero expressions → treated as string literal, produces violation', () => {
        // `#ff0000` with no interpolation is equivalent to the string '#ff0000'
        const ast = jsxFile(
            // eslint-disable-next-line no-template-curly-in-string
            '<div data-flint-id="tl1" style={{ color: `#ff0000` }} />'
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(1)
        expect(warnings.get('tl1')?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('TL2: template literal with expressions → skippedDynamic incremented, no violation', () => {
        // `${someVar}` cannot be statically evaluated
        const ast = jsxFile(
            '<div data-flint-id="tl2" style={{ color: `${someVar}` }} />'
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(0)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })
})

// ── Group V: Vue ternary in parseVueStyleBinding ──────────────────────────────

describe('mithrilStylePlugin — Vue ternary in :style binding', () => {
    const plugin = createMithrilStylePlugin()
    const rule = plugin.rules[0]

    function makeNode(attrs: Record<string, string>): FlintNode {
        return {
            id: 'vue-node-1',
            type: 'element',
            name: 'div',
            attributes: new Map<string, unknown>(Object.entries(attrs)),
            children: [],
            parent: null,
            metadata: {},
        }
    }

    function makeContext(tokens: DesignToken[]): LintContext {
        return {
            document: { root: makeNode({}), filePath: 'test.vue', language: 'vue', parseTimestamp: 0 },
            config: { tokens, policyOptions: undefined },
        }
    }

    it('V1: :style with ternary both branches string literals → violation when both branches bad', () => {
        // Both #ff0000 and #aa0000 are far from the tokens #0066cc and #ffffff
        const node = makeNode({
            ':style': "{ color: isActive ? '#ff0000' : '#aa0000' }",
        })
        const result = rule.visit(node, makeContext(COLOR_TOKENS))
        expect(result).not.toBeNull()
        expect(result?.ruleId).toContain('MITHRIL-IST')
    })

    it('V2: :style with mix of literal and ternary entries → all processed', () => {
        // fontSize is a literal (16px — bad), color ternary has two branches (both bad)
        const node = makeNode({
            ':style': "{ color: isActive ? '#ff0000' : '#aa0000', fontSize: '99px' }",
        })
        const result = rule.visit(node, makeContext(COLOR_TOKENS))
        // Should find at least one violation
        expect(result).not.toBeNull()
    })

    it('V3: :style ternary where both branches match tokens → no violation', () => {
        // #ffffff and #0066cc both match the two tokens exactly
        const node = makeNode({
            ':style': "{ color: isActive ? '#ffffff' : '#0066cc' }",
        })
        const result = rule.visit(node, makeContext(COLOR_TOKENS))
        expect(result).toBeNull()
    })
})

// ── Group A: Angular ternary in [style.*] directives ──────────────────────────

describe('mithrilStylePlugin — Angular [style.*] ternary', () => {
    const plugin = createMithrilStylePlugin()
    const rule = plugin.rules[0]

    function makeAngularNode(styleAttr: string, styleValue: string): FlintNode {
        return {
            id: 'ng-node-1',
            type: 'element',
            name: 'div',
            attributes: new Map<string, unknown>([[styleAttr, styleValue]]),
            children: [],
            parent: null,
            metadata: {},
        }
    }

    function makeContext(tokens: DesignToken[]): LintContext {
        return {
            document: { root: makeAngularNode('', ''), filePath: 'test.component.html', language: 'angular', parseTimestamp: 0 },
            config: { tokens, policyOptions: undefined },
        }
    }

    it('A1: [style.color]="x ? \'#ff0000\' : \'#0000ff\'" → violation when both branches are bad', () => {
        // #ff0000 and #0000ff are both far from #0066cc and #ffffff
        const node = makeAngularNode('[style.color]', "x ? '#ff0000' : '#0000ff'")
        const result = rule.visit(node, makeContext(COLOR_TOKENS))
        expect(result).not.toBeNull()
        expect(result?.ruleId).toContain('MITHRIL-IST')
    })

    it('A2: [style.color]="x ? \'#ffffff\' : \'#0066cc\'" → no violation (both branches match tokens)', () => {
        const node = makeAngularNode('[style.color]', "x ? '#ffffff' : '#0066cc'")
        const result = rule.visit(node, makeContext(COLOR_TOKENS))
        expect(result).toBeNull()
    })
})

// ── Group C: coverage skippedDynamic ──────────────────────────────────────────

describe('visitInlineStyles — coverage.skippedDynamic', () => {
    it('C1: color: someVariable (Identifier) → skippedDynamic incremented', () => {
        const ast = jsxFile(
            `<div data-flint-id="c1" style={{ color: someVariable }} />`
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(0)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
        expect(coverage.inlinePropsSkipped).toBeGreaterThanOrEqual(1)
    })

    it('C2: ternary where alternate branch is a variable → skippedDynamic incremented', () => {
        // consequent is '#ff0000' (bad literal), alternate is someVar (dynamic)
        const ast = jsxFile(
            `<div data-flint-id="c2" style={{ color: isActive ? '#ff0000' : someVar }} />`
        )
        const { coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })

    it('C3: SpreadElement → skippedDynamic incremented', () => {
        const ast = jsxFile(
            `<div data-flint-id="c3" style={{ ...baseStyle, color: '#ffffff' }} />`
        )
        const { coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        // The spread increments skippedDynamic
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })

    it('C4: skippedDynamic present in returned coverage object', () => {
        const ast = jsxFile(
            `<div data-flint-id="c4" style={{ color: '#ffffff' }} />`
        )
        const { coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(typeof coverage.skippedDynamic).toBe('number')
    })

    it('C5: template literal with expressions increments skippedDynamic', () => {
        const ast = jsxFile(
            '<div data-flint-id="c5" style={{ color: `${theme.primary}` }} />'
        )
        const { coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })
})

// ── Group SA: parseCssColorToHex — var() fallback extraction ──────────────────

describe('parseCssColorToHex — var() fallback extraction (Sprint A)', () => {
    it('SA1: var(--primary, #ff0000) → extracts hex fallback', () => {
        expect(parseCssColorToHex('var(--primary, #ff0000)')).toBe('#ff0000')
    })

    it('SA2: var(--primary, hsl(0, 100%, 50%)) → recursive resolution → #ff0000', () => {
        const result = parseCssColorToHex('var(--primary, hsl(0, 100%, 50%))')
        expect(result).not.toBeNull()
        expect(result?.toLowerCase()).toBe('#ff0000')
    })

    it('SA3: var(--primary, red) → named color fallback → #ff0000', () => {
        expect(parseCssColorToHex('var(--primary, red)')).toBe('#ff0000')
    })

    it('SA4: var(--primary) with no fallback → null', () => {
        expect(parseCssColorToHex('var(--primary)')).toBeNull()
    })

    it('SA5: var(--a, var(--b, #0000ff)) → nested var fallback resolves to #0000ff', () => {
        expect(parseCssColorToHex('var(--a, var(--b, #0000ff))')).toBe('#0000ff')
    })
})

// ── Group SB: visitInlineStyles — same-file spread source traversal ────────────

describe('visitInlineStyles — same-file spread resolution (Sprint B)', () => {
    // Helper: wraps source in a component function where `const baseStyle` is in scope
    function componentFile(src: string): File {
        return parseJSX(`export default function C() { ${src} }`)
    }

    it('SB1: same-file spread resolved — color and fontSize from spread produce violations', () => {
        // baseStyle is defined in the same scope; color #ff0000 and fontSize 14px are not tokens
        const ast = componentFile(
            `const baseStyle = { color: '#ff0000', fontSize: '14px' };
             return (<div data-flint-id="sb1" style={{ ...baseStyle }} />);`
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        // color is far from both tokens — should produce a violation
        expect(warnings.size).toBeGreaterThanOrEqual(1)
        expect(warnings.get('sb1')).toBeDefined()
    })

    it('SB2: same-file spread + own props — both spread color and direct fontWeight are checked', () => {
        const ast = componentFile(
            `const baseStyle = { color: '#ff0000' };
             return (<div data-flint-id="sb2" style={{ ...baseStyle, fontWeight: 'bold' }} />);`
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        // At minimum the spread color should be scanned
        expect(coverage.inlinePropsScanned).toBeGreaterThanOrEqual(2)
        expect(warnings.get('sb2')).toBeDefined()
    })

    it('SB3: imported spread (unresolvable binding) → skippedDynamic incremented, no false violation', () => {
        // The import binding is not a VariableDeclarator with ObjectExpression init
        const ast = parseJSX(
            `import { baseStyle } from './styles';
             export default function C() {
                 return (<div data-flint-id="sb3" style={{ ...baseStyle }} />);
             }`
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(0)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })

    it('SB4: expression spread (CallExpression) → skippedDynamic incremented', () => {
        const ast = componentFile(
            `return (<div data-flint-id="sb4" style={{ ...getStyles() }} />);`
        )
        const { warnings, coverage } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.size).toBe(0)
        expect(coverage.skippedDynamic).toBeGreaterThanOrEqual(1)
    })

    it('SB5: var() fallback in same-file spread combines Sprint A + Sprint B', () => {
        // color is 'var(--x, #ff0000)' — Sprint A extracts #ff0000, which is far from tokens
        const ast = componentFile(
            `const baseStyle = { color: 'var(--x, #ff0000)' };
             return (<div data-flint-id="sb5" style={{ ...baseStyle }} />);`
        )
        const { warnings } = visitInlineStyles(ast, COLOR_TOKENS)
        expect(warnings.get('sb5')).toBeDefined()
    })
})

// ── Regression: existing checkStyleProps behavior for named colors ─────────────

describe('checkStyleProps — named color integration', () => {
    it('named color "red" far from all tokens → MITHRIL-IST-COL violation', () => {
        // 'red' now resolves to #ff0000 via parseCssColorToHex
        const result = checkStyleProps(
            [entry('color', 'red')],
            'nc-1',
            COLOR_TOKENS,
        )
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('named color "white" matches color.surface.base token → no violation', () => {
        // 'white' resolves to #ffffff which is color.surface.base
        const result = checkStyleProps(
            [entry('color', 'white')],
            'nc-2',
            COLOR_TOKENS,
        )
        expect(result).toBeNull()
    })

    it('named color "blue" with no tokens → no violation (no tokens to compare against)', () => {
        const result = checkStyleProps(
            [entry('color', 'blue')],
            'nc-3',
            [],
        )
        expect(result).toBeNull()
    })
})
