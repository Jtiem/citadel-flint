/**
 * snippetAuditor — src/core/surgery/snippetAuditor.test.ts
 *
 * Stress Test Suite: [CLAUDE-CONSTRUCTION-DIRECTIVE-v6.6] B.1-b
 *
 * Four adversarial stress categories:
 *   1. Nested Shadow  — nested .map() must get unique index names (no shadowing)
 *   2. Fragment Chaos — fragment roots must not receive data-bridge-id (no crash)
 *   3. Precision Threshold — ΔE just below 2.0 (auto-fix) vs. just above (throw)
 *   4. Idempotency    — running the auditor twice must produce a 1:1 string match
 *
 * All tests are pure/headless: no React, no Electron IPC, no window.bridgeAPI.
 */

import { describe, it, expect } from 'vitest'
import { auditSnippet, MithrilViolationError } from './snippetAuditor'
import { findClosestToken } from '../../utils/tokenMatcher'
import type { DesignToken } from '../../types/bridge-api'

// ── Token factory ─────────────────────────────────────────────────────────────

function makeColorToken(path: string, value: string, id = 1): DesignToken {
    return {
        id,
        token_path: path,
        token_type: 'color',
        token_value: value,
        description: null,
        mode: 'default',
        collection_name: 'test',
    }
}

// ── Stress Category 1: Nested Shadow Test ─────────────────────────────────────

