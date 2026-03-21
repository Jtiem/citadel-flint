/**
 * Stack detector — flint-mcp/src/core/init/stackDetector.ts
 *
 * Auto-discovers which CSS/design-system framework a project uses and
 * returns a StackDetectionResult describing:
 *   - The primary framework (tailwind-v3, tailwind-v4, css-custom-props,
 *     dtcg, tokens-studio, chakra, mui, radix, or none)
 *   - Paths to relevant config / token / CSS files
 *   - UI framework (react, vue, svelte, unknown)
 *   - Whether TypeScript is configured
 *
 * Detection priority (highest wins):
 *   1. .flint/design-tokens.json (non-empty) → dtcg
 *   2. W3C DTCG JSON files (tokens.json, src/tokens/*.json, style-dictionary/**\/*.json)
 *   3. Tokens Studio JSON files
 *   4. Tailwind v4 (@theme block in CSS) → tailwind-v4
 *   5. Tailwind v3 config file → tailwind-v3
 *   6. CSS :root custom properties → css-custom-props
 *   7. package.json deps: chakra, mui, radix
 *   8. none
 *
 * Uses only Node.js built-ins (fs, path). No external dependencies.
 */

import fs from 'node:fs'
import path from 'node:path'

import type { StackDetectionResult, DetectedFramework, DetectedUIFramework } from './types.js'

// ── Internal helpers ─────────────────────────────────────────────────────────

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
 * Returns true when the parsed JSON object looks like a W3C DTCG token file.
 * A DTCG file contains at least one node in its tree that has both `$value`
 * and `$type` keys (or the top-level `$schema` key as a fast-path).
 */
function isDTCGFormat(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false
    const record = obj as Record<string, unknown>
    // Fast path: DTCG files commonly declare a $schema
    if ('$schema' in record) return true
    return hasDTCGNode(record)
}

function hasDTCGNode(obj: Record<string, unknown>): boolean {
    if ('$value' in obj && '$type' in obj) return true
    for (const val of Object.values(obj)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            if (hasDTCGNode(val as Record<string, unknown>)) return true
        }
    }
    return false
}

/**
 * Returns true when the parsed JSON looks like a Tokens Studio file.
 * Tokens Studio uses a `$value` key but also often has a `$extensions`
 * key with `"studio.tokens"` namespace, or uses type-keyed group objects.
 */
function isTokensStudioFormat(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false
    const record = obj as Record<string, unknown>
    return hasTokensStudioNode(record)
}

function hasTokensStudioNode(obj: Record<string, unknown>): boolean {
    // Tokens Studio stores tokens as objects with `value` (no $) and `type`
    if ('value' in obj && 'type' in obj && !('$value' in obj)) return true
    // Check for $extensions with studio.tokens namespace
    if (
        obj['$extensions'] &&
        typeof obj['$extensions'] === 'object' &&
        'studio.tokens' in (obj['$extensions'] as object)
    ) return true
    for (const val of Object.values(obj)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            if (hasTokensStudioNode(val as Record<string, unknown>)) return true
        }
    }
    return false
}

/** Scans a directory (non-recursively) for files matching a predicate. */
function scanDir(
    dir: string,
    predicate: (name: string) => boolean,
): string[] {
    try {
        return fs.readdirSync(dir)
            .filter(predicate)
            .map((name) => path.join(dir, name))
    } catch {
        return []
    }
}

/** Recursively scans a directory for files matching a predicate, up to maxDepth. */
function scanDirRecursive(
    dir: string,
    predicate: (name: string) => boolean,
    maxDepth = 3,
    currentDepth = 0,
): string[] {
    if (currentDepth > maxDepth) return []
    const results: string[] = []
    let entries: fs.Dirent[]
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
        return []
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
            results.push(...scanDirRecursive(fullPath, predicate, maxDepth, currentDepth + 1))
        } else if (entry.isFile() && predicate(entry.name)) {
            results.push(fullPath)
        }
    }
    return results
}

