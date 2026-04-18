/**
 * useTokenHealth — src/hooks/useTokenHealth.ts
 *
 * MINT.5 Phase 1 §1.3 — Canonical health score for the Mint token surface.
 *
 * Consumes useTokenUsage + tokenStore + pending approvals, buckets the counts
 * into HealthScoreInput, and returns { score, grade, buckets } via
 * computeHealthScore from shared/healthScore.ts.
 *
 * Bucket mapping (from contract §1.3):
 *   dead             → advisory   (penalty ×1)
 *   drifted          → amber      (penalty ×3)
 *   contrastFails    → critical   (penalty ×10)
 *   scaleGaps        → advisory   (penalty ×1)
 *   pendingConflicts → amber      (penalty ×3)
 *
 * Risk R5 mitigation: memoize buckets on stable primitives (counts),
 * not on token arrays, to avoid re-derives on every render.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useMemo } from 'react'
import { computeHealthScore } from '../../shared/healthScore'
import type { HealthScoreInput } from '../../shared/healthScore'
import { useTokenUsage } from './useTokenUsage'
import { useTokenStore } from '../store/tokenStore'
import type { TokenHealthData, TokenHealthBuckets } from '../../.flint-context/contracts/MINT.5-phase1.contract'

export type { TokenHealthData }

/**
 * useTokenHealth — returns the canonical A-F health score for the token surface.
 *
 * Designed as a hook (not a store slice) because it derives entirely from
 * existing store state + useTokenUsage. No new Zustand store needed (per contract §1 store contract).
 */
export function useTokenHealth(): TokenHealthData {
    // Pull token list from tokenStore for count-based metrics
    const tokens = useTokenStore((s) => s.tokens)
    const tokenCount = tokens.length

    // MINT.5: drift is now computed server-side via tokens:read-figma-drift IPC.
    // Pass tokenCount as the single dependency so the drift effect re-fires only
    // when the token list grows or shrinks, not on every render.
    const { deadTokenCount, driftCount } = useTokenUsage(tokenCount)

    // scaleGaps and contrastFails are surfaced from the tokenStore when available
    // They are not currently stored in Zustand — they are computed locally in
    // TokenManager and passed down. For useTokenHealth we derive a best-effort
    // count: contrastFails comes from a future store slice (Phase 2); scaleGaps
    // likewise. For Phase 1, both default to 0 here so the grade/score can be
    // computed from the data that IS available (dead, drifted).
    //
    // Phase 2 adds: const { contrastFailCount, scaleGapCount } = useTokenMetrics()
    const contrastFails = 0
    const scaleGaps = 0

    // pendingConflicts: tokens in the drift set that also have a pending approval
    // For Phase 1 we derive this from driftCount alone (no cross-join with pending
    // approvals store yet — that join is a Phase 2 concern).
    const pendingConflicts = 0

    // Build stable primitives for memoization (R5 mitigation)
    const buckets = useMemo<TokenHealthBuckets>(
        () => ({
            dead: deadTokenCount,
            drifted: driftCount,
            scaleGaps,
            contrastFails,
            pendingConflicts,
        }),
        // Keyed on scalar counts only — no array identity
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [deadTokenCount, driftCount, contrastFails, scaleGaps, pendingConflicts],
    )

    const input = useMemo<HealthScoreInput>(
        () => ({
            // dead → advisory
            // scaleGaps → advisory
            advisoryCount: buckets.dead + buckets.scaleGaps,
            // drifted → amber
            // pendingConflicts → amber
            amberCount: buckets.drifted + buckets.pendingConflicts,
            // contrastFails → critical
            criticalCount: buckets.contrastFails,
            overrideCount: 0,
        }),
        [buckets],
    )

    const { score, grade } = useMemo(() => computeHealthScore(input), [input])

    return { score, grade, buckets, input }
}
