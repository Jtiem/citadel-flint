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
 *   - Polls `window.flintAPI.figma.status()` on mount and every 30 s.
 *   - Dot color: emerald (<24 h synced), amber (24–72 h stale), zinc (never / down).
 *   - Clicking the Figma area toggles a popover with sync status and token count.
 *   - Figma MCP is the only integration path (plugin deprecated 2026-04-15).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useOnboardingTooltip } from '../../hooks/useOnboardingTooltip'
import { BRAND } from '../../../shared/brand'
import { ShieldCheck, ShieldAlert, X, RefreshCw, Unplug, FolderInput, MessageSquare, Tablet, Smartphone, Download, Upload, RotateCcw, Loader2, MoreHorizontal } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { BREAKPOINT_LABELS } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import { useNotificationStore } from '../../store/notificationStore'
import { SyncStatus } from '../ui/SyncStatus'
import { BetaFeedbackModal } from '../ui/BetaFeedbackModal'
import { CoverageBadge } from './CoverageBadge'
import { RuntimeAuditPill } from './RuntimeAuditPill'
import { useRuntimeAudit } from '../../hooks/useRuntimeAudit'
import { useRuntimeAxeFlag } from '../../hooks/useRuntimeAxeFlag'
import type { FigmaStatus, BetaInfo, UpdateInfo, UpdateDownloadProgress } from '../../types/flint-api'
import { formatRelativeTime } from '../../utils/relativeTime'

// ── Scratchpad detection ───────────────────────────────────────────────────────

/**
 * Returns true when `filePath` lives inside ~/{Product} Projects/Untitled-*.
 * These are projects created by the instant "New Project" flow with no dialog.
 */
