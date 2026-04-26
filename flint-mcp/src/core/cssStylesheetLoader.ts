/**
 * cssStylesheetLoader.ts — flint-mcp/src/core/cssStylesheetLoader.ts
 *
 * Phase 2: PostCSS Parser + CSS Modules + Tailwind v4 CSS-First
 *
 * Pure PostCSS-based stylesheet parser. Extracts:
 *   - Custom properties from `:root`-scoped blocks
 *   - `@theme {}` blocks (Tailwind v4 CSS-first)
 *   - `@keyframes` names
 *   - `@apply` directive references
 *
 * Security: Hard 2MB file-size cap enforced via fs.stat BEFORE readFile.
 * Cache: mtime-based per-file result cache.
 * Error contract: never throws — all errors returned as `{ ok: false, error }`.
 *
 * Contract: PHASE2-postcss-css-modules.contract.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequire } from 'node:module'

// ── Lazy dependency loader ──────────────────────────────────────────────────

const _require = createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPostcss(): any {
    try {
        return _require('postcss')
    } catch {
        return null
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPostcssScss(): any {
    try {
        return _require('postcss-scss')
    } catch {
        return null
    }
}

// ── Type definitions ─────────────────────────────────────────────────────────

export type StylesheetSyntax = 'css' | 'scss' | 'sass' | 'less' | 'pcss'

export type StylesheetLoadError =
    | 'file-not-found'
    | 'parse-error'
    | 'unsupported-syntax'
    | 'too-large'
    | 'unknown'

export interface CustomPropertyDeclaration {
    name: string
    value: string
    selector: string
    line: number
}

export type ResolvedTailwindThemeSection =
    | 'colors'
    | 'spacing'
    | 'fontFamily'
    | 'fontSize'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'boxShadow'
    | 'borderRadius'
    | 'opacity'
    | 'zIndex'

export interface TailwindV4ThemeBlock {
    rawDeclarations: ReadonlyArray<{ name: string; value: string; line: number }>
    sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
    startLine: number
}

export interface KeyframeDeclaration {
    name: string
    line: number
}

export interface ParsedStylesheet {
    sourcePath: string
    syntax: StylesheetSyntax
    mtimeMs: number
    customProperties: readonly CustomPropertyDeclaration[]
    themeBlocks: readonly TailwindV4ThemeBlock[]
    keyframes: readonly KeyframeDeclaration[]
    applyDirectives: readonly { selector: string; classes: readonly string[]; line: number }[]
}

export type StylesheetLoadResult =
    | { ok: true; stylesheet: ParsedStylesheet }
    | { ok: false; error: StylesheetLoadError; details: string; sourcePath: string }

// ── Hard size cap ─────────────────────────────────────────────────────────────

/**
 * SECURITY-CRITICAL: Files larger than this threshold are rejected without
 * reading any content. Contract invariant: 2_000_000 accepted, 2_000_001 rejected.
 */
export const MAX_STYLESHEET_SIZE_BYTES = 2_000_000

// ── Extension → syntax mapping ───────────────────────────────────────────────

function detectSyntax(filePath: string): StylesheetSyntax | null {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
        case '.css':
        case '.pcss':
        case '.module.css':
            return 'css'
        case '.scss':
        case '.module.scss':
            return 'scss'
        case '.sass':
            return 'sass'
        case '.less':
            return 'less'
        default: {
            // Check compound extensions like .module.css already handled above
            // Handle double extensions e.g. "foo.module.css" → ext is ".css"
            return null
        }
    }
}

/**
 * Detect syntax from the full basename (handles compound extensions like
 * `.module.css`, `.module.scss`).
 */
function detectSyntaxFromPath(filePath: string): StylesheetSyntax {
    const base = path.basename(filePath).toLowerCase()
    if (base.endsWith('.module.css')) return 'css'
    if (base.endsWith('.module.scss')) return 'scss'
    const detected = detectSyntax(filePath)
    return detected ?? 'css'
}

// ── :root selector matching ──────────────────────────────────────────────────

const ROOT_SELECTORS = new Set([':root', 'html', ':where(:root)', ':is(:root)', ':where(html)', ':is(html)'])

function isRootSelector(selector: string): boolean {
    const trimmed = selector.trim()
    return ROOT_SELECTORS.has(trimmed)
}

// ── Tailwind v4 @theme section → ResolvedTailwindThemeSection mapping ────────

/**
 * Map a `--color-*`, `--spacing-*` etc. CSS variable name from a `@theme` block
 * into the appropriate `ResolvedTailwindThemeSection` key.
 */
