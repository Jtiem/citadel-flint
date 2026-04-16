/**
 * server/services/__tests__/librarySeedTokens.test.ts
 *
 * Tests for getSeedTokens() and LIBRARY_OPTIONS in
 * server/services/librarySeedTokens.ts.
 *
 * Pure data file — no I/O. All assertions are synchronous.
 */

import { describe, it, expect } from 'vitest'
import { getSeedTokens, LIBRARY_OPTIONS } from '../librarySeedTokens.js'
import type { SupportedLibrary } from '../librarySeedTokens.js'

// ── Token shape validator ─────────────────────────────────────────────────────

function assertTokenShape(token: unknown, libraryId: string): void {
  const t = token as Record<string, unknown>
  expect(typeof t.id, `${libraryId} token.id`).toBe('number')
  expect(typeof t.token_path, `${libraryId} token.token_path`).toBe('string')
  expect((t.token_path as string).length, `${libraryId} token_path non-empty`).toBeGreaterThan(0)
  expect(typeof t.token_type, `${libraryId} token.token_type`).toBe('string')
  expect(typeof t.token_value, `${libraryId} token.token_value`).toBe('string')
  expect((t.token_value as string).length, `${libraryId} token_value non-empty`).toBeGreaterThan(0)
  expect(typeof t.description, `${libraryId} token.description`).toBe('string')
  expect(typeof t.collection_name, `${libraryId} token.collection_name`).toBe('string')
  expect(typeof t.mode, `${libraryId} token.mode`).toBe('string')
}

// ── getSeedTokens ─────────────────────────────────────────────────────────────

describe('getSeedTokens', () => {
  it('returns a non-empty array for shadcn', () => {
    const tokens = getSeedTokens('shadcn')
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for mui', () => {
    const tokens = getSeedTokens('mui')
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for primeng', () => {
    const tokens = getSeedTokens('primeng')
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for tailwind', () => {
    const tokens = getSeedTokens('tailwind')
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('returns an empty array for "none"', () => {
    const tokens = getSeedTokens('none')
    expect(tokens).toHaveLength(0)
  })

  it('returns an empty array for an unknown library name', () => {
    const tokens = getSeedTokens('unknown-lib')
    expect(tokens).toHaveLength(0)
  })

  it('returns an empty array for empty string', () => {
    expect(getSeedTokens('')).toHaveLength(0)
  })

  // ── token shape assertions ────────────────────────────────────────────────

  it('shadcn tokens all have the expected shape', () => {
    getSeedTokens('shadcn').forEach((t) => assertTokenShape(t, 'shadcn'))
  })

  it('mui tokens all have the expected shape', () => {
    getSeedTokens('mui').forEach((t) => assertTokenShape(t, 'mui'))
  })

  it('primeng tokens all have the expected shape', () => {
    getSeedTokens('primeng').forEach((t) => assertTokenShape(t, 'primeng'))
  })

  it('tailwind tokens all have the expected shape', () => {
    getSeedTokens('tailwind').forEach((t) => assertTokenShape(t, 'tailwind'))
  })

  // ── token counts ──────────────────────────────────────────────────────────

  it('shadcn has at least 15 tokens', () => {
    expect(getSeedTokens('shadcn').length).toBeGreaterThanOrEqual(15)
  })

  it('mui has at least 15 tokens', () => {
    expect(getSeedTokens('mui').length).toBeGreaterThanOrEqual(15)
  })

  it('primeng has at least 10 tokens', () => {
    expect(getSeedTokens('primeng').length).toBeGreaterThanOrEqual(10)
  })

  it('tailwind has at least 10 tokens', () => {
    expect(getSeedTokens('tailwind').length).toBeGreaterThanOrEqual(10)
  })

  // ── collection_name matches library ──────────────────────────────────────

  it('all shadcn tokens have collection_name "shadcn"', () => {
    getSeedTokens('shadcn').forEach((t) => {
      expect((t as Record<string, unknown>).collection_name).toBe('shadcn')
    })
  })

  it('all mui tokens have collection_name "mui"', () => {
    getSeedTokens('mui').forEach((t) => {
      expect((t as Record<string, unknown>).collection_name).toBe('mui')
    })
  })

  // ── color token values ────────────────────────────────────────────────────

  it('color tokens have hex values starting with #', () => {
    const shadcn = getSeedTokens('shadcn')
    const colorTokens = shadcn.filter(
      (t) => (t as Record<string, unknown>).token_type === 'color',
    )
    expect(colorTokens.length).toBeGreaterThan(0)
    colorTokens.forEach((t) => {
      expect((t as Record<string, unknown>).token_value as string).toMatch(/^#/)
    })
  })
})

// ── LIBRARY_OPTIONS ───────────────────────────────────────────────────────────

describe('LIBRARY_OPTIONS', () => {
  const ids = LIBRARY_OPTIONS.map((o) => o.id)

  it('includes all supported libraries', () => {
    const expected: SupportedLibrary[] = ['shadcn', 'mui', 'primeng', 'tailwind', 'none']
    for (const lib of expected) {
      expect(ids).toContain(lib)
    }
  })

  it('each option has a non-empty displayName and description', () => {
    for (const opt of LIBRARY_OPTIONS) {
      expect(opt.displayName.length).toBeGreaterThan(0)
      expect(opt.description.length).toBeGreaterThan(0)
    }
  })
})
