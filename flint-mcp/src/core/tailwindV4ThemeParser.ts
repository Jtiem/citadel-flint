/**
 * tailwindV4ThemeParser.ts — flint-mcp/src/core/tailwindV4ThemeParser.ts
 *
 * Phase 2 — PostCSS Parser + CSS Modules + Tailwind v4 CSS-First
 *
 * Parses `@theme { ... }` blocks from an already-loaded ParsedStylesheet
 * (produced by cssStylesheetLoader) into a TailwindV4ThemeParseResult whose
 * shape is merge-compatible with Phase 1's ResolvedTailwindTheme.
 *
 * Key design decisions:
 *   - Accepts a ParsedStylesheet — never reads files directly.
 *   - Returns an empty-sections result when blockCount === 0.
 *   - Unknown `--custom-*` prefixes are stored in an `extendedCustom` bucket
 *     but NOT placed in named sections (they are not standard Tailwind tokens
 *     and would cause false positives in drift detection).
 *   - All sections are flat maps: `{ "primary.500": "#0066cc" }`.
 *
 * The `knownClasses` set mirrors Phase 1's contract:
 *   membership = "not drift" for extended-theme classes. The generator
 *   produces class-name prefixes for each section (e.g. `bg-primary`,
 *   `text-primary`, `p-4`, `font-sans`, etc.).
 *
 * Contract: PHASE2-postcss-css-modules.contract.ts
 */

import type { ParsedStylesheet, ResolvedTailwindThemeSection } from './cssStylesheetLoader.js'

// ── Output type ───────────────────────────────────────────────────────────────

export interface TailwindV4ThemeParseResult {
    /** Source CSS file that provided the @theme block(s). */
    sourcePath: string
    /**
     * Merged sections across all @theme blocks in the stylesheet.
     * Shape identical to Phase 1's `ResolvedTailwindTheme.sections`.
     */
    sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
    /**
     * Precomputed known-class set derived from the parsed theme.
     * Membership implies "not drift" for extended-theme classes.
     */
    knownClasses: ReadonlySet<string>
    /** Count of @theme blocks merged. 0 → no @theme in the stylesheet. */
    blockCount: number
    /**
     * Custom properties whose prefix did not map to a standard Tailwind section.
     * Preserved for diagnostic purposes; NOT fed into drift detection.
     */
    extendedCustom?: Record<string, string>
}

// ── Section → Tailwind class prefix map ──────────────────────────────────────

/**
 * For each theme section, the Tailwind utility prefixes that use those tokens.
 * Used to build `knownClasses` entries like `bg-primary`, `text-primary`, etc.
 */
const SECTION_PREFIXES: Record<ResolvedTailwindThemeSection, string[]> = {
    colors: ['bg-', 'text-', 'border-', 'ring-', 'outline-', 'shadow-', 'fill-', 'stroke-', 'accent-', 'caret-', 'decoration-'],
    spacing: ['p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-', 'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-', 'gap-', 'space-x-', 'space-y-', 'w-', 'h-', 'size-'],
    fontFamily: ['font-'],
    fontSize: ['text-'],
    fontWeight: ['font-'],
    lineHeight: ['leading-'],
    letterSpacing: ['tracking-'],
    boxShadow: ['shadow-'],
    borderRadius: ['rounded-'],
    opacity: ['opacity-'],
    zIndex: ['z-'],
}

/**
 * Generate known-class entries for a given token name in a section.
 * e.g. section=colors, tokenName="primary.500" → ["bg-primary-500", "text-primary-500", ...]
 */
