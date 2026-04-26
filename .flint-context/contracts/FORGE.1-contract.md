# FORGE.1 — Channel Consolidation + Smart Detection (Sprint 1 of 4)

**Phase:** FORGE.1
**Status:** APPROVED (Phase 1.5 lint findings addressed 2026-04-19)
**Audience:** designer (Glass front door)
**Owner:** flint-architect
**Date:** 2026-04-19
**Beta gate:** Beta-blocker #2 (BETA-READINESS-CHECKLIST.md Gate 2)

---

## meta.background — Verified Current State

The "8 channels" estimate was correct. `src/components/ui/LaunchScreen.tsx` currently surfaces:

1. **Primary "New Project" CTA** — calls `onNewProject()` → `project:create-scratchpad`. Empty scratchpad, no detection, no first-render moment.
2. **Tile: "From Figma"** (`prototype` JTBD path) — folder-picker-first, then expects user to paste Figma URL in chat.
3. **Tile: "Connect codebase"** (`connect`) — folder picker + framework scan.
4. **Tile: "Audit a folder"** (`audit`) — folder picker + one-shot governance audit.
5. **Tile: "Governance dashboard"** (`dashboard`) — folder picker, surfaces MCP-connected project.
6. **DemoScenarioPicker** — 4 bundled demo scenarios.
7. **Recent projects list** — re-open existing.
8. **Footer "Open any folder…"** + **"Connect to IDE"** + **"Paste code to audit"** (FORGE.4a).

The deprecated Figma plugin (`FigmaSetupWizard`) was removed 2026-04-15, but `LaunchScreen.tsx:228` still references the dead setter `setFigmaSetupOpen(false)`. This is an orphan compile risk (only avoided because the function is dead-coded by the surrounding switch).

**FORGE.2 detection infrastructure ALREADY SHIPPED:**

- `shared/projectDetector.ts` — full `ProjectEnvironment` detector (framework + version, CSS framework, component library, design tokens, component count, TS, monorepo). Pure-function, framework-agnostic, importable from both Electron and Express.
- `electron/main.ts:2138` — `project:detect-environment` handler.
- `electron/main.ts:2231` — `project:auto-configure` handler.
- `electron/main.ts:2292` — `project:run-baseline` handler with `project:baseline-progress` event.
- `electron/main.ts:2398` — `project:get-health-grade` handler.
- `server/index.ts:1400-1521` — full web parity for the four handlers.
- `electron/preload.ts:529-558` — exposed in `window.flintAPI.project`.

**Gap:** none of the 4 FORGE.2 IPC handlers have Zod validators in `shared/ipc-validators.ts`. Per Contract-First v2.1 every renderer→main channel must declare a validator. Sprint 1 must close this. Three of the four take no payload, but the schema-registration pattern still applies (use `z.void()`).

**Channels with meaningful usage vs dead code:**

- **Live:** Demo Auto-Load (Channel 2 in strategy doc), Open Codebase, Recent Projects, Paste-Audit. These have telemetry / first-launch defaults.
- **Dead/low-traffic:** Blank "New Project" scratchpad (creates empty canvas with nothing to observe — strategy doc Section 1 calls this "the most prominent CTA delivers the least value"), Governance Dashboard tile (redundant with MCP banner), From Figma tile (folder-picker-first inverts the emotional arc).

**Web/Electron parity:** Both surfaces render the same `LaunchScreen.tsx` and consume the same IPC handlers via the `web-api.ts` adapter. Sprint 1 changes must be parity-clean: any new IPC channel must land in both `electron/main.ts` and `server/index.ts` in the same commit.

---

## Sprint Scope

### What Sprint 1 ships

1. **3 channels only** in LaunchScreen, replacing the 4 tiles:
   - **Start from idea** — D2C scratchpad. MUI default. Calls `project:create-scratchpad` with `{ libraryDefault: 'mui' }`. Lands the user on the canvas with a starter component visible (LivePreview rendered) BEFORE asking for a folder. Folder choice deferred to first save.
   - **Start from Figma** — paste a Figma URL → Figma MCP `get_design_context` → Mason transform. Existing flow; just promoted from tile to top-level channel.
   - **Start from existing code** — single channel that accepts either a folder path OR a git URL. New `project:smart-open` IPC handler heuristic-routes (URL pattern → git clone, otherwise → folder open), then runs the existing detect→auto-configure→baseline pipeline. Detection results surfaced via new `DetectionPreview` component before commit; user can override framework/library/CSS/token-source.
