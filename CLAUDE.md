# Project: Flint (v7.2)

## Identity

Flint is the governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance deterministically at the AST level -- before code reaches production.

Two components:

| Component | What it is | Where it runs |
|-----------|-----------|---------------|
| **Flint MCP** | Headless governance engine exposed via Model Context Protocol | Anywhere -- CI, IDE plugin, cloud |
| **Flint Glass** | Visual observability layer (read-only) | Electron 35.7.5 desktop app |
| **Flint Web** | Glass in the browser (same React UI, Express+WS backend) | Any modern browser (`npm run dev:web`) |

Flint MCP does all the work. Flint Glass reads MCP Resources to display state and calls MCP Tools to trigger actions. Glass owns zero business logic. Chat lives in the host IDE (Claude Code, Cursor, VS Code). Flint Glass is the observability layer, not a chat host.

**Figma Integration:** Figma MCP is the **only** Figma integration path. The custom Figma plugin (`figma-plugin/`) was deprecated and deleted on 2026-04-15. Do not reference, recreate, or suggest the Figma plugin. The ingestion server (`localhost:4545`) remains as an internal API but is not a product feature — do not surface it in UI or documentation. Use `/figma <url>` for design-to-code, `/connect` for OAuth setup, and `/tokens` for token sync.

## Feature Names (The Citadel)

Every feature has a Citadel name. Use these names in conversation, UI text, documentation, and agent prompts. Do NOT rename file paths, function names, IPC channels, or store names -- Citadel names are for human-facing communication only. Full naming guide: `docs/strategy/FEATURE-NAMING-THEMES.md`.

```
THE CITADEL — "Every wall. Every gate. Every guard."

DEFENSE                          CREATION
  Mithril  — perceptual lint       Mason   — JSX transform
  Warden   — a11y lint             Sage    — AI refinement
  Ghost    — hardcoded detection   Oracle  — AI classification
  Shield   — spatial badges        Cipher  — CSS var resolver
  Gate     — export gate           Scout   — token extraction
  Sentry   — risk scoring          Decoy   — component shims
  Flare    — anomaly detection     Envoy   — token sync
  Proof    — snippet validator     Bridge  — Code Connect
  Ledger   — governance log        Armory  — component registry
  Stamp    — provenance
  Manifest — DBOM

FOUNDATION
  Flint    — the product     Beacon   — context sync
  Glass    — observability   Rewind   — undo/recovery
                             Alliance — OAuth flow
                             Garrison — setup wizard
```

## Tech Stack

* **Shell:** Electron 35.7.5 (Node.js 22)
* **Frontend:** React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7
* **Canvas Engine:** `@xyflow/react` (React Flow v12)
* **State Management:** Zustand v5
* **Persistence:** SQLite (`better-sqlite3`) + PowerSync SDK (Sync Layer)
* **Preview Engine:** Custom `srcdoc` iframe + Babel Renderer IPC (100% Offline)
* **AST Factory:** Babel (TSX parse/traverse/generate -- deterministic surgery)
* **Vector Store:** `sqlite-vec` (design system RAG for AI context injection)
* **MCP SDK:** `@modelcontextprotocol/sdk` v1.27+

## Architecture

### Glass Layout (3-Panel)

```
+----------------+----------------------------+---------------------+
|  Left Panel    |  Infinite Canvas            |  Right Sidebar       |
|  (Layers /     |  (XYCanvas + LivePreview    |  Tabs: Properties |  |
|   Assets)      |   as draggable node)        |  Tokens | Activity | |
|                |                             |  Health              |
|  AST tree      |                             |                      |
|  Asset grid    |                             |                      |
|                |  Spatial Repair triggers    |  (inline violations) |
+----------------+----------------------------+---------------------+
|  StatusBar (Export Gate + Save State + Sync + Figma Status)        |
+--------------------------------------------------------------------+
```

Glass does NOT contain: Monaco editor panel, terminal panel, file explorer panel. Those live in the host IDE.

**Progressive Disclosure (Phase PD):** Panels, tabs, and status bar elements are hidden until contextually relevant. The `unlockedTabs` store slice tracks which right sidebar tabs are visible. Left panel tabs unlock progressively (Layers always, Assets on registry, Files on MCP). Status bar elements like Autopilot hide until first violation. Empty states with guidance replace blank panels. One-time onboarding tooltips (`useOnboardingTooltip`) introduce features on first encounter.

### Process Boundary

```
electron/    <->  preload.ts  <->  src/
[Node.js]        [IPC Flint]     [Sandboxed React]
  fs, sqlite                       no Node.js
  AI SDK                           window.flintAPI only
  MCP server
```

Any feature crossing this boundary needs an IPC channel via `contextBridge`.

### Context Flint (Beacon)

`useContextSync` hook (mounted at App root) writes live Glass state to `.flint/context.json` every 200ms (debounced). The MCP server reads this file via `flint_get_context` / `flint://session-context` to stay synchronized with the visual layer without direct IPC coupling.

## MCP Surface

### Tools (54 registered)

All tools registered in `flint-mcp/src/server.ts`:

