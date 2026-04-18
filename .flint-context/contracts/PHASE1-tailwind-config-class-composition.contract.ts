/**
 * PHASE 1 — Tailwind Config + Class Composition Expansion
 *
 * Executable contract. Phase 2 agents import types directly from this file.
 * Phase 1.5 (flint-contract-linter) validates this compiles and its CONTRACT
 * constant satisfies contract-schema v2 (audience, falsifiable invariants,
 * executable given/when/then, IPC validators, non-empty nonGoals).
 *
 * Purpose of Phase 1:
 *   Close the two biggest false-negative paths for React + Tailwind projects
 *   exposed by Phase 0's classifier:
 *     1. `tailwind.config.{js,ts,mjs,cjs}` extensions were invisible to Mithril.
 *     2. Dynamic class expressions (clsx, cva, classnames, cn, tw-merge) were
 *        skipped whole — most modern Tailwind components were partially
 *        ungoverned.
 *
 *   Phase 1 adds two pure services to flint-mcp/src/core/:
 *     - tailwindConfigLoader  — loads + resolves `tailwind.config.*` via
 *       Tailwind's own `resolveConfig` helper. Returns a normalized
 *       ResolvedTailwindTheme and the full class-name-to-token projection
 *       that Mithril's drift detection consumes.
 *     - classExpressionExpander — partial-evaluates class-utility calls into
 *       { definite, possible, unresolvable } sets that Mithril reads as
 *       additional class sources.
 *
 *   coverageClassifier upgrades the `tailwind-config-extension` and
 *   `dynamic-class-expression` verdicts to `parsed` when the new services
 *   resolve successfully.
 *
 *   MithrilLinter integrates both without breaking its 190+ callers.
 *
 * What Phase 1 is NOT:
 *   - Not resolving Tailwind v4 CSS-first `@theme` blocks (Phase 2).
 *   - Not executing arbitrary TypeScript I/O in config files (sandboxed load).
 *   - Not statically evaluating `cva` return functions (variant surface only).
 *   - Not cross-file import resolution for class-utility arguments.
 *   - Not auto-fixing newly-exposed drift (existing `flint_fix` handles that).
 */

import type { FlintContract } from '../../shared/contract-schema'

// ─────────────────────────────────────────────────────────────────────
// tailwindConfigLoader — resolves tailwind.config.{js,ts,mjs,cjs}
// ─────────────────────────────────────────────────────────────────────

/**
 * Subset of Tailwind theme sections Phase 1 extracts.
 * Order is stable — serialized values must not be renamed without a migration.
 * New sections append to the end.
 */
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
 *
 * Each section is a flat map from dotted token name to resolved string value.
 * Example: theme.colors = { "primary.500": "#0066cc", "brand.accent": "..." }.
 *
 * The flat shape mirrors how Mithril's token matcher indexes DesignToken[],
 * so MithrilLinter can merge these into its existing color/dimension/etc.
 * token set without schema translation.
 */
export interface ResolvedTailwindTheme {
    /** Source config file that produced this theme (absolute path). */
    sourcePath: string
    /** Detected Tailwind major version ("v3" | "v4-js" | "v4-css-unsupported"). */
    version: 'v3' | 'v4-js' | 'v4-css-unsupported'
    /** mtimeMs of sourcePath at load time — used for cache invalidation. */
    mtimeMs: number
    /** Flat theme sections — each `Record<dottedName, resolvedValue>`. */
    sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
    /**
     * Precomputed set of fully-resolved Tailwind class-name prefixes derived
     * from the theme (e.g., "bg-primary-500", "text-brand.accent", "p-4").
     * Mithril treats membership in this set as "not drift" for the extended
     * theme — avoiding false positives on extended tokens.
     */
    knownClasses: ReadonlySet<string>
}

/** Why a tailwind.config.* could not be loaded. */
export type TailwindConfigLoadError =
    | 'config-not-found'
    | 'syntax-error'
    | 'sandbox-violation'   // config attempted fs/env/network I/O
    | 'v4-css-first-unsupported'
    | 'resolve-config-threw'
    | 'unknown'

/** Result shape from tailwindConfigLoader.load(). */
export type TailwindConfigLoadResult =
    | { ok: true; theme: ResolvedTailwindTheme }
    | { ok: false; error: TailwindConfigLoadError; details: string; sourcePath: string | null }

/**
 * Public API of tailwindConfigLoader.ts.
 *
 * Stateless from the caller's perspective — internal mtime cache is keyed on
 * projectRoot so parallel audits of the same project reuse the resolved theme.
 */
export interface TailwindConfigLoader {
    /**
     * Resolve the Tailwind config at the given project root.
     * Returns `{ ok: false, error: 'config-not-found' }` when no
     * tailwind.config.{js,ts,mjs,cjs} is present.
     *
     * Cache: returns the previous result if mtimeMs is unchanged.
     */
    load(projectRoot: string): Promise<TailwindConfigLoadResult>
    /** Clear the mtime cache for a single project (test helper). */
    invalidate(projectRoot: string): void
    /** Clear the mtime cache for all projects (test helper). */
    reset(): void
}

