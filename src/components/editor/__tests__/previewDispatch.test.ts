/**
 * previewDispatch.test.ts
 *
 * MFP.1 — Tests for the framework dispatch refactor in LivePreview.tsx.
 * Covers: buildPlaceholderSrcdoc, interaction script extraction verification
 * in srcdoc builders, and the CDN violation fix in buildHtmlSrcdoc.
 *
 * Tests:
 *   PD-01 — buildPlaceholderSrcdoc renders framework name for "Vue"
 *   PD-02 — buildPlaceholderSrcdoc renders framework name for "Svelte"
 *   PD-03 — buildPlaceholderSrcdoc renders framework name for arbitrary string
 *   PD-04 — buildPlaceholderSrcdoc produces a valid HTML document
 *   PD-05 — FLINT_INTERACTION_SCRIPT is a non-empty string (cross-module sanity)
 *   PD-06 — FLINT_INTERACTION_STYLES contains .flint-selected class
 *   PD-07 — buildSrcdoc still produces valid HTML (regression)
 *   PD-08 — buildSrcdoc output includes the interaction script (not inlined duplicate)
 *   PD-09 — buildSrcdoc output includes the shared CSS styles
 *   PD-10 — buildHtmlSrcdoc does NOT contain cdn.tailwindcss.com (C4 fix)
 *   PD-11 — buildHtmlSrcdoc output includes the interaction script
 *   PD-12 — buildHtmlSrcdoc output includes the shared CSS styles
 *   PD-13 — buildHtmlSrcdoc produces a valid HTML document
 *   PD-14 — buildPlaceholderSrcdoc for "Vue" does not contain cdn.tailwindcss.com
 *   PD-15 — buildPlaceholderSrcdoc output is a complete HTML document
 */

import { describe, it, expect } from 'vitest'
import { buildSrcdoc, buildHtmlSrcdoc, buildPlaceholderSrcdoc } from '../LivePreview'
import {
  FLINT_INTERACTION_SCRIPT,
  FLINT_INTERACTION_STYLES,
} from '../../../preview-vendor/flint-interaction'

// ── Shared fixtures ────────────────────────────────────────────────────────────

const SAMPLE_JS = 'window.__AppComponent = function App() { return React.createElement("div", null, "Hello"); };'
const SAMPLE_CONFIG = '{"theme":{"extend":{}}}'
const SAMPLE_HTML = '<body><div data-flint-id="root-1"><h1>Hello</h1></div></body>'

// ── PD-01 through PD-04: buildPlaceholderSrcdoc ────────────────────────────────

