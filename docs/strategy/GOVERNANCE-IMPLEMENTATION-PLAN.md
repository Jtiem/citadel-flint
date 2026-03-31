# Governance Implementation Plan — "Counsel"

**Citadel Name:** Counsel — *Where governance advises rather than judges.*

4 sprints. 20 tasks. Transforms governance from verdict-first to guidance-first.

---

## Sprint COUNSEL.1 — Triage + Framing Foundation

The sprint that changes the first emotional beat. Every change here is presentational — no new infrastructure required.

### COUNSEL.1.1 — Category Split Header (GovernanceDashboard)

**What:** Add a three-column summary row above the health score ring showing counts by category: Design System | Accessibility | Token Sync. These replace the ring as the first thing a designer reads.

**Why:** Every governance tool surveyed (Snyk, SonarQube, axe, Figma plugins) leads with a category breakdown before showing individual violations. Flint leads with a grade. A designer's first question is "what kind of problem is this?" — not "what is my score?"

**Scope:** `src/components/ui/GovernanceDashboard.tsx` — add three `<button>` chips above the score section. Clicking a chip filters the violation list to that category.

**Data already exists:** `mithrilViolations`, `a11yViolations`, and a new `syncViolations` derived from the token sync state already in Zustand.

---

### COUNSEL.1.2 — New-Code-First Default (Delta Mode Inversion)

**What:** When a project opens with more than 10 pre-existing violations, automatically enable Delta Mode and show a contextual banner: "This project has N existing violations. Showing only changes in this session — tap to see all." Delta Mode becomes opt-out for legacy projects, not opt-in for everyone.

**Why:** The "F on day one" problem is the abandon point for legacy project onboarding. SonarQube's "Clean as You Code" solves this with new-code-first framing. Flint's Delta Mode is architecturally identical — it just needs to be the default state, not a hidden power tool.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (banner + auto-enable logic), `electron/main.ts` (violation count on project open IPC), `src/App.tsx` (pass count to dashboard).

**Data already exists:** `violation_baselines` table, Delta Mode state in `canvasStore`.

---

### COUNSEL.1.3 — Health Score Formula Unification (Critical Defect Fix)

**What:** GovernanceDashboard and `flint_debt_report` must produce the same health score for the same project. Adopt a single formula: severity-weighted counts (`criticals × 10, warnings × 3`), computed from the `flint://dashboard` MCP resource rather than local Zustand state.

**Why:** The two formulas (dashboard: `mithril×5 + a11y×10 + override×3` vs dbomService: `criticals×10 + warnings×3`) produce different grades for the same project. This is a trust-destroying defect — a designer who sees "B" in Glass and then asks an agent for a debt report cannot receive a different letter. One source of truth.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (switch to MCP resource), `flint-mcp/src/core/governance/dbomService.ts` (confirm formula is canonical), `src/hooks/useGovernanceHealth.ts` (new hook to abstract the computation).

---

### COUNSEL.1.4 — Violation Card Fix Co-location

**What:** Each violation card expands to show an inline diff preview: current value on the left, proposed token replacement on the right, with a color swatch for visual comparison. Accept or Skip are the two actions. Accepted fixes queue for a single batched mutation run.

**Why:** The current FixPreviewDrawer is a separate navigation step. GitHub Copilot Autofix and Figma "Check Designs" both show the fix adjacent to the violation. Moving the preview into the card reduces one decision step per violation and enables the designer to review all proposed fixes as a set before committing any mutation.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (inline diff expansion), `electron/main.ts` (new IPC: `governance:preview-fix` calling `flint_fix` dry_run). `src/components/ui/FixPreviewDrawer.tsx` can remain for the full-screen review flow.

---

### COUNSEL.1.5 — Auto-Fixable Label on Every Violation

**What:** Every violation card shows one of three states before the fix button: "Auto-fixable" (Flint can repair it in one click), "Needs your input" (requires human decision), or "Flagged for review" (new state, coming in COUNSEL.2).

