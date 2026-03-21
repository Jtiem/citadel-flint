/**
 * Token extractor — flint-mcp/src/core/init/tokenExtractor.ts
 *
 * Extracts design tokens from a project based on the detected stack.
 * Returns a TokenExtractionResult with Flint-format DesignToken objects.
 *
 * Supported sources:
 *   - tailwind-v3 : dynamic require() of tailwind.config, walk theme object
 *   - tailwind-v4 : text scan of @theme CSS block
 *   - css-custom-props : text scan of :root CSS blocks
 *   - dtcg / tokens-studio : walk JSON for $value/$type (DTCG) or value/type (TS)
 *   - chakra / mui / radix : bundled static defaults
 *   - none : empty set with guidance warning
 *
 * Per Commandment 13 clarification: text scanning of CSS/JSON for token
 * READ purposes (no mutation) is acceptable. All source code mutations still
 * require Babel AST traversal.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import type { DesignToken, TokenType } from '../../types.js'
import type { StackDetectionResult, TokenExtractionResult } from './types.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function safeReadFile(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf8')
    } catch {
        return null
    }
}

function safeReadJson(filePath: string): unknown {
    const raw = safeReadFile(filePath)
    if (raw === null) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

/**
 * Derive a Flint TokenType from a token name and value.
 * Used for both CSS custom-property extraction and DTCG type mapping.
 */
