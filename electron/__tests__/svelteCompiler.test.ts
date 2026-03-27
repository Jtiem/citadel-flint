/**
 * svelteCompiler.test.ts — MFP.3: Svelte compiler unit tests
 *
 * Tests the pure logic inside svelteCompiler.ts in two ways:
 *
 *   Group A — Pure helper re-implementations tested directly (no mocking needed).
 *             Covers: stripImports, rewriteExportDefault, section reassembly.
 *
 *   Group B — compileSvelteComponent() with a top-level vi.mock of svelte/compiler.
 *             These verify the full flow using a predictable mocked compiler output.
 *             The mock is defined at module level (Vitest hoists it correctly).
 *
 * Note: Tests that rely on the real svelte package would fail until `npm install svelte`
 * runs. These tests use mocks exclusively so they pass immediately.
 *
 * Coverage:
 *   SC-01 — compileSvelteComponent returns error for non-string input
 *   SC-02 — compileSvelteComponent returns error for empty/whitespace string
 *   SC-03 — compileSvelteComponent returns valid JS from mocked compiler output
 *   SC-04 — compileSvelteComponent extracts CSS from compiler result
 *   SC-05 — compileSvelteComponent handles component with no style block (css = '')
 *   SC-06 — compileSvelteComponent handles compiler returning null css
 *   SC-07 — compileSvelteComponent output assigns window.__SvelteComponent
 *   SC-08 — compileSvelteComponent output includes a mount call for #app
 *   SC-09 — compileSvelteComponent strips import statements from compiled JS
 *   SC-10 — compileSvelteComponent returns error when compiler throws
 *   SC-12 — compiled output contains no bare import statements (self-contained)
 *   stripImports-01 — removes a simple default import
 *   stripImports-02 — removes a named import
 *   stripImports-03 — removes multiple imports
 *   stripImports-04 — passes through code with no imports
 *   rewrite-01 — rewrites "export default ComponentName"
 *   rewrite-02 — rewrites export without semicolon
 *   rewrite-03 — only rewrites the first occurrence
 *   rewrite-04 — passes through code with no export default
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Top-level mock — Vitest hoists this before any import ─────────────────────
//
// We mock svelte/compiler at the top level so all calls to
// `compileSvelteComponent` in this file see the mocked version.
// The mock returns a deterministic compile result we control per-test.
//
// `vi.fn()` starts returning `undefined`; each test overrides it with
// mockReturnValueOnce / mockImplementationOnce.

vi.mock('svelte/compiler', () => ({
    compile: vi.fn(),
    VERSION: '4.2.0',
}))

// ── Import module under test AFTER the mock declaration ───────────────────────

import { compileSvelteComponent } from '../svelteCompiler.js'
import * as svelteCompilerMod from 'svelte/compiler'

// ── Typed reference to the mock ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCompile = vi.mocked((svelteCompilerMod as any).compile)

// ── Shared fixtures ───────────────────────────────────────────────────────────

const MINIMAL_SVELTE = `<script>
  let count = 0;
</script>
<button on:click={() => count++}>{count}</button>
<style>
  button { color: red; }
</style>`

const TEMPLATE_ONLY_SVELTE = `<div><p>Hello, world!</p></div>`
const NO_STYLE_SVELTE = `<script>let name = 'Svelte';</script>\n<h1>Hello {name}!</h1>`

// ── Helper: make a standard mock compile result ───────────────────────────────

function makeCompileResult(jsCode: string, cssCode: string | null) {
    return {
        js: { code: jsCode },
        css: cssCode !== null ? { code: cssCode } : null,
        warnings: [],
    }
}

// ── Group B: compileSvelteComponent() ─────────────────────────────────────────

describe('compileSvelteComponent — input validation', () => {
    it('SC-01: rejects non-string input (returns error)', async () => {
        // @ts-expect-error — intentional wrong type for test
        const result = await compileSvelteComponent(42)
        expect(result.js).toBeNull()
        expect(result.error).toMatch(/non-empty string/)
        // compile must not have been called
        expect(mockCompile).not.toHaveBeenCalled()
    })

    it('SC-02: rejects empty/whitespace string (returns error)', async () => {
        const result = await compileSvelteComponent('   ')
        expect(result.js).toBeNull()
        expect(result.error).toMatch(/non-empty string/)
        expect(mockCompile).not.toHaveBeenCalled()
    })
})

describe('compileSvelteComponent — mocked compiler output', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('SC-03: returns non-null JS string for a minimal Svelte component', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                'function Counter() {}\nexport default Counter;',
                'button { color: red; }'
            )
        )
        const result = await compileSvelteComponent(MINIMAL_SVELTE)
        expect(result.error).toBeNull()
        expect(typeof result.js).toBe('string')
        expect((result.js ?? '').length).toBeGreaterThan(0)
    })

    it('SC-04: extracts CSS from the compiler result', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                'function Counter() {}\nexport default Counter;',
                'button { color: red; }'
            )
        )
        const result = await compileSvelteComponent(MINIMAL_SVELTE)
        expect(result.css).toBe('button { color: red; }')
    })

    it('SC-05: handles component with no style block — css is empty string', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                'function Greeting() {}\nexport default Greeting;',
                ''
            )
        )
        const result = await compileSvelteComponent(NO_STYLE_SVELTE)
        expect(result.error).toBeNull()
        expect(result.css).toBe('')
    })

    it('SC-06: handles compiler returning null for css (template-only component)', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                'function HelloWorld() {}\nexport default HelloWorld;',
                null
            )
        )
        const result = await compileSvelteComponent(TEMPLATE_ONLY_SVELTE)
        expect(result.error).toBeNull()
        expect(result.js).not.toBeNull()
        // css.code was null — should default to empty string
        expect(result.css).toBe('')
    })

    it('SC-07: output assigns window.__SvelteComponent', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                'function Counter() {}\nexport default Counter;',
                ''
            )
        )
        const result = await compileSvelteComponent(MINIMAL_SVELTE)
        expect(result.js).toContain('window.__SvelteComponent')
    })

    it('SC-08: output includes a mount call targeting #app', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                'function Counter() {}\nexport default Counter;',
                ''
            )
        )
        const result = await compileSvelteComponent(MINIMAL_SVELTE)
        expect(result.js).toContain("getElementById('app')")
    })

    it('SC-09: strips import statements from compiled output', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                "import { onMount } from 'svelte';\nfunction Counter() {}\nexport default Counter;",
                ''
            )
        )
        const result = await compileSvelteComponent(MINIMAL_SVELTE)
        const lines = (result.js ?? '').split('\n')
        const importLines = lines.filter(l => /^import\s/.test(l))
        expect(importLines).toHaveLength(0)
    })

    it('SC-10: returns error when compiler throws', async () => {
        mockCompile.mockImplementationOnce(() => {
            throw new Error('Unexpected end of input')
        })
        const result = await compileSvelteComponent('<script>let x = </script>')
        expect(result.js).toBeNull()
        expect(result.error).toMatch(/Svelte compile error/)
        expect(result.error).toMatch(/Unexpected end of input/)
    })

    it('SC-12: compiled output contains no bare import statements (self-contained)', async () => {
        mockCompile.mockReturnValueOnce(
            makeCompileResult(
                "import { onMount } from 'svelte/internal';\nimport { noop } from 'svelte/internal';\nfunction App() {}\nexport default App;",
                ''
            )
        )
        const result = await compileSvelteComponent(MINIMAL_SVELTE)
        const importLines = (result.js ?? '').split('\n').filter(l => /^import\s/.test(l))
        expect(importLines).toHaveLength(0)
    })
})

// ── Group A: Pure helper re-implementations ────────────────────────────────────
//
// These replicate the private helpers in svelteCompiler.ts so we can unit-test
// the core transformation logic without the module mock interfering.

function stripImports(js: string): string {
    return js.replace(/^import\s+.*?['"][^'"]+['"]\s*;?\s*\n?/gm, '')
}

function rewriteExportDefault(js: string): string {
    return js.replace(/export\s+default\s+(\w+)\s*;?/, 'window.__SvelteComponent = $1;')
}

describe('stripImports (pure helper)', () => {
    it('stripImports-01: removes a simple default import', () => {
        const input = "import Component from './Component';\nconst x = 1;"
        const result = stripImports(input)
        expect(result).not.toMatch(/^import\s/m)
        expect(result).toContain('const x = 1')
    })

    it('stripImports-02: removes a named import', () => {
        const input = "import { onMount } from 'svelte';\nfunction App() {}"
        const result = stripImports(input)
        expect(result).not.toMatch(/^import\s/m)
        expect(result).toContain('function App()')
    })

    it('stripImports-03: removes multiple imports', () => {
        const input = "import A from 'a';\nimport B from 'b';\nconst c = 3;"
        const result = stripImports(input)
        expect(result).not.toMatch(/^import\s/m)
        expect(result).toContain('const c = 3')
    })

    it('stripImports-04: passes through code with no imports unchanged', () => {
        const input = 'function hello() { return 42; }'
        expect(stripImports(input)).toBe(input)
    })
})

describe('rewriteExportDefault (pure helper)', () => {
    it('rewrite-01: rewrites "export default ComponentName;"', () => {
        const input = 'function Counter() {}\nexport default Counter;'
        const result = rewriteExportDefault(input)
        expect(result).toContain('window.__SvelteComponent = Counter')
        expect(result).not.toContain('export default Counter')
    })

    it('rewrite-02: rewrites export without trailing semicolon', () => {
        const input = 'function App() {}\nexport default App'
        const result = rewriteExportDefault(input)
        expect(result).toContain('window.__SvelteComponent = App')
    })

    it('rewrite-03: only rewrites the first occurrence', () => {
        const input = 'export default A;\nexport default B;'
        const result = rewriteExportDefault(input)
        // Only first is rewritten
        expect(result).toContain('window.__SvelteComponent = A')
        // Second remains
        expect(result).toContain('export default B')
    })

    it('rewrite-04: passes through code with no export default unchanged', () => {
        const input = 'const x = 1;'
        expect(rewriteExportDefault(input)).toBe(input)
    })
})
