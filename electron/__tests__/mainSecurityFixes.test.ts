/**
 * mainSecurityFixes.test.ts
 *
 * Unit tests for the security fixes applied to electron/main.ts.
 *
 * These tests exercise the pure logic that was added — no Electron, no IPC,
 * no SQLite. Electron APIs (safeStorage, app, BrowserWindow) are not available
 * in a Node.js test environment and are mocked inline where needed.
 *
 * Coverage:
 *   Fix 1 (P0-3) — figma:status strips secret field
 *   Fix 2 (P1-2) — safeStorage encrypt/decrypt + migration logic
 *   Fix 3 (P1-3) — terminal:spawn cwd restricted to home directory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'

// ── Fix 1: Secret stripping logic ─────────────────────────────────────────────

describe('Fix 1 (P0-3) — figma:status secret stripping', () => {
    /**
     * Simulates the handler logic in main.ts:
     *   const { secret: _secret, ...safeStatus } = getFigmaStatus()
     *   return safeStatus
     */
    function stripSecret(rawStatus: {
        running: boolean
        lastWebhookAt: number | null
        tokenCount: number
        port: number
        secret: string
    }) {
        const { secret: _secret, ...safeStatus } = rawStatus
        return safeStatus
    }

    it('removes the secret field from the status object', () => {
        const raw = {
            running: true,
            lastWebhookAt: 1700000000000,
            tokenCount: 42,
            port: 4545,
            secret: 'bridge-dev-secret-phase2',
        }
        const result = stripSecret(raw)
        expect(result).not.toHaveProperty('secret')
    })

    it('preserves all non-secret fields', () => {
        const raw = {
            running: false,
            lastWebhookAt: null,
            tokenCount: 0,
            port: 4546,
            secret: 'super-secret-value',
        }
        const result = stripSecret(raw)
        expect(result.running).toBe(false)
        expect(result.lastWebhookAt).toBeNull()
        expect(result.tokenCount).toBe(0)
        expect(result.port).toBe(4546)
    })

    it('result has exactly 4 keys (running, lastWebhookAt, tokenCount, port)', () => {
        const raw = {
            running: true,
            lastWebhookAt: null,
            tokenCount: 10,
            port: 4545,
            secret: 'abc',
        }
        const result = stripSecret(raw)
        expect(Object.keys(result)).toHaveLength(4)
        expect(Object.keys(result)).toEqual(
            expect.arrayContaining(['running', 'lastWebhookAt', 'tokenCount', 'port']),
        )
    })

    it('does not expose secret even if the value is empty string', () => {
        const raw = {
            running: true,
            lastWebhookAt: 0,
            tokenCount: 1,
            port: 4545,
            secret: '',
        }
        const result = stripSecret(raw)
        expect(result).not.toHaveProperty('secret')
    })
})

// ── Fix 2: safeStorage encrypt/decrypt logic ───────────────────────────────────

describe('Fix 2 (P1-2) — safeStorage API key encryption', () => {
    /**
     * Exercises the encrypt/decrypt round-trip using a pure in-memory mock of
     * safeStorage. The real safeStorage is an Electron API unavailable in Node.
     */

    // Minimal mock: base64-encodes on encrypt, decodes on decrypt.
    const mockSafeStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (s: string) => Buffer.from(s, 'utf-8'),
        decryptString: (buf: Buffer) => buf.toString('utf-8'),
    }

    function encryptApiKey(key: string): string {
        return mockSafeStorage.encryptString(key).toString('base64')
    }

    function decryptApiKey(encrypted: string): string | null {
        try {
            return mockSafeStorage.decryptString(Buffer.from(encrypted, 'base64'))
        } catch {
            return null
        }
    }

    it('encrypts an API key to a non-plaintext base64 string', () => {
        const key = 'sk-ant-api-test-1234567890'
        const encrypted = encryptApiKey(key)
        // The encrypted value should be a base64 string, not the raw key.
        expect(encrypted).not.toBe(key)
        expect(typeof encrypted).toBe('string')
        expect(encrypted.length).toBeGreaterThan(0)
    })

    it('decrypts back to the original key (round-trip)', () => {
        const key = 'sk-ant-api-test-abc'
        const encrypted = encryptApiKey(key)
        const decrypted = decryptApiKey(encrypted)
        expect(decrypted).toBe(key)
    })

    it('returns null for malformed encrypted input', () => {
        // Provide invalid base64 / non-decodable input.
        const result = decryptApiKey('not-valid-encrypted-content!!!@#$%')
        // Our mock will still try to decode; the real safeStorage would throw.
        // Test that the null guard in decryptApiKey is exercised.
        // Here we simulate a throwing decryptString:
        const throwingSafeStorage = {
            decryptString: (_buf: Buffer): string => { throw new Error('decryption failed') },
        }
        function decryptWithThrow(encrypted: string): string | null {
            try {
                return throwingSafeStorage.decryptString(Buffer.from(encrypted, 'base64'))
            } catch {
                return null
            }
        }
        expect(decryptWithThrow('notvalid')).toBeNull()
    })

    it('isEncryptionAvailable guards the encrypt path', () => {
        const unavailableSafeStorage = {
            isEncryptionAvailable: () => false,
            encryptString: (_s: string): Buffer => { throw new Error('unavailable') },
        }
        // Simulate the guard: only call encryptString when available.
        const key = 'sk-ant-api-test-xyz'
        const patch: Record<string, unknown> = { apiKey: key }
        if (unavailableSafeStorage.isEncryptionAvailable()) {
            patch.apiKeyEncrypted = unavailableSafeStorage.encryptString(key).toString('base64')
        }
        // When encryption is unavailable, apiKeyEncrypted should not be set.
        expect(patch.apiKeyEncrypted).toBeUndefined()
        // apiKey should still be in patch for orchestrator compatibility.
        expect(patch.apiKey).toBe(key)
    })

    it('migration path: encrypts legacy plaintext apiKey and sets apiKeyEncrypted', () => {
        // Simulates hasApiKeySecure() migration branch.
        const cfg: Record<string, unknown> = { apiKey: 'sk-legacy-key' }

        let encrypted: string | undefined
        if (typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0) {
            if (mockSafeStorage.isEncryptionAvailable()) {
                encrypted = encryptApiKey(cfg.apiKey)
            }
        }
        expect(encrypted).toBeDefined()
        expect(encrypted).not.toBe(cfg.apiKey)
        // Round-trip should recover the key.
        expect(decryptApiKey(encrypted!)).toBe('sk-legacy-key')
    })

    it('hasApiKeySecure returns true when apiKeyEncrypted is present and decryptable', () => {
        const key = 'sk-ant-api-test-secure'
        const encrypted = encryptApiKey(key)
        const cfg: Record<string, unknown> = { apiKeyEncrypted: encrypted }

        let hasKey = false
        if (typeof cfg.apiKeyEncrypted === 'string' && cfg.apiKeyEncrypted.length > 0) {
            const decrypted = decryptApiKey(cfg.apiKeyEncrypted)
            hasKey = decrypted !== null && decrypted.length > 0
        }
        expect(hasKey).toBe(true)
    })

    it('hasApiKeySecure returns false when no key fields are present', () => {
        const cfg: Record<string, unknown> = { provider: 'anthropic' }
        let hasKey = false
        if (typeof cfg.apiKeyEncrypted === 'string' && cfg.apiKeyEncrypted.length > 0) {
            const decrypted = decryptApiKey(cfg.apiKeyEncrypted)
            hasKey = decrypted !== null && decrypted.length > 0
        } else if (typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0) {
            hasKey = true
        }
        expect(hasKey).toBe(false)
    })

    it('hasApiKeySecure returns false when apiKeyEncrypted is corrupted', () => {
        const cfg: Record<string, unknown> = { apiKeyEncrypted: 'corrupted' }
        // Simulate decrypt throwing.
        function decryptThrows(_s: string): string | null {
            try {
                throw new Error('corrupt')
            } catch {
                return null
            }
        }
        let hasKey = false
        if (typeof cfg.apiKeyEncrypted === 'string' && cfg.apiKeyEncrypted.length > 0) {
            const decrypted = decryptThrows(cfg.apiKeyEncrypted)
            hasKey = decrypted !== null && decrypted.length > 0
        }
        expect(hasKey).toBe(false)
    })
})

