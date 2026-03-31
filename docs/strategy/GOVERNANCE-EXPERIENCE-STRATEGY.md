# Governance Experience Strategy — "Counsel"

**Citadel Name:** Counsel — *Where governance advises rather than judges.*

*Synthesized from: UX Critic, Product Planner, Architect data-gap analysis, Accessibility audit (26 issues), Competitive research (7 tools).*

---

## 1. The Core Diagnosis

Flint's governance engine is technically impressive. Twenty-seven MCP tools. Sentry risk scoring. Stamp provenance. Flare anomaly detection. Mithril with CIEDE2000. Warden with 50 WCAG 2.1 AA rules. A debt report. Trust tiers. Compliance profiles. Jurisdiction coverage. Forty domain objects and 15+ aggregation queries stored in SQLite.

**None of it is surfaced in Glass.**

And the surface that does exist is broken at its foundation: **it presents a verdict before establishing a relationship.** It speaks to a designer as if they are already on trial, not as if they are a teammate who needs help shipping something that meets the bar.

Every tool in the competitive landscape — Snyk, SonarQube, ESLint, axe, GitHub Code Scanning, Figma — leads with "here is your prioritized to-do list." Flint leads with a red F and a ring chart.

---

## 2. The Three Structural Failures

**Failure 1: Governance is punitive, not educational, by default.**
The health score ring, the grade letter, and the "Export blocked" banner are all prominent and appear before any educational context is offered. The educational content (fix guides, "Why" explanations, WCAG references) is hidden behind collapsed accordions the user must discover. The best content has the worst visibility.

**Failure 2: Three governance surfaces with no navigational relationship.**
GovernanceDashboard (observe + act), GovernancePanel (configure rules), and PolicySettings (configure thresholds) serve overlapping purposes with zero pathways between them. A designer trying to understand why their score is low must visit all three surfaces to find the answer. PolicySettings is not reachable from either of the other two.

**Failure 3: The most powerful data Flint owns never surfaces.**
The architect analysis found that riskScoringService, mutationProvenanceService, anomalyDetectionService, and trustTierService collectively compute ~40 domain objects across 15+ aggregation queries — and not one field from any of these services appears in the GovernanceDashboard. The engine knows what caused every violation, which agent introduced it, how anomalous the pattern is, and what the risk score is. The designer sees none of it.

---

## 3. What Governance Actually Needs to Do

Governance in Flint serves four distinct jobs. The current surface conflates them all into one overwhelming panel.

| Job | Audience | Question Being Answered |
|-----|----------|------------------------|
| **Observe** | Designer | "What's wrong with my component right now?" |
| **Act** | Designer | "How do I fix it and can I fix it quickly?" |
| **Configure** | Team Lead / Governance Officer | "What rules apply to this project and how strict are they?" |
| **Report** | Governance Officer / Auditor | "Can I prove compliance over time?" |

The current GovernanceDashboard (~1,300 lines) tries to do all four simultaneously. It is simultaneously a health monitor, violation fixer, autopilot controller, delta mode manager, export gate summary, and rule browser. Observe and Act are the correct jobs for the Glass sidebar. Configure and Report belong in separate surfaces accessible to users with the right context.

---

## 4. User Needs by Persona

### Designer (Primary Glass User)

| Need | Current State | Gap |
|------|--------------|-----|
| Understand what's wrong — by category | Flat violation list | No category split (Design System / A11y / Token Sync counts) before the list |
| Know which violations are auto-fixable | Fix buttons exist | No "X auto-fixable, Y need your attention" summary before the list |
| Fix all auto-fixable violations in one action | Batch button for Mithril only | A11y has no batch fix; 15 violations = 15 button presses |
| Preview what a fix will do before committing | FixPreviewDrawer (separate navigation) | Fix preview not co-located with the violation card |
| Defer a known violation to ship a hotfix | Not available in Glass | `flint_defer_violation` MCP tool exists but no UI surface |
| Understand why a rule matters to MY project | Generic rule explanations | No connection to this project's design system, team workflow, or compliance requirement |
| Track progress across a session | Nothing | No "3 of 7 fixed" session indicator |
| Get back to a known-clean state after a bad fix | Rewind exists, Stamp exists | No "undo to last clean state" surface that uses provenance data |

