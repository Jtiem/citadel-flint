/**
 * figmaJsxTransformer — flint-mcp/src/core/figmaJsxTransformer.ts
 *
 * D2C.6 (Option B): Babel AST transformer that takes Figma MCP JSX
 * (from get_design_context) and transforms it into library-specific components.
 *
 * Pipeline:
 *   1. Parse Figma JSX with @babel/parser
 *   2. Replace elements via data-name → library component mapping
 *   3. Map inline colors to design tokens (exact + CIEDE2000 fuzzy)
 *   4. Clean Figma artifacts (data-*, font encoding, min-h-px)
 *   5. Generate correct imports per library
 *   6. Wrap in exported function component
 *
 * Commandment 13: Babel AST traversal only. Never regex on source code.
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import {
    hexToLab,
    findNearestToken,
    TIER2_DELTA_E,
    type LabTokenEntry,
} from './colorDistance.js'

// CJS/ESM interop (same pattern as tailwindMigrator.ts)
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as { default: typeof _traverse }).default

// @ts-expect-error — @babel/generator ships CJS with a .default property
const generate = (_generate as { default: typeof _generate }).default ?? _generate

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SupportedLibrary = 'shadcn' | 'mui' | 'primeng' | 'tailwind'

export interface TransformOptions {
    library: SupportedLibrary
    tokens: Array<{ name: string; value: string; type: string }>
}

export interface TransformResult {
    code: string
    imports: string[]
    tokenMappings: Record<string, string>
    componentCount: number
    transformations: Array<{ nodeId: string; from: string; to: string }>
}

// ---------------------------------------------------------------------------
// Library component maps
// ---------------------------------------------------------------------------

interface ComponentMapping {
    /** JSX element name or compound structure factory. */
    elementName: string
    /** Import path for this component. */
    importPath: string
    /** All named imports needed. */
    importNames: string[]
    /** If true, the element is a compound structure built by a factory. */
    compound?: boolean
}

type LibraryComponentMap = Record<string, ComponentMapping>

const SHADCN_MAP: LibraryComponentMap = {
    input: {
        elementName: 'Input',
        importPath: '@/components/ui/input',
        importNames: ['Input'],
    },
    button: {
        elementName: 'Button',
        importPath: '@/components/ui/button',
        importNames: ['Button'],
    },
    card: {
        elementName: 'Card',
        importPath: '@/components/ui/card',
        importNames: ['Card', 'CardContent'],
        compound: true,
    },
    select: {
        elementName: 'Select',
        importPath: '@/components/ui/select',
        importNames: ['Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem'],
        compound: true,
    },
    avatar: {
        elementName: 'Avatar',
        importPath: '@/components/ui/avatar',
        importNames: ['Avatar', 'AvatarFallback'],
        compound: true,
    },
    badge: {
        elementName: 'Badge',
        importPath: '@/components/ui/badge',
        importNames: ['Badge'],
    },
    separator: {
        elementName: 'Separator',
        importPath: '@/components/ui/separator',
        importNames: ['Separator'],
    },
    tabs: {
        elementName: 'Tabs',
        importPath: '@/components/ui/tabs',
        importNames: ['Tabs', 'TabsList', 'TabsTrigger'],
        compound: true,
    },
    label: {
        elementName: 'Label',
        importPath: '@/components/ui/label',
        importNames: ['Label'],
    },
    textarea: {
        elementName: 'Textarea',
        importPath: '@/components/ui/textarea',
        importNames: ['Textarea'],
    },
}

const MUI_MAP: LibraryComponentMap = {
    input: {
        elementName: 'TextField',
        importPath: '@mui/material',
        importNames: ['TextField'],
    },
    button: {
        elementName: 'Button',
        importPath: '@mui/material',
        importNames: ['Button'],
    },
    card: {
        elementName: 'Card',
        importPath: '@mui/material',
        importNames: ['Card', 'CardContent'],
        compound: true,
    },
    select: {
        elementName: 'Select',
        importPath: '@mui/material',
        importNames: ['Select', 'MenuItem', 'FormControl', 'InputLabel'],
    },
    avatar: {
        elementName: 'Avatar',
        importPath: '@mui/material',
        importNames: ['Avatar'],
    },
    badge: {
        elementName: 'Badge',
        importPath: '@mui/material',
        importNames: ['Badge'],
    },
    separator: {
        elementName: 'Divider',
        importPath: '@mui/material',
        importNames: ['Divider'],
    },
    tabs: {
        elementName: 'Tabs',
        importPath: '@mui/material',
        importNames: ['Tabs', 'Tab'],
        compound: true,
    },
    label: {
        elementName: 'Typography',
        importPath: '@mui/material',
        importNames: ['Typography'],
    },
    textarea: {
        elementName: 'TextField',
        importPath: '@mui/material',
        importNames: ['TextField'],
    },
}

const PRIMENG_MAP: LibraryComponentMap = {
    input: {
        elementName: 'InputText',
        importPath: 'primereact/inputtext',
        importNames: ['InputText'],
    },
    button: {
        elementName: 'Button',
        importPath: 'primereact/button',
        importNames: ['Button'],
    },
    card: {
        elementName: 'Card',
        importPath: 'primereact/card',
        importNames: ['Card'],
    },
    select: {
        elementName: 'Dropdown',
        importPath: 'primereact/dropdown',
        importNames: ['Dropdown'],
    },
    avatar: {
        elementName: 'Avatar',
        importPath: 'primereact/avatar',
        importNames: ['Avatar'],
    },
    badge: {
        elementName: 'Badge',
        importPath: 'primereact/badge',
        importNames: ['Badge'],
    },
    separator: {
        elementName: 'Divider',
        importPath: 'primereact/divider',
        importNames: ['Divider'],
    },
    tabs: {
        elementName: 'TabView',
        importPath: 'primereact/tabview',
        importNames: ['TabView', 'TabPanel'],
        compound: true,
    },
    label: {
        elementName: 'label',
        importPath: '',
        importNames: [],
    },
    textarea: {
        elementName: 'InputTextarea',
        importPath: 'primereact/inputtextarea',
        importNames: ['InputTextarea'],
    },
}

const TAILWIND_MAP: LibraryComponentMap = {
    // Tailwind has no component library — keep semantic HTML
    input: { elementName: 'input', importPath: '', importNames: [] },
    button: { elementName: 'button', importPath: '', importNames: [] },
    card: { elementName: 'div', importPath: '', importNames: [] },
    select: { elementName: 'select', importPath: '', importNames: [] },
    avatar: { elementName: 'div', importPath: '', importNames: [] },
    badge: { elementName: 'span', importPath: '', importNames: [] },
    separator: { elementName: 'hr', importPath: '', importNames: [] },
    tabs: { elementName: 'div', importPath: '', importNames: [] },
    label: { elementName: 'label', importPath: '', importNames: [] },
    textarea: { elementName: 'textarea', importPath: '', importNames: [] },
}

function getLibraryMap(library: SupportedLibrary): LibraryComponentMap {
    switch (library) {
        case 'shadcn': return SHADCN_MAP
        case 'mui': return MUI_MAP
        case 'primeng': return PRIMENG_MAP
        case 'tailwind': return TAILWIND_MAP
    }
}

// ---------------------------------------------------------------------------
// Figma font cleanup mapping
// ---------------------------------------------------------------------------