function mapThemeVarToSection(varName: string): ResolvedTailwindThemeSection | null {
    // varName includes leading `--`
    const name = varName.startsWith('--') ? varName.slice(2) : varName
    if (name.startsWith('color-') || name.startsWith('colors-')) return 'colors'
    if (name.startsWith('spacing-')) return 'spacing'
    if (name.startsWith('font-family-')) return 'fontFamily'
    if (name.startsWith('font-size-')) return 'fontSize'
    if (name.startsWith('font-weight-')) return 'fontWeight'
    if (name.startsWith('line-height-')) return 'lineHeight'
    if (name.startsWith('letter-spacing-')) return 'letterSpacing'
    if (name.startsWith('shadow-') || name.startsWith('box-shadow-')) return 'boxShadow'
    if (name.startsWith('radius-') || name.startsWith('border-radius-')) return 'borderRadius'
    if (name.startsWith('opacity-')) return 'opacity'
    if (name.startsWith('z-') || name.startsWith('z-index-')) return 'zIndex'
    return null
}

/**
 * Convert `--color-primary-500` → `primary.500` (strip the section prefix).
 */
function stripSectionPrefix(varName: string): string {
    const name = varName.startsWith('--') ? varName.slice(2) : varName
    const prefixes = [
        'color-', 'colors-',
        'spacing-',
        'font-family-',
        'font-size-',
        'font-weight-',
        'line-height-',
        'letter-spacing-',
        'shadow-', 'box-shadow-',
        'radius-', 'border-radius-',
        'opacity-',
        'z-', 'z-index-',
    ]
    for (const prefix of prefixes) {
        if (name.startsWith(prefix)) {
            return name.slice(prefix.length).replace(/-/g, '.')
        }
    }
    return name
}

