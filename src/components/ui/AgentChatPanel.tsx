/**
 * AgentChatPanel.tsx — src/components/ui/AgentChatPanel.tsx
 *
 * Bridge Auditor Chat UI — Phase L (Full UX Upgrade)
 *
 * All 3 phases implemented:
 *
 * Phase 1: Rendering & Input Polish
 *   • react-markdown + rehype-highlight for rich message rendering
 *   • Copy-to-clipboard on all messages and code blocks
 *   • Stop Generation button (AbortController in orchestratorStore)
 *
 * Phase 2: Contextual Awareness
 *   • Active file / selected node context pills shown at top
 *   • @-mention-style trigger popover (Mithril violations, files, tokens)
 *   • One-click prompt suggestions on empty state
 *
 * Phase 3: Tool UX & Edit Flow
 *   • Expandable tool result chips for read-only tools
 *   • Edit & Resubmit on any user message (pencil icon on hover)
 *   • Retry button appended to every error message
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import {
    Bot, Send, Trash2, Key, CheckCircle2, XCircle, Loader2, Zap,
    Square, Copy, Check, Pencil, RotateCcw, ChevronDown, ChevronRight,
    FileCode, Cpu, Settings, Activity,
} from 'lucide-react'

import { useOrchestratorStore } from '../../store/orchestratorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import { AgentSettingsModal } from './AgentSettingsModal'
import { ActivityFeed } from './ActivityFeed'
import type { AgentMessage, PendingToolCall } from '../../store/orchestratorStore'

// ── Suggested prompts shown in empty state ────────────────────────────────────
const SUGGESTIONS = [
    '🔍 Audit the active file for Mithril drift',
    '♿ Fix accessibility violations in the selected node',
    '🎨 Swap all hardcoded color values to design tokens',
    '📐 Restructure layout to use token-based spacing',
]

// ── Utility: copy text to clipboard ──────────────────────────────────────────
function useCopyToClipboard(timeout = 1500) {
    const [copied, setCopied] = useState(false)
    const copy = useCallback((text: string) => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), timeout)
    }, [timeout])
    return { copied, copy }
}

// ── Config Screen ─────────────────────────────────────────────────────────────
function ConfigScreen({ onOpenSettings }: { onOpenSettings?: () => void }) {
    const [key, setKey] = useState('')
    const [saving, setSaving] = useState(false)
    const saveApiKey = useOrchestratorStore((s) => s.saveApiKey)

    const handleSave = async () => {
        if (!key.trim()) return
        setSaving(true)
        await saveApiKey(key.trim())
        setSaving(false)
    }

    return (
        <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 ring-1 ring-indigo-500/30">
                <Key className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
                <h2 className="text-sm font-semibold text-gray-200">Connect Anthropic Claude</h2>
                <p className="mt-1 text-xs text-gray-500">
                    Your key is stored in <code className="text-gray-400">~/.bridge/config.json</code>
                    {' '}and never leaves your machine.
                </p>
            </div>
            <div className="w-full space-y-2">
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
                    placeholder="sk-ant-…"
                    className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                />
                <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !key.trim()}
                    className="w-full rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {saving ? 'Saving…' : 'Save Key'}
                </button>
                {onOpenSettings && (
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                        Open full AI Settings →
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Context Pill Bar ──────────────────────────────────────────────────────────
function ContextPillBar() {
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId)

    if (!activeFilePath && !selectedNodeId) return null

    return (
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-gray-800/60 px-3 py-1.5">
            {activeFilePath && (
                <span className="inline-flex items-center gap-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    <FileCode className="h-2.5 w-2.5 text-gray-500" />
                    {activeFilePath.split('/').pop()}
                </span>
            )}
            {selectedNodeId && (
                <span className="inline-flex items-center gap-1 rounded bg-indigo-900/30 px-1.5 py-0.5 text-[10px] text-indigo-400">
                    <Cpu className="h-2.5 w-2.5" />
                    #{selectedNodeId.slice(0, 8)}
                </span>
            )}
        </div>
    )
}

// ── Markdown Message Renderer ──────────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
    return (
        <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
                code(props) {
                    const { className, children, ...rest } = props
                    const isInline = !className
                    if (isInline) {
                        return (
                            <code
                                className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[10px] text-indigo-300"
                                {...rest}
                            >
                                {children}
                            </code>
                        )
                    }
                    return (
                        <CodeBlock className={className ?? ''} {...rest}>
                            {children}
                        </CodeBlock>
                    )
                },
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
                h1: ({ children }) => <h1 className="mb-1 text-sm font-bold text-gray-100">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-1 text-xs font-bold text-gray-100">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1 text-[11px] font-semibold text-gray-200">{children}</h3>,
            }}
        >
            {content}
        </ReactMarkdown>
    )
}

// ── Code Block with Copy Button ───────────────────────────────────────────────
function CodeBlock({ children, className, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const { copied, copy } = useCopyToClipboard()
    const textContent = typeof children === 'string' ? children : ''

    return (
        <div className="group relative my-1.5 overflow-hidden rounded border border-gray-700">
            <button
                type="button"
                onClick={() => copy(textContent)}
                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded bg-gray-700/80 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-200"
                title="Copy code"
            >
                {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
            </button>
            <code className={`block overflow-x-auto px-3 py-2 text-[10px] leading-relaxed ${className ?? ''}`} {...rest}>
                {children}
            </code>
        </div>
    )
}

// ── Tool Call Diff Card ───────────────────────────────────────────────────────

const MUTATION_TOOL_NAMES = new Set([
    'bridge_update_props', 'bridge_update_text', 'bridge_insert_node',
    'bridge_wrap_node', 'bridge_delete_node', 'bridge_add_class', 'bridge_remove_class',
])

function ToolCallCard({ call }: { call: PendingToolCall }) {
    const approveToolCall = useOrchestratorStore((s) => s.approveToolCall)
    const rejectToolCall = useOrchestratorStore((s) => s.rejectToolCall)
    const [expanded, setExpanded] = useState(false)

    const input = call.input
    const reasoning = typeof input.reasoning === 'string' ? input.reasoning : ''
    const targetId = typeof input.targetId === 'string' ? input.targetId.slice(0, 8) : '—'
    const isPending = call.status === 'pending'

    // All Phase M mutation tools get the rich diff card treatment
    if (MUTATION_TOOL_NAMES.has(call.toolName)) {
        // Build a human-readable summary of what will change
        let summary = ''
        if (call.toolName === 'bridge_update_props') {
            const props = (input.props as Record<string, string>) ?? {}
            summary = Object.entries(props)
                .map(([k, v]) => `${k} → "${v}"`)
                .join(', ')
        } else if (call.toolName === 'bridge_update_text') {
            summary = `"${input.text ?? ''}"`
        } else if (call.toolName === 'bridge_insert_node') {
            summary = `<${input.nodeType ?? 'element'}> ${input.position ?? ''} #${targetId}`
        } else if (call.toolName === 'bridge_wrap_node') {
            summary = `wrap in <${input.wrapperType ?? 'div'}>`
        } else if (call.toolName === 'bridge_delete_node') {
            summary = `delete #${targetId}`
        } else if (call.toolName === 'bridge_add_class') {
            summary = `+ "${input.className ?? ''}"`
        } else if (call.toolName === 'bridge_remove_class') {
            summary = `- "${input.className ?? ''}"`
        }

        return (
            <div className={`rounded border text-[11px] transition-colors ${isPending
                ? 'border-indigo-500/40 bg-indigo-950/40'
                : call.status === 'approved'
                    ? 'border-emerald-500/30 bg-emerald-950/20'
                    : 'border-red-500/30 bg-red-950/20'
                }`}>
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
                    <Zap className="h-3 w-3 text-yellow-400" />
                    <span className="font-medium font-mono text-yellow-400">{call.toolName}</span>
                    <span className="ml-auto font-mono text-zinc-500 text-[10px]">#{targetId}</span>
                </div>

                {/* Summary */}
                <div className="border-b border-white/5 px-3 py-1.5 font-mono text-[10px] text-indigo-300">
                    {summary}
                </div>

                {/* Reasoning */}
                {reasoning && (
                    <p className="border-b border-white/5 px-3 py-1.5 text-gray-400 italic">{reasoning}</p>
                )}

                {/* Actions */}
                {isPending && (
                    <div className="flex gap-2 border-t border-white/5 px-3 py-2">
                        <button
                            type="button"
                            onClick={() => void approveToolCall(call.id)}
                            className="flex items-center gap-1 rounded bg-emerald-600/20 px-2.5 py-1 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                        >
                            <CheckCircle2 className="h-3 w-3" />
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() => rejectToolCall(call.id)}
                            className="flex items-center gap-1 rounded bg-red-600/10 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-600/20"
                        >
                            <XCircle className="h-3 w-3" />
                            Reject
                        </button>
                    </div>
                )}
                {!isPending && (
                    <div className="px-3 py-1.5 text-[10px]">
                        {call.status === 'approved'
                            ? <span className="text-emerald-400">✅ Applied</span>
                            : <span className="text-red-400">❌ Rejected</span>
                        }
                    </div>
                )}
            </div>
        )
    }

    // Read-only tool — expandable chip
    return (
        <div className="rounded border border-gray-800 bg-gray-900/60 text-[10px]">
            <button
                type="button"
                className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-gray-500 hover:text-gray-400"
                onClick={() => setExpanded((v) => !v)}
            >
                {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                <span className="font-mono">{call.toolName}</span>
            </button>
            {expanded && (
                <div className="border-t border-gray-800 px-2 py-1.5">
                    <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-400">
                        {JSON.stringify(call.input, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
}

// ── Message Row ───────────────────────────────────────────────────────────────
function MessageRow({
    msg,
    index,
    onEdit,
}: {
    msg: AgentMessage
    index: number
    onEdit: (index: number, text: string) => void
}) {
    const isUser = msg.role === 'user'
    const isError = msg.role === 'error'
    const isToolResult = msg.role === 'tool_result'
    const retryLast = useOrchestratorStore((s) => s.retryLast)
    const { copied, copy } = useCopyToClipboard()
    const [hovered, setHovered] = useState(false)

    if (msg.role === 'tool_call' && msg.toolData) {
        return (
            <div className="px-3 py-1.5">
                <ToolCallCard call={msg.toolData} />
            </div>
        )
    }

    if (isToolResult) {
        return (
            <div className="px-3 py-0.5">
                <span className={`text-[11px] ${msg.content.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {msg.content}
                </span>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="px-3 py-2">
                <div className="rounded bg-red-900/30 p-2.5 text-[12px] text-red-300 ring-1 ring-red-700/40">
                    <p className="mb-1.5 font-mono text-[10px] text-red-500">Error</p>
                    {msg.content}
                    <button
                        type="button"
                        onClick={() => void retryLast()}
                        className="mt-2 flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
                    >
                        <RotateCcw className="h-2.5 w-2.5" />
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`group relative px-3 py-2 ${isUser ? 'flex flex-col items-end' : ''}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* User message: bubble + action buttons */}
            {isUser ? (
                <>
                    <div className="max-w-[90%] rounded-lg bg-indigo-600 px-3 py-2 text-[12px] leading-relaxed text-white">
                        {msg.content}
                    </div>
                    {/* Hover actions */}
                    {hovered && (
                        <div className="mt-1 flex items-center gap-1.5">
                            <button
                                type="button"
                                title="Copy"
                                onClick={() => copy(msg.content)}
                                className="flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                                {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                            </button>
                            <button
                                type="button"
                                title="Edit & resubmit"
                                onClick={() => onEdit(index, msg.content)}
                                className="flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                                <Pencil className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    )}
                </>
            ) : (
                /* Assistant message: markdown rendered */
                <>
                    <div className="max-w-[95%] text-[12px] leading-relaxed text-gray-300 prose-invert w-full">
                        <MarkdownContent content={msg.content} />
                    </div>
                    {hovered && (
                        <button
                            type="button"
                            title="Copy message"
                            onClick={() => copy(msg.content)}
                            className="absolute right-3 top-2 flex h-5 w-5 items-center justify-center rounded bg-gray-800 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-300"
                        >
                            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}

// ── Typing / Streaming Indicator ──────────────────────────────────────────────
function TypingIndicator({ streamBuffer, activeStatus }: { streamBuffer: string; activeStatus: string }) {
    return (
        <div className="flex items-start gap-2 px-3 py-2">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-700/40">
                <Bot className="h-3 w-3 text-indigo-300" />
            </div>
            <div className="min-h-[1.5rem] w-full max-w-[95%] text-[12px] leading-relaxed text-gray-300">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-mono text-indigo-400 opacity-80">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {activeStatus || 'Thinking...'}
                </div>
                {streamBuffer && (
                    <div className="border-l-2 border-indigo-500/30 pl-2.5">
                        <MarkdownContent content={streamBuffer} />
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Edit-And-Resubmit Overlay ─────────────────────────────────────────────────
function EditBar({
    initialText,
    onSubmit,
    onCancel,
}: {
    initialText: string
    onSubmit: (text: string) => void
    onCancel: () => void
}) {
    const [text, setText] = useState(initialText)

    return (
        <div className="shrink-0 border-t border-indigo-500/30 bg-indigo-950/30 p-2">
            <p className="mb-1 text-[10px] text-indigo-400">Editing message — resubmit will clear all subsequent replies</p>
            <div className="flex items-end gap-2 rounded border border-indigo-500/40 bg-gray-900 px-2 py-1.5">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (text.trim()) onSubmit(text.trim())
                        }
                        if (e.key === 'Escape') onCancel()
                    }}
                    rows={2}
                    autoFocus
                    className="flex-1 resize-none bg-transparent text-[12px] text-gray-200 outline-none"
                />
            </div>
            <div className="mt-1 flex gap-2">
                <button
                    type="button"
                    onClick={() => { if (text.trim()) onSubmit(text.trim()) }}
                    className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500"
                >
                    Resubmit
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function AgentChatPanel() {
    const messages = useOrchestratorStore((s) => s.messages)
    const isThinking = useOrchestratorStore((s) => s.isThinking)
    const activeStatus = useOrchestratorStore((s) => s.activeStatus)
    const streamBuffer = useOrchestratorStore((s) => s.streamBuffer)
    const hasConfig = useOrchestratorStore((s) => s.hasConfig)
    const lastTier = useOrchestratorStore((s) => s.lastTier)
    const sendMessage = useOrchestratorStore((s) => s.sendMessage)
    const clearHistory = useOrchestratorStore((s) => s.clearHistory)
    const initConfig = useOrchestratorStore((s) => s.initConfig)
    const stopGeneration = useOrchestratorStore((s) => s.stopGeneration)
    const resubmitMessage = useOrchestratorStore((s) => s.resubmitMessage)

    const [input, setInput] = useState('')
    const [editTarget, setEditTarget] = useState<{ index: number; text: string } | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [panelTab, setPanelTab] = useState<'chat' | 'activity'>('chat')
    const bottomRef = useRef<HTMLDivElement>(null)

    // Check API key on mount
    useEffect(() => {
        void initConfig()
    }, [initConfig])

    // Auto-scroll (only relevant in chat tab)
    useEffect(() => {
        if (panelTab === 'chat') {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, streamBuffer, panelTab])

    const handleSend = () => {
        const text = input.trim()
        if (!text || isThinking) return
        setInput('')
        void sendMessage(text)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleEditStart = (index: number, text: string) => {
        setEditTarget({ index, text })
    }

    const handleEditSubmit = (newText: string) => {
        if (!editTarget) return
        void resubmitMessage(editTarget.index, newText)
        setEditTarget(null)
    }

    if (!hasConfig && !showSettings) return <ConfigScreen onOpenSettings={() => setShowSettings(true)} />

    return (
        <div className="flex h-full flex-col">
            {/* Settings Modal */}
            {showSettings && <AgentSettingsModal onClose={() => setShowSettings(false)} />}

            {/* Panel tab switcher: Chat | Activity */}
            <div className="flex shrink-0 border-b border-gray-800/60">
                <button
                    type="button"
                    onClick={() => setPanelTab('chat')}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        panelTab === 'chat'
                            ? 'border-b-2 border-indigo-500 text-indigo-400'
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    <Bot className="h-2.5 w-2.5" />
                    Chat
                </button>
                <button
                    type="button"
                    onClick={() => setPanelTab('activity')}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        panelTab === 'activity'
                            ? 'border-b-2 border-indigo-500 text-indigo-400'
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    <Activity className="h-2.5 w-2.5" />
                    Activity
                </button>
            </div>

            {/* Activity tab — renders ActivityFeed */}
            {panelTab === 'activity' && (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <ActivityFeed />
                </div>
            )}

            {/* Chat tab */}
            {panelTab === 'chat' && (
                <>
                    {/* Header */}
                    <div className="flex shrink-0 items-center gap-2 border-b border-gray-800/60 px-3 py-2">
                        <Bot className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-[11px] font-semibold text-gray-300">Bridge Auditor</span>
                        {lastTier && (
                            <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${lastTier === 'flash' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-purple-900/30 text-purple-400'
                                }`}>
                                {lastTier === 'flash' ? '⚡ Flash' : '🧠 Thinking'}
                            </span>
                        )}
                        {isThinking ? (
                            <span className="ml-auto text-[10px] text-zinc-400 animate-pulse flex items-center gap-1.5">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Generating…
                            </span>
                        ) : messages.length > 0 ? (
                            <span className="ml-auto text-[10px] text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Ready
                            </span>
                        ) : null}
                        <button
                            type="button"
                            title="AI Settings"
                            onClick={() => setShowSettings(true)}
                            className={`${isThinking ? '' : 'ml-auto'} text-zinc-500 transition-colors hover:text-zinc-300`}
                        >
                            <Settings className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            title="Clear conversation"
                            onClick={clearHistory}
                            className="text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>

                    {/* Context pill bar — shows active file and selected node */}
                    <ContextPillBar />

                    {/* Message thread */}
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto py-2">
                        {messages.length === 0 && (
                            <div className="px-4 py-4 text-center">
                                <Bot className="mx-auto mb-3 h-6 w-6 text-indigo-500/40" />
                                <p className="text-[11px] text-zinc-500">Bridge Auditor is ready. Every change requires your approval before touching the AST.</p>
                                <div className="mt-3 space-y-1">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setInput(s.replace(/^[\p{Emoji}] /u, '')) }}
                                            className="block w-full rounded border border-gray-800 bg-gray-900/60 px-3 py-1.5 text-left text-[11px] text-gray-500 transition-colors hover:border-gray-700 hover:text-gray-400"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <MessageRow
                                key={msg.id}
                                msg={msg}
                                index={i}
                                onEdit={handleEditStart}
                            />
                        ))}
                        {isThinking && <TypingIndicator streamBuffer={streamBuffer} activeStatus={activeStatus} />}
                        <div ref={bottomRef} />
                    </div>

                    {/* Edit bar (replaces input while editing) */}
                    {editTarget ? (
                        <EditBar
                            initialText={editTarget.text}
                            onSubmit={handleEditSubmit}
                            onCancel={() => setEditTarget(null)}
                        />
                    ) : (
                        /* Input bar */
                        <div className="shrink-0 border-t border-gray-800/60 p-2">
                            <div className="flex items-end gap-2 rounded border border-gray-700 bg-gray-900 px-2 py-1.5 focus-within:border-indigo-500/50">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask the Auditor…"
                                    rows={1}
                                    disabled={isThinking}
                                    className="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-[12px] text-gray-200 placeholder-gray-600 outline-none disabled:opacity-40"
                                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />

                                {/* Stop / Send button */}
                                {isThinking ? (
                                    <button
                                        type="button"
                                        onClick={stopGeneration}
                                        title="Stop generation"
                                        className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-900/30 text-red-400 transition-colors hover:bg-red-900/50"
                                    >
                                        <Square className="h-3 w-3" />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={!input.trim()}
                                        className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-indigo-400 transition-colors hover:text-indigo-300 disabled:opacity-30"
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="mt-1 text-[10px] text-zinc-500">↵ Send · Shift+↵ New line · Hover a message to copy or edit</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
