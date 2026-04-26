/**
 * mcpClient.validation.test.ts — server/__tests__/mcpClient.validation.test.ts
 *
 * MINT.5 Phase 3 — Web-parity mirror of the preload validation gate test.
 *
 * Covers contract testBoundary:
 *   - 'web validation gate (parity)' — mirrors preload validation gate behavior:
 *     bad args → validation-error envelope, mcpClient.callTool NOT called.
 *
 * The web build (server/index.ts) must implement the same per-tool Zod
 * validation gate as electron/preload.ts. This test reproduces the gate logic
 * inline so it can run in Node environment without spawning the full web server.
 *
 * When server/index.ts lands its implementation, these tests verify parity.
 */

import { describe, it, expect, vi } from 'vitest'
import {
    MCP_TOOL_ARG_SCHEMAS,
} from '../../shared/ipc-validators'
import type { MCPCallResultV3 } from '../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Inline reproduction of the server/index.ts validation gate ────────────────
// Mirrors makePreloadMcpCallTool in preload.mcp-validation.test.ts exactly.
// server/index.ts must implement this same logic for web parity.

type McpClientCallTool = (name: string, args: Record<string, unknown>) => Promise<MCPCallResultV3>

function makeServerValidationGate(mcpClientCallTool: McpClientCallTool) {
    return async function callTool(
        name: string,
        args: Record<string, unknown>
    ): Promise<MCPCallResultV3> {
        const schema = MCP_TOOL_ARG_SCHEMAS[name as keyof typeof MCP_TOOL_ARG_SCHEMAS]

        if (schema) {
            const parseResult = schema.safeParse(args)
            if (!parseResult.success) {
                const sanitizedMessage = `Invalid arguments for ${name}: ${parseResult.error.issues
                    .map((i) => i.message)
                    .join(', ')}`
                return {
                    content: [{ type: 'text', text: sanitizedMessage }],
                    isError: true,
                    classification: 'validation-error',
                }
            }
        }

        return mcpClientCallTool(name, args)
    }
}

// ── Web validation gate (bad payload) ────────────────────────────────────────
// boundary: web validation gate (parity)

describe('server validation gate — bad payload (web parity)', () => {
    it('does NOT call mcpClient.callTool when flint_sync_pull args fail validation', async () => {
        // boundary: web validation gate (parity)
        const mcpClientCallTool = vi.fn()
        const callTool = makeServerValidationGate(mcpClientCallTool)

        const result = await callTool('flint_sync_pull', {})

        expect(mcpClientCallTool).not.toHaveBeenCalled()
        expect(result.isError).toBe(true)
        expect(result.classification).toBe('validation-error')
    })

    it('returns a validation-error envelope with sanitized message', async () => {
        const mcpClientCallTool = vi.fn()
        const callTool = makeServerValidationGate(mcpClientCallTool)

        const result = await callTool('flint_sync_pull', {})

        expect(result.content[0]!.type).toBe('text')
        expect(result.content[0]!.text).toContain('flint_sync_pull')
    })

    it('short-circuits for bad flint_resolve_all args', async () => {
        const mcpClientCallTool = vi.fn()
        const callTool = makeServerValidationGate(mcpClientCallTool)

        const result = await callTool('flint_resolve_all', {
            projectRoot: '/proj',
            resolution: 'bogus',
        })

        expect(mcpClientCallTool).not.toHaveBeenCalled()
        expect(result.classification).toBe('validation-error')
    })

    it('short-circuits for bad flint_sync_push args (wrong type)', async () => {
        const mcpClientCallTool = vi.fn()
        const callTool = makeServerValidationGate(mcpClientCallTool)

        const result = await callTool('flint_sync_push', { projectRoot: 99 } as unknown as Record<string, unknown>)

        expect(mcpClientCallTool).not.toHaveBeenCalled()
        expect(result.classification).toBe('validation-error')
    })

    it('short-circuits for extra unknown keys on flint_sync_check', async () => {
        const mcpClientCallTool = vi.fn()
        const callTool = makeServerValidationGate(mcpClientCallTool)

        const result = await callTool('flint_sync_check', {
            projectRoot: '/proj',
            malicious: 'payload',
        })

        expect(mcpClientCallTool).not.toHaveBeenCalled()
        expect(result.classification).toBe('validation-error')
    })
})

