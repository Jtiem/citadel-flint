/**
 * tokenValueSanitizer.test.ts
 *
 * Unit tests for sanitizeTokenValue() and sanitizeTokenDescription()
 * in shared/tokenValueSanitizer.ts.
 *
 * Covers:
 *   - 7 contract testBoundaries (length cap, control-char strip, secret
 *     redaction, color allowlist pass, color allowlist reject, dimension
 *     allowlist, idempotence)
 *   - 60-value fuzz harness (10 bidi/RTL, 5 NUL/control, 10 CSS breakouts,
 *     5 Swift breakouts, 5 Kotlin breakouts, 10 oversized, 10 secrets,
 *     5 prototype-pollution path keys)
 */

import { describe, it, expect } from 'vitest'
import {
    sanitizeTokenValue,
    sanitizeTokenDescription,
    TOKEN_VALUE_MAX_LENGTH,
    TOKEN_DESCRIPTION_MAX_LENGTH,
    SANITIZER_VERSION,
    type TokenShapeCategory,
} from '../tokenValueSanitizer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pass(value: string, type: TokenShapeCategory) {
    const r = sanitizeTokenValue(value, type)
    expect(r.rejected, `expected '${value}' to pass for type '${type}' but it was rejected: ${r.rejectionReason}`).toBe(false)
    return r
}

function fail(value: string, type: TokenShapeCategory) {
    const r = sanitizeTokenValue(value, type)
    expect(r.rejected, `expected '${value}' to be rejected for type '${type}' but it passed`).toBe(true)
    return r
}

// ── Exports ───────────────────────────────────────────────────────────────────

describe('tokenValueSanitizer — exports', () => {
    it('exports TOKEN_VALUE_MAX_LENGTH = 1000', () => {
        expect(TOKEN_VALUE_MAX_LENGTH).toBe(1000)
    })

    it('exports TOKEN_DESCRIPTION_MAX_LENGTH = 4096', () => {
        expect(TOKEN_DESCRIPTION_MAX_LENGTH).toBe(4096)
    })

    it('exports SANITIZER_VERSION as a non-empty string', () => {
        expect(typeof SANITIZER_VERSION).toBe('string')
        expect(SANITIZER_VERSION.length).toBeGreaterThan(0)
    })
})

// ── Contract testBoundary 1: Length cap ───────────────────────────────────────

describe('sanitizeTokenValue — TB1: length cap', () => {
    it('truncates values exceeding 1000 chars and sets truncated: true', () => {
        const r = sanitizeTokenValue('a'.repeat(5000), 'string')
        expect(r.truncated).toBe(true)
        // Even if rejected, the internal processing was bounded
        // For 'string' type, 'aaaa...' passes shape but gets truncated
        if (!r.rejected) {
            expect(r.sanitized!.length).toBeLessThanOrEqual(TOKEN_VALUE_MAX_LENGTH)
        }
    })

    it('exactly 1000 chars passes untruncated for string type', () => {
        const r = sanitizeTokenValue('a'.repeat(1000), 'string')
        expect(r.truncated).toBe(false)
    })

    it('1001 chars is truncated to 1000', () => {
        const r = sanitizeTokenValue('a'.repeat(1001), 'string')
        expect(r.truncated).toBe(true)
        if (!r.rejected) {
            expect(r.sanitized!.length).toBeLessThanOrEqual(1000)
        }
    })
})

// ── Contract testBoundary 2: Control/format char strip ────────────────────────

describe('sanitizeTokenValue — TB2: control/format char strip', () => {
    it('strips bidi override \\u202E from a color value', () => {
        // '#ff0000' + RTL override + 'beef' — the hex part is valid, the bidi char is stripped
        const input = '#ff0000\u202Ebeef'
        const r = sanitizeTokenValue(input, 'color')
        expect(r.strippedControlChars).toBe(true)
        if (r.sanitized) {
            expect(r.sanitized).not.toContain('\u202E')
        }
    })

    it('strips LRO \\u202D', () => {
        const r = sanitizeTokenValue('red\u202D', 'color')
        expect(r.strippedControlChars).toBe(true)
        if (r.sanitized) {
            expect(r.sanitized).not.toContain('\u202D')
        }
    })

    it('strips NUL byte \\u0000 from a color value', () => {
        const r = sanitizeTokenValue('red\u0000', 'color')
        expect(r.strippedControlChars).toBe(true)
        if (r.sanitized) {
            expect(r.sanitized).not.toContain('\u0000')
        }
    })

    it('sets strippedControlChars: false when no control chars present', () => {
        const r = sanitizeTokenValue('red', 'color')
        expect(r.strippedControlChars).toBe(false)
    })
})