### Team Lead

| Need | Current State | Gap |
|------|--------------|-----|
| See whether governance helps or hurts velocity | No metric | Time-to-export, compliance trajectory — neither surfaced |
| Understand rule provenance (pack vs. local) | InheritanceChain in store | Never surfaced in violation or rule context |
| See file-level health grades | Top violated files listed | No per-file grade; count only |
| See governance debt trend over time | Point-in-time score only | No rolling chart or trajectory |
| Set up team governance once and distribute | GPX pack tools exist | No "team governance config" summary view |

### Governance / Compliance Officer

| Need | Current State | Gap |
|------|--------------|-----|
| Prove no WCAG violation shipped in 90 days | Ledger table in SQLite | No audit trail view in Glass |
| Export a compliance report | `flint_audit_report` MCP tool | No Glass trigger; no human-readable format |
| Understand override history | StatusBar badge only | No detailed override history surface |
| Track anomalies and behavioral baselines | Flare service fully built | Never queries `anomaly_history` table |

---

## 5. The Backend Intelligence Gap (Architect Analysis)

The architect agent found that **~40 domain objects across 15+ aggregation queries exist in the backend but are invisible in Glass.** These are the five highest-impact gaps:

### Gap 1: Risk Factor Breakdown (riskScoringService)
The service computes five weighted factors per mutation: provenance (30%), operationType (20%), violationState (20%), fileSensitivity (15%), velocity (15%). It produces per-file risk profiles with `trend` ('rising'|'falling'|'stable') and project summaries with top-5 riskiest files and agents. **Glass shows none of this.**

### Gap 2: Mutation Audit Trail (mutationProvenanceService)
Every mutation is tagged with `provenanceSource` ('human'|'agent'|'auto-heal'|'auto-fix'|'import'), `provenanceAgentId`, `provenanceReasoning` (AI reasoning text), and `provenanceConfidence` (0-1). The `getAuditTrail()` method returns a full chronological trail filterable by source/agent/session. **Glass has zero visibility into this.**

### Gap 3: Statistical Anomaly Baselines (anomalyDetectionService)
The service detects 6 anomaly types (override spike, violation surge, velocity spike, risk drift, agent behavior change) using 3-sigma thresholds against 30-day rolling baselines. It stores history in `anomaly_history`. **Glass never queries this table.**

### Gap 4: Agent Trust Tier Progression (trustTierService)
Every agent has a `AgentTrustRecord` with `currentTier`, `sessionCount`, `redMutationCount`, `overrideCount`, `escalationCount`, and tier change timestamps. Demotion triggers (3+ red mutations) and promotion gates (10 clean sessions) are tracked. **Glass shows nothing about this.**

### Gap 5: Health Score Formula Mismatch (Critical Defect)
GovernanceDashboard computes: `100 - (mithril × 5) - (a11y × 10) - (override × 3)`
dbomService computes: `100 - (criticals × 10) - (warnings × 3)` with severity weighting.

**These produce different numbers for the same project.** A designer seeing a "B" in the dashboard who asks an agent for a debt report could receive a "D." This is a trust-destroying inconsistency that must be fixed before any new health score features are added.

---

## 6. Competitive Landscape: What Flint Is Missing

Research across Snyk, SonarQube, ESLint, axe DevTools, GitHub Code Scanning, Stylelint, and Figma identified five patterns that every designer-facing tool in this space uses — and Flint does not.

### Pattern 1: The "Needs Review" Tier (axe DevTools)
A third classification between "confirmed violation" (blocks you) and "passing" (ignored). axe calls this "Needs Review" — not certain, so it surfaces the issue without adding to the failure count or blocking the gate. Flint has no middle state. Every violation is either active (counts against score, may block export) or overridden (suppressed, counts a 3-point penalty). **Implementing this requires surfacing `flint_defer_violation` with a "Flagged for Review" state that exempts from scoring.**

### Pattern 2: New-Code-First Framing (SonarQube "Clean as You Code")
The default view is violations introduced in the current session, not everything wrong with the entire codebase. Historical violations are visible but non-blocking by default. SonarQube's insight: a quality gate that evaluates only code you touched is far more answerable than one that evaluates everything ever written. Flint's Delta Mode has this capability but requires deliberate activation. **It should be the default for any project with more than 10 pre-existing violations.**

