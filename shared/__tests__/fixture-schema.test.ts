/**
 * FIXTURE.1 — shared/__tests__/fixture-schema.test.ts
 *
 * Unit tests for FlintFixtureSchema (Zod parser).
 *
 * boundary: shared/fixture-schema.ts::FlintFixture (Zod parse)
 */

import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  FlintFixtureSchema,
  DEFAULT_FIXTURE,
  type FlintFixture,
  type FlintFixtureSurface,
  type FlintFixtureRuleMode,
} from '../fixture-schema'

// ── Happy path ────────────────────────────────────────────────────────────────

describe('FlintFixtureSchema — valid inputs', () => {
  // boundary: surface is required, returns typed FlintFixture with surface="component"
  it('parses minimal fixture with only surface', () => {
    const result = FlintFixtureSchema.parse({ surface: 'component' })
    expect(result.surface).toBe('component')
    expect(result.tokens).toBeUndefined()
    expect(result.label).toBeUndefined()
    expect(result.ruleProfile).toBeUndefined()
    expect(result.ruleOverrides).toBeUndefined()
  })

  it('parses surface="document"', () => {
    const result = FlintFixtureSchema.parse({ surface: 'document' })
    expect(result.surface).toBe('document')
  })

  it('parses surface="section"', () => {
    const result = FlintFixtureSchema.parse({ surface: 'section' })
    expect(result.surface).toBe('section')
  })

  // boundary: given JSON { "surface": "component", "label": "Demo", "tokens": "../design-tokens.json" }
  it('parses full valid fixture including tokens, label, ruleProfile', () => {
    const input = {
      surface: 'component',
      label: 'Demo',
      tokens: '../design-tokens.json',
      ruleProfile: 'enterprise',
    }
    const result = FlintFixtureSchema.parse(input)
    expect(result).toEqual(input)
  })

  // boundary: tokens may be omitted
  it('allows tokens to be omitted', () => {
    const result = FlintFixtureSchema.parse({ surface: 'component', label: 'No tokens' })
    expect(result.tokens).toBeUndefined()
  })

  // boundary: ruleOverrides values restricted to error|warn|off|ignore
  it('parses ruleOverrides with all valid mode values', () => {
    const validModes: FlintFixtureRuleMode[] = ['error', 'warn', 'off', 'ignore']
    for (const mode of validModes) {
      const result = FlintFixtureSchema.parse({
        surface: 'component',
        ruleOverrides: { 'A11Y-050': mode },
      })
      expect(result.ruleOverrides?.['A11Y-050']).toBe(mode)
    }
  })

  it('parses ruleOverrides with multiple rules', () => {
    const result = FlintFixtureSchema.parse({
      surface: 'document',
      ruleOverrides: {
        'A11Y-050': 'off',
        'MITHRIL-COL': 'warn',
        'A11Y-001': 'error',
      },
    })
    expect(Object.keys(result.ruleOverrides!)).toHaveLength(3)
    expect(result.ruleOverrides!['MITHRIL-COL']).toBe('warn')
  })

  it('parses empty ruleOverrides object', () => {
    const result = FlintFixtureSchema.parse({ surface: 'component', ruleOverrides: {} })
    expect(result.ruleOverrides).toEqual({})
  })
})

// ── Rejection: required fields ────────────────────────────────────────────────

describe('FlintFixtureSchema — surface is required', () => {
  // boundary: surface is required
  it('throws ZodError when surface is missing', () => {
    expect(() => FlintFixtureSchema.parse({})).toThrow(ZodError)
  })

  it('ZodError path includes "surface"', () => {
    try {
      FlintFixtureSchema.parse({})
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError)
      const zErr = err as ZodError
      expect(zErr.issues.some((i) => i.path.includes('surface'))).toBe(true)
    }
  })

  it('throws ZodError when surface is null', () => {
    expect(() => FlintFixtureSchema.parse({ surface: null })).toThrow(ZodError)
  })
})

// ── Rejection: invalid surface enum value ─────────────────────────────────────

describe('FlintFixtureSchema — surface enum validation', () => {
  it('throws on unknown surface value', () => {
    expect(() => FlintFixtureSchema.parse({ surface: 'page' })).toThrow(ZodError)
  })

  it('throws on surface="any" (not a valid surface kind)', () => {
    expect(() => FlintFixtureSchema.parse({ surface: 'any' })).toThrow(ZodError)
  })
})

// ── Rejection: ruleOverrides values ──────────────────────────────────────────

describe('FlintFixtureSchema — ruleOverrides value validation', () => {
  // boundary: ruleOverrides values restricted to error|warn|off|ignore
  it('throws when ruleOverrides value is not a recognized mode', () => {
    expect(() =>
      FlintFixtureSchema.parse({
        surface: 'component',
        ruleOverrides: { 'A11Y-050': 'disable' },
      })
    ).toThrow(ZodError)
  })

  it('throws when ruleOverrides value is a boolean', () => {
    expect(() =>
      FlintFixtureSchema.parse({
        surface: 'component',
        ruleOverrides: { 'A11Y-050': true },
      })
    ).toThrow(ZodError)
  })

  it('throws when ruleOverrides value is a number', () => {
    expect(() =>
      FlintFixtureSchema.parse({
        surface: 'component',
        ruleOverrides: { 'A11Y-050': 0 },
      })
    ).toThrow(ZodError)
  })
})

// ── Rejection: unknown top-level fields (.strict()) ───────────────────────────

describe('FlintFixtureSchema — strict mode rejects unknown fields', () => {
  // boundary: unknown top-level fields rejected (strict mode)
  it('throws ZodError when an unknown top-level field is present', () => {
    expect(() =>
      FlintFixtureSchema.parse({ surface: 'component', unknownField: 'oops' })
    ).toThrow(ZodError)
  })

  it('throws on typo in known field name', () => {
    expect(() =>
      FlintFixtureSchema.parse({ surface: 'component', tokns: '../design-tokens.json' })
    ).toThrow(ZodError)
  })

  it('does NOT throw when only known fields are present', () => {
    expect(() =>
      FlintFixtureSchema.parse({
        surface: 'section',
        tokens: '../tokens.json',
        label: 'Section context',
        ruleProfile: 'base',
        ruleOverrides: {},
      })
    ).not.toThrow()
  })
})

// ── DEFAULT_FIXTURE ───────────────────────────────────────────────────────────

describe('DEFAULT_FIXTURE', () => {
  it('has surface="component" (safest default)', () => {
    expect(DEFAULT_FIXTURE.fixture.surface).toBe('component')
  })

  it('has source=null', () => {
    expect(DEFAULT_FIXTURE.source).toBeNull()
  })

  it('has resolvedTokensPath=null', () => {
    expect(DEFAULT_FIXTURE.resolvedTokensPath).toBeNull()
  })

  it('fixture passes FlintFixtureSchema parse (default is valid)', () => {
    expect(() => FlintFixtureSchema.parse(DEFAULT_FIXTURE.fixture)).not.toThrow()
  })
})
