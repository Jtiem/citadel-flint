/**
 * orchestratorStore.ts — src/store/orchestratorStore.ts
 *
 * Zustand store for the Bridge Auditor / Orchestration Engine (Phase L).
 *
 * Holds:
 *   - Conversation history shown in AgentChatPanel.
 *   - In-flight streaming state + AbortController for stop-generation.
 *   - Pending tool calls awaiting user confirmation.
 *
 * The store does NOT call the LLM directly. It delegates to:
 *   window.bridgeAPI.ai.chat()   — initiates the IPC → main → Anthropic flow.
 *   window.bridgeAPI.ai.onChunk  — receives streamed OrchestratorChunk objects.
 */

import { create } from 'zustand'
import type { ChatMessage } from '../types/bridge-api'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error'

export interface AgentMessage {
    id: string
    role: MessageRole
    content: string
    /** For tool_call messages: the structured data for the diff card. */
    toolData?: PendingToolCall
    timestamp: number
}

export interface PendingToolCall {
    id: string              // Anthropic tool_use_id
    toolName: string        // e.g. 'bridge_apply_batch'
    input: Record<string, unknown>
    status: 'pending' | 'approved' | 'rejected'
    /** Raw result returned from the tool execution (for expand view) */
    result?: unknown
}

export type ComplexityTier = 'flash' | 'thinking'

interface OrchestratorState {
    messages: AgentMessage[]
    isThinking: boolean
    activeStatus: string    // Running status receipt (e.g. 'Generating response...')
    streamBuffer: string    // accumulates text deltas for current assistant turn
    pendingToolCalls: PendingToolCall[]
    lastTier: ComplexityTier | null
    hasConfig: boolean      // false → show config screen
    currentProvider: 'anthropic' | 'openai' | 'gemini' | null
    currentModel: string | null
    currentBaseURL: string | null
    /** Active AbortController — used by stopGeneration() */
    _abortController: AbortController | null
}

interface OrchestratorActions {
    // Lifecycle
    initConfig: () => Promise<void>
    saveApiKey: (key: string) => Promise<void>
    /** Save any subset of settings (key, model, and/or baseURL). Requires provider. */
    saveSettings: (settings: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey?: string; model?: string; baseURL?: string }) => Promise<void>

    // Conversation
    sendMessage: (text: string, truncateAfterIndex?: number) => Promise<void>
    clearHistory: () => void
    stopGeneration: () => void

    // Edit-and-resubmit: truncates history to just before the user message at
    // `index` and re-sends the new text.
    resubmitMessage: (index: number, newText: string) => Promise<void>

    // Retry: re-fires the last user message (used on error).
    retryLast: () => Promise<void>

    // Tool call approval flow
    approveToolCall: (id: string) => Promise<void>
    rejectToolCall: (id: string) => void

    // Internal helpers (called by the chunk listener)
    _appendTextDelta: (text: string) => void
    _flushAssistantTurn: () => void
    _addToolCallMessage: (toolName: string, toolUseId: string, input: Record<string, unknown>) => void
    _finishStream: () => void
    _addErrorMessage: (text: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
    return crypto.randomUUID()
}

// Builds the minimal message array to send to the API including tool_calls and tool_results
function buildApiMessages(messages: AgentMessage[]): ChatMessage[] {
    return messages
        .filter((m) => m.role !== 'error') // errors never go to the AI
        .map((m): ChatMessage => {
            if (m.role === 'tool_call' && m.toolData) {
                return {
                    role: m.role as 'tool_call',
                    content: m.content,
                    toolUseId: m.toolData.id,
                    toolName: m.toolData.toolName,
                    toolInput: m.toolData.input,
                }
            }
            if (m.role === 'tool_result') {
                return {
                    role: m.role as 'tool_result',
                    content: m.content,
                    toolUseId: m.toolData?.id,
                }
            }
            return { role: m.role as 'user' | 'assistant', content: m.content }
        })
}

// ── Core send logic (shared by sendMessage / resubmitMessage / retryLast) ─────

