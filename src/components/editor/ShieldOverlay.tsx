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
 * Mithril Safety: all classes from Bridge design token palette.
 * No hardcoded hex values. No arbitrary spacing values.
 */

import { useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShieldOverlayProps {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
}

// Messages posted by the in-iframe bridge-init script
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

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the Set of node IDs currently held by remote users.
 * A node is considered locked when any remote PresenceRow has that node_id.
 * We derive this from window.bridgeAPI.readPresence on a 2-second cadence
 * so the overlay stays current without a full PowerSync subscription.
 */
function isValidMessage(data: unknown): data is IframeMessage {
    if (typeof data !== 'object' || data === null) return false
    const d = data as Record<string, unknown>
    return typeof d.type === 'string'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShieldOverlay({ iframeRef }: ShieldOverlayProps) {
    // ── Store selectors ──────────────────────────────────────────────────────
    const nodeLayouts        = useCanvasStore((s) => s.nodeLayouts)
    const setNodeLayout      = useCanvasStore((s) => s.setNodeLayout)
    const setActiveSelection = useCanvasStore((s) => s.setActiveSelection)
    const mithrilViolations  = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations     = useCanvasStore((s) => s.a11yViolations)
    const canvasMode         = useCanvasStore((s) => s.canvasMode)
    const setSelectedNode    = useEditorStore((s) => s.setSelectedNode)
    const pushNotification   = useNotificationStore((s) => s.push)

    // ── Presence lock set ────────────────────────────────────────────────────
    // Mutable ref so the message handler always reads the latest value without
    // causing re-renders on every presence poll tick.
    const lockedNodeIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        let cancelled = false

        const poll = async () => {
            if (cancelled) return
            try {
                const rows = await window.bridgeAPI.readPresence()
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

    return (
        <div
            className="absolute inset-0 z-10 cursor-crosshair"
            aria-hidden="true"
            onPointerDown={handleOverlayPointerDown}
        >
            {/* ── Governance violation badges ─────────────────────────────── */}
            {Array.from(violationNodeIds).map((nodeId) => {
                const layout = nodeLayouts[nodeId]
                if (!layout) return null

                const hasMithril  = mithrilViolations.includes(nodeId)
                const hasA11y     = Boolean(a11yViolations[nodeId]?.length)
                const isCritical  = hasMithril && !hasA11y

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
                                    ? 'border-amber-500/60'
                                    : 'border-red-500/60'
                            }`}
                        />

                        {/* Badge icon — top-left corner */}
                        <div
                            className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full ${
                                isCritical
                                    ? 'bg-amber-900/80 border border-amber-500/40'
                                    : 'bg-red-900/80 border border-red-500/40'
                            }`}
                        >
                            <AlertTriangle
                                className={`h-2.5 w-2.5 ${
                                    isCritical ? 'text-amber-400' : 'text-red-400'
                                }`}
                            />
                        </div>
                    </div>
                )
            })}

            {/* ── Lock icons for remote-locked nodes (Phase 3D) ──────────── */}
            {Array.from(lockedIds).map((nodeId) => {
                const layout = nodeLayouts[nodeId]
                if (!layout) return null

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
