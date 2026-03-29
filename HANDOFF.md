# Flint — Developer Handoff

**Date:** 2026-03-21
**Architecture:** Flint MCP (headless governance engine) + Flint Glass (Electron observability layer) + Flint Web (browser distribution)
**Test baseline:** 3,612/3,612 MCP | 1,537/1,537 Glass | 1,087/1,087 Core | 56/56 CI — TSC 0 errors

---

## Session: 2026-03-29 — Sprint 5 Governance Comprehension (COMPLETE)

**Goal:** Make governance actionable — violation actions, save/apply distinction, pin mode, message expansion, activity undo.

**Files changed:** `src/components/ui/GovernanceDashboard.tsx`, `src/components/ui/GovernancePanel.tsx`, `src/components/ui/__tests__/GovernancePanel.test.tsx`, `src/App.tsx`

**What shipped:**
- **S5.1–S5.4:** Already implemented in prior sessions (zero-state, action-framing, clickable top rules, Fix All button)
- **S5.5:** Defer button on each violation row (`window.flintAPI.deferViolation?.()`); Override uses existing `recordOverride` telemetry IPC
- **S5.6:** Rule descriptions already live in `RULE_DESCRIPTIONS` map in GovernancePanel
- **S5.7:** Amber persistence banner ("Toggles apply immediately · Save to persist") + `Save (N)` count badge on Rules tab; "no Save required" info band on Packs/Profiles tabs
- **S5.8:** "Configure rules" text link in violations footer → `onOpenGovernancePanel` callback (wired in App.tsx)
- **S5.9:** Pin button on every violation row — `pinnedViolations` Set keeps detail panel open; `isOpen = expanded || pinned`
- **S5.10:** Message text changed from `truncate` to `line-clamp-2` (2-line threshold before ellipsis)
- **S5.11:** "Undo this" button on mutation-type activity entries → calls `applyUndo()` from recoveryController

**Test results:** Glass: 78/78 passing (6 new GovernancePanel tests) | TSC: 0 errors

**What remains:** Sprints 6–8 (primitive design system, Figma sync surface, canvas governance)

**Known issues / next agent notes:**
- All session changes across Sprints 1–5 uncommitted — needs git commit + review gate before merge

---

## Session: 2026-03-28 — WEB-GLASS-LAUNCH-SPRINT (COMPLETE)

**Goal:** Implement the full Web Glass Launch Sprint — 4 workstreams making `npx flint-glass --demo` work end-to-end.

**Files changed:** `flint-mcp/src/server.ts`, `flint-mcp/src/prompts/onboard-project.ts` (new), `flint-mcp/src/__tests__/greeting.test.ts`, `flint-mcp/src/tools/{enrich,emitTokens,reindex,universalAudit}.ts`, `server/index.ts`, `server/services/thumbnailService.ts`, `server/__tests__/ws3-server.test.ts` (new), `src/adapters/web-api.ts`, `src/adapters/__tests__/web-api.test.ts` (new), `src/components/editor/__tests__/StatusBar.test.tsx`, `src/components/ui/__tests__/LaunchScreen.test.tsx`, `bin/flint-glass.js` (new), `server/cli.ts`, `package.json`, `.github/workflows/build-release.yml`, `docs/START-HERE.md` (new), `CLAUDE.md`

**What shipped:**
- **WS1 (Demo-First Onboarding):** Verified already implemented — first-launch auto-loads demo via `beta:load-demo-project`. Added 10 tests for StatusBar "Connect IDE" chip and LaunchScreen "Connect to IDE" CTA.
- **WS2 (MCP Greeter):** `buildGreeting()` rewritten with trigger words, dynamic tool count (54), 2KB cap. Tool descriptions cleaned of phase codes across 4 files. `flint-onboard-project` prompt created and registered (joins existing `flint-quick-audit` and `flint-fix-all`). +5 tests.
- **WS3 server:** `components:health` handler implemented (manifest → MCP audit → per-component grades). Two Playwright API bugs fixed (`setViewport` → `setViewportSize`, `networkidle0` → `networkidle`). `project:reindex` and MCP event push verified already complete. +26 tests.
- **WS3 client:** `openFolder()` rewired with deferred promise pattern (emits `flint:open-folder-request`, LaunchScreen resolves). Thumbnails adapter wired to server endpoint. +17 tests.
- **WS4 (Distribution):** `bin/flint-glass.js` ESM entry point, `dist-server/cli.mjs` built via esbuild, `--demo`/`--version`/`--open` flags, `package.json` bin+files fields, CI `build-release.yml` updated with web artifact, `docs/START-HERE.md` getting-started guide.
- **CLAUDE.md:** Added `htmlIntrinsics.ts` to Key Files table (drift fix from prior session).

**What remains:** Nothing — all 4 workstreams complete. WS4 integration testing (actual `npx` execution) deferred to next session.

**Known issues / next agent notes:**
- 13 pre-existing test failures in GovernanceDashboard/GovernancePanel — tracked in GLASS-SPRINT-1
- `'semantic-drift'` type drift still unresolved (renderer LinterWarning.type vs flint-mcp/src/types.ts)
- All changes uncommitted — needs git commit + review gate before merge

---

## Session: 2026-03-29 — Sprint 4 (Zone Hierarchy) — COMPLETE

**Goal:** Complete all 15 Sprint 4 items.

**What shipped:**
- **S4.1:** Figma dot glow verified absent, test added
- **S4.2:** StatusBar reordered Export Gate → Figma → Flint → Connect IDE → others
- **S4.3:** FileExplorer removed from Glass left panel (`'files'` LeftTab eliminated)
- **S4.4:** A11y indicators in LayerTree (`ShieldAlert` beside existing Mithril badge)
- **S4.5:** "Add note" inline composer in AnnotationList (Enter submits, Escape cancels)
- **S4.6:** SetupWizard double-overlay fixed — outer App.tsx wrapper removed
- **S4.7:** Fake macOS traffic lights + "Live Preview · srcdoc Engine" removed from XYCanvas
- **S4.8:** Already done in Sprint 1 (S1.17)
- **S4.9:** Toast severity policy — critical=persistent, error=8s, warning=5s, info=3s, undo=5s
- **S4.10/S4.15:** Already correctly implemented (governance first, context auto-switch)
- **S4.11:** Activity feed empty state in GovernanceDashboard
- **S4.12:** Scope tab empty state updated
- **S4.13:** Tokens tab empty state updated
- **S4.14:** Export Gate click when blocked → `setRightTab('governance')` (not properties)

**Test baseline:** Glass 78/78 | 1455/1455 | TSC 0 errors

**What remains:** Sprint 5 (Governance Comprehension) — 11 items.

---

## Session: 2026-03-28/29 — Sprints 1–3 COMPLETE

**Goal:** 19-agent full UX audit of Flint Glass → cross-reference all prior UX docs → create single master sprint plan → execute Sprints 1–3.

**What shipped:**

- **Sprint 1 (Critical Bugs):** All 19 items — ARIA tablist/role=tab, OnboardingNudge→SetupWizard, disconnect confirm dialog, dedup Figma sync notifications, token value validation, GovernanceDashboard export button, array coercion fix, override count boolean→real count, GovernancePanel backdrop aria-hidden, ComponentPanel insert targetNodeId, inspector ARIA, TokenManager dialog ARIA, ExportModal Fix button, error toast persistence, canvasStore LeftTab type, undo toast 5000ms.
- **Sprint 2 (Dead Code Purge):** 26 files deleted, 8,442 lines removed.
- **Sprint 3 (Vocabulary Normalization):** All 19 items — "Color Alignment", "Change undone/reapplied", "Element Properties", ClassBuilder de-emphasis, hover-only tag badges/line numbers, "Flint" in StatusBar, "New Issues Only" delta badge, "Manual Style Overrides", "Token File (JSON)", planned rules hidden under collapsible.

**Test baseline at Sprint 3 completion:** Glass 77/77 passing | TSC 0 errors.

**Files changed (selected):** `DriftDetector.tsx`, `GovernanceDashboard.tsx`, `GovernancePanel.tsx`, `StatusBar.tsx`, `App.tsx`, `LayerTree.tsx`, `PropertiesPanel.tsx`, `primitives.tsx`, `TokenManager.tsx`, `CommandPalette.tsx`, `canvasStore.ts`, `notificationStore.ts`.

**What remains:** Sprints 4–8. Sprint 4 is next.

---

## Session: 2026-03-28 — Full UX Audit + Sprint Plan (COMPLETE)

**Goal:** 19-agent full UX audit of Flint Glass → cross-reference all prior UX docs → create single master sprint plan → begin Sprint 1 critical bug fixes.

**What shipped:**

- `docs/strategy/GLASS-UX-AUDIT-2026-03-28.md` — Full UX audit across 19 workflow/feature areas (info hierarchy + zone hierarchy lenses)
- `docs/strategy/GLASS-SPRINT-PLAN.md` — **Master execution document.** Consolidates all findings from GLASS-UX-AUDIT, GOVERNANCE-UX-REVIEW, UX-OPPORTUNITIES, and GLASS-BRILLIANCE-PLAN into 8 prioritized sprints, 60+ tagged items. This is the single source of truth for all Glass UX work.

**Cross-reference findings:**

- Many "new" audit findings are [KNOWN] items that were documented in prior docs but never shipped
- GLASS.1 structural redesign left numerous planned items incomplete (empty states, ARIA compliance, Fix All button, dashboard actionability)
- GOVERNANCE-UX-REVIEW.md (2026-03-27) identified 13 OPP-GOV items — most confirmed by audit, several not yet in GLASS sprint plan until now

**What remains:** Sprint 3 (vocabulary normalization) — 13 unclaimed items ready. 6 blocked on WEB-GLASS-LAUNCH-SPRINT territory (StatusBar.tsx, App.tsx).

**Territory note:** WEB-GLASS-LAUNCH-SPRINT is now COMPLETE (see session above). Its territory claims in `ACTIVE-SWARM-TERRITORY.md` should be cleared. Sprint 1 deferred items (S1.10, S1.12, S1.14, S1.15) are now unblocked.

**Single source of truth:** `docs/strategy/GLASS-SPRINT-PLAN.md` — 8 sprints, 60+ items.

---

## Session: 2026-03-28 — Playwright Swap + CR-SEAL Verification + /handoff Command (COMPLETE)

**Goal:** Three small but important items: swap Puppeteer→Playwright in web thumbnail service, confirm CR-SEAL REG-001 pipeline end-to-end, and create /handoff slash command for session-end documentation.

**What shipped:**
- `server/services/thumbnailService.ts` — Playwright replaces Puppeteer (`loadPlaywright()`, `chromium.launch()`). Same Page API, cleaner dependency.
- `package.json` — `puppeteer ^24.9.0` removed, `playwright ^1.52.0` added (was already a devDep, now the sole headless browser dep).
- `.claude/commands/handoff.md` — New `/handoff` command with 3 modes: `start` (declare territory), default (session-end entry + territory clear), `full` (+ CLAUDE.md drift check).
- CR-SEAL REG-001 verified end-to-end: `<Dialog>` and `<Sidebar>` flagged on `_settings-test.tsx`, registered PrimeNG components pass clean.

**What remains:** Nothing — all three items complete.

**Known issues / next agent notes:**
- WEB-GLASS-LAUNCH-SPRINT plan is complete and approved, pending implementation kickoff (see `.flint-context/contracts/WEB-GLASS-LAUNCH-SPRINT.md`).
- Pre-existing type drift: `'semantic-drift'` in renderer's `LinterWarning.type` not in `flint-mcp/src/types.ts` — cleanup pass needed.

---

## Session: 2026-03-28 Phase GLASS — Glass Brilliance (COMPLETE)

**Goal:** Comprehensive UX overhaul of Flint Glass — structural redesign, credibility, and polish. Driven by 3-tier independent review (UX critic, code reviewer, security auditor).

**What shipped (91 files changed, ~98 new tests, 4 swarm waves, 16 parallel agents):**

| Tier | Items | Key Changes |
|------|-------|-------------|
| GLASS.1 Structural | 5 | Right sidebar 7→3 tabs, Build/Govern modes killed, ComponentPanel in left sidebar, unified violations, Fix All button, actionable dashboard |
| GLASS.2 Credibility | 5 | ARIA tree semantics, FocusTrap + modal dialog roles, PanelErrorBoundary, EmptyState component, icon consistency |
| GLASS.3 Polish | 3 | LivePreview loading/stale/error states, panel collapse/expand, production cleanup |
| Review fixes | 8 | Badge navigation, SEC.3 compliance, locked tab CTA, CSS.escape, aria-hidden, innerHTML→textContent, canExport a11y |

**New components created:**
- `src/components/ui/ComponentPanel.tsx` — left sidebar component browser
- `src/components/ui/ComponentPanelCard.tsx` — compact drag-to-insert cards
- `src/components/ui/FocusTrap.tsx` — custom focus trap (no external deps)
- `src/components/ui/PanelErrorBoundary.tsx` — React ErrorBoundary for panels
- `src/components/ui/EmptyState.tsx` — shared zero-data state component
- `src/hooks/useUnifiedViolations.ts` — merged violation hook

**New agents created:** flint-ux-critic, flint-security-reviewer, flint-perf-profiler, flint-release-engineer, flint-docs-keeper, flint-dep-sentinel, flint-e2e-tester

**Review verdicts:** UX B+→A- (after fixes), Code APPROVED (0 blockers), Security APPROVED (after remediation)

**Remaining UX debt (tracked in GLASS-BRILLIANCE-PLAN.md):**
- gray-* vs zinc-* palette normalization across canvas/sidebar boundary
- Orphaned RecoveryPanel/ActivityFeed need final destinations (command palette or statusbar popover)
- GovernanceDashboard approaching 745 lines — decomposition candidate
- Duplicate `extractRuleId` → extract to src/utils/

---

## Session: 2026-03-28 CR-SEAL — Constrained Registry Pipeline Hardening (COMPLETE)

**Goal:** Close 3 gaps in the constrained component generation pipeline so that when a user sets a component library, Flint guarantees code only uses registered components — at generation time, at audit time, and on first AI turn.

### Changes

| Fix | File(s) | What changed |
|-----|---------|-------------|
| **1. Idiom cache pre-warm** | `electron/orchestrator.ts` | `await loadIdiomCache()` in `sendChatMessage()` — first AI turn now gets library-specific constraints. Removed lazy-load fallback. |
| **2. Post-generation registry validation** | `flint-mcp/src/core/hydroPaste.ts`, `flint-mcp/src/tools/designToCode.ts` | New `validateGeneratedComponents()` function. After Mason/D2C generates code, validates every PascalCase component against registry. Non-registry components produce `registryWarnings` in the result. |
| **3. REG-001 audit rule** | `flint-mcp/src/core/MithrilLinter.ts`, `flint-mcp/src/tools/audit.ts`, `flint-mcp/src/server.ts`, `flint-mcp/src/core/errorTaxonomy.ts`, `flint-mcp/src/types.ts` | New `visitRegistryUsage` visitor in Mithril linter. Walks JSX elements, flags PascalCase components not in `flint-manifest.json`. Wired into `auditAll`, `audit_ui_component`, and `flint_audit`. New `'registry'` type in `LinterWarning`. |