const FIGMA_FONT_MAP: Record<string, string> = {
    'thin': 'font-thin',
    'hairline': 'font-thin',
    'extralight': 'font-extralight',
    'extra_light': 'font-extralight',
    'ultralight': 'font-extralight',
    'ultra_light': 'font-extralight',
    'light': 'font-light',
    'regular': 'font-normal',
    'normal': 'font-normal',
    'medium': 'font-medium',
    'semi_bold': 'font-semibold',
    'semibold': 'font-semibold',
    'demi_bold': 'font-semibold',
    'demibold': 'font-semibold',
    'bold': 'font-bold',
    'extra_bold': 'font-extrabold',
    'extrabold': 'font-extrabold',
    'ultra_bold': 'font-extrabold',
    'ultrabold': 'font-extrabold',
    'black': 'font-black',
    'heavy': 'font-black',
}

// ---------------------------------------------------------------------------
// Typography scale maps (Figma arbitrary values → Tailwind named classes)
// ---------------------------------------------------------------------------

/** text-[Xpx] → Tailwind text size class */
const FONT_SIZE_MAP: Record<number, string> = {
    12: 'text-xs',
    14: 'text-sm',
    16: 'text-base',
    18: 'text-lg',
    20: 'text-xl',
    24: 'text-2xl',
    30: 'text-3xl',
    36: 'text-4xl',
    48: 'text-5xl',
    60: 'text-6xl',
    72: 'text-7xl',
    96: 'text-8xl',
    128: 'text-9xl',
}

/** leading-[Xpx] → Tailwind leading class */
const LINE_HEIGHT_MAP: Record<number, string> = {
    12: 'leading-3',
    16: 'leading-4',
    20: 'leading-5',
    24: 'leading-6',
    28: 'leading-7',
    32: 'leading-8',
    36: 'leading-9',
    40: 'leading-10',
}

/**
 * Map a letter-spacing pixel value to a Tailwind tracking class using
 * threshold ranges (Figma values vary, so exact matching is impractical).
 */
function mapLetterSpacing(px: number): string | null {
    if (px < -0.5) return 'tracking-tighter'
    if (px >= -0.5 && px < -0.1) return 'tracking-tight'
    if (px >= -0.1 && px <= 0.1) return null // tracking-normal — remove class entirely
    if (px > 0.1 && px <= 0.5) return 'tracking-wide'
    if (px > 0.5 && px <= 1.0) return 'tracking-wider'
    if (px > 1.0) return 'tracking-widest'
    return null
}

// ---------------------------------------------------------------------------
// Token lookup builder
// ---------------------------------------------------------------------------

interface TokenLookupResult {
    exactMap: Map<string, string>
    labTokens: LabTokenEntry[]
}