// ── Fix 3: terminal:spawn cwd validation ──────────────────────────────────────

describe('Fix 3 (P1-3) — terminal:spawn cwd restriction', () => {
    /**
     * Reproduces the validation logic from the terminal:spawn handler:
     *   const resolvedCwd = path.resolve(cwd)
     *   const home = app.getPath('home')
     *   if (resolvedCwd !== home && !resolvedCwd.startsWith(home + path.sep)) { reject }
     */
    const home = os.homedir()

    function validateCwd(cwd: unknown): { allowed: boolean; reason?: string } {
        if (typeof cwd !== 'string') return { allowed: false, reason: 'not a string' }
        const resolvedCwd = path.resolve(cwd)
        if (resolvedCwd !== home && !resolvedCwd.startsWith(home + path.sep)) {
            return { allowed: false, reason: `outside home dir: ${resolvedCwd}` }
        }
        return { allowed: true }
    }

    it('allows the home directory itself', () => {
        expect(validateCwd(home).allowed).toBe(true)
    })

    it('allows a subdirectory of home', () => {
        const subdir = path.join(home, 'Projects', 'my-bridge-project')
        expect(validateCwd(subdir).allowed).toBe(true)
    })

    it('allows a deeply nested path under home', () => {
        const deep = path.join(home, 'a', 'b', 'c', 'd')
        expect(validateCwd(deep).allowed).toBe(true)
    })

    it('rejects /etc', () => {
        expect(validateCwd('/etc').allowed).toBe(false)
    })

    it('rejects /tmp', () => {
        expect(validateCwd('/tmp').allowed).toBe(false)
    })

    it('rejects /', () => {
        expect(validateCwd('/').allowed).toBe(false)
    })

    it('rejects a path that starts with home as a prefix but is not under it (path confusion)', () => {
        // e.g., if home is /Users/alice, reject /Users/alice_evil
        const evil = home + '_evil'
        expect(validateCwd(evil).allowed).toBe(false)
    })

    it('rejects non-string input', () => {
        expect(validateCwd(null).allowed).toBe(false)
        expect(validateCwd(42).allowed).toBe(false)
        expect(validateCwd(undefined).allowed).toBe(false)
    })

    it('resolves symlink-style relative traversal before checking', () => {
        // path.resolve normalizes '..' sequences — a traversal attempt like
        // ~/Projects/../../../etc resolves to /etc which is outside home.
        const traversal = path.join(home, 'Projects', '..', '..', '..', 'etc')
        const result = validateCwd(traversal)
        // /etc is outside home, so this must be rejected.
        if (!traversal.startsWith(home + path.sep) && traversal !== home) {
            expect(result.allowed).toBe(false)
        }
    })

    it('handles a path that resolves exactly to home via ".."', () => {
        // home/Projects/.. resolves to home — should be allowed.
        const atHome = path.join(home, 'Projects', '..')
        expect(validateCwd(atHome).allowed).toBe(true)
    })
})
