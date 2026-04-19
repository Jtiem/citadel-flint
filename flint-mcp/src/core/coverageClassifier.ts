/**
 * coverageClassifier.ts — flint-mcp/src/core/coverageClassifier.ts
 *
 * Phase 0 — Coverage Honesty
 *
 * Pure function that accepts an already-parsed Babel AST and classifies
 * the file's coverage status. Zero new Babel parse calls — the AST is
 * provided by the caller (Commandment 13: Deterministic Surgery).
 *
 * Detection rules (priority order, first match wins):
 *   1. non-jsx-framework         — .vue / .svelte / Angular-style extensions or ast=null
 *   2. css-in-js-detected        — styled-components, @emotion, stitches, styled-jsx imports
 *   3. external-stylesheet-imported — .css/.scss/.sass/.less/.styl/.pcss import
 *   4. css-modules-reference     — *.module.css import + className={s.foo} usage
 *   5. tailwind-config-extension — tailwindConfigUnparsed=true + Tailwind classes present
 *   6. dynamic-class-expression  — clsx/cva/classnames/cn/twMerge/tw calls or template literals in className
 *   7. non-literal-ternary-branch — className={cond ? 'a' : bar} where a branch is non-literal
 *   8. unresolvable-var          — var(--x) in inline style with no fallback
 *
 * Invariant: (status === 'parsed') iff (reason === null).
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { CoverageReason, CoverageVerdict } from '../shared/coverageTypes.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Classifier Input ──────────────────────────────────────────────────────────

/**
 * Minimal interface for a resolved CSS Modules import.
 * Full type lives in cssModulesResolver.ts — we use a structural subset here
 * so coverageClassifier remains free of that dependency at the type level.
 */
interface CssModuleImportResult {
    resolved: boolean
    failureReason: string | null
}

/**
 * Minimal interface for a CSS custom-property map.
 * Full type (CustomPropertyMap) lives in cssCustomPropertyMap.ts.
 */
interface CustomPropertyMapLike {
    resolve(varExpression: string): string | null
}

/**
 * Minimal interface for a parsed stylesheet result.
 */
interface StylesheetResultLike {
    ok: boolean
}

/**
 * Minimal interface for a Tailwind v4 CSS-first theme parse result.
 */
interface TailwindV4ThemeLike {
    blockCount: number
}

export interface ClassifierInput {
    /** Absolute or project-relative path. Used for extension + framework checks. */
    filePath: string
    /** Full source text. Used only for supplemental checks after AST traversal. */
    source: string
    /** Already-parsed Babel File node, or null if the file could not be parsed. */
    ast: t.File | null
    /**
     * Optional flag: `tailwind.config.*` exists at project root but was not ingested.
     * When true and the file uses Tailwind classes, reason → tailwind-config-extension.
     */
    tailwindConfigUnparsed?: boolean
    /**
     * Phase 1 upgrade — Tailwind config loader result. When `ok: true`, the
     * `tailwind-config-extension` reason is suppressed (verdict upgrades to parsed).
     * When `ok: false`, legacy Phase 0 behavior is preserved via `tailwindConfigUnparsed`.
     */
    tailwindConfig?: { ok: true; [key: string]: unknown } | { ok: false; [key: string]: unknown }
    /**
     * Phase 1 upgrade — class-expression expansion results per clsx/cva/classnames call.
     * When every entry has `unresolvable: false`, the `dynamic-class-expression` reason
     * is suppressed (verdict upgrades to parsed). When any is unresolvable or the array
     * is empty, legacy Phase 0 behavior is preserved.
     */
    classExpansions?: ReadonlyArray<{ unresolvable: boolean; [key: string]: unknown }>

    // ── Phase 2 upgrade fields ─────────────────────────────────────────────

