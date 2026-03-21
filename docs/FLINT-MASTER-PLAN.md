# Flint Master Plan
**Canonical reference — 2026-03-21**
**Supersedes:** FLINT-EXPANSION-PLAN.md, FLINT-FUTURE-SPRINTS.md, FLINT-GLASS-PIVOT.md, FLINT-GAP-REMEDIATION-PLAN.md, and all pre-pivot planning documents.

---

## Quick Navigation

> **For agents:** Read only the section you need. Use line numbers for `Read` tool offset/limit.

| Section | Line | What to find |
|---------|------|-------------|
| **1. Identity** | 34 | What Flint is, three core jobs, what it's NOT |
| **2. Architecture** | 50 | System model, MCP engine, Glass 3-panel layout, 16 Commandments |
| **3. Current State** | 115 | Every ONLINE module with status table |
| **4. Roadmap** | 185 | 7 sprint windows + Glass observability track |
| **5. Dependency Graph** | 315 | Phase ordering and prerequisites |
| **6. Strategic Positioning** | 350 | Market data, moats, investor narratives |
| **7. Ejected Plans** | 426 | What was removed and why |
| **8. Key Files Reference** | 448 | File paths for MCP, Electron, Glass, services |
| **JTBD Gap-Fill** | — | `.flint-context/architect-reviews/JTBD-GapFill-Plan.md` (separate file) |

**TL;DR for agents:**
- Flint = headless MCP governance engine (13 tools, 6 resources, 3 prompts) + Glass visual layer
- Glass layout: **3-panel** — [Left: Layers/Assets] [Center: Canvas] [Right: Properties/Tokens/Activity/Health]
- Chat lives in the host IDE, NOT in Flint Glass. IDE handles code editing, terminal, file explorer.
- JTBD score: **8.4/10** (Waves 1-2 complete) — targeting 9.0 via Wave 3 (see JTBD-GapFill-Plan.md)
- `unset ELECTRON_RUN_AS_NODE && npm run dev` to boot
- 366 MCP tests passing (17 test files), 0 TypeScript errors
- **Next work:** Wave 3 (W.1 Action Flint + W.3 Workflow Templates). See `.flint-context/architect-reviews/JTBD-GapFill-Plan.md`

---

## 1. Identity

Flint is the governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance deterministically at the AST level — before code reaches production.

**One-line investor statement:**
"Flint is the type checker for design systems — the same shift-left move TypeScript made for runtime errors, applied to brand drift and accessibility violations in AI-generated code."

**Three core jobs:**
1. **Accelerate** — Let AI agents generate UI at 10x speed via the MCP tool interface
2. **Protect** — Block brand drift (CIEDE2000 ΔE), accessibility violations (WCAG 2.1 AA), and codebase corruption from reaching production
3. **Recover** — Surgically undo AI mistakes at the AST node level without touching surrounding work

**What Flint is not:** A code editor, a terminal, a file browser, or an IDE replacement. Those live in Claude Code, Cursor, and VS Code. Flint governs what those tools produce.

---

## 2. Architecture

### 2.1 System Model

Flint is a two-component system:

| Component | What it is | Where it runs |
|-----------|-----------|---------------|
| **Flint MCP** | Headless governance engine | Anywhere — CI, IDE, cloud |
| **Flint Glass** | Visual observability layer | Electron 35.7.5 desktop app |

Flint MCP does all the work. Flint Glass is read-only — it reads MCP Resources to display state and calls MCP Tools to trigger actions. Glass owns zero business logic.

### 2.2 Flint MCP — Headless Governance Engine

| Layer | Technology | Role |
|-------|-----------|------|
| App Shell | Electron (Node.js 22) | IPC isolation, native FS, OS keychain |
| AST Engine | Babel | TSX parse, traverse, generate — deterministic surgery |
| Linting | MithrilLinter + A11yLinter | CIEDE2000 color drift, typography/spacing/shadow/opacity, WCAG 2.1 AA |
| Persistence | SQLite (better-sqlite3) | `flint.db` (project state) + `flint-registry.db` (global registry) |
| Vector Store | sqlite-vec | Design system RAG for AI context injection |
| Sync | PowerSync SDK | CRDT token sync, multiplayer presence |
| Context Flint | `.flint/context.json` | Stateless file connecting host IDE to Flint state |
| Distribution | MCP protocol | Tools + Resources exposed to Claude Code, Cursor, VS Code, Windsurf |

### 2.3 Flint Glass — Visual Observability Layer

Glass is a 3-panel Electron app (design tool layout):

```
┌───────────────────┬──────────────────────────┬─────────────────────┐
│  Left Panel       │  Center Panel            │  Right Panel        │
│  (Layers / Assets)│  (Infinite Canvas +      │  Tabs: Properties | │
│                   │   Live Preview node)     │  Tokens | Activity |│
│  AST tree         │                          │  Health             │
│  Asset grid       │  Ghost Code HUDs         │                     │
│                   │  Drift Overlays          │  GovernanceDashboard│
│                   │  Spatial Repair triggers │  (health score ring)│
└───────────────────┴──────────────────────────┴─────────────────────┘
```

**What Glass does NOT contain:** Monaco editor, terminal, file explorer, chat panel. Those live in the host IDE.

### 2.4 The 16 Commandments (Non-Negotiable Guardrails)

