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
    'extralight': 'font-extralight',
    'extra_light': 'font-extralight',
    'light': 'font-light',
    'regular': 'font-normal',
    'medium': 'font-medium',
    'semi_bold': 'font-semibold',
    'semibold': 'font-semibold',
    'bold': 'font-bold',
    'extra_bold': 'font-extrabold',
    'extrabold': 'font-extrabold',
    'black': 'font-black',
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
function mapClassTokens(
    className: string,
    tokenLookup: TokenLookupResult,
    tokenMappings: Record<string, string>,
): string {
    let result = className

    // Pattern 1: utility-[color:var(--name,#hex)] or utility-[var(--name,#hex)]
    result = result.replace(
        /((?:text|bg|border|ring|fill|stroke|shadow|accent|caret|outline|decoration)-)\[(?:color:)?var\(--([^,)]+),\s*#([0-9a-fA-F]{3,8})\)\]/g,
        (match, prefix, varName, hex) => {
            const fullHex = `#${hex.toUpperCase()}`
            const tokenMatch = findNearestToken(fullHex, tokenLookup.exactMap, tokenLookup.labTokens, TIER2_DELTA_E)
            if (tokenMatch) {
                tokenMappings[fullHex] = tokenMatch.className
                return `${prefix}${tokenMatch.className}`
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

function buildShadcnCard(children: t.Node[]): t.JSXElement {
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

function buildShadcnTabs(children: t.Node[]): t.JSXElement {
    // Extract tab items from children
    const tabTexts: string[] = []
    for (const child of children) {
        if (t.isJSXElement(child)) {
            const childName = getDataName(child)
            if (childName) {
                const text = extractTextFromChildren(child.children)
                if (text) tabTexts.push(text)
            }
        }
    }
    if (tabTexts.length === 0) tabTexts.push('Tab 1', 'Tab 2')

    const triggers = tabTexts.map(text =>
        t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('TabsTrigger'), [
                t.jsxAttribute(t.jsxIdentifier('value'), t.stringLiteral(text.toLowerCase().replace(/\s+/g, '-'))),
            ]),
            t.jsxClosingElement(t.jsxIdentifier('TabsTrigger')),
            [t.jsxText(text)],
        ),
    )

    const tabsList = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('TabsList'), []),
        t.jsxClosingElement(t.jsxIdentifier('TabsList')),
        triggers,
    )

    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Tabs'), [
            t.jsxAttribute(t.jsxIdentifier('defaultValue'), t.stringLiteral(tabTexts[0].toLowerCase().replace(/\s+/g, '-'))),
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
                            const attrs: t.JSXAttribute[] = []
                            if (text) {
                                attrs.push(t.jsxAttribute(t.jsxIdentifier('placeholder'), t.stringLiteral(text)))
                            }
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Input'), attrs, true),
                                null, [], true,
                            )
                            break
                        }
                        case 'button': {
                            replacement = t.jsxElement(
                                t.jsxOpeningElement(t.jsxIdentifier('Button'), []),
                                t.jsxClosingElement(t.jsxIdentifier('Button')),
                                [t.jsxText(text || 'Button')],
                            )
                            break
                        }
                        case 'card':
                            replacement = buildShadcnCard(element.children)
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
                            replacement = buildShadcnTabs(element.children)
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

                // Clean Figma artifacts
                className = cleanFigmaArtifacts(className)

                // Map tokens
                className = mapClassTokens(className, tokenLookup, tokenMappings)

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
