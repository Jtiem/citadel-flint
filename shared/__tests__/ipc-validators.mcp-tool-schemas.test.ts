/**
 * ipc-validators.mcp-tool-schemas.test.ts — shared/__tests__/ipc-validators.mcp-tool-schemas.test.ts
 *
 * MINT.5 Phase 3 — Per-tool Zod schemas for the 5 user-invokable sync tools.
 *
 * Covers contract testBoundaries:
 *   - 'flintSyncPullArgsSchema accepts good args'
 *   - 'flintSyncPullArgsSchema rejects missing projectRoot'
 *   - 'flintResolveAllArgsSchema rejects bad resolution'
 *
 * Also covers: all 5 schemas accept well-formed args and reject:
 *   - missing projectRoot
 *   - wrong type for projectRoot
 *   - unknown keys (strict mode)
 *
 * Invariant: per-tool-schema-rejection-latency (< 1ms per rejection at p95)
 * — measured in the bench section at the bottom.
 */

import { describe, it, expect } from 'vitest'
import {
    flintSyncPullArgsSchema,
    flintSyncPushArgsSchema,
    flintResolveAllArgsSchema,
    flintResolveConflictArgsSchema,
    flintSyncCheckArgsSchema,
    MCP_TOOL_ARG_SCHEMAS,
} from '../ipc-validators'
import type {
    FlintSyncPullArgs,
    FlintSyncPushArgs,
    FlintResolveAllArgs,
    FlintResolveConflictArgs,
    FlintSyncCheckArgs,
    MCPToolWithArgSchema,
} from '../../.flint-context/contracts/MINT.5-phase3.contract'

// ── MCP_TOOL_ARG_SCHEMAS lookup presence ──────────────────────────────────────

describe('MCP_TOOL_ARG_SCHEMAS lookup', () => {
    it('exports MCP_TOOL_ARG_SCHEMAS as an object', () => {
        expect(typeof MCP_TOOL_ARG_SCHEMAS).toBe('object')
        expect(MCP_TOOL_ARG_SCHEMAS).not.toBeNull()
    })

    const expectedTools: MCPToolWithArgSchema[] = [
        'flint_sync_pull',
        'flint_sync_push',
        'flint_resolve_all',
        'flint_resolve_conflict',
        'flint_sync_check',
    ]

    for (const tool of expectedTools) {
        it(`contains schema for '${tool}'`, () => {
            expect(MCP_TOOL_ARG_SCHEMAS[tool]).toBeDefined()
        })
    }

    it('each entry in MCP_TOOL_ARG_SCHEMAS has a safeParse function', () => {
        for (const tool of expectedTools) {
            const schema = MCP_TOOL_ARG_SCHEMAS[tool]
            expect(typeof schema.safeParse).toBe('function')
        }
    })
})

// ── flintSyncPullArgsSchema ───────────────────────────────────────────────────
// boundary: flintSyncPullArgsSchema accepts good args
// boundary: flintSyncPullArgsSchema rejects missing projectRoot