| Tool | Purpose |
|------|---------|
| `flint_status` | Server health check |
| `audit_ui_component` | Run Mithril + Warden audit on a component file |
| `hydrate_figma_data` | Convert Figma AST payload into React component snippets |
| `read_design_intent` | Read `.flint/current-intent.json` and return typed Execution Plan |
| `flint_ast_mutate` | Apply batched structural mutations with MRS risk scoring + dry_run support |
| `flint_query_registry` | Armory — semantic + keyword search over component registry; returns Shadow Storybook artifact |
| `flint_audit` | Full governance audit with SARIF output; optional `healOnAudit` for tier-1 auto-fix |
| `flint_fix` | Deterministic auto-fix for token violations; supports `dry_run` |
| `flint_swarm_audit_fix` | Parallel audit + auto-fix across file globs |
| `flint_ingest_figma` | Figma ingestion pipeline |
| `flint_sync_tokens` | Token synchronization |
| `flint_audit_report` | Compliance audit report with rule provenance + sourceAuthority filter |
| `flint_accessibility_report` | Warden — standalone accessibility audit with SARIF output |
| `flint_generate_dbom` | Manifest — Design Bill of Materials export (json, markdown, cyclonedx) |
| `flint_add_remote_library` | Register a remote component library (npm/URL) for registry seeding |
| `flint_plan` | Structured execution plan for multi-step agent tasks |
| `flint_mutation_provenance` | Stamp — query provenance ledger (summary, audit_trail, by_source) |
| `flint_override_telemetry` | Query override events (summary, by_session, by_rule) |
| `flint_agent_risk` | Per-agent risk posture and dashboard |
| `flint_anomaly_report` | Flare — statistical anomaly detection (detect, baseline, history) |
| `flint_consensus_report` | Query epistemic consensus gate records (disagreement rate, outcomes) |
| `flint_risk_score` | Sentry — mutation risk scoring (score_mutation, file_profile, project_summary) |
| `flint_debt_report` | Design debt health score (0-100), grade (A-F), trend tracking |
| `flint_set_policy` | Read, update, or reset project governance policy |
| `flint_get_context` | Beacon — full session context (active file, violations, tokens, health, canvas) |
| `flint_assess_complexity` | Complexity router — recommend AI model tier for a task |
| `flint_migrate_tw` | Tailwind v3→v4 AST-level class migration with post-migration audit |
| `flint_migrate_config` | Auto-migrate JSON config to flint.config.yaml |
| `flint_agent_trust` | Dynamic agent trust tiers (profile, promote, demote, reset, list) |
| `flint_figma_connect` | Alliance — Figma connection management (connect, disconnect, status) |
| `flint_sync_pull` | Envoy — pull remote Figma token changes to local |
| `flint_sync_push` | Envoy — push local token changes to Figma |
| `flint_resolve_conflict` | Resolve a single sync conflict |
| `flint_resolve_all` | Bulk resolve all sync conflicts |
| `flint_sync_check` | CI/CD sync health check |
| `flint_sync_history` | Sync history export (JSON/CSV) |
| `flint_validate_themes` | Multi-brand theme validation (cross-theme matrix) |
| `flint_migrate_ds` | Design system version migration (token diff + AST rename) |
| `flint_universal_audit` | Universal audit using domain-agnostic AST engine |
| `flint_enrich_registry` | Armory — AI-draft enrichment for registry entries |
| `flint_approve_enrichment` | Armory — approve/reject draft enrichment |
| `flint_reindex_registry` | Armory — re-index project manifest + RAG vectors |
| `flint_emit_tokens` | Scout — emit design tokens to platform formats (CSS, Tailwind, Swift, Kotlin) |
| `flint_map_tokens` | Map DTCG tokens to library-specific formats (shadcn, MUI, PrimeNG) |
| `flint_set_library` | Set the active component library for a project |
| `flint_design_to_code` | Mason — Figma-to-code pipeline with library-aware component mapping |
| `flint_extract_tokens` | Scout — extract design tokens from Figma variables |
| `flint_approve_tokens` | Scout — approve extracted tokens for merge into design-tokens.json |
| `flint_code_connect_sync` | Bridge — sync Code Connect mappings between Figma and codebase |
| `flint_pull_variables` | Pull Figma variables directly via API |
| `flint_pack_export` | GPX — export governance pack (rules, config, tokens) |
| `flint_pack_import` | GPX — import governance pack with conflict detection |
| `flint_pack_rollback` | GPX — rollback a previously imported pack |
| `flint_defer_violation` | Defer a violation for later resolution (snooze) |

### Resources (13 registered)

| URI | What it exposes |
|-----|----------------|
| `flint://capabilities` | Full MCP surface inventory (tools, resources, prompts) for agent self-discovery |
| `flint://session-context` | Rich session context snapshot — active file, violations, tokens, health, recent mutations |
| `flint://tokens` | Current design tokens from `.flint/design-tokens.json` |
| `flint://manifest` | Project architecture manifest (`flint-manifest.json`) |
| `flint://rules` | All loaded governance rules, grouped by domain |
| `flint://violations/{filePath}` | Live governance audit for a specific file (with rule provenance) |
| `flint://dashboard` | Design debt health score, grade, top violated files/rules, override telemetry |
| `flint://policy` | Active governance policy — Mithril thresholds, A11y mode, export gate settings |
| `flint://dbom` | Design Bill of Materials — tokens, component compliance, governance status |
| `flint://overrides` | Current override count and summary by rule/session |
| `flint://agent-risk` | Per-agent risk posture and escalation status |
| `flint://anomalies` | Current anomaly count and latest detected anomalies from statistical baseline |
| `flint://figma-connection` | Active Figma connection status for the project |

### Prompts (3 registered)

| Prompt | Purpose |
|--------|---------|
| `flint-intent-composer` | UX/UI Architecture Sentinel persona for design-to-code translation |
| `flint-sentinel` | Domain-configurable governance engine persona |
| `flint-workflow-guide` | Step-by-step workflow guidance for new MCP clients discovering Flint |

## Module Status

### Governance Engine (Flint MCP)

| Module | Phase | Status |
|--------|-------|--------|
| Mithril Enterprise Linter | B-v2 | **ONLINE** |
| Export Gate (Gate) | B.2 | **ONLINE** |
| Export Gate Severity Escalation (Gate) | B.1-d | **ONLINE** |
| Accessibility Gate / Warden (50 WCAG 2.1 AA rules) | B.3 | **ONLINE** |
| Sharma Validation / Proof (snippetAuditor) | B.1-b | **ONLINE** |
| AI Orchestrator Hardening | M | **ONLINE** |
| CI/CD Governance Gate (`flint audit`) | EXP.1 | **ONLINE** |
| CI Parity Rewrite (`flint-gate` CLI, MCP consumer) | CI.2 | **ONLINE** |

### AST Surgery Engine

| Module | Phase | Status |
|--------|-------|--------|
| Batch Mutation Engine | E.1 | **ONLINE** |
| FileTransactionManager | E.2 | **ONLINE** |
| Cross-File Move | F.2 | **ONLINE** |
| Global Recovery Engine / Rewind (Undo/Redo) | G.1 | **ONLINE** |
| Cross-File Redo (Rewind) | H | **ONLINE** |
| Code-First Recovery / Rewind (Git Transplants) | D.1 | **ONLINE** |
| Git Time Machine UI (Rewind) | D.2 | **ONLINE** |
| Undo Void Fix | K | **ONLINE** |

### Glass Observability Layer

