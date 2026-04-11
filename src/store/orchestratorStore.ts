/**
 * orchestratorStore.ts — src/store/orchestratorStore.ts
 *
 * Zustand store for the Flint Auditor / Orchestration Engine (Phase L).
 *
 * Holds:
 *   - Conversation history shown in AgentChatPanel.
 *   - In-flight streaming state + AbortController for stop-generation.
 *   - Pending tool calls awaiting user confirmation.
 *
 * The store does NOT call the LLM directly. It delegates to:
 *   window.flintAPI.ai.chat()   — initiates the IPC → main → Anthropic flow.
 *   window.flintAPI.ai.onChunk  — receives streamed OrchestratorChunk objects.
 */

import { create } from 'zustand'
import type { ChatMessage } from '../types/flint-api'

// ── REVIEW FIX (2026-04-10): Cross-store imports removed ────────────────────
// Previously imported useEditorStore and useCanvasStore directly, which is the
// documented architectural anti-pattern. Now accepts needed values as parameters
// or reads them lazily via dynamic import where unavoidable.
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of messages to retain in conversation history. */
const MAX_MESSAGES = 500

// ── Phase M: Read-Only Tool Auto-Execution ────────────────────────────────────
//
// These tools gather context (code, tokens, violations) without mutating state.
// When the AI calls them, we execute immediately and inject the tool_result
// back into the conversation, then re-prompt the LLM — no user approval needed.

const READ_ONLY_TOOLS = new Set([
    'flint_read_code',
    'flint_read_tokens',
    'flint_audit_mithril',
    'flint_audit_a11y',
    'flint_search_design_system',
])

// ── Lazy cross-store reference (avoids module-level import) ──────────────────
// Populated on first _dispatchChat call via dynamic import. Used synchronously
// in _addToolCallMessage for DiffCard snapshots.
let _cachedEditorStore: { getState: () => { rawCode: string | null } } | null = null

interface PendingReadOnlyTool {
    toolName: string
    toolUseId: string
    toolInput: Record<string, unknown>
}

/**
 * Context bag passed into executeReadOnlyTool so it does not import
 * editorStore / canvasStore directly (cross-store anti-pattern fix).
 */
interface ReadOnlyToolContext {
    rawCode: string | null
    linterWarnings: Map<string, unknown>
    mithrilViolations: string[]
    a11yViolations: Record<string, string[]>
}

/**
 * Executes a read-only tool and returns the result string.
 * Store values are passed in via `ctx` — no cross-store imports.
 */
async function executeReadOnlyTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    ctx: ReadOnlyToolContext,
): Promise<string> {
    switch (toolName) {
        case 'flint_read_code': {
            return ctx.rawCode || '(no file open)'
        }
        case 'flint_read_tokens': {
            const tokens = await window.flintAPI.tokens.readAll() // TODO: extract to service layer
            return JSON.stringify(tokens, null, 2)
        }
        case 'flint_audit_mithril': {
            return JSON.stringify({
                violationCount: ctx.mithrilViolations.length,
                violations: ctx.mithrilViolations.map((id) => {
                    const w = ctx.linterWarnings.get(id)
                    return w ? { ...w } : { id, type: 'unknown', severity: 'amber' }
                }),
            }, null, 2)
        }
        case 'flint_audit_a11y': {
            return JSON.stringify(ctx.a11yViolations, null, 2)
        }
        case 'flint_search_design_system': {
            const query = typeof toolInput.query === 'string' ? toolInput.query : ''
            if (!window.flintAPI.ai.queryRAG) return '(RAG not configured)' // TODO: extract to service layer
            const results = await window.flintAPI.ai.queryRAG(query)
            return JSON.stringify(results, null, 2)
        }
        default:
            return `Unknown read-only tool: ${toolName}`
    }
}

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
    toolName: string        // e.g. 'flint_apply_batch'
    input: Record<string, unknown>
    status: 'pending' | 'approved' | 'rejected'
    /** Raw result returned from the tool execution (for expand view) */
    result?: unknown
    /**
     * Snapshot of rawCode captured the moment this mutation tool_call arrived,
     * before any mutations are applied. Used by DiffCard to show a before/after
     * comparison of the targeted AST node.
     */
    beforeSnapshot?: string
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
    _addToolCallMessage: (toolName: string, toolUseId: string, input: Record<string, unknown>, beforeSnapshot?: string) => void
    _finishStream: () => void
    _addErrorMessage: (text: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
    return crypto.randomUUID()
}

