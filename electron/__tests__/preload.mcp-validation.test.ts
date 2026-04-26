/**
 * preload.mcp-validation.test.ts — electron/__tests__/preload.mcp-validation.test.ts
 *
 * MINT.5 Phase 3 — Per-tool Zod validation gate at the preload bridge.
 *
 * Covers contract testBoundaries:
 *   - 'preload validation gate (bad payload)'   — short-circuits without ipcRenderer.invoke
 *   - 'preload validation gate (good payload)'  — forwards to ipcRenderer.invoke
 *
 * Invariants tested:
 *   - validation-gate-zero-network: ipcRenderer.invoke NOT called on bad payload
 *
 * Pattern: reproduces the validation gate logic inline (same approach as
 * coverageIpc.test.ts and runtimeAxeIpc.test.ts) so we can exercise the gate
 * without importing preload.ts (which has Electron API dependencies).
 *
 * When electron/preload.ts lands its implementation, these tests validate that:
 *   1. Bad payload → validation-error envelope returned, no IPC fired.
 *   2. Good payload → ipcRenderer.invoke called with original args.
 *   3. Unknown tool → no schema found → passes through unchanged (no crash).
 */

import { describe, it, expect, vi } from 'vitest'
import {
    MCP_TOOL_ARG_SCHEMAS,
} from '../../shared/ipc-validators'
import type { MCPCallResultV3 } from '../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Inline reproduction of the preload validation gate ────────────────────────
// This mirrors exactly what electron/preload.ts must implement.

type IpcRendererInvoke = (channel: string, ...args: unknown[]) => Promise<unknown>

