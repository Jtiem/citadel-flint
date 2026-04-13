/**
 * tokenImporter tests — flint-mcp/src/core/__tests__/tokenImporter.test.ts
 *
 * Coverage:
 *   - JS format: real-world Unique-mui-style.js structure (colors, spacing,
 *     typography, shadows, transitions)
 *   - JSON format: flat key-value pairs with mixed types
 *   - CSS format: --custom-property declarations
 *   - DTCG passthrough: JSON with existing $type fields passes through unchanged
 *   - Type classification: each value type is correctly identified
 *   - Merge behavior: deepMergePreserve — existing wins, new tokens added
 *   - countConflicts: detects overlapping leaf paths
 *   - Edge cases: empty input, unsupported values, boundary values
 *   - importTokensFromFile: file-based I/O round-trip
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    importFromJS,
    importFromJSON,
    importFromCSS,
    importTokensFromFile,
    deepMergePreserve,
    countConflicts,
} from '../tokenImporter.js'

// ---------------------------------------------------------------------------
// Temp dir helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-token-import-test-'))
})

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeTmp(name: string, content: string): string {
    const p = path.join(tmpDir, name)
    fs.writeFileSync(p, content, 'utf-8')
    return p
}

// ---------------------------------------------------------------------------
// JS format tests
// ---------------------------------------------------------------------------

describe('importFromJS — real-world MUI-style token file', () => {
    // Approximate structure from demos/Unique-mui-style.js
    const source = `
export const TOKENS = {
  // --- COLORS ---
  colors: {
    white: '#FFFFFF',
    black: '#000000',
    brand: {
      vibrant: '#FF4A00',
    },
  },
  // --- TYPOGRAPHY ---
  typography: {
    fonts: {
      heading: '"Space Grotesk", "Helvetica Neue", sans-serif',
      mono: '"JetBrains Mono", "Courier New", monospace',
    },
    sizes: {
      sm: '0.875rem',
      base: '1rem',
    },
    weights: {
      normal: 400,
      bold: 700,
    },
    lineHeights: {
      tight: 1.1,
      normal: 1.5,
    },
  },
  // --- SPACING ---
  spacing: {
    1: '0.25rem',
    4: '1rem',
  },
  // --- SHADOWS ---
  shadows: {
    sm: '2px 2px 0px 0px #111827',
    accentMd: '4px 4px 0px 0px #FF4A00',
  },
  // --- TRANSITIONS ---
  transitions: {
    fast: 'all 0.1s ease-in-out',
    snap: 'all 0.05s linear',
  },
};`

    it('parses without error', () => {
        expect(() => importFromJS(source)).not.toThrow()
    })

    it('classifies hex colors as type color', () => {
        const result = importFromJS(source)
        const colorNode = (result.tokens as Record<string, unknown>)['colors'] as Record<string, unknown>
        const white = (colorNode['white'] as Record<string, unknown>)
        expect(white['$type']).toBe('color')
        expect(white['$value']).toBe('#FFFFFF')
    })

    it('classifies nested brand color', () => {
        const result = importFromJS(source)
        const brand = ((result.tokens as Record<string, unknown>)['colors'] as Record<string, unknown>)['brand'] as Record<string, unknown>
        const vibrant = brand['vibrant'] as Record<string, unknown>
        expect(vibrant['$type']).toBe('color')
        expect(vibrant['$value']).toBe('#FF4A00')
    })

    it('classifies rem values as dimension', () => {
        const result = importFromJS(source)
        const sizes = (((result.tokens as Record<string, unknown>)['typography'] as Record<string, unknown>)['sizes'] as Record<string, unknown>)
        const sm = sizes['sm'] as Record<string, unknown>
        expect(sm['$type']).toBe('dimension')
        expect(sm['$value']).toBe('0.875rem')
    })

    it('classifies spacing rem values as dimension', () => {
        const result = importFromJS(source)
        const spacing = (result.tokens as Record<string, unknown>)['spacing'] as Record<string, unknown>
        const sp1 = spacing['1'] as Record<string, unknown>
        expect(sp1['$type']).toBe('dimension')
    })

    it('classifies font strings as fontFamily', () => {
        const result = importFromJS(source)
        const fonts = (((result.tokens as Record<string, unknown>)['typography'] as Record<string, unknown>)['fonts'] as Record<string, unknown>)
        const heading = fonts['heading'] as Record<string, unknown>
        expect(heading['$type']).toBe('fontFamily')
    })

    it('classifies numeric font weights as fontWeight', () => {
        const result = importFromJS(source)
        const weights = (((result.tokens as Record<string, unknown>)['typography'] as Record<string, unknown>)['weights'] as Record<string, unknown>)
        const normal = weights['normal'] as Record<string, unknown>
        expect(normal['$type']).toBe('fontWeight')
        expect(normal['$value']).toBe(400)
        const bold = weights['bold'] as Record<string, unknown>
        expect(bold['$type']).toBe('fontWeight')
        expect(bold['$value']).toBe(700)
    })

    it('classifies unitless decimals as lineHeight', () => {
        const result = importFromJS(source)
        const lh = (((result.tokens as Record<string, unknown>)['typography'] as Record<string, unknown>)['lineHeights'] as Record<string, unknown>)
        const tight = lh['tight'] as Record<string, unknown>
        expect(tight['$type']).toBe('lineHeight')
        expect(tight['$value']).toBe(1.1)
    })

    it('classifies box-shadow strings as shadow', () => {
        const result = importFromJS(source)
        const shadows = (result.tokens as Record<string, unknown>)['shadows'] as Record<string, unknown>
        const sm = shadows['sm'] as Record<string, unknown>
        expect(sm['$type']).toBe('shadow')
        expect(sm['$value']).toBe('2px 2px 0px 0px #111827')
    })

    it('classifies transition strings as transition', () => {
        const result = importFromJS(source)
        const transitions = (result.tokens as Record<string, unknown>)['transitions'] as Record<string, unknown>
        const fast = transitions['fast'] as Record<string, unknown>
        expect(fast['$type']).toBe('transition')
        expect(fast['$value']).toBe('all 0.1s ease-in-out')
    })

    it('reports correct imported count', () => {
        const result = importFromJS(source)
        expect(result.summary.imported).toBeGreaterThan(0)
    })

    it('reports by_type breakdown including color and dimension', () => {
        const result = importFromJS(source)
        expect(result.summary.by_type['color']).toBeGreaterThan(0)
        expect(result.summary.by_type['dimension']).toBeGreaterThan(0)
        expect(result.summary.by_type['fontWeight']).toBeGreaterThan(0)
        expect(result.summary.by_type['shadow']).toBeGreaterThan(0)
    })
})

describe('importFromJS — stripping and edge cases', () => {
    it('handles module.exports = style', () => {
        const source = `module.exports = { bg: '#AABBCC' };`
        const result = importFromJS(source)
        const bg = (result.tokens as Record<string, unknown>)['bg'] as Record<string, unknown>
        expect(bg['$type']).toBe('color')
    })

    it('handles export default', () => {
        const source = `export default { primary: '#FF0000' };`
        const result = importFromJS(source)
        const primary = (result.tokens as Record<string, unknown>)['primary'] as Record<string, unknown>
        expect(primary['$type']).toBe('color')
    })

    it('handles trailing commas', () => {
        const source = `export const T = { a: '#FF0000', b: '1rem', };`
        expect(() => importFromJS(source)).not.toThrow()
        const result = importFromJS(source)
        expect(result.summary.imported).toBe(2)
    })

    it('handles block comments', () => {
        const source = `export const T = { /* removed */ a: '#FF0000' };`
        const result = importFromJS(source)
        expect(result.summary.imported).toBe(1)
    })

    it('handles empty object', () => {
        const source = `export const T = {};`
        const result = importFromJS(source)
        expect(result.summary.imported).toBe(0)
        expect(result.summary.skipped).toHaveLength(0)
    })

    it('skips unclassifiable string values and records path', () => {
        const source = `export const T = { weird: 'clamp(2rem, 5vw, 4rem)' };`
        const result = importFromJS(source)
        expect(result.summary.skipped).toContain('weird')
        expect(result.summary.imported).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// JSON format tests
// ---------------------------------------------------------------------------

describe('importFromJSON — plain JSON', () => {
    it('parses flat JSON with color and dimension values', () => {
        const json = JSON.stringify({
            primary: '#3B82F6',
            spacing4: '1rem',
            weightBold: 700,
        })
        const result = importFromJSON(json)
        expect(result.summary.imported).toBe(3)
        expect(result.summary.by_type['color']).toBe(1)
        expect(result.summary.by_type['dimension']).toBe(1)
        expect(result.summary.by_type['fontWeight']).toBe(1)
    })

    it('handles nested JSON', () => {
        const json = JSON.stringify({
            colors: { brand: '#FF4A00' },
            spacing: { sm: '0.5rem' },
        })
        const result = importFromJSON(json)
        const colors = (result.tokens as Record<string, unknown>)['colors'] as Record<string, unknown>
        const brand = colors['brand'] as Record<string, unknown>
        expect(brand['$type']).toBe('color')
    })

    it('throws on malformed JSON', () => {
        expect(() => importFromJSON('{ not valid json')).toThrow()
    })

    it('returns empty result for empty JSON object', () => {
        const result = importFromJSON('{}')
        expect(result.summary.imported).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// DTCG passthrough tests
// ---------------------------------------------------------------------------

describe('importFromJSON — DTCG passthrough', () => {
    it('passes through JSON that already has $type fields unchanged', () => {
        const dtcg = {
            colors: {
                primary: { $type: 'color', $value: '#FF0000' },
                secondary: { $type: 'color', $value: '#00FF00' },
            },
            spacing: {
                sm: { $type: 'dimension', $value: '8px' },
            },
        }
        const result = importFromJSON(JSON.stringify(dtcg))
        // Tokens tree should be the same object
        expect(result.tokens).toEqual(dtcg)
        // Summary should count the leaf tokens
        expect(result.summary.imported).toBe(3)
        expect(result.summary.by_type['color']).toBe(2)
        expect(result.summary.by_type['dimension']).toBe(1)
    })

    it('counts DTCG tokens correctly even when nested deeply', () => {
        const dtcg = {
            a: { b: { c: { $type: 'color', $value: '#AABBCC' } } },
        }
        const result = importFromJSON(JSON.stringify(dtcg))
        expect(result.summary.imported).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// CSS format tests
// ---------------------------------------------------------------------------

describe('importFromCSS — CSS custom properties', () => {
    it('parses simple hex color declarations', () => {
        const css = `:root {
  --color-primary: #FF4A00;
  --color-secondary: #111827;
}`
        const result = importFromCSS(css)
        expect(result.summary.imported).toBe(2)
        const colorNode = (result.tokens as Record<string, unknown>)['color'] as Record<string, unknown>
        const primary = colorNode['primary'] as Record<string, unknown>
        expect(primary['$type']).toBe('color')
        expect(primary['$value']).toBe('#FF4A00')
    })

    it('converts kebab-case to dot-separated nested paths', () => {
        const css = `--color-brand-vibrant: #FF4A00;`
        const result = importFromCSS(css)
        const color = (result.tokens as Record<string, unknown>)['color'] as Record<string, unknown>
        const brand = color['brand'] as Record<string, unknown>
        const vibrant = brand['vibrant'] as Record<string, unknown>
        expect(vibrant['$type']).toBe('color')
    })

    it('classifies rem values as dimension', () => {
        const css = `--spacing-sm: 0.5rem;`
        const result = importFromCSS(css)
        const spacing = (result.tokens as Record<string, unknown>)['spacing'] as Record<string, unknown>
        const sm = spacing['sm'] as Record<string, unknown>
        expect(sm['$type']).toBe('dimension')
    })

    it('skips unclassifiable values and records in skipped list', () => {
        const css = `--layout-complex: clamp(2rem, 5vw, 4rem);`
        const result = importFromCSS(css)
        expect(result.summary.skipped.length).toBeGreaterThan(0)
    })

    it('returns empty result for CSS with no custom property declarations', () => {
        const css = `.button { color: red; }`
        const result = importFromCSS(css)
        expect(result.summary.imported).toBe(0)
    })

    it('handles multiple declarations on same selector block', () => {
        const css = `:root {
  --color-white: #FFFFFF;
  --color-black: #000000;
  --font-size-base: 1rem;
  --weight-bold: 700;
}`
        const result = importFromCSS(css)
        expect(result.summary.imported).toBe(4)
    })
})