function inferTokenType(name: string, value: string): TokenType {
    const n = name.toLowerCase()

    if (
        n.includes('color') || n.includes('-bg') || n.includes('bg-') ||
        n.includes('-fg') || n.includes('fg-') || n.includes('border-color') ||
        n.includes('-fill') || n.includes('fill-') || n.includes('-text') ||
        n.includes('text-') || n.includes('-surface') || n.includes('surface-')
    ) return 'color'

    if (
        /^#([0-9a-fA-F]{3,8})$/.test(value.trim()) ||
        /^rgba?\s*\(/.test(value.trim()) ||
        /^hsla?\s*\(/.test(value.trim()) ||
        /^oklch\s*\(/.test(value.trim())
    ) return 'color'

    if (
        n.includes('font-family') || n.includes('fontfamily') || n.includes('font_family')
    ) return 'fontFamily'

    if (
        n.includes('font-weight') || n.includes('fontweight') || n.includes('font_weight')
    ) return 'fontWeight'

    if (
        n.includes('line-height') || n.includes('lineheight') || n.includes('line_height')
    ) return 'lineHeight'

    if (
        n.includes('letter-spacing') || n.includes('letterspacing') || n.includes('letter_spacing')
    ) return 'letterSpacing'

    if (n.includes('shadow') || n.includes('box-shadow')) return 'shadow'
    if (n.includes('opacity') || n.includes('alpha')) return 'opacity'

    if (
        n.includes('spacing') || n.includes('gap') || n.includes('padding') ||
        n.includes('margin') || n.includes('size') || n.includes('width') ||
        n.includes('height') || n.includes('radius') || n.includes('font-size') ||
        n.includes('fontsize')
    ) return 'dimension'

    if (/\d+(px|rem|em|vh|vw|ch|ex|vmin|vmax)$/.test(value.trim())) return 'dimension'

    return 'dimension'
}

/** Map a W3C DTCG $type string to a Flint TokenType. */
function mapDTCGType(dtcgType: string): TokenType {
    const map: Record<string, TokenType> = {
        color: 'color',
        dimension: 'dimension',
        fontFamily: 'fontFamily',
        'font-family': 'fontFamily',
        fontWeight: 'fontWeight',
        'font-weight': 'fontWeight',
        lineHeight: 'lineHeight',
        'line-height': 'lineHeight',
        letterSpacing: 'letterSpacing',
        'letter-spacing': 'letterSpacing',
        shadow: 'shadow',
        opacity: 'opacity',
        string: 'string',
        boolean: 'boolean',
        number: 'dimension',
        spacing: 'dimension',
        borderRadius: 'dimension',
        'border-radius': 'dimension',
        sizing: 'dimension',
        typography: 'string',
    }
    return map[dtcgType] ?? 'dimension'
}

// Tailwind special values to skip during extraction
const TAILWIND_SKIP_VALUES = new Set([
    'inherit', 'current', 'transparent', 'currentColor', 'initial', 'unset', 'revert',
])

// Auto-incrementing ID counter — reset per extraction call
let _idCounter = 1
function nextId(): number {
    return _idCounter++
}

// ── flattenThemeObject ────────────────────────────────────────────────────────

/**
 * Recursively flattens a Tailwind theme sub-object into DesignToken entries.
 *
 * @param obj       The theme sub-object (e.g. theme.colors).
 * @param tokenType Flint token type string for all tokens produced here.
 * @param prefix    Dot-separated key path built up during recursion.
 */
export function flattenThemeObject(
    obj: Record<string, unknown>,
    tokenType: string,
    prefix: string,
): DesignToken[] {
    const tokens: DesignToken[] = []

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = prefix ? `${prefix}.${key}` : key

        if (typeof value === 'string' || typeof value === 'number') {
            const strValue = String(value)
            if (TAILWIND_SKIP_VALUES.has(strValue)) continue
            const id = currentPath.replace(/\./g, '-')
            tokens.push({
                id: nextId(),
                token_path: `${tokenType}.${currentPath}`,
                token_type: tokenType as TokenType,
                token_value: strValue,
                description: null,
                collection_name: 'tailwind',
                mode: 'default',
            })
        } else if (Array.isArray(value)) {
            // Font families: ['Inter', 'sans-serif'] → "Inter, sans-serif"
            const strValue = (value as unknown[])
                .map((v) => String(v))
                .join(', ')
            tokens.push({
                id: nextId(),
                token_path: `${tokenType}.${currentPath}`,
                token_type: tokenType as TokenType,
                token_value: strValue,
                description: null,
                collection_name: 'tailwind',
                mode: 'default',
            })
        } else if (value && typeof value === 'object') {
            tokens.push(
                ...flattenThemeObject(
                    value as Record<string, unknown>,
                    tokenType,
                    currentPath,
                ),
            )
        }
    }

    return tokens
}

// ── Tailwind v3 extractor ────────────────────────────────────────────────────

const TAILWIND_THEME_KEY_TO_TYPE: Array<[string, string]> = [
    ['colors', 'color'],
    ['color', 'color'],
    ['spacing', 'spacing'],
    ['fontSize', 'fontSize'],
    ['fontWeight', 'fontWeight'],
    ['fontFamily', 'fontFamily'],
    ['borderRadius', 'borderRadius'],
    ['boxShadow', 'shadow'],
    ['letterSpacing', 'letterSpacing'],
    ['lineHeight', 'lineHeight'],
    ['opacity', 'opacity'],
]

async function extractTailwindV3(
    configPath: string,
    warnings: string[],
): Promise<DesignToken[]> {
    _idCounter = 1
    let themeConfig: Record<string, unknown> = {}

    try {
        // In ESM context we use dynamic import. Wrap in try/catch per spec.
        const fileUrl = pathToFileURL(configPath).href
        const mod = await import(fileUrl).catch(() => null)
        if (mod) {
            const raw = mod.default ?? mod
            themeConfig = (raw as { theme?: Record<string, unknown> }).theme ?? {}
        } else {
            // Fallback: try createRequire for CJS configs
            const req = createRequire(import.meta.url)
            try {
                const raw = req(configPath) as { theme?: Record<string, unknown> } | unknown
                if (raw && typeof raw === 'object') {
                    themeConfig = (raw as { theme?: Record<string, unknown> }).theme ?? {}
                }
            } catch {
                warnings.push(
                    `Could not evaluate tailwind.config — some tokens may be missing.`,
                )
            }
        }
    } catch {
        warnings.push(`Could not evaluate tailwind.config — some tokens may be missing.`)
    }

    const tokens: DesignToken[] = []

    // Walk theme.extend first (overrides), then theme (base)
    const extend =
        (themeConfig['extend'] as Record<string, unknown> | undefined) ?? {}

    for (const [themeKey, flintType] of TAILWIND_THEME_KEY_TO_TYPE) {
        const extendSection = extend[themeKey] as Record<string, unknown> | undefined
        if (extendSection && typeof extendSection === 'object' && !Array.isArray(extendSection)) {
            tokens.push(...flattenThemeObject(extendSection, flintType, ''))
        }
        const baseSection = themeConfig[themeKey] as Record<string, unknown> | undefined
        if (baseSection && typeof baseSection === 'object' && !Array.isArray(baseSection)) {
            tokens.push(...flattenThemeObject(baseSection, flintType, ''))
        }
    }

    return tokens
}

// ── Tailwind v4 extractor ────────────────────────────────────────────────────

/**
 * Maps Tailwind v4 CSS variable prefixes to Flint token types.
 * Returns null for prefixes that don't map to a known type (skip them).
 */
function inferV4TokenType(varName: string): TokenType | null {
    const n = varName.toLowerCase()
    if (n.startsWith('--color-')) return 'color'
    if (n.startsWith('--font-size-') || n.startsWith('--text-')) return 'dimension'
    if (n.startsWith('--font-family-') || n.startsWith('--font-')) return 'fontFamily'
    if (n.startsWith('--font-weight-') || n.startsWith('--weight-')) return 'fontWeight'
    if (n.startsWith('--leading-') || n.startsWith('--line-height-')) return 'lineHeight'
    if (n.startsWith('--tracking-') || n.startsWith('--letter-spacing-')) return 'letterSpacing'
    if (n.startsWith('--shadow-')) return 'shadow'
    if (n.startsWith('--opacity-')) return 'opacity'
    if (n.startsWith('--spacing-') || n.startsWith('--radius-') || n.startsWith('--size-')) return 'dimension'
    return null
}

function extractTailwindV4(cssPath: string, warnings: string[]): DesignToken[] {
    _idCounter = 1
    const css = safeReadFile(cssPath)
    if (!css) {
        warnings.push(`Could not read Tailwind v4 CSS file: ${cssPath}`)
        return []
    }

    // Extract all @theme { ... } block contents
    const tokens: DesignToken[] = []
    const themeBlockRegex = /@theme\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
    let match: RegExpExecArray | null

    while ((match = themeBlockRegex.exec(css)) !== null) {
        const blockContent = match[1]
        // Match CSS custom property declarations: --name: value;
        const propRegex = /(--[\w-]+)\s*:\s*([^;]+);/g
        let propMatch: RegExpExecArray | null
        while ((propMatch = propRegex.exec(blockContent)) !== null) {
            const varName = propMatch[1].trim()
            const value = propMatch[2].trim()
            const tokenType = inferV4TokenType(varName)
            if (!tokenType) continue

            // Build a token_path from the CSS var name: --color-primary-500 → color.primary-500
            const withoutDashes = varName.replace(/^--/, '')
            const tokenPath = withoutDashes.replace(/-/g, '.').replace(/^color\./, 'color.')

            tokens.push({
                id: nextId(),
                token_path: tokenPath,
                token_type: tokenType,
                token_value: value,
                description: null,
                collection_name: 'tailwind-v4',
                mode: 'default',
            })
        }
    }

    return tokens
}

// ── CSS custom properties extractor ─────────────────────────────────────────

function extractCSSCustomProps(cssFiles: string[], warnings: string[]): DesignToken[] {
    _idCounter = 1
    const tokens: DesignToken[] = []

    for (const cssFile of cssFiles) {
        const css = safeReadFile(cssFile)
        if (!css) {
            warnings.push(`Could not read CSS file: ${cssFile}`)
            continue
        }

        // Find all :root { ... } blocks
        const rootBlockRegex = /:root\s*\{([^}]+)\}/g
        let blockMatch: RegExpExecArray | null

        while ((blockMatch = rootBlockRegex.exec(css)) !== null) {
            const blockContent = blockMatch[1]
            const propRegex = /(--[\w-]+)\s*:\s*([^;]+);/g
            let propMatch: RegExpExecArray | null

            while ((propMatch = propRegex.exec(blockContent)) !== null) {
                const varName = propMatch[1].trim()
                const value = propMatch[2].trim()
                const tokenType = inferTokenType(varName, value)

                // Build token_path from var name: --color-primary → color-custom.color-primary
                const withoutDashes = varName.replace(/^--/, '')
                const tokenPath = `css-custom.${withoutDashes}`

                tokens.push({
                    id: nextId(),
                    token_path: tokenPath,
                    token_type: tokenType,
                    token_value: value,
                    description: null,
                    collection_name: 'css-custom-props',
                    mode: 'default',
                })
            }
        }
    }

    return tokens
}

// ── DTCG extractor ───────────────────────────────────────────────────────────

function walkDTCG(
    obj: Record<string, unknown>,
    pathParts: string[],
    tokens: DesignToken[],
): void {
    if ('$value' in obj && '$type' in obj) {
        const tokenType = mapDTCGType(String(obj['$type']))
        let tokenValue = String(obj['$value'])
        if (typeof obj['$value'] === 'object' && obj['$value'] !== null) {
            tokenValue = JSON.stringify(obj['$value'])
        }
        const tokenPath = pathParts.join('.')
        tokens.push({
            id: nextId(),
            token_path: tokenPath,
            token_type: tokenType,
            token_value: tokenValue,
            description: (obj['$description'] as string | null) ?? null,
            collection_name: 'dtcg',
            mode: 'default',
        })
        return
    }

    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue // skip $schema, $version, etc.
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            walkDTCG(value as Record<string, unknown>, [...pathParts, key], tokens)
        }
    }
}

