/**
 * StatusBar — src/components/editor/StatusBar.tsx
 *
 * VS Code-style footer strip showing the active engine states so the UI
 * reflects the actual tech running under the hood.
 *
 * Phase B addition: Export Gate chip.
 *   - Reads `mithrilViolations` + `overridesExist` from canvasStore.
 *   - Shows a green "Export Ready" shield when the file is clean.
 *   - Shows an amber "N Mithril Violation(s)" chip when ΔE violations exist.
 *   - Shows an amber "Overrides Active" chip when component_overrides is dirty.
 *   - The Export Gate is the UI surface for Commandment 6 (The Gatekeeper Rule).
 *
 * Phase W.2 addition: Figma connection status popover.
 *   - Polls `window.bridgeAPI.figma.status()` on mount and every 30 s.
 *   - Dot color: emerald (<24 h synced), amber (24–72 h stale), zinc (never / down).
 *   - Clicking the Figma area toggles a popover with server status, last sync
 *     timestamp, and token count.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ShieldCheck, ShieldAlert, X, Copy, Check, RefreshCw, Unplug, FolderInput } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import { SyncStatus } from '../ui/SyncStatus'
import type { FigmaStatus } from '../../types/bridge-api'

// ── Scratchpad detection ───────────────────────────────────────────────────────

/**
 * Returns true when `filePath` lives inside ~/Bridge Projects/Untitled-*.
 * These are projects created by the instant "New Project" flow with no dialog.
 */
function isScratchpadPath(filePath: string | null): boolean {
    if (!filePath) return false
    // Match ~/Bridge Projects/Untitled-<N>/... on any POSIX system
    return /\/Bridge Projects\/Untitled-\d+\//.test(filePath)
}

// ── Figma staleness helpers ───────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000

/**
 * Returns the Tailwind color class for the Figma dot based on sync freshness.
 *   emerald — synced within the last 24 h
 *   amber   — 24–72 h stale
 *   zinc    — never synced or server not running
 */
function figmaDotColor(status: FigmaStatus | null): string {
    if (!status || !status.running || status.lastWebhookAt === null) {
        return 'bg-zinc-500'
    }
    const age = Date.now() - status.lastWebhookAt
    if (age < 24 * HOUR_MS) return 'bg-emerald-500'
    if (age < 72 * HOUR_MS) return 'bg-amber-400'
    return 'bg-zinc-500'
}

/**
 * Formats a Unix timestamp (ms) as a human-readable relative string.
 * Returns "Never" for null.
 */
