/**
 * PHASE 0 — Coverage Honesty
 *
 * Executable contract. Phase 2 agents import types directly from this file.
 * Phase 1.5 (flint-contract-linter) validates this compiles and its CONTRACT
 * constant satisfies contract-schema v2 (audience, falsifiable invariants,
 * executable given/when/then, IPC validators, non-empty nonGoals).
 *
 * Purpose of Phase 0:
 *   Make Flint honest about what it governs vs. what it silently skipped.
 *   Every audit operation emits a per-file `CoverageVerdict` with a structured
 *   reason code. The governed-surface-area % is surfaced in the debt report,
 *   `flint://dashboard`, `flint://session-context`, and the Glass StatusBar.
 *
 * What Phase 0 is NOT:
 *   - Not parsing new file types (CSS Modules, styled-components, Tailwind
 *     config, Vue SFC, etc.) — that's Phases 1–2.
 *   - Not a new violation category — coverage is informational.
 *   - Not a new export-gate condition — observability only.
 */

import type { FlintContract } from '../../shared/contract-schema'

// ─────────────────────────────────────────────────────────────────────
// Core Coverage Types — consumed by MithrilLinter, A11yLinter,
// DebtReportService, IPC layer, StatusBar badge, web parity server.
// ─────────────────────────────────────────────────────────────────────

/**
 * Why a file could not be fully governed.
 *
 * Single enum used by both linters and by the debt-report aggregation.
 * Order is stable — serialized values must not be renamed without a
 * migration. New reasons append to the end.
 */
export type CoverageReason =
    | 'css-in-js-detected'          // styled-components, emotion, stitches, styled-jsx
    | 'external-stylesheet-imported' // `import './x.css'`, `.scss`, `.module.css` side-effect import
    | 'css-modules-reference'       // `className={styles.foo}` where styles came from `*.module.css`
    | 'dynamic-class-expression'    // clsx, cva, classnames, tw-merge, template literals with vars
    | 'unresolvable-var'            // bare `var(--x)` with no fallback and no local :root rule
    | 'tailwind-config-extension'   // `tailwind.config.{js,ts,cjs,mjs}` present but not ingested
    | 'non-jsx-framework'           // `.vue`, `.svelte`, Angular component templates detected
    | 'non-literal-ternary-branch'  // `className={cond ? a : dynamic}` where a branch is non-literal

/**
 * Per-file coverage verdict emitted once per scanned file.
 *
 * `status` semantics:
 *   - `parsed`              — File fully governed. `reason` MUST be null.
 *   - `partial`             — File parsed but at least one styling pattern was
 *                             out of scope. `reason` is the primary trigger;
 *                             `details` may cite file:line for the first hit.
 *   - `skipped-unsupported` — File not parsed at all (wrong framework, binary,
 *                             config-only). `reason` MUST be non-null.
 *
 * Invariant: (status === 'parsed') iff (reason === null).
 */
export interface CoverageVerdict {
    status: 'parsed' | 'partial' | 'skipped-unsupported'
    reason: CoverageReason | null
    /** Optional human-readable marker (e.g. "styled-components tagged template at line 42"). */
    details?: string
}

/**
 * Per-reason count map used by the debt report and the StatusBar popover.
 * Every CoverageReason is present; absent reasons report 0.
 */
export type SkippedFilesByReason = Record<CoverageReason, number>

/**
 * Aggregate coverage shape returned by `flint_debt_report`,
 * `flint://dashboard`, `flint://session-context`, and the new
 * `flint:getCoverageSummary` IPC channel.
 *
 * Invariants (verified by classifier tests and Phase 3 integration):
 *   - totalFiles === parsedFiles + partialFiles + skippedFiles
 *   - governedSurfacePercent === round1((parsedFiles / totalFiles) * 100)
 *     (totalFiles === 0 maps to governedSurfacePercent === 0)
 *   - skippedFilesByReason sums across all values === (partialFiles + skippedFiles)
 */
