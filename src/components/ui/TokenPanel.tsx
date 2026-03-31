/**
 * TokenPanel — src/components/ui/TokenPanel.tsx
 *
 * Governance-aware token observability surface (Wave 3 / MINT).
 * Replaces the flat TokenManager list with type-specific visual rendering.
 *
 * Features:
 *   MINT.1a — TokenHealthBar (count by type, last sync, Figma status)
 *   MINT.1b — Visual token grid (ColorGrid, TypographySpecimen, SpacingRuler)
 *   MINT.1c — Mode columns toggle (group tokens by mode side-by-side)
 *   MINT.1e — A11y fixes (labels, h3 headers, focus-visible delete, roles)
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useMemo } from 'react'
import { Upload, X, Search, Palette, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useTokenStore } from '../../store/tokenStore'
import type { DesignToken, TokenType } from '../../types/flint-api'
import { FocusTrap } from './FocusTrap'
import { ColorGrid } from './token/ColorGrid'
import { TypographySpecimen } from './token/TypographySpecimen'
import { SpacingRuler } from './token/SpacingRuler'
import { ModeColumns } from './token/ModeColumns'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime()
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''} ago`
}

// ── TokenHealthBar ─────────────────────────────────────────────────────────────

interface SyncSummary {
    lastSyncAt: string | null
    tokenCount: number
}

interface TokenHealthBarProps {
    tokens: DesignToken[]
}

function TokenHealthBar({ tokens }: TokenHealthBarProps) {
    const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
    const [figmaRunning, setFigmaRunning] = useState(false)

    useEffect(() => {
        // getSyncSummary is wired by Agent C — handle gracefully if not yet available
        const api = window.flintAPI as any
        if (typeof api?.tokens?.getSyncSummary === 'function') {
            api.tokens.getSyncSummary()
                .then((s: SyncSummary) => setSyncSummary(s))
                .catch(() => { /* not wired yet — silent */ })
        }

        // Figma connection status via existing figma.status IPC
        window.flintAPI.figma.status()
            .then((s) => setFigmaRunning(s.running))
            .catch(() => { /* best-effort */ })
    }, [tokens.length])

    // Count tokens by category
    const colorCount = tokens.filter((t) => t.token_type === 'color').length
    const dimensionCount = tokens.filter(
        (t) => t.token_type === 'dimension' || t.token_type === 'opacity'
    ).length
    const typographyCount = tokens.filter(
        (t) =>
            t.token_type === 'fontFamily' ||
            t.token_type === 'fontWeight' ||
            t.token_type === 'lineHeight' ||
            t.token_type === 'letterSpacing'
    ).length

    const countParts: string[] = []
    if (colorCount > 0) countParts.push(`${colorCount} color${colorCount !== 1 ? 's' : ''}`)
    if (dimensionCount > 0)
        countParts.push(`${dimensionCount} dimension${dimensionCount !== 1 ? 's' : ''}`)
    if (typographyCount > 0)
        countParts.push(`${typographyCount} typography`)

    return (
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2" data-testid="token-health-bar">
            {/* Token type counts */}
            {countParts.length > 0 ? (
                <p className="font-mono text-[10px] text-zinc-400">
                    {countParts.join(' · ')}
                </p>
            ) : (
                <p className="font-mono text-[10px] text-zinc-600">No tokens loaded</p>
            )}

            {/* Sync + Figma status row */}
            <div className="mt-1 flex items-center gap-3">
                {/* Last sync */}
                {syncSummary !== null && (
                    <div className="flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5 text-zinc-500" aria-hidden="true" />
                        <span className="text-[10px] text-zinc-500" data-testid="sync-status">
                            {syncSummary.lastSyncAt
                                ? `Synced ${formatRelativeTime(syncSummary.lastSyncAt)}`
                                : 'Never synced'}
                        </span>
                    </div>
                )}

                {/* Figma connection */}
                <div className="flex items-center gap-1">
                    {figmaRunning ? (
                        <Check className="h-2.5 w-2.5 text-emerald-400" aria-hidden="true" />
                    ) : (
                        <AlertCircle className="h-2.5 w-2.5 text-zinc-600" aria-hidden="true" />
                    )}
                    <span
                        className={`text-[10px] ${figmaRunning ? 'text-emerald-400' : 'text-zinc-600'}`}
                        data-testid="figma-connection-status"
                    >
                        {figmaRunning ? 'Figma connected' : 'Not connected'}
                    </span>
                </div>
            </div>
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
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-8"
            onClick={onClose}
        >
            <FocusTrap>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="import-modal-title"
                    className="mx-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                        <span id="import-modal-title" className="text-sm font-semibold text-zinc-200">
                            Import Token File (JSON)
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close import modal"
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
                        {/* Collection name */}
                        <div>
                            <label
                                htmlFor="token-collection-name"
                                className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                            >
                                Collection name
                            </label>
                            <input
                                id="token-collection-name"
                                value={collectionName}
                                onChange={(e) => setCollectionName(e.target.value)}
                                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>

                        {/* JSON textarea */}
                        <div>
                            <label
                                htmlFor="token-json-input"
                                className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                            >
                                Paste W3C Token File (JSON)
                            </label>
                            <textarea
                                id="token-json-input"
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

// ── Type metadata ─────────────────────────────────────────────────────────────

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
    dimension: 'bg-indigo-400',
    fontFamily: 'bg-amber-400',
    fontWeight: 'bg-amber-400',
    lineHeight: 'bg-amber-400',
    letterSpacing: 'bg-amber-400',
    shadow: 'bg-zinc-400',
    opacity: 'bg-zinc-400',
    string: 'bg-emerald-400',
    boolean: 'bg-amber-400',
}

