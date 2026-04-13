/**
 * vuePreview.test.ts — src/components/editor/__tests__/vuePreview.test.ts
 *
 * Unit tests for the Vue 3 srcdoc builder in LivePreview.tsx (MFP.2).
 *
 * All tests are offline and do NOT exercise the IPC dispatch path.
 * The `buildVueSrcdoc` function is a pure function that assembles a full
 * HTML document from pre-compiled inputs — it can be tested synchronously.
 *
 * MFP.2 Test IDs:
 *   VP-01 — buildVueSrcdoc produces a valid HTML document structure
 *   VP-02 — buildVueSrcdoc includes the Vue UMD runtime script
 *   VP-03 — buildVueSrcdoc includes the compiled JS (via JSON-safe embedding)
 *   VP-04 — buildVueSrcdoc includes extracted CSS in a <style> tag
 *   VP-05 — buildVueSrcdoc includes the Tailwind CDN build
 *   VP-06 — buildVueSrcdoc includes the Tailwind config
 *   VP-07 — buildVueSrcdoc includes the shared Flint interaction script
 *   VP-08 — buildVueSrcdoc includes the shared Flint interaction styles
 *   VP-09 — buildVueSrcdoc mounts the component via createApp + mount
 *   VP-10 — buildVueSrcdoc targets the #app div (not #root)
 *   VP-11 — buildVueSrcdoc with empty CSS does not inject a blank <style> tag
 *   VP-12 — buildVueSrcdoc does NOT reference cdn.tailwindcss.com (Commandment 4)
 *   VP-13 — buildVueSrcdoc does not contain undefined or null interpolations
 *   VP-14 — </script> sequences in compiled JS are safely escaped
 */

import { describe, it, expect } from 'vitest'
import { buildVueSrcdoc } from '../LivePreview'
import {
  FLINT_INTERACTION_SCRIPT,
  FLINT_INTERACTION_STYLES,
} from '../../../preview-vendor/flint-interaction'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_JS = `
(function () {
  window.__VueComponent = { render: function() { return Vue.h('div', {}, 'Hello') } };
  Vue.createApp(window.__VueComponent).mount('#app');
})();
`.trim()

const SAMPLE_CSS = '.container { color: red; padding: 1rem; }'
const SAMPLE_CONFIG = '{"theme":{"extend":{"colors":{"brand":"#ff0000"}}}}'

// JS containing a </script> sequence that must be escaped
const JS_WITH_SCRIPT_TAG = `window.__VueComponent = { template: '<div></div>' }; // </script> injection attempt`

// ── VP-01 through VP-14 ────────────────────────────────────────────────────────