**Why:** ESLint marks fixable rules explicitly. Without this label, a designer with 15 violations doesn't know if Autopilot can solve 14 of them in 30 seconds or if all 15 require manual work. The distinction shapes effort expectations immediately.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` — derive fixability from violation type (Mithril with nearest token = auto-fixable; A11y structural = needs input).

---

### COUNSEL.1.6 — A11y Batch Fix Button

**What:** Add a "Fix all accessibility" batch action alongside the existing Mithril batch fix, using the same batched mutation queue pattern. For violations that cannot be batch-fixed (structural a11y changes), the button shows "Review N manually" and jumps to the first manual item.

**Why:** 15 a11y violations = 15 button presses currently. The Mithril batch fix already proves this pattern works. Extending it to a11y removes the most tedious repeated interaction in the governance flow.

**Scope:** `src/components/ui/GovernanceDashboard.tsx`, `electron/main.ts` (new IPC handler for batch a11y fix), `flint-mcp/src/tools/fix.ts` (extend for a11y auto-fixable rules).

---

### COUNSEL.1.7 — 26 Accessibility Fixes (Governance UI Self-Audit)

**What:** Repair all 26 accessibility violations found in Flint's own governance components. Governance must be compliant before it audits others.

**Priority fixes:**
1. Add root `<h1>` to `src/App.tsx` (fixes heading hierarchy in all components)
2. Convert `<h2>/<h3>` skips to proper levels in GovernanceDashboard, GovernancePanel, PolicySettings, ExportModal
3. Remove or replace `<div onClick>` backdrop handlers in GovernancePanel, PolicySettings, ExportModal with keyboard-equivalent patterns
4. Wrap StatusBar in `<footer>` landmark; add `role="banner"` to app header

**Scope:** `src/App.tsx`, `src/components/ui/GovernanceDashboard.tsx`, `src/components/ui/GovernancePanel.tsx`, `src/components/ui/PolicySettings.tsx`, `src/components/ui/ExportModal.tsx`, `src/components/editor/StatusBar.tsx`.

---

## Sprint COUNSEL.2 — Deferral + Workload Voice

The sprint that makes governance a partner instead of a blocker.

### COUNSEL.2.1 — "Defer" Button in Violation List + ExportModal

**What:** Every violation card in GovernanceDashboard gets a "Defer" secondary action (chevron-down → dropdown: Defer). The ExportModal pre-flight gets a "Defer and Export" path for non-critical violations. The defer action opens a small form: Reason (optional, nudged), Duration (1 day / 1 week / Until next sync / Manually), Scope (this session / this file / this project).

**Why:** `flint_defer_violation` exists as an MCP tool. A designer blocked at the export gate during a hotfix has no way to say "I know about this, I'll fix it after the hotfix." They must either fix it (risky during hotfix) or permanently ignore it (loses governance signal). This is the highest-priority governance UX gap in the product.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (defer dropdown), `src/components/ui/ExportModal.tsx` (defer + export path), `electron/main.ts` (new IPC: `governance:defer-violation`), `electron/store.ts` (deferrals table with expiry).

---

### COUNSEL.2.2 — "Flagged for Review" Tier

**What:** A third violation state between "active" (counts against score, may block export) and "overridden" (suppressed, counts penalty). "Flagged for Review" means: I've looked at this and I'm investigating whether it applies. Violations in this state: do not count against the health score, do not trigger the export gate, appear in a separate "Under Review" section of the dashboard, persist to SQLite.

**Why:** axe DevTools' "Needs Review" tier is the most designer-friendly deferral model in the competitive survey. Flint has no middle ground. A designer confronted with a violation they're not sure about must either ignore it (penalty) or leave it active (overwhelming). This creates a binary that teaches designers to ignore violations rather than investigate them.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (new "Under Review" section), `electron/store.ts` (add `status` field to violation storage), `electron/main.ts` (new IPC: `governance:flag-for-review`), health score formula (exclude flagged violations).

---

### COUNSEL.2.3 — Snooze with Auto-Resurface

