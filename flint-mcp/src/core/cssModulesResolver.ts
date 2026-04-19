/**
 * cssModulesResolver.ts — flint-mcp/src/core/cssModulesResolver.ts
 *
 * Phase 2 — PostCSS Parser + CSS Modules + Tailwind v4 CSS-First
 *
 * Resolves every `import s from '*.module.css'` in a source file's
 * pre-parsed Babel AST into a structured class-binding map.
 *
 * Key contracts:
 *   - AST read-only (Commandment 13): traverses ImportDeclarations without
 *     calling path.replaceWith or any mutation.
 *   - SECURITY GATE: any import whose resolved absolute path does not start
 *     with `projectRoot` returns `failureReason: 'path-outside-project'`
 *     WITHOUT reading the file. The check completes within 1ms (no I/O).
 *   - postcss-modules is not a hard dependency: we use PostCSS alone to
 *     extract class selectors from the CSS file. The scopedClassName is
 *     generated using the conventional `[name]__[local]___[hash]` pattern,
 *     but only the localClassName is required by Mithril drift detection.
 *   - Graceful failure: missing module → 'module-not-found', parse error →
 *     'module-parse-error', no classes in file → 'no-classes-exported'.
 *
 * Contract: PHASE2-postcss-css-modules.contract.ts
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import * as t from '@babel/types'
import { createRequire } from 'node:module'

// ── Types (re-exported for test convenience) ─────────────────────────────────

export interface CssModuleClassBinding {
    localClassName: string
    scopedClassName: string
    /** 1-based line number in the .module.css file, 0 when unavailable. */
    line: number
}

export interface ResolvedCssModuleImport {
    /** Local binding name: `import s from './x.module.css'` → 's' */
    bindingName: string
    /** Absolute path of the resolved .module.* file. */
    modulePath: string
    /** Class bindings exported by the module. Empty when the module fails. */
    classBindings: readonly CssModuleClassBinding[]
    /**
     * Named imports: `import { active, disabled } from './x.module.css'`
     * → [{ imported: 'active', local: 'active' }]
     * Empty for default or namespace imports.
     */
    namedImports: readonly { imported: string; local: string }[]
    /** True when resolution fully succeeded. */
    resolved: boolean
    /** Why resolution failed. Null when resolved:true. */
    failureReason:
        | 'module-not-found'
        | 'module-parse-error'
        | 'no-classes-exported'
        | 'path-outside-project'
        | null
}