describe('Nested Shadow Test', () => {

    // 1-a: Both maps start with no index param — outer gets 'index', inner gets 'index_1'
    it('assigns unique index names to nested .map() callbacks', () => {
        const raw = `
const List = () => items.map((item) => (
  <div>
    {item.subs.map((sub) => (
      <span>{sub}</span>
    ))}
  </div>
))
`
        const out = auditSnippet(raw)

        // Outer map: params become (item, index)
        expect(out).toMatch(/\.map\(\(item,\s*index\)/)
        // Inner map: params become (sub, index_1) — NOT (sub, index)
        expect(out).toMatch(/\.map\(\(sub,\s*index_1\)/)
        // outer div stamped with index
        expect(out).toContain('data-bridge-id={`node-${index}`}')
        // inner span stamped with index_1
        expect(out).toContain('data-bridge-id={`node-${index_1}`}')
        // Ensure the raw word 'index_1' is used and 'index' is not used for inner
        const innerMapMatch = /\.map\(\(sub,\s*([\w_]+)\)/.exec(out)
        expect(innerMapMatch?.[1]).toBe('index_1')
    })

    // 1-b: Triple nesting — three levels get 'index', 'index_1', 'index_2'
    it('assigns index_2 to a triply-nested .map()', () => {
        const raw = `
const A = () => a.map((x) => (
  <div>
    {x.bs.map((y) => (
      <ul>
        {y.cs.map((z) => (
          <li>{z}</li>
        ))}
      </ul>
    ))}
  </div>
))
`
        const out = auditSnippet(raw)
        expect(out).toMatch(/\.map\(\(x,\s*index\)/)
        expect(out).toMatch(/\.map\(\(y,\s*index_1\)/)
        expect(out).toMatch(/\.map\(\(z,\s*index_2\)/)
        expect(out).toContain('data-bridge-id={`node-${index}`}')
        expect(out).toContain('data-bridge-id={`node-${index_1}`}')
        expect(out).toContain('data-bridge-id={`node-${index_2}`}')
    })

    // 1-c: Outer map already has explicit (item, index) — inner must still get index_1
    it('respects an explicit outer index param and uses index_1 for the inner map', () => {
        const raw = `
const B = () => items.map((item, index) => (
  <div>
    {item.subs.map((sub) => (
      <span key={sub}>{sub}</span>
    ))}
  </div>
))
`
        const out = auditSnippet(raw)
        // Outer is untouched — still (item, index)
        expect(out).toMatch(/\.map\(\(item,\s*index\)/)
        // Inner gets index_1 to avoid shadowing
        expect(out).toMatch(/\.map\(\(sub,\s*index_1\)/)
        expect(out).toContain('data-bridge-id={`node-${index_1}`}')
    })

    // 1-d: Already has data-bridge-id — must not double-inject
    it('does not inject a second data-bridge-id when one is already present', () => {
        const raw = `
const C = () => items.map((item, index) => (
  <div data-bridge-id={\`node-\${index}\`}>{item.name}</div>
))
`
        const out = auditSnippet(raw)
        const count = (out.match(/data-bridge-id/g) ?? []).length
        expect(count).toBe(1)
    })

    // 1-e: Sibling (non-nested) maps both get 'index' — no conflict between siblings
    it('allows sibling .map() calls to independently use "index"', () => {
        const raw = `
const D = () => (
  <div>
    {aList.map((a) => <span>{a}</span>)}
    {bList.map((b) => <em>{b}</em>)}
  </div>
)
`
        const out = auditSnippet(raw)
        // Both siblings may independently use 'index' since they are not nested
        const mapMatches = [...out.matchAll(/\.map\(\((\w+),\s*([\w_]+)\)/g)]
        expect(mapMatches).toHaveLength(2)
        // Each sibling gets 'index' (they exit scope before the next sibling enters)
        expect(mapMatches[0]?.[2]).toBe('index')
        expect(mapMatches[1]?.[2]).toBe('index')
    })
})

// ── Stress Category 2: Fragment Chaos Test ─────────────────────────────────────

describe('Fragment Chaos Test', () => {

    // 2-a: Expression-body fragment — index injected, no data-bridge-id (can't prop a fragment)
    it('adds the index param for an expression-body fragment, but does not inject data-bridge-id', () => {
        const raw = `
const E = () => items.map((item) => (
  <>
    <dt>{item.label}</dt>
    <dd>{item.value}</dd>
  </>
))
`
        const out = auditSnippet(raw)
        // index IS injected
        expect(out).toMatch(/\.map\(\(item,\s*index\)/)
        // data-bridge-id is NOT injected (fragments have no props)
        expect(out).not.toContain('data-bridge-id')
    })

    // 2-b: Block-body fragment — same graceful handling
    it('handles a block-body arrow returning a fragment without crashing', () => {
        const raw = `
const F = () => items.map((item) => {
  return (
    <>
      <span>{item.name}</span>
    </>
  )
})
`
        const out = auditSnippet(raw)
        expect(out).toMatch(/\.map\(\(item,\s*index\)/)
        expect(out).not.toContain('data-bridge-id')
    })

    // 2-c: Array return (multiple root elements without a wrapper) — no data-bridge-id
    it('does not crash when the map callback returns an array of elements', () => {
        const raw = `
const G = () => items.map((item) => [
  <dt key="label">{item.label}</dt>,
  <dd key="value">{item.value}</dd>,
])
`
        const out = auditSnippet(raw)
        // index param still gets injected
        expect(out).toMatch(/\.map\(\(item,\s*index\)/)
        // no data-bridge-id since root is an ArrayExpression, not a JSXElement
        expect(out).not.toContain('data-bridge-id')
    })
})

// ── Stress Category 3: Precision Threshold Test ────────────────────────────────

describe('Precision Threshold Test', () => {
    // Token: pure white #ffffff
    // Close hex: #f6f6f6 — ΔE ≈ 1.81 (below 2.0 → must auto-fix)
    // Threshold hex: #f5f5f5 — ΔE ≈ 2.01 (at/above 2.0 → must throw)
    //
    // ΔE values verified at runtime by findClosestToken (same engine as snippetAuditor).

    const whiteToken = makeColorToken('color.surface.base', '#ffffff')

    it('verifies test fixture: #f6f6f6 is ΔE < 2.0 from #ffffff', () => {
        const result = findClosestToken('#f6f6f6', [whiteToken])
        expect(result).not.toBeNull()
        expect(result!.deltaE).toBeLessThan(2.0)
    })

    it('verifies test fixture: #f5f5f5 is ΔE >= 2.0 from #ffffff', () => {
        const result = findClosestToken('#f5f5f5', [whiteToken])
        expect(result).not.toBeNull()
        expect(result!.deltaE).toBeGreaterThanOrEqual(2.0)
    })

    // 3-a: ΔE < 2.0 → color auto-fixed to CSS custom property
    it('replaces a style hex with ΔE < 2.0 with the token CSS variable', () => {
        const raw = `const H = () => <div style={{ backgroundColor: '#f6f6f6' }} />`
        const out = auditSnippet(raw, [whiteToken])
        // hex is gone
        expect(out).not.toContain('#f6f6f6')
        // replaced with the CSS var
        expect(out).toContain('var(--bridge-token-color-surface-base)')
    })

    // 3-b: ΔE >= 2.0 → MithrilViolationError thrown (hard gate)
    it('throws MithrilViolationError for a style hex with ΔE >= 2.0', () => {
        const raw = `const I = () => <div style={{ backgroundColor: '#f5f5f5' }} />`
        expect(() => auditSnippet(raw, [whiteToken])).toThrow(MithrilViolationError)
    })

    // 3-c: All violations are collected before throwing (no partial output)
    it('reports all offending hex values in a single MithrilViolationError', () => {
        const raw = `
const J = () => (
  <div
    style={{
      color: '#f5f5f5',
      backgroundColor: '#f4f4f4',
    }}
  />
)
`
        let err: MithrilViolationError | null = null
        try {
            auditSnippet(raw, [whiteToken])
        } catch (e) {
            if (e instanceof MithrilViolationError) err = e
        }
        expect(err).not.toBeNull()
        // Both violations must be in the report
        expect(err!.violations).toHaveLength(2)
        expect(err!.violations.some(v => v.includes('#f5f5f5'))).toBe(true)
        expect(err!.violations.some(v => v.includes('#f4f4f4'))).toBe(true)
    })

    // 3-d: No tokens provided — color gate is completely skipped
    it('skips the colour gate when the token list is empty', () => {
        const raw = `const K = () => <div style={{ color: '#f5f5f5' }} />`
        // Must not throw even though #f5f5f5 would normally violate
        expect(() => auditSnippet(raw, [])).not.toThrow()
        const out = auditSnippet(raw, [])
        // hex preserved unchanged
        expect(out).toContain('#f5f5f5')
    })

    // 3-e: Non-colour CSS properties are not inspected
    it('ignores non-colour CSS properties in style objects', () => {
        const raw = `const L = () => <div style={{ padding: '#f5f5f5', fontSize: '#f5f5f5' }} />`
        // 'padding' and 'fontSize' are not in CSS_COLOR_PROPS → no violation
        expect(() => auditSnippet(raw, [whiteToken])).not.toThrow()
    })

    // 3-f: CSS var values already present are not re-processed
    it('leaves already-substituted CSS vars untouched', () => {
        const raw = `const M = () => <div style={{ color: 'var(--bridge-token-color-surface-base)' }} />`
        // 'var(...)' does not match HEX_RE → colour gate skips it → no violation
        expect(() => auditSnippet(raw, [whiteToken])).not.toThrow()
        const out = auditSnippet(raw, [whiteToken])
        expect(out).toContain('var(--bridge-token-color-surface-base)')
    })
})

// ── Stress Category 4: Idempotency Test ────────────────────────────────────────

describe('Idempotency Test', () => {

    // 4-a: Commandment 3 output is stable on second pass
    it('produces identical output when run on an already-audited snippet (Commandment 3)', () => {
        const raw = `
const N = () => items.map((item) => (
  <li className="p-4">{item.name}</li>
))
`
        const out1 = auditSnippet(raw)
        const out2 = auditSnippet(out1)
        expect(out2).toBe(out1)
    })

    // 4-b: Colour-gate output is stable on second pass
    it('produces identical output when run on an already-audited snippet (colour gate)', () => {
        const raw = `const O = () => <div style={{ color: '#f6f6f6' }} />`
        const tokens = [makeColorToken('color.surface.base', '#ffffff')]
        const out1 = auditSnippet(raw, tokens)
        // out1 has var(--bridge-token-...) instead of #f6f6f6
        const out2 = auditSnippet(out1, tokens)
        expect(out2).toBe(out1)
    })

    // 4-c: Combined audited output is stable
    it('produces identical output when both transforms are already applied', () => {
        const raw = `
const P = () => items.map((item) => (
  <div style={{ backgroundColor: '#f6f6f6' }}>{item.name}</div>
))
`
        const tokens = [makeColorToken('color.surface.base', '#ffffff')]
        const out1 = auditSnippet(raw, tokens)
        const out2 = auditSnippet(out1, tokens)
        expect(out2).toBe(out1)
    })
})

// ── Additional edge cases ──────────────────────────────────────────────────────

describe('Edge cases', () => {

    // Parse failure → MithrilViolationError
    it('throws MithrilViolationError on unparseable input', () => {
        expect(() => auditSnippet('!!! not valid jsx >>>')).toThrow(MithrilViolationError)
    })

    // Block-body map with explicit return — Commandment 3 still applies
    it('injects data-bridge-id into the return JSXElement of a block-body callback', () => {
        const raw = `
const Q = () => items.map((item) => {
  const label = item.name.toUpperCase()
  return <span title={label}>{item.name}</span>
})
`
        const out = auditSnippet(raw)
        expect(out).toMatch(/\.map\(\(item,\s*index\)/)
        expect(out).toContain('data-bridge-id={`node-${index}`}')
    })

    // No .map() calls → code returned unchanged (minus Babel normalisation)
    it('returns code without modification when there are no .map() calls', () => {
        const raw = `const R = () => <div className="text-white">hello</div>`
        const out = auditSnippet(raw)
        expect(out).not.toContain('data-bridge-id')
        expect(out).not.toContain('index')
    })

    // CSS tokenPathToCssVar — dots in path become hyphens
    it('converts dot-path token names to hyphenated CSS custom-property references', () => {
        const token = makeColorToken('color.brand.primary', '#f6f6f6')
        const raw = `const S = () => <div style={{ color: '#f6f6f6' }} />`
        const out = auditSnippet(raw, [token])
        expect(out).toContain('var(--bridge-token-color-brand-primary)')
    })
})