### Pattern 3: Fix Co-location (GitHub Copilot Autofix + Figma "Check Designs")
The fix lives adjacent to the violation — not in a separate drawer. Figma shows the specific token to apply directly on the violation card. GitHub shows the code diff of the proposed fix inline. Flint's FixPreviewDrawer is a separate navigation step. **Moving the diff preview into the violation card removes a decision step for every violation.**

### Pattern 4: Effort Framing Instead of Grades (SonarQube)
Violations are expressed as "X minutes to fix" in addition to a score. SonarQube's "15 minutes to fix this code smell" changes the emotional register from verdict (F) to workload (manageable). **The grade ring should not be the first thing a designer reads.** A call-to-action ("3 auto-fixable issues — about 2 minutes with Autopilot") should precede it.

### Pattern 5: Snooze with Automatic Resurface (Snyk)
Snyk's "ignore temporarily" with time-bound expiry is the most mature deferral model surveyed. The violation disappears from the immediate workflow but returns automatically when conditions change ("until fix is available," "after N days"). **`flint_defer_violation` exists but has no expiry, no auto-resurface, and no Glass surface.**

### Additional Finding: Category Split Before Individual Violations
Every tool surveyed — Snyk (Critical/High/Medium/Low), SonarQube (Bugs/Vulnerabilities/Code Smells), axe (Violations/Needs Review/Best Practices), Figma plugins (Missing Styles/Wrong Color/Wrong Font) — leads with a category breakdown **before** showing individual items. Flint's dashboard leads with the health score ring, then a score breakdown accordion (collapsed by default), then an undifferentiated violation list. **A top-level category split (Design System / Accessibility / Token Sync with counts) should appear above the score ring.**

---

## 7. Accessibility Audit: 26 Issues Across 5 Components

The accessibility audit found 26 issues (20 critical, 6 warnings) across all five governance UI components — a product whose core promise is enforcing accessibility standards on other people's code.

### By Severity

| Component | Critical | Warning | Total |
|-----------|---------|---------|-------|
| GovernanceDashboard.tsx | 2 | 1 | 3 |
| GovernancePanel.tsx | 5 | 1 | 6 |
| PolicySettings.tsx | 6 | 2 | 8 |
| ExportModal.tsx | 6 | 1 | 7 |
| StatusBar.tsx | 1 | 1 | 2 |
| **TOTAL** | **20** | **6** | **26** |

### Cross-Cutting Issue 1: Heading Hierarchy (WCAG 1.3.1) — Affects All Files
All files use `<h2>` or `<h3>` as their first heading without a prior `<h1>`. The entire application lacks a root `<h1>`. Fix: add `<h1>` at app root outside modals; use `<h2>` for modal/section titles; `<h3>` for subsections.

### Cross-Cutting Issue 2: Backdrop Click Handlers (WCAG 2.1.1) — GovernancePanel, PolicySettings, ExportModal
All three modals use `<div onClick>` to close on backdrop click. This is mouse-only. Fix: rely entirely on the Escape key handler (which all three already have); remove the backdrop click handler or add keyboard equivalence.

### Strong Points
- FocusTrap component is present in all modals — correct pattern.
- All dialogs use `role="dialog"`, `aria-modal="true"`, `aria-labelledby` — correct.
- Toggle/switch components have `role="switch"`, `aria-checked` — correct.
- Tab bars follow the ARIA tab pattern with `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` — correct.
- Escape key handlers are implemented in all modals.

---

## 8. What's Working (Don't Change These)

- **Fix guides are genuinely good.** `A11Y_FIX_GUIDE` and `MITH_FIX_GUIDE` content — "Why it matters," "How to fix," copy-ready snippets — is exactly right. The problem is discovery, not quality.
- **The ExportModal pre-flight is the clearest governance surface.** It speaks the language of outcomes ("these issues are stopping you from shipping") rather than rule mechanics. It is correct for its audience.
- **`scoreTrendHint` is genuinely motivational.** "Fix 4 color drift issues to reach grade B" is the right content. It's just rendered as a `title` tooltip that users never see.
- **Delta Mode is architecturally correct.** Existing vs. new violations is the right distinction. The problem is activation model (opt-in vs. opt-out) and placement (power tool in a primary action button).
- **GovernancePanel's compliance profiles and rule packs** are strategically correct for enterprise positioning. They just shouldn't be reachable from the same navigation flow as the designer's health tab.
- **The EDU module's plain-language labels** (EDU-01 through EDU-12) are directionally correct. Keep expanding them.