function relativeTime(ts: number | null): string {
    if (ts === null) return 'Never'
    const diffMs = Date.now() - ts
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days === 1 ? '' : 's'} ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatusBar() {
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const overridesExist = useCanvasStore((s) => s.overridesExist)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const canExport = mithrilViolations.length === 0 && !overridesExist
    const push = useNotificationStore((s) => s.push)

    // ── Scratchpad indicator ──────────────────────────────────────────────────
    const isScratchpad = isScratchpadPath(activeFilePath)

    const gateLabel = (() => {
        if (canExport) return null
        if (mithrilViolations.length > 0) {
            return `${mithrilViolations.length} Mithril Violation${mithrilViolations.length > 1 ? 's' : ''}`
        }
        return 'Overrides Active'
    })()

    // ── Override count state (GOV.2) ──────────────────────────────────────────
    const [overrideCount, setOverrideCount] = useState<number>(0)

    const fetchOverrideCount = useCallback(() => {
        window.bridgeAPI.governance.getOverrideCount()
            .then(setOverrideCount)
            .catch(() => { /* governance IPC may not be ready on first paint */ })
    }, [])

    useEffect(() => {
        fetchOverrideCount()
        const unsubscribe = window.bridgeAPI.governance.onOverrideRecorded(() => {
            fetchOverrideCount()
        })
        return unsubscribe
    }, [fetchOverrideCount])

    // ── Figma status state ────────────────────────────────────────────────────
    const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null)
    const [popoverOpen, setPopoverOpen] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)

    // Brief "Copied!" visual feedback for copy buttons
    const [copying, setCopying] = useState<'endpoint' | 'secret' | null>(null)
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Tooltip for "Need help?" link
    const [helpTooltipOpen, setHelpTooltipOpen] = useState(false)

    const fetchFigmaStatus = useCallback(() => {
        window.bridgeAPI.figma.status()
            .then(setFigmaStatus)
            .catch(() => { /* server may not be ready on first paint */ })
    }, [])

    useEffect(() => {
        fetchFigmaStatus()
        const id = window.setInterval(fetchFigmaStatus, 5_000)
        return () => { window.clearInterval(id) }
    }, [fetchFigmaStatus])

    // ── Push-based figma event subscriptions ─────────────────────────────────
    useEffect(() => {
        const unsubConnected = window.bridgeAPI.figma.onConnected((event) => {
            push({
                type: 'sync',
                title: 'Figma synced',
                message: `${event.tokenCount} design token${event.tokenCount === 1 ? '' : 's'} received from Figma.`,
                severity: 'success',
                autoDismissMs: 5000,
            })
            fetchFigmaStatus()
        })

        const unsubError = window.bridgeAPI.figma.onError((event) => {
            push({
                type: 'error',
                title: 'Figma sync error',
                message: `HTTP ${event.statusCode}: ${event.reason}`,
                severity: 'error',
                autoDismissMs: 8000,
            })
        })

        return () => {
            unsubConnected()
            unsubError()
        }
    }, [push, fetchFigmaStatus])

    // Cleanup copy timer on unmount
    useEffect(() => {
        return () => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        }
    }, [])

    // Close popover on outside click
    useEffect(() => {
        if (!popoverOpen) return
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setPopoverOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => { document.removeEventListener('mousedown', handler) }
    }, [popoverOpen])

    // ── Copy helper ───────────────────────────────────────────────────────────
    const handleCopy = (field: 'endpoint' | 'secret', value: string) => {
        void navigator.clipboard.writeText(value).then(() => {
            setCopying(field)
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
            copyTimerRef.current = setTimeout(() => setCopying(null), 1500)
        })
    }

    // ── Disconnect handler ────────────────────────────────────────────────────
    const handleDisconnect = () => {
        void window.bridgeAPI.figma.disconnect().then(() => {
            fetchFigmaStatus()
            push({
                type: 'info',
                title: 'Figma server stopped',
                message: 'Restart Bridge to reconnect.',
                severity: 'warning',
                autoDismissMs: 6000,
            })
        })
    }

    const dotColor = figmaDotColor(figmaStatus)
    // OPP-23: Figma sync pulsing indicator — true for 5 s after a webhook arrives
    const isRecentSync =
        figmaStatus?.lastWebhookAt != null &&
        Date.now() - figmaStatus.lastWebhookAt < 5_000
    const endpoint = figmaStatus ? `127.0.0.1:${figmaStatus.port}` : '127.0.0.1:4545'
    const secret = figmaStatus?.secret ?? ''
    const secretTruncated = secret.length > 15 ? `${secret.slice(0, 15)}…` : secret

    // ── No-design-system amber state ─────────────────────────────────────────
    // When zero tokens are loaded, governance is not fully active.  Signal this
    // with an amber dot and a "No design system" label instead of the silent
    // zinc "Figma" chip, so users know they need to connect Figma or import
    // tokens before Mithril enforcement has anything to measure against.
    const tokenCount = figmaStatus?.tokenCount ?? 0
    const hasNoTokens = tokenCount === 0
    const figmaButtonDotColor = hasNoTokens ? 'bg-amber-400' : dotColor
    const figmaButtonLabel = hasNoTokens ? 'No design system' : 'Figma'
    const figmaButtonTitle = hasNoTokens
        ? 'Connect Figma or import tokens to enable governance'
        : 'Figma connection — click for details'

    return (
        <footer className="relative flex shrink-0 items-center gap-6 border-t border-gray-800 bg-gray-950 px-4 py-[3px]">
            <span className="text-xs text-gray-500">
                Local SQLite (better-sqlite3)
            </span>
            <span className="text-xs text-gray-500">
                Babel AST Parser Active
            </span>
            <span className="text-xs text-gray-500">
                Electron IPC Bridge
            </span>

            {/* ── Scratchpad indicator ──────────────────────────────────────── */}
            {isScratchpad && (
                <button
                    type="button"
                    title="Scratchpad project — click to save to a permanent location (Cmd+Shift+S)"
                    onClick={() => { window.dispatchEvent(new CustomEvent('bridge:save-project-as')) }}
                    className="flex items-center gap-1 rounded border border-amber-700/40 bg-amber-900/10 px-1.5 py-0.5 text-xs text-amber-400 transition-colors hover:border-amber-600/60 hover:bg-amber-900/20 hover:text-amber-300"
                >
                    <FolderInput className="h-3 w-3" />
                    Scratchpad
                </button>
            )}

            {/* ── Figma Connection Status (Phase W.2) ──────────────────────── */}
            <div ref={popoverRef} className="relative">
                <button
                    type="button"
                    onClick={() => { setPopoverOpen((v) => !v) }}
                    className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-gray-800 hover:text-gray-200 ${hasNoTokens ? 'text-amber-400' : 'text-gray-400'}`}
                    title={figmaButtonTitle}
                >
                    <span className={`h-2 w-2 rounded-full ${figmaButtonDotColor}${isRecentSync ? ' animate-ping' : ''}`} />
                    {figmaButtonLabel}
                </button>

                {/* Popover */}
                {popoverOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                        {/* Header */}
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-100">Figma Connection</span>
                            <button
                                type="button"
                                onClick={() => { setPopoverOpen(false) }}
                                className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                                aria-label="Close Figma status popover"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Status rows */}
                        <dl className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-500">Server</dt>
                                <dd className={figmaStatus?.running ? 'text-emerald-400' : 'text-zinc-500'}>
                                    {figmaStatus?.running ? 'Running' : 'Stopped'}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-500">Last sync</dt>
                                <dd className="text-zinc-300">
                                    {relativeTime(figmaStatus?.lastWebhookAt ?? null)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-500">Tokens</dt>
                                <dd className="text-zinc-300">
                                    {figmaStatus?.tokenCount ?? 0}
                                </dd>
                            </div>
                        </dl>

                        {/* Separator */}
                        <div className="my-2.5 border-t border-zinc-800" />

                        {/* Endpoint copy row */}
                        <div className="mb-2 space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Endpoint</p>
                            <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
                                <code className="flex-1 truncate font-mono text-[11px] text-zinc-300">
                                    {endpoint}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => { handleCopy('endpoint', `http://${endpoint}`) }}
                                    className="shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                                    title={copying === 'endpoint' ? 'Copied!' : 'Copy endpoint'}
                                    aria-label={copying === 'endpoint' ? 'Copied!' : 'Copy endpoint'}
                                >
                                    {copying === 'endpoint' ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </button>
                            </div>
                            {copying === 'endpoint' && (
                                <p className="text-[10px] text-emerald-400">Copied!</p>
                            )}
                        </div>

                        {/* Secret copy row */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Secret</p>
                            <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
                                <code className="flex-1 truncate font-mono text-[11px] text-zinc-300">
                                    {secretTruncated}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => { handleCopy('secret', secret) }}
                                    className="shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                                    title={copying === 'secret' ? 'Copied!' : 'Copy secret'}
                                    aria-label={copying === 'secret' ? 'Copied!' : 'Copy secret'}
                                >
                                    {copying === 'secret' ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </button>
                            </div>
                            {copying === 'secret' && (
                                <p className="text-[10px] text-emerald-400">Copied!</p>
                            )}
                        </div>

                        {/* Separator */}
                        <div className="my-2.5 border-t border-zinc-800" />

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={fetchFigmaStatus}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700/60 hover:text-zinc-100"
                                title="Re-fetch server status"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Refresh Status
                            </button>
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded border border-red-700/40 bg-red-900/10 px-2 py-1.5 text-xs text-red-400 transition-colors hover:border-red-600/60 hover:bg-red-900/20 hover:text-red-300"
                                title="Stop the ingestion server"
                            >
                                <Unplug className="h-3 w-3" />
                                Disconnect
                            </button>
                        </div>

                        {/* Setup guide link */}
                        <div className="relative mt-2.5 border-t border-zinc-800 pt-2">
                            <button
                                type="button"
                                onClick={() => { setHelpTooltipOpen((v) => !v) }}
                                className="text-[11px] text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Need help? Setup guide
                            </button>
                            {helpTooltipOpen && (
                                <div className="absolute bottom-full left-0 mb-1 w-56 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-[11px] text-zinc-300 shadow-lg">
                                    Close your project to access the setup wizard from the Launch Screen.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Overrides badge (GOV.2) — only visible when count > 0 */}
            {overrideCount > 0 && (
                <span
                    className="text-xs text-amber-500"
                    title={`${overrideCount} governance rule override${overrideCount === 1 ? '' : 's'} recorded this session`}
                >
                    Overrides ({overrideCount})
                </span>
            )}

            {/* Export Gate — Commandment 6 (The Gatekeeper Rule) */}
            <button
                type="button"
                onClick={() => {
                    window.dispatchEvent(new CustomEvent('bridge:open-export'))
                }}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                    canExport
                        ? 'text-emerald-500 hover:text-emerald-400'
                        : 'text-amber-400 hover:text-amber-300'
                }`}
                title={
                    canExport
                        ? 'No Mithril violations or overrides — file is export-ready'
                        : `Export blocked: ${gateLabel} — click to open Export modal`
                }
            >
                {canExport ? (
                    <>
                        <ShieldCheck className="h-3 w-3" />
                        Export Ready
                    </>
                ) : (
                    <>
                        <ShieldAlert className="h-3 w-3" />
                        {gateLabel}
                    </>
                )}
            </button>

            <span className="ml-auto">
                <SyncStatus />
            </span>
        </footer>
    )
}
