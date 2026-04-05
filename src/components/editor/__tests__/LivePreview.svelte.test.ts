/**
 * LivePreview.svelte.test.ts — MFP.3: buildSvelteSrcdoc unit tests
 *
 * Tests the `buildSvelteSrcdoc()` function exported from LivePreview.tsx.
 * These tests are pure — no DOM, no Electron IPC, no Svelte compiler.
 *
 * Coverage:
 *   SVP-01 — buildSvelteSrcdoc produces a valid HTML document structure
 *   SVP-02 — buildSvelteSrcdoc includes the compiled JS via JSON embedding
 *   SVP-03 — buildSvelteSrcdoc includes extracted CSS in a <style> tag
 *   SVP-04 — buildSvelteSrcdoc does NOT include a framework runtime script (unlike Vue)
 *   SVP-05 — buildSvelteSrcdoc includes the Tailwind CDN (vendored)
 *   SVP-06 — buildSvelteSrcdoc applies the Tailwind config
 *   SVP-07 — buildSvelteSrcdoc includes the shared Flint interaction script
 *   SVP-08 — buildSvelteSrcdoc includes the shared Flint interaction CSS styles
 *   SVP-09 — buildSvelteSrcdoc mounts on #app (not #root)
 *   SVP-10 — buildSvelteSrcdoc with empty CSS omits the empty <style> tag
 *   SVP-11 — buildSvelteSrcdoc does NOT contain cdn.tailwindcss.com (Commandment 4)
 *   SVP-12 — buildSvelteSrcdoc does not contain any Vue runtime strings
 *   SVP-13 — buildSvelteSrcdoc embeds the JS safely (no unescaped </script>)
 *   SVP-14 — different compiledJs values produce different output
 */

import { describe, it, expect } from 'vitest'
import { buildSvelteSrcdoc } from '../LivePreview'
import {
  FLINT_INTERACTION_SCRIPT,
  FLINT_INTERACTION_STYLES,
} from '../../../preview-vendor/flint-interaction'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_JS = `
function Counter(options) {
  this._fragment = create_fragment(get_ctx(options));
}
window.__SvelteComponent = Counter;
if (typeof window.__SvelteComponent !== 'undefined') {
  var _target = document.getElementById('app');
  if (_target) { new window.__SvelteComponent({ target: _target }); }
}
`.trim()

const SAMPLE_CSS = `button { color: red; font-size: 14px; }`
const SAMPLE_CONFIG = '{"theme":{"extend":{"colors":{"brand-primary":"#3b82f6"}}}}'

// ── SVP-01 through SVP-04: document structure ──────────────────────────────────

describe('buildSvelteSrcdoc — document structure', () => {
  it('SVP-01: produces a complete HTML document', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body ')
    expect(html).toContain('</html>')
  })

  it('SVP-02: embeds the compiled JS via JSON script tag', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    // The JS is JSON-encoded inside a script[type="application/json"] block
    expect(html).toContain('__svelte_code')
    expect(html).toContain('application/json')
    // JSON.stringify encodes the JS — check for window.__SvelteComponent in encoded form
    expect(html).toContain('window.__SvelteComponent')
  })

  it('SVP-03: injects extracted CSS in a <style> tag', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html).toContain('<style>')
    expect(html).toContain('button { color: red;')
  })

  it('SVP-04: does NOT contain a Vue runtime (unlike buildVueSrcdoc)', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    // Vue.createApp and the Vue global object must not appear
    expect(html).not.toContain('Vue.createApp')
    expect(html).not.toContain('__VueComponent')
    // ReactDOM must not appear either
    expect(html).not.toContain('ReactDOM')
    expect(html).not.toContain('__AppComponent')
  })
})

// ── SVP-05 through SVP-08: vendored assets + interaction script ────────────────

