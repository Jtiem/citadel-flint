/**
 * tailwindV4ThemeParser.test.ts
 *
 * Phase 2 — PostCSS + CSS Modules + Tailwind v4 CSS-First
 *
 * Test map:
 *   1  — basic --color-primary → theme.colors.primary
 *   2  — multiple declarations → merged into proper sections
 *   3  — unknown prefix → in extendedCustom or skipped, not in named sections
 *   4  — empty block → empty sections, blockCount 0
 *   5  — merges correctly with Phase 1 theme shape (spread/assign)
 *   6  — --spacing-4 → theme.spacing["4"]
 *   7  — --font-family-sans → theme.fontFamily["sans"]
 *   8  — multiple @theme blocks → merged, last-declared wins on conflicts
 *   9  — knownClasses contains generated class prefixes
 *  10  — parseV4ThemeBlock helper function (contract signature)
 *  11  — blockCount reflects number of @theme blocks parsed
 */

import { describe, it, expect } from 'vitest'
import type { ParsedStylesheet } from '../cssStylesheetLoader.js'
import { parseV4Theme, parseV4ThemeBlock } from '../tailwindV4ThemeParser.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStylesheet(themeBlocks: ParsedStylesheet['themeBlocks'], sourcePath = '/src/app.css'): ParsedStylesheet {
    return {
        sourcePath,
        syntax: 'css',
        mtimeMs: Date.now(),
        customProperties: [],
        themeBlocks,
        keyframes: [],
        applyDirectives: [],
    }
}