function buildTokenLookup(
    tokens: Array<{ name: string; value: string; type: string }>,
): TokenLookupResult {
    const exactMap = new Map<string, string>()
    const labTokens: LabTokenEntry[] = []

    for (const token of tokens) {
        if (token.type !== 'color') continue
        const hex = token.value.toUpperCase().replace(/^#/, '')
        const normalizedHex = hex.length === 6 ? `#${hex}` : token.value

        // Derive className from token name
        // e.g. "colors.primary" → "primary", "background.default" → "background"
        const segments = token.name.split('.')
        const className = segments.length > 1
            ? segments.slice(1).join('-')
            : segments[0]

        exactMap.set(normalizedHex.toUpperCase(), className)

        const lab = hexToLab(normalizedHex)
        if (lab) {
            labTokens.push({ hex: normalizedHex.toUpperCase(), lab, className })
        }
    }

    return { exactMap, labTokens }
}

// ---------------------------------------------------------------------------
// className token mapper
// ---------------------------------------------------------------------------

/**
 * Extract hex/rgba values from a className string and replace with token names.
 * Handles patterns like:
 *   text-[color:var(--foreground/default,#09090b)]
 *   bg-[#2563eb]
 *   bg-[rgba(0,0,0,0.5)]
 *   text-[var(--foreground/muted,#71717a)]
 */
// ---------------------------------------------------------------------------
// CSS Variable → semantic Tailwind class mapping (D2C.11)
// ---------------------------------------------------------------------------
// Figma designs using Variables emit var(--name, #hex) in classNames.
// The variable name IS the designer's semantic intent — more accurate than
// CIEDE2000 matching on the hex fallback.
// ---------------------------------------------------------------------------

const FIGMA_VAR_TO_SHADCN: Record<string, string> = {
    // foreground family
    'foreground': 'foreground',
    'foreground/default': 'foreground',
    'foreground/muted': 'muted-foreground',
    'foreground/accent': 'accent-foreground',
    'foreground/primary': 'primary-foreground',
    'foreground/primary/default': 'primary-foreground',
    'foreground/secondary': 'secondary-foreground',
    'foreground/destructive': 'destructive-foreground',
    'foreground/card': 'card-foreground',
    'foreground/popover': 'popover-foreground',
    'foreground/success/default': 'emerald-700',
    // background family
    'background': 'background',
    'background/default': 'background',
    'background/card': 'card',
    'background/popover': 'popover',
    'background/destructive/default': 'destructive',
    'background/success/light-hover': 'emerald-500/12',
    // border family
    'border': 'border',
    'border/default': 'border',
    'border/input': 'input',
    // direct semantic tokens
    'primary': 'primary',
    'primary/foreground': 'primary-foreground',
    'secondary': 'secondary',
    'secondary/foreground': 'secondary-foreground',
    'muted': 'muted',
    'muted/foreground': 'muted-foreground',
    'accent': 'accent',
    'accent/foreground': 'accent-foreground',
    'destructive': 'destructive',
    'destructive/foreground': 'destructive-foreground',
    'card': 'card',
    'card/foreground': 'card-foreground',
    'popover': 'popover',
    'popover/foreground': 'popover-foreground',
    'ring': 'ring',
    'input': 'input',
    'white': 'white',
}

// Remap table for cases where Figma's category/qualifier order differs from shadcn
const SHADCN_REMAP: Record<string, string> = {
    'foreground-muted': 'muted-foreground',
    'foreground-accent': 'accent-foreground',
    'foreground-card': 'card-foreground',
    'foreground-popover': 'popover-foreground',
    'foreground-primary': 'primary-foreground',
    'foreground-secondary': 'secondary-foreground',
    'foreground-destructive': 'destructive-foreground',
    'background-card': 'card',
    'background-popover': 'popover',
    'border-input': 'input',
}

/**
 * Resolve a Figma CSS variable name to a shadcn semantic Tailwind class.
 * Returns null if no mapping exists (caller should fall back to CIEDE2000).
 */
export function resolveVarToSemantic(varName: string, library: SupportedLibrary): string | null {
    if (library !== 'shadcn') return null  // MUI/PrimeNG use different systems

    // 1. Exact match
    const exact = FIGMA_VAR_TO_SHADCN[varName]
    if (exact) return exact

    // 2. Strip /default suffix and retry
    const stripped = varName.replace(/\/default$/, '')
    const strippedMatch = FIGMA_VAR_TO_SHADCN[stripped]
    if (strippedMatch) return strippedMatch

    // 3. Slash-to-dash normalization + remap
    const dashed = stripped.replace(/\//g, '-')
    const remapped = SHADCN_REMAP[dashed]
    if (remapped) return remapped

    // 4. Check if dashed form is a known value
    const knownValues = new Set(Object.values(FIGMA_VAR_TO_SHADCN))
    if (knownValues.has(dashed)) return dashed

    return null
}

function mapClassTokens(
    className: string,
    tokenLookup: TokenLookupResult,
    tokenMappings: Record<string, string>,
    library: SupportedLibrary = 'shadcn',
): string {
    let result = className

    // Pattern 1: utility-[color:var(--name,#hex)] or utility-[var(--name,fallback)]
    // Try CSS variable name resolution FIRST, fall back to CIEDE2000 on hex
    result = result.replace(
        /((?:text|bg|border|ring|fill|stroke|shadow|accent|caret|outline|decoration)-)\[(?:color:)?var\(--([^,)]+),\s*([^)]+)\)\]/g,
        (match, prefix, varName, fallback) => {
            // D2C.11: Try semantic variable name resolution first
            const semantic = resolveVarToSemantic(varName, library)
            if (semantic) {
                tokenMappings[`var(--${varName})`] = semantic
                return `${prefix}${semantic}`
            }

            // Fallback: CIEDE2000 on the hex value
            const hexMatch = (fallback as string).match(/#([0-9a-fA-F]{3,8})/)
            if (hexMatch) {
                const fullHex = `#${hexMatch[1].toUpperCase()}`
                const tokenMatch = findNearestToken(fullHex, tokenLookup.exactMap, tokenLookup.labTokens, TIER2_DELTA_E)
                if (tokenMatch) {
                    tokenMappings[fullHex] = tokenMatch.className
                    return `${prefix}${tokenMatch.className}`
                }
            }
            return match
        },
    )

    // Pattern 2: utility-[#hex]
    result = result.replace(
        /((?:text|bg|border|ring|fill|stroke|shadow|accent|caret|outline|decoration)-)\[#([0-9a-fA-F]{3,8})\]/g,
        (match, prefix, hex) => {
            const fullHex = `#${hex.toUpperCase()}`
            const tokenMatch = findNearestToken(fullHex, tokenLookup.exactMap, tokenLookup.labTokens, TIER2_DELTA_E)
            if (tokenMatch) {
                tokenMappings[fullHex] = tokenMatch.className
                return `${prefix}${tokenMatch.className}`
            }
            return match
        },
    )

    // Pattern 3: utility-[rgba(r,g,b,a)]
    result = result.replace(
        /((?:text|bg|border|ring|fill|stroke|shadow|accent|caret|outline|decoration)-)\[rgba\((\d+),\s*(\d+),\s*(\d+),?\s*[\d.]*\)\]/g,
        (match, prefix, r, g, b) => {
            const hex = `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`.toUpperCase()
            const tokenMatch = findNearestToken(hex, tokenLookup.exactMap, tokenLookup.labTokens, TIER2_DELTA_E)
            if (tokenMatch) {
                tokenMappings[hex] = tokenMatch.className
                return `${prefix}${tokenMatch.className}`
            }
            return match
        },
    )

    return result
}

/**
 * Clean Figma font encoding artifacts from a className string.
 * Replaces patterns like font-['Inter:Semi_Bold',sans-serif] with font-semibold.
 */
function cleanFigmaFontClasses(className: string): string {
    return className.replace(
        /font-\['[^']*:([^']*)',\s*sans-serif\]/g,
        (_match, weightPart: string) => {
            const normalized = weightPart.toLowerCase().trim()
            return FIGMA_FONT_MAP[normalized] ?? 'font-normal'
        },
    )
}

/**
 * Remove Figma artifact classes from a className string.
 */
function cleanFigmaArtifacts(className: string): string {
    // Remove min-h-px min-w-px (Figma layout artifact)
    let result = className.replace(/\bmin-h-px\b/g, '').replace(/\bmin-w-px\b/g, '')

    // Remove var(--background/default,white) style patterns that are just "white"
    result = result.replace(
        /\[var\(--[^,)]+,\s*white\)\]/g,
        'white',
    )

    // Collapse multiple spaces
    result = result.replace(/\s{2,}/g, ' ').trim()

    return result
}

/**
 * Map Figma arbitrary typography classes to Tailwind named scale classes.
 *
 * Handles three categories:
 *   - text-[Xpx]      → text-sm, text-base, text-2xl, etc.
 *   - leading-[Xpx]   → leading-3 through leading-10
 *   - tracking-[Xpx]  → tracking-tight, tracking-wide, etc. (threshold ranges)
 *
 * Values without a Tailwind named equivalent are left as arbitrary values.
 */
function cleanFigmaTypography(className: string): string {
    let result = className

    // Font size: text-[Xpx] → named class (only when not a color pattern)
    result = result.replace(
        /\btext-\[(\d+(?:\.\d+)?)px\]/g,
        (_match, sizeStr: string) => {
            const size = parseFloat(sizeStr)
            return FONT_SIZE_MAP[size] ?? _match
        },
    )

    // Line height: leading-[Xpx] → named class
    result = result.replace(
        /\bleading-\[(\d+(?:\.\d+)?)px\]/g,
        (_match, sizeStr: string) => {
            const size = parseFloat(sizeStr)
            return LINE_HEIGHT_MAP[size] ?? _match
        },
    )

    // Letter spacing: tracking-[Xpx] → named class (supports negative values)
    result = result.replace(
        /\btracking-\[(-?\d+(?:\.\d+)?)px\]/g,
        (_match, sizeStr: string) => {
            const px = parseFloat(sizeStr)
            const mapped = mapLetterSpacing(px)
            if (mapped === null) return '' // near-zero → remove
            return mapped
        },
    )

    // Collapse multiple spaces left by removed classes
    result = result.replace(/\s{2,}/g, ' ').trim()

    return result
}

// ---------------------------------------------------------------------------
// AST-level transformers
// ---------------------------------------------------------------------------

/**
 * Extract text content from JSX children (for input placeholders, label text, etc.)
 */
function extractTextFromChildren(children: t.Node[]): string {
    const texts: string[] = []
    for (const child of children) {
        if (t.isJSXText(child)) {
            const trimmed = child.value.trim()
            if (trimmed) texts.push(trimmed)
        } else if (t.isJSXElement(child)) {
            // Recurse into child elements to find text
            texts.push(...extractTextFromChildElement(child))
        } else if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
            texts.push(child.expression.value)
        }
    }
    return texts.join(' ')
}

function extractTextFromChildElement(element: t.JSXElement): string[] {
    const texts: string[] = []
    for (const child of element.children) {
        if (t.isJSXText(child)) {
            const trimmed = child.value.trim()
            if (trimmed) texts.push(trimmed)
        } else if (t.isJSXElement(child)) {
            texts.push(...extractTextFromChildElement(child))
        }
    }
    return texts
}

/**
 * Get the data-name attribute from a JSX element.
 */
function getDataName(element: t.JSXElement): string | null {
    for (const attr of element.openingElement.attributes) {
        if (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === 'data-name' &&
            t.isStringLiteral(attr.value)
        ) {
            return attr.value.value
        }
    }
    return null
}

/**
 * Get the data-node-id attribute from a JSX element.
 */
function getDataNodeId(element: t.JSXElement): string | null {
    for (const attr of element.openingElement.attributes) {
        if (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === 'data-node-id' &&
            t.isStringLiteral(attr.value)
        ) {
            return attr.value.value
        }
    }
    return null
}

/**
 * Classify a data-name string to a component type.
 * Same logic as figmaMcpParser but inline to avoid circular deps.
 */
function classifyName(dataName: string): string | null {
    const lower = dataName.toLowerCase().trim()

    const directMap: Record<string, string> = {
        'input': 'input',
        'textfield': 'input',
        'text field': 'input',
        'select': 'select',
        'dropdown': 'select',
        'textarea': 'textarea',
        'text area': 'textarea',
        'button': 'button',
        'btn': 'button',
        'card': 'card',
        'avatar': 'avatar',
        'badge': 'badge',
        'chip': 'badge',
        'tabs': 'tabs',
        'tab': 'tabs',
        '.tab item': 'tabs',
        'separator': 'separator',
        'divider': 'separator',
        'label': 'label',
    }

    if (directMap[lower]) return directMap[lower]

    // Substring match
    const orderedKeys = [
        'textarea', 'text area',
        'textfield', 'text field',
        'dropdown',
        'input',
        'select',
        'button', 'btn',
        'card',
        'avatar',
        'badge', 'chip',
        'tabs', 'tab',
        'separator', 'divider',
    ]

    for (const key of orderedKeys) {
        if (lower.includes(key)) return directMap[key]
    }

    return null
}

// ---------------------------------------------------------------------------
// D2C.12: Label-Input A11y Association helpers
// ---------------------------------------------------------------------------

/**
 * Convert label text to a camelCase ID for htmlFor/id association.
 * "Display Name" → "displayName", "Email Address" → "emailAddress", "Bio" → "bio"
 */
function toCamelCaseId(text: string): string {
    return text.trim()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('')
}

// ---------------------------------------------------------------------------
// D2C.13: Placeholder vs DefaultValue discrimination helper
// ---------------------------------------------------------------------------

/**
 * Check if a className string indicates a muted/placeholder color.
 * Returns 'placeholder' if muted, 'defaultValue' if foreground/dark, or null if indeterminate.
 */
function inferInputTextRole(className: string): 'placeholder' | 'defaultValue' | null {
    if (!className) return null
    // Muted patterns → placeholder
    if (/foreground\/muted|muted-foreground|text-muted|\/muted/i.test(className)) return 'placeholder'
    if (/#(71717a|9ca3af|a1a1aa|6b7280)/i.test(className)) return 'placeholder'
    // Foreground/default patterns → defaultValue
    if (/foreground\/default|foreground[^/]|text-foreground/i.test(className)) return 'defaultValue'
    if (/#(09090b|0a0a0a|000000|1a1a1a|18181b|171717|020617)/i.test(className)) return 'defaultValue'
    return null
}

// ---------------------------------------------------------------------------
// D2C.14: Button variant inference helper
// ---------------------------------------------------------------------------

/** Check the original element's className and data-name for button variant cues. */
function inferButtonVariant(element: t.JSXElement): string | null {
    const dataName = getDataName(element)
    const className = getClassNameValue(element)

    // Name-based detection (highest priority — designer intent)
    if (dataName) {
        const lower = dataName.toLowerCase()
        if (/destructive|danger|delete|remove/.test(lower)) return 'destructive'
        if (/outline/.test(lower)) return 'outline'
        if (/ghost/.test(lower)) return 'ghost'
        if (/secondary/.test(lower)) return 'secondary'
    }

    // className-based detection
    if (className) {
        // Destructive: red backgrounds
        if (/bg-\[?(?:var\(--(?:background\/)?destructive|#(?:dc2626|ef4444|b91c1c|f87171))/i.test(className)) return 'destructive'
        if (/bg-destructive/i.test(className)) return 'destructive'
        // Outline: has border but transparent/white bg
        if (/\bborder\b/.test(className) && (/bg-(?:white|transparent|\[(?:var\(--background\/default|white|transparent))/.test(className) || !/\bbg-/.test(className))) return 'outline'
        // Ghost: no background, no border
        if (!/\bbg-/.test(className) && !/\bborder\b/.test(className)) return 'ghost'
        // Primary bg → default (no prop)
        if (/bg-\[?(?:var\(--primary|#(?:2563eb|3b82f6))/i.test(className)) return null
        if (/bg-primary/i.test(className)) return null
    }

    return null
}

/** Extract the className string value from a JSX element. */
function getClassNameValue(element: t.JSXElement): string | null {
    for (const attr of element.openingElement.attributes) {
        if (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === 'className' &&
            t.isStringLiteral(attr.value)
        ) {
            return attr.value.value
        }
    }
    return null
}

// ---------------------------------------------------------------------------
// D2C.15: Card structural analysis helpers
// ---------------------------------------------------------------------------

interface CardStructure {
    headerChildren: t.JSXElement[]
    contentChildren: (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment | t.JSXSpreadChild)[]
    footerChildren: t.JSXElement[]
    hasTitle: boolean
    hasDescription: boolean
}

type ValidJSXChild = t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment | t.JSXSpreadChild

function isValidJSXChild(node: t.Node): node is ValidJSXChild {
    return t.isJSXElement(node) || t.isJSXText(node) || t.isJSXExpressionContainer(node) || t.isJSXFragment(node) || t.isJSXSpreadChild(node)
}

/** Check if an element is a heading (h1-h6) or has font-semibold/font-bold class. */
function isHeadingLike(element: t.JSXElement): boolean {
    const tag = t.isJSXIdentifier(element.openingElement.name) ? element.openingElement.name.name : ''
    if (/^h[1-6]$/.test(tag)) return true
    const cn = getClassNameValue(element)
    if (cn && /\bfont-(semibold|bold)\b/.test(cn)) return true
    return false
}

/** Check if an element has muted text styling (description-like). */
function isMutedText(element: t.JSXElement): boolean {
    const cn = getClassNameValue(element)
    if (!cn) return false
    return /\btext-muted\b|\bmuted-foreground\b|foreground\/muted|text-sm\b.*\btext-muted/.test(cn)
        || /text-\[color:var\(--foreground\/muted/.test(cn)
        || /\btext-gray-\d+\b/.test(cn)
}

/** Check if an element is or contains a Button. */
function isButtonLike(element: t.JSXElement): boolean {
    const tag = t.isJSXIdentifier(element.openingElement.name) ? element.openingElement.name.name : ''
    if (tag === 'Button' || tag === 'button') return true
    const dataName = getDataName(element)
    if (dataName) {
        const lower = dataName.toLowerCase()
        if (lower.includes('button') || lower.includes('btn')) return true
    }
    return false
}

/** Analyze card children into header/content/footer sections. */
function analyzeCardStructure(children: t.Node[]): CardStructure {
    const elements = children.filter((c): c is t.JSXElement => t.isJSXElement(c))
    const structure: CardStructure = {
        headerChildren: [],
        contentChildren: [],
        footerChildren: [],
        hasTitle: false,
        hasDescription: false,
    }

    if (elements.length === 0) {
        structure.contentChildren = children.filter(isValidJSXChild)
        return structure
    }

    let idx = 0

    // Check first element for title
    if (idx < elements.length && isHeadingLike(elements[idx])) {
        structure.headerChildren.push(elements[idx])
        structure.hasTitle = true
        idx++

        // Check next element for description
        if (idx < elements.length && isMutedText(elements[idx])) {
            structure.headerChildren.push(elements[idx])
            structure.hasDescription = true
            idx++
        }
    }

    // Check trailing buttons for footer
    let footerStart = elements.length
    for (let i = elements.length - 1; i >= idx; i--) {
        if (isButtonLike(elements[i])) {
            footerStart = i
        } else {
            break
        }
    }

    // Remaining → content
    for (let i = idx; i < footerStart; i++) {
        structure.contentChildren.push(elements[i])
    }

    // Footer
    for (let i = footerStart; i < elements.length; i++) {
        structure.footerChildren.push(elements[i])
    }

    // If no header and no footer, fall back: all children go into content
    if (!structure.hasTitle && structure.footerChildren.length === 0) {
        structure.contentChildren = children.filter(isValidJSXChild)
    }

    return structure
}

// ---------------------------------------------------------------------------
// D2C.16: Active tab detection helper
// ---------------------------------------------------------------------------

/** Examine a .Tab Item child's className to determine if it's the active tab. */
function isActiveTab(element: t.JSXElement): boolean {
    // Look for text children with foreground/primary (active) vs muted (inactive) color
    for (const child of element.children) {
        if (t.isJSXElement(child)) {
            const cn = getClassNameValue(child)
            if (cn && isActiveColor(cn)) return true
        }
    }
    // Also check the element's own className
    const ownCn = getClassNameValue(element)
    if (ownCn && isActiveColor(ownCn)) return true
    return false
}

/** Check if a className indicates an active/primary color (not muted). */
function isActiveColor(cn: string): boolean {
    // Exclude muted patterns first
    if (/muted/i.test(cn)) return false
    // Active: --primary variable
    if (/text-\[color:var\(--primary/.test(cn)) return true
    // Active: --foreground/default or --foreground (not followed by /muted)
    if (/text-\[color:var\(--foreground\/default/.test(cn)) return true
    if (/text-\[color:var\(--foreground[,)]/.test(cn)) return true
    // Active: dark hex colors
    if (/#(?:09090b|0a0a0a|000000|18181b|020617)/i.test(cn)) return true
    // Active: Tailwind utility classes
    if (/\btext-primary\b/.test(cn)) return true
    if (/\btext-foreground\b/.test(cn)) return true
    return false
}

// ---------------------------------------------------------------------------
// D2C.13: Extract input text with role inference
// ---------------------------------------------------------------------------

/**
 * Extract text from an input element's children, inferring whether it's a
 * placeholder or defaultValue based on color styling of the <p> elements.
 */
function extractInputTextWithRole(element: t.JSXElement): { text: string; role: 'placeholder' | 'defaultValue' } {
    // Look for the inner Input frame's text children (the actual input field, not the label)
    // In Figma MCP output, the structure is:
    //   div[data-name="Input"] > div[data-name="Label"] + div[data-name="Input"] > p
    // We want the text inside the inner Input div's <p> elements
    for (const child of element.children) {
        if (!t.isJSXElement(child)) continue
        const childName = getDataName(child)
        // Look at the inner Input frame (not the Label)
        if (childName && classifyName(childName) === 'input') {
            // Found the inner input frame — check its <p> children for color cues
            for (const grandchild of child.children) {
                if (t.isJSXElement(grandchild)) {
                    const cn = getClassNameValue(grandchild)
                    const text = extractTextFromChildren([grandchild])
                    if (text && cn) {
                        const role = inferInputTextRole(cn)
                        if (role) return { text, role }
                    }
                }
            }
            // Fallback: extract text without role determination
            const text = extractTextFromChildren(child.children)
            if (text) return { text, role: 'placeholder' }
        }
    }

    // Fallback: just extract any text
    const text = extractTextFromChildren(element.children)
    return { text, role: 'placeholder' }
}

// ---------------------------------------------------------------------------
// Component replacement builders (per-library compound structures)
// ---------------------------------------------------------------------------

function buildShadcnSelect(text: string): t.JSXElement {
    // <Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="item">{text}</SelectItem></SelectContent></Select>
    const selectValue = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('SelectValue'), [], true),
        null, [], true,
    )
    const selectTrigger = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('SelectTrigger'), []),
        t.jsxClosingElement(t.jsxIdentifier('SelectTrigger')),
        [selectValue],
    )
    const selectItem = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('SelectItem'), [
            t.jsxAttribute(t.jsxIdentifier('value'), t.stringLiteral('item')),
        ]),
        t.jsxClosingElement(t.jsxIdentifier('SelectItem')),
        [t.jsxText(text || 'Option')],
    )
    const selectContent = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('SelectContent'), []),
        t.jsxClosingElement(t.jsxIdentifier('SelectContent')),
        [selectItem],
    )
    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Select'), []),
        t.jsxClosingElement(t.jsxIdentifier('Select')),
        [selectTrigger, selectContent],
    )
}

function buildShadcnCard(children: t.Node[], usedImports: Map<string, Set<string>>): t.JSXElement {
    const structure = analyzeCardStructure(children)
    const cardChildren: ValidJSXChild[] = []

    // D2C.15: Build CardHeader with CardTitle and optional CardDescription
    if (structure.hasTitle) {
        const headerInner: ValidJSXChild[] = []

        // CardTitle from first heading-like element
        const titleEl = structure.headerChildren[0]
        const titleText = extractTextFromChildren(titleEl.children)
        const cardTitle = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('CardTitle'), []),
            t.jsxClosingElement(t.jsxIdentifier('CardTitle')),
            [t.jsxText(titleText || 'Title')],
        )
        headerInner.push(cardTitle)

        // Track additional imports
        const cardImports = usedImports.get('@/components/ui/card') ?? new Set()
        cardImports.add('CardHeader')
        cardImports.add('CardTitle')

        // CardDescription if present
        if (structure.hasDescription && structure.headerChildren.length > 1) {
            const descEl = structure.headerChildren[1]
            const descText = extractTextFromChildren(descEl.children)
            const cardDescription = t.jsxElement(
                t.jsxOpeningElement(t.jsxIdentifier('CardDescription'), []),
                t.jsxClosingElement(t.jsxIdentifier('CardDescription')),
                [t.jsxText(descText || '')],
            )
            headerInner.push(cardDescription)
            cardImports.add('CardDescription')
        }

        usedImports.set('@/components/ui/card', cardImports)

        const cardHeader = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('CardHeader'), []),
            t.jsxClosingElement(t.jsxIdentifier('CardHeader')),
            headerInner,
        )
        cardChildren.push(cardHeader)
    }

    // CardContent for remaining children
    if (structure.contentChildren.length > 0) {
        const cardContent = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('CardContent'), []),
            t.jsxClosingElement(t.jsxIdentifier('CardContent')),
            structure.contentChildren,
        )
        cardChildren.push(cardContent)
    }

    // D2C.15: CardFooter for trailing buttons
    if (structure.footerChildren.length > 0) {
        const cardImports = usedImports.get('@/components/ui/card') ?? new Set()
        cardImports.add('CardFooter')
        usedImports.set('@/components/ui/card', cardImports)

        const cardFooter = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('CardFooter'), []),
            t.jsxClosingElement(t.jsxIdentifier('CardFooter')),
            structure.footerChildren,
        )
        cardChildren.push(cardFooter)
    }

    // Fallback: if nothing was structured, wrap all in CardContent
    if (cardChildren.length === 0) {
        const cardContent = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('CardContent'), []),
            t.jsxClosingElement(t.jsxIdentifier('CardContent')),
            children.filter(isValidJSXChild),
        )
        cardChildren.push(cardContent)
    }

    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Card'), []),
        t.jsxClosingElement(t.jsxIdentifier('Card')),
        cardChildren,
    )
}

function buildShadcnAvatar(text: string): t.JSXElement {
    // Generate initials from text
    const initials = text
        .split(' ')
        .map(w => w[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'AV'

    const fallback = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('AvatarFallback'), []),
        t.jsxClosingElement(t.jsxIdentifier('AvatarFallback')),
        [t.jsxText(initials)],
    )
    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Avatar'), []),
        t.jsxClosingElement(t.jsxIdentifier('Avatar')),
        [fallback],
    )
}

