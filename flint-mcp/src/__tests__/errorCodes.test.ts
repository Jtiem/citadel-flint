/**
 * CX.3 — Error Codes Tests
 * flint-mcp/src/__tests__/errorCodes.test.ts
 *
 * Tests for the Flint tool-failure error taxonomy:
 *   - All 10 FLINT-ERR-XXX codes are defined with non-empty message and recovery
 *   - flintError() factory produces correctly shaped FlintError objects
 *   - isFlintError() type guard returns correct true/false for all inputs
 *   - Context passthrough works for all 10 codes
 *   - formatFlintError() produces readable output with code, message, recovery
 *   - Edge cases: empty context, undefined context, non-object inputs to isFlintError
 */

import { describe, it, expect } from 'vitest'
import {
    flintError,
    isFlintError,
    formatFlintError,
    type FlintError,
    type FlintErrorCode,
} from '../../src/core/errorCodes.js'

// ── All 10 error codes ─────────────────────────────────────────────────────────

const ALL_CODES: FlintErrorCode[] = [
    'FLINT-ERR-001',
    'FLINT-ERR-002',
    'FLINT-ERR-003',
    'FLINT-ERR-004',
    'FLINT-ERR-005',
    'FLINT-ERR-006',
    'FLINT-ERR-007',
    'FLINT-ERR-008',
    'FLINT-ERR-009',
    'FLINT-ERR-010',
]

// ── CX3-01: All 10 codes produce a valid FlintError ─────────────────────────

describe('CX3-01: flintError() factory — all 10 codes produce valid output', () => {
    it('each code produces an object with _type FlintError', () => {
        for (const code of ALL_CODES) {
            const err = flintError(code)
            expect(err._type, `_type should be FlintError for ${code}`).toBe('FlintError')
        }
    })

    it('each code is preserved in the output', () => {
        for (const code of ALL_CODES) {
            const err = flintError(code)
            expect(err.code, `code should match for ${code}`).toBe(code)
        }
    })

    it('each code produces a non-empty message (>= 20 chars)', () => {
        for (const code of ALL_CODES) {
            const err = flintError(code)
            expect(
                err.message.length,
                `message too short for ${code}`,
            ).toBeGreaterThanOrEqual(20)
        }
    })

    it('each code produces a non-empty recovery string (>= 20 chars)', () => {
        for (const code of ALL_CODES) {
            const err = flintError(code)
            expect(
                err.recovery.length,
                `recovery too short for ${code}`,
            ).toBeGreaterThanOrEqual(20)
        }
    })
})

// ── CX3-02: Specific code semantics ───────────────────────────────────────────

describe('CX3-02: Specific error code messages match spec', () => {
    it('FLINT-ERR-001 message refers to node not found / flint-id', () => {
        const err = flintError('FLINT-ERR-001')
        expect(err.message.toLowerCase()).toMatch(/node|flint-id/)
    })

    it('FLINT-ERR-002 message refers to file not found', () => {
        const err = flintError('FLINT-ERR-002')
        expect(err.message.toLowerCase()).toMatch(/file/)
    })

    it('FLINT-ERR-003 message refers to parse / babel', () => {
        const err = flintError('FLINT-ERR-003')
        expect(err.message.toLowerCase()).toMatch(/parse|babel/)
    })

    it('FLINT-ERR-004 message refers to design token', () => {
        const err = flintError('FLINT-ERR-004')
        expect(err.message.toLowerCase()).toMatch(/token/)
    })

    it('FLINT-ERR-005 message refers to typescript or type', () => {
        const err = flintError('FLINT-ERR-005')
        expect(err.message.toLowerCase()).toMatch(/type|typescript|tsc/)
    })

    it('FLINT-ERR-006 message refers to export or violation', () => {
        const err = flintError('FLINT-ERR-006')
        expect(err.message.toLowerCase()).toMatch(/export|violation/)
    })

    it('FLINT-ERR-007 message refers to file write or permissions', () => {
        const err = flintError('FLINT-ERR-007')
        expect(err.message.toLowerCase()).toMatch(/write|permission|disk/)
    })

    it('FLINT-ERR-008 message refers to missing params', () => {
        const err = flintError('FLINT-ERR-008')
        expect(err.message.toLowerCase()).toMatch(/param|missing|required/)
    })

    it('FLINT-ERR-009 message refers to healOnAudit or headless', () => {
        const err = flintError('FLINT-ERR-009')
        expect(err.message.toLowerCase()).toMatch(/heal|headless/)
    })

    it('FLINT-ERR-010 message refers to unknown or internal error', () => {
        const err = flintError('FLINT-ERR-010')
        expect(err.message.toLowerCase()).toMatch(/unknown|internal/)
    })
})

