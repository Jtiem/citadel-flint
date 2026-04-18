/**
 * errorSanitizer.test.ts — Unit tests for MINT.5 Phase 2 Security WARN-2 fix.
 *
 * Covers:
 *   - Non-string / empty input → fallback
 *   - Allowlist-dump collapse (both sentinel patterns)
 *   - Trojan-Source / control-char strip
 *   - Secret redaction (Anthropic / GitHub / AWS / OpenAI / Bearer / high-entropy)
 *   - Length cap
 *   - Whitespace-only post-strip → fallback
 *   - Passthrough for clean short messages
 */

import { describe, it, expect } from 'vitest'
import { sanitizeError, ERROR_MESSAGE_MAX_LENGTH } from '../errorSanitizer'

describe('sanitizeError', () => {
    // ── Fallback paths ─────────────────────────────────────────────────────

    it('returns the fallback message for undefined input', () => {
        expect(sanitizeError(undefined)).toBe('Sync failed. Please try again.')
    })

    it('returns the fallback message for null input', () => {
        expect(sanitizeError(null)).toBe('Sync failed. Please try again.')
    })

    it('returns the fallback message for non-string input', () => {
        expect(sanitizeError(42)).toBe('Sync failed. Please try again.')
        expect(sanitizeError({})).toBe('Sync failed. Please try again.')
        expect(sanitizeError([])).toBe('Sync failed. Please try again.')
    })

    it('returns the fallback for empty string', () => {
        expect(sanitizeError('')).toBe('Sync failed. Please try again.')
    })

    it('returns the fallback for whitespace-only post-strip', () => {
        // Control chars only → strips to empty → trims to '' → fallback
        expect(sanitizeError('\u0000\u001b\u007f')).toBe('Sync failed. Please try again.')
    })

    // ── Allowlist dump collapse ────────────────────────────────────────────

    it('collapses the full mcp-policy allowlist dump to a human-safe message', () => {
        const raw =
            'mcp:call-tool — tool "flint_ast_mutate" is not in the renderer allowlist. ' +
            'Only these tools can be called from Glass: flint_status, flint_audit, flint_debt_report, flint_query_registry, flint_generate_dbom, flint_accessibility_report, flint_audit_report, flint_sync_pull, flint_sync_push, flint_resolve_all, flint_sync_check, flint_figma_connect'

        const out = sanitizeError(raw)
        expect(out).toBe(
            "This tool isn't available from the Glass UI. Run it from the host IDE (Claude Code, Cursor, or VS Code).",
        )
        // Must not contain the original tool-list dump
        expect(out).not.toContain('flint_ast_mutate')
        expect(out).not.toContain('flint_status')
        expect(out).not.toMatch(/not in the renderer allowlist/i)
    })

    it('collapses messages that contain only the "not in the renderer allowlist" sentinel', () => {
        const out = sanitizeError('Tool call failed: not in the renderer allowlist')
        expect(out).toMatch(/Glass UI/)
    })

    // ── Secret redaction ───────────────────────────────────────────────────

    it('redacts Anthropic API keys (sk-ant-...)', () => {
        const raw = 'Key rejected: sk-ant-abcdef0123456789abcdef-01'
        const out = sanitizeError(raw)
        expect(out).toContain('[REDACTED]')
        expect(out).not.toContain('sk-ant-abcdef')
    })

    it('redacts GitHub personal access tokens (ghp_...)', () => {
        const raw = 'Push failed with token ghp_abcdef0123456789abcdef0123456789ABCD'
        const out = sanitizeError(raw)
        expect(out).toContain('[REDACTED]')
        expect(out).not.toContain('ghp_abc')
    })

    it('redacts AWS access key IDs', () => {
        const raw = 'AWS auth error with AKIAIOSFODNN7EXAMPLE in config'
        const out = sanitizeError(raw)
        expect(out).toContain('[REDACTED]')
        expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE')
    })

    it('redacts OpenAI-style keys (sk-... not sk-ant-)', () => {
        const raw = 'OpenAI call failed: sk-abcdef0123456789abcdef01'
        const out = sanitizeError(raw)
        expect(out).toContain('[REDACTED]')
        expect(out).not.toContain('sk-abcdef')
    })

    it('redacts Bearer tokens', () => {
        const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
        const out = sanitizeError(raw)
        expect(out).toContain('[REDACTED]')
        expect(out).not.toContain('eyJhbGciOiJ')
    })

    it('redacts high-entropy base64-like tokens ≥ 32 chars', () => {
        const raw = 'Secret leak: AbCdEfGhIjKlMnOpQrSt0123456789aBcDeFgH in trace'
        const out = sanitizeError(raw)
        expect(out).toContain('[REDACTED]')
        expect(out).not.toContain('AbCdEfGhIjKl')
    })

    it('does not redact normal English words or short token-like strings', () => {
        const raw = 'Could not reach the governance engine.'
        const out = sanitizeError(raw)
        expect(out).toBe('Could not reach the governance engine.')
        expect(out).not.toContain('[REDACTED]')
    })

    // ── Control / format char strip (Trojan-Source) ────────────────────────

    it('strips bidi override characters that could spoof audit log display', () => {
        // U+202E = RIGHT-TO-LEFT OVERRIDE
        const raw = 'Network\u202Eerror'
        const out = sanitizeError(raw)
        expect(out).not.toContain('\u202E')
        expect(out).toBe('Networkerror')
    })

    it('strips zero-width characters', () => {
        const raw = 'Push\u200Bfailed'
        const out = sanitizeError(raw)
        expect(out).not.toContain('\u200B')
    })

    it('strips NUL bytes (prevent C-string truncation downstream)', () => {
        const raw = 'timeout\u0000 extra info'
        const out = sanitizeError(raw)
        expect(out).not.toContain('\u0000')
        expect(out).toContain('extra info')
    })

    // ── Length cap ─────────────────────────────────────────────────────────

    it('caps message length at ERROR_MESSAGE_MAX_LENGTH', () => {
        const raw = 'x'.repeat(ERROR_MESSAGE_MAX_LENGTH + 200)
        const out = sanitizeError(raw)
        expect(out.length).toBeLessThanOrEqual(ERROR_MESSAGE_MAX_LENGTH)
        expect(out.endsWith('\u2026')).toBe(true) // horizontal ellipsis
    })

    // ── Passthrough ────────────────────────────────────────────────────────

    it('passes short clean messages through unchanged', () => {
        const raw = 'Figma API rate limit exceeded'
        expect(sanitizeError(raw)).toBe(raw)
    })

    it('trims leading / trailing whitespace', () => {
        const raw = '  network timeout   '
        expect(sanitizeError(raw)).toBe('network timeout')
    })
})