describe('buildPlaceholderSrcdoc', () => {
  it('PD-01: renders "Vue" in the placeholder message', () => {
    const html = buildPlaceholderSrcdoc('Vue')
    expect(html).toContain('Vue')
  })

  it('PD-02: renders "Svelte" in the placeholder message', () => {
    const html = buildPlaceholderSrcdoc('Svelte')
    expect(html).toContain('Svelte')
  })

  it('PD-03: renders an arbitrary framework name', () => {
    const html = buildPlaceholderSrcdoc('TestFramework')
    expect(html).toContain('TestFramework')
  })

  it('PD-04: produces a valid HTML document structure', () => {
    const html = buildPlaceholderSrcdoc('Vue')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('PD-14: does not reference cdn.tailwindcss.com (Commandment 4)', () => {
    const html = buildPlaceholderSrcdoc('Vue')
    expect(html).not.toContain('cdn.tailwindcss.com')
  })

  it('PD-15: is a complete HTML document (no undefined/null interpolated)', () => {
    const html = buildPlaceholderSrcdoc('Vue')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })

  it('Vue and Svelte placeholders produce different output', () => {
    const vue = buildPlaceholderSrcdoc('Vue')
    const svelte = buildPlaceholderSrcdoc('Svelte')
    expect(vue).not.toBe(svelte)
  })
})

// ── PD-05 & PD-06: Shared constants cross-module sanity ───────────────────────

describe('FLINT_INTERACTION constants (cross-module import)', () => {
  it('PD-05: FLINT_INTERACTION_SCRIPT is a non-empty string', () => {
    expect(typeof FLINT_INTERACTION_SCRIPT).toBe('string')
    expect(FLINT_INTERACTION_SCRIPT.length).toBeGreaterThan(100)
  })

  it('PD-06: FLINT_INTERACTION_STYLES contains .flint-selected class', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('.flint-selected')
  })
})

// ── PD-07 through PD-09: buildSrcdoc regression ───────────────────────────────

describe('buildSrcdoc (regression after MFP.1 refactor)', () => {
  it('PD-07: produces a valid HTML document', () => {
    const html = buildSrcdoc(SAMPLE_JS, SAMPLE_CONFIG, null)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('PD-08: output includes the shared interaction script content', () => {
    const html = buildSrcdoc(SAMPLE_JS, SAMPLE_CONFIG, null)
    // Verify the canonical message handler strings from the shared script are present
    expect(html).toContain('SET_INTERACT_MODE')
    expect(html).toContain('HIGHLIGHT')
    expect(html).toContain('CANVAS_CLICK')
    expect(html).toContain('CANVAS_DRAG_START')
    expect(html).toContain('HIT_TEST_RESULT')
  })

  it('PD-09: output includes the shared CSS styles', () => {
    const html = buildSrcdoc(SAMPLE_JS, SAMPLE_CONFIG, null)
    expect(html).toContain('.flint-selected')
    expect(html).toContain('.flint-hovered')
    expect(html).toContain('.flint-drop-before')
    expect(html).toContain('#flint-ghost')
  })

  it('still embeds the React UMD runtime', () => {
    const html = buildSrcdoc(SAMPLE_JS, SAMPLE_CONFIG, null)
    // React UMD is bundled inline — check for its characteristic export pattern
    expect(html).toContain('ReactDOM')
    expect(html).toContain('React')
  })

  it('embeds the sample JS code', () => {
    const html = buildSrcdoc(SAMPLE_JS, SAMPLE_CONFIG, null)
    expect(html).toContain('__AppComponent')
  })

  it('applies tailwind config', () => {
    const html = buildSrcdoc(SAMPLE_JS, SAMPLE_CONFIG, null)
    expect(html).toContain('tailwind.config =')
    expect(html).toContain(SAMPLE_CONFIG)
  })
})

// ── PD-10 through PD-13: buildHtmlSrcdoc CDN fix + regression ─────────────────

describe('buildHtmlSrcdoc (CDN fix + regression after MFP.1 refactor)', () => {
  it('PD-10: does NOT load Tailwind via a <script src> CDN tag (Commandment 4 fix)', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    // The pre-C4 violation was: <script src="https://cdn.tailwindcss.com">
    // The vendored tailwind-cdn.js contains a console.warn mentioning "cdn.tailwindcss.com"
    // but that is acceptable — the violation is loading it via an external src= attribute.
    expect(html).not.toMatch(/<script[^>]+src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>/)
  })

  it('PD-11: output includes the shared interaction script content', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    expect(html).toContain('SET_INTERACT_MODE')
    expect(html).toContain('HIGHLIGHT')
    expect(html).toContain('CANVAS_CLICK')
    expect(html).toContain('CANVAS_DRAG_START')
    expect(html).toContain('HIT_TEST_RESULT')
  })

  it('PD-12: output includes the shared CSS styles', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    expect(html).toContain('.flint-selected')
    expect(html).toContain('.flint-hovered')
    expect(html).toContain('.flint-drop-before')
    expect(html).toContain('#flint-ghost')
  })

  it('PD-13: produces a valid HTML document', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('includes the body content from input', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    expect(html).toContain('data-flint-id="root-1"')
    expect(html).toContain('<h1>Hello</h1>')
  })

  it('applies tailwind config', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    expect(html).toContain('tailwind.config =')
    expect(html).toContain(SAMPLE_CONFIG)
  })

  it('uses vendored Tailwind (not CDN) — contains inline tailwind script content', () => {
    const html = buildHtmlSrcdoc(SAMPLE_HTML, SAMPLE_CONFIG)
    // The vendored tailwind-cdn.js is inlined; it is much larger than a CDN <script src>
    // Presence of tailwind.config assignment confirms the CDN load succeeded (inline path)
    expect(html).toContain('tailwind.config =')
    // Must not have a src= attribute pointing to tailwind (CDN pattern)
    expect(html).not.toMatch(/<script[^>]+src=[^>]*tailwind[^>]*>/)
  })
})