1. **Code is Truth:** If it isn't saved to the `.tsx` file via the AST, it doesn't exist.
2. **No Hallucinated Styling:** Every visual edit MUST be tied to a design token.
3. **Composite IDs for Arrays:** Dynamic lists MUST use injected composite template IDs.
4. **Local-First Only:** No external URLs, no Sandpack. Preview must remain 100% offline-capable.
5. **Accessibility is a Compiler Error:** Missing a11y attributes trigger a critical export block.
6. **The Gatekeeper Rule:** Exports are permanently blocked if any overrides or design drift remain.
7. **Indestructible ID Preservation:** All mutations MUST preserve `data-flint-id`.
8. **Audit-First Execution:** Every task is audited for complexity before routing to a model.
9. **CIEDE2000 ΔE Logic:** Use perceptual color distance for all design system drift detection.
10. **Targeted Micro-Recovery:** Undo operations must run pre-flight AST checks before executing.
11. **Surgical Git Transplants:** Never execute a raw `git checkout` on a shared file.
12. **Atomic Queuing & Batching:** All file saves must be atomic; AI mass-edits batched into one transaction.
13. **Deterministic Surgery:** Use Babel AST traversal for all code changes. Never use regex on source code.
14. **Bypass Prohibition:** Never use `fs` or `git` directly for stateful file changes; always route through `FileTransactionManager` or `GitManager`.
15. **Granular AST Tools Only:** The AI Orchestrator MUST only emit ops from the versioned AST Tool Catalog. Raw code string generation is prohibited.
16. **In-Memory Validation Before Confirmation:** `orchestrator.ts` MUST run an in-memory TSC type-check on AI output before surfacing any confirmation UI.

---

## 3. Current State — What Is ONLINE

All phases below are complete, tested, and deployed.

### Governance Engine (Flint MCP)

| Module | Phase | What it does |
|--------|-------|-------------|
| Mithril Enterprise Linter | B-v2 | CIEDE2000 color drift, typography (TYP-001..005), spacing (SPC-001), shadow (SHD-001), opacity (OPC-001) — 5 AST visitors |
| Export Gate | B.2 | Pre-flight audit blocks export on active overrides + Mithril violations + a11y violations |
| Export Gate Severity Escalation | B.1-d | Critical (ΔE > 10) → red modal; Amber (2.0–10.0) → amber styling; per-violation severity via `editorStore.linterWarnings` |
| Accessibility Gate | B.3 | `A11yLinter.ts` — 10 WCAG 2.1 AA rules (A11Y-001..010): img, button, a, input, select, textarea, table, html lang, tabIndex, heading skip |
| Sharma Validation | B.1-b | `snippetAuditor.ts` — AST injection robust against Fragment/Shadow scope |
| AI Orchestrator Hardening | M | `orchestrator.ts` constrained to 7-op AST Tool Catalog; in-memory TSC validation loop; design system RAG via sqlite-vec |
| CI/CD Governance Gate | EXP.1 | `flint audit <glob>` CLI; SARIF 2.1.0 formatter; GitHub Action; exit code semantics; PR comment formatter |

### AST Surgery Engine

| Module | Phase | What it does |
|--------|-------|-------------|
| Batch Mutation Engine | E.1 | `ASTService.applyMutationBatch` + `applyInversions` — single parse→mutate→generate cycle |
| FileTransactionManager | E.2 | Atomic `.tmp` → `rename` write queue, serialized per path |
| Cross-File Move | F.2 | `astBufferStore.crossFileMove` — 11-step atomic operation |
| Global Recovery Engine | G.1 | `recoveryController.ts` — single-file + cross-file undo/redo |
| Cross-File Redo | H | `CrossFileMoveRedoPlan` schema; `isRecovery` flag prevents history duplication |
| Code-First Recovery | D.1 | `gitShow` IPC + `transplantNode` AST swap |
| Git Time Machine UI | D.2 | `ast:git-log` IPC + `RecoveryPanel.tsx` + `revertNodeToCommit` |
| Undo Void Fix | K | `applyBatch` no-op guard + `setCode` Commandment-10 fix |

### Canvas + Glass UI

| Module | Phase | What it does |
|--------|-------|-------------|
| Infinite Canvas | A | `XYCanvas.tsx` — `@xyflow/react` v12; LivePreview as draggable custom node; pan/zoom/minimap |
| Auto-Save | F.1 | `triggerAutoSave` debounced IPC save; `saveState: idle/editing/saving/saved` |
| Interaction Modes | I | `canvasMode: 'design'|'interact'` in `canvasStore`; Shield gated on design mode |
| Native OS Menu | J | `menu:new/open/close-project` IPC channels |
| Designer Experience | N.1 | `LayoutPanel.tsx` Figma-grade Auto Layout controls; `layoutMapper.ts` atomic class management |
| Asset Management Hub | Q | `AssetsPanel.tsx` SQLite-backed asset hub; grid/list/search; zombie badge auditor |
| Activity Feed Upgrade | V.2-af | Filter bar, search, error view buttons in ActivityFeed |
| Figma Connection Status | W.2 | IPC endpoint, StatusBar popover, staleness colors |
| Ghost Canvas | U.1 | Severity heat tints, ViolationTooltip, click-to-properties, viewport culling |
| Governance Dashboard | V.1-gd | Health score ring, grade letter, top-5 rules, "health" tab in right sidebar |

### Collaboration + Sync

| Module | Phase | What it does |
|--------|-------|-------------|
| Multiplayer Presence | C.1 | `PresenceService.ts` throttled UPSERT + `useRemotePresence` 5Hz poll + remote cursor SVG overlay |
| AST Conflict Arbiter | C.2 | `useLockedNodeIds` + `useIsNodeLocked` — blocks drag, selection, edits on nodes held by remote users |
| Scaffolding & Registry | G.2 | `flint-registry.db`, `templateService.ts`, `LaunchScreen.tsx` |

### Ingestion + Intelligence

| Module | Phase | What it does |
|--------|-------|-------------|
| Figma Ingestion | O | `ingestion-server.ts` port 4545 + `normalizer.ts` Figma → W3C DTCG + `/ingest-ast` auto-hydration |
| SDI Webhook | O.2 | `POST /intent` validates `FlintSDIPayload`, writes `.flint/current-intent.json`, IPC notify |
| MCP Intent Router | O.3 | `read_design_intent` MCP tool routes `component` → Atomic Sync Plan or `page` → Composer Plan |
| SDI Layout Assembly | O.3a | `assembleLayout` mutation — `sdiLayoutToClasses` maps `layoutState` → Tailwind; `buildJSXFromSDI` builds JSX tree |
| Component Registry RAG | O.3b | `flint_query_registry` MCP tool — keyword search over `flint-manifest.json`; returns component interface + tokens |
| LSP Orchestrator | P | TypeScript + Vue LSP clients for cross-file intelligence |
| Annotation Engine | COLLAB.1-3 | Annotation data model + `flint://annotations` MCP resource + `flint_annotate` MCP tool |
| Annotation Rendering | COLLAB.4 | `annotationStore`, `AnnotationList`, LayerTree annotation dots, `fs.watch` push sync |
| MCP Discoverability | -- | `flint://capabilities` resource + `flint-workflow-guide` prompt for agent self-discovery |

