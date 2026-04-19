# FORGE.1 — Code Review

**Phase:** FORGE.1 (Channel Consolidation + Smart Detection — Sprint 1)
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-19
**Round:** 1
**Verdict:** REVISE — 1 BLOCKER, 3 WARNINGS, 2 NITS

---

## Summary

The Group A IPC plumbing (`project:smart-open` in both Electron and the Express web server, the 5 new Zod validators, the preload bridge, and the type declarations) is implementation-clean. Both handlers route git clones through array-arg `execFile` (no shell interpolation), the heuristic regex is correctly anchored, the path is validated as absolute and inside the home directory, and the validator is parsed twice (preload + handler) — defence in depth.

Group B's UI work landed the 3-channel refactor, the orphan `setFigmaSetupOpen` reference is gone, `DetectionPreview` defaults to MUI when detection returns `null` (both visually via the amber notice and behaviourally via the `handleConfirm` override builder), and the `LaunchScreen` and `DetectionPreview` test files together hold 70 real (non-todo) cases that the team reports as passing.

The blocker: per the contract the Group A scaffold file (`electron/__tests__/projectSmartOpen.test.ts`) was meant to be converted from `it.todo` to real assertions by Group B in the fill pass — all 28 cases remain `it.todo`. Three contract invariants depend on assertions in that file (`smart-open-routing-precision`, `validator-coverage-project-channels`, `detection-coverage-existing-code`) and are therefore unverified in CI.

The most architecturally interesting deviation is in `LaunchScreen.handleFromIdea` — it calls `createScratchpad()` with no argument, but the contract testBoundary "Start from idea defaults to MUI library" requires `project:create-scratchpad` to receive `{ libraryDefault: "mui" }`. The handler signature in `electron/main.ts:1902` is `async (): Promise<FileTreeNode>` — i.e. the IPC channel was never extended to accept a payload. The contract's MUI-default policy is satisfied downstream by `DetectionPreview` (which defaults to MUI on null), but the specific assertion in the contract's testBoundaries is not satisfiable as wired.

---

## BLOCKER 1 — Group B did not convert `projectSmartOpen.test.ts` from `it.todo` to real assertions

**File:** `electron/__tests__/projectSmartOpen.test.ts:1-241`
**Severity:** blocker

**Observed:** All 28 cases in the file are `it.todo(...)` placeholders. `grep -c "it.todo"` returns 28; `grep -c "it("` returns 0.

**Rationale:** The contract (`.flint-context/contracts/FORGE.1-contract.md` lines 178-180) says: *"flint-test-writer — Group B fill pass: convert `it.todo` → real assertions in `projectSmartOpen.test.ts`"*. Three of the contract's six invariants are verified by this file (`smart-open-routing-precision >= 0.95`, `validator-coverage-project-channels === 0`, `detection-coverage-existing-code >= 0.10`). With every case as `it.todo`, none of those invariants are actually measured — the contract's falsifiability claim is broken.

**Fix:** Convert at minimum the 5 cases backing the three invariants to real assertions:
1. The 20-fixture heuristic matrix (`describe('heuristic fixture matrix')`).
2. All 5 validator-coverage cases (`describe('validator-coverage-project-channels invariant')`).
3. The `base-vite-tailwind` detection case.

The git-URL routing tests can stay as `it.todo` for Sprint 2 if the team accepts the carve-out — but the invariant-bearing tests must be live before merge.

---

## WARNING 1 — `handleFromIdea` does not pass `libraryDefault: 'mui'` to `createScratchpad`

**File:** `src/components/ui/LaunchScreen.tsx:266`
**Severity:** warning

**Observed:**
```ts
await window.flintAPI.project.createScratchpad()
```
The IPC handler at `electron/main.ts:1902` is `ipcMain.handle('project:create-scratchpad', async (): Promise<FileTreeNode> => { ... })` — accepts no payload. The preload signature at `electron/preload.ts:508` is `createScratchpad: (): Promise<...>`. There is no `libraryDefault` plumbing anywhere.

**Rationale:** The contract's testBoundary at `FORGE.1.contract.ts:298-306` (and the markdown at line 53) explicitly states *"Calls `project:create-scratchpad` with `{ libraryDefault: 'mui' }`"*. The implementation skips this. The MUI-default behaviour is preserved by `DetectionPreview.handleConfirm` (line 109-112: `overrides.componentLibrary = { name: 'mui', version: 'latest' }` when `!detectedLibrary`), but `DetectionPreview` is only shown for the `from-existing-code` channel — `from-idea` never sees it. So the from-idea scratchpad currently inherits whatever the `base-vite-tailwind` template specifies, with no Sprint-1 MUI guarantee.