### New types/exports

- `RegistryConstraintWarning` — shape for post-generation registry warnings
- `validateGeneratedComponents()` — exported from `hydroPaste.ts`
- `visitRegistryUsage()` — exported from `MithrilLinter.ts`
- `RegistryComponentEntry` — minimal registry entry shape for audit options
- `AuditAllOptions.registry` — optional field to enable REG-001 at audit time
- `DesignToCodeResult.registryWarnings` — new optional field in D2C output
- `LinterWarning.type: 'registry'` — new warning type
- `FLINT-REG-001` — error taxonomy entry for unregistered component usage

### Review fixes (UX + Security + Code Review)

| Finding | Source | Fix |
|---------|--------|-----|
| H-1: Renderer LinterWarning type missing `registry`/`sync`/`inline-style-drift`/`advisory` | Security | Updated `flint-api.d.ts`, GovernanceDashboard TYPE_LABEL, ViolationTooltip typeLabel, useContextSync mithrilTypes |
| S1: HTML_INTRINSICS 3x duplication | Code Review | Created `flint-mcp/src/core/htmlIntrinsics.ts` — canonical source. Orchestrator copy has sync comment. |
| S2: Missing React built-ins | Code Review | `React`, `Suspense`, `StrictMode`, `Profiler` in shared `REACT_BUILTINS` set |
| S3: D2C.6 pipeline skipped validation | Code Review | `handleFigmaJsxTransform` now runs `validateGeneratedComponents` |
| M-2: JSXMemberExpression bypass | Security | `visitRegistryUsage` now extracts root name from `<Dialog.Header>` → `Dialog` |
| C1: Developer-facing language | UX Critic | All messages use Citadel vocabulary ("Armory", "component library") |
| C4: Taxonomy in hot path | Code Review | `getErrorEntryByRuleId` hoisted above `traverse()` |
| L-2: Silent catch on idiom cache | Security | Now logs `console.warn` on failure |

### Test results

```
MCP:   4100/4100 passing (20 new — registryConstraint.test.ts)
Glass: 1509/1533 passing (24 pre-existing, 0 new failures)
Core:  1185/1185 passing (0 new)
TSC:   0 errors
```

---

## Session: 2026-03-27 WEB + PD + EDU + GOV-FIX — Web Build, Progressive Disclosure, Governance Education (COMPLETE)

**Goal:** Ship Glass in the browser, overhaul UX with progressive disclosure, make governance understandable to designers, fix governance correctness bugs.

### 1. Web Build (Phase WEB) — New Distribution Channel

Full Express+WebSocket server that mirrors all 94 Electron IPC handlers, enabling Glass to run in any modern browser without Electron.

| File | Lines | Role |
|------|-------|------|
| `server/index.ts` | 1915 | Express+WS server with 94 IPC handlers |
| `server/mcpClient.ts` | 365 | MCP JSON-RPC client (adapted from electron/mcpClient.ts) |
| `server/cli.ts` | 178 | CLI with `--project`, `--port`, `--open` |
| `server/services/ragStore.ts` | 528 | sqlite-vec RAG with n-gram embeddings |
| `server/services/aiChat.ts` | 371 | Anthropic streaming over WebSocket |
| `server/services/ingestionServer.ts` | 365 | Figma plugin receiver (port 4545) |
| `server/services/previewServer.ts` | 175 | Vite dev server wrapper |
| `server/services/thumbnailService.ts` | 429 | Playwright screenshot to PNG cache |
| `src/adapters/web-api.ts` | 396 | FlintAPI over HTTP+WebSocket |
| `vite.config.web.ts` | 73 | Vite without Electron |
| `src/main.tsx` | -- | 5-line web mode detection |

Commands: `npm run dev:web`, `npm run build:web`, `npm run start:web`.

### 2. UX Progressive Disclosure (Phase PD) — OPP-1 through OPP-17

| ID | What |
|----|------|
| OPP-1 | Status bar debug strings removed |
| OPP-2 | Icon collisions fixed (Health->BarChart2, Scope->Package) |
| OPP-3 | "Open Canvas" -> "New Project", subtitle -> "AI governance for your design system" |
| OPP-4-9 | Empty states for Properties, Health, Activity, Agents, Scope, Tokens panels |
| OPP-10 | Tab unlock system (`unlockedTabs` store slice in canvasStore) |
| OPP-11 | Left panel progressive tabs (Layers always, Assets on registry, Files on MCP) |
| OPP-12 | Status bar progressive elements (Autopilot hidden until first violation) |
| OPP-13 | Tab reorder (Health first, workflow-aligned) |
| OPP-14 | Keyboard shortcut labels on canvas toggle (Cmd+1/Cmd+2/Cmd+3) |
| OPP-15 | Violation -> rule configuration path (gear icon on each violation) |
| OPP-16 | Right panel auto-switch on selection (nothing selected -> Health, selected -> Properties) |
| OPP-17 | Contextual one-time tooltips (`useOnboardingTooltip` hook) |

### 3. Governance Correctness Fixes

| ID | What |
|----|------|
| GOV-FIX-1 | Badge click routes to Health tab (was Properties) |
| GOV-FIX-2 | Export Modal Fix button calls `flint_fix` via MCP (was just selecting node) |
| GOV-FIX-3 | Health score hidden when no tokens (was showing misleading 100/A) |

### 4. Governance Education System (Phase EDU) — EDU-01 through EDU-15

All user-facing internal codenames replaced with plain language: "Mithril" -> "Design Drift", "Warden" -> "Accessibility", "delta-E" -> "Color distance". Tooltips on every severity badge, chip, and indicator. "Why?" expandable rows in GovernanceOverlay pulling from `errorTaxonomy.ts`. Rule descriptions in GovernancePanel. "How is this calculated?" glossary in GovernanceDashboard. "Export is blocked because..." banner in ExportModal. Section headers translated to plain language. MCP connection tooltip. Agent Dashboard plain language (Consensus Gate -> AI Second Opinion). First-occurrence onboarding tooltip on violation badge.

### Test Results

```text
Glass: 1456/1456 passing
TSC:   0 errors
```

**Next steps:**
1. Glass Brilliance contracts (GLASS.1/2/3) are ready for implementation
2. D2C.5 AI Refinement contract is ready for implementation
3. Phase N (Designer Experience) is next planned major phase

---

## Session: 2026-03-27 Phase GLASS — Glass Brilliance (CONTRACTS COMPLETE)

**Goal:** Take Flint Glass from "functional" to "brilliant" via 3-tier UX overhaul: structural redesign, credibility (a11y/errors/empty states), and polish.

**What shipped (contracts only — no implementation yet):**

| Artifact | What it defines |
|----------|----------------|
| `docs/strategy/GLASS-BRILLIANCE-PLAN.md` | Master plan: 3 tiers, 18 items, success criteria, implementation strategy |
| `.flint-context/contracts/GLASS-1-structural-redesign.md` | Tier 1: 7→3 sidebar tabs, kill Build/Govern modes → panels, unified violations, Fix All, actionable dashboard |
| `.flint-context/contracts/GLASS-2-credibility.md` | Tier 2: ARIA trees, focus trapping, ErrorBoundaries, empty state overhaul, emoji cleanup |
| `.flint-context/contracts/GLASS-3-polish.md` | Tier 3: LivePreview loading, panel collapse, transitions, skeletons, first-audit onboarding, keyboard nav |

**Key design decisions:**

- Right sidebar: Health/Activity/Recovery/Scope/Agents tabs removed. Keep Governance, Properties, Tokens.
- Build mode killed → Component Panel in left sidebar (drag-to-insert works because preview stays visible)
- Govern mode killed → Extended GovernanceDashboard in right sidebar (project-level + file-level views)
- Violation unification: GovernanceOverlay is the single source of truth. All other surfaces link to it.
- Agent Dashboard removed from Glass entirely (admin telemetry belongs in IDE extension)

**Also completed this session:**

- Git hygiene: set `main` as GitHub default branch (was `feature/mcp-pivot`), deleted 8 stale remote branches, removed duplicate remote, pruned local branches
- Created 7 new development agents: flint-ux-critic, flint-e2e-tester, flint-release-engineer, flint-docs-keeper, flint-dep-sentinel, flint-perf-profiler, flint-security-reviewer
- Ran flint-docs-keeper audit: fixed CLAUDE.md drift (tool count 51→54, 22 missing tool rows, 4 missing resources, 1 missing store, 21 undocumented key files)

**Next steps:**

1. Run flint-contract-linter on all 3 GLASS contracts
2. Begin GLASS.2 (credibility) — all 5 items are independent, can parallelize immediately
3. Begin GLASS.1a (sidebar consolidation) — the foundation for all other structural changes
4. GLASS.3 items 1-4 can start in parallel; items 5-8 wait for GLASS.1 decisions

**Territory:** `.flint-context/ACTIVE-SWARM-TERRITORY.md` updated with GLASS phase claim.

---

## Session: 2026-03-26 D2C.5 -- AI Refinement Pass (CONTRACT COMPLETE)

**Goal:** Design the AI refinement step that takes deterministic D2C scaffold output and improves it using AI vision + library idioms. Produce a binding contract artifact before any implementation.

**Architecture decision:** Option C -- Hybrid (AI Classification + Targeted Refinement). Phase 1 is a fast Haiku classification pass that overrides heuristics with structured JSON (no code generation). Phase 2 is an opt-in per-component Sonnet refinement with Commandment 16 TSC validation and safe fallback to the deterministic scaffold.

**Key design choices:**

- All code lives in `flint-mcp/` (MCP engine). No IPC, no Glass changes, no store changes.
- Default behavior is unchanged (`aiClassify=false`). AI features are opt-in tool params.
- Phase 1 adds <2s latency (Haiku). Phase 2 adds 3-8s per component (Sonnet, opt-in).
- Screenshot pass-through from Figma MCP `get_design_context` to Phase 2 (optional).
- API key resolved from env var or `.flint/config.json` (MCP is headless, no safeStorage).

**Contract artifact:** `.flint-context/contracts/D2C-5-ai-refinement-pass.md`

**Files to create during implementation:**

| File | Purpose |
|------|---------|
| `flint-mcp/src/core/d2cRefinement.ts` | `classifyWithAI()`, `refineComponent()`, types, prompt builders |
| `flint-mcp/src/core/__tests__/d2cRefinement.test.ts` | Unit tests for classification, refinement, fallback |

**Files to modify during implementation:**

| File | Change |
|------|--------|
| `flint-mcp/src/tools/designToCode.ts` | Add `aiClassify`, `aiRefine`, `screenshotBase64` params |
| `flint-mcp/src/core/hydroPaste.ts` | Accept `ClassificationMap` overrides |
| `flint-mcp/src/tools/__tests__/designToCode.test.ts` | Integration tests for new params |
| `flint-mcp/src/core/__tests__/hydroPaste.test.ts` | Tests for classification override injection |

---

## Session: 2026-03-26 UCFG.5-7 + ERM — Unified Config Wiring + Enterprise Rule Management (COMPLETE)

**Goal:** Close the gap between config spec and runtime reality. Wire all YAML config fields into the enforcement pipeline, then build enterprise rule management UI.

**What shipped (594 new tests):**

| Phase | What | New Tests |
|-------|------|-----------|
| UCFG.5 | Approval gates, scoring weights, classification services | 80 |
| UCFG.6 | GPX pack YAML migration (assembleYamlPack, importYamlPack) | 27 |
| UCFG.7a | Approval gates wired into `flint_ast_mutate` | 5 |
| UCFG.7b | Classification → audit thresholds, scoring weights → debt report | 20 |
| UCFG.7c | Enriched presets (escalation, promotion, classification) + config validator | 30 |
| Gap 1 | Trust tiers from YAML → `agentPolicy.ts` (Electron runtime) | 32 |
| Gap 2 | Escalation rules from YAML → `agentEscalation.ts` (Electron runtime) | 32 |
| Gap 3 | Real MRS risk scoring in approval gate (replaces batch-size heuristic) | 20 |
| Gap 4 | Configurable promotion gates in `trustTierService.ts` | 9 |
| Gap 5 | Content style guide (google/microsoft/apple) → Sentinel prompt | 88 |
| Gap 6 | Registry resolver for `org/pack-name` extends refs | 14 |
| Gap 7 | PDP/PEP enforcement service wired into audit output | 88 |
| ERM-1 | Rule pack registry (10 packs, 64 rules) + 5 MCP tools | 87 |
| ERM-2 | IPC channels + preload surface + governanceStore extensions | 37 |
| ERM-3 | Glass UI: RuleCatalogPanel, ComplianceProfileSelector, CoverageBar, InheritanceChain, useGovernanceConfig hook | 57 |

**Key files created:**

| File | Role |
|------|------|
| `flint-mcp/src/core/governance/approvalGateService.ts` | Conditional approval gate evaluation |
| `flint-mcp/src/core/governance/scoringWeightsService.ts` | Domain-tunable scoring weights |
| `flint-mcp/src/core/governance/classificationService.ts` | Data classification → governance profile |
| `flint-mcp/src/core/governance/enforcementService.ts` | PDP/PEP enforcement point resolution |
| `flint-mcp/src/core/styleGuideService.ts` | Content style guide resolution |
| `flint-mcp/src/core/configValidator.ts` | Parse-time config validation |
| `flint-mcp/src/core/registryResolver.ts` | org/pack-name extends resolution |
| `flint-mcp/src/core/rulePackRegistry.ts` | Static registry of 10 rule packs |
| `flint-mcp/src/tools/rulePacks.ts` | 5 MCP tools for rule pack management |
| `src/components/ui/RuleCatalogPanel.tsx` | Browsable rule pack catalog |
| `src/components/ui/ComplianceProfileSelector.tsx` | Jurisdiction checklist |
| `src/components/ui/CoverageBar.tsx` | Per-jurisdiction coverage bars |
| `src/components/ui/InheritanceChain.tsx` | Visual extends chain |
| `src/hooks/useGovernanceConfig.ts` | IPC→store bridge hook |
| `src/core/rulePackRegistryClient.ts` | Client-side pack metadata |

**Test results:**

```text
MCP:   3612/3612 passing (594 new across 13 phases)
Glass: 1209/1209 passing (57 new)
Core:  1087/1087 passing (32 new)
TSC:   0 errors
```

---

## Session: 2026-03-26 CI.2 — CI/CD Parity Rewrite (COMPLETE)

**Goal:** Replace frozen `bridge-ci/` (10 a11y rules, inlined linters, no YAML config) with `flint-ci/` — a thin CLI shell that consumes the MCP engine directly. Zero duplicated linter logic.