**Test baseline:** 366/366 MCP tests passing · 17 test files · TSC 0 errors

---

## 4. Roadmap

Phases are ordered by dependency and ROI. All roadmap work targets the headless MCP engine or the Glass observability layer — no IDE panel work.

### 4.1 Recently Completed

**COLLAB.4 — Annotation Rendering (COMPLETE)**
Annotation engine wired into Glass: `annotationStore` Zustand store, `AnnotationList` component, LayerTree annotation dots, `fs.watch` push sync from MCP annotation writes.

**JTBD Gap-Fill Wave 1 (COMPLETE)**
Activity Feed upgrade (filter bar, search, error view buttons). Figma Connection Status (IPC endpoint, StatusBar popover, staleness colors). Ghost Canvas (severity heat tints, ViolationTooltip, click-to-properties, viewport culling). MCP Discoverability (`flint://capabilities` resource, `flint-workflow-guide` prompt).

**JTBD Gap-Fill Wave 2 (COMPLETE)**
Annotation rendering in Glass (see COLLAB.4 above). Governance Health Dashboard (health score ring, grade letter, top-5 rules, "health" tab in right sidebar). JTBD score: 7.5 -> 8.4.

**JTBD Gap-Fill Wave 3 (REMAINING)**
W.1 (Action Flint) + W.3 (Workflow Templates). See `.flint-context/architect-reviews/JTBD-GapFill-Plan.md`.

### 4.2 Sprint Window 1 — Foundation Layer (Weeks 1–3)

These three phases build shared infrastructure required by everything downstream.

**INFRA.1 — Governance Events Table**
Add `governance_events` SQLite table to `flint-registry.db`. Fields: `id`, `timestamp`, `event_type`, `rule_id`, `node_id`, `file_path`, `session_id`, `actor`. Serves GOV.1-4 and V.2.

**INFRA.2 — Mutations Ledger Table**
Add `mutations_ledger` table to `flint-registry.db`. Fields: `id`, `timestamp`, `file_path`, `node_id`, `operation_type`, `source_intent_hash`, `registry_artifact_id`, `mrs_score`, `approved_by`, `justification`. Update `FileTransactionManager` to write a record on every atomic commit. Serves V.1, V.2, V.4, GOV.3.

**GOV.1 — Rule Provenance**
Extend every violation emitted by MithrilLinter and A11yLinter with provenance metadata: `ruleId`, `sourceAuthority` (WCAG 2.1 AA / SOC2 / FDA SaMD), `regulatoryReference`, `lastUpdated`. Expose in Export Gate modal "Compliance Summary" section and in Glass HUD hover. Enable PDF/JSON "Audit Report" export. Effort: 1–2 weeks.

**GOV.2 — Override Telemetry**
Capture every `data-flint-override` bypass: which node, which rule, which session, timestamp, project context. Write to `override_events` table. Surface as "Overrides (N)" badge in Glass status bar and filterable dashboard view. Effort: 1 week. The governance claim: every bypass is logged and auditor-visible.

**V.2 — Mutation Provenance Ledger**
Wire INFRA.2 into the MCP surface. Implement `flint://provenance` paginated MCP resource. Add `flint_query_provenance` MCP tool for forensic lookups by `node_id` or time range. Acceptance: every committed mutation has a provenance record queryable within 200ms. Effort: 1–2 sprints.

### 4.3 Sprint Window 2 — Risk Scoring + Debt Report (Weeks 3–5)

**EXP.2 — Design Debt Quantification Report**
`flint report <glob>` scans entire codebase and produces: total violations, breakdown by severity/category/file/rule, trend over time, and a Design Health Score (0–100). Formula: `100 - (criticals × 10 + ambers × 3 + warnings × 1)` clamped to 0–100. Output formats: JSON, Markdown, HTML dashboard. Trend tracking via `.flint/debt-history.json`. MCP tool: `flint_debt_report`. Effort: 1 sprint.

**V.1 — Probabilistic Risk Scoring**
Introduce Mutation Risk Score (MRS 0.0–1.0) accompanying every proposed AST mutation. Score aggregates: linter violation severity, AST blast radius (downstream nodes affected), registry confidence (component familiarity), baseline deviation. Three tiers: Green (0.0–0.3, auto-approve eligible) / Amber (0.31–0.69, requires human review) / Red (0.7–1.0, requires senior sign-off + logged justification). Surface score in MCP `tool_result`. Implement `RiskCompositor` service + `BlastRadiusAnalyzer`. Acceptance: 100% of mutation approvals carry MRS. Effort: 2–3 sprints.

### 4.4 Sprint Window 3 — Validation + Migration (Weeks 5–8)

**GOV.3 — Session-Level Mutation Validation**
After each batch mutation, run a validation pass checking: all `data-flint-id` values unique, no orphaned nodes, import statements match actual usage. Wire into existing `applyMutationBatch`. Store session mutation history as ledger. Validation failures surface as a new error category in the Mithril Safety Score. Effort: 1–2 weeks.

**EXP.3 — Tailwind v3 to v4 Migration**
`flint migrate-tw <glob> --from 3 --to 4` — AST-level class transformation (Babel visitor on JSX `className`), not regex. Migration rule set covers deprecated classes: `bg-opacity-X` → `bg-color/X`, `flex-grow` → `grow`, etc. Config migrator: `tailwind.config.js` → CSS-based v4 pattern. Post-migration audit runs `audit_ui_component` to prove zero token violations. Dry-run mode for safe preview. Effort: 2 sprints.

### 4.5 Sprint Window 4 — Domain Abstraction + Consensus (Weeks 8–11)

