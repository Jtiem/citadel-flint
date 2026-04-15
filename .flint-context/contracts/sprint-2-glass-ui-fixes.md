# Contract — Sprint 2 Glass UI Fixes (Unified A+ Sweep) — v2 STRICT REFACTOR

**Phase:** Sprint 2 / Unified A+ Sweep
**Branch:** `fix/sprint-2-glass-ui`
**Owner architect:** flint-architect
**Date:** 2026-04-12
**Status:** APPROVED (decision-driven expansion; pending Phase 1.5 lint)

---

## Decisions Log

| ID | Date | Decision | Rationale |
|----|------|----------|-----------|
| **R1** | 2026-04-12 | **STRICT <500 LOC ceiling for `GovernanceDashboard.tsx`.** Sprint scope expanded to perform the full refactor: every block of business logic, side-effect, and self-contained JSX section is extracted. The final file is composition only — render child components, pass props. | Justin (UX lead): "Fix it all properly" — strict refactor, not minimum viable. The 1000 LOC soft ceiling was an architect compromise; user overruled. Rejecting the LOC ceiling now means another sweep in 2 sprints. |
| **R2** | 2026-04-12 | **Group E agent runs `npm run test:react` after EVERY extraction step**, not at the end. Any breaking `GovernanceDashboard.*.test.tsx` is fixed immediately before the next extraction. No batched failures. | A 2,788 → <500 LOC refactor with 10+ existing test files cannot batch-debug at the end. Extract → test → green → next extract. |
| **R3** | 2026-04-12 | **Hook tests live in `src/hooks/__tests__/`.** | Confirmed convention. No change. |

---

## Non-Goals (Out of Scope)

- **ZERO new IPC channels.** No changes to `electron/preload.ts`, `electron/main.ts`, or `server/index.ts`.
- **ZERO new Zustand stores or store slices.** No changes to `src/store/**`.
- **No new features.** Refactor + review-driven patches only. Existing behavior preserved exactly.
- **No Sparkline extraction to a shared module.** Export from `./governance/ScoreSection`.
- **No LaunchScreen / TokenManager / DetectionBanner minor fixes** — out of scope for Sprint 2.

---

## Source Review

All findings quoted from `.flint-context/reviews/glass-ui-expansion-aplus-review-2026-04-12.md`.
Refactor scope grounded in actual structure of `src/components/ui/GovernanceDashboard.tsx` (2,788 LOC at branch start), mapped via section dividers and JSX comment regions.

---

## Impact Map (v2)

### Hooks (CREATE — owned by `flint-state-architect`)

| # | File | Source lines | Owns |
|---|------|--------------|------|
| H1 | `src/hooks/useGovernanceDelta.ts` | ~479-580, 934-980 | Baseline state, baseline mutations, delta-filtered warnings |
| H2 | `src/hooks/useGovernanceAudit.ts` | ~981-1002 | `isAuditing`, `lastAuditRanAt`, `runAudit`, `auditError` |
| H3 | `src/hooks/useGovernanceFixActions.ts` | ~1027-1211 | Single fix, batch fix Mithril, batch fix A11y, fix preview state, accepted fixes, inline diff state |
| H4 | `src/hooks/useGovernanceDefer.ts` | ~609-797 | Deferred card keys, resurface check, defer form state, flag/unflag, AI-source detection |
| H5 | `src/hooks/useGovernanceNotifications.ts` | ~689-696, 1271-1277, defer-success bits | Ring pulse trigger, session fix progress, defer success toasts, confirmation toasts |
| H6 | `src/hooks/useGovernanceAnomalies.ts` | ~639-678, 655-677 | Anomaly fetch, anomaly dismissal, provenance map |
| H7 | `src/hooks/useGovernanceCategories.ts` | ~581-608 | Category filter, chip counts, filtered violation lists |
| H8 | `src/hooks/useGovernanceAuditLog.ts` | ~696-744 | Lazy audit log loader, pagination |
| H9 | `src/hooks/useGovernanceCleanState.ts` | ~1278-1315 | Last clean snapshot, Rewind-to-clean handler |
| H10 | `src/hooks/useGovernanceTokenImpact.ts` | ~1316-1407 | Token change impact preview |
| H11 | `src/hooks/useGovernanceHealthSignal.ts` | ~859-925, 1368-1407 | Sub-scores, coaching sentence, top-5 rules, sparkline history |
| H12 | `src/hooks/useGovernanceCoverage.ts` | (jurisdictionCoverage + inheritanceChain reads) | Compliance coverage + config inheritance data |
| H13 | `src/hooks/useGovernanceTimers.ts` | (MAJOR-1) | Unmount-safe `schedule(fn, ms)` helper. Replaces 5 raw `setTimeout` calls. |
| H14 | `src/hooks/useGovernancePendingMutations.ts` | ~1407-1525 | S8.3 pending mutations / MRS approval queue state |
| H15 | `src/hooks/useGovernanceMcpActivity.ts` | ~1537-1559 | MCP activity log feed state |

