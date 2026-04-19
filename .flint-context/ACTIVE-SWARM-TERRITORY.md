# Active Swarm Territory Map

**Purpose:** Prevents concurrent swarms from creating merge conflicts by claiming file ownership.
**Protocol:** Before editing any file, check this map. If it's claimed, coordinate or wait.

---

## How to use this map

1. **Before starting a new swarm:** Read this file
2. **If your swarm needs a file in the MODIFY list:** Either wait for ACX to finish, or coordinate by adding your changes to a separate section of the file (e.g., append new IPC handlers, don't restructure existing ones)
3. **If your swarm creates new files:** Add them to this map under your own swarm section
4. **When a swarm completes:** Remove its section from this file

---

## Template for new swarm entry

```markdown
## Swarm: Phase [NAME]

**Status:** [CONTRACTS APPROVED / IN PROGRESS / COMPLETE]

### Files to CREATE
| File | Purpose |

### Files to MODIFY
| File | What changes |
```

---

## Swarm: FIXTURE.1.1 — DTCG Token Shape Adapter (closes FIXTURE.1 drift)

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-19)
**Scope:** Close the documented drift from FIXTURE.1 integration report. The plumbing (`resolveFixture`, `auditAllWithSurface`, `fixtureContext` payload) all works; the failing invariant is `demo-compliant-clean === 0` because MithrilLinter's token consumer reads a legacy flat token shape while `design-tokens.json` is DTCG nested. Build a DTCG → linter-canonical token adapter so the compliant banner demo audits clean and the broken demo remains distinguishable.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/FIXTURE.1.1-contract.md` | Contract artifact |
| `.flint-context/contracts/FIXTURE.1.1.contract.ts` | Executable contract |

### Coordination notes
- Pure append to MithrilLinter token resolution path — no overlap with RUNTIME.1 (runtime-dom), FIGMA-LINT.1 (Universal AST), or existing FIXTURE.1 surface filter.
- Invariant to hit: `banner-compliant.tsx` MITHRIL-TYP-002 + MITHRIL-SPC-001 count === 0 with DTCG tokens loaded.

---

## Swarm: FIXTURE.1 — Audit Context System (Beta Gate 1 items #3-#4)

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-19)
**Scope:** New per-directory `.flint-fixture.json` declaration system + rule applicability metadata. Solves the demo-audit "tokens loaded: 0" + page-landmark-rules-on-component-fixtures problem at the architectural level. Closes Beta Gate 1 items #3 (zero false-positive regressions on demos) AND #4 (audit→fix→re-audit clean run on demos).

