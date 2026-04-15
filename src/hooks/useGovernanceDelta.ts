/**
 * useGovernanceDelta — src/hooks/useGovernanceDelta.ts
 *
 * Owns: baseline state, baseline mutations, delta-filtered warnings.
 * Extracted from GovernanceDashboard.tsx lines ~479-580, 934-980.
 *
 * Delta Mode: when a baseline is set, only NEW violations (not present at
 * snapshot time) are surfaced. The hook loads the baseline on mount and
 * whenever the active file changes, then exposes set/clear actions.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import { auditDelta } from '../utils/deltaAudit'
import { sanitiseToastMessage } from '../utils/sanitiseToastMessage'
import type { LinterWarning, BaselineEntry } from '../types/flint-api'
import type { UseGovernanceDeltaResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceDeltaResult }

type BaselineStatus = 'idle' | 'setting' | 'clearing'

export function useGovernanceDelta(): UseGovernanceDeltaResult {
    const linterWarnings    = useEditorStore((s) => s.linterWarnings)
    const a11yViolations    = useCanvasStore((s) => s.a11yViolations)
    const activeFilePath    = useCanvasStore((s) => s.activeFilePath)

    const [isBaselineSet, setIsBaselineSet] = useState(false)
    const [baselineEntries, setBaselineEntries] = useState<BaselineEntry[]>([])
    const [baselineStatus, setBaselineStatus] = useState<BaselineStatus>('idle')

    const governanceLoadErrorToasted = useRef(false)

    // On mount and whenever the active file changes, load baseline state.
    useEffect(() => {
        const api = window.flintAPI.baseline
        if (!api) return

        void api.isSet().then(setIsBaselineSet).catch((err: unknown) => {
            console.warn('[Flint] useGovernanceDelta: failed to check baseline', err)
            if (!governanceLoadErrorToasted.current) {
                governanceLoadErrorToasted.current = true
                useNotificationStore.getState().push({
                    type: 'error',
                    severity: 'error',
                    title: 'Governance data unavailable',
                    message: sanitiseToastMessage('Governance tools are unavailable. Check that the Flint MCP server is running.'),
                    autoDismissMs: 8000,
                })
            }
        })

        if (activeFilePath) {
            void api.get(activeFilePath).then(setBaselineEntries).catch(() => setBaselineEntries([]))
        } else {
            setBaselineEntries([])
        }
    }, [activeFilePath])

    // ── Flatten linter warnings ──────────────────────────────────────────────
    const allLinterWarnings = useMemo<LinterWarning[]>(
        () => Array.from(linterWarnings.values()),
        [linterWarnings],
    )

    const allA11yWarnings = useMemo<LinterWarning[]>(
        () =>
            Object.entries(a11yViolations).map(([nodeId, msgs]) => ({
                id: nodeId,
                type: 'a11y' as const,
                severity: 'critical' as const,
                value: 1,
                message: msgs.join(', '),
                nearestToken: null,
                nearestTokenValue: null,
            })),
        [a11yViolations],
    )

    // ── Apply delta filter when baseline is active ───────────────────────────
    const deltaWarnings = useMemo<LinterWarning[]>(() => {
        const all = [...allLinterWarnings, ...allA11yWarnings]
        if (!isBaselineSet || baselineEntries.length === 0) return all
        return auditDelta(all, baselineEntries)
    }, [isBaselineSet, baselineEntries, allLinterWarnings, allA11yWarnings])

    // ── Set Baseline ──────────────────────────────────────────────────────────
    const setBaseline = useCallback(async () => {
        const api = window.flintAPI.baseline
        if (!api || !activeFilePath) return

        setBaselineStatus('setting')

        const violations = [...allLinterWarnings, ...allA11yWarnings].map((v) => ({
            nodeId: v.id,
            ruleId: v.type,
            severity: v.severity,
            filePath: activeFilePath,
            value: String(v.value),
        }))

        await api.set(violations)

        const [nowSet, entries] = await Promise.all([
            api.isSet(),
            api.get(activeFilePath),
        ])
        setIsBaselineSet(nowSet)
        setBaselineEntries(entries)
        setBaselineStatus('idle')
    }, [activeFilePath, allLinterWarnings, allA11yWarnings])

    // ── Clear Baseline ────────────────────────────────────────────────────────
    const clearBaseline = useCallback(async () => {
        const api = window.flintAPI.baseline
        if (!api) return

        setBaselineStatus('clearing')
        await api.clear()
        setIsBaselineSet(false)
        setBaselineEntries([])
        setBaselineStatus('idle')
    }, [])

    return {
        isBaselineSet,
        baselineEntries,
        baselineStatus,
        deltaWarnings,
        setBaseline,
        clearBaseline,
    }
}