---

## 9. What to Remove or Demote

### Demote to Advanced / PolicySettings
**Delta Mode "Set Baseline" button in the dashboard header.** For legacy projects with many existing violations, offer it proactively as a prompt: "This project has 40+ existing violations. Would you like to track only new issues?" For all other projects, move Delta Mode to PolicySettings under "Advanced."

**GovernanceDashboard autopilot toggle.** This is configuration, not observation. Move to PolicySettings; replace in the dashboard with a status indicator ("Autopilot active").

### Decouple from Designer Flow
**GovernancePanel** should not be reachable from the same sidebar flow that a designer uses to check component health. Rule authoring and violation reviewing are different journeys. GovernancePanel should require a deliberate navigation step (⌘K → "Manage Rules" or Settings → Governance) that makes clear it is a configuration surface.

### Fix the Duplication
**Duplicate violation rendering** between ExportModal and GovernanceDashboard must be unified. Both should read from the same computed source — the `flint://dashboard` MCP resource or the same Zustand selector — so the violation count is identical in both places.

---

## 10. The North Star: What "Brilliant" Looks Like

**Today:** Governance is a judge that convicts you on arrival, makes you understand three disconnected panels to change a setting, and stores detailed intelligence about your project in SQLite that it never shows you.

**Tomorrow (Counsel):** Governance is an advisor. It tells you what category of problem exists before showing you the individual items. It lets you defer what can wait. It shows you what a fix will do before committing it. It uses the provenance chain to offer "undo to last clean state" when a fix goes wrong. It warns you before you push a token change that will create violations. And for designers opening a legacy project on day one, it says "here's what changed in your session" instead of "here's everything that's ever been wrong."

---

## 11. The Three Brilliant Governance Moments Nobody Else Can Deliver

### Moment 1: Zero-Violation Generation
The Orchestrator generates a new component. The GovernanceDashboard stays green. The export gate stays open. The message: "This component is brand-compliant and accessible on the first try." Requires feeding historical violation pattern data from the Ledger into the generation context at intent time — not a new system, just a new data feed from existing infrastructure.

### Moment 2: Undo to Clean
A designer applies several fixes. New violations appear that weren't there before. One button: "Undo to last clean state." Flint uses Stamp + Rewind to identify the exact mutation stack that introduced the new violations and collapses them into a single undo operation. Only possible because Flint owns simultaneous provenance and undo history.

### Moment 3: Token Change Impact Preview
Before pushing a Figma token change (e.g., `--color-brand-primary` from `#0057FF` to `#0040CC`), Flint shows: "This change will create 8 Mithril violations in 4 files. The ΔE is 4.7 — above your 2.0 threshold." Only possible because Flint holds the AST and the token registry simultaneously.

---

## 12. Summary: The Five Highest-Impact Changes

Ranked by designer impact. All five require no new infrastructure — only surfacing what already exists.

1. **Category split before the violation list.** Three counts (Design System / Accessibility / Token Sync) above the score ring. Aligns Flint with every other governance tool in the space.

2. **New-code-first as the default.** Delta Mode opt-out for legacy projects. Removes the "F on day one" problem without changing the governance rules.

3. **Unify the two health score formulas.** GovernanceDashboard and `flint_debt_report` must produce the same number for the same project. This is a credibility-critical defect.

4. **Surface `flint_defer_violation` in Glass.** "Defer" button in the violation list and ExportModal pre-flight. Time-bound snooze with auto-resurface. This one Glass surface converts governance from an obstacle into a partner at the exact moment it matters most — when a designer is blocked at export.

5. **Fix co-location: diff preview in the violation card.** Move the FixPreviewDrawer experience into the violation card so designers can review all proposed fixes as a set before committing any mutation.
