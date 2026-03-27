/**
 * SvelteAdapter.test.ts — MFP.3: SvelteAdapter unit tests
 *
 * Tests the SvelteAdapter stub implementation against the IFlintAdapter contract.
 *
 * Coverage:
 *   SA-01 — parse() returns a SvelteSection for a valid .svelte file
 *   SA-02 — parse() returns null for empty input
 *   SA-03 — parse() returns null for whitespace-only input
 *   SA-04 — parse() extracts the <script> block
 *   SA-05 — parse() extracts the <style> block
 *   SA-06 — parse() extracts the markup section (everything outside script/style)
 *   SA-07 — parse() handles a template-only component (no script, no style)
 *   SA-08 — generate() reconstructs source from a SvelteSection
 *   SA-09 — generate() round-trips: parse → generate preserves content
 *   SA-10 — injectFlintIds() adds data-flint-id to markup elements
 *   SA-11 — injectFlintIds() is idempotent (does not double-inject IDs)
 *   SA-12 — injectFlintIds() does not inject into <script> or <style> tags
 *   SA-13 — buildVisualTree() returns layers for each data-flint-id element
 *   SA-14 — buildVisualTree() returns empty array for markup with no elements
 *   SA-15 — nodeExists() returns true when data-flint-id appears in code
 *   SA-16 — nodeExists() returns false when data-flint-id is absent
 *   SA-17 — applyMutationBatch() returns code unchanged (stub)
 *   SA-18 — applyMutationBatch() returns snapshot inversions for each mutation
 *   SA-19 — validateInMemory() returns null
 *   SA-20 — extractNode() returns null (stub)
 *   SA-21 — transplantNode() does not throw (stub no-op)
 *   SA-22 — svelteAdapter singleton is exported and is a SvelteAdapter instance
 */

import { describe, it, expect } from 'vitest'
import { SvelteAdapter, svelteAdapter, type SvelteSection } from '../SvelteAdapter'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_SVELTE = `<script>
  let count = 0;
  function increment() { count++; }
</script>

<button on:click={increment} data-testid="btn">{count}</button>
<p class="text-red-500">Counter demo</p>

<style>
  button { background: blue; color: white; }
  p { font-size: 14px; }
</style>`

const TEMPLATE_ONLY = `<div class="container">
  <h1>Hello World</h1>
  <p>Welcome to Svelte</p>
</div>`

// ── SA-01 through SA-07: parse() ─────────────────────────────────────────────

describe('SvelteAdapter.parse()', () => {
  const adapter = new SvelteAdapter()

  it('SA-01: returns a SvelteSection for a valid .svelte file', () => {
    const result = adapter.parse(FULL_SVELTE)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('object')
    expect(result).toHaveProperty('markup')
    expect(result).toHaveProperty('script')
    expect(result).toHaveProperty('style')
  })

  it('SA-02: returns null for empty string', () => {
    expect(adapter.parse('')).toBeNull()
  })

  it('SA-03: returns null for whitespace-only input', () => {
    expect(adapter.parse('   \n\t  ')).toBeNull()
  })

  it('SA-04: extracts the <script> block', () => {
    const result = adapter.parse(FULL_SVELTE) as SvelteSection
    expect(result.script).toContain('<script>')
    expect(result.script).toContain('let count = 0')
    expect(result.script).toContain('</script>')
  })

  it('SA-05: extracts the <style> block', () => {
    const result = adapter.parse(FULL_SVELTE) as SvelteSection
    expect(result.style).toContain('<style>')
    expect(result.style).toContain('background: blue')
    expect(result.style).toContain('</style>')
  })

  it('SA-06: markup section contains template elements but not script/style blocks', () => {
    const result = adapter.parse(FULL_SVELTE) as SvelteSection
    expect(result.markup).toContain('<button')
    expect(result.markup).toContain('Counter demo')
    // Script and style blocks must not be in markup
    expect(result.markup).not.toContain('let count = 0')
    expect(result.markup).not.toContain('background: blue')
  })

  it('SA-07: handles template-only component (no script, no style)', () => {
    const result = adapter.parse(TEMPLATE_ONLY) as SvelteSection
    expect(result).not.toBeNull()
    expect(result.script).toBe('')
    expect(result.style).toBe('')
    expect(result.markup).toContain('<div')
    expect(result.markup).toContain('Hello World')
  })
})

