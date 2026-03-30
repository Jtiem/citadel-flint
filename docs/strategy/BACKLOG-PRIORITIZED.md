# Flint — Prioritized Product Backlog
**Date:** 2026-03-27
**Author:** flint-product-planner
**Sources:** CLAUDE.md, HANDOFF.md, FLINT-MASTER-PLAN.md, FLINT-GAP-REMEDIATION-PLAN.md, FLINT-EXPANSION-PLAN.md, FLINT-FUTURE-SPRINTS.md, FLINT-GLASS-PIVOT.md, JOURNEY-MAPS.md, JourneyMap-TestAudit.md, JTBD-GapFill-Plan.md, Snyk-Competitive-Analysis.md, INVESTOR-BRIEF-2026.md
**Current JTBD score:** 8.4/10 (target: 9.0)
**Test baseline:** MCP: 3,612/3,612 | Glass: 1,322/1,322 | Core: 1,146/1,146 | CI: 56/56 — TSC 0 errors

---

## Quick Navigation

| Section | What to find |
|---------|-------------|
| [Completed Since Last Update](#completed-since-last-update) | Everything that shipped since the backlog was written |
| [Sprint 1 — Immediate (Weeks 1–2)](#sprint-1--immediate-weeks-12) | Items unblocked right now, highest impact |
| [Sprint 2 — Foundation (Weeks 2–4)](#sprint-2--foundation-weeks-24) | Core infrastructure, unblocks downstream |
| [Sprint 3 — Risk + Chat Quality (Weeks 4–6)](#sprint-3--risk--chat-quality-weeks-46) | Risk scoring, MRS, CX baseline |
| [Sprint 4 — Glass Completion (Weeks 6–8)](#sprint-4--glass-completion-weeks-68) | JTBD 9.0, bidirectional action |
| [Sprint 5 — Market Expansion (Weeks 8–12)](#sprint-5--market-expansion-weeks-812) | Migration tools, multi-brand, a11y depth |
| [Sprint 6 — Platform Moat (Weeks 12–18)](#sprint-6--platform-moat-weeks-1218) | Domain abstraction, consensus gate, DBOM |
| [Sprint 7 — Enterprise Sync (Weeks 18–26)](#sprint-7--enterprise-sync-weeks-1826) | Bidirectional Figma token sync |
| [Sprint 8 — Next Wave](#sprint-8--next-wave) | WCAG 2.2, COGA, Beta, GPX Marketplace, Autopilot |
| [Agent-Aware Governance Track](#agent-aware-governance-track-agv) | AGV.1–4 (all ONLINE) |
| [Do NOT Build](#do-not-build) | Scope creep catalog |
| [Deferred Decisions](#deferred-decisions) | Open questions |

---

## Completed Since Last Update

The backlog was originally authored with a test baseline of 2,165 MCP tests. The following items shipped across three sessions on 2026-03-26, pushing the baseline to 3,612 MCP / 1,322 Glass / 1,146 Core / 56 CI. All items below are now ONLINE.

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
| AGV.2 | Agent Risk Dashboard — `flint://agent-dashboard` resource, Glass "agents" tab |
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

### Additional completions (shipped alongside or after Sprints 1–7)

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

---

## Priority + Effort Legend

| Priority | Meaning |
|----------|---------|
| P0 | Critical. Blocking safety, correctness, or demo-ability. Ship first. |
| P1 | High value. Directly improves JTBD score, revenue, or moat. Ship next. |
| P2 | Important. Meaningful improvement but not blocking. |
| P3 | Nice-to-have. Worthwhile when not competing with P0–P2. |

| Effort | Time |
|--------|------|
| S | 1–2 days |
| M | 3–5 days |
| L | 1–2 weeks |
| XL | 2–4 weeks |

---

## Status Definitions

- **ONLINE** — Shipped and tested
- **IN-FLIGHT** — Code committed but wire-up step pending (see ACTIVE-SWARM-TERRITORY.md)
- **PLANNED** — Spec complete, ready for implementation
- **BACKLOG** — Defined, not yet specced to implementation depth

---

## Sprint 1 — Immediate (Weeks 1–2)

These items are unblocked today, carry security or correctness implications, or close a critical gap that slows every subsequent sprint.

---

### SEC.4 — API Key Safe Storage

| Field | Value |
|-------|-------|
| **ID** | SEC.4 |
| **Priority** | P0 |
| **Effort** | M |
| **Dependencies** | None |
| **Status** | ONLINE |

**What:** Replace plaintext Anthropic API key storage in `~/.flint/config.json` with `safeStorage.encryptString` / `decryptString` (Electron built-in wrapping macOS Keychain / Windows DPAPI / Linux libsecret). Migrate existing plaintext keys on first load.

**Why this priority:** A plaintext API key on disk is an unconditional security failure — not a theoretical risk. If any process reads `~/.flint/config.json`, the key is exfiltrated. This affects every Flint user. Sprint 2 Security completed SEC.1-3, but SEC.4 was deferred. The gap between completing a security sprint and shipping plaintext keys is indefensible.

**Journey impact:** Journey 7 (MCP Agent Workflow) — every AI agent interaction depends on a valid API key. A compromised key terminates agent capability entirely.

**Revenue/demo impact:** Enterprise buyers perform security reviews before purchasing. Plaintext keys are an automatic disqualifier in any SOC 2 or ISO 27001 review.

**Technical debt risk:** Delay increases. Every user who installs Flint before SEC.4 ships has an unencrypted key.

---

### CX.1 — Response Quality Baseline

| Field | Value |
|-------|-------|
| **ID** | CX.1 |
| **Priority** | P0 |
| **Effort** | M |
| **Dependencies** | None |
| **Status** | ONLINE |

**What:** Four additive changes to MCP tool responses — no schema breaking changes:
1. `summary` field on all tool responses (one human-readable sentence alongside the technical payload)
2. `project_context` footer on audit/fix responses (health score, total violations, blocked files)
3. MCP `initialize` onboarding pointer in server description
4. `dry_run` flag on `flint_ast_mutate` and `flint_fix`

**Why this priority:** Flint's governance engine is excellent. The conversational experience is primitive. Every time a designer or agent sees a raw SARIF blob in response to a question, Flint loses a user. CX.1 is the highest ROI change in the entire backlog: it changes what Flint says, not what it does. `flint_plan` (CX.2) is in-flight but meaningless without CX.1's readable output. The `dry_run` flag closes a safety gap — today, `flint_fix` mutates files without any preview capability, which violates the spirit of Commandment 10 (Targeted Micro-Recovery).

**Journey impact:** Journey 7 (MCP Agent Workflow) — every step. Agents relay tool results to users; unreadable output breaks the entire conversational loop.

**Competitive moat:** Snyk's competitive advantage partly rests on readable, actionable error output. Flint currently reads like a linter, not a governance partner.

---

### CX.2 — `flint_plan` Wire-Up (1 remaining step)

| Field | Value |
|-------|-------|
| **ID** | CX.2 |
| **Priority** | P0 |
| **Effort** | S |
| **Dependencies** | CX.1 (for readable output), ING.3 clearance of `server.ts` |
| **Status** | ONLINE |

**What:** Register `flint_plan` in `flint-mcp/src/server.ts`: add import, add to ListTools array, add case to CallTool switch. Three-line change. The `planService.ts`, `plan.ts`, and 64 tests are already committed.

**Why this priority:** The tool is built and tested. It is sitting in a committed but unregistered state. Every multi-step agent task that runs without `flint_plan` (token migration, accessibility sweep, full audit) forces every agent to reinvent the execution loop. That is wasted tokens and inconsistent outcomes. One registration step unblocks it.

**Journey impact:** Journey 7 step 7.2 (Audit Execution) — agents can now request a structured execution plan before running tools.

---

### ING.3 — MCP `healOnAudit` Integration Tests

| Field | Value |
|-------|-------|
| **ID** | ING.3 |
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | Phase ING (ONLINE) |
| **Status** | ONLINE |

**What:** Write `flint-mcp/src/__tests__/healOnAudit.test.ts` covering the `healOnAudit` parameter on `flint_audit`. Also wire real AST surgery for `import:snap-to-token` IPC in `electron/main.ts`.

**Why this priority:** The `healOnAudit` feature is shipped but not fully tested. Flint is a governance product — shipping an audit heal path without integration test coverage is hypocritical and creates regression risk for every downstream feature that touches `flint_audit`. Also, clearing ING.3's claim on `server.ts` unblocks CX.2 wire-up.

**Technical debt risk:** ING.3 holds a territory claim on `flint-mcp/src/server.ts`. Until it clears, CX.2 wire-up cannot proceed cleanly.

---

### SEC.5 — Terminal API Hardening

| Field | Value |
|-------|-------|
| **ID** | SEC.5 |
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | None |
| **Status** | ONLINE |

**What:** Validate `cwd` in `terminal:spawn` handler is at or below `workspaceRoot`. Add 8KB max-length guard on `terminal:data` input.

**Why this priority:** `terminal:spawn` accepts any path from the renderer — effectively unrestricted shell spawn. While the existing process isolation is sound, the blast radius of a compromised renderer is unnecessarily wide. S effort with high security yield. Can ship in parallel with any other work.

**Technical debt risk:** Low today, but grows as Flint gains more users and more MCP surfaces calling back into the renderer context.

---

### SEC.6 — Ingestion Rate Limiting

| Field | Value |
|-------|-------|
| **ID** | SEC.6 |
| **Priority** | P2 |
| **Effort** | S |
| **Dependencies** | None |
| **Status** | ONLINE |

**What:** Token-bucket rate limiter on the ingestion server: 10 req/min for `/ingest`, 60 req/min for `/ingest-ast`. Respond `429` when exceeded.

**Why this priority:** Loopback-only binding already limits exposure significantly. Rate limiting is a P2 cosmetic hardening, not a P0 gap. Ship after SEC.4 and SEC.5 are cleared.

---

## Sprint 2 — Foundation (Weeks 2–4)

These items build shared infrastructure that multiple downstream phases depend on. Delaying them compounds cost.

---

### V.1-rs Wire-Up — Risk Scoring Registration

| Field | Value |
|-------|-------|
| **ID** | V.1-rs-wire |
| **Priority** | P0 |
| **Effort** | S |
| **Dependencies** | V.2-mp (ONLINE), V.1-rs service (ONLINE) |
| **Status** | ONLINE |

**What:** Register the `flint_risk_score` MCP tool in `server.ts` once CX.2 clears the territory claim. The `riskScoringService.ts` and tests are committed.

**Why this priority:** Risk scoring is the single most important governance improvement in the entire V-series. It changes Flint from binary pass/fail to a continuous risk gradient. Every Amber and Red tier mutation now carries a score instead of just a blocking verdict. Until this is registered, the service exists but no MCP client can call it. This also unblocks AGV.2 and AGV.3.

**Competitive moat:** Snyk's AppRisk pro-rating model is their enterprise differentiator. MRS is Flint's equivalent. Demo-able to enterprise buyers immediately after registration.

---

### GOV.3 — Session-Level Mutation Validation

| Field | Value |
|-------|-------|
| **ID** | GOV.3 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | INFRA.2 (ONLINE), V.2-mp (ONLINE) |
| **Status** | ONLINE |

**What:** After each `applyMutationBatch`, run a validation pass: all `data-flint-id` values unique, no orphaned nodes, import statements match actual usage. Store session mutation history in ledger. Surface validation failures as a new error category in the Mithril Safety Score.

**Why this priority:** This closes a real error class — 20 mutations in a session can produce internally inconsistent AST state without triggering any existing check. This is the difference between Flint being a "lints each mutation" tool and a "validates session-level correctness" tool. The latter is what enterprise customers need. INFRA.2 (mutations ledger) is ONLINE so the storage layer is ready.

**Journey impact:** Journey 7 step 7.3 (Auto-Fix) — multi-step agentic workflows currently have no post-session validation. Any AI agent doing bulk mutations could produce orphaned nodes silently.

**Technical debt risk:** Medium. The longer sessions go unvalidated, the larger the potential blast radius of an undetected inconsistency.

---

### CX.3 — Error Taxonomy + Rule Explanations

| Field | Value |
|-------|-------|
| **ID** | CX.3 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | None (additive) |
| **Status** | ONLINE |

**What:** Structured error codes (`FLINT-ERR-001`) with plain-language descriptions and recovery instructions. Per-rule `explanation` field on every governance rule surfaced in `flint_audit` and `flint_audit_report`.

**Why this priority:** Error taxonomy compounds over time — every new tool and rule benefits from it. Without it, tool failures are dead ends. With it, every error is a recovery path. The `explanation` field closes the "why does this rule exist?" gap that causes developers to work around rules they don't understand. This is free adoption velocity.

**Journey impact:** Journey 3 (Governance Audit Loop) step 3.2 (Violation Display) — designers see rule reasons, not just rule codes.

---

### GOV.1 — Rule Provenance

| Field | Value |
|-------|-------|
| **ID** | GOV.1 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | INFRA.1 (ONLINE) |
| **Status** | ONLINE |

**What:** Extend every violation emitted by MithrilLinter and A11yLinter with provenance metadata: `ruleId`, `sourceAuthority` (WCAG 2.1 AA / SOC2 / FDA SaMD), `regulatoryReference`, `lastUpdated`. Expose in Export Gate modal "Compliance Summary" section. Enable PDF/JSON "Audit Report" export.

**Why this priority:** This is the enterprise-facing compliance story. A `MITHRIL-COL-001` violation with `sourceAuthority: "WCAG 2.1 AA"` and `regulatoryReference: "§ 1.4.3 Contrast (Minimum)"` is a compliance artifact. The same violation without provenance is a lint warning. Enterprise buyers — especially in healthcare, government, and finance — need the former. INFRA.1 is ONLINE so the storage layer exists.

**Revenue/demo impact:** High. The Audit Report export is a direct "show your boss" artifact. Every enterprise demo benefits from this.

---

### GOV.2 — Override Telemetry

| Field | Value |
|-------|-------|
| **ID** | GOV.2 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | INFRA.1 (ONLINE) |
| **Status** | ONLINE |

**What:** Capture every `data-flint-override` bypass: node, rule, session, timestamp, project context. Write to `override_events` table. Surface as "Overrides (N)" badge in Glass status bar and filterable dashboard view.

**Why this priority:** Flint's governance claim is "every bypass is logged." Without override telemetry, that claim is false — bypasses happen silently. This is necessary for Flint to be credible as a governance product, not just a linting tool. It also closes the C6 (Gatekeeper Rule) test gap identified in JourneyMap-TestAudit.md.

**Competitive moat:** No design governance tool currently does this. Snyk's policy engine logs override decisions for security rules — this is Flint's equivalent.

---

### U.3 — Immersive Canvas (Remove Bottom Split)

| Field | Value |
|-------|-------|
| **ID** | U.3 |
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | None |
| **Status** | ONLINE |

**What:** Remove bottom horizontal split (CodeEditorPanel + TerminalPanel). Set `XYCanvas` to occupy full viewport height. Recovers ~40% vertical real estate for the design canvas.

**Why this priority:** The bottom panel violates Flint's own architectural principle — Glass is a visual observability layer, not an IDE. The panels that need removal are listed as anti-patterns in CLAUDE.md. This is also the prerequisite for Phase U.4 (Ghost Code Snippets), which gives the canvas its contextual code surface. Critically, it makes every demo visually cleaner and more aligned with Flint's "spatial code observability" identity.

**Journey impact:** Journey 5 (Canvas Interaction) — the most important real estate improvement since the GLASS-PIVOT was adopted.

---

## Sprint 3 — Risk + Chat Quality (Weeks 4–6)

---

### V.1 — Probabilistic Risk Scoring (full feature)

| Field | Value |
|-------|-------|
| **ID** | V.1 |
| **Priority** | P0 |
| **Effort** | L |
| **Dependencies** | V.2-mp (ONLINE), V.1-rs service (ONLINE, needs wire-up) |
| **Status** | ONLINE |

**What:** Wire MRS (Mutation Risk Score) 0.0–1.0 into the full mutation approval flow. Three tiers: Green (0.0–0.3, auto-approve eligible) / Amber (0.31–0.69, requires human review) / Red (0.7–1.0, requires senior sign-off + justification). Surface in MCP `tool_result`. Log to provenance ledger.

**Why this priority:** Binary governance (BLOCKED / APPROVED) is insufficient for enterprise. A single-node text edit and a complete component restructuring both register identically as "APPROVED." Risk scoring adds the gradient that senior decision-makers need for triage. It is also the dependency for V.4 (Consensus Gate) — the most defensible architectural moat in the entire backlog.

**Revenue/demo impact:** Very high. "Here is the risk score for this mutation" is a Board-level demo moment. Snyk's AppRisk ASPM product (their $500M+ revenue contributor) is built on exactly this pattern.

**Competitive moat:** No design governance tool has risk scoring. This is a category-defining capability.

---

### AGV.1 — Per-Agent Tool ACL

| Field | Value |
|-------|-------|
| **ID** | AGV.1 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | SEC.3 (ONLINE — MCP tool allowlist) |
| **Status** | ONLINE |

**What:** Extend the `RENDERER_ALLOWED_MCP_TOOLS` allowlist (from SEC.3, in `electron/mcp-policy.ts`) to a per-agent permission model. Each registered agent (identified by `agent_id` in MCP session metadata) gets its own ACL: which tools it can call, at which tier. An untrusted agent can call read-only tools (audit, query_registry, status) but not mutation tools (ast_mutate, fix, sync) without explicit elevation.

**Why this priority:** SEC.3 blocks the renderer from calling destructive tools. AGV.1 extends that same model to the agent layer. As MCP adoption expands (6,400+ servers, every major IDE), Flint will be called by agents it has never seen before. A blanket allowlist is insufficient for enterprise. Per-agent ACL is the minimum viable trust model for multi-agent environments.

**Fits Flint because:** Protect. Directly defends codebase integrity against untrusted agents.

**Journey impact:** Journey 7 (MCP Agent Workflow) — the governance layer for the AI agent itself, not just the code it produces.

---

### AGV.2 — Agent Risk Dashboard

| Field | Value |
|-------|-------|
| **ID** | AGV.2 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | V.1-rs (ONLINE), V.2-mp (ONLINE), AGV.1 |
| **Status** | ONLINE |

**What:** New MCP resource `flint://agent-risk` that aggregates MRS scores, provenance records, and override counts grouped by `agent_id`. Surfaced in Glass as a tab in the Health panel: "Top 5 riskiest agents this week," average risk score per agent, count of Red-tier mutations per agent.

**Why this priority:** The Governance Dashboard (V.1-gd, ONLINE) shows what happened. The Agent Risk Dashboard shows who caused it. For teams running multiple AI agents (Claude Code, Cursor, custom agents), this is the accountability layer. It answers the enterprise question: "Which agent is responsible for this violation?" — a question that has no answer today.

**Revenue/demo impact:** High. The "agent accountability" narrative is directly relevant to every enterprise buyer asking "how do we control AI agents in our codebase?"

---

### AGV.3 — Auto-Escalation Rules

| Field | Value |
|-------|-------|
| **ID** | AGV.3 |
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | AGV.2, V.1 |
| **Status** | ONLINE |

**What:** Configurable rules that trigger when an agent's cumulative risk score exceeds a threshold: "If agent X produces 3 or more Red-tier mutations in a session, require manual review for all subsequent mutations from that agent." Rules stored in `.flint/agent-policy.json`. Escalation events logged to `governance_events` table (INFRA.1, ONLINE).

**Why this priority:** The auto-escalation pattern is what separates a monitoring tool from a governance tool. Monitoring tells you after the fact. Governance acts in the moment. This is the design-domain equivalent of Snyk Evo's OODA loop "Decide" step.

**Competitive moat:** No competitor has session-level agent behavior analysis with real-time escalation. This is a genuine moat.

---

## Sprint 4 — Glass Completion (Weeks 6–8)

These complete the JTBD 9.0 target and make Glass a bidirectional control surface.

---

### U.4 — Ghost Code Snippets

| Field | Value |
|-------|-------|
| **ID** | U.4 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | U.3 (Immersive Canvas) |
| **Status** | ONLINE |

**What:** When a node is selected on the canvas, a `GhostCodeSnippet.tsx` overlay surfaces relevant source using a lightweight syntax highlighter (`react-syntax-highlighter`). Integrate with `ShieldOverlay.tsx` for "Hover-to-Source." Code is contextual, not permanently embedded. No Monaco panel.

**Why this priority:** This is the payoff for removing the bottom split (U.3). Designers get code context without leaving the canvas. The spatial UX is what differentiates Glass from a GitHub Actions log viewer. Without U.4, U.3 just removes functionality without replacing it.

**Journey impact:** Journey 5 (Canvas Interaction) step 5.3 (Property Edit) — currently PARTIAL coverage. Ghost code HUDs close the spatial-to-code connection.

---

### W.1 — MCP-to-Glass Push Channel

| Field | Value |
|-------|-------|
| **ID** | W.1 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | None (uses fs.watch pattern already established by annotationStore) |
| **Status** | ONLINE |

**What:** Event bus via filesystem: MCP server appends to `.flint/mcp-events.jsonl` after tool completion. Electron main process tail-follows from stored byte offset (10s poll fallback). Emits `flint:mcp-event` IPC event to renderer. `useMCPEventListener` hook dispatches to stores. Bell notification for critical governance events within 5 seconds.

**Why this priority:** This is half of the JTBD Wave 3 goal. Without W.1, Glass is a polling viewer. With W.1, Glass becomes a live control surface. The pattern is already established by `annotationStore` (fs.watch), so implementation risk is understood.

**Journey impact:** Journey 3 (Governance Audit Loop) step 3.2 (Violation Display) — violations surface proactively, not on next user action.

**JTBD impact:** +0.3 toward 9.0 target.

---

### W.3 — Bidirectional Action Flint

| Field | Value |
|-------|-------|
| **ID** | W.3 |
| **Priority** | P1 |
| **Effort** | XL |
| **Dependencies** | W.1 (recommended, not blocking) |
| **Status** | ONLINE |

**What:** Electron main process as MCP client (`electron/mcpClient.ts`). Exposes `flintAPI.mcp.callTool(name, args)` and `flintAPI.mcp.readResource(uri)` to the renderer. Glass buttons "Run Audit" and "Auto-Fix" invoke MCP tools directly from the canvas. Activity Feed gains "Retry" and "Approve" buttons.

**Why this priority:** This is the highest complexity remaining item in the JTBD backlog and the one that unlocks the most downstream affordances. Canvas right-click → "Run Audit." Dashboard "Fix" buttons. Any future Glass-initiated MCP tool call. Everything that makes Glass a governance control surface (not just a monitor) depends on W.3. Risk is HIGH due to child process management, but the architecture is correct and the IPC pattern follows Commandment 9.

**JTBD impact:** Combined with W.1, moves composite score from 8.4 to 9.0.

---

### Mithril Delta Mode — Baseline Snapshotting

| Field | Value |
|-------|-------|
| **ID** | MDA.1 |
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | INFRA.1 (ONLINE), EXP.1 (ONLINE) |
| **Status** | ONLINE |

**What:** New SQLite table `mithril_baseline` storing the last accepted audit snapshot per project. `MithrilLinter` gains an `auditDelta(baseline)` method returning only net-new violations. Export Gate gains a "Set Baseline" button. Delta violations surface in amber; baseline violations are tracked but do not block export.

**Why this priority:** Teams adopting Flint mid-project see 200+ existing violations and disengage. Delta mode changes the adoption story from "fix everything at once" to "don't regress from where you started." This is directly analogous to Snyk's `snyk-delta` CLI — one of their strongest enterprise adoption mechanisms. Snyk analysis (Snyk-Competitive-Analysis.md §4.2) specifically identifies this as a high-impact adoption driver for Flint.

**Journey impact:** Journey 3 (Governance Audit Loop) — reduces false urgency for new project adopters.

---

## Sprint 5 — Market Expansion (Weeks 8–12)

These extend Flint's horizontal surface into adjacent markets with existing infrastructure.

---

### EXP.3 — Tailwind v3 to v4 Migration

| Field | Value |
|-------|-------|
| **ID** | EXP.3 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | EXP.1 (ONLINE — CI gate), EXP.2 (ONLINE — debt report) |
| **Status** | ONLINE |

**What:** `flint migrate-tw <glob> --from 3 --to 4` — AST-level class transformation via Babel visitor on JSX `className`. Covers deprecated class maps (`bg-opacity-X` → `bg-color/X`, `flex-grow` → `grow`, etc.). Config migrator for `tailwind.config.js` → CSS-based v4 pattern. Post-migration audit. Dry-run mode.

**Why this priority:** The Tailwind v3→v4 migration is a market moment. Every Tailwind v3 project will face this migration in 2026. Most migration tools use regex codemods that break on edge cases. Flint's AST approach produces provably correct output validated against design tokens. This is a forcing function for new user acquisition — developers who need to migrate and find Flint's governance-verified output superior to alternatives become Flint users.

**Competitive moat:** "Governance-verified migration" is a category that does not exist. The post-migration audit run is the killer feature.

---

### EXP.4 — White-Label / Multi-Brand Theming

| Field | Value |
|-------|-------|
| **ID** | EXP.4 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | EXP.1 (ONLINE), EXP.3 (class transformer pattern) |
| **Status** | ONLINE |

**What:** `flint theme-validate <glob> --themes brand-a.json,brand-b.json` — validates single codebase under multiple brand token sets. Each theme is a DTCG token file. Cross-theme matrix report: "Brand B has 12 violations Brand A doesn't." MCP tool: `flint_validate_themes`.

**Why this priority:** SaaS companies building white-label products need to prove N brands work correctly. Currently done manually or with visual regression (slow, flaky). Flint's token-based approach is deterministic. Creates a new revenue vector: per-brand licensing model.

**Revenue/demo impact:** High for enterprise SaaS companies. "We validated all 6 of our customer brands in one CI run" is a compelling pitch.

---

### Configurable Policy Engine

| Field | Value |
|-------|-------|
| **ID** | POL.1 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | None |
| **Status** | ONLINE |

**What:** `.flint/policy.json` schema per project. `MithrilLinter` reads it at runtime: configurable ΔE threshold (default 2.0), blocking vs. advisory rule IDs, export gate severity floor, per-team rule overrides. Glass settings panel exposes the policy as a UI form.

**Why this priority:** The hardcoded ΔE = 2.0 threshold means every Flint project has identical tolerance. A marketing team doing experimental work and a financial product with strict accessibility compliance have the same rules. Enterprise buyers require configurable policies. Snyk analysis (§3.3) identifies this as the single most common enterprise objection: "your linter is too strict for our workflow." The counter-argument disappears with POL.1.

**Revenue/demo impact:** High. Per-team policy configuration is a standard enterprise feature. Without it, Flint cannot serve multi-team organizations with different risk tolerances.

**Competitive moat:** Configurable governance shifts Flint from "linter with hardcoded rules" to "policy engine" — a fundamentally different product category.

---

### VS Code / Cursor Extension

| Field | Value |
|-------|-------|
| **ID** | IDE.1 |
| **Priority** | P2 |
| **Effort** | XL |
| **Dependencies** | EXP.1 (ONLINE — CLI audit command is the extension backend) |
| **Status** | ONLINE |

**What:** VS Code extension (and Cursor plugin) that reads `flint-manifest.json` from workspace root, runs `flint audit <activeFile>` via CLI, renders Mithril/a11y violations as amber squiggles with hover text showing ΔE score and suggested token. Quick-fix code action applies AST token substitution.

**Why this priority:** Snyk analysis (§3.2) identifies the IDE extension as the single strongest adoption driver for developer tools. "Flint governance without requiring Flint Glass to be open" makes Flint a passive, always-present safety net — the exact strategy that made Snyk ubiquitous. This is a distribution multiplier, not just a feature.

**Effort caveat:** XL effort due to VS Code extension boilerplate. The governance backend (CLI audit) already exists. This is packaging + IDE integration, not core engine work.

---

### ONBOARD.1 — First-Launch Setup Walkthrough

| Field | Value |
|-------|-------|
| **ID** | ONBOARD.1 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | Flint Glass (distribution), IDE.1 (for IDE-specific snippet generation) |
| **Status** | ONLINE |

**What:** When Flint Glass opens for the first time (no `.flint/` config, or an explicit `first-launch` flag), it shows a full-screen setup wizard before the main canvas. Steps:

1. **Welcome** — one-sentence value prop, "Get Flint running in 2 minutes"
2. **IDE detection** — auto-detect Claude Code, Cursor, or VS Code from known config paths; let user confirm or choose manually
3. **MCP registration** — show a pre-filled JSON snippet with the correct path to the bundled `flint-mcp/dist/server.js` inside the `.app` bundle. Single "Copy" button. Instruction: "Paste this into your IDE settings."
4. **Test connection** — a "Verify Setup" button that pings `flint://capabilities` via the MCP client and shows green/red feedback. If green: "Flint is live." If red: shows the specific failure reason (server not found vs. server running but not registered).
5. **Done** — transitions to the main canvas with a "You're ready" toast. Flag written to suppress wizard on next launch.

**Why this priority:** Distribution is the biggest unsolved problem for Flint. The MCP engine currently requires manual edits to a JSON config file — a step that will block most non-developer users and cause a high drop-off rate during evaluation. The setup wizard makes Glass the installer, not the terminal. A user who downloads a `.dmg` and gets to "Flint is live" in under 3 minutes is a user who evaluates the product, not the setup process.

**Revenue/demo impact:** Very high. First-run experience is the make-or-break moment for trial conversion. Every enterprise evaluation starts here. A broken or confusing install is a lost deal.

**Journey impact:** Directly closes the gap in Journey 1 (New User / First Install). Without ONBOARD.1, Journey 1 has no happy path — it terminates at "edit settings.json manually."

**Implementation notes:**
- Wizard is a fullscreen React overlay in Glass, shown conditionally in `App.tsx` before the main layout renders
- IDE detection checks (in priority order):
  - `~/.claude/settings.json` → Claude Code (standalone or running inside a VS Code fork like Antigravity)
  - `~/Library/Application Support/Cursor/User/settings.json` → Cursor
  - `~/Library/Application Support/Code/User/settings.json` → VS Code
  - Antigravity specifically: uses Claude Code extension — detected via `~/.claude/` path, same flow as Claude Code
- The MCP snippet must use the absolute path to the bundled server inside the `.app` at runtime — Glass knows this path as `process.resourcesPath` (Electron)
- "Test connection" uses the existing `mcpClient.ts` (W.3, ONLINE) to call `flint_status`
- For npx/CLI users (no Glass), the public npm package (`@flinthq/mcp`) shows equivalent setup instructions in its README

---

## Sprint 6 — Platform Moat (Weeks 12–18)

These build the architectural depth that competitors cannot replicate quickly.

---

### EXP.6a — Accessibility Expansion (30 rules, ONLINE continuation)

| Field | Value |
|-------|-------|
| **ID** | EXP.6a-ext |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | EXP.6a (ONLINE — 30 rules exist), A11yLinter architecture |
| **Status** | ONLINE |

**What:** Extend to full WCAG 2.1 AA coverage (~50 rules). Add: focus management, APCA color contrast (WCAG 3.0 readiness), ARIA roles, landmark regions, live regions, keyboard navigation, motion preferences. Auto-fix transforms for all new rules. VPAT/ACR report generation. Domain rule sets for Section 508 (government), HIPAA (healthcare), ADA Title III.

**Why this priority:** EU Accessibility Act in force since June 2025 with EUR 3M fines. 5,114 ADA lawsuits in 2025 (37% YoY increase). Accessibility enforcement is the fastest-growing compliance mandate in the market. Flint already has 30 rules (EXP.6a, ONLINE). This sprint adds the remaining ~20 to reach full WCAG 2.1 AA coverage. Existing tools (axe-core, Lighthouse) detect but don't fix — Flint does both. VPAT generation is the compliance artifact that procurement teams require.

**Revenue/demo impact:** Very high for government, healthcare, and legal verticals. Section 508 compliance is a procurement requirement for all US federal software contracts.

---

### Design Bill of Materials (DBOM)

| Field | Value |
|-------|-------|
| **ID** | DBOM.1 |
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | GOV.1 (Rule Provenance), EXP.2 (ONLINE — Debt Report) |
| **Status** | ONLINE |

**What:** Machine-readable export inventorying: every design token used + compliance status, every component + source (Figma/Flint/handwritten) + Mithril audit result, every a11y violation with severity and rule ID, overall design compliance posture (score, trend). Format: JSON, with CycloneDX-extended option. New IPC channel `flint:generate-dbom`. Export modal gains "Export DBOM" button.

**Why this priority:** DBOM is the data foundation for the org-wide dashboard (a future sprint). It enables downstream workflows: procurement, brand certification, executive reporting. Snyk analysis (§3.4) identifies the SBOM as one of Snyk's most enterprise-differentiating artifacts — DBOM is the design equivalent. Flint already generates per-component audit data in `linterWarnings` and the Export Gate — DBOM is that data serialized into a shareable artifact.

---

### V.3 — Domain-Agnostic AST Abstraction

| Field | Value |
|-------|-------|
| **ID** | V.3 |
| **Priority** | P2 |
| **Effort** | XL |
| **Dependencies** | None (can parallel with V.1/V.2) |
| **Status** | ONLINE |

**What:** Universal AST Adapter layer decoupling the mutation engine from Babel/JSX. Canonical `FlintNode` schema. `LinterPlugin` interface accepting any rule set. `PluginRegistry` in `flint-manifest.json` mapping domain profiles (`clinical_samd`, `iac_soc2`, `legal_contract`) to parser/linter configs. Two reference adapters: JSON-schema + plain-text clause parser.

**Why this priority:** The investor brief explicitly lists IaC, healthcare, government, fintech as expansion domains. V.3 is the architectural prerequisite for all of them. Without it, scaling to non-web domains requires core engine reconstruction. This is a 3-4 sprint effort with no short-term revenue but extremely high long-term TAM impact. P2 because the current JSX surface is the primary market — but delay is risky. Each sprint spent without starting V.3 is a sprint of accumulated JSX coupling that will cost more to abstract later.

**Competitive moat:** "One governance engine, any domain" is a platform story. No competitor is near this capability.

---

### V.4 — Multi-Agent Epistemic Consensus Gate

| Field | Value |
|-------|-------|
| **ID** | V.4 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | V.1 (Risk Scoring), V.2-mp (ONLINE) |
| **Status** | ONLINE |

**What:** For mutations scoring Amber or Red on MRS: route to stateless secondary agent for independent safety evaluation. Secondary agent receives only current AST snapshot + proposed mutation, no primary agent reasoning history. Log both verdicts and disagreements to Provenance Ledger. Configurable per domain profile.

**Why this priority:** Multi-agent epistemic voting is an emerging hallucination-control technique that Flint's single-orchestrator architecture doesn't yet use. The primary orchestrator can reason itself into approving mutation sequences that individually pass linting but collectively produce illegal states. A stateless second opinion detects this error class. Hospitals and regulated industries will require this pattern. Depends on V.1 being fully wired.

---

### GOV.4 — Statistical Anomaly Detection

| Field | Value |
|-------|-------|
| **ID** | GOV.4 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | INFRA.1 (ONLINE), GOV.3, V.1-rs (ONLINE) |
| **Status** | ONLINE |

**What:** Baseline statistics from historical mutations (average mutations per session, typical override frequency, normal violation distribution). Anomaly flagging at 3σ threshold: sudden override spikes, unusual violation patterns, drift in Token Integrity Ratio. Surface as ambient amber alert in Glass Health tab. Weekly/monthly trend reports.

**Why this priority:** "No other design tool does pattern-based governance" — this is the quote from FLINT-FUTURE-SPRINTS.md and it's correct. Anomaly detection transforms Flint from reactive (finds violations when asked) to proactive (notices when behavior is abnormal). This is a genuine architectural moat. P2 because it requires substantial historical data to be meaningful — must wait for GOV.3 to generate session history first.

---

### EXP.5 — Design System Version Migration

| Field | Value |
|-------|-------|
| **ID** | EXP.5 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | EXP.3 (class transformer pattern) |
| **Status** | ONLINE |

**What:** `flint migrate-ds <glob> --from tokens-v4.json --to tokens-v5.json` — token diff engine maps old tokens to new ones, surgically updates consuming code. Handles renamed, removed, changed, and new tokens. Reuses EXP.3 class transformer infrastructure.

**Why this priority:** Every enterprise with a design system upgrades every 12-18 months. Flint's deterministic token remapping ("These 47 files reference `color.brand-blue` which was renamed to `color.primary`") is the enterprise alternative to manual search-and-replace. Reuses EXP.3 infrastructure so marginal effort is low. Strong ROI for the effort.

---

### AGV.4 — Agent Trust Tiers

| Field | Value |
|-------|-------|
| **ID** | AGV.4 |
| **Priority** | P3 |
| **Effort** | L |
| **Dependencies** | AGV.1 (Per-Agent ACL), AGV.2 (Agent Risk Dashboard), GOV.2 (Override Telemetry) |
| **Status** | ONLINE |

**What:** New agents start in a "Restricted" tier: read-only tools only (audit, query, status), no mutation capabilities. Agents earn elevation to "Standard" tier after N sessions with zero Red-tier mutations and zero override events. "Trusted" tier requires explicit human elevation. Tier stored in `flint.db` per agent_id. Trust resets on suspicious activity (AGV.3 escalation trigger).

**Why this priority:** Trust tiers complete the Agent-Aware Governance arc (AGV.1-4). They transform Flint's agent governance from static permissions (AGV.1) to dynamic trust that responds to observed behavior. This is the "earn permissions over time" model from the brief. P3 because AGV.1-3 deliver the core security value; AGV.4 is the behavioral sophistication layer that requires AGV.2's dashboard and AGV.3's escalation rules to be meaningful.

**Competitive moat:** No design tool or MCP server has agent trust tiers. This is Flint as a genuine security infrastructure layer for multi-agent environments.

---

## Sprint 7 — Enterprise Sync (Weeks 18–26)

Bidirectional Figma token sync. This is the longest sprint window and the most complex feature cluster. The MCP engine work ships first; Glass UI panels are additive afterward.

---

### SYNC.1 — Database Schema + OAuth + Figma API Service

| Field | Value |
|-------|-------|
| **ID** | SYNC.1 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | EXP.7 (Cross-Platform Token Sync, for DTCG format maturity) |
| **Status** | ONLINE |

**What:** Four new tables in `flint.db`: `figma_connections`, `token_source`, `sync_history`, `pending_conflicts`. OAuth 2.0 PKCE flow via `flint_figma_connect` MCP tool. `figmaApiService.ts` wrapping Figma Variables API with exponential backoff. MCP resource: `flint://figma-connection`.

**Why this priority:** Foundational for all SYNC phases. The Figma MCP server (launched March 2026) created a competitive urgency here — Figma is moving to be the design-to-code source of truth. Flint's bidirectional sync positions it as the governance layer between Figma and production code, not a competitor to Figma. Without SYNC, Flint is a downstream consumer of Figma data. With SYNC, Flint is the authoritative governance layer over the full Figma ↔ code token lifecycle.

---

### SYNC.2 — Three-Way Diff Sync Engine

| Field | Value |
|-------|-------|
| **ID** | SYNC.2 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | SYNC.1 |
| **Status** | ONLINE |

**What:** `tokenSyncEngine.ts` three-way diff: Figma Variables vs. `token_source` last-sync state vs. `design_tokens` table. Seven diff categories with appropriate auto-actions. Webhook extension. MCP tools: `flint_sync_pull`, `flint_sync_push`, `flint_resolve_conflict`, `flint_resolve_all`.

---

### SYNC.3 — MithrilLinter SYNC Violation Types

| Field | Value |
|-------|-------|
| **ID** | SYNC.3 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | SYNC.2 |
| **Status** | ONLINE |

**What:** Two new violation types: `SYNC-001` (Token Out of Sync, ΔE > 2.0 divergence from Figma source) and `SYNC-002` (Orphaned Token, no Figma mapping). Include in Token Integrity Ratio.

---

### SYNC.4 — Governance Reporting + Error Resilience + CI/CD

| Field | Value |
|-------|-------|
| **ID** | SYNC.4 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | SYNC.2, SYNC.3 |
| **Status** | ONLINE |

**What:** `flint sync --check` CI command. Figma API rate-limit handling. Offline queue with retry. Process-restart conflict recovery. Sync history export (JSON/CSV). Include sync health in `flint://dashboard`.

---

### EXP.7 — Cross-Platform Token Sync

| Field | Value |
|-------|-------|
| **ID** | EXP.7 |
| **Priority** | P3 |
| **Effort** | XL |
| **Dependencies** | EXP.3, EXP.5 (token system maturity) |
| **Status** | ONLINE |

**What:** DTCG tokens → 5 platform outputs: Tailwind (web), CSS custom properties, React Native StyleSheet, Swift UIColor, Kotlin Color. Platform-specific parsers. Cross-platform audit. Sync report.

**Why this priority:** P3 because the current market is web-first. EXP.7 is a TAM expansion, not a core market capture. Cross-platform support is a powerful enterprise story but requires EXP.3 and EXP.5 infrastructure first. Placed last in the expansion sequence intentionally.

---

## Sprint 8 — Next Wave

Sprints 1–7 are fully ONLINE. Sprint 8 defines the next wave of work. All items below are in BACKLOG status — defined but not yet specced to implementation depth.

---

### Beta Distribution Infrastructure

| Field | Value |
|-------|-------|
| **ID** | BETA.1 |
| **Priority** | P0 |
| **Effort** | L |
| **Dependencies** | None |
| **Status** | BACKLOG |

**What:** electron-builder production config, self-expiring `.dmg` builds for evaluations, in-app feedback widget (embedded form, no external service dependency), update channel wired to a static file host. Covers: code signing config (requires Apple Developer Program enrollment), notarization, auto-updater via `electron-updater`.

**Why this priority:** Every other Sprint 8 item depends on having real users. Without a distribution mechanism, Flint has no feedback loop and no trial pipeline. The signing and notarization infrastructure is the prerequisite for any Mac App Store or direct-download distribution. This is the gating constraint on user acquisition.

**Dependencies note:** Requires Apple Developer Program enrollment and Azure Code Signing certificate for Windows. Those are business/credential decisions, not engineering decisions. Engineering can build the config and stub the signing step before credentials are available.

**Journey impact:** Journey 1 (New User / First Install) — currently has no happy path for users who did not build Flint from source.

---

### WCAG 2.2 Rule Pack

| Field | Value |
|-------|-------|
| **ID** | EXP.8 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | EXP.6a-ext (ONLINE — 50 WCAG 2.1 AA rules, A11yLinter architecture) |
| **Status** | BACKLOG |

**What:** 8 new success criteria from WCAG 2.2: Focus Appearance (2.4.11, 2.4.12), Dragging Movements (2.5.7), Target Size Minimum (2.5.8), Consistent Help (3.2.6), Redundant Entry (3.3.7), Accessible Authentication (3.3.8, 3.3.9). Each rule needs: detector, auto-fix where applicable, explanation string, SARIF rule entry. Fills the "coming soon" slot in the Rule Catalog (ERM) and surfaces in the WCAG 2.2 compliance profile.

**Why this priority:** WCAG 2.2 became a W3C Recommendation in October 2023. EN 301 549 (the EU accessibility standard) references WCAG 2.2 as of 2024. The EU Accessibility Act enforcement timeline puts WCAG 2.2 conformance on the procurement checklist for public-sector buyers. Flint's current WCAG 2.1 AA coverage misses 8 criteria that are already legally relevant in the EU. The A11yLinter architecture (9 rule modules, 50 rules) makes adding a bounded new rule pack low-risk.

**Journey impact:** Journey 3 (Governance Audit Loop) — adds 8 new audit findings that currently produce no output despite being legally required for EU contracts.

---

### COGA Cognitive Accessibility Pack

| Field | Value |
|-------|-------|
| **ID** | EXP.9 |
| **Priority** | P2 |
| **Effort** | M |
| **Dependencies** | EXP.8 (WCAG 2.2 rule pack, for rule authoring patterns) |
| **Status** | BACKLOG |

**What:** 8 cognitive accessibility patterns from the W3C COGA (Cognitive and Learning Disabilities Accessibility) Task Force guidance: clear language (reading level detection), predictable navigation (consistent menu placement), error prevention (confirmation dialogs for destructive actions), redundant cues (icons + text labels), timeouts (warning before session expiry), distracting content (autoplay detection), complex authentication, memory-dependent tasks. New rule domain `coga` in the ERM registry.

**Why this priority:** WCAG 2.1/2.2 has limited COGA coverage. The W3C COGA guidance is the reference standard for cognitive accessibility and is increasingly cited in US federal procurement. Adding COGA as a named domain positions Flint in the cognitive accessibility market, which no design governance tool currently addresses. P2 because the legal mandate is softer than WCAG 2.2 — COGA is guidance, not a normative standard — but enterprise buyers in healthcare and government actively request it.

**New domain note:** This requires adding `coga` as a new rule domain in `rulePackRegistry.ts` and updating the `ComplianceProfileSelector` in Glass to expose the COGA profile.

---

### GPX Marketplace (Registry Resolution)

| Field | Value |
|-------|-------|
| **ID** | GPX.3 |
| **Priority** | P1 |
| **Effort** | L |
| **Dependencies** | GPX.1 (ONLINE — pack export), GPX.2 (ONLINE — pack import), registryResolver.ts (ONLINE — org/pack-name extends resolution) |
| **Status** | BACKLOG |

**What:** A hosted registry where governance packs can be published, discovered, and installed by pack name. `registryResolver.ts` (ONLINE) already resolves `org/pack-name` extends refs — GPX.3 provides the network backend that resolver points at. Scope: a static JSON registry file (initially), a `flint pack search <query>` CLI command, a `flint pack install <org/name>` command, and a browsable panel in Glass. Pack publishing is authenticated (API key per org); pack discovery is public.

**Why this priority:** GPX.1 and GPX.2 let teams share governance packs point-to-point. GPX.3 makes packs discoverable without direct coordination — the difference between emailing a zip file and npm install. The platform moat story: Flint governs AI-generated UI, and the governance rules live in a distributed, community-maintained registry. Competitors cannot replicate this network effect without building the same ecosystem. The `registryResolver.ts` infrastructure already exists and is waiting for a registry URL to resolve against.

**Effort note:** L effort assumes a static-hosted JSON registry (no server-side code). A dynamic registry with search indexing moves this to XL.

---

### Flint Autopilot (Nightly Governance)

| Field | Value |
|-------|-------|
| **ID** | AUTO.1 |
| **Priority** | P2 |
| **Effort** | XL |
| **Dependencies** | DBOM.1 (ONLINE), GOV.4 anomaly detection (ONLINE), EXP.2 debt report (ONLINE), BETA.1 (distribution — notifications need a running app) |
| **Status** | BACKLOG |

**What:** A scheduled governance scan that runs on a configurable cadence (nightly by default). Each run: generates a DBOM snapshot, diffs against the previous snapshot, risk-scores any regressions using MRS, flags anomalies using GOV.4's 3σ detector, and produces a digest. Digest delivery: in-app notification on next Glass open, optional email (configurable SMTP), optional Slack webhook. Escalation path: if a regression scores Red, it creates a governance annotation on the offending component.

**Why this priority:** The "set it and forget it" enterprise story. Enterprise buyers do not want to manually run `flint audit` — they want Flint to tell them when something changed. All the underlying infrastructure (DBOM, anomaly detection, debt report, annotation engine) is ONLINE. Autopilot is the scheduled orchestration layer on top of existing capabilities. P2 because it requires BETA.1 distribution to be meaningful — notifications sent to a desktop app the user never opens are useless. XL effort due to scheduling, state management across runs, and notification delivery.

**Deferred decision resolved:** This item was previously listed under Deferred Decisions as "Flint Autopilot / OODA Loop Governance." The dependencies (DBOM.1, GOV.4) are now ONLINE, making it implementable. Promoting to Sprint 8 BACKLOG.

---

## Agent-Aware Governance Track (AGV)

This track applies Flint's existing governance model to the AI agents themselves. Flint governs what agents can do to code — it does not control agent lifecycle, orchestration, or model selection.

**Clear scope boundary:** AGV is NOT an agent orchestrator. Claude Code, Cursor, and similar tools own agent lifecycle. AGV governs the MCP permission surface and tracks risk/behavior after agents connect. AGV never starts, stops, or directs agents — it only controls what tools they can call and what happens when they misbehave.

| Phase | Priority | Effort | Status | Key dependency |
|-------|----------|--------|--------|----------------|
| AGV.1 Per-agent tool ACL | P1 | M | ONLINE | SEC.3 (ONLINE) |
| AGV.2 Agent risk dashboard | P1 | M | ONLINE | V.1-rs, V.2-mp |
| AGV.3 Auto-escalation rules | P2 | M | ONLINE | AGV.2, V.1 |
| AGV.4 Agent trust tiers | P3 | L | ONLINE | AGV.1, AGV.2, AGV.3 |

AGV.1 and AGV.2 are detailed in Sprint 3 above. AGV.3 and AGV.4 are detailed in Sprint 6.

---

## Consolidated Sprint Plan

| Sprint | Weeks | Items | Theme | Demo-able? |
|--------|-------|-------|-------|-----------|
| Sprint 1 | 1–2 | SEC.4, CX.1, CX.2 wire-up, ING.3, SEC.5, SEC.6 | Security + Chat Quality | Yes — readable tool responses |
| Sprint 2 | 2–4 | V.1-rs wire-up, GOV.3, CX.3, GOV.1, GOV.2, U.3 | Foundation + Compliance | Yes — audit reports, immersive canvas |
| Sprint 3 | 4–6 | V.1 (full), AGV.1, AGV.2, MDA.1 | Risk Scoring + Agent Governance | Yes — MRS demo, agent dashboard |
| Sprint 4 | 6–8 | U.4, W.1, W.3 | Glass Completion (JTBD 9.0) | Yes — bidirectional Glass |
| Sprint 5 | 8–12 | EXP.3, EXP.4, POL.1, IDE.1, ONBOARD.1 | Market Expansion | Yes — migration, multi-brand, first-run wizard |
| Sprint 6 | 12–18 | EXP.6a-ext, DBOM.1, V.3, V.4, GOV.4, EXP.5, AGV.3 | Platform Moat | Yes — compliance, domain abstraction |
| Sprint 7 | 18–26 | SYNC.1–4, EXP.7, AGV.4 | Enterprise Sync | Yes — bidirectional Figma sync |
| Sprint 8 | 26+ | BETA.1, EXP.8, EXP.9, GPX.3, AUTO.1 | Next Wave | Yes — distribution, WCAG 2.2, marketplace |

**Parallelization opportunities within each sprint:**
- Sprint 1: SEC.4 + CX.1 + ING.3 are independent, can run simultaneously
- Sprint 2: GOV.1 + GOV.2 + U.3 are independent; GOV.3 depends on INFRA.2 (ONLINE)
- Sprint 5: EXP.3 + POL.1 are independent; IDE.1 can start in parallel
- Sprint 8: BETA.1 + EXP.8 are independent; GPX.3 depends on BETA.1 for meaningful discovery

---

## Project Initiation Track — Forge (FORGE.1–4)

> Full strategy: `docs/strategy/PROJECT-INITIATION-STRATEGY.md`
> Implementation plan: `docs/strategy/PROJECT-INITIATION-PLAN.md`
> Citadel name: **Forge** — where new projects are ignited, their environment detected, and governance activated

**Problem:** 8 initiation channels on one screen = paralysis. The engine has 54 tools but none activate at project open. Gap between "opened" and "governed" is entirely manual. "New Project" creates a blank screen in an observability-only tool.

**Moat:** "The violation IS the first value." No other tool can auto-audit a codebase and offer one-click deterministic fixes in under 10 seconds. Flint's unique advantage is showing real problems on real code before the user asks.

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

## Token Experience Track — Mint (MINT.1–4)

> Full strategy: `docs/strategy/TOKEN-EXPERIENCE-STRATEGY.md`
> Implementation plan: `docs/strategy/TOKEN-IMPLEMENTATION-PLAN.md`
> Citadel name: **Mint** — where tokens are forged, verified, and certified for circulation

**Problem:** The Tokens tab is a flat CRUD list. 80% of the data needed for a brilliant token experience already exists in SQLite/MCP but isn't surfaced in Glass. Meanwhile, inline editing lets designers silently mutate governance standards with no provenance.

**Moat:** No competitor (Figma Variables, Tokens Studio, Supernova, Specify) has AST-level code awareness. Only Flint can show usage counts, dead tokens, drift with ΔE, and impact preview — because only Flint reads the actual code.

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

## Counsel Track — Governance Experience Redesign

*Source: `docs/strategy/GOVERNANCE-EXPERIENCE-STRATEGY.md` + `GOVERNANCE-IMPLEMENTATION-PLAN.md`*
*Citadel name:* **Counsel** — *Where governance advises rather than judges.*

Full strategy: `docs/strategy/GOVERNANCE-EXPERIENCE-STRATEGY.md`
Full plan: `docs/strategy/GOVERNANCE-IMPLEMENTATION-PLAN.md`

### COUNSEL.1 — Triage + Framing Foundation

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.1.1 | Category Split Header (Design System / A11y / Token Sync counts above score ring) | P0 | S | — | PROPOSED |
| COUNSEL.1.2 | New-Code-First Default (Delta Mode auto-enable for legacy projects with 10+ violations) | P0 | M | COUNSEL.1.1 | PROPOSED |
| COUNSEL.1.3 | Health Score Formula Unification (GovernanceDashboard ↔ flint_debt_report parity) | P0 | M | — | PROPOSED |
| COUNSEL.1.4 | Violation Card Fix Co-location (inline diff preview before committing mutation) | P1 | M | — | PROPOSED |
| COUNSEL.1.5 | Auto-Fixable Label on Every Violation Card | P1 | S | — | PROPOSED |
| COUNSEL.1.6 | A11y Batch Fix Button (extends existing Mithril batch pattern) | P1 | M | COUNSEL.1.5 | PROPOSED |
| COUNSEL.1.7 | 26 Accessibility Fixes in Governance UI (self-audit remediation) | P0 | M | — | PROPOSED |

### COUNSEL.2 — Deferral + Workload Voice

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.2.1 | Defer Button in Violation List + ExportModal (surfaces existing flint_defer_violation MCP tool) | P0 | M | COUNSEL.1 | PROPOSED |
| COUNSEL.2.2 | "Flagged for Review" Tier (middle state: not active, not ignored, score-exempt) | P1 | M | COUNSEL.2.1 | PROPOSED |
| COUNSEL.2.3 | Snooze with Auto-Resurface (time-bound expiry + Stamp-recorded deferral) | P1 | L | COUNSEL.2.1 | PROPOSED |
| COUNSEL.2.4 | Effort Framing ("About 2 minutes with Autopilot" replaces grade as first beat) | P1 | S | COUNSEL.1.3 | PROPOSED |
| COUNSEL.2.5 | Session Fix Progress Indicator ("3 of 7 violations fixed this session") | P2 | S | — | PROPOSED |

### COUNSEL.3 — Intelligence Surface

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.3.1 | "Undo to Last Clean State" (Stamp + Rewind integration, session-new violations) | P1 | L | COUNSEL.2 | PROPOSED |
| COUNSEL.3.2 | Provenance Chip in Violation Cards ("Introduced by Claude · 3 mutations ago") | P1 | M | COUNSEL.3.1 | PROPOSED |
| COUNSEL.3.3 | Anomaly Alert Banner (Flare 3-sigma anomalies surfaced in GovernanceDashboard) | P1 | M | — | PROPOSED |
| COUNSEL.3.4 | Risk Trend Badge on Violation Cards (Sentry risk tier + contributing factor label) | P2 | M | COUNSEL.3.2 | PROPOSED |

### COUNSEL.4 — Brilliant Moments

| ID | Task | Priority | Effort | Dependencies | Status |
|----|------|----------|--------|-------------|--------|
| COUNSEL.4.1 | Token Change Impact Preview (pre-sync violation forecast via AST + token registry) | P1 | L | COUNSEL.3 | PROPOSED |
| COUNSEL.4.2 | Compliance Trajectory Chart (7-day rolling health score sparkline) | P2 | M | COUNSEL.1.3 | PROPOSED |
| COUNSEL.4.3 | Governance Navigation Pathway (Dashboard → Panel → PolicySettings clear chain) | P1 | M | COUNSEL.1 | PROPOSED |
| COUNSEL.4.4 | Zero-Violation Generation Signal (celebrate clean component on first audit) | P2 | S | — | PROPOSED |
| COUNSEL.4.5 | Audit Log Tab (provenance + override + anomaly history, filterable, exportable) | P2 | L | COUNSEL.3 | PROPOSED |

---

## Do NOT Build

These items might seem appealing but are outside Flint's scope, duplicate existing tools, or violate the architectural identity.

**Agent orchestration or lifecycle management.** Claude Code, Cursor, and Copilot own this. Flint governs what agents can do to code — it never starts, stops, schedules, or directs agents. Adding orchestration would put Flint in competition with every IDE vendor simultaneously. AGV is governance of agents, not orchestration of agents. This is a critical distinction.

**Chat UI in Flint Glass.** Explicitly prohibited in CLAUDE.md. The host IDE (Claude Code, Cursor, VS Code) owns the conversational interface. Every sprint where we have discussed adding a chat panel to Glass has been rejected correctly. The `AgentChatPanel` component was removed in JTBD Wave 1 for this reason.

**Monaco editor in Flint Glass.** Glass is a visual observability layer. Code editing belongs in the host IDE. The Glass Pivot (FLINT-GLASS-PIVOT.md) removed the editor panel specifically to recover canvas real estate. Re-adding a code editor would undo that architectural decision and blur Glass's identity.

**File explorer panel in Flint Glass.** Same reasoning as Monaco. The host IDE handles file navigation. Glass shows the layer tree — a structural view of the active AST, not a filesystem browser.

**Terminal panel in Flint Glass.** U.3 removes what remains of this. A terminal in Glass creates ambiguity about which shell context the user is in. Host IDE owns the terminal.

**Fine-tuning or model training.** Flint assumes model hallucination and constructs deterministic containment. Fine-tuning would shift Flint into ML infrastructure, which is a completely different product and team.

**General-purpose code quality (ESLint replacement).** Flint's governance is specific: design tokens, accessibility, brand compliance, and AST integrity. It does not replace ESLint, SonarQube, or TypeScript for general code quality. Scope creep here loses the focused narrative.

**Figma plugin canvas editing.** The Figma plugin sends payloads to Flint for governance — it is not a design tool or a canvas editor extension. The Figma MCP server (launched March 2026) already owns design layer generation from VS Code. Flint is the governance layer over Figma outputs, not a Figma feature.

**Cloud-hosted Flint SaaS (until local-first is complete).** Flint's Commandment 4 (Local-First Only) is not just a technical choice — it is a security and trust choice. Cloud Flint requires resolving data residency, SOC 2 Type II certification, and multi-tenant isolation before any code leaves a user's machine. This is a business decision, not a feature. Until it is explicitly decided, all new features default to local-first. Phase C.1 (PowerSync) is the exception, and it has already been architected to respect local-first constraints.

**Automated Fix PRs (GitHub PR opening).** This is on the Snyk Competitive Analysis (§3.6) as a future item but NOT in this backlog. Fix PRs require SCM authentication, branch management, and PR template systems that are significant scope. The current Export Gate + `flint_fix` covers the local fix case. Fix PRs should be revisited after the CI/CD gate (EXP.1, ONLINE) has proven adoption.

---

## Deferred Decisions

These items require more information, user feedback, or a business decision before the implementation approach can be committed.

**Org-Wide Governance Dashboard.** The investor brief (§3.5) identifies this as a high-value enterprise story — a VP of Design wants a fleet-wide compliance metric across all repos. The implementation options are: (a) local aggregation from `flint-registry.db` (all projects on one machine) or (b) cloud backend (Phase C.1 PowerSync). Option A is achievable without cloud infrastructure but is limited to a single developer's machine. Option B requires Cloud PowerSync to be provisioned. Decision deferred until C.1 scope is committed.

**Cloud PowerSync (Phase C.1).** The PowerSync backend needs a provisioned URL before wiring can proceed. This is a business/infrastructure decision, not an engineering decision. The `@powersync/node` integration is architecturally planned. Do not begin implementation until the URL is confirmed.

**Automated Fix PRs.** Deferred per the Do NOT Build section. Revisit after EXP.1 CI gate has demonstrated adoption and there is clear user demand for automated PR opening.

**VS Code / Cursor Extension packaging.** IDE.1 is ONLINE, but the distribution model remains unresolved: publish to VS Code Marketplace under Flint branding, or integrate into the Claude Code MCP auto-discovery flow. The latter is lower friction but less visible. Decision needed before marketplace submission begins. Note: ONBOARD.1 (First-Launch Setup Wizard) is the primary distribution UX for Glass users; IDE.1 marketplace packaging is a secondary channel for IDE-only users.

**Per-agent identity protocol.** AGV.1-4 depend on `agent_id` being a reliable identifier in MCP session metadata. The MCP spec does not currently standardize agent identity. Decision needed: do we use a custom `x-flint-agent-id` header convention, the `clientInfo.name` field from the MCP `initialize` request, or something else? This affects AGV.1 database schema.

**EXP.6 full WCAG 2.1 AA (50 rules) scope vs. WCAG 3.0 (APCA).** The EXP.6 plan targets ~50 rules for full WCAG 2.1 AA coverage. APCA contrast is included for WCAG 3.0 readiness. However, WCAG 3.0 is still in draft. The APCA implementation adds effort; the benefit depends on how quickly the target market moves to WCAG 3.0. Decision: ship APCA alongside WCAG 2.1 AA completion, or defer APCA to a separate sprint? Recommend shipping APCA with EXP.6a-ext for demo differentiation.

**GPX Marketplace hosting model.** GPX.3 can ship as a static JSON file (low cost, low ops burden) or a dynamic API (search indexing, version resolution, auth). Static is faster to ship and sufficient for early adoption. Dynamic is required for community scale. Decision needed before GPX.3 implementation begins.

---

## Backlog Metrics Summary

| Priority | Count | Status breakdown |
|----------|:-----:|-----------------|
| P0 | 1 | BETA.1 (Sprint 8) |
| P1 | 2 | EXP.8, GPX.3 (Sprint 8) |
| P2 | 2 | EXP.9, AUTO.1 (Sprint 8) |
| P3 | 0 | — |
| **Total active** | **5** | All in Sprint 8 — Sprints 1–7 fully ONLINE |

**Sprints 1–7 status:** All 34 items originally tracked across Sprints 1–7 are ONLINE. The backlog above preserves their full specs for reference and dependency tracing.

**Sprint 8 items:** 5 new items added 2026-03-27. None are blocked — all dependencies are ONLINE.

**Test baseline at time of update:** MCP: 3,612/3,612 | Glass: 1,322/1,322 | Core: 1,146/1,146 | CI: 56/56 — TSC 0 errors