function makeThemeBlock(
    declarations: Array<{ name: string; value: string }>,
    startLine = 1
): ParsedStylesheet['themeBlocks'][number] {
    // Replicate cssStylesheetLoader's section classification
    const sections: ParsedStylesheet['themeBlocks'][number]['sections'] = {}

    for (const decl of declarations) {
        const name = decl.name.startsWith('--') ? decl.name.slice(2) : decl.name
        let section: keyof typeof sections | null = null
        let prefix = ''

        if (name.startsWith('color-') || name.startsWith('colors-')) { section = 'colors'; prefix = name.startsWith('color-') ? 'color-' : 'colors-' }
        else if (name.startsWith('spacing-')) { section = 'spacing'; prefix = 'spacing-' }
        else if (name.startsWith('font-family-')) { section = 'fontFamily'; prefix = 'font-family-' }
        else if (name.startsWith('font-size-')) { section = 'fontSize'; prefix = 'font-size-' }
        else if (name.startsWith('font-weight-')) { section = 'fontWeight'; prefix = 'font-weight-' }
        else if (name.startsWith('line-height-')) { section = 'lineHeight'; prefix = 'line-height-' }
        else if (name.startsWith('letter-spacing-')) { section = 'letterSpacing'; prefix = 'letter-spacing-' }
        else if (name.startsWith('shadow-') || name.startsWith('box-shadow-')) { section = 'boxShadow'; prefix = name.startsWith('box-shadow-') ? 'box-shadow-' : 'shadow-' }
        else if (name.startsWith('radius-') || name.startsWith('border-radius-')) { section = 'borderRadius'; prefix = name.startsWith('border-radius-') ? 'border-radius-' : 'radius-' }
        else if (name.startsWith('opacity-')) { section = 'opacity'; prefix = 'opacity-' }
        else if (name.startsWith('z-index-') || (name.startsWith('z-') && !name.startsWith('z-index-'))) {
            section = 'zIndex'
            prefix = name.startsWith('z-index-') ? 'z-index-' : 'z-'
        }

        if (section !== null) {
            if (!sections[section]) sections[section] = {}
            const key = name.slice(prefix.length).replace(/-/g, '.')
            sections[section]![key] = decl.value
        }
    }

    return {
        rawDeclarations: declarations.map((d, i) => ({ name: d.name, value: d.value, line: i + 2 })),
        sections,
        startLine,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tailwindV4ThemeParser', () => {

    // ── 1. Basic --color-primary ──────────────────────────────────────────────

    it('1 — --color-primary → theme.sections.colors.primary', () => {
        const block = makeThemeBlock([{ name: '--color-primary', value: '#0066cc' }])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        expect(result.blockCount).toBe(1)
        expect(result.sections.colors).toBeDefined()
        expect(result.sections.colors!['primary']).toBe('#0066cc')
    })

    // ── 2. Multiple declarations ──────────────────────────────────────────────

    it('2 — multiple declarations → merged into proper sections', () => {
        const block = makeThemeBlock([
            { name: '--color-primary', value: '#0066cc' },
            { name: '--spacing-4', value: '1rem' },
            { name: '--font-family-sans', value: 'Inter, sans-serif' },
            { name: '--font-size-lg', value: '1.125rem' },
        ])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        expect(result.sections.colors!['primary']).toBe('#0066cc')
        expect(result.sections.spacing!['4']).toBe('1rem')
        expect(result.sections.fontFamily!['sans']).toBe('Inter, sans-serif')
        expect(result.sections.fontSize!['lg']).toBe('1.125rem')
    })

    // ── 3. Unknown prefix ─────────────────────────────────────────────────────

    it('3 — unknown prefix not in named sections (may go to extendedCustom or be skipped)', () => {
        const block = makeThemeBlock([
            { name: '--custom-brand-gradient', value: 'linear-gradient(...)' },
            { name: '--color-primary', value: '#0066cc' }, // known
        ])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        // The unknown prefix must NOT appear in any standard section
        const allSectionValues = Object.values(result.sections).flatMap((s) => Object.entries(s ?? {}))
        const unknownInSections = allSectionValues.some(([k]) => k.includes('custom-brand-gradient') || k.includes('brand.gradient'))
        expect(unknownInSections).toBe(false)

        // The known one still maps correctly
        expect(result.sections.colors!['primary']).toBe('#0066cc')
    })

    // ── 4. Empty block ────────────────────────────────────────────────────────

    it('4 — empty @theme block → empty sections, blockCount 0 when no blocks', () => {
        const stylesheet = makeStylesheet([])
        const result = parseV4Theme(stylesheet)

        expect(result.blockCount).toBe(0)
        expect(Object.keys(result.sections)).toHaveLength(0)
        expect(result.knownClasses.size).toBe(0)
    })

    it('4b — @theme block with no declarations → sections may be empty but blockCount 1', () => {
        const block = makeThemeBlock([]) // no declarations
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        expect(result.blockCount).toBe(1)
        // Sections may be empty or minimal
        expect(result.sections).toBeDefined()
    })

    // ── 5. Merges with Phase 1 theme shape ────────────────────────────────────

    it('5 — merges correctly with Phase 1 ResolvedTailwindTheme shape via spread', () => {
        const block = makeThemeBlock([
            { name: '--color-brand', value: '#ff6600' },
            { name: '--spacing-8', value: '2rem' },
        ])
        const stylesheet = makeStylesheet([block])
        const phase2Result = parseV4Theme(stylesheet)

        // Simulate Phase 1 theme
        const phase1Sections = {
            colors: { 'primary.500': '#0066cc' },
            spacing: { '4': '1rem' },
        }

        // Merge: Phase 2 overlays Phase 1
        const mergedSections = {
            ...phase1Sections,
            colors: { ...phase1Sections.colors, ...phase2Result.sections.colors },
            spacing: { ...phase1Sections.spacing, ...phase2Result.sections.spacing },
        }

        expect(mergedSections.colors['primary.500']).toBe('#0066cc') // Phase 1 preserved
        expect(mergedSections.colors['brand']).toBe('#ff6600')       // Phase 2 added
        expect(mergedSections.spacing['4']).toBe('1rem')              // Phase 1 preserved
        expect(mergedSections.spacing['8']).toBe('2rem')              // Phase 2 added
    })

    // ── 6. --spacing-4 ────────────────────────────────────────────────────────

    it('6 — --spacing-4 → theme.spacing["4"] = "1rem"', () => {
        const block = makeThemeBlock([{ name: '--spacing-4', value: '1rem' }])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        expect(result.sections.spacing).toBeDefined()
        expect(result.sections.spacing!['4']).toBe('1rem')
    })

    // ── 7. --font-family-sans ─────────────────────────────────────────────────

    it('7 — --font-family-sans → theme.fontFamily["sans"]', () => {
        const block = makeThemeBlock([{ name: '--font-family-sans', value: 'Inter, system-ui, sans-serif' }])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        expect(result.sections.fontFamily).toBeDefined()
        expect(result.sections.fontFamily!['sans']).toBe('Inter, system-ui, sans-serif')
    })

    // ── 8. Multiple @theme blocks — last wins ─────────────────────────────────

    it('8 — multiple @theme blocks → merged, last-declared wins on conflicts', () => {
        const block1 = makeThemeBlock([{ name: '--color-primary', value: '#0066cc' }], 1)
        const block2 = makeThemeBlock([{ name: '--color-primary', value: '#ff0000' }], 20)
        const stylesheet = makeStylesheet([block1, block2])
        const result = parseV4Theme(stylesheet)

        expect(result.blockCount).toBe(2)
        // Last block wins
        expect(result.sections.colors!['primary']).toBe('#ff0000')
    })

    // ── 9. knownClasses ───────────────────────────────────────────────────────

    it('9 — knownClasses contains generated class prefixes for color tokens', () => {
        const block = makeThemeBlock([
            { name: '--color-primary', value: '#0066cc' },
            { name: '--spacing-4', value: '1rem' },
        ])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        // Colors generate bg-*, text-*, border-* etc.
        expect(result.knownClasses.has('bg-primary')).toBe(true)
        expect(result.knownClasses.has('text-primary')).toBe(true)
        expect(result.knownClasses.has('border-primary')).toBe(true)

        // Spacing generates p-*, m-*, w-* etc.
        expect(result.knownClasses.has('p-4')).toBe(true)
        expect(result.knownClasses.has('m-4')).toBe(true)
    })

    // ── 10. parseV4ThemeBlock helper ─────────────────────────────────────────

    it('10 — parseV4ThemeBlock(declarations) → returns partial sections', () => {
        const sections = parseV4ThemeBlock({
            declarations: [
                { prop: '--color-primary', value: '#0066cc' },
                { prop: '--spacing-2', value: '0.5rem' },
                { prop: '--unknown-thing', value: 'foo' }, // should be skipped
            ],
        })

        expect(sections.colors).toBeDefined()
        expect(sections.colors!['primary']).toBe('#0066cc')
        expect(sections.spacing).toBeDefined()
        expect(sections.spacing!['2']).toBe('0.5rem')
        // Unknown prefix does not appear in any section
        const allKeys = Object.values(sections).flatMap((s) => Object.keys(s ?? {}))
        expect(allKeys).not.toContain('unknown-thing')
    })

    // ── Fix3: extendedCustom routing ─────────────────────────────────────────

    it('Fix3 — unknown prefix goes to extendedCustom, NOT standard sections', () => {
        // --custom-weird has no known prefix; must land in extendedCustom
        const block = makeThemeBlock([{ name: '--custom-weird', value: '#abc' }])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        // No standard section must contain this token
        const allSectionValues = Object.values(result.sections).flatMap((s) => Object.values(s ?? {}))
        expect(allSectionValues).not.toContain('#abc')

        // Must appear in extendedCustom
        expect(result.extendedCustom).toBeDefined()
        expect(result.extendedCustom!['--custom-weird']).toBe('#abc')
    })

    it('Fix3 — known prefix (--color-primary) lands in theme.colors, NOT extendedCustom', () => {
        const block = makeThemeBlock([{ name: '--color-primary', value: '#0066cc' }])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        expect(result.sections.colors!['primary']).toBe('#0066cc')
        // Must NOT appear in extendedCustom
        expect(result.extendedCustom?.['--color-primary']).toBeUndefined()
    })

    it('Fix3 — mixed known + unknown: each routes correctly', () => {
        const block = makeThemeBlock([
            { name: '--custom-weird', value: '#abc' },
            { name: '--color-primary', value: '#0066cc' },
            { name: '--custom-gradient-brand', value: 'linear-gradient(...)' },
        ])
        const stylesheet = makeStylesheet([block])
        const result = parseV4Theme(stylesheet)

        // Known prefix goes to sections
        expect(result.sections.colors!['primary']).toBe('#0066cc')

        // Unknown prefixes go to extendedCustom
        expect(result.extendedCustom!['--custom-weird']).toBe('#abc')
        expect(result.extendedCustom!['--custom-gradient-brand']).toBe('linear-gradient(...)')

        // extendedCustom must NOT contain the known token
        expect(result.extendedCustom?.['--color-primary']).toBeUndefined()
    })

    // ── 11. blockCount ────────────────────────────────────────────────────────

    it('11 — blockCount reflects number of @theme blocks in the stylesheet', () => {
        const blocks = [
            makeThemeBlock([{ name: '--color-a', value: '#aaa' }], 1),
            makeThemeBlock([{ name: '--color-b', value: '#bbb' }], 10),
            makeThemeBlock([{ name: '--color-c', value: '#ccc' }], 20),
        ]
        const stylesheet = makeStylesheet(blocks)
        const result = parseV4Theme(stylesheet)

        expect(result.blockCount).toBe(3)
        expect(result.sections.colors!['a']).toBe('#aaa')
        expect(result.sections.colors!['b']).toBe('#bbb')
        expect(result.sections.colors!['c']).toBe('#ccc')
    })

})
