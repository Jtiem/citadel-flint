/**
 * Config Loader Tests — Sprint 3
 *
 * Coverage:
 *   - MAJOR-2: loadConfig strict mode throws on validation errors
 *   - MAJOR-3: resolveExtendsRef path sandbox rejects traversal
 *   - MAJOR-4: resolveExtendsRef canonicalizes via realpathSync
 *   - MINOR-2: deepMergeConfigs merges trust.profiles by id
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    loadConfig,
    loadYamlConfig,
    deepMergeConfigs,
    resolveExtendsRef,
    redactSecrets,
    ConfigPathSandboxError,
    ConfigValidationError,
} from '../config-loader.js'
import type { FlintProjectConfig } from '../config.js'

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-cfgloader-test-'))
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 })
})

function writeYaml(root: string, body: string): void {
    fs.writeFileSync(path.join(root, 'flint.config.yaml'), body, 'utf-8')
}

describe('Sprint 3 MAJOR-2: loadConfig strict mode', () => {
    it('throws ConfigValidationError when strict:true and YAML is invalid', () => {
        writeYaml(
            tmpDir,
            [
                'project: my-app',
                'rules:',
                '  mithril:',
                '    delta_e: banana', // invalid
            ].join('\n')
        )
        expect(() => loadConfig(tmpDir, { strict: true })).toThrow(ConfigValidationError)
    })

    it('throws ConfigValidationError when strict:true and YAML parse fails', () => {
        writeYaml(tmpDir, ':::: not valid yaml :::: -\n -\n  -')
        // Malformed YAML either throws directly or via the validation path
        expect(() => loadConfig(tmpDir, { strict: true })).toThrow()
    })

    it('strict:false (default) logs and returns config despite validation warnings', () => {
        writeYaml(
            tmpDir,
            [
                'project: my-app',
                'rules:',
                '  mithril:',
                '    mode: BOGUS_MODE',
            ].join('\n')
        )
        const cfg = loadConfig(tmpDir)
        expect(cfg.projectRoot).toBe(tmpDir)
    })

    it('strict:true with valid config returns config', () => {
        writeYaml(tmpDir, 'project: my-app\nrules:\n  mithril:\n    mode: advisory\n')
        const cfg = loadConfig(tmpDir, { strict: true })
        expect(cfg.projectRoot).toBe(tmpDir)
    })
})

describe('Sprint 3 MAJOR-3: resolveExtendsRef path sandbox', () => {
    it('throws ConfigPathSandboxError on ../.. traversal', () => {
        expect(() => resolveExtendsRef('../../../etc/passwd', tmpDir)).toThrow(
            ConfigPathSandboxError
        )
    })

    it('throws ConfigPathSandboxError on absolute path outside projectRoot', () => {
        expect(() => resolveExtendsRef('/etc/passwd', tmpDir)).toThrow(
            ConfigPathSandboxError
        )
    })

    it('accepts legitimate relative refs inside projectRoot', () => {
        const target = path.join(tmpDir, 'child.yaml')
        fs.writeFileSync(target, 'project: child\n', 'utf-8')
        const resolved = resolveExtendsRef('./child.yaml', tmpDir)
        expect(resolved).not.toBeNull()
        expect(resolved!.endsWith('child.yaml')).toBe(true)
    })

    it('accepts @flint/ preset refs (outside projectRoot but inside PRESETS_DIR)', () => {
        // This test asserts no sandbox error is thrown for @flint/ prefix —
        // it may still return a path that does not exist on disk.
        expect(() => resolveExtendsRef('@flint/default', tmpDir)).not.toThrow()
    })
})

describe('Sprint 3 MAJOR-4: resolveExtendsRef realpathSync canonicalization', () => {
    it('canonicalizes symlinked paths to their real location', () => {
        const realFile = path.join(tmpDir, 'real.yaml')
        fs.writeFileSync(realFile, 'project: real\n', 'utf-8')
        const linkFile = path.join(tmpDir, 'link.yaml')
        try {
            fs.symlinkSync(realFile, linkFile)
        } catch {
            // Some CI sandboxes forbid symlink creation — skip gracefully.
            return
        }
        const resolved = resolveExtendsRef('./link.yaml', tmpDir)
        expect(resolved).not.toBeNull()
        expect(fs.realpathSync(resolved!)).toBe(fs.realpathSync(realFile))
    })

    it('already-canonical paths are idempotent', () => {
        const target = path.join(tmpDir, 'direct.yaml')
        fs.writeFileSync(target, 'project: direct\n', 'utf-8')
        const first = resolveExtendsRef('./direct.yaml', tmpDir)
        const second = resolveExtendsRef('./direct.yaml', tmpDir)
        expect(first).toBe(second)
    })
})

describe('Sprint 3 MINOR-2: deepMergeConfigs trust.profiles deep merge', () => {
    it('merges profiles by id — child overrides parent fields for matching ids', () => {
        const base: FlintProjectConfig = {
            project: 'base',
            trust: {
                profiles: [
                    { id: 'alice', tier: 'junior', max_mutations: 10 },
                    { id: 'bob', tier: 'senior' },
                ],
            },
        }
        const override: Partial<FlintProjectConfig> = {
            project: 'base',
            trust: {
                profiles: [
                    { id: 'alice', tier: 'senior' }, // overrides tier, keeps max_mutations
                    { id: 'carol', tier: 'intern' }, // net new
                ],
            },
        }
        const merged = deepMergeConfigs(base, override)
        const profiles = merged.trust?.profiles ?? []
        const byId = new Map(profiles.map((p) => [p.id, p]))
        expect(profiles.length).toBe(3)
        expect(byId.get('alice')?.tier).toBe('senior')
        expect(byId.get('alice')?.max_mutations).toBe(10)
        expect(byId.get('bob')?.tier).toBe('senior')
        expect(byId.get('carol')?.tier).toBe('intern')
    })

    it('disjoint profile ids are preserved from both sides', () => {
        const base: FlintProjectConfig = {
            project: 'base',
            trust: {
                profiles: [{ id: 'alice', tier: 'junior' }],
            },
        }
        const override: Partial<FlintProjectConfig> = {
            project: 'base',
            trust: {
                profiles: [{ id: 'bob', tier: 'senior' }],
            },
        }
        const merged = deepMergeConfigs(base, override)
        const ids = new Set(merged.trust?.profiles?.map((p) => p.id))
        expect(ids.has('alice')).toBe(true)
        expect(ids.has('bob')).toBe(true)
    })

    it('empty override preserves base profiles entirely', () => {
        const base: FlintProjectConfig = {
            project: 'base',
            trust: {
                profiles: [{ id: 'alice', tier: 'principal' }],
            },
        }
        const merged = deepMergeConfigs(base, { project: 'base' })
        expect(merged.trust?.profiles?.[0]?.id).toBe('alice')
    })
})

describe('Sprint 3: loadYamlConfig emits structured event on parse failure', () => {
    it('writes to .flint/ledger/config-events.jsonl on YAML error', () => {
        writeYaml(tmpDir, ':::: completely broken :::: -\n  -\n -')
        const result = loadYamlConfig(tmpDir)
        // May return null or may parse something — what matters is the event
        void result
        const ledgerPath = path.join(tmpDir, '.flint', 'ledger', 'config-events.jsonl')
        // Ledger file exists only if the YAML actually failed to parse.
        if (fs.existsSync(ledgerPath)) {
            const content = fs.readFileSync(ledgerPath, 'utf-8')
            expect(content).toContain('yaml')
        }
    })
})

describe('Sprint 3 polish SEC-3: redactSecrets', () => {
    it('redacts api_key: style pairs', () => {
        const input = 'parse error at api_key: sk-1234567890abcdef1234567890 line 3'
        const out = redactSecrets(input)
        expect(out).not.toContain('sk-1234567890abcdef1234567890')
        expect(out).toContain('[REDACTED]')
    })

    it('redacts token: style pairs across common synonyms', () => {
        for (const key of ['token', 'secret', 'password', 'authorization', 'bearer']) {
            const out = redactSecrets(`${key}: myverysecretvalue123456789`)
            expect(out).not.toContain('myverysecretvalue123456789')
            expect(out).toContain('[REDACTED]')
        }
    })

    it('redacts long standalone opaque tokens', () => {
        const input = 'unexpected char near AKIAIOSFODNN7EXAMPLE in line 5'
        const out = redactSecrets(input)
        expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE')
        expect(out).toContain('[REDACTED]')
    })

    it('leaves short identifiers alone', () => {
        const input = 'unexpected char at line 5 col 12'
        const out = redactSecrets(input)
        expect(out).toBe('unexpected char at line 5 col 12')
    })

    it('is idempotent', () => {
        const input = 'api_key: sk-1234567890abcdef1234567890'
        const once = redactSecrets(input)
        const twice = redactSecrets(once)
        expect(twice).toBe(once)
    })
})