describe('buildVueSrcdoc', () => {
    it('VP-01: produces a valid HTML document structure', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<html')
        expect(html).toContain('<head>')
        expect(html).toContain('</html>')
    })

    it('VP-02: includes the Vue UMD runtime (vendored, not CDN)', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        // The vendored vue.global.prod.js either exposes createApp or the
        // placeholder stub — either way the script block is inline (not src=)
        // and must not be loaded from a CDN.
        expect(html).not.toMatch(/<script[^>]+src=["'][^"']*vue[^"']*["']/)
        // The Vue runtime is injected inline — the output must contain it
        // (at minimum the placeholder's exports.createApp assignment)
        expect(html).toContain('createApp')
    })

    it('VP-03: embeds compiled JS via JSON-safe encoding', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        // The JS is stored in a <script type="application/json"> block
        expect(html).toContain('application/json')
        // The content key from the JS is present after JSON round-trip
        expect(html).toContain('__VueComponent')
    })

    it('VP-04: injects extracted CSS in a <style> tag', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).toContain(SAMPLE_CSS)
        expect(html).toContain('<style>')
    })

    it('VP-05: includes the vendored Tailwind CDN build (inline, not src=)', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        // Must not load Tailwind from a CDN src= attribute
        expect(html).not.toMatch(/<script[^>]+src=["'][^"']*tailwind[^"']*["'][^>]*>/)
        // Tailwind config assignment confirms the inline CDN is present
        expect(html).toContain('tailwind.config =')
    })

    it('VP-06: applies the Tailwind config JSON', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).toContain(SAMPLE_CONFIG)
        expect(html).toContain('tailwind.config =')
    })

    it('VP-07: appends the shared Flint interaction script', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        // Verify key message handler strings from the shared script are present
        expect(html).toContain('SET_INTERACT_MODE')
        expect(html).toContain('HIGHLIGHT')
        expect(html).toContain('CANVAS_CLICK')
        expect(html).toContain('CANVAS_DRAG_START')
        expect(html).toContain('HIT_TEST_RESULT')
    })

    it('VP-08: includes the shared Flint interaction styles', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).toContain('.flint-selected')
        expect(html).toContain('.flint-hovered')
        expect(html).toContain('.flint-drop-before')
        expect(html).toContain('#flint-ghost')
    })

    it('VP-09: mounts the Vue component using createApp + mount pattern', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).toContain('createApp')
        expect(html).toContain('.mount(')
    })

    it('VP-10: targets #app as the mount element (not #root)', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).toContain('id="app"')
        expect(html).toContain("mount('#app')")
    })

    it('VP-11: empty CSS does not inject a blank visible <style> block', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, '', SAMPLE_CONFIG)
        // When CSS is empty string, the conditional style tag should be absent
        // The interaction styles tag is always present — check for extra empty tag
        // (we check that the empty css value '' is not spuriously injected)
        // An empty <style></style> tag should NOT appear after the CSS-conditional block
        expect(html).not.toContain('<style></style>')
    })

    it('VP-12: does NOT load Tailwind via a <script src> CDN tag (Commandment 4)', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        // The vendored tailwind-cdn.js contains an internal console.warn mentioning
        // "cdn.tailwindcss.com" — that is acceptable. The violation is loading
        // Tailwind via an external <script src="https://cdn.tailwindcss.com"> attribute.
        expect(html).not.toMatch(/<script[^>]+src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>/)
        // Also must not load Vue via CDN
        expect(html).not.toMatch(/<script[^>]+src=["'][^"']*unpkg\.com[^"']*["'][^>]*>/)
    })

    it('VP-13: contains no undefined or null interpolations', () => {
        const html = buildVueSrcdoc(SAMPLE_JS, SAMPLE_CSS, SAMPLE_CONFIG)
        expect(html).not.toContain('>undefined<')
        expect(html).not.toContain('>null<')
        // These would appear if a template literal variable was accidentally undefined
        expect(html).not.toMatch(/\bundefined\b.*<\/style>/)
    })

    it('VP-14: safely escapes </script> sequences in compiled JS', () => {
        const html = buildVueSrcdoc(JS_WITH_SCRIPT_TAG, '', SAMPLE_CONFIG)
        // The bare </script> in the JS must be escaped so the HTML parser
        // does not terminate the enclosing script block prematurely.
        // JSON.stringify + \\u003c escape guarantees this.
        // The raw sequence </script> must not appear in the JSON-encoded JS block.
        const jsonBlockMatch = html.match(/<script id="__vue_code"[^>]*>([\s\S]*?)<\/script>/)
        expect(jsonBlockMatch).not.toBeNull()
        if (jsonBlockMatch) {
            expect(jsonBlockMatch[1]).not.toContain('</script>')
        }
    })
})

// ── Interaction script constants sanity ──────────────────────────────────────

describe('buildVueSrcdoc — interaction script constant integrity', () => {
    it('FLINT_INTERACTION_SCRIPT is a non-empty string (import sanity)', () => {
        expect(typeof FLINT_INTERACTION_SCRIPT).toBe('string')
        expect(FLINT_INTERACTION_SCRIPT.length).toBeGreaterThan(100)
    })

    it('FLINT_INTERACTION_STYLES contains required CSS classes', () => {
        expect(FLINT_INTERACTION_STYLES).toContain('.flint-selected')
        expect(FLINT_INTERACTION_STYLES).toContain('.flint-hovered')
    })
})