async function _dispatchChat(
    get: () => OrchestratorState & OrchestratorActions,
    set: (partial: Partial<OrchestratorState & OrchestratorActions>) => void,
) {
    const controller = new AbortController()
    set({ isThinking: true, streamBuffer: '', activeStatus: 'Contacting API...', _abortController: controller })

    window.bridgeAPI.ai.removeChunkListener()

    window.bridgeAPI.ai.onChunk((chunk) => {
        if (controller.signal.aborted) return
        const store = get()
        if (chunk.type === 'text' && chunk.text) {
            store._appendTextDelta(chunk.text)
            set({ activeStatus: 'Generating response...' })
        } else if (chunk.type === 'tool_call' && chunk.toolInput && Object.keys(chunk.toolInput).length > 0) {
            set({ activeStatus: `Preparing tool: ${chunk.toolName ?? '...'}` })
            store._flushAssistantTurn()
            store._addToolCallMessage(
                chunk.toolName ?? '',
                chunk.toolUseId ?? '',
                chunk.toolInput ?? {},
            )
        } else if (chunk.type === 'validation_error') {
            // ── Phase M Commandment 16: Invisible AI Recovery Loop ────────────
            // A tool call failed in-memory validation. Feed the error back to
            // the AI as a tool_result so it can correct itself without the user
            // ever seeing a broken diff card.
            console.warn(`[Bridge] Invisible recovery: ${chunk.toolName} validation failed: ${chunk.error}`)
            store._flushAssistantTurn()
            // Add a synthetic invisible tool_result error into the history.
            // Use get() + imperative set to match the local typed set signature.
            const currentMessages = get().messages
            set({
                messages: [
                    ...currentMessages,
                    {
                        id: uid(),
                        role: 'tool_result' as MessageRole,
                        content: `[VALIDATION ERROR — not shown to user] ${chunk.error ?? 'Unknown validation error'}`,
                        toolData: { id: chunk.toolUseId ?? '', toolName: chunk.toolName ?? '', input: {}, status: 'rejected' as const },
                        timestamp: Date.now(),
                    },
                ],
            })
            // Re-dispatch immediately so the AI can correct itself
            void _dispatchChat(get, set)

        } else if (chunk.type === 'done') {
            store._flushAssistantTurn()
            store._finishStream()
            window.bridgeAPI.ai.removeChunkListener()
        } else if (chunk.type === 'error') {
            store._flushAssistantTurn()
            store._addErrorMessage(chunk.error ?? 'Unknown error')
            store._finishStream()
            window.bridgeAPI.ai.removeChunkListener()
        }
    })

    const apiMessages = buildApiMessages(get().messages)
    await window.bridgeAPI.ai.chat(apiMessages, {})
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOrchestratorStore = create<OrchestratorState & OrchestratorActions>((set, get) => ({
    messages: [],
    isThinking: false,
    activeStatus: '',
    streamBuffer: '',
    pendingToolCalls: [],
    lastTier: null,
    hasConfig: false,
    currentProvider: null,
    currentModel: null,
    currentBaseURL: null,
    _abortController: null,

    // ── Config ────────────────────────────────────────────────────────────────

    initConfig: async () => {
        const cfg = await window.bridgeAPI.ai.getConfig()
        set({ hasConfig: cfg.hasKey, currentProvider: cfg.provider, currentModel: cfg.model, currentBaseURL: cfg.baseURL })
    },

    saveApiKey: async (key: string) => {
        await window.bridgeAPI.ai.saveConfig({ apiKey: key, provider: 'anthropic' })
        set({ hasConfig: true })
    },

    saveSettings: async (settings: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey?: string; model?: string; baseURL?: string }) => {
        await window.bridgeAPI.ai.saveConfig(settings)
        set({ currentProvider: settings.provider })
        if (settings.apiKey) set({ hasConfig: true })
        if (settings.model) set({ currentModel: settings.model })
        // Allow clearing baseURL by setting null when empty string is saved
        set({ currentBaseURL: settings.baseURL ?? null })
    },

    // ── Conversation ──────────────────────────────────────────────────────────

    sendMessage: async (text: string) => {
        const userMsg: AgentMessage = {
            id: uid(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        }
        set((s) => ({ messages: [...s.messages, userMsg] }))
        await _dispatchChat(get, set)
    },

    stopGeneration: () => {
        const { _abortController } = get()
        if (_abortController) {
            _abortController.abort()
        }
        window.bridgeAPI.ai.removeChunkListener()
        const { streamBuffer } = get()
        // Flush whatever partial text was received before stopping.
        if (streamBuffer.trim()) {
            set((s) => ({
                messages: [
                    ...s.messages,
                    {
                        id: uid(),
                        role: 'assistant' as MessageRole,
                        content: s.streamBuffer + ' ✋ *(stopped)*',
                        timestamp: Date.now(),
                    },
                ],
                streamBuffer: '',
            }))
        }
        set({ isThinking: false, activeStatus: '', _abortController: null })
    },

    resubmitMessage: async (index: number, newText: string) => {
        // Truncate history to just before index, then re-fire with the new text.
        const truncated = get().messages.slice(0, index)
        const newUserMsg: AgentMessage = {
            id: uid(),
            role: 'user',
            content: newText,
            timestamp: Date.now(),
        }
        set({ messages: [...truncated, newUserMsg], pendingToolCalls: [] })
        await _dispatchChat(get, set)
    },

    retryLast: async () => {
        // Drop the last error message, keep everything before it, and re-dispatch.
        set((s) => {
            const msgs = [...s.messages]
            if (msgs[msgs.length - 1]?.role === 'error') msgs.pop()
            return { messages: msgs, pendingToolCalls: [] }
        })
        await _dispatchChat(get, set)
    },

    clearHistory: () => {
        window.bridgeAPI.ai.removeChunkListener()
        set({ messages: [], streamBuffer: '', pendingToolCalls: [], isThinking: false })
    },

    // ── Tool Call Approval ────────────────────────────────────────────────────

    approveToolCall: async (id: string) => {
        const call = get().pendingToolCalls.find((c) => c.id === id)
        if (!call) return

        set((s) => ({
            pendingToolCalls: s.pendingToolCalls.map((c) =>
                c.id === id ? { ...c, status: 'approved' } : c
            ),
        }))

        // ── Phase M: Route new 7-op tool names to ASTMutation ops ────────────
        const MUTATION_TOOLS = new Set([
            'bridge_update_props', 'bridge_update_text', 'bridge_insert_node',
            'bridge_wrap_node', 'bridge_delete_node', 'bridge_add_class', 'bridge_remove_class'
        ])

        if (MUTATION_TOOLS.has(call.toolName)) {
            const input = call.input
            let mutations: unknown[] = []

            switch (call.toolName) {
                case 'bridge_update_props': {
                    const props = (input.props as Record<string, string>) ?? {}
                    mutations = Object.entries(props).map(([propName, value]) => ({
                        op: 'updateProp',
                        nodeId: input.targetId,
                        propName,
                        value,
                    }))
                    break
                }
                case 'bridge_update_text':
                    mutations = [{ op: 'updateTextContent', nodeId: input.targetId, text: input.text }]
                    break
                case 'bridge_insert_node':
                    mutations = [{
                        op: 'injectComponent',
                        targetNodeId: input.targetId,
                        jsxSnippet: `<${input.nodeType}${input.children ? `>${input.children}</${input.nodeType}>` : ' /'}>`
                    }]
                    break
                case 'bridge_wrap_node':
                    mutations = [{ op: 'wrapNode', nodeId: input.targetId, wrapperElement: input.wrapperType }]
                    break
                case 'bridge_delete_node':
                    mutations = [{ op: 'deleteNode', nodeId: input.targetId }]
                    break
                case 'bridge_add_class': {
                    // Read current className, append new class via updateClassName
                    mutations = [{ op: 'addClassName', nodeId: input.targetId, className: input.className }]
                    break
                }
                case 'bridge_remove_class':
                    mutations = [{ op: 'removeClassName', nodeId: input.targetId, className: input.className }]
                    break
            }

            if (mutations.length > 0) {
                await window.bridgeAPI.applyBatch(mutations)
                const reasoning = typeof input.reasoning === 'string' ? input.reasoning : ''
                set((s) => ({
                    messages: [
                        ...s.messages,
                        {
                            id: uid(),
                            role: 'tool_result' as MessageRole,
                            content: `✅ Applied ${mutations.length} mutation(s). ${reasoning}`,
                            toolData: call,
                            timestamp: Date.now(),
                        },
                    ],
                }))
                await _dispatchChat(get, set)
            }
        }
    },

    rejectToolCall: async (id: string) => {
        const call = get().pendingToolCalls.find((c) => c.id === id)
        if (!call) return

        set((s) => ({
            pendingToolCalls: s.pendingToolCalls.map((c) =>
                c.id === id ? { ...c, status: 'rejected' } : c
            ),
            messages: [
                ...s.messages,
                {
                    id: uid(),
                    role: 'tool_result' as MessageRole,
                    content: '❌ Mutation rejected by user.',
                    toolData: call,
                    timestamp: Date.now(),
                },
            ],
        }))
        // Re-dispatch so the AI knows it was rejected
        await _dispatchChat(get, set)
    },


    // ── Internal helpers ──────────────────────────────────────────────────────

    _appendTextDelta: (text: string) => {
        set((s) => ({ streamBuffer: s.streamBuffer + text }))
    },

    _flushAssistantTurn: () => {
        const { streamBuffer } = get()
        if (!streamBuffer.trim()) return
        set((s) => ({
            messages: [
                ...s.messages,
                {
                    id: uid(),
                    role: 'assistant' as MessageRole,
                    content: streamBuffer,
                    timestamp: Date.now(),
                },
            ],
            streamBuffer: '',
        }))
    },

    _addToolCallMessage: (toolName: string, toolUseId: string, input: Record<string, unknown>) => {
        const call: PendingToolCall = {
            id: toolUseId,
            toolName,
            input,
            status: 'pending',
        }
        set((s) => ({
            pendingToolCalls: [...s.pendingToolCalls, call],
            messages: [
                ...s.messages,
                {
                    id: uid(),
                    role: 'tool_call' as MessageRole,
                    content: toolName,
                    toolData: call,
                    timestamp: Date.now(),
                },
            ],
        }))
    },

    _finishStream: () => {
        set({ isThinking: false, activeStatus: '', _abortController: null })
    },

    _addErrorMessage: (text: string) => {
        set((s) => ({
            messages: [
                ...s.messages,
                {
                    id: uid(),
                    role: 'error' as MessageRole,
                    content: text,
                    timestamp: Date.now(),
                },
            ],
            isThinking: false,
            activeStatus: '',
            _abortController: null,
        }))
    },
}))
