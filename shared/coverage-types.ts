/**
 * coverage-types.ts — shared/coverage-types.ts
 *
 * Phase 0 — Coverage Honesty
 *
 * Canonical type definitions for the coverage signal. Imported by:
 *   - flint-mcp/src/core/coverageClassifier.ts
 *   - flint-mcp/src/core/MithrilLinter.ts
 *   - flint-mcp/src/core/A11yLinter.ts
 *   - flint-mcp/src/core/dashboard/debtReportService.ts
 *   - electron/main.ts (IPC handler)
 *   - src/hooks/useCoverageSummary.ts
 *   - server/index.ts (web-parity mirror)
 *
 * Wire-format stability: `CoverageReason` values are serialized into
 * `.flint/debt-history.json`. They are append-only — do NOT rename
 * existing values. New reasons must be added at the end of the union.
 *
 * Invariant (enforced by coverageClassifier, verified in tests):
 *   (status === 'parsed') iff (reason === null)
 */

// ─── Status ─────────────────────────────────────────────────────────────────

/**
 * Per-file coverage classification produced once per scanned file.
 *
 * - `parsed`              — File fully governed. Implies `reason === null`.
 * - `partial`             — File parsed but one or more styling patterns fell
 *                           outside Flint's scope. `reason` names the primary
 *                           trigger; `details` may cite a file:line location.
 * - `skipped-unsupported` — File not parsed at all (wrong framework, binary,
 *                           or config-only). `reason` MUST be non-null.
 */
export type CoverageStatus = 'parsed' | 'partial' | 'skipped-unsupported'

// ─── Reason Codes ────────────────────────────────────────────────────────────

/**
 * Structured reason a file could not be fully governed.
 *
 * Order is stable — serialized values must not be renamed without a migration.
 * New reasons append to the end of the union.
 */
export type CoverageReason =
    | 'css-in-js-detected'           // styled-components, emotion, stitches, styled-jsx
    | 'external-stylesheet-imported' // `import './x.css'`, `.scss`, `.module.css` side-effect import
    | 'css-modules-reference'        // `className={styles.foo}` where styles came from `*.module.css`
    | 'dynamic-class-expression'     // clsx, cva, classnames, tw-merge, template literals with vars
    | 'unresolvable-var'             // bare `var(--x)` with no fallback and no local :root rule
    | 'tailwind-config-extension'    // `tailwind.config.{js,ts,cjs,mjs}` present but not ingested
    | 'non-jsx-framework'            // `.vue`, `.svelte`, Angular template files (.component.html)
    | 'non-literal-ternary-branch'   // `className={cond ? a : dynamic}` where a branch is non-literal
    | 'parse-failure'                // JS/TS file that could not be parsed (syntax error / unsupported syntax)

// ─── Per-file Verdict ────────────────────────────────────────────────────────

/**
 * Per-file coverage verdict emitted once per scanned file.
 *
 * Invariant: (status === 'parsed') iff (reason === null).
 * Any non-`parsed` status MUST carry a non-null `reason`.
 */
export interface CoverageVerdict {
    status: CoverageStatus
    /**
     * Reason the file is not fully governed.
     * MUST be non-null when `status !== 'parsed'`.
     * MUST be null when `status === 'parsed'`.
     */
    reason: CoverageReason | null
    /** Optional human-readable marker (e.g. "styled-components tagged template at line 42"). */
    details?: string
}

// ─── Aggregate Summary ───────────────────────────────────────────────────────

/**
 * Per-reason count map used by the debt report and the StatusBar popover.
 * Every `CoverageReason` key is always present; absent reasons report 0.
 */
export type SkippedFilesByReason = Record<CoverageReason, number>

/**
 * Aggregate coverage shape returned by `flint_debt_report`,
 * `flint://dashboard`, `flint://session-context`, and the
 * `flint:getCoverageSummary` IPC channel.
 *
 * Invariants:
 *   - totalFiles === parsedFiles + partialFiles + skippedFiles
 *   - governedSurfacePercent === round1((parsedFiles / totalFiles) * 100)
 *     (when totalFiles === 0, governedSurfacePercent === 0)
 *   - sum(skippedFilesByReason values) === (partialFiles + skippedFiles)
 *
 * This type does NOT feed the debt grade formula — coverage is informational.
 * Non-goal #2 of Phase 0: not changing the A-F grade.
 */
export interface CoverageSummary {
    /** Governed-surface percentage: (parsedFiles / totalFiles) * 100, rounded to 1 dp. */
    governedSurfacePercent: number
    /** Every file the classifier saw, regardless of outcome. */
    totalFiles: number
    /** Count of files with status === 'parsed'. */
    parsedFiles: number
    /** Count of files with status === 'partial'. */
    partialFiles: number
    /** Count of files with status === 'skipped-unsupported'. */
    skippedFiles: number
    /**
     * Files that were partial OR skipped, grouped by primary reason.
     * Every CoverageReason key is present (0 if no files hit that reason).
     */
    skippedFilesByReason: SkippedFilesByReason
    /** ISO 8601 UTC timestamp the summary was generated. */
    timestamp: string
}

// ─── Zero State ─────────────────────────────────────────────────────────────

/**
 * Pre-first-scan fallback returned by `flint:getCoverageSummary` when
 * `.flint/coverage-cache.json` does not yet exist or cannot be parsed.
 *
 * Used by electron/main.ts, server/index.ts, and test helpers — keeps the
 * literal DRY across the process boundary.
 *
 * NOTE: `timestamp` is intentionally a fixed epoch string so the constant is
 * truly constant. Callers that need a live timestamp should spread-override it.
 */
export const ZERO_COVERAGE_SUMMARY: CoverageSummary = {
    totalFiles: 0,
    parsedFiles: 0,
    partialFiles: 0,
    skippedFiles: 0,
    governedSurfacePercent: 0,
    skippedFilesByReason: {
        'css-in-js-detected': 0,
        'external-stylesheet-imported': 0,
        'css-modules-reference': 0,
        'dynamic-class-expression': 0,
        'unresolvable-var': 0,
        'tailwind-config-extension': 0,
        'non-jsx-framework': 0,
        'non-literal-ternary-branch': 0,
        'parse-failure': 0,
    },
    timestamp: '1970-01-01T00:00:00.000Z',
}
