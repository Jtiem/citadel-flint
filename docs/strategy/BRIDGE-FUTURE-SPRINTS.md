# Bridge MCP — Future Sprints Roadmap

**Date:** 2026-03-13
**Version:** 1.0
**Status:** PLANNING
**Baseline:** 409/409 tests passing · 16 test files · EXP.1 DONE · V.1-4 + GOV.1-4 queued

---

## Executive Summary

This document consolidates three strategic inputs into a single sequenced roadmap:

1. **EXP.1-7** — Horizontal expansion (CI/CD gate → cross-platform sync)
2. **V.1-V.4** — Vertical architectural deepening (risk scoring → multi-agent consensus)
3. **GOV.1-GOV.4** — Governance hardening (rule provenance → statistical anomaly detection)

EXP.1 is complete. The remaining 16 workstreams are sequenced below by dependency, shared infrastructure, and ROI.

---

## Completed Work

| ID | Name | Status | Tests Added |
|----|------|--------|-------------|
| EXP.1 | CI/CD Design Governance Gate | **DONE** | +62 (347→409) |

Deliverables: `bridge audit <glob>` CLI, SARIF 2.1.0 formatter, PR comment formatter, GitHub Action, CI config schema, exit code semantics.

---

## Shared Infrastructure (Build First)

These components serve multiple downstream phases. Build them once, reuse everywhere.

| Component | ID | Serves | Sprint | Effort |
|-----------|----|--------|--------|--------|
| `governance_events` SQLite table | INFRA.1 | GOV.1-4, V.2 | S1 | 1-2 days |
| `mutations_ledger` SQLite table | INFRA.2 | V.2, V.1, V.4, GOV.3 | S1 | 1-2 days |
| **Glass Immersive Canvas** (Pivot) | U.3 | Phase 7.0.C/D | S1 | 3-4 days |
| Dashboard UI shell (headless MCP resource) | INFRA.3 | GOV.2-4, EXP.2 | S2 | 2-3 days |
| Export/Report generator (PDF/JSON/HTML) | INFRA.4 | GOV.1, EXP.2, EXP.6 | S2 | 2-3 days |
| Session ledger schema | INFRA.5 | GOV.3-4 | S3 | 1-2 days |

**Location:** All new tables in existing `bridge-registry.db`. No new databases.

---

## Sprint Sequencing

### Sprint Window 1 (Week 1-3): Foundation Layer

#### GOV.1 — Rule Provenance
**Effort:** 1-2 weeks · **Priority:** HIGHEST ROI — mostly schema + decoration

Add provenance metadata to every violation emitted by MithrilLinter and A11yLinter:

```
ruleId: "MITHRIL-COL-001"
sourceAuthority: "WCAG 2.1 AA" | "SOC2" | "FDA SaMD"
regulatoryReference: "§ 1.4.3 Contrast (Minimum)"
lastUpdated: timestamp
```

**Implementation:**
- Extend `Violation` type with `provenance` object
- Store rule provenance in `bridge-registry.db` (no new database)
- Export Gate modal: add "Compliance Summary" section showing rule sources
- Glass Observability HUDs: show regulatory citation on selection/hover
- New "Audit Report" export format (PDF/JSON) for compliance officers

**Why it's cheap:** Decorating existing violations with metadata — no linting logic changes.

**Files:** `bridge-mcp/src/core/violations/types.ts`, `bridge-mcp/src/core/formatters.ts`, new `bridge-mcp/src/core/compliance/provenance.ts`

---

#### V.2 — Mutation Provenance & Citation Trail
**Effort:** 1-2 sprints · **Priority:** CRITICAL — foundational for V.1 and V.4

Implement a Provenance Ledger recording, for every committed mutation:
- Source intent (SDI payload, user prompt, agent reasoning trace)
- Registry artifact grounding (component ID, token ID)
- Linter result and risk score at approval time
- Approver identity (human or auto-approved)

**Implementation:**
- `mutations_ledger` table in `bridge-registry.db`: `id`, `timestamp`, `file_path`, `node_id`, `operation_type`, `source_intent_hash`, `registry_artifact_id`, `mrs_score`, `approved_by`, `justification`
- Update `FileTransactionManager` to write provenance records on every atomic commit
- `bridge://provenance` paginated MCP resource
- `bridge_query_provenance` MCP tool for forensic lookups by node_id or time range