**What shipped:**

| File | Change |
|------|--------|
| `flint-ci/src/engine.ts` | NEW — MCP engine adapter: parseSource, auditFile, auditFiles, shouldBlock, buildSarifReport, loadTokens, loadGovernanceConfig. Imports MithrilLinter (6 visitors, CIEDE2000) + A11yLinter (50 rules) + enforcementService (PDP/PEP ci_gate) directly from flint-mcp. |
| `flint-ci/src/cli.ts` | NEW — Commander CLI: `flint-gate audit\|debt\|sync\|dbom\|fix`. Exit codes 0/1/2/3. |
| `flint-ci/src/commands/audit.ts` | NEW — File collection (recursive walk + git-changed), ANSI terminal output, SARIF generation, enforcement blocking. |
| `flint-ci/src/commands/debt.ts` | NEW — Design debt report via MCP debtReportService. JSON/Markdown. Exit 1 on grade D-F. |
| `flint-ci/src/commands/sync-check.ts` | NEW — Token drift detection. Two-tier: MCP SyncCheckService → .flint/sync-state.json fallback. |
| `flint-ci/src/commands/dbom.ts` | NEW — Design Bill of Materials. JSON/Markdown/CycloneDX via MCP dbomService. |
| `flint-ci/src/commands/fix.ts` | NEW — Auto-fix (dry-run default). MCP fix handler → audit-and-report fallback. |
| `flint-ci/src/github-action.ts` | NEW — GitHub Actions wrapper: PR changed files, SARIF output, PR comment upsert, annotations. |
| `flint-ci/src/__tests__/engine.test.ts` | NEW — 56 tests: parseSource, extractRuleId, loadTokens, auditFile, auditFiles, shouldBlock, buildSarifReport. |
| `.flint-context/contracts/CI-parity-rewrite.md` | NEW — Architecture contract. |
| `CLAUDE.md` | MODIFIED — Added CI.2 module status + flint-ci key files section. |

**Architecture decisions:**

- `flint-ci/` imports MithrilLinter and A11yLinter from `flint-mcp/src/core/` via relative paths — zero linter duplication
- Enforcement service's `ci_gate` decision point controls blocking (coercive=block, normative=warn, advisory=info)
- `flint.config.yaml` loaded via MCP's `loadProjectConfig()` — same config resolution as MCP server
- Dynamic imports with try/catch for optional heavy deps (better-sqlite3, deep governance services) — CLI degrades gracefully
- SARIF builder includes all 50+ rule IDs (MITHRIL-COL, MITHRIL-TYP-001..005, MITHRIL-SPC/SHD/OPC/INL, A11Y-001..050, SYNC-001..002, FLINT-PARSE)

**Test results:**

```text
CI:    56/56 passing (56 new)
MCP:   3612/3612 passing (0 regressions)
Glass: 1209/1209 passing (0 regressions)
Core:  1087/1087 passing (0 regressions)
```

---

## Session: 2026-03-26 D2C.4 Feature 2 -- Token Extraction from Figma (COMPLETE)

**Goal:** Implement Feature 2 (Token Extraction) from the D2C.4 contract. Mandatory two-step approval gateway for extracting design tokens from Figma payloads.

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/core/figmaTokenExtractor.ts` | NEW — Pure stateless extractor. Walks Figma node tree, collects colors/spacing/typography/radii/opacity/effects. Deduplicates by value, scores confidence (frequency + semantic name + common-value + novelty), detects near-duplicates via CIEDE2000 (deltaE < 2.0 threshold). |
| `flint-mcp/src/tools/extractTokens.ts` | NEW — Two MCP tools: `flint_extract_tokens` (READ-ONLY, returns proposals) + `flint_approve_tokens` (writes approved tokens, records governance event). |
| `flint-mcp/src/server.ts` | MODIFIED — Registered `flint_extract_tokens` + `flint_approve_tokens` in ListTools and CallTool handlers. |
| `flint-mcp/src/core/governance/types.ts` | MODIFIED — Added `token_extraction` to `GovernanceEvent.eventType` union. |
| `flint-mcp/src/core/governance/eventService.ts` | MODIFIED — Updated DDL CHECK constraint to allow `token_extraction` event type. |
| `flint-mcp/src/core/__tests__/figmaTokenExtractor.test.ts` | NEW — 29 tests: color extraction, stroke/effect colors, typography, spacing, radii, deduplication, exact match, near-match, confidence scoring, filters, empty/null payloads, naming. |
| `flint-mcp/src/tools/__tests__/extractTokens.test.ts` | NEW — 14 tests: no-write verification, JSON error handling, reviewInstructions, filter pass-through, approve writes, preserve-existing, governance event, empty array rejection, skip/reject counts, round-trip. |

**Architecture decisions:**

- `flint_extract_tokens` is strictly read-only — no file I/O whatsoever. This is enforced at the handler level.
- `flint_approve_tokens` uses the same merge-with-preserve semantics as `flint_set_library` (existing paths at the same token path are never overwritten).
- Governance events for `token_extraction` are written to `.flint/governance.db` (separate from the audit events db). Event failure is swallowed — it never blocks the token write.
- CIEDE2000 near-match threshold is 2.0 (matching the Mithril safety threshold from Commandment 9).
- The DDL CHECK constraint in `eventService.ts` was extended — existing tables created with the old constraint will continue working (SQLite CHECK constraints are evaluated at row insert time, not retrospectively).

**Test results:** MCP: 3554/3554 passing (43 new). TSC: 0 errors.

**Next:** D2C.4 Features 1 (classifyFrame/classifyComponent), 3 (Code Connect sync), 4 (GovernanceOverlay mount). Feature 4 is a trivial single-line mount of an existing component in App.tsx.

---

## Session: 2026-03-26 D2C.4 -- Quality & Intelligence Upgrade (CONTRACT)

**Goal:** Design contracts for 4 features upgrading the D2C pipeline to production quality.

**What shipped:**

| File | Change |
|------|--------|
| `.flint-context/contracts/D2C-4-quality-intelligence.md` | Full contract artifact: 4 features, type contracts, implementation order, test plans |
| `.flint-context/ACTIVE-SWARM-TERRITORY.md` | Territory claimed for D2C.4 |

**Architecture decisions:**

1. **classifyFrame + classifyComponent** -- Two pure heuristic functions in `hydroPaste.ts`. `classifyFrame` uses depth/fill/stroke/name signals to produce `card|form|nav|section|container|component`. `classifyComponent` maps name keywords to 10 component types (Input, Textarea, Select, Checkbox, Switch, Avatar, Badge, Tabs, Separator, Alert). `LibraryCodeEmitter` gets `emitNamedComponent(type, props, children, depth)` -- one generic method instead of 10 specific ones. `wrapContainer` gets optional `element` param for form/nav/section semantics.

2. **Token Extraction from Figma** -- Pure extractor (`figmaTokenExtractor.ts`) walks Figma node tree, collects every visual property value, deduplicates, scores confidence. Returns `ProposedToken[]` with usage counts. APPROVAL GATEWAY is mandatory -- `flint_extract_tokens` returns proposals, `flint_approve_tokens` writes approved subset. Governance events table gets `token_extraction` event type for full provenance.

3. **Code Connect Auto-Registration** -- `flint_code_connect_sync` tool generates Code Connect mappings from Flint's library registry + adapter import conventions. Tries Figma MCP tools (`send_code_connect_mappings`) first, falls back to generating `.figma/code-connect.json` config file for manual import. dry_run mode for review.

4. **Governance Overlay on Generated Code** -- RESEARCH COMPLETE: The entire audit pipeline already works (MithrilProvider fires on AST change, populates linterWarnings, Export Gate reads them). The ONLY gap is `GovernanceOverlay` component exists but is NOT MOUNTED anywhere in App.tsx. Fix is a single import + mount in the `rightTab === 'properties'` branch, above PropertiesPanel.

**Next:** Phase 2 implementation. Feature 4 (GovernanceOverlay mount) can ship immediately -- zero risk, zero new code beyond import+mount. Features 1-2 are parallelizable. Feature 3 depends on Feature 1 completing (needs the component type vocabulary).

---

## Session: 2026-03-26 D2C.3b -- LivePreview Shim Wiring (COMPLETE)

**Goal:** Wire the library shim registry into `buildSrcdoc` so the srcdoc preview injects library-specific components (shadcn, MUI, PrimeNG) when a library is active.

**What shipped:**

| File | Change |
|------|--------|
| `src/components/editor/LivePreview.tsx` | (1) Import `getLibraryShims`, `getGenericShims`, `LibraryShimBundle` from shim registry. (2) `activeLibrary` local state via `scope:get-active-library` IPC on mount. (3) `buildSrcdoc` signature extended with `libraryShims: LibraryShimBundle \| null` param. (4) Inline stub block replaced with `getGenericShims().shimSource` injection + optional library shim block. (5) Library CSS vars `<style>` injected in `<head>` after Tailwind config. (6) `buildSrcdoc` call passes `getLibraryShims(activeLibrary)`. (7) `activeLibrary` added to effect dependency array. (8) `buildSrcdoc` exported for testing. |
| `src/components/__tests__/setup.ts` | Added `getActiveLibrary` mock to `scope` API stub |
| `src/components/editor/__tests__/buildSrcdoc.test.ts` | **NEW** — 23 tests for shim injection: null/shadcn/MUI/PrimeNG paths, injection order, CSS vars, library switching |
| `src/preview-vendor/shims/index.ts` | Created by parallel agent (d2c3-shims) — shim registry with `getLibraryShims`, `getGenericShims`, `getRegisteredLibraries` |
| `src/preview-vendor/shims/generic.js` | Created by parallel agent — 9 generic stubs extracted from LivePreview inline |
| `src/preview-vendor/shims/shadcn.js` | Created by parallel agent — 15 shadcn/ui component shims + CSS vars |
| `src/preview-vendor/shims/mui.js` | Created by parallel agent — 12 MUI component shims + CSS vars |
| `src/preview-vendor/shims/primeng.js` | Created by parallel agent — 10 PrimeNG shims + CSS vars |
| `src/preview-vendor/shims/__tests__/shimRegistry.test.ts` | Created by parallel agent — 56 registry tests |

**Test results:** Glass: 1113/1115 passing (79 new). TSC: 0 errors.
- 2 pre-existing failures unrelated to this work: `GhostCodeSnippet > displays the line number`, `SetupWizard > MCP server not found`.

**Architecture delivered:**
- Injection order: Tailwind config → library CSS vars `<style>` → base styles → generic stubs → library shims
- Library shims override generic stubs for matching component names (additive pattern)
- `buildSrcdoc(null)` preserves original behaviour exactly — no regression
- Vite dev server path unaffected (shims only apply to srcdoc path when `previewUrl == null`)
- `activeLibrary` read once on mount via existing `scope:get-active-library` IPC, rerenders trigger preview rebuild

**Next:** Phase 3 integration validation — launch Flint Glass, set library to shadcn via `flint_set_library`, confirm Card/Button render in preview.

---

## Session: 2026-03-26 D2C.3 -- Library Preview Runtime (CONTRACT APPROVED)

---

## Session: 2026-03-26 UCFG.7 — Full Wiring + Presets + Validation (COMPLETE)

**Goal:** Wire UCFG.5 services into runtime, enrich presets, add config validation.

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/server.ts` | Approval gates wired into `flint_ast_mutate` — mutations above risk threshold get gated |
| `flint-mcp/src/tools/audit.ts` | Classification-based delta-E threshold adjustment (restricted = 0.5x multiplier) |
| `flint-mcp/src/core/dashboard/debtReportService.ts` | Weighted scoring with configurable weights from YAML config |
| `flint-mcp/src/core/dashboard/types.ts` | `weightedScore` field added to DebtReport |
| `flint-mcp/src/core/configValidator.ts` | **NEW** — Parse-time validation with actionable error messages |
| `flint-mcp/src/core/config-loader.ts` | Validation wired into `loadYamlConfig()` |
| `flint-mcp/presets/*.yaml` | 5 presets enriched with trust, escalation, promotion, classification, content |

**Tests:** 55 new (5 + 20 + 30)
**Results:** `MCP: 3221/3221 passing | TSC: 0 errors`

---

## Session: 2026-03-25 UCFG.5+6 — Approval Gates + GPX YAML Migration (COMPLETE)

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/core/governance/approvalGateService.ts` | **NEW** — Conditional approval gates with operator-based conditions (gt/gte/lt/lte/eq/ne) |
| `flint-mcp/src/core/governance/scoringWeightsService.ts` | **NEW** — Configurable scoring weights with domain presets (healthcare/fintech/government) |
| `flint-mcp/src/core/governance/classificationService.ts` | **NEW** — Data classification → governance profile mapping (public/internal/confidential/restricted) |
| `flint-mcp/src/core/packTypes.ts` | Added `format?: 'json' \| 'yaml'` to PackManifest |
| `flint-mcp/src/core/packAssembler.ts` | Added `assembleYamlPack()` — YAML-based pack assembly |
| `flint-mcp/src/core/packImportService.ts` | Added `importYamlPack()`, `isYamlFormatPack()` — YAML-aware pack import with extends integration |

**Tests:** 80 (UCFG.5) + 28 (UCFG.6) = 108 new tests
**Results:** `MCP: 3167/3167 passing (108 new) | TSC: 0 errors`

---

## Session: 2026-03-25 D2C.2 — LivePreview Integration (CONTRACT APPROVED)

**Goal:** Wire `flint_design_to_code` MCP tool output into Glass LivePreview so generated components render live on the canvas.

**What shipped:**

| File | Change |
|------|--------|
| `.flint-context/contracts/D2C-2-livepreview-integration.md` | Full contract artifact: IPC channels, type contracts, sequence diagram, undo plan, test plan |
| `.flint-context/ACTIVE-SWARM-TERRITORY.md` | Territory claimed for D2C.2 implementation |

**Architecture decisions:**
- Main-process orchestration: `d2c:apply` IPC handler owns mkdir + injectFlintIds + writeBatch + shadowCommit + scanDirectory
- File layout: `src/components/generated/<PageName>/` with sibling `.tsx` files
- No new store state: hook calls existing `setWorkspaceFiles` + `setActiveFile` + `setCanvasView`
- No new canvas nodes: page compositor renders all sections in the single LivePreview iframe
- Undo via Git Time Machine (shadowCommit), not AST inversions (files didn't exist before)
- New general-purpose `workspace:rescan` IPC channel for future reuse
- React hook (`useDesignToCodeApply`) is the only IPC caller -- no store actions call flintAPI

**Next:** Phase 2 implementation (2a: IPC layer, 2b: React hook -- parallelizable). Then Phase 3 integration validation.

---

## Session: 2026-03-25 UCFG.1 — Unified Config Loader (COMPLETE)

**Goal:** Replace 3 fragmented JSON config files with a single `flint.config.yaml`. Phase 1: YAML parser + loader + type definitions + JSON fallback + mode/tier mapping.

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/package.json` | Added `yaml: ^2.7.1` dependency |
| `flint-mcp/src/core/config.ts` | `FlintProjectConfig` type, `RuleMode`, `TrustTier`, `DataClassification`, `PolicyRef`, `ApprovalGate`, mapping functions |
| `flint-mcp/src/core/config-loader.ts` | `loadYamlConfig()`, `applyEnvironmentOverlay()`, `loadProjectConfig()`. `loadConfig()` checks YAML first, falls back to JSON |
| `flint-mcp/src/core/__tests__/configLoader.test.ts` | 35 new tests |
| `docs/strategy/UNIFIED-CONFIG-SPEC.md` | Full spec (7 research sources) |
| `docs/strategy/examples/` | 3 example configs |

