/**
 * TokenManager — src/components/ui/TokenManager.tsx
 *
 * Design-tool-style palette for viewing and editing design tokens.
 *
 * Visual rendering per token_type:
 *   color     — filled circle swatch derived from token_value
 *   dimension — proportional bar (width capped at 64px)
 *   string    — value rendered with fontFamily: token_value applied
 *   boolean   — pill badge (true / false)
 *
 * Interactions:
 *   • Click any value  → inline input (Draft Mode); blur/Enter commits
 *   • Trash icon       → delete (visible on row hover)
 *   • Import JSON      → modal for pasting W3C DTCG JSON
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { Upload, Trash2, X } from 'lucide-react'
import { useTokenStore } from '../../store/tokenStore'
import type { DesignToken, TokenType } from '../../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extracts the leading numeric value from a CSS dimension string. */
function parseDimensionNumber(value: string): number {
    const m = /^(\d+(?:\.\d+)?)/.exec(value)
    return m ? parseFloat(m[1]) : 0
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColorSwatch({ value }: { value: string }) {
    return (
        <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: value }}
        />
    )
}

function DimensionBar({ value }: { value: string }) {
    const num = parseDimensionNumber(value)
    // Clamp: 2px minimum visible width, 64px maximum
    const barWidth = Math.max(2, Math.min(num, 64))
    return (
        <span
            className="inline-block h-1.5 shrink-0 rounded-full bg-blue-400/50"
            style={{ width: barWidth }}
        />
    )
}

interface TokenRowProps {
    token: DesignToken
    onEdit: (id: number, path: string, currentValue: string) => void
    onDelete: (id: number) => void
    editingId: number | null
    draftValue: string
    onDraftChange: (v: string) => void
    onCommit: () => void
}

function TokenRow({
    token,
    onEdit,
    onDelete,
    editingId,
    draftValue,
    onDraftChange,
    onCommit,
}: TokenRowProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const isEditing = editingId === token.id

    useEffect(() => {
        if (isEditing) inputRef.current?.focus()
    }, [isEditing])

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
            // Discard draft
            onEdit(-1, '', '')
        }
    }

    return (
        <div className="group flex items-center gap-2 border-b border-gray-800/40 px-3 py-1.5 hover:bg-gray-800/30">
            {/* Type-specific visual indicator */}
            {token.token_type === 'color' && <ColorSwatch value={token.token_value} />}
            {token.token_type === 'dimension' && <DimensionBar value={token.token_value} />}

            {/* Path + value */}
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px] text-gray-500" title={token.token_path}>
                    {token.token_path}
                </p>

                {isEditing ? (
                    <input
                        ref={inputRef}
                        value={draftValue}
                        onChange={(e) => onDraftChange(e.target.value)}
                        onBlur={onCommit}
                        onKeyDown={handleKeyDown}
                        className="mt-0.5 w-full rounded border border-indigo-500 bg-gray-900 px-1 py-0.5 font-mono text-[11px] text-gray-200 outline-none"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => onEdit(token.id, token.token_path, token.token_value)}
                        className="mt-0.5 w-full truncate text-left font-mono text-[11px] text-gray-300 hover:text-indigo-300"
                        title="Click to edit"
                        style={
                            token.token_type === 'string'
                                ? { fontFamily: token.token_value }
                                : undefined
                        }
                    >
                        {token.token_value}
                    </button>
                )}
            </div>

            {/* Mode badge — only when non-default */}
            {token.mode !== 'default' && (
                <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase text-gray-600 ring-1 ring-gray-700">
                    {token.mode}
                </span>
            )}

            {/* Delete — visible on row hover */}
            <button
                type="button"
                onClick={() => onDelete(token.id)}
                className="shrink-0 rounded p-0.5 text-gray-700 opacity-0 transition-opacity hover:bg-red-900/40 hover:text-red-400 group-hover:opacity-100"
                title={`Delete ${token.token_path}`}
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    )
}

