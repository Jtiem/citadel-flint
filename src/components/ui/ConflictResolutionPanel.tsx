/**
 * ConflictResolutionPanel — src/components/ui/ConflictResolutionPanel.tsx
 *
 * S7.3: Three-way diff UI for Figma sync conflicts.
 * Shows Base / Local / Remote (Figma) values side by side.
 * Color tokens get swatches; all others show text values.
 *
 * Wired to:
 *   - window.flintAPI.mcp?.callTool('flint_resolve_conflict', ...)
 *   - window.flintAPI.mcp?.callTool('flint_resolve_all', ...)
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncConflict {
    /** Token path, e.g. "color.brand.primary" */
    tokenPath: string
    tokenType: string
    /** The common ancestor value */
    baseValue: string | null
    /** Current local value */
    localValue: string
    /** Incoming Figma value */
    remoteValue: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isColorValue(value: string): boolean {
    return /^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|hsl)a?\(/.test(value)
}

function ColorSwatch({ value }: { value: string }) {
    if (!isColorValue(value)) return null
    return (
        <span
            className="inline-block h-5 w-5 shrink-0 rounded border border-white/20"
            style={{ backgroundColor: value }}
            title={value}
        />
    )
}

// ── Component ────────────────────────────────────────────────────────────────

interface ConflictResolutionPanelProps {
    onClose?: () => void
    /** Pre-loaded conflicts (if available). Otherwise fetched from MCP. */
    conflicts?: SyncConflict[]
}

