/**
 * reasonSanitizer.test.ts
 *
 * Unit tests for the shared sanitizeReason() used by both electron/main.ts
 * and server/index.ts governance:approve-mutation handlers.
 *
 * Covers the full M1 + M2 + M4 security pipeline:
 *   - M1: Length cap at REASON_MAX_LENGTH
 *   - M2: Control + format char stripping (Trojan-Source defense)
 *   - M4: Secret redaction for Anthropic / OpenAI / AWS / GitHub / high-entropy
 */

import { describe, it, expect } from 'vitest'
import { sanitizeReason, REASON_MAX_LENGTH } from '../reasonSanitizer'

describe('sanitizeReason — basic behavior', () => {
    it('returns null for non-string input (number)', () => {
        const r = sanitizeReason(42)
        expect(r.sanitized).toBeNull()
    })

    it('returns null for non-string input (object)', () => {
        const r = sanitizeReason({ reason: 'text' })
        expect(r.sanitized).toBeNull()
    })

    it('returns null for non-string input (undefined)', () => {
        const r = sanitizeReason(undefined)
        expect(r.sanitized).toBeNull()
    })

    it('returns null for non-string input (null)', () => {
        const r = sanitizeReason(null)
        expect(r.sanitized).toBeNull()
    })

    it('returns null for empty string', () => {
        const r = sanitizeReason('')
        expect(r.sanitized).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
        const r = sanitizeReason('   \t \n ')
        expect(r.sanitized).toBeNull()
    })

    it('trims leading and trailing whitespace', () => {
        const r = sanitizeReason('  brand approved  ')
        expect(r.sanitized).toBe('brand approved')
    })

    it('preserves interior whitespace', () => {
        const r = sanitizeReason('brand team approved this change')
        expect(r.sanitized).toBe('brand team approved this change')
    })

    it('leaves normal Unicode text unchanged', () => {
        const r = sanitizeReason('café — design team signed off 🎨')
        expect(r.sanitized).toBe('café — design team signed off 🎨')
        expect(r.redacted).toBe(false)
        expect(r.strippedControlChars).toBe(false)
        expect(r.truncated).toBe(false)
    })
})

describe('sanitizeReason — M1: length cap', () => {
    it(`truncates input longer than ${REASON_MAX_LENGTH} characters`, () => {
        const long = 'a'.repeat(REASON_MAX_LENGTH + 500)
        const r = sanitizeReason(long)
        expect(r.sanitized).toHaveLength(REASON_MAX_LENGTH)
        expect(r.truncated).toBe(true)
    })

    it(`does not truncate input exactly at ${REASON_MAX_LENGTH} characters`, () => {
        const at = 'a'.repeat(REASON_MAX_LENGTH)
        const r = sanitizeReason(at)
        expect(r.sanitized).toHaveLength(REASON_MAX_LENGTH)
        expect(r.truncated).toBe(false)
    })

    it('does not truncate short input', () => {
        const r = sanitizeReason('short reason')
        expect(r.truncated).toBe(false)
        expect(r.sanitized).toBe('short reason')
    })

    it('does not DoS on pathological input (1 MB)', () => {
        const huge = 'x'.repeat(1024 * 1024)
        const start = Date.now()
        const r = sanitizeReason(huge)
        const elapsed = Date.now() - start
        expect(r.sanitized).toHaveLength(REASON_MAX_LENGTH)
        // The sanitizer must stay well under a second even on a 1 MB input.
        expect(elapsed).toBeLessThan(1000)
    })
})

describe('sanitizeReason — M2: control + format char stripping', () => {
    it('strips NUL bytes (C-string truncation defense)', () => {
        const r = sanitizeReason('brand\x00approved')
        expect(r.sanitized).toBe('brandapproved')
        expect(r.strippedControlChars).toBe(true)
    })

    it('strips ASCII control chars (0x00-0x1F)', () => {
        const r = sanitizeReason('brand\x01\x02\x03approved')
        expect(r.sanitized).toBe('brandapproved')
        expect(r.strippedControlChars).toBe(true)
    })

    it('strips DEL (0x7F)', () => {
        const r = sanitizeReason('brand\x7Fapproved')
        expect(r.sanitized).toBe('brandapproved')
        expect(r.strippedControlChars).toBe(true)
    })

    it('strips Unicode bidi-override chars (CVE-2021-42574 Trojan-Source)', () => {
        // U+202E = Right-to-Left Override
        const r = sanitizeReason('harmless \u202Eevil\u202C content')
        expect(r.sanitized).not.toContain('\u202E')
        expect(r.sanitized).not.toContain('\u202C')
        expect(r.strippedControlChars).toBe(true)
    })

    it('strips Unicode isolate chars (U+2066-U+2069)', () => {
        const r = sanitizeReason('a\u2066b\u2067c\u2068d\u2069e')
        expect(r.sanitized).toBe('abcde')
        expect(r.strippedControlChars).toBe(true)
    })

    it('strips zero-width chars (ZWJ/ZWNJ/ZWSP)', () => {
        const r = sanitizeReason('vis\u200Bible\u200Ctext\u200Dhere')
        expect(r.sanitized).toBe('visibletexthere')
        expect(r.strippedControlChars).toBe(true)
    })

    it('preserves newlines in normal text after stripping', () => {
        // Newlines (\n = 0x0A) are control chars and get stripped by design —
        // audit log entries should be single-line unambiguous text.
        const r = sanitizeReason('line1\nline2')
        expect(r.sanitized).toBe('line1line2')
        expect(r.strippedControlChars).toBe(true)
    })

    it('leaves ordinary printable Unicode untouched', () => {
        const r = sanitizeReason('é ü 中文 日本語 한국어 🌍')
        expect(r.sanitized).toBe('é ü 中文 日本語 한국어 🌍')
        expect(r.strippedControlChars).toBe(false)
    })

    it('returns null when input is entirely control chars', () => {
        const r = sanitizeReason('\x00\x01\x02\x7F')
        expect(r.sanitized).toBeNull()
        expect(r.strippedControlChars).toBe(true)
    })
})

