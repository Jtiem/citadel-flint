# Flint — Prioritized Product Backlog
**Date:** 2026-04-25
**Author:** flint-product-planner
**Sources:** CLAUDE.md, HANDOFF.md, FLINT-MASTER-PLAN.md, FLINT-GAP-REMEDIATION-PLAN.md, FLINT-EXPANSION-PLAN.md, FLINT-FUTURE-SPRINTS.md, FLINT-GLASS-PIVOT.md, JOURNEY-MAPS.md, JourneyMap-TestAudit.md, JTBD-GapFill-Plan.md, Snyk-Competitive-Analysis.md, INVESTOR-BRIEF-2026.md, FEATURE-SPEC-WCAG22.md, FEATURE-SPEC-AUTOPILOT.md, FEATURE-SPEC-COUNSEL.md
**Current JTBD score:** 8.4/10 (target: 9.0)
**Test baseline:** MCP: 3,612/3,612 | Glass: 1,322/1,322 | Core: 1,146/1,146 | CI: 56/56 — TSC 0 errors

---

## Quick Navigation

| Section | What to find |
|---------|-------------|
| [Completed Since Last Update](#completed-since-last-update) | Everything that shipped since the backlog was written |
| [Tier 0 — Beta Ship Milestone](#tier-0--beta-ship-milestone) | The milestone itself; nothing blocking |
| [Tier 1 — Beta Polish](#tier-1--beta-polish-ship-during-60-day-beta-window) | Fix-forward improvements during the beta window |
| [Tier 2 — Pre-Public-Beta Hardening](#tier-2--pre-public-beta-hardening) | Worker hardening, dialog UX, dead code cleanup |
| [Tier 3 — Next Features](#tier-3--next-features) | WCAG 2.2, Vigil, Counsel — implementation-ready |
| [Tier 4 — Strategic Wave](#tier-4--strategic-wave) | GPX Marketplace, COGA pack, Chronicle, Anvil CLI |
| [Sprint History (reference)](#sprint-history-reference) | Sprints 1–7 full specs — all ONLINE |
| [Tracks](#tracks) | Forge, Mint, Counsel, Anvil, Chronicle track tables |
| [Agent-Aware Governance Track](#agent-aware-governance-track-agv) | AGV.1–4 (all ONLINE) |
| [Do NOT Build](#do-not-build) | Scope creep catalog |
| [Deferred Decisions](#deferred-decisions) | Open questions |

---

## Completed Since Last Update

### Sprints 1–7 (shipped 2026-03-26 through 2026-04-19)

The original backlog was authored with a test baseline of 2,165 MCP tests. Sprints 1–7 shipped across multiple sessions and pushed the baseline to 3,612 MCP / 1,322 Glass / 1,146 Core / 56 CI. Full specs preserved in the [Sprint History](#sprint-history-reference) section below. All items ONLINE.

### Completed since 2026-04-19

| Commit | What shipped |
|--------|-------------|
| `88bc5ba` | Beta polish — 6 code-review warnings from 2026-04-20 A/B closed (UI, IPC, type safety) |
| `cbca625` | Beta a11y fix — StatusBar and ResizeHandle keyboard/ARIA violations resolved |
| `f2b1856` | BETA-TELEMETRY-WIRING — full contract-first feature: telemetry consent IPC, Cloudflare Worker receiver, opt-in flag in SQLite, consent dialog in Glass |
| `295ccbe` | Cloudflare Worker hardening — HMAC-SHA256 request auth, env binding wiring, Worker test coverage |
| `93e7829` | Doc reconciliation — CLAUDE.md, HANDOFF.md, FLINT-MASTER-PLAN.md aligned with post-beta-gate codebase state |

### Confirmed done (were in backlog as proposed; already shipped in prior sprints)

| Item | Resolution |
|------|-----------|
| Health score formula unification (COUNSEL.1.3) | Shipped in CHRON.1-repair sprint. `shared/healthScore.ts` is the single source of truth. No divergent formula remains. |
| StatusBar Figma popover a11y | Fixed in commit `cbca625` above. |
| 6 code-review warnings from 2026-04-20 A/B | Fixed in commit `88bc5ba` above. |

---

## Priority + Effort Legend

| Priority | Meaning |
|----------|---------|
| P0 | Critical. Blocking safety, correctness, or ship-ability. |
| P1 | High value. Directly improves tester experience, moat, or revenue. Ship next. |
| P2 | Important. Meaningful improvement but not blocking. |
| P3 | Nice-to-have. Worthwhile when not competing with P0–P2. |

| Effort | Scope |
|--------|-------|
| S | Self-contained, 1–2 days |
| M | Multi-file, 3–5 days |
| L | Cross-process or multi-interface, 1–2 weeks |
| XL | Full sprint or more, 2–4 weeks |

---

## Tier 0 — Beta Ship Milestone

**Status: REACHED.** All Gate 1 findings are closed. The desktop installer is ready to send to testers. The Cloudflare Worker is hardened and safe to publish its URL.

Nothing in this section requires implementation work. It exists to mark the milestone clearly so the team knows what "done" means for beta launch.

What "beta-shippable" means:
- Gate finding from 2026-04-21 code/UX/security reviews: all P0 findings resolved
- Telemetry consent wired end-to-end (Worker → SQLite → Glass dialog)
- A11y violations in core UI surfaces (StatusBar, ResizeHandle) resolved
- Worker auth hardened (HMAC-SHA256)

---

## Tier 1 — Beta Polish (ship during 60-day beta window)

These items improve the experience for the first wave of testers but do not block the initial send. Target: ship as a single fix-forward batch within the first two weeks of the beta window.

---

### BETA-POLISH.1 — Telemetry consent dialog copy: "you can change this later"

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | BETA-TELEMETRY-WIRING (ONLINE) |

**What:** The consent dialog currently presents as a one-time irreversible choice. Add "You can change this at any time in Settings" below the Decline button. Add a "What gets collected" expander with a plain-English list (session IDs, tool call counts, error codes — no code content, no file paths, no personal data).

**Why:** Beta testers who decline without understanding what they're declining represent lost signal. Testers who feel trapped by an irreversible choice will resent the product. Both outcomes are avoidable with two lines of copy and one disclosure component.

---

### BETA-POLISH.2 — Telemetry Decline button visual weight

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | BETA-TELEMETRY-WIRING (ONLINE) |

**What:** The Decline button is currently visually subordinate to Accept in a way that reads as a dark pattern. Make both actions equal weight: same size, same visual tier (outline vs. filled, not ghost vs. filled). The UX review from 2026-04-21 flagged this as a trust risk.

**Why:** Beta testers are design-adjacent. They will notice dark patterns immediately and it will color their entire evaluation. The fix is one line of CSS.

---

### BETA-POLISH.3 — Worker error visibility for operator

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | Cloudflare Worker (ONLINE) |

**What:** The Worker currently swallows errors silently when Slack delivery fails or when the KV write fails. Add `console.error` calls (surfaced in Cloudflare dashboard logs) with structured context: timestamp, error type, payload size, status code. No user-facing change.

**Why:** During the beta window, we need to know immediately if telemetry events are being lost. Silent failures mean the feedback loop we built is broken without anyone knowing.

---

### BETA-POLISH.4 — Worker content-length cap before request parsing

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | Cloudflare Worker (ONLINE) |

**What:** Reject requests with `Content-Length > 64KB` before calling `request.json()`. Return `413 Payload Too Large`. This is a fix-forward hardening item identified in the 2026-04-21 security re-review.

**Why:** Without a size cap, a malformed or malicious request could cause the Worker to attempt to parse an arbitrarily large JSON payload. The Cloudflare free tier has a 128MB memory limit per worker invocation — a 10MB request body would consume most of it.

---

### BETA-POLISH.5 — Worker rate limiting + Slack message dedup

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | Cloudflare Worker (ONLINE), Cloudflare KV |

**What:** Add a KV-backed rate limiter: max 100 telemetry events per installation per hour. Add dedup: if the same `event_type` + `session_id` combination arrives within 60 seconds, drop the duplicate Slack notification (write to KV, but don't post to Slack again).

**Why:** With ~10 beta testers, volume is low. But a bug that causes a client to retry aggressively could flood the Slack channel and obscure real signal. Better to cap it now before scaling.

---

### BETA-POLISH.6 — Timing-safe secret compare in Worker

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | Cloudflare Worker (ONLINE) |

**What:** Replace the current string equality check on the HMAC signature with a constant-time comparison using `crypto.subtle.timingSafeEqual`. This was the primary fix-forward item from the 2026-04-21 security re-review.

**Why:** String equality short-circuits on the first mismatched character, which creates a timing oracle that can be used to brute-force HMAC signatures. This is a well-known class of vulnerability in authentication code. The fix is five lines.

---

## Tier 2 — Pre-Public-Beta Hardening

Do these before scaling beyond ~10 testers. None are user-visible in normal operation, but they make the product trustworthy at higher volume.

---

### QUALITY.1 — Commit 47 unstaged governance service tests

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | None (tests already written) |

**What:** Stage and commit the 47 tests for `mutationProvenanceService`, `trustTierService`, and `agentRiskService` that are written but not yet committed. Verify they pass against the current codebase before committing. Update the test baseline count in this document.

**Why:** These tests cover three governance services that are ONLINE and in use. Uncommitted tests provide no regression protection. This is the simplest possible quality improvement.

---

### QUALITY.2 — Dead code cleanup

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | None |

**What:** Three cleanup areas identified in `.flint-context/dead-code-audit-2026-04-25.md`:
1. Stray `.flint/` directories inside `src/components/` — delete
2. `dist-electron/` at 171MB — add to `.gitignore` and remove from tracking
3. `AppMountGate.test` `vi.mock` blocks that are no longer testing anything meaningful — remove or replace with real assertions

**Why:** `dist-electron/` at 171MB makes every `git clone` painful for new contributors. The stray `.flint/` dirs are confusing noise. The `vi.mock` blocks with no assertions are false confidence in the test suite.

---

### QUALITY.3 — Playbook polish (25 items)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | None |

**What:** 25 polish items catalogued in `.flint-context/playbook-research/polish-findings-2026-04-25.md`. Covers copy accuracy, screenshot freshness, and step-by-step accuracy across the beta playbook docs.

**Why:** The playbook is the first thing a beta tester reads. Stale screenshots or inaccurate steps erode trust before the tester opens the app. Most items are S effort individually; batch them into one pass.

---

### QUALITY.4 — better-sqlite3 NODE_MODULE_VERSION rebuild for dev machines

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Effort** | S |
| **Dependencies** | None |

**What:** Document and automate the `npm rebuild better-sqlite3 --runtime=electron --target=35.7.5 --dist-url=...` step in the contributor setup guide. Currently a silent failure for any dev who installs Node dependencies without this step.

**Why:** Not user-facing. But every new contributor who hits this silently breaks their dev environment, wastes time debugging, or gives up. The fix is one entry in the setup doc and one script alias.

---

## Tier 3 — Next Features

Specs are complete and approved. Implementation can begin. Work through these in order — WCAG 2.2 first (lowest risk, highest legal urgency), then Vigil fake-door, then Counsel Sprint 1.

---

### EXP.8 — WCAG 2.2 Rule Pack (Warden)

| Field | Value |
|-------|-------|
| **ID** | EXP.8 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | EXP.6a-ext (ONLINE — A11yLinter architecture, 50 rules) |
| **Status** | PLANNED — spec at `docs/strategy/FEATURE-SPEC-WCAG22.md` |

**What:** A new default-OFF rule pack `wcag-2.2-aa` in the Rule Pack Registry. 9 new success criteria from WCAG 2.2. 4 are statically detectable in JSX/TSX source today; the remaining 5 require runtime (flagged as "requires axe-core runtime" in the rule description). Projects opt in via `flint.config.yaml` — nothing about today's audit changes for projects that don't opt in.

The 4 statically detectable criteria:
- **2.5.7 Dragging Movements** — detect pointer-down event handlers with no alternative interaction
- **2.5.8 Target Size (Minimum)** — heuristic check on interactive elements for minimum 24×24px sizing tokens
- **3.3.7 Redundant Entry** — detect re-asking for information already submitted in the same form flow
- **3.3.8 Accessible Authentication (No Exception)** — detect cognitive test patterns (CAPTCHA, memory challenges) without alternatives

**Why this sprint:** WCAG 2.2 is a W3C Recommendation as of October 2023. EN 301 549 (the EU standard) references WCAG 2.2 as of 2024. EU Accessibility Act enforcement is active. Flint is already selling to EU-adjacent buyers and WCAG 2.1 leaves 9 criteria unaddressed. The A11yLinter architecture makes adding a bounded rule pack low-risk. Rule pack is default-OFF so it cannot break existing users.

**Handoff prompt:**
"Plan a new Warden extension: WCAG 2.2 Rule Pack (EXP.8). Add a `wcag-2.2-aa` rule pack to `rulePackRegistry.ts`. Implement 4 statically detectable rules in a new `flint-mcp/src/core/a11y/rules/wcag22.ts` module: 2.5.7 (dragging movements), 2.5.8 (target size minimum), 3.3.7 (redundant entry), 3.3.8 (accessible authentication). Each rule needs a detector, an explanation string, a WCAG 2.2 source authority label, and SARIF rule entry. Pack is default-OFF; projects opt in via `flint.config.yaml`. The remaining 5 criteria (focus appearance, consistent help) are runtime-only — add stub entries with `detectionMethod: 'runtime-only'` and point to axe-core. Write tests for all new code. Run the full MCP test suite and report exact pass/fail counts. Run TSC and confirm 0 errors."

---

### AUTO.1 — Vigil (Nightly Governance) — Fake Door First

| Field | Value |
|-------|-------|
| **ID** | AUTO.1 |
| **Priority** | P2 |
| **Effort** | S then XL |
| **Dependencies** | DBOM.1 (ONLINE), GOV.4 (ONLINE), BETA.1 (installer — ONLINE) |
| **Status** | PLANNED — spec at `docs/strategy/FEATURE-SPEC-AUTOPILOT.md` |

**Recommended approach:** Fake-door first. Ship a StatusBar pill labeled "Vigil: Off" that opens a settings panel with the full feature description and a "Turn on" toggle that does nothing yet except record interest. Collect 3 confirmed beta tester requests before building the scheduling engine.

**Why fake-door first:** Vigil is XL effort. The scheduling, state management across runs, and notification delivery are non-trivial. The feature is only useful if Glass stays open (or has an OS-level background process). We do not yet know whether beta testers keep Glass open between sessions. The fake-door answers that question cheaply. If zero testers click "Turn on," we saved a sprint. If 5 out of 10 click it, we build it.

**What the XL implementation covers (when validated):** Scheduled governance scan on configurable cadence (nightly default). DBOM diff against prior snapshot. MRS risk-scores regressions. Flare anomaly detection on delta. Morning digest: in-Glass notification on next open, optional Slack webhook, optional email. Escalation annotation on Red-tier regressions.

**Citadel name note:** The spec renames this from "Autopilot" to **Vigil**. Vigil is the Defense column name that fits the pattern (Mithril, Warden, Sentry, Flare, Vigil — all guards, all continuous). Update `docs/strategy/FEATURE-NAMING-THEMES.md` as part of the implementation task.

---

### Counsel Track — Sprint 1 (COUNSEL.1)

| Field | Value |
|-------|-------|
| **Priority** | P1 (P0 tasks within) |
| **Effort** | M–L (sprint total) |
| **Dependencies** | COUNSEL.1.3 resolved (health score unification DONE via `shared/healthScore.ts`) |
| **Status** | PLANNED — spec at `docs/strategy/FEATURE-SPEC-COUNSEL.md` |

**Why start Counsel now:** The health score unification bug (COUNSEL.1.3) was the blocker for starting Counsel. It shipped in the CHRON.1-repair sprint. All COUNSEL.1 tasks are now unblocked.

**Recommendation:** Let beta feedback from the first 2 weeks inform which Sprint 1 tasks matter most before locking implementation order. The P0 tasks (1.1, 1.2, 1.7) should ship first regardless — they are foundational and have no downstream risk.

COUNSEL.1 tasks in priority order:

| ID | Task | Priority | Effort | Status |
|----|------|----------|--------|--------|
| COUNSEL.1.1 | Category Split Header (Design System / A11y / Token Sync counts above score ring) | P0 | S | PROPOSED |
| COUNSEL.1.2 | New-Code-First Default (Delta Mode auto-enable for legacy projects with 10+ violations) | P0 | M | PROPOSED |
| COUNSEL.1.3 | Health Score Formula Unification | P0 | — | **DONE** via `shared/healthScore.ts` |
| COUNSEL.1.4 | Violation Card Fix Co-location (inline diff preview before committing mutation) | P1 | M | PROPOSED |
| COUNSEL.1.5 | Auto-Fixable Label on Every Violation Card | P1 | S | PROPOSED |
| COUNSEL.1.6 | A11y Batch Fix Button (extends existing Mithril batch pattern) | P1 | M | PROPOSED |
| COUNSEL.1.7 | 26 Accessibility Fixes in Governance UI (self-audit remediation) | P0 | M | PROPOSED |

Full 4-sprint Counsel plan at `docs/strategy/FEATURE-SPEC-COUNSEL.md`.

---

## Tier 4 — Strategic Wave

These are next after beta feedback is incorporated into priorities. None are blocked — all dependencies are ONLINE. Start them after Tier 3 is underway and beta signal is coming in.

---

### GPX.3 — GPX Marketplace (Registry Resolution)

| Field | Value |
|-------|-------|
| **ID** | GPX.3 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | GPX.1 (ONLINE), GPX.2 (ONLINE), registryResolver.ts (ONLINE) |
| **Status** | BACKLOG |

**What:** A hosted registry where governance packs can be published, discovered, and installed by pack name. `registryResolver.ts` already resolves `org/pack-name` extends refs — GPX.3 provides the network backend that resolver points at. Static JSON registry initially (L effort). `flint pack search <query>` and `flint pack install <org/name>` CLI commands. Browsable panel in Glass.

**Why:** GPX.1 and GPX.2 let teams share packs point-to-point. GPX.3 makes packs discoverable without direct coordination — the difference between emailing a zip file and `npm install`. Platform moat: governance rules in a community-maintained registry that competitors cannot replicate without building the same ecosystem.

**Open decision needed:** Static JSON file (L, ship fast) vs. dynamic API with search indexing (XL, required for community scale). Recommend static for beta, upgrade when adoption justifies it.

---

### EXP.9 — COGA Cognitive Accessibility Pack

| Field | Value |
|-------|-------|
| **ID** | EXP.9 |
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | EXP.8 (WCAG 2.2 rule pack, for rule authoring patterns) |
| **Status** | BACKLOG |

**What:** 8 cognitive accessibility patterns from W3C COGA Task Force guidance: clear language, predictable navigation, error prevention, redundant cues, timeouts, distracting content, complex authentication, memory-dependent tasks. New rule domain `coga` in the ERM registry.

**Why after EXP.8:** COGA is guidance, not normative — softer legal mandate than WCAG 2.2. But enterprise buyers in healthcare and government actively request it, and no design governance tool currently addresses it. Wait for EXP.8 to establish the rule authoring pattern, then COGA ships fast.

---

### CHRON.1 — Reason-on-Override (Chronicle)

| Field | Value |
|-------|-------|
| **ID** | CHRON.1 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | COUNSEL.1 (Counsel Sprint 1 UI foundation) |
| **Status** | BACKLOG |

**What:** Risk-tiered reason annotations on overrides. Green: auto-logged. Amber: optional free-text prompt. Red / manual override: required justification before the action proceeds. Reason stored alongside the override event in `override_events` table. Surfaced in the Audit Log (COUNSEL.4.5).

**Why:** Ledger records that overrides happen. Stamp records who. Chronicle records why. In a compliance review, "why" is the question that matters. This is the missing piece of the governance trail.

---

### ANVIL.1 — CLI Identity + Beautiful Output

| Field | Value |
|-------|-------|
| **ID** | ANVIL.1 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | None |
| **Status** | BACKLOG |

**What:** Rename the binary from `flint-gate` to `flint`. Rich terminal output using `chalk` and `cli-table3`: inline source snippets on violations, color-coded severity, summary box with health score + grade. Works in CI (detects TTY and strips color). Full spec at `docs/strategy/FEATURE-SPEC-ANVIL.md`.

**Why now:** The CLI is the first surface a developer evaluates when considering Flint for CI adoption. `flint-gate` is a name that reads like a temporary internal binary. `flint` is the product. The output quality gap is the difference between a tool that feels professional and one that feels like a prototype.

---

### CHRON.2 — Git-Backed Governance Ledger

| Field | Value |
|-------|-------|
| **ID** | CHRON.2 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | CHRON.1, BETA.1 (installer, ONLINE) |
| **Status** | BACKLOG |

**What:** `.flint/chronicle.jsonl` — a git-tracked append-only file that travels with the repo. Every override reason, every Red-tier mutation approval, every governance decision that CHRON.1 captures gets written here. Multi-developer teams share the same governance history. Chronicle entries surface in `git log` as governance-tagged commits.

---

### ANVIL.2 — Interactive Fix + Local Diff

| Field | Value |
|-------|-------|
| **ID** | ANVIL.2 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | ANVIL.1 |
| **Status** | BACKLOG |

**What:** `flint fix -i` — interactive step-through fix mode (approve/skip each violation). `flint diff` — show a local diff of what `flint fix` would change without applying it. Full spec at `docs/strategy/FEATURE-SPEC-ANVIL.md`.

---

### flint-ci build issues (deferred)

| Field | Value |
|-------|-------|
| **Priority** | P3 |
| **Effort** | M |
| **Status** | DEFERRED — post-beta |

**What:** Three outstanding build issues in `flint-ci/`: `computeDelta` export resolution, ANSI escape export collision, and `shared/` rootDir configuration in `tsconfig.json`. These cause build warnings but the CLI works for its primary commands.

**Why deferred:** None of these block the beta. They are developer experience issues in the CI package, not runtime failures. Revisit when ANVIL.1 (CLI rename + output rewrite) starts, since that sprint touches the same files.

---

## Tier 3 + 4 Sequencing Recommendation

If you had to pick the order for the next six weeks, this is the suggested sequence:

1. **Ship Tier 1 batch** (BETA-POLISH.1–6) in the first two weeks of the beta window. One PR, one deploy.
2. **QUALITY.1** (commit the 47 unstaged tests) — one afternoon, no risk.
3. **EXP.8** (WCAG 2.2 rule pack) — spec is complete, architecture is proven, legal urgency is real.
4. **COUNSEL.1.1, 1.2, 1.7** (P0 Counsel tasks) — these are the foundation for everything else in Counsel.
5. **AUTO.1 fake-door** (Vigil StatusBar pill) — one day, generates validation data.
6. **QUALITY.2 + QUALITY.3** (dead code + playbook polish) — batch into one cleanup sprint.
7. **ANVIL.1** (CLI rename + output) — when beta feedback confirms developer-facing work is the right next bet.

---

## Sprint History (reference)

All items below are ONLINE. Full specs preserved for dependency tracing.

---

### Sprint 1 completions

| ID | Name |
|----|------|
| SEC.4 | API Key Safe Storage — `safeStorage.encryptString` wrapping macOS Keychain / DPAPI |
| CX.1 | Response Quality Baseline — `ResponseMeta` helper, `summary` field, `dry_run` flag |
| CX.2 | `flint_plan` Wire-Up — registered in `server.ts`, 64 tests |
| ING.3 | MCP `healOnAudit` Integration Tests — `healOnAudit.test.ts`, `import:snap-to-token` IPC |
| SEC.5 | Terminal API Hardening — `cwd` validation, 8KB input guard |
| SEC.6 | Ingestion Rate Limiting — token-bucket, 429 on breach |

### Sprint 2 completions

| ID | Name |
|----|------|
| V.1-rs-wire | Risk Scoring Registration — `flint_risk_score` registered in `server.ts` |
| GOV.3 | Session-Level Mutation Validation — uniqueness + orphan checks, ledger storage |
| CX.3 | Error Taxonomy + Rule Explanations — 50 entries, `explanation` field on every rule |
| GOV.1 | Rule Provenance — `sourceAuthority`, `regulatoryReference`, audit report export |
| GOV.2 | Override Telemetry — `override_events` table, StatusBar badge |
| U.3 | Immersive Canvas — bottom split removed, full-height XYCanvas |

### Sprint 3 completions

| ID | Name |
|----|------|
| V.1 | Probabilistic Risk Scoring (full) — Green/Amber/Red tiers, MRS 0–100, `flint_risk_score` |
| AGV.1 | Per-Agent Tool ACL — 4 trust tiers, `.flint/agent-policy.json` |
| AGV.2 | Agent Risk Dashboard — `flint://agent-risk` resource, Glass "agents" tab |
| MDA.1 | Mithril Delta Mode — baseline snapshots, delta-only audit, "Set Baseline" |

### Sprint 4 completions

| ID | Name |
|----|------|
| U.4 | Ghost Code Snippets — `GhostCodeSnippet.tsx`, Hover-to-Source, `react-syntax-highlighter` |
| W.1 | MCP Push Channel — `mcp-events.jsonl`, `useMCPEventListener`, `fs.watch` tail |
| W.3 | Bidirectional Action Flint — `mcpClient.ts`, Glass-initiated MCP tool calls |

### Sprint 5 completions

| ID | Name |
|----|------|
| EXP.3 | Tailwind v3→v4 Migration — `flint_migrate_tw`, AST class transform, post-migration audit |
| EXP.4 | Multi-Brand Theme Validation — `flint_validate_themes`, cross-theme matrix |
| POL.1 | Configurable Policy Engine — ΔE threshold, per-rule modes, team overlays, Glass UI |
| IDE.1 | VS Code / Cursor Extension — diagnostics, quick fixes, status bar, MCP client |
| ONBOARD.1 | First-Launch Setup Wizard — IDE detection, MCP snippet, connection test, first-launch flag |

### Sprint 6 completions

| ID | Name |
|----|------|
| EXP.6a-ext | Accessibility Expansion (50 WCAG 2.1 AA rules) — live regions, motion, forms, 9 rule modules |
| DBOM.1 | Design Bill of Materials — JSON/Markdown/CycloneDX, `flint_generate_dbom` |
| V.3 | Universal AST Abstraction — `FlintNode`, JSX + JSON Schema adapters, `PluginRegistry` |
| V.4 | Multi-Agent Epistemic Consensus Gate — secondary agent eval, `flint_consensus_report` |
| GOV.4 | Statistical Anomaly Detection — 3σ threshold, baseline/detect/history |
| EXP.5 | Design System Version Migration — token diff, AST rename, ΔE scoring |
| AGV.3 | Auto-Escalation Rules — 4 default rules, session-scoped |
| AGV.4 | Agent Trust Tiers — behavioral promotion/demotion, SQLite-backed |

### Sprint 7 completions

| ID | Name |
|----|------|
| SYNC.1 | Database Schema + OAuth + Figma API Service — 4 tables, PKCE flow, `figmaApiService.ts` |
| SYNC.2 | Three-Way Diff Sync Engine — 7 diff categories, pull/push/conflict resolution |
| SYNC.3 | MithrilLinter SYNC Violation Types — SYNC-001 token drift, SYNC-002 orphaned token |
| SYNC.4 | CI Sync Gate + Offline Queue + History Export + Dashboard Integration |
| EXP.7 | Cross-Platform Token Sync — DTCG → Tailwind/CSS/React Native/Swift/Kotlin |

### Additional completions (shipped alongside Sprints 1–7)

| Phase | Name |
|-------|------|
| ERM | Enterprise Rule Management — catalog, profiles, coverage, inheritance, 5 MCP tools, Glass UI |
| UCFG.5–7 | Unified Config Wiring — approval gates, scoring weights, classification, PDP/PEP enforcement, presets |
| CI.2 | CI/CD Parity Rewrite — `flint-ci/` thin CLI shell, 56 tests, SARIF, GitHub Actions wrapper |
| D2C.4 | Design-to-Code Quality — heuristics, token extraction, Code Connect, GovernanceOverlay mount |
| OAUTH.1 | Figma OAuth Flow — one-click Connect Figma from Glass |
| CR.1–4 | Constrained Registry — system prompt injection, registry gate, Scope panel |
| CK.1–4 | RAG Auto-Seeding — sqlite-vec, manifest + tokens + docs, constrained plan intent |
| EN.1–4 | Registry Enrichment — MCP tools, draft staging, Scope panel review UI, JSDoc extraction |
| CV2.2–7 | Component Canvas — thumbnail generator, cards, health grades, drag-to-insert, categories, search |
| VIS.1–7 | Visual Intelligence — variant preview, responsive snapping, live diff, coverage map, recipes, stickers, smart insert |
| GPX.1–2 | Governance Pack Exchange — export (security scanner, SHA-256), import (merge strategies, snapshot rollback) |
| LIB.1 | Bidirectional Library Workflow — set/detect/seed/push/pull, adapter tokens |
| BETA.1 | Beta Distribution Infrastructure — electron-builder prod config, signing config, auto-updater |
| BETA-TELEMETRY | Beta Telemetry Wiring — consent dialog, Cloudflare Worker, SQLite flag, opt-in flow |

---

## Tracks

### Project Initiation Track — Forge (FORGE.1–4)

> Full strategy: `docs/strategy/PROJECT-INITIATION-STRATEGY.md`
> Implementation plan: `docs/strategy/PROJECT-INITIATION-PLAN.md`
> Citadel name: **Forge**

**Problem:** 8 initiation channels on one screen = paralysis. The engine has 54 tools but none activate at project open. Gap between "opened" and "governed" is entirely manual.

| ID | Name | Priority | Effort | Sprint | Status |
|----|------|----------|--------|--------|--------|
| FORGE.1a | Three-Path LaunchScreen (reduce from 8 channels) | P0 | M | FORGE.1 | PROPOSED |
| FORGE.1b | Demo-to-Project Handoff (conversion CTA) | P1 | S | FORGE.1 | PROPOSED |
| FORGE.1c | Workspace Orientation Step (Step 0 in walkthrough) | P1 | S | FORGE.1 | PROPOSED |
| FORGE.1d | LaunchScreen A11y Fixes (10 critical) | P0 | M | FORGE.1 | PROPOSED |
| FORGE.1e | DemoWalkthrough A11y Fixes (6 critical) | P0 | S | FORGE.1 | PROPOSED |
| FORGE.1f | BetaWelcome + SetupWizard A11y Fixes (7 critical) | P1 | M | FORGE.1 | PROPOSED |
| FORGE.1g | Gate Transition Announcements (screen reader) | P1 | S | FORGE.1 | PROPOSED |
| FORGE.2a | Project Environment Detection (framework, library, tokens) | P0 | M | FORGE.2 | PROPOSED |
| FORGE.2b | Auto-Configuration from Detection | P1 | M | FORGE.2 | PROPOSED |
| FORGE.2c | Baseline Audit on Open (auto-audit + progress) | P0 | M | FORGE.2 | PROPOSED |
| FORGE.2d | Detection Banner in Glass | P1 | S | FORGE.2 | PROPOSED |
| FORGE.2e | MCP Banner Promotion (dominant when active) | P1 | S | FORGE.2 | PROPOSED |
| FORGE.3a | Progressive Integration Suggestions | P2 | M | FORGE.3 | PROPOSED |
| FORGE.3b | Figma Setup as Contextual Flow (not LaunchScreen) | P2 | S | FORGE.3 | PROPOSED |
| FORGE.3c | Demo Scenario Picker | P2 | S | FORGE.3 | PROPOSED |
| FORGE.4a | "Paste and Audit" Entry Point | P2 | M | FORGE.4 | PROPOSED |
| FORGE.4b | Recent Projects with Health Grades | P1 | S | FORGE.4 | PROPOSED |
| FORGE.4c | Scan Progress Streaming | P1 | S | FORGE.4 | PROPOSED |
| FORGE.4d | Smart Recommendations on First Audit | P1 | S | FORGE.4 | PROPOSED |

---

### Token Experience Track — Mint (MINT.1–4)

> Full strategy: `docs/strategy/TOKEN-EXPERIENCE-STRATEGY.md`
> Implementation plan: `docs/strategy/TOKEN-IMPLEMENTATION-PLAN.md`
> Citadel name: **Mint**

**Problem:** The Tokens tab is a flat CRUD list. 80% of the data needed for a brilliant token experience already exists in SQLite/MCP but isn't surfaced in Glass. Meanwhile, inline editing lets designers silently mutate governance standards with no provenance.

| ID | Name | Priority | Effort | Sprint | Status |
|----|------|----------|--------|--------|--------|
| MINT.1a | Token Health Bar (wire sync/coverage data) | P1 | S | MINT.1 | PROPOSED |
| MINT.1b | Visual Token Grid (swatches, specimens, rulers) | P1 | M | MINT.1 | PROPOSED |
| MINT.1c | Mode Columns (Light/Dark side-by-side) | P1 | S | MINT.1 | PROPOSED |
| MINT.1d | Remove Dangerous Actions (inline edit, delete, clear all) | P0 | S | MINT.1 | PROPOSED |
| MINT.1e | Fix TokenManager A11y Issues (8 findings) | P1 | S | MINT.1 | PROPOSED |
| MINT.2a | Token Usage Scanner (AST-level usage counts) | P0 | M | MINT.2 | PROPOSED |
| MINT.2b | Usage Counts + Dead Token Badges in UI | P0 | S | MINT.2 | PROPOSED |
| MINT.2c | Drift Indicators (Figma vs. local swatch comparison) | P1 | M | MINT.2 | PROPOSED |
| MINT.2d | Silent Drift Badge on Tokens Tab | P1 | S | MINT.2 | PROPOSED |
| MINT.3a | Token Contrast Auditor (WCAG pairing matrix) | P1 | M | MINT.3 | PROPOSED |
| MINT.3b | Contrast Badges in Token UI | P1 | S | MINT.3 | PROPOSED |
| MINT.3c | Token Approval Staging Area | P1 | M | MINT.3 | PROPOSED |
| MINT.3d | Additional A11y Token Insights (motion, scale, modes) | P2 | M | MINT.3 | PROPOSED |
| MINT.4a | First-Sync Prompt (Brilliant Moment 1) | P1 | S | MINT.4 | PROPOSED |
| MINT.4b | Pre-Export Emission Check (Brilliant Moment 4) | P1 | S | MINT.4 | PROPOSED |
| MINT.4c | Scale Gap Analysis | P2 | S | MINT.4 | PROPOSED |
| MINT.4d | Per-Token Detail View (usage + contrast + drift + provenance) | P1 | M | MINT.4 | PROPOSED |
| MINT.4e | Alias Chain Preservation (schema migration) | P2 | M | MINT.4 | PROPOSED |

---

### Counsel Track — Governance Experience Redesign (COUNSEL.1–4)

> Full spec: `docs/strategy/FEATURE-SPEC-COUNSEL.md`
> Citadel name: **Counsel**

**Health score unification status:** DONE. `shared/healthScore.ts` is the single source of truth. COUNSEL.1.3 is closed.

**Note on COUNSEL.1:** P0 tasks (1.1, 1.2, 1.7) are ready to implement now. See [Tier 3](#tier-3--next-features) for the recommended start sequence.

#### COUNSEL.2 — Deferral + Workload Voice

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.2.1 | Defer Button in Violation List + ExportModal | P0 | M | COUNSEL.1 | PROPOSED |
| COUNSEL.2.2 | "Flagged for Review" Tier (middle state) | P1 | M | COUNSEL.2.1 | PROPOSED |
| COUNSEL.2.3 | Snooze with Auto-Resurface (time-bound expiry) | P1 | L | COUNSEL.2.1 | PROPOSED |
| COUNSEL.2.4 | Effort Framing ("About 2 minutes with Autopilot") | P1 | S | COUNSEL.1.3 | PROPOSED |
| COUNSEL.2.5 | Session Fix Progress Indicator | P2 | S | — | PROPOSED |

#### COUNSEL.3 — Intelligence Surface

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.3.1 | "Undo to Last Clean State" (Stamp + Rewind integration) | P1 | L | COUNSEL.2 | PROPOSED |
| COUNSEL.3.2 | Provenance Chip in Violation Cards | P1 | M | COUNSEL.3.1 | PROPOSED |
| COUNSEL.3.3 | Anomaly Alert Banner (Flare 3-sigma in GovernanceDashboard) | P1 | M | — | PROPOSED |
| COUNSEL.3.4 | Risk Trend Badge on Violation Cards | P2 | M | COUNSEL.3.2 | PROPOSED |

#### COUNSEL.4 — Brilliant Moments

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.4.1 | Token Change Impact Preview | P1 | L | COUNSEL.3 | PROPOSED |
| COUNSEL.4.2 | Compliance Trajectory Chart (7-day sparkline) | P2 | M | COUNSEL.1.3 | PROPOSED |
| COUNSEL.4.3 | Governance Navigation Pathway (Dashboard → Panel → Policy) | P1 | M | COUNSEL.1 | PROPOSED |
| COUNSEL.4.4 | Zero-Violation Generation Signal | P2 | S | — | PROPOSED |
| COUNSEL.4.5 | Audit Log Tab (provenance + override + anomaly, filterable) | P2 | L | COUNSEL.3 | PROPOSED |

---

### Anvil Track — Brilliant CLI Experience (ANVIL.1–4)

> Full spec: `docs/strategy/FEATURE-SPEC-ANVIL.md`
> Citadel name: **Anvil**

| ID | Name | Priority | Effort | Sprint | Status |
|----|------|----------|--------|--------|--------|
| ANVIL.1 | Identity + Beautiful Output (rename to `flint`, rich terminal) | P1 | M | Tier 4 | BACKLOG |
| ANVIL.2 | Interactive Fix + Local Diff (`flint fix -i`, `flint diff`) | P1 | L | Tier 4 | BACKLOG |
| ANVIL.3 | Watch Mode + Missing Commands (`flint watch`, migrate, pack, rules) | P2 | L | Tier 4 | BACKLOG |
| ANVIL.4 | Polish (shell completions, CI detection, smart errors, npx) | P2 | M | Tier 4 | BACKLOG |

---

### Chronicle Track — Narrated Governance History (CHRON.1–2)

> Full spec: `docs/strategy/FEATURE-SPEC-CHRONICLE.md`
> Citadel name: **Chronicle**

| ID | Name | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| CHRON.1 | Reason-on-Override (risk-tiered annotation) | P1 | M | COUNSEL.1 | BACKLOG |
| CHRON.2 | Git-Backed Governance Ledger | P2 | L | CHRON.1, BETA.1 | BACKLOG |

---

## Agent-Aware Governance Track (AGV)

All AGV phases are ONLINE. Listed here for dependency reference.

| Phase | Status |
|-------|--------|
| AGV.1 Per-agent tool ACL | ONLINE |
| AGV.2 Agent risk dashboard | ONLINE |
| AGV.3 Auto-escalation rules | ONLINE |
| AGV.4 Agent trust tiers | ONLINE |

---

## Do NOT Build

**Agent orchestration or lifecycle management.** Claude Code, Cursor, and Copilot own this. Flint governs what agents can do to code — it never starts, stops, schedules, or directs agents. AGV is governance of agents, not orchestration of agents.

**Chat UI in Flint Glass.** Explicitly prohibited in CLAUDE.md. The host IDE owns the conversational interface.

**Monaco editor in Flint Glass.** Glass is a visual observability layer. Code editing belongs in the host IDE.

**File explorer panel in Flint Glass.** Same reasoning as Monaco. Glass shows the layer tree, not a filesystem browser.

**Terminal panel in Flint Glass.** U.3 removed this. Host IDE owns the terminal.

**Fine-tuning or model training.** Flint assumes model hallucination and constructs deterministic containment. Fine-tuning is a different product.

**General-purpose code quality (ESLint replacement).** Flint's governance is scoped: design tokens, accessibility, brand compliance, AST integrity. Not a general linter.

**Figma plugin canvas editing.** The Figma MCP server owns design layer generation. Flint is the governance layer over Figma outputs, not a Figma feature. The custom plugin was deprecated 2026-04-15.

**Cloud-hosted Flint SaaS (until local-first is complete).** Commandment 4 (Local-First Only) is a security and trust choice, not just a technical one. Phase C.1 (PowerSync) is the planned exception and must be explicitly decided before any code leaves a user's machine.

**Automated Fix PRs (GitHub PR opening).** Revisit after the CI/CD gate (EXP.1, ONLINE) has proven adoption. Requires SCM auth, branch management, and PR template systems that are significant scope.

---

## Deferred Decisions

**Org-Wide Governance Dashboard.** Requires either local aggregation (limited to one machine) or cloud backend (requires C.1 PowerSync URL provisioned). Deferred until C.1 scope is committed.

**Cloud PowerSync (Phase C.1).** Needs a provisioned URL. Business/infrastructure decision, not engineering. Do not begin implementation until the URL is confirmed.

**VS Code / Cursor Extension packaging.** IDE.1 is ONLINE. Distribution model unresolved: VS Code Marketplace vs. Claude Code MCP auto-discovery flow. Decision needed before marketplace submission.

**Per-agent identity protocol.** AGV.1-4 depend on `agent_id` being a reliable identifier. The MCP spec does not standardize agent identity. Custom `x-flint-agent-id` header vs. `clientInfo.name` from MCP `initialize`. Decision needed before any AGV schema change.

**Vigil scheduling model (AUTO.1 full build).** Fake-door first. Full build only after beta confirms testers want nightly scans. If Glass is typically closed between sessions, the scheduling model changes (OS background process vs. next-open trigger).

**GPX Marketplace hosting model.** Static JSON file (L, low ops) vs. dynamic API (XL, search indexing, auth). Recommend static for beta.

---

## Backlog Metrics Summary

| Tier | Items | Notes |
|------|:-----:|-------|
| Tier 0 (shipped) | — | Beta milestone reached |
| Tier 1 (beta polish) | 6 | BETA-POLISH.1–6; all S or M effort |
| Tier 2 (hardening) | 4 | QUALITY.1–4; no blockers |
| Tier 3 (next features) | 3 clusters | EXP.8, AUTO.1 fake-door, COUNSEL.1 |
| Tier 4 (strategic) | 6 | GPX.3, EXP.9, CHRON.1, ANVIL.1, CHRON.2, ANVIL.2 |
| Tracks (post-Tier 4) | 19 (Forge) + 18 (Mint) + 14 (Counsel 2–4) + 4 (Anvil 3–4) | |
| Deferred | 5 decisions | No implementation blocked |

**Test baseline at time of update:** MCP: 3,612/3,612 | Glass: 1,322/1,322 | Core: 1,146/1,146 | CI: 56/56 — TSC 0 errors (47 additional governance service tests staged but not yet committed — update count after QUALITY.1 ships)
