/**
 * TokenManager — src/components/ui/TokenManager.tsx
 *
 * Read-only governance palette for viewing design tokens.
 * Token values are managed through your design system via MCP tools
 * (flint_approve_tokens, flint_sync_tokens) — not directly in this UI.
 *
 * Visual rendering per token_type:
 *   color     — filled circle swatch derived from token_value
 *   dimension — proportional bar (width capped at 64px)
 *   string    — value rendered with fontFamily: token_value applied
 *   boolean   — pill badge (true / false)
 *
 * Interactions:
 *   • Token values are read-only (hover shows governance tooltip)
 *   • Import JSON → modal for pasting W3C DTCG JSON
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Upload, X, Search, Palette } from 'lucide-react'
import { useTokenStore } from '../../store/tokenStore'
import type { DesignToken, TokenType, FigmaStatus } from '../../types/flint-api'
import { FocusTrap } from './FocusTrap'

// (Validation helpers removed — token values are read-only in this UI)

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

// ── S7.2: Sync badge types ───────────────────────────────────────────────────

export type SyncBadgeStatus = 'synced' | 'local-only' | 'drifted' | 'figma-only'

const SYNC_BADGE_STYLES: Record<SyncBadgeStatus, string> = {
    'synced': 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    'local-only': 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
    'drifted': 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    'figma-only': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
}

const SYNC_BADGE_LABELS: Record<SyncBadgeStatus, string> = {
    'synced': 'Synced',
    'local-only': 'Local only',
    'drifted': 'Drifted',
    'figma-only': 'Figma only',
}

function SyncBadge({ status }: { status: SyncBadgeStatus }) {
    return (
        <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${SYNC_BADGE_STYLES[status]}`}
            data-testid="sync-badge"
        >
            {SYNC_BADGE_LABELS[status]}
        </span>
    )
}

interface TokenRowProps {
    token: DesignToken
    syncStatus?: SyncBadgeStatus | null
}

/** Read-only token row. Values are managed via MCP tools (flint_approve_tokens, flint_sync_tokens). */
function TokenRow({ token, syncStatus }: TokenRowProps) {
    return (
        <div className="flex items-center gap-2 border-b border-zinc-800/40 px-3 py-1.5 hover:bg-zinc-800/30">
            {/* Type-specific visual indicator */}
            {token.token_type === 'color' && <ColorSwatch value={token.token_value} />}
            {token.token_type === 'dimension' && <DimensionBar value={token.token_value} />}

            {/* Path + value */}
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px] text-zinc-500" title={token.token_path}>
                    {token.token_path}
                </p>
                {/* Read-only value — tooltip explains how to edit */}
                <p
                    className="mt-0.5 truncate font-mono text-[11px] text-zinc-300"
                    title="Token values are managed through your design system. Use Envoy sync to update."
                    style={
                        token.token_type === 'string'
                            ? { fontFamily: token.token_value }
                            : undefined
                    }
                >
                    {token.token_value}
                </p>
            </div>

            {/* S7.2: Sync badge — only when Figma is connected */}
            {syncStatus && <SyncBadge status={syncStatus} />}

            {/* Mode badge — only when non-default */}
            {token.mode !== 'default' && (
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase text-zinc-400 ring-1 ring-zinc-700">
                    {token.mode}
                </span>
            )}
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
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-8"
            onClick={onClose}
        >
            <FocusTrap>
            {/* Modal */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-modal-title"
                className="mx-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <span id="import-modal-title" className="text-sm font-semibold text-zinc-200">Import Token File (JSON)</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
                    {/* Collection name */}
                    <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            Collection name
                        </label>
                        <input
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    {/* JSON textarea */}
                    <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            Paste W3C Token File (JSON)
                        </label>
                        <textarea
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                            rows={8}
                            spellCheck={false}
                            placeholder={'{\n  "color": {\n    "brand": {\n      "primary": { "$value": "#0066FF", "$type": "color" }\n    }\n  }\n}'}
                            className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-2 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:border-indigo-500 focus:outline-none"
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
                            className="flex-1 rounded border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
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
            </FocusTrap>
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
    const { tokens, isLoading, error, fetchTokens, importTokensJSON } =
        useTokenStore()

    // Search
    const [searchQuery, setSearchQuery] = useState('')

    // Import modal
    const [showImport, setShowImport] = useState(false)

    // S7.2: Figma connection state + figma tokens for sync badges
    const [figmaConnected, setFigmaConnected] = useState(false)
    const [figmaTokens, setFigmaTokens] = useState<Map<string, string>>(new Map())

    const fetchFigmaState = useCallback(() => {
        window.flintAPI.figma?.status()
            .then((status: FigmaStatus) => {
                const connected = status.running && (status.tokenCount ?? 0) > 0
                setFigmaConnected(connected)
                if (connected) {
                    // Read figma-tokens.json via MCP readResource
                    window.flintAPI.mcp?.readResource?.('flint://tokens')
                        .then((text) => {
                            try {
                                const data = typeof text === 'string' ? JSON.parse(text) : text
                                const map = new Map<string, string>()
                                // Parse flat token map or nested DTCG structure
                                if (data && typeof data === 'object') {
                                    const entries = Array.isArray(data) ? data : Object.entries(data)
                                    for (const entry of entries) {
                                        if (Array.isArray(entry)) {
                                            const [key, val] = entry
                                            map.set(String(key), typeof val === 'object' && val?.$value ? String(val.$value) : String(val))
                                        } else if (entry && typeof entry === 'object' && entry.token_path) {
                                            map.set(String(entry.token_path), String(entry.token_value ?? ''))
                                        }
                                    }
                                }
                                setFigmaTokens(map)
                            } catch { /* parse error — ignore */ }
                        })
                        .catch(() => { /* MCP not available */ })
                }
            })
            .catch(() => setFigmaConnected(false))
    }, [])

    useEffect(() => {
        fetchTokens().catch(console.error)
        fetchFigmaState()
    }, [fetchTokens, fetchFigmaState])

    // S7.2: Compute sync status for each token
    const getSyncStatus = useCallback((token: DesignToken): SyncBadgeStatus | null => {
        if (!figmaConnected || figmaTokens.size === 0) return null
        const figmaValue = figmaTokens.get(token.token_path)
        if (figmaValue === undefined) return 'local-only'
        if (figmaValue === token.token_value) return 'synced'
        return 'drifted'
    }, [figmaConnected, figmaTokens])

    // Search-filtered token list
    const filteredTokens = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return tokens
        return tokens.filter(
            (t) =>
                t.token_path.toLowerCase().includes(q) ||
                t.token_value.toLowerCase().includes(q) ||
                t.token_type.toLowerCase().includes(q)
        )
    }, [tokens, searchQuery])

    // Group: collection_name → token_type → tokens[]
    const grouped = useMemo(() => {
        const map = new Map<string, Map<TokenType, DesignToken[]>>()
        for (const token of filteredTokens) {
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
    }, [filteredTokens])

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="relative flex h-full flex-col text-zinc-300">
            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-indigo-500 hover:text-indigo-300"
                    >
                        <Upload className="h-3 w-3" />
                        Import JSON
                    </button>
                </div>
            </div>

            {/* ── Search bar ───────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800/60 px-3 py-1.5">
                <Search size={10} className="shrink-0 text-zinc-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, value, or type…"
                    className="flex-1 bg-transparent font-mono text-[11px] text-zinc-300 placeholder-zinc-700 outline-none"
                />
                {searchQuery && (
                    <span className="shrink-0 text-[10px] text-zinc-500">
                        {filteredTokens.length}/{tokens.length}
                    </span>
                )}
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="shrink-0 text-[10px] text-zinc-500 hover:text-zinc-300"
                        title="Clear search"
                    >
                        <X size={10} />
                    </button>
                )}
            </div>

            {/* ── Token list ────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading && (
                    <p className="px-3 py-6 text-center text-xs text-zinc-500">Loading…</p>
                )}

                {!isLoading && tokens.length > 0 && filteredTokens.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <Search className="h-5 w-5 text-zinc-600" />
                        <p className="text-xs text-zinc-500">No tokens match</p>
                        <p className="text-[10px] text-zinc-400">Try a different search term</p>
                    </div>
                )}

                {!isLoading && tokens.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center px-6 py-12 text-center"
                        data-testid="tokens-empty-state"
                    >
                        <Palette className="h-8 w-8 text-zinc-600 mb-3" aria-hidden="true" />
                        <p className="text-sm text-zinc-500 leading-relaxed max-w-[240px]">
                            No design tokens loaded. Connect Figma or import a tokens JSON file.
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowImport(true)}
                            className="mt-4 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-900/20 hover:text-indigo-300"
                        >
                            Import JSON
                        </button>
                    </div>
                )}

                {[...grouped.entries()].map(([collectionName, byType]) => (
                    <div key={collectionName}>
                        {/* Collection header */}
                        <div className="sticky top-0 z-[1] border-b border-zinc-700 bg-zinc-950/95 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                {collectionName}
                            </span>
                        </div>

                        {[...byType.entries()].map(([tokenType, group]) => (
                            <div key={tokenType}>
                                {/* Type sub-header */}
                                <div className="flex items-center gap-1.5 border-b border-zinc-800/60 bg-zinc-900/40 px-3 py-1">
                                    <span
                                        className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_DOT[tokenType] ?? 'bg-zinc-500'}`}
                                    />
                                    <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
                                        {TYPE_LABEL[tokenType] ?? tokenType}
                                    </span>
                                    <span className="ml-auto text-[10px] text-zinc-500">
                                        {group.length}
                                    </span>
                                </div>

                                {/* Token rows */}
                                {group.map((token) => (
                                    <TokenRow
                                        key={token.id}
                                        token={token}
                                        syncStatus={getSyncStatus(token)}
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
