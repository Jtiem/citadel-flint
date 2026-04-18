/**
 * TokenHealthBar — src/components/ui/TokenHealthBar.tsx
 *
 * MINT.5 Phase 1 refactor — adopts useTokenHealth + SeverityChip.
 *
 * Visual hierarchy (contract §1.3):
 *   [B+] 84/100  •  3 critical  2 amber  5 advisory
 *
 * Leading element: HealthGradePill (grade + score).
 * Severity pills: <SeverityChip> for each non-zero bucket.
 *   dead             → advisory
 *   drifted          → amber
 *   contrast fail    → critical
 *   scale gaps       → advisory
 *   pending conflict → amber
 *
 * No `syncStatuses`-based drift pill — drift count authority belongs to
 * useTokenUsage (via TokenHealthData.buckets.drifted).
 *
 * Renderer Process only — no Node.js imports.
 */

import { SeverityChip } from './governance/SeverityChip'
import type { TokenHealthData } from '../../hooks/useTokenHealth'
import type { HealthGrade } from '../../../shared/healthScore'

// ── HealthGradePill ────────────────────────────────────────────────────────────

interface HealthGradePillProps {
    grade: HealthGrade
    score: number
}

/**
 * 5-tier color mapping:
 *   A  → emerald (green)
 *   B  → indigo
 *   C  → amber
 *   D  → red/amber
 *   F  → red
 */
const GRADE_PILL_CLASS: Record<HealthGrade, string> = {
    A: 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400',
    B: 'bg-indigo-400/10 border-indigo-500/20 text-indigo-400',
    C: 'bg-amber-400/10 border-amber-500/20 text-amber-400',
    D: 'bg-red-400/10 border-red-500/20 text-red-400',
    F: 'bg-red-500/10 border-red-500/30 text-red-400',
}

function HealthGradePill({ grade, score }: HealthGradePillProps) {
    return (
        <span
            className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
                'text-[11px] font-semibold leading-none',
                GRADE_PILL_CLASS[grade],
            ].join(' ')}
            aria-label={`Health grade ${grade}, score ${score} out of 100`}
            data-testid="health-grade-pill"
        >
            <span className="text-[13px] font-bold leading-none" data-testid="health-grade-letter">
                {grade}
            </span>
            <span className="text-[10px] font-medium opacity-80" data-testid="health-score-number">
                {score}/100
            </span>
        </span>
    )
}

// ── TokenHealthBar ─────────────────────────────────────────────────────────────

export interface TokenHealthBarProps {
    totalTokens: number
    figmaConnected: boolean
    usageFileCount: number
    /**
     * TokenHealthData from useTokenHealth(). When provided, the grade pill and
     * SeverityChip breakdown are rendered. When omitted (e.g. during initial
     * load), only the total-tokens pill is shown.
     */
    health?: TokenHealthData
    /**
     * @deprecated MINT.5 — syncStatuses-based drift pill removed.
     * Prop kept for call-site back-compat but ignored internally.
     * Drift count authority is health.buckets.drifted from useTokenUsage.
     */
    syncStatuses?: unknown[]
    /** @deprecated Use health.buckets.dead instead. */
    deadTokenCount?: number
    /** @deprecated Use health.buckets.drifted instead. */
    driftCount?: number
    /** @deprecated Use health.buckets.scaleGaps instead. */
    scaleGapCount?: number
}

export function TokenHealthBar({
    totalTokens,
    figmaConnected,
    usageFileCount,
    health,
}: TokenHealthBarProps) {
    return (
        <div
            className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800/60 px-3 py-2"
            role="status"
            aria-label="Token health summary"
            data-testid="token-health-bar"
        >
            {/* Leading element: grade pill — only when health data available */}
            {health && (
                <HealthGradePill grade={health.grade} score={health.score} />
            )}

            {/* Total tokens pill */}
            <span
                className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
                data-testid="health-total"
            >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                {totalTokens} token{totalTokens !== 1 ? 's' : ''}
            </span>

            {/* Separator when health chips follow */}
            {health && (health.buckets.contrastFails > 0 || health.buckets.drifted > 0 || health.buckets.dead > 0 || health.buckets.scaleGaps > 0 || health.buckets.pendingConflicts > 0) && (
                <span className="text-zinc-700" aria-hidden="true">•</span>
            )}

            {/* Severity breakdown chips — only non-zero buckets rendered */}
            {health && health.buckets.contrastFails > 0 && (
                <SeverityChip
                    severity="critical"
                    label="contrast fail"
                    count={health.buckets.contrastFails}
                    data-testid="health-chip-contrast"
                />
            )}

            {health && health.buckets.drifted > 0 && (
                <SeverityChip
                    severity="amber"
                    label="drifted"
                    count={health.buckets.drifted}
                    data-testid="health-chip-drifted"
                />
            )}

            {health && health.buckets.pendingConflicts > 0 && (
                <SeverityChip
                    severity="amber"
                    label="pending conflict"
                    count={health.buckets.pendingConflicts}
                    data-testid="health-chip-pending"
                />
            )}

            {health && health.buckets.dead > 0 && (
                <SeverityChip
                    severity="advisory"
                    label="dead"
                    count={health.buckets.dead}
                    data-testid="health-chip-dead"
                />
            )}

            {health && health.buckets.scaleGaps > 0 && (
                <SeverityChip
                    severity="advisory"
                    label="scale gap"
                    count={health.buckets.scaleGaps}
                    data-testid="health-chip-scale-gaps"
                />
            )}

            {/* Figma sync: when connected and no drift, show success pill */}
            {figmaConnected && health && health.buckets.drifted === 0 && (
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400"
                    data-testid="health-sync"
                >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    In sync
                </span>
            )}

            {/* Coverage pill — only when usage data is available */}
            {usageFileCount > 0 && (
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400"
                    data-testid="health-coverage"
                >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                    Used in {usageFileCount} file{usageFileCount !== 1 ? 's' : ''}
                </span>
            )}
        </div>
    )
}
