/**
 * AnomalyDetectionService -- Unit Tests (GOV.4)
 *
 * Uses an in-memory SQLite database for hermetic, disk-free tests.
 * Each test constructs a fresh service instance with prerequisite tables
 * seeded as needed.
 *
 * Coverage:
 *   - Schema initialisation (anomaly_history table + indexes)
 *   - computeBaseline: empty tables, single data point, normal data
 *   - detectAnomalies: override_spike, violation_surge, velocity_spike,
 *     risk_drift, agent_behavior_change
 *   - 3-sigma threshold logic + stddev=0 fallback (mean * 1.5)
 *   - getAnomalyHistory: retrieval, ordering, limit, empty
 *   - Multiple anomaly types simultaneously
 *   - Graceful handling when prerequisite tables are missing
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { AnomalyDetectionService } from '../anomalyDetectionService.js'
import type { BaselineStats, Anomaly } from '../types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

function makeService(db?: Database.Database): {
    service: AnomalyDetectionService
    db: Database.Database
} {
    const database = db ?? makeDb()
    return {
        service: new AnomalyDetectionService(database),
        db: database,
    }
}

/** Create prerequisite tables that the service reads from. */
function createPrereqTables(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS override_events (
            id TEXT PRIMARY KEY,
            node_id TEXT,
            rule_id TEXT NOT NULL,
            session_id TEXT,
            agent_id TEXT,
            timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            project_root TEXT NOT NULL,
            reason TEXT
        );
        CREATE TABLE IF NOT EXISTS governance_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            event_type TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            node_id TEXT,
            file_path TEXT NOT NULL,
            message TEXT,
            session_id TEXT,
            actor TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS mutations_ledger (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            file_path TEXT NOT NULL,
            node_id TEXT,
            operation_type TEXT NOT NULL,
            source TEXT NOT NULL,
            source_intent_hash TEXT,
            registry_artifact_id TEXT,
            before_snapshot TEXT,
            after_snapshot TEXT,
            session_id TEXT,
            approved_by TEXT,
            justification TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS mutation_risk_scores (
            mutation_id TEXT PRIMARY KEY,
            score REAL NOT NULL,
            tier TEXT NOT NULL,
            factors_json TEXT NOT NULL DEFAULT '[]',
            scored_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
    `)
}

function makeBaseline(overrides?: Partial<BaselineStats>): BaselineStats {
    return {
        computedAt: new Date().toISOString(),
        windowDays: 30,
        dataPoints: 10,
        overrides: { mean: 5, stddev: 2 },
        violations: { mean: 10, stddev: 3 },
        mutationVelocity: { mean: 20, stddev: 5 },
        avgRiskScore: { mean: 40, stddev: 10 },
        ...overrides,
    }
}

function recentTimestamp(minutesAgo = 0): string {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
}

function pastTimestamp(daysAgo: number): string {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnomalyDetectionService', () => {
    describe('schema initialisation', () => {
        it('creates anomaly_history table and indexes', () => {
            const { db } = makeService()
            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anomaly_history'")
                .all() as Array<{ name: string }>
            expect(tables).toHaveLength(1)

            const indexes = db
                .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_anomaly%'")
                .all() as Array<{ name: string }>
            expect(indexes.length).toBeGreaterThanOrEqual(3)
        })

        it('is idempotent (double construction)', () => {
            const db = makeDb()
            new AnomalyDetectionService(db)
            new AnomalyDetectionService(db) // should not throw
        })
    })

    describe('computeBaseline', () => {
        it('returns zero baselines when prerequisite tables do not exist', () => {
            const { service } = makeService()
            const baseline = service.computeBaseline('/test/project')
            expect(baseline.dataPoints).toBe(0)
            expect(baseline.overrides).toEqual({ mean: 0, stddev: 0 })
            expect(baseline.violations).toEqual({ mean: 0, stddev: 0 })
            expect(baseline.mutationVelocity).toEqual({ mean: 0, stddev: 0 })
            expect(baseline.avgRiskScore).toEqual({ mean: 0, stddev: 0 })
            expect(baseline.windowDays).toBe(30)
        })

        it('returns zero baselines when tables exist but are empty', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)
            const baseline = service.computeBaseline('/test/project')
            expect(baseline.dataPoints).toBe(0)
            expect(baseline.overrides.mean).toBe(0)
        })

        it('computes correct stats with a single data point (stddev = 0)', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // Insert 1 override event today
            db.prepare(`
                INSERT INTO override_events (id, rule_id, timestamp, project_root)
                VALUES ('o1', 'CLR-001', ?, '/test/project')
            `).run(recentTimestamp(10))

            const baseline = service.computeBaseline('/test/project')
            // Single day = 1 count, stddev = 0
            expect(baseline.overrides.mean).toBe(1)
            expect(baseline.overrides.stddev).toBe(0)
        })

        it('computes mean and stddev across multiple days', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // Day 1: 2 overrides, Day 2: 4 overrides
            for (let i = 0; i < 2; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`d1-${i}`, pastTimestamp(2))
            }
            for (let i = 0; i < 4; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`d2-${i}`, pastTimestamp(1))
            }

            const baseline = service.computeBaseline('/test/project')
            // [2, 4] → mean = 3, stddev = 1
            expect(baseline.overrides.mean).toBe(3)
            expect(baseline.overrides.stddev).toBe(1)
        })
    })

    describe('detectAnomalies', () => {
        it('returns empty array when no anomalies exist', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)
            const baseline = makeBaseline()
            const anomalies = service.detectAnomalies('/test/project', baseline)
            expect(anomalies).toEqual([])
        })

        it('returns empty when baseline has 0 dataPoints', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // Inject override events that would normally trigger
            for (let i = 0; i < 50; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`ov-${i}`, recentTimestamp(5))
            }

            // But baseline has 0 dataPoints
            const baseline = makeBaseline({ dataPoints: 0 })
            const anomalies = service.detectAnomalies('/test/project', baseline)
            expect(anomalies).toEqual([])
        })

        it('detects override_spike', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // Baseline: mean=2, stddev=1 → threshold = 2 + 3*1 = 5
            const baseline = makeBaseline({
                overrides: { mean: 2, stddev: 1 },
            })

            // Insert 10 override events in the last 24h
            for (let i = 0; i < 10; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`spike-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const spike = anomalies.find((a) => a.type === 'override_spike')
            expect(spike).toBeDefined()
            expect(spike!.observedValue).toBe(10)
            expect(spike!.threshold).toBe(5)
            expect(spike!.severity).toBe('critical') // (10-2)/1 = 8σ
        })

        it('detects violation_surge', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            const baseline = makeBaseline({
                violations: { mean: 3, stddev: 1 },
            })

            // Insert 10 violation events
            for (let i = 0; i < 10; i++) {
                db.prepare(`
                    INSERT INTO governance_events (id, event_type, rule_id, severity, file_path, actor, timestamp)
                    VALUES (?, 'violation', 'CLR-001', 'warning', '/test/file.tsx', 'test', ?)
                `).run(`viol-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const surge = anomalies.find((a) => a.type === 'violation_surge')
            expect(surge).toBeDefined()
            expect(surge!.observedValue).toBe(10)
        })

        it('detects velocity_spike', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            const baseline = makeBaseline({
                mutationVelocity: { mean: 5, stddev: 1 },
            })

            // Insert 20 mutations in the last hour
            for (let i = 0; i < 20; i++) {
                db.prepare(`
                    INSERT INTO mutations_ledger (id, file_path, operation_type, source, timestamp)
                    VALUES (?, '/test/file.tsx', 'updateProp', 'mcp_tool', ?)
                `).run(`mut-${i}`, recentTimestamp(10))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const vspike = anomalies.find((a) => a.type === 'velocity_spike')
            expect(vspike).toBeDefined()
            expect(vspike!.observedValue).toBe(20)
        })

        it('detects risk_drift', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            const baseline = makeBaseline({
                avgRiskScore: { mean: 30, stddev: 5 },
            })

            // Insert high risk scores in the last 24h
            for (let i = 0; i < 5; i++) {
                db.prepare(`
                    INSERT INTO mutation_risk_scores (mutation_id, score, tier, scored_at)
                    VALUES (?, 80, 'critical', ?)
                `).run(`risk-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const drift = anomalies.find((a) => a.type === 'risk_drift')
            expect(drift).toBeDefined()
            expect(drift!.observedValue).toBe(80)
        })

        it('detects agent_behavior_change', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            const baseline = makeBaseline({
                avgRiskScore: { mean: 20, stddev: 5 },
            })

            // Agent 'rogue-agent' with 3 high-risk mutations
            for (let i = 0; i < 3; i++) {
                const ts = recentTimestamp(30)
                db.prepare(`
                    INSERT INTO mutations_ledger (id, file_path, operation_type, source, timestamp, approved_by)
                    VALUES (?, '/test/file.tsx', 'deleteNode', 'ai_orchestrator', ?, 'rogue-agent')
                `).run(`agent-mut-${i}`, ts)
                db.prepare(`
                    INSERT INTO mutation_risk_scores (mutation_id, score, tier, scored_at)
                    VALUES (?, 85, 'critical', ?)
                `).run(`agent-mut-${i}`, ts)
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const agentAnomaly = anomalies.find((a) => a.type === 'agent_behavior_change')
            expect(agentAnomaly).toBeDefined()
            expect(agentAnomaly!.agentId).toBe('rogue-agent')
        })

        it('uses mean * 1.5 threshold when stddev is 0', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // Baseline: mean=4, stddev=0 → threshold = 4 * 1.5 = 6
            const baseline = makeBaseline({
                overrides: { mean: 4, stddev: 0 },
            })

            // Insert 7 overrides (> 6 threshold)
            for (let i = 0; i < 7; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`zstd-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const spike = anomalies.find((a) => a.type === 'override_spike')
            expect(spike).toBeDefined()
            expect(spike!.threshold).toBe(6) // mean * 1.5
            expect(spike!.severity).toBe('warning') // stddev=0 → always 'warning'
        })

        it('detects multiple anomaly types simultaneously', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            const baseline = makeBaseline({
                overrides: { mean: 1, stddev: 0.5 },
                violations: { mean: 1, stddev: 0.5 },
            })

            // Overrides: 10 (threshold = 1 + 1.5 = 2.5)
            for (let i = 0; i < 10; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`multi-o-${i}`, recentTimestamp(30))
            }
            // Violations: 10
            for (let i = 0; i < 10; i++) {
                db.prepare(`
                    INSERT INTO governance_events (id, event_type, rule_id, severity, file_path, actor, timestamp)
                    VALUES (?, 'violation', 'CLR-001', 'warning', '/test/file.tsx', 'test', ?)
                `).run(`multi-v-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const types = anomalies.map((a) => a.type)
            expect(types).toContain('override_spike')
            expect(types).toContain('violation_surge')
        })

        it('persists detected anomalies', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            const baseline = makeBaseline({
                overrides: { mean: 1, stddev: 0.5 },
            })

            for (let i = 0; i < 10; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`persist-${i}`, recentTimestamp(30))
            }

            service.detectAnomalies('/test/project', baseline)
            const history = service.getAnomalyHistory('/test/project')
            expect(history.length).toBeGreaterThan(0)
            expect(history[0].type).toBe('override_spike')
        })

        it('handles gracefully when prerequisite tables are missing', () => {
            const { service } = makeService()
            const baseline = makeBaseline()
            // Should not throw even though override_events etc. don't exist
            const anomalies = service.detectAnomalies('/test/project', baseline)
            expect(anomalies).toEqual([])
        })
    })

    describe('getAnomalyHistory', () => {
        it('returns empty array when no anomalies recorded', () => {
            const { service } = makeService()
            const history = service.getAnomalyHistory('/test/project')
            expect(history).toEqual([])
        })

        it('returns anomalies ordered newest-first', () => {
            const { service, db } = makeService()

            db.prepare(`
                INSERT INTO anomaly_history (id, type, severity, detected_at, observed_value,
                    baseline_mean, baseline_stddev, threshold, message, project_root, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('a1', 'override_spike', 'warning', '2026-01-01T00:00:00Z', 10, 2, 1, 5, 'old', '/test', null)

            db.prepare(`
                INSERT INTO anomaly_history (id, type, severity, detected_at, observed_value,
                    baseline_mean, baseline_stddev, threshold, message, project_root, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('a2', 'risk_drift', 'critical', '2026-03-01T00:00:00Z', 80, 30, 5, 45, 'new', '/test', null)

            const history = service.getAnomalyHistory('/test')
            expect(history).toHaveLength(2)
            expect(history[0].id).toBe('a2') // newer first
            expect(history[1].id).toBe('a1')
        })

        it('respects limit parameter', () => {
            const { service, db } = makeService()

            for (let i = 0; i < 10; i++) {
                db.prepare(`
                    INSERT INTO anomaly_history (id, type, severity, detected_at, observed_value,
                        baseline_mean, baseline_stddev, threshold, message, project_root, agent_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(`lim-${i}`, 'override_spike', 'warning', `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
                    10, 2, 1, 5, `msg-${i}`, '/test', null)
            }

            const history = service.getAnomalyHistory('/test', 3)
            expect(history).toHaveLength(3)
        })

        it('scopes by project_root', () => {
            const { service, db } = makeService()

            db.prepare(`
                INSERT INTO anomaly_history (id, type, severity, detected_at, observed_value,
                    baseline_mean, baseline_stddev, threshold, message, project_root, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('p1', 'override_spike', 'warning', '2026-01-01T00:00:00Z', 10, 2, 1, 5, 'proj1', '/proj1', null)

            db.prepare(`
                INSERT INTO anomaly_history (id, type, severity, detected_at, observed_value,
                    baseline_mean, baseline_stddev, threshold, message, project_root, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('p2', 'risk_drift', 'critical', '2026-01-01T00:00:00Z', 80, 30, 5, 45, 'proj2', '/proj2', null)

            expect(service.getAnomalyHistory('/proj1')).toHaveLength(1)
            expect(service.getAnomalyHistory('/proj2')).toHaveLength(1)
            expect(service.getAnomalyHistory('/proj3')).toHaveLength(0)
        })
    })

    describe('severity derivation', () => {
        it('assigns warning at exactly 3 sigma', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // mean=10, stddev=2, threshold=16. Value of 16 = exactly 3σ
            const baseline = makeBaseline({
                overrides: { mean: 10, stddev: 2 },
            })

            // Insert exactly 17 overrides (> 16 threshold, 3.5σ → warning)
            for (let i = 0; i < 17; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`sev-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const spike = anomalies.find((a) => a.type === 'override_spike')
            expect(spike).toBeDefined()
            // (17-10)/2 = 3.5σ → warning
            expect(spike!.severity).toBe('warning')
        })

        it('assigns critical at 4+ sigma', () => {
            const db = makeDb()
            createPrereqTables(db)
            const { service } = makeService(db)

            // mean=5, stddev=2, 4σ threshold = 13
            const baseline = makeBaseline({
                overrides: { mean: 5, stddev: 2 },
            })

            // Insert 14 overrides → (14-5)/2 = 4.5σ → critical
            for (let i = 0; i < 14; i++) {
                db.prepare(`
                    INSERT INTO override_events (id, rule_id, timestamp, project_root)
                    VALUES (?, 'CLR-001', ?, '/test/project')
                `).run(`crit-${i}`, recentTimestamp(30))
            }

            const anomalies = service.detectAnomalies('/test/project', baseline)
            const spike = anomalies.find((a) => a.type === 'override_spike')
            expect(spike).toBeDefined()
            expect(spike!.severity).toBe('critical')
        })
    })
})