2. **Library default = MUI** when detection finds no library AND for "Start from idea" channel.
3. **Removal of orphaned plugin references** — delete `setFigmaSetupOpen(false)` at LaunchScreen.tsx:228; remove `figmaSetupOpen` from any state declarations; remove the deprecated comment hint.
4. **Validator backfill** — register Zod schemas for the 4 already-shipped FORGE.2 IPC handlers PLUS the new `project:smart-open` channel.

### What Sprint 1 does NOT ship (`nonGoals`)

- Visual redesign of LaunchScreen beyond what 3-channel consolidation requires (Sprints 2-4).
- Animation/transition polish (Sprints 2-4).
- Copy refinement beyond the 3 channel labels themselves (Sprints 2-4).
- New AI orchestrator capabilities (Mason/Sage already exist).
- Token sync changes (no Envoy/Scout work).
- Mithril/Warden rule changes.
- Library-pack support beyond MUI default (other adapters already shipped via LIB.1; not adding new ones here).
- Removal of DemoScenarioPicker, Recent Projects, or Paste-Audit (these are NOT counted in the "3 channels" set — they are persistent surfaces; the 3-channel rule applies to the primary "start a new project" decision).
- Removal of footer "Connect to IDE" and "Open any folder…" (footer escape hatches; not entry channels).
- VS Code extension or CI surface changes.
- New MCP tools.
- New stores. Sprint 1 uses existing `canvasStore` and component-local state only.

---

## Impact Map

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/LaunchScreen.tsx` | MODIFY | flint-design-engineer | Replace `TILES` 4-tile array with 3-channel array; new "Start from idea" handler; merge "open folder" + "open git URL" into single "Start from existing code" channel calling `project:smart-open`; delete orphaned `setFigmaSetupOpen` reference at line 228. |
| `src/components/ui/DetectionPreview.tsx` | CREATE | flint-design-engineer | Renders `ProjectEnvironment` summary with override controls; calls `project:auto-configure` on confirm. Used by "Start from existing code" channel. |
| `src/components/ui/__tests__/LaunchScreen.test.tsx` | MODIFY | flint-test-writer | Update existing tests to new 3-channel set; add tests for orphan-reference removal. |
| `src/components/ui/__tests__/DetectionPreview.test.tsx` | CREATE | flint-test-writer | Render + interaction + override tests for the new component. |
| `electron/main.ts` | MODIFY | flint-electron-ipc | Append-only: register `project:smart-open` IPC handler. Heuristic: input matches `/^(https?:|git@|ssh:)/` → git clone path; else folder path. Returns `{ projectPath, environment }` for downstream preview. |
| `server/index.ts` | MODIFY | flint-electron-ipc | Web parity mirror of `project:smart-open`. |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Append-only: expose `window.flintAPI.project.smartOpen(input: string)`. |
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | Type declaration for `smartOpen`. |
| `shared/ipc-validators.ts` | MODIFY | flint-electron-ipc | Append 5 Zod exports: `projectDetectEnvironmentSchema` (z.void), `projectAutoConfigureSchema` (z.void), `projectRunBaselineSchema` (z.void), `projectGetHealthGradeSchema` (z.string), `projectSmartOpenSchema` (z.object with `input: z.string().min(1)`). |
| `electron/__tests__/projectSmartOpen.test.ts` | CREATE | flint-test-writer | Heuristic routing tests (URL vs path); error propagation; validator integration. |

---

## Type Contracts

See `.flint-context/contracts/FORGE.1.contract.ts` for the executable form. Key cross-boundary types:

```ts
// IPC payload — single string accepted by Start from existing code channel
export interface SmartOpenPayload {
  /** Either an absolute folder path or a git URL (https://, git@, ssh://). */
  input: string;
}

// IPC return — caller renders DetectionPreview from this
export interface SmartOpenResult {
  projectPath: string;
  environment: ProjectEnvironment; // imported from shared/projectDetector
  source: 'folder' | 'git-clone';
}

// DetectionPreview props
export interface DetectionPreviewProps {
  environment: ProjectEnvironment;
  projectPath: string;
  onConfirm: (overrides?: Partial<ProjectEnvironment>) => void;
  onCancel: () => void;
}

