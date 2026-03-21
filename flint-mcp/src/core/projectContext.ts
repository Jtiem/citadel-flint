/**
 * projectContext.ts — flint-mcp/src/core/projectContext.ts
 *
 * Lightweight project health context loader for CX.1 Response Quality Baseline.
 *
 * Data source: .flint/debt-history.json — reads the most recent entry (O(1) read).
 * Does NOT run a full debt scan. The project_context footer must add < 5ms overhead.
 *
 * Design principles:
 *   - Never throws. Any error → return null (graceful omission).
 *   - < 5ms overhead: single readFileSync on a small JSON file.
 *   - blocked_files defaults to 0 when sourced from history (history lacks per-file data).
 */

import fs from 'node:fs'
import path from 'node:path'

export interface ProjectContext {
    health_score: number
    grade: string
    total_violations: number
    blocked_files: number
}

/**
 * Shape of an entry in .flint/debt-history.json.
 * The file is written by generateDebtReport({ track: true }).
 * History may use either `snapshots` (array-of-objects) or a top-level array.
 */
interface DebtHistoryEntry {
    score?: number
    healthScore?: number
    grade?: string
    totalViolations?: number
    violationCount?: number
}

type DebtHistory = DebtHistoryEntry[] | { snapshots?: DebtHistoryEntry[] }

/**
 * Load project-level health context from .flint/debt-history.json.
 *
 * Data source priority:
 *   1. .flint/debt-history.json — reads the most recent entry (O(1) file read)
 *   2. If no history file exists, return null (do NOT run a full scan)
 *
 * Returns null when:
 *   - .flint/debt-history.json does not exist
 *   - The file is empty or unparseable
 *   - The array has zero entries
 *   - Any unexpected error occurs
 */
export function loadProjectContext(projectRoot: string): ProjectContext | null {
    try {
        const historyPath = path.join(projectRoot, '.flint', 'debt-history.json')

        if (!fs.existsSync(historyPath)) return null

        let raw: string
        try {
            raw = fs.readFileSync(historyPath, 'utf-8')
        } catch {
            return null
        }

        if (!raw || raw.trim().length === 0) return null

        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch {
            return null
        }

        // Resolve the array of entries — supports two shapes:
        //   1. Top-level array: [{ score, grade, totalViolations }, ...]
        //   2. Object with snapshots: { snapshots: [{ score, grade, ... }] }
        let entries: DebtHistoryEntry[] | null = null

        if (Array.isArray(parsed)) {
            entries = parsed as DebtHistoryEntry[]
        } else if (
            parsed !== null &&
            typeof parsed === 'object' &&
            Array.isArray((parsed as { snapshots?: unknown }).snapshots)
        ) {
            entries = (parsed as { snapshots: DebtHistoryEntry[] }).snapshots
        }

        if (!entries || entries.length === 0) return null

        // Take the last (most recent) entry
        const latest = entries[entries.length - 1]
        if (!latest || typeof latest !== 'object') return null

        // Resolve fields — support both naming conventions
        const health_score =
            typeof latest.healthScore === 'number'
                ? latest.healthScore
                : typeof latest.score === 'number'
                    ? latest.score
                    : null

        const grade =
            typeof latest.grade === 'string' && latest.grade.length > 0
                ? latest.grade
                : null

        const total_violations =
            typeof latest.totalViolations === 'number'
                ? latest.totalViolations
                : typeof latest.violationCount === 'number'
                    ? latest.violationCount
                    : null

        // All three required fields must be present
        if (health_score === null || grade === null || total_violations === null) return null

        return {
            health_score,
            grade,
            total_violations,
            // blocked_files: history entries lack per-file data, default to 0
            blocked_files: 0,
        }
    } catch {
        // Never throw — return null on any unexpected error
        return null
    }
}