function buildShadcnTabs(children: t.Node[], activeTabText?: string): t.JSXElement {
    // Extract tab items from children
    const tabEntries: Array<{ text: string; active: boolean }> = []
    for (const child of children) {
        if (t.isJSXElement(child)) {
            const childName = getDataName(child)
            if (childName) {
                const text = extractTextFromChildren(child.children)
                if (text) {
                    // D2C.16: Detect active tab by color (from pre-scan or inline)
                    const active = activeTabText ? (text === activeTabText) : isActiveTab(child)
                    tabEntries.push({ text, active })
                }
            }
        }
    }
    if (tabEntries.length === 0) tabEntries.push({ text: 'Tab 1', active: true }, { text: 'Tab 2', active: false })

    // D2C.16: Determine defaultValue from active tab detection
    const activeEntry = tabEntries.find(e => e.active)
    const defaultSlug = activeEntry
        ? activeEntry.text.toLowerCase().replace(/\s+/g, '-')
        : tabEntries[0].text.toLowerCase().replace(/\s+/g, '-')

    const triggers = tabEntries.map(entry =>
        t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('TabsTrigger'), [
                t.jsxAttribute(t.jsxIdentifier('value'), t.stringLiteral(entry.text.toLowerCase().replace(/\s+/g, '-'))),
            ]),
            t.jsxClosingElement(t.jsxIdentifier('TabsTrigger')),
            [t.jsxText(entry.text)],
        ),
    )

    const tabsList = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('TabsList'), []),
        t.jsxClosingElement(t.jsxIdentifier('TabsList')),
        triggers,
    )

    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Tabs'), [
            t.jsxAttribute(t.jsxIdentifier('defaultValue'), t.stringLiteral(defaultSlug)),
        ]),
        t.jsxClosingElement(t.jsxIdentifier('Tabs')),
        [tabsList],
    )
}

