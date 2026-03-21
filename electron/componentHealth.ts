/**
 * componentHealth.ts — electron/componentHealth.ts
 *
 * CV2.4: Per-Component Health Assessment
 *
 * Exports `computeComponentHealth` (pure, synchronous grade computation) and
 * `enrichComponentHealth` (async, reads a source file and runs Mithril + A11y
 * audits on it). Both functions run exclusively in the main process (electron/)
 * where Node.js fs APIs and @babel/parser are available.
 *
 * Keeping these functions in a standalone module rather than inline in main.ts
 * allows them to be imported in unit tests without triggering Electron's
 * `app.disableHardwareAcceleration()` call at the top of main.ts.
 *
 * Commandment compliance:
 *   C4  — Local-First: zero external network calls
 *   C13 — Babel AST traversal (no regex on source code)
 *   C14 — Reads via Node.js `readFile`, no direct `fs.writeFile`
 */

import { readFile } from 'node:fs/promises'
import type { File as BabelFile } from '@babel/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComponentHealth {
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    maxDeltaE: number
    violationCount: number
    mithrilCount: number
    a11yCount: number
}

/** Minimal token shape needed for Mithril audits. */
export interface AuditToken {
    token_path: string
    token_type: string
    token_value: string
}

/**
 * Injected linter function types — kept as opaque function references so this
 * module does not take a hard import-time dependency on flint-mcp (which would
 * break graceful degradation in environments where flint-mcp is absent).
 */
export type AuditAllFn = (
    ast: BabelFile,
    tokens: unknown[],
) => Map<string, { value?: number }>

export type A11yAuditFn = (ast: BabelFile) => Record<string, string[]>

// ── Grade computation ─────────────────────────────────────────────────────────

/**
 * Pure, synchronous grade computation.  Exported for unit testing without I/O.
 *
 * Grade boundaries:
 *   A — 0 violations AND maxDeltaE < 2.0
 *   B — ≤ 2 violations AND maxDeltaE < 5.0
 *   C — ≤ 5 violations AND maxDeltaE < 10.0
 *   D — ≤ 10 violations
 *   F — > 10 violations
 */
export function computeComponentHealth(
    mithrilCount: number,
    a11yCount: number,
    maxDeltaE: number,
): ComponentHealth {
    const violationCount = mithrilCount + a11yCount
    let grade: ComponentHealth['grade']

    if (violationCount === 0 && maxDeltaE < 2.0) grade = 'A'
    else if (violationCount <= 2 && maxDeltaE < 5.0) grade = 'B'
    else if (violationCount <= 5 && maxDeltaE < 10.0) grade = 'C'
    else if (violationCount <= 10) grade = 'D'
    else grade = 'F'

    return { grade, maxDeltaE, violationCount, mithrilCount, a11yCount }
}

// ── File-level enrichment ─────────────────────────────────────────────────────

/**
 * Reads a component source file, parses it with Babel, runs Mithril + A11y
 * audits, and returns a ComponentHealth record.
 *
 * Returns `null` in all error conditions (file not found, parse failure,
 * linter crash) so that one bad component never blocks the full list.
 *
 * @param filePath    Absolute path to the component source file.
 * @param tokens      Design tokens loaded once before the component loop.
 * @param auditAll    `auditAll` from MithrilLinter — injected to allow the
 *                    caller to load flint-mcp once and share the reference.
 * @param a11yAudit   `A11yLinter.audit` — injected for the same reason.
 */
export async function enrichComponentHealth(
    filePath: string,
    tokens: AuditToken[],
    auditAll: AuditAllFn,
    a11yAudit: A11yAuditFn,
): Promise<ComponentHealth | null> {
    try {
        const code = await readFile(filePath, 'utf-8')

        // @babel/parser is a transitive dep of @babel/core (already in deps).
        const { parse } = await import('@babel/parser')
        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        })

        // Mithril audit — count warnings and find the maximum ΔE value.
        const mithrilWarnings = auditAll(ast, tokens)
        const mithrilCount = mithrilWarnings.size

        let maxDeltaE = 0
        for (const warning of mithrilWarnings.values()) {
            const de = typeof warning.value === 'number' ? warning.value : 0
            if (de > maxDeltaE) maxDeltaE = de
        }

        // A11y audit — sum all violation message arrays across all element keys.
        const a11yViolations = a11yAudit(ast)
        const a11yCount = Object.values(a11yViolations).reduce(
            (sum, msgs) => sum + msgs.length,
            0,
        )

        return computeComponentHealth(mithrilCount, a11yCount, maxDeltaE)
    } catch {
        // Any failure (ENOENT, parse error, linter crash) → null.
        return null
    }
}
