/**
 * styleGuideService.test.ts — Gap 5: Content Style Guide resolution
 *
 * Tests for resolveStyleGuide():
 *   - Returns correct built-in content for 'google', 'microsoft', 'apple'
 *   - Returns null for null / undefined input
 *   - Returns null for unknown built-in name (not a path)
 *   - Reads custom file when path starts with './'
 *   - Returns null when custom file doesn't exist
 *   - Truncates long custom files to 2000 chars
 *   - Guide content is non-empty for all built-in guides
 *   - Handles absolute paths
 *   - Returns null for empty string input
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveStyleGuide } from '../styleGuideService.js'

// ── Test helpers ─────────────────────────────────────────────────────────────

function createTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-style-guide-test-'))
}

function cleanup(dir: string): void {
    try {
        fs.rmSync(dir, { recursive: true, force: true })
    } catch {
        // Ignore cleanup errors
    }
}

// ── Built-in guides ───────────────────────────────────────────────────────────

describe('resolveStyleGuide - built-in guides', () => {
    it('returns the google guide for "google"', () => {
        const result = resolveStyleGuide('google', '/any/root')
        expect(result).not.toBeNull()
        expect(typeof result).toBe('string')
        expect(result!.length).toBeGreaterThan(0)
    })

    it('google guide mentions active voice', () => {
        const result = resolveStyleGuide('google', '/any/root')
        expect(result).toContain('active voice')
    })

    it('google guide mentions serial commas', () => {
        const result = resolveStyleGuide('google', '/any/root')
        expect(result).toContain('serial commas')
    })

    it('returns the microsoft guide for "microsoft"', () => {
        const result = resolveStyleGuide('microsoft', '/any/root')
        expect(result).not.toBeNull()
        expect(typeof result).toBe('string')
        expect(result!.length).toBeGreaterThan(0)
    })

    it('microsoft guide mentions contractions', () => {
        const result = resolveStyleGuide('microsoft', '/any/root')
        expect(result).toContain("contractions")
    })

    it('microsoft guide mentions "select" not "click"', () => {
        const result = resolveStyleGuide('microsoft', '/any/root')
        expect(result).toContain('select')
    })

    it('returns the apple guide for "apple"', () => {
        const result = resolveStyleGuide('apple', '/any/root')
        expect(result).not.toBeNull()
        expect(typeof result).toBe('string')
        expect(result!.length).toBeGreaterThan(0)
    })

    it('apple guide mentions Oxford comma', () => {
        const result = resolveStyleGuide('apple', '/any/root')
        expect(result).toContain('Oxford comma')
    })

    it('apple guide is direct and mentions short sentences', () => {
        const result = resolveStyleGuide('apple', '/any/root')
        expect(result).toContain('short sentences')
    })

    it('all built-in guides are non-empty strings', () => {
        for (const name of ['google', 'microsoft', 'apple']) {
            const result = resolveStyleGuide(name, '/any/root')
            expect(result).not.toBeNull()
            expect(result!.length).toBeGreaterThan(10)
        }
    })

    it('all built-in guides are under 500 chars', () => {
        for (const name of ['google', 'microsoft', 'apple']) {
            const result = resolveStyleGuide(name, '/any/root')
            expect(result!.length).toBeLessThanOrEqual(500)
        }
    })
})

// ── Null / undefined input ───────────────────────────────────────────────────

describe('resolveStyleGuide - null / undefined input', () => {
    it('returns null for null input', () => {
        expect(resolveStyleGuide(null, '/any/root')).toBeNull()
    })

    it('returns null for undefined input', () => {
        expect(resolveStyleGuide(undefined, '/any/root')).toBeNull()
    })

    it('returns null for empty string', () => {
        expect(resolveStyleGuide('', '/any/root')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
        expect(resolveStyleGuide('   ', '/any/root')).toBeNull()
    })

    it('does not throw for null', () => {
        expect(() => resolveStyleGuide(null, '/any/root')).not.toThrow()
    })

    it('does not throw for undefined', () => {
        expect(() => resolveStyleGuide(undefined, '/any/root')).not.toThrow()
    })
})

// ── Unknown built-in name ─────────────────────────────────────────────────────

describe('resolveStyleGuide - unknown built-in name', () => {
    it('returns null for unknown name that is not a path', () => {
        expect(resolveStyleGuide('chicago', '/any/root')).toBeNull()
    })

    it('returns null for "strunk-and-white"', () => {
        expect(resolveStyleGuide('strunk-and-white', '/any/root')).toBeNull()
    })

    it('returns null for a random string with no path prefix', () => {
        expect(resolveStyleGuide('not-a-guide-or-path', '/any/root')).toBeNull()
    })

    it('does not throw for unknown name', () => {
        expect(() => resolveStyleGuide('unknown-guide', '/any/root')).not.toThrow()
    })
})

// ── Custom file paths ─────────────────────────────────────────────────────────

describe('resolveStyleGuide - custom file path', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = createTempDir()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('reads content from a ./ relative file path', () => {
        const content = 'Use plain language. Keep sentences short.'
        fs.writeFileSync(path.join(tmpDir, 'style-guide.md'), content, 'utf-8')

        const result = resolveStyleGuide('./style-guide.md', tmpDir)
        expect(result).toBe(content)
    })

    it('reads content from a ../ relative file path', () => {
        // Create a subdirectory; the guide lives one level up in tmpDir
        const subDir = path.join(tmpDir, 'subproject')
        fs.mkdirSync(subDir, { recursive: true })
        const content = 'Parent guide content.'
        fs.writeFileSync(path.join(tmpDir, 'parent-guide.md'), content, 'utf-8')

        const result = resolveStyleGuide('../parent-guide.md', subDir)
        expect(result).toBe(content)
    })

    it('reads content from an absolute file path', () => {
        const filePath = path.join(tmpDir, 'absolute-guide.txt')
        const content = 'Absolute path guide content.'
        fs.writeFileSync(filePath, content, 'utf-8')

        const result = resolveStyleGuide(filePath, '/any/root')
        expect(result).toBe(content)
    })

    it('returns null when the file does not exist', () => {
        const result = resolveStyleGuide('./nonexistent-guide.md', tmpDir)
        expect(result).toBeNull()
    })

    it('does not throw when the file does not exist', () => {
        expect(() => resolveStyleGuide('./nonexistent-guide.md', tmpDir)).not.toThrow()
    })

    it('returns null for a non-existent absolute path', () => {
        const result = resolveStyleGuide('/absolutely/does/not/exist/guide.md', '/any/root')
        expect(result).toBeNull()
    })

    it('truncates long custom files to 2000 chars', () => {
        // Generate a string longer than 2000 chars
        const longContent = 'A'.repeat(3000)
        fs.writeFileSync(path.join(tmpDir, 'long-guide.md'), longContent, 'utf-8')

        const result = resolveStyleGuide('./long-guide.md', tmpDir)
        expect(result).not.toBeNull()
        expect(result!.length).toBe(2000)
    })

    it('does not truncate content that is exactly 2000 chars', () => {
        const content = 'B'.repeat(2000)
        fs.writeFileSync(path.join(tmpDir, 'exact-guide.md'), content, 'utf-8')

        const result = resolveStyleGuide('./exact-guide.md', tmpDir)
        expect(result!.length).toBe(2000)
    })

    it('returns full content when file is shorter than 2000 chars', () => {
        const content = 'Short guide content.'
        fs.writeFileSync(path.join(tmpDir, 'short-guide.md'), content, 'utf-8')

        const result = resolveStyleGuide('./short-guide.md', tmpDir)
        expect(result).toBe(content)
    })

    it('returns an empty string for an empty file (not null)', () => {
        // Edge case: empty file exists and is readable — returns "" (empty string)
        // The slice(0, 2000) of "" is "" which is falsy but not null
        // The function returns the content as-is (empty string from readFileSync)
        fs.writeFileSync(path.join(tmpDir, 'empty-guide.md'), '', 'utf-8')

        const result = resolveStyleGuide('./empty-guide.md', tmpDir)
        // An empty file is readable; we return the empty string, not null
        expect(result).toBe('')
    })
})

// ── Boundary / integration checks ────────────────────────────────────────────

describe('resolveStyleGuide - boundary values', () => {
    it('handles a projectRoot that does not exist gracefully for relative paths', () => {
        // Non-existent projectRoot + relative path → file won't exist → null
        const result = resolveStyleGuide('./style.md', '/nonexistent/project/root')
        expect(result).toBeNull()
    })

    it('google and apple guides both mention you', () => {
        expect(resolveStyleGuide('google', '/any')).toContain('you')
        expect(resolveStyleGuide('apple', '/any')).toContain('you')
    })

    it('case-sensitive: "Google" (capital G) returns null, not the built-in', () => {
        // Built-in names are lowercase only
        expect(resolveStyleGuide('Google', '/any/root')).toBeNull()
    })

    it('case-sensitive: "APPLE" returns null', () => {
        expect(resolveStyleGuide('APPLE', '/any/root')).toBeNull()
    })
})