### Components (CREATE — owned by `flint-design-engineer`)

All live under `src/components/ui/governance/`.

| # | File | Source lines | Renders |
|---|------|--------------|---------|
| C1 | `src/components/ui/governance/AnomalyBanner.tsx` | 2290-2329 | Flare anomaly alert + dismiss |
| C2 | `src/components/ui/governance/ZeroViolationCelebration.tsx` | 1710-1778 | Confetti hero state for score=100 |
| C3 | `src/components/ui/governance/CompactScoreSummary.tsx` | 1779-1918 | Category chips, mini ring, grade, score, export badge, delta banner |
| C4 | `src/components/ui/governance/HealthScoreAccordion.tsx` | 1919-2056 | Sub-scores, sparkline, coaching sentence (uses exported `Sparkline` from ScoreSection) |
| C5 | `src/components/ui/governance/GovernanceHeader.tsx` | 1621-1685 | Header row with Rewind-to-clean button |
| C6 | `src/components/ui/governance/ViolationsList.tsx` | 2072-2249 | BatchActionBar + Mithril + A11y + Resurfaced + Deferred + Overrides ViolationCard mapping |
| C7 | `src/components/ui/governance/GovernanceFooter.tsx` | 2252-2288 | Manage rules / Policy settings footer links |
| C8 | `src/components/ui/governance/FixAllCta.tsx` | 2057-2070 | Primary "Fix all auto-fixable" CTA |
| C9 | `src/components/ui/governance/MoreDetailsPanel.tsx` | 2341-2785 | Outer accordion container hosting all the secondary "More details" sections |
| C10 | `src/components/ui/governance/TopRulesAccordion.tsx` | 2361-2400 | Top-5 violated rules accordion |
| C11 | `src/components/ui/governance/SessionBaselineAccordion.tsx` | 2401-2471 | Session & Baseline accordion + confirmation toast |
| C12 | `src/components/ui/governance/McpActivityAccordion.tsx` | 2472-2544 | MCP Activity Feed accordion (S4.11) |
| C13 | `src/components/ui/governance/TokenImpactAccordion.tsx` | 2545-2608 | COUNSEL.4.1 token change impact preview |
| C14 | `src/components/ui/governance/PendingApprovalsAccordion.tsx` | 2609-2683 | S8.3 MRS pending approvals |
| C15 | `src/components/ui/governance/AuditLogAccordion.tsx` | 2684-2776 | COUNSEL.4.5 lazy audit log |
| C16 | `src/components/ui/governance/CoverageSection.tsx` | 2777-2782 | Wraps CoverageBar + InheritanceChain w/ `useGovernanceCoverage` data |
| C17 | `src/components/ui/governance/FixPreviewDrawerHost.tsx` | 2331-2340 | FixPreviewDrawer wiring + apply handler |
| C18 | `src/components/ui/governance/NoDesignSystemEmpty.tsx` | 1688-1704 | Empty state when no design system loaded |

### MODIFY (existing files)

