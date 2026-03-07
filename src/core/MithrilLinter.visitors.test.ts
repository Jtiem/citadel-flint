/**
 * MithrilLinter — Non-Color Visitor Tests (Phase B.1-e)
 *
 * Covers the four non-color Mithril AST visitors and the auditAll
 * cross-visitor priority / dedup logic:
 *
 *   1. visitTypography  (MITHRIL-TYP-001..005) — fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
 *   2. visitSpacing      (MITHRIL-SPC-001)      — p/m/gap/w/h arbitrary pixel/rem/em values
 *   3. visitShadows      (MITHRIL-SHD-001)      — arbitrary box-shadow values
 *   4. visitOpacity      (MITHRIL-OPC-001)      — arbitrary opacity values
 *   5. auditAll priority — color > typography > spacing > shadow > opacity
 *
 * Environment: pure Node.js — no React, no DOM, no Electron IPC.
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    visitTypography,
    visitSpacing,
    visitShadows,
    visitOpacity,
    auditAll,
} from './MithrilLinter'
import type { DesignToken } from '../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSource(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as File
}

function makeToken(
    overrides: Partial<DesignToken> & Pick<DesignToken, 'token_path' | 'token_type' | 'token_value'>
): DesignToken {
    return {
        id: 1,
        description: null,
        collection_name: 'Test',
        mode: 'default',
        ...overrides,
    }
}

// ── Token Fixtures ────────────────────────────────────────────────────────────
// Derived from the demo token set in tokenStore.ts

const FONT_FAMILY_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'fontFamily.sans', token_type: 'fontFamily', token_value: 'Inter, ui-sans-serif, system-ui, sans-serif' }),
    makeToken({ token_path: 'fontFamily.mono', token_type: 'fontFamily', token_value: 'JetBrains Mono, ui-monospace, monospace' }),
]

const FONT_WEIGHT_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'fontWeight.regular', token_type: 'fontWeight', token_value: '400' }),
    makeToken({ token_path: 'fontWeight.medium', token_type: 'fontWeight', token_value: '500' }),
    makeToken({ token_path: 'fontWeight.semibold', token_type: 'fontWeight', token_value: '600' }),
    makeToken({ token_path: 'fontWeight.bold', token_type: 'fontWeight', token_value: '700' }),
]

const LINE_HEIGHT_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'lineHeight.tight', token_type: 'lineHeight', token_value: '1.25' }),
    makeToken({ token_path: 'lineHeight.normal', token_type: 'lineHeight', token_value: '1.5' }),
    makeToken({ token_path: 'lineHeight.relaxed', token_type: 'lineHeight', token_value: '1.75' }),
]

const LETTER_SPACING_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'letterSpacing.tight', token_type: 'letterSpacing', token_value: '-0.025em' }),
    makeToken({ token_path: 'letterSpacing.normal', token_type: 'letterSpacing', token_value: '0em' }),
    makeToken({ token_path: 'letterSpacing.wide', token_type: 'letterSpacing', token_value: '0.025em' }),
]

const DIMENSION_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'spacing.4', token_type: 'dimension', token_value: '16px' }),
    makeToken({ token_path: 'spacing.8', token_type: 'dimension', token_value: '32px' }),
    makeToken({ token_path: 'sizing.card', token_type: 'dimension', token_value: '400px' }),
]

const SHADOW_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'shadow.sm', token_type: 'shadow', token_value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }),
    makeToken({ token_path: 'shadow.card', token_type: 'shadow', token_value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }),
]

const OPACITY_TOKENS: DesignToken[] = [
    makeToken({ token_path: 'opacity.muted', token_type: 'opacity', token_value: '50' }),
    makeToken({ token_path: 'opacity.subtle', token_type: 'opacity', token_value: '75' }),
    makeToken({ token_path: 'opacity.full', token_type: 'opacity', token_value: '100' }),
]

const COLOR_TOKEN: DesignToken = makeToken({
    token_path: 'color.white', token_type: 'color', token_value: '#ffffff',
})

/** All non-color tokens combined — used for visitors that filter by type internally. */
const ALL_TOKENS: DesignToken[] = [
    COLOR_TOKEN,
    ...FONT_FAMILY_TOKENS,
    ...FONT_WEIGHT_TOKENS,
    ...LINE_HEIGHT_TOKENS,
    ...LETTER_SPACING_TOKENS,
    ...DIMENSION_TOKENS,
    ...SHADOW_TOKENS,
    ...OPACITY_TOKENS,
]