**Acceptance:** Every committed mutation has provenance record; queryable within 200ms.

**Files:** `bridge-mcp/src/core/provenance/ledger.ts`, `bridge-mcp/src/core/provenance/resources.ts`, schema migration in `bridge-registry.db`

---

#### GOV.2 — Override Telemetry
**Effort:** 1 week · **Priority:** HIGH — critical for governance credibility

Capture every `data-bridge-override` usage:
- Which node was bypassed
- What rule was skipped
- Who (session/user) triggered it
- Timestamp and project context

**Implementation:**
- Hook into MithrilLinter's existing override detection
- Write events to `override_events` table in `bridge-registry.db`
- Surface in Glass HUD: "Overrides (N)" badge in status bar
- Dashboard view: list all overrides, filter by rule/date/component

**The governance claim:** "Every bypass is logged. We can show auditors exactly when and why rules were suspended."

**Files:** `bridge-mcp/src/core/governance/overrideTelemetry.ts`, schema in `bridge-registry.db`

---

### Sprint Window 2 (Week 3-5): Risk + Reporting

#### EXP.2 — Design Debt Quantification Report
**Effort:** 1 sprint · **Priority:** HIGH · **Depends on:** EXP.1 (DONE)

`bridge report <glob>` scans entire codebase → design debt report with Health Score (0-100).

**Implementation:**
- Report aggregator: scan glob, collect violations, aggregate by file/severity/category/rule
- Health Score: `100 - (criticals × 10 + ambers × 3 + warnings × 1)` clamped 0-100
- Output formats: JSON, Markdown, HTML dashboard (single-file, Tailwind CDN)
- Trend tracking: `.bridge/debt-history.json` with `--track` flag
- `bridge_debt_report` MCP tool

**Files:** `bridge-mcp/src/core/violations/reporter.ts`, `bridge-mcp/src/core/violations/scorer.ts`, `bridge-mcp/src/core/violations/history.ts`

---

#### V.1 — Probabilistic Risk Scoring
**Effort:** 2-3 sprints · **Priority:** CRITICAL · **Depends on:** V.2

Mutation Risk Score (MRS) 0.0-1.0 accompanying every proposed AST mutation:
- Linter violation severity weighting
- AST blast radius — quantity of downstream nodes affected
- Registry confidence — component familiarity status
- Deviation from baseline state

**Three tiers:**
- **Green (0.0-0.3):** auto-approve eligible
- **Amber (0.31-0.69):** requires human review
- **Red (0.7-1.0):** requires senior sign-off with mandatory justification logging

**Implementation:**
- `RiskCompositor` service aggregating MithrilLinter, A11yLinter, and new `BlastRadiusAnalyzer`
- Extend `LinterResult` schema with `riskScore` (float) and `riskFactors` (string[])
- Surface score in MCP `tool_result` for risk-tiered responses

**Acceptance:** 100% of mutation approvals carry MRS; Amber/Red tiers trigger documented human review.

**Files:** `bridge-mcp/src/core/risk-compositor.ts`, `bridge-mcp/src/core/blast-radius.ts`

---

### Sprint Window 3 (Week 5-8): Validation + Migration

#### GOV.3 — Session-Level Mutation Validation
**Effort:** 1-2 weeks · **Priority:** HIGH — closes real error class

**The problem:** A session with 20 mutations might produce internally inconsistent state.

**Validation pass after each batch mutation:**
- All `data-bridge-id` values unique
- No orphaned nodes (referenced but not present)
- Import statements match actual usage

**Implementation:**
- Wire into existing `applyMutationBatch` in ASTService.ts (already returns inversions — add validation pass)
- Store session mutation history as ledger in `bridge-registry.db`
- Validation failures surface as new error category in Mithril Safety Score

**Files:** `bridge-mcp/src/core/governance/sessionValidator.ts`, integration in `bridge-mcp/src/core/ast-modifier.ts`

---

#### EXP.3 — Tailwind v3→v4 Migration
**Effort:** 2 sprints · **Priority:** HIGH — timely market opportunity