/** Returns true if the CSS source contains an `@theme` block (Tailwind v4). */
function hasThemeBlock(cssSource: string): boolean {
    return /@theme\s*\{/.test(cssSource)
}

/** Returns true if the CSS source contains a `:root {` block with CSS vars. */
function hasRootCustomProps(cssSource: string): boolean {
    return /:root\s*\{[^}]*--[a-zA-Z]/.test(cssSource)
}

/**
 * Reads package.json from projectRoot and returns the parsed deps/devDeps,
 * or empty objects on failure.
 */
function readPackageDeps(projectRoot: string): {
    deps: Record<string, string>
    devDeps: Record<string, string>
} {
    const pkgPath = path.join(projectRoot, 'package.json')
    const pkg = safeReadJson(pkgPath)
    if (!pkg || typeof pkg !== 'object') return { deps: {}, devDeps: {} }
    const p = pkg as Record<string, unknown>
    return {
        deps: (p['dependencies'] as Record<string, string>) ?? {},
        devDeps: (p['devDependencies'] as Record<string, string>) ?? {},
    }
}

// ── Well-known paths to check ────────────────────────────────────────────────

const TAILWIND_CONFIG_NAMES = [
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
]

const TAILWIND_V4_CSS_CANDIDATES = [
    'src/index.css',
    'src/app.css',
    'src/main.css',
    'src/globals.css',
    'src/styles/globals.css',
    'src/styles/global.css',
    'app/globals.css',
    'styles/global.css',
    'styles/globals.css',
    'styles/index.css',
]

const DTCG_CANDIDATE_FILES = [
    'tokens.json',
    'design-tokens.json',
]

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Detect the design-system stack used by the project at `projectRoot`.
 *
 * @param projectRoot - Absolute path to the project directory.
 * @returns A fully-populated StackDetectionResult.
 */
export async function detectStack(projectRoot: string): Promise<StackDetectionResult> {
    const result: StackDetectionResult = {
        framework: 'none',
        configPath: null,
        cssFiles: [],
        tokenFiles: [],
        packageDeps: [],
        uiFramework: 'unknown',
        typescript: false,
    }

    // ── TypeScript detection ─────────────────────────────────────────────────
    if (fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
        result.typescript = true
    }

    // ── Package.json scanning ────────────────────────────────────────────────
    const { deps, devDeps } = readPackageDeps(projectRoot)
    const allDeps = { ...deps, ...devDeps }

    // UI framework
    if ('react' in allDeps || 'react-dom' in allDeps) {
        result.uiFramework = 'react'
    } else if ('vue' in allDeps) {
        result.uiFramework = 'vue'
    } else if ('svelte' in allDeps) {
        result.uiFramework = 'svelte'
    }

    // Design-system packages
    const dsPackages: string[] = []
    if ('@chakra-ui/react' in allDeps) dsPackages.push('@chakra-ui/react')
    if ('@mui/material' in allDeps) dsPackages.push('@mui/material')
    if ('@radix-ui/themes' in allDeps) dsPackages.push('@radix-ui/themes')
    result.packageDeps = dsPackages

    // ── Priority 1: .flint/design-tokens.json ───────────────────────────────
    const flintTokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')
    if (fs.existsSync(flintTokensPath)) {
        const content = safeReadFile(flintTokensPath)
        if (content && content.trim() !== '' && content.trim() !== '[]' && content.trim() !== '{}') {
            result.framework = 'dtcg'
            result.configPath = flintTokensPath
            result.tokenFiles = [flintTokensPath]
            return result
        }
    }

    // ── Priority 2: W3C DTCG JSON files ─────────────────────────────────────
    const dtcgTokenFiles: string[] = []

    // Check well-known candidate filenames at project root
    for (const candidate of DTCG_CANDIDATE_FILES) {
        const candidatePath = path.join(projectRoot, candidate)
        if (fs.existsSync(candidatePath)) {
            const obj = safeReadJson(candidatePath)
            if (isDTCGFormat(obj)) {
                dtcgTokenFiles.push(candidatePath)
            }
        }
    }

    // Check src/tokens/*.json
    const srcTokensDir = path.join(projectRoot, 'src', 'tokens')
    if (fs.existsSync(srcTokensDir)) {
        const jsonFiles = scanDir(srcTokensDir, (n) => n.endsWith('.json'))
        for (const f of jsonFiles) {
            const obj = safeReadJson(f)
            if (isDTCGFormat(obj)) dtcgTokenFiles.push(f)
        }
    }

    // Check style-dictionary/**/*.json (up to 3 levels deep)
    const sdDir = path.join(projectRoot, 'style-dictionary')
    if (fs.existsSync(sdDir)) {
        const jsonFiles = scanDirRecursive(sdDir, (n) => n.endsWith('.json'))
        for (const f of jsonFiles) {
            const obj = safeReadJson(f)
            if (isDTCGFormat(obj)) dtcgTokenFiles.push(f)
        }
    }

    if (dtcgTokenFiles.length > 0) {
        result.framework = 'dtcg'
        result.configPath = dtcgTokenFiles[0]
        result.tokenFiles = dtcgTokenFiles
        return result
    }

    // ── Priority 3: Tokens Studio JSON files ────────────────────────────────
    const tsTokenFiles: string[] = []
    for (const candidate of DTCG_CANDIDATE_FILES) {
        const candidatePath = path.join(projectRoot, candidate)
        if (fs.existsSync(candidatePath)) {
            const obj = safeReadJson(candidatePath)
            if (isTokensStudioFormat(obj)) tsTokenFiles.push(candidatePath)
        }
    }

    if (tsTokenFiles.length > 0) {
        result.framework = 'tokens-studio'
        result.configPath = tsTokenFiles[0]
        result.tokenFiles = tsTokenFiles
        return result
    }

    // ── Priority 4: Tailwind v4 (@theme in CSS) ──────────────────────────────
    for (const candidate of TAILWIND_V4_CSS_CANDIDATES) {
        const cssPath = path.join(projectRoot, candidate)
        const css = safeReadFile(cssPath)
        if (css && hasThemeBlock(css)) {
            result.framework = 'tailwind-v4'
            result.configPath = cssPath
            result.cssFiles = [cssPath]
            return result
        }
    }

    // ── Priority 5: Tailwind v3 config file ─────────────────────────────────
    for (const configName of TAILWIND_CONFIG_NAMES) {
        const configPath = path.join(projectRoot, configName)
        if (fs.existsSync(configPath)) {
            result.framework = 'tailwind-v3'
            result.configPath = configPath
            return result
        }
    }

    // ── Priority 6: CSS custom properties (:root) ───────────────────────────
    const cssFilesWithProps: string[] = []

    // Scan root-level CSS files
    const rootCssFiles = scanDir(projectRoot, (n) => n.endsWith('.css') || n.endsWith('.scss'))
    for (const f of rootCssFiles) {
        const css = safeReadFile(f)
        if (css && hasRootCustomProps(css)) cssFilesWithProps.push(f)
    }

    // Scan src/ CSS files (non-recursive, one level)
    const srcDir = path.join(projectRoot, 'src')
    if (fs.existsSync(srcDir)) {
        const srcCssFiles = scanDir(srcDir, (n) => n.endsWith('.css') || n.endsWith('.scss'))
        for (const f of srcCssFiles) {
            const css = safeReadFile(f)
            if (css && hasRootCustomProps(css)) cssFilesWithProps.push(f)
        }
    }

    if (cssFilesWithProps.length > 0) {
        result.framework = 'css-custom-props'
        result.configPath = cssFilesWithProps[0]
        result.cssFiles = cssFilesWithProps
        return result
    }

    // ── Priority 7: Known UI library packages ────────────────────────────────
    if ('@chakra-ui/react' in allDeps) {
        result.framework = 'chakra'
        return result
    }
    if ('@mui/material' in allDeps) {
        result.framework = 'mui'
        return result
    }
    if ('@radix-ui/themes' in allDeps) {
        result.framework = 'radix'
        return result
    }

    // ── Priority 8: nothing found ────────────────────────────────────────────
    return result
}