**V.3 — Domain-Agnostic AST Abstraction**
Introduce Universal AST Adapter layer decoupling the mutation engine from Babel/JSX. Define canonical `FlintNode` schema — syntax-neutral intermediate representation. `LinterPlugin` interface accepts any rule set. `PluginRegistry` in `flint-manifest.json` maps domain profiles (`clinical_samd`, `iac_soc2`, `legal_contract`) to parser/linter configs. Ship two reference adapters: JSON-schema adapter + plain-text clause parser. Acceptance: new domain adapters register without modifying core engine files. Effort: 3–4 sprints.

**V.4 — Multi-Agent Epistemic Consensus**
For mutations scoring Amber or Red on MRS: route to stateless secondary agent for independent safety evaluation. Secondary agent receives only current AST snapshot + proposed mutation — no primary agent reasoning history. Log both agent verdicts and disagreements to Provenance Ledger. Configurable per domain profile. Acceptance: zero cases where a Red-tier mutation reaches the filesystem without a logged second-agent verdict. Effort: 2–3 sprints. Depends on V.1 and V.2.

**EXP.4 — White-Label / Multi-Brand Theming**
`flint theme-validate <glob> --themes brand-a.json,brand-b.json` validates a single codebase under multiple brand token sets. Each theme is a DTCG token file. Flint swaps tokens, re-audits, and tags violations by theme. Cross-theme matrix report: "Brand B has 12 violations Brand A doesn't." Theme diff tool for comparing token coverage gaps. MCP tool: `flint_validate_themes`. Effort: 2 sprints.

### 4.6 Sprint Window 5 — Anomaly Detection + DS Migration (Weeks 11–14)

**GOV.4 — Statistical Anomaly Detection**
Establish baseline statistics from historical mutations (average mutations per session, typical override frequency, normal violation distribution). Flag anomalies using 3σ threshold: sudden override spikes, unusual rule violation patterns, drift in Token Integrity Ratio. Surface as "Health" tab in Glass governance dashboard; ambient amber alert (non-blocking). Weekly/monthly trend reports. Effort: 2 weeks.

**EXP.5 — Design System Version Migration**
`flint migrate-ds <glob> --from tokens-v4.json --to tokens-v5.json` — token diff engine maps old tokens to new ones, surgically updates all consuming code. Handles renamed, removed, changed, and new tokens. Token diff report shows exactly what changed. Post-migration audit proves output is compliant with the new token set. Reuses Phase EXP.3 class transformer infrastructure. Effort: 2 sprints.

### 4.7 Sprint Window 6 — Compliance + Cross-Platform (Weeks 14–18)

**EXP.6 — Accessibility Compliance Automation**
Extend 10-rule A11yLinter to 50+ WCAG 2.1 AA rules with auto-fix. Add: focus management, APCA color contrast (WCAG 3.0 readiness), ARIA roles, landmark regions, live regions, keyboard navigation, motion preferences. Auto-fix transforms: add missing labels, fix heading hierarchy, add ARIA attributes. VPAT/ACR report generation. Domain-specific rule sets for Section 508 (government), HIPAA (healthcare), ADA Title III. MCP tool: `flint_accessibility_report`. Effort: 3 sprints. Can parallelize with EXP.3-5.

**EXP.7 — Cross-Platform Token Sync**
DTCG tokens → 5 platform output formats: Tailwind (web), CSS custom properties, React Native StyleSheet, Swift UIColor, Kotlin Color. Platform-specific parsers: `.swift`, `.kt`, `.css`, RN StyleSheet patterns. Cross-platform audit detects hardcoded values that should be token references. Sync report: per-platform token coverage comparison. MCP tool: `flint_cross_platform_report`. Effort: 3 sprints.

### 4.8 Sprint Window 7 — Bidirectional Figma Token Sync (Weeks 18–26)

All sync engine logic lives in the headless MCP server. Glass UI panels (SyncStatusPanel, ConflictModal, SyncHistoryDash) are additive and deferred to the Glass roadmap — they read MCP Resources and call MCP Tools with zero business logic.

**SYNC.1 — Database Schema + OAuth + Figma API Service**
Four new tables in `flint.db` (not `flint-registry.db`): `figma_connections`, `token_source`, `sync_history`, `pending_conflicts`. OAuth 2.0 PKCE flow via `flint_figma_connect` MCP tool. `figmaApiService.ts` wraps Figma Variables API with exponential backoff. MCP tools: `flint_figma_connect`, `flint_figma_link_file`. MCP resource: `flint://figma-connection`. Effort: 1–2 weeks.

**SYNC.2 — Three-Way Diff Sync Engine**
`tokenSyncEngine.ts` performs three-way diff: Figma Variables (current API state) vs. `token_source` last-sync state vs. `design_tokens` table (current code state). Seven diff categories: FIGMA_ADDED (auto-insert), CODE_ADDED (pending conflict), FIGMA_MODIFIED (auto-update), CODE_MODIFIED (pending conflict), CONFLICT (both sides changed, require resolution), FIGMA_DELETED (amber governance flag), ORPHANED (SYNC-002 violation). Webhook extension: `POST /figma-webhook` debounced at 100ms. MCP tools: `flint_sync_pull`, `flint_sync_push`, `flint_resolve_conflict`, `flint_resolve_all`. MCP resources: `flint://sync-status`, `flint://pending-conflicts`, `flint://sync-history`. Effort: 2 weeks.

**SYNC.3 — MithrilLinter SYNC Violation Types**
Two new violation types: `SYNC-001` (Token Out of Sync — ΔE > 2.0 divergence from Figma source, quick fix: "Pull from Figma") and `SYNC-002` (Orphaned Token — no Figma mapping, quick fix: "Promote to Figma"). Include SYNC-001/002 in Token Integrity Ratio calculation. Effort: 1 week.

**SYNC.4 — Governance Reporting + Error Resilience + CI/CD**
`flint sync --check` CLI for CI pipelines (exit 1 on unresolved conflicts). Figma API rate-limit handling with exponential backoff + local cache. Offline queue with retry on reconnect. Process-restart recovery: reload `pending_conflicts` from DB on `tokenSyncEngine` init. Sync history export: JSON/CSV via `flint_export_sync_history`. Effort: 2 weeks.

