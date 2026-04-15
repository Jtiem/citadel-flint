/**
 * useGovernanceCategories — src/hooks/useGovernanceCategories.ts
 *
 * Owns: category filter, chip counts, filtered violation lists.
 * Extracted from GovernanceDashboard.tsx lines ~581-608.
 *
 * Categories:
 *   'design-system' — non-sync Mithril violations
 *   'accessibility'  — a11y violations
 *   'token-sync'    — sync-type violations
 *   null            — all violations (no filter active)
 */

import { useState, useMemo } from 'react'
import type { LinterWarning } from '../types/flint-api'
import type { UseGovernanceCategoriesResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'
import type { UseGovernanceDeltaResult } from './useGovernanceDelta'

export type { UseGovernanceCategoriesResult }

interface UseGovernanceCategoriesOptions {
    delta: Pick<UseGovernanceDeltaResult, 'deltaWarnings'>
}

export function useGovernanceCategories({ delta }: UseGovernanceCategoriesOptions): UseGovernanceCategoriesResult {
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

    // Split delta warnings into Mithril vs A11y
    const allLinterWarnings = useMemo<LinterWarning[]>(
        () => delta.deltaWarnings.filter((w) => w.type !== 'a11y'),
        [delta.deltaWarnings],
    )

    const allA11yWarnings = useMemo<LinterWarning[]>(
        () => delta.deltaWarnings.filter((w) => w.type === 'a11y'),
        [delta.deltaWarnings],
    )

    // ── Category chip counts ─────────────────────────────────────────────────
    const syncCount = allLinterWarnings.filter((w) => w.type === 'sync').length
    const designSystemCount = allLinterWarnings.filter((w) => w.type !== 'sync').length
    const accessibilityCount = allA11yWarnings.length

    const chipCounts: Record<string, number> = useMemo(() => ({
        'design-system': designSystemCount,
        'accessibility': accessibilityCount,
        'token-sync': syncCount,
    }), [designSystemCount, accessibilityCount, syncCount])

    // ── Filtered violation lists ─────────────────────────────────────────────
    const visibleLinterWarnings = useMemo<LinterWarning[]>(() => {
        if (categoryFilter === null) return allLinterWarnings
        if (categoryFilter === 'design-system') return allLinterWarnings.filter((w) => w.type !== 'sync')
        if (categoryFilter === 'token-sync') return allLinterWarnings.filter((w) => w.type === 'sync')
        return []
    }, [allLinterWarnings, categoryFilter])

    const visibleA11yWarnings = useMemo<LinterWarning[]>(() => {
        if (categoryFilter === null || categoryFilter === 'accessibility') return allA11yWarnings
        return []
    }, [allA11yWarnings, categoryFilter])

    return {
        categoryFilter,
        setCategoryFilter,
        chipCounts,
        visibleLinterWarnings,
        visibleA11yWarnings,
        effectiveA11yWarnings: allA11yWarnings,
    }
}