**What:** Deferred violations store an expiry condition in SQLite. When the condition is met (timer expires, Figma sync completes, gate reopens), the violation returns to the active list with context: "Deferred by [author] on [date] — [reason]." The Stamp provenance chain records who deferred it and why.

**Why:** Snyk's "ignore temporarily — until fix is available" is the most mature deferral model in the survey. A snooze with no expiry is not a snooze, it's an ignore. The time-bound resurface is what makes deferral responsible rather than evasive.

**Scope:** `electron/store.ts` (deferrals table: `expiry_type`, `expiry_value`, `deferred_by`, `deferred_at`, `reason`), new background job in `electron/main.ts` to check expiry on project open and sync events, `src/components/ui/GovernanceDashboard.tsx` (resurface notification).

---

### COUNSEL.2.4 — Effort Framing ("About 2 minutes with Autopilot")

**What:** Replace or accompany the grade letter with an effort estimate as the primary action call-to-action. For auto-fixable violations: "3 auto-fixable issues — about 2 minutes with Autopilot." For manual violations: "2 violations need your input." The grade ring moves lower in the visual hierarchy (remains for the governance officer audience; just not the first text a designer reads).

**Why:** SonarQube expresses debt as time ("15 minutes to fix this code smell"), which changes the emotional register from verdict (F) to workload (manageable). A letter grade is a verdict. An effort estimate is a plan. The change is a reordering of visual hierarchy, not a removal of the grade.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` — reorder the score section so the action CTA appears above the ring. Compute effort estimate from violation count × average fix time (constants from auto-fix history).

---

### COUNSEL.2.5 — Session Fix Progress Indicator

**What:** A persistent progress indicator during an active editing session: "3 of 7 violations fixed this session." Resets on project close. Celebrates when all violations are resolved.

**Why:** No current signal tells a designer they're making progress. Without it, the governance experience feels like a treadmill — you fix one thing, another appears. The progress indicator makes the session feel goal-directed.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` — derive from session-scoped fix event count. No new IPC needed; track via Zustand ephemeral state.

---

## Sprint COUNSEL.3 — Intelligence Surface

The sprint that exposes the 40 backend domain objects Glass has never shown.

### COUNSEL.3.1 — "Undo to Last Clean State" Surface

**What:** When new violations appear in the current session that weren't there before, the dashboard shows an inline action: "These violations were introduced in this session. Undo to last clean state?" One click triggers a Stamp-guided Rewind that identifies and reverses the mutation stack that introduced the violations.

**Why:** Flint owns both Stamp (provenance) and Rewind (undo). The connection between them — "which violations are undo-able back to a clean state?" — does not exist in the UI. This is the most uniquely Flint moment in the entire governance flow. No linter, no CI tool, no design tool can do this.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (session-new violation detection + undo CTA), `electron/main.ts` (new IPC: `governance:undo-to-clean` using Stamp audit trail + Rewind), `electron/orchestrator.ts` (mutation stack analysis).

---

### COUNSEL.3.2 — Provenance "Who Changed This?" in Violation Cards

**What:** Each violation card shows a provenance chip: "Introduced by Claude · 3 mutations ago" or "Present since project open." Clicking the chip opens a mini audit trail showing the mutation chain.

**Why:** mutationProvenanceService tracks `provenanceSource`, `provenanceAgentId`, `provenanceReasoning`, and `provenanceConfidence` per mutation, but Glass has zero visibility. A designer who sees "Introduced by Claude · 3 mutations ago" immediately understands the violation is recent and recoverable. This changes the emotional register from "I caused this" to "we can trace this."

**Scope:** `electron/main.ts` (new IPC: `governance:get-violation-provenance`), `src/components/ui/GovernanceDashboard.tsx` (provenance chip per card), `flint-mcp/src/core/governance/mutationProvenanceService.ts` (no changes needed, just wire the existing `getAuditTrail()` call).

---

### COUNSEL.3.3 — Anomaly Alert Banner (Flare Integration)

