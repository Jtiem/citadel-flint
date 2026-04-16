/**
 * Registry Resolver Tests — Phase 1B / Gap 6
 *
 * Tests the cache-first registry pack resolver that checks
 * .flint-packs/<pack-dir>/flint.config.yaml for registry extends refs.
 *
 * Coverage:
 *   1. Returns path when pack exists in .flint-packs/
 *   2. Returns null when pack not cached
 *   3. Sanitises "org/name" to "org--name" directory
 *   4. Handles nested org names (multiple slashes)
 *   5. Handles refs with no slash (plain name, no transform)
 *   6. Returns null for empty string
 *   7. Returns null when only the directory exists but not the config file
 *   8. Works with absolute projectRoot paths
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveRegistryRef } from '../registryResolver.js'

// ── Temp directory helpers ────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-registry-test-'))
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

function createPack(dirName: string): string {
    const packDir = path.join(tmpDir, '.flint-packs', dirName)
    fs.mkdirSync(packDir, { recursive: true })
    const configPath = path.join(packDir, 'flint.config.yaml')
    fs.writeFileSync(configPath, 'project: test-pack\n', 'utf-8')
    return configPath
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveRegistryRef (Gap 6)', () => {

    // ── Pack found in local cache ─────────────────────────────────────────────

    it('returns config path when pack exists in .flint-packs/', () => {
        const expectedPath = fs.realpathSync(createPack('acme--my-pack'))
        const result = resolveRegistryRef('acme/my-pack', tmpDir)
        expect(result).toBe(expectedPath)
    })

    it('returned path points to a real file that exists', () => {
        createPack('acme--healthcare')
        const result = resolveRegistryRef('acme/healthcare', tmpDir)
        expect(result).not.toBeNull()
        expect(fs.existsSync(result!)).toBe(true)
    })

    // ── Pack not in local cache ───────────────────────────────────────────────

    it('returns null when pack is not cached', () => {
        const result = resolveRegistryRef('acme/nonexistent-pack', tmpDir)
        expect(result).toBeNull()
    })

    it('returns null for an empty project root with no .flint-packs dir', () => {
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-empty-'))
        try {
            const result = resolveRegistryRef('acme/pack', emptyDir)
            expect(result).toBeNull()
        } finally {
            fs.rmSync(emptyDir, { recursive: true, force: true })
        }
    })

    // ── Sanitisation: org/name → org--name ───────────────────────────────────

    it('sanitises "org/pack-name" to "org--pack-name" directory', () => {
        createPack('org--pack-name')
        const result = resolveRegistryRef('org/pack-name', tmpDir)
        expect(result).not.toBeNull()
        expect(result).toContain('org--pack-name')
    })

    it('sanitises "acme/healthcare-base" correctly', () => {
        createPack('acme--healthcare-base')
        const result = resolveRegistryRef('acme/healthcare-base', tmpDir)
        expect(result).not.toBeNull()
        expect(result).toContain('acme--healthcare-base')
    })

    // ── Nested org names (multiple slashes) ───────────────────────────────────

    it('handles nested org names (two slashes) correctly', () => {
        // "org/sub/pack" → "org--sub--pack"
        createPack('org--sub--pack')
        const result = resolveRegistryRef('org/sub/pack', tmpDir)
        expect(result).not.toBeNull()
        expect(result).toContain('org--sub--pack')
    })

    it('handles deeply nested refs (three slashes)', () => {
        createPack('a--b--c--d')
        const result = resolveRegistryRef('a/b/c/d', tmpDir)
        expect(result).not.toBeNull()
        expect(result).toContain('a--b--c--d')
    })

    // ── No slash in ref ───────────────────────────────────────────────────────

    it('handles refs with no slash (plain name unchanged)', () => {
        createPack('standalone-pack')
        const result = resolveRegistryRef('standalone-pack', tmpDir)
        expect(result).not.toBeNull()
        expect(result).toContain('standalone-pack')
    })

    // ── Directory exists but config file does not ─────────────────────────────

    it('returns null when directory exists but flint.config.yaml is missing', () => {
        // Create the directory but NOT the config file
        const packDir = path.join(tmpDir, '.flint-packs', 'acme--partial')
        fs.mkdirSync(packDir, { recursive: true })
        // No flint.config.yaml written

        const result = resolveRegistryRef('acme/partial', tmpDir)
        expect(result).toBeNull()
    })

    // ── Absolute path correctness ─────────────────────────────────────────────

    it('uses absolute projectRoot to locate the pack', () => {
        // tmpDir is already absolute — verify the returned path is also absolute
        createPack('vendor--pack')
        const result = resolveRegistryRef('vendor/pack', tmpDir)
        expect(result).not.toBeNull()
        expect(path.isAbsolute(result!)).toBe(true)
    })

    // ── Edge cases ────────────────────────────────────────────────────────────

    it('throws RegistryPathSandboxError for a ref that is just a slash (absolute path)', () => {
        expect(() => resolveRegistryRef('/', tmpDir)).toThrow(/absolute/)
    })

    it('throws RegistryPathSandboxError for special characters in ref', () => {
        expect(() => resolveRegistryRef('org/pack!@#', tmpDir)).toThrow()
    })
})
