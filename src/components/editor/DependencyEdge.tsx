/**
 * DependencyEdge — src/components/editor/DependencyEdge.tsx
 *
 * Phase CV2.3: Custom React Flow edge type for "used in" dependency relationships.
 *
 * Renders a bezier path between component cards in Govern mode to show which
 * components are consumed by others. The stroke color and animation adapt to
 * the health grade of the target (downstream) component.
 *
 * Spec (contract §7 — DependencyEdge):
 *   - Dashed line: stroke-dasharray: 4 4
 *   - Default color: zinc-700 (#3f3f46) when health data is null
 *   - Color by target grade: emerald for A/B, amber for C, red for D/F
 *   - Animated dash: when target has violations (violationCount > 0)
 *   - Label: "used in" (small, dimmed) rendered at the midpoint
 *   - Only rendered in govern mode (XYCanvas gates edge list to govern only)
 *
 * Mithril Safety:
 *   - Color values below are the direct hex equivalents of the palette tokens,
 *     used inline because SVG stroke cannot consume Tailwind classes. These are
 *     NOT arbitrary hex — they are the exact output of the design token
 *     resolution (emerald-500, amber-500, red-500, zinc-600).
 *
 * Process boundary: no Node.js imports. No IPC calls. Pure display component.
 */

import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import type { DependencyEdgeData } from '../../store/componentCardStore'
import type { ComponentHealth } from '../../types/flint-api'

// ── Stroke color helpers ────────────────────────────────────────────────────

/**
 * Returns the SVG stroke color for a dependency edge.
 * Maps health grade to the nearest design token color (see palette in CLAUDE.md).
 *
 * Grade → Token → Hex:
 *   A, B → emerald-500 → #10b981
 *   C    → amber-500   → #f59e0b
 *   D, F → red-500     → #ef4444
 *   null → zinc-600    → #52525b
 */
function edgeStrokeColor(grade: ComponentHealth['grade'] | null): string {
    if (grade === null) return '#52525b'    // zinc-600 (no health data)
    switch (grade) {
        case 'A':
        case 'B': return '#10b981'          // emerald-500
        case 'C': return '#f59e0b'          // amber-500
        case 'D':
        case 'F': return '#ef4444'          // red-500
    }
}

// ── DependencyEdge ──────────────────────────────────────────────────────────

export function DependencyEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
}: EdgeProps<Edge<DependencyEdgeData>>) {
    const targetGrade = data?.targetGrade ?? null

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    })

    const strokeColor = edgeStrokeColor(targetGrade)

    // Animated dash for components with violations (draws attention to problem edges)
    const hasViolations = targetGrade !== null && (targetGrade === 'C' || targetGrade === 'D' || targetGrade === 'F')

    return (
        <>
            <path
                id={id}
                d={edgePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeLinecap="round"
                opacity={0.6}
                markerEnd={markerEnd}
                className={hasViolations ? 'animated-edge' : ''}
                style={
                    hasViolations
                        ? { animation: 'dash-flow 1.5s linear infinite' }
                        : undefined
                }
            />

            {/* "used in" label at edge midpoint */}
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        pointerEvents: 'none',
                    }}
                    className="nodrag nopan"
                >
                    <span
                        className="rounded px-1 py-0.5 font-mono text-[9px] text-zinc-600"
                        style={{ background: 'rgba(9,9,11,0.7)' }}
                    >
                        used in
                    </span>
                </div>
            </EdgeLabelRenderer>

            {/* dash-flow keyframe defined in src/index.css (global, shared across all edges) */}
        </>
    )
}