// ---------------------------------------------------------------------------
// Value classification boundary tests
// ---------------------------------------------------------------------------

describe('type classification — boundary values', () => {
    it('classifies 3-char hex color', () => {
        const r = importFromJSON(JSON.stringify({ c: '#FFF' }))
        expect(r.summary.by_type['color']).toBe(1)
    })

    it('classifies 8-char hex color (with alpha)', () => {
        const r = importFromJSON(JSON.stringify({ c: '#FF4A00FF' }))
        expect(r.summary.by_type['color']).toBe(1)
    })

    it('classifies 0rem as dimension', () => {
        const r = importFromJSON(JSON.stringify({ s: '0rem' }))
        expect(r.summary.by_type['dimension']).toBe(1)
    })

    it('classifies px values as dimension', () => {
        const r = importFromJSON(JSON.stringify({ b: '2px' }))
        expect(r.summary.by_type['dimension']).toBe(1)
    })

    it('classifies em values as dimension', () => {
        const r = importFromJSON(JSON.stringify({ e: '1.5em' }))
        expect(r.summary.by_type['dimension']).toBe(1)
    })

    it('classifies fontWeight 100 as fontWeight', () => {
        const r = importFromJSON(JSON.stringify({ w: 100 }))
        expect(r.summary.by_type['fontWeight']).toBe(1)
    })

    it('classifies fontWeight 900 as fontWeight', () => {
        const r = importFromJSON(JSON.stringify({ w: 900 }))
        expect(r.summary.by_type['fontWeight']).toBe(1)
    })

    it('does NOT classify 150 as fontWeight (not a multiple of 100)', () => {
        const r = importFromJSON(JSON.stringify({ w: 150 }))
        expect(r.summary.by_type['fontWeight']).toBeUndefined()
        // 150 is in 0-3 range? no, 150 > 3. So it should be skipped.
        expect(r.summary.skipped).toContain('w')
    })

    it('classifies lineHeight 1 as lineHeight', () => {
        const r = importFromJSON(JSON.stringify({ lh: 1 }))
        expect(r.summary.by_type['lineHeight']).toBe(1)
    })

    it('classifies lineHeight 0 as lineHeight', () => {
        const r = importFromJSON(JSON.stringify({ lh: 0 }))
        expect(r.summary.by_type['lineHeight']).toBe(1)
    })

    it('classifies lineHeight 3 as lineHeight', () => {
        const r = importFromJSON(JSON.stringify({ lh: 3 }))
        expect(r.summary.by_type['lineHeight']).toBe(1)
    })

    it('does NOT classify number > 3 (that is not a font weight) as lineHeight', () => {
        // e.g. 5 — not a fontWeight (not multiple of 100), not lineHeight (> 3)
        const r = importFromJSON(JSON.stringify({ n: 5 }))
        expect(r.summary.skipped).toContain('n')
    })
})