`bridge migrate-tw <glob> --from 3 --to 4` — AST-level class transformation (not regex).

**Implementation:**
- Migration rule set: `bg-opacity-X` → `bg-color/X`, `flex-grow` → `grow`, etc.
- Babel visitor: traverse JSX `className`, apply rules, preserve non-Tailwind classes
- Config migrator: `tailwind.config.js` → CSS-based config (v4 pattern)
- Post-migration audit: run `audit_ui_component` to verify zero token violations

**Files:** `bridge-mcp/src/core/migrations/tailwind-v3-to-v4.ts`, `bridge-mcp/src/core/migrations/classTransformer.ts`, `bridge-mcp/src/core/migrations/configMigrator.ts`

---

### Sprint Window 4 (Week 8-11): Domain Abstraction + Consensus

#### V.3 — Domain-Agnostic AST Abstraction
**Effort:** 3-4 sprints · **Priority:** HIGH · **Can parallel with V.1/V.2**

Universal AST Adapter layer decoupling the mutation engine from Babel/JSX.

**Implementation:**
- `BridgeNode` canonical schema (syntax-neutral intermediate representation)
- `LinterPlugin` interface accepting any rule set
- `PluginRegistry` in `bridge-manifest.json` mapping domain profiles to parser/linter configs
- Two reference adapters: JSON-schema adapter + plain-text clause parser

**Acceptance:** New domain adapters register without modifying core engine files; two non-JSX adapters pass integration tests.

**Files:** `bridge-mcp/src/core/universal-ast.ts`, `bridge-mcp/src/core/plugin-registry.ts`

---

#### V.4 — Multi-Agent Epistemic Consensus
**Effort:** 2-3 sprints · **Priority:** MEDIUM · **Depends on:** V.1, V.2

For mutations scoring Amber/Red on MRS: route to stateless secondary agent for independent safety evaluation.

**Implementation:**
- `ConsensusGate` module — any mutation with MRS >= 0.31 triggers secondary evaluation
- Secondary agent: strict, stateless auditor receiving only current AST snapshot + proposed mutation
- Log both agent verdicts and disagreements to Provenance Ledger
- Configurable per domain profile

**Acceptance:** Zero cases where Red-tier mutation reaches filesystem without logged second-agent verdict.

**Files:** `bridge-mcp/src/core/consensus-gate.ts`

---

#### EXP.4 — White-Label / Multi-Brand Theming
**Effort:** 2 sprints · **Priority:** MEDIUM

`bridge theme-validate <glob> --themes brand-a.json,brand-b.json` — validates single codebase under multiple brand token sets.

**Files:** `bridge-mcp/src/core/violations/themeAuditor.ts`, `bridge-mcp/src/core/violations/themeReporter.ts`

---

### Sprint Window 5 (Week 11-14): Anomaly Detection + DS Migration

#### GOV.4 — Statistical Anomaly Detection
**Effort:** 2 weeks · **Priority:** MEDIUM — genuine moat capability

**No other tool in this space does pattern-based governance.**

**Baseline statistics from historical mutations:**
- Average mutations per session
- Typical override frequency per project
- Normal violation distribution

**Anomaly flagging:**
- Sudden spike in overrides (3σ above baseline)
- Unusual rule violation patterns
- Drift in Token Integrity Ratio over time

**UI surface:**
- "Health" tab in governance dashboard
- Ambient alert on anomalies (amber glow, not blocking)
- Weekly/monthly trend reports for enterprise customers

**Files:** `bridge-mcp/src/core/governance/anomalyDetector.ts`, `bridge-mcp/src/core/governance/baselineBuilder.ts`

---

#### EXP.5 — Design System Version Migration
**Effort:** 2 sprints · **Priority:** MEDIUM · **Depends on:** EXP.3

`bridge migrate-ds <glob> --from v4.json --to v5.json` — token diff + class remapping.

**Files:** `bridge-mcp/src/core/migrations/tokenDiff.ts`, `bridge-mcp/src/core/migrations/tokenMigrationMap.ts`

---

### Sprint Window 6 (Week 14-18): Compliance + Cross-Platform

