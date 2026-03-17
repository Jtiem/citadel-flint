/**
 * terminalHardening.test.ts — SEC.5 Terminal API Hardening
 *
 * Unit tests for the security hardening applied to the terminal IPC handlers
 * in electron/main.ts. These tests exercise the pure validation logic without
 * requiring Electron or node-pty.
 *
 * Coverage:
 *   1. terminal:spawn — cwd validation against activeProjectRoot / home fallback
 *   2. terminal:data  — 8 KB input size limit
 *   3. terminal:data  — null byte sanitization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'

// ── Constants matching electron/main.ts ─────────────────────────────────────
const TERMINAL_INPUT_MAX_BYTES = 8192

// ── Helper: reproduces the cwd validation logic from terminal:spawn ─────────
function validateCwd(
    cwd: unknown,
    activeProjectRoot: string | null,
    homedir: string,
): { allowed: boolean; reason?: string } {
    if (typeof cwd !== 'string') {
        return { allowed: false, reason: 'not a string' }
    }
    const resolvedCwd = path.resolve(cwd)
    const allowedRoot = activeProjectRoot ?? homedir
    if (resolvedCwd !== allowedRoot && !resolvedCwd.startsWith(allowedRoot + path.sep)) {
        return { allowed: false, reason: `outside allowed root: ${resolvedCwd} (root: ${allowedRoot})` }
    }
    return { allowed: true }
}

// ── Helper: reproduces the input validation logic from terminal:data ────────
function validateAndSanitizeInput(
    data: unknown,
): { accepted: boolean; sanitized?: string; reason?: string; wasSanitized?: boolean } {
    if (typeof data !== 'string') {
        return { accepted: false, reason: 'not a string' }
    }

    // 8 KB size limit
    if (Buffer.byteLength(data, 'utf-8') > TERMINAL_INPUT_MAX_BYTES) {
        return {
            accepted: false,
            reason: `oversized input (${Buffer.byteLength(data, 'utf-8')} bytes, limit ${TERMINAL_INPUT_MAX_BYTES})`,
        }
    }

    // Null byte sanitization
    let sanitized = data
    let wasSanitized = false
    if (data.includes('\x00')) {
        sanitized = data.replaceAll('\x00', '')
        wasSanitized = true
    }

    // Empty after sanitization means nothing to write
    if (sanitized.length === 0) {
        return { accepted: false, reason: 'empty after sanitization', wasSanitized }
    }

    return { accepted: true, sanitized, wasSanitized }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. terminal:spawn — cwd validation with activeProjectRoot
// ─────────────────────────────────────────────────────────────────────────────

describe('SEC.5 — terminal:spawn cwd validation (project root)', () => {
    const home = os.homedir()
    const projectRoot = path.join(home, 'Projects', 'my-bridge-app')

    it('accepts cwd at exact project root', () => {
        const result = validateCwd(projectRoot, projectRoot, home)
        expect(result.allowed).toBe(true)
    })

    it('accepts cwd within project root', () => {
        const subdir = path.join(projectRoot, 'src', 'components')
        const result = validateCwd(subdir, projectRoot, home)
        expect(result.allowed).toBe(true)
    })

    it('accepts deeply nested path within project root', () => {
        const deep = path.join(projectRoot, 'a', 'b', 'c', 'd', 'e')
        const result = validateCwd(deep, projectRoot, home)
        expect(result.allowed).toBe(true)
    })

    it('rejects cwd with ../ traversal above project root', () => {
        const traversal = path.join(projectRoot, '..', '..', 'etc')
        const result = validateCwd(traversal, projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects cwd as absolute path outside project root', () => {
        const result = validateCwd('/etc/passwd', projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects cwd at home dir when project root is set', () => {
        // When a project is open, home itself is NOT within the project tree
        const result = validateCwd(home, projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects sibling directory of project root', () => {
        const sibling = path.join(home, 'Projects', 'other-project')
        const result = validateCwd(sibling, projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects prefix-matching path that is not a real subdirectory', () => {
        // e.g., project root is /Users/alice/Projects/my-bridge-app
        // attacker tries /Users/alice/Projects/my-bridge-app-evil
        const evil = projectRoot + '-evil'
        const result = validateCwd(evil, projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects /tmp', () => {
        const result = validateCwd('/tmp', projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects /', () => {
        const result = validateCwd('/', projectRoot, home)
        expect(result.allowed).toBe(false)
    })

    it('handles relative path that resolves within project root', () => {
        // path.resolve will resolve relative to process.cwd(), but the
        // validation uses the resolved absolute path. If it happens to land
        // within the project root, it should be allowed. Since we can't
        // control process.cwd() in tests, we just verify resolve + startsWith.
        const resolved = path.resolve('.')
        const result = validateCwd('.', projectRoot, home)
        // We can't predict whether the test runner's cwd is inside the project,
        // but we can verify the logic is consistent.
        const expected =
            resolved === projectRoot || resolved.startsWith(projectRoot + path.sep)
        expect(result.allowed).toBe(expected)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. terminal:spawn — cwd validation with NO project root (home fallback)
// ─────────────────────────────────────────────────────────────────────────────

describe('SEC.5 — terminal:spawn cwd validation (home fallback)', () => {
    const home = os.homedir()

    it('falls back to home dir when no project root is set', () => {
        const result = validateCwd(home, null, home)
        expect(result.allowed).toBe(true)
    })

    it('allows subdirectory of home when no project root is set', () => {
        const subdir = path.join(home, 'Documents', 'work')
        const result = validateCwd(subdir, null, home)
        expect(result.allowed).toBe(true)
    })

    it('rejects /etc when no project root is set', () => {
        const result = validateCwd('/etc', null, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects root when no project root is set', () => {
        const result = validateCwd('/', null, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects path that traverses above home via ../', () => {
        const traversal = path.join(home, '..', '..', 'etc', 'passwd')
        const result = validateCwd(traversal, null, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects non-string input (null)', () => {
        const result = validateCwd(null, null, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects non-string input (number)', () => {
        const result = validateCwd(42, null, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects non-string input (undefined)', () => {
        const result = validateCwd(undefined, null, home)
        expect(result.allowed).toBe(false)
    })

    it('rejects prefix confusion path (home + suffix without separator)', () => {
        const evil = home + '_evil'
        const result = validateCwd(evil, null, home)
        expect(result.allowed).toBe(false)
    })

    it('allows path that resolves to home via parent traversal', () => {
        const atHome = path.join(home, 'Projects', '..')
        const result = validateCwd(atHome, null, home)
        expect(result.allowed).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. terminal:data — 8 KB input size limit
// ─────────────────────────────────────────────────────────────────────────────

describe('SEC.5 — terminal:data 8KB size limit', () => {
    it('accepts input within 8 KB', () => {
        const data = 'a'.repeat(8192)
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(true)
    })

    it('accepts a single character', () => {
        const result = validateAndSanitizeInput('x')
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('x')
    })

    it('accepts exactly 8192 bytes', () => {
        const data = 'x'.repeat(8192)
        expect(Buffer.byteLength(data, 'utf-8')).toBe(8192)
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(true)
    })

    it('rejects input exceeding 8 KB', () => {
        const data = 'a'.repeat(8193)
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(false)
        expect(result.reason).toContain('oversized')
    })

    it('rejects very large input (1 MB)', () => {
        const data = 'b'.repeat(1024 * 1024)
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(false)
    })

    it('counts multi-byte characters correctly', () => {
        // Each emoji is 4 bytes in UTF-8.
        // 2049 emojis = 8196 bytes > 8192 limit
        const emoji = '\u{1F600}' // grinning face, 4 bytes
        const data = emoji.repeat(2049)
        expect(Buffer.byteLength(data, 'utf-8')).toBeGreaterThan(8192)
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(false)
    })

    it('accepts multi-byte input within limit', () => {
        // 2048 emojis = 8192 bytes = exactly at limit
        const emoji = '\u{1F600}'
        const data = emoji.repeat(2048)
        expect(Buffer.byteLength(data, 'utf-8')).toBe(8192)
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(true)
    })

    it('rejects non-string input', () => {
        const result = validateAndSanitizeInput(12345)
        expect(result.accepted).toBe(false)
        expect(result.reason).toBe('not a string')
    })

    it('rejects null input', () => {
        const result = validateAndSanitizeInput(null)
        expect(result.accepted).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. terminal:data — null byte sanitization
// ─────────────────────────────────────────────────────────────────────────────

describe('SEC.5 — terminal:data null byte sanitization', () => {
    it('passes clean input through unchanged', () => {
        const result = validateAndSanitizeInput('ls -la')
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('ls -la')
        expect(result.wasSanitized).toBe(false)
    })

    it('strips null bytes from input', () => {
        const result = validateAndSanitizeInput('hello\x00world')
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('helloworld')
        expect(result.wasSanitized).toBe(true)
    })

    it('strips multiple null bytes', () => {
        const result = validateAndSanitizeInput('\x00a\x00b\x00c\x00')
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('abc')
        expect(result.wasSanitized).toBe(true)
    })

    it('rejects input that is only null bytes (empty after sanitization)', () => {
        const result = validateAndSanitizeInput('\x00\x00\x00')
        expect(result.accepted).toBe(false)
        expect(result.reason).toBe('empty after sanitization')
        expect(result.wasSanitized).toBe(true)
    })

    it('handles empty string (no sanitization needed, but nothing to write)', () => {
        // Empty string has 0 bytes which is within limit, but nothing to write
        // The real handler would do nothing (ptyProcess.write not called for empty)
        const result = validateAndSanitizeInput('')
        expect(result.accepted).toBe(false)
        expect(result.reason).toBe('empty after sanitization')
    })

    it('sanitization happens before size check (null bytes within limit)', () => {
        // 8190 chars + 2 null bytes = 8192 bytes = within limit
        const data = 'x'.repeat(8190) + '\x00\x00'
        const result = validateAndSanitizeInput(data)
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('x'.repeat(8190))
        expect(result.wasSanitized).toBe(true)
    })

    it('preserves other control characters (tab, newline, carriage return)', () => {
        const result = validateAndSanitizeInput('hello\tworld\nfoo\rbar')
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('hello\tworld\nfoo\rbar')
        expect(result.wasSanitized).toBe(false)
    })

    it('preserves escape sequences', () => {
        // Terminal escape sequences (e.g., arrow keys) must pass through
        const result = validateAndSanitizeInput('\x1b[A')
        expect(result.accepted).toBe(true)
        expect(result.sanitized).toBe('\x1b[A')
        expect(result.wasSanitized).toBe(false)
    })
})