**Fix (one of two):**
- Extend the IPC channel: add an optional `{ libraryDefault?: string }` payload, a Zod validator, plumb through `initializeProject(targetPath, 'base-vite-tailwind', { libraryDefault })`, and wire it from `handleFromIdea`.
- Or amend the contract to record this as a Sprint-2 carve-out (the architect's `<100ms` note is a precedent for documented deviations) and tag the testBoundary as `pending`.

---

## WARNING 2 — Stale console.log left in `findFlintIdOffsets`

**File:** `electron/GitManager.ts:51`
**Severity:** warning

**Observed:**
```ts
console.log('found data-flint-id attr:', attr.value)
```
Inside the AST walker — fires on every JSXAttribute named `data-flint-id` regardless of match. This was not part of the FORGE.1 diff per the file list, but the file was touched (the new `clone()` method was added) and the line is in a hot path that runs on every `getGitNode` recovery call.

**Rationale:** Unintentional log noise in a hot recovery path; floods the main-process console during Rewind. Likely pre-existing debug code.

**Fix:** Delete line 51 or guard with a `DEBUG` env flag. Out of scope strictly speaking, but trivial and the file was modified in this phase.

---

## WARNING 3 — `LaunchScreen.handleDetectionConfirm` discards the user's overrides

**File:** `src/components/ui/LaunchScreen.tsx:340-354`
**Severity:** warning

**Observed:**
```ts
const handleDetectionConfirm = async (overrides?: Partial<ProjectEnvironment>) => {
    ...
    if (window.flintAPI.project.autoConfigureProject) {
        await window.flintAPI.project.autoConfigureProject()
    }
    await onOpenRecent(detectedProjectPath!)
}
// Suppress unused-variable lint for overrides param (passed to parent)
void overrides
```
The `overrides` parameter is consumed by `void overrides` — explicitly thrown away. `autoConfigureProject()` takes no args; the channel has no payload (validated as `z.undefined()` in `projectAutoConfigureSchema`).

**Rationale:** `DetectionPreview.handleConfirm` builds and passes a merged `Partial<ProjectEnvironment>` (lines 96-129 in DetectionPreview.tsx). The contract testBoundary "DetectionPreview — confirm calls auto-configure with overrides" (FORGE.1.contract.ts:278-286) requires `project:auto-configure` to be invoked with the merged environment — but the renderer drops it on the floor. The user's manual library/framework/CSS choice is silently discarded; auto-configure runs against whatever was originally detected.

**Fix:** Either (a) extend `project:auto-configure` to accept an optional override payload and update the validator from `z.undefined()` to a partial-environment schema, then thread the overrides through; or (b) document that overrides are advisory-only for Sprint 1 and amend the testBoundary.

---

## NIT 1 — Architect's `<100ms` substitution is acceptable but should be re-recorded

**File:** `.flint-context/contracts/FORGE.1.contract.ts:335-339`
**Severity:** info

**Observed:** The invariant text reads *"Vitest mock timing on the project:create-scratchpad IPC handler invoked from the from-idea channel"* with threshold `< 100ms`. The deviation note in the user's review request says the architect rewrote this from the original `< 100ms` budget to "handler fires in same async flush". The committed contract still reads `< 100ms`.

**Rationale:** Either the deviation note in the review prompt is stale or the contract was not updated to reflect the rewrite. Re-recording the invariant as a synchronous-flush assertion is genuinely a stronger contract (deterministic, no flake risk from CI machine load) than a millisecond budget — but the file should record the intended threshold. Right now there is a documentation/code skew.

**Fix:** Update the invariant string in `FORGE.1.contract.ts:335-339` to match the actually-implemented assertion and add a one-line `evolution:` note.

---

## NIT 2 — `DetectionPreview` `LIBRARY_OPTIONS` array uses string literals instead of a const

**File:** `src/components/ui/DetectionPreview.tsx:35-43`
**Severity:** info

**Observed:** Library labels (`'MUI (Material UI)'`, etc.) are duplicated between the option array and the override-builder fallback (lines 105-111). If the label changes, two sites must be edited in sync.

**Rationale:** Low-risk drift surface. Not a Commandment violation.

**Fix:** Hoist labels to a `const LIBRARY_LABELS: Record<string, string>` and reuse.

---

## Commandment + Mithril Compliance

| # | Commandment | Status | Notes |
|---|-------------|--------|-------|
| 2 | No Hallucinated Styling | PASS | DetectionPreview uses Tailwind tokens only — `bg-zinc-900/60`, `border-indigo-500/40`, `text-amber-400`. No hex literals. |
| 4 | Local-First Only | PASS | Git clone uses local binary; no external preview URL. |
| 8 | Audit-First Execution | PASS | Detection fires before AI orchestrator; complexity routing untouched. |
| 12 | Atomic Queuing | PARTIAL | Electron handler writes `detected-environment.json` via raw `writeFile`, not `fileTransactionManager`. Server handler uses `safeAtomicWrite`. The Electron side should mirror — see WARNING fold-in below. |
| 13 | Deterministic Surgery | PASS | No regex source modification. Smart-open uses anchored regex on the *URL string*, not on source code. |
| 14 | Bypass Prohibition | PASS | Electron path goes through `gitManager.clone(url, projectPath)`. Server path uses `execFileAsync('git', ['clone', '--', input, projectPath])` with array args; the `--` argument terminator prevents URL-as-flag injection. |

**Mithril:** No arbitrary `bg-[#…]` or `p-[Npx]` introduced. Spacing uses scale (`p-4`, `py-2.5`, `gap-2`).

**Process Boundary:** No Node module imports in `src/`. New `flintAPI.project.smartOpen` is typed in `src/types/flint-api.d.ts:619`. CSP unchanged.

**Heuristic regex anchoring (review prompt question):** The regex `/^(https?:\/\/|git@|ssh:\/\/)/` IS anchored at start. A folder name like `https://my-folder` cannot exist as a real folder path because `:` and `/` are not directory components in absolute paths under the home dir — and even if it were crafted, the `path.isAbsolute(projectPath)` and `startsWith(home + path.sep)` gates would reject it before any git command runs. A malicious folder name cannot spoof URL routing because the regex is checked *before* the folder gates, so a folder literally named `https://...` would be misrouted to `git clone` — but `git clone https://name-not-a-url` fails fast against the network and never touches the filesystem outside `~/Flint Projects`. Safe.

**Web parity (review prompt question):** `server/index.ts:1690` uses `execFileAsync('git', ['clone', '--', input, projectPath])`. Array args, no shell. Identical safety profile to Electron's `gitManager.clone`. The doc comment at `server/index.ts:1656-1659` correctly explains why GitManager isn't reused (no singleton in the web build) and that the safety guarantee is preserved.

**Orphan reference (review prompt question):** `grep "setFigmaSetupOpen\|figmaSetupOpen\|FigmaSetupWizard" src/components/ui/LaunchScreen.tsx` returns 0 hits. Confirmed removed.

**DetectionPreview MUI default (review prompt question):** Yes — `DetectionPreview.tsx:86` `effectiveLibrary = libraryOverride ?? detectedLibrary ?? 'mui'`, and `handleConfirm` lines 108-112 emit `{ name: 'mui', version: 'latest' }` when both detected and override are null. Visible amber notice at line 180-183 ("Defaulting to MUI"). Behaviour is real, not cosmetic.

---

## Test/TSC Status (reported by team)

```
MCP:   5550/5550
Core:  2579/2579
Glass: 3179/3181 (2 unrelated StatusBar pre-existing)
TSC:   0 errors
```

I did not re-run locally — accepting the reported state. The 2 pre-existing failures are out of FORGE.1 scope.

---

## What to do next

1. **Fix the BLOCKER:** Land real assertions in `projectSmartOpen.test.ts` for the 3 invariant-bearing describes (heuristic matrix, validator coverage, detection coverage). Other cases may stay `it.todo` if explicitly carved out.
2. **Decide on WARNING 1 (libraryDefault):** Either plumb the payload through or amend the contract.
3. **Decide on WARNING 3 (overrides discarded):** Either plumb overrides through `auto-configure` or amend the testBoundary to "advisory-only".
4. **Trivial cleanup:** Delete the stray `console.log` at `GitManager.ts:51`.
5. **Doc sync:** Update the `from-idea-ipc-roundtrip` invariant text in the contract to match what was actually shipped.