**Beta-load-bearing:** This is also the clean replication run for the Review Ceremony Cheaper-Pilot (with the agent Write-tool fixes from PR #10).

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/FIXTURE.1-contract.md` | Contract artifact |
| `.flint-context/contracts/FIXTURE.1.contract.ts` | Executable contract |

### Coordination notes
- Touches every Mithril and Warden rule (must add `appliesTo` field). Coordinate with RUNTIME.1 (which adds `runtime-dom` source authority to A11yLinter) and FIGMA-LINT.1 (which uses Universal AST adapter). All three are append-only changes to A11yLinter; sequence to avoid simultaneous restructuring.
- Demo subdirectories under `demos/**` get per-fixture JSON files — no overlap with other swarms.
- New `shared/fixture-schema.ts` (or similar) — net-new file, no conflicts.

---

## Swarm: RUNTIME.1 — axe-core Runtime Adapter

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-18)
**Scope:** Runtime adapter that boots LivePreview (or separate sandboxed BrowserWindow), runs axe-core, pipes findings into Warden SARIF with a new `runtime-dom` source authority. Closes competitive gap #3 — DOM-layer verification that static AST analysis cannot provide.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/RUNTIME.1-contract.md` | Contract artifact |
| `.flint-context/contracts/RUNTIME.1.contract.ts` | Executable contract |

### Files to MODIFY (Phase 2 — after contract approval)
| File | What changes |
|------|--------------|
| `electron/main.ts` | IPC handler `runtime:run-axe` (APPEND ONLY) |
| `electron/preload.ts` | Expose `window.flintAPI.runtime.runAxe` |
| `server/index.ts` | Web-parity mirror |
| `shared/ipc-validators.ts` | Zod schema for runtime IPC |
| `flint-mcp/src/core/A11yLinter.ts` | Accept `runtime-dom` sourceAuthority (APPEND ONLY) |
| `src/components/editor/StatusBar.tsx` | Runtime-mode toggle pill |
| `src/components/ui/GovernanceDashboard.tsx` | Merge AST-time + runtime findings |

**Coordination note:** Phase 2 implementation collides with Phase 0 on `A11yLinter.ts` and `StatusBar.tsx`. Coordinate before implementation — both are append-only changes, should compose cleanly but must be sequenced.

---

## Swarm: FIGMA-LINT.1 — Figma-side Mithril/Warden Lint

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-18)
**Scope:** New MCP tool `flint_audit_figma_frame` using Universal AST (V.3) to run Mithril/Warden against Figma node trees pre-code. Closes competitive gap #2 — pre-code drift detection that Stark and FigmaLint currently own.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/FIGMA-LINT.1-contract.md` | Contract artifact |
| `.flint-context/contracts/FIGMA-LINT.1.contract.ts` | Executable contract |

### Files to CREATE (Phase 2)
| File | Purpose |
|------|---------|
| `flint-mcp/src/core/universal-ast/FigmaNodeAdapter.ts` | Figma node tree → FlintNode adapter |
| `flint-mcp/src/tools/audit-figma-frame.ts` | New MCP tool handler |
| `flint-mcp/src/core/figmaFrameCache.ts` | Node-tree cache with TTL |
| `flint-mcp/src/**/__tests__/*` | Adapter + tool tests |

### Files to MODIFY (Phase 2)
| File | What changes |
|------|--------------|
| `flint-mcp/src/server.ts` | Register new tool (APPEND ONLY) |

**Coordination note:** No overlap with MINT.5 or Phase 0. Universal AST engines (MithrilLinter, A11yLinter) must NOT be modified — adapter-only pattern preserves the engine-agnostic contract.

---

## Swarm: COUNSEL.1 — Unify the Health Score (Sprint 1)

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-19)
**Scope:** Beta-blocker fix. Three divergent health-score code paths funnel into one canonical `shared/healthScore.ts`. `flint-mcp/src/core/dashboard/debtReportService.ts:135` (fork-copy formula), `flint-mcp/src/core/dbom/generator.ts:469` (drops advisory bucket), and `flint-mcp/src/core/governance/dbomService.ts:341` (inline per-component arithmetic) all replaced by delegating calls. Hooks audited; deprecation shim on the legacy `computeHealthScore` positional signature.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/COUNSEL.1-contract.md` | Contract artifact |
| `.flint-context/contracts/COUNSEL.1.contract.ts` | Executable contract |

### Files to MODIFY (Phase 2 — after contract approval)
| File | What changes |
|------|--------------|
| `flint-mcp/src/core/dashboard/debtReportService.ts` | Replace inline `computeHealthScore` with delegating wrapper that imports `shared/healthScore.ts`; keep positional signature as deprecation shim |
| `flint-mcp/src/core/dbom/generator.ts` | Pass advisory bucket to `computeHealthScore`; switch import to `shared/healthScore.ts` |
| `flint-mcp/src/core/governance/dbomService.ts` | Replace inline per-component arithmetic with `computeHealthScore` from canonical module |
| `flint-mcp/src/core/dashboard/types.ts` | JSDoc correction — current comment claims `mithrilCount × 5 - a11yCount × 10` formula which is wrong |
| `src/hooks/useGovernanceHealth.ts` | Keep delegating wrapper; add `@deprecated` JSDoc on positional `computeCanonicalHealthScore` shim |
| `src/hooks/useTokenHealth.ts` | No change to math (already delegates); add cross-package parity test reference |
| `shared/__tests__/healthScore.parity.test.ts` (NEW) | Cross-surface parity test: same inputs → identical score in every consumer |

**Coordination note:** No file overlap with MINT.5.3, RUNTIME.1, FIGMA-LINT.1, POS.1. flint-mcp dashboard files are otherwise quiet. Safe to run in parallel.

---

## Swarm: FORGE.1 Phase 2 Consolidated Fix-Forward (flint-coder)

**Status:** IN PROGRESS (2026-04-19)
**Scope:** Address SEC-HIGH-1/2, SEC-MED-1/3/4/5, CODE-BLK-1, CONS-1/2, UX-B3/W3/W4/W5, CODE-WARN-3, CODE-SUG-1/2 from FORGE.1 Phase 2 reviews.

### Files to MODIFY
- `electron/main.ts` (slug sanitization, symlink-off, timeout, env, path normalization, smart-open + auto-configure overrides)
- `server/index.ts` (web parity for above + SSRF check)
- `electron/GitManager.ts` (clone hardening, remove stale console.log)
- `shared/ipc-validators.ts` (input length + control-char rejection, scratchpad schema, auto-configure overrides)
- `electron/preload.ts` (createScratchpad payload, auto-configure overrides payload)
- `src/types/flint-api.d.ts` (signatures for above)
- `src/adapters/web-api.ts` (web adapter parity)
- `src/components/ui/LaunchScreen.tsx` (CONS-1 wiring, CONS-2 wiring, UX-W4 figma URL prompt)
- `src/components/ui/DetectionPreview.tsx` (UX-B3 plain labels, UX-W3 reframe, UX-W5 override hint, CODE-SUG-2 constants)
- `electron/__tests__/projectSmartOpen.test.ts` (fill 28 it.todo + new SEC-HIGH probe tests)
- `.flint-context/contracts/FORGE.1-contract.md`, `.contract.ts` (CODE-SUG-1 + auto-configure overrides shape)
- `HANDOFF.md`

## Swarm: FORGE.1 Phase 2 Group A — IPC Layer (flint-electron-ipc)

**Status:** SUPERSEDED BY FIX-FORWARD (2026-04-19)
**Scope:** `project:smart-open` IPC channel + preload exposure + type declaration + web adapter + test scaffold. Validator backfill for 4 existing FORGE.2 channels (already landed in shared/ipc-validators.ts at Phase 1.5 — confirming preload wiring).

### Files to MODIFY
| File | What changes |
|------|--------------|
| `electron/GitManager.ts` | Append `clone(url, destDir)` method (Commandment 14 — no raw exec) |
| `electron/main.ts` | Append `project:smart-open` IPC handler (heuristic git URL vs folder routing) |
| `server/index.ts` | Web parity: `project:smart-open` handler |
| `electron/preload.ts` | Append `smartOpen` to `window.flintAPI.project.*` |
| `src/types/flint-api.d.ts` | `smartOpen` declaration on `ProjectAPI` interface |
| `src/adapters/web-api.ts` | `smartOpen` in web adapter project block |
| `HANDOFF.md` | Session entry |

### Files to CREATE
| File | Purpose |
|------|---------|
| `electron/__tests__/projectSmartOpen.test.ts` | `it.todo` scaffold from all contract testBoundaries scoped to project:smart-open |

### DO NOT TOUCH (Group B owns)
- `src/components/ui/LaunchScreen.tsx`
- `src/components/ui/DetectionPreview.tsx`
- `src/components/ui/__tests__/LaunchScreen.test.tsx`
- `src/components/ui/__tests__/DetectionPreview.test.tsx`

---

## Swarm: FORGE.1 — Channel Consolidation + Smart Detection (Beta Gate 2)

**Status:** CONTRACT APPROVED (architect spawned 2026-04-19)
**Scope:** Beta-blocker fix. Collapse LaunchScreen from 8 entry channels to 3 (Start from idea / Start from Figma / Start from existing code) with smart-detection surfacing for the existing-code channel before commit. Net-new "Start from idea" channel (D2C scratchpad, MUI default, no folder picker before first render). Add Zod validators for the 4 already-shipped FORGE.2 IPC handlers (`project:detect-environment`, `project:auto-configure`, `project:run-baseline`, `project:get-health-grade`) — currently missing. Audit and remove orphaned `FigmaSetupWizard` references (plugin deprecated 2026-04-15). Sprint 2-4 work (visual polish, copy refinement, animation) explicitly deferred.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/FORGE.1-contract.md` | Contract artifact |
| `.flint-context/contracts/FORGE.1.contract.ts` | Executable contract |

### Files to MODIFY (Phase 2 — after contract approval)
| File | What changes |
|------|--------------|
| `src/components/ui/LaunchScreen.tsx` | Reduce 4-tile array to 3-channel array; new "Start from idea" channel routes to `project:create-scratchpad`; "Start from existing code" channel auto-routes folder OR git URL; remove orphan `setFigmaSetupOpen` reference at line 228 |
| `src/components/ui/DetectionPreview.tsx` (NEW) | Renders `ProjectEnvironment` summary with override controls before commit |
| `src/components/ui/__tests__/LaunchScreen.test.tsx` | Updated for 3-channel set |
| `shared/ipc-validators.ts` | Add Zod schemas for `project:detect-environment` (no payload), `project:auto-configure` (no payload), `project:run-baseline` (no payload), `project:get-health-grade` (string payload), and new `project:smart-open` (string payload — folder or git URL) |
| `electron/main.ts` | New `project:smart-open` IPC handler that routes folder vs git URL via heuristic, then calls existing detect-environment + auto-configure pipeline |
| `server/index.ts` | Web parity mirror of `project:smart-open` |
| `electron/preload.ts` | Expose `window.flintAPI.project.smartOpen` |
| `src/types/flint-api.d.ts` | Type for `smartOpen` |

### Coordination notes
- No overlap with COUNSEL.1 (health score), RUNTIME.1 (axe runtime), FIGMA-LINT.1 (Figma adapter), MINT.5 (sync), POS.1 (content), FIXTURE.1 (audit context).
- Touches `electron/main.ts`, `server/index.ts`, `shared/ipc-validators.ts`, `electron/preload.ts` — all append-only additions for the new `project:smart-open` channel; no restructuring of existing handlers.
- LaunchScreen.tsx is otherwise quiet across active swarms — safe.

---

## Swarm: POS.1 — Positioning Content

**Status:** RESEARCH IN PROGRESS (researcher spawned 2026-04-18)
**Scope:** Angle A positioning content ("The governance layer for AI-generated UI") — landing page copy, Mason generator-positioning doc, investor brief refresh. Closes competitive gap #1 via message positioning, not engineering.

### Files to CREATE
| File | Purpose |
|------|---------|
| `docs/strategy/MASON-POSITIONING.md` | Mason generator positioning ("generate against your design system") |
| `docs/strategy/INVESTOR-BRIEF-2026-Q2.md` | Investor brief refreshed with 2026-04-18 competitive findings |
| `docs/strategy/LANDING-PAGE-COPY.md` | Public-facing landing page copy draft |

### Files to MODIFY (low-priority, Justin approves)
| File | What changes |
|------|--------------|
| `README.md` | Angle A messaging in intro |

**Coordination note:** No code territory claimed. Pure content. Safe to run in parallel with all other swarms.


<!-- FORGE.1 Phase 2 fix-forward — COMPLETE 2026-04-19 (territory cleared) -->