function generateKnownClassesForToken(
    section: ResolvedTailwindThemeSection,
    tokenName: string
): string[] {
    const prefixes = SECTION_PREFIXES[section]
    if (!prefixes) return []
    // Convert dot-notation to hyphen: "primary.500" → "primary-500"
    const hyphenName = tokenName.replace(/\./g, '-')
    return prefixes.map((prefix) => `${prefix}${hyphenName}`)
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse `@theme { ... }` blocks from an already-loaded ParsedStylesheet.
 *
 * Returns a result with `blockCount: 0` and empty sections when the stylesheet
 * contains no @theme blocks. Callers MUST check blockCount before merging into
 * the audit pipeline.
 *
 * This function is pure and synchronous — it consumes the `themeBlocks` array
 * that cssStylesheetLoader already extracted.
 */
export function parseV4Theme(stylesheet: ParsedStylesheet): TailwindV4ThemeParseResult {
    const blockCount = stylesheet.themeBlocks.length

    if (blockCount === 0) {
        return {
            sourcePath: stylesheet.sourcePath,
            sections: {},
            knownClasses: new Set<string>(),
            blockCount: 0,
        }
    }

    // Merge all @theme blocks — last-declared wins on conflicts (matches Tailwind runtime)
    const mergedSections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>> = {}
    const extendedCustom: Record<string, string> = {}

    for (const block of stylesheet.themeBlocks) {
        // Each block already has pre-classified sections from cssStylesheetLoader
        for (const [sectionKey, sectionValues] of Object.entries(block.sections)) {
            const section = sectionKey as ResolvedTailwindThemeSection
            if (!mergedSections[section]) {
                mergedSections[section] = {}
            }
            Object.assign(mergedSections[section]!, sectionValues)
        }

        // Collect declarations that did NOT map to any known section.
        // isInSomeSectionOfBlock now checks varName against THEME_VAR_PREFIXES
        // so each declaration is evaluated individually.
        for (const decl of block.rawDeclarations) {
            if (!isInSomeSectionOfBlock(decl.name, block.sections)) {
                extendedCustom[decl.name] = decl.value
            }
        }
    }

    // Build knownClasses from the merged sections
    const knownClassSet = new Set<string>()
    for (const [sectionKey, sectionValues] of Object.entries(mergedSections)) {
        if (!sectionValues) continue
        const section = sectionKey as ResolvedTailwindThemeSection
        for (const tokenName of Object.keys(sectionValues)) {
            const classes = generateKnownClassesForToken(section, tokenName)
            for (const cls of classes) {
                knownClassSet.add(cls)
            }
        }
    }

    const result: TailwindV4ThemeParseResult = {
        sourcePath: stylesheet.sourcePath,
        sections: mergedSections,
        knownClasses: knownClassSet,
        blockCount,
    }

    if (Object.keys(extendedCustom).length > 0) {
        result.extendedCustom = extendedCustom
    }

    return result
}

/**
 * Check if a CSS variable declaration name maps to any known section prefix.
 *
 * Fix: the previous implementation ignored varName entirely — it returned true
 * whenever ANY section had entries, meaning the "unknown prefix" branch that
 * routes to extendedCustom was never reached. Fixed to actually check varName
 * against the known THEME_VAR_PREFIXES, mirroring mapThemeVarToSection.
 */
function isInSomeSectionOfBlock(
    varName: string,
    _sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
): boolean {
    return mapThemeVarToSection(varName) !== null
}

/**
 * Convenience function for the simple function-per-block case (contract signature).
 *
 * Accepts the raw declarations from a single `@theme {}` block (extracted by
 * cssStylesheetLoader or tests). Returns a partial theme that can be spread
 * into a Phase 1 ResolvedTailwindTheme.
 */
export function parseV4ThemeBlock(themeBlock: {
    declarations: Array<{ prop: string; value: string }>
}): Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>> {
    const sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>> = {}

    for (const decl of themeBlock.declarations) {
        const prop = decl.prop
        const value = decl.value.trim()

        const section = mapThemeVarToSection(prop)
        if (section === null) continue

        if (!sections[section]) {
            sections[section] = {}
        }
        const tokenKey = stripSectionPrefix(prop)
        sections[section]![tokenKey] = value
    }

    return sections
}

// ── Helpers (duplicated from cssStylesheetLoader to keep this module standalone) ──

const THEME_VAR_PREFIXES: Array<[string, ResolvedTailwindThemeSection]> = [
    ['color-', 'colors'],
    ['colors-', 'colors'],
    ['spacing-', 'spacing'],
    ['font-family-', 'fontFamily'],
    ['font-size-', 'fontSize'],
    ['font-weight-', 'fontWeight'],
    ['line-height-', 'lineHeight'],
    ['letter-spacing-', 'letterSpacing'],
    ['shadow-', 'boxShadow'],
    ['box-shadow-', 'boxShadow'],
    ['radius-', 'borderRadius'],
    ['border-radius-', 'borderRadius'],
    ['opacity-', 'opacity'],
    ['z-', 'zIndex'],
    ['z-index-', 'zIndex'],
]

function mapThemeVarToSection(varName: string): ResolvedTailwindThemeSection | null {
    const name = varName.startsWith('--') ? varName.slice(2) : varName
    for (const [prefix, section] of THEME_VAR_PREFIXES) {
        if (name.startsWith(prefix)) return section
    }
    return null
}

function stripSectionPrefix(varName: string): string {
    const name = varName.startsWith('--') ? varName.slice(2) : varName
    const prefixes = THEME_VAR_PREFIXES.map(([p]) => p)
    for (const prefix of prefixes) {
        if (name.startsWith(prefix)) {
            return name.slice(prefix.length).replace(/-/g, '.')
        }
    }
    return name
}

// ── Object-style API ──────────────────────────────────────────────────────────

export const tailwindV4ThemeParser = {
    parse: parseV4Theme,
} as const