// ── Contract testBoundary 3: Secret redaction ─────────────────────────────────

describe('sanitizeTokenDescription — TB3: secret redaction', () => {
    it('redacts sk-ant- Anthropic API key', () => {
        const r = sanitizeTokenDescription('token from sk-ant-api03-xyzABC123456789012345678')
        expect(r.redacted).toBe(true)
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.sanitized).not.toContain('sk-ant-')
    })

    it('redacts ghp_ GitHub token', () => {
        const r = sanitizeTokenDescription('ghp_' + 'A'.repeat(36) + 'zZ1')
        expect(r.redacted).toBe(true)
        expect(r.sanitized).toContain('[REDACTED]')
    })

    it('redacts AKIA AWS access key', () => {
        const r = sanitizeTokenDescription('key: AKIA1234567890ABCD')
        expect(r.redacted).toBe(true)
        expect(r.sanitized).toContain('[REDACTED]')
    })

    it('does not redact non-secret text', () => {
        const r = sanitizeTokenDescription('Primary blue brand color for interactive elements')
        expect(r.redacted).toBe(false)
        expect(r.sanitized).toBe('Primary blue brand color for interactive elements')
    })
})

// ── Contract testBoundary 4: Color shape allowlist — pass ─────────────────────

describe('sanitizeTokenValue — TB4: color shape allowlist (pass)', () => {
    const validColors: string[] = [
        '#f00',
        '#ff0000',
        '#ff0000ff',
        '#3b82f6',
        'red',
        'transparent',
        'currentColor',
        'rgb(255, 0, 0)',
        'rgb(59 130 246)',
        'rgba(255, 0, 0, 0.5)',
        'hsl(0, 100%, 50%)',
        'hsl(0 100% 50%)',
        'hsla(0, 100%, 50%, 0.8)',
        'oklch(0.5 0.2 30)',
        'lab(50% 25 -30)',
        'color(display-p3 0.9 0.1 0.2)',
    ]

    for (const color of validColors) {
        it(`accepts valid color: ${color}`, () => {
            pass(color, 'color')
        })
    }
})

// ── Contract testBoundary 4b: Color shape allowlist — reject ──────────────────

describe('sanitizeTokenValue — TB4: color shape allowlist (reject)', () => {
    const invalidColors: string[] = [
        'red; } body {',
        'url(javascript:0)',
        'expression(alert(1))',
        '#f00; }',
        'red } :root { color: red',
    ]

    for (const color of invalidColors) {
        it(`rejects invalid color: ${JSON.stringify(color)}`, () => {
            fail(color, 'color')
        })
    }
})

// ── Contract testBoundary 5: Dimension shape allowlist ───────────────────────

describe('sanitizeTokenValue — TB5: dimension allowlist', () => {
    const validDimensions = ['16px', '1.5rem', '0', '50%', '2em', '-4px', '1.25rem', '100vh']
    const invalidDimensions = ['16', '16px; }', '16 px', 'abc', 'px', 'none']

    for (const d of validDimensions) {
        it(`accepts valid dimension: ${d}`, () => {
            pass(d, 'dimension')
        })
    }

    for (const d of invalidDimensions) {
        it(`rejects invalid dimension: ${JSON.stringify(d)}`, () => {
            fail(d, 'dimension')
        })
    }
})

// ── Contract testBoundary 6: Empty / whitespace-only ─────────────────────────

