# COUNSEL.1 Code Review — 2026-04-11

**Commit:** 9470eb8  
**Reviewer:** flint-review-gate  
**Verdict: SHIP**

## Results

- TSC: 0 errors
- Glass: 1961/1961 passing
- MCP: 4440/4440 passing

## Checklist

**Commandment compliance:** No violations found. No direct AST mutation (C3), no regex surgery (C13), no raw fs imports in src/ (process boundary), no store-inside-store imports. All file writes go through existing IPC channels.

**Mithril safety:** All new UI in ViolationCard, BatchActionBar, ScoreSection uses Tailwind token classes only. No hardcoded hex in className strings. Pre-existing sparkline hex values (emerald-400/red-400/amber-400 mapped to SVG stroke) carry a justification comment and predate this commit.

**A11y (COUNSEL.1.7):** Backdrop divs in ExportModal, GovernancePanel, PolicySettings now have keyboard dismiss (Enter/Space), role="button", tabIndex, aria-label. PolicySettings correctly moved role="dialog" and aria-modal from backdrop to inner content div. StatusBar has role="contentinfo". GovernanceDashboard has sr-only h2 for heading hierarchy. BatchActionBar buttons all have aria-labels.

**State architecture:** Auto-baseline effect (COUNSEL.1.2) calls window.flintAPI.baseline inside a useEffect, not inside a store action -- correct boundary. Uses useRef to gate single execution per session.

**Formula unification (COUNSEL.1.3):** Mithril penalty changed from 5 to 3 in three locations (shared/healthSignal.ts, debtReportService.ts, GovernanceDashboard.tsx). All tests updated to match. The canonical formula is now consistent across Glass, MCP, and CLI.

**Test coverage:** 144 new test lines covering DOM order, auto-baseline trigger/no-trigger, formula verification, chip visibility/zero-state, accordion open/close for nested elements.

## Warnings (non-blocking)

**WARNING: ExportModal complexity.** The blocked-export section now has deeply nested IIFEs (3 levels of `(() => { ... })()`). Extracting auto-fixable, manual, and override sections into named sub-components would improve readability. Not blocking -- functional correctness is verified by tests.

**WARNING: Duplicated violation row rendering.** ExportModal duplicates the Mithril violation card markup between auto-fixable and manual sections (~80 lines each). Consider extracting a shared `ExportViolationRow` component in a follow-up.