| Module | Phase | Status |
|--------|-------|--------|
| Infinite Canvas (XYCanvas) | A | **ONLINE** |
| LivePreview (srcdoc iframe) | A | **ONLINE** |
| ShieldOverlay / Shield (spatial governance badges) | A | **DELETED Sprint 2** — replaced by GovernanceDashboard inline violations |
| GhostOverlay / Ghost (hardcoded class HUD) | U.4 | **DELETED Sprint 2** — hardcoded detection in GovernanceDashboard |
| GovernanceOverlay / Shield (violation list + auto-fix) | U | **DELETED Sprint 2** — merged into GovernanceDashboard |
| GovernancePanel (rule manager) | U | **ONLINE** |
| StatusBar (export gate + save state + sync) | A | **ONLINE** |
| NotificationCenter (toast system) | -- | **ONLINE** |
| ActivityFeed (MCP tool invocation log) | -- | **DELETED Sprint 2** — superseded by useMCPEventListener |
| OnboardingOverlay | -- | **ONLINE** |
| ExportModal / Gate (pre-flight audit) | B.2 | **ONLINE** |
| RecoveryPanel / Rewind (Git Time Machine) | D.2 | **DELETED Sprint 2** — TODO: move to Command Palette |
| Designer Experience (LayoutPanel) | N.1 | **ONLINE** |
| Asset Management Hub | Q | **ONLINE** |
| Interaction Modes (design/interact) | I | **ONLINE** |
| Native OS Menu | J | **ONLINE** |
| Context Flint / Beacon (useContextSync) | 1A | **ONLINE** |
| Auto-Save | F.1 | **ONLINE** |
| Activity Feed Upgrade (filter bar, search, error view) | V.2-af | **ONLINE** |
| Figma Connection Status (IPC, StatusBar popover, staleness) | W.2 | **ONLINE** |
| Ghost Canvas (Ghost severity heat tints, ViolationTooltip, viewport culling) | U.1 | **DELETED Sprint 2** — canvas governance visualization needs redesign (Sprint 8) |
| Annotation Rendering (annotationStore, AnnotationList, LayerTree dots) | COLLAB.4 | **ONLINE** |
| Governance Dashboard (health score ring, grade, top-5 rules, "health" tab) | V.1-gd | **ONLINE** |
| MCP Push Channel (mcp-events.jsonl, useMCPEventListener, fs.watch tail) | W.1 | **ONLINE** |
| Bidirectional Action Flint (mcpClient.ts, Glass-initiated MCP tool calls) | W.3 | **ONLINE** |
| Agent Risk Dashboard (per-agent risk badges, escalation indicators) | AGV.2 | **DELETED Sprint 2** — Glass component removed; MCP resource `flint://agent-risk` still ONLINE |
| Multi-Agent Epistemic Consensus Gate (secondary agent eval for Amber/Red mutations, `flint_consensus_report`, per-domain config) | V.4 | **ONLINE** |
| First-Launch Setup Wizard / Garrison (IDE detection, MCP snippet, connection test, first-launch flag) | ONBOARD.1 | **ONLINE** |
| Ghost Code Snippet Overlay (contextual source panel on node select, Hover-to-Source) | U.2 | **ONLINE** |
| IDE→Glass File Sync (VS Code/Cursor active-file follows IDE focus via `.flint/ide-active-file.json` stat-poll) | IDE.2 | **ONLINE** |
| Web Build (Express+WS server, 94 IPC handlers, `web-api.ts` adapter) | WEB | **ONLINE** |
| Progressive Disclosure (tab unlock, empty states, contextual tooltips, status bar gating) | PD | **ONLINE** |
| Governance Education (plain-language labels, "Why?" rows, glossary, rule descriptions) | EDU | **ONLINE** |

### Collaboration + Sync

| Module | Phase | Status |
|--------|-------|--------|
| Multiplayer Presence | C.1 | **ONLINE** |
| AST Conflict Arbiter | C.2 | **ONLINE** |
| Scaffolding & Registry | G.2 | **ONLINE** |

### Ingestion + Intelligence

| Module | Phase | Status |
|--------|-------|--------|
| Figma Ingestion | O | **ONLINE** |
| SDI Webhook | O.2 | **ONLINE** |
| MCP Intent Router | O.3 | **ONLINE** |
| SDI Layout Assembly | O.3a | **ONLINE** |
| Component Registry / Armory RAG | O.3b | **ONLINE** |
| LSP Orchestrator | P | **ONLINE** |
| Annotation Engine | COLLAB.1-3 | **ONLINE** |
| MCP Discoverability (capabilities resource, workflow prompt) | -- | **ONLINE** |
| Ingestion-Time Audit & Auto-Heal (IngestionAuditor, ImportSummary, heal IPC) | ING | **ONLINE** |

### Infrastructure + Governance Roadmap

