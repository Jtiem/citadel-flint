/**
 * buildSrcdoc.test.ts
 *
 * Integration tests for the buildSrcdoc function in LivePreview.tsx.
 * Verifies shim injection produces correct HTML structure for library-aware preview.
 *
 * Tests:
 *   SRCDOC-01 — buildSrcdoc with null shims produces HTML containing generic stubs
 *   SRCDOC-02 — buildSrcdoc with null shims contains Badge and Button stubs
 *   SRCDOC-03 — buildSrcdoc with shadcn shims contains shadcn CSS variables in <head>
 *   SRCDOC-04 — buildSrcdoc with shadcn shims contains shadcn component shims (Card, Button)
 *   SRCDOC-05 — library CSS variables <style> block appears after tailwind config <script>
 *   SRCDOC-06 — library shim <script> appears after generic shim <script>
 *   SRCDOC-07 — buildSrcdoc with MUI shims contains MUI CSS variables
 *   SRCDOC-08 — buildSrcdoc with PrimeNG shims contains PrimeNG CSS variables
 *   SRCDOC-09 — switching from null to shadcn shims changes the srcdoc content
 *   SRCDOC-10 — generic stubs are present even when library shims are also injected
 */

import { describe, it, expect } from 'vitest'
import { buildSrcdoc } from '../LivePreview'
import {
  getLibraryShims,
  getGenericShims,
  type LibraryShimBundle,
} from '../../../preview-vendor/shims/index'

// ── Shared fixtures ────────────────────────────────────────────────────────────

const SAMPLE_CODE = 'window.__AppComponent = function App() { return React.createElement("div", null, "Hello"); };'
const SAMPLE_CONFIG = '{"theme":{"extend":{}}}'

// ── SRCDOC-01: null shims → valid HTML with generic stubs ─────────────────────

describe('buildSrcdoc — no library shims (null)', () => {
  it('SRCDOC-01: produces a complete HTML document', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, null)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('SRCDOC-02: contains generic Badge and Button stubs', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, null)
    // The generic stubs assign to window.*
    expect(html).toContain('window.Badge')
    expect(html).toContain('window.Button')
    expect(html).toContain('window.Input')
    expect(html).toContain('window.Stack')
  })

  it('does not inject a library CSS variables <style> block', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, null)
    // No shadcn/MUI/PrimeNG CSS vars should appear
    expect(html).not.toContain('--background: 0 0% 100%')
    expect(html).not.toContain('--mui-primary')
    expect(html).not.toContain('--p-primary-color')
  })
})

// ── SRCDOC-03 & SRCDOC-04: shadcn shims ───────────────────────────────────────

describe('buildSrcdoc — shadcn library shims', () => {
  const shadcnBundle = getLibraryShims('shadcn')!

  it('SRCDOC-03: injects shadcn CSS variables in <head>', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    expect(html).toContain('--background: 0 0% 100%')
    expect(html).toContain('--foreground: 222.2 84% 4.9%')
    expect(html).toContain('--primary: 222.2 47.4% 11.2%')
    expect(html).toContain('--radius: 0.5rem')
  })

  it('SRCDOC-04: injects shadcn component shims (Card, Button)', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    expect(html).toContain('window.Card')
    expect(html).toContain('window.CardHeader')
    expect(html).toContain('window.CardTitle')
    expect(html).toContain('window.Button')
    expect(html).toContain('window.Badge')
    expect(html).toContain('window.Avatar')
    expect(html).toContain('window.Switch')
    expect(html).toContain('window.Checkbox')
    expect(html).toContain('window.Alert')
  })

  it('SRCDOC-05: library CSS variables <style> appears after tailwind config <script>', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    const tailwindConfigPos = html.indexOf('tailwind.config =')
    const cssVarsPos = html.indexOf('--background: 0 0% 100%')
    expect(tailwindConfigPos).toBeGreaterThan(-1)
    expect(cssVarsPos).toBeGreaterThan(-1)
    expect(cssVarsPos).toBeGreaterThan(tailwindConfigPos)
  })

  it('SRCDOC-06: library shim <script> appears after generic shim <script>', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    // Generic stubs define window.Stack (not in shadcn); library shims define window.Card (not in generic)
    // The Card definition must come after the generic Stack definition
    const stackPos = html.indexOf('window.Stack')
    const cardPos = html.indexOf('window.Card')
    expect(stackPos).toBeGreaterThan(-1)
    expect(cardPos).toBeGreaterThan(-1)
    expect(cardPos).toBeGreaterThan(stackPos)
  })

  it('SRCDOC-10: generic stubs (Stack, Heading) are still present alongside shadcn shims', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    expect(html).toContain('window.Stack')
    expect(html).toContain('window.Heading')
    // shadcn shims override Button — both definitions present, shadcn after generic
    expect(html).toContain('window.Button')
  })
})