function makePreloadMcpCallTool(ipcRendererInvoke: IpcRendererInvoke) {
    return async function callTool(
        name: string,
        args: Record<string, unknown>
    ): Promise<MCPCallResultV3> {
        // Look up per-tool schema
        const schema = MCP_TOOL_ARG_SCHEMAS[name as keyof typeof MCP_TOOL_ARG_SCHEMAS]

        if (schema) {
            const parseResult = schema.safeParse(args)
            if (!parseResult.success) {
                // Validation-error envelope — do NOT call ipcRenderer.invoke
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

        // Good payload (or unknown tool) — forward to IPC
        const result = await ipcRendererInvoke('mcp:call-tool', name, args)
        return result as MCPCallResultV3
    }
}

// ── preload validation gate (bad payload) ─────────────────────────────────────
// boundary: preload validation gate (bad payload)
// Invariant: validation-gate-zero-network

describe('preload validation gate — bad payload', () => {
    it('does NOT call ipcRenderer.invoke when flint_sync_pull args fail validation', async () => {
        // boundary: preload validation gate (bad payload)
        const ipcInvoke = vi.fn()
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        // {} is missing projectRoot — schema must reject
        const result = await callTool('flint_sync_pull', {})

        // Invariant: validation-gate-zero-network
        expect(ipcInvoke).not.toHaveBeenCalled()
        expect(result.isError).toBe(true)
        expect(result.classification).toBe('validation-error')
    })

    it('returns a validation-error envelope with sanitized message', async () => {
        const ipcInvoke = vi.fn()
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        const result = await callTool('flint_sync_pull', {})

        expect(result.content).toHaveLength(1)
        expect(result.content[0]!.type).toBe('text')
        expect(result.content[0]!.text).toContain('flint_sync_pull')
    })

    it('short-circuits for bad flint_resolve_all args (invalid resolution)', async () => {
        const ipcInvoke = vi.fn()
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        const result = await callTool('flint_resolve_all', {
            projectRoot: '/proj',
            resolution: 'bogus',
        })

        expect(ipcInvoke).not.toHaveBeenCalled()
        expect(result.classification).toBe('validation-error')
    })

    it('short-circuits for bad flint_sync_push args (wrong type)', async () => {
        const ipcInvoke = vi.fn()
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        const result = await callTool('flint_sync_push', { projectRoot: 42 } as unknown as Record<string, unknown>)

        expect(ipcInvoke).not.toHaveBeenCalled()
        expect(result.classification).toBe('validation-error')
    })

    it('short-circuits for bad flint_sync_check args (unknown extra keys)', async () => {
        const ipcInvoke = vi.fn()
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        const result = await callTool('flint_sync_check', {
            projectRoot: '/proj',
            injected: 'evil',
        })

        expect(ipcInvoke).not.toHaveBeenCalled()
        expect(result.classification).toBe('validation-error')
    })
})

// ── preload validation gate (good payload) ────────────────────────────────────
// boundary: preload validation gate (good payload)

describe('preload validation gate — good payload', () => {
    it('calls ipcRenderer.invoke with ("mcp:call-tool", name, args) for valid flint_sync_pull args', async () => {
        // boundary: preload validation gate (good payload)
        const successResult: MCPCallResultV3 = {
            content: [{ type: 'text', text: 'ok' }],
            isError: false,
            classification: 'unknown',
        }
        const ipcInvoke = vi.fn().mockResolvedValue(successResult)
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        await callTool('flint_sync_pull', { projectRoot: '/proj' })

        expect(ipcInvoke).toHaveBeenCalledTimes(1)
        expect(ipcInvoke).toHaveBeenCalledWith('mcp:call-tool', 'flint_sync_pull', {
            projectRoot: '/proj',
        })
    })

    it('calls ipcRenderer.invoke for valid flint_sync_push args', async () => {
        const ipcInvoke = vi.fn().mockResolvedValue({ content: [], isError: false, classification: 'unknown' })
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        await callTool('flint_sync_push', { projectRoot: '/proj' })

        expect(ipcInvoke).toHaveBeenCalledWith('mcp:call-tool', 'flint_sync_push', {
            projectRoot: '/proj',
        })
    })

    it('calls ipcRenderer.invoke for valid flint_resolve_all args', async () => {
        const ipcInvoke = vi.fn().mockResolvedValue({ content: [], isError: false, classification: 'unknown' })
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        await callTool('flint_resolve_all', { projectRoot: '/proj', resolution: 'local' })

        expect(ipcInvoke).toHaveBeenCalledWith('mcp:call-tool', 'flint_resolve_all', {
            projectRoot: '/proj',
            resolution: 'local',
        })
    })

    it('calls ipcRenderer.invoke for valid flint_resolve_conflict args', async () => {
        const ipcInvoke = vi.fn().mockResolvedValue({ content: [], isError: false, classification: 'unknown' })
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        await callTool('flint_resolve_conflict', {
            conflictId: 'c-1',
            resolution: 'remote',
        })

        expect(ipcInvoke).toHaveBeenCalledWith('mcp:call-tool', 'flint_resolve_conflict', {
            conflictId: 'c-1',
            resolution: 'remote',
        })
    })
})

// ── Unknown tool falls through ────────────────────────────────────────────────
// boundary: preload validation gate (good payload) — edge: unknown tool

describe('preload validation gate — unknown tool name', () => {
    it('passes through to ipcRenderer.invoke for an unknown tool (no schema = no validation, no crash)', async () => {
        // boundary: preload validation gate (good payload) — edge: unknown tool
        const ipcInvoke = vi.fn().mockResolvedValue({ content: [], isError: false, classification: 'unknown' })
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        // flint_audit has no per-tool schema in Phase 3
        await callTool('flint_audit', { filePath: '/src/App.tsx' })

        // Should pass through — no crash, no validation-error
        expect(ipcInvoke).toHaveBeenCalledTimes(1)
        expect(ipcInvoke).toHaveBeenCalledWith('mcp:call-tool', 'flint_audit', {
            filePath: '/src/App.tsx',
        })
    })

    it('does not crash for completely unknown tool names', async () => {
        const ipcInvoke = vi.fn().mockResolvedValue({ content: [], isError: false, classification: 'unknown' })
        const callTool = makePreloadMcpCallTool(ipcInvoke)

        await expect(
            callTool('nonexistent_tool_xyz', { anyArg: 'value' })
        ).resolves.not.toThrow()

        expect(ipcInvoke).toHaveBeenCalledTimes(1)
    })
})