describe('sanitizeTokenValue — TB6: empty / whitespace-only', () => {
    it('returns rejected for empty string', () => {
        const r = sanitizeTokenValue('', 'string')
        expect(r.rejected).toBe(true)
        expect(r.sanitized).toBeNull()
    })

    it('returns rejected for whitespace-only string', () => {
        const r = sanitizeTokenValue('   ', 'string')
        expect(r.rejected).toBe(true)
        expect(r.sanitized).toBeNull()
    })

    it('returns rejected for non-string (null)', () => {
        const r = sanitizeTokenValue(null, 'string')
        expect(r.rejected).toBe(true)
        expect(r.sanitized).toBeNull()
    })

    it('returns rejected for non-string (number)', () => {
        const r = sanitizeTokenValue(42, 'string')
        expect(r.rejected).toBe(true)
    })
})

// ── Contract testBoundary 7: Idempotence ─────────────────────────────────────

describe('sanitizeTokenValue — TB7: idempotence', () => {
    const idempotentInputs: Array<[string, TokenShapeCategory]> = [
        ['#3b82f6', 'color'],
        ['16px', 'dimension'],
        ['Inter, sans-serif', 'fontFamily'],
        ['Brand primary color', 'string'],
        ['true', 'boolean'],
    ]

    for (const [value, type] of idempotentInputs) {
        it(`sanitize(sanitize(x)) === sanitize(x) for '${value}' (${type})`, () => {
            const first = sanitizeTokenValue(value, type)
            if (first.sanitized !== null) {
                const second = sanitizeTokenValue(first.sanitized, type)
                expect(second.sanitized).toBe(first.sanitized)
            }
        })
    }
})

// ── Additional type coverage ──────────────────────────────────────────────────

describe('sanitizeTokenValue — type coverage', () => {
    it('accepts fontWeight: bold', () => pass('bold', 'fontWeight'))
    it('accepts fontWeight: 700', () => pass('700', 'fontWeight'))
    it('rejects fontWeight: extra-heavy', () => fail('extra-heavy', 'fontWeight'))

    it('accepts opacity: 0.5', () => pass('0.5', 'opacity'))
    it('accepts opacity: 0', () => pass('0', 'opacity'))
    it('accepts opacity: 1', () => pass('1', 'opacity'))
    it('rejects opacity: 1.5', () => fail('1.5', 'opacity'))

    it('accepts boolean: true', () => pass('true', 'boolean'))
    it('accepts boolean: false', () => pass('false', 'boolean'))
    it('rejects boolean: yes', () => fail('yes', 'boolean'))

    it('passes fontFamily through (free text)', () => pass('Inter, sans-serif', 'fontFamily'))
    it('passes shadow through (free text)', () => pass('0 4px 6px rgba(0,0,0,0.1)', 'shadow'))
    it('rejects fontFamily with CSS breakout: } in value', () => fail('Inter} :root', 'fontFamily'))
})

// ── 60-value fuzz harness ─────────────────────────────────────────────────────

/**
 * The fuzz harness asserts three properties for every input:
 *   1. sanitizeTokenValue() does NOT throw (any type).
 *   2. If a sanitized value is returned, it does NOT contain any of the
 *      primary breakout sequences from the fuzz corpus.
 *   3. If a sanitized value is returned, its length <= TOKEN_VALUE_MAX_LENGTH.
 *
 * Each fuzz input is tagged with its threat category for traceability.
 */

type FuzzEntry = { label: string; value: string; type: TokenShapeCategory }