/** Trims the messages array from the front if it exceeds MAX_MESSAGES. */
function trimMessages(messages: AgentMessage[]): AgentMessage[] {
    if (messages.length <= MAX_MESSAGES) return messages
    return messages.slice(messages.length - MAX_MESSAGES)
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

/** Recursion depth guard — prevents infinite loops from validation errors
 *  or read-only tool chains. Shared across all recursive _dispatchChat paths. */
let _chatDepth = 0
const MAX_CHAT_DEPTH = 10

/**
 * Lazily reads store values from editorStore and canvasStore for read-only
 * tool execution, avoiding module-level cross-store imports.
 */
async function _getReadOnlyToolContext(): Promise<ReadOnlyToolContext> {
    const { useEditorStore } = await import('./editorStore')
    const { useCanvasStore } = await import('./canvasStore')
    // Cache for synchronous access in _addToolCallMessage
    if (!_cachedEditorStore) _cachedEditorStore = useEditorStore
    const editorState = useEditorStore.getState()
    const canvasState = useCanvasStore.getState()
    return {
        rawCode: editorState.rawCode,
        linterWarnings: editorState.linterWarnings,
        mithrilViolations: canvasState.mithrilViolations,
        a11yViolations: canvasState.a11yViolations,
    }
}

async function _dispatchChat(
    get: () => OrchestratorState & OrchestratorActions,
    set: (partial: Partial<OrchestratorState & OrchestratorActions>) => void,
) {
    // ── Recursion depth guard ────────────────────────────────────────────────
    _chatDepth++
    if (_chatDepth > MAX_CHAT_DEPTH) {
        _chatDepth--
        console.error(`[Flint] _dispatchChat recursion limit (${MAX_CHAT_DEPTH}) reached — aborting`)
        set({ isThinking: false, activeStatus: '', _abortController: null })
        return
    }

    const controller = new AbortController()
    set({ isThinking: true, streamBuffer: '', activeStatus: 'Contacting API...', _abortController: controller })

    // Ensure lazy editorStore cache is populated for snapshot capture
    if (!_cachedEditorStore) {
        try {
            const { useEditorStore } = await import('./editorStore')
            _cachedEditorStore = useEditorStore
        } catch { /* not critical — snapshots will be undefined */ }
    }

    window.flintAPI.ai.removeChunkListener() // TODO: extract to service layer

    // ── Phase M: Collect read-only tool calls during streaming ────────────────
    // Deduplicates by toolUseId (backend emits tool_call at content_block_start
    // AND message_stop — we only process each ID once).
    const pendingReadOnly: PendingReadOnlyTool[] = []
    const seenToolIds = new Set<string>()

    window.flintAPI.ai.onChunk((chunk) => {
        if (controller.signal.aborted) return
        const store = get()
        if (chunk.type === 'text' && chunk.text) {
            store._appendTextDelta(chunk.text)
            set({ activeStatus: 'Generating response...' })
        } else if (chunk.type === 'tool_call') {
            const toolName = chunk.toolName ?? ''
            const toolUseId = chunk.toolUseId ?? ''

            // Deduplicate: skip if we've already seen this tool_use ID
            if (seenToolIds.has(toolUseId)) return
            seenToolIds.add(toolUseId)

            if (READ_ONLY_TOOLS.has(toolName)) {
                // ── Phase M: Queue read-only tool for auto-execution on 'done' ──
                set({ activeStatus: `Reading: ${toolName}...` })
                pendingReadOnly.push({ toolName, toolUseId, toolInput: chunk.toolInput ?? {} })
            } else if (chunk.toolInput && Object.keys(chunk.toolInput).length > 0) {
                // Mutation tool — queue for user approval
                // Capture rawCode snapshot for DiffCard before/after comparison.
                // Uses _cachedEditorStore (lazy-loaded) to avoid module-level import.
                set({ activeStatus: `Preparing tool: ${toolName}` })
                store._flushAssistantTurn()
                const MUTATION_TOOL_NAMES_SET = new Set([
                    'flint_update_props', 'flint_update_text', 'flint_insert_node',
                    'flint_wrap_node', 'flint_delete_node', 'flint_add_class', 'flint_remove_class',
                ])
                let snapshot: string | undefined
                if (MUTATION_TOOL_NAMES_SET.has(toolName) && _cachedEditorStore) {
                    snapshot = _cachedEditorStore.getState().rawCode ?? undefined
                }
                store._addToolCallMessage(toolName, toolUseId, chunk.toolInput ?? {}, snapshot)
            }
        } else if (chunk.type === 'validation_error') {
            // ── Phase M Commandment 16: Invisible AI Recovery Loop ────────────
            // A tool call failed in-memory validation. Feed the error back to
            // the AI as a tool_result so it can correct itself without the user
            // ever seeing a broken diff card.
            console.warn(`[Flint] Invisible recovery: ${chunk.toolName} validation failed: ${chunk.error}`)
            store._flushAssistantTurn()
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
            void _dispatchChat(get, set)

        } else if (chunk.type === 'done') {
            store._flushAssistantTurn()
            window.flintAPI.ai.removeChunkListener()

            if (pendingReadOnly.length > 0) {
                // ── Phase M: Auto-execute read-only tools, then re-prompt ─────
                void (async () => {
                    const ctx = await _getReadOnlyToolContext()
                    for (const tool of pendingReadOnly) {
                        set({ activeStatus: `Executing: ${tool.toolName}...` })
                        try {
                            const result = await executeReadOnlyTool(tool.toolName, tool.toolInput, ctx)
                            const toolData: PendingToolCall = {
                                id: tool.toolUseId,
                                toolName: tool.toolName,
                                input: tool.toolInput,
                                status: 'approved',
                                result,
                            }
                            // Inject tool_call + tool_result pair into history
                            const currentMessages = get().messages
                            set({
                                messages: [
                                    ...currentMessages,
                                    {
                                        id: uid(),
                                        role: 'tool_call' as MessageRole,
                                        content: tool.toolName,
                                        toolData,
                                        timestamp: Date.now(),
                                    },
                                    {
                                        id: uid(),
                                        role: 'tool_result' as MessageRole,
                                        content: result,
                                        toolData,
                                        timestamp: Date.now(),
                                    },
                                ],
                            })
                        } catch (err) {
                            const errMsg = err instanceof Error ? err.message : String(err)
                            console.error(`[Flint] Read-only tool ${tool.toolName} failed:`, errMsg)
                            const currentMessages = get().messages
                            set({
                                messages: [
                                    ...currentMessages,
                                    {
                                        id: uid(),
                                        role: 'tool_result' as MessageRole,
                                        content: `Error reading ${tool.toolName}: ${errMsg}`,
                                        toolData: { id: tool.toolUseId, toolName: tool.toolName, input: tool.toolInput, status: 'approved' },
                                        timestamp: Date.now(),
                                    },
                                ],
                            })
                        }
                    }
                    // Re-dispatch to continue the LLM conversation with tool results
                    await _dispatchChat(get, set)
                })()
            } else {
                store._finishStream()
            }
        } else if (chunk.type === 'error') {
            store._flushAssistantTurn()
            store._addErrorMessage(chunk.error ?? 'Unknown error')
            store._finishStream()
            window.flintAPI.ai.removeChunkListener()
        }
    })

    const apiMessages = buildApiMessages(get().messages)
    try {
        await window.flintAPI.ai.chat(apiMessages, {}) // TODO: extract to service layer
    } finally {
        _chatDepth--
    }
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
        const cfg = await window.flintAPI.ai.getConfig() // TODO: extract to service layer
        set({ hasConfig: cfg.hasKey, currentProvider: cfg.provider, currentModel: cfg.model, currentBaseURL: cfg.baseURL })
    },

    saveApiKey: async (key: string) => {
        await window.flintAPI.ai.saveConfig({ apiKey: key, provider: 'anthropic' }) // TODO: extract to service layer
        set({ hasConfig: true })
    },

    saveSettings: async (settings: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey?: string; model?: string; baseURL?: string }) => {
        await window.flintAPI.ai.saveConfig(settings) // TODO: extract to service layer
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
        set((s) => ({ messages: trimMessages([...s.messages, userMsg]) }))
        await _dispatchChat(get, set)
    },

    stopGeneration: () => {
        const { _abortController } = get()
        if (_abortController) {
            _abortController.abort()
        }
        window.flintAPI.ai.removeChunkListener()
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
        window.flintAPI.ai.removeChunkListener()
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
            'flint_update_props', 'flint_update_text', 'flint_insert_node',
            'flint_wrap_node', 'flint_delete_node', 'flint_add_class', 'flint_remove_class'
        ])

        if (MUTATION_TOOLS.has(call.toolName)) {
            const input = call.input
            let mutations: unknown[] = []

            switch (call.toolName) {
                case 'flint_update_props': {
                    const props = (input.props as Record<string, string>) ?? {}
                    mutations = Object.entries(props).map(([propName, value]) => ({
                        op: 'updateProp',
                        nodeId: input.targetId,
                        propName,
                        value,
                    }))
                    break
                }
                case 'flint_update_text':
                    mutations = [{ op: 'updateTextContent', nodeId: input.targetId, text: input.text }]
                    break
                case 'flint_insert_node':
                    mutations = [{
                        op: 'injectComponent',
                        targetNodeId: input.targetId,
                        jsxSnippet: `<${input.nodeType}${input.children ? `>${input.children}</${input.nodeType}>` : ' /'}>`
                    }]
                    break
                case 'flint_wrap_node':
                    mutations = [{ op: 'wrapNode', nodeId: input.targetId, wrapperElement: input.wrapperType }]
                    break
                case 'flint_delete_node':
                    mutations = [{ op: 'deleteNode', nodeId: input.targetId }]
                    break
                case 'flint_add_class': {
                    // Read current className, append new class via updateClassName
                    mutations = [{ op: 'addClassName', nodeId: input.targetId, className: input.className }]
                    break
                }
                case 'flint_remove_class':
                    mutations = [{ op: 'removeClassName', nodeId: input.targetId, className: input.className }]
                    break
            }

            if (mutations.length > 0) {
                await window.flintAPI.applyBatch(mutations) // TODO: extract to service layer
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

    _addToolCallMessage: (toolName: string, toolUseId: string, input: Record<string, unknown>, beforeSnapshot?: string) => {
        const call: PendingToolCall = {
            id: toolUseId,
            toolName,
            input,
            status: 'pending',
            beforeSnapshot,
        }
        set((s) => ({
            pendingToolCalls: [...s.pendingToolCalls, call],
            messages: trimMessages([
                ...s.messages,
                {
                    id: uid(),
                    role: 'tool_call' as MessageRole,
                    content: toolName,
                    toolData: call,
                    timestamp: Date.now(),
                },
            ]),
        }))
    },

    _finishStream: () => {
        set({ isThinking: false, activeStatus: '', _abortController: null })
    },

    _addErrorMessage: (text: string) => {
        set((s) => ({
            messages: trimMessages([
                ...s.messages,
                {
                    id: uid(),
                    role: 'error' as MessageRole,
                    content: text,
                    timestamp: Date.now(),
                },
            ]),
            isThinking: false,
            activeStatus: '',
            _abortController: null,
        }))
    },
}))