// ─────────────────────────────────────────────────────────────────────
// classExpressionExpander — partial-evaluates class utility calls
// ─────────────────────────────────────────────────────────────────────

/**
 * Utility callee names recognized by classExpressionExpander.
 *
 * Matched either by the identifier itself OR by the local binding from a
 * known npm package — so `import cn from './utils'` is NOT recognized
 * unless a companion detection proves `cn` is re-exporting clsx (out of
 * scope for Phase 1; cross-file resolution is a non-goal).
 */
export type ClassUtilityName =
    | 'clsx'
    | 'cva'
    | 'classnames'
    | 'classNames'   // case variant
    | 'cn'
    | 'twMerge'
    | 'tw'

/**
 * Output of classExpressionExpander.expand() for a single className-bearing
 * call expression.
 *
 * Mithril runs drift detection against `definite ∪ possible`. `unresolvable`
 * means at least one branch could not be statically evaluated; the classifier
 * still keeps `dynamic-class-expression` as the reason in that case.
 */
export interface ExpandedClassExpression {
    /** Classes that are ALWAYS applied regardless of runtime state. */
    definite: readonly string[]
    /** Classes that MAY be applied depending on runtime conditionals. */
    possible: readonly string[]
    /**
     * True if any argument could not be fully evaluated (unresolved identifier,
     * non-local import, runtime-only value). When true, Mithril still checks
     * `definite` and `possible`, but the coverage classifier retains
     * `dynamic-class-expression` so the file remains `partial`.
     */
    unresolvable: boolean
    /** Which utility produced this expansion. */
    utility: ClassUtilityName
    /** 1-based line number of the call expression. */
    line: number
}

/** Cache entry for the expander, keyed on a stable AST node identity. */
export interface ClassExpressionExpansionCacheKey {
    filePath: string
    /** Start offset of the CallExpression in source. */
    start: number
    /** End offset of the CallExpression in source. */
    end: number
}

/**
 * Public API of classExpressionExpander.ts.
 *
 * Accepts a pre-parsed Babel File — never calls Babel.parse() internally
 * (Commandment 13: Deterministic Surgery).
 */
export interface ClassExpressionExpander {
    /**
     * Walk the AST, expand every recognized class-utility call, and return
     * one ExpandedClassExpression per call site.
     *
     * Expansions are collected in source order. Duplicate classes across
     * calls are NOT deduplicated at this layer — Mithril handles merging.
     */
    expandAll(input: {
        filePath: string
        ast: import('@babel/types').File
    }): ExpandedClassExpression[]
}

// ─────────────────────────────────────────────────────────────────────
// coverageClassifier upgrade — new ClassifierInput fields
// ─────────────────────────────────────────────────────────────────────

/**
 * Additive ClassifierInput fields. The existing ClassifierInput keeps all
 * prior fields unchanged (Phase 0 contract stability) and adds two optional
 * injectables. When present, they flip matching partial verdicts to `parsed`.
 *
 * Contract stability: consumers that don't pass these fields behave exactly
 * as before Phase 1 — Phase 0 tests remain green unmodified.
 */
export interface ClassifierInputV2 {
    /** Existing Phase 0 fields (filePath, source, ast, tailwindConfigUnparsed). */
    /**
     * Result of tailwindConfigLoader for the project containing this file.
     * When `ok: true`, the classifier treats `tailwind-config-extension` as
     * resolved (verdict flips to `parsed` unless another reason still applies).
     */
    tailwindConfig?: TailwindConfigLoadResult
    /**
     * Output of classExpressionExpander for this file. When every expansion
     * is `unresolvable: false`, the classifier treats `dynamic-class-expression`
     * as resolved. If any is unresolvable, the original reason is retained.
     */
    classExpansions?: readonly ExpandedClassExpression[]
}

// ─────────────────────────────────────────────────────────────────────
// MithrilLinter integration surface
// ─────────────────────────────────────────────────────────────────────

/**
 * Additive fields appended to `AuditAllOptions`. The existing `auditAll`
 * signature is unchanged (Phase 1 non-goal: do not modify `auditAll` —
 * 190+ callers depend on it). Options are opt-in: callers that want the
 * Phase 1 benefits pass these; all others behave exactly as before.
 */
export interface AuditAllOptionsV2Additive {
    /**
     * Resolved Tailwind theme. When provided, Mithril:
     *  1. Treats `knownClasses` membership as "not drift" for affected rules.
     *  2. Merges color/dimension/fontFamily/etc. entries into its token set.
     */
    tailwindTheme?: ResolvedTailwindTheme
    /**
     * Expanded class expressions for the file being audited. When provided,
     * Mithril's className extractor iterates `definite ∪ possible` classes
     * in addition to the literal `className="..."` strings it already handles.
     */
    classExpansions?: readonly ExpandedClassExpression[]
}

