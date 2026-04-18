/**
 * tailwindConfigLoader.ts — flint-mcp/src/core/tailwindConfigLoader.ts
 *
 * Phase 1: Tailwind Config + Class Composition Expansion
 *
 * Loads and resolves tailwind.config.{js,ts,mjs,cjs} via Tailwind's own
 * `resolveConfig` helper. Returns a normalized `ResolvedTailwindTheme` with:
 *   - A flat `sections` map of token names → resolved values
 *   - A `knownClasses` set of fully-resolved Tailwind utility class strings
 *   - An mtime cache to avoid re-loading unchanged configs
 *
 * Security (Commandment 14 — Bypass Prohibition):
 *   All user config evaluation runs inside `vm.runInNewContext` with a frozen
 *   sandbox that exposes ZERO Node built-ins. The custom `require` resolver
 *   allowlists only an explicit set of first-party and widely-adopted Tailwind
 *   packages (see ALLOWED_REQUIRE_SPECIFIERS). Community plugins beyond this
 *   set are blocked to prevent typosquatting attacks.
 *   Any attempt to access `process`, `fs`, `http`, `fetch`, or any other
 *   disallowed API returns `{ ok: false, error: "sandbox-violation" }`.
 *
 * Contract: PHASE1-tailwind-config-class-composition.contract.ts
 */

import * as vm from 'node:vm'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'

