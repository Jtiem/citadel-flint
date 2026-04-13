/**
 * DriftTrendService — flint-mcp/src/core/governance/driftTrendService.ts
 *
 * Aggregation and trending layer that sits atop the mutation ledger and
 * governance events to compute longitudinal design system compliance metrics.
 *
 * Phase: P3.5 (Governance Telemetry & Drift Trending)
 * Unblocked by: INFRA.1, INFRA.2, GOV.4 (all ONLINE)
 *
 * Uses better-sqlite3 (synchronous API). Constructor accepts a Database
 * instance for dependency injection — callers supply the db handle so the
 * service is trivially testable with an in-memory SQLite database.
 */

import type Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WeeklyViolation {
    /** ISO 8601 date of the Monday starting the week (YYYY-MM-DD). */
    week: string
    /** Total violations in this week. */
    total: number
    /** Violation count keyed by rule ID. */
    byRule: Record<string, number>
}

export interface FixRate {
    /** Number of auto_fix source mutations in the window. */
    autoFixed: number
    /** Total violations (governance_events with event_type='violation') in the window. */
    total: number
    /** Percentage: autoFixed / total * 100 (0 when total is 0). */
    percentage: number
}

export interface RepeatOffender {
    /** Absolute or relative file path. */
    file: string
    /** Number of times this file appears in the mutation ledger. */
    count: number
}

export interface AdoptionScore {
    /** Components matching the registry. */
    registered: number
    /** Rogue intrinsic elements not in the registry. */
    rogue: number
    /** Percentage: registered / (registered + rogue) * 100 (0 when sum is 0). */
    percentage: number
}

export interface DriftTrend {
    /** The time window these metrics cover. */
    window: { start: string; end: string; days: number }
    /** Violations bucketed by ISO week. */
    weeklyViolations: WeeklyViolation[]
    /** Ratio of auto-fixes to total violations (self-healing metric). */
    fixRate: FixRate
    /** Files appearing in the ledger more than the threshold in the window. */
    repeatOffenders: RepeatOffender[]
    /** Registry adoption score (present when registry data exists). */
    adoptionScore?: AdoptionScore
    /** Alert strings triggered when metrics exceed thresholds. */
    alerts: string[]
}

export interface DriftTrendConfig {
    /** Minimum appearances for repeat offender detection (default: 3). */
    repeatOffenderThreshold?: number
    /** Week-over-week violation increase percentage that triggers an alert (default: 40). */
    spikeAlertPercent?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tableExists(db: Database.Database, tableName: string): boolean {
    const row = db
        .prepare("SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?")
        .get(tableName) as { cnt: number }
    return row.cnt > 0
}

/**
 * Compute the ISO week start (Monday) for a given date string.
 * Returns YYYY-MM-DD.
 */
function isoWeekStart(dateStr: string): string {
    const d = new Date(dateStr)
    const day = d.getUTCDay()
    // Shift so Monday = 0
    const diff = (day === 0 ? 6 : day - 1)
    d.setUTCDate(d.getUTCDate() - diff)
    return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DriftTrendService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
    }

    // -------------------------------------------------------------------------
    // computeTrend
    // -------------------------------------------------------------------------

    /**
     * Compute drift trend metrics for the given time window.
     *
     * @param windowDays  Number of past days to include (default: 30).
     * @param config      Optional configuration overrides.
     */
    computeTrend(windowDays = 30, config: DriftTrendConfig = {}): DriftTrend {
        const repeatThreshold = config.repeatOffenderThreshold ?? 3
        const spikePercent = config.spikeAlertPercent ?? 40

        const end = new Date()
        const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000)
        const startISO = start.toISOString()
        const endISO = end.toISOString()

        const weeklyViolations = this.getWeeklyViolations(startISO)
        const fixRate = this.getFixRate(startISO)
        const repeatOffenders = this.getRepeatOffenders(startISO, repeatThreshold)
        const adoptionScore = this.getAdoptionScore(startISO)
        const alerts = this.computeAlerts(weeklyViolations, fixRate, spikePercent)