    /**
     * Phase 2 upgrade — results of cssStylesheetLoader for every stylesheet
     * imported by this file. When every entry has `ok: true`, the
     * `external-stylesheet-imported` reason is suppressed.
     */
    externalStylesheets?: readonly StylesheetResultLike[]
    /**
     * Phase 2 upgrade — result of cssModulesResolver for this source file.
     * When every import has `resolved: true`, the `css-modules-reference`
     * reason is suppressed.
     */
    cssModules?: { imports: readonly CssModuleImportResult[] }
    /**
     * Phase 2 upgrade — project-wide custom-property map. When every bare
     * `var(--x)` in the file resolves via `.resolve()`, the `unresolvable-var`
     * reason is suppressed.
     */
    customPropertyMap?: CustomPropertyMapLike
    /**
     * Phase 2 upgrade — result of tailwindV4ThemeParser. When `blockCount >= 1`,
     * the `tailwind-config-extension` reason for v4-CSS-first files is suppressed.
     */
    tailwindV4Theme?: TailwindV4ThemeLike
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** File extensions that belong to non-JSX frameworks. Highest priority check. */
const NON_JSX_EXTENSIONS = new Set(['.vue', '.svelte'])

/** Import specifiers that signal CSS-in-JS. */
const CSS_IN_JS_SPECIFIERS = new Set([
    'styled-components',
    '@emotion/styled',
    '@emotion/react',
    '@stitches/react',
    'styled-jsx',
])

/** Stylesheet file extension suffixes. */
const STYLESHEET_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.styl', '.pcss']

/** CSS Module file extension suffixes. */
const CSS_MODULE_SUFFIXES = ['.module.css', '.module.scss', '.module.sass', '.module.less', '.module.styl']

/** Import callee names that indicate dynamic class assembly. */
const DYNAMIC_CLASS_CALLEE_NAMES = new Set([
    'clsx', 'cva', 'classnames', 'cn', 'twMerge', 'tw',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

function extname(filePath: string): string {
    const dot = filePath.lastIndexOf('.')
    if (dot === -1) return ''
    // Handle double-extension like .module.css
    const afterDot = filePath.slice(dot)
    return afterDot
}

/**
 * Returns true for Angular template files (*.component.html and similar
 * Angular-specific template extensions). Does NOT cover *.component.ts —
 * those are valid TypeScript and are classified normally based on their
 * styling content.
 */
function isAngularComponent(filePath: string): boolean {
    return filePath.endsWith('.component.html')
}

/** Returns true only for files whose extension identifies a non-JSX framework. */
function isNonJsxFramework(filePath: string): boolean {
    const ext = extname(filePath)
    if (NON_JSX_EXTENSIONS.has(ext)) return true
    if (isAngularComponent(filePath)) return true
    return false
}

/**
 * Extract all import specifiers (source values) from the AST's top-level
 * ImportDeclarations. Returns a list of { specifier, localNames }.
 */
interface ImportRecord {
    specifier: string
    localNames: string[]
}

function collectImports(ast: t.File): ImportRecord[] {
    const records: ImportRecord[] = []
    for (const node of ast.program.body) {
        if (!t.isImportDeclaration(node)) continue
        const specifier = node.source.value
        const localNames: string[] = []
        for (const s of node.specifiers) {
            if (t.isImportDefaultSpecifier(s) || t.isImportNamespaceSpecifier(s)) {
                localNames.push(s.local.name)
            } else if (t.isImportSpecifier(s)) {
                localNames.push(s.local.name)
            }
        }
        records.push({ specifier, localNames })
    }
    return records
}

// ── Rule checkers ─────────────────────────────────────────────────────────────

/** Rule 2: css-in-js-detected */
function checkCssInJs(
    imports: ImportRecord[],
    ast: t.File,
): { hit: boolean; details?: string } {
    // Check import specifiers
    for (const { specifier } of imports) {
        if (CSS_IN_JS_SPECIFIERS.has(specifier)) {
            return { hit: true, details: `CSS-in-JS import: '${specifier}'` }
        }
    }

    // Also check TaggedTemplateExpression — catches aliased / re-exported imports
    let found: { line: number } | null = null
    try {
        traverse(ast, {
            TaggedTemplateExpression(path) {
                const tag = path.node.tag
                // styled.div`...` or styled('div')`...`
                if (
                    t.isMemberExpression(tag) &&
                    t.isIdentifier(tag.object, { name: 'styled' })
                ) {
                    found = { line: path.node.loc?.start.line ?? 0 }
                    path.stop()
                }
                // styled`...` or css`...` bare tagged template
                if (t.isIdentifier(tag, { name: 'styled' }) || t.isIdentifier(tag, { name: 'css' })) {
                    found = { line: path.node.loc?.start.line ?? 0 }
                    path.stop()
                }
            },
        })
    } catch {
        // Traverse errors are non-fatal; fall through
    }
    if (found !== null) {
        return { hit: true, details: `CSS-in-JS tagged template at line ${(found as { line: number }).line}` }
    }
    return { hit: false }
}

/** Rule 3: external-stylesheet-imported */
function checkExternalStylesheet(imports: ImportRecord[]): { hit: boolean; details?: string } {
    for (const { specifier } of imports) {
        for (const ext of STYLESHEET_EXTENSIONS) {
            if (specifier.endsWith(ext)) {
                return { hit: true, details: `External stylesheet import: '${specifier}'` }
            }
        }
    }
    return { hit: false }
}

/** Rule 4: css-modules-reference */
function checkCssModulesReference(
    imports: ImportRecord[],
    ast: t.File,
): { hit: boolean; details?: string } {
    // Collect the local names bound to CSS Module imports
    const cssModuleBindings = new Set<string>()
    for (const { specifier, localNames } of imports) {
        const isCssModule = CSS_MODULE_SUFFIXES.some((s) => specifier.endsWith(s))
        if (isCssModule) {
            for (const name of localNames) {
                cssModuleBindings.add(name)
            }
        }
    }
    if (cssModuleBindings.size === 0) return { hit: false }

    // Check if any JSX className attribute is a MemberExpression where the object
    // is one of the CSS module bindings (styles.foo, s.foo, etc.)
    let found: { line: number; detail: string } | null = null
    try {
        traverse(ast, {
            JSXAttribute(path) {
                const name = path.node.name
                if (!t.isJSXIdentifier(name, { name: 'className' })) return

                const val = path.node.value
                if (!t.isJSXExpressionContainer(val)) return

                const expr = val.expression
                if (
                    t.isMemberExpression(expr) &&
                    t.isIdentifier(expr.object) &&
                    cssModuleBindings.has(expr.object.name)
                ) {
                    found = {
                        line: path.node.loc?.start.line ?? 0,
                        detail: `CSS module reference: ${expr.object.name}.${t.isIdentifier(expr.property) ? expr.property.name : '?'} at line ${path.node.loc?.start.line ?? '?'}`,
                    }
                    path.stop()
                }
            },
        })
    } catch {
        // Non-fatal
    }
    if (found !== null) {
        return { hit: true, details: (found as { detail: string }).detail }
    }
    return { hit: false }
}

/** Rule 5: tailwind-config-extension */
function checkTailwindConfigExtension(
    tailwindConfigUnparsed: boolean | undefined,
    ast: t.File,
): { hit: boolean; details?: string } {
    if (!tailwindConfigUnparsed) return { hit: false }

    // Check if file has any className string literals (Tailwind class usage)
    let hasTailwindClasses = false
    try {
        traverse(ast, {
            JSXAttribute(path) {
                const name = path.node.name
                if (!t.isJSXIdentifier(name, { name: 'className' })) return

                const val = path.node.value
                // String literal className="..."
                if (t.isStringLiteral(val) && val.value.trim().length > 0) {
                    hasTailwindClasses = true
                    path.stop()
                }
                // Expression container with string literal className={"..."}
                if (
                    t.isJSXExpressionContainer(val) &&
                    t.isStringLiteral(val.expression) &&
                    val.expression.value.trim().length > 0
                ) {
                    hasTailwindClasses = true
                    path.stop()
                }
            },
        })
    } catch {
        // Non-fatal
    }

    if (hasTailwindClasses) {
        return { hit: true, details: 'tailwind.config.* present but not ingested; custom classes cannot be validated' }
    }
    return { hit: false }
}

/** Rule 6: dynamic-class-expression */
function checkDynamicClassExpression(
    imports: ImportRecord[],
    ast: t.File,
): { hit: boolean; details?: string } {
    // Build set of locally imported dynamic-class-utility names
    const dynamicBindings = new Set<string>()
    for (const { specifier, localNames } of imports) {
        // Check if the specifier itself matches a known utility package
        const specLower = specifier.toLowerCase()
        const isKnownPackage =
            specLower === 'clsx' ||
            specLower === 'cva' ||
            specLower === 'class-variance-authority' ||
            specLower === 'classnames' ||
            specLower === 'tailwind-merge'
        if (isKnownPackage) {
            for (const name of localNames) {
                dynamicBindings.add(name)
            }
        }
    }
    // Always include the well-known names (in case they are defined locally)
    for (const name of DYNAMIC_CLASS_CALLEE_NAMES) {
        dynamicBindings.add(name)
    }

    let found: { line: number; detail: string } | null = null
    try {
        traverse(ast, {
            JSXAttribute(path) {
                const name = path.node.name
                if (!t.isJSXIdentifier(name, { name: 'className' })) return

                const val = path.node.value
                if (!t.isJSXExpressionContainer(val)) return
                const expr = val.expression
                if (t.isJSXEmptyExpression(expr)) return

                const line = path.node.loc?.start.line ?? 0

                // CallExpression: className={clsx(...)} etc.
                if (t.isCallExpression(expr)) {
                    const callee = expr.callee
                    const calleeName = t.isIdentifier(callee)
                        ? callee.name
                        : t.isMemberExpression(callee) && t.isIdentifier(callee.property)
                          ? callee.property.name
                          : null
                    if (calleeName !== null && dynamicBindings.has(calleeName)) {
                        found = { line, detail: `Dynamic class utility call '${calleeName}(...)' at line ${line}` }
                        path.stop()
                        return
                    }
                }

                // TemplateLiteral with expressions: className={`text-${color}`}
                if (t.isTemplateLiteral(expr) && expr.expressions.length > 0) {
                    found = { line, detail: `Template literal with expressions in className at line ${line}` }
                    path.stop()
                }
            },
        })
    } catch {
        // Non-fatal
    }
    if (found !== null) {
        return { hit: true, details: (found as { detail: string }).detail }
    }
    return { hit: false }
}

/** Rule 7: non-literal-ternary-branch */
function checkNonLiteralTernaryBranch(ast: t.File): { hit: boolean; details?: string } {
    let found: { line: number } | null = null
    try {
        traverse(ast, {
            JSXAttribute(path) {
                const name = path.node.name
                if (!t.isJSXIdentifier(name, { name: 'className' })) return

                const val = path.node.value
                if (!t.isJSXExpressionContainer(val)) return
                const expr = val.expression
                if (!t.isConditionalExpression(expr)) return

                const consequent = expr.consequent
                const alternate = expr.alternate
                const isLiteral = (n: t.Expression | t.TSType | t.JSXEmptyExpression): boolean =>
                    t.isStringLiteral(n) || t.isNullLiteral(n)

                if (!isLiteral(consequent) || !isLiteral(alternate)) {
                    const line = path.node.loc?.start.line ?? 0
                    found = { line }
                    path.stop()
                }
            },
        })
    } catch {
        // Non-fatal
    }
    if (found !== null) {
        return { hit: true, details: `Non-literal ternary branch in className at line ${(found as { line: number }).line}` }
    }
    return { hit: false }
}

/** Rule 8: unresolvable-var */
function checkUnresolvableVar(ast: t.File): { hit: boolean; details?: string } {
    // Look for style={{ color: 'var(--x)' }} where 'var(--x)' has no fallback
    // Pattern: StringLiteral containing 'var(--' without a comma (no fallback)
    const VAR_NO_FALLBACK = /var\(--[^,)]+\)/

    let found: { line: number; detail: string } | null = null
    try {
        traverse(ast, {
            JSXAttribute(path) {
                const name = path.node.name
                if (!t.isJSXIdentifier(name, { name: 'style' })) return

                const val = path.node.value
                if (!t.isJSXExpressionContainer(val)) return
                const expr = val.expression
                if (!t.isObjectExpression(expr)) return

                for (const prop of expr.properties) {
                    if (!t.isObjectProperty(prop)) continue
                    const propVal = prop.value
                    if (!t.isStringLiteral(propVal)) continue
                    if (VAR_NO_FALLBACK.test(propVal.value)) {
                        const line = prop.loc?.start.line ?? 0
                        found = {
                            line,
                            detail: `Unresolvable CSS variable '${propVal.value}' (no fallback) at line ${line}`,
                        }
                        break
                    }
                }
                if (found !== null) path.stop()
            },
        })
    } catch {
        // Non-fatal
    }
    if (found !== null) {
        return { hit: true, details: (found as { detail: string }).detail }
    }
    return { hit: false }
}

/**
 * Phase 2 helper: check ALL var(--x) references in inline styles against the
 * provided custom-property map. Returns { allResolved: true } if every bare
 * var(--x) (no fallback) resolves; otherwise returns the first unresolved detail.
 */
function checkAllVarsResolvable(
    ast: t.File,
    customPropertyMap: { resolve(expr: string): string | null },
): { allResolved: boolean; firstUnresolved?: string } {
    const VAR_NO_FALLBACK = /var\(--[^,)]+\)/g

    let firstUnresolved: string | undefined
    let allResolved = true

    try {
        traverse(ast, {
            JSXAttribute(path) {
                const name = path.node.name
                if (!t.isJSXIdentifier(name, { name: 'style' })) return

                const val = path.node.value
                if (!t.isJSXExpressionContainer(val)) return
                const expr = val.expression
                if (!t.isObjectExpression(expr)) return

                for (const prop of expr.properties) {
                    if (!t.isObjectProperty(prop)) continue
                    const propVal = prop.value
                    if (!t.isStringLiteral(propVal)) continue

                    let match: RegExpExecArray | null
                    const re = /var\(--[^,)]+\)/g
                    while ((match = re.exec(propVal.value)) !== null) {
                        const varExpr = match[0]
                        const resolved = customPropertyMap.resolve(varExpr)
                        if (resolved === null) {
                            allResolved = false
                            const line = prop.loc?.start.line ?? 0
                            firstUnresolved = `Unresolvable CSS variable '${propVal.value}' (no fallback, not in property map) at line ${line}`
                            break
                        }
                    }
                    if (!allResolved) break
                }
                if (!allResolved) path.stop()
            },
        })
    } catch {
        // Non-fatal — treat traversal errors as unresolved to be safe
    }