**What:** When anomalyDetectionService detects a 3-sigma anomaly (override spike, violation surge, velocity spike, risk drift, agent behavior change), show a dismissible alert banner in the GovernanceDashboard: "Unusual activity detected: override rate is 4× above your 30-day baseline. [View details]"

**Why:** Flare's anomaly detection service runs continuously and stores results in `anomaly_history`, but Glass never queries this table. A sudden violation surge or override spike is exactly the signal a team lead or governance officer needs to investigate. Currently it disappears into a table no one reads.

**Scope:** `electron/main.ts` (new IPC: `governance:get-anomalies`, polling on interval), `src/components/ui/GovernanceDashboard.tsx` (anomaly banner above violation list), `src/store/governanceStore.ts` (add anomaly state slice).

---

### COUNSEL.3.4 — Risk Trend Badge on Violation Cards

**What:** Violations with associated mutation risk scores show a badge: "Risk: Amber" or "Risk: Green" with the primary contributing factor ("High due to velocity"). For files where the risk trend is rising, show a subtle "trending up" indicator on the file name in the violation list.

**Why:** riskScoringService computes 5-factor weighted risk scores and `FileRiskProfile.trend` ('rising'|'falling'|'stable') — all stored in `mutation_risk_scores` — and Glass shows none of it. A designer who sees "Risk: Amber — High due to velocity" understands this violation came from a fast-moving mutation sequence and may want to review the change more carefully.

**Scope:** `electron/main.ts` (new IPC: `governance:get-risk-for-violation`), `src/components/ui/GovernanceDashboard.tsx` (risk badge per card). Read from `mutation_risk_scores` table via existing Sentry IPC patterns.

---

## Sprint COUNSEL.4 — Brilliant Moments

The sprint that delivers experiences no other tool can replicate.

### COUNSEL.4.1 — Token Change Impact Preview

**What:** When a Figma token sync is about to push a value change, Flint intercepts and shows: "Changing `--color-brand-primary` from #0057FF to #0040CC will create 8 Mithril violations in 4 files (ΔE = 4.7, above your 2.0 threshold). Here are the affected components: [list]. Proceed, adjust threshold, or pre-fix components?"

**Why:** Only Flint can answer this question — it holds the AST and the token registry simultaneously. No Figma plugin, sync service, or linter can show pre-sync violation impact. This is the most technically distinctive governance moment in the entire product.

**Scope:** `flint-mcp/src/core/sync/tokenSyncEngine.ts` (add impact-check hook before sync commit), `electron/main.ts` (new IPC: `governance:preview-token-change-impact`), `src/components/ui/GovernanceDashboard.tsx` (impact preview modal triggered by sync event). Uses existing CIEDE2000 delta-E logic + `buildTokenCoverage()` from MithrilLinter.

---

### COUNSEL.4.2 — Compliance Trajectory Chart

**What:** A 7-day rolling sparkline of health score history in the GovernanceDashboard score section. "Trending up ↑" or "Trending down ↓" with the delta. Hovering shows the score for each day.

**Why:** A point-in-time score tells you nothing about direction. A project at B trending upward is more valuable than a project at A trending downward. The SQLite infrastructure already supports this — health scores just need to be snapshotted once per session and read back as a trend.

**Scope:** `electron/store.ts` (add `health_score_history` table: date, score, grade), `electron/main.ts` (snapshot score on project close IPC), `src/components/ui/GovernanceDashboard.tsx` (sparkline component using score history).

---

### COUNSEL.4.3 — Governance Navigation Pathway

**What:** Add a clear navigation chain: GovernanceDashboard → "Manage rules" → GovernancePanel (configure tab) → "Policy settings" → PolicySettings. The autopilot toggle moves from GovernanceDashboard to PolicySettings and is replaced in the dashboard with a status chip. GovernancePanel is no longer reachable from the same sidebar flow as the designer's health tab — it requires a deliberate navigation step (⌘K → "Manage Governance Rules").