**SYNC success metrics:**

| Metric | Target |
|--------|--------|
| Figma → Code sync latency (post-webhook) | < 10 seconds |
| Code → Figma promotion success rate | > 99% |
| Conflict durability across process restart | 100% |
| SYNC-001/002 false positive rate | < 2% |
| `flint://sync-status` response time | < 200ms |

### 4.9 Glass Observability Layer — Ongoing

These items apply to Flint Glass specifically (Electron app) and run in parallel with MCP engine work:

**Phase U.3 — Immersive Canvas**
Remove the bottom horizontal split (CodeEditorPanel + TerminalPanel). Set `XYCanvas` to occupy full viewport height. This recovers ~40% of vertical real estate. Source: FLINT-GLASS-PIVOT.md (adopted).

**Phase U.4 — Ghost Code Snippets**
When a node is selected on the canvas, a `GhostCodeSnippet.tsx` overlay surfaces relevant source using a lightweight syntax highlighter. Integrate with `ShieldOverlay.tsx` for "Hover-to-Source" — code is contextual, not permanently embedded. No Monaco panel.

**Phase U.5 — In-Situ Healing**
Connect "Pinch-to-Fix" gesture triggers to Ghost Code Snippets. Visualize AST mutations as a "Ripple Diff" animation on the canvas. Flints tactile spatial interaction with deterministic AST surgery.

**Glass interaction model:**

| Trigger | Glass behavior |
|---------|---------------|
| Select node | Ghost HUD shows relevant source snippet; syncs VS Code cursor position |
| Hover violation badge | Floating HUD with Mithril violation detail + "Heal" trigger |
| Pinch gesture | Triggers AST-level auto-heal; ripple diff visualizes the change |
| File browse | Immersive Tree HUD overlay, not a fixed sidebar panel |

### 4.10 Security Hardening Track — Defense-in-Depth

All SEC phases are independent (no blocking deps) and can run in any order alongside MCP engine work.

**Architecture note:** Flint's process isolation is fundamentally sound — `contextBridge`, no `nodeIntegration`, parameterized SQL, loopback-only ingestion server. SEC phases add defense-in-depth layers to reduce blast radius in the event something upstream (a crafted Figma payload, a future XSS vector) goes wrong.

**SEC.1 — Renderer Hardening (P0, small ≈ 1 day)**
The two highest-leverage security controls for Electron apps, both currently absent.
- `src/components/editor/LivePreview.tsx`: Add `sandbox="allow-scripts allow-forms"` to srcdoc iframe. The critical omission is `allow-same-origin` — without it, iframe code cannot call `window.parent` and reach the renderer context. This single attribute breaks the XSS → renderer escape chain.
- `electron/main.ts`: Add CSP via `session.defaultSession.webRequest.onHeadersReceived`. Restrict `script-src` to `'self'`; block inline script execution in the renderer. CSP is the last line of defense against injected scripts executing in the DOM even if they reach it.
- Files: `src/components/editor/LivePreview.tsx`, `electron/main.ts`
- Contract required: yes (crosses process boundary for CSP handler)

**SEC.2 — Secret Hygiene (P1-P2, small ≈ 0.5 day)**
The ingestion secret is currently hardcoded, logged to stdout, and returned to the renderer — three unnecessary exposures.
- `electron/ingestion-server.ts`: Replace hardcoded `flint-dev-secret-phase2` with `crypto.randomBytes(32).toString('hex')` generated once at process start. Stop logging the secret value to console.
- `electron/main.ts` + `electron/preload.ts`: Remove `secret` field from `figma:status` IPC response — the renderer never needs to display it. Update `src/types/flint-api.d.ts` accordingly.
- Files: `electron/ingestion-server.ts`, `electron/main.ts`, `electron/preload.ts`, `src/types/flint-api.d.ts`

**SEC.3 — MCP Tool Allowlist (P1, medium ≈ 2 days)**
`mcp:call-tool` currently accepts any tool name from the renderer with no server-side validation. A compromised renderer could invoke destructive tools.
- Create `electron/mcp-policy.ts` defining `RENDERER_ALLOWED_MCP_TOOLS: ReadonlySet<string>` — the subset of MCP tools Glass UI legitimately calls (status, read-resource, query-registry, etc.).
- Add allowlist check in `mcp:call-tool` IPC handler in `electron/main.ts`. Reject non-allowlisted names with a typed error returned to the renderer.
- Files: `electron/main.ts`, new `electron/mcp-policy.ts`
- Contract required: yes (new module + IPC handler change)

**SEC.4 — API Key Safe Storage (P1, medium ≈ 2 days)**
The Anthropic API key is currently written to `~/.flint/config.json` as plaintext. macOS provides `safeStorage` (Electron built-in wrapping the OS Keychain) for exactly this case.
- Replace `ai:save-config` / `ai:load-config` IPC handlers in `electron/main.ts` with `safeStorage.encryptString` / `decryptString`. Encrypted blob stored in `config.json`; key never written plaintext.
- Migrate existing plaintext keys on first load: detect unencrypted value, re-encrypt, rewrite.
- Files: `electron/main.ts`

**SEC.5 — Terminal API Hardening (P2, small ≈ 0.5 day)**
`terminal:spawn(cwd)` accepts any path from the renderer — effectively unrestricted shell spawn with no cwd validation. While the terminal is a legitimate feature, the blast radius of renderer compromise is unnecessarily wide.
- `electron/main.ts`: Validate `cwd` in `terminal:spawn` handler is at or below the current `workspaceRoot` (available from `canvasStore` state or passed as a param). Reject with descriptive error if outside project bounds.
- Add max-length guard on `terminal:data` input (8KB ceiling) to prevent memory pressure from malformed input.
- Files: `electron/main.ts`

