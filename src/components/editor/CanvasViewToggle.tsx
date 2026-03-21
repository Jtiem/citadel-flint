/**
 * CanvasViewToggle — src/components/editor/CanvasViewToggle.tsx
 *
 * CV2.1 — Segmented control that switches the canvas between Preview,
 * Build, and Govern view modes.
 *
 * Positioned absolutely in the top-center of the canvas area so it floats
 * above the content in all three modes.
 *
 * Mithril Safety: all colour classes use Flint design token palette.
 * No hardcoded hex values. No arbitrary spacing.
 */

import { Eye, LayoutGrid, ShieldCheck } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import type { CanvasView } from '../../store/canvasStore'

// ── Segment definition ────────────────────────────────────────────────────────

interface Segment {
    view: CanvasView
    label: string
    Icon: typeof Eye
    testId: string
    ariaLabel: string
    title: string
}

const SEGMENTS: Segment[] = [
    {
        view: 'preview',
        label: 'Preview',
        Icon: Eye,
        testId: 'canvas-view-preview',
        ariaLabel: 'Switch to Preview mode',
        title: 'Preview — Live Preview iframe (Cmd+1)',
    },
    {
        view: 'build',
        label: 'Build',
        Icon: LayoutGrid,
        testId: 'canvas-view-build',
        ariaLabel: 'Switch to Build mode',
        title: 'Build — Component library (Cmd+2)',
    },
    {
        view: 'govern',
        label: 'Govern',
        Icon: ShieldCheck,
        testId: 'canvas-view-govern',
        ariaLabel: 'Switch to Govern mode',
        title: 'Govern — Compliance map (Cmd+3)',
    },
]

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CanvasViewToggle
 *
 * Self-contained segmented control. No props required — reads and writes
 * `canvasView` directly from canvasStore via the Zustand selector pattern.
 *
 * Rendered inside XYCanvas so it appears in all three view modes. The
 * parent must be `position: relative` for the `absolute` positioning to work.
 */
export function CanvasViewToggle() {
    const canvasView = useCanvasStore((s) => s.canvasView)
    const setCanvasView = useCanvasStore((s) => s.setCanvasView)

    return (
        <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex rounded-lg border border-zinc-700 bg-zinc-900/90 p-1 shadow-lg backdrop-blur-sm"
            role="group"
            aria-label="Canvas view mode"
        >
            {SEGMENTS.map(({ view, label, Icon, testId, ariaLabel, title }) => {
                const isActive = canvasView === view
                return (
                    <button
                        key={view}
                        type="button"
                        data-testid={testId}
                        aria-label={ariaLabel}
                        aria-pressed={isActive}
                        title={title}
                        onClick={() => setCanvasView(view)}
                        className={[
                            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            isActive
                                ? 'bg-indigo-600 text-white'
                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                        ].join(' ')}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