**Why:** Three governance surfaces with no pathways is the clearest structural UX failure in the product. A designer cannot build a mental model of where to go for what when all three surfaces are in different places with no connecting thread.

**Scope:** `src/components/ui/GovernanceDashboard.tsx` (remove autopilot toggle, add "Manage rules" link), `src/components/ui/CommandPalette.tsx` (add governance configuration commands), `src/App.tsx` (routing for GovernancePanel as deliberate navigation, not sidebar tab).

---

### COUNSEL.4.4 — Zero-Violation Generation Signal

**What:** When the Orchestrator generates a component with zero violations on the first audit, show a success moment in the GovernanceDashboard: "Generated compliant. This component is brand-compliant and accessible." The message is transient (5 seconds) and logged to the governance events table.

**Why:** The aspiration of governance-as-guide rather than governance-as-cleanup is realized the first time a component generates clean. Surfacing this moment explicitly — rather than letting it pass unnoticed — teaches designers that governance shapes generation, not just cleans up after it.

**Scope:** `electron/orchestrator.ts` (emit event when post-generation audit returns 0 violations), `electron/main.ts` (IPC event: `governance:clean-generation`), `src/components/ui/GovernanceDashboard.tsx` (success toast using `notificationStore`).

---

### COUNSEL.4.5 — Audit Log Tab (Governance Officer Surface)

**What:** A new "Audit" tab in the GovernanceDashboard (alongside "Health") showing a paginated chronological log of governance events: mutation provenance, override events, deferral history, anomaly detections. Filterable by source (human/agent/auto-fix), time range, and event type. Exportable as JSON.

**Why:** A governance officer needs to prove that no WCAG violation shipped to production in 90 days. mutationProvenanceService stores every event but Glass has no audit trail surface. This is the surface that makes Flint defensible to an auditor — not just governance-compliant, but governance-provable.

**Scope:** `electron/main.ts` (new IPC: `governance:get-audit-log` reading from `mutation_provenance` + `override_events` + `anomaly_history`), `src/components/ui/GovernanceDashboard.tsx` (new "Audit" tab with paginated list, filter bar, export button).

---

## Implementation Notes

### New IPC Channels Required (COUNSEL.1-4)

| Channel | Handler | Returns |
|---------|---------|---------|
| `governance:preview-fix` | `flint_fix` dry_run | Diff preview object |
| `governance:defer-violation` | SQLite write | Deferral ID |
| `governance:flag-for-review` | SQLite write + score update | Updated score |
| `governance:get-anomalies` | `anomaly_history` read | `Anomaly[]` |
| `governance:get-violation-provenance` | `mutation_provenance` read | `AuditTrailEntry` |
| `governance:get-risk-for-violation` | `mutation_risk_scores` read | `RiskScore` |
| `governance:undo-to-clean` | Stamp + Rewind orchestration | Undo confirmation |
| `governance:preview-token-change-impact` | MithrilLinter + tokenSyncEngine | Impact report |
| `governance:get-audit-log` | Multi-table read | `AuditEvent[]` |
| `governance:get-health-history` | `health_score_history` read | `ScoreSnapshot[]` |

### New SQLite Tables Required

| Table | Purpose |
|-------|---------|
| `deferrals` | Violation deferrals with expiry conditions |
| `health_score_history` | Daily health score snapshots for trend chart |

Both `mutation_provenance`, `anomaly_history`, `mutation_risk_scores`, and `agent_trust` tables already exist. No schema changes needed for COUNSEL.3.

### Test Requirements

Every sprint task must include:
- Unit tests for new IPC handlers (happy path + error + missing params)
- React component tests for new UI states (defer form, flagged state, anomaly banner)
- Integration test for health score formula parity (dashboard score = debt report score for same project)
- Run `cd flint-mcp && npm test` + `npm run test:react` + `npx tsc --noEmit` before marking any task ONLINE
- Report format: `MCP: X/Y passing (Z new) | Glass: X/Y passing (Z new) | TSC: 0 errors`
