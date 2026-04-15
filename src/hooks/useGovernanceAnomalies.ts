/**
 * useGovernanceAnomalies — src/hooks/useGovernanceAnomalies.ts
 *
 * H6: Anomaly fetch, anomaly dismissal, provenance map.
 *
 * Extracts the COUNSEL.3.2 (provenance) and COUNSEL.3.3 (anomaly alerts)
 * logic from GovernanceDashboard.tsx (lines ~639–677).
 *
 * Lifecycle:
 *   - On mount: fetches anomaly alerts via IPC; if activeFilePath is set,
 *     also fetches provenance map.
 *   - When activeFilePath changes: re-fetches provenance map.
 *   - Cleanup: no subscriptions — one-shot fetches only.
 *
 * Zero .getState() in render path.
 */

import { useState, useEffect, useCallback } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import type { UseGovernanceAnomaliesResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceAnomaliesResult }

export function useGovernanceAnomalies(): UseGovernanceAnomaliesResult {
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const [anomalies, setAnomalies] = useState<Array<{ type: string; message?: string }>>([])
    const [anomalyBannerDismissed, setAnomalyBannerDismissed] = useState(false)
    const [provenanceMap, setProvenanceMap] = useState<Record<string, unknown>>({})

    // Fetch anomalies on mount
    useEffect(() => {
        const api = window.flintAPI.governance
        if (!api.getAnomalies) return
        void api.getAnomalies()
            .then(setAnomalies)
            .catch((err: unknown) => {
                console.warn('[Flint] useGovernanceAnomalies: failed to load anomalies', err)
                setAnomalies([])
                useNotificationStore.getState().push({
                    type: 'error',
                    title: 'Anomaly data unavailable',
                    message: 'Could not load anomaly alerts. Governance monitoring may be limited.',
                    severity: 'warning',
                    autoDismissMs: 5000,
                })
            })
    }, [])

    // Fetch provenance map when activeFilePath changes
    useEffect(() => {
        if (!activeFilePath) {
            setProvenanceMap({})
            return
        }
        const api = window.flintAPI.governance
        if (!api.getProvenanceSummary) return
        void api.getProvenanceSummary(activeFilePath)
            .then((result) => setProvenanceMap(result as Record<string, unknown>))
            .catch(() => setProvenanceMap({}))
    }, [activeFilePath])

    const handleSetAnomalyBannerDismissed = useCallback((next: boolean) => {
        setAnomalyBannerDismissed(next)
    }, [])

    return {
        anomalies,
        anomalyBannerDismissed,
        setAnomalyBannerDismissed: handleSetAnomalyBannerDismissed,
        provenanceMap,
    }
}