// New 3-channel discriminator (replaces JTBDPath in LaunchScreen.tsx)
export type ForgeChannel = 'from-idea' | 'from-figma' | 'from-existing-code';
```

---

## IPC Channel Contracts

| Channel | Direction | Payload | Return | Handler | Validator (shared/ipc-validators.ts) |
|---------|-----------|---------|--------|---------|--------------------------------------|
| `project:smart-open` | renderer→main | `SmartOpenPayload` | `SmartOpenResult` | `electron/main.ts` + `server/index.ts` | `projectSmartOpenSchema` |
| `project:detect-environment` | renderer→main | `void` | `ProjectEnvironment \| null` | already in `electron/main.ts:2143` | `projectDetectEnvironmentSchema` (NEW — backfill) |
| `project:auto-configure` | renderer→main | `void` | `{ configured: boolean; library: string \| null; reindexed: boolean }` | already in `electron/main.ts:2235` | `projectAutoConfigureSchema` (NEW — backfill) |
| `project:run-baseline` | renderer→main | `void` | `{ violations: number; grade: string; score: number; filesAudited: number } \| null` | already in `electron/main.ts:2297` | `projectRunBaselineSchema` (NEW — backfill) |
| `project:get-health-grade` | renderer→main | `string` (project path) | `{ grade: string; score: number; updatedAt: string } \| null` | already in `electron/main.ts:2401` | `projectGetHealthGradeSchema` (NEW — backfill) |

---

## Store Contracts

**No new stores.** Sprint 1 uses existing `canvasStore` for the post-channel-selection workspace state. Channel selection is component-local in LaunchScreen. Detection-preview confirmation is component-local in DetectionPreview.

This is intentional — adding a `forgeStore` slice would create cross-store contamination risk (LaunchScreen is a transient screen) and is out of scope per Sprint 1 minimalism.

---

## Component Contracts

| Component | File | Props | Stores read | IPC called |
|-----------|------|-------|-------------|-----------|
| `LaunchScreen` (modified) | `src/components/ui/LaunchScreen.tsx` | `LaunchScreenProps` (existing) | none new | `project:smart-open` (new), `project:create-scratchpad` (existing), existing demo + recent calls |
| `DetectionPreview` (new) | `src/components/ui/DetectionPreview.tsx` | `DetectionPreviewProps` | none | `project:auto-configure` |

---

## Commandment Checklist

| # | Commandment | Applies? | How Sprint 1 satisfies |
|---|-------------|----------|------------------------|
| 2 | No Hallucinated Styling | YES | Detection is deterministic — `shared/projectDetector.ts` reads `package.json` + config files only, no AI. MUI default is a pre-known mapping, not generated. |
| 4 | Local-First Only | YES | Git clone path uses local `git` binary via `GitManager`; no external preview URLs. "Start from idea" scratchpad uses local template. |
| 8 | Audit-First Execution | YES | Detection fires `project:detect-environment` BEFORE the Sage/Mason orchestrator is engaged. Complexity routing already in place. |
| 12 | Atomic Queuing | YES | `project:smart-open` returns the detected environment; the user-confirmed `auto-configure` step queues a single transactional write through existing `FileTransactionManager` paths. |
| 13 | Deterministic Surgery | YES | All detection is AST/JSON parsing of `package.json`, `tailwind.config.*`, etc. No regex on source code. |
| 14 | Bypass Prohibition | YES | `project:smart-open` git-clone path MUST route through `electron/GitManager.ts` (existing). No `child_process.exec('git clone …')` in the handler. |

Commandments 1, 3, 5, 6, 7, 9, 10, 11, 15, 16 are not directly engaged by Sprint 1 (no AST mutations, no AI tool emission, no recovery, no color logic).

---

## Implementation Order

**Group A — Plumbing (parallel-safe):**

- `flint-electron-ipc` — `shared/ipc-validators.ts` (5 new validators — already landed alongside this contract on 2026-04-19), `electron/main.ts` (`project:smart-open` handler), `server/index.ts` (web parity), `electron/preload.ts` (surface), `src/types/flint-api.d.ts` (type).
- `flint-test-writer` — Group A scaffold pass: `electron/__tests__/projectSmartOpen.test.ts` as `it.todo(...)` cases derived directly from `testBoundaries`. No real assertions yet — Group B fills them once components and IPC are real.

**Group B — UI (depends on Group A IPC types):**

- `flint-design-engineer` — `LaunchScreen.tsx` 3-channel refactor + orphan removal; `DetectionPreview.tsx` new component.
- `flint-test-writer` — Group B fill pass: convert `it.todo` → real assertions in `projectSmartOpen.test.ts`; create `LaunchScreen.test.tsx` updates and `DetectionPreview.test.tsx`. Group A scaffolds MUST land first so Group B has typed targets.

**Coordinating note for `flint-test-writer`:** the agent runs in BOTH groups but does different work in each. Group A = scaffolds only (`it.todo`). Group B = real assertions. Do not write real assertions in Group A — the IPC types and components don't exist yet.

Phase 2.5 (`/review` via `flint-code-reviewer`) and Phase 3 (`flint-integration-validator`) are run by the workflow itself after Group B completes — they are not implementer agents and are intentionally omitted from `parallelismGroups`.

---

## Risks

| # | Risk | Severity | Commandment | Mitigation |
|---|------|----------|-------------|------------|
| 1 | Smart-open heuristic misclassifies a folder path that looks like a URL (e.g. on Windows `\\server\share`) or a git URL with no scheme prefix. | medium | — | Heuristic uses anchored regex `/^(https?:\/\/|git@|ssh:\/\/)/`. Anything else treated as a folder path. UNC paths fail loudly with a typed error rather than silently cloning. |
| 2 | Library detection returns null for a project that uses MUI but never imports it (uncommon edge). User overrides via DetectionPreview. | low | — | DetectionPreview always renders even when fields are null; user can manually select MUI as override. Default-MUI policy applies only to "Start from idea" channel and to `null` detection result. |
| 3 | Removal of `setFigmaSetupOpen(false)` orphan could mask an undocumented re-mount path. | low | — | Grep audit during Phase 2 confirms no other call site. Pre-commit gate runs full test suite. |
| 4 | Adding 5 Zod validators retroactively could expose pre-existing payload shape mismatches in production callers. | medium | — | Phase 2 implementer must run `electron/__tests__/preload.mcp-validation.test.ts`-style integration check to confirm every existing `window.flintAPI.project.*` call passes the new validator. |
| 5 | "Start from idea" channel skipping folder picker conflicts with web-mode (no `localStorage` for pending scratchpad state). | medium | C4 | Reuse existing `project:create-scratchpad` which already has web-parity at `server/index.ts`. Web mode lands on canvas with starter file in-memory until first save triggers path prompt. |

---

## Invariants (falsifiable, measurable)

| Name | Measurable | Threshold | Verified by |
|------|------------|-----------|-------------|
| `entry-channel-count` | Number of primary "start" channels rendered by LaunchScreen | `=== 3` | `LaunchScreen.test.tsx` — `expect(channelButtons).toHaveLength(3)` |
| `from-idea-folder-deferral` | Whether the "Start from idea" channel calls any folder-picker IPC before first render | `=== false` (zero calls) | `LaunchScreen.test.tsx` — spy on `dialog:openFolder`, assert `0 calls` after channel click |
| `smart-open-routing-precision` | For a 20-fixture mix of folder paths and git URLs, the heuristic classifies each correctly | `>= 0.95` (≥ 19/20) | `electron/__tests__/projectSmartOpen.test.ts` fixture suite |
| `validator-coverage` | Number of `project:*` renderer→main channels in preload.ts that lack a Zod validator export in shared/ipc-validators.ts | `=== 0` | Phase 1.5 lint + `electron/__tests__/preload.mcp-validation.test.ts` |
| `from-idea-ipc-roundtrip` | The from-idea channel's `project:create-scratchpad` IPC call resolves on the same async flush as the channel-click handler — no folder-picker await, no second render-blocking round-trip before the canvas mount kicks off | "same async flush" (one Promise tick to hand off to `onNewProject`, no intermediate dialogs) | `LaunchScreen.test.tsx` — assert `dialog:openFolder` is never called and `createScratchpad` is awaited inline within the click handler |

> **Phase 2 fix-forward (CODE-SUG-1, 2026-04-19):** the original threshold was `< 100ms` mock timing, which conflated "no extra IPC round-trips" with "fast wall-clock." The implementation never adds an intermediate dialog or extra IPC round-trip — it `await`s `project:create-scratchpad` directly inside the click handler and immediately calls `onNewProject`. The "same async flush" framing makes that property the falsifiable invariant; wall-clock timing was an unstable proxy for it.
| `detection-coverage-existing-code` | Fraction of in-repo fixtures (`electron/templates/*` + `demos/0*`) where `ProjectEnvironment.framework` is non-null | `>= 0.10` (Sprint 1 floor — only `base-vite-tailwind` has a real `package.json` today; raising to 0.85 is Sprint 2 fixture-backfill work tracked in HANDOFF) | `electron/__tests__/projectSmartOpen.test.ts` fixture suite |

---

## Phase 2 Implementation Brief

Phase 2 implementers will: (a) add 5 Zod validators in `shared/ipc-validators.ts`, (b) build the `project:smart-open` IPC handler in both Electron and Express that heuristic-routes folder vs git URL and runs the existing detect→preview→commit pipeline, (c) collapse `LaunchScreen.tsx` from 4 JTBD tiles to 3 channels (Start from idea / Start from Figma / Start from existing code) with the new "Start from idea" channel rendering canvas + LivePreview before any folder picker, (d) build the `DetectionPreview` component that surfaces `ProjectEnvironment` with override controls before commit, and (e) remove the orphan `setFigmaSetupOpen` reference at LaunchScreen.tsx:228. No new stores, no new MCP tools, no AI orchestrator changes, no Mithril/Warden touches.
