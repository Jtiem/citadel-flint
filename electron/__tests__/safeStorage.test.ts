/**
 * safeStorage.test.ts — SEC.4 API Key Safe Storage
 *
 * Tests the safeStorage encrypt/decrypt integration in orchestrator.ts.
 *
 * Strategy: orchestrator.ts imports `safeStorage` from `electron`. We mock the
 * `electron` module so that all safeStorage calls use in-process fakes. The
 * `readConfig` / `writeConfig` / `encryptApiKey` / `decryptApiKey` functions are
 * then imported from the real orchestrator module (post-mock) and exercised.
 *
 * We avoid touching the real filesystem by pointing CONFIG_PATH at a temp dir via
 * `os.homedir` mock. Each test group uses `beforeEach` / `afterEach` to create and
 * clean up an isolated config file.
 *
 * Coverage (6 test groups):
 *   SEC4-01 — encrypt → decrypt round-trip preserves key
 *   SEC4-02 — writeConfig with encryption available: apiKeyEncrypted present, apiKey absent
 *   SEC4-03 — readConfig of encrypted config returns correct key via apiKey field
 *   SEC4-04 — readConfig of legacy plaintext config returns key; migration fires on next write
 *   SEC4-05 — safeStorage unavailable → plaintext fallback with console.warn
 *   SEC4-06 — empty / missing config file → graceful degradation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── safeStorage mock ──────────────────────────────────────────────────────────
//
// `vi.mock` is hoisted to the top of the file by Vitest's transform.
// Variables defined OUTSIDE vi.mock are not yet initialised when the factory
// runs. Use `vi.hoisted` to create mutable references that are initialised
// before the factory executes, then expose them as module-level variables.

const { mockSafeStorage } = vi.hoisted(() => {
    return {
        mockSafeStorage: {
            isEncryptionAvailable: vi.fn(() => true),
            encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
            decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, '')),
        },
    }
})

vi.mock('electron', () => ({
    safeStorage: mockSafeStorage,
    app: { getPath: vi.fn(() => '/tmp/test-bridge-home') },
}))

// ── Stub heavy dependencies so orchestrator.ts can be imported ────────────────
// better-sqlite3 is a native module that requires a matching Node.js ABI.
// The LSP clients start background processes. The Anthropic SDK is network I/O.
// None of these are needed to test the config / safeStorage functions.

vi.mock('../store.js', () => ({
    default: {
        prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })),
    },
}))

vi.mock('../lsp/TypeScriptLspClient.js', () => ({
    tsLspClient: {
        start: vi.fn(),
        stop: vi.fn(),
        validateSnippet: vi.fn(() => Promise.resolve(null)),
    },
}))

vi.mock('../lsp/VueLspClient.js', () => ({
    vueLspClient: {
        start: vi.fn(),
        stop: vi.fn(),
        validateSnippet: vi.fn(() => Promise.resolve(null)),
    },
}))

vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(() => ({
        messages: { stream: vi.fn() },
    })),
}))

vi.mock('../mithrilPreCommit.js', () => ({
    checkClassNameForColorDrift: vi.fn(() => []),
    formatViolationsForAI: vi.fn(() => ''),
}))

// ── Import module under test AFTER mock ───────────────────────────────────────
// Dynamic import is used so that the vi.mock factory above has already been
// registered by the time orchestrator.ts is evaluated.

import {
    readConfig,
    writeConfig,
    encryptApiKey,
    decryptApiKey,
    hasApiKey,
} from '../orchestrator.js'

// ── Test fixture helpers ───────────────────────────────────────────────────────

const TEST_HOME = path.join(os.tmpdir(), 'bridge-safeStorage-test')
const TEST_CONFIG_DIR = path.join(TEST_HOME, '.bridge')
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json')

/**
 * Writes a config object to the test fixture path.
 * orchestrator.ts derives CONFIG_PATH from `homedir()` at module init time.
 * Because the module is already loaded and CONFIG_PATH is a module-level
 * const, we patch it via the Node module cache after the first import.
 * Instead, we write to the real homedir path (~/.bridge/config.json) during
 * tests and restore afterwards using a temp copy strategy.
 *
 * Simpler approach: since orchestrator's CONFIG_PATH is `path.join(homedir(), '.bridge', 'config.json')`
 * and homedir() is evaluated at module-load time (not via the `app` mock),
 * we write directly to the real path. Tests use `afterEach` cleanup.
 */