function extractDTCG(tokenFiles: string[], warnings: string[]): DesignToken[] {
    _idCounter = 1
    const tokens: DesignToken[] = []

    for (const tokenFile of tokenFiles) {
        const obj = safeReadJson(tokenFile)
        if (!obj || typeof obj !== 'object') {
            warnings.push(`Could not parse DTCG token file: ${tokenFile}`)
            continue
        }
        walkDTCG(obj as Record<string, unknown>, [], tokens)
    }

    return tokens
}

// ── Tokens Studio extractor ──────────────────────────────────────────────────

function walkTokensStudio(
    obj: Record<string, unknown>,
    pathParts: string[],
    tokens: DesignToken[],
): void {
    // Tokens Studio format: { value, type } (no $ prefix)
    if ('value' in obj && 'type' in obj && !('$value' in obj)) {
        const tokenType = mapDTCGType(String(obj['type']))
        let tokenValue = String(obj['value'])
        if (typeof obj['value'] === 'object' && obj['value'] !== null) {
            tokenValue = JSON.stringify(obj['value'])
        }
        const tokenPath = pathParts.join('.')
        tokens.push({
            id: nextId(),
            token_path: tokenPath,
            token_type: tokenType,
            token_value: tokenValue,
            description: (obj['description'] as string | null) ?? null,
            collection_name: 'tokens-studio',
            mode: 'default',
        })
        return
    }

    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            walkTokensStudio(value as Record<string, unknown>, [...pathParts, key], tokens)
        }
    }
}