const FUZZ_CORPUS: FuzzEntry[] = [
    // ── 10 bidi/RTL chars ─────────────────────────────────────────────────
    { label: 'bidi-01 RLO \\u202E', value: '#ff0000\u202Ebeef', type: 'color' },
    { label: 'bidi-02 LRO \\u202D', value: '16px\u202D', type: 'dimension' },
    { label: 'bidi-03 LRE \\u202A', value: 'Inter\u202A, sans-serif', type: 'fontFamily' },
    { label: 'bidi-04 RLE \\u202B', value: 'note\u202B text', type: 'string' },
    { label: 'bidi-05 PDF \\u202C', value: 'true\u202C', type: 'boolean' },
    { label: 'bidi-06 ALM \\u061C', value: '0.5\u061C', type: 'opacity' },
    { label: 'bidi-07 LRM \\u200E', value: '700\u200E', type: 'fontWeight' },
    { label: 'bidi-08 RLM \\u200F', value: '#abc\u200F', type: 'color' },
    { label: 'bidi-09 WJ \\u2060', value: 'Inter\u2060', type: 'fontFamily' },
    { label: 'bidi-10 ZWJ \\u200D', value: 'red\u200D', type: 'color' },

    // ── 5 NUL/control byte injections ────────────────────────────────────
    { label: 'ctrl-01 NUL byte', value: 'red\u0000', type: 'color' },
    { label: 'ctrl-02 NUL mid-value', value: '16\u0000px', type: 'dimension' },
    { label: 'ctrl-03 BEL byte \\u0007', value: 'font\u0007name', type: 'fontFamily' },
    { label: 'ctrl-04 DEL \\u007F', value: '0.5\u007F', type: 'opacity' },
    { label: 'ctrl-05 SOH \\u0001', value: 'true\u0001', type: 'boolean' },

    // ── 10 CSS breakouts ─────────────────────────────────────────────────
    { label: 'css-01 close brace', value: 'red; }', type: 'color' },
    { label: 'css-02 comment close', value: 'red */ body', type: 'color' },
    { label: 'css-03 url(javascript:)', value: 'url(javascript:alert(1))', type: 'color' },
    { label: 'css-04 expression()', value: 'expression(alert(1))', type: 'color' },
    { label: 'css-05 --var breakout', value: '--var: }', type: 'string' },
    { label: 'css-06 open+close brace', value: '{ color: red }', type: 'string' },
    { label: 'css-07 multi-line breakout', value: '#f00;\n}:root{color:red', type: 'color' },
    { label: 'css-08 url( with space', value: 'url( javascript:0)', type: 'color' },
    { label: 'css-09 EXPRESSION uppercase', value: 'EXPRESSION(evil())', type: 'color' },
    { label: 'css-10 nested comment', value: '/* */ } :root', type: 'string' },

    // ── 5 Swift breakouts ─────────────────────────────────────────────────
    { label: 'swift-01 string interpolation \\(', value: 'Inter\\(x)', type: 'fontFamily' },
    { label: 'swift-02 triple-quote"""', value: 'Inter"""exit(1)', type: 'fontFamily' },
    { label: 'swift-03 newline injection', value: 'Inter\nexit(1)//', type: 'fontFamily' },
    { label: 'swift-04 quote close "', value: 'font")\nexit(1)', type: 'fontFamily' },
    { label: 'swift-05 backslash escape', value: 'Inter\\n', type: 'fontFamily' },

    // ── 5 Kotlin breakouts ────────────────────────────────────────────────
    { label: 'kotlin-01 ${ template', value: 'Inter${System.exit(0)}', type: 'fontFamily' },
    { label: 'kotlin-02 $ identifier', value: 'value$x', type: 'string' },
    { label: 'kotlin-03 triple-quote', value: '"""Inter"""', type: 'fontFamily' },
    { label: 'kotlin-04 newline', value: 'Inter\nSystem.exit(0)', type: 'fontFamily' },
    { label: 'kotlin-05 quote + dollar', value: '"${"'.repeat(2), type: 'string' },

    // ── 10 oversized strings ──────────────────────────────────────────────
    { label: 'oversize-01 10KB string', value: 'a'.repeat(10_000), type: 'string' },
    { label: 'oversize-02 10KB color', value: '#'.padEnd(10_000, 'f'), type: 'color' },
    { label: 'oversize-03 100KB', value: 'x'.repeat(100_000), type: 'string' },
    { label: 'oversize-04 1MB', value: 'y'.repeat(1_000_000), type: 'string' },
    { label: 'oversize-05 exactly 1001', value: 'z'.repeat(1001), type: 'string' },
    { label: 'oversize-06 exactly 1000', value: 'w'.repeat(1000), type: 'string' },
    { label: 'oversize-07 1KB color-like', value: '#' + 'a'.repeat(999), type: 'color' },
    { label: 'oversize-08 1KB dimension-like', value: '1'.repeat(998) + 'px', type: 'dimension' },
    { label: 'oversize-09 2MB', value: 'a'.repeat(2_000_000), type: 'string' },
    { label: 'oversize-10 5000 chars', value: 'b'.repeat(5000), type: 'string' },

    // ── 10 secret patterns ────────────────────────────────────────────────
    { label: 'secret-01 sk-ant- key', value: 'sk-ant-api03-' + 'xA1bC2dE3f'.repeat(3), type: 'string' },
    { label: 'secret-02 ghp_ token', value: 'ghp_' + 'Aa1'.repeat(13), type: 'string' },
    { label: 'secret-03 AKIA AWS key', value: 'AKIA1234567890ABCD', type: 'string' },
    { label: 'secret-04 sk- openai key', value: 'sk-' + 'Abc123'.repeat(5), type: 'string' },
    { label: 'secret-05 high-entropy b64', value: 'aAbBcC1234567890xXyYzZ+/aAbBcC12', type: 'string' },
    { label: 'secret-06 sk-ant- embedded in color desc', value: '#3b82f6 sk-ant-api03-' + 'X1y2Z3'.repeat(4), type: 'string' },
    { label: 'secret-07 AWS key in dimension', value: 'AKIA12345678901234', type: 'dimension' },
    { label: 'secret-08 ghp in fontFamily', value: 'ghp_' + 'Zz9'.repeat(13), type: 'fontFamily' },
    { label: 'secret-09 high-entropy in color value', value: 'aAbBcCdDeEfF1234567890ZzXxYy+/QQ', type: 'color' },
    { label: 'secret-10 multiple secrets', value: 'sk-ant-api03-' + 'xA1b'.repeat(5) + ' and AKIA' + 'A1'.repeat(8), type: 'string' },

    // ── 5 prototype-pollution path keys ──────────────────────────────────
    { label: 'proto-01 __proto__ key as value', value: '__proto__', type: 'string' },
    { label: 'proto-02 constructor as value', value: 'constructor', type: 'string' },
    { label: 'proto-03 prototype as value', value: 'prototype', type: 'string' },
    { label: 'proto-04 __proto__.polluted', value: '__proto__.polluted', type: 'string' },
    { label: 'proto-05 constructor.prototype', value: 'constructor.prototype', type: 'string' },
]

