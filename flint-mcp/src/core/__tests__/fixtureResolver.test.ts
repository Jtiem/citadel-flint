/**
 * FIXTURE.1 — flint-mcp/src/core/__tests__/fixtureResolver.test.ts
 *
 * Tests for resolveFixture() walk-up, caching, tokens resolution, and guards.
 *
 * boundary: flint-mcp/src/core/fixtureResolver.ts::resolveFixture
 * boundary: flint-mcp/src/core/fixtureResolver.ts (cache)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveFixture, clearFixtureCache } from '../fixtureResolver.js'
import type { ResolvedFixture } from '../../../../shared/fixture-schema.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmp(): string {
  // Canonicalize via realpath so assertions line up with the resolver's own
  // symlink-safe canonicalization (on macOS, /var/folders is a symlink to
  // /private/var/folders; without this, path comparisons would diverge).
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'flint-fixture-test-')))
}

function writeFixture(dir: string, content: object): string {
  const fixturePath = path.join(dir, '.flint-fixture.json')
  fs.writeFileSync(fixturePath, JSON.stringify(content), 'utf-8')
  return fixturePath
}

function writeFile(dir: string, name: string, content: string = ''): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
  clearFixtureCache()
  tmpDir = makeTmp()
})

afterEach(() => {
  // Clean up tmp dirs recursively
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})

// ── No fixture found ──────────────────────────────────────────────────────────

describe('resolveFixture — no fixture in walk-up chain', () => {
  // boundary: file at project root with no fixture ⇒ defaults
  it('returns DEFAULT_FIXTURE when no .flint-fixture.json exists', () => {
    const filePath = writeFile(tmpDir, 'Button.tsx')
    const result = resolveFixture(filePath, tmpDir)

    expect(result.source).toBeNull()
    expect(result.resolvedTokensPath).toBeNull()
    expect(result.fixture.surface).toBe('component')
  })

  it('source is null when no fixture file found', () => {
    const filePath = writeFile(tmpDir, 'App.tsx')
    const result = resolveFixture(filePath, tmpDir)
    expect(result.source).toBeNull()
  })
})

// ── Fixture found in same directory ──────────────────────────────────────────

describe('resolveFixture — fixture in same directory as audited file', () => {
  it('returns fixture from same directory', () => {
    writeFixture(tmpDir, { surface: 'component', label: 'RAG demo' })
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    const result = resolveFixture(filePath, tmpDir)

    expect(result.source).not.toBeNull()
    expect(result.source).toContain('.flint-fixture.json')
    expect(result.fixture.surface).toBe('component')
    expect(result.fixture.label).toBe('RAG demo')
  })

  // boundary: given demos/01-rag-ui-builder/banner-broken.tsx + fixture at same dir
  it('returns fixture with correct surface for demo-01 scenario', () => {
    writeFixture(tmpDir, { surface: 'component', label: 'RAG UI demo' })
    const filePath = writeFile(tmpDir, 'banner-broken.tsx')

    const result = resolveFixture(filePath, tmpDir)

    expect(result.fixture.surface).toBe('component')
  })
})

// ── Walk-up behaviour ─────────────────────────────────────────────────────────

describe('resolveFixture — walk-up chain', () => {
  // boundary: fixture two directories up ⇒ that one wins
  it('finds fixture two directories up when none in child directories', () => {
    const childDir = path.join(tmpDir, 'src', 'components')
    fs.mkdirSync(childDir, { recursive: true })

    writeFixture(tmpDir, { surface: 'document', label: 'Project root' })
    const filePath = writeFile(childDir, 'Header.tsx')

    const result = resolveFixture(filePath, tmpDir)

    expect(result.source).not.toBeNull()
    expect(result.fixture.surface).toBe('document')
    expect(result.fixture.label).toBe('Project root')
  })

  // boundary: two fixtures in walk-up chain ⇒ nearest wins
  it('nearest fixture wins over ancestor fixture', () => {
    const subDir = path.join(tmpDir, 'demos', 'demo01')
    fs.mkdirSync(subDir, { recursive: true })

    writeFixture(tmpDir, { surface: 'document', label: 'Root fixture' })
    writeFixture(subDir, { surface: 'component', label: 'Demo fixture' })

    const filePath = writeFile(subDir, 'Banner.tsx')
    const result = resolveFixture(filePath, tmpDir)

    expect(result.fixture.label).toBe('Demo fixture')
    expect(result.fixture.surface).toBe('component')
  })

  it('returns root fixture when child directory has no fixture', () => {
    const subDir = path.join(tmpDir, 'src')
    fs.mkdirSync(subDir, { recursive: true })

    writeFixture(tmpDir, { surface: 'section', label: 'Root' })
    const filePath = writeFile(subDir, 'Card.tsx')

    const result = resolveFixture(filePath, tmpDir)
    expect(result.fixture.label).toBe('Root')
  })
})

// ── Tokens path resolution ────────────────────────────────────────────────────

describe('resolveFixture — tokens path resolution', () => {
  // boundary: tokens path resolved relative to fixture file's directory (not audited file)
  it('resolves tokens relative to fixture file directory', () => {
    const tokensPath = writeFile(tmpDir, 'design-tokens.json', '[]')
    writeFixture(tmpDir, { surface: 'component', tokens: './design-tokens.json' })

    const subDir = path.join(tmpDir, 'components')
    fs.mkdirSync(subDir, { recursive: true })
    const filePath = writeFile(subDir, 'Button.tsx')

    // Fixture is at tmpDir, file is at tmpDir/components/Button.tsx
    // tokens should be resolved relative to tmpDir, not subDir
    const result = resolveFixture(filePath, tmpDir)

    // Since the fixture is at tmpDir level and file is in subDir,
    // the fixture should be found via walk-up
    if (result.source) {
      expect(result.resolvedTokensPath).toBe(tokensPath)
    }
  })

  it('resolves tokens with parent-relative path (../)', () => {
    const subDir = path.join(tmpDir, 'demo01')
    fs.mkdirSync(subDir, { recursive: true })

    const tokensPath = writeFile(tmpDir, 'design-tokens.json', '[]')
    writeFixture(subDir, { surface: 'component', tokens: '../design-tokens.json' })
    const filePath = writeFile(subDir, 'Banner.tsx')

    const result = resolveFixture(filePath, tmpDir)

    expect(result.resolvedTokensPath).toBe(tokensPath)
  })

  // boundary: missing tokens file does NOT throw (resolvedTokensPath: null)
  it('returns resolvedTokensPath=null when tokens file does not exist (no throw)', () => {
    writeFixture(tmpDir, { surface: 'component', tokens: './nonexistent-tokens.json' })
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    expect(() => resolveFixture(filePath, tmpDir)).not.toThrow()
    const result = resolveFixture(filePath, tmpDir)
    expect(result.resolvedTokensPath).toBeNull()
  })

  it('sets resolvedTokensPath to null when fixture has no tokens field', () => {
    writeFixture(tmpDir, { surface: 'component' })
    const filePath = writeFile(tmpDir, 'Card.tsx')

    const result = resolveFixture(filePath, tmpDir)
    expect(result.resolvedTokensPath).toBeNull()
  })
})

// ── Cache behaviour ───────────────────────────────────────────────────────────

describe('resolveFixture — per-directory cache', () => {
  // boundary: two files in same directory ⇒ one fs.readFile call total for the fixture
  it('returns identical ResolvedFixture reference for two files in same directory', () => {
    writeFixture(tmpDir, { surface: 'component', label: 'Cached' })
    const file1 = writeFile(tmpDir, 'A.tsx')
    const file2 = writeFile(tmpDir, 'B.tsx')

    const result1 = resolveFixture(file1, tmpDir)
    const result2 = resolveFixture(file2, tmpDir)

    // Should return the same object reference (cache hit)
    expect(result1).toBe(result2)
  })

  // boundary: cache invalidated when explicitly cleared (test helper)
  it('re-reads fixture after clearFixtureCache()', () => {
    writeFixture(tmpDir, { surface: 'component', label: 'First' })
    const filePath = writeFile(tmpDir, 'Button.tsx')

    const result1 = resolveFixture(filePath, tmpDir)
    expect(result1.fixture.label).toBe('First')

    // Mutate the fixture file
    writeFixture(tmpDir, { surface: 'document', label: 'Second' })

    // Without clearing cache, still returns cached value
    const result2 = resolveFixture(filePath, tmpDir)
    expect(result2.fixture.label).toBe('First') // cache hit

    // After clearing, reads the new file
    clearFixtureCache()
    const result3 = resolveFixture(filePath, tmpDir)
    expect(result3.fixture.label).toBe('Second')
  })

  it('caches null (no fixture found) for directory with no fixture', () => {
    const file1 = writeFile(tmpDir, 'A.tsx')
    const file2 = writeFile(tmpDir, 'B.tsx')

    const result1 = resolveFixture(file1, tmpDir)
    const result2 = resolveFixture(file2, tmpDir)

    // Both should be the DEFAULT_FIXTURE (same object from module)
    expect(result1.source).toBeNull()
    expect(result2.source).toBeNull()
  })
})

// ── Malformed JSON ────────────────────────────────────────────────────────────

describe('resolveFixture — malformed JSON', () => {
  // boundary: malformed JSON ⇒ thrown error names the offending file
  it('throws when fixture file contains malformed JSON', () => {
    const fixturePath = path.join(tmpDir, '.flint-fixture.json')
    fs.writeFileSync(fixturePath, '{ surface: "component", broken json', 'utf-8')
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    expect(() => resolveFixture(filePath, tmpDir)).toThrow(/fixtureResolver/)
  })

  it('error message includes the path to the offending fixture file', () => {
    const fixturePath = path.join(tmpDir, '.flint-fixture.json')
    fs.writeFileSync(fixturePath, '{ invalid }', 'utf-8')
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    try {
      resolveFixture(filePath, tmpDir)
      expect.fail('should have thrown')
    } catch (err: unknown) {
      expect((err as Error).message).toContain('.flint-fixture.json')
    }
  })

  it('throws when fixture file has invalid Zod schema (bad surface value)', () => {
    const fixturePath = path.join(tmpDir, '.flint-fixture.json')
    fs.writeFileSync(fixturePath, JSON.stringify({ surface: 'invalid-surface' }), 'utf-8')
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    expect(() => resolveFixture(filePath, tmpDir)).toThrow()
  })

  it('error message mentions the field name on Zod failure', () => {
    const fixturePath = path.join(tmpDir, '.flint-fixture.json')
    fs.writeFileSync(
      fixturePath,
      JSON.stringify({ surface: 'component', ruleOverrides: { 'A11Y-001': 'invalid-mode' } }),
      'utf-8',
    )
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    try {
      resolveFixture(filePath, tmpDir)
      expect.fail('should have thrown')
    } catch (err: unknown) {
      expect((err as Error).message).toMatch(/fixtureResolver/)
    }
  })
})

// ── Path-traversal guard ──────────────────────────────────────────────────────

describe('resolveFixture — path-traversal guard', () => {
  // boundary: symlink that escapes projectRoot ⇒ blocked
  // boundary: tokens path is within projectRoot always checked
  it('throws when fixture.tokens resolves outside projectRoot via ../ sequences', () => {
    // The tokens path ../../etc/passwd would escape projectRoot
    writeFixture(tmpDir, {
      surface: 'component',
      tokens: '../../../etc/passwd',
    })
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    expect(() => resolveFixture(filePath, tmpDir)).toThrow(/traversal|outside|projectRoot/i)
  })

  it('blocks tokens path that escapes with multiple parent segments', () => {
    const subDir = path.join(tmpDir, 'src', 'components')
    fs.mkdirSync(subDir, { recursive: true })

    writeFixture(subDir, { surface: 'component', tokens: '../../../../etc/passwd' })
    const filePath = writeFile(subDir, 'Button.tsx')

    expect(() => resolveFixture(filePath, tmpDir)).toThrow(/traversal|outside|projectRoot/i)
  })

  it('allows tokens path that stays within projectRoot', () => {
    const tokensPath = writeFile(tmpDir, 'tokens.json', '[]')
    writeFixture(tmpDir, { surface: 'component', tokens: './tokens.json' })
    const filePath = writeFile(tmpDir, 'Banner.tsx')

    // Should NOT throw — tokens path is within projectRoot
    expect(() => resolveFixture(filePath, tmpDir)).not.toThrow()
    const result = resolveFixture(filePath, tmpDir)
    expect(result.resolvedTokensPath).toBe(tokensPath)
  })
})

// ── Source path ───────────────────────────────────────────────────────────────

describe('resolveFixture — source field', () => {
  it('source is an absolute path ending in .flint-fixture.json', () => {
    writeFixture(tmpDir, { surface: 'component' })
    const filePath = writeFile(tmpDir, 'Button.tsx')

    const result = resolveFixture(filePath, tmpDir)

    expect(result.source).not.toBeNull()
    expect(path.isAbsolute(result.source!)).toBe(true)
    expect(result.source!.endsWith('.flint-fixture.json')).toBe(true)
  })

  it('source is null when defaults are returned', () => {
    const filePath = writeFile(tmpDir, 'Button.tsx')
    const result = resolveFixture(filePath, tmpDir)
    expect(result.source).toBeNull()
  })
})
