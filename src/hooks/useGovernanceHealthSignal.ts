/**
 * useGovernanceHealthSignal — src/hooks/useGovernanceHealthSignal.ts
 *
 * H11: Sub-scores, coaching sentence, top-5 rules, sparkline history.
 *
 * Extracts health signal logic from GovernanceDashboard.tsx:
 *   - lines ~859–925: nextStep coaching sentence, topRules
 *   - lines ~1368–1405: healthHistory fetch + sparkline data
 *
 * Dependencies:
 *   - Receives mithrilCount, a11yCount, overrideCount, score, grade as params
 *     to avoid circular state (callers pass these from their own derived state).
 *   - Reads tokenCount from tokenStore to guard recordHealth calls.
 *
 * Zero .getState() in render path.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useTokenStore } from '../store/tokenStore'
import type { LinterWarning } from '../types/flint-api'
import type { UseGovernanceHealthSignalResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceHealthSignalResult }

export interface HealthSignalInput {
    mithrilCount: number
    a11yCount: number
    overrideCount: number
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Effective linter warnings (delta-filtered) for top-rules computation. */
    effectiveLinterWarnings: LinterWarning[]
}

export function useGovernanceHealthSignal(input: HealthSignalInput): UseGovernanceHealthSignalResult {
    const { mithrilCount, a11yCount, overrideCount, score, grade, effectiveLinterWarnings } = input
    const tokenCount = useTokenStore((s) => s.tokens.length)

    // ── COUNSEL.4.2: Health history for sparkline ────────────────────────────
    const [healthHistory, setHealthHistory] = useState<Array<{ date: string; score: number; grade: string }>>([])
    const prevScoreRef = useRef<number | null>(null)

    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getHealthHistory) {
            void api.getHealthHistory()
                .then(setHealthHistory)
                .catch((err: unknown) => {
                    console.warn('[Flint] useGovernanceHealthSignal: failed to load health history', err)
                    setHealthHistory([])
                })
        }
    }, [])

    // Record health entry when score changes (debounced by React batching)
    useEffect(() => {
        if (prevScoreRef.current === null) {
            prevScoreRef.current = score
            return
        }
        if (prevScoreRef.current === score) return
        prevScoreRef.current = score
        const api = window.flintAPI.governance
        if (api.recordHealth && tokenCount > 0) {
            void api.recordHealth({ score, grade })
                .then(() => {
                    if (api.getHealthHistory) {
                        void api.getHealthHistory()
                            .then(setHealthHistory)
                            .catch((err) => console.warn('[Flint] useGovernanceHealthSignal: failed to refresh history', err))
                    }
                })
                .catch((err) => console.warn('[Flint] useGovernanceHealthSignal: failed to record health', err))
        }
    }, [score, grade, tokenCount])

    // ── Sub-scores ───────────────────────────────────────────────────────────
    const subScores = useMemo(() => ({
        mithril: Math.max(0, Math.min(100, 100 - mithrilCount * 3)),
        a11y: Math.max(0, Math.min(100, 100 - a11yCount * 10)),
        overrides: Math.max(0, Math.min(100, 100 - overrideCount * 3)),
    }), [mithrilCount, a11yCount, overrideCount])

    // ── Top-5 violated rules ─────────────────────────────────────────────────
    const topRules = useMemo(() => {
        const buckets = new Map<string, { ruleId: string; count: number; severity: LinterWarning['severity'] }>()

        for (const warning of effectiveLinterWarnings) {
            const key = `${warning.type}:${warning.severity}`
            const existing = buckets.get(key)
            if (existing) {
                existing.count += 1
            } else {
                buckets.set(key, {
                    ruleId: warning.type,
                    severity: warning.severity,
                    count: 1,
                })
            }
        }

        // A11y synthetic row
        if (a11yCount > 0) {
            buckets.set('a11y:critical', {
                ruleId: 'a11y',
                severity: 'critical',
                count: a11yCount,
            })
        }

        return Array.from(buckets.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
    }, [effectiveLinterWarnings, a11yCount])

    // ── Coaching sentence ────────────────────────────────────────────────────
    const coachingSentence = useMemo(() => {
        const total = mithrilCount + a11yCount + overrideCount
        if (score === 100) {
            return 'Perfect score — your design system is fully in sync.'
        }
        if (overrideCount > mithrilCount + a11yCount) {
            return `${overrideCount} rule override${overrideCount !== 1 ? 's are' : ' is'} active. Review them in the Governance panel to restore full compliance.`
        }
        if (score >= 90) {
            const category = a11yCount > mithrilCount
                ? 'accessibility gap' + (total !== 1 ? 's' : '')
                : 'design drift' + (total !== 1 ? 's' : '')
            return `Nearly perfect. ${total} ${category} remain — say 'fix it' in your IDE to clean up.`
        }
        if (a11yCount > 0 && mithrilCount > 0) {
            if (a11yCount > mithrilCount) {
                return `${a11yCount} accessibility gap${a11yCount !== 1 ? 's are' : ' is'} pulling your score down. Run an a11y audit for details.`
            }
            return `${mithrilCount} color drift${mithrilCount !== 1 ? 's are' : ' is'} lowering your score. Say 'fix it' in your IDE to auto-remediate.`
        }
        if (a11yCount > 0) {
            return `${a11yCount} accessibility gap${a11yCount !== 1 ? 's are' : ' is'} pulling your score down. Run an a11y audit for details.`
        }
        if (mithrilCount > 0) {
            return `${mithrilCount} color drift${mithrilCount !== 1 ? 's are' : ' is'} lowering your score. Say 'fix it' in your IDE to auto-remediate.`
        }
        return `${mithrilCount} drift${mithrilCount !== 1 ? 's' : ''} and ${a11yCount} accessibility gap${a11yCount !== 1 ? 's' : ''} need attention. Start with accessibility — it has the biggest score impact.`
    }, [mithrilCount, a11yCount, overrideCount, score])

    return {
        score,
        grade,
        subScores,
        coachingSentence,
        topRules,
        sparklineData: healthHistory,
    }
}