export interface CoverageSummary {
    /** Governed-surface percentage (parsed / total) * 100, rounded to 1 dp. */
    governedSurfacePercent: number
    /** Every file the classifier saw, regardless of outcome. */
    totalFiles: number
    /** status === 'parsed' count. */
    parsedFiles: number
    /** status === 'partial' count. */
    partialFiles: number
    /** status === 'skipped-unsupported' count. */
    skippedFiles: number
    /**
     * Count of files that were partial OR skipped, grouped by reason.
     * Every CoverageReason key is present (0 if none).
     */
    skippedFilesByReason: SkippedFilesByReason
    /** ISO 8601 UTC timestamp the summary was generated. */
    timestamp: string
}

// ─────────────────────────────────────────────────────────────────────
// Classifier Input/Output — pure function contract.
// Used by MithrilLinter + A11yLinter as a shared single-file classifier.
// ─────────────────────────────────────────────────────────────────────

/**
 * Everything the classifier needs to reach a verdict. All inputs are
 * already available where MithrilLinter/A11yLinter are invoked, so the
 * classifier adds no new I/O.
 *
 * `ast` is optional: when the file could not be parsed at all (binary,
 * Vue SFC, Svelte, Angular), classifier returns 'skipped-unsupported'
 * using only `filePath` + `source`.
 */
export interface CoverageInput {
    /** Absolute or project-relative path. Used to detect extension + framework. */
    filePath: string
    /** Full source text. Used for regex-free AST-based detection when `ast` is provided;
     *  falls back to framework-extension signature checks when AST is absent. */
    source: string
    /** Babel `File` node, or null if parsing failed / wrong framework. */
    ast: unknown | null
    /** Optional import graph for the project — enables external-stylesheet detection
     *  (`import './x.css'`). When omitted, classifier uses AST-local import declarations only. */
    projectImportGraph?: ReadonlyMap<string, readonly string[]>
    /** Optional flag that `tailwind.config.*` exists at project root but was not
     *  ingested. When true and the file uses Tailwind classes, classifier upgrades
     *  verdict to `partial` with reason `tailwind-config-extension`. */
    tailwindConfigUnparsed?: boolean
}

// ─────────────────────────────────────────────────────────────────────
// Linter Result Extension — both linters gain optional `coverage` field.
// MUST be optional to preserve backward compatibility with existing callers.
// ─────────────────────────────────────────────────────────────────────

/**
 * Additive extension to linter audit results. `CoverageVerdict` is attached
 * to each file's audit output; pre-existing shapes are unchanged.
 */
export interface LinterResultWithCoverage {
    /** Present on every audit result produced after Phase 0 ships. */
    coverage: CoverageVerdict
}

// ─────────────────────────────────────────────────────────────────────
// Debt Report Extension — additive fields on the existing DebtReport.
// No field removed, no field renamed. Grade formula unchanged.
// ─────────────────────────────────────────────────────────────────────

/**
 * Additive fields layered onto `DebtReport` (flint-mcp/src/core/dashboard/types.ts).
 * Carries the `CoverageSummary` without touching `healthScore` or `grade`.
 * The grade formula explicitly does NOT include coverage (non-goal #2).
 */
export interface DebtReportCoverageExtension {
    coverage: CoverageSummary
}

// ─────────────────────────────────────────────────────────────────────
// Dashboard Extension — additive fields on DashboardData payload.
// ─────────────────────────────────────────────────────────────────────

export interface DashboardCoverageExtension {
    coverage: CoverageSummary
}

// ─────────────────────────────────────────────────────────────────────
// Session Context Extension — adds `coverage` to SessionContext snapshot.
// Consumed by `flint_get_context` tool and `flint://session-context` resource.
// ─────────────────────────────────────────────────────────────────────

export interface SessionContextCoverageExtension {
    coverage: CoverageSummary
}

// ─────────────────────────────────────────────────────────────────────
// IPC Contract — renderer→main channel for the StatusBar badge.
// Zod validator exported from shared/ipc-validators.ts as
// `getCoverageSummaryPayloadSchema`. Payload is undefined (no args).
// ─────────────────────────────────────────────────────────────────────

/** Payload for `flint:getCoverageSummary`. Channel takes no arguments. */
export type GetCoverageSummaryPayload = undefined

/** Response shape for `flint:getCoverageSummary`. Mirrors CoverageSummary exactly. */
export type GetCoverageSummaryResponse = CoverageSummary

