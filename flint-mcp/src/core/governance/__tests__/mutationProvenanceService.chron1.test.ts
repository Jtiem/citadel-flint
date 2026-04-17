/**
 * mutationProvenanceService.chron1.test.ts — CHRON.1 Reason-on-Override
 *
 * Test boundaries 9–12 from the CHRON.1 contract:
 *   TB-9:  recordProvenance stores reason in provenance_reasoning column
 *   TB-10: recordProvenance with reason='skipped' stores 'skipped'
 *   TB-11: recordProvenance with reason=undefined/null stores null
 *   TB-12: getAuditTrail includes provenanceReasoning in result rows
 *
 * Uses an in-memory SQLite database so tests are hermetic and leave
 * no artifacts on disk.
 *
 * Contract: .flint-context/contracts/CHRON.1.contract.ts
 * Implementation: flint-mcp/src/core/governance/mutationProvenanceService.ts
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { MutationProvenanceService } from '../mutationProvenanceService.js'
import type {
    AutoReason,
    ReasonRequirement,
} from '../../../../../../.flint-context/contracts/CHRON.1.contract.js'

// Type-level smoke check: contract types must compile.
type _CheckAutoReason = AutoReason
type _CheckRequirement = ReasonRequirement

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

/**
 * Create a MutationProvenanceService backed by an in-memory DB.
 * Also initialises the mutations_ledger table (needed by getAuditTrail's
 * INNER JOIN) with the minimal schema required by that query.
 */
function makeService(): { svc: MutationProvenanceService; db: Database.Database } {
    const db = makeDb()
    // Initialise mutations_ledger so getAuditTrail's INNER JOIN can succeed.
    db.exec(`
        CREATE TABLE IF NOT EXISTS mutations_ledger (
            id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            timestamp            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            file_path            TEXT NOT NULL,
            node_id              TEXT,
            operation_type       TEXT NOT NULL,
            source               TEXT NOT NULL,
            source_intent_hash   TEXT,
            registry_artifact_id TEXT,
            before_snapshot      TEXT,
            after_snapshot       TEXT,
            session_id           TEXT,
            approved_by          TEXT,
            justification        TEXT,
            metadata             TEXT DEFAULT '{}'
        );
    `)
    const svc = new MutationProvenanceService(db)
    return { svc, db }
}

/**
 * Insert a minimal row into mutations_ledger so that getAuditTrail's
 * INNER JOIN on mutation_id finds the row.
 */
function insertLedgerRow(db: Database.Database, id: string, filePath: string): void {
    db.prepare(`
        INSERT INTO mutations_ledger (id, file_path, operation_type, source, metadata)
        VALUES (?, ?, 'updateClassName', 'mcp_tool', '{}')
    `).run(id, filePath)
}

// ---------------------------------------------------------------------------
// TB-9: recordProvenance stores user reason in provenance_reasoning column
// ---------------------------------------------------------------------------

describe('CHRON.1 — MutationProvenanceService reason param (TB-9)', () => {
    it('recordProvenance: stores user reason in provenance_reasoning column', () => {
        const { svc } = makeService()
        const mutationId = 'mut-tb9-user-reason'

        svc.recordProvenance(mutationId, 'agent', null, null, 'brand approved')

        const result = svc.getProvenance(mutationId)
        expect(result).not.toBeNull()
        expect(result!.provenanceReasoning).toBe('brand approved')
    })

    // Edge case: 'skipped' is stored verbatim — SARIF filtering happens in buildSarifOutput
    it('recordProvenance: reason="skipped" is stored verbatim as "skipped"', () => {
        const { svc } = makeService()
        const mutationId = 'mut-tb9-skipped'

        svc.recordProvenance(mutationId, 'agent', null, null, 'skipped')

        const result = svc.getProvenance(mutationId)
        expect(result).not.toBeNull()
        expect(result!.provenanceReasoning).toBe('skipped')
    })

    // Edge case: undefined reason stores null
    it('recordProvenance: reason=undefined stores null in provenance_reasoning column', () => {
        const { svc } = makeService()
        const mutationId = 'mut-tb9-undefined-reason'

        // Call without the reasoning param — defaults to undefined -> null via `?? null`
        svc.recordProvenance(mutationId, 'human')

        const result = svc.getProvenance(mutationId)
        expect(result).not.toBeNull()
        expect(result!.provenanceReasoning).toBeNull()
    })

    it('recordProvenance: reason=null stores null in provenance_reasoning column', () => {
        const { svc } = makeService()
        const mutationId = 'mut-tb9-null-reason'

        svc.recordProvenance(mutationId, 'auto-fix', null, null, null)

        const result = svc.getProvenance(mutationId)
        expect(result).not.toBeNull()
        expect(result!.provenanceReasoning).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// TB-12: getAuditTrail includes provenanceReasoning in result rows
// ---------------------------------------------------------------------------

describe('CHRON.1 — MutationProvenanceService getAuditTrail (TB-12)', () => {
    it('getAuditTrail: returns provenanceReasoning on each trail entry', () => {
        const { svc, db } = makeService()
        const mutationId = 'mut-tb12-trail-reason'
        const filePath = '/src/components/Button.tsx'

        // Insert a ledger row so the INNER JOIN finds the record
        insertLedgerRow(db, mutationId, filePath)

        // Record provenance with a reason
        svc.recordProvenance(mutationId, 'agent', 'claude-orchestrator', 'session-001', 'compliance requirement')

        const trail = svc.getAuditTrail(filePath)

        expect(trail.length).toBeGreaterThanOrEqual(1)
        const entry = trail.find((e) => e.mutationId === mutationId)
        expect(entry).toBeDefined()
        expect(entry!.provenanceReasoning).toBe('compliance requirement')
    })

    it('getAuditTrail: provenanceReasoning is null when no reason was stored', () => {
        const { svc, db } = makeService()
        const mutationId = 'mut-tb12-no-reason'
        const filePath = '/src/components/Card.tsx'

        insertLedgerRow(db, mutationId, filePath)
        svc.recordProvenance(mutationId, 'human')

        const trail = svc.getAuditTrail(filePath)
        const entry = trail.find((e) => e.mutationId === mutationId)
        expect(entry).toBeDefined()
        expect(entry!.provenanceReasoning).toBeNull()
    })

    it('getAuditTrail: returns provenanceReasoning for multiple entries', () => {
        const { svc, db } = makeService()
        const filePath = '/src/components/Nav.tsx'

        const entries = [
            { id: 'mut-trail-a', reason: 'first change' },
            { id: 'mut-trail-b', reason: 'second change' },
            { id: 'mut-trail-c', reason: null },
        ]

        for (const e of entries) {
            insertLedgerRow(db, e.id, filePath)
            svc.recordProvenance(e.id, 'agent', null, null, e.reason)
        }

        const trail = svc.getAuditTrail(filePath)
        expect(trail.length).toBe(entries.length)

        const entryA = trail.find((t) => t.mutationId === 'mut-trail-a')
        const entryB = trail.find((t) => t.mutationId === 'mut-trail-b')
        const entryC = trail.find((t) => t.mutationId === 'mut-trail-c')

        expect(entryA!.provenanceReasoning).toBe('first change')
        expect(entryB!.provenanceReasoning).toBe('second change')
        expect(entryC!.provenanceReasoning).toBeNull()
    })
})
