/**
 * RiskScoringService — flint-mcp/src/core/governance/riskScoringService.ts
 *
 * Assigns a numerical risk score (0-100) to each AST mutation based on five
 * weighted factors: provenance source, mutation type, violation state, file
 * sensitivity, and mutation velocity.
 *
 * Uses better-sqlite3 (synchronous API). Constructor accepts a Database
 * instance for dependency injection — callers supply the db handle so the
 * service is trivially testable with an in-memory SQLite database.
 *
 * The mutation_risk_scores table stores one row per scored mutation. Scores
 * are recomputed on each call to scoreMutation; existing rows are replaced
 * (INSERT OR REPLACE) so the table always reflects the latest evaluation.
 *
 * Phase: V.1-rs (Mutation Risk Scoring)
 * Unblocked by: V.2-mp (Mutation Provenance Ledger — ONLINE)
 *
 * MCP tool registration deferred — see ACTIVE-SWARM-TERRITORY.md
 */

import type Database from 'better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { MutationProvenanceService } from './mutationProvenanceService.js'
import { MutationLedgerService } from './mutationLedgerService.js'
import type {
    RiskScore,
    RiskFactor,
    RiskTier,
    FileRiskProfile,
    ProjectRiskSummary,
    MutationOperationType,
    ProvenanceSource,
    MRSTier,
    MRSFactor,
    MutationRiskScore,
    RiskScoringInput,
} from './types.js'

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS mutation_risk_scores (
    mutation_id     TEXT    PRIMARY KEY,
    score           REAL    NOT NULL CHECK (score >= 0 AND score <= 100),
    tier            TEXT    NOT NULL CHECK (tier IN ('low', 'medium', 'high', 'critical')),
    factors_json    TEXT    NOT NULL DEFAULT '[]',
    scored_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_risk_tier      ON mutation_risk_scores(tier);
CREATE INDEX IF NOT EXISTS idx_risk_scored_at ON mutation_risk_scores(scored_at);
CREATE INDEX IF NOT EXISTS idx_risk_score     ON mutation_risk_scores(score);
`

// ---------------------------------------------------------------------------
// Row shape returned by better-sqlite3
// ---------------------------------------------------------------------------

interface RiskScoreRow {
    mutation_id: string
    score: number
    tier: string
    factors_json: string
    scored_at: string
}

// ---------------------------------------------------------------------------
// Factor weight constants
// ---------------------------------------------------------------------------

/** Provenance source → raw contribution (0-100 scale before weighting). */
const PROVENANCE_RAW: Record<ProvenanceSource, number> = {
    human: 0,
    'auto-fix': 10,
    'auto-heal': 20,
    import: 30,
    agent: 50,
}

/** Mutation operation type → raw contribution (0-100 scale before weighting). */
const OPERATION_TYPE_RAW: Record<MutationOperationType, number> = {
    updateTextContent: 5,
    updateClassName: 10,
    updateProp: 15,
    addClass: 20,
    removeClass: 20,
    fixToken: 25,
    assembleLayout: 30,
    move: 35,
    crossFileMove: 40,
    insertNode: 40,
    inject: 40,
    wrapNode: 45,
    deleteNode: 50,
}

/** Weights for each factor (must sum to 1.0). */
const WEIGHTS = {
    provenance: 0.30,
    operationType: 0.20,
    violationState: 0.20,
    fileSensitivity: 0.15,
    velocity: 0.15,
} as const

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Classify a file path into a raw file-sensitivity score (0-100 scale before
 * weighting). Higher values indicate files that are more risky to mutate.
 *
 * Tiers:
 *   70 — entry-point files (App.tsx, main.tsx, index.tsx)
 *   50 — shared/lib files (paths containing shared/, lib/, hooks/, store/)
 *   40 — layout/page files (paths containing layout/, page/, pages/, Layout, Page)
 *   20 — all other files
 */
function fileSensitivityRaw(filePath: string): number {
    const lower = filePath.toLowerCase()
    const base = lower.split('/').pop() ?? lower

    // Entry-point detection
    if (
        base === 'app.tsx' ||
        base === 'app.ts' ||
        base === 'index.tsx' ||
        base === 'index.ts' ||
        base === 'main.tsx' ||
        base === 'main.ts'
    ) {
        return 70
    }

    // Shared/lib detection
    if (
        lower.includes('/shared/') ||
        lower.includes('/lib/') ||
        lower.includes('/hooks/') ||
        lower.includes('/store/')
    ) {
        return 50
    }

    // Layout/page detection
    if (
        lower.includes('/layout') ||
        lower.includes('/page') ||
        lower.includes('/pages/')
    ) {
        return 40
    }

    return 20
}

/**
 * Compute a velocity raw score (0-100 scale before weighting) from the
 * count of mutations recorded for the same file in the last 5 minutes.
 *
 *   < 3  → 0   (quiet)
 *   3-9  → 20  (active)
 *   10-19→ 40  (rapid)
 *   20+  → 60  (alarm)
 */
function velocityRaw(count: number): number {
    if (count < 3) return 0
    if (count < 10) return 20
    if (count < 20) return 40
    return 60
}

/**
 * Clamp a number to [0, 100].
 */
function clamp(n: number): number {
    return Math.max(0, Math.min(100, n))
}

// ---------------------------------------------------------------------------
// Context type for scoreMutation
// ---------------------------------------------------------------------------

export interface ScoreMutationContext {
    /**
     * Number of current violations on the node. If the provenance service does
     * not have violation data, pass 0.
     */
    violationCount?: number

    /**
     * Whether any current violation is 'critical'. Ignored when violationCount
     * is 0.
     */
    hasCritical?: boolean

    /**
     * Whether the node was just auto-fixed from a critical violation. This is
     * the riskiest violation state (mutation touched a known-bad node).
     */
    wasAutoFixedFromCritical?: boolean

    /**
     * ISO 8601 timestamp for velocity window start. Defaults to 5 minutes ago
     * from the current system time when omitted.
     */
    velocityWindowStart?: string

    /**
     * If supplied, this count is used directly for the velocity factor instead
     * of querying the ledger. Useful in tests.
     */
    velocityCount?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToRiskScore(row: RiskScoreRow): RiskScore {
    let factors: RiskFactor[] = []
    try {
        factors = JSON.parse(row.factors_json) as RiskFactor[]
    } catch {
        factors = []
    }
    return {
        mutationId: row.mutation_id,
        score: row.score,
        tier: row.tier as RiskTier,
        factors,
        scoredAt: row.scored_at,
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RiskScoringService {
    private readonly db: Database.Database
    private readonly provenance: MutationProvenanceService
    private readonly ledger: MutationLedgerService

    constructor(db: Database.Database) {
        this.db = db
        // Both dependency services are constructed with the same db handle so
        // they share schema initialisation — each uses IF NOT EXISTS DDL so
        // repeated construction is harmless.
        this.provenance = new MutationProvenanceService(db)
        this.ledger = new MutationLedgerService(db)
        this.db.exec(INIT_SQL)
    }

    // -------------------------------------------------------------------------
    // Public API — tier mapping
    // -------------------------------------------------------------------------

    /**
     * Map a numeric score to a RiskTier string.
     *
     *   0-25   → 'low'
     *   26-50  → 'medium'
     *   51-75  → 'high'
     *   76-100 → 'critical'
     */
    getRiskTier(score: number): RiskTier {
        if (score <= 25) return 'low'
        if (score <= 50) return 'medium'
        if (score <= 75) return 'high'
        return 'critical'
    }

    // -------------------------------------------------------------------------
    // Public API — single mutation
    // -------------------------------------------------------------------------

    /**
     * Compute and persist a risk score for a single mutation.
     *
     * Reads provenance from mutation_provenance and the ledger entry from
     * mutations_ledger. Both tables must have a row for the given mutationId
     * or the method returns null.
     *
     * @param mutationId  The UUID from mutations_ledger / mutation_provenance.
     * @param context     Optional supplemental signals (violation state,
     *                    velocity override).
     */
    scoreMutation(mutationId: string, context: ScoreMutationContext = {}): RiskScore | null {
        // ── 1. Fetch ledger entry ────────────────────────────────────────────
        const ledgerRow = this.db
            .prepare('SELECT * FROM mutations_ledger WHERE id = ?')
            .get(mutationId) as {
                id: string
                file_path: string
                operation_type: string
                source: string
                timestamp: string
            } | undefined

        if (ledgerRow === undefined) return null

        // ── 2. Fetch provenance ──────────────────────────────────────────────
        const prov = this.provenance.getProvenance(mutationId)
        // Provenance is optional — if not recorded, treat as unknown source
        // (mapped to the riskiest non-agent tier: 'import').
        const provenanceSource: ProvenanceSource =
            prov?.provenanceSource ?? 'import'

        // ── 3. Compute factor: provenance (weight 30%) ───────────────────────
        const provenanceRaw = PROVENANCE_RAW[provenanceSource] ?? 30
        const provenanceContribution = provenanceRaw * WEIGHTS.provenance

        const provenanceFactor: RiskFactor = {
            name: 'provenance',
            weight: WEIGHTS.provenance,
            rawValue: provenanceRaw,
            contribution: clamp(provenanceContribution),
            description: `Source: ${provenanceSource}`,
        }

        // ── 4. Compute factor: operation type (weight 20%) ───────────────────
        const opType = ledgerRow.operation_type as MutationOperationType
        const opRaw = OPERATION_TYPE_RAW[opType] ?? 30
        const opContribution = opRaw * WEIGHTS.operationType

        const operationFactor: RiskFactor = {
            name: 'operationType',
            weight: WEIGHTS.operationType,
            rawValue: opRaw,
            contribution: clamp(opContribution),
            description: `Operation: ${opType}`,
        }

        // ── 5. Compute factor: violation state (weight 20%) ──────────────────
        let violationRaw = 0
        if (context.wasAutoFixedFromCritical === true) {
            violationRaw = 80
        } else if ((context.violationCount ?? 0) > 0) {
            violationRaw = context.hasCritical === true ? 60 : 30
        }
        const violationContribution = violationRaw * WEIGHTS.violationState

        const violationFactor: RiskFactor = {
            name: 'violationState',
            weight: WEIGHTS.violationState,
            rawValue: violationRaw,
            contribution: clamp(violationContribution),
            description: context.wasAutoFixedFromCritical
                ? 'Node was auto-fixed from critical violation'
                : context.hasCritical
                ? 'Node has critical violation'
                : (context.violationCount ?? 0) > 0
                ? 'Node has amber violations'
                : 'No violations',
        }

        // ── 6. Compute factor: file sensitivity (weight 15%) ─────────────────
        const fileSensRaw = fileSensitivityRaw(ledgerRow.file_path)
        const fileSensContribution = fileSensRaw * WEIGHTS.fileSensitivity

        const fileSensitivityFactor: RiskFactor = {
            name: 'fileSensitivity',
            weight: WEIGHTS.fileSensitivity,
            rawValue: fileSensRaw,
            contribution: clamp(fileSensContribution),
            description: `File: ${ledgerRow.file_path}`,
        }

        // ── 7. Compute factor: velocity (weight 15%) ─────────────────────────
        let velocityCount: number
        if (context.velocityCount !== undefined) {
            velocityCount = context.velocityCount
        } else {
            const windowStart =
                context.velocityWindowStart ??
                new Date(Date.now() - 5 * 60 * 1000).toISOString()

            const countRow = this.db
                .prepare(`
                    SELECT COUNT(*) AS cnt
                    FROM mutations_ledger
                    WHERE file_path = ? AND timestamp >= ?
                `)
                .get(ledgerRow.file_path, windowStart) as { cnt: number }
            velocityCount = countRow.cnt
        }

        const velRaw = velocityRaw(velocityCount)
        const velContribution = velRaw * WEIGHTS.velocity

        const velocityFactor: RiskFactor = {
            name: 'velocity',
            weight: WEIGHTS.velocity,
            rawValue: velRaw,
            contribution: clamp(velContribution),
            description: `${velocityCount} mutations in last 5min`,
        }

        // ── 8. Aggregate score ───────────────────────────────────────────────
        const rawScore =
            provenanceFactor.contribution +
            operationFactor.contribution +
            violationFactor.contribution +
            fileSensitivityFactor.contribution +
            velocityFactor.contribution

        const score = clamp(Math.round(rawScore * 10) / 10)
        const tier = this.getRiskTier(score)
        const factors: RiskFactor[] = [
            provenanceFactor,
            operationFactor,
            violationFactor,
            fileSensitivityFactor,
            velocityFactor,
        ]
        const scoredAt = new Date().toISOString()

        // ── 9. Persist (upsert) ──────────────────────────────────────────────
        this.db
            .prepare(`
                INSERT OR REPLACE INTO mutation_risk_scores
                    (mutation_id, score, tier, factors_json, scored_at)
                VALUES (?, ?, ?, ?, ?)
            `)
            .run(mutationId, score, tier, JSON.stringify(factors), scoredAt)

        return { mutationId, score, tier, factors, scoredAt }
    }

    // -------------------------------------------------------------------------
    // Public API — batch
    // -------------------------------------------------------------------------

    /**
     * Score multiple mutations in a single pass. Mutations with no ledger
     * entry are skipped (no null in the output array — the array length may
     * be shorter than the input).
     *
     * @param mutationIds  Array of mutation UUIDs to score.
     * @param context      Shared context applied to all mutations in the batch.
     */
    scoreBatch(
        mutationIds: string[],
        context: ScoreMutationContext = {},
    ): RiskScore[] {
        const results: RiskScore[] = []

        const batchFn = this.db.transaction(() => {
            for (const id of mutationIds) {
                const result = this.scoreMutation(id, context)
                if (result !== null) {
                    results.push(result)
                }
            }
        })

        batchFn()
        return results
    }

    // -------------------------------------------------------------------------
    // Public API — file risk profile
    // -------------------------------------------------------------------------

    /**
     * Aggregate all persisted risk scores for a given file path.
     *
     * Returns null if no mutations have been scored for the file.
     *
     * Trend is computed by comparing the mean score of the first half of scored
     * mutations vs the second half (oldest first). If the second-half mean is
     * more than 5 points higher, trend is 'rising'; more than 5 points lower,
     * trend is 'falling'; otherwise 'stable'.
     */
    getFileRiskProfile(filePath: string): FileRiskProfile | null {
        // Join risk scores with ledger to filter by file path.
        const rows = this.db
            .prepare(`
                SELECT mrs.mutation_id, mrs.score, mrs.scored_at
                FROM mutation_risk_scores mrs
                INNER JOIN mutations_ledger ml ON mrs.mutation_id = ml.id
                WHERE ml.file_path = ?
                ORDER BY mrs.scored_at ASC
            `)
            .all(filePath) as Array<{ mutation_id: string; score: number; scored_at: string }>

        if (rows.length === 0) return null

        const scores = rows.map((r) => r.score)
        const mutationCount = scores.length
        const maxScore = Math.max(...scores)
        const meanScore =
            Math.round((scores.reduce((a, b) => a + b, 0) / mutationCount) * 10) / 10

        // Trend: compare first half vs second half
        let trend: 'rising' | 'falling' | 'stable' = 'stable'
        if (mutationCount >= 4) {
            const half = Math.floor(mutationCount / 2)
            const firstHalf = scores.slice(0, half)
            const secondHalf = scores.slice(half)
            const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
            const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
            const delta = secondMean - firstMean
            if (delta > 5) trend = 'rising'
            else if (delta < -5) trend = 'falling'
        }

        return { filePath, meanScore, maxScore, mutationCount, trend }
    }

    // -------------------------------------------------------------------------
    // Public API — project risk summary
    // -------------------------------------------------------------------------

    /**
     * Compute a project-wide risk summary from all persisted risk scores.
     *
     * Returns:
     *   - totalScored: number of scored mutations
     *   - distribution: count per RiskTier
     *   - riskiestFiles: top-5 files by mean risk score
     *   - riskiestAgents: top-5 agents by mean risk score (agent provenance only)
     */
    getProjectRiskSummary(): ProjectRiskSummary {
        // Total scored
        const totalRow = this.db
            .prepare('SELECT COUNT(*) AS cnt FROM mutation_risk_scores')
            .get() as { cnt: number }
        const totalScored = totalRow.cnt

        // Distribution by tier
        const tierRows = this.db
            .prepare(`
                SELECT tier, COUNT(*) AS cnt
                FROM mutation_risk_scores
                GROUP BY tier
            `)
            .all() as Array<{ tier: string; cnt: number }>

        const distribution: Record<RiskTier, number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        }
        for (const row of tierRows) {
            const t = row.tier as RiskTier
            if (t in distribution) {
                distribution[t] = row.cnt
            }
        }

        // Riskiest files: join with mutations_ledger to get file paths
        const fileRows = this.db
            .prepare(`
                SELECT ml.file_path, AVG(mrs.score) AS mean_score
                FROM mutation_risk_scores mrs
                INNER JOIN mutations_ledger ml ON mrs.mutation_id = ml.id
                GROUP BY ml.file_path
                ORDER BY mean_score DESC
                LIMIT 5
            `)
            .all() as Array<{ file_path: string; mean_score: number }>

        const riskiestFiles = fileRows.map((row) => ({
            filePath: row.file_path,
            meanScore: Math.round(row.mean_score * 10) / 10,
        }))

        // Riskiest agents: join with provenance to get agent IDs
        const agentRows = this.db
            .prepare(`
                SELECT mp.provenance_agent_id, AVG(mrs.score) AS mean_score
                FROM mutation_risk_scores mrs
                INNER JOIN mutation_provenance mp ON mrs.mutation_id = mp.mutation_id
                WHERE mp.provenance_agent_id IS NOT NULL
                  AND mp.provenance_source = 'agent'
                GROUP BY mp.provenance_agent_id
                ORDER BY mean_score DESC
                LIMIT 5
            `)
            .all() as Array<{ provenance_agent_id: string; mean_score: number }>

        const riskiestAgents = agentRows.map((row) => ({
            agentId: row.provenance_agent_id,
            meanScore: Math.round(row.mean_score * 10) / 10,
        }))

        return { totalScored, distribution, riskiestFiles, riskiestAgents }
    }

    // -------------------------------------------------------------------------
    // Public API — retrieve persisted score
    // -------------------------------------------------------------------------

    /**
     * Retrieve a previously computed and persisted risk score.
     * Returns null if the mutation has not been scored yet.
     */
    getScore(mutationId: string): RiskScore | null {
        const row = this.db
            .prepare('SELECT * FROM mutation_risk_scores WHERE mutation_id = ?')
            .get(mutationId) as RiskScoreRow | undefined

        return row !== undefined ? rowToRiskScore(row) : null
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Delete risk score records scored before `olderThan` (ISO 8601 UTC).
     * Returns the number of rows deleted.
     */
    pruneScores(olderThan: string): number {
        const result = this.db
            .prepare('DELETE FROM mutation_risk_scores WHERE scored_at < ?')
            .run(olderThan)
        return result.changes
    }
}

// =============================================================================
// V.1-rs: Stateless function-based MRS API (0.0–1.0 scale, green/amber/red)
//
// This is a lightweight, purely functional scorer that does NOT persist to a
// database. It uses the four-factor MRS formula:
//
//   mrs = clamp(opWeight×0.4 + blastRadius×0.35 + severity×0.15 + familiarity×0.1)
//
// Use this API when you need a quick inline risk estimate without needing the
// full provenance/ledger context that RiskScoringService requires.
// =============================================================================

/** Static risk weight table for the function-based MRS (0.0–1.0 scale). */
const MRS_OP_WEIGHTS: Record<string, number> = {
    updateClassName: 0.1,
    fixToken: 0.1,
    updateTextContent: 0.15,
    updateProp: 0.2,
    injectNode: 0.4,
    inject: 0.4,
    wrapNode: 0.5,
    moveNode: 0.6,
    move: 0.6,
    deleteNode: 0.65,
    assembleLayout: 0.7,
    crossFileMove: 0.85,
} as const

/** Default weight for unknown op types. */
const MRS_UNKNOWN_OP_WEIGHT = 0.5

/** Factor weights for the MRS formula. Must sum to 1.0. */
const MRS_WEIGHTS = {
    opWeight: 0.40,
    blastRadius: 0.35,
    severity: 0.15,
    familiarity: 0.10,
} as const

/**
 * Clamp a number to [0.0, 1.0], rounding to 4 decimal places.
 */
function mrsClamped(n: number): number {
    return Math.round(Math.max(0.0, Math.min(1.0, n)) * 10000) / 10000
}

/**
 * Derive the MRSTier for a score in [0.0, 1.0].
 *
 *   green  0.0–0.30
 *   amber  0.31–0.69
 *   red    0.70–1.0
 */
export function getTier(score: number): MRSTier {
    if (score <= 0.30) return 'green'
    if (score <= 0.69) return 'amber'
    return 'red'
}

/**
 * Return a human-readable recommendation for a given tier and op type.
 */
export function getRecommendation(tier: MRSTier, opType: string): string {
    switch (tier) {
        case 'green':
            return `Low risk — auto-approve eligible. Operation '${opType}' has minimal blast radius and no structural side-effects.`
        case 'amber':
            return `Moderate risk — human review required before executing '${opType}'. Verify the affected nodes and check for downstream references.`
        case 'red':
            return `High risk — senior sign-off recommended before executing '${opType}'. This is a structural change with significant blast radius. Log a justification and verify there are no unsaved overrides.`
    }
}

/**
 * Query .flint/provenance.db to count how many prior mutations exist for
 * the given filePath. Returns -1 if the DB does not exist or any error occurs.
 *
 * Never throws.
 */
function queryProvenance(projectRoot: string, filePath: string): number {
    try {
        const dbPath = path.join(projectRoot, '.flint', 'provenance.db')
        if (!fs.existsSync(dbPath)) return -1

        // Open read-only to avoid creating the db if it's missing
        const db = new BetterSqlite3(dbPath, { readonly: true })
        try {
            // mutation_provenance does not store file_path directly; we join to
            // mutations_ledger which does. If mutations_ledger doesn't exist yet,
            // the query will throw and we fall through to return -1.
            const row = db
                .prepare(`
                    SELECT COUNT(*) AS cnt
                    FROM mutation_provenance mp
                    INNER JOIN mutations_ledger ml ON mp.mutation_id = ml.id
                    WHERE ml.file_path = ?
                `)
                .get(filePath) as { cnt: number } | undefined
            return row?.cnt ?? 0
        } finally {
            db.close()
        }
    } catch {
        return -1
    }
}

/**
 * Compute a stateless Mutation Risk Score (MRS) for a proposed AST mutation.
 *
 * Formula:
 *   mrs = clamp(opWeight×0.4 + blastRadiusFactor×0.35 + severityFactor×0.15 + familiarityFactor×0.1)
 *
 * Where:
 *   blastRadiusFactor = min(affectedNodeCount / 10, 1.0)
 *   severityFactor    = 0.0 (no context) | 0.3 (amber) | 0.7 (structural + no baseline)
 *   familiarityFactor = 0.0 (5+ prior mutations) | 0.1 (neutral) | 0.2 (no history)
 *
 * Never throws.
 */
export function scoreMutation(input: RiskScoringInput): MutationRiskScore {
    const { opType, affectedNodeCount = 1, filePath, hasViolationContext, projectRoot } = input

    // ── Factor 1: operation weight ──────────────────────────────────────────
    const opWeightRaw = MRS_OP_WEIGHTS[opType] ?? MRS_UNKNOWN_OP_WEIGHT
    const opWeightContribution = mrsClamped(opWeightRaw * MRS_WEIGHTS.opWeight)

    const opFactor: MRSFactor = {
        name: 'opWeight',
        weight: MRS_WEIGHTS.opWeight,
        contribution: opWeightContribution,
        rationale: `Operation '${opType}' has base risk weight ${opWeightRaw.toFixed(2)}`,
    }

    // ── Factor 2: blast radius ───────────────────────────────────────────────
    const blastRadiusRaw = Math.min((affectedNodeCount ?? 1) / 10, 1.0)
    const blastRadiusContribution = mrsClamped(blastRadiusRaw * MRS_WEIGHTS.blastRadius)

    const blastFactor: MRSFactor = {
        name: 'blastRadius',
        weight: MRS_WEIGHTS.blastRadius,
        contribution: blastRadiusContribution,
        rationale: `${affectedNodeCount ?? 1} affected node(s); blast radius factor ${blastRadiusRaw.toFixed(2)}`,
    }

    // ── Factor 3: severity ───────────────────────────────────────────────────
    // 0.0 for read-only/fix ops with no violation context
    // 0.3 for amber (hasViolationContext = true, non-structural op)
    // 0.7 for structural mutations with no audit baseline
    const isStructural = (opWeightRaw >= 0.5)
    let severityRaw: number
    if (isStructural && !hasViolationContext) {
        severityRaw = 0.7
    } else if (hasViolationContext) {
        severityRaw = 0.3
    } else {
        severityRaw = 0.0
    }
    const severityContribution = mrsClamped(severityRaw * MRS_WEIGHTS.severity)

    const severityFactor: MRSFactor = {
        name: 'severity',
        weight: MRS_WEIGHTS.severity,
        contribution: severityContribution,
        rationale: isStructural && !hasViolationContext
            ? 'Structural op with no audit baseline'
            : hasViolationContext
            ? 'Mutation is addressing a known violation'
            : 'No violation context — read-only or fix op',
    }

    // ── Factor 4: familiarity ────────────────────────────────────────────────
    // 0.0  → 5+ prior mutations recorded in provenance for this file
    // 0.1  → neutral (no projectRoot, or projectRoot provided but count 1-4)
    // 0.2  → no provenance history at all (new file, db missing, 0 mutations)
    let familiarityRaw: number
    if (!projectRoot) {
        familiarityRaw = 0.1
    } else if (!filePath) {
        familiarityRaw = 0.1
    } else {
        const count = queryProvenance(projectRoot, filePath)
        if (count < 0) {
            // DB missing or query failed — neutral
            familiarityRaw = 0.1
        } else if (count >= 5) {
            familiarityRaw = 0.0
        } else if (count === 0) {
            familiarityRaw = 0.2
        } else {
            familiarityRaw = 0.1
        }
    }
    const familiarityContribution = mrsClamped(familiarityRaw * MRS_WEIGHTS.familiarity)

    const familiarityFactor: MRSFactor = {
        name: 'familiarity',
        weight: MRS_WEIGHTS.familiarity,
        contribution: familiarityContribution,
        rationale: !projectRoot
            ? 'No project root provided — using neutral familiarity (0.1)'
            : familiarityRaw === 0.0
            ? 'File has 5+ prior mutations — well-known'
            : familiarityRaw === 0.2
            ? 'No prior mutation history for this file — elevated uncertainty'
            : 'File has limited prior mutation history',
    }

    // ── Aggregate ────────────────────────────────────────────────────────────
    const rawScore =
        opWeightContribution +
        blastRadiusContribution +
        severityContribution +
        familiarityContribution

    const score = mrsClamped(rawScore)
    const tier = getTier(score)
    const recommendation = getRecommendation(tier, opType)

    return {
        score,
        tier,
        factors: [opFactor, blastFactor, severityFactor, familiarityFactor],
        recommendation,
    }
}

// Re-export types so callers can import everything from this module
export type { MRSTier, MRSFactor, MutationRiskScore, RiskScoringInput }
