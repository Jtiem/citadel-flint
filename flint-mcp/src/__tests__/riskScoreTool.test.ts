/**
 * flint_risk_score MCP tool handler tests — V.1-rs Wire-Up
 *
 * Validates the MCP tool registration by exercising the RiskScoringService
 * through the same code paths the server.ts handler uses:
 *   - score_mutation: happy path, missing mutationId, unknown mutationId
 *   - file_profile: happy path, missing filePath, no data
 *   - project_summary: happy path (empty + populated)
 *
 * Uses an in-memory SQLite database for hermetic, fast, disk-free tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { RiskScoringService } from '../core/governance/riskScoringService.js'
import { MutationLedgerService } from '../core/governance/mutationLedgerService.js'
import { MutationProvenanceService } from '../core/governance/mutationProvenanceService.js'
import type { MutationOperationType, ProvenanceSource } from '../core/governance/types.js'

// ---------------------------------------------------------------------------
// Helpers — mirrors the existing riskScoring.test.ts pattern
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

interface ToolServices {
    riskSvc: RiskScoringService
    ledger: MutationLedgerService
    provenance: MutationProvenanceService
    db: Database.Database
}

function makeServices(): ToolServices {
    const db = makeDb()
    return {
        riskSvc: new RiskScoringService(db),
        ledger: new MutationLedgerService(db),
        provenance: new MutationProvenanceService(db),
        db,
    }
}

/** Seed a mutation in the ledger + provenance so scoreMutation can find it. */
function seedMutation(
    svcs: ToolServices,
    opts: {
        mutationId: string
        filePath?: string
        operationType?: MutationOperationType
        provenanceSource?: ProvenanceSource
        agentId?: string | null
        timestamp?: string
    },
): void {
    const {
        mutationId,
        filePath = 'src/components/Button.tsx',
        operationType = 'updateClassName',
        provenanceSource = 'human',
        agentId = null,
        timestamp,
    } = opts

    svcs.ledger.recordMutation({
        id: mutationId,
        filePath,
        operationType,
        source: 'mcp_tool',
        metadata: {},
        ...(timestamp ? { timestamp } : {}),
    })

    svcs.provenance.recordProvenance(
        mutationId,
        provenanceSource,
        agentId,
        null,
        null,
        null,
        timestamp,
    )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('flint_risk_score tool — score_mutation action', () => {
    let svcs: ToolServices

    beforeEach(() => {
        svcs = makeServices()
    })

    it('returns a risk score for a valid mutationId', () => {
        seedMutation(svcs, { mutationId: 'mut-001' })
        const result = svcs.riskSvc.scoreMutation('mut-001')

        expect(result).not.toBeNull()
        expect(result!.mutationId).toBe('mut-001')
        expect(result!.score).toBeGreaterThanOrEqual(0)
        expect(result!.score).toBeLessThanOrEqual(100)
        expect(['low', 'medium', 'high', 'critical']).toContain(result!.tier)
        expect(result!.factors).toHaveLength(5)
    })

    it('returns null for unknown mutationId', () => {
        const result = svcs.riskSvc.scoreMutation('nonexistent')
        expect(result).toBeNull()
    })

    it('passes violationCount context through to scoring', () => {
        seedMutation(svcs, { mutationId: 'mut-002' })

        const noViolation = svcs.riskSvc.scoreMutation('mut-002')
        const withViolation = svcs.riskSvc.scoreMutation('mut-002', {
            violationCount: 5,
            hasCritical: true,
        })

        expect(noViolation).not.toBeNull()
        expect(withViolation).not.toBeNull()
        expect(withViolation!.score).toBeGreaterThanOrEqual(noViolation!.score)
    })

    it('passes wasAutoFixedFromCritical context', () => {
        seedMutation(svcs, { mutationId: 'mut-003' })

        const base = svcs.riskSvc.scoreMutation('mut-003')
        const autoFixed = svcs.riskSvc.scoreMutation('mut-003', {
            wasAutoFixedFromCritical: true,
        })

        expect(autoFixed).not.toBeNull()
        expect(autoFixed!.score).toBeGreaterThanOrEqual(base!.score)
    })

    it('persists score and retrieves via getScore', () => {
        seedMutation(svcs, { mutationId: 'mut-004' })
        svcs.riskSvc.scoreMutation('mut-004')

        const retrieved = svcs.riskSvc.getScore('mut-004')
        expect(retrieved).not.toBeNull()
        expect(retrieved!.mutationId).toBe('mut-004')
    })
})

describe('flint_risk_score tool — file_profile action', () => {
    let svcs: ToolServices

    beforeEach(() => {
        svcs = makeServices()
    })

    it('returns null for a file with no scored mutations', () => {
        const profile = svcs.riskSvc.getFileRiskProfile('src/components/Missing.tsx')
        expect(profile).toBeNull()
    })

    it('returns aggregated profile for a file with scored mutations', () => {
        const filePath = 'src/components/Card.tsx'

        seedMutation(svcs, { mutationId: 'fp-001', filePath })
        seedMutation(svcs, { mutationId: 'fp-002', filePath })
        svcs.riskSvc.scoreMutation('fp-001')
        svcs.riskSvc.scoreMutation('fp-002')

        const profile = svcs.riskSvc.getFileRiskProfile(filePath)
        expect(profile).not.toBeNull()
        expect(profile!.filePath).toBe(filePath)
        expect(profile!.mutationCount).toBe(2)
        expect(profile!.meanScore).toBeGreaterThanOrEqual(0)
        expect(profile!.maxScore).toBeGreaterThanOrEqual(profile!.meanScore)
        expect(['rising', 'falling', 'stable']).toContain(profile!.trend)
    })
})

// ---------------------------------------------------------------------------
// Handler-level validation tests (mirrors server.ts switch-case error paths)
// ---------------------------------------------------------------------------

/**
 * Simulates the handler logic from server.ts for flint_risk_score.
 * This is a direct extraction of the validation branches so we can
 * test them without spinning up the full MCP server.
 */
function simulateHandler(
    args: {
        action: string;
        projectRoot?: string;
        mutationId?: string;
        filePath?: string;
        violationCount?: number;
        hasCritical?: boolean;
        wasAutoFixedFromCritical?: boolean;
    },
    riskSvc: RiskScoringService | null,
): { isError?: boolean; text: string } {
    if (!args.projectRoot) {
        return { isError: true, text: "flint_risk_score: 'projectRoot' must be an existing directory." };
    }
    if (!riskSvc) {
        return { isError: true, text: "flint_risk_score: 'projectRoot' must be an existing directory." };
    }
    switch (args.action) {
        case 'score_mutation': {
            if (!args.mutationId) {
                return { isError: true, text: "flint_risk_score: action='score_mutation' requires 'mutationId'." };
            }
            const result = riskSvc.scoreMutation(args.mutationId, {
                violationCount: args.violationCount,
                hasCritical: args.hasCritical,
                wasAutoFixedFromCritical: args.wasAutoFixedFromCritical,
            });
            if (result === null) {
                return { isError: true, text: `flint_risk_score: no ledger entry found for mutationId '${args.mutationId}'.` };
            }
            return { text: JSON.stringify(result, null, 2) };
        }
        case 'file_profile': {
            if (!args.filePath) {
                return { isError: true, text: "flint_risk_score: action='file_profile' requires 'filePath'." };
            }
            const profile = riskSvc.getFileRiskProfile(args.filePath);
            if (profile === null) {
                return { text: JSON.stringify({ filePath: args.filePath, message: 'No risk scores recorded for this file.' }, null, 2) };
            }
            return { text: JSON.stringify(profile, null, 2) };
        }
        case 'project_summary': {
            const summary = riskSvc.getProjectRiskSummary();
            return { text: JSON.stringify(summary, null, 2) };
        }
        default:
            return { isError: true, text: `flint_risk_score: unknown action '${args.action}'. Must be 'score_mutation', 'file_profile', or 'project_summary'.` };
    }
}

describe('flint_risk_score handler — validation branches', () => {
    let svcs: ToolServices

    beforeEach(() => {
        svcs = makeServices()
    })

    it('rejects missing projectRoot', () => {
        const res = simulateHandler({ action: 'score_mutation' }, null)
        expect(res.isError).toBe(true)
        expect(res.text).toContain('projectRoot')
    })

    it('rejects score_mutation without mutationId', () => {
        const res = simulateHandler(
            { action: 'score_mutation', projectRoot: '/tmp' },
            svcs.riskSvc,
        )
        expect(res.isError).toBe(true)
        expect(res.text).toContain('mutationId')
    })

    it('rejects score_mutation with unknown mutationId', () => {
        const res = simulateHandler(
            { action: 'score_mutation', projectRoot: '/tmp', mutationId: 'ghost' },
            svcs.riskSvc,
        )
        expect(res.isError).toBe(true)
        expect(res.text).toContain("no ledger entry found for mutationId 'ghost'")
    })

    it('rejects file_profile without filePath', () => {
        const res = simulateHandler(
            { action: 'file_profile', projectRoot: '/tmp' },
            svcs.riskSvc,
        )
        expect(res.isError).toBe(true)
        expect(res.text).toContain('filePath')
    })

    it('returns graceful message for file_profile with no data', () => {
        const res = simulateHandler(
            { action: 'file_profile', projectRoot: '/tmp', filePath: 'src/Missing.tsx' },
            svcs.riskSvc,
        )
        expect(res.isError).toBeUndefined()
        expect(res.text).toContain('No risk scores recorded')
    })

    it('rejects unknown action', () => {
        const res = simulateHandler(
            { action: 'bogus_action', projectRoot: '/tmp' },
            svcs.riskSvc,
        )
        expect(res.isError).toBe(true)
        expect(res.text).toContain("unknown action 'bogus_action'")
    })
})

describe('flint_risk_score tool — project_summary action', () => {
    let svcs: ToolServices

    beforeEach(() => {
        svcs = makeServices()
    })

    it('returns zero counts on empty database', () => {
        const summary = svcs.riskSvc.getProjectRiskSummary()
        expect(summary.totalScored).toBe(0)
        expect(summary.distribution.low).toBe(0)
        expect(summary.distribution.medium).toBe(0)
        expect(summary.distribution.high).toBe(0)
        expect(summary.distribution.critical).toBe(0)
        expect(summary.riskiestFiles).toHaveLength(0)
        expect(summary.riskiestAgents).toHaveLength(0)
    })

    it('returns correct distribution after scoring mutations', () => {
        seedMutation(svcs, { mutationId: 'ps-001', provenanceSource: 'human' })
        seedMutation(svcs, { mutationId: 'ps-002', provenanceSource: 'agent', agentId: 'bot-1', operationType: 'deleteNode' })
        svcs.riskSvc.scoreMutation('ps-001')
        svcs.riskSvc.scoreMutation('ps-002')

        const summary = svcs.riskSvc.getProjectRiskSummary()
        expect(summary.totalScored).toBe(2)
        expect(summary.riskiestFiles.length).toBeGreaterThan(0)
    })
})