#### EXP.6 — Accessibility Compliance Automation
**Effort:** 3 sprints · **Priority:** MEDIUM-HIGH · **Independent — can parallelize**

Extend 10-rule A11yLinter to 50+ WCAG 2.1 AA rules with auto-fix, VPAT generation, APCA contrast, and domain-specific rule sets (Section 508, HIPAA, ADA).

**Files:** `bridge-mcp/src/core/A11yLinter.ts`, `bridge-mcp/src/core/compliance/vpat.ts`, `bridge-mcp/src/core/validators/strategies/apca.ts`

---

#### EXP.7 — Cross-Platform Token Sync
**Effort:** 3 sprints · **Priority:** LOWER

DTCG → 5 platform outputs (Tailwind, CSS vars, RN, Swift, Kotlin) with cross-platform audit.

**Files:** `bridge-mcp/src/core/platforms/`, `bridge-mcp/src/core/parsers/` (Swift, Kotlin, RN extensions)

---

### Sprint Window 7 (Week 18-26): Bidirectional Figma Token Sync

> **Source:** `docs/strategy/Bidirectional_Token_Sync_MCP_Architecture.docx` (supersedes `Bidirectional_Token_Sync_Plan.docx`)
>
> **Architecture principle:** The Glass has zero business logic. All sync algorithms, conflict detection, OAuth, and Figma API calls live in the headless MCP server. The Glass extension (VS Code/Cursor) reads MCP Resources for display and calls MCP Tools for user actions.
>
> **Scope boundary:** Glass UI panels (SyncStatusPanel, ConflictModal, SyncHistoryDash) belong in the **Bridge Glass roadmap**, not here. This window implements the MCP engine: OAuth, sync engine, MCP tools, MCP resources, and MithrilLinter integration.
>
> **Database target correction:** New tables go in `~/.bridge-standalone/bridge.db` (the existing `store.ts` database), not `bridge-registry.db`. This aligns with `mutations_ledger`, `override_events`, and `governance_events` already in that database.

---

#### SYNC.1 — Database Schema + OAuth + Figma API Service (Week 18-19)
**Effort:** 1-2 weeks · **Priority:** FOUNDATIONAL · **Depends on:** EXP.7 (DTCG token format)

Add four new tables to `bridge.db`:

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `figma_connections` | `file_key`, `team_id`, `last_synced_at` | Tracks connected Figma files per project |
| `token_source` | `token_path`, `origin` (`figma|code|alias`), `figma_var_id` | Marks each token's source of truth |
| `sync_history` | `action`, `direction`, `token_path`, `timestamp`, `actor` | Audit trail — who changed what, which direction |
| `pending_conflicts` | `token_path`, `figma_value`, `code_value`, `last_synced_value` | Unresolved conflicts; survives process restart |

**OAuth via MCP Tool (MCP-native, no Electron dependency):**

Create `bridge-mcp/src/core/sync/figmaAuthService.ts`:
- OAuth 2.0 PKCE flow — `bridge_figma_connect` tool returns `{ authUrl }` for browser redirect
- MCP server listens on localhost callback port for OAuth code exchange
- Store tokens in system keychain (`keytar`) or `.bridge/credentials.json`
- Auto-refresh before expiration

**Figma API Service (MCP-side wrapper):**

Create `bridge-mcp/src/core/sync/figmaApiService.ts`:
- `getVariables(fileKey, accessToken)` — GET `/v1/files/:key/variables/local`
- `getVariableCollections(fileKey, accessToken)` — collection metadata
- `createVariable(fileKey, collectionId, name, resolvedValue, accessToken)` — create new Figma variable (for promotion)
- `updateVariable(fileKey, variableId, value, accessToken)` — push single token value to Figma
- Exponential backoff on 429 responses; read-only graceful degradation when write permission absent

**MCP tools (connection):**
- `bridge_figma_connect` — initiates OAuth flow, returns `{ authUrl }` for browser
- `bridge_figma_link_file` — links a Figma file to this project (takes `fileKey`)

**MCP resource (connection):**
- `bridge://figma-connection` — `{ connected, fileName, lastSync, permissions }`

