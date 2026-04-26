/**
 * Executable contract — Sprint 2 Glass UI Fixes (Unified A+ Sweep) — v2 STRICT
 *
 * Companion to `.flint-context/contracts/sprint-2-glass-ui-fixes.md`.
 * Phase 2 implementers import types from this file; Phase 1.5 contract-linter
 * validates `CONTRACT` against `shared/contract-schema.ts`.
 *
 * v2 (2026-04-12): User decisions R1/R2/R3 expand the scope from a minimum-viable
 * patch into a full strict refactor. Final GovernanceDashboard.tsx must be < 500 LOC.
 */

import type { LegacyFlintContract } from '../../shared/contract-schema'
import type { LinterWarning, BaselineEntry } from '../../src/types/flint-api'

// ─── Hook contracts (H1–H15) ────────────────────────────────────────

export interface UseGovernanceDeltaResult {
    isBaselineSet: boolean
    baselineEntries: BaselineEntry[]
    baselineStatus: 'idle' | 'setting' | 'clearing'
    deltaWarnings: LinterWarning[]
    setBaseline: () => Promise<void>
    clearBaseline: () => Promise<void>
}

export interface UseGovernanceAuditResult {
    isAuditing: boolean
    lastAuditRanAt: number | null
    runAudit: () => Promise<void>
    auditError: string | null
}

export interface FixableItem {
    nodeId: string
    label: string
    hardcodedClass: string
    tokenClass: string
}

export interface AutoFixableEntry {
    nodeId: string
    label: string
    hardcodedClass: string
    tokenClass: string
}

export interface UseGovernanceFixActionsResult {
    autoFixableEntries: AutoFixableEntry[]
    autoFixableA11yEntries: LinterWarning[]
    manualA11yEntries: LinterWarning[]
    acceptedFixes: FixableItem[]
    fixPreviewItems: FixableItem[] | null
    inlineDiffOpen: Set<string>
    inlineDiffLoading: Set<string>
    inlineDiffData: Map<string, unknown>
    handleFixSingle: (item: FixableItem) => void
    handleFixAll: () => void
    handleBatchFixA11y: () => Promise<void>
    handleApplyPreview: () => Promise<void>
    setFixPreviewItems: (items: FixableItem[] | null) => void
    acceptInlineFix: (cardKey: string, item: FixableItem) => void
    skipInlineFix: (cardKey: string) => void
    toggleInlineDiff: (cardKey: string, ruleId: string, file: string | null) => Promise<void>
    applyAcceptedFixes: () => Promise<void>
}

export interface UseGovernanceDeferResult {
    deferredCardKeys: Set<string>
    deferredExpiresAt: Map<string, number>
    deferFormOpen: Set<string>
    deferReasons: Map<string, string>
    deferDurations: Map<string, string>
    deferSuccess: Set<string>
    deferSuccessMsg: Map<string, string>
    flaggedCardKeys: Set<string>
    aiSourcedCardKeys: Set<string>
    resurfacedCardKeys: Set<string>
    resurfaceTick: number
    setDeferReasons: import('react').Dispatch<import('react').SetStateAction<Map<string, string>>>
    setDeferDurations: import('react').Dispatch<import('react').SetStateAction<Map<string, string>>>
    toggleDeferForm: (cardKey: string) => void
    submitDefer: (cardKey: string, ruleId: string, nodeId: string) => Promise<void>
    handleFlag: (cardKey: string, ruleId: string, nodeId: string) => Promise<void>
    handleUnflag: (cardKey: string) => void
}

export interface UseGovernanceNotificationsResult {
    sessionInitialCount: number
    pulseRing: boolean
    showConfirmationToast: (msg: string) => void
}

export interface UseGovernanceAnomaliesResult {
    anomalies: Array<{ type: string; message?: string }>
    anomalyBannerDismissed: boolean
    setAnomalyBannerDismissed: (next: boolean) => void
    provenanceMap: Record<string, unknown>
}

export interface UseGovernanceCategoriesResult {
    categoryFilter: string | null
    setCategoryFilter: (cat: string | null) => void
    chipCounts: Record<string, number>
    visibleLinterWarnings: LinterWarning[]
    visibleA11yWarnings: LinterWarning[]
    effectiveA11yWarnings: LinterWarning[]
}

