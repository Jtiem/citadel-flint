/**
 * CX.3 — Error Codes Tests
 * bridge-mcp/src/__tests__/errorCodes.test.ts
 *
 * Tests for the Bridge tool-failure error taxonomy:
 *   - All 10 BRIDGE-ERR-XXX codes are defined with non-empty message and recovery
 *   - bridgeError() factory produces correctly shaped BridgeError objects
 *   - isBridgeError() type guard returns correct true/false for all inputs
 *   - Context passthrough works for all 10 codes
 *   - formatBridgeError() produces readable output with code, message, recovery
 *   - Edge cases: empty context, undefined context, non-object inputs to isBridgeError
 */

import { describe, it, expect } from 'vitest'
import {
    bridgeError,
    isBridgeError,
    formatBridgeError,
    type BridgeError,
    type BridgeErrorCode,
} from '../../src/core/errorCodes.js'

// ── All 10 error codes ─────────────────────────────────────────────────────────

const ALL_CODES: BridgeErrorCode[] = [
    'BRIDGE-ERR-001',
    'BRIDGE-ERR-002',
    'BRIDGE-ERR-003',
    'BRIDGE-ERR-004',
    'BRIDGE-ERR-005',
    'BRIDGE-ERR-006',
    'BRIDGE-ERR-007',
    'BRIDGE-ERR-008',
    'BRIDGE-ERR-009',
    'BRIDGE-ERR-010',
]

// ── CX3-01: All 10 codes produce a valid BridgeError ─────────────────────────

describe('CX3-01: bridgeError() factory — all 10 codes produce valid output', () => {
    it('each code produces an object with _type BridgeError', () => {
        for (const code of ALL_CODES) {
            const err = bridgeError(code)
            expect(err._type, `_type should be BridgeError for ${code}`).toBe('BridgeError')
        }
    })

    it('each code is preserved in the output', () => {
        for (const code of ALL_CODES) {
            const err = bridgeError(code)
            expect(err.code, `code should match for ${code}`).toBe(code)
        }
    })

    it('each code produces a non-empty message (>= 20 chars)', () => {
        for (const code of ALL_CODES) {
            const err = bridgeError(code)
            expect(
                err.message.length,
                `message too short for ${code}`,
            ).toBeGreaterThanOrEqual(20)
        }
    })

    it('each code produces a non-empty recovery string (>= 20 chars)', () => {
        for (const code of ALL_CODES) {
            const err = bridgeError(code)
            expect(
                err.recovery.length,
                `recovery too short for ${code}`,
            ).toBeGreaterThanOrEqual(20)
        }
    })
})

// ── CX3-02: Specific code semantics ───────────────────────────────────────────

describe('CX3-02: Specific error code messages match spec', () => {
    it('BRIDGE-ERR-001 message refers to node not found / bridge-id', () => {
        const err = bridgeError('BRIDGE-ERR-001')
        expect(err.message.toLowerCase()).toMatch(/node|bridge-id/)
    })

    it('BRIDGE-ERR-002 message refers to file not found', () => {
        const err = bridgeError('BRIDGE-ERR-002')
        expect(err.message.toLowerCase()).toMatch(/file/)
    })

    it('BRIDGE-ERR-003 message refers to parse / babel', () => {
        const err = bridgeError('BRIDGE-ERR-003')
        expect(err.message.toLowerCase()).toMatch(/parse|babel/)
    })

    it('BRIDGE-ERR-004 message refers to design token', () => {
        const err = bridgeError('BRIDGE-ERR-004')
        expect(err.message.toLowerCase()).toMatch(/token/)
    })

    it('BRIDGE-ERR-005 message refers to typescript or type', () => {
        const err = bridgeError('BRIDGE-ERR-005')
        expect(err.message.toLowerCase()).toMatch(/type|typescript|tsc/)
    })

    it('BRIDGE-ERR-006 message refers to export or violation', () => {
        const err = bridgeError('BRIDGE-ERR-006')
        expect(err.message.toLowerCase()).toMatch(/export|violation/)
    })

    it('BRIDGE-ERR-007 message refers to file write or permissions', () => {
        const err = bridgeError('BRIDGE-ERR-007')
        expect(err.message.toLowerCase()).toMatch(/write|permission|disk/)
    })

    it('BRIDGE-ERR-008 message refers to missing params', () => {
        const err = bridgeError('BRIDGE-ERR-008')
        expect(err.message.toLowerCase()).toMatch(/param|missing|required/)
    })

    it('BRIDGE-ERR-009 message refers to healOnAudit or headless', () => {
        const err = bridgeError('BRIDGE-ERR-009')
        expect(err.message.toLowerCase()).toMatch(/heal|headless/)
    })

    it('BRIDGE-ERR-010 message refers to unknown or internal error', () => {
        const err = bridgeError('BRIDGE-ERR-010')
        expect(err.message.toLowerCase()).toMatch(/unknown|internal/)
    })
})

