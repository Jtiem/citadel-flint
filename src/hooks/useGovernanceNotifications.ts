/**
 * useGovernanceNotifications — src/hooks/useGovernanceNotifications.ts
 *
 * H5: Ring pulse trigger, session fix progress indicator, defer success
 *     toasts, and confirmation toast helper.
 *
 * Extracted from GovernanceDashboard.tsx lines ~689-696, ~1271-1277, and
 * defer-success bits.
 *
 * Contract: UseGovernanceNotificationsResult (sprint-2-glass-ui-fixes.contract.ts)
 *
 * Key design rules:
 *   - sessionInitialCount is captured once on mount via lazy useState init
 *     so it reads .getState() at mount time, NOT in the render path.
 *   - pulseRing triggers for 3 seconds when totalViolations drops to 0.
 *   - showConfirmationToast wraps the notification store push so callers
 *     do not import the store directly.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import type { UseGovernanceTimersResult } from './useGovernanceTimers'
import type { UseGovernanceNotificationsResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceNotificationsResult }

interface UseGovernanceNotificationsInput {
    timers: UseGovernanceTimersResult
    /** Combined delta-filtered violation count (mithril + a11y). */
    totalViolations: number
}

export function useGovernanceNotifications({
    timers,
    totalViolations,
}: UseGovernanceNotificationsInput): UseGovernanceNotificationsResult {
    // ── COUNSEL.2.5: Session fix progress ────────────────────────────────────
    // Captured once on mount — reads .getState() here intentionally (not render).
    const [sessionInitialCount] = useState<number>(() => {
        const mWarnings = Array.from(useEditorStore.getState().linterWarnings.values())
        const aWarnings = Object.keys(useCanvasStore.getState().a11yViolations)
        return mWarnings.length + aWarnings.length
    })

    // ── COUNSEL.4.4: Ring pulse when total drops to 0 ────────────────────────
    const [pulseRing, setPulseRing] = useState(false)
    const prevTotalRef = useRef<number | null>(null)

    useEffect(() => {
        if (prevTotalRef.current !== null && prevTotalRef.current > 0 && totalViolations === 0) {
            setPulseRing(true)
            timers.schedule(() => setPulseRing(false), 3000)
        }
        prevTotalRef.current = totalViolations
    }, [totalViolations, timers])

    // ── Confirmation toast helper ─────────────────────────────────────────────
    const showConfirmationToast = useCallback((msg: string) => {
        useNotificationStore.getState().push({
            type: 'mutation',
            title: 'Done',
            message: msg,
            severity: 'info',
            autoDismissMs: 4000,
        })
    }, [])

    return {
        sessionInitialCount,
        pulseRing,
        showConfirmationToast,
    }
}
