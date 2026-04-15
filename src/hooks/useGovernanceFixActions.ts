/**
 * useGovernanceFixActions — src/hooks/useGovernanceFixActions.ts
 *
 * H3: Single fix, batch fix Mithril, batch fix A11y, fix preview state,
 *     accepted fixes queue, inline diff state.
 *
 * Extracted from GovernanceDashboard.tsx lines ~1027-1211.
 *
 * Contract: UseGovernanceFixActionsResult (sprint-2-glass-ui-fixes.contract.ts)
 *
 * Dependencies:
 *   - useGovernanceTimers (timers.schedule replaces raw setTimeout)
 *   - effectiveLinterWarnings / effectiveA11yWarnings from H1 (delta result)
 *   - useUserPrefs for fixMode
 *   - window.flintAPI.mcp, window.flintAPI.governance, window.flintAPI.readFile
 *   - useEditorStore.applyBatch (via .getState() — intentionally NOT in render)
 *   - useCanvasStore.activeFilePath (via .getState() — intentionally NOT in render)
 */

import { useState, useCallback, useMemo } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import { useUserPrefs } from './useUserPrefs'
import { extractHardcodedClassFromMsg, extractRuleIdFromMsg, A11Y_NOT_AUTO_FIXABLE } from '../components/ui/governance/ViolationCard'
import type { LinterWarning } from '../types/flint-api'
import type { FixableItem } from '../components/ui/FixPreviewDrawer'
import type { UseGovernanceTimersResult } from './useGovernanceTimers'
import type { UseGovernanceFixActionsResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceFixActionsResult }

interface InlineFixPreview {
    current: string
    proposed: string
    tokenName: string
    isColor: boolean
}

interface UseGovernanceFixActionsInput {
    timers: UseGovernanceTimersResult
    effectiveLinterWarnings: LinterWarning[]
    effectiveA11yWarnings: LinterWarning[]
}