function extractTokensStudio(tokenFiles: string[], warnings: string[]): DesignToken[] {
    _idCounter = 1
    const tokens: DesignToken[] = []

    for (const tokenFile of tokenFiles) {
        const obj = safeReadJson(tokenFile)
        if (!obj || typeof obj !== 'object') {
            warnings.push(`Could not parse Tokens Studio file: ${tokenFile}`)
            continue
        }
        walkTokensStudio(obj as Record<string, unknown>, [], tokens)
    }

    return tokens
}

// ── Static framework defaults ────────────────────────────────────────────────

function makeToken(
    id: number,
    path: string,
    type: TokenType,
    value: string,
    collection: string,
): DesignToken {
    return { id, token_path: path, token_type: type, token_value: value, description: null, collection_name: collection, mode: 'default' }
}

const CHAKRA_DEFAULTS: DesignToken[] = [
    makeToken(1,  'color.blue.500',     'color',     '#3182CE', 'chakra'),
    makeToken(2,  'color.blue.600',     'color',     '#2B6CB0', 'chakra'),
    makeToken(3,  'color.gray.50',      'color',     '#F7FAFC', 'chakra'),
    makeToken(4,  'color.gray.100',     'color',     '#EDF2F7', 'chakra'),
    makeToken(5,  'color.gray.200',     'color',     '#E2E8F0', 'chakra'),
    makeToken(6,  'color.gray.500',     'color',     '#718096', 'chakra'),
    makeToken(7,  'color.gray.700',     'color',     '#2D3748', 'chakra'),
    makeToken(8,  'color.gray.900',     'color',     '#171923', 'chakra'),
    makeToken(9,  'color.green.500',    'color',     '#38A169', 'chakra'),
    makeToken(10, 'color.red.500',      'color',     '#E53E3E', 'chakra'),
    makeToken(11, 'color.orange.500',   'color',     '#DD6B20', 'chakra'),
    makeToken(12, 'color.white',        'color',     '#FFFFFF', 'chakra'),
    makeToken(13, 'spacing.1',          'dimension', '0.25rem', 'chakra'),
    makeToken(14, 'spacing.2',          'dimension', '0.5rem',  'chakra'),
    makeToken(15, 'spacing.3',          'dimension', '0.75rem', 'chakra'),
    makeToken(16, 'spacing.4',          'dimension', '1rem',    'chakra'),
    makeToken(17, 'spacing.6',          'dimension', '1.5rem',  'chakra'),
    makeToken(18, 'spacing.8',          'dimension', '2rem',    'chakra'),
    makeToken(19, 'fontSize.sm',        'dimension', '0.875rem','chakra'),
    makeToken(20, 'fontSize.md',        'dimension', '1rem',    'chakra'),
    makeToken(21, 'fontSize.lg',        'dimension', '1.125rem','chakra'),
    makeToken(22, 'fontSize.xl',        'dimension', '1.25rem', 'chakra'),
    makeToken(23, 'fontSize.2xl',       'dimension', '1.5rem',  'chakra'),
    makeToken(24, 'radii.sm',           'dimension', '0.125rem','chakra'),
    makeToken(25, 'radii.md',           'dimension', '0.375rem','chakra'),
    makeToken(26, 'radii.lg',           'dimension', '0.5rem',  'chakra'),
    makeToken(27, 'fontWeight.normal',  'fontWeight','400',     'chakra'),
    makeToken(28, 'fontWeight.medium',  'fontWeight','500',     'chakra'),
    makeToken(29, 'fontWeight.bold',    'fontWeight','700',     'chakra'),
]

