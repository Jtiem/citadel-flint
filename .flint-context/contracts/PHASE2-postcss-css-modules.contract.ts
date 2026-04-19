/**
 * PHASE 2 — PostCSS Parser + CSS Modules + Tailwind v4 CSS-First
 *
 * Executable contract. Phase 2 agents import types directly from this file.
 * Phase 1.5 (flint-contract-linter) validates this compiles and its CONTRACT
 * constant satisfies contract-schema v2 (audience, falsifiable invariants,
 * executable given/when/then, IPC validators, non-empty nonGoals).
 *
 * Purpose of Phase 2:
 *   Close the four remaining styling coverage reasons that still silently
 *   skip real code in mainstream React projects. Phase 0 made coverage
 *   honest; Phase 1 closed Tailwind configs + class composition. Phase 2
 *   makes Flint READ CSS:
 *     1. `external-stylesheet-imported` — PostCSS parses `.css`/`.scss`/
 *        `.module.css` imports and extracts custom properties + `@theme`.
 *     2. `css-modules-reference` — postcss-modules resolves
 *        `import s from './x.module.css'; <div className={s.active}>`
 *        to the literal class `active` so Mithril can lint it.
 *     3. `unresolvable-var` — `var(--primary)` (no fallback) resolves via
 *        the project-wide customPropertyMap built from `:root` blocks.
 *     4. `tailwind-config-extension` (v4 CSS-first) — Tailwind v4's
 *        `@theme { --color-primary: #0066cc; }` blocks feed the same
 *        ResolvedTailwindTheme pipeline Phase 1 built for JS configs.
 *
 *   Phase 2 adds four pure services to flint-mcp/src/core/:
 *     - cssStylesheetLoader      — PostCSS parse + custom property / @theme /
 *       keyframe extraction. mtime cache. Graceful failure on malformed CSS.
 *     - cssModulesResolver       — Map<ImportBinding, Map<class, scopedClass>>
 *       for every `*.module.css` imported by a source file.
 *     - cssCustomPropertyMap     — Project-wide Map<`--name`, value> merged
 *       from every imported stylesheet, with fallback-chain walking.
 *     - tailwindV4ThemeParser    — Parse `@theme {}` blocks into the EXACT
 *       same ResolvedTailwindTheme shape Phase 1's JS-config loader produces.
 *
 *   coverageClassifier upgrades all four reasons to `parsed` when the new
 *   services resolve successfully. MithrilLinter integrates without breaking
 *   its existing callers (auditAll signature stability — Phase 1 non-goal
 *   still binding).
 *
 * What Phase 2 is NOT:
 *   - Not parsing CSS-in-JS tagged template bodies (Phase 3).
 *   - Not parsing Vue `<style>` / Svelte `<style>` / Angular component styles (Phase 4).
 *   - Not executing SCSS `@mixin` / `@function` / `$variable` logic.
 *   - Not transitively resolving cross-stylesheet `@import` (out of scope).
 *   - Not parsing HTML `<style>` tags.
 *   - Not auto-fixing newly-exposed stylesheet drift.
 *   - Not modifying the debt grade formula.
 *   - Not touching Glass UI. Zero IPC channels. Zero MCP tools added.
 */

import type { FlintContract } from '../../shared/contract-schema'

// ─────────────────────────────────────────────────────────────────────
// cssStylesheetLoader — PostCSS parse + extraction
// ─────────────────────────────────────────────────────────────────────

/**
 * Supported stylesheet syntaxes. Mapped to PostCSS syntax plugins:
 *   css / pcss  → PostCSS default
 *   scss        → postcss-scss
 *   sass        → postcss-scss (indented fallback — limited)
 *   less        → postcss-less IF installed; otherwise default PostCSS with
 *                 best-effort extraction. Less-specific constructs are skipped.
 *
 * Module variants (`*.module.css` etc.) are parsed as their base syntax;
 * module-scoped class name extraction happens in cssModulesResolver.
 */
export type StylesheetSyntax = 'css' | 'scss' | 'sass' | 'less' | 'pcss'

/**
 * One custom-property declaration captured from a `:root`-scoped block.
 *
 * `selector` records which selector the property was declared under. Phase 2
 * only captures properties whose selector is one of:
 *   - `:root`
 *   - `:where(:root)` / `:is(:root)`
 *   - any selector inside `@layer base { :root { ... } }`
 *   - `html` (treated as equivalent to `:root` for property resolution)
 * Properties declared under component selectors (e.g. `.button { --x: ... }`)
 * are NOT captured in Phase 2 — they are locally scoped and not resolvable
 * from inline-style `var(--x)` references at a distance.
 */
export interface CustomPropertyDeclaration {
    /** Property name including the leading `--` (e.g. `--primary`). */
    name: string
    /** Resolved string value exactly as written in CSS (e.g. `#0066cc`, `hsl(210, 80%, 40%)`). */
    value: string
    /** Selector the declaration appeared under (e.g. `:root`, `html`). */
    selector: string
    /** 1-based line number of the declaration inside the stylesheet. */
    line: number
}

/**
 * A single `@theme { ... }` block captured from a Tailwind v4 CSS-first config.
 *
 * The shape intentionally mirrors the subset of ResolvedTailwindTheme.sections
 * Phase 1 produced for JS configs, so MithrilLinter's token merger is
 * source-agnostic.
 */
export interface TailwindV4ThemeBlock {
    /** Raw `--color-primary: #0066cc;` pairs extracted from the `@theme` block. */
    rawDeclarations: ReadonlyArray<{ name: string; value: string; line: number }>
    /**
     * Normalized sections. Section keys MUST match the Phase 1
     * `ResolvedTailwindThemeSection` union so the downstream merge is a
     * spread, not a translation. Keys absent from the block are omitted.
     * Flat map shape: `{ "primary.500": "#0066cc" }`.
     */
    sections: Partial<Record<
        'colors' | 'spacing' | 'fontFamily' | 'fontSize' | 'fontWeight' |
        'lineHeight' | 'letterSpacing' | 'boxShadow' | 'borderRadius' |
        'opacity' | 'zIndex',
        Record<string, string>
    >>
    /** Starting line of the `@theme {` block inside the stylesheet. */
    startLine: number
}

/**
 * Keyframe names declared at the top level of the stylesheet via `@keyframes`.
 * Nice-to-have — captured for future animation-token linting. Phase 2
 * consumers may ignore this field.
 */
export interface KeyframeDeclaration {
    name: string
    line: number
}

/**
 * Result of parsing a single stylesheet file.
 *
 * This is the authoritative product of cssStylesheetLoader. All downstream
 * services (cssCustomPropertyMap, cssModulesResolver, tailwindV4ThemeParser)
 * read from this shape; none of them re-parse the file.
 */
export interface ParsedStylesheet {
    /** Absolute filesystem path of the parsed stylesheet. */
    sourcePath: string
    /** Detected syntax dialect. */
    syntax: StylesheetSyntax
    /** mtimeMs of sourcePath at load time — used for cache invalidation. */
    mtimeMs: number
    /** Custom properties declared under `:root`-equivalent selectors. */
    customProperties: readonly CustomPropertyDeclaration[]
    /**
     * `@theme {}` blocks (Tailwind v4 CSS-first). Empty array when not a
     * Tailwind v4 source or the file contains no @theme block.
     */
    themeBlocks: readonly TailwindV4ThemeBlock[]
    /** Top-level `@keyframes` declarations. */
    keyframes: readonly KeyframeDeclaration[]
    /**
     * `@apply` directives found in the stylesheet, as (selector, applied-classes)
     * pairs. Optional signal for future work; Phase 2 does not consume it but
     * the loader exposes it because the PostCSS walk is already free.
     */
    applyDirectives: readonly { selector: string; classes: readonly string[]; line: number }[]
}

