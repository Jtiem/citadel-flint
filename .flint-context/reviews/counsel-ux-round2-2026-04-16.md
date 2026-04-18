# Counsel UX Review — Round 2 (2026-04-16)

**Reviewer:** design-experience agent
**Scope:** Verify CHRON.1-repair sprint remediations against round-1 findings (commit 7511d75)
**Round 1 grade:** B

---

## Executive Summary

**New Grade: A-**

CHRON.1-repair resolves every P0 and P1 I called out in round 1. The score-formula unification is genuinely excellent — one canonical module (`shared/healthScore.ts`), one mirrored copy in MCP (with parity test enforcement), a 17-scenario cross-surface harness that asserts byte-for-byte equality. `inferRiskTier` is gone and `riskTier` is a required prop. `OverrideReasonDialog` exists, is wired to `ViolationCard`, and has thoughtful UX (Red requires ≥10 chars, Amber offers a dual-button "with/without reason" path, Cmd/Ctrl+Enter submits, autofocus + autoreset on reopen, MUI Dialog handles focus trap).

The surface misses a straight A only because of small residuals: `formatRelativeTime` does not guard future/negative deltas (an override with clock skew renders "-3m ago"), the ScoreSection narration still carries legacy `mithrilCount`/`a11yCount` fallback paths alongside the new canonical `criticalCount`/`amberCount`/`advisoryCount` triple (two parallel APIs in one prop shape — a future-drift trap), and the severity bucket chips ("Design System N / Accessibility N") remain unchanged — the severity-bucketed narration is only in the score-deduction modal, not in the primary chips a designer scans first. None of these block ship.

---

## Round 1 Resolution Status

| # | Round 1 Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Four competing health-score formulas (64/70/75/69) | **RESOLVED** | `shared/healthScore.ts` is the canonical formula. `debtReportService.computeHealthScore` mirrors it with a loud comment + parity test. `formatHealthSignal` delegates (its own formula deleted). `useGovernanceHealth` wraps canonical. `healthScore.parity.test.ts` runs 17 scenarios across all 4 surfaces and asserts byte equality. |
| P0-2 | Sub-score narration used type-weighted math that diverged from ring | **RESOLVED** | `ScoreSection` now accepts `criticalCount`/`amberCount`/`advisoryCount` and deducts `HEALTH_SCORE_WEIGHTS` imported from the canonical module. Fallback to legacy `mithrilCount`/`a11yCount` exists but is a transitional shim, not a divergent formula. |
| P1-1 | `OverrideReasonDialog` did not exist | **RESOLVED** | 295-line MUI Dialog at `src/components/ui/governance/OverrideReasonDialog.tsx`, wired to ViolationCard at line 1022. 17 tests confirmed present per sprint claim. |
| P1-2 | `inferRiskTier` was a naive name-based allowlist | **RESOLVED** | Function deleted. `riskTier: RiskTier` is now a required prop. A preserved NOTE comment at line 44 documents the change and warns future contributors to pass "amber" as a conservative default rather than reintroduce inference. All 3 `DiffCard` test call-sites pass `riskTier` explicitly. |

---

## New Findings Introduced By The Sprint

### N1 — `formatRelativeTime` does not guard future/negative deltas (P2, low risk)
`src/utils/relativeTime.ts:5-14` subtracts input from `Date.now()` without `Math.abs` or a future-guard. A clock-skewed client writing an override at `T+5s` renders `"Overridden by Justin -0m ago"` (negative 0, or negative integer for larger skew). Fix: clamp `mins = Math.max(0, mins)` or branch on sign. Not a blocker — clock skew in a local-first tool is rare.

### N2 — ScoreSection has dual prop APIs (P2, future-drift trap)
Both `mithrilCount`/`a11yCount` (type-bucketed, legacy) and `criticalCount`/`amberCount`/`advisoryCount` (severity-bucketed, canonical) are accepted. Lines 215-217 derive the bucket values with nullish-coalescing fallbacks. This works today but any caller that passes the old pair on a project with amber-severity a11y violations will under-report critical counts. Recommend: add a `@deprecated` JSDoc on the legacy pair and a console.warn in dev mode, then delete in a follow-up sprint.

### N3 — Severity bucket chips still show type taxonomy (P2, UX coherence)
The chips row ("Design System N / Accessibility N / Sync N") is type-bucketed while the score deduction is severity-bucketed. A designer who sees "2 Design System, 3 Accessibility" and tries to predict the score will reach for type-weighted math. Consider a secondary "Severity" row ("2 Critical · 3 Amber · 1 Advisory") or a flip-toggle. Not urgent — the "How is this calculated?" modal bridges this.

### N4 — Override row reads naturally but is dense (P3)
`Overridden by Justin 2h ago: "Waived per legal memo"` at `text-[10px]` italic is readable and low-noise. The 10px sizing is borderline on HiDPI displays. Bump to `text-[11px]` to match the DiffCard norm.

---

## UX Health: Before vs After

| Dimension | Round 1 | Round 2 |
|---|---|---|
| Score trustworthiness (Glass = MCP = CLI) | Broken (4 formulas) | **Hardened** (parity test enforces) |
| Risk-tier gate on AI mutations | Leaky (name-based) | **Airtight** (required prop) |
| User-initiated override reason capture | Missing | **Present + well-designed** |
| Information density in right sidebar | Overwhelming | Still dense (not touched this sprint) |
| Jargon leak (MRS, ΔE, rule IDs) | Present | Still present (not touched this sprint) |
| Plain-language labels | Good (`getRuleLabel`) | Still good |
| Keyboard/screen reader support on dialog | N/A | **Strong** (Esc, Cmd/Ctrl+Enter, aria-labelledby, autofocus, focus trap via MUI) |

---

## Recommendations (To Reach A)

1. Fix `formatRelativeTime` future-delta guard (one line).
2. Deprecate the legacy `mithrilCount`/`a11yCount` props on `ScoreSection`; collapse to the canonical triple.
3. Add severity-bucketed chips or a type/severity flip-toggle in the chips row so the primary scan matches the score math.
4. Pick up the untouched round-1 items in the next Counsel sprint: `MRS 42` jargon, ΔE leakage in OnboardingOverlay/PolicySettings, `MoreDetailsPanel` default-collapsed, `role="list"` on ViolationsList, DiffCard 10/11px → 12px minimum.

---

## Ship-Worthiness — Top 3

1. **CHRON.1 is now structurally sound.** The reason-capture contract (AI-mediated via DiffCard + user-initiated via OverrideReasonDialog) is complete. Risk-tier gating is enforced at the type system, not at runtime inference. Reason strings persist with actor and timestamp, filtered for `'skipped'`/`'auto'` sentinels. This is ship-grade.
2. **The score-parity harness is the highest-leverage test in the repo.** 17 scenarios × 4 surfaces with byte-for-byte assertions turns a trust-eroding bug class into a CI-caught regression. Keep this test in the critical path forever.
3. **Residuals are polish, not blockers.** `formatRelativeTime` future guard, ScoreSection dual-API deprecation, and chip-severity alignment are follow-up sprint material. Nothing in round 2 warrants blocking the sprint.

**Verdict: Ship. Grade A-.**