const MUI_DEFAULTS: DesignToken[] = [
    makeToken(1,  'color.primary.main',      'color',     '#1976D2', 'mui'),
    makeToken(2,  'color.primary.dark',      'color',     '#115293', 'mui'),
    makeToken(3,  'color.primary.light',     'color',     '#4FC3F7', 'mui'),
    makeToken(4,  'color.secondary.main',    'color',     '#9C27B0', 'mui'),
    makeToken(5,  'color.error.main',        'color',     '#D32F2F', 'mui'),
    makeToken(6,  'color.warning.main',      'color',     '#ED6C02', 'mui'),
    makeToken(7,  'color.success.main',      'color',     '#2E7D32', 'mui'),
    makeToken(8,  'color.grey.50',           'color',     '#FAFAFA', 'mui'),
    makeToken(9,  'color.grey.100',          'color',     '#F5F5F5', 'mui'),
    makeToken(10, 'color.grey.200',          'color',     '#EEEEEE', 'mui'),
    makeToken(11, 'color.grey.500',          'color',     '#9E9E9E', 'mui'),
    makeToken(12, 'color.grey.900',          'color',     '#212121', 'mui'),
    makeToken(13, 'color.background.default','color',     '#FFFFFF', 'mui'),
    makeToken(14, 'color.text.primary',      'color',     'rgba(0,0,0,0.87)', 'mui'),
    makeToken(15, 'color.text.secondary',    'color',     'rgba(0,0,0,0.6)', 'mui'),
    makeToken(16, 'spacing.1',               'dimension', '8px',    'mui'),
    makeToken(17, 'spacing.2',               'dimension', '16px',   'mui'),
    makeToken(18, 'spacing.3',               'dimension', '24px',   'mui'),
    makeToken(19, 'spacing.4',               'dimension', '32px',   'mui'),
    makeToken(20, 'typography.body1.fontSize','dimension','1rem',   'mui'),
    makeToken(21, 'typography.body2.fontSize','dimension','0.875rem','mui'),
    makeToken(22, 'typography.h1.fontSize',  'dimension', '6rem',   'mui'),
    makeToken(23, 'typography.h2.fontSize',  'dimension', '3.75rem','mui'),
    makeToken(24, 'shape.borderRadius',      'dimension', '4px',    'mui'),
    makeToken(25, 'shadows.1',               'shadow',    '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14)', 'mui'),
    makeToken(26, 'shadows.4',               'shadow',    '0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14)', 'mui'),
    makeToken(27, 'fontWeight.regular',      'fontWeight','400',    'mui'),
    makeToken(28, 'fontWeight.medium',       'fontWeight','500',    'mui'),
    makeToken(29, 'fontWeight.bold',         'fontWeight','700',    'mui'),
]