// ---------------------------------------------------------------------------
// deepMergePreserve tests
// ---------------------------------------------------------------------------

describe('deepMergePreserve', () => {
    it('adds new keys from incoming that do not exist in base', () => {
        const base = { a: { $type: 'color', $value: '#000' } }
        const incoming = { b: { $type: 'color', $value: '#FFF' } }
        const merged = deepMergePreserve(base, incoming)
        expect(merged['b']).toEqual({ $type: 'color', $value: '#FFF' })
    })

    it('preserves base leaf value when same key exists in incoming', () => {
        const base = { a: { $type: 'color', $value: '#000000' } }
        const incoming = { a: { $type: 'color', $value: '#FFFFFF' } }
        const merged = deepMergePreserve(base, incoming)
        // Base wins
        const a = merged['a'] as Record<string, unknown>
        expect(a['$value']).toBe('#000000')
    })

    it('recursively merges nested objects', () => {
        const base = { colors: { primary: { $type: 'color', $value: '#FF0000' } } }
        const incoming = {
            colors: {
                primary: { $type: 'color', $value: '#00FF00' },  // base wins
                secondary: { $type: 'color', $value: '#0000FF' }, // new, added
            },
        }
        const merged = deepMergePreserve(
            base as Record<string, unknown>,
            incoming as Record<string, unknown>,
        )
        const colors = merged['colors'] as Record<string, unknown>
        const primary = colors['primary'] as Record<string, unknown>
        expect(primary['$value']).toBe('#FF0000')
        const secondary = colors['secondary'] as Record<string, unknown>
        expect(secondary['$value']).toBe('#0000FF')
    })

    it('handles empty base', () => {
        const base = {}
        const incoming = { a: { $type: 'color', $value: '#FFF' } }
        const merged = deepMergePreserve(base, incoming)
        expect(merged['a']).toBeDefined()
    })

    it('handles empty incoming', () => {
        const base = { a: { $type: 'color', $value: '#FFF' } }
        const merged = deepMergePreserve(base, {})
        expect(merged['a']).toEqual({ $type: 'color', $value: '#FFF' })
    })
})

