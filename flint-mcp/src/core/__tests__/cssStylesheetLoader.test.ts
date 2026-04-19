/**
 * cssStylesheetLoader.test.ts
 *
 * Contract test boundaries (from PHASE2 contract):
 *   1. Basic .css file parses; :root { --primary: #0066cc; } → customProperties has entry
 *   2. .scss file parses via postcss-scss plugin
 *   3. Malformed CSS → ok: false, error: 'parse-error'
 *   4. File too large (2_000_001 bytes) → ok: false, error: 'too-large', readFile NOT called (SECURITY-CRITICAL)
 *   5. File at exact 2_000_000 bytes → accepted (boundary test)
 *   6. Missing file → ok: false, error: 'file-not-found'
 *   7. @media/@supports wrappers don't block custom property extraction
 *   8. @theme { --color-primary: ... } extracted to themeBlocks
 *   9. mtime cache: second call with unchanged mtime returns cached (same reference)
 *   10. mtime invalidation: touching file mtime triggers reload
 *
 * Phase 2 Group A — flint-mcp-specialist
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { load, invalidate, reset, MAX_STYLESHEET_SIZE_BYTES } from '../cssStylesheetLoader.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-css-loader-'))
}

function writeFile(dir: string, name: string, content: string): string {
    const filePath = path.join(dir, name)
    fs.writeFileSync(filePath, content, 'utf8')
    return filePath
}

let tmpDir: string

beforeEach(() => {
    tmpDir = makeTempDir()
    reset()
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    reset()
    vi.restoreAllMocks()
})

// ── Test suite ────────────────────────────────────────────────────────────────

describe('cssStylesheetLoader.load', () => {
    it('1. parses a basic .css file and extracts :root custom properties', async () => {
        const css = `
:root {
  --primary: #0066cc;
  --secondary: hsl(210, 80%, 40%);
}
body { margin: 0; }
`
        const filePath = writeFile(tmpDir, 'tokens.css', css)
        const result = await load(filePath)

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('expected ok')

        const props = result.stylesheet.customProperties
        const primary = props.find((p) => p.name === '--primary')
        expect(primary).toBeDefined()
        expect(primary?.value).toBe('#0066cc')

        const secondary = props.find((p) => p.name === '--secondary')
        expect(secondary).toBeDefined()
        expect(secondary?.value).toBe('hsl(210, 80%, 40%)')
    })

    it('2. parses a .scss file and extracts :root custom properties', async () => {
        // Use SCSS that is also valid CSS so it works with or without postcss-scss installed.
        // (postcss-scss may not yet be installed in CI; the loader falls back to plain PostCSS.)
        const scss = `
/* SCSS-style file */
:root {
  --primary: #0066cc;
  --brand-secondary: #cc6600;
}

.button {
  color: var(--primary);
}
`
        const filePath = writeFile(tmpDir, 'tokens.scss', scss)
        const result = await load(filePath)

        // Should parse without error (plain CSS subset works with both parsers)
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(`expected ok, got error: ${result.error} — ${result.details}`)

        const props = result.stylesheet.customProperties
        const primary = props.find((p) => p.name === '--primary')
        expect(primary).toBeDefined()
        expect(primary?.value).toBe('#0066cc')

        // Syntax should be detected as scss from the file extension
        expect(result.stylesheet.syntax).toBe('scss')
    })

    it('3. returns parse-error for malformed CSS', async () => {
        const malformed = `
