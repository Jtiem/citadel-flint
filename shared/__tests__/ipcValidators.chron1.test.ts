/**
 * ipcValidators.chron1.test.ts
 *
 * Tests for the CHRON.1 Zod schemas in shared/ipc-validators.ts that validate
 * the two governance IPC channels used for reason logging.
 *
 *   - governance:approve-mutation     — existing handler, gains reason param
 *   - governance:record-approval-reason — new handler for orchestrator path
 */

import { describe, it, expect } from 'vitest'
import { ipcSchemas } from '../ipc-validators'

// The `ipcSchemas` object is typed via `satisfies Record<string, ...>` which
// preserves the literal keys at the TSC level but uses `noUncheckedIndexedAccess`
// on some consumer tsconfigs. We assert-cast to the looser map shape so tests
// can access entries by key name without TSC objecting to the narrow tuple.
const schemas = ipcSchemas as unknown as Record<string, { payload: { safeParse: (x: unknown) => { success: boolean } } }>

describe('ipcSchemas["governance:approve-mutation"].payload', () => {
    const schema = schemas['governance:approve-mutation'].payload

    it('accepts { id: number } with no reason', () => {
        const r = schema.safeParse({ id: 42 })
        expect(r.success).toBe(true)
    })

    it('accepts { id: number, reason: string }', () => {
        const r = schema.safeParse({ id: 42, reason: 'compliance' })
        expect(r.success).toBe(true)
    })

    it('accepts id=0 (sentinel)', () => {
        // Defensive: id=0 should be syntactically valid even if semantically deprecated.
        // The real protection is in the handler layer switching to recordApprovalReason.
        const r = schema.safeParse({ id: 0 })
        expect(r.success).toBe(true)
    })

    it('rejects negative id', () => {
        const r = schema.safeParse({ id: -1 })
        expect(r.success).toBe(false)
    })

    it('rejects string id', () => {
        const r = schema.safeParse({ id: '42' })
        expect(r.success).toBe(false)
    })

    it('rejects float id', () => {
        const r = schema.safeParse({ id: 42.5 })
        expect(r.success).toBe(false)
    })

    it('rejects reason longer than 1000 chars', () => {
        const r = schema.safeParse({ id: 42, reason: 'x'.repeat(1001) })
        expect(r.success).toBe(false)
    })

    it('accepts reason exactly 1000 chars', () => {
        const r = schema.safeParse({ id: 42, reason: 'x'.repeat(1000) })
        expect(r.success).toBe(true)
    })

    it('rejects non-string reason (number)', () => {
        const r = schema.safeParse({ id: 42, reason: 123 })
        expect(r.success).toBe(false)
    })

    it('rejects non-string reason (object)', () => {
        const r = schema.safeParse({ id: 42, reason: { text: 'hi' } })
        expect(r.success).toBe(false)
    })
})

describe('ipcSchemas["governance:record-approval-reason"].payload', () => {
    const schema = schemas['governance:record-approval-reason'].payload

    it('accepts the happy path', () => {
        const r = schema.safeParse({
            filePath: '/project/src/Button.tsx',
            toolName: 'flint_add_class',
            reason: 'brand team approved',
        })
        expect(r.success).toBe(true)
    })

    it('rejects empty filePath', () => {
        const r = schema.safeParse({ filePath: '', toolName: 'x', reason: 'r' })
        expect(r.success).toBe(false)
    })

    it('rejects empty toolName', () => {
        const r = schema.safeParse({ filePath: '/x', toolName: '', reason: 'r' })
        expect(r.success).toBe(false)
    })

    it('rejects empty reason (reason is required here)', () => {
        const r = schema.safeParse({ filePath: '/x', toolName: 't', reason: '' })
        expect(r.success).toBe(false)
    })

    it('rejects reason > 1000 chars', () => {
        const r = schema.safeParse({
            filePath: '/x',
            toolName: 't',
            reason: 'x'.repeat(1001),
        })
        expect(r.success).toBe(false)
    })

    it('rejects filePath > 4096 chars (path length bound)', () => {
        const r = schema.safeParse({
            filePath: '/' + 'a'.repeat(4097),
            toolName: 't',
            reason: 'r',
        })
        expect(r.success).toBe(false)
    })

    it('rejects extra unknown keys only if strict (zod default: allows extras)', () => {
        // Documenting default behavior — zod object schemas allow unknown keys unless .strict().
        const r = schema.safeParse({
            filePath: '/x',
            toolName: 't',
            reason: 'r',
            extraField: 'ignored',
        })
        // With default (non-strict) parsing this succeeds; it just strips the extra key.
        expect(r.success).toBe(true)
    })

    it('rejects missing filePath entirely', () => {
        const r = schema.safeParse({ toolName: 't', reason: 'r' })
        expect(r.success).toBe(false)
    })

    it('rejects missing reason entirely', () => {
        const r = schema.safeParse({ filePath: '/x', toolName: 't' })
        expect(r.success).toBe(false)
    })
})
