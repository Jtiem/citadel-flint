/**
 * AnomalyDetectionService -- flint-mcp/src/core/governance/anomalyDetectionService.ts
 *
 * Computes baseline statistics from historical governance data (mutations_ledger,
 * governance_events, override_events, mutation_risk_scores) and detects statistical
 * anomalies using a 3-sigma threshold.
 *
 * Uses better-sqlite3 (synchronous API). Constructor accepts a Database instance
 * for dependency injection -- callers supply the db handle so the service is
 * trivially testable with an in-memory SQLite database.
 *
 * Phase: GOV.4 (Statistical Anomaly Detection)
 * Unblocked by: INFRA.1, INFRA.2, V.1-rs, GOV.2 (all ONLINE)
 */

import type Database from 'better-sqlite3'
import type {
    BaselineStats,
    Anomaly,
    AnomalyType,
    AnomalySeverity,
} from './types.js'

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS anomaly_history (
    id              TEXT    PRIMARY KEY,
    type            TEXT    NOT NULL,
    severity        TEXT    NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    detected_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    observed_value  REAL    NOT NULL,
    baseline_mean   REAL    NOT NULL,
    baseline_stddev REAL    NOT NULL,
    threshold       REAL    NOT NULL,
    message         TEXT    NOT NULL,
    project_root    TEXT    NOT NULL,
    agent_id        TEXT
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detected_at ON anomaly_history(detected_at);
CREATE INDEX IF NOT EXISTS idx_anomaly_type        ON anomaly_history(type);
CREATE INDEX IF NOT EXISTS idx_anomaly_project     ON anomaly_history(project_root);
`

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface AnomalyRow {
    id: string
    type: string
    severity: string
    detected_at: string
    observed_value: number
    baseline_mean: number
    baseline_stddev: number
    threshold: number
    message: string
    project_root: string
    agent_id: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToAnomaly(row: AnomalyRow): Anomaly {
    return {
        id: row.id,
        type: row.type as AnomalyType,
        severity: row.severity as AnomalySeverity,
        detectedAt: row.detected_at,
        observedValue: row.observed_value,
        baselineMean: row.baseline_mean,
        baselineStddev: row.baseline_stddev,
        threshold: row.threshold,
        message: row.message,
        projectRoot: row.project_root,
        agentId: row.agent_id,
    }
}

function computeThreshold(mean: number, stddev: number, sigmas = 3): number {
    if (stddev === 0) return mean * 1.5
    return mean + sigmas * stddev
}

function deriveSeverity(value: number, mean: number, stddev: number): AnomalySeverity {
    if (stddev === 0) return 'warning'
    const sigmaDistance = (value - mean) / stddev
    if (sigmaDistance >= 4) return 'critical'
    if (sigmaDistance >= 3) return 'warning'
    return 'info'
}

function computeMeanStddev(values: number[]): { mean: number; stddev: number } {
    if (values.length === 0) return { mean: 0, stddev: 0 }
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    if (values.length < 2) return { mean, stddev: 0 }
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    return { mean, stddev: Math.sqrt(variance) }
}

function tableExists(db: Database.Database, tableName: string): boolean {
    const row = db
        .prepare("SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?")
        .get(tableName) as { cnt: number }
    return row.cnt > 0
}

function generateId(): string {
    const bytes = new Uint8Array(16)
    // Use crypto.getRandomValues if available, otherwise fallback
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes)
    } else {
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256)
        }
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AnomalyDetectionService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(INIT_SQL)
    }

    // -------------------------------------------------------------------------
    // computeBaseline
    // -------------------------------------------------------------------------

    /**
     * Compute baseline statistics from historical data within a time window.
     *
     * Reads from: governance_events, override_events, mutations_ledger,
     * mutation_risk_scores. Gracefully returns zero baselines when tables
     * are missing or empty.
     *
     * @param projectRoot  Absolute path to scope the query.
     * @param windowDays   Number of past days to include (default: 30).
     */
    computeBaseline(projectRoot: string, windowDays = 30): BaselineStats {
        const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

        // --- Override counts per day ---
        const overrideCounts = this.getDailyCounts(
            'override_events',
            'timestamp',
            'project_root',
            projectRoot,
            cutoff,
        )

        // --- Violation counts per day ---
        const violationCounts = this.getDailyCountsFiltered(
            'governance_events',
            'timestamp',
            'file_path',
            cutoff,
            "event_type = 'violation'",
        )

        // --- Mutation velocity (mutations per hour, grouped by hour) ---
        const velocityCounts = this.getHourlyCounts(
            'mutations_ledger',
            'timestamp',
            cutoff,
        )

        // --- Average risk scores per day ---
        const riskScores = this.getDailyAvgScores(cutoff)

        const overrideStats = computeMeanStddev(overrideCounts)
        const violationStats = computeMeanStddev(violationCounts)
        const velocityStats = computeMeanStddev(velocityCounts)
        const riskStats = computeMeanStddev(riskScores)

        const dataPoints = Math.max(
            overrideCounts.length,
            violationCounts.length,
            velocityCounts.length,
            riskScores.length,
            0,
        )

        return {
            computedAt: new Date().toISOString(),
            windowDays,
            dataPoints,
            overrides: overrideStats,
            violations: violationStats,
            mutationVelocity: velocityStats,
            avgRiskScore: riskStats,
        }
    }

    // -------------------------------------------------------------------------
    // detectAnomalies
    // -------------------------------------------------------------------------

    /**
     * Compare current-period metrics against a baseline and flag anomalies
     * at the 3-sigma threshold. Detected anomalies are persisted.
     *
     * @param projectRoot  Absolute path to scope the query.
     * @param baseline     Previously computed baseline stats.
     */
    detectAnomalies(projectRoot: string, baseline: BaselineStats): Anomaly[] {
        const anomalies: Anomaly[] = []
        const now = new Date().toISOString()

        // Current period = last 24 hours
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        // --- Override spike ---
        const currentOverrides = this.countSince('override_events', 'timestamp', 'project_root', projectRoot, since24h)
        const overrideThreshold = computeThreshold(baseline.overrides.mean, baseline.overrides.stddev)
        if (currentOverrides > overrideThreshold && baseline.dataPoints > 0) {
            anomalies.push(this.buildAnomaly(
                'override_spike',
                currentOverrides,
                baseline.overrides,
                overrideThreshold,
                `Override spike: ${currentOverrides} overrides in the last 24h (threshold: ${overrideThreshold.toFixed(1)})`,
                projectRoot,
                now,
            ))
        }

        // --- Violation surge ---
        const currentViolations = this.countSinceFiltered(
            'governance_events', 'timestamp', since24h, "event_type = 'violation'",
        )
        const violationThreshold = computeThreshold(baseline.violations.mean, baseline.violations.stddev)
        if (currentViolations > violationThreshold && baseline.dataPoints > 0) {
            anomalies.push(this.buildAnomaly(
                'violation_surge',
                currentViolations,
                baseline.violations,
                violationThreshold,
                `Violation surge: ${currentViolations} violations in the last 24h (threshold: ${violationThreshold.toFixed(1)})`,
                projectRoot,
                now,
            ))
        }

        // --- Velocity spike ---
        const currentHour = this.countSince(
            'mutations_ledger', 'timestamp', null, null,
            new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        )
        const velocityThreshold = computeThreshold(baseline.mutationVelocity.mean, baseline.mutationVelocity.stddev)
        if (currentHour > velocityThreshold && baseline.dataPoints > 0) {
            anomalies.push(this.buildAnomaly(
                'velocity_spike',
                currentHour,
                baseline.mutationVelocity,
                velocityThreshold,
                `Velocity spike: ${currentHour} mutations in the last hour (threshold: ${velocityThreshold.toFixed(1)})`,
                projectRoot,
                now,
            ))
        }

        // --- Risk drift (average risk score trending upward) ---
        const recentAvgRisk = this.getRecentAvgRiskScore(since24h)
        const riskThreshold = computeThreshold(baseline.avgRiskScore.mean, baseline.avgRiskScore.stddev)
        if (recentAvgRisk > riskThreshold && baseline.dataPoints > 0 && recentAvgRisk > 0) {
            anomalies.push(this.buildAnomaly(
                'risk_drift',
                recentAvgRisk,
                baseline.avgRiskScore,
                riskThreshold,
                `Risk drift: average MRS ${recentAvgRisk.toFixed(1)} exceeds baseline (threshold: ${riskThreshold.toFixed(1)})`,
                projectRoot,
                now,
            ))
        }

        // --- Agent behavior change ---
        const agentAnomalies = this.detectAgentBehaviorChange(projectRoot, baseline, since24h, now)
        anomalies.push(...agentAnomalies)

        // Persist all detected anomalies
        for (const anomaly of anomalies) {
            this.persistAnomaly(anomaly)
        }

        return anomalies
    }

    // -------------------------------------------------------------------------
    // getAnomalyHistory
    // -------------------------------------------------------------------------

    /**
     * Return stored anomalies for a project, newest first.
     *
     * @param projectRoot  Absolute path to scope the query.
     * @param limit        Maximum rows (default: 50).
     */
    getAnomalyHistory(projectRoot: string, limit = 50): Anomaly[] {
        const rows = this.db
            .prepare(`
                SELECT * FROM anomaly_history
                WHERE project_root = ?
                ORDER BY detected_at DESC
                LIMIT ?
            `)
            .all(projectRoot, limit) as AnomalyRow[]

        return rows.map(rowToAnomaly)
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private buildAnomaly(
        type: AnomalyType,
        observedValue: number,
        stats: { mean: number; stddev: number },
        threshold: number,
        message: string,
        projectRoot: string,
        detectedAt: string,
        agentId: string | null = null,
    ): Anomaly {
        return {
            id: generateId(),
            type,
            severity: deriveSeverity(observedValue, stats.mean, stats.stddev),
            detectedAt,
            observedValue,
            baselineMean: stats.mean,
            baselineStddev: stats.stddev,
            threshold,
            message,
            projectRoot,
            agentId,
        }
    }

    private persistAnomaly(anomaly: Anomaly): void {
        this.db.prepare(`
            INSERT INTO anomaly_history (
                id, type, severity, detected_at, observed_value,
                baseline_mean, baseline_stddev, threshold, message,
                project_root, agent_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            anomaly.id,
            anomaly.type,
            anomaly.severity,
            anomaly.detectedAt,
            anomaly.observedValue,
            anomaly.baselineMean,
            anomaly.baselineStddev,
            anomaly.threshold,
            anomaly.message,
            anomaly.projectRoot,
            anomaly.agentId,
        )
    }

    private getDailyCounts(
        table: string,
        tsCol: string,
        scopeCol: string | null,
        scopeVal: string | null,
        since: string,
    ): number[] {
        if (!tableExists(this.db, table)) return []
        const scopeClause = scopeCol ? `AND ${scopeCol} = ?` : ''
        const params: unknown[] = [since]
        if (scopeVal) params.push(scopeVal)

        const sql = `
            SELECT COUNT(*) AS cnt
            FROM ${table}
            WHERE ${tsCol} >= ? ${scopeClause}
            GROUP BY date(${tsCol})
            ORDER BY date(${tsCol})
        `
        const rows = this.db.prepare(sql).all(...params) as Array<{ cnt: number }>
        return rows.map((r) => r.cnt)
    }

    private getDailyCountsFiltered(
        table: string,
        tsCol: string,
        _scopeCol: string,
        since: string,
        extraWhere: string,
    ): number[] {
        if (!tableExists(this.db, table)) return []
        const sql = `
            SELECT COUNT(*) AS cnt
            FROM ${table}
            WHERE ${tsCol} >= ? AND ${extraWhere}
            GROUP BY date(${tsCol})
            ORDER BY date(${tsCol})
        `
        const rows = this.db.prepare(sql).all(since) as Array<{ cnt: number }>
        return rows.map((r) => r.cnt)
    }

    private getHourlyCounts(table: string, tsCol: string, since: string): number[] {
        if (!tableExists(this.db, table)) return []
        const sql = `
            SELECT COUNT(*) AS cnt
            FROM ${table}
            WHERE ${tsCol} >= ?
            GROUP BY strftime('%Y-%m-%d %H', ${tsCol})
            ORDER BY strftime('%Y-%m-%d %H', ${tsCol})
        `
        const rows = this.db.prepare(sql).all(since) as Array<{ cnt: number }>
        return rows.map((r) => r.cnt)
    }

    private getDailyAvgScores(since: string): number[] {
        if (!tableExists(this.db, 'mutation_risk_scores')) return []
        const sql = `
            SELECT AVG(score) AS avg_score
            FROM mutation_risk_scores
            WHERE scored_at >= ?
            GROUP BY date(scored_at)
            ORDER BY date(scored_at)
        `
        const rows = this.db.prepare(sql).all(since) as Array<{ avg_score: number }>
        return rows.map((r) => r.avg_score)
    }

    private countSince(
        table: string,
        tsCol: string,
        scopeCol: string | null,
        scopeVal: string | null,
        since: string,
    ): number {
        if (!tableExists(this.db, table)) return 0
        const scopeClause = scopeCol ? `AND ${scopeCol} = ?` : ''
        const params: unknown[] = [since]
        if (scopeVal) params.push(scopeVal)
        const sql = `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${tsCol} >= ? ${scopeClause}`
        const row = this.db.prepare(sql).get(...params) as { cnt: number }
        return row.cnt
    }

    private countSinceFiltered(
        table: string,
        tsCol: string,
        since: string,
        extraWhere: string,
    ): number {
        if (!tableExists(this.db, table)) return 0
        const sql = `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${tsCol} >= ? AND ${extraWhere}`
        const row = this.db.prepare(sql).get(since) as { cnt: number }
        return row.cnt
    }

    private getRecentAvgRiskScore(since: string): number {
        if (!tableExists(this.db, 'mutation_risk_scores')) return 0
        const row = this.db
            .prepare('SELECT AVG(score) AS avg_score FROM mutation_risk_scores WHERE scored_at >= ?')
            .get(since) as { avg_score: number | null }
        return row.avg_score ?? 0
    }

    private detectAgentBehaviorChange(
        projectRoot: string,
        baseline: BaselineStats,
        since24h: string,
        now: string,
    ): Anomaly[] {
        if (!tableExists(this.db, 'mutation_risk_scores') || !tableExists(this.db, 'mutations_ledger')) {
            return []
        }
        // No provenance table dependency -- use mutations_ledger.source + approved_by
        // for agent identification, joined with risk scores
        const sql = `
            SELECT ml.approved_by AS agent_id, AVG(mrs.score) AS avg_score, COUNT(*) AS cnt
            FROM mutations_ledger ml
            JOIN mutation_risk_scores mrs ON ml.id = mrs.mutation_id
            WHERE ml.timestamp >= ? AND ml.approved_by IS NOT NULL
            GROUP BY ml.approved_by
        `
        const rows = this.db.prepare(sql).all(since24h) as Array<{
            agent_id: string
            avg_score: number
            cnt: number
        }>

        const anomalies: Anomaly[] = []
        const riskThreshold = computeThreshold(baseline.avgRiskScore.mean, baseline.avgRiskScore.stddev)

        for (const row of rows) {
            if (row.avg_score > riskThreshold && baseline.dataPoints > 0 && row.cnt >= 3) {
                anomalies.push(this.buildAnomaly(
                    'agent_behavior_change',
                    row.avg_score,
                    baseline.avgRiskScore,
                    riskThreshold,
                    `Agent '${row.agent_id}' risk profile shifted: avg MRS ${row.avg_score.toFixed(1)} across ${row.cnt} mutations (threshold: ${riskThreshold.toFixed(1)})`,
                    projectRoot,
                    now,
                    row.agent_id,
                ))
            }
        }

        return anomalies
    }
}