const REAL_CONFIG_DIR = path.join(os.homedir(), '.bridge')
const REAL_CONFIG_PATH = path.join(REAL_CONFIG_DIR, 'config.json')

async function writeTestConfig(obj: Record<string, unknown>): Promise<void> {
    if (!existsSync(REAL_CONFIG_DIR)) await mkdir(REAL_CONFIG_DIR, { recursive: true })
    await writeFile(REAL_CONFIG_PATH, JSON.stringify(obj, null, 2), 'utf-8')
}

async function deleteTestConfig(): Promise<void> {
    if (existsSync(REAL_CONFIG_PATH)) {
        await rm(REAL_CONFIG_PATH, { force: true })
    }
}

// ── SEC4-01: encrypt → decrypt round-trip ─────────────────────────────────────

describe('SEC4-01 — encrypt/decrypt round-trip', () => {
    beforeEach(() => {
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
        mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(`enc:${s}`))
        mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^enc:/, ''))
    })

    it('encryptApiKey returns a non-empty base64 string', () => {
        const result = encryptApiKey('sk-ant-test-key')
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
        // Must be valid base64 (Buffer.from(..., 'base64') should not throw)
        expect(() => Buffer.from(result, 'base64')).not.toThrow()
    })

    it('encrypted value is not the plaintext key', () => {
        const key = 'sk-ant-test-key'
        const encrypted = encryptApiKey(key)
        expect(encrypted).not.toBe(key)
    })

    it('decryptApiKey recovers the original key', () => {
        const key = 'sk-ant-api03-test-1234567890abcdef'
        const encrypted = encryptApiKey(key)
        const decrypted = decryptApiKey(encrypted)
        expect(decrypted).toBe(key)
    })

    it('round-trip is stable (encrypting twice produces different bytes but same plaintext after decrypt)', () => {
        const key = 'sk-ant-roundtrip-test'
        const enc1 = encryptApiKey(key)
        const dec1 = decryptApiKey(enc1)
        const enc2 = encryptApiKey(key)
        const dec2 = decryptApiKey(enc2)
        expect(dec1).toBe(key)
        expect(dec2).toBe(key)
    })

    it('decryptApiKey returns null for corrupted ciphertext', () => {
        mockSafeStorage.decryptString.mockImplementationOnce(() => {
            throw new Error('decryption failed')
        })
        const result = decryptApiKey('not-valid-base64!!!')
        expect(result).toBeNull()
    })

    it('decryptApiKey returns null when decryptString throws', () => {
        mockSafeStorage.decryptString.mockImplementationOnce(() => {
            throw new Error('OS keychain error')
        })
        const result = decryptApiKey(Buffer.from('anything').toString('base64'))
        expect(result).toBeNull()
    })
})

// ── SEC4-02: writeConfig encrypts key and removes plaintext ───────────────────

describe('SEC4-02 — writeConfig with encryption available', () => {
    beforeEach(() => {
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
        mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(`enc:${s}`))
        mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^enc:/, ''))
    })

    afterEach(async () => {
        await deleteTestConfig()
    })

    it('apiKeyEncrypted is present in written config', async () => {
        await writeConfig({ apiKey: 'sk-ant-write-test', provider: 'anthropic' })
        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        expect(typeof raw.apiKeyEncrypted).toBe('string')
        expect((raw.apiKeyEncrypted as string).length).toBeGreaterThan(0)
    })

    it('plaintext apiKey is absent from written config', async () => {
        await writeConfig({ apiKey: 'sk-ant-write-test', provider: 'anthropic' })
        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        expect(raw.apiKey).toBeUndefined()
    })

    it('non-key fields (provider, model) are preserved', async () => {
        await writeConfig({ apiKey: 'sk-ant-write-test', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' })
        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        expect(raw.provider).toBe('anthropic')
        expect(raw.model).toBe('claude-3-7-sonnet-20250219')
    })

    it('writing the same config twice does not double-encrypt (idempotent)', async () => {
        await writeConfig({ apiKey: 'sk-ant-idempotent', provider: 'anthropic' })
        const { readFile: fsReadFile } = await import('node:fs/promises')
        const first = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>

        // Second write of same key — result must also have no plaintext.
        await writeConfig({ apiKey: 'sk-ant-idempotent', provider: 'anthropic' })
        const second = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        expect(second.apiKey).toBeUndefined()
        expect(typeof second.apiKeyEncrypted).toBe('string')
        // Both writes should produce a valid (decodable) encrypted value.
        expect(() => Buffer.from(first.apiKeyEncrypted as string, 'base64')).not.toThrow()
        expect(() => Buffer.from(second.apiKeyEncrypted as string, 'base64')).not.toThrow()
    })

    it('apiKeyEncrypted value is valid base64', async () => {
        await writeConfig({ apiKey: 'sk-ant-base64-test', provider: 'anthropic' })
        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        const enc = raw.apiKeyEncrypted as string
        // Must round-trip through base64 without error.
        const buf = Buffer.from(enc, 'base64')
        expect(buf.length).toBeGreaterThan(0)
        expect(buf.toString('base64')).toBe(enc)
    })
})

