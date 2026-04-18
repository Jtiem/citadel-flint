/**
 * CoverageBadge.tsx — src/components/editor/CoverageBadge.tsx
 *
 * Phase 0 — Coverage Honesty
 *
 * A StatusBar pill that communicates the governed-surface percentage at a glance.
 *
 * Three visual states controlled by `data-coverage-state`:
 *   healthy — 100% governed  (green dot)
 *   warning — <100% governed (indigo dot — neutral, not an error signal)
 *   idle    — no scan yet / null summary (zinc dot)
 *
 * Commandment compliance:
 *   C2 (No Hallucinated Styling)  — dot color comes from the COVERAGE_DOT_COLOR
 *     map below, mirroring the pattern used by figmaDotColor() and IDESyncChip
 *     in StatusBar.tsx. Raw bg-emerald-500 literals are NOT used as className;
 *     they live in this single map and are applied via the data-coverage-state
 *     attribute guard.
 *   C5 (Accessibility is a Compiler Error) — button carries an aria-label that
 *     conveys the percentage and hints at the popover. Idle state opens an
 *     educational popover — buttons MUST respond to activation.
 *
 * Performance invariant (coverage-badge-click-latency < 50ms at p95): the
 * label and aria-label are derived from `summary` via useMemo, not on every
 * render in the event handler path.
 *
 * UX fixes (Phase 0 review):
 *   Fix 1 — Idle button now opens an idle popover (no more no-op clicks).
 *   Fix 3 — title attribute on button surfaces the informational-nature note.
 *   Fix 4 — Partial coverage dot changed from amber to indigo to avoid
 *            false-alarm confusion with Mithril/Figma amber signals.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useCoverageSummary } from '../../hooks/useCoverageSummary'
import { CoveragePopover } from './CoveragePopover'
import type { CoverageSummary } from '../../../shared/coverage-types'

// ── Design-token color map (mirrors figmaDotColor + IDESyncChip patterns) ────
//
// Commandment 2: dot colors come from this single declared map.
// The `data-coverage-state` attribute drives which class is applied.
// Tests assert on data-coverage-state, not on the raw class name.
//
// Fix 4: 'warning' dot changed from bg-amber-400 to bg-indigo-400.
// Amber is reserved for Mithril ΔE violations and Figma staleness warnings.
// A partial coverage state in indigo reads as "informational, not alarming."
const COVERAGE_DOT_COLOR: Record<'healthy' | 'warning' | 'idle', string> = {
    healthy: 'bg-emerald-400',
    warning: 'bg-indigo-400',
    idle: 'bg-zinc-500',
}

// ── State derivation (pure, memoized) ─────────────────────────────────────────

type CoverageState = 'healthy' | 'warning' | 'idle'

function deriveCoverageState(summary: CoverageSummary | null): CoverageState {
    if (summary === null) return 'idle'
    if (summary.totalFiles === 0) return 'idle'
    if (summary.governedSurfacePercent === 100) return 'healthy'
    return 'warning'
}

function deriveLabel(summary: CoverageSummary | null, state: CoverageState): string {
    if (state === 'idle') return '—'
    // summary is non-null when state is healthy/warning
    return `${summary!.governedSurfacePercent}% governed`
}

function deriveAriaLabel(summary: CoverageSummary | null, state: CoverageState): string {
    if (state === 'idle') {
        if (summary === null) return 'Governance coverage: loading'
        // totalFiles === 0 — no scan completed yet
        return 'Coverage pending, no scan completed yet'
    }
    return `Governance coverage: ${summary!.governedSurfacePercent}% of files governed. Click to see breakdown.`
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Self-contained StatusBar badge. Calls useCoverageSummary() internally so
 * the parent (StatusBar) never needs to know about coverage IPC.
 */
export function CoverageBadge() {
    const { summary } = useCoverageSummary()
    const [popoverOpen, setPopoverOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    // ── Memoized derived values ────────────────────────────────────────────────
    const state = useMemo(() => deriveCoverageState(summary), [summary])
    const label = useMemo(() => deriveLabel(summary, state), [summary, state])
    const ariaLabel = useMemo(() => deriveAriaLabel(summary, state), [summary, state])
    const dotColor = COVERAGE_DOT_COLOR[state]

    // Fix 3: title surfacing the informational-nature note at the badge level.
    // Visible text ("60% governed") doesn't change — that's contract-verified.
    // The tooltip is an additive affordance so users don't misread it as a grade.
    const titleAttr = state === 'idle'
        ? 'Click to learn how to run a coverage scan'
        : `${label} (click for breakdown). Coverage is informational — does not change your grade.`

    // ── Click handler ──────────────────────────────────────────────────────────
    // Fix 1: idle state now also opens the popover (educational idle variant).
    // Previously handleClick no-oped when summary === null, making it an
    // announced-but-unresponsive button — an a11y and discoverability failure.
    const handleClick = useCallback(() => {
        setPopoverOpen((v) => !v)
    }, [])

    // ── Close on outside click ─────────────────────────────────────────────────
    useEffect(() => {
        if (!popoverOpen) return
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setPopoverOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [popoverOpen])

    // ── Close on Escape ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!popoverOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPopoverOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [popoverOpen])

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                data-coverage-state={state}
                onClick={handleClick}
                className="flex min-h-[24px] cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label={ariaLabel}
                title={titleAttr}
                data-testid="coverage-badge"
            >
                <span
                    className={`h-2 w-2 rounded-full ${dotColor}`}
                    aria-hidden="true"
                />
                {label}
            </button>

            {popoverOpen && state === 'idle' && (
                <CoveragePopover
                    mode="idle"
                    onClose={() => setPopoverOpen(false)}
                />
            )}

            {popoverOpen && state !== 'idle' && summary !== null && (
                <CoveragePopover
                    summary={summary}
                    onClose={() => setPopoverOpen(false)}
                />
            )}
        </div>
    )
}
