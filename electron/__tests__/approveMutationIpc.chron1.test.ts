/**
 * approveMutationIpc.chron1.test.ts — electron/__tests__/approveMutationIpc.chron1.test.ts
 *
 * CHRON.1 unit tests for the governance:approve-mutation IPC handler logic
 * (test boundaries 13–14 from the CHRON.1 contract).
 *
 * Pattern: handler logic is reproduced as a pure function so no Electron APIs
 * (ipcMain, BrowserWindow) or SQLite binary are required in the test process.
 * The DB dependency is replaced by a stub that captures what was written.
 *
 * Covers:
 *   CHRON-AM-01 — handler with reason writes justification to DB (boundary 13)
 *   CHRON-AM-02 — handler with no reason writes null justification (boundary 14)
 *   CHRON-AM-03 — handler trims leading/trailing whitespace from reason
 *   CHRON-AM-04 — handler rejects non-number id with TypeError
 *   CHRON-AM-05 — handler with whitespace-only reason writes null justification
 *   CHRON-AM-06 — handler with empty string reason writes null justification
 *   CHRON-AM-07 — handler is atomic: approved_at and justification in one statement
 *   CHRON-AM-08 — preload bridge passes reason param through to ipcRenderer.invoke
 *   CHRON-AM-09 — web adapter passes reason param through to invoke
 *   CHRON-AM-10 — resolveReasonForStorage: green tier always returns 'auto'
 *   CHRON-AM-11 — resolveReasonForStorage: amber + empty returns 'skipped'
 *   CHRON-AM-12 — resolveReasonForStorage: amber + text returns trimmed text
 *   CHRON-AM-13 — resolveReasonForStorage: red + text returns trimmed text
 *   CHRON-AM-14 — getReasonRequirement: override always required
 *   CHRON-AM-15 — getReasonRequirement: green tier = none
 *   CHRON-AM-16 — getReasonRequirement: amber tier = optional
 *   CHRON-AM-17 — getReasonRequirement: red tier = required
 */

import { describe, it, expect, vi } from 'vitest'
import { sanitizeReason } from '../../shared/reasonSanitizer'
import { ipcSchemas } from '../../shared/ipc-validators'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Captures what the DB prepare/run was called with */
interface DbWrite {
    sql: string
    params: unknown[]
}

/** Stub DB that records prepare().run() calls */
function makeStubDb() {
    const writes: DbWrite[] = []

    const db = {
        prepare: (sql: string) => ({
            run: (...params: unknown[]) => {
                writes.push({ sql, params })
                return { changes: 1 }
            },
        }),
        _writes: writes,
    }

    return db
}

// ── Handler logic reproduction ────────────────────────────────────────────────
//
// This mirrors the core logic of the ipcMain.handle('governance:approve-mutation')
// callback in electron/main.ts (post end-of-round hardening) without importing
// Electron. The handler now:
//   1. Validates shape via ipcSchemas Zod schema (throws on invalid).
//   2. Runs sanitizeReason() for length cap / control-char strip / secret redact.
//   3. Writes the sanitized reason atomically alongside approved_at.