| Module | Phase | Status |
|--------|-------|--------|
| Governance Events Table (Ledger) | INFRA.1 | **ONLINE** |
| Mutations Ledger Table (Ledger) | INFRA.2 | **ONLINE** |
| Design Debt Report (`flint_debt_report`) | EXP.2 | **ONLINE** |
| Rule Provenance (`flint_audit_report`) | GOV.1 | **ONLINE** |
| Override Telemetry (IPC + StatusBar badge) | GOV.2 | **ONLINE** |
| Accessibility Expansion (30 rules, auto-fix) | EXP.6a | **ONLINE** |
| Figma Plugin Settings UI (endpoint + secret + clientStorage) | FP.1 | **DEPRECATED** — plugin removed 2026-04-15, Figma MCP is the only path |
| Proactive Session Context / Beacon (`flint://session-context`) | ACX.1 | **ONLINE** |
| Event-Driven Context Push / Beacon (ContextPushManager) | ACX.2 | **ONLINE** |
| Complexity Router (Commandment 8 model routing) | ACX.4 | **ONLINE** |
| Sentinel Prompt (6 domain presets) | ACX.1 | **ONLINE** |
| Tool Enrichment (pre-flight context injection) | ACX.3 | **ONLINE** |
| Mutation Provenance / Stamp | V.2-mp | **ONLINE** |
| Risk Scoring / Sentry (MRS, 5-factor weighted) | V.1-rs | **ONLINE** |
| Renderer Hardening (iframe sandbox + CSP) | SEC.1 | **ONLINE** |
| Secret Hygiene (per-session secret, strip from renderer) | SEC.2 | **ONLINE** |
| MCP Tool Allowlist (renderer-callable tool restriction) | SEC.3 | **ONLINE** |
| API Key Safe Storage (safeStorage encryption) | SEC.4 | **ONLINE** |
| Terminal API Hardening (cwd restriction, input sanitization) | SEC.5 | **ONLINE** |
| Ingestion Rate Limiting (token-bucket, per-route) | SEC.6 | **ONLINE** |
| Session-Level Mutation Validation | GOV.3 | **ONLINE** |
| Error Taxonomy + Rule Explanations (50 entries) | CX.3 | **ONLINE** |
| Immersive Canvas (dead IDE panels removed) | U.3 | **ONLINE** |
| Per-Agent Tool ACL (4 trust tiers, `.flint/agent-policy.json`) | AGV.1 | **ONLINE** |
| MRS Approval Flow / Sentry (Green/Amber/Red risk tiers on tool_call chunks) | V.1 | **ONLINE** |
| Auto-Escalation Rules (4 default rules, session-scoped) | AGV.3 | **ONLINE** |
| Mithril Delta Mode (baseline snapshots, delta-only audit) | MDA.1 | **ONLINE** |
| Configurable Policy Engine (ΔE threshold, per-rule modes, team overlays, Glass UI) | POL.1 | **ONLINE** |
| Response Quality Baseline (`ResponseMeta` helper, 3 tools enriched) | CX.1 | **ONLINE** |
| Statistical Anomaly Detection / Flare (3σ threshold, baseline/detect/history) | GOV.4 | **ONLINE** |
| Design Bill of Materials / Manifest (token/component/violation inventory, CycloneDX) | DBOM.1 | **ONLINE** |
| Agent Risk Dashboard (MCP resource + Glass UI, per-agent risk posture) | AGV.2 | **ONLINE** |
| Dynamic Agent Trust Tiers (behavioral promotion/demotion, SQLite-backed) | AGV.4 | **ONLINE** |
| Accessibility Expansion / Warden (50 WCAG 2.1 AA rules, live regions, motion, forms) | EXP.6a-ext | **ONLINE** |
| Tailwind v3→v4 Migration (`flint_migrate_tw`, AST class transform) | EXP.3 | **ONLINE** |
| Figma Connection + OAuth / Alliance + API Service (4 SQLite tables, injectable crypto) | SYNC.1 | **ONLINE** |
| Three-Way Diff Sync Engine / Envoy (7 diff categories, pull/push/conflict resolution) | SYNC.2 | **ONLINE** |
| SYNC Violation Types (SYNC-001 token drift, SYNC-002 orphaned token) | SYNC.3 | **ONLINE** |
| CI Sync Gate + Offline Queue + History Export + Dashboard Integration | SYNC.4 | **ONLINE** |
| Multi-Brand Theme Validation (cross-theme matrix, delta report) | EXP.4 | **ONLINE** |
| Design System Version Migration (token diff, AST rename, ΔE scoring) | EXP.5 | **ONLINE** |
| Cross-Platform Token Sync (DTCG → Tailwind/CSS/React Native/Swift/Kotlin, cross-platform audit) | EXP.7 | **ONLINE** |
| Governance Pack Export (`flint_pack_export`, security scanner, SHA-256 checksums) | GPX.1 | **ONLINE** |
| Governance Pack Import (`flint_pack_import`, conflict detection, 3 merge strategies, snapshot rollback) | GPX.2 | **ONLINE** |
| VS Code / Cursor Extension (diagnostics, quick fixes, status bar, MCP client) | IDE.1 | **ONLINE** |
| Universal AST Abstraction (FlintNode, JSX + JSON Schema adapters, PluginRegistry) | V.3 | **ONLINE** |
| Constrained Registry / Armory (proactive system prompt injection, registry membership gate, per-project scope) | CR.1-3 | **ONLINE** |
| Component Scope Editor / Armory (Glass right sidebar, visual allowlist, IPC scope management) | CR.4 | **ONLINE** |
| RAG Auto-Seeding / Armory (manifest + tokens + docs seeded to sqlite-vec on project open) | CK.1 | **ONLINE** |
| Constrained Plan Intent (component-composition, 6th intent type, registry-aware) | CK.2 | **ONLINE** |
| On-Demand Re-Indexing (project:reindex IPC, manifest + RAG refresh) | CK.3 | **ONLINE** |
| Extended ComponentEntry (usageExample, compositionNotes, a11yNotes, relatedComponents) | CK.4 | **ONLINE** |
| Registry Enrichment (MCP tools, draft staging, Scope panel review UI, JSDoc extraction) | EN.1-4 | **ONLINE** |
| Component Cards on Canvas (Build mode grid + Govern mode health + dependency edges) | CV2.3 | **ONLINE** |
| Component Health Enrichment (per-component Mithril + A11y audit, A-F grades) | CV2.4 | **ONLINE** |
| Component Thumbnail Generator (offscreen BrowserWindow → PNG cache, useThumbnail hook) | CV2.2 | **ONLINE** |
| Drag-to-Insert (card drag from Build canvas → LivePreview drop → AST injection) | CV2.5 | **ONLINE** |
| Category Management (badge dropdown reclassification, override persistence) | CV2.6 | **ONLINE** |
| Search/Filter Bar (text search + category filter for component card grid) | CV2.7 | **ONLINE** |
| Variant Preview Strip (fan out variant chips below selected card in Build mode) | VIS.1 | **ONLINE** |
| Responsive Preview Snapping (Shift+scroll cycles mobile/tablet/desktop breakpoints) | VIS.2 | **ONLINE** |
| Live Diff for AI Edits (before/after code diff with LCS highlighting on tool_call) | VIS.3 | **ONLINE** |
| Design System Coverage Map (radial heat halos + coverage summary bar in Govern mode) | VIS.4 | **ONLINE** |
| Component Recipes (6 builtin patterns, horizontal strip in Build mode, registry validation) | VIS.5 | **ONLINE** |
| Governance Stickers (5 sticker types, spatial badges on cards in Govern mode) | VIS.6 | **ONLINE** |
| Smart Insert Context (position-aware drop targets, visual tree sidebar panel) | VIS.7 | **ONLINE** |
| Unified Config YAML (loader, extends, tighten-only, env overlays, JSON fallback) | UCFG.1-2 | **ONLINE** |
| Normative Mode + Migration Tool (`flint_migrate_config`) | UCFG.3-4 | **ONLINE** |
| Approval Gates + Scoring Weights + Classification Services | UCFG.5 | **ONLINE** |
| GPX Pack YAML Migration (assembleYamlPack, importYamlPack, format field) | UCFG.6 | **ONLINE** |
| Config Wiring (gates→mutations, classification→audit, weights→debt, style→sentinel) | UCFG.7 | **ONLINE** |
| PDP/PEP Enforcement Service (resolve, getActiveModes, getEnforcementAction) | UCFG.7-PEP | **ONLINE** |
| Trust Tiers from YAML (agentPolicy reads flint.config.yaml, tier name mapping) | UCFG.7-TRUST | **ONLINE** |
| Escalation Rules from YAML (agentEscalation reads flint.config.yaml) | UCFG.7-ESC | **ONLINE** |
| Config Validation (parse-time, actionable errors, warn-not-block) | UCFG.7-VAL | **ONLINE** |
| Rule Pack Registry (10 packs, 64 rules, domain/jurisdiction grouping) | ERM.1 | **ONLINE** |
| Rule Pack MCP Tools (list, enable, disable, set_mode, compliance_coverage) | ERM.1 | **ONLINE** |
| Enterprise Rule Management Glass UI (catalog, profiles, coverage, inheritance) | ERM.3 | **ONLINE** |
| Coverage Honesty (per-file `CoverageVerdict`, 9 reason codes, `governedSurfacePercent`, StatusBar `CoverageBadge` + `CoveragePopover`) | PHASE0 | **ONLINE** |
| Tailwind Config Ingestion (sandboxed `vm.runInNewContext` loader, explicit require allowlist, `resolveConfig` + `knownClasses` set, mtime cache) | PHASE1 | **ONLINE** |
| Class Composition Expansion (partial-evaluator for `clsx`/`cva`/`classnames`/`cn`/`twMerge`/`tw` with nested-call folding and cva variant dedup) | PHASE1 | **ONLINE** |