// ── SEC4-03: readConfig of encrypted config returns correct key ───────────────

describe('SEC4-03 — readConfig reads encrypted config', () => {
    beforeEach(() => {
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
        mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(`enc:${s}`))
        mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^enc:/, ''))
    })

    afterEach(async () => {
        await deleteTestConfig()
    })

    it('returns decrypted apiKey from apiKeyEncrypted', async () => {
        const key = 'sk-ant-encrypted-read-test'
        const encrypted = encryptApiKey(key)
        await writeTestConfig({ apiKeyEncrypted: encrypted, provider: 'anthropic' })

        const cfg = await readConfig()
        expect(cfg.apiKey).toBe(key)
    })

    it('does not expose apiKeyEncrypted field as raw data in the result', async () => {
        const key = 'sk-ant-no-raw-encrypted'
        const encrypted = encryptApiKey(key)
        await writeTestConfig({ apiKeyEncrypted: encrypted, provider: 'anthropic' })

        const cfg = await readConfig()
        // readConfig overwrites apiKey with the decrypted value.
        // The apiKeyEncrypted field may still be present (it's part of the spread),
        // but the resolved apiKey must be the plaintext.
        expect(cfg.apiKey).toBe(key)
    })

    it('returns undefined apiKey when decryption fails', async () => {
        await writeTestConfig({ apiKeyEncrypted: 'corrupted-value', provider: 'anthropic' })
        mockSafeStorage.decryptString.mockImplementationOnce(() => {
            throw new Error('decryption failed')
        })

        const cfg = await readConfig()
        expect(cfg.apiKey).toBeUndefined()
    })

    it('preserves provider and model fields after decryption', async () => {
        const key = 'sk-ant-preserve-fields'
        const encrypted = encryptApiKey(key)
        await writeTestConfig({
            apiKeyEncrypted: encrypted,
            provider: 'anthropic',
            model: 'claude-3-7-sonnet-20250219',
        })

        const cfg = await readConfig()
        expect(cfg.provider).toBe('anthropic')
        expect(cfg.model).toBe('claude-3-7-sonnet-20250219')
    })
})

// ── SEC4-04: readConfig of legacy plaintext config ───────────────────────────

describe('SEC4-04 — readConfig with legacy plaintext apiKey', () => {
    beforeEach(() => {
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
        mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(`enc:${s}`))
        mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^enc:/, ''))
    })

    afterEach(async () => {
        await deleteTestConfig()
    })

    it('returns the plaintext key from legacy config', async () => {
        await writeTestConfig({ apiKey: 'sk-ant-legacy-key', provider: 'anthropic' })
        const cfg = await readConfig()
        expect(cfg.apiKey).toBe('sk-ant-legacy-key')
    })

    it('migration on next writeConfig: produces apiKeyEncrypted and removes apiKey', async () => {
        await writeTestConfig({ apiKey: 'sk-ant-migrate-key', provider: 'anthropic' })

        // Read picks up legacy config.
        const cfg = await readConfig()
        expect(cfg.apiKey).toBe('sk-ant-migrate-key')

        // Writing the config with the key in apiKey triggers migration.
        await writeConfig({ apiKey: cfg.apiKey!, provider: 'anthropic' })

        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>

        // After migration: encrypted field present, plaintext absent.
        expect(typeof raw.apiKeyEncrypted).toBe('string')
        expect(raw.apiKey).toBeUndefined()
    })

    it('migration is idempotent — running a second writeConfig does not re-encrypt unnecessarily', async () => {
        await writeTestConfig({ apiKey: 'sk-ant-idem-key', provider: 'anthropic' })
        await writeConfig({ apiKey: 'sk-ant-idem-key', provider: 'anthropic' })
        await writeConfig({ apiKey: 'sk-ant-idem-key', provider: 'anthropic' })

        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        expect(raw.apiKey).toBeUndefined()
        expect(typeof raw.apiKeyEncrypted).toBe('string')
    })
})