export interface UseGovernanceAuditLogResult {
    entries: unknown[]
    isLoading: boolean
    hasMore: boolean
    loadMore: () => Promise<void>
    refresh: () => Promise<void>
}

export interface UseGovernanceCleanStateResult {
    lastCleanCommit: string | null
    canRewind: boolean
    rewindToClean: () => Promise<void>
}

export interface UseGovernanceTokenImpactResult {
    impactPreview: unknown | null
    isComputing: boolean
    /** Optional `tokenName` triggers a recompute for that specific token. */
    refresh: (tokenName?: string) => Promise<void>
}

export interface UseGovernanceHealthSignalResult {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    subScores: { mithril: number; a11y: number; overrides: number }
    coachingSentence: string
    topRules: Array<{ ruleId: string; count: number; severity: LinterWarning['severity'] }>
    sparklineData: Array<{ score: number }>
}

export interface UseGovernanceCoverageResult {
    jurisdictionCoverage: unknown[] | Record<string, { covered: number; total: number }>
    inheritanceChain: unknown[]
    isLoadingConfig: boolean
}

export type ScheduleTimerFn = (fn: () => void, ms: number) => void

export interface UseGovernanceTimersResult {
    schedule: ScheduleTimerFn
    clearAll: () => void
}

export interface UseGovernancePendingMutationsResult {
    pending: unknown[]
    approve: (id: string) => Promise<void>
    reject: (id: string) => Promise<void>
}

export interface UseGovernanceMcpActivityResult {
    feed: unknown[]
    isStreaming: boolean
}

// ─── Fix-guide tables (MINOR-3) ─────────────────────────────────────

export interface FixGuideEntry {
    wcag: string
    wcagRef: string
    why: string
    steps: string[]
    snippet?: string
}

export type A11yFixGuideTable = Record<string, FixGuideEntry>
export type MithrilFixGuideTable = Record<string, FixGuideEntry>

// ─── getNodeName pure signature (MAJOR-3) ───────────────────────────

export interface VisualNodeLike {
    id: string
    tagName?: string
}

export type GetNodeNameFn = (tree: VisualNodeLike[], id: string) => string

// ─── CONTRACT metadata ──────────────────────────────────────────────

