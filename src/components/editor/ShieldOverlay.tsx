/**
 * ShieldOverlay — src/components/editor/ShieldOverlay.tsx
 *
 * Transparent overlay rendered above the srcdoc iframe in design mode.
 * Responsibilities:
 *   - Intercept iframe postMessage events (CANVAS_CLICK, NODE_LAYOUT, etc.)
 *   - Forward CANVAS_CLICK to editorStore/canvasStore selection logic
 *   - Block click/drag on nodes locked by remote presence users and emit a
 *     notification (Phase 3D)
 *   - Render spatial governance badges at node positions from nodeLayouts
 *   - Render lock icons at the top-right of remote-locked nodes (Phase 3D)
 *   - Relay presence cursor positions as SVG overlays
 *
 * Phase U.1 additions:
 *   - Severity heat tint — semi-transparent color overlay on violating nodes
 *   - Hover tooltip — ViolationTooltip popover on badge hover
 *   - Click-to-health — badge click selects node + switches to Health tab
 *   - Viewport culling — badges only rendered for nodes within visible area
 *   - Badge cap — max 50 badges, sorted criticals first
 *
 * Mithril Safety: all classes from Flint design token palette.
 * No hardcoded hex values. No arbitrary spacing values.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { AlertTriangle, Lock, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import { ViolationTooltip } from './ViolationTooltip'
import { useOnboardingTooltip } from '../../hooks/useOnboardingTooltip'
import type { LinterWarning } from '../../types/flint-api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShieldOverlayProps {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
}

// Messages posted by the in-iframe flint-init script
interface CanvasClickMessage {
    type: 'CANVAS_CLICK'
    id: string
}

interface NodeLayoutMessage {
    type: 'NODE_LAYOUT'
    id: string
    x: number
    y: number
    width: number
    height: number
}

type IframeMessage = CanvasClickMessage | NodeLayoutMessage

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum governance badges rendered in a single frame. Criticals fill first. */
const BADGE_CAP = 50

/**
 * Extra pixels beyond the overlay edges still considered "visible".
 * Generous margin to prevent pop-in when scrolling rapidly.
 */
const CULLING_MARGIN = 200

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidMessage(data: unknown): data is IframeMessage {
    if (typeof data !== 'object' || data === null) return false
    const d = data as Record<string, unknown>
    return typeof d.type === 'string'
}

/**
 * Determine the composite severity for a node from its Mithril + A11y data.
 * Returns 'critical' when any Mithril warning is critical or any a11y message
 * exists. Returns 'amber' for amber-only Mithril warnings. Returns 'clean'
 * when no violations are present.
 */
