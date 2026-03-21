/**
 * DependencyEdge.test.tsx
 *
 * Phase CV2.3 — Unit tests for the DependencyEdge custom React Flow edge.
 *
 * Tests (contract §7):
 *   DE-01: Renders an SVG path element with the edge path data
 *   DE-02: Renders the "used in" label text at the edge midpoint
 *   DE-03: Uses emerald stroke color (#10b981) for grade A
 *   DE-04: Uses emerald stroke color (#10b981) for grade B
 *   DE-05: Uses amber stroke color (#f59e0b) for grade C
 *   DE-06: Uses red stroke color (#ef4444) for grade D
 *   DE-07: Uses red stroke color (#ef4444) for grade F
 *   DE-08: Uses zinc-600 stroke color (#52525b) when grade is null
 *   DE-09: Applies animated-edge class and animation style for grade C (has violations)
 *   DE-10: Applies animated-edge class and animation style for grade D (has violations)
 *   DE-11: Applies animated-edge class and animation style for grade F (has violations)
 *   DE-12: Does NOT apply animated-edge class for grade A (no violations)
 *   DE-13: Does NOT apply animated-edge class for grade B (no violations)
 *   DE-14: Does NOT apply animated-edge class when grade is null
 *   DE-15: Path uses stroke-dasharray="4 4" (dashed line per contract §7)
 *   DE-16: Renders CSS keyframe animation style block when violations present
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DependencyEdge } from '../DependencyEdge'
import type { Edge, EdgeProps } from '@xyflow/react'
import type { DependencyEdgeData } from '../../../store/componentCardStore'
import type { ComponentHealth } from '../../../types/flint-api'
import { Position } from '@xyflow/react'

// ── Mock @xyflow/react ────────────────────────────────────────────────────────
// getBezierPath returns [path, labelX, labelY]. We return a fixed SVG path
// string so tests can inspect the rendered <path d="..."> attribute.
// EdgeLabelRenderer is a portal wrapper — in jsdom we render its children inline.

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>()
    return {
        ...actual,
        getBezierPath: () => ['M0,0 C50,0 50,100 100,100', 50, 50] as [string, number, number],
        EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="edge-label-renderer">{children}</div>
        ),
        Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
    }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEdgeProps(
    targetGrade: ComponentHealth['grade'] | null,
    overrides: Partial<EdgeProps<Edge<DependencyEdgeData>>> = {},
): EdgeProps<Edge<DependencyEdgeData>> {
    return {
        id: 'dep-card-a-card-b',
        source: 'card-a',
        target: 'card-b',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { targetGrade },
        selected: false,
        animated: false,
        markerEnd: undefined,
        markerStart: undefined,
        interactionWidth: 20,
        ...overrides,
    } as EdgeProps<Edge<DependencyEdgeData>>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DependencyEdge', () => {
    // DE-01: Renders an SVG path element
    it('DE-01: renders an SVG path element with the bezier path data', () => {
        const { container } = render(
            <svg>
                <DependencyEdge {...makeEdgeProps('A')} />
            </svg>,
        )

        const path = container.querySelector('path')
        expect(path).not.toBeNull()
        expect(path!.getAttribute('d')).toBe('M0,0 C50,0 50,100 100,100')
    })

    // DE-02: Renders the "used in" label
    it('DE-02: renders the "used in" label text', () => {
        render(
            <svg>
                <DependencyEdge {...makeEdgeProps('A')} />
            </svg>,
        )

        expect(screen.getByText('used in')).toBeDefined()
    })

    // DE-03 / DE-04: Emerald stroke for A and B grades
    it.each([['A'], ['B']] as Array<[ComponentHealth['grade']]>)(
        'DE-03/04: uses emerald stroke (#10b981) for grade %s',
        (grade) => {
            const { container } = render(
                <svg>
                    <DependencyEdge {...makeEdgeProps(grade)} />
                </svg>,
            )

            const path = container.querySelector('path')
            expect(path!.getAttribute('stroke')).toBe('#10b981')
        },
    )

    // DE-05: Amber stroke for grade C
    it('DE-05: uses amber stroke (#f59e0b) for grade C', () => {
        const { container } = render(
            <svg>
                <DependencyEdge {...makeEdgeProps('C')} />
            </svg>,
        )

        const path = container.querySelector('path')
        expect(path!.getAttribute('stroke')).toBe('#f59e0b')
    })

    // DE-06 / DE-07: Red stroke for D and F grades
    it.each([['D'], ['F']] as Array<[ComponentHealth['grade']]>)(
        'DE-06/07: uses red stroke (#ef4444) for grade %s',
        (grade) => {
            const { container } = render(
                <svg>
                    <DependencyEdge {...makeEdgeProps(grade)} />
                </svg>,
            )

            const path = container.querySelector('path')
            expect(path!.getAttribute('stroke')).toBe('#ef4444')
        },
    )

    // DE-08: Zinc-600 stroke when grade is null (no health data)
    it('DE-08: uses zinc-600 stroke (#52525b) when targetGrade is null', () => {
        const { container } = render(
            <svg>
                <DependencyEdge {...makeEdgeProps(null)} />
            </svg>,
        )

        const path = container.querySelector('path')
        expect(path!.getAttribute('stroke')).toBe('#52525b')
    })

    // DE-09 / DE-10 / DE-11: Animated edge class for violation grades (C, D, F)
    it.each([['C'], ['D'], ['F']] as Array<[ComponentHealth['grade']]>)(
        'DE-09/10/11: applies animated-edge class for grade %s (has violations)',
        (grade) => {
            const { container } = render(
                <svg>
                    <DependencyEdge {...makeEdgeProps(grade)} />
                </svg>,
            )

            const path = container.querySelector('path')
            expect(path!.classList.contains('animated-edge')).toBe(true)
            // Animation style should be set
            expect(path!.getAttribute('style')).toContain('animation')
        },
    )

    // DE-12 / DE-13: No animated-edge class for clean grades (A, B)
    it.each([['A'], ['B']] as Array<[ComponentHealth['grade']]>)(
        'DE-12/13: does not apply animated-edge class for grade %s (no violations)',
        (grade) => {
            const { container } = render(
                <svg>
                    <DependencyEdge {...makeEdgeProps(grade)} />
                </svg>,
            )

            const path = container.querySelector('path')
            expect(path!.classList.contains('animated-edge')).toBe(false)
            expect(path!.getAttribute('style')).toBeNull()
        },
    )

    // DE-14: No animated-edge class when grade is null
    it('DE-14: does not apply animated-edge class when targetGrade is null', () => {
        const { container } = render(
            <svg>
                <DependencyEdge {...makeEdgeProps(null)} />
            </svg>,
        )

        const path = container.querySelector('path')
        expect(path!.classList.contains('animated-edge')).toBe(false)
        expect(path!.getAttribute('style')).toBeNull()
    })

    // DE-15: Path uses stroke-dasharray="4 4" (dashed line per spec)
    it('DE-15: path has stroke-dasharray="4 4" (dashed line per contract §7)', () => {
        const { container } = render(
            <svg>
                <DependencyEdge {...makeEdgeProps('A')} />
            </svg>,
        )

        const path = container.querySelector('path')
        expect(path!.getAttribute('stroke-dasharray')).toBe('4 4')
    })

    // DE-16: CSS keyframe style block is rendered when violations are present
    it('DE-16: renders CSS keyframe style block when target has violations (grade F)', () => {
        const { container } = render(
            <svg>
                <DependencyEdge {...makeEdgeProps('F')} />
            </svg>,
        )

        // The <style> tag with the dash-flow keyframe should be present
        const styleEl = container.querySelector('style')
        expect(styleEl).not.toBeNull()
        expect(styleEl!.textContent).toContain('dash-flow')
        expect(styleEl!.textContent).toContain('stroke-dashoffset')
    })

    // Edge: data prop is undefined — should not crash, defaults grade to null
    it('renders without error when data prop is undefined (defaults to null grade)', () => {
        expect(() =>
            render(
                <svg>
                    <DependencyEdge {...makeEdgeProps(null, { data: undefined })} />
                </svg>,
            ),
        ).not.toThrow()
    })
})
