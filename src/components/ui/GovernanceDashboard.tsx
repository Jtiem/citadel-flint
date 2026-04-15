/**
 * GovernanceDashboard.tsx — Phase V.1 + Sprint 2 refactor
 *
 * Pure composition shell: calls Wave 1 hooks, derives a handful of scalar
 * values, then delegates all rendering to Wave 1 components.
 *
 * Health score formula (canonical):
 *   score = 100 − (criticals × 10) − (warnings × 3) − (infos × 1) − (overrides × 3)
 *   Grade: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import { useTokenStore } from '../../store/tokenStore'
import { useGovernanceConfig } from '../../hooks/useGovernanceConfig'
import { useGovernanceHealth, gradeFromScore } from '../../hooks/useGovernanceHealth'
import { useGovernanceTimers } from '../../hooks/useGovernanceTimers'
import { useGovernanceDelta } from '../../hooks/useGovernanceDelta'
import { useGovernanceAudit } from '../../hooks/useGovernanceAudit'
import { useGovernanceCategories } from '../../hooks/useGovernanceCategories'
import { useGovernanceAnomalies } from '../../hooks/useGovernanceAnomalies'
import { useGovernanceDefer } from '../../hooks/useGovernanceDefer'
import { useGovernanceFixActions } from '../../hooks/useGovernanceFixActions'
import { useGovernanceNotifications } from '../../hooks/useGovernanceNotifications'
import { useGovernanceHealthSignal } from '../../hooks/useGovernanceHealthSignal'
import { useGovernanceAuditLog } from '../../hooks/useGovernanceAuditLog'
import { useGovernanceCleanState } from '../../hooks/useGovernanceCleanState'
import { useGovernanceTokenImpact } from '../../hooks/useGovernanceTokenImpact'
import { useGovernanceCoverage } from '../../hooks/useGovernanceCoverage'
import { useGovernancePendingMutations } from '../../hooks/useGovernancePendingMutations'
import { useGovernanceMcpActivity } from '../../hooks/useGovernanceMcpActivity'
import { GovernanceHeader } from './governance/GovernanceHeader'
import { NoDesignSystemEmpty } from './governance/NoDesignSystemEmpty'
import { ZeroViolationCelebration } from './governance/ZeroViolationCelebration'
import { CompactScoreSummary } from './governance/CompactScoreSummary'
import { HealthScoreAccordion } from './governance/HealthScoreAccordion'
import { FixAllCta } from './governance/FixAllCta'
import { ViolationsList } from './governance/ViolationsList'
import { GovernanceFooter } from './governance/GovernanceFooter'
import { AnomalyBanner } from './governance/AnomalyBanner'
import { FixPreviewDrawerHost } from './governance/FixPreviewDrawerHost'
import { MoreDetailsPanel } from './governance/MoreDetailsPanel'
import { TopRulesAccordion } from './governance/TopRulesAccordion'
import { SessionBaselineAccordion } from './governance/SessionBaselineAccordion'
import { McpActivityAccordion } from './governance/McpActivityAccordion'
import { TokenImpactAccordion } from './governance/TokenImpactAccordion'
import { PendingApprovalsAccordion } from './governance/PendingApprovalsAccordion'
import { AuditLogAccordion } from './governance/AuditLogAccordion'
import { CoverageSection } from './governance/CoverageSection'
import { extractHardcodedClassFromMsg, extractRuleIdFromMsg, A11Y_NOT_AUTO_FIXABLE } from './governance/ViolationCard'
import { applyUndo } from '../../core/recoveryController'
import { sanitiseToastMessage } from '../../utils/sanitiseToastMessage'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning, PendingMutation, ProvenanceInfo, AnomalyAlert } from '../../types/flint-api'
import type { FixableItem } from './FixPreviewDrawer'
import type { DeferDuration } from '../../../shared/deferralUtils'
import type { MithrilCardData, A11yCardData } from './governance/ViolationsList'
import type { AuditLogEntry } from './governance/AuditLogAccordion'
import type { McpActivityEvent } from './governance/McpActivityAccordion'
import type { TokenImpactData } from './governance/TokenImpactAccordion'

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernanceDashboardProps {
    onOpenExportModal?: () => void
    onOpenGovernancePanel?: () => void
    initialViolationCount?: number
    onManageRules?: () => void
    onPolicySettings?: () => void
}

// ── Navigation map builder (outside component to avoid inline complexity) ─────

function buildNavMap(
    mithrilWarnings: LinterWarning[],
    a11yWarnings: LinterWarning[],
    deferredCardKeys: Set<string>,
    flaggedCardKeys: Set<string>,
): Map<string, number> {
    const map = new Map<string, number>()
    const sw: Record<string, number> = { critical: 3, amber: 2, advisory: 1 }
    const items = [
        ...mithrilWarnings.map((w) => ({
            key: `m-${w.id}`, severity: w.severity,
            autoFixable: extractHardcodedClassFromMsg(w.message) !== null && w.nearestToken !== null,
        })),
        ...a11yWarnings.map((w, i) => ({
            key: `a-${w.id}-${i}`, severity: w.severity,
            autoFixable: !A11Y_NOT_AUTO_FIXABLE.has(extractRuleIdFromMsg(w.message) ?? ''),
        })),
    ].filter((item) => !deferredCardKeys.has(item.key) && !flaggedCardKeys.has(item.key))
    items.sort((a, b) => a.autoFixable !== b.autoFixable ? (a.autoFixable ? -1 : 1) : (sw[b.severity] ?? 0) - (sw[a.severity] ?? 0))
    items.forEach((item, i) => map.set(item.key, i + 1))
    return map
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceDashboard({
    onOpenExportModal, onOpenGovernancePanel, initialViolationCount, onManageRules, onPolicySettings,
}: GovernanceDashboardProps = {}) {

    // Store slices
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const overridesExist = useCanvasStore((s) => s.overridesExist)
    const tokenCount = useTokenStore((s) => s.tokens.length)
    const setRightTab = useCanvasStore((s) => s.setRightTab)
    const unlockTab = useCanvasStore((s) => s.unlockTab)
    const autopilotEnabled = useCanvasStore((s) => s.autopilotEnabled)
    const setAutopilotEnabled = useCanvasStore((s) => s.setAutopilotEnabled)
    const storeCanExport = useCanvasStore((s) => s.canExport)
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations = useCanvasStore((s) => s.a11yViolations)
    const setGovernanceRuleFilter = useCanvasStore((s) => s.setGovernanceRuleFilter)

    useGovernanceConfig()

    // Override count (GOV.2)
    const [govOverrideCount, setGovOverrideCount] = useState(0)
    const overrideErrorToasted = useRef(false)
    const fetchOverrideCount = useCallback(() => {
        window.flintAPI.governance.getOverrideCount().then(setGovOverrideCount).catch((err: unknown) => {
            console.warn('[GovernanceDashboard] override count fetch failed', err)
            if (!overrideErrorToasted.current) {
                overrideErrorToasted.current = true
                useNotificationStore.getState().push({ type: 'error', severity: 'error', title: 'Governance data unavailable', message: sanitiseToastMessage('Governance tools are unavailable. Check that the Flint MCP server is running.'), autoDismissMs: 8000 })
            }
        })
    }, [])
    useEffect(() => {
        fetchOverrideCount()
        const unsub = window.flintAPI.governance.onOverrideRecorded(() => fetchOverrideCount())
        return unsub
    }, [fetchOverrideCount])
    const overrideCount = overridesExist ? Math.max(1, govOverrideCount) : 0

    // Wave 1 hooks
    const timers    = useGovernanceTimers()
    const delta     = useGovernanceDelta()
    const audit     = useGovernanceAudit()
    const categories = useGovernanceCategories({ delta })
    const anomalies = useGovernanceAnomalies()
    const defer     = useGovernanceDefer({ timers, effectiveLinterWarnings: categories.visibleLinterWarnings, effectiveA11yWarnings: categories.visibleA11yWarnings, provenanceMap: anomalies.provenanceMap as Record<string, ProvenanceInfo> })
    const fixActions = useGovernanceFixActions({ timers, effectiveLinterWarnings: categories.visibleLinterWarnings, effectiveA11yWarnings: categories.visibleA11yWarnings })
    const { score, grade } = useGovernanceHealth(delta.deltaWarnings, overrideCount)
    const mithrilCount = categories.chipCounts['design-system'] + categories.chipCounts['token-sync']
    const a11yCount = categories.chipCounts['accessibility']
    const totalViolations = mithrilCount + a11yCount
    const notifications = useGovernanceNotifications({ timers, totalViolations })
    const healthSignal = useGovernanceHealthSignal({ mithrilCount, a11yCount, overrideCount, score, grade, effectiveLinterWarnings: delta.deltaWarnings.filter((w) => w.type !== 'a11y') })
    const auditLog   = useGovernanceAuditLog()
    const cleanState = useGovernanceCleanState({ score })
    const tokenImpact = useGovernanceTokenImpact()
    const coverage   = useGovernanceCoverage()
    const pending    = useGovernancePendingMutations()
    const mcpActivity = useGovernanceMcpActivity()

    // Accordion open state
    const [isTopRulesOpen, setIsTopRulesOpen]   = useState(false)
    const [isSessionOpen, setIsSessionOpen]     = useState(false)
    const [isMoreOpen, setIsMoreOpen]           = useState(false)
    const [isActivityOpen, setIsActivityOpen]   = useState(false)
    const [isTokenImpactOpen, setIsTokenImpactOpen] = useState(false)
    const [isPendingOpen, setIsPendingOpen]     = useState(false)
    const [isAuditLogOpen, setIsAuditLogOpen]   = useState(false)
    const [auditLogLoaded, setAuditLogLoaded]   = useState(false)
    const [bannerDismissed, setBannerDismissed] = useState(false)
    const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null)

    // Expanded + pinned violation card state
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
    const [pinnedCards, setPinnedCards] = useState<Set<string>>(new Set())
    const toggleExpand = useCallback((key: string) => {
        setExpandedCards((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    }, [])
    const togglePin = useCallback((key: string) => {
        setPinnedCards((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
        setExpandedCards((prev) => { const n = new Set(prev); n.add(key); return n })
    }, [])

    // Baseline handlers
    const handleSetBaseline = useCallback(async () => {
        await delta.setBaseline()
        const c = delta.deltaWarnings.length
        setConfirmationMsg(`Baseline set — ${c} existing ${c !== 1 ? 'issues' : 'issue'} marked as known`)
        timers.schedule(() => setConfirmationMsg(null), 4000)
    }, [delta, timers])

    const handleClearBaseline = useCallback(async () => {
        await delta.clearBaseline()
        setConfirmationMsg('Baseline cleared — all issues are now visible')
        timers.schedule(() => setConfirmationMsg(null), 4000)
    }, [delta, timers])

    // Auto-baseline for legacy projects (COUNSEL.1.2)
    const autoAttempted = useRef(false)
    useEffect(() => {
        if (autoAttempted.current || (initialViolationCount ?? 0) <= 10 || delta.isBaselineSet || !activeFilePath || delta.deltaWarnings.length === 0) return
        autoAttempted.current = true
        void delta.setBaseline().catch((err) => console.warn('[GovernanceDashboard] auto-baseline failed', err))
    }, [initialViolationCount, activeFilePath, delta])

    // Export blocked
    const exportBlocked = useMemo(() => !storeCanExport(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mithrilViolations, overridesExist, a11yViolations, storeCanExport])

    // Effort framing
    const manualReviewCount = useMemo(() => categories.visibleA11yWarnings.filter((w) => A11Y_NOT_AUTO_FIXABLE.has(extractRuleIdFromMsg(w.message) ?? '')).length, [categories.visibleA11yWarnings])
    const effortText = useMemo(() => {
        const ul = categories.visibleLinterWarnings.filter((w) => !defer.flaggedCardKeys.has(`m-${w.id}`) && !defer.deferredCardKeys.has(`m-${w.id}`))
        const ua = categories.visibleA11yWarnings.filter((w, i) => !defer.flaggedCardKeys.has(`a-${w.id}-${i}`) && !defer.deferredCardKeys.has(`a-${w.id}-${i}`))
        const total = ul.length + ua.length
        if (total === 0) return 'No violations — looking good'
        const af = ul.filter((w) => w.nearestToken !== null).length
        if (af > 0) return `${af} auto-fixable — Autopilot can resolve ${af === 1 ? 'it' : 'them'} in one click`
        return `${total} ${total === 1 ? 'issue' : 'issues'} need your input to resolve`
    }, [categories.visibleLinterWarnings, categories.visibleA11yWarnings, defer.flaggedCardKeys, defer.deferredCardKeys])

    const effortEstimate = useMemo(() => {
        const af = fixActions.autoFixableEntries.length, mr = manualReviewCount
        if (af === 0 && mr === 0) return ''
        const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.ceil(s / 60)} min`
        const pts = [`${af} auto-fix${af !== 1 ? 'es' : ''} (~${fmt(af * 5)})`, `${mr} manual review${mr !== 1 ? 's' : ''} (~${fmt(mr * 120)})`].filter((_, i) => [af, mr][i] > 0)
        return `Estimated effort: ${pts.join(' + ')}${pts.length > 1 ? ` = ~${fmt(af * 5 + mr * 120)} total` : ''}`
    }, [fixActions.autoFixableEntries.length, manualReviewCount])

    // Score trend hint
    const scoreTrendHint = useMemo<string | null>(() => {
        const top = healthSignal.topRules[0]
        if (!top) return null
        const labels: Record<string, string> = { 'color-drift': 'Color Drift', 'typography-drift': 'Typography', 'spacing-drift': 'Spacing', 'shadow-drift': 'Shadow', 'opacity-drift': 'Opacity', 'a11y': 'A11y', 'semantic-drift': 'Semantic', 'sync': 'Token Sync', 'inline-style-drift': 'Inline Style', 'registry': 'Registry' }
        const pts = top.ruleId === 'a11y' ? top.count * 10 : top.count * 3
        const pg = gradeFromScore(Math.min(100, score + pts))
        return pg === grade ? `Fix ${top.count} ${labels[top.ruleId] ?? top.ruleId} issue${top.count !== 1 ? 's' : ''} to improve your score by ${pts} points`
            : `Fix ${top.count} ${labels[top.ruleId] ?? top.ruleId} issue${top.count !== 1 ? 's' : ''} to reach grade ${pg}`
    }, [healthSignal.topRules, score, grade])

    // Navigation map + rule click handler
    const violationsSectionRef = useRef<HTMLDivElement>(null)
    const handleRuleRowClick = useCallback((type: LinterWarning['type']) => {
        setGovernanceRuleFilter(type)
        violationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [setGovernanceRuleFilter])
    const navigationMap = useMemo(() => buildNavMap(categories.visibleLinterWarnings, categories.visibleA11yWarnings, defer.deferredCardKeys, defer.flaggedCardKeys), [categories.visibleLinterWarnings, categories.visibleA11yWarnings, defer.deferredCardKeys, defer.flaggedCardKeys])

    // Blocking counts (GAP-11)
    const designSystemBlockingCount = useMemo(() => categories.visibleLinterWarnings.filter((w) => w.severity === 'critical' && w.type !== 'sync').length, [categories.visibleLinterWarnings])
    const syncBlockingCount = useMemo(() => categories.visibleLinterWarnings.filter((w) => w.severity === 'critical' && w.type === 'sync').length, [categories.visibleLinterWarnings])

    // Last clean snapshot (for header + health accordion)
    const [lastCleanSnapshot, setLastCleanSnapshot] = useState<{ score: number; timestamp: string } | null>(null)
    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getLastCleanState) void api.getLastCleanState().then((s: typeof lastCleanSnapshot) => setLastCleanSnapshot(s)).catch(() => setLastCleanSnapshot(null))
    }, [score])

    // Token impact auto-fetch when sync violations appear
    const syncCount = useMemo(() => categories.visibleLinterWarnings.filter((w) => w.type === 'sync').length, [categories.visibleLinterWarnings])
    useEffect(() => {
        if (syncCount === 0) return
        const first = categories.visibleLinterWarnings.find((w) => w.type === 'sync')
        const name = first?.nearestToken ?? (first ? extractHardcodedClassFromMsg(first.message) : null) ?? ''
        if (name) void tokenImpact.refresh(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncCount])

    // Audit log lazy toggle
    const handleAuditLogToggle = useCallback(() => {
        setIsAuditLogOpen((prev) => {
            if (!prev && !auditLogLoaded) void auditLog.refresh().then(() => setAuditLogLoaded(true))
            return !prev
        })
    }, [auditLog, auditLogLoaded])

    // Card data assembly
    const mithrilCards = useMemo<MithrilCardData[]>(() =>
        categories.visibleLinterWarnings.map((w) => {
            const k = `m-${w.id}`
            const h = extractHardcodedClassFromMsg(w.message), t = w.nearestToken
            const canFix = h !== null && t !== null
            return { warning: w, cardKey: k, isPinned: pinnedCards.has(k), isFlagged: defer.flaggedCardKeys.has(k), isDeferred: defer.deferredCardKeys.has(k), deferExpiresAtMs: (defer.deferredExpiresAt as Map<string, number | null>).get(k) ?? null, isDeferSuccess: defer.deferSuccess.has(k), deferSuccessMsg: defer.deferSuccessMsg.get(k), isResurfaced: defer.resurfacedCardKeys.has(k), isAiSourced: defer.aiSourcedCardKeys.has(k), isExpanded: expandedCards.has(k) || pinnedCards.has(k), isDiffOpen: fixActions.inlineDiffOpen.has(k), isDiffLoading: fixActions.inlineDiffLoading.has(k), diffData: (fixActions.inlineDiffData as Map<string, { current: string; proposed: string; tokenName: string; isColor: boolean }>).get(k) ?? null, isDeferFormOpen: defer.deferFormOpen.has(k), fixItem: canFix ? { nodeId: w.id, label: `${extractRuleIdFromMsg(w.message) ?? w.type} — ${w.id.slice(0, 12)}`, hardcodedClass: h, tokenClass: t } : null, provenance: (anomalies.provenanceMap as Record<string, ProvenanceInfo>)[w.id] ?? null, deferReason: defer.deferReasons.get(k) ?? '', deferDuration: (defer.deferDurations.get(k) ?? '1 day') as DeferDuration, navigationIndex: navigationMap.get(k) ?? null }
        }),
        [categories.visibleLinterWarnings, defer, fixActions, anomalies.provenanceMap, navigationMap, expandedCards, pinnedCards])

    const a11yCards = useMemo<A11yCardData[]>(() =>
        categories.visibleA11yWarnings.map((w, i) => {
            const k = `a-${w.id}-${i}`
            return { warning: w, cardKey: k, indexInList: i, isPinned: pinnedCards.has(k), isFlagged: defer.flaggedCardKeys.has(k), isDeferred: defer.deferredCardKeys.has(k), deferExpiresAtMs: (defer.deferredExpiresAt as Map<string, number | null>).get(k) ?? null, isDeferSuccess: defer.deferSuccess.has(k), deferSuccessMsg: defer.deferSuccessMsg.get(k), isResurfaced: defer.resurfacedCardKeys.has(k), isAiSourced: defer.aiSourcedCardKeys.has(k), isExpanded: expandedCards.has(k) || pinnedCards.has(k), isDeferFormOpen: defer.deferFormOpen.has(k), provenance: (anomalies.provenanceMap as Record<string, ProvenanceInfo>)[w.id] ?? null, deferReason: defer.deferReasons.get(k) ?? '', deferDuration: (defer.deferDurations.get(k) ?? '1 day') as DeferDuration, navigationIndex: navigationMap.get(k) ?? null }
        }),
        [categories.visibleA11yWarnings, defer, anomalies.provenanceMap, navigationMap, expandedCards, pinnedCards])

    const getNodeName = useCallback((id: string) => `#${id.slice(0, 12)}`, [])

    // Violation list callbacks
    const onFlagKey = useCallback((key: string) => {
        const isMithril = key.startsWith('m-')
        if (isMithril) { const w = categories.visibleLinterWarnings.find((v) => `m-${v.id}` === key); if (w) void defer.handleFlag(key, extractRuleIdFromMsg(w.message) ?? w.type, w.id) }
        else { const idx = parseInt(key.split('-').pop() ?? '0', 10); const w = categories.visibleA11yWarnings[idx]; if (w) void defer.handleFlag(key, extractRuleIdFromMsg(w.message) ?? 'A11Y', w.id) }
    }, [categories.visibleLinterWarnings, categories.visibleA11yWarnings, defer])

    const onSubmitDeferKey = useCallback((key: string) => {
        const isMithril = key.startsWith('m-')
        if (isMithril) { const w = categories.visibleLinterWarnings.find((v) => `m-${v.id}` === key); if (w) void defer.submitDefer(key, extractRuleIdFromMsg(w.message) ?? w.type, w.id) }
        else { const idx = parseInt(key.split('-').pop() ?? '0', 10); const w = categories.visibleA11yWarnings[idx]; if (w) void defer.submitDefer(key, extractRuleIdFromMsg(w.message) ?? 'A11Y', w.id) }
    }, [categories.visibleLinterWarnings, categories.visibleA11yWarnings, defer])

    const onPreviewFixKey = useCallback((key: string) => {
        const w = categories.visibleLinterWarnings.find((v) => `m-${v.id}` === key)
        if (w) void fixActions.toggleInlineDiff(key, extractRuleIdFromMsg(w.message) ?? w.type, activeFilePath)
    }, [categories.visibleLinterWarnings, fixActions, activeFilePath])

    return (
        <div className="flex flex-col" role="region" aria-label="Governance health dashboard">
            <h2 className="sr-only">Governance Health</h2>

            <GovernanceHeader
                isAuditing={audit.isAuditing} activeFilePath={activeFilePath} totalViolations={totalViolations}
                lastAuditRanAt={audit.lastAuditRanAt} isBaselineSet={delta.isBaselineSet} govOverrideCount={govOverrideCount}
                autopilotEnabled={autopilotEnabled} lastCleanState={lastCleanSnapshot} score={score}
                onRunAudit={() => void audit.runAudit()} onToggleAutopilot={() => setAutopilotEnabled(!autopilotEnabled)}
                onRewindToClean={() => void cleanState.rewindToClean()}
            />

            <NoDesignSystemEmpty visible={tokenCount === 0} onImportTokens={() => { unlockTab('tokens'); setRightTab('tokens') }} />

            {tokenCount > 0 && <>
                <ZeroViolationCelebration visible={totalViolations === 0 && !overridesExist} score={score} ringPulse={notifications.pulseRing} isBaselineSet={delta.isBaselineSet} />
                <CompactScoreSummary
                    score={score} grade={grade} exportBlocked={exportBlocked} ringPulse={notifications.pulseRing}
                    mithrilCount={mithrilCount} a11yCount={a11yCount} syncCount={categories.chipCounts['token-sync']}
                    activeCategory={categories.categoryFilter as 'design-system' | 'accessibility' | 'token-sync' | null}
                    onSetCategory={categories.setCategoryFilter as (cat: 'design-system' | 'accessibility' | 'token-sync' | null) => void}
                    designSystemBlockingCount={designSystemBlockingCount} a11yBlockingCount={a11yCount} syncBlockingCount={syncBlockingCount}
                    effortText={effortText} initialViolationCount={initialViolationCount} isBaselineSet={delta.isBaselineSet}
                    bannerDismissed={bannerDismissed} onDismissBanner={() => setBannerDismissed(true)}
                    onShowAllViolations={() => void delta.clearBaseline()} onOpenExportModal={onOpenExportModal}
                />
                <HealthScoreAccordion
                    score={score} grade={grade} mithrilCount={mithrilCount} a11yCount={a11yCount} overrideCount={overrideCount}
                    healthHistory={healthSignal.sparklineData as Array<{ date: string; score: number; grade: string }>}
                    scoreTrendHint={scoreTrendHint} nextStep={{ variant: 'coaching', text: healthSignal.coachingSentence }}
                    lastCleanState={lastCleanSnapshot} onRewindToClean={() => void cleanState.rewindToClean()}
                    fidelityScore={healthSignal.subScores.mithril} a11yScore={healthSignal.subScores.a11y}
                />
            </>}

            <FixAllCta visible={tokenCount > 0} autoFixableCount={fixActions.autoFixableEntries.length} onFixAll={fixActions.handleFixAll} />

            {tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0 || overridesExist) && (
                <div ref={violationsSectionRef}>
                    <ViolationsList
                        mithrilCards={mithrilCards} a11yCards={a11yCards}
                        resurfacedCardKeys={defer.resurfacedCardKeys} resurfaceTick={defer.resurfaceTick}
                        deferredCardKeys={defer.deferredCardKeys} overridesExist={overridesExist}
                        acceptedCount={fixActions.acceptedFixes.length} autoFixableCount={fixActions.autoFixableEntries.length}
                        a11yFixableCount={fixActions.autoFixableA11yEntries.length} manualCount={fixActions.manualA11yEntries.length}
                        sessionProgress={notifications.sessionInitialCount > 0 ? { fixed: Math.max(0, notifications.sessionInitialCount - totalViolations), total: notifications.sessionInitialCount } : undefined}
                        isBaselineSet={delta.isBaselineSet} effortEstimate={effortEstimate} activeFilePath={activeFilePath} getNodeName={getNodeName}
                        onApplyAccepted={() => void fixActions.applyAcceptedFixes()} onAutoFixMithril={fixActions.handleFixAll}
                        onFixAllA11y={() => void fixActions.handleBatchFixA11y()} onReviewManual={() => void 0}
                        onToggleExpand={toggleExpand}
                        onFix={(_, fixItem) => fixActions.handleFixSingle(fixItem)} onPreviewFix={onPreviewFixKey}
                        onAcceptFix={(key, fixItem) => fixActions.acceptInlineFix(key, fixItem)} onSkipFix={fixActions.skipInlineFix}
                        onFlag={onFlagKey} onUnflag={defer.handleUnflag}
                        onDefer={(key, d) => defer.setDeferDurations((prev) => new Map([...prev, [key, d]]))}
                        onDeferReasonChange={(key, r) => defer.setDeferReasons((prev) => new Map([...prev, [key, r]]))}
                        onDeferDurationChange={(key, d) => defer.setDeferDurations((prev) => new Map([...prev, [key, d]]))}
                        onSubmitDefer={onSubmitDeferKey} onCancelDefer={defer.toggleDeferForm} onPin={togglePin}
                    />
                </div>
            )}

            <GovernanceFooter
                visible={tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0)}
                onOpenGovernancePanel={onOpenGovernancePanel} onManageRules={onManageRules} onPolicySettings={onPolicySettings}
            />

            <AnomalyBanner anomalies={anomalies.anomalies as AnomalyAlert[]} isDismissed={anomalies.anomalyBannerDismissed} onDismiss={() => anomalies.setAnomalyBannerDismissed(true)} />

            <FixPreviewDrawerHost fixPreviewItems={fixActions.fixPreviewItems} onApply={() => void fixActions.handleApplyPreview()} onCancel={() => fixActions.setFixPreviewItems(null)} onOpenSettings={() => setRightTab('governance')} />

            <MoreDetailsPanel tokenCount={tokenCount} isOpen={isMoreOpen} onToggle={() => setIsMoreOpen((v) => !v)} isBaselineSet={delta.isBaselineSet}>
                <TopRulesAccordion isOpen={isTopRulesOpen} onToggle={() => setIsTopRulesOpen((v) => !v)}
                    topRules={healthSignal.topRules.map((r) => ({ type: r.ruleId as LinterWarning['type'], severity: r.severity, count: r.count }))}
                    onRuleRowClick={handleRuleRowClick}
                />
                <SessionBaselineAccordion
                    isOpen={isSessionOpen} onToggle={() => setIsSessionOpen((v) => !v)}
                    isBaselineSet={delta.isBaselineSet} baselineStatus={delta.baselineStatus} activeFilePath={activeFilePath}
                    activeFileName={activeFilePath ? (activeFilePath.split('/').pop() ?? activeFilePath) : null}
                    violationCount={totalViolations} baselineEntries={delta.baselineEntries.length}
                    totalRaw={delta.deltaWarnings.length} overridesExist={overridesExist} overrideCount={overrideCount}
                    confirmationMsg={confirmationMsg} onSetBaseline={() => void handleSetBaseline()} onClearBaseline={() => void handleClearBaseline()}
                />
                <McpActivityAccordion isOpen={isActivityOpen} onToggle={() => setIsActivityOpen((v) => !v)} events={mcpActivity.feed as McpActivityEvent[]} onUndo={() => void applyUndo()} />
                <TokenImpactAccordion isOpen={isTokenImpactOpen} onToggle={() => setIsTokenImpactOpen((v) => !v)} tokenImpact={tokenImpact.impactPreview as TokenImpactData | null} tokenImpactDetails={[]} isTokenImpactLoading={tokenImpact.isComputing} onPreviewImpact={() => void tokenImpact.refresh()} />
                <PendingApprovalsAccordion isOpen={isPendingOpen} onToggle={() => setIsPendingOpen((v) => !v)} pendingMutations={pending.pending as PendingMutation[]} onApprove={(id) => void pending.approve(String(id))} onReject={(id) => void pending.reject(String(id))} />
                <AuditLogAccordion isOpen={isAuditLogOpen} onToggle={handleAuditLogToggle} auditLog={auditLog.entries as AuditLogEntry[]} auditLogLoaded={auditLogLoaded} auditLogLoading={auditLog.isLoading} auditLogHasMore={auditLog.hasMore} onLoadMore={() => void auditLog.loadMore()} />
                <CoverageSection jurisdictionCoverage={coverage.jurisdictionCoverage as Record<string, { covered: number; total: number }> | null} inheritanceChain={coverage.inheritanceChain as string[]} isLoadingConfig={coverage.isLoadingConfig} />
            </MoreDetailsPanel>
        </div>
    )
}