// ── Import Modal ──────────────────────────────────────────────────────────────

interface ImportModalProps {
    onClose: () => void
    onImport: (json: string, collectionName: string) => Promise<void>
    isLoading: boolean
    error: string | null
}

function ImportModal({ onClose, onImport, isLoading, error }: ImportModalProps) {
    const [json, setJson] = useState('')
    const [collectionName, setCollectionName] = useState('Imported')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!json.trim()) return
        await onImport(json, collectionName)
        if (!error) onClose()
    }

    return (
        /* Backdrop */
        <div
            className="absolute inset-0 z-10 flex items-start justify-center bg-black/70 pt-8"
            onClick={onClose}
        >
            {/* Modal */}
            <div
                className="mx-2 w-full rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                    <span className="text-sm font-semibold text-gray-200">Import DTCG JSON</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
                    {/* Collection name */}
                    <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                            Collection name
                        </label>
                        <input
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    {/* JSON textarea */}
                    <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">
                            Paste W3C DTCG JSON
                        </label>
                        <textarea
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                            rows={8}
                            spellCheck={false}
                            placeholder={'{\n  "color": {\n    "brand": {\n      "primary": { "$value": "#0066FF", "$type": "color" }\n    }\n  }\n}'}
                            className="w-full resize-none rounded border border-gray-700 bg-gray-800 px-2 py-2 font-mono text-[11px] text-gray-200 placeholder:text-gray-700 focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    {error && (
                        <p className="rounded bg-red-900/30 px-2 py-1.5 text-[11px] text-red-400">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded border border-gray-700 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!json.trim() || isLoading}
                            className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {isLoading ? 'Importing…' : 'Import'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Type section header ───────────────────────────────────────────────────────

const TYPE_LABEL: Record<TokenType, string> = {
    color: 'Color',
    dimension: 'Dimension',
    fontFamily: 'Font Family',
    fontWeight: 'Font Weight',
    lineHeight: 'Line Height',
    letterSpacing: 'Letter Spacing',
    shadow: 'Shadow',
    opacity: 'Opacity',
    string: 'String',
    boolean: 'Boolean',
}

const TYPE_DOT: Record<TokenType, string> = {
    color: 'bg-purple-400',
    dimension: 'bg-blue-400',
    fontFamily: 'bg-amber-400',
    fontWeight: 'bg-amber-400',
    lineHeight: 'bg-amber-400',
    letterSpacing: 'bg-amber-400',
    shadow: 'bg-indigo-400',
    opacity: 'bg-indigo-400',
    string: 'bg-emerald-400',
    boolean: 'bg-amber-400',
}

// ── Main component ────────────────────────────────────────────────────────────

export function TokenManager() {
    const { tokens, isLoading, error, fetchTokens, updateToken, deleteToken, importTokensJSON, clearAllTokens } =
        useTokenStore()

    // Inline-edit state
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingPath, setEditingPath] = useState<string>('')
    const [draftValue, setDraftValue] = useState<string>('')

    // Import modal
    const [showImport, setShowImport] = useState(false)

    // Clear-all two-step confirm
    const [confirmingClear, setConfirmingClear] = useState(false)
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        fetchTokens().catch(console.error)
    }, [fetchTokens])

    // Cancel the auto-reset timer on unmount
    useEffect(() => {
        return () => {
            if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current)
        }
    }, [])

    // Group: collection_name → token_type → tokens[]
    const grouped = useMemo(() => {
        const map = new Map<string, Map<TokenType, DesignToken[]>>()
        for (const token of tokens) {
            if (!map.has(token.collection_name)) {
                map.set(token.collection_name, new Map())
            }
            const byType = map.get(token.collection_name)!
            if (!byType.has(token.token_type)) {
                byType.set(token.token_type, [])
            }
            byType.get(token.token_type)!.push(token)
        }
        return map
    }, [tokens])

    function startEdit(id: number, path: string, currentValue: string) {
        // id = -1 signals a discard (from Escape key)
        if (id === -1) {
            setEditingId(null)
            return
        }
        setEditingId(id)
        setEditingPath(path)
        setDraftValue(currentValue)
    }

    function handleClearAll(): void {
        if (!confirmingClear) {
            // First click — arm the confirm state and auto-reset after 2.5 s
            setConfirmingClear(true)
            clearTimerRef.current = setTimeout(() => setConfirmingClear(false), 2500)
            return
        }
        // Second click — execute
        if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current)
        setConfirmingClear(false)
        clearAllTokens().catch(console.error)
    }

    function commitEdit() {
        if (editingId === null) return
        // Find the original value to avoid a no-op IPC call
        const original = tokens.find((t) => t.id === editingId)
        if (original && draftValue !== original.token_value) {
            updateToken(editingPath, draftValue).catch(console.error)
        }
        setEditingId(null)
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="relative flex h-full flex-col text-gray-300">
            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-800 px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
                    {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                    {tokens.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${confirmingClear
                                    ? 'border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/50'
                                    : 'border-gray-700 bg-gray-800/40 text-gray-600 hover:border-red-700/60 hover:text-red-500'
                                }`}
                            title="Delete all design tokens"
                        >
                            <Trash2 className="h-3 w-3" />
                            {confirmingClear ? 'Confirm?' : 'Clear all'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-1.5 rounded border border-gray-700 bg-gray-800/60 px-2 py-1 text-[11px] text-gray-400 transition-colors hover:border-indigo-500 hover:text-indigo-300"
                    >
                        <Upload className="h-3 w-3" />
                        Import JSON
                    </button>
                </div>
            </div>

            {/* ── Token list ────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading && (
                    <p className="px-3 py-6 text-center text-xs text-gray-600">Loading…</p>
                )}

                {!isLoading && tokens.length === 0 && (
                    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                        <Upload className="h-6 w-6 text-gray-700" />
                        <p className="text-xs text-gray-600">
                            No tokens yet.{' '}
                            <button
                                type="button"
                                onClick={() => setShowImport(true)}
                                className="text-indigo-400 hover:underline"
                            >
                                Import DTCG JSON
                            </button>{' '}
                            to get started.
                        </p>
                    </div>
                )}

                {[...grouped.entries()].map(([collectionName, byType]) => (
                    <div key={collectionName}>
                        {/* Collection header */}
                        <div className="sticky top-0 z-[1] border-b border-gray-700 bg-gray-950/95 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                {collectionName}
                            </span>
                        </div>

                        {[...byType.entries()].map(([tokenType, group]) => (
                            <div key={tokenType}>
                                {/* Type sub-header */}
                                <div className="flex items-center gap-1.5 border-b border-gray-800/60 bg-gray-900/40 px-3 py-1">
                                    <span
                                        className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_DOT[tokenType] ?? 'bg-gray-500'}`}
                                    />
                                    <span className="text-[9px] font-medium uppercase tracking-widest text-gray-500">
                                        {TYPE_LABEL[tokenType] ?? tokenType}
                                    </span>
                                    <span className="ml-auto text-[9px] text-gray-700">
                                        {group.length}
                                    </span>
                                </div>

                                {/* Token rows */}
                                {group.map((token) => (
                                    <TokenRow
                                        key={token.id}
                                        token={token}
                                        onEdit={startEdit}
                                        onDelete={deleteToken}
                                        editingId={editingId}
                                        draftValue={draftValue}
                                        onDraftChange={setDraftValue}
                                        onCommit={commitEdit}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Store-level error (shown at bottom so it doesn't push content) */}
                {error && !showImport && (
                    <p className="border-t border-red-900/40 bg-red-900/10 px-3 py-2 text-[11px] text-red-400">
                        {error}
                    </p>
                )}
            </div>

            {/* ── Import Modal ─────────────────────────────────────────────── */}
            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onImport={importTokensJSON}
                    isLoading={isLoading}
                    error={error}
                />
            )}
        </div>
    )
}