| # | File | Owner | Change |
|---|------|-------|--------|
| M1 | `src/components/ui/GovernanceDashboard.tsx` | flint-design-engineer (Group E) | **Reduce to <500 LOC.** Pure composition: import all C1–C18, wire all H1–H15, render. No business logic. No raw setTimeout. No `.getState()` in render path. |
| M2 | `src/components/ui/governance/ScoreSection.tsx` | flint-design-engineer | Export existing `Sparkline` (1-line change). |
| M3 | `src/components/ui/governance/ViolationCard.tsx` | flint-design-engineer | MINOR-7: guard `CopySnippet` `setTimeout` with `useEffect` cleanup. |
| M4 | `src/components/ui/TokenDetailPanel.tsx` | flint-design-engineer | MINOR-2: wrap dialog body in `<FocusTrap>`, initial focus → close button. |
| M5 | `src/components/ui/PasteAuditModal.tsx` | flint-design-engineer | MINOR-5: structured error state instead of 500-char text dump. |

### Test files (CREATE — owned by `flint-test-writer`)

| # | File | Covers |
|---|------|--------|
| T1 | `src/hooks/__tests__/useGovernanceDelta.test.ts` | H1 |
| T2 | `src/hooks/__tests__/useGovernanceAudit.test.ts` | H2 |
| T3 | `src/hooks/__tests__/useGovernanceFixActions.test.ts` | H3 |
| T4 | `src/hooks/__tests__/useGovernanceDefer.test.ts` | H4 |
| T5 | `src/hooks/__tests__/useGovernanceNotifications.test.ts` | H5 |
| T6 | `src/hooks/__tests__/useGovernanceAnomalies.test.ts` | H6 |
| T7 | `src/hooks/__tests__/useGovernanceCategories.test.ts` | H7 |
| T8 | `src/hooks/__tests__/useGovernanceAuditLog.test.ts` | H8 |
| T9 | `src/hooks/__tests__/useGovernanceCleanState.test.ts` | H9 |
| T10 | `src/hooks/__tests__/useGovernanceTokenImpact.test.ts` | H10 |
| T11 | `src/hooks/__tests__/useGovernanceHealthSignal.test.ts` | H11 |
| T12 | `src/hooks/__tests__/useGovernanceCoverage.test.ts` | H12 |
| T13 | `src/hooks/__tests__/useGovernanceTimers.test.ts` | H13 |
| T14 | `src/hooks/__tests__/useGovernancePendingMutations.test.ts` | H14 |
| T15 | `src/hooks/__tests__/useGovernanceMcpActivity.test.ts` | H15 |
| T16 | `src/components/ui/governance/__tests__/AnomalyBanner.test.tsx` | C1 |
| T17 | `src/components/ui/governance/__tests__/ZeroViolationCelebration.test.tsx` | C2 |
| T18 | `src/components/ui/governance/__tests__/CompactScoreSummary.test.tsx` | C3 |
| T19 | `src/components/ui/governance/__tests__/HealthScoreAccordion.test.tsx` | C4 |
| T20 | `src/components/ui/governance/__tests__/GovernanceHeader.test.tsx` | C5 |
| T21 | `src/components/ui/governance/__tests__/ViolationsList.test.tsx` | C6 |
| T22 | `src/components/ui/governance/__tests__/GovernanceFooter.test.tsx` | C7 |
| T23 | `src/components/ui/governance/__tests__/FixAllCta.test.tsx` | C8 |
| T24 | `src/components/ui/governance/__tests__/MoreDetailsPanel.test.tsx` | C9 |
| T25 | `src/components/ui/governance/__tests__/TopRulesAccordion.test.tsx` | C10 |
| T26 | `src/components/ui/governance/__tests__/SessionBaselineAccordion.test.tsx` | C11 |
| T27 | `src/components/ui/governance/__tests__/McpActivityAccordion.test.tsx` | C12 |
| T28 | `src/components/ui/governance/__tests__/TokenImpactAccordion.test.tsx` | C13 |
| T29 | `src/components/ui/governance/__tests__/PendingApprovalsAccordion.test.tsx` | C14 |
| T30 | `src/components/ui/governance/__tests__/AuditLogAccordion.test.tsx` | C15 |
| T31 | `src/components/ui/governance/__tests__/CoverageSection.test.tsx` | C16 |
| T32 | `src/components/ui/governance/__tests__/FixPreviewDrawerHost.test.tsx` | C17 |
| T33 | `src/components/ui/governance/__tests__/NoDesignSystemEmpty.test.tsx` | C18 |
| T34 | `src/components/ui/__tests__/ContrastAuditPanel.test.tsx` | (coverage gap from review) |
| T35 | `src/components/ui/__tests__/FixPreviewDrawer.test.tsx` | (coverage gap from review) |