### Stores

| Store | Responsibility |
|-------|---------------|
| `editorStore` | Active-file AST, visual tree, linterWarnings, applyBatch, syncCode |
| `canvasStore` | Workspace tree, active file, saveState, canvasMode, mithrilViolations |
| `astBufferStore` | Headless multi-file AST buffers, crossFileMove |
| `tokenStore` | Design token CRUD |
| `historyStore` | Undo/redo stack management |
| `governanceStore` | Rule override deltas, activePresets, inheritanceChain, jurisdictionCoverage |
| `notificationStore` | Global toast/notification queue (max 5 concurrent) |
| `orchestratorStore` | AI orchestrator state, tool call approval |
| `assetStore` | Asset metadata, zombie audit state |
| `annotationStore` | Annotation CRUD, fs.watch push sync, rendering state |
| `importSummaryStore` | Ingestion heal summary, tier-2 snap resolution, undo-all-heals |
| `componentCardStore` | Component card grid state (Build/Govern canvas modes), card positions, selection, category overrides |

## The 16 Commandments

1. **Code is Truth** -- mutations must save to `.tsx` via AST. No ephemeral state.
2. **No Hallucinated Styling** -- every visual edit tied to a `design_token`.
3. **Composite IDs for Arrays** -- `Array.map` elements use injected composite IDs.
4. **Local-First Only** -- no external URLs in preview. 100% offline.
5. **Accessibility is a Compiler Error** -- a11y violations block export.
6. **The Gatekeeper Rule** -- exports blocked while overrides or drift remain.
7. **ID Preservation** -- `injectFlintIds` after every structural op.
8. **Audit-First Execution** -- complexity routed to Flash vs. Thinking model.
9. **CIEDE2000 Delta-E Logic** -- perceptual color distance for drift detection.
10. **Targeted Micro-Recovery** -- undo pre-flight checks node existence before executing.
11. **Surgical Git Transplants** -- never `git checkout` a shared file; transplant specific nodes.
12. **Atomic Queuing** -- all file saves via `FileTransactionManager`. AI edits batched.
13. **Deterministic Surgery** -- Babel AST traversal only. Never regex on source code.
14. **Bypass Prohibition** -- never use `fs` or `git` directly; route through `FileTransactionManager` / `GitManager`.
15. **Granular AST Tools Only** -- The catalog provides targeted, single-purpose mutation tools for structural changes, property changes, component logic (emit hook, emit handler, emit callback), rendering control flow (emit conditional, emit map), compound component assembly (compose slot), and imports (emit import).
16. **In-Memory Validation** -- type-check AI output before surfacing confirmation UI.

## Testing Standard

Flint is a governance product — it enforces quality on other people's code. Our own testing bar must be unimpeachable. Every agent and every implementation task follows this protocol.

### Required Test Coverage

| Domain | What must be tested | Test location |
|--------|-------------------|---------------|
| **MCP tools** | Happy path + missing params + malformed input | `flint-mcp/src/**/__tests__/` |
| **MCP resources** | Returns correct shape + handles missing data | `flint-mcp/src/**/__tests__/` |
| **SQLite services** | CRUD round-trip + each filter + aggregations + pruning + concurrent writes | `flint-mcp/src/**/__tests__/` |
| **Linter rules** | Each rule triggers on known-bad input + passes on known-good input | `src/core/*.test.ts` |
| **Zustand stores** | State transitions + selectors + edge cases (empty state, overflow) | `src/store/__tests__/` |
| **React components** | Renders without crash + user interactions + conditional UI states | `src/components/**/__tests__/` |
| **IPC channels** | Request/response shape + error propagation | `electron/*.test.ts` |
| **Hooks** | Mount/unmount lifecycle + state updates + cleanup | `src/hooks/__tests__/` |

### Test Completion Checklist (Every Task)

Every implementation task — whether done by a human or an agent — must complete ALL of these before being marked ONLINE:

1. **Write tests** for all new code (unit tests minimum, integration where IPC/DB involved)
2. **Run the full suite** for the affected package:
   - `cd flint-mcp && npm test` — MCP engine (must report exact count)
   - `npm run test:react` — Glass components (must report exact count)
   - `npm test` — Core/Electron tests (must report exact count)
3. **Run TSC** — `npx tsc --noEmit` must produce 0 errors
4. **Report results** in this exact format:
   ```
   MCP:   114/114 passing (3 new)
   Glass: 409/409 passing (0 new)
   TSC:   0 errors
   ```
5. **No regressions** — if any pre-existing test fails, fix it before proceeding
6. **Edge cases required** — every service must test: empty input, boundary values, error conditions, concurrent access (for DB services)

### Agent Testing Directive

When spawning agents for implementation work, the prompt MUST include:
- "Write tests for all new code"
- "Run the full test suite and report exact pass/fail counts"
- "Run `npx tsc --noEmit` and confirm 0 errors"
- "Report results in the format: `[Package]: X/Y passing (Z new)`"

If an agent completes work without reporting test results in this format, the work is considered **unverified** and must be re-tested before marking ONLINE.

## Commands

* `unset ELECTRON_RUN_AS_NODE && npm run dev` -- Launch Flint Glass (Vite + Electron)
* `npm run dev:web` -- Launch Glass in browser (Express+WS backend, no Electron)
* `npm run build:web` -- Production web SPA build
* `npm run test:react` -- Run React component tests (vitest.config.react.ts)
* `npm test` -- Run core tests (vitest.config.ts)
* `cd flint-mcp && npm test` -- Run MCP engine tests
* `npx tsc --noEmit` -- Strict type check

## Session Start Protocol (Every Development Session)

Before writing any code, every agent MUST complete these steps in order:

1. **Declare territory** — Update `.flint-context/ACTIVE-SWARM-TERRITORY.md` with the files and modules you intend to touch. If another agent has already claimed a file, stop and coordinate first.
2. **Update HANDOFF.md** — Add a session entry: phase/feature name, files in scope, and goal. This is how the next agent (or session) knows what was in progress.
3. **Read context** — Consult `HANDOFF.md`, `CLAUDE.md`, and `docs/FLINT-MASTER-PLAN.md` before reading the codebase.
4. **Begin work.**

After completing work:
- Update `HANDOFF.md` with what was done, what changed, and what remains.
- Clear your entries from `.flint-context/ACTIVE-SWARM-TERRITORY.md`.

This protocol is mandatory for any session involving implementation, refactoring, or file changes. Read-only research sessions are exempt.

## Development Workflow

**Contract-First Feature Build v2** (`.claude/workflows/feature-build.md`) is the mandatory workflow for any feature touching 2+ files or crossing a process boundary.