// ── SA-08 through SA-09: generate() ──────────────────────────────────────────

describe('SvelteAdapter.generate()', () => {
  const adapter = new SvelteAdapter()

  it('SA-08: reassembles a SvelteSection into source text', () => {
    const sections: SvelteSection = {
      script: '<script>\n  let x = 1;\n</script>',
      markup: '<p>{x}</p>',
      style: '<style>\n  p { color: blue; }\n</style>',
    }
    const result = adapter.generate(sections)
    expect(result).toContain('let x = 1')
    expect(result).toContain('<p>{x}</p>')
    expect(result).toContain('p { color: blue; }')
  })

  it('SA-09: round-trips: parse → generate preserves all content', () => {
    const parsed = adapter.parse(FULL_SVELTE)
    const regenerated = adapter.generate(parsed)
    // All key content sections should be preserved
    expect(regenerated).toContain('let count = 0')
    expect(regenerated).toContain('Counter demo')
    expect(regenerated).toContain('background: blue')
  })
})

// ── SA-10 through SA-12: injectFlintIds() ────────────────────────────────────

describe('SvelteAdapter.injectFlintIds()', () => {
  const adapter = new SvelteAdapter()

  it('SA-10: adds data-flint-id to markup elements', () => {
    const parsed = adapter.parse(TEMPLATE_ONLY)
    adapter.injectFlintIds(parsed)
    const sections = parsed as SvelteSection
    expect(sections.markup).toContain('data-flint-id=')
  })

  it('SA-11: is idempotent — does not double-inject IDs', () => {
    const parsed = adapter.parse(TEMPLATE_ONLY)
    adapter.injectFlintIds(parsed)
    const firstPass = (parsed as SvelteSection).markup
    adapter.injectFlintIds(parsed)
    const secondPass = (parsed as SvelteSection).markup
    // The second pass should not add more IDs than the first
    const countFirst = (firstPass.match(/data-flint-id=/g) ?? []).length
    const countSecond = (secondPass.match(/data-flint-id=/g) ?? []).length
    expect(countSecond).toBe(countFirst)
  })

  it('SA-12: does not inject into <script> or <style> block tags', () => {
    const parsed = adapter.parse(FULL_SVELTE)
    adapter.injectFlintIds(parsed)
    const sections = parsed as SvelteSection
    // The script and style blocks themselves must not receive data-flint-id
    expect(sections.script).not.toContain('data-flint-id=')
    expect(sections.style).not.toContain('data-flint-id=')
  })
})

// ── SA-13 through SA-14: buildVisualTree() ────────────────────────────────────

describe('SvelteAdapter.buildVisualTree()', () => {
  const adapter = new SvelteAdapter()

  it('SA-13: returns layers for each injected data-flint-id element', () => {
    const parsed = adapter.parse(TEMPLATE_ONLY)
    adapter.injectFlintIds(parsed)
    const layers = adapter.buildVisualTree(parsed)
    expect(Array.isArray(layers)).toBe(true)
    expect(layers.length).toBeGreaterThan(0)
    for (const layer of layers) {
      expect(typeof layer.id).toBe('string')
      expect(typeof layer.tagName).toBe('string')
    }
  })

  it('SA-14: returns empty array for markup with no elements', () => {
    const emptySection: SvelteSection = { markup: 'Just some text', script: '', style: '' }
    const layers = adapter.buildVisualTree(emptySection)
    expect(Array.isArray(layers)).toBe(true)
    // Text nodes with no tags → no layers
    expect(layers).toHaveLength(0)
  })

  it('layer tagName matches the HTML element type', () => {
    // Parse a component with a single known element
    const parsed = adapter.parse('<div class="wrapper"><span>text</span></div>')
    adapter.injectFlintIds(parsed)
    const layers = adapter.buildVisualTree(parsed)
    const tagNames = layers.map(l => l.tagName.toLowerCase())
    expect(tagNames).toContain('div')
  })
})

