/**
 * useGovernanceAuditLog — src/hooks/useGovernanceAuditLog.ts
 *
 * H8: Lazy audit log loader + pagination.
 *
 * Extracts the COUNSEL.4.5 audit log logic from GovernanceDashboard.tsx
 * (lines ~696–743).
 *
 * Behaviour:
 *   - Does NOT auto-fetch on mount. Fetch only when `refresh()` is explicitly
 *     called (the accordion open handler calls refresh() on first open).
 *   - `loadMore()` increases the page limit by 20 and re-fetches.
 *   - Request limit+1 trick to detect if there are more entries without an
 *     extra IPC round-trip.
 *
 * Zero .getState() in render path.
 */

import { useState, useCallback } from 'react'
import type { UseGovernanceAuditLogResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceAuditLogResult }

const PAGE_SIZE = 20

export function useGovernanceAuditLog(): UseGovernanceAuditLogResult {
    const [entries, setEntries] = useState<unknown[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [limit, setLimit] = useState(PAGE_SIZE)

    const fetchLog = useCallback(async (fetchLimit: number) => {
        const api = window.flintAPI.governance
        if (!api.getAuditLog) return
        setIsLoading(true)
        try {
            // Fetch limit+1 to detect if there are more entries
            const raw = await api.getAuditLog({ limit: fetchLimit + 1 })
            if (raw.length > fetchLimit) {
                setEntries(raw.slice(0, fetchLimit))
                setHasMore(true)
            } else {
                setEntries(raw)
                setHasMore(false)
            }
        } catch (err: unknown) {
            console.warn('[Flint] useGovernanceAuditLog: failed to load audit log', err)
            setEntries([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    const refresh = useCallback(async () => {
        await fetchLog(limit)
    }, [fetchLog, limit])

    const loadMore = useCallback(async () => {
        const newLimit = limit + PAGE_SIZE
        setLimit(newLimit)
        await fetchLog(newLimit)
    }, [fetchLog, limit])

    return {
        entries,
        isLoading,
        hasMore,
        loadMore,
        refresh,
    }
}
