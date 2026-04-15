/**
 * useGovernanceTokenImpact — src/hooks/useGovernanceTokenImpact.ts
 *
 * H10: Token change impact preview.
 *
 * Extracts the COUNSEL.4.1 token impact preview logic from
 * GovernanceDashboard.tsx (lines ~1316–1366).
 *
 * Behaviour:
 *   - Exposes `impactPreview` (current computed impact or null) and
 *     `isComputing` flag.
 *   - `refresh(tokenName?)` triggers a manual on-demand impact fetch.
 *   - The dashboard component drives automatic refresh when sync warnings
 *     change — this hook deliberately does not own that dependency to keep
 *     it decoupled from violation state.
 *
 * Zero .getState() in render path.
 */

import { useState, useCallback } from 'react'
import type { UseGovernanceTokenImpactResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceTokenImpactResult }

export function useGovernanceTokenImpact(): UseGovernanceTokenImpactResult {
    const [impactPreview, setImpactPreview] = useState<unknown | null>(null)
    const [isComputing, setIsComputing] = useState(false)

    const refresh = useCallback(async (tokenPath?: string) => {
        const api = window.flintAPI.governance
        if (!api.previewTokenImpact) return
        const name = tokenPath ?? (impactPreview && typeof impactPreview === 'object' && 'tokenName' in impactPreview
            ? (impactPreview as { tokenName: string }).tokenName
            : '')
        if (!name) return
        setIsComputing(true)
        try {
            const result = await api.previewTokenImpact(name, '')
            setImpactPreview({ tokenName: name, ...result })
        } catch {
            setImpactPreview(null)
        } finally {
            setIsComputing(false)
        }
    }, [impactPreview])

    return {
        impactPreview,
        isComputing,
        refresh,
    }
}
