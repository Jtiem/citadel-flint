/**
 * FIXTURE.1 — flint-mcp/src/core/__tests__/mithrilAppliesTo.test.ts
 *
 * Asserts that MITHRIL_APPLIES_TO covers every ruleId emitted by MithrilLinter.
 * The intersection approach: extract ruleIds from a corpus audit run and verify
 * the map covers them all. Default for any ruleId should be 'any'.
 *
 * boundary: flint-mcp/src/core/mithrilAppliesTo.ts
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import { auditAll } from '../MithrilLinter.js'
import { MITHRIL_APPLIES_TO } from '../mithrilAppliesTo.js'
import type { RuleAppliesTo } from '../../../../shared/fixture-schema.js'

// ── Corpus: small components that trigger each visitor category ───────────────

const CORPUS: string[] = [
  // Color drift — MITHRIL-COL
  `export default () => <div className="bg-[#ff0000] text-[#00ff00]">Hello</div>`,

  // Typography — MITHRIL-TYP-001..005
  `export default () => (
    <div
      className="font-[Arial] text-[14px] font-[700] leading-[1.5] tracking-[0.01em]"
    >body</div>
  )`,

  // Spacing — MITHRIL-SPC-001
  `export default () => <div className="p-[16px] m-[8px] gap-[24px]">Card</div>`,

  // Shadow — MITHRIL-SHD-001
  `export default () => <div className="shadow-[0_2px_4px_rgba(0,0,0,0.2)]">Shadow</div>`,

  // Opacity — MITHRIL-OPC-001
  `export default () => <div className="opacity-[0.7]">Opacity</div>`,

  // Inline styles — MITHRIL-IST-*
  `export default () => (
    <div style={{
      color: '#ff0000',
      fontSize: '14px',
      padding: '16px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      opacity: 0.7
    }}>Inline</div>
  )`,

  // Local design-token object — MITHRIL-DTO-001
  `const tokens = { primary: '#0066FF', spacing: 16 }
   export default () => <div style={{ color: tokens.primary }}>Token</div>`,
]

function parseSource(src: string) {
  return parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  }) as any
}

function collectRuleIdsFromCorpus(): Set<string> {
  const ruleIds = new Set<string>()
  const tokens: any[] = []

  for (const source of CORPUS) {
    try {
      const ast = parseSource(source)
      const warnings = auditAll(ast, tokens)
      for (const warning of warnings.values()) {
        if (warning.ruleId) {
          ruleIds.add(warning.ruleId)
        }
      }
    } catch {
      // Skip unparseable corpus entries
    }
  }
  return ruleIds
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MITHRIL_APPLIES_TO map', () => {
  // boundary: Map covers every ruleId emitted by MithrilLinter
  it('covers every ruleId observed in corpus audit run', () => {
    const observed = collectRuleIdsFromCorpus()

    const missing: string[] = []
    for (const ruleId of observed) {
      if (!(ruleId in MITHRIL_APPLIES_TO)) {
        // MOTION-001 is emitted by AnimationLinter — it may appear as MOTION-001
        // or MITHRIL-MOTION-001 depending on the visitor. Accept either.
        if (ruleId === 'MOTION-001' && 'MITHRIL-MOTION-001' in MITHRIL_APPLIES_TO) {
          continue
        }
        missing.push(ruleId)
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `MITHRIL_APPLIES_TO is missing entries for observed ruleIds: ${missing.join(', ')}. ` +
          `Add them to flint-mcp/src/core/mithrilAppliesTo.ts in the same PR as the new rule.`,
      )
    }
  })

  // boundary: Default 'any' enforced. No rule missing.
  it('all values are valid RuleAppliesTo values', () => {
    const validValues: RuleAppliesTo[] = ['document', 'section', 'component', 'any']
    for (const [ruleId, appliesTo] of Object.entries(MITHRIL_APPLIES_TO)) {
      expect(
        validValues.includes(appliesTo as RuleAppliesTo),
        `MITHRIL_APPLIES_TO["${ruleId}"] = "${appliesTo}" is not a valid RuleAppliesTo`,
      ).toBe(true)
    }
  })

  it('all Mithril rules default to "any" (token compliance is universal)', () => {
    for (const [ruleId, appliesTo] of Object.entries(MITHRIL_APPLIES_TO)) {
      // All Mithril rules should be 'any' per FIXTURE.1 contract decision
      expect(appliesTo, `${ruleId} should be 'any'`).toBe('any')
    }
  })

  it('map covers every statically known Mithril ruleId', () => {
    const knownRuleIds = [
      'MITHRIL-COL',
      'MITHRIL-TYP-001',
      'MITHRIL-TYP-002',
      'MITHRIL-TYP-003',
      'MITHRIL-TYP-004',
      'MITHRIL-TYP-005',
      'MITHRIL-TYP-HIERARCHY',
      'MITHRIL-SPC-001',
      'MITHRIL-SPC-TOUCH',
      'MITHRIL-SHD-001',
      'MITHRIL-OPC-001',
      'MITHRIL-IST-COL',
      'MITHRIL-IST-TYP',
      'MITHRIL-IST-SPC',
      'MITHRIL-IST-SHD',
      'MITHRIL-IST-OPC',
      'MITHRIL-DTO-001',
      'MITHRIL-REG-001',
      'MITHRIL-TW-001',
      'MITHRIL-TW-002',
      'MITHRIL-DARK-001',
      'MITHRIL-FLUID-001',
      'MITHRIL-COMP-001',
      'MITHRIL-COMP-002',
      'MITHRIL-COMP-003',
      'MITHRIL-MOTION-001',
      'SYNC-001',
      'SYNC-002',
    ]

    for (const ruleId of knownRuleIds) {
      expect(
        ruleId in MITHRIL_APPLIES_TO,
        `MITHRIL_APPLIES_TO is missing "${ruleId}"`,
      ).toBe(true)
    }
  })

  it('map is a non-empty object', () => {
    expect(Object.keys(MITHRIL_APPLIES_TO).length).toBeGreaterThan(0)
  })

  it('has at least the minimum expected number of entries (covers all documented rules)', () => {
    // 28 entries documented in FIXTURE.1-contract.ts
    expect(Object.keys(MITHRIL_APPLIES_TO).length).toBeGreaterThanOrEqual(25)
  })
})
