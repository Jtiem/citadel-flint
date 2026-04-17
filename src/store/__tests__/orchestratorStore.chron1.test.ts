/**
 * orchestratorStore.chron1.test.ts
 *
 * CHRON.1 — Reason-on-Override: orchestratorStore.approveToolCall
 *
 * UPDATED (2026-04-16, post end-of-round ceremony, H2/MAJ-1 fix):
 *   The earlier `approveMutation(0, reason)` sentinel call silently no-op'd
 *   because no mutations_ledger row exists for the orchestrator path. It now
 *   calls `governance.recordApprovalReason({ filePath, toolName, reason })`
 *   which writes a governance_events entry (event_type='override') queryable
 *   via the audit log. The reason is no longer appended to chat transcripts.
 *
 * Test boundaries:
 *   - approveToolCall passes reason to governance.recordApprovalReason IPC
 *   - approveToolCall with no reason does NOT call recordApprovalReason
 *   - approveToolCall no longer writes the reason into tool_result content
 *   - recordApprovalReason failure does not block applyBatch success
 *   - filePath is read from canvasStore and forwarded
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOrchestratorStore } from '../orchestratorStore'
import { useCanvasStore } from '../canvasStore'

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockChat = vi.fn().mockResolvedValue(undefined)
const mockOnChunk = vi.fn()
const mockRemoveChunkListener = vi.fn()
const mockApplyBatch = vi.fn().mockResolvedValue(undefined)
const mockApproveMutation = vi.fn().mockResolvedValue(undefined)
const mockRecordApprovalReason = vi.fn().mockResolvedValue(undefined)

function setupFlintAPI() {
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        ai: {
            chat: mockChat,
            onChunk: mockOnChunk,
            removeChunkListener: mockRemoveChunkListener,
            getConfig: vi.fn().mockResolvedValue({ hasKey: false, provider: null, model: null, baseURL: null }),
            saveConfig: vi.fn().mockResolvedValue(undefined),
        },
        tokens: { readAll: vi.fn().mockResolvedValue([]) },
        applyBatch: mockApplyBatch,
        governance: {
            approveMutation: mockApproveMutation,
            rejectMutation: vi.fn().mockResolvedValue(undefined),
            recordApprovalReason: mockRecordApprovalReason,
            getPendingMutations: vi.fn().mockResolvedValue([]),
        },
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    useOrchestratorStore.getState().clearHistory()
    // Reset canvas state so filePath is deterministic per test.
    useCanvasStore.setState({ activeFilePath: '/tmp/test/file.tsx' })
    setupFlintAPI()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedPendingToolCall(id = 'tool-chron1') {
    useOrchestratorStore.getState()._addToolCallMessage(
        'flint_add_class',
        id,
        { targetId: 'node-abc', className: 'text-indigo-400', reasoning: 'brand colour' },
    )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CHRON.1 — orchestratorStore.approveToolCall reason wiring', () => {
    it('approveToolCall with reason passes filePath+toolName+reason to recordApprovalReason', async () => {
        seedPendingToolCall('tc-with-reason')
        await useOrchestratorStore.getState().approveToolCall('tc-with-reason', 'brand team approved')

        expect(mockApplyBatch).toHaveBeenCalledOnce()
        expect(mockRecordApprovalReason).toHaveBeenCalledOnce()
        expect(mockRecordApprovalReason).toHaveBeenCalledWith({
            filePath: '/tmp/test/file.tsx',
            toolName: 'flint_add_class',
            reason: 'brand team approved',
        })
        // The deprecated approveMutation(0, …) sentinel must NOT fire anymore.
        expect(mockApproveMutation).not.toHaveBeenCalled()
    })

    it('approveToolCall with no reason does NOT call recordApprovalReason', async () => {
        seedPendingToolCall('tc-no-reason')
        await useOrchestratorStore.getState().approveToolCall('tc-no-reason')

        expect(mockApplyBatch).toHaveBeenCalledOnce()
        expect(mockRecordApprovalReason).not.toHaveBeenCalled()
        expect(mockApproveMutation).not.toHaveBeenCalled()
    })

    it('approveToolCall with reason="skipped" forwards "skipped" to recordApprovalReason', async () => {
        seedPendingToolCall('tc-skipped')
        await useOrchestratorStore.getState().approveToolCall('tc-skipped', 'skipped')

        expect(mockRecordApprovalReason).toHaveBeenCalledWith({
            filePath: '/tmp/test/file.tsx',
            toolName: 'flint_add_class',
            reason: 'skipped',
        })
    })

    it('approveToolCall does NOT append reason text to tool_result content (security hardening)', async () => {
        seedPendingToolCall('tc-content')
        await useOrchestratorStore.getState().approveToolCall('tc-content', 'compliance requirement')

        const messages = useOrchestratorStore.getState().messages
        const resultMsg = messages.find((m) => m.role === 'tool_result')
        expect(resultMsg).toBeDefined()
        // The reason must NOT leak into chat history — it belongs in the audit ledger.
        expect(resultMsg!.content).not.toContain('compliance requirement')
        expect(resultMsg!.content).not.toContain('Reason:')
    })

    it('approveToolCall with no reason does not include "Reason:" in tool_result content', async () => {
        seedPendingToolCall('tc-no-reason-content')
        await useOrchestratorStore.getState().approveToolCall('tc-no-reason-content')

        const messages = useOrchestratorStore.getState().messages
        const resultMsg = messages.find((m) => m.role === 'tool_result')
        expect(resultMsg).toBeDefined()
        expect(resultMsg!.content).not.toContain('Reason:')
    })

    it('approveToolCall is a no-op when tool call id does not exist', async () => {
        await useOrchestratorStore.getState().approveToolCall('nonexistent-id', 'some reason')

        expect(mockApplyBatch).not.toHaveBeenCalled()
        expect(mockRecordApprovalReason).not.toHaveBeenCalled()
        expect(mockApproveMutation).not.toHaveBeenCalled()
    })

    it('recordApprovalReason failure does not block applyBatch success', async () => {
        mockRecordApprovalReason.mockRejectedValueOnce(new Error('DB write failed'))
        seedPendingToolCall('tc-ipc-fail')

        // Should not throw
        await expect(
            useOrchestratorStore.getState().approveToolCall('tc-ipc-fail', 'some reason')
        ).resolves.toBeUndefined()

        expect(mockApplyBatch).toHaveBeenCalledOnce()
    })

    it('recordApprovalReason uses "unknown" filePath when canvasStore has no active file', async () => {
        useCanvasStore.setState({ activeFilePath: null })
        seedPendingToolCall('tc-no-file')

        await useOrchestratorStore.getState().approveToolCall('tc-no-file', 'audit reason')

        expect(mockRecordApprovalReason).toHaveBeenCalledWith({
            filePath: 'unknown',
            toolName: 'flint_add_class',
            reason: 'audit reason',
        })
    })
})