**Results:** `MCP: 3015/3015 passing (35 new) | TSC: 0 errors`

---

## Session: 2026-03-25 UCFG.3+4 — Normative Mode + Migrate Tool (COMPLETE)

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/core/config.ts` | `normative` added to `PolicyMode`, `ruleModeToPolicy` and `policyToRuleMode` map normative ↔ normative |
| `flint-mcp/src/core/policyEngine.ts` | `normative` added to `PolicyMode`, `VALID_POLICY_MODES`, validation messages, `shouldBlockExport()` treats normative as blocking |
| `flint-mcp/src/tools/migrateConfig.ts` | **NEW** — `buildProjectConfigFromLegacy()` reads 3 JSON files → FlintProjectConfig, `handleMigrateConfig()` MCP tool handler |
| `flint-mcp/src/server.ts` | `flint_migrate_config` tool registration + handler |
| `flint-mcp/src/tools/__tests__/migrateConfig.test.ts` | **NEW** — 11 tests |

**Results:** `MCP: 3059/3059 passing | TSC: 0 errors`
**Review:** SHIP (1 critical fixed during review — policyEngine.ts normative gap)

---

## Session: 2026-03-25 UCFG.2 — Extends + Tighten-Only (COMPLETE)

**Goal:** Composable governance inheritance via `extends` + tighten-only invariant.

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/core/config-loader.ts` | `deepMergeConfigs()`, `validateTightenOnly()`, `resolveExtends()` with circular-ref detection, `@flint/` preset + local file + absolute path resolution |
| `flint-mcp/presets/` | 6 official presets: general, healthcare, fintech, e-commerce, government, enterprise-saas |
| `flint-mcp/src/core/__tests__/configLoader.test.ts` | 26 new tests (36-61): deep merge, tighten-only validation, extends resolution, recursive extends, circular detection, preset loading |

**Results:** `MCP: 3048/3048 passing (26 new) | TSC: 0 errors`

**Next phases:** UCFG.3 (full normative mode), UCFG.4 (migrate tool), UCFG.5 (approval gates), UCFG.6 (GPX pack migration)

---

## Session: 2026-03-25 D2C — Figma Design-to-Code Pipeline (COMPLETE)

**Goal:** End-to-end pipeline: paste a Figma design payload + pick a UI library → get library-specific component code + theme file in a single MCP call. Then harden output quality so the generated code is actually correct.

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/core/hydroPaste-emitters.ts` | **NEW** — `LibraryCodeEmitter` interface + 4 emitters (Shadcn, MUI, PrimeReact, Tailwind). Button/heading detection. `emitHeading()` method. |
| `flint-mcp/src/core/hydroPaste.ts` | Library-aware engine: `HydroOptions`, `generateJSXWithEmitter()`, color role detection (`text-`/`bg-`), `isLikelyButton()`, `isLikelyHeading()` with exclusion list. |
| `flint-mcp/src/core/colorDistance.ts` | **NEW** — CIEDE2000 perceptual color math (ported from IngestionAuditor). `findNearestToken()` fuzzy matching with ΔE ≤ 3.0 threshold. |
| `flint-mcp/src/tools/ingest.ts` | Reads `selectedLibrary` from `.flint/policy.json`, passes to `HydroPasteEngine`. |
| `flint-mcp/src/tools/designToCode.ts` | **NEW** — `flint_design_to_code` unified MCP tool: ingest + map + hydrate in one call. |
| `flint-mcp/src/server.ts` | Registered `flint_design_to_code` tool + handler. |
| `flint-mcp/src/core/libraryAdapters/shadcnAdapter.ts` | Fixed HSL saturation formula bug (`max-min` → `max+min`). |
| `flint-mcp/src/core/__tests__/hydroPaste.test.ts` | 94+ new tests: emitters, color roles, buttons, headings, fuzzy matching. |
| `flint-mcp/src/core/__tests__/colorDistance.test.ts` | **NEW** — 39 tests: CIEDE2000 math, fuzzy token matching. |
| `flint-mcp/src/core/__tests__/shadcnAdapter.test.ts` | **NEW** — 23 tests: HSL conversion, semantic mapping. |
| `flint-mcp/src/tools/__tests__/designToCode.test.ts` | **NEW** — 22 tests: all libraries, auto-detect, error cases. |

**Quality hardening (second pass):**

| Issue | Fix |
|-------|-----|
| Text nodes got `bg-` instead of `text-` | Token lookup stores bare names; prefix applied by role (`bg-` for FRAME, `text-` for TEXT) |
| Every FRAME became `<Card>` | `isLikelyButton()` heuristic: single TEXT child + short action phrase → `<Button>` |
| "Subtitle" falsely treated as heading | Exclusion list: `subtitle`, `subheading`, `caption`, `overline`, `eyebrow` |
| Near-identical colors not matched | CIEDE2000 fuzzy matching with ΔE ≤ 3.0 threshold (e.g. `#17171C` → `color.background` token `#171719`) |
| `#171719` → `220 100% 46.1%` in shadcn theme | HSL saturation formula had wrong denominator for dark colors |

**Verified output (shadcn):**
```jsx
<Card className="flex flex-col bg-color-background">
  <CardContent>
    <h2 className="text-2xl font-bold text-color-foreground">Ship with confidence</h2>
    <p className="text-color-muted">AI-generated UI.</p>
    <Button>Get Started</Button>
  </CardContent>
</Card>
// Imports: Card, CardContent, Button — correct paths
// Token mappings: 3/3 resolved via exact + CIEDE2000
```

**Test results:**
```
MCP:   3015/3015 passing (129 new)
TSC:   0 errors
```

---

## Session: 2026-03-24 LIB.1 — Library-First Bidirectional Workflow (COMPLETE)

**Goal:** Enable the full bidirectional workflow: User selects library → seed tokens → push to Figma → design → pull back → AI builds with library idioms. AND the reverse: pull from Figma → detect library → set active → AI builds.

**What shipped:**

| File | Change |
|------|--------|
| `flint-mcp/src/core/libraryAdapters/types.ts` | Added `LibraryMatchResult` interface, `seedTokens()`, `getIdiomBlock()`, `matchTokens()` to `LibraryAdapter` contract |
| `flint-mcp/src/core/libraryAdapters/shadcnAdapter.ts` | Implemented 3 new methods: 20 seed tokens, idiom block, 8-signal fingerprint matcher |
| `flint-mcp/src/core/libraryAdapters/muiAdapter.ts` | Implemented 3 new methods: 25 seed tokens, idiom block, 8-signal fingerprint matcher |
| `flint-mcp/src/core/libraryAdapters/primeAdapter.ts` | Implemented 3 new methods: 21 seed tokens, idiom block, 7-signal fingerprint matcher |
| `flint-mcp/src/core/libraryAdapters/tailwindAdapter.ts` | Implemented 3 new methods: 35 seed tokens, idiom block, 6-signal matcher (capped at 65 — generic fallback) |
| `flint-mcp/src/core/libraryAdapters/index.ts` | Added `detectLibraryFromTokens()` — runs all adapters, returns top scorer with ≥60% confidence |
| `flint-mcp/src/tools/setLibrary.ts` | **NEW** `flint_set_library` MCP tool — explicit set, auto-detect, list, none modes; seeds tokens with merge-preserve |
| `flint-mcp/src/server.ts` | Registered `flint_set_library` tool + handler |
| `flint-mcp/src/core/sync/tokenSyncEngine.ts` | Fixed `executePush()` to use proper Figma Variable types (COLOR/FLOAT/STRING); added `hexToFigmaRGBA()` conversion; added post-pull library detection to `executePull()` |
| `electron/orchestrator.ts` | Added `serializeLibraryIdiomConstraints()` — injects library idiom block into AI system prompt when `selectedLibrary` set in policy.json |
| `electron/main.ts` | Added `library:get-active` and `library:set-active` IPC handlers |
| `electron/preload.ts` | Added `getActiveLibrary()` and `setActiveLibrary()` to `scope` bridge |
| `src/types/flint-api.d.ts` | Added `getActiveLibrary`/`setActiveLibrary` to `ScopeAPI`; added `selectedLibrary` to `FlintContext` |
| `src/hooks/useContextSync.ts` | Added `selectedLibrary` to context sync (reads from IPC, included in 200ms debounce cycle) |
| `src/components/ui/ComponentScopePanel.tsx` | Added Active Library dropdown selector in Scope panel with optimistic UI |

**Architecture:**

Forward flow: `flint_set_library library="shadcn"` → seeds tokens → `flint_sync_push` → Figma → design → `flint_sync_pull` → `flint_map_tokens library="shadcn"` → theme file → AI builds with shadcn idioms in system prompt

Reverse flow: `flint_sync_pull` → post-pull detection → `PullResult.detectedLibrary` suggestion → `flint_set_library library="auto"` → auto-detect → set active → AI builds

**Integration gap fixed:** `executePull()` now bootstraps `token_source` baseline from local tokens on first pull (plugin-first flow). Without this, tokens ingested via the Figma plugin were treated as "added_local" instead of being recognized as Figma-sourced baseline. The bootstrap only runs inside `executePull()` — not `computeDiff()` — so `executePush()` correctly treats local-only tokens as additions to push.

**Test results:**
```
MCP:   2823/2823 passing (0 regressions)
Glass: 993/993 passing (2 pre-existing failures: GhostCodeSnippet, SetupWizard)
Core:  959/959 passing (7 pre-existing failures: GitManager dirty worktree)
TSC:   0 errors
```

---

## Reference: Figma Integration Pipeline (Two Paths)

This section documents the complete Figma token sync architecture. Both paths are fully implemented and working.

### Path 1: Figma Plugin (Push — Figma → Flint)

**Direction:** One-way. Figma → Flint only.

**Flow:**
1. `figma-plugin/code.ts` collects variables via `figma.variables.getLocalVariables()`
2. `figma-plugin/ui.html` sends POST to `http://127.0.0.1:4545/ingest` with `x-flint-secret` header
3. `electron/ingestion-server.ts` receives, validates secret (SEC.2)
4. `electron/normalizer.ts` converts Figma types (RGBA → hex, FLOAT → dimension, etc.) to W3C DTCG format
5. Tokens batch-upserted into `design_tokens` SQLite table
6. IPC `tokens-updated` fires to renderer

**Security:** Loopback-only (127.0.0.1), per-session secret (32 bytes, runtime-injected), wildcard CORS (safe on loopback).

**Glass UI:** `FigmaSetupWizard.tsx` — 3-step wizard shows endpoint + secret for plugin config.

### Path 2: REST API with PAT (Bidirectional — Flint ↔ Figma)

**Direction:** Both ways. Pull AND push.

**Setup:**
```
flint_figma_connect action="connect" fileKey="YOUR_FILE_KEY" accessToken="figd_YOUR_PAT"
```
Get a Personal Access Token from figma.com → Settings → Personal access tokens.
Get the file key from your Figma URL: `figma.com/design/FILE_KEY_HERE/...`

**Pull (Figma → Flint):**
```
flint_sync_pull projectRoot="/path/to/project"
```
- Calls Figma REST API: `GET /v1/files/{fileKey}/variables/local`
- Three-way diff: baseline (token_source table) vs local (design-tokens.json) vs remote (Figma API)
- Auto-applies `added_remote` and `modified_remote`
- Creates conflicts for `modified_both` (resolve via `flint_resolve_conflict`)
- Writes updated tokens to `.flint/design-tokens.json`
- Updates baseline in `token_source` table

**Push (Flint → Figma):**
```
flint_sync_push projectRoot="/path/to/project"
```
- Three-way diff identifies `added_local`, `modified_local`, `removed_local`
- Calls Figma REST API: `POST /v1/files/{fileKey}/variables`
- CREATE: new variables with correct type (COLOR/FLOAT/STRING)
- UPDATE: existing variables by `figmaVariableId`
- DELETE: removed variables

**Plugin-First Bootstrap:** When tokens arrive via the plugin path first (no API sync yet), `executePull()` auto-seeds the `token_source` baseline from local tokens. This prevents the first API pull from treating plugin-ingested tokens as user-local additions.

### Both Paths Together (Recommended Workflow)

1. Install Figma plugin → sync tokens once (populates `design_tokens`)
2. Connect API: `flint_figma_connect action="connect" fileKey="..." accessToken="figd_..."`
3. Now `flint_sync_pull` and `flint_sync_push` work bidirectionally
4. Plugin can still be used for quick manual syncs

### Key Files

| File | Role |
|------|------|
| `figma-plugin/code.ts` | Plugin main thread — collects variables |
| `figma-plugin/ui.html` | Plugin UI — endpoint/secret config + sync button |
| `electron/ingestion-server.ts` | HTTP server on port 4545 (loopback) |
| `electron/normalizer.ts` | Figma variables → W3C DTCG token mapping |
| `flint-mcp/src/core/sync/figmaApiService.ts` | Figma REST API client (GET/POST variables) |
| `flint-mcp/src/core/sync/connectionService.ts` | Encrypted PAT storage (safeStorage) |
| `flint-mcp/src/core/sync/tokenSyncEngine.ts` | Three-way diff + pull/push orchestration |
| `flint-mcp/src/core/sync/tokenSourceService.ts` | Baseline tracking (token_source table) |
| `flint-mcp/src/core/sync/conflictService.ts` | Conflict detection + resolution |
| `flint-mcp/src/core/sync/syncHistoryService.ts` | Sync audit trail |

### MCP Tools

| Tool | What it does |
|------|-------------|
| `flint_figma_connect` | Connect/disconnect/status for Figma PAT |
| `flint_sync_pull` | Pull remote changes + post-pull library detection |
| `flint_sync_push` | Push local changes as typed Figma variables |
| `flint_resolve_conflict` | Resolve a single merge conflict |
| `flint_resolve_all` | Bulk resolve all conflicts (local or remote wins) |
| `flint_sync_check` | CI/CD health check (inSync?, drift count) |
| `flint_sync_history` | Export sync history as JSON/CSV |

---