// ---------------------------------------------------------------------------
// countConflicts tests
// ---------------------------------------------------------------------------

describe('countConflicts', () => {
    it('returns 0 when no overlapping leaf paths', () => {
        const base = { a: { $type: 'color', $value: '#000' } }
        const incoming = { b: { $type: 'color', $value: '#FFF' } }
        expect(countConflicts(base, incoming)).toBe(0)
    })

    it('counts 1 conflict for one overlapping leaf', () => {
        const base = { a: { $type: 'color', $value: '#000' } }
        const incoming = { a: { $type: 'color', $value: '#FFF' } }
        expect(countConflicts(base, incoming)).toBe(1)
    })

    it('counts conflicts in nested objects', () => {
        const base = {
            colors: { primary: { $type: 'color', $value: '#000' } },
        }
        const incoming = {
            colors: {
                primary: { $type: 'color', $value: '#FFF' },
                secondary: { $type: 'color', $value: '#ABC' }, // new, not a conflict
            },
        }
        expect(countConflicts(
            base as Record<string, unknown>,
            incoming as Record<string, unknown>,
        )).toBe(1)
    })

    it('returns 0 for empty base', () => {
        const incoming = { a: { $type: 'color', $value: '#FFF' } }
        expect(countConflicts({}, incoming)).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// importTokensFromFile — file I/O round-trip
// ---------------------------------------------------------------------------

describe('importTokensFromFile — file I/O', () => {
    it('reads and imports a .json file', () => {
        const filePath = writeTmp('tokens.json', JSON.stringify({
            primary: '#FF4A00',
            spacingSm: '0.5rem',
        }))
        const result = importTokensFromFile(filePath, tmpDir)
        expect(result.summary.imported).toBe(2)
    })

    it('reads and imports a .css file', () => {
        const filePath = writeTmp('tokens.css', `
:root {
  --color-primary: #FF4A00;
  --spacing-sm: 0.5rem;
}`)
        const result = importTokensFromFile(filePath, tmpDir)
        expect(result.summary.imported).toBe(2)
    })

    it('reads and imports a .js file', () => {
        const filePath = writeTmp('tokens.js', `
export const TOKENS = {
  primary: '#FF4A00',
  spacingSm: '0.5rem',
};`)
        const result = importTokensFromFile(filePath, tmpDir)
        expect(result.summary.imported).toBe(2)
    })

    it('resolves relative paths from projectRoot', () => {
        writeTmp('rel-tokens.json', JSON.stringify({ bg: '#FFFFFF' }))
        const result = importTokensFromFile('rel-tokens.json', tmpDir)
        expect(result.summary.imported).toBe(1)
    })

    it('throws when file does not exist', () => {
        expect(() => importTokensFromFile('/does/not/exist.json', tmpDir)).toThrow()
    })
})

// ---------------------------------------------------------------------------
// Dry run behavior (via handleImportTokens)
// ---------------------------------------------------------------------------

describe('handleImportTokens — dry_run and merge', () => {
    it('does not write to disk when dry_run=true', async () => {
        const { handleImportTokens } = await import('../../tools/importTokens.js')
        const tokenFile = writeTmp('dry-run-tokens.json', JSON.stringify({ c: '#FF0000' }))
        const outDir = path.join(tmpDir, 'dry-run-project', '.flint')
        // Ensure output dir does NOT exist before dry run
        if (fs.existsSync(outDir)) {
            fs.rmSync(outDir, { recursive: true })
        }

        const result = handleImportTokens({
            file: tokenFile,
            dry_run: true,
            projectRoot: path.join(tmpDir, 'dry-run-project'),
        })

        expect(result.isError).toBeUndefined()
        const output = JSON.parse(result.content[0].text)
        expect(output.dry_run).toBe(true)
        expect(output.written).toBe(false)
        // Output dir should still not exist
        expect(fs.existsSync(outDir)).toBe(false)
    })

    it('writes to disk when dry_run=false', async () => {
        const { handleImportTokens } = await import('../../tools/importTokens.js')
        const tokenFile = writeTmp('write-tokens.json', JSON.stringify({ bg: '#FFFFFF' }))
        const projRoot = path.join(tmpDir, 'write-project')
        fs.mkdirSync(path.join(projRoot, '.flint'), { recursive: true })

        const result = handleImportTokens({
            file: tokenFile,
            dry_run: false,
            projectRoot: projRoot,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.written).toBe(true)
        expect(fs.existsSync(output.output_path)).toBe(true)
    })

    it('returns error for missing file param', async () => {
        const { handleImportTokens } = await import('../../tools/importTokens.js')
        const result = handleImportTokens({ file: '' })
        expect(result.isError).toBe(true)
    })

    it('returns error for unsupported file extension', async () => {
        const { handleImportTokens } = await import('../../tools/importTokens.js')
        const badFile = writeTmp('tokens.yaml', 'color: red')
        const result = handleImportTokens({ file: badFile })
        expect(result.isError).toBe(true)
    })

    it('merge=true preserves existing tokens', async () => {
        const { handleImportTokens } = await import('../../tools/importTokens.js')
        const projRoot = path.join(tmpDir, 'merge-project')
        fs.mkdirSync(path.join(projRoot, '.flint'), { recursive: true })

        // Write initial token file (DTCG tree)
        const existing = {
            primary: { $type: 'color', $value: '#000000' },
        }
        fs.writeFileSync(
            path.join(projRoot, '.flint', 'design-tokens.json'),
            JSON.stringify(existing, null, 2),
        )

        // Import new tokens that include same key
        const newTokenFile = writeTmp('new-tokens.json', JSON.stringify({
            primary: '#FFFFFF', // would conflict
            secondary: '#FF0000', // new
        }))

        const result = handleImportTokens({
            file: newTokenFile,
            merge: true,
            projectRoot: projRoot,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.conflicts).toBeGreaterThanOrEqual(1)

        // Existing primary should be preserved
        const written = JSON.parse(
            fs.readFileSync(path.join(projRoot, '.flint', 'design-tokens.json'), 'utf-8')
        )
        expect(written['primary']['$value']).toBe('#000000')
    })
})
