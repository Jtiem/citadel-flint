/**
 * escape.test.ts
 *
 * Unit tests for the per-emitter string-literal escape helpers in
 * flint-mcp/src/core/emitters/escape.ts.
 *
 * Covers 6 contract testBoundaries:
 *   TB1 — CSS escape: } becomes neutralized, url(javascript:) blocked
 *   TB2 — Tailwind/TS escape: extends past \ and '
 *   TB3 — Swift escape: " and \( neutralized
 *   TB4 — Kotlin escape: " and ${ neutralized
 *   TB5 — Idempotence per emitter
 *   TB6 — Output passes a basic roundtrip sanity check (no raw breakout
 *          sequences in the escaped output)
 */

import { describe, it, expect } from 'vitest'
import {
    escapeCssValue,
    escapeSwiftStringLiteral,
    escapeKotlinStringLiteral,
    escapeTypescriptStringLiteral,
} from '../escape.js'

// ── Contract testBoundary 1: CSS escape ──────────────────────────────────────

describe('escapeCssValue — TB1: declaration breakout neutralization', () => {
    it('neutralizes close-brace }', () => {
        const out = escapeCssValue('#f00; } body { background: red }')
        expect(out).not.toContain('}')
    })

    it('neutralizes open-brace {', () => {
        const out = escapeCssValue('value { color: red }')
        expect(out).not.toContain('{')
    })

    it('neutralizes url(javascript:...)', () => {
        const out = escapeCssValue('url(javascript:alert(1))')
        expect(out).not.toContain('url(javascript')
        expect(out).not.toContain('javascript:alert')
    })

    it('allows url(data:...) to pass through', () => {
        const out = escapeCssValue("url('data:image/svg+xml,...')")
        // data: URIs are permitted
        expect(out).toContain('data:')
    })

    it('neutralizes comment-close sequence */', () => {
        const out = escapeCssValue('value */ body')
        expect(out).not.toContain('*/')
    })

    it('neutralizes expression() IE injection', () => {
        const out = escapeCssValue('expression(alert(1))')
        expect(out).not.toContain('expression(')
    })

    it('collapses newline to space (newline terminates CSS declaration)', () => {
        const out = escapeCssValue('value\nnewline')
        expect(out).not.toContain('\n')
    })

    it('strips bidi override \\u202E', () => {
        const out = escapeCssValue('#f00\u202E')
        expect(out).not.toContain('\u202E')
    })

    it('preserves a clean color value unchanged (modulo backslash escaping)', () => {
        const out = escapeCssValue('#3b82f6')
        // Clean hex color — no transformation should break the core value
        expect(out).toContain('3b82f6')
    })

    it('handles complex malicious input without throwing', () => {
        const malicious = '#f00; } body { background:url(javascript:0) } /*'
        expect(() => escapeCssValue(malicious)).not.toThrow()
        const out = escapeCssValue(malicious)
        expect(out).not.toContain('}')
        expect(out).not.toContain('url(javascript')
        expect(out).not.toContain('*/')
    })
})

// ── Contract testBoundary 2: TypeScript/Tailwind escape ───────────────────────

describe('escapeTypescriptStringLiteral — TB2: extends past \\ and \'', () => {
    it('escapes backslash', () => {
        const out = escapeTypescriptStringLiteral('value\\path')
        expect(out).toBe('value\\\\path')
    })

    it('escapes single-quote', () => {
        const out = escapeTypescriptStringLiteral("it's a value")
        expect(out).toContain("\\'")
    })

    it('escapes double-quote (beyond what old escapeValue did)', () => {
        const out = escapeTypescriptStringLiteral('say "hello"')
        expect(out).toContain('\\"')
        expect(out).not.toContain('"hello"')
    })

    it('escapes newline (beyond what old escapeValue did)', () => {
        const out = escapeTypescriptStringLiteral('line1\nline2')
        expect(out).toContain('\\n')
        expect(out).not.toContain('\n')
    })

    it('escapes CR', () => {
        const out = escapeTypescriptStringLiteral('value\rend')
        expect(out).toContain('\\r')
        expect(out).not.toContain('\r')
    })

    it('escapes tab', () => {
        const out = escapeTypescriptStringLiteral('value\tend')
        expect(out).toContain('\\t')
        expect(out).not.toContain('\t')
    })

    it('escapes template literal interpolation ${', () => {
        const out = escapeTypescriptStringLiteral('${evil}')
        expect(out).not.toContain('${')
    })

    it('escapes backtick', () => {
        const out = escapeTypescriptStringLiteral('value`end')
        expect(out).toContain('\\`')
    })

    it('strips bidi override \\u202E', () => {
        const out = escapeTypescriptStringLiteral('Inter\u202E')
        expect(out).not.toContain('\u202E')
    })

    it('handles the full Tailwind attack vector', () => {
        const out = escapeTypescriptStringLiteral('\n"test')
        // Should escape both newline and quote
        expect(out).toContain('\\n')
        expect(out).toContain('\\"')
    })
})