// ── CX3-03: Recovery instructions are actionable ──────────────────────────────

describe('CX3-03: Recovery instructions contain actionable guidance', () => {
    it('BRIDGE-ERR-001 recovery mentions bridge_audit', () => {
        const err = bridgeError('BRIDGE-ERR-001')
        expect(err.recovery).toMatch(/bridge_audit/)
    })

    it('BRIDGE-ERR-004 recovery mentions bridge_sync_tokens', () => {
        const err = bridgeError('BRIDGE-ERR-004')
        expect(err.recovery).toMatch(/bridge_sync_tokens/)
    })

    it('BRIDGE-ERR-006 recovery mentions bridge_fix or bridge_audit', () => {
        const err = bridgeError('BRIDGE-ERR-006')
        expect(err.recovery).toMatch(/bridge_fix|bridge_audit/)
    })

    it('BRIDGE-ERR-008 recovery mentions bridge://capabilities', () => {
        const err = bridgeError('BRIDGE-ERR-008')
        expect(err.recovery).toMatch(/bridge:\/\/capabilities/)
    })

    it('BRIDGE-ERR-009 recovery mentions bridge_fix', () => {
        const err = bridgeError('BRIDGE-ERR-009')
        expect(err.recovery).toMatch(/bridge_fix/)
    })
})

// ── CX3-04: Context passthrough ───────────────────────────────────────────────

describe('CX3-04: Context passthrough', () => {
    it('context is attached when provided', () => {
        const err = bridgeError('BRIDGE-ERR-002', { filePath: '/src/Button.tsx' })
        expect(err.context).toBeDefined()
        expect(err.context!.filePath).toBe('/src/Button.tsx')
    })

    it('context is undefined when not provided', () => {
        const err = bridgeError('BRIDGE-ERR-001')
        expect(err.context).toBeUndefined()
    })

    it('context can hold multiple keys', () => {
        const err = bridgeError('BRIDGE-ERR-001', {
            nodeId: 'btn-42',
            filePath: '/src/App.tsx',
            operation: 'updateProp',
        })
        expect(err.context!.nodeId).toBe('btn-42')
        expect(err.context!.filePath).toBe('/src/App.tsx')
        expect(err.context!.operation).toBe('updateProp')
    })

    it('context can hold nested objects', () => {
        const err = bridgeError('BRIDGE-ERR-005', {
            diagnostics: [{ message: 'Type error', line: 10 }],
        })
        expect(Array.isArray(err.context!.diagnostics)).toBe(true)
    })

    it('context passthrough works for all 10 codes', () => {
        for (const code of ALL_CODES) {
            const ctx = { testKey: `value-for-${code}` }
            const err = bridgeError(code, ctx)
            expect(err.context?.testKey).toBe(`value-for-${code}`)
        }
    })
})

// ── CX3-05: isBridgeError type guard ─────────────────────────────────────────