**Acceptance:** Tables created; OAuth round-trips; `figmaApiService.ts` can read/write variables with a valid Figma PAT; `bridge://figma-connection` resource returns connection status.

**Files:** Schema added to `bridge-mcp/src/core/ingestion/store.ts`, new `bridge-mcp/src/core/sync/figmaAuthService.ts`, new `bridge-mcp/src/core/sync/figmaApiService.ts`, new `bridge-mcp/src/core/sync/types.ts`

---

#### SYNC.2 — Three-Way Diff Sync Engine (Week 19-21)
**Effort:** 2 weeks · **Priority:** CRITICAL · **Depends on:** SYNC.1, EXP.5 (token diff pattern)

Create `bridge-mcp/src/core/sync/tokenSyncEngine.ts` with three-way diff:
- **Figma Variables** — current state from API
- **`token_source` last-sync state** — last known reconciled value in DB
- **`design_tokens` table** — current code state

Diff output categories:

| Category | Definition | Auto-action |
|----------|-----------|-------------|
| `FIGMA_ADDED` | New in Figma, absent in code | Auto-insert into `design_tokens` |
| `CODE_ADDED` | New in code, absent in Figma | Insert into `pending_conflicts` (requires promotion) |
| `FIGMA_MODIFIED` | Figma changed, code unchanged since last sync | Auto-update `design_tokens` |
| `CODE_MODIFIED` | Code changed, Figma unchanged since last sync | Insert into `pending_conflicts` |
| `CONFLICT` | Both sides changed since last sync | Insert into `pending_conflicts`; require resolution |
| `FIGMA_DELETED` | Removed in Figma, still in code | Amber governance flag; no auto-delete |
| `ORPHANED` | In code, no Figma mapping | SYNC-002 violation emitted |

**Webhook endpoint** extension to `ingestion-server.ts`: `POST /figma-webhook` — verifies passcode, calls `tokenSyncEngine.diff()`, debounces 100ms.

**MCP tools (sync operations):**
- `bridge_sync_pull` — fetches latest Figma Variables, runs diff, auto-applies non-conflicts, queues conflicts
- `bridge_sync_push` — promotes code-only tokens to Figma Variables (takes `{ tokenIds }`)
- `bridge_resolve_conflict` — resolves one conflict: `{ tokenId, resolution: 'figma' | 'code' | 'alias' }`
- `bridge_resolve_all` — bulk resolve: `{ resolution: 'accept_all_figma' | 'keep_all_code' }` (for conflict explosion scenarios)

**MCP resources (sync state):**
- `bridge://sync-status` — `{ totalTokens, synced, pending, conflicts, lastCheck }`
- `bridge://pending-conflicts` — array of `{ tokenId, tokenName, figmaValue, codeValue, deltaE }`
- `bridge://sync-history` — paginated audit trail from `sync_history` table (filter by direction, date, token type)

**Acceptance:** All 7 diff categories correctly classified; conflicts written to `pending_conflicts`; MCP tools all respond correctly.

**Files:** `bridge-mcp/src/core/sync/tokenSyncEngine.ts`, `bridge-mcp/src/core/sync/syncResources.ts`, additions to `bridge-mcp/src/server.ts`, additions to `ingestion-server.ts`

---

#### SYNC.3 — MithrilLinter SYNC Violation Types (Week 21-22)
**Effort:** 1 week · **Priority:** HIGH · **Depends on:** SYNC.2, EXP.6 (linter extension pattern)

Add two new violation types to MithrilLinter:

| Rule ID | Name | Condition | Severity | Quick Fix |
|---------|------|-----------|----------|-----------|
| `SYNC-001` | Token Out of Sync | Token value in code diverges from Figma source of truth (by ΔE > 2.0 for colors) | AMBER | "Pull from Figma" (calls `bridge_resolve_conflict { resolution: 'figma' }`) |
| `SYNC-002` | Orphaned Token | Token exists in code with no Figma mapping | WARNING | "Promote to Figma" (calls `bridge_sync_push`) |

**Token Integrity Ratio (TIR) extension:** Include `SYNC-001` and `SYNC-002` violations in TIR calculation so synced tokens count positively.

**Files:** `bridge-mcp/src/core/governance/MithrilLinter.ts`, `bridge-mcp/src/core/compliance/provenance.ts` (add SYNC rule entries)