## Session: 2026-03-22 IDE→Glass File Sync + Rebrand Cleanup (COMPLETE)

**Goal:** Wire VS Code extension active-file selection into Glass (auto-follow IDE focus), remove "Flint IDE" branding remnants.

**What shipped:**

| File | Change |
|------|--------|
| `flint-vscode/src/extension.ts` | `onDidChangeActiveTextEditor` now writes `{path, ts}` to `.flint/ide-active-file.json` (fire-and-forget, non-fatal) |
| `electron/main.ts` | 1s stat-poll watcher on `ide-active-file.json`; broadcasts `flint:ide-file-selected` to renderer when path changes |
| `electron/preload.ts` | Exposes `onIDEFileSelected(cb)` and `removeIDEFileSelectedListener()` |
| `src/types/flint-api.d.ts` | Added `onIDEFileSelected?` and `removeIDEFileSelectedListener?` to `FlintAPI` interface |
| `src/hooks/useIDEFileSync.ts` | New hook — subscribes to IDE file change events, calls `setActiveFile` |
| `src/App.tsx` | Mounts `useIDEFileSync()` at app root |
| `electron/GitManager.ts` | git commit identity: `'Flint IDE'` → `'Flint'` |
| `electron/orchestrator.ts` | SYSTEM_PROMPT updated: "Flint IDE" → "Flint Glass" |
| `src/templates/paymentCalculator.ts` | Demo label: "Flint IDE · Demo" → "Flint · Demo" |

**Architecture:**
- VS Code extension → `.flint/ide-active-file.json` → Electron stat-poll → IPC → `useIDEFileSync` → `setActiveFile`
- Files tab preserved in Glass left panel as fallback for standalone use
- All new IPC channels follow existing `ipcChannel()` + `BrowserWindow.getAllWindows()` broadcast pattern

**Next:** Pending review verdict; rebuild `.vsix` after fixes if any.

---

## Session: 2026-03-22 Extension Verification + Strategy Review (COMPLETE)

**Goal:** Verify VS Code extension builds clean, validate product strategy for dual-audience (designers + developers).

**What confirmed:**

- `flint-vscode/` builds with 0 TSC errors, 0 stale Bridge references
- Extension already has: Governance panel, Activity panel, diagnostics, quick fixes, auto-audit, MCP client, multi-IDE auto-registration
- Extension is ready for testing via `Fn+F5` in VS Code

**Strategic decisions documented:**

- Glass serves designers (visual verification), VS Code extension serves developers (inline governance)
- Governance Packs are the shared contract between both audiences
- Distribution strategy: private beta first (zip/direct share), then npm+BSL after validation
- Feature freeze recommended until 5 real users provide signal

---

## Session: 2026-03-21 GPX.1 + GPX.2 — Governance Pack Exchange (COMPLETE)

**Goal:** Build portable governance pack export/import so teams can share Flint configs across projects.

**What shipped:**

| Phase | Files | Tests |
|-------|-------|-------|
| GPX.1 — Pack Export | `packTypes.ts`, `packSecurityScanner.ts`, `packAssembler.ts`, `tools/packExport.ts` | 101 new |
| GPX.2 — Pack Import | `packImportService.ts`, `tools/packImport.ts`, `governance/types.ts` extended | 63 new |

**3 new MCP tools:** `flint_pack_export`, `flint_pack_import`, `flint_pack_rollback`

**Key capabilities:**
- Export: bundles policy.json + agent-policy.json + rule overrides + CLAUDE.md fragments into `.flint-pack/` with SHA-256 checksums and security scanning (11 secret patterns)
- Import: conflict detection across 4 domains (policy, agents, rules, fragments), 3 merge strategies (override, skip-conflicts, interactive), snapshot-based rollback
- Security: blocks export/import if secrets or absolute paths detected in pack files

**Test results:**
```
MCP:   2454/2454 passing (164 new)
Core:   966/966 passing
Glass:  983/983 passing
TSC:    0 errors
```

---

## Session: 2026-03-21 GPX.2 — Governance Pack Import + Conflict Resolution (CONTRACT)

**Goal:** Produce a full architecture contract for the pack import engine and conflict resolution system.

**What shipped:**

| File | Purpose |
|------|---------|
| `.flint-context/contracts/GPX.2-contract.md` | Full architecture contract: 14 sections, type contracts, MCP tool schemas, conflict detection pipeline, merge engine, snapshot/rollback, provenance integration, test plan, commandment compliance |

**Architecture decisions:**
- MCP-only phase: two new tools (`flint_pack_import`, `flint_pack_rollback`), no Glass UI changes
- 7 new types added to `governance/types.ts`: `PackManifest`, `MergeStrategy`, `PackConflict`, `ConflictResolution`, `PackSnapshot`, `PackImportResult`, `PackRollbackResult`
- Core service: `packImportService.ts` — owns unzip, manifest validation, checksum verification, conflict detection, merge engine, snapshot/rollback
- Policy merge uses `policyEngine.ts` primitives (`validatePolicy`, `coerceToResolved`) — requires exporting `coerceToResolved` as public
- 3 merge strategies: `override` (pack wins), `skip-conflicts` (non-conflicting only), `interactive` (two-phase user resolution)
- Snapshot system: `.flint/pack-snapshots/<uuid>/` with `index.json` registry, max 10 retained
- Trust tier cap: community packs cannot grant elevated/admin agent tiers
- Provenance: uses existing `'import'` source type in `MutationProvenanceService`
- Glass import wizard deferred to follow-up `GPX.2-glass-contract.md`

**Next:** Phase 2 implementation — spawn agents per the contract's implementation order (types -> service -> tool handlers -> tests).

---

## Session: 2026-03-21 EXP.7 — Cross-Platform Token Sync (COMPLETE)

**Goal:** DTCG design tokens → 5 platform-native outputs with cross-platform consistency audit.

**What shipped:**

| File | Purpose |
|------|---------|
| `flint-mcp/src/core/emitters/types.ts` | Shared types: `PlatformTarget`, `PlatformEmitter`, `PlatformOutput`, `CrossPlatformAuditResult`, `TokenSyncReport` |
| `flint-mcp/src/core/emitters/index.ts` | Emitter registry with lazy factory pattern |
| `flint-mcp/src/core/emitters/tailwindEmitter.ts` | DTCG → Tailwind CSS v4 theme config |
| `flint-mcp/src/core/emitters/cssEmitter.ts` | DTCG → CSS custom properties (`:root {}`) |
| `flint-mcp/src/core/emitters/reactNativeEmitter.ts` | DTCG → React Native TypeScript exports |
| `flint-mcp/src/core/emitters/swiftEmitter.ts` | DTCG → Swift UIColor extensions + DesignTokens struct |
| `flint-mcp/src/core/emitters/kotlinEmitter.ts` | DTCG → Kotlin Compose Color/Dp objects |
| `flint-mcp/src/tools/emitTokens.ts` | `flint_emit_tokens` MCP tool handler + cross-platform auditor |
| `flint-mcp/src/server.ts` | Tool registration |

**Architecture:** MCP-only, no Glass UI, no IPC. Pure-function emitters (tokens in → string out). Registry pattern for extensibility. Supports dryRun, mode/collection filtering, and atomic file writes.

**Test results:**
```
MCP:   2290/2290 passing (125 new)
Core:   966/966 passing
Glass:  983/983 passing
TSC:    0 errors
```

---

## Session: 2026-03-21 Tech Debt Sprint (COMPLETE)

**Goal:** Clean up all tracked technical debt items from HANDOFF.md.

**What shipped:**

| Fix | File | Details |
|-----|------|---------|
| AppMountGate 8 test failures | `setup.ts`, `AppMountGate.test.tsx` | Added missing mocks for `onResetState`, `resetState`, `removeChangedListener`, `createScratchpad` + 5 new component mocks |
| Cross-store import | `componentCardStore.ts` | Removed `useNotificationStore` import; notification dispatch moved to caller |
| betaGuard IPC strings | `betaGuard.ts` | Raw `'beta:expired-remote'` / `'beta:update-available'` → `ipcChannel()` helper |
| DependencyEdge per-edge CSS | `DependencyEdge.tsx`, `index.css` | `@keyframes dash-flow` moved from per-instance `<style>` to global CSS |
| ragSeeder sync I/O | `ragSeeder.ts` | `readFileSync` / `readdirSync` → `fs/promises` async; added symlink guard on `.flint/docs/` |
| MRS formula duplication | `mrsEngine.ts` (CREATE), `orchestrator.ts`, `riskApproval.test.ts` | Extracted MRS types + scorer to shared module; removed 120-line duplication |

**Test results:**
```
MCP:   2165/2165 passing
Glass:  983/983  passing (was 975/983 — 8 failures fixed)
Core:   966/966  passing
TSC:    0 errors
```

**Remaining warnings:** None. All tracked debt items resolved.

---

## Session: 2026-03-21 Doc Audit Sprint (COMPLETE)

**Goal:** Bring all docs in sync with actual shipped state. Found that most backlog items marked PLANNED/BACKLOG were already built but undocumented.

**What changed:**

- `CLAUDE.md` — Added ONBOARD.1 (Setup Wizard) and U.2 (GhostCodeSnippet overlay) to Module Status; added V.4 (Consensus Gate)
- `docs/strategy/BACKLOG-PRIORITIZED.md` — 34 stale PLANNED/BACKLOG/IN-FLIGHT items marked ONLINE; date + test baseline updated to 2026-03-21
- `.flint-context/contracts/ONBOARD.1-contract.md` — Updated to v2 as-built

**Genuine remaining items (not yet built):**

- `GPX Track` — Governance Pack Exchange (long-term horizon)

All other items resolved: EXP.7 shipped, AppMountGate tests fixed, tech debt cleaned.

---

## Session: 2026-03-21 V.4 — Multi-Agent Epistemic Consensus Gate (COMPLETE)

**Goal:** For Amber/Red MRS mutations, route to a stateless secondary agent before surfacing the approval UI. Prevents confirmation bias. Fail-open; domain-configurable.

**What shipped:**

| File | Change |
|------|--------|
| `electron/consensusGateService.ts` (CREATE) | Secondary Anthropic API call, `resolveConfig`, `shouldFireGate`, `evaluate`, `persistRecord` → `.flint/consensus.db` |
| `electron/consensusGateService.test.ts` (CREATE) | 25 tests: resolveConfig, shouldFireGate, evaluate (6 scenarios incl. timeout/error), persistRecord |
| `flint-mcp/src/core/governance/consensusQueryService.ts` (CREATE) | Read-only query service: `getSummary`, `getBySession`, `getByAgent`, `getDisagreements`, `pruneRecords` |
| `flint-mcp/src/core/governance/__tests__/consensusQueryService.test.ts` (CREATE) | 30 tests covering all query methods, zero-state, aggregations, limit enforcement |
| `flint-mcp/src/core/governance/types.ts` | Added `ConsensusJudgment`, `ConsensusOutcome`, `EvaluatorVerdict`, `ConsensusRecord`, `ConsensusReportSummary` |
| `flint-mcp/src/server.ts` | Registered `flint_consensus_report` tool (summary/by_session/by_agent/disagreements modes) |
| `electron/orchestrator.ts` | Wired gate after MRS/escalation, before `onChunk`; extended `OrchestratorChunk` with `consensusOutcome?` + `consensusReasoning?` |
| `src/components/ui/AgentDashboard.tsx` | Consensus Gate stats section (total evals, disagreement rate, outcome distribution) |
| `src/components/ui/DiffCard.tsx` | Consensus badge (agree_approve/disagree/agree_reject variants with reasoning tooltip) |

**Architecture decisions:**

- Gate uses `.flint/consensus.db` per-project (matches provenance/anomaly pattern) — NOT the shared Electron userData db
- Fail-open: `error` + `skipped` outcomes always `proceed: true`; outer try/catch in orchestrator is non-fatal
- Domain defaults: healthcare/fintech/government → enabled by default; general/e-commerce/enterprise-saas → disabled
- `includePrimaryReasoning: false` enforced by prompt construction (epistemic independence)

**Test results:**
```
MCP:   2165/2165 passing (30 new)
Core:  1005/1005 passing (25 new)
Glass: 975/983  passing (23 new; 8 pre-existing AppMountGate failures, unrelated)
TSC:   0 errors
```

---

## Session: 2026-03-21 Rebrand Sprint (COMPLETE)

**Goal:** Rename product from Bridge → Flint across all source files, agents, commands, and docs. `shared/brand.ts` is the single source of truth for all product name strings.

**What shipped:**
- All `bridge-*` directory references → `flint-*` (`bridge-mcp/` → `flint-mcp/`, `bridge-vscode/` → `flint-vscode/`, `bridge-ci/` → `flint-ci/`)
- All user-visible strings, IPC channel prefixes (`bridge:` → `flint:`), and type names updated
- Old `.bridge-context/` directory removed; `.flint-context/` is the active territory tracking dir
- Old `.claude/agents/bridge-*.md` → `.claude/agents/flint-*.md`
- `flint-manifest.json` replaces `bridge-manifest.json` as the project registry file
- `src/types/flint-api.d.ts` replaces `src/types/bridge-api.d.ts`
- `shared/brand.ts` — single source of truth for `BRAND.product`, `BRAND.manifestFile`, `toolName()`, `ipcChannel()`, `configPath()`

**Test results:**
```
MCP:   2135/2135 passing
Glass:  960/960  passing
Core:   977/977  passing
TSC:    0 errors
```

---

## Session: 2026-03-21 Cleanup Sprint (COMPLETE)

**Goal:** Three deferred code fixes + framework-agnostic language sweep + post-review hardening.

**What shipped:**

| Fix | File | Details |
|-----|------|---------|
| CK.3 MCP tool registration | `flint-mcp/src/tools/reindex.ts` (CREATE), `flint-mcp/src/server.ts` | `flint_reindex_registry` tool was ONLINE in Electron IPC but missing from MCP surface. Added tool definition, handler, import, ListTools entry, and CallTool case. |
| Double scope filter | `electron/orchestrator.ts:1801` | `activeRegistry` was already scope-filtered; removed redundant `scope` arg from `serializeRegistryConstraints()` call. |
| Pluralization fix | `electron/orchestrator.ts` | `TOKEN_TYPE_LABELS` lookup table replaces naive `type + 's'` — fixes "Typographys" → "Typography". |
| Framework-agnostic language | 7 files | 11 occurrences of "React component" in tool descriptions, JSDoc, UI strings → "component" (framework-neutral). Files: `ingest.ts`, `hydroPaste.ts`, `componentIndexer.ts`, `main.ts`, `LaunchScreen.tsx`. |
| Atomic write (review fix) | `flint-mcp/src/tools/reindex.ts` | `writeFileSync` → tmp file + `renameSync` (Commandment 12). |
| Missing try/catch (review fix) | `flint-mcp/src/tools/reindex.ts` | `indexComponents()` call now wrapped in try/catch returning structured error. |
| Non-null assertion (review fix) | `src/components/ui/AgentDashboard.tsx` | `mcp!.readResource` → `mcp?.readResource` (runtime safety). |
| Missing aria-label (review fix) | `src/components/ui/ComponentSearch.tsx` | Added `aria-label="Search components"` to search input. |
| Color palette (review fix) | `src/components/ui/SetupWizard.tsx` | 5 `gray-*` classes → `zinc-*` for consistency with the rest of Glass UI. |

