/**
 * MithrilBaselineService — flint-mcp/src/core/mithrilBaseline.ts
 *
 * SQLite-backed baseline snapshot service for Mithril Delta Mode (MDA.1).
 *
 * Problem context: teams adopting Flint mid-project see 200+ existing
 * violations and disengage. Delta mode changes the adoption story from
 * "fix everything" to "don't regress from where you started."
 *
 * Design decisions:
 *   - Violation hashing is deterministic: SHA-256 of "ruleId|nodeId|value".
 *     Same violation always produces the same hash regardless of when it runs.
 *   - Baseline is per-project-root. Multiple projects are fully independent.
 *   - Delta mode is strictly opt-in. When no baseline exists the service
 *     returns all violations unchanged (backward compatible with callers that
 *     do not know about baselines).
 *   - All SQLite ops are synchronous (better-sqlite3 style).
 *
 * SQLite table: mithril_baseline
 *   PRIMARY KEY: (project_root, snapshot_id, violation_hash)
 *
 * This module runs in the MCP server process (Node.js). It MUST NOT be
 * imported anywhere inside src/ (process boundary law).
 */

import { createHash, randomFillSync } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { LinterWarning } from '../types.js'

// ── Public types ──────────────────────────────────────────────────────────────

export interface FileSnapshot {
    filePath: string
    violationCount: number
    violationHashes: string[]
}

export interface BaselineSnapshot {
    projectRoot: string
    snapshotId: string
    capturedAt: string
    fileSnapshots: FileSnapshot[]
}

/**
 * The result of auditDelta — the subset of currentViolations that are new
 * (not present in the baseline).
 */
export interface DeltaResult {
    /** Violations that are genuinely new (not in the stored baseline). */
    newViolations: LinterWarning[]
    /** Number of violations suppressed because they exist in the baseline. */
    baselineViolationCount: number
    /**
     * True when the project has a stored baseline. False means all violations
     * are returned unchanged — the caller can treat this the same as a full audit.
     */
    hasBaseline: boolean
    /** The snapshot ID that was used for comparison, or null if no baseline. */
    snapshotId: string | null
}

// ── Internal row types ────────────────────────────────────────────────────────

interface BaselineRow {
    project_root: string
    snapshot_id: string
    captured_at: string
    file_path: string
    violation_hash: string
    rule_id: string | null
    node_id: string | null
}

interface SnapshotIdRow {
    snapshot_id: string
    captured_at: string
}

// ── DDL ───────────────────────────────────────────────────────────────────────

const DDL = `
CREATE TABLE IF NOT EXISTS mithril_baseline (
    project_root    TEXT NOT NULL,
    snapshot_id     TEXT NOT NULL,
    captured_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    file_path       TEXT NOT NULL,
    violation_hash  TEXT NOT NULL,
    rule_id         TEXT,
    node_id         TEXT,
    PRIMARY KEY (project_root, snapshot_id, violation_hash)
);

CREATE INDEX IF NOT EXISTS idx_mithril_baseline_project
    ON mithril_baseline (project_root, captured_at DESC);
`

// ── Hash function ─────────────────────────────────────────────────────────────

/**
 * Deterministic SHA-256 hash of a LinterWarning for baseline diffing.
 *
 * Components:
 *   - ruleId  — the rule that fired (MITHRIL-COL, MITHRIL-TYP-001, A11Y-001, etc.)
 *   - id      — the flint node ID (data-flint-id attribute value)
 *   - value   — the numeric violation magnitude (stringified to 6 decimal places)
 *
 * These three fields uniquely identify a structural occurrence of a violation.
 * The message text is intentionally excluded — if a token is renamed the
 * message changes but the violation is still the same occurrence.
 */
export function computeViolationHash(warning: LinterWarning): string {
    const ruleId = warning.ruleId ?? warning.type
    const nodeId = warning.id
    // Round value to 6dp to avoid float noise across runs (e.g. 14.123456789…)
    const value = warning.value.toFixed(6)
    const raw = `${ruleId}|${nodeId}|${value}`
    return createHash('sha256').update(raw, 'utf8').digest('hex')
}

// ── UUID helper ───────────────────────────────────────────────────────────────

/**
 * RFC 4122 v4-compatible UUID using Node.js crypto.randomFillSync.
 * Synchronous — no event loop involvement. Safe to call from better-sqlite3
 * transactions.
 */
function generateUuid(): string {
    const bytes = new Uint8Array(16)
    randomFillSync(bytes)

    // Set version (4) and variant (RFC 4122) bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('-')
}

// ── Service class ─────────────────────────────────────────────────────────────

export class MithrilBaselineService {
    private readonly db: Database.Database