// ─────────────────────────────────────────────────────────────────────
// Machine-Readable Contract
// ─────────────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'PHASE1-TailwindConfig-ClassComposition',
        phase: 'PHASE1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-18',
        audience: 'engine',
    },
    impact: [
        {
            file: 'flint-mcp/src/core/tailwindConfigLoader.ts',
            changeType: 'CREATE',
            owner: 'flint-mcp-specialist',
            summary:
                'Load + resolve tailwind.config.{js,ts,mjs,cjs} via Tailwind\'s resolveConfig; return ResolvedTailwindTheme with mtime cache and v3/v4-JS/v4-CSS-unsupported version detection.',
        },
        {
            file: 'flint-mcp/src/core/classExpressionExpander.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Partial-evaluate clsx/cva/classnames/cn/twMerge/tw calls into { definite, possible, unresolvable }. Resolves local const StringLiteral/ObjectExpression/ArrayExpression identifiers; marks non-local imports unresolvable.',
        },
        {
            file: 'flint-mcp/src/core/coverageClassifier.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Accept optional `tailwindConfig` + `classExpansions` inputs (additive). When loader returns ok and every expansion is resolvable, upgrade the matching `partial` verdict to `parsed`.',
        },
        {
            file: 'flint-mcp/src/core/MithrilLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary:
                'Append optional `tailwindTheme` + `classExpansions` to AuditAllOptions (additive only — signature preserved). Merge theme tokens into the existing token set and iterate expanded classes in getClassString-equivalent paths.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/tailwindConfigLoader.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'v3 + v4-JS load, v4-CSS flagged unsupported, malformed config fails cleanly, missing config returns config-not-found, mtime cache round-trip, sandbox rejects fs/env reads.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/classExpressionExpander.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                '50-fixture corpus: literal clsx, object clsx, array clsx, ternary branches, logical &&, renamed imports, cva variants object, unresolvable identifiers, nested calls, tw-merge precedence.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/coverageClassifier.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary:
                'Add cases: resolvable clsx literals flip to parsed; mixed clsx(foo, bar) stays partial with dynamic-class-expression; tailwind.config.js resolved flips to parsed.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/MithrilLinter.tailwind-theme.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Extended theme `primary` token added via tailwindTheme → `bg-primary` passes drift; absent token → drift fires. Expanded classes feed visitClassNames/visitSpacing.',
        },
        {
            file: 'flint-mcp/package.json',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary:
                'Add `tailwindcss` as a dependency (for resolveConfig) and `esbuild` as a dependency (for sandboxed TS config loading). Dev-only; no runtime impact on flint-gate CLI bundling is expected — confirm bundle size delta < 5MB in PR.',
        },
    ],
    // Phase 1 is MCP-engine-only. Zero IPC channels, zero Glass UI, zero
    // preload changes. Coverage % updates automatically via Phase 0's pipeline.
    ipc: [],
    stores: [],
    components: [],
    commandments: [
        // C2  — No Hallucinated Styling: extended theme tokens become legitimate
        //       drift-free classes, closing a false-negative gap.
        2,
        // C8  — Audit-First Execution: classifier upgrades affect coverage
        //       signaling, not routing, but the expansion step is itself an audit.
        8,
        // C9  — CIEDE2000 ΔE Logic: drift detection against expanded class sets
        //       uses the existing CIEDE2000 engine unchanged.
        9,
        // C13 — Deterministic Surgery: expander traverses pre-parsed Babel AST,
        //       never regex on source. Config loader uses Tailwind's own
        //       resolveConfig (no source-string hacks).
        13,
        // C14 — Bypass Prohibition: tailwindConfigLoader sandboxes config
        //       evaluation via `vm.runInNewContext` with a stripped sandbox
        //       object (no `process`, no `fs`, no `require` — a custom
        //       resolver intercepts imports and allowlists only safe
        //       Tailwind preset packages). Any config that attempts direct
        //       fs/env/network I/O returns `sandbox-violation`. This is the
        //       single most security-critical invariant in Phase 1.
        14,
    ],
    testBoundaries: [
        {
            target: 'tailwindConfigLoader.load (v3 config)',
            kind: 'service',
            behavior:
                'Resolves a standard Tailwind v3 tailwind.config.js and returns its fully-merged theme plus a knownClasses set that contains the extended class prefixes.',
            assertion:
                'returns { ok: true, theme: ResolvedTailwindTheme } with version="v3" and sections.colors["primary.500"]==="#0066cc"',
            edgeCases: [
                'theme.extend.colors merges with defaults',
                'preset that supplies extra colors is merged',
                'config exports default vs module.exports',
                'relative content globs do not crash the resolver',
            ],
            given:
                'a project root containing tailwind.config.js that extends theme.colors.primary.500 = "#0066cc"',
            when: 'load(projectRoot) is called',
            then:
                'returns { ok: true } with theme.sections.colors["primary.500"] === "#0066cc" and theme.knownClasses contains "bg-primary-500"',
        },
        {
            target: 'tailwindConfigLoader.load (v4 JS config)',
            kind: 'service',
            behavior:
                'Loads a Tailwind v4 JS config via resolveConfig and tags it version="v4-js".',
            assertion: 'returns { ok: true, theme.version: "v4-js" }',
            edgeCases: [
                'v4 JS config using @tailwindcss/postcss plugin array',
                'v4 JS config without presets',
            ],
            given: 'a project root containing a v4 tailwind.config.ts with theme.extend.spacing["18"]="4.5rem"',
            when: 'load(projectRoot) is called',
            then:
                'returns { ok: true } and theme.version equals "v4-js" and theme.sections.spacing["18"] equals "4.5rem"',
        },
        {
            target: 'tailwindConfigLoader.load (v4 CSS-first)',
            kind: 'service',
            behavior:
                'Detects a project using @theme in a .css file with no JS config and reports v4-css-first-unsupported without crashing.',
            assertion: 'returns { ok: false, error: "v4-css-first-unsupported" }',
            edgeCases: [
                'no tailwind.config.* present, but @theme in src/app.css',
                'both JS config and @theme present — JS takes precedence (ok: true)',
            ],
            given:
                'a project root with no tailwind.config.* and an `@theme { --color-primary: #0066cc; }` block in src/app.css',
            when: 'load(projectRoot) is called',
            then:
                'returns { ok: false, error: "v4-css-first-unsupported" } and classifier keeps tailwind-config-extension as the reason',
        },
        {
            target: 'tailwindConfigLoader.load (malformed config)',
            kind: 'service',
            behavior:
                'Catches syntax errors and module-eval throws and returns a typed error without bubbling an exception to the caller.',
            assertion: 'returns { ok: false, error: "syntax-error" }',
            edgeCases: [
                'ts file with invalid syntax',
                'js file that throws at module evaluation',
                'unterminated template string',
                'importing a package that does not exist (module-not-found)',
            ],
            given: 'a tailwind.config.ts file with a top-level SyntaxError',
            when: 'load(projectRoot) is called',
            then:
                'returns { ok: false, error: "syntax-error" } and does NOT throw, leaving the audit pipeline uninterrupted',
        },
        {
            target: 'tailwindConfigLoader.load (sandbox violation — fs access)',
            kind: 'service',
            behavior:
                'Rejects a tailwind.config.js that attempts to read the filesystem at top level. The VM sandbox exposes NO `fs`, `process`, or `require("fs")` surface. The read result MUST NOT be exposed to the caller, and the load MUST complete within the 2s timeout budget.',
            assertion:
                'returns { ok: false, error: "sandbox-violation" } within 2000ms and theme is absent from the result',
            edgeCases: [
                'fs.readFileSync at top level',
                'require("fs").readFileSync at top level',
                'fs.readFile callback pattern',
                'dynamic await import("fs") at top level',
            ],
            given: 'a tailwind.config.js that calls fs.readFileSync(...) at top level',
            when: 'load(projectRoot) is called',
            then: 'returns { ok: false, error: "sandbox-violation" } within 2000ms and does NOT expose the read result',
        },
        {
            target: 'tailwindConfigLoader.load (sandbox violation — env access)',
            kind: 'service',
            behavior:
                'Rejects a tailwind.config.js that reads `process.env` at top level. The VM sandbox omits `process` entirely — reading `process.env` throws a ReferenceError inside the sandbox, which the loader catches and maps to `sandbox-violation`.',
            assertion: 'returns { ok: false, error: "sandbox-violation" }',
            edgeCases: [
                'process.env.NODE_ENV read at top level',
                'destructured `const { PATH } = process.env`',
                'ternary on process.env flag in theme.extend',
            ],
            given: 'a tailwind.config.js that reads process.env.FOO at top level',
            when: 'load(projectRoot) is called',
            then: 'returns { ok: false, error: "sandbox-violation" } and does NOT leak the env var value in details',
        },
        {
            target: 'tailwindConfigLoader.load (sandbox violation — network access)',
            kind: 'service',
            behavior:
                'Rejects a tailwind.config.js that attempts to reach the network. `http`, `https`, `net`, and `fetch` are all absent from the sandbox.',
            assertion: 'returns { ok: false, error: "sandbox-violation" }',
            edgeCases: [
                'require("http").get at top level',
                'fetch(...) at top level',
                'await import("https") at top level',
            ],
            given: 'a tailwind.config.js that calls fetch("https://evil.example") at top level',
            when: 'load(projectRoot) is called',
            then: 'returns { ok: false, error: "sandbox-violation" } and emits no outbound network request',
        },
        {
            target: 'tailwindConfigLoader.load (missing config)',
            kind: 'service',
            behavior: 'Returns config-not-found when the project has no tailwind config.',
            assertion: 'returns { ok: false, error: "config-not-found" }',
            edgeCases: ['empty project dir', 'project with postcss.config.* but no tailwind.config.*'],
            given: 'a project root with no tailwind.config.{js,ts,mjs,cjs}',
            when: 'load(projectRoot) is called',
            then:
                'returns { ok: false, error: "config-not-found", sourcePath: null } within 50ms',
        },
        {
            target: 'tailwindConfigLoader.load (mtime cache round-trip)',
            kind: 'service',
            behavior:
                'Second call for the same project returns cached theme when mtimeMs is unchanged; touching the file invalidates.',
            assertion:
                'second call returns the SAME ResolvedTailwindTheme object reference when mtime is unchanged',
            edgeCases: [
                'second call hits cache',
                'touching config invalidates',
                'invalidate(projectRoot) clears just that project',
            ],
            given:
                'load(projectRoot) was called once and produced theme T; the config file mtime has not changed',
            when: 'load(projectRoot) is called again',
            then: 'returns T by reference without re-parsing, completing in < 10ms at p95',
        },
        {
            target: 'classExpressionExpander.expandAll (literal clsx)',
            kind: 'service',
            behavior:
                'Expands `clsx("a", "b")` to definite=["a","b"], possible=[], unresolvable=false.',
            assertion: 'returns [{ definite: ["a","b"], possible: [], unresolvable: false }]',
            edgeCases: ['single arg', 'empty args', 'string with multiple classes'],
            given: 'source `clsx("a", "b c")` with clsx imported from "clsx"',
            when: 'expandAll({ filePath, ast }) is called',
            then:
                'returns one ExpandedClassExpression with definite containing "a", "b", "c" and unresolvable === false',
        },
        {
            target: 'classExpressionExpander.expandAll (object clsx)',
            kind: 'service',
            behavior:
                'Expands `clsx({ foo: true, bar: false, baz: dynamic })` to definite=["foo"], possible=["baz"], removes bar.',
            assertion: 'returns { definite: ["foo"], possible: ["baz"], unresolvable: false }',
            edgeCases: [
                'all keys true',
                'all keys false',
                'computed key',
                'spread element forces unresolvable',
            ],
            given:
                'source `clsx({ foo: true, bar: false, baz: condition })` where `condition` is a local identifier',
            when: 'expandAll is called',
            then:
                'returns { definite: ["foo"], possible: ["baz"], unresolvable: false } — false keys are dropped, dynamic values become possible',
        },
        {
            target: 'classExpressionExpander.expandAll (ternary + logical)',
            kind: 'service',
            behavior:
                'Both branches of a ternary and the right-hand side of && are captured as possible classes.',
            assertion:
                'returns { definite: [], possible: ["x","y","z"], unresolvable: false } for `clsx(active ? "x" : "y", show && "z")`',
            edgeCases: [
                'ternary with non-literal branch',
                'nested ternary',
                '|| fallback pattern',
                'unary negation',
            ],
            given:
                'source `clsx(active ? "x" : "y", show && "z")` with `active` and `show` as non-const identifiers',
            when: 'expandAll is called',
            then:
                'returns possible containing "x", "y", and "z" and unresolvable === false',
        },
        {
            target: 'classExpressionExpander.expandAll (renamed import)',
            kind: 'service',
            behavior:
                'Recognizes `import cn from "clsx"` and expands `cn(...)` identically to `clsx(...)`.',
            assertion: 'returns an expansion even when the local name differs from the utility name',
            edgeCases: [
                'default import renamed',
                'named import with alias `import { clsx as x } from "clsx"`',
                'namespace import `import * as c from "classnames"` and call `c.default(...)`',
            ],
            given:
                'source `import cn from "clsx"; cn("a", "b")` — local binding is `cn`, package is clsx',
            when: 'expandAll is called',
            then: 'returns [{ utility: "clsx", definite: ["a","b"], unresolvable: false }]',
        },
        {
            target: 'classExpressionExpander.expandAll (cva variants)',
            kind: 'service',
            behavior:
                'For a `cva(base, { variants })` call, captures the base string AND every literal class across the variants object as possible classes.',
            assertion:
                'returns one expansion with all variant class strings present in `possible`',
            edgeCases: [
                'base arg is array',
                'variants are nested objects',
                'compound variants',
                'default variants',
            ],
            given:
                'source `cva("rounded-md", { variants: { intent: { primary: "bg-primary-500", secondary: "bg-gray-500" } } })`',
            when: 'expandAll is called',
            then:
                'returns definite containing "rounded-md" and possible containing "bg-primary-500" and "bg-gray-500"',
        },
        {
            target: 'classExpressionExpander.expandAll (unresolvable identifier)',
            kind: 'service',
            behavior:
                'Marks the expansion unresolvable when an argument is an identifier whose binding is not a local const with a literal initializer.',
            assertion: 'returns { unresolvable: true } while still capturing resolvable branches',
            edgeCases: [
                'identifier is a function parameter',
                'identifier is imported from another file',
                'identifier is a let reassigned after declaration',
                'identifier resolves to `any`-typed expression',
            ],
            given: 'source `clsx(baseClasses, "extra")` where `baseClasses` is imported from "./utils"',
            when: 'expandAll is called',
            then:
                'returns { definite: ["extra"], possible: [], unresolvable: true } — the unresolvable flag blocks the classifier upgrade',
        },
        {
            target: 'coverageClassifier upgrade (clsx literals → parsed)',
            kind: 'service',
            behavior:
                'A file whose only coverage blocker is a `clsx("a", "b")` call (resolvable) flips from partial to parsed when classExpansions is provided.',
            assertion: 'returns CoverageVerdict { status: "parsed", reason: null }',
            edgeCases: [
                'mixed resolvable + unresolvable → stays partial',
                'multiple calls all resolvable → parsed',
                'no expansions provided → legacy behavior (partial)',
            ],
            given:
                'a file with `className={clsx("a", "b")}` and no other coverage blockers; tailwindConfig and classExpansions (all resolvable) are passed',
            when: 'classifyCoverage is called with the v2 inputs',
            then: 'returns { status: "parsed", reason: null } — no coverage blockers remain',
        },
        {
            target: 'coverageClassifier upgrade (mixed clsx stays partial)',
            kind: 'service',
            behavior:
                'A file with `clsx(foo, bar)` where both are unresolvable remains partial with dynamic-class-expression.',
            assertion:
                'returns { status: "partial", reason: "dynamic-class-expression" } even with classExpansions passed',
            edgeCases: [
                'one of many calls unresolvable → partial',
                'spread operator → partial',
            ],
            given:
                'a file with `className={clsx(foo, bar)}` where neither is a resolvable local const',
            when: 'classifyCoverage is called with classExpansions containing one unresolvable expansion',
            then:
                'returns { status: "partial", reason: "dynamic-class-expression" } — unresolvable flag blocks the upgrade',
        },
        {
            target: 'coverageClassifier upgrade (tailwind.config resolved → parsed)',
            kind: 'service',
            behavior:
                'A file flagged tailwind-config-extension flips to parsed when tailwindConfig.ok === true.',
            assertion: 'returns { status: "parsed", reason: null }',
            edgeCases: [
                'ok: false with v4-css-first-unsupported → stays partial',
                'ok: false with syntax-error → stays partial',
            ],
            given:
                'a file using `bg-brand-primary` in a project with a resolvable tailwind.config.js that defines brand.primary; tailwindConfigUnparsed=true is NO LONGER set',
            when: 'classifyCoverage is called with tailwindConfig from loader',
            then:
                'returns { status: "parsed", reason: null } — the config resolution removed the blocker',
        },
        {
            target: 'MithrilLinter.visitClassNames (extended theme drift-free)',
            kind: 'service',
            behavior:
                'When tailwindTheme.knownClasses contains "bg-primary-500", `className="bg-primary-500"` does not trigger MITHRIL-COL drift.',
            assertion: 'returns empty warnings Map for that className',
            edgeCases: [
                'theme token present but hex ΔE > threshold still flags',
                'absent token → flags as before',
            ],
            given:
                'AuditAllOptionsV2 with tailwindTheme whose knownClasses includes "bg-primary-500" and sections.colors["primary.500"] === "#0066cc"; file uses className="bg-primary-500"',
            when: 'auditAll(ast, tokens, options) runs',
            then: 'returns no MITHRIL-COL warning for that JSX element',
        },
        {
            target: 'MithrilLinter.visitClassNames (expanded classes feed drift)',
            kind: 'service',
            behavior:
                'Classes surfaced in classExpansions[i].definite and .possible are checked against drift rules alongside literal className strings.',
            assertion:
                'returns a MITHRIL-COL warning for a drift-y class that appeared only inside clsx(...)',
            edgeCases: [
                'class appears only in possible[] → still checked',
                'duplicate class across definite and literal → single warning',
            ],
            given:
                'a file whose className={clsx("bg-[#ff0000]", active && "text-[#110033]")} expands to { possible: ["bg-[#ff0000]","text-[#110033]"] } and tokens contain a distant-hex primary',
            when: 'auditAll runs with classExpansions supplied',
            then:
                'returns a MITHRIL-COL warning keyed to the JSX element for bg-[#ff0000] drift (or the worst-case ΔE class)',
        },
        {
            target: 'auditAll signature preservation',
            kind: 'service',
            behavior:
                'Existing callers that do not pass tailwindTheme or classExpansions see IDENTICAL behavior to pre-Phase-1. All 46 existing auditAll() call sites compile and pass unchanged.',
            assertion: 'auditAll(ast, tokens) returns the same Map<string, LinterWarning> as before',
            edgeCases: [
                'no options param',
                'options object without the new fields',
                'options with tailwindTheme but no classExpansions and vice versa',
            ],
            given: 'the pre-Phase-1 fixture corpus (46 call sites across flint-mcp)',
            when: 'the full flint-mcp test suite runs',
            then:
                'returns 0 regressions (all previously green tests remain green) — verified by `cd flint-mcp && npm test`',
        },
    ],
    invariants: [
        {
            name: 'tailwindConfigLoader-load-p95',
            measurable:
                'p95 wall-clock latency of tailwindConfigLoader.load() on a 10KB Tailwind config with 3 presets',
            threshold: '< 500ms at p95 over 50 consecutive calls on a cold cache',
            measuredBy:
                'vitest bench in flint-mcp/src/core/__tests__/tailwindConfigLoader.bench.ts using a canonical 10KB fixture',
        },
        {
            name: 'tailwindConfigLoader-cache-hit',
            measurable: 'p95 latency of cached tailwindConfigLoader.load() when mtimeMs is unchanged',
            threshold: '< 10ms at p95 over 1000 calls',
            measuredBy:
                'vitest bench case `cache-hit warm` in flint-mcp/src/core/__tests__/tailwindConfigLoader.bench.ts — one cold load() to populate the cache, then 1000 back-to-back load() calls on the same projectRoot with mtime untouched',
        },
        {
            name: 'classExpressionExpander-correctness',
            measurable:
                'Fraction of the 50-fixture expander corpus where expandAll output matches the classes produced by the real utility at runtime (clsx/cva/classnames/twMerge)',
            threshold: '>= 0.95 (at least 48/50 fixtures match runtime output)',
            measuredBy:
                'flint-mcp/src/core/__tests__/classExpressionExpander.fidelity.test.ts — each fixture runs the utility at runtime and diffs against expandAll output',
        },
        {
            name: 'coverage-upgrade-parity',
            measurable:
                'Fraction of the classifier test corpus that, when classExpansions reports all resolvable, flips from dynamic-class-expression to parsed',
            threshold: '= 1.0 (100% of static-resolvable fixtures flip; 0 fixtures with unresolvable: true flip)',
            measuredBy:
                'coverageClassifier.test.ts — new "Phase 1 upgrade" describe block comparing classifier verdicts before and after injecting classExpansions',
        },
        {
            name: 'phase0-grade-formula-stability',
            measurable:
                'Delta in debt-report healthScore + letter grade when running the same fixture corpus before and after Phase 1 with no NEW violations exposed',
            threshold:
                '= 0 (grade formula MUST NOT change in Phase 1 — Phase 0 non-goal #2 still binding). Grade deltas caused by NEW violations exposed by expansion ARE allowed; grade deltas caused by formula changes are NOT.',
            measuredBy:
                'flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts — add a Phase 1 parity test that holds violations constant and asserts grade == grade',
        },
        {
            name: 'auditAll-signature-stability',
            measurable: 'Number of pre-Phase-1 `auditAll(...)` call sites in flint-mcp/src that require modification to compile',
            threshold: '= 0 (signature unchanged — additive options only)',
            measuredBy:
                '`npx tsc --noEmit` on flint-mcp before and after Phase 1 on an unchanged call-site fixture file',
        },
    ],
    risks: [
        {
            risk:
                'Tailwind resolveConfig transitively loads user presets that import Node built-ins — running in our MCP process could leak env/fs access or slow the audit pipeline. Critical gotcha: esbuild alone only TRANSPILES source; it does not sandbox the Node runtime, so `require("fs")` inside a preset still works after transpilation. The sandbox must block the runtime, not just the syntax.',
            severity: 'high',
            commandment: 14,
            mitigation:
                // Explicit mechanism (per contract-linter WARNING-5):
                //   1. Transpile the user config with `esbuild.transformSync(source, { loader: "ts", format: "cjs", target: "node20", sourcefile: configPath })` — handles TS + ESM → CJS, NO bundling.
                //   2. Evaluate the transpiled JS inside `vm.runInNewContext(code, sandbox, { timeout: 2000, displayErrors: true })`.
                //      `sandbox` is a frozen object containing ONLY:
                //        - `module: { exports: {} }`, `exports: module.exports`, `__filename`, `__dirname`
                //        - `Buffer`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `console` (shimmed to a noop)
                //        - A custom `require` function (see step 3).
                //      NOTHING ELSE. No `process`, no `global`, no `fs`, no `http`, no `fetch`, no `import`,
                //      no `setTimeout` (runInNewContext timeout kills runaway loops).
                //   3. Custom `require(id)` resolver with an ALLOWLIST:
                //        - `tailwindcss` and any `tailwindcss/*` subpath — required for resolveConfig.
                //        - Packages matching `/^@tailwindcss\//` (official Tailwind presets).
                //        - Packages matching `/^tailwindcss-[a-z0-9-]+$/` (community presets — lexical match; no version negotiation).
                //      ANY other specifier throws `new Error("sandbox-violation: require(\"" + id + "\") blocked")`.
                //      Resolved allowed modules are loaded with `createRequire(configPath)` but themselves wrapped:
                //      each preset is re-evaluated inside the SAME sandbox via a second runInNewContext so a malicious
                //      preset cannot escape by calling a Node built-in that was present when the parent app loaded it.
                //   4. Wrap the entire load in a 2000ms hard timeout (runInNewContext's `timeout` option handles CPU;
                //      a wall-clock `AbortController` + Promise.race handles event-loop starvation).
                //   5. Any thrown error containing "sandbox-violation" or matching ReferenceError for `process`/`fs`/`require`
                //      maps to `{ ok: false, error: "sandbox-violation", details: <redacted message> }`.
                //      Details string MUST NOT include arg values from the offending call (redact to `fs.readFileSync(<redacted>)`).
                //   6. The VM cannot spawn child processes because `child_process` is not in the allowlist.
                //      Worker threads are unreachable for the same reason. No fs → no child_process bootstrap path.
                'vm.runInNewContext in an allowlisted sandbox (no process/fs/http/fetch) + esbuild transpile for TS + custom require resolver allowlisting tailwindcss + @tailwindcss/* + tailwindcss-*; 2s CPU timeout + wall-clock AbortController; all thrown built-in ReferenceErrors map to sandbox-violation with redacted details. See inline comment in tailwindConfigLoader.ts for the full enforcement checklist.',
        },
        {
            risk:
                'Tailwind v3 and v4 emit different resolved theme shapes — a v4-specific key (e.g. CSS-variable references) could crash the downstream Mithril token merge',
            severity: 'medium',
            commandment: 9,
            mitigation:
                'Version-tag the ResolvedTailwindTheme (v3 | v4-js) and branch the token normalizer; unit-test both fixtures; fall back to empty theme on unknown shapes rather than crashing',
        },
        {
            risk:
                'classExpressionExpander over-reports `possible` classes, causing a spike in new Mithril drift warnings that overwhelms users who previously had clean audits',
            severity: 'medium',
            mitigation:
                'Document in HANDOFF that Phase 1 EXPOSES pre-existing drift; surface it in the debt-report release notes; the `possible` channel is treated as advisory for amber-tier rules where the class only appears conditionally',
        },
        {
            risk:
                'The expander mutates or re-traverses the AST, causing later linter passes to misattribute loc info',
            severity: 'high',
            commandment: 13,
            mitigation:
                'Expander is read-only — accepts pre-parsed AST, uses @babel/traverse visitor pattern without calling path.replaceWith; unit-test asserts AST object identity unchanged after expandAll',
        },
        {
            risk:
                'Tailwind v4 CSS-first @theme blocks silently fail to resolve and the file stays `tailwind-config-extension` forever — users perceive no Phase 1 win',
            severity: 'low',
            mitigation:
                'Explicit error code `v4-css-first-unsupported` + note in debt-report popover pointing to Phase 2 roadmap; classifier keeps current reason unchanged',
        },
        {
            risk:
                'Adding tailwindcss as a dependency bloats the flint-gate CLI bundle',
            severity: 'low',
            mitigation:
                'tailwindcss is imported only inside tailwindConfigLoader.load() via dynamic `await import("tailwindcss/resolveConfig.js")`; bundler tree-shakes when the loader is unused; size delta asserted < 5MB in PR review',
        },
    ],
    parallelismGroups: {
        // Group A: config loader + expander — zero-dependency pure services.
        // classifier upgrade is trivial and piggybacks on the expander author.
        A: ['flint-mcp-specialist', 'flint-ast-surgeon'],
        // Group B: test scaffolds from testBoundaries. Runs in parallel with A
        // for the scaffolds (it.todo), fills in real assertions after A lands.
        B: ['flint-test-writer'],
    },
    nonGoals: [
        'Not resolving Tailwind v4 CSS-first `@theme` blocks. v4 lets you declare theme values in CSS via `@theme { --color-primary: #0066cc; }`. Parsing external CSS is Phase 2 work. Phase 1 loads JS/TS/MJS/CJS configs only; CSS-first v4 projects are flagged as `v4-css-first-unsupported` and their files retain `tailwind-config-extension` in the coverage classifier.',
        'Not executing arbitrary TypeScript I/O in config files. tailwind.config.ts is loaded via esbuild + in-memory eval in a sandbox that intercepts fs/net/env access. If the config does dynamic disk reads, env reads, or network calls, the loader fails with `sandbox-violation` and the file retains `tailwind-config-extension`.',
        'Not attempting full static evaluation of `cva` returned functions. cva produces a function — classExpressionExpander captures variant class strings from the literal `variants` object AND the base arg, but does NOT evaluate the runtime-selected variant. If the user writes `button({ intent: "primary" })`, Mithril sees the union of all possible variant classes, not just the selected one.',
        'Not expanding imported non-literal class objects from other files. If `baseClasses` is imported from `./utils.ts`, the call is marked `unresolvable: true` and the classifier retains `dynamic-class-expression`. Cross-file resolution is a Phase 2+ consideration.',
        'Not auto-fixing the newly-exposed drift. Phase 1 EXPOSES more drift by unblocking previously-skipped expressions. User-initiated `flint_fix` handles the fixing — Phase 1 introduces no new auto-fix paths.',
        'Not adding new MCP tools. Existing `audit_ui_component` / `flint_audit` / `flint_debt_report` benefit automatically. No new entries in server.ts.',
        'Not changing the debt-grade formula (Phase 0 non-goal #2 still binding). Coverage % remains informational and Phase 1 does not alter the A-F grade calculation.',
        'Not touching Glass UI — the CoverageBadge / CoveragePopover / StatusBar updates through Phase 0 pipeline automatically when classifier verdicts change. Zero src/ changes.',
    ],
}