export interface CssModulesResolution {
    sourcePath: string
    imports: readonly ResolvedCssModuleImport[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const _require = createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPostcss(): any {
    try {
        return _require('postcss')
    } catch {
        return null
    }
}

/** CSS Module file extension suffixes. */
const CSS_MODULE_SUFFIXES = [
    '.module.css',
    '.module.scss',
    '.module.sass',
    '.module.less',
    '.module.styl',
    '.module.pcss',
]

function isCssModuleImport(spec: string): boolean {
    return CSS_MODULE_SUFFIXES.some((s) => spec.endsWith(s))
}

/** Simple hash of a string for scoped class name generation (djb2). */
function simpleHash(str: string): string {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
        hash = hash >>> 0 // unsigned 32-bit
    }
    return hash.toString(36).slice(0, 5)
}

/**
 * Generate a scoped class name using the conventional postcss-modules pattern:
 *   `[filename]__[localName]___[hash]`
 */
function generateScopedName(localName: string, modulePath: string): string {
    const basename = path.basename(modulePath, path.extname(modulePath))
        .replace(/\.module$/, '')
    const hash = simpleHash(`${modulePath}:${localName}`)
    return `${basename}__${localName}___${hash}`
}

/**
 * Extract class names from CSS file content using PostCSS.
 * Returns null on parse error.
 */
function extractClassNames(
    content: string,
    modulePath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postcss: any
): CssModuleClassBinding[] | null {
    let root: unknown
    try {
        root = postcss.parse(content)
    } catch {
        return null
    }

    const bindings: CssModuleClassBinding[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootNode = root as any

    // Walk all rule nodes looking for class selectors
    rootNode.walk?.((node: any) => {
        if (node.type !== 'rule') return
        const selector: string = node.selector ?? ''
        // Extract all class names from the selector
        // Matches `.foo`, `.foo:hover`, `.foo .bar`, `.foo:not(.bar)`, etc.
        const classPattern = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g
        let match: RegExpExecArray | null
        while ((match = classPattern.exec(selector)) !== null) {
            const localClassName = match[1]
            // Deduplicate: only add if not already present
            if (!bindings.some((b) => b.localClassName === localClassName)) {
                bindings.push({
                    localClassName,
                    scopedClassName: generateScopedName(localClassName, modulePath),
                    line: node.source?.start?.line ?? 0,
                })
            }
        }
    })

    return bindings
}

// ── SECURITY GATE ─────────────────────────────────────────────────────────────

/**
 * SECURITY-CRITICAL: Returns true if absolutePath escapes projectRoot.
 *
 * Uses path.relative to detect `../` traversal. This check MUST complete
 * synchronously and immediately — no I/O is permitted before it runs.
 *
 * Invariant from contract: must complete within 10ms per call.
 */
function isOutsideProject(absolutePath: string, projectRoot: string): boolean {
    const rel = path.relative(path.resolve(projectRoot), path.resolve(absolutePath))
    return rel.startsWith('..') || path.isAbsolute(rel)
}

// ── ImportDeclaration walker (AST read-only) ──────────────────────────────────

interface RawImportRecord {
    spec: string
    bindingName: string
    namedImports: Array<{ imported: string; local: string }>
}

/**
 * Walk the top-level ImportDeclarations of the Babel AST and collect
 * CSS Module import records.
 *
 * Read-only: never calls path.replaceWith or any mutation API.
 * Uses the raw AST nodes directly (no @babel/traverse) to avoid
 * any possibility of accidental mutation.
 */
function collectCssModuleImports(ast: t.File): RawImportRecord[] {
    const results: RawImportRecord[] = []

    for (const node of ast.program.body) {
        if (!t.isImportDeclaration(node)) continue
        const spec = node.source.value
        if (!isCssModuleImport(spec)) continue

        const namedImports: Array<{ imported: string; local: string }> = []
        let bindingName = ''

        for (const s of node.specifiers) {
            if (t.isImportDefaultSpecifier(s)) {
                // import s from './x.module.css'
                bindingName = s.local.name
            } else if (t.isImportNamespaceSpecifier(s)) {
                // import * as s from './x.module.css'
                bindingName = s.local.name
            } else if (t.isImportSpecifier(s)) {
                // import { active } from './x.module.css'
                // import { default as s } from './x.module.css'
                const importedName = t.isIdentifier(s.imported)
                    ? s.imported.name
                    : t.isStringLiteral(s.imported)
                      ? s.imported.value
                      : ''
                if (importedName === 'default') {
                    // `import { default as s } from './x.module.css'`
                    bindingName = s.local.name
                } else {
                    namedImports.push({ imported: importedName, local: s.local.name })
                }
            }
        }

        // If no default/namespace import but we have named imports, use first named local
        // as a synthetic binding name (the resolved object is the module itself)
        if (!bindingName && namedImports.length > 0) {
            bindingName = namedImports[0].local
        }

        if (!bindingName) continue

        results.push({ spec, bindingName, namedImports })
    }

    return results
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve every CSS Modules import in the given source file.
 *
 * SECURITY: The path-traversal check runs BEFORE any I/O for each import.
 * Any import whose absolute path escapes projectRoot returns
 * `failureReason: 'path-outside-project'` immediately.
 */
export async function resolve(input: {
    sourcePath: string
    projectRoot: string
    ast: t.File
}): Promise<CssModulesResolution> {
    const { sourcePath, projectRoot, ast } = input

    // Fix 2 — SECURITY MEDIUM: projectRoot must be absolute.
    // Relative paths like "." silently anchor to process.cwd() which could widen
    // the isOutsideProject gate unexpectedly.
    if (!path.isAbsolute(projectRoot)) {
        throw new Error(
            `cssModulesResolver.resolve: projectRoot must be absolute, got: ${JSON.stringify(projectRoot)}`
        )
    }

    const rawImports = collectCssModuleImports(ast)
    if (rawImports.length === 0) {
        return { sourcePath, imports: [] }
    }

    const resolvedRoot = path.resolve(projectRoot)
    const sourceDir = path.dirname(path.resolve(sourcePath))

    // Canonicalize projectRoot once for the realpath gate (Fix 1).
    // On macOS, /tmp is a symlink to /private/tmp — resolving realpath of the
    // root ensures both sides of isOutsideProject use canonical paths.
    let canonicalRoot: string
    try {
        canonicalRoot = await fs.promises.realpath(resolvedRoot)
    } catch {
        // projectRoot doesn't exist — no imports can be valid
        canonicalRoot = resolvedRoot
    }

    const results: ResolvedCssModuleImport[] = []

    for (const raw of rawImports) {
        const absoluteModulePath = path.resolve(sourceDir, raw.spec)

        // ── SECURITY GATE (synchronous, zero I/O) ────────────────────────────
        if (isOutsideProject(absoluteModulePath, resolvedRoot)) {
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'path-outside-project',
            })
            continue
        }
        // ── END SECURITY GATE ─────────────────────────────────────────────────

        // Fix 1 — SECURITY HIGH: resolve symlinks before reading.
        // path.resolve does NOT follow symlinks. A symlink inside projectRoot
        // pointing outside (e.g. /etc/passwd.module.css) would pass the static
        // isOutsideProject check above, then fs.readFile would follow it and
        // exfiltrate the target. We use realpath to get the canonical path, then
        // re-run isOutsideProject on the real path.
        let realModulePath: string
        try {
            realModulePath = await fs.promises.realpath(absoluteModulePath)
        } catch {
            // File does not exist (or dangling symlink) — report missing-module.
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'module-not-found',
            })
            continue
        }