const RADIX_DEFAULTS: DesignToken[] = [
    makeToken(1,  'color.accent.9',        'color',     '#3E63DD', 'radix'),
    makeToken(2,  'color.accent.10',       'color',     '#3358D4', 'radix'),
    makeToken(3,  'color.gray.1',          'color',     '#FCFCFC', 'radix'),
    makeToken(4,  'color.gray.2',          'color',     '#F9F9F9', 'radix'),
    makeToken(5,  'color.gray.3',          'color',     '#F0F0F0', 'radix'),
    makeToken(6,  'color.gray.5',          'color',     '#D8D8D8', 'radix'),
    makeToken(7,  'color.gray.8',          'color',     '#ADADAD', 'radix'),
    makeToken(8,  'color.gray.11',         'color',     '#646464', 'radix'),
    makeToken(9,  'color.gray.12',         'color',     '#202020', 'radix'),
    makeToken(10, 'color.red.9',           'color',     '#E5484D', 'radix'),
    makeToken(11, 'color.green.9',         'color',     '#30A46C', 'radix'),
    makeToken(12, 'color.orange.9',        'color',     '#F76B15', 'radix'),
    makeToken(13, 'space.1',               'dimension', '4px',     'radix'),
    makeToken(14, 'space.2',               'dimension', '8px',     'radix'),
    makeToken(15, 'space.3',               'dimension', '12px',    'radix'),
    makeToken(16, 'space.4',               'dimension', '16px',    'radix'),
    makeToken(17, 'space.5',               'dimension', '20px',    'radix'),
    makeToken(18, 'space.6',               'dimension', '24px',    'radix'),
    makeToken(19, 'space.9',               'dimension', '36px',    'radix'),
    makeToken(20, 'radius.1',              'dimension', '3px',     'radix'),
    makeToken(21, 'radius.2',              'dimension', '4px',     'radix'),
    makeToken(22, 'radius.3',              'dimension', '6px',     'radix'),
    makeToken(23, 'radius.full',           'dimension', '9999px',  'radix'),
    makeToken(24, 'fontSize.1',            'dimension', '12px',    'radix'),
    makeToken(25, 'fontSize.2',            'dimension', '14px',    'radix'),
    makeToken(26, 'fontSize.3',            'dimension', '16px',    'radix'),
    makeToken(27, 'fontWeight.regular',    'fontWeight','400',     'radix'),
    makeToken(28, 'fontWeight.medium',     'fontWeight','500',     'radix'),
    makeToken(29, 'fontWeight.bold',       'fontWeight','700',     'radix'),
]

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Extract design tokens from the project based on the detected stack.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param stack       - The StackDetectionResult from detectStack().
 * @returns A TokenExtractionResult with tokens, source description, and warnings.
 */