// ── 1. visitTypography ──────────────────────────────────────────────────────

describe('visitTypography (MITHRIL-TYP-*)', () => {

    it('returns empty map when no arbitrary typography classes are present', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="font-bold text-lg leading-6 tracking-wide" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('flags an arbitrary font-family not in the token set (TYP-001)', () => {
        const ast = parseSource(`
            export default function A() {
                return <h1 data-bridge-id="n1" className="font-[Comic_Sans_MS]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.type).toBe('typography-drift')
        expect(w!.severity).toBe('amber')
        expect(w!.message).toMatch(/MITHRIL-TYP-001/)
        expect(w!.message).toContain('Comic_Sans_MS')
    })

    it('does not flag an arbitrary font-family that matches a token (case-insensitive)', () => {
        // The demo token is 'Inter, ui-sans-serif, system-ui, sans-serif'.
        // font-[Inter,_ui-sans-serif,_system-ui,_sans-serif] would match with
        // underscore→space normalization — but the visitor does exact lowercase compare.
        // So we test with the exact token value as the arbitrary value.
        const ast = parseSource(`
            export default function A() {
                return <h1 data-bridge-id="n1" className="font-[Inter, ui-sans-serif, system-ui, sans-serif]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('flags an arbitrary font-size not in the dimension token set (TYP-002)', () => {
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="text-[37px]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.message).toMatch(/MITHRIL-TYP-002/)
        expect(w!.message).toContain('37px')
    })

    it('does not flag an arbitrary font-size that matches a dimension token', () => {
        // 16px matches DIMENSION_TOKENS[0]
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="text-[16px]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('flags font-[900] via TYP-001 (fontFamily regex matches before TYP-003)', () => {
        // font-[900] matches TYP-001's broad font-\[...\] regex before TYP-003's
        // specific \d{3} regex because TYP-001 runs first in the TYP_REGEXES array.
        // '900' is checked against fontFamily tokens, finds no match → violation.
        const ast = parseSource(`
            export default function A() {
                return <span data-bridge-id="n1" className="font-[900]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.message).toMatch(/MITHRIL-TYP-001/)
        expect(w!.message).toContain('900')
    })

    it('does not flag a font-family value that matches a fontFamily token', () => {
        // The TYP-001 regex catches all font-[...] — so a matching fontFamily token clears it.
        const ast = parseSource(`
            export default function A() {
                return <span data-bridge-id="n1" className="font-[Inter, ui-sans-serif, system-ui, sans-serif]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('flags an arbitrary leading value not in the token set (TYP-004)', () => {
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="leading-[2.0]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.message).toMatch(/MITHRIL-TYP-004/)
        expect(w!.message).toContain('2.0')
    })

    it('does not flag a leading value that matches a token', () => {
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="leading-[1.5]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('flags an arbitrary tracking value not in the token set (TYP-005)', () => {
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="tracking-[0.5em]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.message).toMatch(/MITHRIL-TYP-005/)
        expect(w!.message).toContain('0.5em')
    })

    it('keeps first violation per node — does not overwrite with later TYP rules', () => {
        // Both font-[900] (TYP-001 fontFamily) and leading-[2.0] (TYP-004) violate,
        // but only the first encountered should be stored.
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="font-[900] leading-[2.0]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.size).toBe(1)
        const w = result.get('n1')!
        expect(w.message).toMatch(/MITHRIL-TYP-001/)
    })

    it('skips nodes without data-bridge-id', () => {
        const ast = parseSource(`
            export default function A() {
                return <p className="font-[900]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('populates nearestToken and nearestTokenValue when tokens exist for the type', () => {
        // font-[900] is caught by TYP-001 (fontFamily) — suggestion is first fontFamily token
        const ast = parseSource(`
            export default function A() {
                return <span data-bridge-id="n1" className="font-[900]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        const w = result.get('n1')!
        expect(w.nearestToken).toBe('fontFamily.sans')
        expect(w.nearestTokenValue).toBe('Inter, ui-sans-serif, system-ui, sans-serif')
    })

    it('handles responsive prefix on arbitrary typography class', () => {
        const ast = parseSource(`
            export default function A() {
                return <p data-bridge-id="n1" className="md:leading-[2.0]" />
            }
        `)
        const result = visitTypography(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(true)
        expect(result.get('n1')!.message).toMatch(/MITHRIL-TYP-004/)
    })
})

// ── 2. visitSpacing ──────────────────────────────────────────────────────────

describe('visitSpacing (MITHRIL-SPC-001)', () => {

    it('returns empty map when no arbitrary spacing classes are present', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="p-4 m-2 gap-6 w-full" />
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('flags an arbitrary padding value not in the dimension token set', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="p-[37px]" />
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.type).toBe('spacing-drift')
        expect(w!.severity).toBe('amber')
        expect(w!.message).toMatch(/MITHRIL-SPC-001/)
        expect(w!.message).toContain('37px')
    })

    it('does not flag a spacing value that matches a dimension token', () => {
        // 16px matches DIMENSION_TOKENS spacing.4
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="p-[16px]" />
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('flags arbitrary margin, gap, and width values', () => {
        const ast = parseSource(`
            export default function A() {
                return (
                    <div>
                        <div data-bridge-id="m1" className="mt-[13px]" />
                        <div data-bridge-id="g1" className="gap-[22px]" />
                        <div data-bridge-id="w1" className="w-[999px]" />
                    </div>
                )
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        expect(result.has('m1')).toBe(true)
        expect(result.has('g1')).toBe(true)
        expect(result.has('w1')).toBe(true)
    })

    it('flags rem and em units as arbitrary spacing values', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="p-[2.5rem]" />
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(true)
        expect(result.get('n1')!.message).toContain('2.5rem')
    })

    it('skips nodes without data-bridge-id', () => {
        const ast = parseSource(`
            export default function A() {
                return <div className="p-[37px]" />
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('populates nearestToken when dimension tokens exist', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="p-[37px]" />
            }
        `)
        const result = visitSpacing(ast, ALL_TOKENS)
        const w = result.get('n1')!
        expect(w.nearestToken).toBe('spacing.4')
        expect(w.nearestTokenValue).toBe('16px')
    })
})

// ── 3. visitShadows ──────────────────────────────────────────────────────────

describe('visitShadows (MITHRIL-SHD-001)', () => {

    it('returns empty map when no arbitrary shadow classes are present', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="shadow-lg shadow-md" />
            }
        `)
        const result = visitShadows(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('flags an arbitrary shadow value not in the token set', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="shadow-[0_8px_30px_rgb(0,0,0,0.12)]" />
            }
        `)
        const result = visitShadows(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.type).toBe('shadow-drift')
        expect(w!.severity).toBe('amber')
        expect(w!.message).toMatch(/MITHRIL-SHD-001/)
    })

    it('does not flag an arbitrary shadow that matches a token (underscore→space normalization)', () => {
        // shadow.sm token value: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
        // Tailwind arbitrary value uses underscores for spaces
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="shadow-[0_1px_2px_0_rgb(0_0_0_/_0.05)]" />
            }
        `)
        const result = visitShadows(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('returns empty map when no shadow tokens are defined', () => {
        const noShadowTokens = ALL_TOKENS.filter(t => t.token_type !== 'shadow')
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="shadow-[0_8px_30px_rgb(0,0,0,0.12)]" />
            }
        `)
        const result = visitShadows(ast, noShadowTokens)
        expect(result.size).toBe(0)
    })

    it('skips nodes without data-bridge-id', () => {
        const ast = parseSource(`
            export default function A() {
                return <div className="shadow-[0_8px_30px_rgb(0,0,0,0.12)]" />
            }
        `)
        const result = visitShadows(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('populates nearestToken when shadow tokens exist', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="shadow-[0_99px_99px_black]" />
            }
        `)
        const result = visitShadows(ast, ALL_TOKENS)
        const w = result.get('n1')!
        expect(w.nearestToken).toBe('shadow.sm')
        expect(w.nearestTokenValue).toBe('0 1px 2px 0 rgb(0 0 0 / 0.05)')
    })
})

// ── 4. visitOpacity ──────────────────────────────────────────────────────────

describe('visitOpacity (MITHRIL-OPC-001)', () => {

    it('returns empty map when no arbitrary opacity classes are present', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="opacity-50 opacity-75" />
            }
        `)
        const result = visitOpacity(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('flags an arbitrary opacity value not in the token set', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="opacity-[0.73]" />
            }
        `)
        const result = visitOpacity(ast, ALL_TOKENS)
        const w = result.get('n1')
        expect(w).toBeDefined()
        expect(w!.type).toBe('opacity-drift')
        expect(w!.severity).toBe('amber')
        expect(w!.message).toMatch(/MITHRIL-OPC-001/)
        expect(w!.message).toContain('0.73')
    })

    it('does not flag an arbitrary opacity that matches a token', () => {
        // opacity.muted token value: '50'
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="opacity-[50]" />
            }
        `)
        const result = visitOpacity(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(false)
    })

    it('returns empty map when no opacity tokens are defined', () => {
        const noOpacityTokens = ALL_TOKENS.filter(t => t.token_type !== 'opacity')
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="opacity-[0.73]" />
            }
        `)
        const result = visitOpacity(ast, noOpacityTokens)
        expect(result.size).toBe(0)
    })

    it('skips nodes without data-bridge-id', () => {
        const ast = parseSource(`
            export default function A() {
                return <div className="opacity-[0.73]" />
            }
        `)
        const result = visitOpacity(ast, ALL_TOKENS)
        expect(result.size).toBe(0)
    })

    it('handles responsive prefix on arbitrary opacity class', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="hover:opacity-[0.33]" />
            }
        `)
        const result = visitOpacity(ast, ALL_TOKENS)
        expect(result.has('n1')).toBe(true)
    })
})

// ── 5. auditAll — cross-visitor priority and dedup ───────────────────────────

describe('auditAll — cross-visitor priority (B.1-e)', () => {

    it('color violation takes precedence over typography violation on the same node', () => {
        // Node has both a color violation (bg-[#000000]) and a typography violation (font-[900])
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-[#000000] font-[900]" />
            }
        `)
        const merged = auditAll(ast, ALL_TOKENS)
        const w = merged.get('n1')
        expect(w).toBeDefined()
        expect(w!.type).toBe('color-drift')
        expect(w!.message).toMatch(/MITHRIL-COL/)
    })

    it('color violation takes precedence over spacing violation on the same node', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-[#000000] p-[37px]" />
            }
        `)
        const merged = auditAll(ast, ALL_TOKENS)
        const w = merged.get('n1')!
        expect(w.type).toBe('color-drift')
    })

    it('different nodes get independent violations from different visitors', () => {
        const ast = parseSource(`
            export default function A() {
                return (
                    <div>
                        <p data-bridge-id="typ" className="font-[900]" />
                        <div data-bridge-id="spc" className="p-[37px]" />
                        <div data-bridge-id="shd" className="shadow-[0_99px_99px_black]" />
                        <div data-bridge-id="opc" className="opacity-[0.73]" />
                    </div>
                )
            }
        `)
        const merged = auditAll(ast, ALL_TOKENS)
        expect(merged.get('typ')?.type).toBe('typography-drift')
        expect(merged.get('spc')?.type).toBe('spacing-drift')
        expect(merged.get('shd')?.type).toBe('shadow-drift')
        expect(merged.get('opc')?.type).toBe('opacity-drift')
    })

    it('returns empty map when no violations of any kind exist', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-blue-500 p-4 font-bold" />
            }
        `)
        const merged = auditAll(ast, ALL_TOKENS)
        expect(merged.size).toBe(0)
    })

    it('non-color violations always have severity "amber" and value 1', () => {
        const ast = parseSource(`
            export default function A() {
                return (
                    <div>
                        <p data-bridge-id="typ" className="font-[900]" />
                        <div data-bridge-id="spc" className="p-[37px]" />
                        <div data-bridge-id="shd" className="shadow-[0_99px_99px_black]" />
                        <div data-bridge-id="opc" className="opacity-[0.73]" />
                    </div>
                )
            }
        `)
        const merged = auditAll(ast, ALL_TOKENS)
        for (const [, w] of merged) {
            expect(w.severity).toBe('amber')
            expect(w.value).toBe(1)
        }
    })
})