// Verify corpus has exactly 60 entries
const EXPECTED_FUZZ_COUNT = 60
if (FUZZ_CORPUS.length !== EXPECTED_FUZZ_COUNT) {
    throw new Error(`Fuzz corpus must have exactly ${EXPECTED_FUZZ_COUNT} entries, got ${FUZZ_CORPUS.length}`)
}

/**
 * Sequences that the sanitizer is responsible for ensuring do not appear
 * in sanitized output. Note: language-specific escape sequences (${, \()
 * are the emitter escape helpers' responsibility, not the sanitizer's.
 * The sanitizer's job is to strip Trojan-Source vectors, cap length, and
 * reject CSS breakout patterns via the shape validator.
 */
const FORBIDDEN_IN_OUTPUT = [
    '\u202E',   // RTL override (bidi) — stripped by M2
    '\u202D',   // LRO (bidi) — stripped by M2
    '\u0000',   // NUL byte — stripped by M2
    'url(javascript',  // CSS JavaScript URL — rejected by shape validator
]

describe('sanitizeTokenValue — 60-value fuzz harness', () => {
    describe.each(FUZZ_CORPUS.map((e, i) => ({ ...e, idx: i + 1 })))(
        'fuzz #$idx — $label',
        ({ value, type }) => {
            it('does not throw', () => {
                expect(() => sanitizeTokenValue(value, type)).not.toThrow()
            })

            it('sanitized output (if any) does not contain primary breakout sequences', () => {
                const r = sanitizeTokenValue(value, type)
                if (r.sanitized !== null) {
                    expect(r.sanitized.length).toBeLessThanOrEqual(TOKEN_VALUE_MAX_LENGTH)
                    for (const forbidden of FORBIDDEN_IN_OUTPUT) {
                        expect(r.sanitized, `sanitized output should not contain ${JSON.stringify(forbidden)}`).not.toContain(forbidden)
                    }
                }
            })

            it('result has the expected shape', () => {
                const r = sanitizeTokenValue(value, type)
                expect(typeof r.rejected).toBe('boolean')
                expect(typeof r.truncated).toBe('boolean')
                expect(typeof r.redacted).toBe('boolean')
                expect(typeof r.strippedControlChars).toBe('boolean')
                expect(r.rejectionReason === null || typeof r.rejectionReason === 'string').toBe(true)
            })
        }
    )
})