export async function extractTokens(
    projectRoot: string,
    stack: StackDetectionResult,
): Promise<TokenExtractionResult> {
    const warnings: string[] = []

    switch (stack.framework) {

        case 'tailwind-v3': {
            if (!stack.configPath) {
                warnings.push('Tailwind v3 detected but no config path available.')
                return { tokens: [], source: 'tailwind-v3 (no config)', warnings }
            }
            const tokens = await extractTailwindV3(stack.configPath, warnings)
            return {
                tokens,
                source: `Tailwind v3 config: ${stack.configPath}`,
                warnings,
            }
        }

        case 'tailwind-v4': {
            if (!stack.configPath) {
                warnings.push('Tailwind v4 detected but no CSS file path available.')
                return { tokens: [], source: 'tailwind-v4 (no CSS file)', warnings }
            }
            const tokens = extractTailwindV4(stack.configPath, warnings)
            return {
                tokens,
                source: `Tailwind v4 @theme block: ${stack.configPath}`,
                warnings,
            }
        }

        case 'css-custom-props': {
            const cssFiles = stack.cssFiles.length > 0
                ? stack.cssFiles
                : (stack.configPath ? [stack.configPath] : [])
            const tokens = extractCSSCustomProps(cssFiles, warnings)
            return {
                tokens,
                source: `CSS custom properties from: ${cssFiles.join(', ')}`,
                warnings,
            }
        }

        case 'dtcg': {
            // Special case: .flint/design-tokens.json is in Flint native format, not DTCG
            const flintTokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')
            if (
                stack.tokenFiles.length === 1 &&
                stack.tokenFiles[0] === flintTokensPath
            ) {
                // Read as Flint native JSON array
                try {
                    const raw = fs.readFileSync(flintTokensPath, 'utf8')
                    const arr = JSON.parse(raw) as DesignToken[]
                    if (Array.isArray(arr) && arr.length > 0) {
                        return {
                            tokens: arr,
                            source: `.flint/design-tokens.json (Flint native format)`,
                            warnings,
                        }
                    }
                } catch {
                    warnings.push('Could not parse .flint/design-tokens.json')
                }
                return { tokens: [], source: '.flint/design-tokens.json (empty or invalid)', warnings }
            }

            const tokens = extractDTCG(stack.tokenFiles, warnings)
            return {
                tokens,
                source: `W3C DTCG token files: ${stack.tokenFiles.join(', ')}`,
                warnings,
            }
        }

        case 'tokens-studio': {
            const tokens = extractTokensStudio(stack.tokenFiles, warnings)
            return {
                tokens,
                source: `Tokens Studio files: ${stack.tokenFiles.join(', ')}`,
                warnings,
            }
        }

        case 'chakra': {
            warnings.push(
                'Using default token set for Chakra UI. Customize in .flint/design-tokens.json.',
            )
            return {
                tokens: CHAKRA_DEFAULTS,
                source: 'Chakra UI default tokens',
                warnings,
            }
        }

        case 'mui': {
            warnings.push(
                'Using default token set for Material UI. Customize in .flint/design-tokens.json.',
            )
            return {
                tokens: MUI_DEFAULTS,
                source: 'Material UI default tokens',
                warnings,
            }
        }

        case 'radix': {
            warnings.push(
                'Using default token set for Radix UI. Customize in .flint/design-tokens.json.',
            )
            return {
                tokens: RADIX_DEFAULTS,
                source: 'Radix UI default tokens',
                warnings,
            }
        }

        case 'none':
        default: {
            warnings.push(
                'No design system detected. Create .flint/design-tokens.json manually or connect Figma.',
            )
            return {
                tokens: [],
                source: 'none',
                warnings,
            }
        }
    }
}