// ─────────────────────────────────────────────────────────────────────
// Component Contract — CoverageBadge in the StatusBar.
// ─────────────────────────────────────────────────────────────────────

export interface CoverageBadgeProps {
    /** Current coverage summary. null while the first IPC request is in flight. */
    summary: CoverageSummary | null
    /** Called when the badge is clicked; parent owns popover open state. */
    onClick: () => void
}

export interface CoveragePopoverProps {
    /** Snapshot to render breakdowns from. */
    summary: CoverageSummary
    /** Dismiss callback — closes popover on click-away or Escape. */
    onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────
// Machine-Readable Contract
// ─────────────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'Phase0-CoverageHonesty',
        phase: 'PHASE0',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-18',
        // Phase 0 is an engine feature first — the classifier, linter wiring,
        // debt-report extension, and MCP resource/context extensions are all
        // engine work. The StatusBar badge is a thin read-only surface of
        // engine output. Per the Feature Budget Framework's dual-audience
        // rule, this remains a single `engine` feature because the designer
        // surface is strictly informational. If the popover ever grows its
        // own actions (filter, mute, annotate), it becomes a split.
        audience: 'engine',
    },

    impact: [
        // ── Shared types (Phase 2 Group A blocker) ───────────────────────
        {
            file: 'shared/coverage-types.ts',
            changeType: 'CREATE',
            owner: 'flint-state-architect',
            summary: 'Create shared CoverageVerdict / CoverageReason / CoverageSummary types. Imported by MCP engine AND Glass renderer AND server/ web adapter.',
        },
        {
            file: 'shared/ipc-validators.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Add Zod schemas for `flint:getCoverageSummary` channel (undefined payload, CoverageSummary response).',
        },

        // ── MCP engine: classifier + linter wiring + debt/dashboard/context ──
        {
            file: 'flint-mcp/src/core/coverageClassifier.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary: 'Pure function that takes CoverageInput and returns CoverageVerdict. Single responsibility: classify styling surface area. No side effects, no I/O beyond what the caller already did.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/coverageClassifier.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Unit tests: one `it` per CoverageReason triggering correctly, plus `parsed` happy-path and reason-null invariant.',
        },
        {
            file: 'flint-mcp/src/core/MithrilLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Invoke coverageClassifier once per file in auditAll() and attach CoverageVerdict to the returned result. Classifier is called exactly once per file (deduplicated with A11yLinter via a shared cache passed by the caller).',
        },
        {
            file: 'flint-mcp/src/core/A11yLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Accept optional pre-computed CoverageVerdict from the caller and surface it on the audit result. Does NOT re-run the classifier — the MithrilLinter run already did.',
        },
        {
            file: 'flint-mcp/src/core/dashboard/debtReportService.ts',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary: 'Aggregate per-file CoverageVerdicts into a CoverageSummary. Attach to DebtReport as additive `coverage` field. Grade formula unchanged.',
        },
        {
            file: 'flint-mcp/src/core/dashboard/types.ts',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary: 'Extend DebtReport and DashboardData interfaces with `coverage: CoverageSummary` (re-exported from shared/coverage-types.ts).',
        },
        {
            file: 'flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Integration test: scan fixture project with 3 parsed + 1 partial + 1 skipped → governedSurfacePercent ≈ 60%, skippedFilesByReason sums to 2.',
        },
        {
            file: 'flint-mcp/src/server.ts',
            changeType: 'MODIFY',
            owner: 'flint-mcp-specialist',
            summary: 'Include `coverage` in `flint://dashboard` and `flint://session-context` resource payloads. `flint_get_context` tool response includes the same shape.',
        },

        // ── Electron main: IPC handler + web-build parity ────────────────
        {
            file: 'electron/main.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Register `flint:getCoverageSummary` IPC handler that delegates to DebtReportService (already instantiated for other handlers) and returns CoverageSummary.',
        },
        {
            file: 'electron/preload.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Expose `coverage.getSummary()` on `window.flintAPI` via contextBridge. Uses the validated invoker (validateIPC + validateIPCResponse).',
        },
        {
            file: 'server/index.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Mirror `flint:getCoverageSummary` as an HTTP endpoint for the web build. Same Zod schema, same response shape.',
        },
        {
            file: 'src/adapters/web-api.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Add `coverage.getSummary()` to the browser-side flintAPI adapter so the same React code works in Glass + Web.',
        },
        {
            file: 'src/types/flint-api.d.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Extend FlintAPI type with `coverage: { getSummary(): Promise<CoverageSummary> }`.',
        },

        // ── Glass UI: StatusBar badge + popover ──────────────────────────
        {
            file: 'src/components/editor/CoverageBadge.tsx',
            changeType: 'CREATE',
            owner: 'flint-design-engineer',
            summary: 'Green/amber dot + "X% governed" label. Mounts in StatusBar. Reads CoverageSummary via useCoverageSummary hook. Click opens popover.',
        },
        {
            file: 'src/components/editor/CoveragePopover.tsx',
            changeType: 'CREATE',
            owner: 'flint-design-engineer',
            summary: 'Lists total files + parsed + partial + skipped counts, plus one row per non-zero reason with its human-readable label.',
        },
        {
            file: 'src/components/editor/StatusBar.tsx',
            changeType: 'MODIFY',
            owner: 'flint-design-engineer',
            summary: 'Mount <CoverageBadge /> in the existing StatusBar element list. No other visual changes.',
        },
        {
            file: 'src/hooks/useCoverageSummary.ts',
            changeType: 'CREATE',
            owner: 'flint-state-architect',
            summary: 'Hook that calls window.flintAPI.coverage.getSummary() on mount and on every `mcp-event` push message with `eventType === "debt-scan-complete"` (existing channel — no new IPC surface). Never reads a Zustand store directly. Lives as a hook, not in a store (coverage is derived, not owned).',
        },
        {
            file: 'src/components/editor/__tests__/CoverageBadge.test.tsx',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Render tests: green dot at 100%, amber at <100%, "—" when summary is null. Click fires onClick.',
        },
        {
            file: 'src/components/editor/__tests__/CoveragePopover.test.tsx',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Render tests: breakdown rows match skippedFilesByReason, close-on-Escape works, only non-zero reasons are shown.',
        },
        {
            file: 'electron/__tests__/coverageIpc.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'IPC round-trip test: invoke `flint:getCoverageSummary` against the real main-process handler, assert response matches CoverageSummary shape.',
        },
    ],

    ipc: [
        {
            channel: 'flint:getCoverageSummary',
            direction: 'renderer→main',
            payloadType: 'undefined',
            returnType: 'CoverageSummary',
            handler: 'electron/main.ts',
            validator: 'getCoverageSummaryPayloadSchema',
        },
    ],

    // Coverage is derived, not owned. There is NO store slice for it.
    // The hook fetches from IPC; no Zustand store is added. This matches
    // Architectural Anti-Pattern guidance: don't put IPC in a store.
    stores: [],

    components: [
        {
            name: 'CoverageBadge',
            file: 'src/components/editor/CoverageBadge.tsx',
            propsType: 'CoverageBadgeProps',
            consumesStores: [],
            emitsIPC: ['flint:getCoverageSummary'],
        },
        {
            name: 'CoveragePopover',
            file: 'src/components/editor/CoveragePopover.tsx',
            propsType: 'CoveragePopoverProps',
            consumesStores: [],
            emitsIPC: [],
        },
    ],

    commandments: [
        // C2 No Hallucinated Styling — CoverageBadge dot color (emerald/amber/zinc)
        // must come from the existing StatusBar semantic-color classes shared with
        // SyncStatus and the Figma dot helper (`figmaDotColor`). No new raw
        // `bg-emerald-500` / `bg-amber-500` literals; reuse the StatusBar token map.
        2,
        // C4 Local-First Only — classifier and badge are fully offline; no network calls.
        4,
        // C5 Accessibility is a Compiler Error — CoverageBadge is an interactive
        // button; it MUST carry an accessible name via `aria-label` that conveys
        // the governed percentage (e.g. "Governance coverage: 60% of files governed.
        // Click to see breakdown.").
        5,
        // C13 Deterministic Surgery — classifier uses Babel AST traversal, never regex on source.
        13,
        // C14 Bypass Prohibition — no new fs.readFile calls from src/; all reads through IPC/DB.
        14,
    ],

    testBoundaries: [
        {
            target: 'coverageClassifier — parsed happy path',
            kind: 'service',
            behavior: 'Pure Tailwind className={string literal} file produces status="parsed" with reason=null.',
            assertion: 'returns { status: "parsed", reason: null }',
            edgeCases: ['empty file', 'file with only imports', 'file with only JSX and no className'],
            given: 'a parsed Babel AST of a file using only static Tailwind class literals and no external stylesheet imports',
            when: 'coverageClassifier(input) is invoked with a valid CoverageInput',
            then: 'returns { status: "parsed", reason: null, details: undefined }',
        },
        {
            target: 'coverageClassifier — css-in-js-detected',
            kind: 'service',
            behavior: 'File containing a styled-components tagged template produces partial + css-in-js-detected.',
            assertion: 'returns { status: "partial", reason: "css-in-js-detected" }',
            edgeCases: ['@emotion/styled import', 'stitches createStitches', 'styled-jsx <style jsx>'],
            given: 'a parsed AST of a file importing styled-components and using styled.div`...`',
            when: 'coverageClassifier(input) is invoked',
            then: 'returns status "partial" with reason "css-in-js-detected" and details citing the tagged-template line',
        },
        {
            target: 'coverageClassifier — external-stylesheet-imported',
            kind: 'service',
            behavior: 'File with `import "./styles.css"` sets reason to external-stylesheet-imported.',
            assertion: 'returns { status: "partial", reason: "external-stylesheet-imported" }',
            edgeCases: ['.scss import', '.sass import', '.module.css import', 'bare @import not supported'],
            given: 'a parsed AST of a file with a side-effect import of ./styles.css',
            when: 'coverageClassifier(input) runs with projectImportGraph omitted',
            then: 'returns status "partial" with reason "external-stylesheet-imported"',
        },
        {
            target: 'coverageClassifier — css-modules-reference',
            kind: 'service',
            behavior: 'className={styles.foo} where `styles` came from a `*.module.css` import sets reason to css-modules-reference.',
            assertion: 'returns { status: "partial", reason: "css-modules-reference" }',
            edgeCases: ['styles.foo vs s.foo aliasing', 'nested s.foo.bar (bail out, still reports)'],
            given: 'a parsed AST with `import s from "./x.module.css"` and JSX attribute `className={s.active}`',
            when: 'coverageClassifier(input) runs',
            then: 'returns status "partial" with reason "css-modules-reference"',
        },
        {
            target: 'coverageClassifier — dynamic-class-expression',
            kind: 'service',
            behavior: 'Calls to clsx/cva/classnames/tw-merge or template literals in className produce dynamic-class-expression.',
            assertion: 'returns { status: "partial", reason: "dynamic-class-expression" }',
            edgeCases: ['clsx() call', 'cva() call', 'classnames() call', 'tw-merge() call', 'template literal `text-${color}`'],
            given: 'a parsed AST with a JSX attribute `className={clsx("a", cond && "b")}`',
            when: 'coverageClassifier(input) runs',
            then: 'returns status "partial" with reason "dynamic-class-expression"',
        },
        {
            target: 'coverageClassifier — unresolvable-var',
            kind: 'service',
            behavior: 'style={{ color: "var(--brand)" }} with no fallback and no local :root rule sets reason to unresolvable-var.',
            assertion: 'returns { status: "partial", reason: "unresolvable-var" }',
            edgeCases: ['var(--x, #fff) — with fallback passes', 'var(--x) with local :root definition passes'],
            given: 'a parsed AST with an inline style using `var(--brand)` and no fallback argument',
            when: 'coverageClassifier(input) runs',
            then: 'returns status "partial" with reason "unresolvable-var"',
        },
        {
            target: 'coverageClassifier — tailwind-config-extension',
            kind: 'service',
            behavior: 'When tailwindConfigUnparsed=true and the file uses Tailwind classes, classifier reports tailwind-config-extension.',
            assertion: 'returns { status: "partial", reason: "tailwind-config-extension" }',
            edgeCases: ['tailwindConfigUnparsed=false → classifier does NOT emit this reason', 'file has no Tailwind classes → no emission'],
            given: 'a CoverageInput with tailwindConfigUnparsed=true and a parsed AST using class="text-brand-primary"',
            when: 'coverageClassifier(input) runs',
            then: 'returns status "partial" with reason "tailwind-config-extension"',
        },
        {
            target: 'coverageClassifier — non-jsx-framework',
            kind: 'service',
            behavior: 'Vue SFC / Svelte / Angular template file (ast === null, extension match) produces skipped-unsupported.',
            assertion: 'returns { status: "skipped-unsupported", reason: "non-jsx-framework" }',
            edgeCases: ['.vue file', '.svelte file', 'Angular .component.html'],
            given: 'a CoverageInput with filePath ending in ".vue" and ast=null',
            when: 'coverageClassifier(input) runs',
            then: 'returns status "skipped-unsupported" with reason "non-jsx-framework"',
        },
        {
            target: 'coverageClassifier — non-literal-ternary-branch',
            kind: 'service',
            behavior: 'className={cond ? "static" : someVar} with a non-literal branch produces non-literal-ternary-branch.',
            assertion: 'returns { status: "partial", reason: "non-literal-ternary-branch" }',
            edgeCases: ['both branches literal → status parsed', 'nested ternary with one identifier branch'],
            given: 'a parsed AST with JSX attribute `className={isActive ? "a" : dynVar}`',
            when: 'coverageClassifier(input) runs',
            then: 'returns status "partial" with reason "non-literal-ternary-branch"',
        },
        {
            target: 'coverageClassifier — status/reason invariant',
            kind: 'service',
            behavior: '(status === "parsed") iff (reason === null) across every classifier output.',
            assertion: 'emits verdicts where parsed implies null reason and non-parsed implies non-null reason',
            edgeCases: ['every CoverageReason must be produced by at least one test', 'parsed output never carries a reason'],
            given: 'a property-based generator that yields 100 diverse CoverageInput fixtures',
            when: 'coverageClassifier is invoked on each',
            then: 'returns results where every parsed verdict has reason=null and every non-parsed verdict has reason≠null',
        },
        {
            target: 'MithrilLinter.auditAll — coverage propagation',
            kind: 'service',
            behavior: 'auditAll attaches CoverageVerdict to each file result without altering existing warning shape.',
            assertion: 'sets result.coverage to the classifier output',
            edgeCases: ['file with no warnings still gets coverage', 'file with 100 warnings still gets exactly one coverage'],
            given: 'a project fixture with 3 .tsx files and a MithrilLinter invocation',
            when: 'auditAll is called',
            then: 'returns a result where each of the 3 files has exactly one CoverageVerdict attached',
        },
        {
            target: 'A11yLinter.auditStructured — coverage passthrough',
            kind: 'service',
            behavior: 'Linter accepts a pre-computed CoverageVerdict from the caller and does not re-run classification.',
            assertion: 'calls classifier zero times when caller supplies verdict',
            edgeCases: ['caller omits verdict → classifier runs once', 'caller supplies verdict → classifier runs zero times'],
            given: 'an A11yLinter invocation where the caller has already computed a CoverageVerdict for the file',
            when: 'auditStructured is called with { preComputedCoverage }',
            then: 'calls classifier 0 times and attaches the supplied verdict to the result',
        },
        {
            target: 'debtReportService — aggregation math',
            kind: 'service',
            behavior: 'Given 3 parsed + 1 partial + 1 skipped, CoverageSummary reports governedSurfacePercent ≈ 60%.',
            assertion: 'returns governedSurfacePercent === 60.0 and sums to totalFiles===5',
            edgeCases: ['0 files scanned → governedSurfacePercent=0 and totalFiles=0', 'all parsed → 100%', 'all skipped → 0%'],
            given: 'a DebtReportService run against a fixture with 3 parsed .tsx, 1 styled-components file, 1 .vue file',
            when: 'the debt report is generated',
            then: 'returns coverage with governedSurfacePercent=60, parsedFiles=3, partialFiles=1, skippedFiles=1, and skippedFilesByReason sums to 2',
        },
        {
            target: 'flint:getCoverageSummary IPC handler',
            kind: 'ipc-handler',
            behavior: 'IPC handler returns the current CoverageSummary from DebtReportService.',
            assertion: 'returns CoverageSummary matching Zod schema',
            edgeCases: ['no debt scan yet → empty summary with totalFiles=0', 'scan in progress → last completed snapshot'],
            given: 'the electron main process has a DebtReportService with a completed debt scan',
            when: 'the renderer invokes window.flintAPI.coverage.getSummary()',
            then: 'returns a CoverageSummary that passes the Zod response schema and has timestamp !== ""',
        },
        {
            target: 'CoverageBadge render — 100% state',
            kind: 'component',
            behavior: 'Renders healthy-state dot + "100% governed" when all files parsed.',
            assertion: 'renders an element with data-coverage-state="healthy" and visible text "100% governed"',
            edgeCases: ['totalFiles=0 → render "—" placeholder with data-coverage-state="idle"'],
            given: 'CoverageBadge is rendered with summary={governedSurfacePercent: 100, parsedFiles: 10, partialFiles: 0, skippedFiles: 0, totalFiles: 10, skippedFilesByReason: {...zeroes}, timestamp: "..."}',
            when: 'the component mounts',
            then: 'renders element with data-coverage-state="healthy" and text "100% governed"',
        },
        {
            target: 'CoverageBadge render — <100% state',
            kind: 'component',
            behavior: 'Renders warning-state dot + "X% governed" when any files partial or skipped.',
            assertion: 'renders an element with data-coverage-state="warning" and visible text matching /60%\\s+governed/',
            edgeCases: ['summary=null → data-coverage-state="idle" placeholder', 'governedSurfacePercent 0 → still warning (not critical — coverage is informational)'],
            given: 'CoverageBadge is rendered with summary.governedSurfacePercent=60',
            when: 'the component mounts',
            then: 'renders element with data-coverage-state="warning" and text "60% governed"',
        },
        {
            target: 'CoverageBadge — accessible name',
            kind: 'component',
            behavior: 'CoverageBadge carries an aria-label that conveys the governed percentage and hints at the popover.',
            assertion: 'sets aria-label matching /Governance coverage:\\s+\\d+%\\s+of files governed.\\s+Click to see breakdown/',
            edgeCases: ['summary=null → aria-label falls back to "Governance coverage: loading"', 'governedSurfacePercent 100 → label reads "100%"'],
            given: 'CoverageBadge is rendered with summary.governedSurfacePercent=60',
            when: 'the component mounts',
            then: 'sets aria-label to "Governance coverage: 60% of files governed. Click to see breakdown."',
        },
        {
            target: 'CoverageBadge click → popover open',
            kind: 'component',
            behavior: 'Clicking the badge fires onClick within 50ms of the mousedown event.',
            assertion: 'calls onClick exactly once on click',
            edgeCases: ['keyboard Enter triggers click', 'rapid double-click fires onClick twice (parent dedupes)'],
            given: 'CoverageBadge rendered with a mock onClick handler',
            when: 'the user clicks the badge',
            then: 'calls onClick exactly once',
        },
        {
            target: 'CoveragePopover — breakdown rendering',
            kind: 'component',
            behavior: 'Popover lists one row per non-zero reason with its human-readable label.',
            assertion: 'renders exactly N <li> elements where N is the count of non-zero reasons',
            edgeCases: ['zero skipped files → "All files governed" empty state', 'all reasons non-zero → 8 rows'],
            given: 'CoveragePopover rendered with summary where skippedFilesByReason has 2 non-zero reasons (css-in-js-detected=3, non-jsx-framework=1)',
            when: 'the component mounts',
            then: 'renders 2 <li> elements, one labeled "CSS-in-JS" with count 3 and one labeled "Non-JSX framework" with count 1',
        },
    ],

    invariants: [
        {
            name: 'coverage-emit-parity',
            measurable: 'Ratio of CoverageVerdicts emitted to files scanned (emittedCount / scannedCount)',
            threshold: '= 1.0 across any debt-report run (no file scanned without a verdict)',
            measuredBy: 'instrumented debtReportService integration test asserting emittedCount === scannedCount',
        },
        {
            name: 'coverage-percent-math',
            measurable: 'Absolute error between reported governedSurfacePercent and (parsedFiles / totalFiles) * 100',
            threshold: '< 0.5 percentage points across all fixture runs',
            measuredBy: 'vitest table-driven test over 20 randomized fixtures',
        },
        {
            name: 'reason-completeness',
            measurable: 'Count of non-parsed verdicts whose `reason` is null',
            threshold: '= 0 across every classifier invocation in the test suite (100% coverage of the status/reason invariant)',
            measuredBy: 'property-based test in coverageClassifier.test.ts generating 100 random inputs',
        },
        {
            name: 'coverage-badge-click-latency',
            measurable: 'Time between CoverageBadge mousedown and onClick firing',
            threshold: '< 50ms at p95 under a 100-click benchmark',
            measuredBy: 'React Testing Library + performance.now() in CoverageBadge.bench.test.tsx',
        },
        {
            name: 'coverage-grade-independence',
            measurable: 'Delta between DebtReport.healthScore before and after Phase 0 classifier integration on an identical fixture',
            threshold: '= 0 (exact match — grade formula MUST NOT read coverage)',
            measuredBy: 'fixture test comparing debtReportService output with and without classifier',
        },
    ],

    risks: [
        {
            risk: 'Classifier heuristics produce false positives (e.g., unrelated `clsx`-named util flagged as dynamic-class-expression)',
            severity: 'medium',
            commandment: 13,
            mitigation: 'Match only when the imported `clsx` binding is used inside a JSX className attribute. Unit-test ambiguous cases (local variable named clsx, namespace imports, aliased imports).',
        },
        {
            risk: 'Classifier doubled the MithrilLinter runtime by re-parsing source',
            severity: 'medium',
            mitigation: 'Classifier takes the already-parsed AST from the caller. No new Babel parse calls. Cached verdict is passed from MithrilLinter into A11yLinter so neither linter re-classifies.',
        },
        {
            risk: 'StatusBar popover adds new popover plumbing to Glass',
            severity: 'low',
            mitigation: 'Mirror the existing FigmaConnectionPanel popover pattern in StatusBar.tsx — reuse the same click-away + focus-trap primitives. No new overlay library.',
        },
        {
            risk: 'Users confuse "60% governed" with "60/100 debt score" and assume coverage affects the grade',
            severity: 'medium',
            mitigation: 'Popover copy explicitly states "Coverage is informational — it does not change your grade." Documented as non-goal #2.',
        },
        {
            risk: 'Web build drift — electron/main.ts IPC change not mirrored in server/index.ts',
            severity: 'medium',
            mitigation: 'Single Phase 2 owner (flint-electron-ipc) owns BOTH electron/main.ts and server/index.ts for this channel. Integration validator diffs the two files for parity.',
        },
        {
            risk: 'CoverageReason enum values serialize into debt-history.json; renaming them later would corrupt trend history',
            severity: 'low',
            mitigation: 'Enum values are treated as stable wire-format strings. New reasons append only. Existing callers MUST pattern-match with a default branch.',
        },
    ],

    parallelismGroups: {
        // Group A — foundations. No inter-dependencies; can run fully in parallel.
        // flint-test-writer runs in Group A to generate TDD red-phase it.todo()
        // scaffolds for the classifier + IPC boundaries (no implementation deps).
        A: ['flint-state-architect', 'flint-electron-ipc', 'flint-ast-surgeon', 'flint-mcp-specialist', 'flint-test-writer'],
        // Group B — UI + fills in the Group-A scaffolds with real assertions now
        // that implementation exists.
        B: ['flint-design-engineer', 'flint-test-writer'],
    },

    nonGoals: [
        'Not attempting to parse unsupported patterns. Phase 0 is detection, not support. Mithril emits a coverage reason and moves on — it does NOT parse tagged-template bodies, CSS Module files, Tailwind config, Vue SFC, or Svelte templates.',
        'Not changing the debt grade formula. The A-F grade continues to reflect violations on the parsed surface only. Coverage % is a separate signal. Conflating them is a separate product decision.',
        'Not blocking the export gate based on coverage. A 60%-governed project still ships. Phase 0 is observability, not enforcement.',
        'Not emitting coverage as a violation. Coverage reasons are informational — they do not feed MithrilLinter.violations or affect health scores.',
        'Not backfilling coverage onto pre-Phase-0 mutations ledger entries. History rows predating Phase 0 remain coverage-free; only go-forward scans emit verdicts.',
    ],
}
