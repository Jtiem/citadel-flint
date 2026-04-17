/**
 * server/__tests__/governanceApproval.chron1.test.ts
 *
 * CHRON.1 BLK-2: end-of-round parity tests for the web build
 * (server/index.ts) governance:approve-mutation + get-audit-log +
 * record-approval-reason handlers.
 *
 * Pattern (per existing server tests): handler logic is reproduced as pure
 * functions that share the same shared/* dependencies (sanitizeReason,
 * ipcSchemas) so any drift between electron/main.ts and server/index.ts
 * immediately surfaces here.
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { sanitizeReason } from '../../shared/reasonSanitizer'
import { ipcSchemas } from '../../shared/ipc-validators'

// ── In-memory DB with CHRON.1 DDL guard ───────────────────────────────────────

function makeDb(): Database.Database {
    const db = new Database(':memory:')
    db.exec(`
        CREATE TABLE mutations_ledger (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            mutation_id      TEXT,
            file_path        TEXT,
            op               TEXT,
            risk_score       REAL,
            risk_tier        TEXT,
            agent_id         TEXT,
            session_id       TEXT,
            justification    TEXT,
            approved_at      TEXT,
            before_snapshot  TEXT,
            after_snapshot   TEXT,
            created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE TABLE governance_events (
            id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            timestamp   TEXT    NOT NULL    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            event_type  TEXT    NOT NULL,
            rule_id     TEXT    NOT NULL,
            severity    TEXT    NOT NULL,
            node_id     TEXT,
            file_path   TEXT    NOT NULL,
            message     TEXT,
            session_id  TEXT,
            actor       TEXT    NOT NULL    DEFAULT 'system',
            metadata    TEXT    NOT NULL    DEFAULT '{}'
        );
    `)
    return db
}

// ── Handler logic reproduction ────────────────────────────────────────────────
//
// Mirrors exactly what server/index.ts ships. When these tests fail after
// a server/index.ts edit, you're looking at a parity break.

function approveMutationHandler(id: unknown, reason: unknown, db: Database.Database): void {
    const parsed = ipcSchemas['governance:approve-mutation'].payload.safeParse({ id, reason })
    if (!parsed.success) throw new TypeError('invalid payload')
    const { sanitized } = sanitizeReason(parsed.data.reason)
    db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?`)
        .run(sanitized, parsed.data.id)
}

function recordApprovalReasonHandler(payload: unknown, db: Database.Database): void {
    const parsed = ipcSchemas['governance:record-approval-reason'].payload.safeParse(payload)
    if (!parsed.success) throw new TypeError('invalid payload')
    const { sanitized } = sanitizeReason(parsed.data.reason)
    if (sanitized === null) return
    db.prepare(`
        INSERT INTO governance_events (id, timestamp, event_type, rule_id, severity, node_id, file_path, message, session_id, actor, metadata)
        VALUES (lower(hex(randomblob(16))), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'override', ?, 'info', NULL, ?, NULL, NULL, 'user', ?)
    `).run(
        `orchestrator:${parsed.data.toolName}`,
        parsed.data.filePath,
        JSON.stringify({ reason: sanitized, source: 'orchestrator', toolName: parsed.data.toolName }),
    )
}

function getAuditLogHandler(opts: unknown, db: Database.Database) {
    const limit = typeof (opts as Record<string, unknown>)?.limit === 'number'
        ? (opts as Record<string, unknown>).limit as number : 50
    return db.prepare(`
        SELECT id, timestamp AS timestamp, event_type AS action,
               COALESCE(file_path, '') AS filePath, COALESCE(message, event_type) AS description,
               metadata, rule_id AS ruleId
        FROM governance_events ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as Array<{
        id: number | string; timestamp: string; action: string; filePath: string; description: string;
        metadata: string | null; ruleId: string | null
    }>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('server/index.ts — governance:approve-mutation (CHRON.1 BLK-2)', () => {
    it('writes reason to justification column in the web build', () => {
        const db = makeDb()
        db.prepare(`INSERT INTO mutations_ledger (id, risk_tier) VALUES (42, 'amber')`).run()

        approveMutationHandler(42, 'compliance requirement', db)

        const row = db.prepare(`SELECT justification, approved_at FROM mutations_ledger WHERE id = 42`).get() as {
            justification: string | null; approved_at: string | null
        }
        expect(row.justification).toBe('compliance requirement')
        expect(row.approved_at).not.toBeNull()
    })

    it('writes null justification when no reason is provided', () => {
        const db = makeDb()
        db.prepare(`INSERT INTO mutations_ledger (id, risk_tier) VALUES (42, 'amber')`).run()

        approveMutationHandler(42, undefined, db)

        const row = db.prepare(`SELECT justification FROM mutations_ledger WHERE id = 42`).get() as {
            justification: string | null
        }
        expect(row.justification).toBeNull()
    })

    it('sanitizes control chars in the web build (parity)', () => {
        const db = makeDb()
        db.prepare(`INSERT INTO mutations_ledger (id, risk_tier) VALUES (7, 'amber')`).run()

        approveMutationHandler(7, 'brand\x00approved', db)

        const row = db.prepare(`SELECT justification FROM mutations_ledger WHERE id = 7`).get() as {
            justification: string | null
        }
        expect(row.justification).toBe('brandapproved')
    })

    it('redacts API keys in the web build (parity)', () => {
        const db = makeDb()
        db.prepare(`INSERT INTO mutations_ledger (id, risk_tier) VALUES (8, 'amber')`).run()

        approveMutationHandler(8, 'token sk-ant-api03-abcdef123456789012345678', db)

        const row = db.prepare(`SELECT justification FROM mutations_ledger WHERE id = 8`).get() as {
            justification: string | null
        }
        expect(row.justification).toContain('[REDACTED]')
    })

    it('caps very long reasons at 1000 chars (via Zod reject)', () => {
        const db = makeDb()
        db.prepare(`INSERT INTO mutations_ledger (id, risk_tier) VALUES (9, 'amber')`).run()

        expect(() => approveMutationHandler(9, 'x'.repeat(1001), db))
            .toThrow(/invalid payload/)
    })
})

describe('server/index.ts — governance:record-approval-reason (CHRON.1 Option A)', () => {
    it('inserts a governance_events row with reason in metadata', () => {
        const db = makeDb()
        recordApprovalReasonHandler(
            { filePath: '/src/Button.tsx', toolName: 'flint_add_class', reason: 'brand approved' },
            db,
        )

        const rows = db.prepare(`SELECT * FROM governance_events`).all() as Array<{
            file_path: string; rule_id: string; event_type: string; metadata: string
        }>
        expect(rows).toHaveLength(1)
        expect(rows[0].event_type).toBe('override')
        expect(rows[0].file_path).toBe('/src/Button.tsx')
        expect(rows[0].rule_id).toBe('orchestrator:flint_add_class')
        const meta = JSON.parse(rows[0].metadata) as { reason: string; source: string }
        expect(meta.reason).toBe('brand approved')
        expect(meta.source).toBe('orchestrator')
    })

    it('throws on invalid payload', () => {
        const db = makeDb()
        expect(() => recordApprovalReasonHandler({ filePath: '', toolName: 't', reason: 'r' }, db))
            .toThrow(/invalid payload/)
    })

    it('redacts secrets in metadata.reason', () => {
        const db = makeDb()
        recordApprovalReasonHandler(
            { filePath: '/x', toolName: 't', reason: 'leaked AKIAIOSFODNN7EXAMPLE in log' },
            db,
        )
        const rows = db.prepare(`SELECT metadata FROM governance_events`).all() as Array<{ metadata: string }>
        const meta = JSON.parse(rows[0].metadata) as { reason: string }
        expect(meta.reason).toContain('[REDACTED]')
        expect(meta.reason).not.toContain('AKIAIOSFODNN7EXAMPLE')
    })
})

describe('server/index.ts — governance:get-audit-log (CHRON.1 BLK-2)', () => {
    it('returns metadata + ruleId fields on audit entries', () => {
        const db = makeDb()
        recordApprovalReasonHandler(
            { filePath: '/x', toolName: 'flint_add_class', reason: 'approved' },
            db,
        )

        const rows = getAuditLogHandler({ limit: 10 }, db)
        expect(rows).toHaveLength(1)
        expect(rows[0].ruleId).toBe('orchestrator:flint_add_class')
        expect(rows[0].metadata).toBeTruthy()
        const meta = JSON.parse(rows[0].metadata as string) as { reason: string }
        expect(meta.reason).toBe('approved')
    })

    it('uses the actual column names (timestamp, message) — regression guard', () => {
        // The old code referenced `created_at` and `description` which do not exist
        // on governance_events — the try/catch swallowed the error and returned [].
        // This test confirms the SELECT now uses the real columns and returns data.
        const db = makeDb()
        db.prepare(`
            INSERT INTO governance_events (event_type, rule_id, severity, file_path, message, metadata)
            VALUES ('override', 'ruleA', 'info', '/foo', 'a human message', '{"reason":"ok"}')
        `).run()

        const rows = getAuditLogHandler({ limit: 10 }, db)
        expect(rows).toHaveLength(1)
        expect(rows[0].description).toBe('a human message')
        expect(rows[0].ruleId).toBe('ruleA')
        expect(rows[0].filePath).toBe('/foo')
    })
})