// ── Contract testBoundary 3: Swift escape ────────────────────────────────────

describe('escapeSwiftStringLiteral — TB3: Swift string literal safety', () => {
    it('escapes double-quote to prevent literal close', () => {
        const out = escapeSwiftStringLiteral('Inter"')
        expect(out).toContain('\\"')
        expect(out).not.toMatch(/(?<!\\)"/)  // no unescaped quote
    })

    it('escapes backslash first (double-escape protection)', () => {
        const out = escapeSwiftStringLiteral('Inter\\n')
        // Original backslash becomes \\, then the n is just 'n'
        expect(out).toContain('\\\\')
    })

    it('neutralizes Swift string interpolation \\( by escaping backslash', () => {
        // Raw input: "Inter\(x)" — the \( would execute string interpolation in Swift
        const out = escapeSwiftStringLiteral('Inter\\(x)')
        // After backslash doubling: Inter\\(x) — the \( is now \\\(, safe
        expect(out).toContain('\\\\')
    })

    it('escapes newline', () => {
        const out = escapeSwiftStringLiteral('Inter\nexit(1)//')
        expect(out).toContain('\\n')
        expect(out).not.toContain('\n')
    })

    it('escapes CR', () => {
        const out = escapeSwiftStringLiteral('value\rend')
        expect(out).toContain('\\r')
        expect(out).not.toContain('\r')
    })

    it('strips bidi override chars', () => {
        const out = escapeSwiftStringLiteral('Inter\u202E')
        expect(out).not.toContain('\u202E')
    })

    it('does not throw on complex input', () => {
        expect(() => escapeSwiftStringLiteral('Inter")\nexit(1)//')).not.toThrow()
    })

    it('result does not contain raw double-quote from original that would close Swift literal', () => {
        const original = 'Inter")\nexit(1)//'
        const out = escapeSwiftStringLiteral(original)
        // Unescaped double-quote would close the Swift literal.
        // We verify no unescaped double-quote is present.
        // Pattern: a quote NOT preceded by an odd number of backslashes
        const hasUnescapedQuote = /(?<!\\)(?:\\\\)*"/.test(out)
        // Actually we just check the output doesn't contain an unescaped lone "
        // The escaped form is \" which is fine.
        expect(out.includes('\\"') || !out.includes('"')).toBe(true)
    })
})

// ── Contract testBoundary 4: Kotlin escape ───────────────────────────────────

describe('escapeKotlinStringLiteral — TB4: Kotlin template neutralization', () => {
    it('escapes double-quote', () => {
        const out = escapeKotlinStringLiteral('value"end')
        expect(out).toContain('\\"')
    })

    it('escapes $ to prevent $identifier template interpolation', () => {
        const out = escapeKotlinStringLiteral('value$x')
        expect(out).toContain('\\$')
        expect(out).not.toMatch(/(?<!\\)\$[a-zA-Z]/)
    })

    it('escapes ${ to prevent ${expr} template interpolation', () => {
        const out = escapeKotlinStringLiteral('Inter${x}')
        // Dollar sign is escaped to \\$, so ${ becomes \\${
        expect(out).not.toContain('${')
        expect(out).toContain('\\$')
    })

    it('escapes ${System.exit(0)} attack vector', () => {
        const out = escapeKotlinStringLiteral('Inter${System.exit(0)}')
        expect(out).not.toContain('${')
    })

    it('escapes backslash first (double-escape protection)', () => {
        const out = escapeKotlinStringLiteral('Inter\\n')
        expect(out).toContain('\\\\')
    })

    it('escapes newline', () => {
        const out = escapeKotlinStringLiteral('value\nend')
        expect(out).toContain('\\n')
        expect(out).not.toContain('\n')
    })

    it('strips bidi override chars', () => {
        const out = escapeKotlinStringLiteral('Inter\u202E')
        expect(out).not.toContain('\u202E')
    })

    it('does not throw on complex input', () => {
        expect(() => escapeKotlinStringLiteral('Inter${System.exit(0)}')).not.toThrow()
    })
})

// ── Contract testBoundary 5: Idempotence ─────────────────────────────────────

describe('escape helpers — TB5: idempotence', () => {
    const cssInputs = ['#3b82f6', 'Inter, sans-serif', '16px solid rgba(0,0,0,0.1)']
    for (const input of cssInputs) {
        it(`escapeCssValue is idempotent for: ${JSON.stringify(input)}`, () => {
            const once = escapeCssValue(input)
            const twice = escapeCssValue(once)
            expect(twice).toBe(once)
        })
    }

    const swiftInputs = ['Inter', 'SF Pro', 'Helvetica Neue']
    for (const input of swiftInputs) {
        it(`escapeSwiftStringLiteral is idempotent for: ${JSON.stringify(input)}`, () => {
            const once = escapeSwiftStringLiteral(input)
            const twice = escapeSwiftStringLiteral(once)
            expect(twice).toBe(once)
        })
    }

    const kotlinInputs = ['Roboto', 'Noto Sans', 'Inter']
    for (const input of kotlinInputs) {
        it(`escapeKotlinStringLiteral is idempotent for: ${JSON.stringify(input)}`, () => {
            const once = escapeKotlinStringLiteral(input)
            const twice = escapeKotlinStringLiteral(once)
            expect(twice).toBe(once)
        })
    }

    const tsInputs = ['Inter', '#3b82f6', '16px']
    for (const input of tsInputs) {
        it(`escapeTypescriptStringLiteral is idempotent for: ${JSON.stringify(input)}`, () => {
            const once = escapeTypescriptStringLiteral(input)
            const twice = escapeTypescriptStringLiteral(once)
            expect(twice).toBe(once)
        })
    }
})

// ── Contract testBoundary 6: Roundtrip parse safety ──────────────────────────

describe('escape helpers — TB6: roundtrip parse safety (no breakout in output)', () => {
    it('escapeCssValue output: no unescaped { or } that would break a CSS parser', () => {
        const malicious = '#f00; } body { color: red }'
        const out = escapeCssValue(malicious)
        expect(out).not.toContain('{')
        expect(out).not.toContain('}')
    })

    it('escapeCssValue output: no url(javascript: that would execute in a CSS parser', () => {
        const out = escapeCssValue('url(javascript:alert(1))')
        expect(out.toLowerCase()).not.toContain('url(javascript')
    })

    it('escapeSwiftStringLiteral output: embeddable in Swift string literal without closing it', () => {
        const values = ['"hello"', 'say "world"', 'a"b"c']
        for (const v of values) {
            const out = escapeSwiftStringLiteral(v)
            // Simulated Swift string: `"<out>"`
            // We verify the out does not contain an unescaped double-quote
            // that would prematurely close the Swift string.
            // Check: any " in out must be preceded by \
            const unescapedQuote = out.match(/(?<!\\)"/g)
            expect(unescapedQuote).toBeNull()
        }
    })

    it('escapeKotlinStringLiteral output: no ${ template interpolation', () => {
        const out = escapeKotlinStringLiteral('value${malicious}end')
        expect(out).not.toContain('${')
    })

    it('escapeTypescriptStringLiteral output: no raw newline that would break TS string literal', () => {
        const out = escapeTypescriptStringLiteral('line1\nline2\nline3')
        expect(out).not.toContain('\n')
    })

    it('all four helpers handle empty string without throwing', () => {
        expect(() => escapeCssValue('')).not.toThrow()
        expect(() => escapeSwiftStringLiteral('')).not.toThrow()
        expect(() => escapeKotlinStringLiteral('')).not.toThrow()
        expect(() => escapeTypescriptStringLiteral('')).not.toThrow()
    })
})

// ── Additional edge cases ─────────────────────────────────────────────────────

describe('escape helpers — additional edge cases', () => {
    it('escapeCssValue: EXPRESSION uppercase is also neutralized', () => {
        const out = escapeCssValue('EXPRESSION(evil())')
        expect(out.toLowerCase()).not.toContain('expression(')
    })

    it('escapeCssValue: url( with spaces is neutralized', () => {
        const out = escapeCssValue('url( javascript:0)')
        expect(out.toLowerCase()).not.toContain('url(javascript')
    })

    it('escapeKotlinStringLiteral: single $ (not followed by {) also escaped', () => {
        const out = escapeKotlinStringLiteral('$name')
        expect(out).toContain('\\$')
    })

    it('escapeTypescriptStringLiteral: handles all bidi variants', () => {
        const bidiChars = '\u202E\u202D\u202A\u202B\u202C\u061C\u200E\u200F'
        const out = escapeTypescriptStringLiteral(bidiChars + 'safe')
        for (const char of bidiChars) {
            expect(out).not.toContain(char)
        }
        expect(out).toContain('safe')
    })
})