describe('CX3-05: isBridgeError type guard', () => {
    it('returns true for a valid BridgeError created by bridgeError()', () => {
        const err = bridgeError('BRIDGE-ERR-001')
        expect(isBridgeError(err)).toBe(true)
    })

    it('returns true for a BridgeError with context', () => {
        const err = bridgeError('BRIDGE-ERR-002', { filePath: '/src/App.tsx' })
        expect(isBridgeError(err)).toBe(true)
    })

    it('returns false for null', () => {
        expect(isBridgeError(null)).toBe(false)
    })

    it('returns false for undefined', () => {
        expect(isBridgeError(undefined)).toBe(false)
    })

    it('returns false for a plain string', () => {
        expect(isBridgeError('BRIDGE-ERR-001')).toBe(false)
    })

    it('returns false for a plain Error object', () => {
        expect(isBridgeError(new Error('something went wrong'))).toBe(false)
    })

    it('returns false for an empty object', () => {
        expect(isBridgeError({})).toBe(false)
    })

    it('returns false for an object missing _type', () => {
        expect(isBridgeError({ code: 'BRIDGE-ERR-001', message: 'x', recovery: 'y' })).toBe(false)
    })

    it('returns false for an object with wrong _type value', () => {
        expect(isBridgeError({ _type: 'SomethingElse', code: 'BRIDGE-ERR-001', message: 'x', recovery: 'y' })).toBe(false)
    })

    it('returns false for an object missing message', () => {
        expect(isBridgeError({ _type: 'BridgeError', code: 'BRIDGE-ERR-001', recovery: 'y' })).toBe(false)
    })

    it('returns false for an object missing recovery', () => {
        expect(isBridgeError({ _type: 'BridgeError', code: 'BRIDGE-ERR-001', message: 'x' })).toBe(false)
    })

    it('returns false for a number', () => {
        expect(isBridgeError(42)).toBe(false)
    })

    it('returns true for all 10 codes produced by the factory', () => {
        for (const code of ALL_CODES) {
            const err = bridgeError(code)
            expect(isBridgeError(err), `isBridgeError failed for ${code}`).toBe(true)
        }
    })
})

// ── CX3-06: formatBridgeError output ─────────────────────────────────────────

describe('CX3-06: formatBridgeError output', () => {
    it('includes the error code in the output', () => {
        const err = bridgeError('BRIDGE-ERR-001')
        const output = formatBridgeError(err)
        expect(output).toContain('BRIDGE-ERR-001')
    })

    it('includes the message text', () => {
        const err = bridgeError('BRIDGE-ERR-002')
        const output = formatBridgeError(err)
        expect(output).toContain(err.message)
    })

    it('includes "Recovery:" label', () => {
        const err = bridgeError('BRIDGE-ERR-003')
        const output = formatBridgeError(err)
        expect(output).toContain('Recovery:')
    })

    it('includes context JSON when context is present', () => {
        const err = bridgeError('BRIDGE-ERR-002', { filePath: '/src/Button.tsx' })
        const output = formatBridgeError(err)
        expect(output).toContain('Context:')
        expect(output).toContain('/src/Button.tsx')
    })

    it('omits "Context:" when no context is provided', () => {
        const err = bridgeError('BRIDGE-ERR-001')
        const output = formatBridgeError(err)
        expect(output).not.toContain('Context:')
    })

    it('produces a multi-line string', () => {
        const err = bridgeError('BRIDGE-ERR-005')
        const output = formatBridgeError(err)
        expect(output.split('\n').length).toBeGreaterThanOrEqual(2)
    })
})

// ── CX3-07: BridgeError shape is a plain-serializable object ─────────────────

describe('CX3-07: BridgeError is JSON-serializable', () => {
    it('round-trips through JSON.stringify / JSON.parse', () => {
        const err = bridgeError('BRIDGE-ERR-003', { filePath: '/src/App.tsx', line: 42 })
        const json = JSON.stringify(err)
        const parsed = JSON.parse(json) as BridgeError
        expect(parsed.code).toBe('BRIDGE-ERR-003')
        expect(parsed.message).toBe(err.message)
        expect(parsed.recovery).toBe(err.recovery)
        expect(parsed.context!.filePath).toBe('/src/App.tsx')
        expect(parsed.context!.line).toBe(42)
    })

    it('serialized form can be detected by isBridgeError after parse', () => {
        const err = bridgeError('BRIDGE-ERR-007')
        const parsed = JSON.parse(JSON.stringify(err))
        expect(isBridgeError(parsed)).toBe(true)
    })
})

// ── CX3-08: Error message/recovery content quality ───────────────────────────

describe('CX3-08: Content quality checks', () => {
    it('no code shares a message with another code', () => {
        const messages = ALL_CODES.map((c) => bridgeError(c).message)
        const unique = new Set(messages)
        expect(unique.size).toBe(ALL_CODES.length)
    })

    it('no code shares a recovery string with another code', () => {
        const recoveries = ALL_CODES.map((c) => bridgeError(c).recovery)
        const unique = new Set(recoveries)
        expect(unique.size).toBe(ALL_CODES.length)
    })

    it('all messages end with a period', () => {
        for (const code of ALL_CODES) {
            const err = bridgeError(code)
            expect(
                err.message.trim().endsWith('.'),
                `message for ${code} does not end with a period`,
            ).toBe(true)
        }
    })
})