**Remaining warnings (non-blocking, tracked):**
- `componentCardStore.ts` — cross-store import + `window.flintAPI` in store actions (architectural debt)
- `betaGuard.ts` — IPC channels use raw strings instead of `ipcChannel()` helper; no test file
- `DependencyEdge.tsx` — `<style>` keyframe injected per-edge (should be global CSS)
- `ragSeeder.ts` — synchronous I/O; no symlink guard on `.flint/docs/` reads

---

## Session: 2026-03-20 CV2.1 (COMPLETE)

**Sprint:** CV2.1 — Build/Govern Canvas Mode Toggle
**Goal:** Three-mode canvas view toggle (Preview/Build/Govern) with segmented control, keyboard shortcuts, and StatusBar indicator.

**What shipped:**

| Task | Files | Tests Added |
| ---- | ----- | ----------- |
| Store: `CanvasView` type, `canvasView` state, `setCanvasView`, reset in `closeWorkspace` | `src/store/canvasStore.ts` | 6 new (canvasStore.canvasView.test.ts) |
| UI: Segmented control floating top-center of canvas | `src/components/editor/CanvasViewToggle.tsx` (CREATE) | 7 new (CanvasViewToggle.test.tsx) |
| UI: XYCanvas conditional rendering — Preview/Build/Govern panels | `src/components/editor/XYCanvas.tsx` | — |
| UI: Cmd+1/2/3 keyboard shortcuts | `src/App.tsx` | — |
| UI: "Build View" / "Govern View" StatusBar chip | `src/components/editor/StatusBar.tsx` | — |

**Test results:**

```text
Glass: 734/734 passing
TSC:   0 errors
```

**Notes:**

- Build and Govern modes render placeholder panels (CV2.3/CV2.4 will fill them)
- `canvasView` is orthogonal to `canvasMode` ('design'|'interact') — different concerns
- Cross-file drop handler gated behind `canvasView === 'preview'`

---

## Session: 2026-03-20 CV2.7 (COMPLETE)

**Sprint:** CV2.7 — Search/Filter Bar
**Goal:** Text search + category filter for the component card grid.

**What shipped:** Debounced search input (150ms) + category `<select>` dropdown + result count + clear button. Filters apply to both `toFlowNodes` and `toFlowEdges`. `clearCards()` resets filters.

