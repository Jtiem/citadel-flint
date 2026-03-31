# Flint — Unified UX Sprint Plan
**Date:** 2026-03-30
**Status:** ACTIVE
**Supersedes:** Separate Counsel / Forge / Mint / GLASS sprint plans for ordering purposes. Those documents remain the source of truth for task detail.

---

## The Full Inventory

Six UX plans exist. Five had no sprint slot relative to each other.

| Plan | Document | Tasks | Previously |
|------|----------|-------|-----------|
| **GLASS.6–8** | `GLASS-SPRINT-PLAN.md` | 12 | Unsequenced |
| **Counsel** | `GOVERNANCE-IMPLEMENTATION-PLAN.md` | 20 | Sprint 8 mention only |
| **Forge** | `PROJECT-INITIATION-PLAN.md` | 19 | Sprint 8 mention only |
| **Mint** | `TOKEN-IMPLEMENTATION-PLAN.md` | 18 | Sprint 8 mention only |
| **GTM** | `GO-TO-MARKET-PLAN.md` | — | Not in backlog |
| **BETA.1** | `BACKLOG-PRIORITIZED.md` | — | Sprint 8 P0 |

Total: **69 UX tasks** across 6 plans, now sequenced.

---

## Sequencing Logic

Three rules drove the ordering:

1. **Fix before feature.** Active defects and a11y violations in Flint's own UI ship before new capabilities. A governance tool with a11y failures in its own interface is a credibility problem.
2. **First impressions before depth.** Forge (what new users see first) and the health score defect (first data a returning user sees) rank above deeper features like Mint and canvas governance.
3. **GTM gates everything.** Beta distribution unlocks real users. Real users make all other prioritization questions answerable with data. It runs in parallel with UX work, not after it.

---

## The Plan

### Wave 1 — Credibility Baseline
*Fixes defects and a11y failures. Ships before any real users see the product.*

These are not features — they are correctness fixes. Nothing else should ship until these are done.

| ID | Task | Source | Why now |
|----|------|--------|---------|
| COUNSEL.1.3 | Health score formula unification | Counsel | Active defect — two formulas produce different grades for the same project |
| COUNSEL.1.7 | 26 a11y fixes in Governance UI | Counsel | Flint is an a11y tool. Self-violations are a trust problem. |
| FORGE.1d | 10 a11y fixes in LaunchScreen | Forge | First screen every user sees |
| FORGE.1e | 6 a11y fixes in DemoWalkthrough | Forge | First demo experience |
| MINT.1d | Remove dangerous token actions (inline edit, delete, clear all) | Mint | Governance data should not be silently mutable |
| S6.1 | Delete/rewrite 6 broken UI primitives | GLASS.6 | Dead code in active components causes visual bugs |
| S6.2 | Create `Badge` primitive (replaces 59+ inline compositions) | GLASS.6 | Consistency and maintainability |

---

### Wave 2 — First Impressions
*What new users experience in the first 5 minutes.*

| ID | Task | Source | Why now |
|----|------|--------|---------|
| FORGE.1a | Three-path LaunchScreen (8 channels → 3) | Forge | Paralysis on first open is the top abandon point |
| FORGE.1b | Demo-to-Project handoff CTA | Forge | Demo ends without a conversion path today |
| FORGE.1c | Workspace orientation step (Step 0 in walkthrough) | Forge | New users don't know what Glass is for |
| FORGE.1f | BetaWelcome + SetupWizard a11y fixes (7 critical) | Forge | Setup flow is the second thing new users hit |
| FORGE.1g | Gate transition announcements (screen reader) | Forge | Screen reader users get no context on screen change |
| COUNSEL.1.1 | Category split header (Design System / A11y / Token Sync) | Counsel | Replaces verdict-first grade as the opening beat |
| COUNSEL.1.2 | New-code-first default (Delta Mode auto-enable at 10+ violations) | Counsel | Eliminates "F on day one" for legacy project onboarding |
| COUNSEL.2.4 | Effort framing ("About 2 minutes" replaces grade as first beat) | Counsel | Co-pilot tone instead of police scanner tone |