    /**
     * @param db - An open better-sqlite3 Database instance.
     *   Pass `new Database(':memory:')` in tests;
     *   pass the shared app database instance in production.
     */
    constructor(db: Database.Database) {
        this.db = db
        this.db.exec(DDL)
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Snapshot the current audit results as the new baseline for this project.
     *
     * The snapshot replaces any previously stored baseline: the old rows are
     * deleted inside the same transaction so the table never holds two
     * concurrent snapshots for the same project root.
     *
     * @param projectRoot  - Absolute path to the project root directory.
     * @param auditResults - Map of filePath → array of LinterWarnings.
     *   Typically the result of running auditAll() on every project file.
     * @returns The new BaselineSnapshot (snapshotId + capturedAt assigned here).
     */
    captureBaseline(
        projectRoot: string,
        auditResults: Map<string, LinterWarning[]>,
    ): BaselineSnapshot {
        const snapshotId = generateUuid()
        const capturedAt = new Date().toISOString()

        const insertRow = this.db.prepare<[string, string, string, string, string, string | null, string | null]>(`
            INSERT INTO mithril_baseline
                (project_root, snapshot_id, captured_at, file_path, violation_hash, rule_id, node_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)

        const deleteOld = this.db.prepare<[string]>(`
            DELETE FROM mithril_baseline WHERE project_root = ?
        `)

        const fileSnapshots: FileSnapshot[] = []

        const transaction = this.db.transaction(() => {
            // Clear the old baseline for this project atomically.
            deleteOld.run(projectRoot)

            for (const [filePath, warnings] of auditResults) {
                const hashes: string[] = []

                for (const warning of warnings) {
                    const hash = computeViolationHash(warning)
                    hashes.push(hash)
                    insertRow.run(
                        projectRoot,
                        snapshotId,
                        capturedAt,
                        filePath,
                        hash,
                        warning.ruleId ?? null,
                        warning.id,
                    )
                }

                fileSnapshots.push({
                    filePath,
                    violationCount: warnings.length,
                    violationHashes: hashes,
                })
            }

            // If the map was empty, insert a sentinel row so hasBaseline()
            // returns true — an empty baseline is still a captured baseline.
            if (auditResults.size === 0) {
                insertRow.run(
                    projectRoot,
                    snapshotId,
                    capturedAt,
                    '__sentinel__',
                    '__sentinel__',
                    null,
                    null,
                )
            }
        })

        transaction()

        return { projectRoot, snapshotId, capturedAt, fileSnapshots }
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Retrieve the most recent baseline for the given project root.
     *
     * Returns null when no baseline has been captured yet.
     */
    getBaseline(projectRoot: string): BaselineSnapshot | null {
        // Find the most recent snapshot_id for this project.
        const snapshotRow = this.db.prepare<[string], SnapshotIdRow>(`
            SELECT snapshot_id, captured_at
            FROM mithril_baseline
            WHERE project_root = ?
            ORDER BY captured_at DESC
            LIMIT 1
        `).get(projectRoot)

        if (snapshotRow === undefined) return null

        const { snapshot_id: snapshotId, captured_at: capturedAt } = snapshotRow

        // Load all rows for that snapshot.
        const rows = this.db.prepare<[string, string], BaselineRow>(`
            SELECT project_root, snapshot_id, captured_at,
                   file_path, violation_hash, rule_id, node_id
            FROM mithril_baseline
            WHERE project_root = ? AND snapshot_id = ?
            ORDER BY file_path
        `).all(projectRoot, snapshotId)

        // Reconstruct per-file snapshots (skip sentinel rows from empty baselines).
        const fileMap = new Map<string, string[]>()
        for (const row of rows) {
            if (row.file_path === '__sentinel__') continue
            const existing = fileMap.get(row.file_path)
            if (existing !== undefined) {
                existing.push(row.violation_hash)
            } else {
                fileMap.set(row.file_path, [row.violation_hash])
            }
        }

        const fileSnapshots: FileSnapshot[] = []
        for (const [filePath, hashes] of fileMap) {
            fileSnapshots.push({
                filePath,
                violationCount: hashes.length,
                violationHashes: hashes,
            })
        }

        return { projectRoot, snapshotId, capturedAt, fileSnapshots }
    }

    /**
     * Returns true when a baseline exists for the given project root.
     */
    hasBaseline(projectRoot: string): boolean {
        const row = this.db.prepare<[string], { count: number }>(`
            SELECT COUNT(*) AS count
            FROM mithril_baseline
            WHERE project_root = ?
        `).get(projectRoot)
        return (row?.count ?? 0) > 0
    }

    /**
     * Removes all baseline rows for the given project root, returning the
     * system to full-audit mode for that project.
     *
     * @returns Number of rows deleted.
     */
    clearBaseline(projectRoot: string): number {
        const result = this.db.prepare<[string]>(`
            DELETE FROM mithril_baseline WHERE project_root = ?
        `).run(projectRoot)
        return result.changes
    }

    // ── Delta audit ───────────────────────────────────────────────────────────

    /**
     * Filter `currentViolations` to only those that are not in the stored
     * baseline for `projectRoot`.
     *
     * When no baseline exists, all violations are returned unchanged (backward
     * compatible). The DeltaResult includes context for callers to display
     * "14 baseline violations suppressed" messaging.
     *
     * @param currentViolations - Flat array of LinterWarnings from the current
     *   audit run (all files combined, or a single file — callers decide scope).
     * @param projectRoot - Project root used to look up the stored baseline.
     */
    auditDelta(currentViolations: LinterWarning[], projectRoot: string): DeltaResult {
        const baseline = this.getBaseline(projectRoot)

        if (baseline === null) {
            // No baseline — return everything unchanged (backward compatible).
            return {
                newViolations: currentViolations,
                baselineViolationCount: 0,
                hasBaseline: false,
                snapshotId: null,
            }
        }

        // Build a flat set of all hashes in the stored baseline (sentinel excluded by getBaseline).
        const baselineHashes = new Set<string>()
        for (const fileSnapshot of baseline.fileSnapshots) {
            for (const hash of fileSnapshot.violationHashes) {
                if (hash !== '__empty_baseline__') baselineHashes.add(hash)
            }
        }

        const newViolations: LinterWarning[] = []
        let suppressedCount = 0

        for (const violation of currentViolations) {
            const hash = computeViolationHash(violation)
            if (baselineHashes.has(hash)) {
                suppressedCount++
            } else {
                newViolations.push(violation)
            }
        }

        return {
            newViolations,
            baselineViolationCount: suppressedCount,
            hasBaseline: true,
            snapshotId: baseline.snapshotId,
        }
    }
}