function nodeSeverity(
    mithrilWarnings: LinterWarning[],
    a11yMessages: string[]
): 'critical' | 'amber' | 'clean' {
    if (
        a11yMessages.length > 0 ||
        mithrilWarnings.some((w) => w.severity === 'critical')
    ) {
        return 'critical'
    }
    if (mithrilWarnings.length > 0) return 'amber'
    return 'clean'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShieldOverlay({ iframeRef }: ShieldOverlayProps) {
    // ── Store selectors ──────────────────────────────────────────────────────
    const nodeLayouts        = useCanvasStore((s) => s.nodeLayouts)
    const setNodeLayout      = useCanvasStore((s) => s.setNodeLayout)
    const setActiveSelection = useCanvasStore((s) => s.setActiveSelection)
    const setRightTab        = useCanvasStore((s) => s.setRightTab)
    const setScrollToViolationId = useCanvasStore((s) => s.setScrollToViolationId)
    const mithrilViolations  = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations     = useCanvasStore((s) => s.a11yViolations)
    const canvasMode         = useCanvasStore((s) => s.canvasMode)
    const setSelectedNode    = useEditorStore((s) => s.setSelectedNode)
    const linterWarnings     = useEditorStore((s) => s.linterWarnings)
    const pushNotification   = useNotificationStore((s) => s.push)

    // ── Zero-violations celebration (OPP-09) ─────────────────────────────────
    // Tracks the previous total violation count so we can detect the >0 → 0
    // transition and push a single "All Clear" notification.
    const prevViolationCount = useRef<number>(0)

    const totalViolations =
        mithrilViolations.length + Object.keys(a11yViolations).length

    useEffect(() => {
        if (prevViolationCount.current > 0 && totalViolations === 0) {
            useNotificationStore.getState().push({
                type: 'info',
                title: 'All Clear',
                message: 'All governance violations resolved',
                severity: 'success',
                autoDismissMs: 4000,
            })
        }
        prevViolationCount.current = totalViolations
    }, [totalViolations])

    // ── EDU-15: First-occurrence onboarding tooltip ──────────────────────────
    // Shown once when the first governance badge appears on the canvas so
    // designers know what the badge means without needing a tutorial.
    const { shouldShow: showBadgeOnboarding, dismiss: dismissBadgeOnboarding } =
        useOnboardingTooltip('first-violation')

    // ── Local UI state ───────────────────────────────────────────────────────
    /** The nodeId of the badge currently showing a tooltip, or null. */
    const [hoveredBadgeId, setHoveredBadgeId] = useState<string | null>(null)
    /** Overlay dimensions — used for viewport culling. Updated on resize. */
    const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 })
    const overlayRef = useRef<HTMLDivElement>(null)

    // ── Overlay resize observer ──────────────────────────────────────────────
    useEffect(() => {
        const el = overlayRef.current
        if (!el) return
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            setOverlaySize({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            })
        })
        ro.observe(el)
        // Capture initial size
        setOverlaySize({ width: el.clientWidth, height: el.clientHeight })
        return () => ro.disconnect()
    }, [])

    // ── Presence lock set ────────────────────────────────────────────────────
    // Mutable ref so the message handler always reads the latest value without
    // causing re-renders on every presence poll tick.
    const lockedNodeIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        let cancelled = false

        const poll = async () => {
            if (cancelled) return
            try {
                const rows = await window.flintAPI.readPresence()
                if (!cancelled) {
                    lockedNodeIdsRef.current = new Set(
                        rows.map((r) => r.node_id).filter(Boolean)
                    )
                }
            } catch {
                // IPC unavailable (test env) — leave the set empty
            }
            if (!cancelled) {
                setTimeout(poll, 2000)
            }
        }

        void poll()
        return () => {
            cancelled = true
        }
    }, [])

    // ── postMessage handler ──────────────────────────────────────────────────
    const handleMessage = useCallback(
        (event: MessageEvent) => {
            // Only process messages that originate from our managed iframe.
            // iframeRef.current may be null during unmount — guard accordingly.
            if (
                iframeRef.current &&
                event.source !== iframeRef.current.contentWindow
            ) {
                return
            }
            if (!isValidMessage(event.data)) return

            const msg = event.data

            if (msg.type === 'NODE_LAYOUT') {
                setNodeLayout(msg.id, {
                    x: msg.x,
                    y: msg.y,
                    width: msg.width,
                    height: msg.height,
                })
                return
            }

            if (msg.type === 'CANVAS_CLICK') {
                // Block interaction on nodes locked by remote users
                if (lockedNodeIdsRef.current.has(msg.id)) {
                    pushNotification({
                        type: 'info',
                        title: 'Node Locked',
                        message: 'This element is being edited by another user',
                        severity: 'warning',
                        autoDismissMs: 3000,
                    })
                    return
                }

                // Forward selection to stores
                setSelectedNode(msg.id)
                setActiveSelection(msg.id)
            }
        },
        [iframeRef, setNodeLayout, setSelectedNode, setActiveSelection, pushNotification]
    )

    useEffect(() => {
        window.addEventListener('message', handleMessage)
        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [handleMessage])

    // ── Drag interception on the overlay div ─────────────────────────────────
    const handleOverlayPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (canvasMode !== 'design') return

            // Determine which node the pointer landed on by checking nodeLayouts
            // against the pointer position relative to the overlay.
            const rect = e.currentTarget.getBoundingClientRect()
            const px = e.clientX - rect.left
            const py = e.clientY - rect.top

            for (const [nodeId, layout] of Object.entries(nodeLayouts)) {
                if (
                    px >= layout.x &&
                    px <= layout.x + layout.width &&
                    py >= layout.y &&
                    py <= layout.y + layout.height
                ) {
                    if (lockedNodeIdsRef.current.has(nodeId)) {
                        e.stopPropagation()
                        pushNotification({
                            type: 'info',
                            title: 'Node Locked',
                            message: 'This element is being edited by another user',
                            severity: 'warning',
                            autoDismissMs: 3000,
                        })
                        return
                    }
                    // Not locked — let drag proceed normally
                    break
                }
            }
        },
        [canvasMode, nodeLayouts, pushNotification]
    )

    // Do not render the overlay in interact mode — let events pass through
    if (canvasMode !== 'design') return null

    // ── All node IDs that have any governance badge ──────────────────────────
    const violationNodeIds = new Set<string>([
        ...mithrilViolations,
        ...Object.keys(a11yViolations),
    ])

    // ── Locked node IDs snapshot for render (derived from ref at render time) ─
    // We snapshot here once per render so JSX is stable.
    const lockedIds = lockedNodeIdsRef.current

    // ── Viewport culling: discard nodes outside the visible overlay area ─────
    // Add a generous margin so badges appear before fully scrolled into view.
    const minX = -CULLING_MARGIN
    const minY = -CULLING_MARGIN
    const maxX = overlaySize.width + CULLING_MARGIN
    const maxY = overlaySize.height + CULLING_MARGIN

    function isInViewport(layout: { x: number; y: number; width: number; height: number }) {
        return (
            layout.x + layout.width > minX &&
            layout.x < maxX &&
            layout.y + layout.height > minY &&
            layout.y < maxY
        )
    }

    // ── Collect badge descriptors and apply badge cap ────────────────────────
    interface BadgeDescriptor {
        nodeId: string
        severity: 'critical' | 'amber'
        mithrilWarnings: LinterWarning[]
        a11yMessages: string[]
        layout: { x: number; y: number; width: number; height: number }
    }

    const allBadges: BadgeDescriptor[] = []

    for (const nodeId of violationNodeIds) {
        const layout = nodeLayouts[nodeId]
        if (!layout) continue
        if (!isInViewport(layout)) continue

        const nodeWarnings = linterWarnings.get(nodeId)
        const mithrilWarns: LinterWarning[] = nodeWarnings ? [nodeWarnings] : []
        const a11yMsgs: string[] = a11yViolations[nodeId] ?? []
        const severity = nodeSeverity(mithrilWarns, a11yMsgs)
        if (severity === 'clean') continue

        allBadges.push({ nodeId, severity, mithrilWarnings: mithrilWarns, a11yMessages: a11yMsgs, layout })
    }

    // Sort: criticals first, then ambers
    allBadges.sort((a, b) => {
        if (a.severity === b.severity) return 0
        return a.severity === 'critical' ? -1 : 1
    })

    // Apply cap
    const visibleBadges = allBadges.slice(0, BADGE_CAP)

    // ── Tooltip data for the hovered badge ──────────────────────────────────
    const hoveredBadge = hoveredBadgeId
        ? visibleBadges.find((b) => b.nodeId === hoveredBadgeId) ?? null
        : null

    return (
        <div
            ref={overlayRef}
            className="absolute inset-0 z-10 cursor-crosshair"
            aria-label="Governance violation badges"
            onPointerDown={handleOverlayPointerDown}
        >
            {/* ── Phase U.1: Severity heat tints ──────────────────────────── */}
            {visibleBadges.map(({ nodeId, severity, layout }) => (
                <div
                    key={`heat-${nodeId}`}
                    className={`pointer-events-none absolute rounded-sm ${
                        severity === 'critical'
                            ? 'bg-red-500/10'
                            : 'bg-amber-500/10'
                    }`}
                    style={{
                        left: layout.x,
                        top: layout.y,
                        width: layout.width,
                        height: layout.height,
                    }}
                />
            ))}

            {/* ── Governance violation badges ──────────────────────────────── */}
            {visibleBadges.map(({ nodeId, severity, mithrilWarnings, a11yMessages, layout }) => {
                const isCritical = severity === 'critical'
                const isHovered  = hoveredBadgeId === nodeId
                const violationCount = mithrilWarnings.length + a11yMessages.length

                return (
                    <div
                        key={`badge-${nodeId}`}
                        className="pointer-events-none absolute"
                        style={{
                            left: layout.x,
                            top: layout.y,
                            width: layout.width,
                            height: layout.height,
                        }}
                    >
                        {/* Violation outline */}
                        <div
                            className={`absolute inset-0 rounded-sm border ${
                                isCritical
                                    ? 'border-red-500/60'
                                    : 'border-amber-500/60'
                            }`}
                        />

                        {/* Badge icon + count — top-left corner, interactive */}
                        {/* EDU-02: title tooltip explains what the badge means */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={`${violationCount} governance violation${violationCount !== 1 ? 's' : ''} on ${nodeId}`}
                            title={
                                isCritical
                                    ? `${violationCount} issue${violationCount !== 1 ? 's' : ''} — blocks export. Must be fixed or overridden before you can export.`
                                    : `${violationCount} design system warning${violationCount !== 1 ? 's' : ''}. Click to see details and fix options.`
                            }
                            className={`pointer-events-auto absolute -left-1 -top-1 flex h-5 min-w-5 cursor-pointer items-center gap-0.5 rounded-full px-1 transition-colors ${
                                isCritical
                                    ? `bg-red-900/80 border ${isHovered ? 'border-red-400' : 'border-red-500/40'}`
                                    : `bg-amber-900/80 border ${isHovered ? 'border-amber-400' : 'border-amber-500/40'}`
                            }`}
                            onMouseEnter={() => setHoveredBadgeId(nodeId)}
                            onMouseLeave={() => setHoveredBadgeId(null)}
                            onClick={(e) => {
                                e.stopPropagation()
                                setSelectedNode(nodeId)
                                setActiveSelection(nodeId)
                                setRightTab('properties')
                                setScrollToViolationId(nodeId)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setSelectedNode(nodeId)
                                    setActiveSelection(nodeId)
                                    setRightTab('properties')
                                    setScrollToViolationId(nodeId)
                                }
                            }}
                        >
                            <AlertTriangle
                                className={`h-2.5 w-2.5 shrink-0 ${
                                    isCritical ? 'text-red-400' : 'text-amber-400'
                                }`}
                            />
                            {violationCount > 1 && (
                                <span
                                    className={`text-[10px] font-bold leading-none ${
                                        isCritical ? 'text-red-300' : 'text-amber-300'
                                    }`}
                                >
                                    {violationCount}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}

            {/* ── Phase U.1: Violation tooltip ─────────────────────────────── */}
            {hoveredBadge && (
                <ViolationTooltip
                    nodeId={hoveredBadge.nodeId}
                    position={{
                        // Place tooltip below-right of the badge icon, clamped
                        // to the right so it doesn't overflow left edge.
                        x: Math.max(8, hoveredBadge.layout.x - 4),
                        y: hoveredBadge.layout.y + hoveredBadge.layout.height + 6,
                    }}
                    mithrilWarnings={hoveredBadge.mithrilWarnings}
                    a11yMessages={hoveredBadge.a11yMessages}
                    onClose={() => setHoveredBadgeId(null)}
                />
            )}

            {/* EDU-15: First-occurrence onboarding tooltip ──────────────────── */}
            {/* Shown once when the first badge appears so designers know what  */}
            {/* it means without needing to read documentation.                */}
            {showBadgeOnboarding && visibleBadges.length > 0 && (() => {
                const firstBadge = visibleBadges[0]
                if (!firstBadge) return null
                const tipX = Math.max(8, firstBadge.layout.x - 4)
                const tipY = firstBadge.layout.y + firstBadge.layout.height + 8
                return (
                    <div
                        className="pointer-events-auto absolute z-50"
                        style={{ left: tipX, top: tipY }}
                        data-flint-id="onboarding-tooltip-first-violation"
                    >
                        <div className="w-64 rounded-lg border border-indigo-500/30 bg-zinc-900 p-3 shadow-xl">
                            <div className="mb-1.5 flex items-start justify-between gap-2">
                                <p className="text-xs font-medium text-zinc-100">
                                    This badge means Flint found a design issue.
                                </p>
                                <button
                                    type="button"
                                    onClick={dismissBadgeOnboarding}
                                    className="shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                                    aria-label="Dismiss tip"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                            <p className="text-[11px] leading-relaxed text-zinc-400">
                                Click it to see details and fix options.
                            </p>
                            <button
                                type="button"
                                onClick={dismissBadgeOnboarding}
                                className="mt-2 rounded border border-indigo-500/30 bg-indigo-900/20 px-2 py-0.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-900/40"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )
            })()}

            {/* ── Lock icons for remote-locked nodes (Phase 3D) ───────────── */}
            {Array.from(lockedIds).map((nodeId) => {
                const layout = nodeLayouts[nodeId]
                if (!layout) return null
                if (!isInViewport(layout)) return null

                return (
                    <div
                        key={`lock-${nodeId}`}
                        className="pointer-events-none absolute"
                        style={{
                            left: layout.x + layout.width - 12,
                            top: layout.y - 8,
                        }}
                        title="Locked by another user"
                    >
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 border border-red-500/40">
                            <Lock className="h-2.5 w-2.5 text-red-400" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