        // Second traversal gate — now on the real (symlink-resolved) path.
        // Compare against canonicalRoot (also realpath-resolved) so macOS /tmp
        // symlink and similar OS-level symlinks don't produce false positives.
        if (isOutsideProject(realModulePath, canonicalRoot)) {
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'path-outside-project',
            })
            continue
        }

        // Read the canonical path — never the pre-realpath absoluteModulePath.
        let cssContent: string
        try {
            cssContent = await fs.promises.readFile(realModulePath, 'utf8')
        } catch {
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'module-not-found',
            })
            continue
        }

        // Load PostCSS
        const postcss = loadPostcss()
        if (postcss === null) {
            // PostCSS not available — degrade gracefully
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'module-parse-error',
            })
            continue
        }

        // Extract classes — use realModulePath for deterministic scoped name generation.
        const classBindings = extractClassNames(cssContent, realModulePath, postcss)
        if (classBindings === null) {
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'module-parse-error',
            })
            continue
        }

        if (classBindings.length === 0) {
            results.push({
                bindingName: raw.bindingName,
                modulePath: absoluteModulePath,
                classBindings: [],
                namedImports: raw.namedImports,
                resolved: false,
                failureReason: 'no-classes-exported',
            })
            continue
        }

        results.push({
            bindingName: raw.bindingName,
            modulePath: absoluteModulePath,
            classBindings,
            namedImports: raw.namedImports,
            resolved: true,
            failureReason: null,
        })
    }

    return { sourcePath, imports: results }
}

// ── Object-style API (compatible with CssModulesResolver interface) ──────────

export const cssModulesResolver = {
    resolve,
} as const