// ── PostCSS AST walking ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStylesheet(content: string, syntax: StylesheetSyntax, postcss: any): ParsedStylesheet | Error {
    const customProperties: CustomPropertyDeclaration[] = []
    const themeBlocks: TailwindV4ThemeBlock[] = []
    const keyframes: KeyframeDeclaration[] = []
    const applyDirectives: { selector: string; classes: readonly string[]; line: number }[] = []

    let syntaxPlugin: object | undefined
    if (syntax === 'scss' || syntax === 'sass') {
        const scssPlugin = loadPostcssScss()
        if (scssPlugin) syntaxPlugin = scssPlugin
    }

    let root: unknown
    try {
        if (syntaxPlugin) {
            root = postcss.parse(content, { syntax: syntaxPlugin })
        } else {
            root = postcss.parse(content)
        }
    } catch (err: unknown) {
        return err instanceof Error ? err : new Error(String(err))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootNode = root as any

    /**
     * Walk a container node and extract custom properties if it matches a :root selector.
     * Also recurse into @layer base { :root { ... } }.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walkContainer(container: any, parentIsLayerBase = false): void {
        container.each?.((node: any) => {
            if (node.type === 'rule') {
                const selector: string = node.selector ?? ''
                const isRoot = isRootSelector(selector) || (parentIsLayerBase && isRootSelector(selector))

                if (isRoot) {
                    // Extract custom properties
                    node.each?.((child: any) => {
                        if (child.type === 'decl' && child.prop?.startsWith('--')) {
                            customProperties.push({
                                name: child.prop as string,
                                value: (child.value as string).trim(),
                                selector: selector,
                                line: child.source?.start?.line ?? 0,
                            })
                        }
                    })
                }

                // Also check @apply inside any rule
                node.each?.((child: any) => {
                    if (child.type === 'atrule' && child.name === 'apply') {
                        const classes = (child.params as string).trim().split(/\s+/).filter(Boolean)
                        if (classes.length > 0) {
                            applyDirectives.push({
                                selector: selector,
                                classes,
                                line: child.source?.start?.line ?? 0,
                            })
                        }
                    }
                })
            } else if (node.type === 'atrule') {
                const atName: string = node.name ?? ''
                const atParams: string = node.params ?? ''

                if (atName === 'theme') {
                    // Tailwind v4 @theme {} block
                    const rawDeclarations: Array<{ name: string; value: string; line: number }> = []
                    const sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>> = {}

                    node.each?.((child: any) => {
                        if (child.type === 'decl' && child.prop?.startsWith('--')) {
                            const decl = {
                                name: child.prop as string,
                                value: (child.value as string).trim(),
                                line: child.source?.start?.line ?? 0,
                            }
                            rawDeclarations.push(decl)

                            const section = mapThemeVarToSection(child.prop as string)
                            if (section !== null) {
                                if (sections[section] === undefined) {
                                    sections[section] = {}
                                }
                                const tokenKey = stripSectionPrefix(child.prop as string)
                                sections[section]![tokenKey] = decl.value
                            }
                        }
                    })

                    themeBlocks.push({
                        rawDeclarations,
                        sections,
                        startLine: node.source?.start?.line ?? 0,
                    })
                } else if (atName === 'keyframes') {
                    keyframes.push({
                        name: atParams.trim(),
                        line: node.source?.start?.line ?? 0,
                    })
                } else if (atName === 'layer') {
                    // @layer base { :root { ... } } — recurse
                    const isBase = atParams.trim() === 'base'
                    walkContainer(node, isBase)
                } else if (atName === 'media' || atName === 'supports') {
                    // @media / @supports wrappers — recurse to find nested :root
                    walkContainer(node, false)
                } else {
                    // Generic at-rule — recurse (handles @layer utilities etc.)
                    walkContainer(node, false)
                }
            }
        })
    }

    walkContainer(rootNode)

    return {
        sourcePath: '', // filled by caller
        syntax,
        mtimeMs: 0,     // filled by caller
        customProperties,
        themeBlocks,
        keyframes,
        applyDirectives,
    }
}

// ── mtime cache ───────────────────────────────────────────────────────────────

interface CacheEntry {
    mtimeMs: number
    result: StylesheetLoadResult
}

const _cache = new Map<string, CacheEntry>()

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load and parse a stylesheet file.
 *
 * SECURITY: File size is checked via `fs.stat` BEFORE any content is read.
 * Files >2MB are rejected without reading a single byte.
 *
 * Cache: returns the previous result if `mtimeMs` is unchanged (per-process).
 */
export async function load(filePath: string): Promise<StylesheetLoadResult> {
    const absolutePath = path.resolve(filePath)

    // ── 1. Stat the file (size gate + mtime) ─────────────────────────────────
    let stat: fs.Stats
    try {
        stat = await fs.promises.stat(absolutePath)
    } catch {
        return {
            ok: false,
            error: 'file-not-found',
            details: `File not found: ${absolutePath}`,
            sourcePath: absolutePath,
        }
    }

    // SECURITY-CRITICAL: Reject files > 2MB without reading content
    if (stat.size > MAX_STYLESHEET_SIZE_BYTES) {
        return {
            ok: false,
            error: 'too-large',
            details: `File size ${stat.size} bytes exceeds limit of ${MAX_STYLESHEET_SIZE_BYTES} bytes`,
            sourcePath: absolutePath,
        }
    }

    // ── 2. mtime cache check ─────────────────────────────────────────────────
    const mtimeMs = stat.mtimeMs
    const cached = _cache.get(absolutePath)
    if (cached !== undefined && cached.mtimeMs === mtimeMs) {
        return cached.result
    }

    // ── 3. Load PostCSS ───────────────────────────────────────────────────────
    const postcss = loadPostcss()
    if (postcss === null) {
        const result: StylesheetLoadResult = {
            ok: false,
            error: 'unknown',
            details: 'postcss package not installed',
            sourcePath: absolutePath,
        }
        _cache.set(absolutePath, { mtimeMs, result })
        return result
    }

    // ── 4. Detect syntax ──────────────────────────────────────────────────────
    const syntax = detectSyntaxFromPath(absolutePath)

    // ── 5. Read file content ──────────────────────────────────────────────────
    let content: string
    try {
        content = await fs.promises.readFile(absolutePath, 'utf8')
    } catch (err: unknown) {
        const result: StylesheetLoadResult = {
            ok: false,
            error: 'unknown',
            details: err instanceof Error ? err.message : String(err),
            sourcePath: absolutePath,
        }
        _cache.set(absolutePath, { mtimeMs, result })
        return result
    }

    // ── 6. Parse ──────────────────────────────────────────────────────────────
    const parsed = parseStylesheet(content, syntax, postcss)
    if (parsed instanceof Error) {
        // Security: do NOT include the offending CSS source or full message in details.
        // CSS comments may contain secrets (API keys, credentials). Only emit the
        // error type and source location — never the raw CSS content.
        const errName = (parsed as NodeJS.ErrnoException & { line?: number; column?: number }).constructor?.name
            ?? parsed.name
            ?? 'ParseError'
        const errLine = (parsed as NodeJS.ErrnoException & { line?: number }).line
        const errCol = (parsed as NodeJS.ErrnoException & { column?: number }).column
        const safeDetails = errCol !== undefined
            ? `${errName} at line ${errLine ?? '?'}, column ${errCol}`
            : `${errName} at line ${errLine ?? '?'}`
        const result: StylesheetLoadResult = {
            ok: false,
            error: 'parse-error',
            details: safeDetails,
            sourcePath: absolutePath,
        }
        _cache.set(absolutePath, { mtimeMs, result })
        return result
    }

    // ── 7. Fill in metadata and return ────────────────────────────────────────
    const stylesheet: ParsedStylesheet = {
        ...parsed,
        sourcePath: absolutePath,
        mtimeMs,
    }

    const result: StylesheetLoadResult = { ok: true, stylesheet }
    _cache.set(absolutePath, { mtimeMs, result })
    return result
}

/**
 * Clear the mtime cache for a single file (test helper).
 */
export function invalidate(absolutePath: string): void {
    _cache.delete(path.resolve(absolutePath))
}

/**
 * Clear the mtime cache for all files (test helper).
 */
export function reset(): void {
    _cache.clear()
}