// Lazy loaders for optional dependencies (tree-shaken when unused)
const _require = createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadEsbuild(): any {
    try {
        return _require('esbuild')
    } catch {
        return null
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadResolveConfig(): ((cfg: any) => any) | null {
    // Tailwind v3 exports resolveConfig; v4 removed it
    for (const specifier of ['tailwindcss/resolveConfig', 'tailwindcss']) {
        try {
            const mod = _require(specifier)
            const fn = mod?.default ?? mod
            if (typeof fn === 'function') return fn
        } catch {
            // continue to next specifier
        }
    }
    return null
}
// ── Type definitions (matching PHASE1 contract) ───────────────────────────────

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

/**
 * Normalized Tailwind theme produced by tailwindConfigLoader.
 * Each section is a flat map from dotted token name to resolved string value.
 */
export interface ResolvedTailwindTheme {
    /** Source config file that produced this theme (absolute path). */
    sourcePath: string
    /** Detected Tailwind major version. */
    version: 'v3' | 'v4-js' | 'v4-css-unsupported'
    /** mtimeMs of sourcePath at load time — used for cache invalidation. */
    mtimeMs: number
    /** Flat theme sections — each `Record<dottedName, resolvedValue>`. */
    sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
    /**
     * Precomputed set of fully-resolved Tailwind class-name prefixes derived
     * from the theme (e.g., "bg-primary-500", "text-brand.accent", "p-4").
     */
    knownClasses: ReadonlySet<string>
}

/** Why a tailwind.config.* could not be loaded. */
export type TailwindConfigLoadError =
    | 'config-not-found'
    | 'syntax-error'
    | 'sandbox-violation'
    | 'v4-css-first-unsupported'
    | 'resolve-config-threw'
    | 'timeout'
    | 'unknown'

/** Result shape from load(). */
export type TailwindConfigLoadResult =
    | { ok: true; theme: ResolvedTailwindTheme }
    | { ok: false; error: TailwindConfigLoadError; details: string; sourcePath: string | null }

// ── Config file candidates (checked in priority order) ────────────────────────

const CONFIG_CANDIDATES = [
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
] as const

// ── Sandbox require allowlist ─────────────────────────────────────────────────

/**
 * Explicit static allowlist of module specifiers permitted inside the sandbox.
 *
 * Opt-in by editing this set; matches explicit names only to prevent
 * typosquatting. The previous prefix regex (`/^tailwindcss-[a-z0-9-]+$/`)
 * was removed because it matched arbitrary community packages
 * (e.g. "tailwindcss-backdoor"), which could acquire full Node.js privileges
 * via `createRequire` outside the vm sandbox.
 *
 * To add a community plugin, append its exact npm package name here and open
 * a PR for review. Subpath imports (e.g. "tailwindcss/resolveConfig") are
 * handled separately by the `startsWith` checks below.
 */
const ALLOWED_REQUIRE_SPECIFIERS = new Set([
    'tailwindcss',
    '@tailwindcss/forms',
    '@tailwindcss/typography',
    '@tailwindcss/container-queries',
    '@tailwindcss/aspect-ratio',
    '@tailwindcss/line-clamp',
    'tailwindcss-animate',
])

/**
 * Returns true if the module specifier is allowed inside the sandbox.
 * Opt-in by editing ALLOWED_REQUIRE_SPECIFIERS; matches explicit names only
 * to prevent typosquatting.
 */
function isAllowedSpecifier(spec: string): boolean {
    if (ALLOWED_REQUIRE_SPECIFIERS.has(spec)) return true
    // Allow subpath imports for any approved top-level package
    // e.g. "tailwindcss/resolveConfig", "@tailwindcss/forms/dist/..."
    if (spec.startsWith('tailwindcss/')) return true
    if (spec.startsWith('@tailwindcss/')) return true
    return false
}

// ── Error message redaction ───────────────────────────────────────────────────

/**
 * Redact potentially-sensitive information from a caught error message.
 * We only expose the error CLASS, not argument values or env var contents.
 *
 * Covers common secret shapes:
 *   - key=value pairs (env vars, query strings, connection params)
 *   - URLs with embedded credentials (scheme://user:pass@host)
 *   - Long base64-ish strings (≥20 chars of base64 alphabet)
 *   - File path arguments inside parentheses
 *
 * Exported as __TEST_ONLY_redactErrorDetails for unit testing only.
 * Do not import this symbol in production code outside this module.
 */
function redactErrorDetails(err: unknown): string {
    if (err instanceof Error) {
        const msg = err.message
            // Redact URLs with embedded credentials: scheme://user:secret@host/...
            .replace(/[a-z][a-z0-9+\-.]*:\/\/[^\s@]*:[^\s@]*@[^\s"',)]+/gi, '<redacted-url>')
            // Redact key=value pairs (env vars, query params, connection strings)
            .replace(/\b\w+\s*=\s*["']?[^\s"',;&\)]{1,200}["']?/g, '<key>=<redacted>')
            // Redact long base64-ish strings (≥20 consecutive base64 chars)
            .replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '<redacted-b64>')
            // Redact file path arguments inside parentheses
            .replace(/\(["']?\/[^"')]+["']?\)/g, '(<redacted-path>)')
            // Trim to 200 chars max
            .slice(0, 200)
        return `${err.constructor?.name ?? 'Error'}: ${msg}`
    }
    return 'unknown-error'
}

/** @internal Test-only export — do not use in production code. */
export const __TEST_ONLY_redactErrorDetails = redactErrorDetails

// ── Sandbox executor ──────────────────────────────────────────────────────────

/**
 * Execute a CJS module string inside a vm.runInNewContext sandbox.
 * The sandbox contains ONLY: module, exports, __filename, __dirname,
 * Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, console (noop).
 * NO: process, global, fs, http, https, fetch, net, child_process, setTimeout, import.
 *
 * The custom require allowlist only permits tailwindcss packages.
 */
function runInSandbox(
    code: string,
    configPath: string,
    timeout: number,
): { exports: unknown } {
    const configDir = path.dirname(configPath)

    // Build the allowlisted require function using createRequire pointed at the
    // config file so relative subpaths resolve correctly.
    const safeRequire = createRequire(configPath)

    function sandboxRequire(specifier: string): unknown {
        if (!isAllowedSpecifier(specifier)) {
            // Do NOT include the raw specifier in the error message — it would
            // be echoed in details and could reveal attacker-controlled input.
            throw new Error(
                `sandbox-violation: community plugin not in allowlist — edit ALLOWED_REQUIRE_SPECIFIERS to opt in`,
            )
        }
        // Allowed: load it via the real require, but module itself is not
        // re-sandboxed at this layer (tailwindcss internals are trusted).
        return safeRequire(specifier)
    }

    // module.exports must be reassignable — do NOT freeze the module object
    // itself. The sandbox object is frozen (below) to prevent untrusted code
    // from replacing sandbox.require mid-execution. `module.exports = {...}`
    // works correctly because it reassigns a property on moduleObj, not on
    // the frozen sandbox reference.
    // Security: the dangerous globals (process, fs, http, fetch, global) are
    // simply absent from the sandbox object. vm.runInNewContext does not
    // inherit them.
    const moduleObj: { exports: Record<string, unknown> } = { exports: {} }

    const sandbox = {
        module: moduleObj,
        exports: moduleObj.exports,
        __filename: configPath,
        __dirname: configDir,
        Buffer,
        URL,
        URLSearchParams,
        TextEncoder,
        TextDecoder,
        // Noop console to suppress config side-effects
        console: {
            log: () => {},
            warn: () => {},
            error: () => {},
            info: () => {},
        },
        require: sandboxRequire,
        // Explicitly absent (security): process, global, fs, http, https,
        // net, fetch, child_process, setTimeout, setInterval, clearTimeout,
        // clearInterval, import, Worker, SharedArrayBuffer
    }

    // Freeze the sandbox object so that untrusted code cannot replace
    // sandbox.require or other properties mid-execution. module.exports
    // assignments use `module.exports = ...` (reassigning a property on
    // the moduleObj, not on sandbox itself) so freezing is safe here.
    Object.freeze(sandbox)

    // vm.Script with timeout handles CPU-bound runaway; wall-clock AbortController
    // is added by the caller (`load`) via Promise.race.
    const script = new vm.Script(code, {
        filename: configPath,
    })

    script.runInNewContext(sandbox, { timeout })

    return moduleObj
}

// ── TypeScript transpilation ──────────────────────────────────────────────────

function transpileTs(source: string, filePath: string): string {
    const esbuild = loadEsbuild()
    if (esbuild === null) {
        throw new Error('esbuild is required to load TypeScript tailwind configs — install esbuild')
    }
    const result = esbuild.transformSync(source, {
        loader: 'ts',
        format: 'cjs',
        target: 'node20',
        sourcefile: filePath,
    })
    return result.code
}

// ── Theme flattening ──────────────────────────────────────────────────────────

type RawThemeValue =
    | string
    | Record<string, string | Record<string, string>>
    | (() => RawThemeValue)
    | null
    | undefined

/**
 * Flatten a (possibly nested) Tailwind theme section into a dotted-key map.
 * e.g. { primary: { 500: "#0066cc" } } → { "primary.500": "#0066cc" }
 * Only string leaf values are collected.
 */
function flattenSection(
    obj: unknown,
    prefix = '',
): Record<string, string> {
    const result: Record<string, string> = {}
    if (obj === null || obj === undefined) return result
    if (typeof obj === 'function') {
        // Some theme values are functions — skip them (we only handle resolved values)
        return result
    }
    if (typeof obj === 'string') {
        if (prefix) result[prefix] = obj
        return result
    }
    if (typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const key = prefix ? `${prefix}.${k}` : k
            Object.assign(result, flattenSection(v, key))
        }
    }
    return result
}

// ── Class name generation from theme sections ─────────────────────────────────

/**
 * Map from theme section → list of Tailwind class prefixes that use it.
 * Used to generate knownClasses entries like "bg-primary-500", "text-lg", "p-4".
 */
const SECTION_CLASS_PREFIXES: Record<string, string[]> = {
    colors: [
        'bg', 'text', 'border', 'ring', 'from', 'via', 'to', 'outline',
        'decoration', 'divide', 'shadow', 'placeholder',
        'accent', 'caret',
    ],
    spacing: ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'gap', 'w', 'h', 'inset'],
    fontFamily: ['font'],
    fontSize: ['text'],
    fontWeight: ['font'],
    lineHeight: ['leading'],
    letterSpacing: ['tracking'],
    boxShadow: ['shadow'],
    borderRadius: ['rounded'],
    opacity: ['opacity'],
    zIndex: ['z'],
}

/**
 * Generate the full set of Tailwind class strings from a resolved theme.
 * For each token key in each section, generate classes for all relevant prefixes.
 */
function buildKnownClasses(
    sections: ResolvedTailwindTheme['sections'],
): ReadonlySet<string> {
    const classes = new Set<string>()

    for (const [section, tokens] of Object.entries(sections)) {
        const prefixes = SECTION_CLASS_PREFIXES[section]
        if (prefixes === undefined || tokens === undefined) continue

        for (const tokenKey of Object.keys(tokens)) {
            // tokenKey might be "primary.500" → class suffix is "primary-500"
            const suffix = tokenKey.replace(/\./g, '-')
            for (const prefix of prefixes) {
                classes.add(`${prefix}-${suffix}`)
            }
        }
    }

    return classes
}

// ── Resolve config via Tailwind's resolveConfig ───────────────────────────────

function resolveTheme(
    rawConfig: unknown,
    configPath: string,
    version: 'v3' | 'v4-js',
    mtimeMs: number,
): ResolvedTailwindTheme {
    // Tailwind v3 exports resolveConfig as a top-level function.
    // Tailwind v4 removed this API — we gracefully fall through.
    const resolveConfig = loadResolveConfig()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolved: any = rawConfig
    if (resolveConfig !== null) {
        try {
            resolved = resolveConfig(rawConfig)
        } catch {
            // Fall through with raw config if resolveConfig fails
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const themeObj: Record<string, any> = (resolved as any)?.theme ?? {}
    // When resolveConfig is unavailable, merge `theme.extend` into the base theme
    // so that extended tokens are still visible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extend: Record<string, any> = themeObj.extend ?? {}

    // Extract and flatten each section
    const sections: ResolvedTailwindTheme['sections'] = {}

    const sectionNames = [
        'colors', 'spacing', 'fontFamily', 'fontSize',
        'fontWeight', 'lineHeight', 'letterSpacing',
        'boxShadow', 'borderRadius', 'opacity', 'zIndex',
    ] as const

    for (const section of sectionNames) {
        // Merge base section + extended section (extend takes precedence)
        const base = themeObj[section] ?? {}
        const ext = extend[section] ?? {}
        // Deep merge: extended keys override base keys at the top level
        const raw = typeof base === 'object' && typeof ext === 'object'
            ? { ...base, ...ext }
            : (ext !== null && ext !== undefined && Object.keys(ext).length > 0 ? ext : base)
        if (raw !== undefined && raw !== null && typeof raw === 'object') {
            const flat = flattenSection(raw)
            if (Object.keys(flat).length > 0) {
                sections[section] = flat
            }
        }
    }

    const knownClasses = buildKnownClasses(sections)

    return {
        sourcePath: configPath,
        version,
        mtimeMs,
        sections,
        knownClasses,
    }
}

// ── v4 CSS-first detection ────────────────────────────────────────────────────

/**
 * Scan CSS files in the project root (non-recursively) for `@theme {` blocks.
 * Only inspects .css files directly in projectRoot and one level deep.
 */
async function detectV4CssFirst(projectRoot: string): Promise<boolean> {
    const CSS_GLOB_DIRS = [projectRoot, path.join(projectRoot, 'src')]

    for (const dir of CSS_GLOB_DIRS) {
        let entries: fs.Dirent[]
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
            continue
        }

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.css')) continue
            try {
                const content = fs.readFileSync(path.join(dir, entry.name), 'utf8')
                if (content.includes('@theme')) return true
            } catch {
                // Skip unreadable files
            }
        }
    }

    return false
}

// ── mtime cache ───────────────────────────────────────────────────────────────

interface CacheEntry {
    configPath: string
    mtimeMs: number
    result: TailwindConfigLoadResult
}

const cache = new Map<string, CacheEntry>()

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the Tailwind config at the given project root.
 * Returns `{ ok: false, error: 'config-not-found' }` when no
 * tailwind.config.{js,ts,mjs,cjs} is present.
 *
 * Cache: returns the previous result if mtimeMs is unchanged.
 */
export async function load(projectRoot: string): Promise<TailwindConfigLoadResult> {
    // 1. Find the config file
    let configPath: string | null = null
    for (const candidate of CONFIG_CANDIDATES) {
        const candidate_path = path.join(projectRoot, candidate)
        try {
            fs.accessSync(candidate_path, fs.constants.R_OK)
            configPath = candidate_path
            break
        } catch {
            // Not found, try next
        }
    }

    // 2. If no JS config found, check for v4 CSS-first
    if (configPath === null) {
        const hasCssFirst = await detectV4CssFirst(projectRoot)
        if (hasCssFirst) {
            return {
                ok: false,
                error: 'v4-css-first-unsupported' as TailwindConfigLoadError,
                details: 'v4 CSS-first @theme detected — Phase 2 will handle this',
                sourcePath: null,
            }
        }
        return {
            ok: false,
            error: 'config-not-found' as TailwindConfigLoadError,
            details: 'No tailwind.config.{js,ts,mjs,cjs} found',
            sourcePath: null,
        }
    }

    // 3. Check mtime cache
    let mtimeMs: number
    try {
        const stat = fs.statSync(configPath)
        mtimeMs = stat.mtimeMs
    } catch (err) {
        return {
            ok: false,
            error: 'config-not-found' as TailwindConfigLoadError,
            details: redactErrorDetails(err),
            sourcePath: configPath,
        }
    }

    const cached = cache.get(projectRoot)
    if (
        cached !== undefined &&
        cached.configPath === configPath &&
        cached.mtimeMs === mtimeMs
    ) {
        return cached.result
    }

    // 4. Read source
    let source: string
    try {
        source = fs.readFileSync(configPath, 'utf8')
    } catch (err) {
        return {
            ok: false,
            error: 'syntax-error' as TailwindConfigLoadError,
            details: redactErrorDetails(err),
            sourcePath: configPath,
        }
    }

    // 5. Transpile TypeScript files via esbuild
    let cjsCode: string
    const ext = path.extname(configPath)

    if (ext === '.ts' || ext === '.mts') {
        try {
            cjsCode = transpileTs(source, configPath)
        } catch (err) {
            return {
                ok: false,
                error: 'syntax-error' as TailwindConfigLoadError,
                details: redactErrorDetails(err),
                sourcePath: configPath,
            }
        }
    } else if (ext === '.mjs') {
        // ESM → CJS conversion via esbuild
        try {
            const esbuild = loadEsbuild()
            if (esbuild === null) throw new Error('esbuild not available')
            const result = esbuild.transformSync(source, {
                loader: 'js',
                format: 'cjs',
                target: 'node20',
                sourcefile: configPath,
            })
            cjsCode = result.code
        } catch (err) {
            return {
                ok: false,
                error: 'syntax-error' as TailwindConfigLoadError,
                details: redactErrorDetails(err),
                sourcePath: configPath,
            }
        }
    } else {
        // .js, .cjs — use as-is (may still be CommonJS)
        cjsCode = source
    }

    // 6. Evaluate in sandbox with 2000ms CPU timeout
    const TIMEOUT_MS = 2000
    let rawExports: unknown

    try {
        // Wall-clock timeout race in case event-loop starvation prevents CPU timeout
        const execPromise = new Promise<{ exports: unknown }>((resolve, reject) => {
            try {
                const result = runInSandbox(cjsCode, configPath!, TIMEOUT_MS)
                resolve(result)
            } catch (err) {
                reject(err)
            }
        })

        const timeoutPromise = new Promise<never>((_, reject) => {
            const t = setTimeout(() => {
                reject(new Error('timeout: config evaluation exceeded 2000ms wall-clock budget'))
            }, TIMEOUT_MS + 100) // Slightly longer than CPU timeout
            // Don't block Node exit on this timer
            if (typeof t === 'object' && t !== null && 'unref' in t) {
                (t as NodeJS.Timeout).unref()
            }
        })

        const { exports } = await Promise.race([execPromise, timeoutPromise])
        // CJS: module.exports or exports.default
        rawExports = (exports as Record<string, unknown>)?.default ?? exports
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)

        // Classify the error type
        if (
            msg.includes('sandbox-violation') ||
            msg.includes('process is not defined') ||
            msg.includes('fs is not defined') ||
            msg.includes('fetch is not defined') ||
            msg.includes('http is not defined') ||
            msg.includes('https is not defined') ||
            msg.includes('child_process') ||
            (err instanceof ReferenceError &&
                /process|fs|require|global|window/.test(msg))
        ) {
            return {
                ok: false,
                error: 'sandbox-violation' as TailwindConfigLoadError,
                details: redactErrorDetails(err),
                sourcePath: configPath,
            }
        }

        if (msg.includes('timeout')) {
            return {
                ok: false,
                error: 'timeout' as TailwindConfigLoadError,
                details: 'Config evaluation exceeded 2000ms',
                sourcePath: configPath,
            }
        }

        return {
            ok: false,
            error: 'syntax-error' as TailwindConfigLoadError,
            details: redactErrorDetails(err),
            sourcePath: configPath,
        }
    }

    // 7. Detect version
    // v4 JS configs typically use @tailwindcss/vite or postcss plugin arrays
    // We detect this by the absence of the classic `theme.extend` pattern or
    // presence of v4-specific fields. Default to v3 for most configs.
    const version: 'v3' | 'v4-js' = detectTailwindVersion(rawExports, source)

    // 8. Resolve theme
    let theme: ResolvedTailwindTheme
    try {
        theme = resolveTheme(rawExports, configPath, version, mtimeMs)
    } catch (err) {
        return {
            ok: false,
            error: 'resolve-config-threw' as TailwindConfigLoadError,
            details: redactErrorDetails(err),
            sourcePath: configPath,
        }
    }

    const result: TailwindConfigLoadResult = { ok: true, theme }

    // 9. Cache and return
    cache.set(projectRoot, { configPath, mtimeMs, result })
    return result
}

/**
 * Simple heuristic to detect whether a config is v3 or v4-js.
 * v4 configs may use plugins like `@tailwindcss/vite`, have no `theme` block,
 * or explicitly reference v4 APIs. Default is v3.
 */
function detectTailwindVersion(config: unknown, sourceText: string): 'v3' | 'v4-js' {
    // Check source for v4 indicators
    if (
        sourceText.includes('@tailwindcss/vite') ||
        sourceText.includes('@tailwindcss/postcss') ||
        // v4 alpha/beta package names
        sourceText.includes("from 'tailwindcss/plugin'") && !sourceText.includes('theme')
    ) {
        return 'v4-js'
    }

    // Config object indicators
    if (config !== null && typeof config === 'object') {
        const cfg = config as Record<string, unknown>
        // v4 configs typically don't have a theme block but may have `plugins`
        if (cfg._v4 === true || cfg.__isTailwindV4 === true) return 'v4-js'
    }

    return 'v3'
}

/**
 * Clear the mtime cache for a single project (test helper).
 */
export function invalidate(projectRoot: string): void {
    cache.delete(projectRoot)
}

/**
 * Clear the mtime cache for all projects (test helper).
 */
export function reset(): void {
    cache.clear()
}