---

### Wave 3 — Core Governance Loop
*Makes the daily fix-a-violation workflow fast and clear.*

| ID | Task | Source | Why now |
|----|------|--------|---------|
| COUNSEL.1.4 | Violation card fix co-location (inline diff preview) | Counsel | Fix preview is a separate navigation step today |
| COUNSEL.1.5 | Auto-fixable label on every violation card | Counsel | Designers can't tell which violations they can resolve instantly |
| COUNSEL.1.6 | A11y batch fix button | Counsel | A11y has no batch fix — 15 violations = 15 button presses |
| COUNSEL.2.1 | Defer button in violation list + ExportModal | Counsel | The MCP tool exists — it just has no UI |
| COUNSEL.2.5 | Session fix progress indicator ("3 of 7 fixed") | Counsel | No sense of progress during a fix session |
| MINT.1a | Token health bar (sync/coverage data) | Mint | Surfaces data that already exists in SQLite |
| MINT.1b | Visual token grid (swatches, specimens, rulers) | Mint | CRUD list is not a governance surface |
| MINT.1c | Mode columns (Light/Dark side-by-side) | Mint | Token modes are invisible today |
| MINT.1e | Fix TokenManager a11y issues (8 findings) | Mint | Token tab has its own a11y debt |
| S6.3 | `Modal` primitive with FocusTrap + ARIA | GLASS.6 | Foundation for all new modal dialogs |
| S6.4 | Reconcile 3 SwitchToggle implementations | GLASS.6 | Consistency across settings surfaces |
| COUNSEL.4.3 | Governance navigation pathway (Dashboard → Panel → PolicySettings) | Counsel | Three surfaces with zero pathways between them |

---

### Wave 4 — Intelligence Surface
*Surfaces the data Flint already owns but never shows.*

| ID | Task | Source | Why now |
|----|------|--------|---------|
| FORGE.2a | Project environment detection (framework, library, tokens) | Forge | Gap between "opened" and "governed" is entirely manual today |
| FORGE.2b | Auto-configuration from detection | Forge | Detected context is wasted without auto-config |
| FORGE.2c | Baseline audit on open (auto-audit + progress) | Forge | Flint's moat is showing real problems on real code in under 10 seconds |
| FORGE.2d | Detection banner in Glass | Forge | Users don't know what Flint detected |
| MINT.2a | Token usage scanner (AST-level usage counts) | Mint | Dead tokens and usage counts require codebase read — only Flint can do this |
| MINT.2b | Usage counts + dead token badges | Mint | The scanner data needs a UI surface |
| MINT.2c | Drift indicators (Figma vs. local swatch) | Mint | Token drift is the #1 sync issue — currently invisible in the token tab |
| MINT.2d | Silent drift badge on Tokens tab | Mint | Tab-level signal that drift exists |
| COUNSEL.2.2 | "Flagged for Review" tier (middle state) | Counsel | Third state between violation and override — reduces binary pressure |
| COUNSEL.3.2 | Provenance chip in violation cards | Counsel | "Introduced by Claude · 3 mutations ago" closes the who/when gap |
| COUNSEL.3.3 | Anomaly alert banner (Flare 3-sigma) | Counsel | The anomaly engine runs — nothing shows its output |
| S7.4 | Pull/push buttons in Figma StatusBar popover | GLASS.7 | Minimal first step for sync surface; minimal scope |

---

### Wave 5 — Depth + Confidence
*Power features for returning designers and team leads.*