export function useGovernanceFixActions({
    timers,
    effectiveLinterWarnings,
    effectiveA11yWarnings,
}: UseGovernanceFixActionsInput): UseGovernanceFixActionsResult {
    const [prefs] = useUserPrefs()

    // ── Fix preview state (FixPreviewDrawer) ────────────────────────────────
    const [fixPreviewItems, setFixPreviewItems] = useState<FixableItem[] | null>(null)

    // ── Inline diff state ────────────────────────────────────────────────────
    const [inlineDiffOpen, setInlineDiffOpen] = useState<Set<string>>(new Set())
    const [inlineDiffData, setInlineDiffData] = useState<Map<string, InlineFixPreview>>(new Map())
    const [inlineDiffLoading, setInlineDiffLoading] = useState<Set<string>>(new Set())

    // ── Accepted fixes queue ─────────────────────────────────────────────────
    const [acceptedFixes, setAcceptedFixes] = useState<FixableItem[]>([])

    // ── Derived: auto-fixable Mithril entries ────────────────────────────────
    const autoFixableEntries = useMemo(
        () =>
            effectiveLinterWarnings
                .filter((w) => w.nearestToken !== null && extractHardcodedClassFromMsg(w.message) !== null)
                .map((w) => ({
                    nodeId: w.id,
                    label: `${extractRuleIdFromMsg(w.message) ?? w.type} — ${w.id.slice(0, 12)}`,
                    hardcodedClass: extractHardcodedClassFromMsg(w.message) ?? '',
                    tokenClass: w.nearestToken ?? '',
                })),
        [effectiveLinterWarnings],
    )

    // ── Derived: A11y fix groups ─────────────────────────────────────────────
    const autoFixableA11yEntries = useMemo(
        () =>
            effectiveA11yWarnings.filter((w) => {
                const ruleId = extractRuleIdFromMsg(w.message) ?? ''
                return !A11Y_NOT_AUTO_FIXABLE.has(ruleId)
            }),
        [effectiveA11yWarnings],
    )

    const manualA11yEntries = useMemo(
        () =>
            effectiveA11yWarnings.filter((w) => {
                const ruleId = extractRuleIdFromMsg(w.message) ?? ''
                return w.nearestToken === null && !['A11Y-001', 'A11Y-002'].includes(ruleId)
            }),
        [effectiveA11yWarnings],
    )

    // ── Single fix ───────────────────────────────────────────────────────────
    const handleFixSingle = useCallback(
        (item: FixableItem) => {
            if (prefs.fixMode === 'auto') {
                void useEditorStore.getState().applyBatch([{
                    op: 'applyTokenFix',
                    nodeId: item.nodeId,
                    hardcodedClass: item.hardcodedClass,
                    tokenClass: item.tokenClass,
                }])
            } else {
                setFixPreviewItems([item])
            }
        },
        [prefs.fixMode],
    )

    // ── Batch fix (Mithril) ──────────────────────────────────────────────────
    const handleFixAll = useCallback(() => {
        if (autoFixableEntries.length === 0) return
        if (prefs.fixMode === 'auto') {
            void useEditorStore.getState().applyBatch(
                autoFixableEntries.map((item) => ({
                    op: 'applyTokenFix' as const,
                    nodeId: item.nodeId,
                    hardcodedClass: item.hardcodedClass,
                    tokenClass: item.tokenClass,
                })),
            )
        } else {
            setFixPreviewItems(autoFixableEntries)
        }
    }, [autoFixableEntries, prefs.fixMode])

    // ── Batch fix (A11y) ─────────────────────────────────────────────────────
    const handleBatchFixA11y = useCallback(async () => {
        const activeFilePath = useCanvasStore.getState().activeFilePath
        if (!activeFilePath) {
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Fix failed',
                message: 'No active file — open a file before fixing',
                severity: 'warning',
                autoDismissMs: 4000,
            })
            return
        }
        try {
            const result = await window.flintAPI.governance.applyFix?.(activeFilePath) ?? null

            if (result === null) {
                useNotificationStore.getState().push({
                    type: 'violation',
                    title: 'Fix unavailable',
                    message: 'Flint MCP is not connected — start the MCP server to enable auto-fix',
                    severity: 'warning',
                    autoDismissMs: 5000,
                })
                return
            }

            const fixCount = result.fixesApplied

            if (fixCount === 0) {
                useNotificationStore.getState().push({
                    type: 'violation',
                    title: 'No auto-fixable issues',
                    message: 'All violations in this file require manual fixes — see the "How to fix" guide in each card',
                    severity: 'warning',
                    autoDismissMs: 5000,
                })
                return
            }

            try {
                const content = await window.flintAPI.readFile(activeFilePath)
                useEditorStore.getState().syncCode(content)
            } catch (err) {
                console.warn('[Flint] useGovernanceFixActions: failed to re-sync editor after a11y batch fix', err)
            }

            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'A11y fixes applied',
                message: `${fixCount} accessibility ${fixCount === 1 ? 'issue' : 'issues'} fixed`,
                severity: 'info',
                autoDismissMs: 3000,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'A11y batch fix failed',
                message: msg,
                severity: 'warning',
                autoDismissMs: 5000,
            })
        }
    }, [])

    // ── Apply preview drawer items ────────────────────────────────────────────
    const handleApplyPreview = useCallback(async () => {
        if (!fixPreviewItems) return
        void useEditorStore.getState().applyBatch(
            fixPreviewItems.map((item) => ({
                op: 'applyTokenFix' as const,
                nodeId: item.nodeId,
                hardcodedClass: item.hardcodedClass,
                tokenClass: item.tokenClass,
            })),
        )
        setFixPreviewItems(null)
    }, [fixPreviewItems])

    // ── Inline diff toggle ────────────────────────────────────────────────────
    const toggleInlineDiff = useCallback(
        async (key: string, ruleId: string, filePath: string | null) => {
            if (inlineDiffOpen.has(key)) {
                setInlineDiffOpen((prev) => {
                    const n = new Set(prev)
                    n.delete(key)
                    return n
                })
                return
            }
            setInlineDiffOpen((prev) => new Set([...prev, key]))
            if (inlineDiffData.has(key)) return
            setInlineDiffLoading((prev) => new Set([...prev, key]))
            try {
                if (window.flintAPI.governance.previewFix && filePath) {
                    const data = await window.flintAPI.governance.previewFix(ruleId, filePath)
                    if (data) {
                        setInlineDiffData((prev) => new Map([...prev, [key, data as InlineFixPreview]]))
                    }
                }
            } catch {
                // IPC not yet available — show placeholder diff from store data
            } finally {
                setInlineDiffLoading((prev) => {
                    const n = new Set(prev)
                    n.delete(key)
                    return n
                })
            }
        },
        [inlineDiffOpen, inlineDiffData],
    )

    // ── Accept / skip inline fix ──────────────────────────────────────────────
    const acceptInlineFix = useCallback((key: string, item: FixableItem) => {
        setAcceptedFixes((prev) => {
            if (prev.some((f) => f.nodeId === item.nodeId)) return prev
            return [...prev, item]
        })
        setInlineDiffOpen((prev) => {
            const n = new Set(prev)
            n.delete(key)
            return n
        })
    }, [])

    const skipInlineFix = useCallback((key: string) => {
        setInlineDiffOpen((prev) => {
            const n = new Set(prev)
            n.delete(key)
            return n
        })
    }, [])

    // ── Apply all accepted inline fixes ──────────────────────────────────────
    const applyAcceptedFixes = useCallback(async () => {
        if (acceptedFixes.length === 0) return
        void useEditorStore.getState().applyBatch(
            acceptedFixes.map((item) => ({
                op: 'applyTokenFix' as const,
                nodeId: item.nodeId,
                hardcodedClass: item.hardcodedClass,
                tokenClass: item.tokenClass,
            })),
        )
        setAcceptedFixes([])
    }, [acceptedFixes])

    return {
        autoFixableEntries,
        autoFixableA11yEntries,
        manualA11yEntries,
        acceptedFixes,
        fixPreviewItems,
        inlineDiffOpen,
        inlineDiffLoading,
        inlineDiffData,
        handleFixSingle,
        handleFixAll,
        handleBatchFixA11y,
        handleApplyPreview,
        setFixPreviewItems,
        acceptInlineFix,
        skipInlineFix,
        toggleInlineDiff,
        applyAcceptedFixes,
    }
}