**SEC.6 — Ingestion Rate Limiting (P3, small ≈ 0.5 day)**
Cosmetic hardening — the loopback-only binding already limits exposure, but a tight rate limit prevents a local runaway process from spamming the ingestion endpoint.
- `electron/ingestion-server.ts`: Add a simple token-bucket rate limiter per-session: 10 req/min for `/ingest`, 60 req/min for `/ingest-ast`. Respond `429 Too Many Requests` when exceeded.
- Files: `electron/ingestion-server.ts`

| Phase | Priority | Effort | What it closes |
|-------|----------|--------|----------------|
| SEC.1 | P0 | ~1 day | iframe escape chain + XSS execution |
| SEC.2 | P1 | ~0.5 day | secret logging + renderer secret exposure |
| SEC.3 | P1 | ~2 days | renderer-initiated destructive MCP tool calls |
| SEC.4 | P1 | ~2 days | plaintext API key on disk |
| SEC.5 | P2 | ~0.5 day | unrestricted shell cwd + oversized terminal input |
| SEC.6 | P3 | ~0.5 day | local process DoS on ingestion endpoint |

---

### 4.11 Chat UX Track — Conversational Experience

**Context:** Flint has an excellent governance engine and a primitive conversational interface. These phases make every tool response a first-class conversational turn — with a voice, a summary, project-level context, and actionable error signals. Full rationale and issue stack in `docs/strategy/CHAT-UX-CRITIQUE.md`.

All CX phases target the headless MCP engine. Zero Glass changes required.

---

**CX.1 — Response Quality Baseline (P0, small ≈ 1 sprint)**

The highest-ROI, lowest-effort chat improvement: change what Flint *says*, not what it *does*.

- **`summary` field on all tool responses:** Every tool response gets a one-sentence human-readable statement alongside the technical payload. Designers stop seeing raw SARIF. Agents can relay results to users without translation.
  ```json
  { "summary": "Found 3 violations in Button.tsx. 2 can be auto-fixed.", "violations": [...] }
  ```
- **`project_context` footer on audit/fix responses:** Local task responses include health score, total violation count, and blocked-file count. Agents stop optimizing locally while the project burns.
  ```json
  { "file_result": {...}, "project_context": { "total_violations": 47, "blocked_files": 3, "health_score": 62, "grade": "D" } }
  ```
- **MCP server `initialize` onboarding pointer:** Add one sentence to the server description field: *"New? Start with the `flint-workflow-guide` prompt or read `flint://capabilities`."* Cost: 1 line. Every agent gets the map at connection.
- **`dry_run` flag on `flint_ast_mutate` and `flint_fix`:** Returns a preview of what would change without writing to disk. Gives agents a natural confirmation checkpoint before destructive mutations.
- Files: `flint-mcp/src/server.ts`, `flint-mcp/src/tools/audit.ts`, `flint-mcp/src/tools/fix.ts`, `flint-mcp/src/core/ast-modifier.ts`
- Contract required: yes (new response fields across multiple tools)

**CX.2 — `flint_plan` Orchestration Tool (P1, medium ≈ 2 sprints)**

The most significant gap in Flint's chat experience: there is no orchestration layer. For multi-step tasks (bulk token migration, full design system compliance sweep), every agent reinvents the execution loop from scratch. Some miss re-audit. Some miss recovery. All duplicate planning logic that Flint already knows.

`flint_plan` accepts a high-level intent string and returns a structured execution plan: the ordered tool sequence, the decision points that require judgment, the expected inputs/outputs at each step, and the success criteria.

```
Input: "Migrate all hardcoded colors in src/components/ to design tokens"

Output:
{
  "intent": "token-migration",
  "steps": [
    { "step": 1, "tool": "flint_audit", "params": { "glob": "src/components/**/*.tsx" }, "purpose": "Identify all color violations" },
    { "step": 2, "decision": "Review violations — confirm token mappings for ambiguous colors", "required": true },
    { "step": 3, "tool": "flint_fix", "params": { "healOnAudit": true }, "purpose": "Apply auto-fixable tier-1 violations" },
    { "step": 4, "tool": "flint_ast_mutate", "purpose": "Apply manual fixes for tier-2/3 violations requiring judgment" },
    { "step": 5, "tool": "flint_audit", "purpose": "Re-audit to verify zero regressions" },
    { "step": 6, "tool": "flint_debt_report", "purpose": "Confirm health score improvement" }
  ],
  "estimated_scope": "~47 files, ~200 violations",
  "risk_level": "medium"
}
```

Intent types to support at launch: `token-migration`, `accessibility-sweep`, `full-governance-audit`, `figma-sync`, `debt-remediation`.

- Files: `flint-mcp/src/server.ts`, new `flint-mcp/src/tools/plan.ts`, new `flint-mcp/src/core/planService.ts`
- Contract required: yes (new MCP tool + service)

**CX.3 — Error Taxonomy + Rule Explanations (P1, small ≈ 1 sprint)**

Two quality improvements that compound over time as the rule library and tool surface grow.

- **Error taxonomy:** Every tool failure gets a structured code (`FLINT-ERR-001`), a plain-language description, and a recovery instruction. Replace raw stack traces with actionable diagnostic output. Errors become inputs, not dead ends.
- **Per-rule `explanation` field:** Every governance rule gets a 1-2 sentence statement of *why* the rule exists — the business or user impact, not the technical violation. Surfaced in `flint_audit` and `flint_audit_report` responses. Developers who understand the rule internalize the pattern instead of working around it.
- Files: `flint-mcp/src/core/MithrilLinter.ts`, `flint-mcp/src/core/A11yLinter.ts`, `flint-mcp/src/tools/audit.ts`, new `flint-mcp/src/core/errorCodes.ts`
- Contract required: no (additive fields + new error module)

| Phase | Priority | Effort | What it closes |
|-------|----------|--------|----------------|
| CX.1 | P0 | ~1 sprint | Vocabulary tax, silent state, unconfirmed mutations |
| CX.2 | P1 | ~2 sprints | Multi-step task coordination gap (`flint_plan`) |
| CX.3 | P1 | ~1 sprint | Error recovery blindness, "why" gap |

---

## 5. Master Dependency Graph