```
SESSION START: Declare territory in ACTIVE-SWARM-TERRITORY.md + update HANDOFF.md
GIT:      flint-git-guru → create feature branch
Phase 1:  flint-architect → Contract Artifact (.md) + Executable Contract (.contract.ts)
GIT:      flint-git-guru → commit contract artifacts
Phase 1.5: flint-contract-linter → Lint Report (APPROVED / REVISE)
Phase 2:  Parallel specialist agents implement against contract (import types from .contract.ts)
          Group A: IPC + Store + Test Scaffolds (it.todo)
          Group B: UI + Full Tests (it.todo → real assertions)
Phase 2.5: /review → Pre-commit code review gate (MANDATORY for agent-produced code)
GIT:      flint-git-guru → commit per agent + pre-commit gate (TSC + tests)
Phase 3:  flint-integration-validator → Integration Report (SHIP/FIX/REDESIGN)
GIT:      flint-git-guru → create PR (on SHIP)
REVIEW:   3 parallel reviews (UX + code + security) → write full reports to .flint-context/reviews/
          Surface findings to user — user makes grade/threshold calls, not the agent
SESSION END: Update HANDOFF.md + clear territory claim
```

Single-file bug fixes and cosmetic changes are exempt from the Contract-First flow but NOT from the Session Start Protocol. All other work follows this flow. Contract artifacts are the binding specification — Phase 2 agents implement exactly what the contract defines. If the contract is wrong, return to Phase 1.

**v2 improvements** (2026-03-27): Executable `.contract.ts` files (Phase 2 imports real types, not prose), Phase 1.5 contract linting (catches architect mistakes before cascade), test-from-contract scaffolding (TDD red phase from `testBoundaries`), IPC runtime validation (Zod schemas at preload bridge).

**v2.1 hardening** (2026-04-17): Contract schema tightened to make architect specs falsifiable. Every `FlintContract` now requires `meta.audience` (one of `engine | designer | developer | ci`), at least one `Invariant` with a measurable threshold containing a comparison operator (no adjectives like "fast"), executable `given/when/then` on every `TestBoundary` (prose fails Phase 1.5), a `validator` export name on every `renderer→main`/`bidirectional` IPC channel linking to `shared/ipc-validators.ts`, and at least one `nonGoals` entry. flint-contract-linter grew from 9 checks to 12. See [shared/contract-schema.ts](shared/contract-schema.ts) for types and helper functions (`validateInvariants`, `validateTestBoundaries`, `validateIPCTriangles`).

**Review gate** — `/review` runs between Phase 2 (implementation) and git commit. It catches issues that TSC and tests miss: Commandment violations, IPC security gaps, architectural anti-patterns, and missing test coverage. Code that fails review must be fixed before committing. This gate is mandatory for all agent-produced code, including single-file fixes.

**End-of-round review ceremony** — Before marking any phase COMPLETE, run 3 independent parallel reviews (UX, code, security) that write full findings to `.flint-context/reviews/<phase>-{ux,code,security}-review-<date>.md`. Surface these reports to the user directly — paste key findings in chat. The user makes all grade threshold calls. Reviewers do not assign letter grades — verdicts are derived from finding-severity counts via `deriveVerdict()` in [shared/review-schema.ts](shared/review-schema.ts). Each reviewer now writes a `.review.ts` sibling alongside the markdown; `ReviewFinding` requires `evidence[]` with file:line citations, and `aggregateConsensus()` surfaces parallel-reviewer disagreement as information rather than synthesizing it away. Do not mark work COMPLETE until the user has seen the findings and approved the threshold.

**Cheaper-Pilot levers (standardized 2026-04-20 after MINT.5 Phase 3 POC + A/B verification)** — Apply on every review ceremony.