// ── CX3-03: Recovery instructions are actionable ──────────────────────────────

describe('CX3-03: Recovery instructions contain actionable guidance', () => {
    it('FLINT-ERR-001 recovery mentions flint_audit', () => {
        const err = flintError('FLINT-ERR-001')
        expect(err.recovery).toMatch(/flint_audit/)
    })

    it('FLINT-ERR-004 recovery mentions flint_sync_tokens', () => {
        const err = flintError('FLINT-ERR-004')
        expect(err.recovery).toMatch(/flint_sync_tokens/)
    })

    it('FLINT-ERR-006 recovery mentions flint_fix or flint_audit', () => {
        const err = flintError('FLINT-ERR-006')
        expect(err.recovery).toMatch(/flint_fix|flint_audit/)
    })

    it('FLINT-ERR-008 recovery mentions flint://capabilities', () => {
        const err = flintError('FLINT-ERR-008')
        expect(err.recovery).toMatch(/flint:\/\/capabilities/)
    })

    it('FLINT-ERR-009 recovery mentions flint_fix', () => {
        const err = flintError('FLINT-ERR-009')
        expect(err.recovery).toMatch(/flint_fix/)
    })
})

// ── CX3-04: Context passthrough ───────────────────────────────────────────────

describe('CX3-04: Context passthrough', () => {
    it('context is attached when provided', () => {
        const err = flintError('FLINT-ERR-002', { filePath: '/src/Button.tsx' })
        expect(err.context).toBeDefined()
        expect(err.context!.filePath).toBe('/src/Button.tsx')
    })

    it('context is undefined when not provided', () => {
        const err = flintError('FLINT-ERR-001')
        expect(err.context).toBeUndefined()
    })

    it('context can hold multiple keys', () => {
        const err = flintError('FLINT-ERR-001', {
            nodeId: 'btn-42',
            filePath: '/src/App.tsx',
            operation: 'updateProp',
        })
        expect(err.context!.nodeId).toBe('btn-42')
        expect(err.context!.filePath).toBe('/src/App.tsx')
        expect(err.context!.operation).toBe('updateProp')
    })

    it('context can hold nested objects', () => {
        const err = flintError('FLINT-ERR-005', {
            diagnostics: [{ message: 'Type error', line: 10 }],
        })
        expect(Array.isArray(err.context!.diagnostics)).toBe(true)
    })

    it('context passthrough works for all 10 codes', () => {
        for (const code of ALL_CODES) {
            const ctx = { testKey: `value-for-${code}` }
            const err = flintError(code, ctx)
            expect(err.context?.testKey).toBe(`value-for-${code}`)
        }
    })
})

// ── CX3-05: isFlintError type guard ─────────────────────────────────────────