| ID | Task | Source | Why now |
|----|------|--------|---------|
| FORGE.4b | Recent projects with health grades | Forge | Health grade on reopen signals progress |
| FORGE.4c | Scan progress streaming | Forge | Large projects need visible progress |
| FORGE.4d | Smart recommendations on first audit | Forge | First-audit result should include a next-step suggestion |
| MINT.3a | Token contrast auditor (WCAG pairing matrix) | Mint | Closes a11y gap at the token layer |
| MINT.3b | Contrast badges in token UI | Mint | Surface of the auditor |
| MINT.3c | Token approval staging area | Mint | Token changes need a review step before they land |
| MINT.4d | Per-token detail view (usage + contrast + drift + provenance) | Mint | Single token view that surfaces all dimensions |
| COUNSEL.3.1 | "Undo to last clean state" (Stamp + Rewind integration) | Counsel | Uses provenance data to provide a targeted recovery path |
| COUNSEL.4.1 | Token change impact preview (pre-sync violation forecast) | Counsel | Shows what a token change would break before it syncs |
| COUNSEL.4.2 | Compliance trajectory chart (7-day sparkline) | Counsel | Team leads need trend, not point-in-time score |
| S7.1 | Unified Figma connection panel | GLASS.7 | One entry point for both sync paths |
| S7.2 | Per-token sync state badges in TokenManager | GLASS.7 | Figma / Local / Drifted states per token |
| S7.3 | Conflict resolution UI (three-way diff) | GLASS.7 | The sync engine exists — it has no UI |
| S8.1 | Spatial violation signal on canvas (design decision required) | GLASS.8 | Canvas is dark — violations are invisible spatially |
| S8.3 | MRS pending approval state in governance surfaces | GLASS.8 | High-risk mutations pending review are invisible |

---

### Wave 6 — Completeness
*Finish line items. Deferred until core loop is solid.*

| ID | Task | Source | Notes |
|----|------|--------|-------|
| COUNSEL.2.3 | Snooze with auto-resurface | Counsel | Defer first, snooze after it proves useful |
| COUNSEL.3.4 | Risk trend badge on violation cards | Counsel | After provenance chip (Wave 4) proves readable |
| COUNSEL.4.4 | Zero-violation generation signal | Counsel | Small but important moment for new users |
| COUNSEL.4.5 | Audit log tab | Counsel | Compliance officer feature, lower urgency |
| FORGE.3a | Progressive integration suggestions | Forge | After environment detection (Wave 4) |
| FORGE.3b | Figma setup as contextual flow | Forge | After Forge.1 proves conversion |
| FORGE.3c | Demo scenario picker | Forge | After demo-to-project handoff works |
| FORGE.4a | "Paste and Audit" entry point | Forge | New entry channel — validate core first |
| MINT.3d | A11y token insights (motion, scale, modes) | Mint | After contrast auditor lands |
| MINT.4a | First-sync prompt | Mint | After token sync surface is built |
| MINT.4b | Pre-export emission check | Mint | After token health bar proves useful |
| MINT.4c | Scale gap analysis | Mint | P2, deferrable |
| MINT.4e | Alias chain preservation | Mint | Schema migration — validate need first |
| S7.5 | ActivityFeed governance delta annotations | GLASS.7 | Nice-to-have until agents are in heavy use |
| S8.2 | Autopilot toggle explanation tooltip | GLASS.8 | Trivial — can ship any time |
| FORGE.1g | Gate transition announcements | Forge | Moved later — requires testing with real screen readers |

---

## Parallel Track — GTM + Beta (runs alongside all waves)

These do not block UX work and should run in parallel.

| ID | Task | Blocker |
|----|------|---------|
| BETA.1 | electron-builder production config + `.dmg` builds | Requires Apple Developer Program enrollment |
| GTM Phase 1a | Publish `@flinthq/mcp` to npm | None — engine is ready |
| GTM Phase 1b | Ship `flint-gate` CLI | None — already in `flint-ci/` |

**Recommendation:** Start GTM Phase 1a (npm publish) immediately. It has zero blockers and puts the engine in front of real users while UX waves ship.

---

## Summary View

| Wave | Theme | Tasks | When |
|------|-------|-------|------|
| **1** | Credibility baseline (defects + a11y) | 7 | Now |
| **2** | First impressions | 8 | After Wave 1 |
| **3** | Core governance loop | 13 | After Wave 2 |
| **4** | Intelligence surface | 12 | After Wave 3 |
| **5** | Depth + confidence | 15 | After Wave 4 |
| **6** | Completeness | 15 | After Wave 5 |
| **GTM** | Distribution (parallel) | — | Now, always |

Total: **70 UX tasks** sequenced across 6 waves.