/** Why a stylesheet could not be parsed. */
export type StylesheetLoadError =
    | 'file-not-found'
    | 'parse-error'           // PostCSS threw (malformed CSS, unterminated block)
    | 'unsupported-syntax'    // Loader could not select a syntax plugin
    | 'too-large'             // File exceeded hard size cap (see invariant)
    | 'unknown'

/** Result shape from cssStylesheetLoader.load(). */
export type StylesheetLoadResult =
    | { ok: true; stylesheet: ParsedStylesheet }
    | { ok: false; error: StylesheetLoadError; details: string; sourcePath: string }

/**
 * Public API of cssStylesheetLoader.ts.
 *
 * Stateless from the caller's perspective — internal mtime cache is keyed on
 * absolute path so parallel audits reuse a single parse per stylesheet.
 * Pure parsing: no JS execution, no eval, no `vm`. PostCSS is a pure AST walker.
 */
export interface CssStylesheetLoader {
    /**
     * Load + parse a stylesheet file.
     * Returns `{ ok: false, error: 'file-not-found' }` when the file is missing.
     * Returns `{ ok: false, error: 'parse-error' }` on malformed CSS — does NOT throw.
     *
     * Cache: returns the previous result if mtimeMs is unchanged.
     */
    load(absolutePath: string): Promise<StylesheetLoadResult>
    /** Clear the mtime cache for a single file (test helper). */
    invalidate(absolutePath: string): void
    /** Clear the mtime cache for all files (test helper). */
    reset(): void
}

