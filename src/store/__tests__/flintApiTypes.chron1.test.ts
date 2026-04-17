/**
 * flintApiTypes.chron1.test.ts
 *
 * Type-level smoke test for the CHRON.1 changes to
 * src/types/flint-api.d.ts — ensures the declared GovernanceAPI surface
 * stays in sync with the implementation.
 *
 * This file relies on TypeScript strict mode; the actual enforcement
 * happens when `tsc --noEmit` runs. The runtime assertions are minimal —
 * they just prove the file compiles against the current declaration.
 */

import { describe, it, expect } from 'vitest'
import type { FlintAPI, PendingMutation } from '../../types/flint-api'

describe('GovernanceAPI signature smoke tests (CHRON.1)', () => {
    it('approveMutation accepts optional reason string', () => {
        // Type-only assertion: the expression compiles iff approveMutation's
        // signature is (id: number, reason?: string) => Promise<void>.
        const fn: NonNullable<FlintAPI['governance']['approveMutation']> =
            async (_id: number, _reason?: string) => { /* noop */ }
        expect(typeof fn).toBe('function')
    })

    it('getAuditLog return shape includes metadata and ruleId', () => {
        // Build a value matching the declared shape — compile-time only.
        const row: Awaited<ReturnType<NonNullable<FlintAPI['governance']['getAuditLog']>>>[number] = {
            id: 1,
            timestamp: '2026-04-16T00:00:00Z',
            action: 'override',
            filePath: '/x',
            description: 'ok',
            metadata: '{"reason":"ok"}',
            ruleId: 'orchestrator:flint_add_class',
        }
        expect(row.metadata).toBe('{"reason":"ok"}')
        expect(row.ruleId).toBe('orchestrator:flint_add_class')
    })

    it('getAuditLog tolerates null metadata and ruleId (optional fields)', () => {
        const row: Awaited<ReturnType<NonNullable<FlintAPI['governance']['getAuditLog']>>>[number] = {
            id: 2,
            timestamp: '2026-04-16T00:01:00Z',
            action: 'violation',
            filePath: '/y',
            description: 'ok',
            metadata: null,
            ruleId: null,
        }
        expect(row.metadata).toBeNull()
        expect(row.ruleId).toBeNull()
    })

    it('recordApprovalReason is declared as optional governance method', () => {
        const fn: NonNullable<FlintAPI['governance']['recordApprovalReason']> =
            async (_args: { filePath: string; toolName: string; reason: string }) => { /* noop */ }
        expect(typeof fn).toBe('function')
    })

    it('PendingMutation.reason is optional', () => {
        const mutWith: PendingMutation = {
            id: 1, type: 't', filePath: '/x', riskScore: 0.5, riskTier: 'amber',
            reason: 'brand approved',
        }
        const mutWithout: PendingMutation = {
            id: 2, type: 't', filePath: '/y', riskScore: 0.2, riskTier: 'amber',
        }
        expect(mutWith.reason).toBe('brand approved')
        expect(mutWithout.reason).toBeUndefined()
    })
})