---

#### SYNC.4 — Governance Reporting + Error Resilience + CI/CD (Week 22-24)
**Effort:** 2 weeks · **Priority:** MEDIUM · **Depends on:** SYNC.2-3

**Sync history MCP resource enhancements:**
- Filter by: direction (push/pull), token type, date range, actor
- Export to JSON/CSV via `bridge_debt_report` integration (re-use EXP.2 formatters)
- `bridge_export_sync_history` tool outputs JSON/CSV
- Include sync health summary in `bridge://dashboard` resource

**Error resilience:**
- Handle Figma API rate limits (429) with exponential backoff + local cache
- Handle network failures: queue writes to `sync_history` with `status: 'pending_retry'`
- Handle permission errors: detect read-only mode upfront, surface via `bridge://figma-connection`
- Offline detection: queue writes, retry on reconnect
- Token expiration: auto-refresh or prompt re-auth via `bridge_figma_connect`
- Process-restart recovery: reload `pending_conflicts` from DB on `tokenSyncEngine` init

**CI/CD integration:**
- `bridge sync --check` CLI command for CI pipelines — exit code 1 if unresolved conflicts exist
- GitHub Action wrapper (re-use EXP.1 CI/CD pattern)

**Success metrics for SYNC.1-4:**

| Metric | Target |
|--------|--------|
| Figma → Code sync latency (post-webhook API call) | < 10 seconds (API-dependent) |
| Code → Figma promotion success rate | > 99% (excluding permission errors) |
| Conflict durability across process restart | 100% |
| SYNC-001/SYNC-002 false positive rate | < 2% |
| `bridge://sync-status` response time | < 200ms |

**Files:** Additions to `bridge-mcp/src/server.ts` (resource updates), `bridge-mcp/src/core/sync/tokenSyncEngine.ts` (retry logic), `bridge-mcp/src/core/reporting/` (sync history formatters), `bridge-mcp/src/cli.ts` (sync --check command)

---

> **Deferred to Bridge Glass Roadmap (not this document):**
> - `bridge-glass/src/panels/SyncStatusPanel.tsx` — sidebar status view (reads `bridge://sync-status`)
> - `bridge-glass/src/modals/ConflictModal.tsx` — conflict resolution UI (reads `bridge://pending-conflicts`, calls `bridge_resolve_conflict`)
> - `bridge-glass/src/panels/SyncHistoryDash.tsx` — audit trail dashboard (reads `bridge://sync-history`)
> - `bridge-glass/src/hooks/useMCPResource.ts` — resource polling hook
> - `bridge-glass/src/hooks/useMCPTool.ts` — tool invocation hook
>
> The MCP tool surface (`bridge_resolve_conflict`, `bridge_sync_push`, `bridge://sync-status`) provides full headless access. Glass UI is additive — reads Resources, calls Tools, owns zero business logic.

---

## Master Dependency Graph

```
INFRA.1-2 (SQLite tables)
  │
  ├── GOV.1 (Rule Provenance) ──────────────────────────────┐
  ├── V.2 (Mutation Provenance) ────┐                       │
  ├── GOV.2 (Override Telemetry)    │                       │
  │                                 │                       │
  │                            V.1 (Risk Scoring)  ──┐      │
  │                                 │                │      │
  │                            GOV.3 (Session        │      │
  │                              Validation)    V.4 (Consensus
  │                                 │           Gate)       │
  │                            INFRA.5 (Session             │
  │                              Ledger)                    │
  │                                 │                       │
  │                            GOV.4 (Anomaly               │
  │                              Detection)                 │
  │                                                         │
  EXP.1 (DONE) ───── EXP.2 (Debt Report) ──── INFRA.4 ────┘
                         │
                    EXP.3 (TW Migration)
                         │
                    EXP.5 (DS Migration)
                         │
                    EXP.4 (White-Label)
                         │
                    EXP.7 (Cross-Platform)

  V.3 (Universal AST) ─── runs parallel, no deps
  EXP.6 (Accessibility) ── runs parallel, no deps

  EXP.7 (Cross-Platform Sync)
       │
  SYNC.1 (DB Schema + Figma API)
       │
  SYNC.2 (Three-Way Diff Engine + MCP tools)
       │
  SYNC.3 (SYNC-001/002 Violations)
       │
  SYNC.4 (Reporting + Error Resilience)
```

