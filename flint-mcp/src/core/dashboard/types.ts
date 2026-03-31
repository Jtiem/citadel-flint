/**
 * Design Debt Report types — flint-mcp/src/core/dashboard/types.ts
 *
 * Shared type definitions for the DebtReportService, the flint_debt_report
 * MCP tool, and the flint://dashboard resource. Used by EXP.2 (Design Debt
 * Report) and the Glass Governance Dashboard.
 */

// ── DebtReport ────────────────────────────────────────────────────────────────

/**
 * A project-wide design debt report aggregating violations from the
 * MithrilLinter (color, typography, spacing, shadow, opacity drift) and
 * A11yLinter (WCAG 2.1 AA rules) across all scanned source files.
 *
 * healthScore is computed as:
 *   clamp(100 - mithrilCount × 5 - a11yCount × 10, 0, 100)
 *   (matches GovernanceDashboard formula; overrideCount is 0 for file scans)
 */
export interface DebtReport {
    /** Aggregate health score, 0-100. */
    healthScore: number
    /** Letter grade derived from healthScore. */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Total violation count across all files. */
    totalViolations: number
    /** Violation counts grouped by severity. */
    bySeverity: { critical: number; warning: number; info: number }
    /** Violation counts grouped by rule ID (e.g. 'MITHRIL-COL', 'A11Y-001'). */
    byCategory: Record<string, number>
    /** Per-file violation summary, sorted by count descending. */
    byFile: Array<{ filePath: string; count: number; worst: string }>
    /** Top violated rules, sorted by count descending. */
    topRules: Array<{ ruleId: string; count: number; severity: string }>
    /** Number of files scanned. */
    scannedFiles: number
    /** ISO 8601 UTC timestamp of when the report was generated. */
    timestamp: string
    /**
     * UCFG.7b: Weighted violation score derived from configurable scoring
     * weights (coercive/normative/advisory). Present when scoring weights are
     * available from flint.config.yaml. Omitted for projects using only the
     * legacy policy.json config.
     *
     * When violation mode data is available per-violation, this score will
     * reflect the full per-mode weighting. Currently computed as a
     * severity-proxy weighted score (critical → coercive weight, warning →
     * normative weight, info → advisory weight) until mode-aware scanning
     * carries explicit mode labels.
     */
    weightedScore?: {
        raw: number
        weighted: number
        weights: { coercive: number; normative: number; advisory: number; recency: number }
    }
}

// ── DebtHistoryEntry ──────────────────────────────────────────────────────────

/**
 * A compact snapshot appended to .flint/debt-history.json on each tracked
 * scan. Used to render trend lines in the Glass dashboard.
 */
export interface DebtHistoryEntry {
    /** ISO 8601 UTC timestamp. */
    timestamp: string
    /** Health score at this point in time. */
    healthScore: number
    /** Letter grade at this point in time. */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Total violations at this point in time. */
    totalViolations: number
}

// ── DashboardData ─────────────────────────────────────────────────────────────

/**
 * The payload returned by the flint://dashboard resource. Combines the
 * current report snapshot with recent history for trend visualisation.
 */
export interface DashboardData {
    /** Current health score. */
    healthScore: number
    /** Current letter grade. */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Current violation counts by severity. */
    bySeverity: { critical: number; warning: number; info: number }
    /** Last 10 debt history snapshots (newest first). */
    history: DebtHistoryEntry[]
    /** ISO 8601 UTC timestamp of the current snapshot. */
    timestamp: string
    /** Sync health status (SYNC.4). */
    syncStatus?: 'synced' | 'stale' | 'conflicts' | 'disconnected'
    /** ISO timestamp of last successful sync, or null if never synced. */
    lastSyncAt?: string | null
    /** Number of unresolved sync conflicts. */
    pendingConflicts?: number
}