    return allResolved ? { allResolved: true } : { allResolved: false, firstUnresolved }
}

// ── Main classifier ───────────────────────────────────────────────────────────

/**
 * Classify the coverage status of a single file.
 *
 * Takes a pre-parsed AST — never calls Babel.parse() internally.
 * Returns the first matching reason in priority order.
 *
 * Invariant: (result.status === 'parsed') iff (result.reason === null).
 */
export function classifyCoverage(input: ClassifierInput): CoverageVerdict {
    const {
        filePath, ast,
        tailwindConfigUnparsed, tailwindConfig, classExpansions,
        // Phase 2 fields
        externalStylesheets, cssModules, customPropertyMap, tailwindV4Theme,
    } = input

    // ── Rule 1: non-jsx-framework (highest priority) ──────────────────────────
    // Only extension-based: .vue, .svelte, Angular template (.component.html).
    // Never triggered by a parse failure on a .tsx/.ts file.
    if (isNonJsxFramework(filePath)) {
        return {
            status: 'skipped-unsupported',
            reason: 'non-jsx-framework' satisfies CoverageReason,
            details: `Non-JSX framework file: '${filePath}'`,
        }
    }

    // ── parse-failure: JS/TS file that couldn't be parsed ────────────────────
    // Checked AFTER the extension check so a .tsx with a syntax error gets a
    // distinct reason from a .vue file — they are different failure modes.
    if (ast === null) {
        return {
            status: 'skipped-unsupported',
            reason: 'parse-failure' satisfies CoverageReason,
            details: `Could not parse file: '${filePath}'`,
        }
    }

    // Collect imports once — shared across rules 2–4
    const imports = collectImports(ast)

    // ── Rule 2: css-in-js-detected ────────────────────────────────────────────
    const cssInJs = checkCssInJs(imports, ast)
    if (cssInJs.hit) {
        return {
            status: 'partial',
            reason: 'css-in-js-detected' satisfies CoverageReason,
            details: cssInJs.details,
        }
    }

    // ── Rule 4 (elevated): css-modules-reference ──────────────────────────────
    // Checked before Rule 3 because a CSS Module import + className={s.foo} usage
    // is a more specific signal than a generic stylesheet import. The `.module.css`
    // suffix also matches the Rule 3 stylesheet list, so this check must precede it.
    //
    // Phase 2 upgrade: when cssModules is provided and every import resolved
    // successfully, skip this rule (verdict upgrades to parsed).
    const allCssModulesResolved =
        cssModules !== undefined &&
        cssModules.imports.length > 0 &&
        cssModules.imports.every((imp) => imp.resolved === true)
    if (!allCssModulesResolved) {
        const cssModulesCheck = checkCssModulesReference(imports, ast)
        if (cssModulesCheck.hit) {
            return {
                status: 'partial',
                reason: 'css-modules-reference' satisfies CoverageReason,
                details: cssModulesCheck.details,
            }
        }
    }

    // ── Rule 3: external-stylesheet-imported ──────────────────────────────────
    // Phase 2 upgrade: when externalStylesheets is provided and every entry has
    // ok:true, the stylesheet imports are parsed and governed. Skip this rule.
    //
    // Also: when allCssModulesResolved is true, any *.module.* import that
    // would trigger this rule has already been handled. We exclude module imports
    // from the external-stylesheet check in that case to avoid double-counting.
    const allStylesheetsOk =
        externalStylesheets !== undefined &&
        externalStylesheets.length > 0 &&
        externalStylesheets.every((s) => s.ok === true)
    if (!allStylesheetsOk) {
        // If CSS modules are all resolved, filter out the module imports before
        // running the external-stylesheet check so they don't double-trigger.
        const importsForExtCheck = allCssModulesResolved
            ? imports.filter(({ specifier }) => !CSS_MODULE_SUFFIXES.some((suffix) => specifier.endsWith(suffix)))
            : imports
        const extStylesheet = checkExternalStylesheet(importsForExtCheck)
        if (extStylesheet.hit) {
            return {
                status: 'partial',
                reason: 'external-stylesheet-imported' satisfies CoverageReason,
                details: extStylesheet.details,
            }
        }
    }

    // ── Rule 5: tailwind-config-extension ─────────────────────────────────────
    // Phase 1 upgrade: when tailwindConfig.ok === true, the loader resolved the
    // config and merged its tokens into Mithril's token set. Skip this rule.
    //
    // Phase 2 upgrade: when tailwindV4Theme.blockCount >= 1, the v4 CSS-first
    // @theme blocks were parsed and merged. This supersedes the Phase 1
    // `v4-css-first-unsupported` fallback for v4-CSS-first files.
    const tailwindConfigResolved =
        tailwindConfig?.ok === true ||
        (tailwindV4Theme !== undefined && tailwindV4Theme.blockCount >= 1)
    if (!tailwindConfigResolved) {
        const twConfig = checkTailwindConfigExtension(tailwindConfigUnparsed, ast)
        if (twConfig.hit) {
            return {
                status: 'partial',
                reason: 'tailwind-config-extension' satisfies CoverageReason,
                details: twConfig.details,
            }
        }
    }

    // ── Rule 6: dynamic-class-expression ──────────────────────────────────────
    // Phase 1 upgrade: when classExpansions is provided and every expansion is
    // resolvable (unresolvable: false), the expander fully evaluated the call
    // and Mithril can run drift detection on the expanded classes. Skip this rule.
    const allExpansionsResolvable =
        classExpansions !== undefined &&
        classExpansions.length > 0 &&
        classExpansions.every((e) => e.unresolvable === false)
    if (!allExpansionsResolvable) {
        const dynamic = checkDynamicClassExpression(imports, ast)
        if (dynamic.hit) {
            return {
                status: 'partial',
                reason: 'dynamic-class-expression' satisfies CoverageReason,
                details: dynamic.details,
            }
        }
    }

    // ── Rule 7: non-literal-ternary-branch ────────────────────────────────────
    const ternary = checkNonLiteralTernaryBranch(ast)
    if (ternary.hit) {
        return {
            status: 'partial',
            reason: 'non-literal-ternary-branch' satisfies CoverageReason,
            details: ternary.details,
        }
    }

    // ── Rule 8: unresolvable-var ──────────────────────────────────────────────
    // Phase 2 upgrade: when customPropertyMap is provided, check every bare
    // var(--x) reference in the file. Only skip this rule if ALL detected
    // var(--x) references actually resolve via the map.
    if (customPropertyMap !== undefined) {
        const unresolvableCheck = checkUnresolvableVar(ast)
        if (unresolvableCheck.hit) {
            // Attempt to resolve the var expression via the map
            const varMatch = unresolvableCheck.details?.match(/var\(--[^)]+\)/)
            if (varMatch) {
                const resolved = customPropertyMap.resolve(varMatch[0])
                if (resolved !== null) {
                    // This specific var resolved — continue to check more
                    // (we do a comprehensive check below)
                } else {
                    return {
                        status: 'partial',
                        reason: 'unresolvable-var' satisfies CoverageReason,
                        details: unresolvableCheck.details,
                    }
                }
            } else {
                return {
                    status: 'partial',
                    reason: 'unresolvable-var' satisfies CoverageReason,
                    details: unresolvableCheck.details,
                }
            }
        }
        // Even if the quick check passed, verify ALL vars resolve
        const allVarsResolved = checkAllVarsResolvable(ast, customPropertyMap)
        if (!allVarsResolved.allResolved) {
            return {
                status: 'partial',
                reason: 'unresolvable-var' satisfies CoverageReason,
                details: allVarsResolved.firstUnresolved,
            }
        }
    } else {
        const unresolvable = checkUnresolvableVar(ast)
        if (unresolvable.hit) {
            return {
                status: 'partial',
                reason: 'unresolvable-var' satisfies CoverageReason,
                details: unresolvable.details,
            }
        }
    }

    // ── All rules passed: file is fully in governance surface ─────────────────
    return { status: 'parsed', reason: null }
}