export function ConflictResolutionPanel({ onClose, conflicts: initialConflicts }: ConflictResolutionPanelProps) {
    const push = useNotificationStore((s) => s.push)

    const [conflicts, setConflicts] = useState<SyncConflict[]>(initialConflicts ?? [])
    const [isLoading, setIsLoading] = useState(!initialConflicts)
    const [resolvingPath, setResolvingPath] = useState<string | null>(null)
    const [resolvingAll, setResolvingAll] = useState(false)

    // ── Fetch conflicts from MCP ─────────────────────────────────────────────
    const fetchConflicts = useCallback(() => {
        setIsLoading(true)
        window.flintAPI.mcp?.callTool('flint_sync_check', {})
            .then((result) => {
                if (result?.isError) return
                try {
                    const text = result?.content?.[0]?.text
                    if (text) {
                        const data = JSON.parse(text)
                        const parsed: SyncConflict[] = (data.conflicts ?? []).map((c: Record<string, unknown>) => ({
                            tokenPath: String(c.tokenPath ?? c.token_path ?? ''),
                            tokenType: String(c.tokenType ?? c.token_type ?? 'string'),
                            baseValue: c.baseValue != null ? String(c.baseValue) : null,
                            localValue: String(c.localValue ?? c.local_value ?? ''),
                            remoteValue: String(c.remoteValue ?? c.remote_value ?? ''),
                        }))
                        setConflicts(parsed)
                    }
                } catch { /* parse failure */ }
            })
            .catch(() => { /* MCP unavailable */ })
            .finally(() => setIsLoading(false))
    }, [])

    useEffect(() => {
        if (!initialConflicts) fetchConflicts()
    }, [initialConflicts, fetchConflicts])

    // ── Resolve single conflict ──────────────────────────────────────────────
    const resolveConflict = useCallback(async (tokenPath: string, resolution: 'local' | 'remote') => {
        setResolvingPath(tokenPath)
        try {
            const result = await window.flintAPI.mcp?.callTool('flint_resolve_conflict', {
                tokenPath,
                resolution,
            })
            if (result?.isError) {
                push({
                    type: 'error',
                    title: 'Resolve failed',
                    message: result?.content?.[0]?.text ?? 'Unknown error.',
                    severity: 'error',
                    autoDismissMs: 6000,
                })
            } else {
                setConflicts((prev) => prev.filter((c) => c.tokenPath !== tokenPath))
            }
        } catch {
            push({
                type: 'error',
                title: 'Resolve failed',
                message: 'Could not reach the governance engine.',
                severity: 'error',
                autoDismissMs: 6000,
            })
        } finally {
            setResolvingPath(null)
        }
    }, [push])

    // ── Resolve all ──────────────────────────────────────────────────────────
    const resolveAll = useCallback(async (resolution: 'local' | 'remote') => {
        setResolvingAll(true)
        try {
            const result = await window.flintAPI.mcp?.callTool('flint_resolve_all', {
                resolution,
            })
            if (result?.isError) {
                push({
                    type: 'error',
                    title: 'Resolve all failed',
                    message: result?.content?.[0]?.text ?? 'Unknown error.',
                    severity: 'error',
                    autoDismissMs: 6000,
                })
            } else {
                setConflicts([])
                push({
                    type: 'mutation',
                    title: 'All conflicts resolved',
                    message: `Kept ${resolution === 'local' ? 'local' : 'Figma'} values for all conflicts.`,
                    severity: 'success',
                    autoDismissMs: 4000,
                })
            }
        } catch {
            push({
                type: 'error',
                title: 'Resolve all failed',
                message: 'Could not reach the governance engine.',
                severity: 'error',
                autoDismissMs: 6000,
            })
        } finally {
            setResolvingAll(false)
        }
    }, [push])

    return (
        <div className="flex h-full flex-col bg-zinc-950 text-zinc-300" data-testid="conflict-resolution-panel">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-zinc-100">
                        Sync Conflicts
                        {conflicts.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                                {conflicts.length}
                            </span>
                        )}
                    </h2>
                </div>
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
                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && conflicts.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center" data-testid="no-conflicts">
                        <Check className="h-6 w-6 text-emerald-400" />
                        <p className="text-sm text-zinc-400">No sync conflicts</p>
                        <p className="text-[10px] text-zinc-600">Local and Figma tokens are in agreement.</p>
                    </div>
                )}

                {/* Resolve All bar */}
                {!isLoading && conflicts.length > 1 && (
                    <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2">
                        <span className="text-[10px] text-zinc-500">Resolve all:</span>
                        <button
                            type="button"
                            onClick={() => resolveAll('local')}
                            disabled={resolvingAll}
                            className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-40"
                            data-testid="resolve-all-local"
                        >
                            {resolvingAll ? 'Resolving…' : 'Keep All Local'}
                        </button>
                        <button
                            type="button"
                            onClick={() => resolveAll('remote')}
                            disabled={resolvingAll}
                            className="rounded border border-indigo-700/40 bg-indigo-900/10 px-2 py-1 text-[10px] text-indigo-400 transition-colors hover:border-indigo-600/60 hover:text-indigo-300 disabled:opacity-40"
                            data-testid="resolve-all-remote"
                        >
                            {resolvingAll ? 'Resolving…' : 'Accept All Figma'}
                        </button>
                    </div>
                )}

                {/* Conflict list */}
                {!isLoading && conflicts.map((conflict) => (
                    <div
                        key={conflict.tokenPath}
                        className="border-b border-zinc-800/40 px-4 py-3"
                        data-testid={`conflict-${conflict.tokenPath}`}
                    >
                        {/* Token path */}
                        <p className="mb-2 truncate font-mono text-[11px] text-zinc-400" title={conflict.tokenPath}>
                            {conflict.tokenPath}
                        </p>

                        {/* Three-way diff: Base / Local / Remote */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            {/* Base */}
                            <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-2">
                                <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-600">Base</p>
                                {conflict.baseValue != null ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <ColorSwatch value={conflict.baseValue} />
                                        <p className="truncate font-mono text-[10px] text-zinc-400" title={conflict.baseValue}>
                                            {conflict.baseValue}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-zinc-600">n/a</p>
                                )}
                            </div>

                            {/* Local */}
                            <div className="rounded border border-zinc-700 bg-zinc-900/80 px-2 py-2">
                                <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-500">Local</p>
                                <div className="flex flex-col items-center gap-1">
                                    <ColorSwatch value={conflict.localValue} />
                                    <p className="truncate font-mono text-[10px] text-zinc-300" title={conflict.localValue}>
                                        {conflict.localValue}
                                    </p>
                                </div>
                            </div>

                            {/* Remote (Figma) */}
                            <div className="rounded border border-indigo-700/30 bg-indigo-900/10 px-2 py-2">
                                <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-indigo-400">Figma</p>
                                <div className="flex flex-col items-center gap-1">
                                    <ColorSwatch value={conflict.remoteValue} />
                                    <p className="truncate font-mono text-[10px] text-indigo-300" title={conflict.remoteValue}>
                                        {conflict.remoteValue}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Resolution buttons */}
                        <div className="mt-2 flex gap-2">
                            <button
                                type="button"
                                onClick={() => resolveConflict(conflict.tokenPath, 'local')}
                                disabled={resolvingPath === conflict.tokenPath}
                                className="flex flex-1 items-center justify-center gap-1 rounded border border-zinc-700 px-2 py-1.5 text-[10px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-40"
                                data-testid={`keep-local-${conflict.tokenPath}`}
                            >
                                Keep Local
                            </button>
                            <button
                                type="button"
                                onClick={() => resolveConflict(conflict.tokenPath, 'remote')}
                                disabled={resolvingPath === conflict.tokenPath}
                                className="flex flex-1 items-center justify-center gap-1 rounded border border-indigo-700/40 bg-indigo-900/10 px-2 py-1.5 text-[10px] text-indigo-400 transition-colors hover:border-indigo-600/60 hover:text-indigo-300 disabled:opacity-40"
                                data-testid={`accept-figma-${conflict.tokenPath}`}
                            >
                                Accept Figma
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