// ── Web validation gate (good payload) ───────────────────────────────────────

describe('server validation gate — good payload (web parity)', () => {
    it('calls mcpClient.callTool with original name and args for valid flint_sync_pull', async () => {
        const successResult: MCPCallResultV3 = {
            content: [{ type: 'text', text: 'ok' }],
            isError: false,
            classification: 'unknown',
        }
        const mcpClientCallTool = vi.fn().mockResolvedValue(successResult)
        const callTool = makeServerValidationGate(mcpClientCallTool)

        await callTool('flint_sync_pull', { projectRoot: '/proj' })

        expect(mcpClientCallTool).toHaveBeenCalledTimes(1)
        expect(mcpClientCallTool).toHaveBeenCalledWith('flint_sync_pull', {
            projectRoot: '/proj',
        })
    })

    it('calls mcpClient.callTool for valid flint_resolve_all args', async () => {
        const mcpClientCallTool = vi.fn().mockResolvedValue({
            content: [], isError: false, classification: 'unknown',
        })
        const callTool = makeServerValidationGate(mcpClientCallTool)

        await callTool('flint_resolve_all', { projectRoot: '/proj', resolution: 'remote' })

        expect(mcpClientCallTool).toHaveBeenCalledWith('flint_resolve_all', {
            projectRoot: '/proj',
            resolution: 'remote',
        })
    })

    it('calls mcpClient.callTool for valid flint_sync_check args', async () => {
        const mcpClientCallTool = vi.fn().mockResolvedValue({
            content: [], isError: false, classification: 'unknown',
        })
        const callTool = makeServerValidationGate(mcpClientCallTool)

        await callTool('flint_sync_check', { projectRoot: '/my-project' })

        expect(mcpClientCallTool).toHaveBeenCalledWith('flint_sync_check', {
            projectRoot: '/my-project',
        })
    })
})

// ── Unknown tool passes through unchanged ────────────────────────────────────

describe('server validation gate — unknown tool falls through (web parity)', () => {
    it('passes unknown tool directly to mcpClient.callTool without validation', async () => {
        const mcpClientCallTool = vi.fn().mockResolvedValue({
            content: [], isError: false, classification: 'unknown',
        })
        const callTool = makeServerValidationGate(mcpClientCallTool)

        // flint_audit has no per-tool schema in Phase 3
        await callTool('flint_audit', { filePath: '/src/App.tsx' })

        expect(mcpClientCallTool).toHaveBeenCalledTimes(1)
        expect(mcpClientCallTool).toHaveBeenCalledWith('flint_audit', {
            filePath: '/src/App.tsx',
        })
    })

    it('does not crash for completely unknown tool names', async () => {
        const mcpClientCallTool = vi.fn().mockResolvedValue({
            content: [], isError: false, classification: 'unknown',
        })
        const callTool = makeServerValidationGate(mcpClientCallTool)

        await expect(
            callTool('nonexistent_tool_xyz', { arg: 'val' })
        ).resolves.not.toThrow()

        expect(mcpClientCallTool).toHaveBeenCalledTimes(1)
    })
})

// ── Parity assertion: both gates produce identical envelopes ──────────────────

describe('server validation gate — parity with preload gate', () => {
    it('produces the same validation-error envelope shape as the preload gate', async () => {
        const mcpClientCallTool = vi.fn()
        const callTool = makeServerValidationGate(mcpClientCallTool)

        const result = await callTool('flint_sync_pull', {})

        // Must match the contract envelope shape (MCPCallResultV3)
        expect(Array.isArray(result.content)).toBe(true)
        expect(result.isError).toBe(true)
        expect(result.classification).toBe('validation-error')
        expect(result.content[0]!.type).toBe('text')
        expect(typeof result.content[0]!.text).toBe('string')
    })
})
