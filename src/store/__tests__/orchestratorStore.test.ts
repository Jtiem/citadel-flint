/**
 * orchestratorStore.test.ts — src/store/__tests__/orchestratorStore.test.ts
 *
 * Tests for the AI orchestrator Zustand store.
 *
 * Covers:
 *   - Initial state shape
 *   - sendMessage appends user message
 *   - clearHistory resets all conversation state
 *   - _appendTextDelta accumulates stream buffer
 *   - _flushAssistantTurn converts buffer to message
 *   - _addErrorMessage appends error and resets thinking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOrchestratorStore } from '../../store/orchestratorStore'

// ── Setup ────────────────────────────────────────────────────────────────────

const mockChat = vi.fn().mockResolvedValue(undefined)
const mockOnChunk = vi.fn()
const mockRemoveChunkListener = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    useOrchestratorStore.getState().clearHistory()

    ;(window as unknown as Record<string, unknown>).flintAPI = {
        ai: {
            chat: mockChat,
            onChunk: mockOnChunk,
            removeChunkListener: mockRemoveChunkListener,
            getConfig: vi.fn().mockResolvedValue({ hasKey: false, provider: null, model: null, baseURL: null }),
            saveConfig: vi.fn().mockResolvedValue(undefined),
        },
        tokens: { readAll: vi.fn().mockResolvedValue([]) },
        applyBatch: vi.fn().mockResolvedValue(undefined),
    }
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('orchestratorStore', () => {
    it('has correct initial state', () => {
        const state = useOrchestratorStore.getState()
        expect(state.messages).toEqual([])
        expect(state.isThinking).toBe(false)
        expect(state.activeStatus).toBe('')
        expect(state.streamBuffer).toBe('')
        expect(state.pendingToolCalls).toEqual([])
        expect(state.lastTier).toBeNull()
        expect(state.hasConfig).toBe(false)
        expect(state.currentProvider).toBeNull()
    })

    it('sendMessage appends a user message and calls chat', async () => {
        await useOrchestratorStore.getState().sendMessage('Hello')

        const messages = useOrchestratorStore.getState().messages
        expect(messages.length).toBeGreaterThanOrEqual(1)
        expect(messages[0].role).toBe('user')
        expect(messages[0].content).toBe('Hello')
        expect(mockChat).toHaveBeenCalled()
    })

    it('clearHistory resets all conversation state', () => {
        // Manually set some state
        useOrchestratorStore.setState({
            messages: [{ id: 'x', role: 'user', content: 'hi', timestamp: 1 }],
            streamBuffer: 'partial',
            pendingToolCalls: [{ id: 'tc', toolName: 'test', input: {}, status: 'pending' as const }],
            isThinking: true,
        })

        useOrchestratorStore.getState().clearHistory()

        const state = useOrchestratorStore.getState()
        expect(state.messages).toEqual([])
        expect(state.streamBuffer).toBe('')
        expect(state.pendingToolCalls).toEqual([])
        expect(state.isThinking).toBe(false)
    })

    it('_appendTextDelta accumulates into streamBuffer', () => {
        useOrchestratorStore.getState()._appendTextDelta('Hello ')
        useOrchestratorStore.getState()._appendTextDelta('world')
        expect(useOrchestratorStore.getState().streamBuffer).toBe('Hello world')
    })

    it('_flushAssistantTurn converts streamBuffer into a message', () => {
        useOrchestratorStore.getState()._appendTextDelta('response text')
        useOrchestratorStore.getState()._flushAssistantTurn()

        const messages = useOrchestratorStore.getState().messages
        expect(messages).toHaveLength(1)
        expect(messages[0].role).toBe('assistant')
        expect(messages[0].content).toBe('response text')
        expect(useOrchestratorStore.getState().streamBuffer).toBe('')
    })

    it('_flushAssistantTurn is a no-op when streamBuffer is empty', () => {
        useOrchestratorStore.getState()._flushAssistantTurn()
        expect(useOrchestratorStore.getState().messages).toHaveLength(0)
    })

    it('_addErrorMessage appends an error and resets thinking state', () => {
        useOrchestratorStore.setState({ isThinking: true, activeStatus: 'Working...' })
        useOrchestratorStore.getState()._addErrorMessage('Something broke')

        const state = useOrchestratorStore.getState()
        expect(state.messages).toHaveLength(1)
        expect(state.messages[0].role).toBe('error')
        expect(state.messages[0].content).toBe('Something broke')
        expect(state.isThinking).toBe(false)
        expect(state.activeStatus).toBe('')
    })
})