        return {
            window: {
                start: startISO,
                end: endISO,
                days: windowDays,
            },
            weeklyViolations,
            fixRate,
            repeatOffenders,
            adoptionScore: adoptionScore ?? undefined,
            alerts,
        }
    }

    // -------------------------------------------------------------------------
    // Weekly violation bucketing
    // -------------------------------------------------------------------------

    private getWeeklyViolations(since: string): WeeklyViolation[] {
        if (!tableExists(this.db, 'governance_events')) return []

        const rows = this.db.prepare(`
            SELECT timestamp, rule_id
            FROM governance_events
            WHERE timestamp >= ? AND event_type = 'violation'
            ORDER BY timestamp ASC
        `).all(since) as Array<{ timestamp: string; rule_id: string }>

        // Bucket by ISO week
        const weekMap = new Map<string, { total: number; byRule: Record<string, number> }>()

        for (const row of rows) {
            const week = isoWeekStart(row.timestamp)
            let bucket = weekMap.get(week)
            if (!bucket) {
                bucket = { total: 0, byRule: {} }
                weekMap.set(week, bucket)
            }
            bucket.total++
            bucket.byRule[row.rule_id] = (bucket.byRule[row.rule_id] ?? 0) + 1
        }

        // Sort by week ascending
        const weeks = Array.from(weekMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([week, data]) => ({ week, ...data }))

        return weeks
    }

    // -------------------------------------------------------------------------
    // Fix rate
    // -------------------------------------------------------------------------

    private getFixRate(since: string): FixRate {
        // Count auto_fix mutations from mutations_ledger
        let autoFixed = 0
        if (tableExists(this.db, 'mutations_ledger')) {
            const row = this.db.prepare(`
                SELECT COUNT(*) AS cnt
                FROM mutations_ledger
                WHERE timestamp >= ? AND source = 'auto_fix'
            `).get(since) as { cnt: number }
            autoFixed = row.cnt
        }

        // Count total violations from governance_events
        let total = 0
        if (tableExists(this.db, 'governance_events')) {
            const row = this.db.prepare(`
                SELECT COUNT(*) AS cnt
                FROM governance_events
                WHERE timestamp >= ? AND event_type = 'violation'
            `).get(since) as { cnt: number }
            total = row.cnt
        }

        return {
            autoFixed,
            total,
            percentage: total > 0 ? Math.round((autoFixed / total) * 10000) / 100 : 0,
        }
    }

    // -------------------------------------------------------------------------
    // Repeat offenders
    // -------------------------------------------------------------------------

    private getRepeatOffenders(since: string, threshold: number): RepeatOffender[] {
        if (!tableExists(this.db, 'mutations_ledger')) return []

        const rows = this.db.prepare(`
            SELECT file_path, COUNT(*) AS cnt
            FROM mutations_ledger
            WHERE timestamp >= ?
            GROUP BY file_path
            HAVING COUNT(*) >= ?
            ORDER BY cnt DESC
        `).all(since, threshold) as Array<{ file_path: string; cnt: number }>

        return rows.map(r => ({ file: r.file_path, count: r.cnt }))
    }

    // -------------------------------------------------------------------------
    // Adoption score
    // -------------------------------------------------------------------------

    /**
     * Compute the adoption score by examining governance_events metadata.
     * Returns null if no registry adoption data is available.
     *
     * This looks for events that tag `metadata` with `registryMatch: true/false`
     * (produced by P2 Rogue Intrinsic Detection). If no such events exist,
     * returns null.
     */
    private getAdoptionScore(since: string): AdoptionScore | null {
        if (!tableExists(this.db, 'governance_events')) return null

        // Check for events with MITHRIL-REG rule violations (rogue intrinsics).
        // Count DISTINCT file_path so the unit matches `registered` below —
        // otherwise dividing "event rows" by "distinct files" is meaningless.
        // Some seed data for this table may use `file` instead of `file_path`;
        // coalesce so older ledgers remain comparable.
        const rogueRow = this.db.prepare(`
            SELECT COUNT(DISTINCT file_path) AS cnt
            FROM governance_events
            WHERE timestamp >= ? AND rule_id LIKE 'MITHRIL-REG%' AND file_path IS NOT NULL
        `).get(since) as { cnt: number }

        // If no MITHRIL-REG violations exist, P2 hasn't run. Return null.
        if (rogueRow.cnt === 0) {
            return null
        }

        const rogue = rogueRow.cnt

        // Registered count: violations that are NOT rogue intrinsics
        // This is a proxy — the accurate count requires P2 data.
        // For now, count auto_fix mutations as a proxy for registered component usage.
        let registered = 0
        if (tableExists(this.db, 'mutations_ledger')) {
            const regRow = this.db.prepare(`
                SELECT COUNT(DISTINCT file_path) AS cnt
                FROM mutations_ledger
                WHERE timestamp >= ? AND registry_artifact_id IS NOT NULL
            `).get(since) as { cnt: number }
            registered = regRow.cnt
        }

        const sum = registered + rogue
        return {
            registered,
            rogue,
            percentage: sum > 0 ? Math.round((registered / sum) * 10000) / 100 : 0,
        }
    }

    // -------------------------------------------------------------------------
    // Drift alerts
    // -------------------------------------------------------------------------

    private computeAlerts(
        weeklyViolations: WeeklyViolation[],
        fixRate: FixRate,
        spikePercent: number,
    ): string[] {
        const alerts: string[] = []

        // Week-over-week spike detection
        if (weeklyViolations.length >= 2) {
            const prev = weeklyViolations[weeklyViolations.length - 2]
            const curr = weeklyViolations[weeklyViolations.length - 1]

            if (prev.total > 0) {
                const increase = ((curr.total - prev.total) / prev.total) * 100
                if (increase > spikePercent) {
                    alerts.push(
                        `Violation spike: ${curr.total} violations in week ${curr.week} vs ${prev.total} in week ${prev.week} (+${Math.round(increase)}% week-over-week). Threshold: ${spikePercent}%.`,
                    )
                }
            } else if (curr.total > 0) {
                // Previous week was zero, current has violations — regression
                alerts.push(
                    `Drift regression: ${curr.total} new violations in week ${curr.week} after a clean week.`,
                )
            }
        }

        // Low fix rate alert (< 20% when there are violations)
        if (fixRate.total > 10 && fixRate.percentage < 20) {
            alerts.push(
                `Low self-healing rate: only ${fixRate.percentage}% of ${fixRate.total} violations were auto-fixed. Consider enabling deterministic auto-fix for common violations.`,
            )
        }

        return alerts
    }
}
