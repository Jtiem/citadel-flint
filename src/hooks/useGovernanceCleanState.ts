/**
 * useGovernanceCleanState — src/hooks/useGovernanceCleanState.ts
 *
 * Owns: lastCleanCommit, canRewind, rewindToClean handler.
 * Extracted from GovernanceDashboard.tsx lines ~1278-1315.
 *
 * Fetches the last clean state snapshot from the governance IPC whenever
 * the health score changes. Exposes a rewindToClean() action that calls
 * applyUndo() after user confirmation.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import { applyUndo } from '../core/recoveryController'
import { formatRelativeTime } from '../utils/relativeTime'
import type { UseGovernanceCleanStateResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceCleanStateResult }

interface LastCleanState {
    timestamp: string
    score: number
}

interface UseGovernanceCleanStateOptions {
    /** Current health score — re-fetches the last clean state when it changes. */
    score: number
}

export function useGovernanceCleanState({ score }: UseGovernanceCleanStateOptions): UseGovernanceCleanStateResult {
    const [lastCleanState, setLastCleanState] = useState<LastCleanState | null>(null)

    // Re-fetch whenever the score changes.
    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getLastCleanState) {
            void api.getLastCleanState()
                .then((state: LastCleanState | null) => setLastCleanState(state))
                .catch(() => setLastCleanState(null))
        }
    }, [score])

    const rewindToClean = useCallback(async () => {
        if (!lastCleanState) return
        const confirmed = window.confirm(
            `Rewind to last clean state (score ${lastCleanState.score}, ${formatRelativeTime(lastCleanState.timestamp)})?\n\nThis will undo all changes since that point.`
        )
        if (!confirmed) return
        try {
            await applyUndo()
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Reverted to clean state',
                message: `Reverted to score ${lastCleanState.score}`,
                severity: 'info',
                autoDismissMs: 4000,
            })
        } catch {
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Rewind failed',
                message: 'Could not revert — try using the undo shortcut instead',
                severity: 'warning',
                autoDismissMs: 5000,
            })
        }
    }, [lastCleanState])

    return {
        lastCleanCommit: lastCleanState ? lastCleanState.timestamp : null,
        canRewind: lastCleanState !== null,
        rewindToClean,
    }
}