function buildMuiCard(children: t.Node[]): t.JSXElement {
    const cardContent = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('CardContent'), []),
        t.jsxClosingElement(t.jsxIdentifier('CardContent')),
        children.filter((c): c is t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment | t.JSXSpreadChild => t.isJSXElement(c) || t.isJSXText(c) || t.isJSXExpressionContainer(c) || t.isJSXFragment(c) || t.isJSXSpreadChild(c)),
    )
    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Card'), []),
        t.jsxClosingElement(t.jsxIdentifier('Card')),
        [cardContent],
    )
}

function buildMuiTabs(children: t.Node[]): t.JSXElement {
    const tabTexts: string[] = []
    for (const child of children) {
        if (t.isJSXElement(child)) {
            const text = extractTextFromChildren(child.children)
            if (text) tabTexts.push(text)
        }
    }
    if (tabTexts.length === 0) tabTexts.push('Tab 1', 'Tab 2')

    const tabs = tabTexts.map(text =>
        t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('Tab'), [
                t.jsxAttribute(t.jsxIdentifier('label'), t.stringLiteral(text)),
            ], true),
            null, [], true,
        ),
    )

    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Tabs'), []),
        t.jsxClosingElement(t.jsxIdentifier('Tabs')),
        tabs,
    )
}