### Total

- **15 hooks created**
- **18 components created**
- **5 files modified**
- **35 test files created**
- **= 73 files in scope**

---

## Per-File Defect → Fix → Acceptance

(Unchanged from v1 for M2–M5, ViolationCard, TokenDetailPanel, PasteAuditModal, ContrastAuditPanel, FixPreviewDrawer test files. See git blame on the previous revision for full text. All five MINOR fixes still apply. The new content below covers only the v2 expansion.)

### M1. `GovernanceDashboard.tsx` — strict refactor to <500 LOC

**Hard acceptance criteria:**

1. `wc -l src/components/ui/GovernanceDashboard.tsx` returns a value **< 500**.
2. The file contains **zero** of the following:
   - `function Sparkline`
   - `const A11Y_FIX_GUIDE`
   - `const MITH_FIX_GUIDE`
   - `interface FixGuide`
   - `function getFixGuide`
   - `setTimeout(` (all timers go through `useGovernanceTimers`)
   - `useEditorStore.getState()` (in render path)
   - Inline business logic — only hook calls, prop threading, and JSX composition.
3. All 15 hooks (H1–H15) are imported and consumed.
4. All 18 child components (C1–C18) are imported and rendered.
5. All existing `GovernanceDashboard.*.test.tsx` suites still pass without behavioral change.
6. `npx tsc --noEmit` reports 0 errors.

**Render shape (target):**

```tsx
export function GovernanceDashboard(props: GovernanceDashboardProps = {}) {
  // 1. Read stores via subscriptions (NOT .getState())
  const visualTree = useEditorStore(s => s.visualTree)
  const activeFilePath = useCanvasStore(s => s.activeFilePath)
  // ... other subscriptions

  // 2. Compose hooks
  const timers = useGovernanceTimers()
  const delta = useGovernanceDelta()
  const audit = useGovernanceAudit()
  const fixActions = useGovernanceFixActions({ timers })
  const defer = useGovernanceDefer({ timers })
  const notifications = useGovernanceNotifications({ timers })
  const anomalies = useGovernanceAnomalies()
  const categories = useGovernanceCategories({ delta })
  const auditLog = useGovernanceAuditLog()
  const cleanState = useGovernanceCleanState()
  const tokenImpact = useGovernanceTokenImpact()
  const healthSignal = useGovernanceHealthSignal({ delta })
  const coverage = useGovernanceCoverage()
  const pending = useGovernancePendingMutations()
  const mcpActivity = useGovernanceMcpActivity()

  // 3. Render — composition only
  return (
    <div className="...">
      <GovernanceHeader cleanState={cleanState} {...props} />
      <NoDesignSystemEmpty visible={tokenCount === 0} />
      <ZeroViolationCelebration healthSignal={healthSignal} />
      <CompactScoreSummary categories={categories} healthSignal={healthSignal} delta={delta} />
      <HealthScoreAccordion healthSignal={healthSignal} />
      <FixAllCta fixActions={fixActions} categories={categories} />
      <ViolationsList
        categories={categories}
        defer={defer}
        fixActions={fixActions}
        anomalies={anomalies}
        visualTree={visualTree}
        activeFilePath={activeFilePath}
      />
      <GovernanceFooter {...props} />
      <AnomalyBanner anomalies={anomalies} />
      <FixPreviewDrawerHost fixActions={fixActions} />
      <MoreDetailsPanel>
        <TopRulesAccordion healthSignal={healthSignal} />
        <SessionBaselineAccordion delta={delta} audit={audit} />
        <McpActivityAccordion mcpActivity={mcpActivity} />
        <TokenImpactAccordion tokenImpact={tokenImpact} />
        <PendingApprovalsAccordion pending={pending} />
        <AuditLogAccordion auditLog={auditLog} />
        <CoverageSection coverage={coverage} />
      </MoreDetailsPanel>
    </div>
  )
}
```