describe('buildSvelteSrcdoc — vendored assets', () => {
  it('SVP-05: includes the vendored Tailwind CDN (inline, not external src)', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    // The vendored tailwind-cdn.js is inlined — it's large and contains characteristic content
    // Tailwind config assignment proves the CDN script executed
    expect(html).toContain('tailwind.config =')
    // Must not be loaded via an external src attribute
    expect(html).not.toMatch(/<script[^>]+src=[^>]*tailwind[^>]*>/)
  })

  it('SVP-06: applies the Tailwind config', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html).toContain('tailwind.config =')
    expect(html).toContain(SAMPLE_CONFIG)
  })

  it('SVP-07: includes the shared Flint interaction script', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    // Check for canonical interaction script handlers
    expect(html).toContain('SET_INTERACT_MODE')
    expect(html).toContain('HIGHLIGHT')
    expect(html).toContain('CANVAS_CLICK')
    expect(html).toContain('CANVAS_DRAG_START')
    expect(html).toContain('HIT_TEST_RESULT')
  })

  it('SVP-08: includes the shared Flint interaction CSS styles', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html).toContain('.flint-selected')
    expect(html).toContain('.flint-hovered')
    expect(html).toContain('.flint-drop-before')
    expect(html).toContain('#flint-ghost')
  })
})

// ── SVP-09: mount target is #app ───────────────────────────────────────────────

describe('buildSvelteSrcdoc — mount target', () => {
  it('SVP-09: mounts on #app (Svelte convention, not #root)', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    // The app div is #app, matching the Svelte mount convention
    expect(html).toContain('<div id="app">')
  })
})

// ── SVP-10: empty CSS handling ─────────────────────────────────────────────────

describe('buildSvelteSrcdoc — empty CSS', () => {
  it('SVP-10: with empty CSS, omits the extra <style> tag', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, '', SAMPLE_CONFIG)
    // The interaction styles <style> is always present, but the component CSS style
    // should not be injected when css is empty string
    // Count <style> occurrences: should be 1 (just the interaction styles)
    const styleTags = html.match(/<style>/g) ?? []
    // Interaction styles are in one tag; no extra empty style block should appear
    expect(styleTags.length).toBe(1)
  })
})

// ── SVP-11 through SVP-13: security + correctness ─────────────────────────────

describe('buildSvelteSrcdoc — security and correctness', () => {
  it('SVP-11: does NOT reference cdn.tailwindcss.com (Commandment 4)', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html).not.toMatch(/<script[^>]+src=["'][^"']*cdn\.tailwindcss\.com[^"']*["']/)
  })

  it('SVP-12: does not contain Vue-specific runtime identifiers', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html).not.toContain('vue.global')
    expect(html).not.toContain('createApp')
  })

  it('SVP-13: JS is embedded safely via JSON — </script> in code cannot break HTML parser', () => {
    const jsWithScriptTag = `window.__SvelteComponent = function() {}; // </script> hack`
    const html = buildSvelteSrcdoc(jsWithScriptTag, '', SAMPLE_CONFIG)
    // The raw `</script>` from the JS code must not appear verbatim in the output
    // (it is JSON-encoded inside the application/json script block)
    // The literal string `</script>` should not appear outside a JSON-encoded context
    // i.e. the application/json block contains the escaped form
    expect(html).toContain('__svelte_code')
    // Verify the JS was JSON-encoded (the angle bracket is escaped to \u003c)
    expect(html).toContain('\\u003c/script')
  })
})

// ── SVP-14: different JS → different output ───────────────────────────────────

describe('buildSvelteSrcdoc — output variation', () => {
  it('SVP-14: different compiledJs values produce different HTML output', () => {
    const html1 = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    const differentJs = 'window.__SvelteComponent = function AnotherComponent() {};'
    const html2 = buildSvelteSrcdoc(differentJs, SAMPLE_CSS, SAMPLE_CONFIG)
    expect(html1).not.toBe(html2)
  })
})

// ── Cross-module constant sanity ───────────────────────────────────────────────

describe('buildSvelteSrcdoc — interaction constant sanity', () => {
  it('FLINT_INTERACTION_SCRIPT is embedded in the Svelte srcdoc', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    // Sample a distinctive section of the interaction script
    const scriptSnippet = FLINT_INTERACTION_SCRIPT.slice(0, 50).trim()
    expect(html).toContain(scriptSnippet)
  })

  it('FLINT_INTERACTION_STYLES are embedded in the Svelte srcdoc', () => {
    const html = buildSvelteSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
    const stylesSnippet = FLINT_INTERACTION_STYLES.slice(0, 50).trim()
    expect(html).toContain(stylesSnippet)
  })
})