```
INFRA.1-2 (SQLite tables — build first)
  │
  ├── GOV.1 (Rule Provenance)
  ├── GOV.2 (Override Telemetry)
  ├── V.2 (Mutation Provenance) ────── V.1 (Risk Scoring) ──── V.4 (Consensus Gate)
  │                                          │
  │                                     GOV.3 (Session Validation)
  │                                          │
  │                                     GOV.4 (Anomaly Detection)
  │
  EXP.1 (DONE) ──── EXP.2 (Debt Report)
                           │
                      EXP.3 (TW Migration)
                           │
                      EXP.5 (DS Migration)
                           │
                      EXP.4 (White-Label Theming)
                           │
                      EXP.7 (Cross-Platform)
                           │
                      SYNC.1-4 (Bidirectional Figma Sync)

  V.3 (Universal AST) ─── parallel, no deps, start early
  EXP.6 (Accessibility) ── parallel, no deps, start any time

  Glass U.3-5 ─────────── parallel, no MCP deps

  SEC.1 (Renderer Hardening) ─┐
  SEC.2 (Secret Hygiene) ─────┤── all independent, no deps, run any time
  SEC.3 (MCP Allowlist) ──────┤
  SEC.4 (Safe Storage) ───────┤
  SEC.5 (Terminal Hardening) ─┤
  SEC.6 (Rate Limiting) ──────┘
```

**With 2 parallel tracks (MCP engine + Glass), total timeline: ~14 weeks.**

---

## 6. Strategic Positioning

### 6.1 Market Context (March 2026)

| Stat | Source |
|------|--------|
| 41% of all code is AI-generated (2025) | GitHub / multiple |
| 100% of code at Anthropic and OpenAI is now AI-written | Fortune, Jan 2026 |
| AI code introduces 1.7x more issues than human code | Second Talent |
| 75% of tech leaders expect severe AI-driven tech debt by 2026 | Gartner |
| 5,114 ADA lawsuits filed in 2025 — 37% YoY growth | UsableNet |
| EU Accessibility Act in force since June 2025 — fines up to EUR 3M | Level Access |
| 6,400+ MCP servers registered as of Feb 2026 | CData |
| MCP adopted by OpenAI, Google, Microsoft, Amazon, Anthropic | Pento |

The AI code flood is accelerating faster than human review capacity. Flint's deterministic governance layer becomes more valuable — not less — as AI code generation volume grows.

### 6.2 Competitive Moat

No competitor occupies Flint's intersection across all seven capability dimensions:

| Tool | Token Gov | AST Gov | WCAG Gate | Figma Sync | MCP Native | Deterministic | Color Science |
|------|-----------|---------|-----------|------------|------------|---------------|---------------|
| **Flint** | **Full** | **Full** | **Yes** | **Full** | **Yes** | **Yes** | **CIEDE2000** |
| Knapsack | Docs | None | None | Docs | No | N/A | None |
| Supernova | Files | None | None | Import | No | N/A | None |
| Chromatic | None | None | None | None | No | N/A | Pixel diff |
| SonarQube | None | Generic | None | None | No | Yes | None |
| Snyk Code | None | Security | CI block | None | No | Yes | None |
| axe-core | None | DOM | Post-render | None | No | Yes | None |

**Four durable differentiators:**

1. **Deterministic, not probabilistic.** LLM-based code review produces different outputs for the same code on different runs — inadmissible for compliance. Flint produces identical results every time from identical inputs.

2. **Shift-left beyond CI/CD.** axe-core checks after rendering. SonarQube checks after writing. Flint checks during AI generation — at the MCP tool call layer, before code is committed.

3. **Perceptual color science.** CIEDE2000 distinguishes a brand violation (ΔE=5.0) from an imperceptible rounding error (ΔE=0.3). Pixel-diff tools cannot make this distinction. No competitor uses perceptual color science.

4. **MCP-native distribution.** One MCP server = zero-friction distribution across Claude Code, Cursor, VS Code, Windsurf, and every future MCP-compatible agent. No IDE plugin installs required.

### 6.3 Five Investor Narratives

1. **"The Type Checker for Design Systems"** — TypeScript turned runtime errors into compile-time errors. Flint does the same for brand drift and accessibility violations. Wrong blue in production becomes wrong blue blocked before commit.

2. **"AI Generates Code. Flint Governs It."** — Every dollar invested in Cursor ($1.1B), Copilot, v0, and Claude Code increases demand for governance. Flint is the picks-and-shovels play in the AI code generation wave.

3. **"The Missing Safety Layer for AI-Generated UI"** — With 5,100+ ADA lawsuits/year, 37% YoY growth, and EUR 3M EU fines, accessibility compliance carries legal liability. Flint is the answer to "Who is responsible when AI-generated UI violates ADA?"

4. **"Design Debt is the Next Technical Debt"** — Technical debt has SonarQube. Design debt has nothing. Flint's Health Score (0–100) makes design debt visible, measurable, and actionable. Category creation.

5. **"The Snyk for Design Compliance"** — Snyk ($8.5B valuation) proved deterministic AST scanning + CI/CD blocking = multi-billion-dollar business. Flint applies the identical pattern to design/accessibility compliance. Same architecture, adjacent market, proven model.

### 6.4 Headwinds and Counters

| Objection | Counter |
|-----------|---------|
| "Can't ESLint do this?" | ESLint cannot calculate CIEDE2000 color distance, traverse JSX semantics for design intent, or participate in MCP agent loops. ESLint is spell-check. Flint is a contract reviewer. |
| "Feature, not a company. Figma/Vercel will build it." | Figma optimizes for keeping designers in Figma. Vercel optimizes for deployment speed. Neither has incentive to build a neutral governance layer that works across all tools. Flint's neutrality is structurally impossible for any single-platform vendor. |
| "Market too small." | Design governance alone is ~$500M TAM. But the parser-agnostic V.3 engine extends to IaC security (Terraform), HIPAA UI, Section 508, and PCI DSS. Real TAM is "deterministic governance for AI-generated artifacts." |
| "Developer tools are hard to sell." | Three zero-friction distribution channels: (1) CLI gate (`npx flint-mcp audit`) — 5 minutes to integrate. (2) MCP auto-discovery — agents find Flint via the MCP ecosystem. (3) Design debt report creates a "show your boss" artifact for top-down adoption. |

