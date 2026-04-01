/**
 * useContrastAudit — src/hooks/useContrastAudit.ts
 *
 * MINT.3b: Hook that fetches WCAG contrast audit results for color token pairs.
 *
 * Calls `tokens:audit-contrast` IPC on mount and exposes:
 * - All contrast pairs
 * - Worst-10 failing pairs (sorted by ratio, ascending)
 * - Passing count and total count
 * - Auditing state
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect } from 'react'
import type { ContrastPair } from '../types/flint-api'

export interface ContrastAuditData {
    /** All contrast pairs returned by the audit. */
    pairs: ContrastPair[]
    /** Worst 10 failing pairs (ratio < 4.5), sorted ascending by ratio. */
    failingPairs: ContrastPair[]
    /** Number of pairs that pass WCAG AA (ratio >= 4.5). */
    passingCount: number
    /** Total number of pairs audited. */
    totalPairs: number
    /** True while the audit is in progress. */
    isAuditing: boolean
}

export function useContrastAudit(): ContrastAuditData {
    const [pairs, setPairs] = useState<ContrastPair[]>([])
    const [isAuditing, setIsAuditing] = useState(false)

    useEffect(() => {
        const fn = window.flintAPI.tokens?.auditContrast
        if (!fn) return

        setIsAuditing(true)
        fn()
            .then(setPairs)
            .catch(() => {})
            .finally(() => setIsAuditing(false))
    }, [])

    const failingPairs = pairs
        .filter((p) => !p.passAA)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 10)

    const passingCount = pairs.filter((p) => p.passAA).length

    return { pairs, failingPairs, passingCount, totalPairs: pairs.length, isAuditing }
}
