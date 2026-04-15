/**
 * useGovernanceDefer — src/hooks/useGovernanceDefer.ts
 *
 * H4: Deferred card keys, resurface check, defer form state, flag/unflag,
 *     AI-source detection.
 *
 * Extracted from GovernanceDashboard.tsx lines ~609-797.
 *
 * Contract: UseGovernanceDeferResult (sprint-2-glass-ui-fixes.contract.ts)
 *
 * Dependencies:
 *   - useGovernanceTimers (timers.schedule replaces raw setTimeout for defer success dismiss)
 *   - effectiveLinterWarnings / effectiveA11yWarnings for aiSourcedCardKeys
 *   - provenanceMap from H6 for AI-source detection
 *   - window.flintAPI.governance.deferViolation
 *   - useCanvasStore.activeFilePath (subscribed, not .getState())
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import type { LinterWarning, ProvenanceInfo } from '../types/flint-api'
import type { DeferDuration } from '../../shared/deferralUtils'
import type { UseGovernanceTimersResult } from './useGovernanceTimers'
import type { UseGovernanceDeferResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceDeferResult }

interface UseGovernanceDeferInput {
    timers: UseGovernanceTimersResult
    effectiveLinterWarnings: LinterWarning[]
    effectiveA11yWarnings: LinterWarning[]
    provenanceMap: Record<string, ProvenanceInfo>
}

export function useGovernanceDefer({
    timers,
    effectiveLinterWarnings,
    effectiveA11yWarnings,
    provenanceMap,
}: UseGovernanceDeferInput): UseGovernanceDeferResult {
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    // ── Flagged card keys ────────────────────────────────────────────────────
    const [flaggedCardKeys, setFlaggedCardKeys] = useState<Set<string>>(new Set())

    // ── Deferred card keys ───────────────────────────────────────────────────
    const [deferredCardKeys, setDeferredCardKeys] = useState<Set<string>>(new Set())

    // ── Deferred expiresAt map (cardKey → unix-ms | null) ───────────────────
    const [deferredExpiresAt, setDeferredExpiresAt] = useState<Map<string, number>>(new Map())

    // ── Resurface tick — increments every 60s ────────────────────────────────
    const [resurfaceTick, setResurfaceTick] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setResurfaceTick((t) => t + 1), 60_000)
        return () => clearInterval(id)
    }, [])

    // ── Resurface check — run on mount and every 60s (via resurfaceTick) ─────
    const [resurfacedCardKeys, setResurfacedCardKeys] = useState<Set<string>>(new Set())

    useEffect(() => {
        const now = Date.now()
        const resurfaced = new Set<string>()
        const stillDeferred = new Map<string, number>()

        for (const [key, expiresMs] of deferredExpiresAt.entries()) {
            if (expiresMs !== null && expiresMs <= now) {
                resurfaced.add(key)
            } else {
                stillDeferred.set(key, expiresMs)
            }
        }

        if (resurfaced.size > 0) {
            setResurfacedCardKeys((prev) => new Set([...prev, ...resurfaced]))
            setDeferredCardKeys((prev) => {
                const next = new Set(prev)
                for (const k of resurfaced) next.delete(k)
                return next
            })
            setDeferredExpiresAt(stillDeferred)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resurfaceTick])

    // ── Defer form state ─────────────────────────────────────────────────────
    const [deferFormOpen, setDeferFormOpen] = useState<Set<string>>(new Set())
    const [deferReasons, setDeferReasons] = useState<Map<string, string>>(new Map())
    const [deferDurations, setDeferDurations] = useState<Map<string, string>>(new Map())
    const [deferSuccess, setDeferSuccess] = useState<Set<string>>(new Set())
    const [deferSuccessMsg, setDeferSuccessMsg] = useState<Map<string, string>>(new Map())

    const toggleDeferForm = useCallback((cardKey: string) => {
        setDeferFormOpen((prev) => {
            const n = new Set(prev)
            if (n.has(cardKey)) {
                n.delete(cardKey)
            } else {
                n.add(cardKey)
            }
            return n
        })
    }, [])

    const submitDefer = useCallback(
        async (cardKey: string, ruleId: string, nodeId: string) => {
            const reason = deferReasons.get(cardKey) ?? ''
            const duration = (deferDurations.get(cardKey) ?? '1 day') as DeferDuration
            let deferred = false

            try {
                if (window.flintAPI.governance.deferViolation) {
                    await window.flintAPI.governance.deferViolation({
                        ruleId,
                        filePath: activeFilePath ?? '',
                        nodeId,
                        reason,
                        duration,
                    })
                    deferred = true
                } else if (window.flintAPI.deferViolation) {
                    await window.flintAPI.deferViolation(
                        activeFilePath ?? '',
                        ruleId,
                        nodeId,
                        reason,
                        duration,
                    )
                    deferred = true
                }
            } catch (err) {
                console.warn('[Flint] useGovernanceDefer: deferViolation IPC failed', err)
            }

            if (!deferred) {
                useNotificationStore.getState().push({
                    type: 'violation',
                    title: 'Defer unavailable',
                    message: 'Defer IPC is not available in this environment',
                    severity: 'warning',
                    autoDismissMs: 4000,
                })
                return
            }

            const msg =
                duration === 'Manually'
                    ? 'Deferred. Will resurface manually.'
                    : `Deferred. Will resurface in ${duration}.`

            setDeferSuccessMsg((prev) => new Map([...prev, [cardKey, msg]]))
            setDeferSuccess((prev) => new Set([...prev, cardKey]))
            setDeferFormOpen((prev) => {
                const n = new Set(prev)
                n.delete(cardKey)
                return n
            })
            setDeferredCardKeys((prev) => new Set([...prev, cardKey]))

            // Compute expiresAt and store
            const { computeExpiresAt: computeExp } = await import('../../shared/deferralUtils')
            const expiresMs: number | null = (() => {
                if (duration === 'Manually') return null
                const expStr = computeExp(duration as Parameters<typeof computeExp>[0])
                return expStr ? new Date(expStr).getTime() : null
            })()

            if (expiresMs !== null) {
                setDeferredExpiresAt((prev) => new Map([...prev, [cardKey, expiresMs]]))
            }

            // Auto-dismiss success badge using tracked timer
            timers.schedule(() => {
                setDeferSuccess((prev) => {
                    const n = new Set(prev)
                    n.delete(cardKey)
                    return n
                })
            }, 4000)
        },
        [deferReasons, deferDurations, activeFilePath, timers],
    )

    // ── Flag / Unflag ────────────────────────────────────────────────────────
    const handleFlag = useCallback(
        async (cardKey: string, ruleId: string, nodeId: string) => {
            setFlaggedCardKeys((prev) => new Set([...prev, cardKey]))
            try {
                if (window.flintAPI.governance.deferViolation) {
                    await window.flintAPI.governance.deferViolation({
                        ruleId,
                        filePath: activeFilePath ?? '',
                        nodeId,
                        reason: '[FLAGGED] Flagged for review',
                        duration: 'Manually',
                    })
                }
            } catch (err) {
                console.warn('[Flint] useGovernanceDefer: failed to persist flag', err)
            }
        },
        [activeFilePath],
    )

    const handleUnflag = useCallback((cardKey: string) => {
        setFlaggedCardKeys((prev) => {
            const next = new Set(prev)
            next.delete(cardKey)
            return next
        })
    }, [])

    // ── AI-source detection ──────────────────────────────────────────────────
    const aiSourcedCardKeys = useMemo<Set<string>>(() => {
        const keys = new Set<string>()

        for (const w of effectiveLinterWarnings) {
            const prov = provenanceMap[w.id]
            if (
                prov &&
                (prov.source === 'ai_orchestrator' ||
                    prov.source === 'auto_fix' ||
                    prov.source === 'auto-fix' ||
                    prov.source === 'auto-heal' ||
                    (prov.agentId && prov.source !== 'human'))
            ) {
                keys.add(`m-${w.id}`)
            }
        }

        for (let i = 0; i < effectiveA11yWarnings.length; i++) {
            const w = effectiveA11yWarnings[i]
            const prov = provenanceMap[w.id]
            if (
                prov &&
                (prov.source === 'ai_orchestrator' ||
                    prov.source === 'auto_fix' ||
                    prov.source === 'auto-fix' ||
                    prov.source === 'auto-heal' ||
                    (prov.agentId && prov.source !== 'human'))
            ) {
                keys.add(`a-${w.id}-${i}`)
            }
        }

        return keys
    }, [effectiveLinterWarnings, effectiveA11yWarnings, provenanceMap])

    return {
        deferredCardKeys,
        deferredExpiresAt,
        deferFormOpen,
        deferReasons,
        deferDurations,
        deferSuccess,
        deferSuccessMsg,
        flaggedCardKeys,
        aiSourcedCardKeys,
        resurfacedCardKeys,
        resurfaceTick,
        setDeferReasons,
        setDeferDurations,
        toggleDeferForm,
        submitDefer,
        handleFlag,
        handleUnflag,
    }
}