This shape, with imports + props types, is well under 500 LOC. Estimated final size: **350–450 LOC**.

---

## Work Partition & Parallelization (v2)

### Wave 1 — fully parallel (no inter-dependencies)

| Group | Agent | Files |
|-------|-------|-------|
| **A1** | flint-state-architect (#1) | H1, H2, H7, H9 + tests T1, T2, T7, T9 |
| **A2** | flint-state-architect (#2) | H3, H4, H5, H13 + tests T3, T4, T5, T13 |
| **A3** | flint-state-architect (#3) | H6, H8, H10, H11, H12, H14, H15 + tests T6, T8, T10, T11, T12, T14, T15 |
| **B1** | flint-design-engineer (#1) | C1, C2, C5, C7, C8, C18 + tests T16, T17, T20, T22, T23, T33; M3 (ViolationCard) |
| **B2** | flint-design-engineer (#2) | C3, C4, C6 + tests T18, T19, T21; M2 (ScoreSection Sparkline export) |
| **B3** | flint-design-engineer (#3) | C9, C10, C11, C12, C13, C14, C15, C16, C17 + tests T24–T32 |
| **C** | flint-design-engineer (#4) | M4 (TokenDetailPanel), M5 (PasteAuditModal) |
| **D** | flint-test-writer | T34 (ContrastAuditPanel), T35 (FixPreviewDrawer) |

All Wave 1 groups spawn simultaneously. Each must run `npm run test:react` after every file landed (R2).

### Wave 2 — strictly serial, runs LAST

| Group | Agent | Files | Blocked on |
|-------|-------|-------|------------|
| **E** | flint-design-engineer (lead) | M1 (`GovernanceDashboard.tsx` strict refactor) | All of Wave 1 must be GREEN (TSC + tests) |

Group E's process is:
1. Pull green Wave 1.
2. Refactor `GovernanceDashboard.tsx` step-by-step. After EACH extraction, run `npm run test:react` and fix any breaking `GovernanceDashboard.*.test.tsx` immediately (R2).
3. Confirm `wc -l src/components/ui/GovernanceDashboard.tsx` < 500.
4. Confirm `npx tsc --noEmit` is clean.
5. Hand off to Phase 3 (`flint-integration-validator`).

---

## Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|---|---|---|
| 4 | Local-First Only | Yes | All changes stay in renderer; no new external URLs. |
| 5 | Accessibility is a Compiler Error | Yes | MINOR-2 FocusTrap restores keyboard-trap. |
| 13 | Deterministic Surgery | No | No source-code mutation tooling touched. |

Not applicable: 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16.

---

## Risks (v2)

| Risk | Severity | Mitigation |
|------|----------|------------|
| 15 hooks + 18 components is a large surface; a single bad extraction can cascade through 10+ existing test files. | **high** | R2: test-after-every-extraction. Group E never batches. |
| Hook interdependencies (e.g., fixActions needs timers, categories needs delta) introduce a hidden ordering constraint. | medium | Contract documents the dependency graph in the M1 render shape. Group E follows that order. |
| Extracted hooks reintroduce `.getState()` reads in render path (regresses MAJOR-3). | medium | Linter + code review gate flag any `.getState()` in hook bodies. |
| Final GovernanceDashboard.tsx exceeds 500 LOC despite extraction. | medium | Group E's checklist explicitly fails the gate at >=500. If hit, extract the next-largest block until <500. |
| Component prop surface explosion (each child takes 5+ props from hooks). | low | Pass hook result objects whole rather than destructuring at call site. Each child component imports its needed hook result type from the hook file. |
| Existing `GovernanceDashboard.*.test.tsx` suites depend on internal helpers (e.g., test importing `getFixGuide`). | low | Update imports in tests to point at canonical sources (ViolationCard for guides, etc.). |

---

## Phase 2 Entry Criteria

1. Contract status flipped to **APPROVED** (this revision). Phase 1.5 lint may still validate.
2. Wave 1 (groups A1–A3, B1–B3, C, D) spawns simultaneously.
3. Wave 2 (Group E, the GovernanceDashboard refactor) waits for Wave 1 GREEN signal.
4. R2 enforced: Group E runs `npm run test:react` after every extraction step.