function buildPrimengTabs(children: t.Node[]): t.JSXElement {
    const tabTexts: string[] = []
    for (const child of children) {
        if (t.isJSXElement(child)) {
            const text = extractTextFromChildren(child.children)
            if (text) tabTexts.push(text)
        }
    }
    if (tabTexts.length === 0) tabTexts.push('Tab 1', 'Tab 2')

    const panels = tabTexts.map(text =>
        t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('TabPanel'), [
                t.jsxAttribute(t.jsxIdentifier('header'), t.stringLiteral(text)),
            ]),
            t.jsxClosingElement(t.jsxIdentifier('TabPanel')),
            [],
        ),
    )

    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('TabView'), []),
        t.jsxClosingElement(t.jsxIdentifier('TabView')),
        panels,
    )
}

// ---------------------------------------------------------------------------
// Core transform
// ---------------------------------------------------------------------------

/**
 * Transform Figma MCP JSX into library-specific components.
 *
 * @param jsxCode - Raw JSX string from Figma MCP get_design_context
 * @param options - Library target and design tokens for color mapping
 * @returns Transformed code, imports, token mappings, and transformation log
 */
export function transformFigmaJsx(
    jsxCode: string,
    options: TransformOptions,
): TransformResult {
    if (!jsxCode || typeof jsxCode !== 'string' || !jsxCode.trim()) {
        return {
            code: '',
            imports: [],
            tokenMappings: {},
            componentCount: 0,
            transformations: [],
        }
    }

    const libraryMap = getLibraryMap(options.library)
    const tokenLookup = buildTokenLookup(options.tokens)
    const tokenMappings: Record<string, string> = {}
    const transformations: Array<{ nodeId: string; from: string; to: string }> = []
    const usedImports = new Map<string, Set<string>>() // importPath → Set<importName>
    let componentCount = 0

    // Wrap in a component function for parsing
    const wrappedCode = `function __FigmaTransformWrapper() { return (\n${jsxCode}\n); }`

    let ast: ReturnType<typeof parse>
    try {
        ast = parse(wrappedCode, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch {
        // Malformed JSX — return as-is
        return {
            code: jsxCode,
            imports: [],
            tokenMappings: {},
            componentCount: 0,
            transformations: [],
        }
    }

    // Derive component name from root data-name
    let rootDataName: string | null = null

    // -----------------------------------------------------------------------
    // Pass 0: Pre-scan to collect metadata before bottom-up transforms
    //   - D2C.13: Input text roles (placeholder vs defaultValue)
    //   - D2C.16: Active tab detection per Tabs container
    // -----------------------------------------------------------------------
    const inputTextRoles = new Map<string, { text: string; role: 'placeholder' | 'defaultValue' }>()
    const tabActiveMap = new Map<string, string>() // Tabs nodeId → active tab text

    traverse(ast, {
        JSXElement(path) {
            const element = path.node
            const dataName = getDataName(element)
            if (!dataName) return
            const nodeId = getDataNodeId(element) ?? ''
            const componentType = classifyName(dataName)

            // D2C.13: Pre-scan input elements for text role
            if (componentType === 'input') {
                const result = extractInputTextWithRole(element)
                if (result.text && nodeId) {
                    inputTextRoles.set(nodeId, result)
                }
            }

            // D2C.16: Pre-scan Tabs for active tab detection
            if (componentType === 'tabs' && dataName.toLowerCase() !== '.tab item') {
                const tabEntries: Array<{ text: string; active: boolean }> = []
                for (const child of element.children) {
                    if (t.isJSXElement(child)) {
                        const childName = getDataName(child)
                        if (childName) {
                            const text = extractTextFromChildren(child.children)
                            if (text) {
                                tabEntries.push({ text, active: isActiveTab(child) })
                            }
                        }
                    }
                }
                if (tabEntries.length > 0 && nodeId) {
                    const activeEntry = tabEntries.find(e => e.active)
                    if (activeEntry) {
                        tabActiveMap.set(nodeId, activeEntry.text)
                    }
                }
            }
        },
    })

    // -----------------------------------------------------------------------
    // Pass 1: Component replacement (bottom-up via exit visitor)
    // -----------------------------------------------------------------------
    traverse(ast, {
        JSXElement: {
            exit(path) {
                const element = path.node
                const dataName = getDataName(element)
                if (!dataName) return

                // Capture root data-name for component naming
                if (rootDataName === null) {
                    rootDataName = dataName
                }

                const componentType = classifyName(dataName)
                if (!componentType) return

                // Skip .Tab Item sub-components — they're consumed by the parent Tabs builder
                const lowerName = dataName.toLowerCase().trim()
                if (lowerName === '.tab item' || lowerName === 'tab item') return

                const mapping = libraryMap[componentType]
                if (!mapping) return

                const nodeId = getDataNodeId(element) ?? `unnamed-${componentCount}`
                const originalTag = t.isJSXIdentifier(element.openingElement.name)
                    ? element.openingElement.name.name
                    : 'div'

                // Track the library import
                if (mapping.importPath) {
                    const existing = usedImports.get(mapping.importPath) ?? new Set()
                    for (const name of mapping.importNames) {
                        existing.add(name)
                    }
                    usedImports.set(mapping.importPath, existing)
                }

                const text = extractTextFromChildren(element.children)

                // Build replacement element
                let replacement: t.JSXElement | null = null

                if (options.library === 'shadcn') {
                    switch (componentType) {
                        case 'input': {
                            // D2C.13: Use pre-scanned text role data
                            const attrs: t.JSXAttribute[] = []
                            const preScanned = inputTextRoles.get(nodeId)
                            if (preScanned && preScanned.text) {
                                const propName = preScanned.role === 'defaultValue' ? 'defaultValue' : 'placeholder'
                                attrs.push(t.jsxAttribute(t.jsxIdentifier(propName), t.stringLiteral(preScanned.text)))
                            } else if (text) {
                                attrs.push(t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Input'), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                        case 'button': {
                            // D2C.14: Infer button variant from className/data-name
                            const buttonAttrs: t.JSXAttribute[] = []
                            const variant = inferButtonVariant(element)
                            if (variant) {
                                buttonAttrs.push(t.jsxAttribute(t.jsxIdentifier('variant'), t.stringLiteral(variant)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Button'), buttonAttrs),
                                t.jsxClosingElement(t.jsxIdentifier('Button')),
                                [t.jsxText(text || 'Button')],
                            )
                            break
                        }
                        case 'card':
                            replacement = buildShadcnCard(element.children, usedImports)
                            break
                        case 'select':
                            replacement = buildShadcnSelect(text)
                            break
                        case 'avatar':
                            replacement = buildShadcnAvatar(text)
                            break
                        case 'badge':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Badge'), []),
                                t.jsxClosingElement(t.jsxIdentifier('Badge')),
                                [t.jsxText(text || 'Badge')],
                            )
                            break
                        case 'separator':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Separator'), [], true),
                                null, [], true,
                            )
                            break
                        case 'tabs':
                            replacement = buildShadcnTabs(element.children, tabActiveMap.get(nodeId))
                            break
                        case 'label':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Label'), []),
                                t.jsxClosingElement(t.jsxIdentifier('Label')),
                                [t.jsxText(text || 'Label')],
                            )
                            break
                        case 'textarea':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Textarea'), [], true),
                                null, [], true,
                            )
                            break
                    }
                } else if (options.library === 'mui') {
                    switch (componentType) {
                        case 'input': {
                            const attrs: t.JSXAttribute[] = [
                                t.jsxAttribute(t.jsxIdentifier('variant'), t.stringLiteral('outlined')),
                            ]
                            if (text) {
                                attrs.push(t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('TextField'), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                        case 'button':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Button'), [
                                    t.jsxAttribute(t.jsxIdentifier('variant'), t.stringLiteral('contained')),
                                ]),
                                t.jsxClosingElement(t.jsxIdentifier('Button')),
                                [t.jsxText(text || 'Button')],
                            )
                            break
                        case 'card':
                            replacement = buildMuiCard(element.children)
                            break
                        case 'select':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Select'), []),
                                t.jsxClosingElement(t.jsxIdentifier('Select')),
                                [t.jsxText(text || 'Select')],
                            )
                            break
                        case 'avatar':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Avatar'), [], true),
                                null, [], true,
                            )
                            break
                        case 'badge': {
                            const inner = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Badge'), [
                                    t.jsxAttribute(t.jsxIdentifier('badgeContent'), t.stringLiteral(text || '0')),
                                ]),
                                t.jsxClosingElement(t.jsxIdentifier('Badge')),
                                [],
                            )
                            replacement = inner
                            break
                        }
                        case 'separator':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Divider'), [], true),
                                null, [], true,
                            )
                            break
                        case 'tabs':
                            replacement = buildMuiTabs(element.children)
                            break
                        case 'label':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Typography'), [
                                    t.jsxAttribute(t.jsxIdentifier('variant'), t.stringLiteral('body2')),
                                ]),
                                t.jsxClosingElement(t.jsxIdentifier('Typography')),
                                [t.jsxText(text || '')],
                            )
                            break
                        case 'textarea': {
                            const attrs: t.JSXAttribute[] = [
                                t.jsxAttribute(t.jsxIdentifier('multiline'), t.jsxExpressionContainer(t.booleanLiteral(true))),
                                t.jsxAttribute(t.jsxIdentifier('rows'), t.jsxExpressionContainer(t.numericLiteral(4))),
                            ]
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('TextField'), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                    }
                } else if (options.library === 'primeng') {
                    switch (componentType) {
                        case 'input': {
                            const attrs: t.JSXAttribute[] = []
                            if (text) {
                                attrs.push(t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('InputText'), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                        case 'button':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Button'), [
                                    t.jsxAttribute(t.jsxIdentifier('label'), t.stringLiteral(text || 'Button')),
                                ], true),
                                null, [], true,
                            )
                            break
                        case 'card':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Card'), []),
                                t.jsxClosingElement(t.jsxIdentifier('Card')),
                                element.children.filter((c): c is t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment | t.JSXSpreadChild =>
                                    t.isJSXElement(c) || t.isJSXText(c) || t.isJSXExpressionContainer(c) || t.isJSXFragment(c) || t.isJSXSpreadChild(c)),
                            )
                            break
                        case 'select':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Dropdown'), [
                                    t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text || 'Select')),
                                ], true),
                                null, [], true,
                            )
                            break
                        case 'avatar':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Avatar'), [
                                    t.jsxAttribute(t.jsxIdentifier('label'), t.stringLiteral(text ? text[0].toUpperCase() : 'A')),
                                ], true),
                                null, [], true,
                            )
                            break
                        case 'badge':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Badge'), [
                                    t.jsxAttribute(t.jsxIdentifier('value'), t.stringLiteral(text || '0')),
                                ], true),
                                null, [], true,
                            )
                            break
                        case 'separator':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Divider'), [], true),
                                null, [], true,
                            )
                            break
                        case 'tabs':
                            replacement = buildPrimengTabs(element.children)
                            break
                        case 'label':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('label'), []),
                                t.jsxClosingElement(t.jsxIdentifier('label')),
                                [t.jsxText(text || '')],
                            )
                            break
                        case 'textarea': {
                            const attrs: t.JSXAttribute[] = []
                            if (text) {
                                attrs.push(t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('InputTextarea'), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                    }
                } else if (options.library === 'tailwind') {
                    // For Tailwind, just rename to semantic HTML elements
                    const htmlTag = mapping.elementName
                    switch (componentType) {
                        case 'input': {
                            const attrs: t.JSXAttribute[] = [
                                t.jsxAttribute(t.jsxIdentifier('type'), t.stringLiteral('text')),
                                t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral('border rounded px-3 py-2')),
                            ]
                            if (text) {
                                attrs.push(t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier(htmlTag), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                        case 'button':
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier(htmlTag), [
                                    t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral('px-4 py-2 rounded bg-primary text-white')),
                                ]),
                                t.jsxClosingElement(t.jsxIdentifier(htmlTag)),
                                [t.jsxText(text || 'Button')],
                            )
                            break
                        default: {
                            // Default: just rename the element tag
                            const existingAttrs = element.openingElement.attributes.filter(attr => {
                                if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                                    return !attr.name.name.startsWith('data-')
                                }
                                return true
                            })
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier(htmlTag), existingAttrs),
                                t.jsxClosingElement(t.jsxIdentifier(htmlTag)),
                                element.children,
                            )
                            break
                        }
                    }
                }

                if (replacement) {
                    path.replaceWith(replacement)
                    componentCount++
                    transformations.push({
                        nodeId,
                        from: `${originalTag}[data-name="${dataName}"]`,
                        to: mapping.elementName,
                    })
                }
            },
        },
    })

    // -----------------------------------------------------------------------
    // Pass 1b (D2C.12): Label-Input A11y Association
    // Scan sibling elements for Label followed by Input/Select/Textarea,
    // then add htmlFor/id props for accessibility.
    // -----------------------------------------------------------------------
    if (options.library === 'shadcn') {
        traverse(ast, {
            JSXElement(path) {
                // Collect only JSXElement children (skip whitespace text nodes)
                const jsxChildren = path.node.children.filter(
                    (c): c is t.JSXElement => t.isJSXElement(c),
                )

                for (let i = 0; i < jsxChildren.length - 1; i++) {
                    const current = jsxChildren[i]
                    const next = jsxChildren[i + 1]

                    // Check if current is a Label
                    const currentTag = t.isJSXIdentifier(current.openingElement.name) ? current.openingElement.name.name : ''
                    if (currentTag !== 'Label') continue

                    // Check if next is an Input, Select, or Textarea
                    const nextTag = t.isJSXIdentifier(next.openingElement.name) ? next.openingElement.name.name : ''
                    const inputTypes = ['Input', 'Select', 'Textarea']
                    if (!inputTypes.includes(nextTag)) continue

                    // Extract the label text
                    const labelText = extractTextFromChildren(current.children)
                    if (!labelText) continue

                    const id = toCamelCaseId(labelText)
                    if (!id) continue

                    // Add htmlFor to the Label
                    current.openingElement.attributes.push(
                        t.jsxAttribute(t.jsxIdentifier('htmlFor'), t.stringLiteral(id)),
                    )

                    // Add id to the input element
                    next.openingElement.attributes.push(
                        t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(id)),
                    )
                }
            },
        })
    }

    // -----------------------------------------------------------------------
    // Pass 2: Token mapping + Figma artifact cleanup on classNames
    // -----------------------------------------------------------------------
    traverse(ast, {
        JSXAttribute(path) {
            if (
                !t.isJSXIdentifier(path.node.name) ||
                path.node.name.name !== 'className'
            ) return

            if (t.isStringLiteral(path.node.value)) {
                let className = path.node.value.value

                // Clean Figma font encoding
                className = cleanFigmaFontClasses(className)

                // Map Figma arbitrary typography to Tailwind named scale
                className = cleanFigmaTypography(className)

                // Clean Figma artifacts
                className = cleanFigmaArtifacts(className)

                // Map tokens
                className = mapClassTokens(className, tokenLookup, tokenMappings, options.library)

                path.node.value = t.stringLiteral(className)
            }
        },
    })

    // -----------------------------------------------------------------------
    // Pass 3: Remove data-name and data-node-id attributes
    // -----------------------------------------------------------------------
    traverse(ast, {
        JSXAttribute(path) {
            if (
                t.isJSXIdentifier(path.node.name) &&
                (path.node.name.name === 'data-name' || path.node.name.name === 'data-node-id')
            ) {
                path.remove()
            }
        },
    })

    // -----------------------------------------------------------------------
    // Generate code from transformed AST
    // -----------------------------------------------------------------------
    const generated = generate(ast, { retainLines: false, concise: false })
    let code = generated.code

    // Extract the JSX from the wrapper function
    const returnMatch = code.match(/return\s*\(\s*([\s\S]*?)\s*\);\s*}/)
    if (returnMatch) {
        code = returnMatch[1].trim()
    } else {
        // Fallback: strip wrapper function
        code = code.replace(/^function __FigmaTransformWrapper\(\) \{\s*return\s*\(\s*/, '')
            .replace(/\s*\);\s*\}$/, '')
            .trim()
    }

    // -----------------------------------------------------------------------
    // Build imports
    // -----------------------------------------------------------------------
    const importStatements: string[] = []
    for (const [importPath, names] of usedImports) {
        if (!importPath) continue
        const sortedNames = [...names].sort()
        importStatements.push(
            `import { ${sortedNames.join(', ')} } from "${importPath}"`,
        )
    }

    // -----------------------------------------------------------------------
    // Wrap in component function
    // -----------------------------------------------------------------------
    const componentName = deriveComponentName(rootDataName)
    const fullCode = [
        ...importStatements,
        '',
        `export function ${componentName}() {`,
        '  return (',
        indent(code, 4),
        '  )',
        '}',
    ].filter(line => line !== undefined).join('\n')

    return {
        code: fullCode,
        imports: importStatements,
        tokenMappings,
        componentCount,
        transformations,
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveComponentName(dataName: string | null): string {
    if (!dataName) return 'FigmaComponent'

    // PascalCase from data-name: "User Profile Card" → "UserProfileCard"
    return dataName
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
        || 'FigmaComponent'
}

function indent(code: string, spaces: number): string {
    const pad = ' '.repeat(spaces)
    return code.split('\n').map(line => line.trim() ? `${pad}${line}` : line).join('\n')
}