---

## Timeline Summary

| Window | Weeks | Phases | Theme |
|--------|-------|--------|-------|
| S1 | 1-3 | INFRA.1-2, GOV.1, V.2, GOV.2 | Foundation: provenance + telemetry |
| S2 | 3-5 | EXP.2, V.1, INFRA.3-4 | Risk scoring + debt reporting |
| S3 | 5-8 | GOV.3, EXP.3 | Validation + migration |
| S4 | 8-11 | V.3, V.4, EXP.4 | Domain abstraction + consensus |
| S5 | 11-14 | GOV.4, EXP.5 | Anomaly detection + DS migration |
| S6 | 14-18 | EXP.6, EXP.7 | Compliance + cross-platform |
| S7 | 18-26 | SYNC.1-4 | Bidirectional Figma Token Sync |

**Total: ~26 weeks (6.5 months) for all 20 remaining workstreams.**

---

## Parallelization Opportunities

These phases have no mutual dependencies and can run simultaneously:

| Track A (sequential) | Track B (parallel) |
|----------------------|-------------------|
| GOV.1 → V.2 → V.1 → V.4 | V.3 (Universal AST) — start any time |
| EXP.2 → EXP.3 → EXP.5 | EXP.6 (Accessibility) — start any time |
| GOV.2 → GOV.3 → GOV.4 | |

With 2 parallel tracks, total timeline compresses to **~14 weeks**.

---

## Success Metrics

| ID | KPI | Target |
|----|-----|--------|
| GOV.1 | Violations with regulatory citation | 100% |
| GOV.2 | Override events captured | 100% |
| GOV.3 | Post-batch validation pass rate | 100% |
| GOV.4 | Anomaly detection precision (3σ) | >90% |
| V.1 | Mutations with MRS score | 100% |
| V.2 | Provenance query latency | <200ms |
| V.3 | Non-JSX adapters passing integration tests | ≥2 |
| V.4 | Red-tier mutations with second-agent verdict | 100% |
| EXP.2 | Report generation (1000 files) | <30s |
| EXP.3 | Class transform accuracy | >99% |
| EXP.4 | Themes validated per minute | >10 |
| EXP.5 | Token remap accuracy | >99% |
| EXP.6 | WCAG 2.1 AA rule coverage | >90% |
| EXP.7 | Platform outputs | 5 |
| SYNC.1-4 | Figma → Code sync latency | <10s |
| SYNC.1-4 | Promotion success rate | >99% |
| SYNC.1-4 | Conflict durability across restart | 100% |

---

## Agent Assignment Pattern

Each phase uses a **5-agent Expert Tier S squad**:

| Role | Agent Type | Responsibility |
|------|-----------|---------------|
| Lead | `bridge-architect` | Architecture validation, design review |
| Builder | `bridge-ast-surgeon` or domain specialist | Core implementation |
| Integrator | `cli-developer` or `cicd-engineer` | CLI/MCP/CI wiring |
| Tester | `bridge-test-writer` | Comprehensive test coverage |
| Reviewer | `bridge-code-reviewer` | Final review, merge readiness |

---

## Relationship Between Plans

| Plan | Direction | Scope |
|------|-----------|-------|
| **EXP.1-7** | Horizontal | New use cases — extends what Bridge can do |
| **V.1-V.4** | Vertical | Architectural depth — strengthens how Bridge does it |
| **GOV.1-GOV.4** | Internal | Governance integrity — ensures Bridge practices what it preaches |

All three are orthogonal and composable. GOV phases provide the infrastructure (provenance, telemetry, validation) that makes EXP deliverables enterprise-credible and V phases architecturally sound.

---

## Out of Scope

- IDE/Electron/canvas-specific work — headless MCP exclusively
- Fine-tuning or model training — Bridge assumes model hallucination and constructs containment
- General-purpose guardrails frameworks — Bridge's pre-commit interception is structurally superior
- Any changes to the existing 409 passing tests — only additions