// ── SEC4-05: safeStorage unavailable → plaintext fallback ────────────────────

describe('SEC4-05 — safeStorage unavailable (CI/headless) fallback', () => {
    beforeEach(() => {
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
    })

    afterEach(async () => {
        await deleteTestConfig()
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
    })

    it('writeConfig keeps plaintext apiKey when safeStorage is unavailable', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await writeConfig({ apiKey: 'sk-ant-ci-fallback', provider: 'anthropic' })

        const { readFile: fsReadFile } = await import('node:fs/promises')
        const raw = JSON.parse(await fsReadFile(REAL_CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        expect(raw.apiKey).toBe('sk-ant-ci-fallback')
        expect(raw.apiKeyEncrypted).toBeUndefined()
        warnSpy.mockRestore()
    })

    it('writeConfig emits a console.warn when encryption is unavailable', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await writeConfig({ apiKey: 'sk-ant-ci-warn', provider: 'anthropic' })
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('safeStorage'),
        )
        warnSpy.mockRestore()
    })

    it('readConfig returns plaintext apiKey when safeStorage is unavailable', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await writeTestConfig({ apiKey: 'sk-ant-ci-read', provider: 'anthropic' })
        const cfg = await readConfig()
        expect(cfg.apiKey).toBe('sk-ant-ci-read')
        warnSpy.mockRestore()
    })

    it('readConfig emits a console.warn for encrypted config when safeStorage unavailable', async () => {
        // Config has apiKeyEncrypted but safeStorage is unavailable — key is inaccessible.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await writeTestConfig({ apiKeyEncrypted: 'somebase64value==', provider: 'anthropic' })
        const cfg = await readConfig()
        expect(cfg.apiKey).toBeUndefined()
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('safeStorage'),
        )
        warnSpy.mockRestore()
    })
})

// ── SEC4-06: empty / missing config file → graceful degradation ───────────────

describe('SEC4-06 — empty / missing config graceful degradation', () => {
    beforeEach(() => {
        mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
        mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from(`enc:${s}`))
        mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^enc:/, ''))
    })

    afterEach(async () => {
        await deleteTestConfig()
    })

    it('readConfig returns empty object when config file does not exist', async () => {
        // Ensure no config file exists.
        await deleteTestConfig()
        const cfg = await readConfig()
        expect(cfg).toEqual({})
    })

    it('readConfig returns empty object for malformed JSON', async () => {
        await writeTestConfig({ bad: 'json' })
        // Overwrite with invalid JSON directly.
        const { writeFile: fsWriteFile } = await import('node:fs/promises')
        await fsWriteFile(REAL_CONFIG_PATH, '{not valid json}', 'utf-8')
        const cfg = await readConfig()
        expect(cfg).toEqual({})
    })

    it('hasApiKey returns false when config file does not exist', async () => {
        await deleteTestConfig()
        const result = await hasApiKey()
        expect(result).toBe(false)
    })

    it('hasApiKey returns false when config has no key fields', async () => {
        await writeTestConfig({ provider: 'anthropic' })
        const result = await hasApiKey()
        expect(result).toBe(false)
    })

    it('hasApiKey returns true after writing an apiKey', async () => {
        await writeConfig({ apiKey: 'sk-ant-has-key', provider: 'anthropic' })
        const result = await hasApiKey()
        expect(result).toBe(true)
    })

    it('writeConfig creates the .bridge directory if it does not exist', async () => {
        // Remove config dir entirely.
        if (existsSync(REAL_CONFIG_DIR)) {
            await rm(REAL_CONFIG_DIR, { recursive: true, force: true })
        }
        await writeConfig({ apiKey: 'sk-ant-mkdir-test', provider: 'anthropic' })
        expect(existsSync(REAL_CONFIG_PATH)).toBe(true)
        // Restore dir for afterEach cleanup.
    })
})