/** True for token types that use the typography specimen renderer. */
function isTypographyType(type: TokenType): boolean {
    return (
        type === 'fontFamily' ||
        type === 'fontWeight' ||
        type === 'lineHeight' ||
        type === 'letterSpacing'
    )
}

/** True for token types that use the spacing ruler renderer. */
function isSpacingType(type: TokenType): boolean {
    return type === 'dimension' || type === 'opacity'
}

// ── Generic token row (fallback renderer) ─────────────────────────────────────

function GenericTokenRow({ token }: { token: DesignToken }) {
    return (
        <div className="flex items-center gap-2 border-b border-zinc-800/40 px-3 py-1.5">
            <div className="min-w-0 flex-1">
                <p
                    className="truncate font-mono text-[10px] text-zinc-500"
                    title={token.token_path}
                >
                    {token.token_path}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-300">
                    {token.token_value}
                </p>
            </div>
            {/* Type badge */}
            <span className="shrink-0 rounded border border-zinc-700 px-1 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
                {TYPE_LABEL[token.token_type] ?? token.token_type}
            </span>
            {token.mode !== 'default' && (
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase text-zinc-400 ring-1 ring-zinc-700">
                    {token.mode}
                </span>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TokenPanel() {
    const { tokens, isLoading, error, fetchTokens, importTokensJSON } = useTokenStore()

    const [searchQuery, setSearchQuery] = useState('')
    const [showImport, setShowImport] = useState(false)
    const [groupByMode, setGroupByMode] = useState(false)

    useEffect(() => {
        fetchTokens().catch(console.error)
    }, [fetchTokens])

    // Detect whether any token has a non-default mode
    const hasMultipleModes = useMemo(
        () => tokens.some((t) => t.mode !== 'default'),
        [tokens]
    )

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
            {/* ── Health Bar ─────────────────────────────────────────────── */}
            <TokenHealthBar tokens={tokens} />

            {/* ── Toolbar ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-zinc-500" title="Modify tokens via MCP tools">
                    (read-only)
                </span>

                <div className="ml-auto flex items-center gap-1.5">
                    {/* Mode columns toggle — only shown when multiple modes exist */}
                    {hasMultipleModes && (
                        <button
                            type="button"
                            onClick={() => setGroupByMode((v) => !v)}
                            className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                                groupByMode
                                    ? 'border-indigo-500/60 bg-indigo-900/30 text-indigo-300'
                                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-indigo-500/40 hover:text-indigo-300'
                            }`}
                            aria-pressed={groupByMode}
                        >
                            Group by mode
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-indigo-500 hover:text-indigo-300"
                    >
                        <Upload className="h-3 w-3" aria-hidden="true" />
                        Import JSON
                    </button>
                </div>
            </div>

            {/* ── Search bar ──────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800/60 px-3 py-1.5">
                <Search size={10} className="shrink-0 text-zinc-500" aria-hidden="true" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, value, or type…"
                    aria-label="Search tokens"
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
                        aria-label="Clear search"
                        className="shrink-0 text-[10px] text-zinc-500 opacity-100 hover:text-zinc-300 focus:opacity-100"
                    >
                        <X size={10} aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* ── Token list ──────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading && (
                    <p className="px-3 py-6 text-center text-xs text-zinc-500">Loading…</p>
                )}

                {!isLoading && tokens.length > 0 && filteredTokens.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <Search className="h-5 w-5 text-zinc-600" aria-hidden="true" />
                        <p className="text-xs text-zinc-500">No tokens match</p>
                        <p className="text-[10px] text-zinc-400">Try a different search term</p>
                    </div>
                )}

                {!isLoading && tokens.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center px-6 py-12 text-center"
                        data-testid="tokens-empty-state"
                    >
                        <Palette className="mb-3 h-8 w-8 text-zinc-600" aria-hidden="true" />
                        <p className="max-w-[240px] text-sm leading-relaxed text-zinc-500">
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

                {/* Mode columns view */}
                {!isLoading && groupByMode && hasMultipleModes && filteredTokens.length > 0 && (
                    <ModeColumns tokens={filteredTokens} />
                )}

                {/* Grid / list view */}
                {!isLoading && (!groupByMode || !hasMultipleModes) &&
                    [...grouped.entries()].map(([collectionName, byType]) => (
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
                                    <h3 className="flex items-center gap-1.5 border-b border-zinc-800/60 bg-zinc-900/40 px-3 py-1">
                                        <span
                                            className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_DOT[tokenType] ?? 'bg-zinc-500'}`}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
                                            {TYPE_LABEL[tokenType] ?? tokenType}
                                        </span>
                                        <span className="ml-auto text-[10px] text-zinc-500">
                                            {group.length}
                                        </span>
                                    </h3>

                                    {/* Visual renderers per type */}
                                    {tokenType === 'color' && <ColorGrid tokens={group} />}
                                    {isTypographyType(tokenType) && <TypographySpecimen tokens={group} />}
                                    {isSpacingType(tokenType) && <SpacingRuler tokens={group} />}

                                    {/* Fallback for shadow, string, boolean, etc. */}
                                    {tokenType !== 'color' &&
                                        !isTypographyType(tokenType) &&
                                        !isSpacingType(tokenType) &&
                                        group.map((token) => (
                                            <GenericTokenRow key={token.id} token={token} />
                                        ))}
                                </div>
                            ))}
                        </div>
                    ))}

                {/* Store-level error */}
                {error && !showImport && (
                    <p className="border-t border-red-900/40 bg-red-900/10 px-3 py-2 text-[11px] text-red-400">
                        {error}
                    </p>
                )}
            </div>

            {/* ── Import Modal ──────────────────────────────────────────── */}
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