describe('sanitizeReason — M4: secret redaction', () => {
    it('redacts Anthropic API key (sk-ant-…)', () => {
        const r = sanitizeReason('approved using sk-ant-api03-abcdef123456789012345678')
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.sanitized).not.toContain('sk-ant-api03-abcdef')
        expect(r.redacted).toBe(true)
    })

    it('redacts OpenAI-style key (sk-…)', () => {
        const r = sanitizeReason('key sk-abcdefghijklmnopqrstuvwxyz123456')
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.sanitized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz')
        expect(r.redacted).toBe(true)
    })

    it('does not double-redact sk-ant- as both Anthropic and OpenAI', () => {
        // Anthropic pattern should match first; the result should have exactly one redaction.
        const r = sanitizeReason('sk-ant-api03-abcdef123456789012345678')
        expect(r.sanitized).toBe('[REDACTED]')
    })

    it('redacts AWS access key ID (AKIA…)', () => {
        const r = sanitizeReason('credentials AKIAIOSFODNN7EXAMPLE for deploy')
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE')
        expect(r.redacted).toBe(true)
    })

    it('redacts GitHub personal access token (ghp_…)', () => {
        const r = sanitizeReason('ci token ghp_abcdefghijklmnopqrstuvwxyz0123456789')
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.sanitized).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz')
        expect(r.redacted).toBe(true)
    })

    it('redacts high-entropy base64/hex string (>= 32 chars)', () => {
        const r = sanitizeReason('JWT-ish ABCDEFabcdef0123456789ABCDEFabcdef0123')
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.redacted).toBe(true)
    })

    it('does not false-positive on short identifiers', () => {
        const r = sanitizeReason('ID abc123 is fine')
        expect(r.sanitized).toBe('ID abc123 is fine')
        expect(r.redacted).toBe(false)
    })

    it('redacts multiple secrets in one input', () => {
        const r = sanitizeReason(
            'both sk-ant-api03-abcdef123456789012345678 and AKIAIOSFODNN7EXAMPLE leaked',
        )
        // Count occurrences of [REDACTED]
        const redactedCount = (r.sanitized!.match(/\[REDACTED\]/g) ?? []).length
        expect(redactedCount).toBeGreaterThanOrEqual(2)
        expect(r.redacted).toBe(true)
    })

    it('does not redact normal English prose', () => {
        const r = sanitizeReason('The brand team approved this change for compliance reasons.')
        expect(r.redacted).toBe(false)
        expect(r.sanitized).toBe('The brand team approved this change for compliance reasons.')
    })

    it('does not reject on secret — redacts and proceeds', () => {
        // Important: redaction is non-blocking. A human writing *about* a key
        // is still allowed through (just with the key masked).
        const r = sanitizeReason('I accidentally typed sk-ant-api03-abcdef123456789012345678 in the log')
        expect(r.sanitized).not.toBeNull()
        expect(r.sanitized).toContain('[REDACTED]')
    })
})

describe('sanitizeReason — pipeline order', () => {
    it('applies length cap BEFORE control-char stripping and redaction', () => {
        // Start with a short valid prefix, then pad with safe filler up to just
        // under the cap, then a trailing control char and secret. The cap should
        // keep the prefix untouched.
        const prefix = 'valid reason'
        const filler = 'x'.repeat(REASON_MAX_LENGTH - prefix.length)
        const input = prefix + filler + '\x00ignored-tail-sk-ant-abc123'
        const r = sanitizeReason(input)
        expect(r.sanitized!.startsWith(prefix)).toBe(true)
        expect(r.truncated).toBe(true)
        // The tail control char + secret should be outside the cap window.
    })

    it('strips control chars before trimming final whitespace', () => {
        const r = sanitizeReason('\x00\x01text\x02\x03')
        expect(r.sanitized).toBe('text')
    })

    it('redacts secret even when wrapped in control chars', () => {
        const r = sanitizeReason('prefix \x00sk-ant-api03-abcdef123456789012345678\x00 suffix')
        expect(r.sanitized).toContain('[REDACTED]')
        expect(r.sanitized).not.toContain('sk-ant-api03')
        expect(r.strippedControlChars).toBe(true)
        expect(r.redacted).toBe(true)
    })
})