// ── SRCDOC-07: MUI shims ──────────────────────────────────────────────────────

describe('buildSrcdoc — MUI library shims', () => {
  const muiBundle = getLibraryShims('mui')!

  it('SRCDOC-07: injects MUI CSS variables in <head>', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, muiBundle)
    expect(html).toContain('--mui-primary: #1976d2')
    expect(html).toContain('--mui-secondary: #9c27b0')
    expect(html).toContain('--mui-background: #fff')
  })

  it('injects MUI component shims (Typography, TextField, Chip)', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, muiBundle)
    expect(html).toContain('window.Typography')
    expect(html).toContain('window.TextField')
    expect(html).toContain('window.Chip')
    expect(html).toContain('window.MenuItem')
    expect(html).toContain('window.Avatar')
  })
})

// ── SRCDOC-08: PrimeNG shims ──────────────────────────────────────────────────

describe('buildSrcdoc — PrimeNG library shims', () => {
  const primengBundle = getLibraryShims('primeng')!

  it('SRCDOC-08: injects PrimeNG CSS variables in <head>', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, primengBundle)
    expect(html).toContain('--p-primary-color: #6366f1')
    expect(html).toContain('--p-text-color: #334155')
    expect(html).toContain('--p-border-radius: 6px')
  })

  it('injects PrimeNG component shims (Button with label prop, DataTable)', () => {
    const html = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, primengBundle)
    expect(html).toContain('window.Button')
    expect(html).toContain('window.DataTable')
    expect(html).toContain('window.Message')
  })
})

// ── SRCDOC-09: library switch changes the srcdoc ──────────────────────────────

describe('buildSrcdoc — library switching', () => {
  it('SRCDOC-09: switching from null to shadcn shims changes the srcdoc content', () => {
    const withoutShims = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, null)
    const shadcnBundle = getLibraryShims('shadcn')!
    const withShadcn = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    expect(withoutShims).not.toBe(withShadcn)
    // Without shims: no CSS vars
    expect(withoutShims).not.toContain('--background: 0 0% 100%')
    // With shadcn: CSS vars present
    expect(withShadcn).toContain('--background: 0 0% 100%')
  })

  it('switching from shadcn to MUI uses different CSS vars', () => {
    const shadcnBundle = getLibraryShims('shadcn')!
    const muiBundle = getLibraryShims('mui')!
    const withShadcn = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, shadcnBundle)
    const withMUI = buildSrcdoc(SAMPLE_CODE, SAMPLE_CONFIG, muiBundle)
    expect(withShadcn).not.toBe(withMUI)
    expect(withShadcn).toContain('--background: 0 0% 100%')
    expect(withShadcn).not.toContain('--mui-primary')
    expect(withMUI).toContain('--mui-primary: #1976d2')
    expect(withMUI).not.toContain('--background: 0 0% 100%')
  })
})

// ── Registry contract compliance ──────────────────────────────────────────────

describe('getGenericShims', () => {
  it('returns a bundle with componentCount >= 9', () => {
    const bundle = getGenericShims()
    expect(bundle.componentCount).toBeGreaterThanOrEqual(9)
  })

  it('shimSource contains window. assignments', () => {
    const bundle = getGenericShims()
    expect(bundle.shimSource).toContain('window.')
  })

  it('cssVars is empty string for generic stubs', () => {
    const bundle = getGenericShims()
    expect(bundle.cssVars).toBe('')
  })
})

describe('getLibraryShims — known libraries', () => {
  it('returns non-null for shadcn', () => {
    expect(getLibraryShims('shadcn')).not.toBeNull()
  })

  it('returns non-null for mui', () => {
    expect(getLibraryShims('mui')).not.toBeNull()
  })

  it('returns non-null for primeng', () => {
    expect(getLibraryShims('primeng')).not.toBeNull()
  })

  it('returns null for tailwind (no components to shim)', () => {
    expect(getLibraryShims('tailwind')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(getLibraryShims(null)).toBeNull()
  })

  it('returns null for unknown library', () => {
    expect(getLibraryShims('unknown-library-xyz')).toBeNull()
  })
})