// ─────────────────────────────────────────────────────────────────────
// cssCustomPropertyMap — project-wide :root property resolver
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolved custom-property map for a project or a single source file's
 * transitively imported stylesheets.
 *
 * The map is a flat `Map<propertyName, resolvedValue>` where:
 *   - `propertyName` INCLUDES the leading `--` (key: `--primary`, not `primary`).
 *   - `resolvedValue` is the final string after walking `var(--a, var(--b, <lit>))`
 *     chains WITHIN the map. External-chain (cross-stylesheet `@import`) is
 *     explicitly out of scope (nonGoals #2).
 *
 * Conflict resolution: when the same `--name` is declared by multiple
 * imported stylesheets, the LAST-imported value wins (matches CSS cascade
 * behavior for later `<link>` / `@import` order). Imports that appear
 * earlier in the source file's import graph are considered "earlier".
 */
export interface CustomPropertyMap {
    /** Flat resolved map. Readonly for consumers. */
    readonly map: ReadonlyMap<string, string>
    /**
     * Resolve `var(--x)` (with or without fallback) against the map.
     * Walks fallback chains: `var(--a, var(--b, #0000ff))` returns `#0000ff`
     * when neither `--a` nor `--b` is in the map; returns map value when hit.
     *
     * Returns null when nothing resolves (neither the map nor the fallback chain).
     */
    resolve(varExpression: string): string | null
    /** Origin stylesheet paths that contributed declarations (for diagnostics). */
    readonly sourcePaths: readonly string[]
}

/**
 * Input to customPropertyMap builder. Consumers pass the list of
 * stylesheets imported (directly, not transitively) by the source file
 * being audited, plus any project-wide "always on" stylesheets (e.g.
 * a globally-imported `src/index.css`).
 */
export interface CustomPropertyMapInput {
    /** Parsed stylesheets in import order (earlier = lower precedence). */
    stylesheets: readonly ParsedStylesheet[]
}

export interface CustomPropertyMapBuilder {
    /** Merge `:root` declarations across stylesheets into a single map. */
    build(input: CustomPropertyMapInput): CustomPropertyMap
}

// ─────────────────────────────────────────────────────────────────────
// cssModulesResolver — className={s.active} → literal class strings
// ─────────────────────────────────────────────────────────────────────

/**
 * A resolved CSS Modules mapping for one import statement.
 *
 * `localClassName` is the developer-facing name (the key in the exported map:
 * `s.active` → `'active'`). `scopedClassName` is the generated bundler-scoped
 * name (e.g. `_Button_active_x7f`) as produced by postcss-modules.
 *
 * Mithril's drift detection uses `localClassName` because that is the name the
 * user intends; `scopedClassName` is preserved for future cross-file
 * correlation (e.g. when we report "this class in Button.module.css is unused").
 */
export interface CssModuleClassBinding {
    localClassName: string
    scopedClassName: string
    /** 1-based line in the .module.css file where the class selector appears. */
    line: number
}

/**
 * A resolved CSS Modules import:
 *   `import s from './Button.module.css'`   →   bindingName: 's'
 *   `import * as s from './Button.module.css'` →  bindingName: 's'
 *   `import { active } from './Button.module.css'` → bindingName of the
 *     ImportSpecifier ('active'); see `namedImports` below.
 */
export interface ResolvedCssModuleImport {
    /** Local import binding name in the source file. */
    bindingName: string
    /** Absolute path of the resolved .module.css file. */
    modulePath: string
    /** Class bindings exported by the module (empty when the module fails to parse). */
    classBindings: readonly CssModuleClassBinding[]
    /**
     * Named imports from the module:
     *   `import { active, disabled } from './x.module.css'`
     *   → [{ imported: 'active', local: 'active' }, ...]
     * Empty for default or namespace imports.
     */
    namedImports: readonly { imported: string; local: string }[]
    /** True when resolution succeeded fully (file found + parsed + at least one class). */
    resolved: boolean
    /** Why resolution failed. Null when `resolved: true`. */
    failureReason:
        | 'module-not-found'
        | 'module-parse-error'
        | 'no-classes-exported'
        | 'path-outside-project'   // SECURITY: resolved path escapes projectRoot
        | null
}

/**
 * Output of cssModulesResolver for a single source file.
 *
 * The map is keyed by the LOCAL import binding name (e.g. 's', 'styles').
 * Name-mangling options from the user's PostCSS config are NOT honored in
 * Phase 2 — we emit the post-mangling scoped names that postcss-modules
 * would produce with default `generateScopedName: '[name]__[local]___[hash:base64:5]'`.
 * Users who run a custom generator will still see correct `localClassName`
 * lookups (which is what Mithril needs); only `scopedClassName` may differ
 * from their bundler output.
 */
export interface CssModulesResolution {
    /** Source file whose imports were resolved. */
    sourcePath: string
    /** One entry per `import ... from '*.module.css'` statement. */
    imports: readonly ResolvedCssModuleImport[]
}

export interface CssModulesResolver {
    /**
     * Resolve every CSS Modules import in the given source file.
     *
     * Reads ImportDeclarations from the pre-parsed Babel AST (no re-parse).
     * For each `*.module.*` import, loads the referenced stylesheet via
     * cssStylesheetLoader and emits the class-binding map.
     *
     * Missing modules and parse errors degrade gracefully — the ResolvedCssModuleImport
     * reports `resolved: false` and a reason; the classifier keeps
     * `css-modules-reference` as the coverage reason for that source file.
     *
     * SECURITY: `projectRoot` bounds path-traversal. Any import whose
     * `path.resolve(dirname(sourcePath), spec)` falls OUTSIDE `projectRoot`
     * (as detected by a `path.relative(projectRoot, resolved).startsWith('..')`
     * check) fails with `failureReason: 'path-outside-project'` and the
     * referenced file is NOT read from disk.
     */
    resolve(input: {
        sourcePath: string
        projectRoot: string
        ast: import('@babel/types').File
    }): Promise<CssModulesResolution>
}

// ─────────────────────────────────────────────────────────────────────
// tailwindV4ThemeParser — @theme {} → ResolvedTailwindTheme
// ─────────────────────────────────────────────────────────────────────

/**
 * Output of the v4 CSS-first theme parser.
 *
 * The result is MERGE-COMPATIBLE with Phase 1's ResolvedTailwindTheme. The
 * consumer (MithrilLinter) does not distinguish between a theme produced
 * from `tailwind.config.ts` (Phase 1) and a theme produced from
 * `@theme { --color-primary: ... }` (Phase 2). Both feed the same token
 * normalizer; both contribute knownClasses to drift detection.
 *
 * When BOTH sources exist in a project, the merge order is:
 *   1. v3/v4-JS config (Phase 1's tailwindConfigLoader) — base.
 *   2. v4 CSS `@theme` blocks — overlay (last-declared wins).
 * This matches Tailwind v4's own runtime behavior.
 */
export interface TailwindV4ThemeParseResult {
    /** Source CSS file that provided the @theme block(s). */
    sourcePath: string
    /**
     * Merged sections across all @theme blocks in the stylesheet.
     * Shape identical to Phase 1's `ResolvedTailwindTheme.sections`.
     */
    sections: Partial<Record<
        'colors' | 'spacing' | 'fontFamily' | 'fontSize' | 'fontWeight' |
        'lineHeight' | 'letterSpacing' | 'boxShadow' | 'borderRadius' |
        'opacity' | 'zIndex',
        Record<string, string>
    >>
    /**
     * Precomputed known-class set derived from the parsed theme. Mirrors
     * Phase 1's `knownClasses` contract: membership implies "not drift".
     */
    knownClasses: ReadonlySet<string>
    /** Count of @theme blocks merged. 0 means the parser was called on a stylesheet that had none. */
    blockCount: number
}

export interface TailwindV4ThemeParser {
    /**
     * Parse `@theme { ... }` blocks from an already-parsed ParsedStylesheet.
     * Returns an empty-sections result (blockCount: 0) when the stylesheet
     * contains no @theme blocks — callers MUST check blockCount before
     * merging into the audit pipeline.
     */
    parse(stylesheet: ParsedStylesheet): TailwindV4ThemeParseResult
}

// ─────────────────────────────────────────────────────────────────────
// coverageClassifier upgrade — Phase 2 additive inputs
// ─────────────────────────────────────────────────────────────────────

/**
 * Additive ClassifierInput fields (Phase 2). The Phase 0 + Phase 1 field set
 * is preserved unchanged. When any of these are provided, the matching
 * coverage reason upgrades from `partial` to `parsed`.
 *
 * Contract stability: consumers that do not pass these fields behave exactly
 * as before Phase 2 — all existing classifier tests remain green unmodified.
 */
export interface ClassifierInputV3 {
    /**
     * Result of cssStylesheetLoader for every stylesheet imported by the file.
     * When every referenced `.css`/`.scss`/`.module.css` import returns `ok: true`,
     * `external-stylesheet-imported` upgrades to `parsed`.
     */
    externalStylesheets?: readonly StylesheetLoadResult[]
    /**
     * Result of cssModulesResolver for this source file. When every CSS Module
     * import resolves (`resolved: true`) AND every `s.className` reference
     * matches a known localClassName, `css-modules-reference` upgrades to `parsed`.
     */
    cssModules?: CssModulesResolution
    /**
     * Project-wide custom-property map built from all imported stylesheets.
     * When every bare `var(--x)` reference in this file resolves via `.resolve()`,
     * `unresolvable-var` upgrades to `parsed`.
     */
    customPropertyMap?: CustomPropertyMap
    /**
     * Result of tailwindV4ThemeParser for this project's primary CSS file.
     * When `blockCount >= 1`, the Phase 1 `v4-css-first-unsupported` fallback
     * is overridden and `tailwind-config-extension` upgrades to `parsed`.
     */
    tailwindV4Theme?: TailwindV4ThemeParseResult
}

// ─────────────────────────────────────────────────────────────────────
// MithrilLinter integration — additive AuditAllOptions fields
// ─────────────────────────────────────────────────────────────────────

/**
 * Additive fields appended to `AuditAllOptions` (Phase 2). The existing
 * signature is unchanged — Phase 1 non-goal "do not modify `auditAll`
 * signature" remains binding.
 *
 * Interaction with Phase 1:
 *   - `tailwindTheme` is reused (not re-declared). When both a Phase 1 JS
 *     config and a Phase 2 @theme block are available, the caller builds
 *     the merged theme BEFORE invoking auditAll and passes the single result.
 *   - `classExpansions` (Phase 1) remains independent.
 */
export interface AuditAllOptionsV3Additive {
    /**
     * Custom-property map built from imported stylesheets. When provided,
     * Mithril's existing `parseCssColorToHex(var(--x))` path consults this
     * map for bare references (no fallback). Drift detection then runs
     * against the resolved value as if it were an inline literal.
     */
    customPropertyMap?: CustomPropertyMap
    /**
     * CSS Modules resolution for this source file. When provided, Mithril's
     * className extractor treats `<div className={s.active}>` as if the
     * source wrote `className="active"` — enabling drift detection on the
     * local class name.
     */
    cssModulesMaps?: CssModulesResolution
    /**
     * NOTE on tailwindTheme: Phase 2 does NOT introduce a new field for
     * v4 CSS-first themes. Callers pre-merge v4 `@theme` into the existing
     * `tailwindTheme` (Phase 1 shape) before invoking auditAll.
     *
     * This preserves the Phase 1 type while letting Phase 2 unlock new
     * coverage. See tailwindV4ThemeParser contract for the merge rule.
     */
}

// ─────────────────────────────────────────────────────────────────────
// Machine-Readable Contract
// ─────────────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'PHASE2-PostCSS-CSSModules-TailwindV4',
        phase: 'PHASE2',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-18',
        audience: 'engine',
    },
    impact: [
        {
            file: 'flint-mcp/src/core/cssStylesheetLoader.ts',
            changeType: 'CREATE',
            owner: 'flint-mcp-specialist',
            summary:
                'PostCSS-based parser for .css/.scss/.sass/.less/.pcss/.module.* files. Extracts :root custom properties, @theme blocks, @keyframes, @apply directives. mtime cache. Graceful parse-error handling — never throws. Pure parsing, zero JS execution.',
        },
        {
            file: 'flint-mcp/src/core/cssCustomPropertyMap.ts',
            changeType: 'CREATE',
            owner: 'flint-mcp-specialist',
            summary:
                'Builds a project-wide Map<`--name`, value> from a list of ParsedStylesheets. Walks `var(--a, var(--b, <lit>))` fallback chains within the map. Last-import-wins on conflicts. Ships with a `.resolve(expr)` helper that MithrilLinter consumes.',
        },
        {
            file: 'flint-mcp/src/core/cssModulesResolver.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Walks ImportDeclarations from a pre-parsed Babel AST, resolves each *.module.* import via postcss-modules (or manual scoped-class extraction), returns CssModulesResolution with per-import localClassName → scopedClassName maps. Missing / malformed modules degrade to `resolved: false`.',
        },
        {
            file: 'flint-mcp/src/core/tailwindV4ThemeParser.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Walks a ParsedStylesheet.themeBlocks array and normalizes @theme {} declarations into the Phase 1 ResolvedTailwindTheme.sections shape. Emits a knownClasses set so MithrilLinter drift detection treats v4 CSS-first themes identically to JS configs.',
        },
        {
            file: 'flint-mcp/src/core/coverageClassifier.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Accept new optional inputs from ClassifierInputV3: externalStylesheets, cssModules, customPropertyMap, tailwindV4Theme. When each resolves fully, the matching partial reason upgrades to `parsed`. Phase 0 + Phase 1 upgrade paths are preserved (no regression).',
        },
        {
            file: 'flint-mcp/src/core/MithrilLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary:
                'Append optional customPropertyMap + cssModulesMaps to AuditAllOptions (additive only — signature preserved). Extend parseCssColorToHex to consult customPropertyMap for bare var(--x). Extend className extraction to treat `s.active` member-expressions as literal class strings when cssModulesMaps is present.',
        },
        {
            file: 'flint-mcp/package.json',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary:
                'Add runtime dependencies: `postcss` (^8.4.0), `postcss-scss` (^4.0.0), `postcss-modules` (^6.0.0). All well-audited pure-JS parsers. Confirm bundle size delta < 3MB in PR review.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/cssStylesheetLoader.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Unit suite: plain CSS, SCSS, CSS Modules variant, malformed CSS → parse-error (no throw), missing file → file-not-found, :root extraction, @layer base { :root }, @theme block capture, @keyframes capture, non-root declarations ignored, mtime cache round-trip, too-large file cap.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/cssStylesheetLoader.bench.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'vitest bench: 50 consecutive loads of a 10KB design-token CSS file on a cold cache; 1000 cached loads for the cache-hit invariant.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/cssCustomPropertyMap.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Unit suite: single-file map, multi-file merge with last-wins, chained fallback `var(--a, var(--b, #0000ff))`, unresolvable chain returns null, empty input → empty map. Build-time perf assertion (< 50ms per stylesheet at p95).',
        },
        {
            file: 'flint-mcp/src/core/__tests__/cssModulesResolver.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Fidelity suite against a 20-fixture CSS Modules corpus: default-import, namespace-import, named-import, nested directory, scss module, missing module, parse error, no classes exported, kebab-case class, duplicate class, non-module CSS filename, import from alias path (alias not resolved → skip gracefully).',
        },
        {
            file: 'flint-mcp/src/core/__tests__/fixtures/css-modules/',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                '20-fixture corpus of .module.css + consumer .tsx pairs covering every resolver edge case. Each fixture includes `expected.json` describing the expected CssModulesResolution output. Must include ≥ 20 fixtures for the fidelity invariant.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/tailwindV4ThemeParser.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Unit suite: basic @theme with color + spacing, @theme with dark variants, empty @theme, multiple @theme blocks in one file merged, @theme inside @layer, malformed @theme gracefully returns blockCount 0.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/coverageClassifier.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary:
                'Add Phase 2 upgrade cases: resolvable externalStylesheets flip external-stylesheet-imported → parsed; resolved cssModules flip css-modules-reference → parsed; customPropertyMap resolves `var(--primary)` and flips unresolvable-var → parsed; tailwindV4Theme with blockCount ≥ 1 flips tailwind-config-extension → parsed (overriding Phase 1 v4-css-first-unsupported). Each upgrade also has a NEGATIVE case (failed resolve → partial preserved).',
        },
        {
            file: 'flint-mcp/src/core/__tests__/MithrilLinter.css-integration.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Integration: var(--primary) resolves via customPropertyMap to a drift-y hex → MITHRIL-IST-COL fires; var(--primary) resolves to a token-matching hex → no warning; `s.active` via cssModulesMaps is linted as class string "active"; auditAll signature unchanged (46 existing call sites unmodified).',
        },
    ],
    // Phase 2 is MCP-engine-only. Zero IPC channels, zero Glass UI, zero
    // preload changes. Coverage % updates automatically via Phase 0's pipeline.
    ipc: [],
    stores: [],
    components: [],
    commandments: [
        // C2  — No Hallucinated Styling: v4 @theme tokens + resolved custom
        //       properties become legitimate drift-free values, closing a
        //       false-negative gap.
        2,
        // C8  — Audit-First Execution: stylesheet parse is an audit step
        //       before any linter runs; mtime cache avoids redundant work.
        8,
        // C9  — CIEDE2000 ΔE Logic: resolved custom-property + v4 theme
        //       values feed the existing CIEDE2000 engine unchanged.
        9,
        // C13 — Deterministic Surgery: PostCSS is a pure AST parser. No
        //       regex on CSS source; no regex on source code anywhere in Phase 2.
        //       cssModulesResolver reads ImportDeclarations from a pre-parsed
        //       Babel AST — never re-parses.
        13,
        // C14 — Bypass Prohibition: stylesheet reads go through the loader's
        //       own fs access (no FileTransactionManager because we read, not
        //       write) — but Phase 2 adds NO write paths, so the commandment
        //       is satisfied by omission. Critically, Phase 2 adds NO JS
        //       execution surface: no vm, no eval, no new Function(). This
        //       is the security-delta vs Phase 1's tailwindConfigLoader.
        14,
    ],
    testBoundaries: [
        {
            target: 'cssStylesheetLoader.load (plain CSS)',
            kind: 'service',
            behavior:
                'Parses a standard .css file containing `:root { --primary: #0066cc; }` and returns ParsedStylesheet with one customProperty entry and empty themeBlocks/keyframes.',
            assertion:
                'returns { ok: true, stylesheet: { customProperties: [{ name: "--primary", value: "#0066cc", selector: ":root", line: X }], themeBlocks: [], keyframes: [] } }',
            edgeCases: [
                'single :root block',
                ':root with multiple properties',
                'html { --x: ... } treated equivalent to :root',
                ':where(:root) declaration',
                'trailing semicolon missing',
            ],
            given: 'an absolute path to a .css file containing `:root { --primary: #0066cc; }`',
            when: 'load(absolutePath) is called',
            then:
                'returns { ok: true } with stylesheet.customProperties containing exactly one entry { name: "--primary", value: "#0066cc", selector: ":root" } and themeBlocks.length === 0',
        },
        {
            target: 'cssStylesheetLoader.load (SCSS)',
            kind: 'service',
            behavior:
                'Parses a .scss file via postcss-scss and extracts :root custom properties. SCSS $variables and @mixin bodies are walked but NOT evaluated (non-goal #3).',
            assertion:
                'returns { ok: true, stylesheet.syntax: "scss" } with customProperties populated and SCSS-only constructs silently skipped',
            edgeCases: [
                '.scss file with $variables',
                '.scss file with nested selectors',
                '.scss file with @mixin — mixin body not evaluated',
                '.scss file with @include',
            ],
            given: 'an absolute path to a .scss file with `:root { --primary: #0066cc; }` and a `$scss-var: 10;` declaration',
            when: 'load(absolutePath) is called',
            then:
                'returns { ok: true, stylesheet.syntax: "scss" } and customProperties contains --primary (the SCSS $var is NOT captured)',
        },
        {
            target: 'cssStylesheetLoader.load (CSS Modules variant)',
            kind: 'service',
            behavior:
                'Parses a .module.css file with default CSS syntax. Class scoping is NOT performed here — that is cssModulesResolver\'s job. Custom properties from :root are still extracted.',
            assertion: 'returns { ok: true } and syntax === "css" for a .module.css file',
            edgeCases: [
                '.module.css with :root block',
                '.module.scss with :root + SCSS $vars',
                '.module.css with global {} wrapper',
            ],
            given: 'an absolute path to a .module.css file that contains `.active { color: red } :root { --x: 1 }`',
            when: 'load(absolutePath) is called',
            then:
                'returns { ok: true, stylesheet.customProperties } containing { name: "--x", value: "1" } and no class-scoping output',
        },
        {
            target: 'cssStylesheetLoader.load (malformed CSS — SECURITY-CRITICAL)',
            kind: 'service',
            behavior:
                'Parses a deliberately malformed CSS file. PostCSS throws internally; the loader CATCHES and returns a typed error without crashing the audit pipeline. No memory leak, no infinite loop. A dedicated security testBoundary ensures hostile input (unterminated blocks, deeply nested selectors, giant strings) cannot DoS the audit.',
            assertion:
                'returns { ok: false, error: "parse-error" } within 500ms for any malformed input ≤ 1MB',
            edgeCases: [
                'unterminated `{` block',
                'stray `}` brace',
                '10KB of nested `:not(:not(:not(...)))`',
                'UTF-8 BOM + null bytes',
                '1MB of valid-but-pathological CSS (long selectors)',
            ],
            given: 'an absolute path to a .css file whose content is `:root { --primary: #0066cc` (unterminated block)',
            when: 'load(absolutePath) is called',
            then:
                'returns { ok: false, error: "parse-error" } within 500ms and does NOT throw, leaving the audit pipeline uninterrupted',
        },
        {
            target: 'cssStylesheetLoader.load (file too large — SECURITY-CRITICAL)',
            kind: 'service',
            behavior:
                'Rejects files over a hard size cap (2MB) before invoking PostCSS. Prevents memory blowup on adversarial inputs. The size check is performed via fs.stat BEFORE reading bytes into memory.',
            assertion: 'returns { ok: false, error: "too-large" } when file size > 2_000_000 bytes',
            edgeCases: [
                'exactly 2_000_000 bytes → accepted',
                '2_000_001 bytes → rejected',
                '10MB file → rejected without loading full content into memory',
            ],
            given: 'a .css file whose on-disk size is 2_500_000 bytes',
            when: 'load(absolutePath) is called',
            then:
                'returns { ok: false, error: "too-large" } without reading the file contents into memory and within 50ms',
        },
        {
            target: 'cssStylesheetLoader.load (missing file)',
            kind: 'service',
            behavior: 'Returns file-not-found for a nonexistent path; does NOT throw.',
            assertion: 'returns { ok: false, error: "file-not-found" }',
            edgeCases: ['path does not exist', 'path is a directory', 'path is a broken symlink'],
            given: 'an absolute path pointing to a non-existent .css file',
            when: 'load(absolutePath) is called',
            then: 'returns { ok: false, error: "file-not-found", sourcePath } within 50ms',
        },
        {
            target: 'cssStylesheetLoader.load (@theme extraction — v4 CSS-first)',
            kind: 'service',
            behavior:
                'Parses a CSS file containing `@theme { --color-primary: #0066cc; }` and captures the block in stylesheet.themeBlocks. Non-@theme declarations do NOT appear in themeBlocks.',
            assertion:
                'returns { ok: true, stylesheet.themeBlocks: [{ rawDeclarations: [{ name: "--color-primary", value: "#0066cc" }], startLine: X }] }',
            edgeCases: [
                'single @theme block',
                'multiple @theme blocks in one file',
                '@theme inside @layer base',
                '@theme with @media variant',
                'empty @theme block → captured with rawDeclarations: []',
            ],
            given: 'a .css file containing `@theme { --color-primary: #0066cc; --spacing-4: 1rem; }`',
            when: 'load(absolutePath) is called',
            then:
                'returns { ok: true } and stylesheet.themeBlocks[0].rawDeclarations includes both --color-primary and --spacing-4',
        },
        {
            target: 'cssStylesheetLoader.load (mtime cache round-trip)',
            kind: 'service',
            behavior:
                'Second call for the same path returns the cached ParsedStylesheet when mtimeMs is unchanged. Touching the file invalidates.',
            assertion:
                'second call returns the SAME ParsedStylesheet reference when mtime is unchanged',
            edgeCases: [
                'second call hits cache',
                'touching file invalidates',
                'invalidate(path) clears one file',
                'reset() clears all files',
            ],
            given: 'load(path) was called once returning stylesheet S; the file mtime has not changed',
            when: 'load(path) is called again',
            then:
                'returns S by reference without re-parsing, completing in < 10ms at p95',
        },
        {
            target: 'cssStylesheetLoader (non-root declaration ignored)',
            kind: 'service',
            behavior:
                'A `--local` declared under a component selector (e.g. `.button { --x: ... }`) is NOT captured in customProperties. Only :root / :where(:root) / :is(:root) / html and @layer base :root are captured.',
            assertion: 'returns { ok: true } with customProperties NOT containing the component-scoped property',
            edgeCases: [
                '.button { --x: 1 } — not captured',
                ':root, .button { --x: 1 } — captured (because one of the selectors is :root)',
                ':hover { --x: 1 } — not captured',
            ],
            given: 'a .css file containing `.button { --local: 1 } :root { --primary: #0066cc }`',
            when: 'load(path) is called',
            then: 'returns { ok: true } with customProperties containing only --primary (not --local)',
        },
        {
            target: 'cssCustomPropertyMap.build (single file)',
            kind: 'service',
            behavior:
                'Merges one ParsedStylesheet into a CustomPropertyMap with one entry per :root declaration.',
            assertion: 'returns CustomPropertyMap whose .map has size equal to the input customProperties count',
            edgeCases: [
                'zero declarations → empty map',
                'duplicate property within same file → last-within-file wins',
            ],
            given: 'a ParsedStylesheet with customProperties [{ name: "--primary", value: "#0066cc" }]',
            when: 'build({ stylesheets: [ps] }) is called',
            then:
                'returns CustomPropertyMap.map of size 1 with `--primary` mapping to `#0066cc`',
        },
        {
            target: 'cssCustomPropertyMap.build (multi-file merge + last-wins)',
            kind: 'service',
            behavior:
                'Merges multiple stylesheets in import order. When two stylesheets declare the same `--name`, the LAST (higher-precedence) stylesheet wins.',
            assertion:
                'returns map where the conflicting key resolves to the value from the last-indexed stylesheet',
            edgeCases: [
                'first declares --x=A, second declares --x=B → map has --x=B',
                'three-way conflict — last wins',
                'non-conflicting declarations merge without loss',
            ],
            given:
                'stylesheets: [A with `--primary: red`, B with `--primary: blue`, C with `--secondary: green`] in that order',
            when: 'build({ stylesheets: [A, B, C] }) is called',
            then:
                'returns map with `--primary` === "blue" and `--secondary` === "green"',
        },
        {
            target: 'cssCustomPropertyMap.resolve (chained fallback)',
            kind: 'service',
            behavior:
                'Resolves `var(--a, var(--b, #0000ff))` by walking fallbacks. If --a misses and --b misses, returns the literal `#0000ff`. If --a hits, returns that value. If --b hits, returns that value.',
            assertion: 'returns the hex literal when neither --a nor --b is in the map',
            edgeCases: [
                'no fallback → null when missing',
                'single fallback literal',
                'nested var in fallback',
                'map hit short-circuits fallback walk',
            ],
            given: 'a CustomPropertyMap with no declarations for --a or --b',
            when: 'resolve("var(--a, var(--b, #0000ff))") is called',
            then: 'returns "#0000ff"',
        },
        {
            target: 'cssCustomPropertyMap.resolve (unresolvable chain)',
            kind: 'service',
            behavior:
                'A `var(--x)` reference with no map hit AND no fallback returns null. Callers (classifier, MithrilLinter) treat null as "could not resolve" and retain the unresolvable-var reason.',
            assertion: 'returns null when no fallback and no map hit',
            edgeCases: [
                'bare var() with no fallback and no map entry',
                'chained fallbacks all miss and no literal at the end',
            ],
            given: 'a CustomPropertyMap with no declaration for --missing',
            when: 'resolve("var(--missing)") is called',
            then: 'returns null',
        },
        {
            target: 'cssModulesResolver.resolve (default-import happy path)',
            kind: 'service',
            behavior:
                'Given `import s from "./Button.module.css"` in the source AST and a Button.module.css with `.active { color: red }`, returns one ResolvedCssModuleImport with bindingName "s", resolved: true, classBindings containing "active".',
            assertion:
                'returns CssModulesResolution with imports[0].resolved === true and imports[0].classBindings[0].localClassName === "active"',
            edgeCases: [
                'multiple classes in one module',
                'kebab-case class name',
                'nested directory path',
                'absolute import path',
            ],
            given:
                'sourcePath referring to `import s from "./Button.module.css"`; sibling Button.module.css contains `.active { color: red }`',
            when: 'resolve({ sourcePath, projectRoot, ast }) is called',
            then:
                'returns CssModulesResolution with imports[0] = { bindingName: "s", resolved: true, classBindings: [{ localClassName: "active", ... }] }',
        },
        {
            target: 'cssModulesResolver.resolve (missing module graceful failure)',
            kind: 'service',
            behavior:
                'Import referencing a missing .module.css file yields resolved: false, failureReason: "module-not-found". The classifier retains css-modules-reference.',
            assertion: 'returns imports[0].resolved === false and imports[0].failureReason === "module-not-found"',
            edgeCases: [
                'file not found',
                'directory at that path',
                'broken symlink',
            ],
            given: 'sourcePath referring to `import s from "./Missing.module.css"` where the file does not exist',
            when: 'resolve({ sourcePath, projectRoot, ast }) is called',
            then:
                'returns CssModulesResolution with imports[0] = { resolved: false, failureReason: "module-not-found" } and does NOT throw',
        },
        {
            target: 'cssModulesResolver.resolve — path traversal rejected (SECURITY-CRITICAL)',
            kind: 'service',
            behavior:
                'An import whose resolved absolute path escapes `projectRoot` is rejected WITHOUT reading the referenced file from disk. The check uses `path.relative(projectRoot, resolved)` — any result starting with `..` means the target is outside the project. This closes the last user-controlled-path security surface in Phase 2: a source file cannot use a CSS Module import to probe arbitrary filesystem locations (e.g. /etc/passwd, ~/.ssh, sibling project directories). Must complete within 10ms — fs.access / open is never invoked for the offending path.',
            assertion:
                'returns imports[0] = { resolved: false, failureReason: "path-outside-project" } within 10ms and does NOT read the referenced file',
            edgeCases: [
                '`../../../../../etc/passwd.module.css` from a deep source path',
                '`/etc/passwd.module.css` (absolute path escape)',
                '`./../../outside/x.module.css` resolving just outside projectRoot',
                'symlink inside project that points outside — rejected (resolved real path outside)',
                'exactly at projectRoot boundary — accepted',
            ],
            given:
                'a source file with `import s from "../../../../../etc/passwd.module.css"` and projectRoot = "/app"',
            when: 'cssModulesResolver.resolve runs against this import with projectRoot="/app"',
            then:
                'returns { resolved: false, failureReason: "path-outside-project" } within 10ms and does NOT read the referenced file',
        },
        {
            target: 'cssModulesResolver.resolve (named + namespace imports)',
            kind: 'service',
            behavior:
                'Handles `import * as s from "..."` and `import { active } from "..."` variants. Namespace import uses the namespace binding name; named imports are reported in `namedImports`.',
            assertion:
                'returns ResolvedCssModuleImport with namedImports correctly populated for named-import syntax',
            edgeCases: [
                'default import',
                'namespace import (`* as s`)',
                'named import (`{ active }`)',
                'named import with alias (`{ active as a }`)',
                'mixed default + named — default takes bindingName, named populates namedImports',
            ],
            given: 'sourcePath with `import { active, disabled as d } from "./Button.module.css"`',
            when: 'resolve({ sourcePath, projectRoot, ast }) is called',
            then:
                'returns imports[0].namedImports containing [{ imported: "active", local: "active" }, { imported: "disabled", local: "d" }]',
        },
        {
            target: 'tailwindV4ThemeParser.parse (basic @theme)',
            kind: 'service',
            behavior:
                'Parses a @theme block with `--color-primary: #0066cc` into sections.colors with key "primary" (Tailwind v4 drops the leading --color- prefix). Emits knownClasses containing "bg-primary", "text-primary", "border-primary" etc.',
            assertion:
                'returns { sections: { colors: { "primary": "#0066cc" } }, knownClasses: Set containing "bg-primary", blockCount: 1 }',
            edgeCases: [
                '--color-* → colors section',
                '--spacing-* → spacing section',
                '--font-family-* → fontFamily section',
                '--radius-* → borderRadius section',
            ],
            given: 'a ParsedStylesheet with themeBlocks containing one block with `{ name: "--color-primary", value: "#0066cc" }`',
            when: 'parse(stylesheet) is called',
            then:
                'returns { sections.colors.primary === "#0066cc", knownClasses.has("bg-primary") === true, blockCount === 1 }',
        },
        {
            target: 'tailwindV4ThemeParser.parse (empty / no @theme)',
            kind: 'service',
            behavior:
                'When the stylesheet has no @theme blocks, returns a result with blockCount === 0 and empty sections. Callers MUST check blockCount before merging.',
            assertion: 'returns { blockCount: 0, sections: {}, knownClasses: empty Set }',
            edgeCases: [
                'stylesheet with no @theme',
                'stylesheet with @theme {} (empty block) → blockCount: 1 but empty sections',
            ],
            given: 'a ParsedStylesheet whose themeBlocks is []',
            when: 'parse(stylesheet) is called',
            then: 'returns { blockCount: 0, sections: {}, knownClasses: new Set() }',
        },
        {
            target: 'tailwindV4ThemeParser.parse (multiple @theme blocks merged)',
            kind: 'service',
            behavior:
                'When a file contains multiple @theme blocks, they merge into a single result in source order — later blocks override earlier on conflicting keys.',
            assertion:
                'returns sections.colors containing tokens from all blocks with later-in-file values winning conflicts',
            edgeCases: [
                'two blocks declare the same color token — later wins',
                'two blocks declare disjoint sections — merged',
            ],
            given:
                'a ParsedStylesheet with themeBlocks: [block1 with --color-primary: red, block2 with --color-primary: blue]',
            when: 'parse(stylesheet) is called',
            then: 'returns sections.colors.primary === "blue" and blockCount === 2',
        },
        {
            target: 'coverageClassifier upgrade (external-stylesheet resolved → parsed)',
            kind: 'service',
            behavior:
                'A file whose only coverage blocker is an `import "./x.css"` flips from partial to parsed when externalStylesheets contains a successful load for that import.',
            assertion: 'returns CoverageVerdict { status: "parsed", reason: null }',
            edgeCases: [
                'one stylesheet fails → stays partial',
                'all stylesheets succeed → parsed',
                'empty externalStylesheets array with no imports → parsed (nothing to block)',
            ],
            given:
                'a file with `import "./index.css"` and no other blockers; externalStylesheets is [{ ok: true, stylesheet: ... }]',
            when: 'classifyCoverage is called with the v3 inputs',
            then: 'returns { status: "parsed", reason: null }',
        },
        {
            target: 'coverageClassifier upgrade (css-modules resolved → parsed)',
            kind: 'service',
            behavior:
                'A file with `className={s.active}` flips to parsed when cssModules contains a resolved import whose classBindings includes "active".',
            assertion: 'returns { status: "parsed", reason: null }',
            edgeCases: [
                'one s.className reference unresolved → stays partial',
                'all s.className references resolved → parsed',
                'cssModules with resolved: false → stays partial',
            ],
            given:
                'a file with `import s from "./x.module.css"; <div className={s.active}>`; cssModules.imports[0].resolved === true with classBindings including "active"',
            when: 'classifyCoverage is called with the v3 inputs',
            then: 'returns { status: "parsed", reason: null }',
        },
        {
            target: 'coverageClassifier upgrade (unresolvable-var resolved → parsed)',
            kind: 'service',
            behavior:
                'A file using `style={{ color: "var(--primary)" }}` flips to parsed when customPropertyMap.resolve returns non-null for that expression.',
            assertion: 'returns { status: "parsed", reason: null }',
            edgeCases: [
                'var(--x) with map hit → parsed',
                'var(--x) with no map hit → stays partial',
                'var(--x, #fallback) → already parsed pre-Phase-2',
            ],
            given:
                'a file with `style={{ color: "var(--primary)" }}`; customPropertyMap.resolve("var(--primary)") === "#0066cc"',
            when: 'classifyCoverage is called with the v3 inputs',
            then: 'returns { status: "parsed", reason: null }',
        },
        {
            target: 'coverageClassifier upgrade (v4 @theme resolved → parsed)',
            kind: 'service',
            behavior:
                'A project using v4 CSS-first (no JS config, @theme in CSS) flips tailwind-config-extension to parsed when tailwindV4Theme.blockCount >= 1. Overrides the Phase 1 v4-css-first-unsupported fallback.',
            assertion: 'returns { status: "parsed", reason: null }',
            edgeCases: [
                'blockCount 0 → stays partial',
                'blockCount 1 → parsed',
                'both Phase 1 tailwindConfig.ok and Phase 2 v4 theme → parsed (either source suffices)',
            ],
            given:
                'a file using Tailwind classes; no JS config exists; tailwindV4Theme.blockCount === 1 with populated sections',
            when: 'classifyCoverage is called with the v3 inputs',
            then:
                'returns { status: "parsed", reason: null } — the @theme resolution removed the blocker',
        },
        {
            target: 'coverageClassifier — negative upgrade cases (regression guard)',
            kind: 'service',
            behavior:
                'When the new inputs are passed but resolution FAILS (ok: false, resolved: false, map miss, blockCount 0), the classifier retains the original partial verdict. Phase 0 + Phase 1 verdicts are unchanged.',
            assertion:
                'returns { status: "partial", reason: <matching reason> } for each failed-resolution case',
            edgeCases: [
                'externalStylesheets contains one ok: false entry',
                'cssModules.imports[0].resolved === false',
                'customPropertyMap.resolve() returns null',
                'tailwindV4Theme.blockCount === 0',
            ],
            given: 'inputs are passed but all fail resolution',
            when: 'classifyCoverage is called with each failure shape',
            then:
                'returns the original Phase 0/1 partial verdict for every failure shape — no false upgrades',
        },
        {
            target: 'MithrilLinter.parseCssColorToHex (var(--x) resolves via customPropertyMap)',
            kind: 'service',
            behavior:
                'When customPropertyMap is supplied and contains `--primary: #0066cc`, parseCssColorToHex("var(--primary)") returns "#0066cc" instead of null. The downstream drift detector treats it as an inline literal.',
            assertion: 'returns "#0066cc" for input "var(--primary)" when map provides the binding',
            edgeCases: [
                'map hit → hex returned',
                'map miss → null (preserves existing behavior)',
                'var with fallback still uses fallback path',
            ],
            given:
                'options.customPropertyMap resolves --primary to #0066cc; JSX contains `style={{ color: "var(--primary)" }}`',
            when: 'auditAll(ast, tokens, options) runs',
            then:
                'emits MITHRIL-IST-COL for the style prop when #0066cc drifts from every color token (or suppresses when within ΔE threshold)',
        },
        {
            target: 'MithrilLinter.visitClassNames (s.active treated as "active")',
            kind: 'service',
            behavior:
                'When cssModulesMaps is provided and contains a binding for "s" with classBindings including "active", JSX `<div className={s.active}>` is linted as if the source wrote `className="active"`. Drift detection runs against "active" the same way it would against any literal class.',
            assertion:
                'returns a LinterWarning keyed to the JSX element when "active" would have drifted as a literal',
            edgeCases: [
                's.active present in map → linted',
                's.unknownClass absent from map → skipped (map miss)',
                'namespaced import same behavior',
            ],
            given:
                'options.cssModulesMaps has an import with bindingName "s" and classBindings including { localClassName: "active" }; JSX uses `<div className={s.active}>`',
            when: 'auditAll runs',
            then:
                'emits the same drift warning it would emit for `<div className="active">` — no less, no more',
        },
        {
            target: 'auditAll signature preservation (Phase 2)',
            kind: 'service',
            behavior:
                'Existing callers that do not pass customPropertyMap or cssModulesMaps see IDENTICAL behavior to pre-Phase-2. All 46+ existing auditAll() call sites compile and pass unchanged. Phase 1 options remain untouched.',
            assertion:
                'auditAll(ast, tokens) returns the same Map<string, LinterWarning> as before for the pre-Phase-2 fixture corpus',
            edgeCases: [
                'no options param',
                'options without the new fields',
                'options with Phase 1 fields only',
                'options with Phase 2 fields only',
                'options with both Phase 1 + Phase 2 fields',
            ],
            given: 'the pre-Phase-2 fixture corpus (46+ call sites across flint-mcp)',
            when: 'the full flint-mcp test suite runs',
            then:
                'returns 0 regressions — all previously green tests remain green, verified by `cd flint-mcp && npm test`',
        },
    ],
    invariants: [
        {
            name: 'cssStylesheetLoader-parse-10KB-p95',
            measurable:
                'p95 wall-clock latency of cssStylesheetLoader.load() on a canonical 10KB design-token CSS file with ~100 :root declarations',
            threshold: '< 100ms at p95 over 50 consecutive cold-cache calls',
            measuredBy:
                'vitest bench case `cold-parse-10KB` in flint-mcp/src/core/__tests__/cssStylesheetLoader.bench.ts',
        },
        {
            name: 'cssStylesheetLoader-cache-hit',
            measurable: 'p95 latency of cached cssStylesheetLoader.load() when mtimeMs is unchanged',
            threshold: '< 10ms at p95 over 1000 calls',
            measuredBy:
                'vitest bench case `cache-hit warm` in flint-mcp/src/core/__tests__/cssStylesheetLoader.bench.ts — one cold load() to populate, then 1000 back-to-back load() calls on unchanged mtime',
        },
        {
            name: 'cssCustomPropertyMap-build-per-sheet',
            measurable:
                'Average wall-clock latency of cssCustomPropertyMap.build() per input ParsedStylesheet',
            threshold: '< 50ms on average over a 10-stylesheet merge with 50 total declarations',
            measuredBy:
                'vitest bench case `build-10-sheets` in flint-mcp/src/core/__tests__/cssCustomPropertyMap.test.ts (bench describe block) — records average per-sheet time',
        },
        {
            name: 'cssModulesResolver-fidelity',
            measurable:
                'Fraction of the 20-fixture CSS Modules corpus where resolver output matches the expected.json snapshot per fixture',
            threshold: '>= 0.95 (at least 19/20 fixtures match)',
            measuredBy:
                'flint-mcp/src/core/__tests__/cssModulesResolver.test.ts — each fixture directory loaded, resolver run, diffed against expected.json',
        },
        {
            name: 'coverage-upgrade-parity',
            measurable:
                'Fraction of the classifier test corpus that flips from each Phase 2 partial reason to parsed when its matching resolver returns success',
            threshold:
                '= 1.0 (100% of resolvable fixtures flip for all four reasons; 0 fixtures with unresolved inputs flip)',
            measuredBy:
                'coverageClassifier.test.ts — new "Phase 2 upgrade" describe block comparing verdicts before and after injecting each Phase 2 input shape (positive + negative cases)',
        },
        {
            name: 'phase0-grade-formula-stability',
            measurable:
                'Delta in debt-report healthScore + letter grade when running the same fixture corpus before and after Phase 2 with no NEW violations exposed',
            threshold:
                '= 0 (grade formula MUST NOT change in Phase 2 — Phase 0 non-goal #2 still binding). Grade deltas caused by NEW violations exposed by parsing ARE allowed; grade deltas caused by formula changes are NOT.',
            measuredBy:
                'flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts — add a Phase 2 parity test that holds violations constant and asserts grade == grade',
        },
        {
            name: 'auditAll-signature-stability',
            measurable:
                'Number of pre-Phase-2 auditAll() call sites in flint-mcp/src that require modification to compile',
            threshold: '= 0 (signature unchanged — additive options only)',
            measuredBy:
                '`npx tsc --noEmit` on flint-mcp before and after Phase 2 on the unchanged call-site fixture file',
        },
    ],
    risks: [
        {
            risk:
                'PostCSS malformed-input handling — a hostile stylesheet (deeply nested selectors, unterminated strings, giant file) could throw unexpectedly, crash the audit worker, or spike memory. Critical gotcha: PostCSS catches most syntax errors, but nested-selector parsing can OOM on pathological inputs without a size cap.',
            severity: 'high',
            commandment: 14,
            mitigation:
                'Two-layer defense: (1) fs.stat-based size cap (2_000_000 bytes hard limit) BEFORE reading bytes into memory — returns `too-large` error. (2) wrap PostCSS parse in try/catch that maps ANY thrown error to `{ ok: false, error: "parse-error" }`. No PostCSS error is ever allowed to bubble. Tested by the malformed-CSS and too-large security testBoundaries. No JS execution ever occurs — PostCSS is a pure AST parser, so no sandbox is required.',
        },
        {
            risk:
                'CSS Modules scoped-name generation varies across bundlers (webpack, Vite, Parcel, esbuild). The resolver\'s default scoped-name template may not match a user\'s actual output, causing false drift on `scopedClassName` comparisons.',
            severity: 'medium',
            commandment: 9,
            mitigation:
                'Mithril consumes localClassName (the developer-facing name) for drift detection — scopedClassName is advisory. The 20-fixture corpus tests localClassName fidelity >= 0.95; scopedClassName is not asserted. Documented as a known limitation in the service header; future work can add bundler-config sniffing.',
        },
        {
            risk:
                'Tailwind v4 `@theme` naming conventions don\'t round-trip cleanly to Phase 1\'s section keys. v4 uses `--color-primary` / `--spacing-4` / `--font-family-sans`; our normalizer must strip the correct prefix and map to `colors.primary`, `spacing.4`, `fontFamily.sans`. A wrong mapping would silently break drift detection.',
            severity: 'medium',
            commandment: 2,
            mitigation:
                'tailwindV4ThemeParser implements the official v4 prefix table (`--color-*` → colors, `--spacing-*` → spacing, `--font-*` → fontFamily/fontWeight/etc., `--radius-*` → borderRadius, `--shadow-*` → boxShadow). Unit-tested for every prefix. Unknown prefixes are dropped silently (logged) rather than crashing. Reconciled against Tailwind v4 docs in the test fixtures.',
        },
        {
            risk:
                'Custom-property map last-wins merge can silently shadow a user\'s primary value if their stylesheet import order is unusual (e.g. a theme override imported before the base theme). Users would see unexpected "no drift" on what they consider the wrong color.',
            severity: 'low',
            commandment: 9,
            mitigation:
                'Document the last-wins rule in cssCustomPropertyMap\'s API docs. Expose `sourcePaths` so diagnostic tooling can show which stylesheet contributed each property. Future enhancement: surface the resolution path in Mithril warnings so users can trace drift-vs-expected confusion.',
        },
        {
            risk:
                'The 2MB size cap is conservative for most projects but may reject large bundled output files (e.g. compiled design-system CSS). These would silently lose governance coverage.',
            severity: 'low',
            mitigation:
                'Log a clear warning when rejecting with `too-large` error. Document the cap in the service header. Make the cap a constant with a code-level comment pointing to the justification. Users can file an issue to request the cap be raised; Phase 2 treats this as a security/perf floor, not a final value.',
        },
        {
            risk:
                'cssModulesResolver reads filesystem paths derived from user code — an unresolved alias (e.g. `@/styles/Button.module.css`) could cause repeated file-not-found failures that spam logs. Or, in a pathological case, a malicious source file could probe filesystem paths via imports.',
            severity: 'medium',
            commandment: 14,
            mitigation:
                'Path resolution uses `path.resolve(dirname(sourcePath), importSpecifier)` — resolves ONLY relative paths. Alias paths (`@/...`, `~/...`) fail with `module-not-found` immediately (no filesystem probe outside the project root). The resolver refuses any absolute path that escapes the project root (e.g. `../../../etc/passwd`) — enforced via a post-resolution path.relative() check that rejects paths starting with `..`. Logged warnings are rate-limited per session.',
        },
        {
            risk:
                'Adding postcss + postcss-scss + postcss-modules to flint-mcp inflates the CLI bundle size and startup time. flint-gate users who don\'t touch CSS pay the cost.',
            severity: 'low',
            mitigation:
                'Imports are dynamic: `const postcss = await import("postcss")` inside cssStylesheetLoader.load() only. Bundler tree-shakes when no CSS files are audited. Size delta asserted < 3MB in PR review. Cold-start impact measured via the 10KB parse invariant.',
        },
    ],
    parallelismGroups: {
        // Group A: PostCSS loader + customPropertyMap + package.json deps — one owner.
        // They form a single cohesive service-layer.
        A: ['flint-mcp-specialist', 'flint-ast-surgeon'],
        // Group B: test scaffolds from testBoundaries + fixture corpus.
        // Runs in parallel with A for the scaffolds (it.todo); fills in real
        // assertions after A lands. Fixture corpus creation can start immediately.
        B: ['flint-test-writer'],
    },
    nonGoals: [
        'Not executing any JavaScript. Phase 2 is pure CSS parsing. No `vm.runInNewContext`, no `eval`, no `new Function()`. PostCSS is a pure parser with no JS evaluation surface. This is the security-delta versus Phase 1\'s tailwindConfigLoader (which sandboxed a JS runtime). Phase 2 has no sandbox because it has nothing to sandbox.',
        'Not resolving cross-stylesheet `@import` transitively. Phase 2 parses each stylesheet in isolation. Shared custom properties declared in a file imported via `@import "base.css"` are detected ONLY if that file is also directly imported by the user\'s source JS/TSX. Full transitive resolution is a future enhancement — the current behavior is conservative (prefer false-negative over false-positive on merge order).',
        'Not executing SCSS `@mixin` / `@function` / `$variable` constructs. We parse SCSS syntax via postcss-scss but do NOT evaluate SCSS logic. Custom-property declarations (`:root { --x: $scss-var }`) are captured as raw strings — if the value is a `$scss-var`, it is stored verbatim and will NOT resolve against tokens. Files using heavy SCSS logic retain `external-stylesheet-imported` partial coverage if custom-property extraction alone isn\'t sufficient.',
        'Not auto-fixing stylesheet drift. When a stylesheet\'s custom property conflicts with a design token, Mithril reports drift but does NOT rewrite the CSS file. Stylesheet writes are out of scope — CSS rewrites belong to a user-initiated pipeline, not this observability pass. Phase 2 is pure read.',
        'Not changing the debt grade formula. Phase 0 non-goal #2 and Phase 1 non-goal still binding. Coverage % is a separate informational signal from the A-F grade.',
        'Not parsing HTML `<style>` tags, Vue SFC `<style>` blocks, Svelte `<style>` blocks, or Angular component styles. HTML/Vue/Svelte/Angular are Phase 4. Phase 2 handles external stylesheet FILES only — anything embedded in source is deferred.',
        'Not adding new MCP tools. Existing `audit_ui_component` / `flint_audit` / `flint_debt_report` benefit automatically once the classifier sees Phase 2 inputs. No new entries in server.ts. No new IPC channels. No Glass UI changes.',
        'Not resolving CSS Module path aliases (`@/styles/Button.module.css`). Phase 2 resolves only relative paths. Alias-configured imports fail with `module-not-found` and the file retains `css-modules-reference`. Alias resolution requires reading the project\'s bundler config (tsconfig paths, vite/webpack config) — out of scope for Phase 2.',
        'Not honoring user-custom postcss-modules `generateScopedName` functions. The resolver uses the postcss-modules default scoped-name template. Mithril consumes `localClassName` (developer-facing) for drift detection, so user-custom scoping does not break correctness — only the advisory `scopedClassName` field may differ from bundler output.',
    ],
}
