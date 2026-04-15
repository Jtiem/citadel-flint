/**
 * useGovernanceTimers — src/hooks/useGovernanceTimers.ts
 *
 * H13: Unmount-safe timer scheduler for GovernanceDashboard (MAJOR-1).
 *
 * Replaces 5 raw setTimeout() calls in GovernanceDashboard with a single
 * registry that clears all pending timers on unmount, preventing the
 * "setState on an unmounted component" warning pattern.
 *
 * Contract: UseGovernanceTimersResult (sprint-2-glass-ui-fixes.contract.ts)
 */

import { useCallback, useEffect, useRef } from 'react'
import type { UseGovernanceTimersResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceTimersResult }

/**
 * Returns a `schedule(fn, ms)` that works like setTimeout but registers
 * the handle in a shared ref so all pending timers are cancelled when the
 * host component unmounts.
 *
 * `clearAll()` is also exposed for callers that need to flush eagerly
 * (e.g., before a new batch of timers replaces the old ones).
 */
export function useGovernanceTimers(): UseGovernanceTimersResult {
    // Set of active timer handles — persists across renders
    const timerIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    // Cancel all tracked timers on unmount
    useEffect(() => {
        return () => {
            for (const id of timerIds.current) {
                clearTimeout(id)
            }
            timerIds.current.clear()
        }
    }, [])

    const clearAll = useCallback(() => {
        for (const id of timerIds.current) {
            clearTimeout(id)
        }
        timerIds.current.clear()
    }, [])

    const schedule = useCallback((fn: () => void, ms: number) => {
        const id = setTimeout(() => {
            timerIds.current.delete(id)
            fn()
        }, ms)
        timerIds.current.add(id)
    }, [])

    return { schedule, clearAll }
}
