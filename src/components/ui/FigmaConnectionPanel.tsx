/**
 * FigmaConnectionPanel — src/components/ui/FigmaConnectionPanel.tsx
 *
 * S7.1: Dedicated panel for Figma connection management.
 * Sections:
 *   1. Connection Status — indicator, project name, last sync
 *   2. Sync Actions — Pull / Push buttons
 *   3. Token Mapping — total / synced / drifted / orphaned counts
 *   4. History — last 5 sync operations
 *
 * Reads from window.flintAPI.figma and window.flintAPI.mcp.
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useCallback } from 'react'
import { Download, Upload, RefreshCw, Loader2, Unplug, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import type { FigmaStatus } from '../../types/flint-api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number | null): string {
    if (ts === null) return 'Never'
    const diffMs = Date.now() - ts
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

interface SyncHistoryEntry {
    direction: 'pull' | 'push'
    timestamp: number
    success: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

interface FigmaConnectionPanelProps {
    onClose?: () => void
}

export function FigmaConnectionPanel({ onClose }: FigmaConnectionPanelProps) {
    const push = useNotificationStore((s) => s.push)

    // ── Figma status ─────────────────────────────────────────────────────────
    const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null)
    const [syncOp, setSyncOp] = useState<'pull' | 'push' | null>(null)
    const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([])

    // Token mapping counts (from MCP sync_check)
    const [tokenCounts, setTokenCounts] = useState<{
        total: number
        synced: number
        drifted: number
        orphaned: number
    }>({ total: 0, synced: 0, drifted: 0, orphaned: 0 })

    const fetchStatus = useCallback(() => {
        window.flintAPI.figma?.status()
            .then(setFigmaStatus)
            .catch(() => { /* server may not be ready */ })
    }, [])

    const fetchTokenCounts = useCallback(() => {
        window.flintAPI.mcp?.callTool('flint_sync_check', {})
            .then((result) => {
                if (result?.isError) return
                try {
                    const text = result?.content?.[0]?.text
                    if (text) {
                        const data = JSON.parse(text)
                        setTokenCounts({
                            total: data.totalTokens ?? data.total ?? 0,
                            synced: data.syncedTokens ?? data.synced ?? 0,
                            drifted: data.driftedTokens ?? data.drifted ?? 0,
                            orphaned: data.orphanedTokens ?? data.orphaned ?? 0,
                        })
                    }
                } catch { /* parse error — keep defaults */ }
            })
            .catch(() => { /* MCP not available */ })
    }, [])

    useEffect(() => {
        fetchStatus()
        fetchTokenCounts()
        const id = setInterval(fetchStatus, 5_000)
        return () => clearInterval(id)
    }, [fetchStatus, fetchTokenCounts])

    const isConnected = figmaStatus?.running === true && (figmaStatus?.tokenCount ?? 0) > 0

    // ── Sync handlers ────────────────────────────────────────────────────────
    const handleSync = useCallback(async (direction: 'pull' | 'push') => {
        if (syncOp || !isConnected) return
        setSyncOp(direction)
        const toolName = direction === 'pull' ? 'flint_sync_pull' : 'flint_sync_push'
        let success = false
        try {
            const result = await window.flintAPI.mcp?.callTool(toolName, {})
            const isError = result?.isError === true
            success = !isError
            push({
                type: isError ? 'error' : 'mutation',
                title: isError ? `${direction === 'pull' ? 'Pull' : 'Push'} failed` : `${direction === 'pull' ? 'Pull' : 'Push'} complete`,
                message: isError
                    ? (result?.content?.[0]?.text ?? 'Unknown error.')
                    : direction === 'pull'
                        ? 'Figma tokens pulled to local project.'
                        : 'Local tokens pushed to Figma.',
                severity: isError ? 'error' : 'success',
                autoDismissMs: isError ? 8000 : 4000,
            })
            if (!isError) {
                fetchStatus()
                fetchTokenCounts()
            }
        } catch {
            push({
                type: 'error',
                title: `${direction === 'pull' ? 'Pull' : 'Push'} failed`,
                message: 'Could not reach the governance engine.',
                severity: 'error',
                autoDismissMs: 8000,
            })
        } finally {
            setSyncOp(null)
            setSyncHistory((prev) => [
                { direction, timestamp: Date.now(), success },
                ...prev.slice(0, 4),
            ])
        }
    }, [syncOp, isConnected, push, fetchStatus, fetchTokenCounts])

    // ── Disconnect ───────────────────────────────────────────────────────────
    const handleDisconnect = useCallback(() => {
        if (!window.confirm('Disconnect Figma? You will need to reconnect to sync tokens.')) return
        void window.flintAPI.figma?.disconnect().then(() => {
            fetchStatus()
            push({
                type: 'info',
                title: 'Figma disconnected',
                message: 'Restart to reconnect.',
                severity: 'warning',
                autoDismissMs: 6000,
            })
        })
    }, [fetchStatus, push])

    // ── Status indicator color ───────────────────────────────────────────────
    const statusColor = isConnected ? 'bg-emerald-500' : 'bg-zinc-500'
    const statusLabel = isConnected ? 'Connected' : 'Not connected'

    return (
        <div className="flex h-full flex-col bg-zinc-950 text-zinc-300" data-testid="figma-connection-panel">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-100">Figma Connection</h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        aria-label="Close panel"
                    >
                        &times;
                    </button>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {/* ── 1. Connection Status ─────────────────────────────────────── */}
                <section className="border-b border-zinc-800/60 px-4 py-3">
                    <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Status</h3>
                    <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} data-testid="figma-status-dot" />
                        <span className="text-xs text-zinc-200" data-testid="figma-status-label">{statusLabel}</span>
                    </div>
                    <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                            <dt className="text-zinc-500">Last sync</dt>
                            <dd className="text-zinc-300" data-testid="figma-last-sync">
                                {relativeTime(figmaStatus?.lastWebhookAt ?? null)}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between">
                            <dt className="text-zinc-500">Tokens loaded</dt>
                            <dd className="text-zinc-300">{figmaStatus?.tokenCount ?? 0}</dd>
                        </div>
                    </dl>
                </section>

                {/* MINT.4a: First-sync banner — shown when connected but never synced */}
                {isConnected && figmaStatus?.lastWebhookAt === null && (
                    <section
                        className="border-b border-indigo-800/40 bg-indigo-900/10 px-4 py-3"
                        data-testid="first-sync-banner"
                    >
                        <p className="mb-2 text-xs text-indigo-300">
                            Your Figma tokens haven&apos;t been synced yet. Pull from Figma to bring your design tokens into the project.
                        </p>
                        <button
                            type="button"
                            onClick={() => void handleSync('pull')}
                            disabled={syncOp !== null}
                            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            data-testid="first-sync-pull-btn"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Pull tokens from Figma
                        </button>
                    </section>
                )}

                {/* ── 2. Sync Actions ──────────────────────────────────────────── */}
                <section className="border-b border-zinc-800/60 px-4 py-3">
                    <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sync Actions</h3>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleSync('pull')}
                            disabled={!isConnected || syncOp !== null}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium text-white transition-colors ${
                                !isConnected || syncOp !== null
                                    ? 'cursor-not-allowed bg-indigo-600 opacity-50'
                                    : 'bg-indigo-600 hover:bg-indigo-500'
                            }`}
                            data-testid="figma-panel-pull"
                        >
                            {syncOp === 'pull' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Download className="h-3.5 w-3.5" />
                            )}
                            Pull from Figma
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSync('push')}
                            disabled={!isConnected || syncOp !== null}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium transition-colors ${
                                !isConnected || syncOp !== null
                                    ? 'cursor-not-allowed bg-zinc-700 text-zinc-300 opacity-50'
                                    : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
                            }`}
                            data-testid="figma-panel-push"
                        >
                            {syncOp === 'push' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Upload className="h-3.5 w-3.5" />
                            )}
                            Push to Figma
                        </button>
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={fetchStatus}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleDisconnect}
                            disabled={!isConnected}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-red-700/40 bg-red-900/10 px-2 py-1.5 text-xs text-red-400 transition-colors hover:border-red-600/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Unplug className="h-3 w-3" />
                            Disconnect
                        </button>
                    </div>
                </section>

                {/* ── 3. Token Mapping ─────────────────────────────────────────── */}
                <section className="border-b border-zinc-800/60 px-4 py-3">
                    <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Token Mapping</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                            <p className="text-lg font-semibold text-zinc-100" data-testid="token-total">{tokenCounts.total}</p>
                            <p className="text-[10px] text-zinc-500">Total</p>
                        </div>
                        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                            <p className="text-lg font-semibold text-emerald-400" data-testid="token-synced">{tokenCounts.synced}</p>
                            <p className="text-[10px] text-zinc-500">Synced</p>
                        </div>
                        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                            <p className="text-lg font-semibold text-amber-400" data-testid="token-drifted">{tokenCounts.drifted}</p>
                            <p className="text-[10px] text-zinc-500">Drifted</p>
                        </div>
                        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                            <p className="text-lg font-semibold text-blue-400" data-testid="token-orphaned">{tokenCounts.orphaned}</p>
                            <p className="text-[10px] text-zinc-500">Orphaned</p>
                        </div>
                    </div>
                </section>

                {/* ── 4. History ───────────────────────────────────────────────── */}
                <section className="px-4 py-3">
                    <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Recent Sync History</h3>
                    {syncHistory.length === 0 ? (
                        <p className="text-xs text-zinc-600">No sync operations this session.</p>
                    ) : (
                        <ul className="space-y-1">
                            {syncHistory.map((entry, i) => (
                                <li key={i} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs">
                                    {entry.success ? (
                                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                                    ) : (
                                        <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
                                    )}
                                    <span className="text-zinc-300">
                                        {entry.direction === 'pull' ? 'Pull from Figma' : 'Push to Figma'}
                                    </span>
                                    <span className="ml-auto flex items-center gap-1 text-zinc-500">
                                        <Clock className="h-2.5 w-2.5" />
                                        {relativeTime(entry.timestamp)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    )
}
