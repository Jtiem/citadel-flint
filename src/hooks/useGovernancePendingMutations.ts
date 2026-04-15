/**
 * useGovernancePendingMutations — src/hooks/useGovernancePendingMutations.ts
 *
 * H14: S8.3 pending mutations / MRS approval queue state.
 *
 * Extracts the pending mutations logic from GovernanceDashboard.tsx
 * (lines ~1407–1451).
 *
 * Lifecycle:
 *   - On mount: fetches pending mutations from IPC.
 *   - approve(id): calls IPC, filters item from local state on success, pushes
 *     a notification.
 *   - reject(id): calls IPC, filters item from local state on success, pushes
 *     a notification.
 *
 * Zero .getState() in render path.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import type { UseGovernancePendingMutationsResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernancePendingMutationsResult }

export function useGovernancePendingMutations(): UseGovernancePendingMutationsResult {
    const [pending, setPending] = useState<unknown[]>([])

    // Fetch on mount
    useEffect(() => {
        const api = window.flintAPI.governance
        if (!api.getPendingMutations) return
        void api.getPendingMutations()
            .then(setPending)
            .catch(() => setPending([]))
    }, [])

    const approve = useCallback(async (id: string) => {
        const api = window.flintAPI.governance
        if (!api.approveMutation) return
        const numericId = Number(id)
        try {
            await api.approveMutation(numericId)
            setPending((prev) => (prev as Array<{ id: number }>).filter((m) => m.id !== numericId))
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Mutation approved',
                message: `Mutation #${id} approved`,
                severity: 'info',
                autoDismissMs: 3000,
            })
        } catch (err) {
            console.warn('[Flint] useGovernancePendingMutations: approve failed', err)
        }
    }, [])

    const reject = useCallback(async (id: string) => {
        const api = window.flintAPI.governance
        if (!api.rejectMutation) return
        const numericId = Number(id)
        try {
            await api.rejectMutation(numericId)
            setPending((prev) => (prev as Array<{ id: number }>).filter((m) => m.id !== numericId))
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Mutation rejected',
                message: `Mutation #${id} rejected and removed`,
                severity: 'warning',
                autoDismissMs: 3000,
            })
        } catch (err) {
            console.warn('[Flint] useGovernancePendingMutations: reject failed', err)
        }
    }, [])

    return {
        pending,
        approve,
        reject,
    }
}