describe('flintSyncPullArgsSchema', () => {
    it('accepts well-formed args: { projectRoot: "/proj" }', () => {
        // boundary: flintSyncPullArgsSchema accepts good args
        const result = flintSyncPullArgsSchema.safeParse({ projectRoot: '/proj' })
        expect(result.success).toBe(true)
    })

    it('accepts optional scope="token" with tokenPath', () => {
        // boundary: flintSyncPullArgsSchema accepts good args (edge: optional scope+tokenPath)
        const result = flintSyncPullArgsSchema.safeParse({
            projectRoot: '/proj',
            scope: 'token',
            tokenPath: 'colors.primary',
        })
        expect(result.success).toBe(true)
    })

    it('rejects when projectRoot is missing', () => {
        // boundary: flintSyncPullArgsSchema rejects missing projectRoot
        const result = flintSyncPullArgsSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('rejects empty string projectRoot', () => {
        // boundary: flintSyncPullArgsSchema rejects missing projectRoot (edge: empty string)
        const result = flintSyncPullArgsSchema.safeParse({ projectRoot: '' })
        expect(result.success).toBe(false)
    })

    it('rejects when projectRoot is a number instead of a string', () => {
        const result = flintSyncPullArgsSchema.safeParse({ projectRoot: 42 })
        expect(result.success).toBe(false)
    })

    it('rejects unknown extra keys (strict mode)', () => {
        const result = flintSyncPullArgsSchema.safeParse({
            projectRoot: '/proj',
            unknownKey: 'danger',
        })
        expect(result.success).toBe(false)
    })

    it('rejects scope value outside the allowed union', () => {
        const result = flintSyncPullArgsSchema.safeParse({
            projectRoot: '/proj',
            scope: 'invalid-scope',
        })
        expect(result.success).toBe(false)
    })
})

// ── flintSyncPushArgsSchema ───────────────────────────────────────────────────

describe('flintSyncPushArgsSchema', () => {
    it('accepts well-formed args: { projectRoot: "/proj" }', () => {
        const result = flintSyncPushArgsSchema.safeParse({ projectRoot: '/proj' })
        expect(result.success).toBe(true)
    })

    it('rejects when projectRoot is missing', () => {
        const result = flintSyncPushArgsSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('rejects wrong type for projectRoot', () => {
        const result = flintSyncPushArgsSchema.safeParse({ projectRoot: null })
        expect(result.success).toBe(false)
    })

    it('rejects unknown extra keys (strict mode)', () => {
        const result = flintSyncPushArgsSchema.safeParse({
            projectRoot: '/proj',
            extraField: true,
        })
        expect(result.success).toBe(false)
    })
})

// ── flintResolveAllArgsSchema ─────────────────────────────────────────────────
// boundary: flintResolveAllArgsSchema rejects bad resolution

describe('flintResolveAllArgsSchema', () => {
    it('accepts well-formed args with resolution="local"', () => {
        const result = flintResolveAllArgsSchema.safeParse({
            projectRoot: '/proj',
            resolution: 'local',
        })
        expect(result.success).toBe(true)
    })

    it('accepts well-formed args with resolution="remote"', () => {
        const result = flintResolveAllArgsSchema.safeParse({
            projectRoot: '/proj',
            resolution: 'remote',
        })
        expect(result.success).toBe(true)
    })

    it('rejects resolution outside the union ("lol")', () => {
        // boundary: flintResolveAllArgsSchema rejects bad resolution
        const result = flintResolveAllArgsSchema.safeParse({
            projectRoot: '/proj',
            resolution: 'lol',
        })
        expect(result.success).toBe(false)
    })

    it('rejects when projectRoot is missing', () => {
        const result = flintResolveAllArgsSchema.safeParse({ resolution: 'local' })
        expect(result.success).toBe(false)
    })

    it('rejects when resolution is missing', () => {
        const result = flintResolveAllArgsSchema.safeParse({ projectRoot: '/proj' })
        expect(result.success).toBe(false)
    })

    it('rejects unknown extra keys (strict mode)', () => {
        const result = flintResolveAllArgsSchema.safeParse({
            projectRoot: '/proj',
            resolution: 'local',
            hackField: 'x',
        })
        expect(result.success).toBe(false)
    })
})

// ── flintResolveConflictArgsSchema ────────────────────────────────────────────

describe('flintResolveConflictArgsSchema', () => {
    it('accepts well-formed args with resolution="local"', () => {
        const result = flintResolveConflictArgsSchema.safeParse({
            conflictId: 'abc-123',
            resolution: 'local',
        })
        expect(result.success).toBe(true)
    })

    it('accepts resolution="merged" with mergedValue', () => {
        const result = flintResolveConflictArgsSchema.safeParse({
            conflictId: 'abc-123',
            resolution: 'merged',
            mergedValue: '#3B82F6',
        })
        expect(result.success).toBe(true)
    })

    it('rejects when conflictId is missing', () => {
        const result = flintResolveConflictArgsSchema.safeParse({ resolution: 'local' })
        expect(result.success).toBe(false)
    })

    it('rejects resolution outside the union', () => {
        const result = flintResolveConflictArgsSchema.safeParse({
            conflictId: 'abc-123',
            resolution: 'bogus',
        })
        expect(result.success).toBe(false)
    })

    it('rejects unknown extra keys (strict mode)', () => {
        const result = flintResolveConflictArgsSchema.safeParse({
            conflictId: 'abc-123',
            resolution: 'local',
            injected: 'bad',
        })
        expect(result.success).toBe(false)
    })
})

// ── flintSyncCheckArgsSchema ──────────────────────────────────────────────────

describe('flintSyncCheckArgsSchema', () => {
    it('accepts well-formed args: { projectRoot: "/proj" }', () => {
        const result = flintSyncCheckArgsSchema.safeParse({ projectRoot: '/proj' })
        expect(result.success).toBe(true)
    })

    it('rejects when projectRoot is missing', () => {
        const result = flintSyncCheckArgsSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('rejects unknown extra keys (strict mode)', () => {
        const result = flintSyncCheckArgsSchema.safeParse({
            projectRoot: '/proj',
            extra: 'bad',
        })
        expect(result.success).toBe(false)
    })
})

// ── Per-tool-schema-rejection-latency invariant ───────────────────────────────
// Invariant: per-tool-schema-rejection-latency (< 1ms per rejection at p95)
// Measured via programmatic timing loop (bench() lives in the .bench.ts sibling).

describe('per-tool-schema-rejection-latency invariant', () => {
    it('p95 < 1ms: 1000 safeParse rejections timed via performance.now()', () => {
        const CALL_COUNT = 1000
        const timings: number[] = []

        for (let i = 0; i < CALL_COUNT; i++) {
            const start = performance.now()
            flintSyncPullArgsSchema.safeParse({})
            const end = performance.now()
            timings.push(end - start)
        }

        timings.sort((a, b) => a - b)
        const p95Index = Math.floor(CALL_COUNT * 0.95)
        const p95 = timings[p95Index]!

        // Invariant: < 1ms per rejection at p95
        expect(p95).toBeLessThan(1)
    })

    it('lookup + safeParse via MCP_TOOL_ARG_SCHEMAS is consistent with direct schema call', () => {
        const directResult = flintSyncPullArgsSchema.safeParse({ projectRoot: '/proj' })
        const lookupResult = MCP_TOOL_ARG_SCHEMAS['flint_sync_pull'].safeParse({ projectRoot: '/proj' })

        expect(directResult.success).toBe(lookupResult.success)
    })
})