**Test results:**
```text
Glass: 813/813 passing (29 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 CV2.6 (COMPLETE)

**Sprint:** CV2.6 — Category Management
**Goal:** Reclassify components via category badge dropdown in Build mode.

**What shipped:**

| Component | What | Tests |
|-----------|------|-------|
| IPC: `components:set-category` + override persistence | Category overrides in `.flint/category-overrides.json`, applied in `components:list` | 30 new |
| Store: `setCategoryOverride` action | Optimistic update + IPC + revert on failure + notification | 5 new |
| UI: Category badge dropdown on ComponentCardNode | Click badge → 6-option popover, Build mode only | 7 new |

**Test results:**
```text
Glass: 795/795 passing (12 new)
Core:  977/977 passing (30 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 CV2.5 (COMPLETE)

**Sprint:** CV2.5 — Drag-to-Insert
**Goal:** Drag component cards from Build canvas into LivePreview to insert into AST.

**What shipped:**

| Component | What | Tests |
|-----------|------|-------|
| `ComponentCardNode.tsx` | `nodrag` drag handle with `flint-component-card` MIME, Build mode only | 4 new |
| `LivePreview.tsx` | Enhanced drop handler for card MIME, dashed indigo drop indicator | 8 new |

**Test results:**
```text
Glass: 783/783 passing (12 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 CV2.4 (COMPLETE)

**Sprint:** CV2.4 — Component Health Enrichment
**Goal:** Populate Govern mode cards with real per-component audit data.

**What shipped:**

| Component | What | Tests |
|-----------|------|-------|
| `componentHealth.ts` (NEW) | Grade computation + per-file parse/lint enrichment | 12 new |
| `main.ts` (`components:list`) | Dynamically imports linters, loads tokens, enriches cards with real health | — |

**Test results:**
```text
Core: 947/947 passing (12 new)
TSC:  0 errors
```

---

## Session: 2026-03-20 CV2.3 (COMPLETE)

**Sprint:** CV2.3 — Component Cards on Canvas
**Goal:** Fill the Build/Govern placeholder panels with a spatial component library.

**What shipped:**

| Component | What it does | Tests |
|-----------|-------------|-------|
| `componentCardStore.ts` | Cards, positions, selection, auto-layout, flow selectors | 15 (pre-existing) |
| `ComponentCardNode.tsx` | Build mode (thumbnail, Insert) + Govern mode (grade, Delta-E, A11y) | 20 (pre-existing) |
| `DependencyEdge.tsx` | Health-grade colored bezier edges in Govern mode | 17 new |

**Code review:** FIX. One type bug found and fixed (DependencyEdgeData conditional type resolving to `null` instead of grade string). Now SHIP.

**Test results:**
```text
Glass: 771/771 passing (17 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 EN.1-4 (COMPLETE)

**Sprint:** EN.1-4 — Registry Enrichment (Generate, Then Curate)
**Goal:** AI generates component documentation drafts, designers curate in Scope panel

**What shipped:**

| Phase | What | Tests |
|-------|------|-------|
| EN.1 | `flint_enrich_registry` + `flint_approve_enrichment` MCP tools, `enrichmentDraftService`, IPC handlers (`enrichment:get-drafts`, `enrichment:approve`) | 19 new (enrichTool.test.ts) |
| EN.2 | JSDoc extraction in `componentIndexer.ts` — auto-populates descriptions from `/** */` comments | 7 new (componentIndexer.test.ts) |
| EN.3 | Scope panel: three-state dots (bare/draft/enriched), expandable draft review, approve/edit/dismiss, health metric | 9 new (ComponentScopePanel.test.tsx) |
| EN.4 | Discovery banner when >50% bare: "Ask your AI: enrich my component registry" with copy-to-clipboard | (included in EN.3 tests) |
| Agent | `flint-registry-enricher` agent definition — cross-component analysis, usage mining, relationship discovery | n/a |

**Code review:** FIX verdict. One critical fix applied (IPC handlers not unwrapping `.drafts` sub-key). Now SHIP-ready.

**Test results:**
```text
MCP:   2,135/2,135 passing (26 new)
Glass:   754/754 passing (9 new)
Core:    935/935 passing
TSC:     0 errors
```

---

## Session: 2026-03-20 CK.1-4 (COMPLETE)

**Sprint:** CK.1-4 — Component Knowledge (Closing the Generation Gap)
**Goal:** Make the AI effectively build with registered components, not just be constrained by them.

**What shipped:**

| Phase | What | Tests |
|-------|------|-------|
| CK.1 | RAG auto-seeding from manifest + tokens + docs on project open | 13 new (ragSeeder.test.ts) |
| CK.2 | 6th plan intent `component-composition` — queries registry, suggests components | 30 new (planComposition.test.ts) |
| CK.3 | On-demand re-indexing via `project:reindex` IPC | 12 new (reindex.test.ts) |
| CK.4 | Extended ComponentEntry: usageExample, compositionNotes, a11yNotes, relatedComponents | 13 new (registryService.test.ts) |

**Test results:**
```text
MCP:   2,109/2,109 passing (43 new)
Core:    935/935 passing (25 new)
Glass:   745/745 passing
TSC:     0 errors
```

**Code review:** SHIP. Two fixes applied: Commandment 12 atomic write in reindex handler, CK.4 fields added to ragSeeder. One follow-up noted: `flint_reindex_registry` MCP tool not yet registered (IPC path works, MCP clients need follow-up).

---

## Session: 2026-03-20 CR.4 (COMPLETE)

**Sprint:** CR.4 — Glass UI for Component Scope Management
**Goal:** Visual control surface for managing which components the AI can use per-project.

**What shipped:**

| Task | Files | Tests Added |
|------|-------|-------------|
| IPC: `scope:get-registry-and-scope`, `scope:set-scope` | `electron/main.ts`, `electron/preload.ts` | 18 new (componentScope.test.ts) |
| Types: `ComponentRegistryEntry`, `ComponentScopeData`, `ScopeAPI` | `src/types/flint-api.d.ts` | 0 (type-level, verified by TSC) |
| Store: `'scope'` added to `RightTab` union | `src/store/canvasStore.ts` | 0 (type-level) |
| UI: ComponentScopePanel (scope editor in right sidebar) | `src/components/ui/ComponentScopePanel.tsx`, `src/App.tsx` | 11 new (ComponentScopePanel.test.tsx) |

**Test results:**
```text
Glass: 745/745 passing (11 new)
Core:  910/910 passing (18 new)
TSC:   0 errors
```

**Code review:** FIX verdict (2 fixes applied inline: useEffect cleanup for debounce timer, string validation in scope:set-scope). Now SHIP-ready.

**Key decisions:**
1. New "Scope" tab in right sidebar (Layers icon), after Agents, before Recovery
2. No new Zustand store — local state only (matches AgentDashboard pattern)
3. "All Components" vs "Restricted" mode toggle with clear semantics
4. 300ms debounced persistence for rapid toggles, optimistic UI with revert on failure

---

## Session: 2026-03-20 CR.1-3 (COMPLETE)

**Sprint:** CR.1-3 — Constrained Registry (Proactive Generation Constraints)
**Goal:** When a user describes what they want built, the AI orchestrator is constrained to only use components and styles registered for the active project.

**What shipped:**

| Task | Files | Tests Added |
|------|-------|-------------|
| CR.1: System prompt injection (registry + tokens as BINDING constraints) | `electron/orchestrator.ts` | 10 new |
| CR.2: Registry membership gate in Commandment 16 validation loop | `electron/orchestrator.ts` | 16 new |
| CR.3: Per-project `componentScope` filter via `.flint/policy.json` | `electron/orchestrator.ts` | 4 new |

**New exported functions:**
- `serializeRegistryConstraints(registry, scope?)` — serializes allowed components into system prompt
- `serializeTokenConstraints(tokens)` — serializes design token palette into system prompt
- `validateRegistryMembership(toolName, input, registry)` — hard-rejects ops targeting unregistered components

**Test results:**
```
Core: 892/892 passing (30 new in constrainedRegistry.test.ts)
TSC:  0 errors
```

**Code review:** SHIP verdict. Three low-priority items noted (double scope filter, "Typographys" pluralization, module-level activeRegistry). No blockers.

**Key architectural decision:** Governance flipped from reactive (audit after generation) to proactive (constrain before generation). The AI model now sees a BINDING component registry and token palette in its system prompt. Unregistered components are rejected at the Commandment 16 validation loop before reaching the UI.

---

## Session: 2026-03-20 CV2.1 (Contracts Phase)

**Sprint:** CV2.1 -- Build/Govern Canvas Mode Toggle
**Goal:** Write Phase 1 contract artifact for the three-mode canvas view toggle (Preview/Build/Govern).

**Contracts produced:**
- `.flint-context/contracts/CV2.1-contract.md` -- Full contract: state, UI, keyboard shortcuts, StatusBar indicator
- `.flint-context/contracts/CV2.1-validation.md` -- Validation spec with 24 test case requirements

**Files in scope (Phase 2 implementation):**

| Task | Files to MODIFY | Files to CREATE |
|------|----------------|-----------------|
| State | `src/store/canvasStore.ts` | `src/store/__tests__/canvasStore.canvasView.test.ts` |
| UI | `src/components/editor/XYCanvas.tsx`, `src/App.tsx`, `src/components/editor/StatusBar.tsx` | `src/components/editor/CanvasViewToggle.tsx`, `src/components/editor/__tests__/CanvasViewToggle.test.tsx` |

**Key architectural decisions:**
1. No new IPC channels -- entirely renderer-side state + UI
2. New `CanvasView` type is orthogonal to existing `CanvasMode` ('design'|'interact')
3. Build and Govern modes render placeholder panels (actual content in CV2.3/CV2.4)
4. `canvasView` resets to `'preview'` on `closeWorkspace()` -- no cross-project bleed
5. Cross-file drop handler gated behind `canvasView === 'preview'`

**Parallelism:** flint-state-architect and flint-design-engineer can run fully in parallel. flint-test-writer runs after both complete.

**Next steps:** Phase 2 implementation. Spawn specialist agents per contract.

---

## Session: 2026-03-20 HYDRO.1 (COMPLETE)

**Sprint:** HYDRO.1 — Component Hydration Wiring

**What shipped:**

| Task | Files | Tests Added |
|------|-------|-------------|
| HYDRO.1-A: `flint_ingest_figma` stub → full HydroPaste wiring | `flint-mcp/src/tools/ingest.ts` | 7 new (ingestTool.test.ts) |
| HYDRO.1-B: Figma ID deterministic match loop | `flint-mcp/src/core/hydroPaste.ts` | 10 new (hydroPaste.test.ts) |
| HYDRO.1-C: Component Registry Search UI in Glass | `src/components/ui/ComponentSearch.tsx`, `src/components/editor/AssetsPanel.tsx` | 11 new (ComponentSearch.test.tsx) |

**Post-review fixes applied:**

- `ingest.ts`: Added try/catch around `engine.processPayload` → `'error'` status now reachable
- `ingest.ts`: Extended `isInvalidPayload` detection to include `'unrecognized'` and `'error'` summaries
- `hydroPaste.ts`: Replaced `as any` with narrow typed cast + comment; renamed `violationCount` → `registryComponentCount`; narrowed `matchMode !== 'none'` guard to fix TSC error
- `ComponentSearch.tsx`: Replaced `mcp!.callTool` with `mcp` guard + `mcp.callTool`; added `aria-label` on Insert buttons; added `role="status"` on spinner
- `ComponentSearch.test.tsx`: Added `isError: true` response test; strengthened loading test to assert spinner presence

**Test results:**
```
MCP:   2046/2046 passing (28 new: 7 + 10 + 11 across 3 test files)
Glass: 642/642 passing (32 new from this sprint)
TSC:   0 errors
```

**What these changes enable:**

- Calling `flint_ingest_figma` now returns actual generated JSX components (not an empty stub)
- Figma component IDs deterministically match to code components via `queryRegistryDeterministic`
- Glass "Assets" tab now has a live search field — type 2+ chars → searches registry → click Insert to inject into active layer

**Nothing remains from HYDRO.1. Territory cleared.**

---

## Session: 2026-03-20 HYDRO.1 (Contracts Phase)

**Sprint:** HYDRO.1 -- Component Hydration Wiring
**Goal:** Write Phase 1 contract artifacts for three wiring tasks that connect the Figma ingestion pipeline, deterministic component matching, and Glass search UI.

**Contracts produced:**
- `.flint-context/contracts/HYDRO.1-A-contract.md` -- Wire HydroPaste into flint_ingest_figma tool
- `.flint-context/contracts/HYDRO.1-B-contract.md` -- Figma ID deterministic match loop
- `.flint-context/contracts/HYDRO.1-C-contract.md` -- Component Registry Search UI in Glass

**Files in scope (Phase 2 implementation):**

| Task | Files to MODIFY | Files to CREATE |
|------|----------------|-----------------|
| HYDRO.1-A | `flint-mcp/src/tools/ingest.ts`, `flint-mcp/src/core/hydroPaste.ts` | `flint-mcp/src/__tests__/ingestTool.test.ts` |
| HYDRO.1-B | `flint-mcp/src/core/hydroPaste.ts` | `flint-mcp/src/core/__tests__/hydroPaste.test.ts` |
| HYDRO.1-C | `src/components/editor/AssetsPanel.tsx` | `src/components/ui/ComponentSearch.tsx`, `src/components/ui/__tests__/ComponentSearch.test.tsx` |

**Key architectural decisions:**
1. No new IPC channels needed -- HYDRO.1-C uses existing `window.flintAPI.mcp.callTool` (Phase W.3)
2. HYDRO.1-B replaces inline manifest scan in hydroPaste.ts with canonical `queryRegistryDeterministic()` from registryService.ts
3. HYDRO.1-C lives in the left sidebar "assets" tab, augmenting (not replacing) the hardcoded AssetsPanel tiles
4. HYDRO.1-A and HYDRO.1-B both touch hydroPaste.ts -- coordinate via territory claim or merge sequentially

**Parallelism:** HYDRO.1-A and HYDRO.1-C can run fully in parallel. HYDRO.1-B shares hydroPaste.ts with HYDRO.1-A.

**Next steps:** Phase 2 implementation. Spawn specialist agents per contract.

---

## Session: 2026-03-19 ONBOARD.1-FIXES (Swarm: ONBOARD.1-FIXES)

**Files changed:**
- `src/components/ui/SetupWizard.tsx`
- `src/components/ui/__tests__/SetupWizard.test.tsx`

**Fixes (9 UX and safety issues from formal audit):**
1. **R-1** — Removed auto-write `useEffect`; `writeMCPConfig` now fires only when user clicks "Install MCP Config"; config JSON preview shown before install.
2. **R-2** — Error state now shows "Copy config snippet" button (copies JSON to clipboard) and manual paste instruction with the target path.
3. **R-3** — "Skip" on mcp-snippet calls `goNext` (advances to verify), not `handleDone`; `completeFirstLaunch` is called only from the done step's "Start building" button.
4. **R-4** — Escape key handler checks `writeStatus !== 'writing'` before calling `onComplete`; dismissal blocked mid-write.
5. **R-5** — Verify step copy updated: removed "restart your IDE" instruction; replaced with accurate "Flint is checking its internal connection" text.
6. **R-6** — IDE selection button now calls `setWriteStatus(null)` and `setWriteError(null)` on click to reset stale write state.
7. **R-8** — Removed two stale `@ts-expect-error` comments on `window.flintAPI.setup` and `window.flintAPI.mcp` calls (types are defined in `flint-api.d.ts`).
8. **R-9** — Added `aria-live="polite"` to the mcp-snippet status indicator container.
9. **R-10** — `StepDots` rewritten: completed steps show filled indigo dot with checkmark character; current step shows outlined ring with inner filled dot; future steps show hollow ring. Uses `data-step-state` and `data-step-index` attributes for testability.

**Test results:**
```
Glass: 610/610 passing (17 new)
TSC:   0 errors
```

---

## Session: 2026-03-19 MCP-FIXES (Swarm: MCP-FIXES)

**Files changed:**
- `flint-mcp/src/core/capabilities/index.ts`
- `flint-mcp/src/server.ts`
- `flint-mcp/src/core/tailwindMigrator.ts`
- `flint-mcp/src/core/tailwindMigrator.test.ts` (deleted — duplicate)

**Fixes:**
1. **capabilities/index.ts** — Updated `audit_ui_component` param `componentPath`→`file` and `flint_query_registry` param `semantic_query`→`query`; marked `projectRoot` as optional to match actual tool schemas.
2. **server.ts (audit_ui_component)** — Added `args.file ?? args.componentPath` fallback for backward-compatible clients still sending `componentPath`.
3. **server.ts (flint_query_registry)** — Added `args.query ?? args.semantic_query` fallback for backward-compatible clients still sending `semantic_query`.
4. **server.ts (flint_migrate_tw)** — Added path traversal guard: rejects any `glob` containing `..` or an absolute path before file operations.
5. **server.ts (SYNC.4 factories)** — Converted `getSyncCheckService`, `getOfflineQueue`, `getSyncHistoryService` from per-call constructors to module-scope cached singletons (Maps keyed by projectRoot) to prevent SQLite connection leaks.
6. **tailwindMigrator.ts** — Replaced bare `@ts-ignore` with `@ts-expect-error` plus an explanatory comment about the Babel CJS/ESM interop.
7. **tailwindMigrator.test.ts** — Deleted duplicate; canonical test lives at `flint-mcp/src/core/__tests__/tailwindMigrator.test.ts`.

**Test results:**
```
MCP: 1886/1886 passing (0 new)
TSC: 0 errors
```

---

## 1. What Is Flint

Flint is a governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance deterministically at the AST level — before code reaches production.

**Two components:**

| Component | What it is | Where it runs |
|-----------|------------|---------------|
| **Flint MCP** | Headless governance engine — 13 tools, 6 resources, 3 prompts | Anywhere: CI, Claude Code, Cursor, VS Code |
| **Flint Glass** | Visual observability layer — reads MCP state, calls MCP tools | Electron 35.7.5 desktop app |

Flint Glass owns zero business logic. All enforcement, mutation, and linting lives in the MCP engine.

---

## 2. How to Run

### First-time setup

```bash
npm install
```

> Note: `flint-mcp/` is the headless server package. Install its deps separately if working on MCP tools directly:
> ```bash
> cd flint-mcp && npm install
> ```

### Launch Flint Glass (Electron + Vite)

```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

`ELECTRON_RUN_AS_NODE` must be unset — if it is set (which happens when Claude Code spawns the shell), Electron boots in a headless Node mode and the window never appears.

### Run tests

```bash
# MCP engine tests (515 tests across 23 files)
cd flint-mcp && npm test

# Glass component tests (386 tests across 25 files)
npm run test:react

# Core + Electron tests (295 tests across 11 files)
npm test

# TypeScript strict check (both packages)
npx tsc --noEmit
```

---

## 3. Architecture

### 3.1 Glass Layout

Glass is a 3-panel Electron app. There is no Monaco editor pane, no terminal pane, no file explorer pane — those live in the host IDE (Claude Code / Cursor / VS Code).

```
┌─────────────────┬──────────────────────────┬─────────────────────┐
│  Left Panel     │  Infinite Canvas         │  Right Sidebar       │
│  (Layers /      │  (XYCanvas.tsx +         │  Tabs: Properties |  │
│   Assets)       │   LivePreview node)      │  Tokens | Activity | │
│                 │                          │  Health              │
│  AST tree       │  Ghost Code HUDs         │                      │
│  Asset grid     │  Drift Overlays          │  Governance HUDs     │
└─────────────────┴──────────────────────────┴─────────────────────┘
```

### 3.2 Process Model

```
Main Process (Node.js / Electron)
  FileTransactionManager  — atomic .tmp → rename write queue
  SQLite WAL              — flint.db (project) + flint-registry.db (global)
  GitManager              — shadow commits on every save
  orchestrator.ts         — Claude AI + constrained AST Tool Catalog + TSC loop
  ingestion-server.ts     — Figma plugin flint (port 4545)
  LSP clients             — TypeScript + Vue language servers

Renderer Process (React 19 / Vite)
  XYCanvas.tsx            — infinite canvas (@xyflow/react v12)
  LivePreview.tsx         — srcdoc iframe, 100% offline
  ExportModal.tsx         — pre-flight Mithril + a11y audit gate

Preload (contextBridge)
  window.flintAPI        — typed IPC surface between renderer and main
```

### 3.3 MCP-First Design

Claude Code and other MCP clients connect to Flint MCP directly. Glass reads the same MCP Resources to display state — it is a consumer of the engine, not a wrapper around it.

MCP connection config (add to `~/.claude/mcp.json`):
```json
{
  "mcpServers": {
    "flint": {
      "command": "node",
      "args": ["/path/to/flint-mcp/dist/server.js"]
    }
  }
}
```

---

## 4. File Map

### `src/` — Glass React renderer

| Path | Role |
|------|------|
| `src/App.tsx` | Root layout, keyboard bindings (Cmd+Z / Cmd+Shift+Z), IPC wiring |
| `src/components/editor/XYCanvas.tsx` | Infinite canvas — LivePreview as draggable custom node |
| `src/components/editor/LivePreview.tsx` | `srcdoc` iframe + Shield overlay + design/interact mode toggle |
| `src/components/inspector/LayoutPanel.tsx` | Figma-grade Auto Layout panel |
| `src/components/ui/ExportModal.tsx` | Export Gate — Mithril severity escalation + a11y pre-flight |
| `src/components/ui/RecoveryPanel.tsx` | Git Time Machine UI — per-node surgical revert |
| `src/components/editor/AssetsPanel.tsx` | Asset Management Hub (SQLite-backed, zombie auditor) |
| `src/store/editorStore.ts` | Active-file AST, Visual Tree, `applyBatch`, `syncCode` |
| `src/store/canvasStore.ts` | Workspace tree, active file, `saveState` lifecycle |
| `src/store/astBufferStore.ts` | Headless multi-file AST buffers, `crossFileMove` (11-step atomic) |
| `src/store/historyStore.ts` | `past`/`future` stacks with `CrossFileMoveRedoPlan` |
| `src/store/annotationStore.ts` | Annotation CRUD + `fs.watch` push sync from MCP writes |
| `src/components/ui/GovernanceDashboard.tsx` | Health score ring, grade letter, top-5 rules ("health" tab) |
| `src/components/ui/AnnotationList.tsx` | Annotation rendering in Properties panel |
| `src/components/editor/ViolationTooltip.tsx` | Ghost Canvas severity tooltip on hover |
| `src/core/ASTService.ts` | `applyMutationBatch`, `applyInversions`, `synthesizeImports` |
| `src/core/MithrilLinter.ts` | CIEDE2000 ΔE color drift + typography/spacing/shadow/opacity visitors |
| `src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules (A11Y-001..010) |
| `src/core/recoveryController.ts` | Undo/redo orchestration — single-file + cross-file |
| `src/utils/layoutMapper.ts` | Atomic Tailwind layout class management |

### `electron/` — Electron main process

| File | Role |
|------|------|
| `electron/main.ts` | IPC handlers: `saveFile`, `saveFileBatch`, `readFile`, `ast:git-show`, `ast:git-log` |
| `electron/preload.ts` | `contextBridge` — exposes `window.flintAPI` to renderer |
| `electron/FileTransactionManager.ts` | Atomic `.tmp` → `rename` write queue, serialized per path |
| `electron/GitManager.ts` | `ensureRepo`, `shadowCommit`, `getGitNode` for surgical recovery |
| `electron/orchestrator.ts` | Claude streaming + 7-op AST Tool Catalog + in-memory TSC validation |
| `electron/ingestion-server.ts` | Figma ingestion (port 4545) + SDI webhook (`POST /intent`) |
| `electron/store.ts` | SQLite `flint.db` initialization and schema |
| `electron/ragService.ts` | `sqlite-vec` design system RAG for AI context injection |
| `electron/mcpClient.ts` | MCP client (JSON-RPC stdio, crash recovery) |

### `src/hooks/` — React hooks

| File | Role |
|------|------|
| `src/hooks/useMCPEventListener.ts` | Renderer hook for MCP event dispatch |
| `src/hooks/useContextSync.ts` | Context flint (writes `.flint/context.json`) |

### `flint-mcp/` — Headless MCP server

| Path | Role |
|------|------|
| `flint-mcp/src/server.ts` | MCP tool and resource registrations (13 tools, 6 resources, 3 prompts) |
| `flint-mcp/src/core/ast-modifier.ts` | `assembleLayout`, `apply_ast_mutations` |
| `flint-mcp/src/core/registryService.ts` | `flint_query_registry` keyword search over `flint-manifest.json` |
| `flint-mcp/src/core/MithrilLinter.ts` | CIEDE2000 + typography/spacing/shadow/opacity visitors |
| `flint-mcp/src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules |
| `flint-mcp/src/core/events.ts` | MCP event bus + JSONL writer |

### `docs/` — Planning and strategy

| Path | Role |
|------|------|
| `docs/FLINT-MASTER-PLAN.md` | Single source of truth for architecture, roadmap, and ejected plans |
| `docs/strategy/` | Fidelity strategy documents (visual accuracy, logic ingestion, AI healing) |
| `docs/archive/` | Stale pre-pivot planning documents (not authoritative) |

---

## 5. Key Invariants

1. **No hardcoded colors in Glass** — token-derived Tailwind classes only. ΔE > 2.0 triggers Amber warning in PropertiesPanel.
2. **`data-flint-id` is sacred** — never remove or overwrite it. All canvas-selectable elements need it. All mutations must preserve it.
3. **Atomic writes only** — all file saves route through `FileTransactionManager`. Never call `fs.writeFile` directly for stateful changes.
4. **No raw code strings from AI** — `orchestrator.ts` is constrained to 7 ops from the AST Tool Catalog. Raw code string generation is prohibited (Commandment 15).
5. **Babel AST for all mutations** — never use regex on source code. Every code change goes through `ASTService.applyMutationBatch` (Commandment 13).
6. **In-memory TSC before confirmation** — `orchestrator.ts` runs a TypeScript type-check on every AI-proposed mutation before surfacing a confirmation dialog (Commandment 16).
7. **`historyStore.clear()` on file-open** — prevents stale undo entries bleeding across files.
8. **`isRecovery` flag on cross-file redo** — `crossFileMove(..., { isRecovery: true })` prevents double-push to history.

---

## 6. Known Issues

- **`ELECTRON_RUN_AS_NODE` must be unset** — Claude Code sets this env var in its shell environment. If you launch `npm run dev` from a Claude Code terminal without unsetting it, Electron boots headless and no window appears. Always run `unset ELECTRON_RUN_AS_NODE && npm run dev`.
- **`ENOTEMPTY` on APFS in tests** — use `rm({ maxRetries: 3 })` for temp directory cleanup. `force: true` alone is insufficient on APFS.
- **Monaco undo guard** — `App.tsx` uses `!= null` (loose equality) for the Monaco focus guard. `document.activeElement?.closest(…)` returns `undefined` when `activeElement` is null — strict `!== null` incorrectly allows undo to fire.

---

## 6b. Active Work

- **ONBOARD.1 — First-Launch Setup Walkthrough:** Phase 1 contract produced. 5-step wizard guides user through MCP registration in their IDE. Contract at `.flint-context/contracts/ONBOARD.1-contract.md`. Awaiting Phase 2 implementation.

## 7. Recent Changes

- **Phase U.4 — Ghost Code Snippets (COMPLETE 2026-03-16):** New `GhostCodeSnippet.tsx` floating overlay (portal into `document.body`) shows JSX source context for the selected canvas node. Extracts source lines via node id's embedded 1-based line number (format `tagName:line:col`). CSS-class-based keyword tokeniser with Flint palette token colours — no Monaco/CodeMirror added. Escape key + close button dismiss; auto-resets on node deselect. Integrated into `XYCanvas.tsx` as a sibling overlay. 18 new Glass tests covering `parseLineFromNodeId`, `extractSourceContext`, and all component render/dismiss states. Glass: 554/554 passing (18 new). TSC: 0 errors.
- **Phase CX.1 — Response Quality Baseline (COMPLETE 2026-03-16):** New `flint-mcp/src/core/projectContext.ts` (`loadProjectContext()` — O(1) read of `.flint/debt-history.json`, graceful null on any error). `summary` field added to `flint_audit`, `flint_fix`, `flint_ast_mutate`, `flint_debt_report`, `audit_ui_component`, `flint_swarm_audit_fix` responses — one sentence plain English per contract generation rules. `project_context` footer on `flint_audit`, `flint_fix`, and `flint_ast_mutate` responses. `dryRun` flag formalized on `flint_fix` (response labeling + provenance skip) and `flint_ast_mutate` (writeFile forced false + provenance skip + MRS skip). Server `instructions` onboarding hint set in MCP Server constructor. 69 new tests (projectContext.test.ts: 24, responseQuality.test.ts: 34, cx1-response-quality.test.ts: 11). MCP: 1,158/1,158 passing, TSC: 0 errors.
- **Phase ING (COMPLETE 2026-03-16)** — Ingestion-Time Audit & Auto-Heal. `IngestionAuditor.ts` (CIEDE2000 tier classification + Babel AST surgery), heal pass wired in `/ingest-ast` handler, `importSummaryStore`, `ImportSummary.tsx` (toast + panel), `flint:import-summary` IPC push, `import:snap-to-token` + `import:undo-all-heals` IPC handlers, `healOnAudit` parameter on `flint_audit` MCP tool. 30 new tests (ING-01 → ING-18 + integration tests + store tests + component tests).
- **Wave 1 (COMPLETE)** — Activity Feed upgrade (filter bar, search, error view buttons). Figma Connection Status (IPC endpoint, StatusBar popover, staleness colors). Ghost Canvas (severity heat tints, ViolationTooltip, click-to-properties, viewport culling). MCP Discoverability (`flint://capabilities` resource, `flint-workflow-guide` prompt).
- **Wave 2 (COMPLETE)** — Annotation rendering in Glass (`annotationStore`, `AnnotationList`, LayerTree annotation dots, `fs.watch` push sync from MCP). Governance Health Dashboard (health score ring, grade letter, top-5 rules, "health" tab in right sidebar).
- **JTBD score: 7.5 -> 8.4 (projected)** — Waves 1-2 close the observability and discoverability gaps.
- **Glass 3-panel layout** — [Left: Layers/Assets] [Center: Canvas] [Right: Properties/Tokens/Activity/Health]. Four right sidebar tabs.
- **New store: `annotationStore`** — Annotation CRUD, fs.watch push sync, rendering state for AnnotationList and LayerTree dots.
- **New components** — `ViolationTooltip` (Ghost Canvas hover), `AnnotationList` (right sidebar), `GovernanceDashboard` (health tab). Figma connection status popover is implemented inline in `StatusBar.tsx`.
- **MCP-first architecture** — `flint-mcp/` is the authoritative governance engine. Glass is a read-only consumer of MCP Resources.
- **Context flint** — `.flint/context.json` is a stateless file that connects the host IDE cursor position and selection to Flint state.
- **Annotation engine** — COLLAB.1-4 complete: annotation data model + `flint://annotations` MCP resource + `flint_annotate` MCP tool + Glass rendering.
- **Notification system** — Toast notifications for save state, sync state, and governance violations wired through `canvasStore`.

---

## 8. Module Status (all ONLINE)

See `docs/FLINT-MASTER-PLAN.md` Section 3 for the full module table. All phases through COLLAB.4 are online and tested.

**Sprint 3 — Risk + Chat Quality (COMPLETE 2026-03-16):**
- **GOV.1 — Rule Provenance (COMPLETE):** Static provenance registry mapping all 40 governance rules to compliance authorities (WCAG 2.1 AA, SOC2, FDA SaMD, Section 508). Provenance attached to `flint_audit` and `audit_ui_component` violations. `flint_audit_report` extended with `sourceAuthority` filter and compliance summary. 50 tests.
- **GOV.2 — Override Telemetry (COMPLETE):** SQLite-backed `override_events` table. `OverrideTelemetryService` with record, query by session/rule, summary, pruning. `flint_override_telemetry` MCP tool (summary/by_session/by_rule). `flint://overrides` resource. Fire-and-forget recording wired into audit/fix. 33 tests.
- **V.1 — Risk Scoring Approval Flow (COMPLETE):** MRS Green/Amber/Red tiers wired into orchestrator mutation approval. Green auto-approves, Amber requires human review, Red requires senior sign-off. Policy floors enforce minimum tiers for structural/destructive ops. `requiresReview`/`requiresSignoff` annotated on tool_call chunks. 47 tests.
- **AGV.1 — Per-Agent Tool ACL (COMPLETE):** Deny-by-default per-agent permission model extending SEC.3 renderer allowlist. Tier hierarchy (untrusted/standard/trusted/admin). Rate limiting per session. `agentPolicy.ts` + `mcp-policy.ts` unified `checkToolAccess`. 74 tests.
- **AGV.3 — Agent Auto-Escalation (COMPLETE):** Configurable escalation rules engine with session-scoped tracking. 4 default rules (red count, amber count, avg risk, velocity). Rule deduplication. `agentEscalation.ts`. Note: not yet wired into orchestrator — infrastructure ready. 74 tests.
- **CX.1 — Response Quality Baseline (COMPLETE):** `summary` + `project_context` on all tool responses. `dry_run` flag on `flint_ast_mutate` and `flint_fix`. MCP `initialize` onboarding pointer. 76 tests.
- **CX.3 — Error Taxonomy (COMPLETE):** Structured `FLINT-ERR-001..010` error codes with descriptions and recovery instructions. `explanation` field on Mithril and A11y rules. `errorCodes.ts` + `errorTaxonomy.ts`.
- **MDA.1 — Mithril Delta Mode (COMPLETE):** Baseline snapshotting with SHA-256 violation hashing. Per-project baselines. `auditDelta` suppresses known violations. Sentinel row for empty baselines. 39 tests.
- **SEC.4-6 (COMPLETE):** SEC.4 safeStorage API key encryption, SEC.5 terminal cwd/input hardening, SEC.6 ingestion rate limiting.
- **U.3 — Immersive Canvas (COMPLETE):** Removed CodeEditor, CodeEditorPanel, TerminalPanel. Recovers ~40% vertical real estate.
- **ING.3 — healOnAudit Integration Tests (COMPLETE):** 17 tests covering happy path, backward compat, zero-token edge case.
- **Security fix:** Closed agent ID spoofing vector in `main.ts` — renderer always identified as `'renderer'`, never trusts `_agentId` from IPC args.
- **`/review` command:** Automated pre-commit code review gate (`.claude/commands/review.md`). Domain-aware parallel `flint-code-reviewer` agents. Wired into Contract-First workflow between Phase 2 and Phase 3.

**Previously completed:**
- V.1-rs (MRS stateless scorer), V.2-mp (Mutation Provenance Ledger), CX.2 (flint_plan), Sprint 2 Security (SEC.1-3, P0-4), Phase ACX (Proactive Agent Context), Phase ING (Ingestion Auto-Heal), JTBD Waves 1-3, INFRA.1-2, EXP.2 (Debt Report), GOV.3 (Session Validation), Test Coverage Remediation.
- **Contract-First Feature Build:** Mandatory 3-phase workflow. See `.claude/workflows/feature-build.md`.

**EXP.3 — Tailwind v3→v4 Migration Tool (COMPLETE 2026-03-16):**
- **`flint-mcp/src/core/tailwindMigrator.ts`** — Core migration engine: Babel AST visitor (`JSXAttribute` traversal on `className`), `TW_V3_TO_V4_MAP` (75+ class entries covering flex, text-overflow, box-decoration, bg-gradient, opacity modifiers, shadow, outline renames), `migrateFile(source, options)`, `migrateFileAtPath(filePath, options)`. Dry-run default. Commandment 13 compliant — zero regex on source code.
- **`flint-mcp/src/core/__tests__/tailwindMigrator.test.ts`** — 56 tests covering all transformation categories, template literals, expression containers, no-op cases, malformed JSX, empty input, dry-run vs. write mode, file I/O round-trips, TW_V3_TO_V4_MAP integrity checks.
- **`flint-mcp/src/server.ts`** — `flint_migrate_tw` MCP tool registered (tool definition + `case "flint_migrate_tw"` handler). Accepts `filePaths[]`, `dryRun`, `from`, `to`. Post-migration `flint_audit` run on each changed file. Returns per-file `summary`, `changes[]`, `auditViolationCount`.
- MCP: 1,602/1,602 passing (56 new) | TSC: 0 errors

**Sprint 4 Phase A — Wire + AGV.2 (COMPLETE 2026-03-16):**
- **1A: Escalation engine wired into orchestrator.** `escalationEngine` imported from `agentEscalation.ts`. After MRS computation, `recordMutationRisk` called. `block_mutations` escalation rejects tool calls with clear error. `require_review` escalation forces `requiresReview=true`.
- **1B: Policy file loading wired into main.ts.** `loadAgentPolicy(projectRoot)` called at all 3 `activeProjectRoot` assignment points (openFolder, create-scratchpad, openPath). Per-project `.flint/agent-policy.json` is now live.
- **1C: Blast radius populated in orchestrator.** `flint_ast_mutate` extracts `mutations.length` for real blast radius. Other tools default to 1.
- **AGV.2: Agent Risk Dashboard (COMPLETE).** New `AgentRiskService` aggregates provenance + risk scores + overrides per agent. `flint://agent-risk` MCP resource. `flint_agent_risk` MCP tool (summary/by_agent). Types: `AgentRiskProfile`, `AgentRiskSummary`. 15 new tests.

**GOV.4: Statistical Anomaly Detection (COMPLETE 2026-03-16):**
- **AnomalyDetectionService** (`flint-mcp/src/core/governance/anomalyDetectionService.ts`): Computes baseline stats from mutations_ledger, governance_events, override_events, mutation_risk_scores. Detects 5 anomaly types (override_spike, violation_surge, risk_drift, velocity_spike, agent_behavior_change) at 3-sigma threshold. When stddev=0, uses mean*1.5 fallback. Severity derived from sigma distance (3σ=warning, 4σ=critical). SQLite `anomaly_history` table for persistence.
- **Types** added to `types.ts`: `AnomalyType`, `AnomalySeverity`, `BaselineStats`, `Anomaly`.
- **MCP tool** `flint_anomaly_report` registered with actions: `detect`, `history`, `baseline`.
- **MCP resource** `flint://anomalies` returns count + latest 10 anomalies.
- **23 new tests** covering: schema init, empty/missing tables, single data point, multi-day baselines, all 5 anomaly types, stddev=0 fallback, multiple simultaneous anomalies, persistence, severity derivation, history ordering/limit/scoping.
- **Test results:** MCP: 1491/1512 passing (23 new; 21 pre-existing policy test failures unchanged) | TSC: 0 errors

**2026-03-19 ELECTRON-JSONC: Setup IPC Bug Fixes (COMPLETE):**
- **Files changed:** `electron/main.ts`, `electron/__tests__/setupIpc.test.ts`
- **Fix 1 (JSONC-safe parse):** Added `stripJsoncComments()` helper in `main.ts`; `setup:write-mcp-config` now strips JSONC comments before `JSON.parse()` so VS Code / Cursor settings files with `//` or `/* */` comments are merged correctly.
- **Fix 2 (Claude Code dual detection):** `setup:detect-ides` now treats either `~/.claude/settings.json` (older) or `~/.claude/mcp.json` (fresh MCP-first install) as proof of Claude Code; `settingsPath` prefers `mcp.json` when present.
- **Tests:** 21 new tests (SETUP-06b/c/d + SETUP-21-27). Core: 812/812 passing (21 new). TSC: 0 errors.

**ONBOARD.1: First-Launch Setup Walkthrough (COMPLETE 2026-03-18):**
- **`src/components/ui/SetupWizard.tsx`** -- 5-step full-screen wizard (welcome, ide-detect, mcp-snippet, verify, done). Local React state only, no Zustand store. Uses `window.flintAPI.setup.*` IPC for IDE detection and first-launch flag. Uses `window.flintAPI.mcp.callTool('flint_status')` for connection verification.
- **`electron/main.ts`** -- 3 IPC handlers: `setup:detect-ides` (macOS IDE path detection via `existsSync`), `setup:check-first-launch` (reads `~/.flint/setup.json`), `setup:complete-first-launch` (writes flag). Claude Code detection checks `settings.json` but returns `mcp.json` as the config target.
- **`electron/preload.ts`** -- `setup` namespace added to `window.flintAPI`.
- **`src/types/flint-api.d.ts`** -- `setup` property added as required on `FlintAPI` interface.
- **`src/App.tsx`** -- Wizard gate inserted before LaunchScreen gate with 3-second timeout fallback.
- **Tests:** 22 wizard tests (SetupWizard.test.tsx) + 14 IPC tests (setupIpc.test.ts) = 36 new tests.
- **Validation:** Integration report at `.flint-context/contracts/ONBOARD.1-validation.md`. Verdict: SHIP.
- Glass: 592/592 | Core: 791/791 | MCP: 1886/1886 | TSC: 0 errors

**Remaining architectural gaps (Sprint 4):**
4. Duplicated MRS formula in `riskApproval.test.ts` — no sync enforcement with `orchestrator.ts`

**Note:** Master Plan uses V.1 (Risk Scoring) and V.2 (Mutation Provenance). JTBD plan uses V.1-gd (Governance Dashboard) and V.2-af (Activity Feed). These are different features — use full phase codes to avoid confusion.