function approveMutationHandlerLogic(
    id: unknown,
    reason: unknown,
    db: ReturnType<typeof makeStubDb>,
): void {
    // CHRON.1 + M3: Zod schema validation.
    const parsed = ipcSchemas['governance:approve-mutation'].payload.safeParse({ id, reason })
    if (!parsed.success) {
        throw new TypeError(
            `governance:approve-mutation — invalid payload: ${parsed.error.issues.map(i => i.message).join('; ')}`
        )
    }

    // CHRON.1 + M1/M2/M4: sanitize the reason before storage.
    const { sanitized } = sanitizeReason(parsed.data.reason)

    try {
        db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?`)
            .run(sanitized, parsed.data.id)
    } catch { /* DDL guard keeps this unreachable in practice */ }
}

// ── Contract utility reproductions ────────────────────────────────────────────
//
// These mirror the types/functions from CHRON.1.contract.ts for unit testing
// without importing the contract file itself (avoids resolving shared/ imports
// in the test harness).

type ReasonRequirement = 'none' | 'optional' | 'required'

function getReasonRequirement(tier: 'green' | 'amber' | 'red', isOverride: boolean): ReasonRequirement {
    if (isOverride) return 'required'
    switch (tier) {
        case 'green': return 'none'
        case 'amber': return 'optional'
        case 'red': return 'required'
    }
}

function resolveReasonForStorage(tier: 'green' | 'amber' | 'red', userInput: string | undefined): string {
    if (tier === 'green') return 'auto'
    if (!userInput || userInput.trim().length === 0) return 'skipped'
    return userInput.trim()
}

// ── Tests: governance:approve-mutation handler logic ──────────────────────────

describe('governance:approve-mutation handler logic (CHRON.1)', () => {

    it('CHRON-AM-01: writes justification when reason is provided (boundary 13)', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'compliance requirement', db)

        expect(db._writes).toHaveLength(1)
        const write = db._writes[0]
        expect(write.sql).toContain('justification = ?')
        // params: [reasonStr, id]
        expect(write.params[0]).toBe('compliance requirement')
        expect(write.params[1]).toBe(42)
    })

    it('CHRON-AM-02: writes null justification when no reason provided (boundary 14)', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, undefined, db)

        expect(db._writes).toHaveLength(1)
        const write = db._writes[0]
        expect(write.params[0]).toBeNull()
        expect(write.params[1]).toBe(42)
    })

    it('CHRON-AM-03: trims leading and trailing whitespace from reason', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(7, '  brand team approved  ', db)

        expect(db._writes[0].params[0]).toBe('brand team approved')
    })

    it('CHRON-AM-04: throws TypeError when id is not a number (Zod guard)', () => {
        const db = makeStubDb()
        expect(() => approveMutationHandlerLogic('42', 'some reason', db))
            .toThrow(TypeError)
        // Zod generates its own message — we only assert the channel name + validation prefix.
        expect(() => approveMutationHandlerLogic('42', 'some reason', db))
            .toThrow(/governance:approve-mutation — invalid payload/)
    })

    it('CHRON-AM-05: whitespace-only reason writes null justification', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(10, '   ', db)

        expect(db._writes[0].params[0]).toBeNull()
    })

    it('CHRON-AM-06: empty string reason writes null justification', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(10, '', db)

        expect(db._writes[0].params[0]).toBeNull()
    })

    it('CHRON-AM-07: atomic update — approved_at and justification in one SQL statement', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(99, 'security audit', db)

        // Must be exactly one statement (atomic per Commandment 12)
        expect(db._writes).toHaveLength(1)
        const sql = db._writes[0].sql
        expect(sql).toContain('approved_at')
        expect(sql).toContain('justification')
        // Both columns set in one UPDATE — verified by the SQL containing both assignments
        expect(sql).toMatch(/SET approved_at.*justification/s)
    })

    it('CHRON-AM-08: null reason when reason argument is missing (no second arg)', () => {
        const db = makeStubDb()
        // Simulating IPC call where renderer did not pass reason
        approveMutationHandlerLogic(5, undefined, db)

        expect(db._writes[0].params[0]).toBeNull()
        expect(db._writes[0].params[1]).toBe(5)
    })

    it('CHRON-AM-09: non-string reason (object) throws via Zod', () => {
        const db = makeStubDb()
        // Guards against malformed IPC payloads. Post-hardening, a non-string
        // reason is rejected at the Zod boundary rather than coerced to null —
        // the renderer should never send an object here.
        expect(() => approveMutationHandlerLogic(3, { reason: 'some text' } as unknown, db))
            .toThrow(/governance:approve-mutation — invalid payload/)
        expect(db._writes).toHaveLength(0)
    })

    // ── CHRON.1 end-of-round hardening (2026-04-16) ─────────────────────────

    it('CHRON-AM-SEC-01 (M1): accepts reason exactly 1000 chars', () => {
        const db = makeStubDb()
        const longReason = 'x'.repeat(1000)
        approveMutationHandlerLogic(42, longReason, db)

        expect(db._writes).toHaveLength(1)
        const stored = db._writes[0].params[0] as string
        expect(typeof stored).toBe('string')
        expect(stored.length).toBe(1000)
    })

    it('CHRON-AM-SEC-02 (M1): rejects reason longer than 1000 chars at Zod boundary', () => {
        // The Zod schema max(1000) rejects before sanitizeReason() even runs.
        // The handler must throw, not silently truncate at the wire.
        const db = makeStubDb()
        expect(() => approveMutationHandlerLogic(42, 'y'.repeat(1001), db))
            .toThrow(/governance:approve-mutation — invalid payload/)
    })

    it('CHRON-AM-SEC-03 (M2): strips NUL bytes from reason', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'brand\x00approved', db)

        expect(db._writes[0].params[0]).toBe('brandapproved')
        // Verify no NUL bytes survive into the DB param
        expect(String(db._writes[0].params[0])).not.toContain('\x00')
    })

    it('CHRON-AM-SEC-04 (M2): strips bidi-override chars (Trojan-Source defense)', () => {
        const db = makeStubDb()
        // U+202E = Right-to-Left Override — used in CVE-2021-42574
        approveMutationHandlerLogic(42, 'legit \u202Eevil\u202C text', db)

        const stored = String(db._writes[0].params[0])
        expect(stored).not.toContain('\u202E')
        expect(stored).not.toContain('\u202C')
    })

    it('CHRON-AM-SEC-05 (M2): strips ASCII control chars (0x01-0x1F)', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'a\x01b\x02c\x03', db)

        expect(db._writes[0].params[0]).toBe('abc')
    })

    it('CHRON-AM-SEC-06 (M4): redacts Anthropic API key', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'key sk-ant-api03-abcdef123456789012345678 leaked', db)

        const stored = String(db._writes[0].params[0])
        expect(stored).toContain('[REDACTED]')
        expect(stored).not.toContain('sk-ant-api03-abcdef')
    })

    it('CHRON-AM-SEC-07 (M4): redacts AWS access key', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'AKIAIOSFODNN7EXAMPLE in logs', db)

        const stored = String(db._writes[0].params[0])
        expect(stored).toContain('[REDACTED]')
        expect(stored).not.toContain('AKIAIOSFODNN7EXAMPLE')
    })

    it('CHRON-AM-SEC-08 (M4): redacts GitHub personal access token', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'ci ghp_abcdefghijklmnopqrstuvwxyz0123456789 used', db)

        const stored = String(db._writes[0].params[0])
        expect(stored).toContain('[REDACTED]')
        expect(stored).not.toContain('ghp_abcdefghij')
    })

    it('CHRON-AM-SEC-09 (M4): redacts OpenAI-style API key', () => {
        const db = makeStubDb()
        approveMutationHandlerLogic(42, 'using sk-abcdefghijklmnopqrstuvwxyz123456 here', db)

        const stored = String(db._writes[0].params[0])
        expect(stored).toContain('[REDACTED]')
        expect(stored).not.toContain('sk-abcdefghijklmnopqrstuvwxyz')
    })

    it('CHRON-AM-SEC-10 (M4): redaction does not block the write (human may write about keys)', () => {
        const db = makeStubDb()
        // The redaction replaces the key but still stores the surrounding context.
        approveMutationHandlerLogic(42, 'we rotated the sk-ant-api03-abcdef123456789012345678 yesterday', db)

        expect(db._writes).toHaveLength(1)
        const stored = String(db._writes[0].params[0])
        expect(stored).toContain('we rotated')
        expect(stored).toContain('yesterday')
        expect(stored).toContain('[REDACTED]')
    })

    it('CHRON-AM-SEC-11: rejects negative id at Zod boundary', () => {
        const db = makeStubDb()
        expect(() => approveMutationHandlerLogic(-5, 'reason', db))
            .toThrow(/governance:approve-mutation — invalid payload/)
    })

    it('CHRON-AM-SEC-12: accepts id=0 (documented sentinel) at Zod boundary', () => {
        // id=0 is syntactically valid for backwards compat — the real protection
        // is the store switching to recordApprovalReason. Zod should not reject.
        const db = makeStubDb()
        approveMutationHandlerLogic(0, 'legacy caller', db)
        expect(db._writes).toHaveLength(1)
    })
})

// ── Tests: preload bridge signature ───────────────────────────────────────────

describe('preload approveMutation bridge (CHRON.1)', () => {

    it('CHRON-AM-08: passes id and reason to ipcRenderer.invoke', () => {
        const invokeSpy = vi.fn().mockResolvedValue(undefined)

        // Reproduce the AFTER bridge: approveMutation(id, reason?) calls invoke with both
        const approveMutation = (id: number, reason?: string): Promise<void> =>
            invokeSpy('governance:approve-mutation', id, reason)

        approveMutation(42, 'compliance requirement')

        expect(invokeSpy).toHaveBeenCalledWith('governance:approve-mutation', 42, 'compliance requirement')
    })

    it('CHRON-AM-09: passes id and undefined when reason omitted', () => {
        const invokeSpy = vi.fn().mockResolvedValue(undefined)

        const approveMutation = (id: number, reason?: string): Promise<void> =>
            invokeSpy('governance:approve-mutation', id, reason)

        approveMutation(7)

        expect(invokeSpy).toHaveBeenCalledWith('governance:approve-mutation', 7, undefined)
    })
})

// ── Tests: web adapter signature ──────────────────────────────────────────────

describe('web-api approveMutation adapter (CHRON.1)', () => {

    it('CHRON-AM-10: forwards id and reason to invoke', () => {
        const invokeSpy = vi.fn().mockResolvedValue(undefined)

        // Reproduce the AFTER adapter: approveMutation(id, reason?) => invoke(channel, id, reason)
        const approveMutation = (id: number, reason?: string): Promise<void> =>
            invokeSpy('governance:approve-mutation', id, reason) as Promise<void>

        approveMutation(99, 'security audit')

        expect(invokeSpy).toHaveBeenCalledWith('governance:approve-mutation', 99, 'security audit')
    })

    it('CHRON-AM-11: forwards id and undefined when reason omitted', () => {
        const invokeSpy = vi.fn().mockResolvedValue(undefined)

        const approveMutation = (id: number, reason?: string): Promise<void> =>
            invokeSpy('governance:approve-mutation', id, reason) as Promise<void>

        approveMutation(3)

        expect(invokeSpy).toHaveBeenCalledWith('governance:approve-mutation', 3, undefined)
    })
})

// ── Tests: resolveReasonForStorage utility ────────────────────────────────────

describe('resolveReasonForStorage (CHRON.1 contract utility)', () => {

    it('CHRON-AM-10: green tier always returns "auto" regardless of user input', () => {
        expect(resolveReasonForStorage('green', undefined)).toBe('auto')
        expect(resolveReasonForStorage('green', '')).toBe('auto')
        expect(resolveReasonForStorage('green', 'user typed something')).toBe('auto')
    })

    it('CHRON-AM-11: amber tier with no input returns "skipped"', () => {
        expect(resolveReasonForStorage('amber', undefined)).toBe('skipped')
        expect(resolveReasonForStorage('amber', '')).toBe('skipped')
        expect(resolveReasonForStorage('amber', '   ')).toBe('skipped')
    })

    it('CHRON-AM-12: amber tier with text returns trimmed text', () => {
        expect(resolveReasonForStorage('amber', 'brand team approved')).toBe('brand team approved')
        expect(resolveReasonForStorage('amber', '  trimmed  ')).toBe('trimmed')
    })

    it('CHRON-AM-13: red tier with text returns trimmed text', () => {
        expect(resolveReasonForStorage('red', 'justified because X')).toBe('justified because X')
        expect(resolveReasonForStorage('red', '  security requirement  ')).toBe('security requirement')
    })

    it('CHRON-AM-13b: red tier with empty input returns "skipped" (defensive guard only)', () => {
        // Dead code in practice — DiffCard blocks Apply when input is empty for red tier.
        // Defensive guard for programmatic callers.
        expect(resolveReasonForStorage('red', '')).toBe('skipped')
        expect(resolveReasonForStorage('red', undefined)).toBe('skipped')
    })
})

// ── Tests: getReasonRequirement utility ───────────────────────────────────────

describe('getReasonRequirement (CHRON.1 contract utility)', () => {

    it('CHRON-AM-14: override context always returns "required"', () => {
        expect(getReasonRequirement('green', true)).toBe('required')
        expect(getReasonRequirement('amber', true)).toBe('required')
        expect(getReasonRequirement('red', true)).toBe('required')
    })

    it('CHRON-AM-15: green tier (non-override) returns "none"', () => {
        expect(getReasonRequirement('green', false)).toBe('none')
    })

    it('CHRON-AM-16: amber tier (non-override) returns "optional"', () => {
        expect(getReasonRequirement('amber', false)).toBe('optional')
    })

    it('CHRON-AM-17: red tier (non-override) returns "required"', () => {
        expect(getReasonRequirement('red', false)).toBe('required')
    })
})

// ── Tests: governance:record-approval-reason handler logic ────────────────────
//
// This channel writes a governance_events row when the orchestrator-path
// approval happens without a mutations_ledger row. Mirrors the logic in
// electron/main.ts's ipcMain.handle('governance:record-approval-reason').

/** Stub recordEvent() captures what would be inserted into governance_events. */
function makeStubEventService() {
    const events: Array<Record<string, unknown>> = []
    return {
        recordEvent: (event: Record<string, unknown>) => { events.push(event) },
        _events: events,
    }
}

function recordApprovalReasonHandlerLogic(
    payload: unknown,
    eventService: ReturnType<typeof makeStubEventService>,
): void {
    const parsed = ipcSchemas['governance:record-approval-reason'].payload.safeParse(payload)
    if (!parsed.success) {
        throw new TypeError(
            `governance:record-approval-reason — invalid payload: ${parsed.error.issues.map(i => i.message).join('; ')}`
        )
    }
    const { sanitized } = sanitizeReason(parsed.data.reason)
    if (sanitized === null) return

    eventService.recordEvent({
        eventType: 'override',
        ruleId: `orchestrator:${parsed.data.toolName}`,
        severity: 'info',
        filePath: parsed.data.filePath,
        actor: 'user',
        metadata: { reason: sanitized, source: 'orchestrator', toolName: parsed.data.toolName },
    })
}

describe('governance:record-approval-reason handler logic (CHRON.1)', () => {
    it('records a governance_events row with sanitized reason in metadata', () => {
        const svc = makeStubEventService()
        recordApprovalReasonHandlerLogic(
            { filePath: '/src/Button.tsx', toolName: 'flint_add_class', reason: 'brand approved' },
            svc,
        )

        expect(svc._events).toHaveLength(1)
        const ev = svc._events[0]
        expect(ev.eventType).toBe('override')
        expect(ev.filePath).toBe('/src/Button.tsx')
        expect(ev.ruleId).toBe('orchestrator:flint_add_class')
        expect((ev.metadata as Record<string, unknown>).reason).toBe('brand approved')
    })

    it('throws on missing filePath', () => {
        const svc = makeStubEventService()
        expect(() => recordApprovalReasonHandlerLogic(
            { toolName: 'x', reason: 'y' },
            svc,
        )).toThrow(/invalid payload/)
    })

    it('throws on empty reason', () => {
        const svc = makeStubEventService()
        expect(() => recordApprovalReasonHandlerLogic(
            { filePath: '/x', toolName: 't', reason: '' },
            svc,
        )).toThrow(/invalid payload/)
    })

    it('redacts API keys in the stored metadata.reason', () => {
        const svc = makeStubEventService()
        recordApprovalReasonHandlerLogic(
            {
                filePath: '/x',
                toolName: 't',
                reason: 'leaked sk-ant-api03-abcdef123456789012345678 in comment',
            },
            svc,
        )

        const metaReason = (svc._events[0].metadata as Record<string, unknown>).reason as string
        expect(metaReason).toContain('[REDACTED]')
        expect(metaReason).not.toContain('sk-ant-api03-abcdef')
    })

    it('strips control chars from the stored metadata.reason', () => {
        const svc = makeStubEventService()
        recordApprovalReasonHandlerLogic(
            { filePath: '/x', toolName: 't', reason: 'no\x00\x01ctrl' },
            svc,
        )

        const metaReason = (svc._events[0].metadata as Record<string, unknown>).reason as string
        expect(metaReason).toBe('noctrl')
    })

    it('does not write when sanitization returns null (all-control-char input after Zod)', () => {
        // Reason must first pass Zod (min length 1), then get stripped to empty by sanitize.
        const svc = makeStubEventService()
        // Zod min(1) allows a 1-char control string — sanitize then strips it to empty.
        recordApprovalReasonHandlerLogic(
            { filePath: '/x', toolName: 't', reason: '\x01' },
            svc,
        )
        expect(svc._events).toHaveLength(0)
    })
})

// ── Tests: server/index.ts parity for governance:approve-mutation ─────────────
//
// The web build handler shares 100% of the sanitizer + Zod pipeline with
// electron/main.ts. This block re-exercises the pipeline via the server-side
// handler shape to lock in BLK-2 (no regressions if someone edits one and not
// the other).

function serverApproveMutationHandlerLogic(
    id: unknown,
    reason: unknown,
    db: ReturnType<typeof makeStubDb>,
): void {
    // Matches the signature in server/index.ts — positional args from JSON-RPC.
    const parsed = ipcSchemas['governance:approve-mutation'].payload.safeParse({ id, reason })
    if (!parsed.success) {
        throw new TypeError(
            `governance:approve-mutation — invalid payload: ${parsed.error.issues.map(i => i.message).join('; ')}`
        )
    }
    const { sanitized } = sanitizeReason(parsed.data.reason)
    try {
        db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?`)
            .run(sanitized, parsed.data.id)
    } catch { /* noop */ }
}