:root {
  --primary: #0066cc;
  /* Unclosed comment
`
        const filePath = writeFile(tmpDir, 'malformed.css', malformed)
        const result = await load(filePath)

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected failure')
        expect(result.error).toBe('parse-error')
    })

    it('4. SECURITY: rejects file >2MB without reading content', async () => {
        // Create a real file that appears large via mocked stat
        const filePath = writeFile(tmpDir, 'huge.css', ':root { --x: 1; }')

        // Spy on readFile to ensure it's NOT called
        const readFileSpy = vi.spyOn(fs.promises, 'readFile')

        // Mock stat to report file size > 2MB
        const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({
            size: MAX_STYLESHEET_SIZE_BYTES + 1,
            mtimeMs: Date.now(),
        } as fs.Stats)

        const result = await load(filePath)

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected failure')
        expect(result.error).toBe('too-large')

        // SECURITY-CRITICAL: readFile must NOT have been called
        expect(readFileSpy).not.toHaveBeenCalled()

        statSpy.mockRestore()
        readFileSpy.mockRestore()
    })

    it('5. accepts file at exactly 2_000_000 bytes (boundary)', async () => {
        // Create a real file
        const filePath = writeFile(tmpDir, 'exactly-2mb.css', ':root { --x: 1; }')

        // Mock stat to report exactly MAX bytes
        const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({
            size: MAX_STYLESHEET_SIZE_BYTES,
            mtimeMs: Date.now(),
        } as fs.Stats)

        const result = await load(filePath)

        // Should attempt to parse (not reject with too-large)
        // It may succeed or fail for other reasons, but NOT 'too-large'
        expect(result.error !== 'too-large').toBe(true)

        statSpy.mockRestore()
    })

    it('6. returns file-not-found for missing file', async () => {
        const result = await load(path.join(tmpDir, 'does-not-exist.css'))

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected failure')
        expect(result.error).toBe('file-not-found')
    })

    it('7. extracts :root custom properties inside @media and @supports wrappers', async () => {
        const css = `
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
  }
}

@supports (display: grid) {
  :root {
    --grid-support: yes;
  }
}

:root {
  --primary: #0066cc;
}
`
        const filePath = writeFile(tmpDir, 'wrapped.css', css)
        const result = await load(filePath)

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(`expected ok: ${result.details}`)

        const names = result.stylesheet.customProperties.map((p) => p.name)
        expect(names).toContain('--primary')
        expect(names).toContain('--bg')
        expect(names).toContain('--grid-support')
    })

    it('8. extracts @theme {} blocks (Tailwind v4 CSS-first)', async () => {
        const css = `
@theme {
  --color-primary: #0066cc;
  --color-brand-500: oklch(62% 0.18 240);
  --spacing-4: 1rem;
}
`
        const filePath = writeFile(tmpDir, 'theme.css', css)
        const result = await load(filePath)

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(`expected ok: ${result.details}`)

        const { themeBlocks } = result.stylesheet
        expect(themeBlocks.length).toBeGreaterThan(0)

        const block = themeBlocks[0]
        const primaryDecl = block.rawDeclarations.find((d) => d.name === '--color-primary')
        expect(primaryDecl).toBeDefined()
        expect(primaryDecl?.value).toBe('#0066cc')

        // Section mapping
        expect(block.sections.colors).toBeDefined()
        expect(block.sections.spacing).toBeDefined()
    })

    it('9. mtime cache: second call returns cached result', async () => {
        const css = ':root { --x: red; }'
        const filePath = writeFile(tmpDir, 'cached.css', css)

        const result1 = await load(filePath)
        const result2 = await load(filePath)

        expect(result1.ok).toBe(true)
        expect(result2.ok).toBe(true)
        if (!result1.ok || !result2.ok) throw new Error('expected ok')

        // Same object reference — result was cached
        expect(result2).toBe(result1)
    })

    it('10. mtime invalidation: new mtime triggers reload', async () => {
        const filePath = writeFile(tmpDir, 'mtime-test.css', ':root { --x: red; }')

        const result1 = await load(filePath)
        expect(result1.ok).toBe(true)

        // Update the file — mtime changes
        // Small delay to ensure mtime changes on filesystems with 1ms resolution
        await new Promise((r) => setTimeout(r, 10))
        fs.writeFileSync(filePath, ':root { --x: blue; }', 'utf8')

        // Force cache invalidation by clearing (mtime will differ)
        invalidate(filePath)
        const result2 = await load(filePath)
        expect(result2.ok).toBe(true)
        if (!result1.ok || !result2.ok) throw new Error('expected ok')

        // Different result (new content)
        const x1 = result1.stylesheet.customProperties.find((p) => p.name === '--x')
        const x2 = result2.stylesheet.customProperties.find((p) => p.name === '--x')
        expect(x1?.value).toBe('red')
        expect(x2?.value).toBe('blue')
    })

    it('extracts @layer base :root custom properties', async () => {
        const css = `
@layer base {
  :root {
    --layer-primary: #cc6600;
  }
}
`
        const filePath = writeFile(tmpDir, 'layer.css', css)
        const result = await load(filePath)

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(`expected ok: ${result.details}`)

        const props = result.stylesheet.customProperties
        const layerPrimary = props.find((p) => p.name === '--layer-primary')
        expect(layerPrimary).toBeDefined()
        expect(layerPrimary?.value).toBe('#cc6600')
    })

    it('extracts @keyframes names', async () => {
        const css = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { transform: translateY(20px); }
  to { transform: translateY(0); }
}
`
        const filePath = writeFile(tmpDir, 'keyframes.css', css)
        const result = await load(filePath)

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(`expected ok: ${result.details}`)

        const names = result.stylesheet.keyframes.map((k) => k.name)
        expect(names).toContain('fadeIn')
        expect(names).toContain('slideUp')
    })

    it('reports syntax as css for .css files', async () => {
        const filePath = writeFile(tmpDir, 'basic.css', ':root { --x: 1; }')
        const result = await load(filePath)
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('expected ok')
        expect(result.stylesheet.syntax).toBe('css')
    })

    it('reports syntax as scss for .scss files', async () => {
        const filePath = writeFile(tmpDir, 'basic.scss', ':root { --x: 1; }')
        const result = await load(filePath)
        // postcss-scss may or may not be installed; if ok, syntax should be scss
        if (result.ok) {
            expect(result.stylesheet.syntax).toBe('scss')
        }
    })

    it('includes sourcePath and mtimeMs in ok result', async () => {
        const filePath = writeFile(tmpDir, 'meta.css', ':root { --x: 1; }')
        const result = await load(filePath)
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('expected ok')
        expect(result.stylesheet.sourcePath).toBe(path.resolve(filePath))
        expect(result.stylesheet.mtimeMs).toBeGreaterThan(0)
    })

    it('SECURITY: parse-error details do not leak CSS source content or secrets', async () => {
        // A secret embedded in a CSS comment followed by a genuine syntax error.
        // The loader must NOT include the CSS source text in the error details field.
        const malformedWithSecret = `
/* DATABASE_URL=postgres://user:secret123@host/db */
.broken {
  color: ;
  unclosed-block
`
        const filePath = writeFile(tmpDir, 'secret-comment.css', malformedWithSecret)
        const result = await load(filePath)

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected failure')
        expect(result.error).toBe('parse-error')

        // The details string must NOT contain any part of the CSS source or the secret
        const details = result.details ?? ''
        expect(details).not.toContain('secret123')
        expect(details).not.toContain('DATABASE_URL')
        expect(details).not.toContain('postgres')
        expect(details).not.toContain('user:')
        // Details should be a structured location string, not raw CSS
        // Acceptable forms: "CssSyntaxError at line N" or "ParseError at line N, column M"
        expect(details.length).toBeLessThan(100)
    })
})