describe('CX3-05: isFlintError type guard', () => {
    it('returns true for a valid FlintError created by flintError()', () => {
        const err = flintError('FLINT-ERR-001')
        expect(isFlintError(err)).toBe(true)
    })

    it('returns true for a FlintError with context', () => {
        const err = flintError('FLINT-ERR-002', { filePath: '/src/App.tsx' })
        expect(isFlintError(err)).toBe(true)
    })

    it('returns false for null', () => {
        expect(isFlintError(null)).toBe(false)
    })

    it('returns false for undefined', () => {
        expect(isFlintError(undefined)).toBe(false)
    })

    it('returns false for a plain string', () => {
        expect(isFlintError('FLINT-ERR-001')).toBe(false)
    })

    it('returns false for a plain Error object', () => {
        expect(isFlintError(new Error('something went wrong'))).toBe(false)
    })

    it('returns false for an empty object', () => {
        expect(isFlintError({})).toBe(false)
    })

    it('returns false for an object missing _type', () => {
        expect(isFlintError({ code: 'FLINT-ERR-001', message: 'x', recovery: 'y' })).toBe(false)
    })

    it('returns false for an object with wrong _type value', () => {
        expect(isFlintError({ _type: 'SomethingElse', code: 'FLINT-ERR-001', message: 'x', recovery: 'y' })).toBe(false)
    })

    it('returns false for an object missing message', () => {
        expect(isFlintError({ _type: 'FlintError', code: 'FLINT-ERR-001', recovery: 'y' })).toBe(false)
    })

    it('returns false for an object missing recovery', () => {
        expect(isFlintError({ _type: 'FlintError', code: 'FLINT-ERR-001', message: 'x' })).toBe(false)
    })

    it('returns false for a number', () => {
        expect(isFlintError(42)).toBe(false)
    })

    it('returns true for all 10 codes produced by the factory', () => {
        for (const code of ALL_CODES) {
            const err = flintError(code)
            expect(isFlintError(err), `isFlintError failed for ${code}`).toBe(true)
        }
    })
})

// ── CX3-06: formatFlintError output ─────────────────────────────────────────

describe('CX3-06: formatFlintError output', () => {
    it('includes the error code in the output', () => {
        const err = flintError('FLINT-ERR-001')
        const output = formatFlintError(err)
        expect(output).toContain('FLINT-ERR-001')
    })

    it('includes the message text', () => {
        const err = flintError('FLINT-ERR-002')
        const output = formatFlintError(err)
        expect(output).toContain(err.message)
    })

    it('includes "Recovery:" label', () => {
        const err = flintError('FLINT-ERR-003')
        const output = formatFlintError(err)
        expect(output).toContain('Recovery:')
    })

    it('includes context JSON when context is present', () => {
        const err = flintError('FLINT-ERR-002', { filePath: '/src/Button.tsx' })
        const output = formatFlintError(err)
        expect(output).toContain('Context:')
        expect(output).toContain('/src/Button.tsx')
    })

    it('omits "Context:" when no context is provided', () => {
        const err = flintError('FLINT-ERR-001')
        const output = formatFlintError(err)
        expect(output).not.toContain('Context:')
    })

    it('produces a multi-line string', () => {
        const err = flintError('FLINT-ERR-005')
        const output = formatFlintError(err)
        expect(output.split('\n').length).toBeGreaterThanOrEqual(2)
    })
})

// ── CX3-07: FlintError shape is a plain-serializable object ─────────────────

describe('CX3-07: FlintError is JSON-serializable', () => {
    it('round-trips through JSON.stringify / JSON.parse', () => {
        const err = flintError('FLINT-ERR-003', { filePath: '/src/App.tsx', line: 42 })
        const json = JSON.stringify(err)
        const parsed = JSON.parse(json) as FlintError
        expect(parsed.code).toBe('FLINT-ERR-003')
        expect(parsed.message).toBe(err.message)
        expect(parsed.recovery).toBe(err.recovery)
        expect(parsed.context!.filePath).toBe('/src/App.tsx')
        expect(parsed.context!.line).toBe(42)
    })

    it('serialized form can be detected by isFlintError after parse', () => {
        const err = flintError('FLINT-ERR-007')
        const parsed = JSON.parse(JSON.stringify(err))
        expect(isFlintError(parsed)).toBe(true)
    })
})

// ── CX3-08: Error message/recovery content quality ───────────────────────────

describe('CX3-08: Content quality checks', () => {
    it('no code shares a message with another code', () => {
        const messages = ALL_CODES.map((c) => flintError(c).message)
        const unique = new Set(messages)
        expect(unique.size).toBe(ALL_CODES.length)
    })

    it('no code shares a recovery string with another code', () => {
        const recoveries = ALL_CODES.map((c) => flintError(c).recovery)
        const unique = new Set(recoveries)
        expect(unique.size).toBe(ALL_CODES.length)
    })

    it('all messages end with a period', () => {
        for (const code of ALL_CODES) {
            const err = flintError(code)
            expect(
                err.message.trim().endsWith('.'),
                `message for ${code} does not end with a period`,
            ).toBe(true)
        }
    })
})