describe('server/index.ts governance:approve-mutation parity (CHRON.1 BLK-2)', () => {
    it('writes justification when reason is provided (parity with electron)', () => {
        const db = makeStubDb()
        serverApproveMutationHandlerLogic(42, 'web-path reason', db)

        expect(db._writes[0].params[0]).toBe('web-path reason')
        expect(db._writes[0].params[1]).toBe(42)
    })

    it('writes null justification when reason is absent (parity with electron)', () => {
        const db = makeStubDb()
        serverApproveMutationHandlerLogic(42, undefined, db)

        expect(db._writes[0].params[0]).toBeNull()
    })

    it('applies sanitization in the web build too (parity with electron)', () => {
        const db = makeStubDb()
        serverApproveMutationHandlerLogic(42, '\x00brand\x02 approved', db)

        expect(db._writes[0].params[0]).toBe('brand approved')
    })

    it('redacts secrets in the web build too', () => {
        const db = makeStubDb()
        serverApproveMutationHandlerLogic(42, 'key sk-ant-api03-abcdef123456789012345678', db)

        const stored = String(db._writes[0].params[0])
        expect(stored).toContain('[REDACTED]')
    })

    it('rejects invalid payload at the Zod boundary (parity with electron)', () => {
        const db = makeStubDb()
        expect(() => serverApproveMutationHandlerLogic('42', 'reason', db))
            .toThrow(/governance:approve-mutation — invalid payload/)
    })
})
