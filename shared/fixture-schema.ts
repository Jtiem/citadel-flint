/**
 * FIXTURE.1 — Audit Context System
 *
 * Zod schema and TypeScript types for `.flint-fixture.json`.
 *
 * Consumed by: fixtureResolver.ts, A11yLinter.ts, MithrilLinter.ts,
 * server.ts audit handlers, and the flint-ast-surgeon rule metadata modules.
 *
 * Type names match those declared in FIXTURE.1.contract.ts.
 */

import { z } from 'zod'

// ─── String-literal union types ───────────────────────────────────────────────

/**
 * Surface kind drives rule applicability filtering.
 * - document  → full page; landmark / structure rules apply
 * - section   → page section; some structure rules apply
 * - component → single export; only component-scope rules apply
 */
export type FlintFixtureSurface = 'document' | 'section' | 'component'

/**
 * Rule mode used in `ruleOverrides` (last-resort escape hatch).
 * Applicability filtering (`appliesTo`) is preferred over overrides.
 */
export type FlintFixtureRuleMode = 'error' | 'warn' | 'off' | 'ignore'

/**
 * Applicability metadata attached to every governance rule.
 * Default for unspecified rules is `'any'` (no behavior change).
 *
 * - 'document'  → only run on fixtures with surface='document'
 * - 'section'   → run on 'document' or 'section'
 * - 'component' → run on 'component' (and broader, by inclusion)
 * - 'any'       → run on all surfaces (default)
 */
export type RuleAppliesTo = 'document' | 'section' | 'component' | 'any'

/** Mithril appliesTo map keyed by ruleId. */
export type MithrilAppliesToMap = Record<string, RuleAppliesTo>

// ─── FlintFixture interface ───────────────────────────────────────────────────

/**
 * Schema for `.flint-fixture.json`. Walked-up resolution: the nearest fixture
 * file at-or-above the audited file wins (like tsconfig.json).
 */
export interface FlintFixture {
  /** Path to design-tokens.json relative to this fixture file. Falsy ⇒ no tokens loaded. */
  tokens?: string
  /** What kind of surface this directory represents — drives rule applicability. */
  surface: FlintFixtureSurface
  /** Which rule pack profile to apply (default: project default). */
  ruleProfile?: string
  /** Optional human label shown in StatusBar ("MUI demo context", "Tailwind defaults"). */
  label?: string
  /**
   * Last-resort per-rule mode override. Applies AFTER applicability filtering —
   * never resurrects a hard-skipped rule.
   */
  ruleOverrides?: Record<string, FlintFixtureRuleMode>
}

// ─── ResolvedFixture ──────────────────────────────────────────────────────────

/**
 * Output of `resolveFixture(filePath, projectRoot)`. The `source` field tells
 * the caller which fixture file (if any) won the walk-up — enabling StatusBar label.
 */
export interface ResolvedFixture {
  /** The resolved fixture (always populated; defaults applied if no file found). */
  fixture: FlintFixture
  /** Absolute path to the .flint-fixture.json that won the walk-up; null if defaults. */
  source: string | null
  /** Absolute path to the resolved tokens file (if `fixture.tokens` set and existed). */
  resolvedTokensPath: string | null
}

// ─── ApplicabilityDecision ────────────────────────────────────────────────────

/**
 * Decision returned by the applicability filter for one (rule, fixture) pair.
 * Used by the audit pipeline; surfaced in trace logs but NOT recorded as a
 * suppressed violation (hard-skip is silent — the rule simply doesn't apply).
 */
export interface ApplicabilityDecision {
  ruleId: string
  appliesTo: RuleAppliesTo
  fixtureSurface: FlintFixtureSurface
  /** True ⇒ rule is invoked. False ⇒ rule is silently skipped. */
  invoke: boolean
}

// ─── Surface applicability predicate ─────────────────────────────────────────

/**
 * Returns true if a rule with the given `appliesTo` should be invoked for the
 * given fixture surface. Single source of truth for BOTH A11yLinter and
 * MithrilLinter — keep the inclusion table here, not duplicated per-linter.
 *
 * Inclusion table:
 *   appliesTo=any       → all surfaces ✓
 *   appliesTo=document  → document only
 *   appliesTo=section   → document, section
 *   appliesTo=component → all surfaces (symmetry with 'any'; most permissive)
 *   appliesTo=undefined → treated as 'any' (backward-compatible default)
 *
 * Silent-skip semantics: when this returns false, the rule is NOT invoked and
 * NO suppressed-log entry is emitted (per FIXTURE.1 contract).
 */
export function ruleMatchesSurface(
  appliesTo: RuleAppliesTo | undefined,
  surface: FlintFixtureSurface,
): boolean {
  if (appliesTo === undefined || appliesTo === 'any' || appliesTo === 'component') return true
  if (appliesTo === 'document') return surface === 'document'
  if (appliesTo === 'section') return surface === 'document' || surface === 'section'
  return true // future-proof: unknown values default to include
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

/** Zod schema for FlintFixtureSurface. */
export const FlintFixtureSurfaceSchema = z.enum(['document', 'section', 'component'])

/** Zod schema for FlintFixtureRuleMode. */
export const FlintFixtureRuleModeSchema = z.enum(['error', 'warn', 'off', 'ignore'])

/**
 * Zod schema for `.flint-fixture.json`.
 *
 * `.strict()` rejects unknown top-level fields, surfacing author typos as
 * actionable errors rather than silent misconfigurations.
 */
export const FlintFixtureSchema = z
  .object({
    surface: FlintFixtureSurfaceSchema,
    tokens: z.string().optional(),
    ruleProfile: z.string().optional(),
    label: z.string().optional(),
    ruleOverrides: z.record(z.string(), FlintFixtureRuleModeSchema).optional(),
  })
  .strict()

/** Zod schema for the resolved fixture output shape. */
export const ResolvedFixtureSchema = z.object({
  fixture: FlintFixtureSchema,
  source: z.string().nullable(),
  resolvedTokensPath: z.string().nullable(),
})

// ─── Default ─────────────────────────────────────────────────────────────────

/**
 * Typed default returned by `resolveFixture` when no `.flint-fixture.json`
 * is found in the walk-up chain.
 *
 * - `surface: 'component'` — safest default; document-level rules are
 *   suppressed, avoiding mass false-positives on component fixtures.
 * - `source: null` — no fixture file was found.
 * - `resolvedTokensPath: null` — no token file declared.
 */
export const DEFAULT_FIXTURE: ResolvedFixture = {
  fixture: {
    surface: 'component',
  },
  source: null,
  resolvedTokensPath: null,
}