function isScratchpadPath(filePath: string | null): boolean {
    if (!filePath) return false
    // Match ~/{Product} Projects/Untitled-<N>/... on any POSIX system
    return new RegExp(`/${BRAND.product} Projects/Untitled-\\d+/`).test(filePath)
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


// ── Component ─────────────────────────────────────────────────────────────────

// ── Herald: IDE Sync Status Chip ─────────────────────────────────────────────

const IDE_SYNC_ACTIVE_THRESHOLD_MS = 30_000  // emerald if event within 30s
const IDE_SYNC_IDLE_THRESHOLD_MS = 60_000    // zinc after 60s of silence

function IDESyncChip({ onConnectIDE }: { onConnectIDE?: () => void }) {
    const ideSyncActive = useCanvasStore((s) => s.ideSyncActive)
    const lastEventAt = useCanvasStore((s) => s.ideSyncLastEventAt)
    const lastFile = useCanvasStore((s) => s.ideSyncLastFile)
    const [now, setNow] = useState(Date.now())
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Tick every 10s to update dot color based on staleness
    useEffect(() => {
        if (!ideSyncActive) return
        const timer = setInterval(() => setNow(Date.now()), 10_000)
        return () => clearInterval(timer)
    }, [ideSyncActive])

    // Close popover on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Layer 3: first-encounter tooltip (shows once, persists in localStorage)
    const { shouldShow: showTooltip, dismiss: dismissTooltip } = useOnboardingTooltip('ide-file-sync')

    // Progressive disclosure: hidden until first IDE sync event
    if (!ideSyncActive) return null

    const elapsed = now - lastEventAt
    const dotColor = elapsed < IDE_SYNC_ACTIVE_THRESHOLD_MS
        ? 'bg-emerald-400'
        : elapsed < IDE_SYNC_IDLE_THRESHOLD_MS
            ? 'bg-zinc-400'
            : 'bg-zinc-600'
    const statusLabel = elapsed < IDE_SYNC_ACTIVE_THRESHOLD_MS
        ? 'Following your editor'
        : 'Waiting for file changes'

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex min-h-[24px] cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title={statusLabel}
                data-testid="ide-sync-chip"
            >
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                IDE
            </button>

            {/* Layer 3: One-time onboarding tooltip */}
            {showTooltip && !open && (
                <div
                    className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 shadow-lg border border-zinc-700"
                    role="status"
                    data-testid="ide-sync-tooltip"
                >
                    Glass is following your editor. Switch files to see it update.
                    <button
                        type="button"
                        onClick={dismissTooltip}
                        className="ml-2 inline-flex rounded p-0.5 text-zinc-400 hover:text-zinc-200"
                        aria-label="Dismiss tooltip"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {open && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">IDE Sync</span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded p-0.5 text-zinc-400 hover:text-zinc-300"
                            aria-label="Close IDE sync popover"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>

                    <dl className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                            <dt className="text-zinc-400">Status</dt>
                            <dd className="text-zinc-300">{statusLabel}</dd>
                        </div>
                        {lastFile && (
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-400">Last file</dt>
                                <dd className="truncate text-zinc-300 max-w-[140px]">{lastFile}</dd>
                            </div>
                        )}
                        {lastEventAt > 0 && (
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-400">Received</dt>
                                <dd className="text-zinc-300">{formatRelativeTime(lastEventAt)}</dd>
                            </div>
                        )}
                    </dl>

                    <div className="mt-2.5 border-t border-zinc-800 pt-2">
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                            Switch files in VS Code and Glass follows automatically.
                            Or right-click a file → &quot;Open in Flint Glass.&quot;
                        </p>
                    </div>

                    {onConnectIDE && (
                        <div className="mt-2 border-t border-zinc-800 pt-2">
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onConnectIDE() }}
                                className="text-[11px] text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Set up IDE connection
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── RuntimeAuditGate (RUNTIME.1) ──────────────────────────────────────────────

/**
 * Double-gated container for the RuntimeAuditPill.
 *
 * Contract invariant `flag-off-ui-silent`: when `runtime.axe.enabled` is false
 * OR no file is active, this component renders NOTHING — zero DOM nodes — so
 * `queryByTestId('runtime-audit-pill')` returns null.
 *
 * Progressive disclosure: even with the flag on, the pill stays hidden until
 * a file is active so users without an open project never see an orphaned
 * pill that has no preview to audit.
 */
function RuntimeAuditGate() {
    const flagEnabled = useRuntimeAxeFlag()
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    // Flag-off-ui-silent: zero DOM nodes when flag is off.
    if (!flagEnabled) return null
    // Progressive disclosure: also hidden until a file is active.
    if (activeFilePath === null) return null

    return <RuntimeAuditSurface />
}

/**
 * Renders the actual pill + optional sub-message. Split from the gate so the
 * useRuntimeAudit hook is only mounted when both gates pass.
 */
function RuntimeAuditSurface() {
    const { status, result, run } = useRuntimeAudit()
    const findingCount = result?.violations?.length ?? 0

    const onClick = useCallback(() => {
        // The real `previewHtml` is captured by Group A's main-process handler
        // from the active LivePreview iframe. Here we pass an empty payload —
        // the adapter treats absence as "use the current LivePreview HTML".
        void run({})
    }, [run])

    const isNoPreview = status === 'no-preview'

    return (
        <div className="relative flex items-center gap-1.5">
            <RuntimeAuditPill
                status={status}
                findingCount={findingCount}
                onClick={onClick}
            />
            {isNoPreview && (
                <span
                    data-testid="runtime-audit-no-preview-message"
                    className="text-[10px] text-zinc-500"
                >
                    Runtime audit skipped — no preview
                </span>
            )}
        </div>
    )
}

// ── AuditContextPill (FIXTURE.1) ──────────────────────────────────────────────

/**
 * Reads `canvasStore.latestAudit.fixtureContext` and renders a small status
 * pill showing the resolved fixture label.
 *
 * Contract invariants:
 *   - Renderless (zero DOM nodes) when fixtureContext or label is absent.
 *   - Labels are truncated via CSS `max-w-[160px] truncate` (not a char cap),
 *     so proportional-font widths are honored. The full label lives in the
 *     `title` attribute AND `aria-label` so screen readers and hover tooltips
 *     both carry it.
 *   - `role="status"` satisfies Warden (Commandment 5 — A11y is a compiler error).
 *   - Focusable (`tabIndex={0}`) so keyboard users can reveal the native tooltip
 *     on focus (FIXTURE.1-UX-SUG-1).
 *   - Prefixed with "Context · " so sighted users read the pill as an
 *     audit-context signal, not a brand badge (FIXTURE.1-UX-WARN-2).
 *   - Surface name shown in tooltip as "Surface: <surface>" per test spec.
 */
function AuditContextPill() {
    const latestAudit = useCanvasStore((s) => s.latestAudit)

    const label = latestAudit?.fixtureContext?.label
    const surface = latestAudit?.fixtureContext?.surface

    // Renderless when no label is present — zero DOM nodes.
    if (!label) return null

    // Tooltip always carries full label + surface when available. CSS truncation
    // handles visible overflow; the title value is unconditional so keyboard-focus
    // and mouse-hover both reveal the full context.
    const tooltipParts: string[] = [label]
    if (surface) tooltipParts.push(`Surface: ${surface}`)
    const tooltip = tooltipParts.join(' · ')

    return (
        <span
            role="status"
            aria-label={`Audit context: ${label}`}
            title={tooltip}
            tabIndex={0}
            data-testid="audit-context-pill"
            className="flex min-h-[24px] max-w-[160px] items-center gap-1 truncate rounded border border-indigo-500/30 bg-zinc-800 px-1.5 py-0.5 text-xs text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
            <span className="opacity-60">Context ·</span>
            <span className="truncate">{label}</span>
        </span>
    )
}

// ── StatusBar ────────────────────────────────────────────────────────────────

interface StatusBarProps {
    /** WS1: Opens the SetupWizard as a non-blocking modal for IDE/MCP configuration */
    onConnectIDE?: () => void
    /** True when the current project is the auto-loaded demo */
    isDemo?: boolean
    /** Navigate away from the demo to the user's real project */
    onOpenOwnProject?: () => void
    /** S7.1: Opens the dedicated Figma Connection Panel */
    onManageFigma?: () => void
}

export function StatusBar({ onConnectIDE, isDemo, onOpenOwnProject, onManageFigma }: StatusBarProps = {}) {
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const overridesExist = useCanvasStore((s) => s.overridesExist)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const setRightTab = useCanvasStore((s) => s.setRightTab)
    const a11yViolations = useCanvasStore((s) => s.a11yViolations)
    const storeCanExport = useCanvasStore((s) => s.canExport)
    const canExport = useMemo(
        () => storeCanExport(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mithrilViolations, overridesExist, a11yViolations, storeCanExport],
    )
    const a11yViolationCount = useMemo(() => Object.keys(a11yViolations).length, [a11yViolations])
    const push = useNotificationStore((s) => s.push)


    // ── Responsive breakpoint chip ────────────────────────────────────────────
    const previewBreakpoint = useCanvasStore((s) => s.previewBreakpoint)
    const cyclePreviewBreakpoint = useCanvasStore((s) => s.cyclePreviewBreakpoint)

    // ── Governance Autopilot (Phase REM.2.2) ─────────────────────────────────
    const autopilotEnabled = useCanvasStore((s) => s.autopilotEnabled)
    const governedCode = useCanvasStore((s) => s.governedCode)
    const governedFixCount = useCanvasStore((s) => s.governedFixCount)
    const setAutopilotEnabled = useCanvasStore((s) => s.setAutopilotEnabled)
    const clearGovernedResult = useCanvasStore((s) => s.clearGovernedResult)
    // OPP-12: Progressive status bar elements
    const hasUsedBreakpoint = useCanvasStore((s) => s.hasUsedBreakpoint)

    // ── OPP-12: Autopilot toggle progressive visibility ───────────────────────
    // The Autopilot button is hidden until the user has seen at least one
    // Mithril violation. Once revealed it stays visible for the session.
    const [hasSeenViolation, setHasSeenViolation] = useState(false)
    useEffect(() => {
        if (mithrilViolations.length > 0) setHasSeenViolation(true)
    }, [mithrilViolations.length])

    // ── Scratchpad indicator ──────────────────────────────────────────────────
    const isScratchpad = isScratchpadPath(activeFilePath)

    const totalIssues = mithrilViolations.length + a11yViolationCount
    const gateLabel = (() => {
        if (canExport) return null
        if (totalIssues > 0) {
            return `${totalIssues} ${totalIssues === 1 ? 'Issue' : 'Issues'}`
        }
        return 'Overrides Active'
    })()

    // GOV.2 override badge relocated to GovernanceDashboard (GLASS.3.4-B)

    // ── MCP connection status ─────────────────────────────────────────────────
    const [mcpConnected, setMcpConnected] = useState<boolean | null>(null)

    useEffect(() => {
        const poll = () => {
            window.flintAPI.mcp?.status()
                .then((s) => setMcpConnected(s.connected))
                .catch(() => setMcpConnected(false))
        }
        poll()
        const id = setInterval(poll, 5000)
        return () => clearInterval(id)
    }, [])

    const handleMcpReconnect = useCallback(() => {
        setMcpConnected(null) // show loading state
        window.flintAPI.mcp?.reconnect?.()
            .catch((err) => console.warn('[Flint] StatusBar: MCP reconnect failed', err))
    }, [])

    // ── Figma status state ────────────────────────────────────────────────────
    const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null)
    const [popoverOpen, setPopoverOpen] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)


    // Tooltip for "Need help?" link
    const [helpTooltipOpen, setHelpTooltipOpen] = useState(false)

    const fetchFigmaStatus = useCallback(() => {
        window.flintAPI.figma.status()
            .then(setFigmaStatus)
            .catch((err) => console.warn('[Flint] StatusBar: failed to fetch Figma status', err))
    }, [])

    useEffect(() => {
        fetchFigmaStatus()
        const id = window.setInterval(fetchFigmaStatus, 5_000)
        return () => { window.clearInterval(id) }
    }, [fetchFigmaStatus])

    // ── Push-based figma event subscriptions ─────────────────────────────────
    useEffect(() => {
        const unsubConnected = window.flintAPI.figma.onConnected(() => {
            // Figma connected — refresh status indicator
            fetchFigmaStatus()
        })

        const unsubError = window.flintAPI.figma.onError((event) => {
            const safeReason = typeof event.reason === 'string'
                ? event.reason.replace(/[^\x20-\x7E]/g, '').slice(0, 200)
                : 'Unknown error'
            push({
                type: 'error',
                title: 'Figma sync error',
                message: `HTTP ${event.statusCode}: ${safeReason}`,
                severity: 'error',
                autoDismissMs: 8000,
            })
        })

        return () => {
            unsubConnected()
            unsubError()
        }
    }, [push, fetchFigmaStatus])

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

    // W-15: Auto-focus first button when popover opens
    useEffect(() => {
        if (popoverOpen) {
            popoverRef.current?.querySelector<HTMLElement>('button')?.focus()
        }
    }, [popoverOpen])

    // W-15: Close popover on Escape key
    useEffect(() => {
        if (!popoverOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPopoverOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [popoverOpen])

    // ── Disconnect handler ────────────────────────────────────────────────────
    const handleDisconnect = () => {
        if (!window.confirm('Disconnect Figma? You will need to reconnect to sync tokens.')) return
        void window.flintAPI.figma.disconnect().then(() => {
            fetchFigmaStatus()
            push({
                type: 'info',
                title: 'Figma server stopped',
                message: `Restart ${BRAND.product} to reconnect.`,
                severity: 'warning',
                autoDismissMs: 6000,
            })
        })
    }

    // ── S7.4: Pull / Push sync handlers ────────────────────────────────────
    const [syncOp, setSyncOp] = useState<'pull' | 'push' | null>(null)
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

    // Seed lastSyncedAt from figmaStatus whenever it updates
    useEffect(() => {
        if (figmaStatus?.lastWebhookAt != null) {
            setLastSyncedAt(figmaStatus.lastWebhookAt)
        }
    }, [figmaStatus?.lastWebhookAt])

    const isFigmaConnected = figmaStatus?.running === true && (figmaStatus?.tokenCount ?? 0) > 0

    const handleSyncPull = useCallback(async () => {
        if (syncOp || !isFigmaConnected) return
        setSyncOp('pull')
        try {
            const result = await window.flintAPI.mcp?.callTool('flint_sync_pull', {})
            const isError = result?.isError === true
            push({
                type: isError ? 'error' : 'mutation',
                title: isError ? 'Pull failed' : 'Pull complete',
                message: isError
                    ? (result?.content?.[0]?.text ?? 'Unknown error during pull.')
                    : 'Figma tokens pulled to local project.',
                severity: isError ? 'error' : 'success',
                autoDismissMs: isError ? 8000 : 4000,
            })
            if (!isError) {
                setLastSyncedAt(Date.now())
                fetchFigmaStatus()
            }
        } catch {
            push({
                type: 'error',
                title: 'Pull failed',
                message: 'Could not reach the governance engine. Check your MCP connection.',
                severity: 'error',
                autoDismissMs: 8000,
            })
        } finally {
            setSyncOp(null)
        }
    }, [syncOp, isFigmaConnected, push, fetchFigmaStatus])

    const handleSyncPush = useCallback(async () => {
        if (syncOp || !isFigmaConnected) return
        setSyncOp('push')
        try {
            const result = await window.flintAPI.mcp?.callTool('flint_sync_push', {})
            const isError = result?.isError === true
            push({
                type: isError ? 'error' : 'mutation',
                title: isError ? 'Push failed' : 'Push complete',
                message: isError
                    ? (result?.content?.[0]?.text ?? 'Unknown error during push.')
                    : 'Local tokens pushed to Figma.',
                severity: isError ? 'error' : 'success',
                autoDismissMs: isError ? 8000 : 4000,
            })
            if (!isError) {
                setLastSyncedAt(Date.now())
                fetchFigmaStatus()
            }
        } catch {
            push({
                type: 'error',
                title: 'Push failed',
                message: 'Could not reach the governance engine. Check your MCP connection.',
                severity: 'error',
                autoDismissMs: 8000,
            })
        } finally {
            setSyncOp(null)
        }
    }, [syncOp, isFigmaConnected, push, fetchFigmaStatus])

    // ── Beta distribution state ─────────────────────────────────────────────
    const [betaInfo, setBetaInfo] = useState<BetaInfo | null>(null)
    const [feedbackOpen, setFeedbackOpen] = useState(false)

    useEffect(() => {
        window.flintAPI.beta?.getInfo()
            .then((info) => { if (info.isBeta) setBetaInfo(info) })
            .catch((err) => console.warn('[Flint] StatusBar: beta info check failed', err))
    }, [])

    // Subscribe to beta update notifications
    useEffect(() => {
        const unsubUpdate = window.flintAPI.beta?.onUpdateAvailable((event) => {
            push({
                type: 'info',
                title: 'New beta available',
                message: event.message,
                severity: 'warning',
                autoDismissMs: 15000,
            })
        })

        const unsubExpired = window.flintAPI.beta?.onExpiredRemote((event) => {
            push({
                type: 'error',
                title: 'Beta expired',
                message: event.message,
                severity: 'error',
                autoDismissMs: 0,
            })
        })

        return () => {
            unsubUpdate?.()
            unsubExpired?.()
        }
    }, [push])

    // ── BETA.3: electron-updater auto-update state ────────────────────────────
    type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'
    const [updateState, setUpdateState] = useState<UpdateState>('idle')
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgress | null>(null)

    useEffect(() => {
        const unsubAvailable = window.flintAPI.autoUpdate?.onUpdateAvailable((info) => {
            setUpdateInfo(info as UpdateInfo)
            setUpdateState('available')
        })

        const unsubProgress = window.flintAPI.autoUpdate?.onDownloadProgress((progress) => {
            setDownloadProgress(progress as UpdateDownloadProgress)
            setUpdateState('downloading')
        })

        const unsubDownloaded = window.flintAPI.autoUpdate?.onUpdateDownloaded((info) => {
            setUpdateInfo(info as UpdateInfo)
            setDownloadProgress(null)
            setUpdateState('ready')
        })

        return () => {
            unsubAvailable?.()
            unsubProgress?.()
            unsubDownloaded?.()
        }
    }, [])

    const handleUpdateDownload = useCallback(() => {
        setUpdateState('downloading')
        window.flintAPI.autoUpdate?.download().catch((err) => {
            console.warn('[Flint] StatusBar: auto-update download failed', err)
            setUpdateState('available') // revert on error
        })
    }, [])

    const handleUpdateInstall = useCallback(() => {
        window.flintAPI.autoUpdate?.install() // terminates process — no catch needed
    }, [])

    // ── Autopilot: apply governed code to the active file ────────────────────
    const applyGovernedCode = useCallback(() => {
        const { governedCode: code, autopilotEnabled: enabled } = useCanvasStore.getState()
        if (!enabled || !code) return
        useEditorStore.getState().setCode(code)
        clearGovernedResult()
        push({
            type: 'mutation',
            title: 'Governance Applied',
            message: 'Auto-fixes applied to active file.',
            severity: 'success',
            autoDismissMs: 4000,
        })
    }, [clearGovernedResult, push])

    const dotColor = figmaDotColor(figmaStatus)
    // OPP-23: Figma sync pulsing indicator — true for 5 s after a webhook arrives
    const isRecentSync =
        figmaStatus?.lastWebhookAt != null &&
        Date.now() - figmaStatus.lastWebhookAt < 5_000
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
        ? 'No design tokens loaded — click to connect Figma or import tokens. This unlocks design system governance.'
        : 'Figma connection — click for details'

    return (
        <footer role="contentinfo" aria-label="Application status" className="relative flex shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4 py-1">
            {/* ── Zone 1 (left): Export Gate — visually dominant primary signal ── */}
            <div className="flex flex-shrink-0 items-center">
            {/* ── Priority 1: Export Gate — Commandment 6 (The Gatekeeper Rule)
                GLASS.1d: When violations exist, clicking opens the Governance tab
                so the user can see and fix them. When clean, opens the export panel.
                S4.2: Leftmost — this is what designers care most about. */}
            <button
                type="button"
                onClick={() => {
                    if (canExport) {
                        window.dispatchEvent(new CustomEvent(`${BRAND.productLower}:open-export`))
                    } else {
                        // S4.14: violations exist → show Health/Governance tab, not Properties
                        setRightTab('governance')
                    }
                }}
                className={`flex flex-shrink-0 min-h-[24px] cursor-pointer items-center gap-1.5 text-sm font-medium transition-colors ${
                    canExport
                        ? 'text-emerald-500 hover:text-emerald-400'
                        : 'text-amber-400 hover:text-amber-300'
                }`}
                title={
                    canExport
                        // EDU-01: explain what "export ready" means
                        ? 'All design system checks pass — your file is ready to export. Click to open the Export panel.'
                        : `Export blocked: ${gateLabel}. Click to see issues and fix options.`
                }
            >
                {canExport ? (
                    <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Export Ready
                    </>
                ) : (
                    <>
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span className="max-w-[200px] truncate">{gateLabel}</span>
                    </>
                )}
            </button>
            </div>{/* end zone 1 */}

            {/* ── Zone 2 (center): Secondary signals — Figma, MCP, violation count ── */}
            <div className="flex min-w-0 flex-1 items-center justify-center gap-3 px-4">

            {/* ── Priority 3: Figma Connection Status (Phase W.2) ─────────────
                S4.2: After export gate — infrastructure signal.
                DOM order: Export Gate → Figma → MCP (per tests 20, 21). */}
            <div ref={popoverRef} className="relative min-w-0">
                <button
                    type="button"
                    onClick={() => {
                        if (tokenCount === 0) {
                            setRightTab('governance')
                            return
                        }
                        setPopoverOpen((v) => !v)
                    }}
                    className={`flex cursor-pointer min-h-[24px] items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-zinc-800 hover:text-zinc-200 ${hasNoTokens ? 'text-amber-400' : 'text-zinc-400'}`}
                    title={figmaButtonTitle}
                >
                    {/* S4.1: Removed shadow-lg shadow-emerald-400/40 from the emerald-state dot.
                         The infrastructure signal should not visually dominate the export gate. */}
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
                                className="rounded p-0.5 text-zinc-400 hover:text-zinc-300"
                                aria-label="Close Figma status popover"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Status rows */}
                        <dl className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-400">Last sync</dt>
                                <dd className="text-zinc-300">
                                    {formatRelativeTime(figmaStatus?.lastWebhookAt ?? null)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-400">Tokens</dt>
                                <dd className="text-zinc-300">
                                    {figmaStatus?.tokenCount ?? 0}
                                </dd>
                            </div>
                        </dl>

                        {/* Separator */}
                        <div className="my-2.5 border-t border-zinc-800" />

                        {/* S7.4: Pull / Push sync buttons */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSyncPull}
                                disabled={!isFigmaConnected || syncOp !== null}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs text-white transition-colors ${
                                    !isFigmaConnected || syncOp !== null
                                        ? 'bg-indigo-600 opacity-50 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-500'
                                }`}
                                title={!isFigmaConnected ? 'Connect to Figma first' : 'Pull token changes from Figma to local project'}
                                data-testid="figma-sync-pull"
                            >
                                {syncOp === 'pull' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Download className="h-3 w-3" />
                                )}
                                Pull from Figma
                            </button>
                            <button
                                type="button"
                                onClick={handleSyncPush}
                                disabled={!isFigmaConnected || syncOp !== null}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${
                                    !isFigmaConnected || syncOp !== null
                                        ? 'bg-zinc-700 text-zinc-200 opacity-50 cursor-not-allowed'
                                        : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
                                }`}
                                title={!isFigmaConnected ? 'Connect to Figma first' : 'Push local token changes to Figma'}
                                data-testid="figma-sync-push"
                            >
                                {syncOp === 'push' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Upload className="h-3 w-3" />
                                )}
                                Push to Figma
                            </button>
                        </div>

                        {/* S7.4: Last synced timestamp */}
                        {lastSyncedAt != null && (
                            <p className="mt-1.5 text-[10px] text-zinc-400" data-testid="figma-last-synced">
                                Last synced: {formatRelativeTime(lastSyncedAt)}
                            </p>
                        )}

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
                                title="Disconnect Figma sync"
                            >
                                <Unplug className="h-3 w-3" />
                                Disconnect
                            </button>
                        </div>

                        {/* S7.1: Manage connection link */}
                        {onManageFigma && (
                            <div className="mt-2.5 border-t border-zinc-800 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setPopoverOpen(false); onManageFigma() }}
                                    className="text-[11px] text-indigo-400 transition-colors hover:text-indigo-300"
                                    data-testid="figma-manage-link"
                                >
                                    Manage connection
                                </button>
                            </div>
                        )}

                        {/* Help link */}
                        <div className="relative mt-2.5 border-t border-zinc-800 pt-2">
                            <button
                                type="button"
                                onClick={() => { setHelpTooltipOpen((v) => !v) }}
                                className="text-[11px] text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Need help?
                            </button>
                            {helpTooltipOpen && (
                                <div className="absolute bottom-full left-0 mb-1 w-56 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-[11px] text-zinc-300 shadow-lg">
                                    Use /figma in your IDE to import designs via Figma MCP. No plugin needed.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Coverage Badge (Phase 0 — Coverage Honesty) ──────────────────── */}
            {/* Self-contained: calls useCoverageSummary() internally. No store. */}
            <CoverageBadge />

            {/* ── Audit Context Pill (FIXTURE.1) ────────────────────────────────── */}
            {/* Renderless when no fixture was resolved (latestAudit is null or has
                no fixtureContext.label). Pill order: [coverage] [audit context] [runtime]. */}
            <AuditContextPill />

            {/* ── Runtime Audit Pill (RUNTIME.1 — axe-core adapter) ────────────── */}
            {/* Double-gated: feature flag + activeFilePath. Renders ZERO DOM nodes
                when either gate is false (contract invariant flag-off-ui-silent). */}
            <RuntimeAuditGate />

            {/* ── Herald: IDE Sync Indicator (progressive disclosure) ──────────── */}
            {/* Hidden until the first flint:ide-file-selected event. Then shows
                an emerald dot when active, zinc when idle, matching the Figma pattern. */}
            <IDESyncChip onConnectIDE={onConnectIDE} />

            {/* ── MCP Connection Indicator (secondary — always visible in zone 2) ── */}
            {/* DOM order: Figma → IDE → MCP. */}
            <div
                className="flex items-center gap-1.5 px-1.5 py-0.5"
                title={
                    mcpConnected === null
                        ? 'Governance engine — connecting…'
                        : mcpConnected
                        // EDU-13: plain-language tooltip explaining what MCP is
                        ? 'Governance engine — connected. Flint is actively checking your code.'
                        : 'Governance engine — not connected. Audits and fixes are unavailable.'
                }
            >
                <span
                    className={[
                        'inline-block w-2 h-2 rounded-full',
                        mcpConnected === null
                            ? 'bg-zinc-500 animate-pulse'
                            : mcpConnected
                            ? 'bg-emerald-400'
                            : 'bg-red-400',
                    ].join(' ')}
                    aria-hidden="true"
                />
                <span className={`text-xs ${mcpConnected ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    {mcpConnected === null ? 'Connecting…' : mcpConnected ? 'Connected' : 'Offline'}
                </span>
                {mcpConnected === false && (
                    <button
                        type="button"
                        onClick={handleMcpReconnect}
                        className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 ml-0.5"
                        aria-label="Reconnect Flint engine"
                    >
                        Reconnect
                    </button>
                )}
            </div>

            </div>{/* end zone 2 */}

            {/* GOV.2 override badge relocated to GovernanceDashboard (GLASS.3.4-B) */}

            {/* ── Zone 3 (right): Tertiary indicators + overflow popover ─── */}
            <div className="flex flex-shrink-0 items-center gap-2">

            {/* ── Contextual primary slot: download progress (transient, high-priority) ── */}
            {updateState === 'downloading' && (
                <span
                    className="flex items-center gap-1.5 rounded border border-blue-700/40 bg-blue-900/10 px-2 py-0.5 text-xs text-blue-400"
                    title={`Downloading update… ${downloadProgress ? `${Math.round(downloadProgress.percent)}%` : ''}`}
                >
                    <Download className="h-3 w-3 animate-pulse" />
                    {downloadProgress ? `${Math.round(downloadProgress.percent)}%` : 'Downloading…'}
                    {downloadProgress && (
                        <span
                            className="ml-1 inline-block h-1 w-12 overflow-hidden rounded bg-blue-900/40"
                            aria-hidden="true"
                        >
                            <span
                                className="block h-full bg-blue-400 transition-all"
                                style={{ width: `${downloadProgress.percent}%` }}
                            />
                        </span>
                    )}
                </span>
            )}

            {/* ── Overflow popover — tertiary indicators ─────────────────── */}
            <OverflowMenu
                mcpConnected={mcpConnected}
                onConnectIDE={onConnectIDE}
                isDemo={isDemo}
                onOpenOwnProject={onOpenOwnProject}
                previewBreakpoint={previewBreakpoint}
                hasUsedBreakpoint={hasUsedBreakpoint}
                cyclePreviewBreakpoint={cyclePreviewBreakpoint}
                isScratchpad={isScratchpad}
                hasSeenViolation={hasSeenViolation}
                autopilotEnabled={autopilotEnabled}
                setAutopilotEnabled={setAutopilotEnabled}
                governedCode={governedCode}
                governedFixCount={governedFixCount}
                activeFilePath={activeFilePath}
                applyGovernedCode={applyGovernedCode}
                betaInfo={betaInfo}
                setFeedbackOpen={setFeedbackOpen}
                updateState={updateState}
                updateInfo={updateInfo}
                handleUpdateDownload={handleUpdateDownload}
                handleUpdateInstall={handleUpdateInstall}
            />

            </div>{/* end right zone */}

            {/* Beta feedback modal */}
            <BetaFeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </footer>
    )
}

// ── OverflowMenu ──────────────────────────────────────────────────────────────

interface OverflowMenuProps {
    mcpConnected: boolean | null
    onConnectIDE?: () => void
    isDemo?: boolean
    onOpenOwnProject?: () => void
    previewBreakpoint: string
    hasUsedBreakpoint: boolean
    cyclePreviewBreakpoint: (dir: 'up' | 'down') => void
    isScratchpad: boolean
    hasSeenViolation: boolean
    autopilotEnabled: boolean
    setAutopilotEnabled: (val: boolean) => void
    governedCode: string | null
    governedFixCount: number
    activeFilePath: string | null
    applyGovernedCode: () => void
    betaInfo: BetaInfo | null
    setFeedbackOpen: (val: boolean) => void
    updateState: 'idle' | 'available' | 'downloading' | 'ready'
    updateInfo: UpdateInfo | null
    handleUpdateDownload: () => void
    handleUpdateInstall: () => void
}

function OverflowMenu({
    mcpConnected,
    onConnectIDE,
    isDemo,
    onOpenOwnProject,
    previewBreakpoint,
    hasUsedBreakpoint,
    cyclePreviewBreakpoint,
    isScratchpad,
    hasSeenViolation,
    autopilotEnabled,
    setAutopilotEnabled,
    governedCode,
    governedFixCount,
    activeFilePath,
    applyGovernedCode,
    betaInfo,
    setFeedbackOpen,
    updateState,
    updateInfo,
    handleUpdateDownload,
    handleUpdateInstall,
}: OverflowMenuProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    // Badge count: items needing attention
    const badgeCount = [
        updateState === 'available' || updateState === 'ready',
        isDemo,
        isScratchpad,
        mcpConnected === false && !!onConnectIDE,
        betaInfo != null,
    ].filter(Boolean).length

    const showBreakpointChip = hasUsedBreakpoint && previewBreakpoint !== 'desktop'

    // Don't render overflow button if there's nothing to show
    const hasAnyOverflowItem =
        (mcpConnected === false && !!onConnectIDE) ||
        isDemo ||
        showBreakpointChip ||
        isScratchpad ||
        hasSeenViolation ||
        betaInfo != null ||
        updateState === 'available' ||
        updateState === 'ready'

    if (!hasAnyOverflowItem) return <SyncStatus />

    return (
        <div ref={ref} className="relative flex items-center gap-2">
            <SyncStatus />
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative flex items-center justify-center rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                title="More status items"
                aria-label="Show more status indicators"
                data-testid="statusbar-overflow-btn"
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
                {badgeCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold leading-none text-zinc-950">
                        {badgeCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute bottom-full right-0 mb-2 w-56 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">

                    {/* WS1: Connect IDE */}
                    {mcpConnected === false && onConnectIDE && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onConnectIDE() }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-indigo-400 transition-colors hover:bg-zinc-800 hover:text-indigo-300"
                            title="Open IDE setup wizard to configure Flint connection"
                            data-testid="statusbar-connect-ide"
                        >
                            Connect IDE
                        </button>
                    )}

                    {/* Demo indicator */}
                    {isDemo && (
                        <div className="px-3 py-1.5">
                            <span className="text-[10px] text-amber-400">Demo Project</span>
                            {onOpenOwnProject && (
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); onOpenOwnProject() }}
                                    className="mt-0.5 block text-[10px] text-zinc-400 underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-zinc-200"
                                >
                                    Open your project
                                </button>
                            )}
                        </div>
                    )}

                    {/* Breakpoint chip */}
                    {showBreakpointChip && (
                        <button
                            type="button"
                            onClick={() => { cyclePreviewBreakpoint('up') }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                            title={`Preview breakpoint: ${BREAKPOINT_LABELS[previewBreakpoint as keyof typeof BREAKPOINT_LABELS]} — click to cycle`}
                            data-testid="statusbar-breakpoint-chip"
                        >
                            {previewBreakpoint === 'mobile' ? (
                                <Smartphone className="h-3 w-3" />
                            ) : (
                                <Tablet className="h-3 w-3" />
                            )}
                            {BREAKPOINT_LABELS[previewBreakpoint as keyof typeof BREAKPOINT_LABELS]}
                        </button>
                    )}

                    {/* Scratchpad */}
                    {isScratchpad && (
                        <button
                            type="button"
                            title="Scratchpad project — click to save to a permanent location (Cmd+Shift+S)"
                            onClick={() => {
                                setOpen(false)
                                window.dispatchEvent(new CustomEvent(`${BRAND.productLower}:save-project-as`))
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-amber-400 transition-colors hover:bg-zinc-800 hover:text-amber-300"
                        >
                            <FolderInput className="h-3 w-3" />
                            Unsaved Project
                        </button>
                    )}

                    {/* Autopilot toggle */}
                    {hasSeenViolation && (
                        <button
                            type="button"
                            onClick={() => { setAutopilotEnabled(!autopilotEnabled) }}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-[10px] transition-colors hover:bg-zinc-800 ${autopilotEnabled ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'}`}
                            aria-label={autopilotEnabled ? 'Autopilot: On' : 'Autopilot: Off'}
                            title={autopilotEnabled
                                ? 'Autopilot is active — Flint will automatically fix safe issues as you work'
                                : 'Enable Autopilot to let Flint auto-fix safe issues in the background'}
                        >
                            <span className={`h-2 w-2 rounded-full ${autopilotEnabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                            Autopilot {autopilotEnabled ? 'On' : 'Off'}
                        </button>
                    )}

                    {/* Autopilot status (fixes ready) */}
                    {hasSeenViolation && autopilotEnabled && governedFixCount > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (governedCode && activeFilePath) {
                                    setOpen(false)
                                    applyGovernedCode()
                                }
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-emerald-400 transition-colors hover:bg-zinc-800 hover:text-emerald-300"
                            title={`Apply ${governedFixCount} governance fixes (Cmd+Shift+G)`}
                        >
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                            {governedFixCount} fixes ready
                        </button>
                    )}

                    {/* Divider before meta items */}
                    {(betaInfo != null || updateState === 'available' || updateState === 'ready') && (
                        <div className="my-1 border-t border-zinc-800" />
                    )}

                    {/* Beta chip */}
                    {betaInfo && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); setFeedbackOpen(true) }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-indigo-400 transition-colors hover:bg-zinc-800 hover:text-indigo-300"
                            title={`Beta build ${betaInfo.buildId}${betaInfo.daysRemaining != null ? ` — ${betaInfo.daysRemaining} day${betaInfo.daysRemaining === 1 ? '' : 's'} remaining` : ''} — click to send feedback`}
                        >
                            <MessageSquare className="h-3 w-3" />
                            Beta {betaInfo.daysRemaining != null ? `(${betaInfo.daysRemaining}d)` : ''} — Send feedback
                        </button>
                    )}

                    {/* Update available */}
                    {updateState === 'available' && updateInfo && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); handleUpdateDownload() }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-emerald-400 transition-colors hover:bg-zinc-800 hover:text-emerald-300"
                            title={`Update available: v${updateInfo.version} — click to download`}
                        >
                            <Download className="h-3 w-3" />
                            Update v{updateInfo.version} available
                        </button>
                    )}

                    {/* Update ready to install */}
                    {updateState === 'ready' && updateInfo && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); handleUpdateInstall() }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-violet-400 transition-colors hover:bg-zinc-800 hover:text-violet-300"
                            title={`v${updateInfo.version} downloaded — click to restart and install`}
                        >
                            <RotateCcw className="h-3 w-3" />
                            Restart to install v{updateInfo.version}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