### 6.5 Expansion Roadmap (Beyond Web)

The V.3 domain-agnostic AST abstraction unlocks Flint's engine for regulated, high-stakes sectors beyond web UI. Each new domain is a domain profile in `flint-manifest.json`:

| Domain | Rule Profile | Linter Focus |
|--------|-------------|-------------|
| Infrastructure as Code | `iac_soc2` | Terraform misconfigurations, SOC2 policy violations |
| Healthcare | `clinical_samd` | FDA Software as a Medical Device UI requirements |
| Finance | `fintech_pci` | PCI DSS UI element requirements |
| Legal | `legal_contract` | Clause structure consistency, regulatory citation |
| Government | `gov_508` | Section 508 + EU Accessibility Act |

---

## 7. Ejected Plans

The following items were in earlier planning documents and have been explicitly removed from the active roadmap.

| Ejected Item | Source | Reason |
|-------------|--------|--------|
| Permanent split-pane Monaco editor in Glass | FLINT-GLASS-PIVOT.md (deprecation noted in that doc itself) | Superseded by Ghost Code HUDs; IDE handles editing |
| Terminal panel as permanent Glass pane | Multiple pre-pivot docs | IDE handles terminals; Terminal moves to minimized overlay at most |
| File explorer panel in Glass | Pre-pivot architecture | IDE handles file navigation; Glass is observability-only |
| Embedded AI chat in Glass (AgentChatPanel) | CLAUDE.md (old), HANDOFF.md (old) | Chat lives in host IDE (Claude Code / VS Code) |
| Flint IDE v5 Gap Analysis (full document) | `Flint IDE v5 Gap Analysis.md` | Pre-pivot analysis from Feb 2026. Every gap it identified is now ONLINE. The document's framing (building a standalone IDE) is superseded by the MCP-first model. |
| Architect Status Report 2/27 | `Plan Logs/Flint IDE — Architect Status Report 2:27.md` | Pre-pivot; identifies gaps now ONLINE; framing based on old 3-panel IDE architecture |
| Phase C.1 Cloud PowerSync (as a roadmap item) | Previous CLAUDE.md | PowerSync is ONLINE. This is no longer a future phase. |
| Phase L.6 TaskHeader / Antigravity Parity | CLAUDE.md | Chat/agent UI lives in host IDE; TaskHeader is an IDE concern |
| Phase U.1 Ghost Canvas / U.2 Spatial Overlays (as separate phases) | Previous planning | Consolidated into U.3-U.5 Glass roadmap; simpler naming |
| Multi-library Figma Team Libraries (future Q extensibility) | PhaseQ-AssetManager-Plan.md | The Asset Hub is ONLINE; future library linking deferred indefinitely |
| Lottie/SVG animation support | PhaseQ-AssetManager-Plan.md | Not relevant to governance mission; no committed phase |
| Three-pane Glass with embedded code editor/terminal | PhaseQ-AssetManager-Plan.md | Glass uses 3-panel design-tool layout (Layers/Canvas/Properties) but no code editor or terminal — IDE handles those |
| Phase N.2 Logic Extraction Scratchpad | HANDOFF.md Immediate Next Steps | Listed as next step in a stale HANDOFF; not prioritized over EXP/GOV/V phases above; can be re-evaluated |

---

## 8. Key Files Reference

### Flint MCP Engine
| File | Role |
|------|------|
| `flint-mcp/src/server.ts` | MCP tool and resource registrations |
| `flint-mcp/src/core/ast-modifier.ts` | `assembleLayout`, `apply_ast_mutations` |
| `flint-mcp/src/core/registryService.ts` | `flint_query_registry` keyword search |
| `flint-mcp/src/core/MithrilLinter.ts` | CIEDE2000 + typography/spacing/shadow/opacity visitors |
| `flint-mcp/src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules |

### Electron Main Process
| File | Role |
|------|------|
| `electron/main.ts` | IPC handlers: saveFile, saveFileBatch, readFile, ast:git-show, ast:git-log |
| `electron/orchestrator.ts` | Phase M — constrained AI orchestration with TSC validation loop |
| `electron/FileTransactionManager.ts` | Atomic `.tmp` → `rename` write queue |
| `electron/GitManager.ts` | `ensureRepo`, `shadowCommit`, `getGitNode` |
| `electron/ingestion-server.ts` | Figma ingestion + SDI webhook (port 4545) |
| `electron/store.ts` | SQLite database (`flint.db`) |

### Glass UI
| File | Role |
|------|------|
| `src/components/editor/XYCanvas.tsx` | Infinite canvas — `@xyflow/react` v12 whiteboard |
| `src/components/editor/LivePreview.tsx` | `srcdoc` iframe preview engine |
| `src/components/ui/ExportModal.tsx` | Export Gate — Mithril + a11y pre-flight audit |
| `src/components/ui/RecoveryPanel.tsx` | Git Time Machine UI |
| `src/components/ui/AgentChatPanel.tsx` | DEPRECATED target — migrate chat to host IDE |
| `src/components/inspector/LayoutPanel.tsx` | Figma-grade Auto Layout controls |
| `src/components/editor/AssetsPanel.tsx` | Asset Management Hub |

### Core Services
| File | Role |
|------|------|
| `src/core/ASTService.ts` | `applyMutationBatch`, `applyInversions`, `synthesizeImports` |
| `src/core/recoveryController.ts` | Undo/redo orchestration — single-file + cross-file |
| `src/store/editorStore.ts` | Active-file AST, Visual Tree, `applyBatch`, `syncCode` |
| `src/store/canvasStore.ts` | Workspace tree, active file, `saveState` lifecycle |
| `src/store/astBufferStore.ts` | Headless multi-file AST buffers, `crossFileMove` |
| `src/utils/layoutMapper.ts` | Atomic Tailwind layout class management |

---

*This document is the single source of truth for Flint's direction. When planning work, check here first. When completing work, update the "Current State" section. When ejecting plans, add them to Section 7.*