export const CONTRACT: LegacyFlintContract = {
    meta: {
        name: 'sprint-2-glass-ui-fixes',
        phase: 'UnifiedAPlus.Sprint2.v2',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-12',
    },
    impact: [
        // ── Hooks (CREATE) ──
        { file: 'src/hooks/useGovernanceDelta.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H1: baseline state + delta-filtered warnings.' },
        { file: 'src/hooks/useGovernanceAudit.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H2: on-demand audit trigger.' },
        { file: 'src/hooks/useGovernanceFixActions.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H3: single/batch/a11y fix handlers + preview state.' },
        { file: 'src/hooks/useGovernanceDefer.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H4: deferred keys, defer form, flag/unflag, resurface, AI-source detection.' },
        { file: 'src/hooks/useGovernanceNotifications.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H5: ring pulse, session progress, confirmation toasts.' },
        { file: 'src/hooks/useGovernanceAnomalies.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H6: anomaly fetch + dismissal + provenance map.' },
        { file: 'src/hooks/useGovernanceCategories.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H7: category filter + chip counts + filtered violation lists.' },
        { file: 'src/hooks/useGovernanceAuditLog.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H8: lazy audit log loader.' },
        { file: 'src/hooks/useGovernanceCleanState.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H9: last clean snapshot + rewind handler.' },
        { file: 'src/hooks/useGovernanceTokenImpact.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H10: token change impact preview.' },
        { file: 'src/hooks/useGovernanceHealthSignal.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H11: sub-scores, coaching, top-rules, sparkline data.' },
        { file: 'src/hooks/useGovernanceCoverage.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H12: compliance coverage + config inheritance data.' },
        { file: 'src/hooks/useGovernanceTimers.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H13: unmount-safe schedule(fn, ms) helper (MAJOR-1 fix).' },
        { file: 'src/hooks/useGovernancePendingMutations.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H14: S8.3 MRS pending approvals.' },
        { file: 'src/hooks/useGovernanceMcpActivity.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'H15: MCP activity feed.' },

        // ── Components (CREATE) ──
        { file: 'src/components/ui/governance/AnomalyBanner.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C1: Flare anomaly alert banner + dismiss.' },
        { file: 'src/components/ui/governance/ZeroViolationCelebration.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C2: confetti hero state when score=100.' },
        { file: 'src/components/ui/governance/CompactScoreSummary.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C3: chips, mini ring, grade, score, export badge, delta banner.' },
        { file: 'src/components/ui/governance/HealthScoreAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C4: sub-scores + sparkline + coaching sentence.' },
        { file: 'src/components/ui/governance/GovernanceHeader.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C5: header with Rewind-to-clean button.' },
        { file: 'src/components/ui/governance/ViolationsList.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C6: BatchActionBar + ViolationCard mapping (Mithril + A11y + Resurfaced + Deferred + Overrides).' },
        { file: 'src/components/ui/governance/GovernanceFooter.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C7: Manage rules / Policy settings footer links.' },
        { file: 'src/components/ui/governance/FixAllCta.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C8: primary "Fix all auto-fixable" CTA.' },
        { file: 'src/components/ui/governance/MoreDetailsPanel.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C9: outer accordion container for secondary details.' },
        { file: 'src/components/ui/governance/TopRulesAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C10: Top-5 violated rules accordion.' },
        { file: 'src/components/ui/governance/SessionBaselineAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C11: Session & Baseline accordion + confirmation toast.' },
        { file: 'src/components/ui/governance/McpActivityAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C12: MCP Activity Feed accordion.' },
        { file: 'src/components/ui/governance/TokenImpactAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C13: token change impact preview accordion.' },
        { file: 'src/components/ui/governance/PendingApprovalsAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C14: S8.3 MRS pending approvals accordion.' },
        { file: 'src/components/ui/governance/AuditLogAccordion.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C15: lazy audit log accordion.' },
        { file: 'src/components/ui/governance/CoverageSection.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C16: wraps CoverageBar + InheritanceChain w/ useGovernanceCoverage data.' },
        { file: 'src/components/ui/governance/FixPreviewDrawerHost.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C17: FixPreviewDrawer wiring + apply handler.' },
        { file: 'src/components/ui/governance/NoDesignSystemEmpty.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'C18: empty state when no design system loaded.' },

        // ── Modify ──
        { file: 'src/components/ui/GovernanceDashboard.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'M1: STRICT refactor. Reduce to <500 LOC. Pure composition only — import H1-H15 + C1-C18, render. No business logic, no raw setTimeout, no .getState() in render.' },
        { file: 'src/components/ui/governance/ScoreSection.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'M2: export existing Sparkline.' },
        { file: 'src/components/ui/governance/ViolationCard.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'M3 (MINOR-7): guard CopySnippet setTimeout via useEffect cleanup.' },
        { file: 'src/components/ui/TokenDetailPanel.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'M4 (MINOR-2): wrap dialog in <FocusTrap>; initial focus = close button.' },
        { file: 'src/components/ui/PasteAuditModal.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'M5 (MINOR-5): structured error state on JSON parse failure.' },

        // ── Hook tests ──
        { file: 'src/hooks/__tests__/useGovernanceDelta.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T1: H1 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceAudit.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T2: H2 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceFixActions.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T3: H3 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceDefer.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T4: H4 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceNotifications.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T5: H5 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceAnomalies.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T6: H6 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceCategories.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T7: H7 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceAuditLog.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T8: H8 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceCleanState.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T9: H9 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceTokenImpact.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T10: H10 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceHealthSignal.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T11: H11 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceCoverage.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T12: H12 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceTimers.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T13: H13 unit tests — unmount cleanup.' },
        { file: 'src/hooks/__tests__/useGovernancePendingMutations.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T14: H14 unit tests.' },
        { file: 'src/hooks/__tests__/useGovernanceMcpActivity.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T15: H15 unit tests.' },

        // ── Component tests ──
        { file: 'src/components/ui/governance/__tests__/AnomalyBanner.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T16: C1.' },
        { file: 'src/components/ui/governance/__tests__/ZeroViolationCelebration.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T17: C2.' },
        { file: 'src/components/ui/governance/__tests__/CompactScoreSummary.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T18: C3.' },
        { file: 'src/components/ui/governance/__tests__/HealthScoreAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T19: C4.' },
        { file: 'src/components/ui/governance/__tests__/GovernanceHeader.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T20: C5.' },
        { file: 'src/components/ui/governance/__tests__/ViolationsList.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T21: C6.' },
        { file: 'src/components/ui/governance/__tests__/GovernanceFooter.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T22: C7.' },
        { file: 'src/components/ui/governance/__tests__/FixAllCta.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T23: C8.' },
        { file: 'src/components/ui/governance/__tests__/MoreDetailsPanel.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T24: C9.' },
        { file: 'src/components/ui/governance/__tests__/TopRulesAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T25: C10.' },
        { file: 'src/components/ui/governance/__tests__/SessionBaselineAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T26: C11.' },
        { file: 'src/components/ui/governance/__tests__/McpActivityAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T27: C12.' },
        { file: 'src/components/ui/governance/__tests__/TokenImpactAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T28: C13.' },
        { file: 'src/components/ui/governance/__tests__/PendingApprovalsAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T29: C14.' },
        { file: 'src/components/ui/governance/__tests__/AuditLogAccordion.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T30: C15.' },
        { file: 'src/components/ui/governance/__tests__/CoverageSection.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T31: C16.' },
        { file: 'src/components/ui/governance/__tests__/FixPreviewDrawerHost.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T32: C17.' },
        { file: 'src/components/ui/governance/__tests__/NoDesignSystemEmpty.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T33: C18.' },
        { file: 'src/components/ui/__tests__/ContrastAuditPanel.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T34: coverage gap from review.' },
        { file: 'src/components/ui/__tests__/FixPreviewDrawer.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'T35: coverage gap from review.' },
    ],
    ipc: [],
    stores: [],
    components: [
        { name: 'GovernanceDashboard', file: 'src/components/ui/GovernanceDashboard.tsx', propsType: 'GovernanceDashboardProps', consumesStores: ['editorStore', 'canvasStore', 'governanceStore', 'tokenStore', 'notificationStore'], emitsIPC: ['baseline:*', 'mcp:callTool:flint_audit'] },
        { name: 'AnomalyBanner', file: 'src/components/ui/governance/AnomalyBanner.tsx', propsType: 'AnomalyBannerProps', consumesStores: [], emitsIPC: [] },
        { name: 'ZeroViolationCelebration', file: 'src/components/ui/governance/ZeroViolationCelebration.tsx', propsType: 'ZeroViolationCelebrationProps', consumesStores: [], emitsIPC: [] },
        { name: 'CompactScoreSummary', file: 'src/components/ui/governance/CompactScoreSummary.tsx', propsType: 'CompactScoreSummaryProps', consumesStores: [], emitsIPC: [] },
        { name: 'HealthScoreAccordion', file: 'src/components/ui/governance/HealthScoreAccordion.tsx', propsType: 'HealthScoreAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'GovernanceHeader', file: 'src/components/ui/governance/GovernanceHeader.tsx', propsType: 'GovernanceHeaderProps', consumesStores: [], emitsIPC: [] },
        { name: 'ViolationsList', file: 'src/components/ui/governance/ViolationsList.tsx', propsType: 'ViolationsListProps', consumesStores: [], emitsIPC: [] },
        { name: 'GovernanceFooter', file: 'src/components/ui/governance/GovernanceFooter.tsx', propsType: 'GovernanceFooterProps', consumesStores: [], emitsIPC: [] },
        { name: 'FixAllCta', file: 'src/components/ui/governance/FixAllCta.tsx', propsType: 'FixAllCtaProps', consumesStores: [], emitsIPC: [] },
        { name: 'MoreDetailsPanel', file: 'src/components/ui/governance/MoreDetailsPanel.tsx', propsType: 'MoreDetailsPanelProps', consumesStores: [], emitsIPC: [] },
        { name: 'TopRulesAccordion', file: 'src/components/ui/governance/TopRulesAccordion.tsx', propsType: 'TopRulesAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'SessionBaselineAccordion', file: 'src/components/ui/governance/SessionBaselineAccordion.tsx', propsType: 'SessionBaselineAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'McpActivityAccordion', file: 'src/components/ui/governance/McpActivityAccordion.tsx', propsType: 'McpActivityAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'TokenImpactAccordion', file: 'src/components/ui/governance/TokenImpactAccordion.tsx', propsType: 'TokenImpactAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'PendingApprovalsAccordion', file: 'src/components/ui/governance/PendingApprovalsAccordion.tsx', propsType: 'PendingApprovalsAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'AuditLogAccordion', file: 'src/components/ui/governance/AuditLogAccordion.tsx', propsType: 'AuditLogAccordionProps', consumesStores: [], emitsIPC: [] },
        { name: 'CoverageSection', file: 'src/components/ui/governance/CoverageSection.tsx', propsType: 'CoverageSectionProps', consumesStores: [], emitsIPC: [] },
        { name: 'FixPreviewDrawerHost', file: 'src/components/ui/governance/FixPreviewDrawerHost.tsx', propsType: 'FixPreviewDrawerHostProps', consumesStores: [], emitsIPC: [] },
        { name: 'NoDesignSystemEmpty', file: 'src/components/ui/governance/NoDesignSystemEmpty.tsx', propsType: 'NoDesignSystemEmptyProps', consumesStores: [], emitsIPC: [] },
        { name: 'TokenDetailPanel', file: 'src/components/ui/TokenDetailPanel.tsx', propsType: 'TokenDetailPanelProps', consumesStores: [], emitsIPC: [] },
        { name: 'PasteAuditModal', file: 'src/components/ui/PasteAuditModal.tsx', propsType: '(existing props)', consumesStores: [], emitsIPC: ['mcp:callTool:flint_audit'] },
        { name: 'ViolationCard', file: 'src/components/ui/governance/ViolationCard.tsx', propsType: '(existing props)', consumesStores: [], emitsIPC: [] },
        { name: 'ContrastAuditPanel', file: 'src/components/ui/ContrastAuditPanel.tsx', propsType: 'ContrastAuditPanelProps', consumesStores: [], emitsIPC: [] },
        { name: 'FixPreviewDrawer', file: 'src/components/ui/FixPreviewDrawer.tsx', propsType: '(existing props)', consumesStores: [], emitsIPC: [] },
    ],
    commandments: [4, 5],
    testBoundaries: [
        {
            target: 'GovernanceDashboard.tsx LOC ceiling',
            kind: 'component',
            behavior: 'Final file is composition only — every business-logic block extracted into a hook or child component.',
            assertion: '`wc -l src/components/ui/GovernanceDashboard.tsx` returns a value strictly less than 500',
            edgeCases: [
                'no setTimeout( in file',
                'no useEditorStore.getState() in file',
                'no function Sparkline / A11Y_FIX_GUIDE / MITH_FIX_GUIDE / interface FixGuide / function getFixGuide in file',
                'all 15 hooks (H1–H15) imported',
                'all 18 child components (C1–C18) imported',
                'all existing GovernanceDashboard.*.test.tsx suites pass',
            ],
        },
        {
            target: 'useGovernanceDelta',
            kind: 'hook',
            behavior: 'Owns baseline snapshot and delta-filtered warnings; mutations go through window.flintAPI.baseline.',
            assertion: 'returns UseGovernanceDeltaResult with correct initial + post-action state',
            edgeCases: ['no active file → setBaseline is no-op', 'baseline API missing → graceful', 'setBaseline error → status returns to idle', 'unmount mid-async → no setState'],
        },
        {
            target: 'useGovernanceAudit',
            kind: 'hook',
            behavior: 'Exposes isAuditing + lastAuditRanAt; runAudit calls flint_audit MCP tool.',
            assertion: 'returns UseGovernanceAuditResult; isAuditing toggles true→false around runAudit',
            edgeCases: ['no active file → no-op', 'mcp api missing → auditError populated', 'runAudit throws → error captured', 'unmount mid-flight → no setState'],
        },
        {
            target: 'useGovernanceFixActions',
            kind: 'hook',
            behavior: 'Owns single + batch + a11y fix flows and fix preview state.',
            assertion: 'handleFixSingle queues a fix, handleFixAll batches all auto-fixable, applyAcceptedFixes flushes accepted queue',
            edgeCases: ['no active file', 'empty acceptedFixes', 'a11y batch with no auto-fixable', 'preview drawer open/cancel'],
        },
        {
            target: 'useGovernanceDefer',
            kind: 'hook',
            behavior: 'Defer/flag state, resurface tick, AI-source detection.',
            assertion: 'submitDefer adds key to deferredCardKeys; resurface tick advances every 60s',
            edgeCases: ['defer with empty reason', 'unflag non-flagged', 'resurface expiration boundary'],
        },
        {
            target: 'useGovernanceNotifications',
            kind: 'hook',
            behavior: 'Session progress + ring pulse + confirmation toasts.',
            assertion: 'pulseRing flips true on score=100 transition',
            edgeCases: ['multiple toasts queued', 'unmount before pulse expires'],
        },
        {
            target: 'useGovernanceAnomalies',
            kind: 'hook',
            behavior: 'Anomaly fetch + dismissal + provenance.',
            assertion: 'anomalies populated from store; dismissal persists',
            edgeCases: ['empty anomaly list', 'provenance missing for some ids'],
        },
        {
            target: 'useGovernanceCategories',
            kind: 'hook',
            behavior: 'Category filter + chip counts + filtered visible warnings.',
            assertion: 'visibleLinterWarnings reflects categoryFilter',
            edgeCases: ['null filter shows all', 'unknown category → empty result'],
        },
        {
            target: 'useGovernanceAuditLog',
            kind: 'hook',
            behavior: 'Lazy audit log loader with pagination.',
            assertion: 'loadMore appends without duplicating',
            edgeCases: ['hasMore=false → loadMore no-op', 'refresh resets pagination'],
        },
        {
            target: 'useGovernanceCleanState',
            kind: 'hook',
            behavior: 'Tracks last clean snapshot; rewindToClean restores it.',
            assertion: 'canRewind=true when lastCleanCommit set',
            edgeCases: ['no clean snapshot → canRewind false', 'rewind error → graceful'],
        },
        {
            target: 'useGovernanceTokenImpact',
            kind: 'hook',
            behavior: 'Computes token-change impact preview.',
            assertion: 'refresh recomputes impactPreview',
            edgeCases: ['no tokens', 'compute throws'],
        },
        {
            target: 'useGovernanceHealthSignal',
            kind: 'hook',
            behavior: 'Sub-scores, coaching, top rules, sparkline.',
            assertion: 'grade derives from score thresholds; topRules sorted by count',
            edgeCases: ['score=0', 'score=100', 'no warnings → grade A'],
        },
        {
            target: 'useGovernanceCoverage',
            kind: 'hook',
            behavior: 'Compliance coverage + config inheritance fetch.',
            assertion: 'isLoadingConfig=false after fetch resolves',
            edgeCases: ['fetch error', 'empty coverage'],
        },
        {
            target: 'useGovernanceTimers',
            kind: 'hook',
            behavior: 'Unmount-safe schedule helper. All scheduled timers cleared on unmount.',
            assertion: 'no setState warnings after unmount of consumer',
            edgeCases: ['schedule called after unmount', 'clearAll while timers pending', 'multiple schedules same tick'],
        },
        {
            target: 'useGovernancePendingMutations',
            kind: 'hook',
            behavior: 'MRS pending approval queue.',
            assertion: 'approve/reject removes item from pending',
            edgeCases: ['approve unknown id', 'empty queue'],
        },
        {
            target: 'useGovernanceMcpActivity',
            kind: 'hook',
            behavior: 'MCP activity feed stream.',
            assertion: 'feed populated from event listener',
            edgeCases: ['stream disconnected', 'feed cap reached'],
        },
        {
            target: 'AnomalyBanner',
            kind: 'component',
            behavior: 'Renders anomaly count + dismiss; hidden when dismissed.',
            assertion: 'role="alert" present; dismiss button calls callback',
            edgeCases: ['empty anomalies → not rendered', 'multiple anomalies → all listed'],
        },
        {
            target: 'CompactScoreSummary',
            kind: 'component',
            behavior: 'Renders chips + ring + grade + delta banner.',
            assertion: 'chip click calls setCategoryFilter; export badge reflects gate state',
            edgeCases: ['delta mode active → banner shown', 'no warnings → ring at 100'],
        },
        {
            target: 'ViolationsList',
            kind: 'component',
            behavior: 'Renders BatchActionBar + ViolationCard mapping for Mithril, A11y, Resurfaced, Deferred, Overrides.',
            assertion: 'card count matches visibleWarnings length',
            edgeCases: ['no violations → not rendered', 'all deferred → deferred section only'],
        },
        {
            target: 'ViolationCard.CopySnippet',
            kind: 'component',
            behavior: 'Copy flash clears via useEffect cleanup.',
            assertion: 'no unmount warning',
            edgeCases: ['unmount before timer fires', 'double-click copy'],
        },
        {
            target: 'TokenDetailPanel',
            kind: 'component',
            behavior: 'FocusTrap wraps dialog content.',
            assertion: 'focus does not escape on Tab from last focusable',
            edgeCases: ['initial focus on close button', 'Escape closes', 'Shift+Tab cycles backward'],
        },
        {
            target: 'PasteAuditModal error state',
            kind: 'component',
            behavior: 'Structured error block on JSON parse failure.',
            assertion: 'role="alert" present; zero <li> with raw tool text',
            edgeCases: ['non-JSON string', 'JSON with stack trace', 'valid JSON happy path'],
        },
        {
            target: 'ContrastAuditPanel',
            kind: 'component',
            behavior: 'Loading / empty / populated states.',
            assertion: 'CTA renders when null; loading state when isLoading; matrix when data',
            edgeCases: ['null + not loading', 'empty array', 'AAA pass', 'fail badge', 'onClose', 'onRunAudit'],
        },
        {
            target: 'FixPreviewDrawer',
            kind: 'component',
            behavior: 'Diff renderer with confirm/cancel.',
            assertion: 'confirm callback receives full items array',
            edgeCases: ['empty', 'single', 'batch 3+', 'always-auto-fix toggle', 'cancel', 'a11y names'],
        },
    ],
    risks: [
        { risk: '15 hooks + 18 components is a large surface; bad extraction cascades through 10+ existing test files.', severity: 'high', mitigation: 'R2: test-after-every-extraction in Group E; never batch failures.' },
        { risk: 'Hook interdependencies (fixActions needs timers, categories needs delta) introduce hidden ordering constraints.', severity: 'medium', mitigation: 'Render shape in contract documents the dependency graph; Group E follows it.' },
        { risk: 'Extracted hooks reintroduce .getState() reads in render path (regresses MAJOR-3).', severity: 'medium', commandment: 5, mitigation: 'Linter and code review gate flag any .getState() in hook bodies.' },
        { risk: 'Final GovernanceDashboard.tsx exceeds 500 LOC.', severity: 'medium', mitigation: 'Hard fail at >=500. Group E extracts the next-largest block until <500.' },
        { risk: 'Existing GovernanceDashboard.*.test.tsx suites import internal helpers (e.g., getFixGuide).', severity: 'low', mitigation: 'Update test imports to canonical sources (ViolationCard for guides).' },
        { risk: 'Component prop surface explosion (each child takes 5+ props).', severity: 'low', mitigation: 'Pass hook result objects whole rather than destructuring at call site.' },
        { risk: 'PasteAuditModal error test expectations depend on old 500-char dump format.', severity: 'low', mitigation: 'Update single affected test in same PR.' },
    ],
    parallelismGroups: {
        A1: ['flint-state-architect'],
        A2: ['flint-state-architect'],
        A3: ['flint-state-architect'],
        B1: ['flint-design-engineer'],
        B2: ['flint-design-engineer'],
        B3: ['flint-design-engineer'],
        C: ['flint-design-engineer'],
        D: ['flint-test-writer'],
        E: ['flint-design-engineer'],
    },
    nonGoals: [
        'No new IPC channels',
        'No new Zustand stores or store slices',
        'No new features — existing behavior preserved exactly',
        'No MINOR-1 (TokenManager stale-closure doc)',
        'No MINOR-4 (LaunchScreen AbortController fix)',
        'No MINOR-6 (ScoreSection hex → tokens.ts)',
        'No MINOR-8 (DetectionBanner React default import)',
        'No Sparkline extraction to a shared module — only export from ScoreSection',
    ],
}