* **Lever A — Domain partition (mandatory).** Split the ceremony into 3 domain reviewers: UX (components/hooks/stores the designer touches), Code (all modified implementation files **PLUS their test files and direct callers**), Security (IPC/preload/allowlist/validators + anything crossing the process boundary). The A/B measurement confirmed the domain split finds things no single generalist reviewer catches (e.g. security's tmpdir carve-out). Do NOT narrow the code reviewer's scope below "all modified impl + tests + callers" — the A/B showed a narrowed code scope misses ~6 warnings per phase.
* **Lever B — Structured-only output.** Every reviewer emits BOTH a markdown report AND a sibling `.review.ts` with typed `ReviewFinding[]`. `flint-ux-critic`, `flint-code-reviewer`, and `flint-security-reviewer` all have Write — no orchestrator-persistence fallback. Missing `.review.ts` = incomplete ceremony.
* **Parallel dispatch.** Send all 3 reviewer tool-calls in a single message. This is about wall-clock latency, not cache sharing — sub-agents run in isolated contexts so prompt-cache does NOT span reviewer boundaries. (Lever E from the original pilot dropped 2026-04-20 after A/B — the claimed cache savings were actually Lever A savings.)
* **Regression canary (mandatory, not optional).** Always run `flint-integration-validator` after the 3 scoped reviewers. A/B measurement showed a non-zero miss rate even with correct scoping; the canary is the backstop. If it surfaces findings the scoped reviewers missed, widen scope for next phase and log the miss in HANDOFF.md.

**Git ceremonies** are handled by `flint-git-guru` at every phase boundary. It manages branch naming (`feat/<phase>-<desc>`), conventional commit messages, pre-commit validation, and PR creation. Never commit without running the pre-commit gate (TSC + relevant test suites).

## Feature Budget Framework

Every feature proposal must pass these 6 gates before implementation. Full framework at `docs/strategy/FEATURE-BUDGET-FRAMEWORK.md`.

### The 6 Gates

1. **Who is this for?** Identify the audience: Engine (both), Designer (Glass), Developer (VS Code extension), or CI. Features claiming "both/everyone" must justify why each audience needs it separately.
2. **What behavior does this enable?** State as: "[User] can now [action] which they couldn't before." If you can't state this clearly, the feature is a solution looking for a problem.
3. **Is this the 80% use case or the 5% demo moment?** Build 80% features first. Demo moments are only justified when you have users to demo to.
4. **What's the maintenance cost?** Low (pure function, self-contained) / Medium (store slice, IPC, component) / High (cross-process, multi-interface, real-time). High-maintenance features require 3x the user signal.
5. **Can we validate without building it?** Ask users, show a mockup, ship a minimal version, or run a manual process first. Features taking >1 week must be validated before implementation.
6. **What do we stop doing to make room?** Explicitly name what gets deprioritized. If you can't name the trade-off, you haven't prioritized.

### Dual-Audience Rule

Flint serves designers AND developers. Features go to the layer that matches their audience:

| Audience | Where it lives | Core actions |
|----------|---------------|--------------|
| **Both** | `flint-mcp/` (engine) | Audit, fix, emit tokens, pack export/import |
| **Designer** | `electron/` + `src/` (Glass) | Preview, Verify, Fix, Score, Export |
| **Developer** | `flint-vscode/` (extension) | Diagnostics, Quick Fix, Status, Panel |
| **CI** | `flint-ci/` (CLI) | Headless audit, SARIF output |

Do not port designer features to the extension or developer features to Glass unless user signals justify it. Each interface is deliberately scoped.

## Critical AI Directives

1. **Session Start Protocol:** Before any implementation work, declare territory in `.flint-context/ACTIVE-SWARM-TERRITORY.md` and update `HANDOFF.md`. See the Session Start Protocol section above. Always consult `HANDOFF.md`, `CLAUDE.md`, and `docs/FLINT-MASTER-PLAN.md` before reading the codebase.
2. **Glass is Observability Only:** Chat lives in the host IDE. Flint Glass is the visual observability layer, not a code editor, terminal, file browser, or chat host. Do not add IDE-native panels to Glass.
3. **Mithril Safety:** If Delta-E > 2.0, code must be auto-fixed or Amber-flagged.
4. **Persistence Rule:** All mutations MUST be atomic and saved via the `FileTransactionManager` queue.
5. **No Hallucinations:** Use Babel AST traversal for all code changes. Never use Regex for source code.
6. **Granular AST Tools Only (Commandment 15):** The AI Orchestrator MUST only emit ops from the versioned AST Tool Catalog. Raw code string generation is prohibited.
7. **In-Memory Validation Loop (Commandment 16):** `orchestrator.ts` MUST run an in-memory TSC type-check on all AI output before surfacing a confirmation UI.
8. **Context Flint Awareness:** Glass writes live state to `.flint/context.json` via `useContextSync`. The MCP server reads `flint_get_context` / `flint://session-context` to stay synchronized. Any new Glass state that should be visible to MCP must be added to the `FlintContext` type.
9. **Process Boundary Law:** No `fs`, `sqlite`, or Node.js APIs in `src/`. All cross-boundary calls go through `window.flintAPI` (defined in `preload.ts`).
10. **Audit Result Presentation:** When `audit_ui_component` or `flint_audit` returns results, ALWAYS present the key findings as formatted markdown in your chat response — do not rely on the tool output block alone (VS Code collapses it to one line). Present: the verdict (BLOCKED/APPROVED), the violation summary, the "Why it matters" explanations, and the natural-language next step ("Say 'fix it' to auto-remediate"). Keep your presentation concise — the report has the detail, your response has the narrative.
11. **Citadel Vocabulary:** Use the Citadel feature names (see "Feature Names" section above) when presenting results to the user. Examples: "Mithril flagged 3 drifts", "Gate blocked export", "Mason produced 5 components", "Warden found 2 a11y violations", "Sentry elevated risk to Amber". This makes conversation consistent across all agents and sessions.

## Key Files

### Flint MCP Engine
| File | Role |
|------|------|
| `flint-mcp/src/server.ts` | MCP tool and resource registrations |
| `flint-mcp/src/core/ast-modifier.ts` | `assembleLayout`, mutation ops |
| `flint-mcp/src/core/registryService.ts` | `flint_query_registry` search |
| `flint-mcp/src/core/MithrilLinter.ts` | Mithril — CIEDE2000 + typography/spacing/shadow/opacity |
| `flint-mcp/src/core/A11yLinter.ts` | Warden — 50 WCAG 2.1 AA rules (9 rule modules) |
| `flint-mcp/src/tools/` | audit, fix, ingest, sync tool handlers |
| `flint-mcp/src/prompts/sentinel.ts` | Domain-configurable governance persona |
| `flint-mcp/src/core/governance/mutationProvenanceService.ts` | Stamp — provenance tracking; `recordProvenance`, `getAuditTrail`, `getProvenanceSummary` |
| `flint-mcp/src/core/governance/riskScoringService.ts` | Sentry — 5-factor weighted risk scoring (0-100), tier classification |
| `flint-mcp/src/core/governance/anomalyDetectionService.ts` | Flare — 3σ anomaly detection on mutation/override/violation baselines |
| `flint-mcp/src/core/governance/dbomService.ts` | Manifest — Design Bill of Materials generation (JSON/CycloneDX) |
| `flint-mcp/src/core/responseMeta.ts` | CX.1 — ResponseMeta helper for tool response quality measurement |
| `flint-mcp/src/core/governance/trustTierService.ts` | AGV.4 — Dynamic trust tier promotion/demotion |
| `flint-mcp/src/core/tailwindMigrator.ts` | EXP.3 — Tailwind v3→v4 AST class migration engine |
| `flint-mcp/src/core/a11y/rules/` | Warden rules — 50 WCAG 2.1 AA rules (9 modules: names-labels, keyboard, structure, aria, landmarks, contrast, forms, live-regions, motion) |
| `flint-mcp/src/core/htmlIntrinsics.ts` | Canonical HTML intrinsic element set shared by MithrilLinter, hydroPaste, and orchestrator |
| `flint-mcp/src/core/coverageClassifier.ts` | Phase 0 — per-file `CoverageVerdict` with 9 reason codes; Phase 1 upgrade paths suppress verdicts when config/expansion resolves |
| `flint-mcp/src/core/tailwindConfigLoader.ts` | Phase 1 — sandboxed `vm.runInNewContext` loader for `tailwind.config.*`, explicit require allowlist, mtime cache, error redaction |
| `flint-mcp/src/core/classExpressionExpander.ts` | Phase 1 — partial-evaluator for `clsx`/`cva`/`classnames`/`cn`/`twMerge`/`tw` call sites; returns `{ definite, possible, unresolvable }` |
| `flint-mcp/src/core/dashboard/debtReportService.ts` | Phase 0 — `computeCoverageSummary()` aggregation, writes `.flint/coverage-cache.json`, governed-surface-% in debt report |
| `flint-mcp/src/core/hydroPaste.ts` | Mason — Figma-to-JSX transform engine (component classification + code generation) |
| `flint-mcp/src/core/figmaMcpParser.ts` | Figma MCP `get_design_context` response parser |
| `flint-mcp/src/core/figmaJsxTransformer.ts` | Figma node tree → JSX AST transformer |
| `flint-mcp/src/core/d2cRefinement.ts` | Sage/Oracle — AI classification + refinement for D2C pipeline |
| `flint-mcp/src/core/figmaTokenExtractor.ts` | Scout — extract design tokens from Figma variables |
| `flint-mcp/src/core/codeConnectMapper.ts` | Bridge — Code Connect mapping resolution |
| `flint-mcp/src/core/rulePackRegistry.ts` | Static registry of 10 rule packs (64 rules) |
| `flint-mcp/src/core/governance/enforcementService.ts` | PDP/PEP enforcement point resolution |
| `flint-mcp/src/core/configValidator.ts` | Parse-time YAML config validation |
| `flint-mcp/src/core/config-loader.ts` | Unified config loader (YAML + JSON fallback) |

### Electron Main Process
| File | Role |
|------|------|
| `electron/main.ts` | IPC handlers: saveFile, readFile, ast:git-show, ast:git-log, syncContext |
| `electron/orchestrator.ts` | Constrained AI orchestration with TSC validation loop + CR.1-3 registry/token constraint injection |
| `electron/FileTransactionManager.ts` | Atomic `.tmp` -> `rename` write queue |
| `electron/GitManager.ts` | ensureRepo, shadowCommit, getGitNode |
| `electron/ingestion-server.ts` | Figma ingestion + SDI webhook (port 4545) + heal pass |
| `electron/ingestion/IngestionAuditor.ts` | CIEDE2000 tier classification + Babel AST auto-heal (Phase ING) |
| `electron/normalizer.ts` | Figma Variables → W3C DTCG token normalization |
| `electron/store.ts` | SQLite database (`flint.db`) |
| `electron/preload.ts` | IPC flint -- defines `window.flintAPI` surface |
| `electron/agentPolicy.ts` | AGV.1 — Per-agent ACL, 4 trust tiers, `.flint/agent-policy.json` |
| `electron/agentEscalation.ts` | AGV.3 — Auto-escalation rules engine (session-scoped) |
| `electron/mcpClient.ts` | W.3 — Bidirectional MCP client for Glass-initiated tool calls |
| `electron/consensusGateService.ts` | V.4 — Multi-agent epistemic consensus gate evaluation |
| `electron/mrsEngine.ts` | MRS risk scoring engine (Electron-side) |
| `electron/figmaOAuth.ts` | Alliance — Figma OAuth flow handler |

### Glass UI
| File | Role |
|------|------|
| `src/App.tsx` | Application shell -- 3-panel layout, keyboard shortcuts, menu events |
| `src/components/editor/XYCanvas.tsx` | Infinite canvas (`@xyflow/react` v12) |
| `src/components/editor/LivePreview.tsx` | `srcdoc` iframe preview engine |
| `src/components/editor/StatusBar.tsx` | Gate + engine indicators |
| `src/components/ui/NotificationCenter.tsx` | Global toast renderer |
| `src/components/ui/GovernancePanel.tsx` | Rule enable/disable/severity manager |
| `src/components/ui/ExportModal.tsx` | Gate — export pre-flight audit |
| `src/components/inspector/LayoutPanel.tsx` | Figma-grade Auto Layout controls |
| `src/components/ui/GovernanceDashboard.tsx` | Health score ring, grade letter, top-5 rules, violation list ("governance" tab) |
| `src/components/ui/AnnotationList.tsx` | Annotation rendering in right sidebar |
| `src/components/ui/ImportSummary.tsx` | Ingestion heal summary toast + review panel (Phase ING) |
| `src/components/ui/ComponentPanel.tsx` | Left sidebar component browser with drag-to-insert |
| `src/components/ui/FixPreviewDrawer.tsx` | Fix preview diff drawer (fixMode: preview) |
| `src/store/importSummaryStore.ts` | Ingestion summary state, tier-2 snap, undo-all-heals |
| `src/store/annotationStore.ts` | Annotation CRUD + fs.watch push sync |
| `src/hooks/useContextSync.ts` | Beacon — writes live state to `.flint/context.json` |

### CI/CD Gate (`flint-ci/`)
| File | Role |
|------|------|
| `flint-ci/src/cli.ts` | Commander CLI: `flint-gate audit|debt|sync|dbom|fix` |
| `flint-ci/src/engine.ts` | MCP engine adapter: zero-copy linter delegation |
| `flint-ci/src/commands/audit.ts` | File collection + Mithril/A11y audit + SARIF |
| `flint-ci/src/commands/debt.ts` | Design debt report (0-100, A-F grade) |
| `flint-ci/src/commands/sync-check.ts` | Token drift detection for CI |
| `flint-ci/src/commands/dbom.ts` | Manifest — Design Bill of Materials export |
| `flint-ci/src/commands/fix.ts` | Auto-fix (dry-run default) |
| `flint-ci/src/github-action.ts` | GitHub Actions wrapper + PR comment |

### Core Services
| File | Role |
|------|------|
| `src/core/ASTService.ts` | applyMutationBatch, applyInversions, synthesizeImports |
| `src/core/recoveryController.ts` | Undo/redo orchestration (single-file + cross-file) |
| `src/utils/layoutMapper.ts` | Atomic Tailwind layout class management |

### Web Build (`server/`)

| File | Role |
|------|------|
| `server/index.ts` | Express+WebSocket server — 94 IPC handlers mirroring Electron main process |
| `server/cli.ts` | CLI entry point (`--project`, `--port`, `--open`) |
| `server/mcpClient.ts` | MCP JSON-RPC client (adapted from `electron/mcpClient.ts`) |
| `server/services/ragStore.ts` | sqlite-vec RAG with n-gram embeddings |
| `server/services/aiChat.ts` | Anthropic streaming over WebSocket |
| `server/services/ingestionServer.ts` | Figma plugin receiver (port 4545) |
| `server/services/previewServer.ts` | Vite dev server wrapper for LivePreview |
| `server/services/thumbnailService.ts` | Puppeteer screenshot → PNG cache |
| `src/adapters/web-api.ts` | Browser-side `window.flintAPI` adapter (HTTP+WS, replaces Electron IPC) |
| `vite.config.web.ts` | Vite config for web build (no Electron plugins) |

### Shared Infrastructure

| File | Role |
|------|------|
| `shared/brand.ts` | Single source of truth for all product name strings |
| `shared/contract-schema.ts` | Machine-readable contract types (`FlintContract`, `Invariant`, helpers) — Phase 1 outputs, Phase 1.5 validates, Phase 3 checks |
| `shared/review-schema.ts` | Machine-readable review ceremony types (`ReviewReport`, `deriveVerdict`, `aggregateConsensus`) — reviewers emit `.review.ts` siblings alongside markdown |
| `shared/ipc-validators.ts` | Zod schemas for IPC runtime validation at the preload bridge — Design by Contract at the process boundary |

## Architectural Anti-Patterns (Reject These)

- Importing a Zustand store inside another store (cross-store contamination)
- Calling `window.flintAPI` inside a Zustand store action (IPC belongs in components/hooks/services)
- Writing to disk with `fs.writeFile` instead of routing through `FileTransactionManager`
- Adding `import { readFileSync } from 'fs'` anywhere in `src/` (process boundary violation)
- Using `ipcRenderer.send` directly in React (must go through `contextBridge` surface)
- Regex-based source code modification (always Babel AST traversal)
- Adding IDE panels (editor, terminal, file explorer, chat) to Flint Glass