// ── SA-15 through SA-16: nodeExists() ────────────────────────────────────────

describe('SvelteAdapter.nodeExists()', () => {
  const adapter = new SvelteAdapter()

  it('SA-15: returns true when data-flint-id is present in code', () => {
    const code = '<div data-flint-id="svelte-abc12345">Hello</div>'
    expect(adapter.nodeExists(code, 'svelte-abc12345')).toBe(true)
  })

  it('SA-16: returns false when data-flint-id is absent', () => {
    const code = '<div class="foo">Hello</div>'
    expect(adapter.nodeExists(code, 'svelte-abc12345')).toBe(false)
  })

  it('returns false for empty code', () => {
    expect(adapter.nodeExists('', 'svelte-abc12345')).toBe(false)
  })

  it('is case-sensitive for the ID value', () => {
    const code = '<div data-flint-id="SVELTE-ABC">text</div>'
    expect(adapter.nodeExists(code, 'svelte-abc')).toBe(false)
    expect(adapter.nodeExists(code, 'SVELTE-ABC')).toBe(true)
  })
})

// ── SA-17 through SA-18: applyMutationBatch() ────────────────────────────────

describe('SvelteAdapter.applyMutationBatch()', () => {
  const adapter = new SvelteAdapter()

  it('SA-17: returns code unchanged (stub)', () => {
    const code = FULL_SVELTE
    const { code: returned } = adapter.applyMutationBatch(code, [])
    expect(returned).toBe(code)
  })

  it('SA-18: returns one snapshot inversion per mutation', () => {
    const code = FULL_SVELTE
    const mutations = [
      { op: 'updateClassName' as const, nodeId: 'svelte-abc', className: 'foo' },
      { op: 'updateTextContent' as const, nodeId: 'svelte-def', text: 'bar' },
    ]
    const { inversions } = adapter.applyMutationBatch(code, mutations)
    expect(inversions).toHaveLength(2)
    for (const inv of inversions) {
      expect(inv.op).toBe('restoreCode')
      expect((inv as { op: string; code: string }).code).toBe(code)
    }
  })

  it('returns empty inversions array for zero mutations', () => {
    const { inversions } = adapter.applyMutationBatch(FULL_SVELTE, [])
    expect(inversions).toHaveLength(0)
  })
})

// ── SA-19 through SA-21: remaining stubs ─────────────────────────────────────

describe('SvelteAdapter — remaining stubs', () => {
  const adapter = new SvelteAdapter()

  it('SA-19: validateInMemory() always returns null', () => {
    expect(adapter.validateInMemory(FULL_SVELTE)).toBeNull()
    expect(adapter.validateInMemory('')).toBeNull()
  })

  it('SA-20: extractNode() returns null', () => {
    const parsed = adapter.parse(FULL_SVELTE)
    expect(adapter.extractNode(parsed, 'any-id')).toBeNull()
  })

  it('SA-21: transplantNode() does not throw', () => {
    const live = adapter.parse(FULL_SVELTE)
    const historic = adapter.parse(FULL_SVELTE)
    expect(() => adapter.transplantNode(live, historic, 'any-id')).not.toThrow()
  })
})

// ── SA-22: singleton export ───────────────────────────────────────────────────

describe('svelteAdapter singleton', () => {
  it('SA-22: is exported and is a SvelteAdapter instance', () => {
    expect(svelteAdapter).toBeInstanceOf(SvelteAdapter)
  })

  it('singleton parse() works the same as instance parse()', () => {
    const result = svelteAdapter.parse(TEMPLATE_ONLY)
    expect(result).not.toBeNull()
    expect((result as SvelteSection).markup).toContain('<div')
  })
})
