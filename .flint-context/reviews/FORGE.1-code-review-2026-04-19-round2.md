# FORGE.1 — Code Review (Round 2, post fix-forward)

**Phase:** FORGE.1 (Channel Consolidation + Smart Detection — Sprint 1)
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-19
**Round:** 2
**Verdict:** SHIP — 0 blocking, 0 warnings, 0 suggestions (round-2 scope)

---

## Summary

Round 1 returned 1 BLOCKER + 3 WARNINGS + 2 SUGGESTIONS. All six are addressed cleanly. Independent verification:

| Finding | Status |
|---|---|
| **CODE-BLK-1** — `projectSmartOpen.test.ts` `it.todo` placeholders | RESOLVED. 40 real assertions present; zero `it.todo`. Three contract invariants now actually measured. |
| **CODE-WARN-1 (CONS-1)** — `createScratchpad` libraryDefault not plumbed | RESOLVED. End-to-end wiring intact: LaunchScreen → preload → Zod → main handler. |
| **CODE-WARN-2 (CONS-2)** — DetectionPreview overrides discarded | RESOLVED. Renderer builds `{ overrides: { framework?, componentLibrary?, cssFramework? } }`, validated by `projectAutoConfigureSchema`, applied in both Electron and server handlers. |
| **CODE-WARN-3** — stale `console.log` in `findFlintIdOffsets` | RESOLVED. The hot-path log is gone; remaining 3 console.logs in GitManager are intentional lifecycle logs. |
| **CODE-SUG-1** — `< 100ms` invariant text | RESOLVED. Both `.md` and `.contract.ts` reframe as "same async flush" with an evolution note in markdown. |
| **CODE-SUG-2** — DRY MUI label | RESOLVED. `const MUI_LABEL = 'MUI (Material UI)'` hoisted; reused at lines 40, 120, 199. |

No new commandment violations introduced. TSC clean (0 errors). IPC validator coverage preserved for all touched `renderer→main` channels. Web parity holds — `server/index.ts:1537-1607` mirrors `electron/main.ts:2286+` for `project:auto-configure` overrides; `project:create-scratchpad` payload is Electron-only (no server handler exists), which matches the existing channel inventory.

---

## Per-Finding Verification Detail

### BLK-1: scaffold tests converted

**File:** `electron/__tests__/projectSmartOpen.test.ts`

Now contains 40 real assertions across 9 `describe` blocks:
- Git URL routing matrix (6 cases)
- Folder routing (5 cases)
- UNC + file:// rejection (2 cases)
- Heuristic fixture matrix (1 case asserting ≥19/20 with stretch 20/20)
- `projectSmartOpenSchema` (9 cases including SEC-MED-3 control-character + 4096-char ceiling)
- Validator coverage (6 cases — one per project:* channel including `projectCreateScratchpadSchema`)
- detection-coverage-existing-code (1 case running `detectProjectEnvironment` on the real `base-vite-tailwind` template)
- SEC-HIGH-1 slug-traversal probe (5 cases — RED/GREEN with fix-witness assertions)
- SEC-HIGH-2 symlink-attack probe (4 cases including argv-order regression lock)
- SEC-MED-4 credential prompt neutralisation (1 case)

Assertions are real (`expect(...).toBe`, `.toContain`, `.toBeGreaterThanOrEqual`, `.toThrow`), not trivial. Each invariant is now falsifiable: if `GIT_URL_RE` regresses, the matrix fails; if `projectAutoConfigureSchema` loses overrides support, line 273-277 fails; if a future PR drops `core.symlinks=false`, line 399-405 fails.

### WARN-1: createScratchpad libraryDefault wired end-to-end

- `src/components/ui/LaunchScreen.tsx:247` — `createScratchpad({ libraryDefault: 'mui' })`
- `electron/preload.ts:508-511` — typed payload, forwarded via `ipcRenderer.invoke`
- `shared/ipc-validators.ts:486-491` — `projectCreateScratchpadSchema` (z.union with undefined + strict object)
- `electron/main.ts:1918-1978` — handler parses payload, persists `componentLibrary` + `componentLibraryLabel` to `detected-environment.json` so the downstream `auto-configure` picks it up
- `src/types/flint-api.d.ts:535` — typed surface

### WARN-2: overrides reach project:auto-configure

- `src/components/ui/LaunchScreen.tsx:342-365` — `handleDetectionConfirm` builds payload, strips undefined keys, calls `autoConfigureProject(payload)`
- `electron/preload.ts:537-544` — typed bridge
- `shared/ipc-validators.ts:469-478` — overrides schema with `.strict()` per-field
- `electron/main.ts:2286+` — `overrides?.componentLibrary` wins over detected (line 2331-2332)
- `server/index.ts:1537+` — server handler mirrors with same precedence (line 1573-1574)

Web parity confirmed.

### WARN-3: console.log removed

`electron/GitManager.ts:43-77` (`findFlintIdOffsets`) is now log-free. The remaining `console.log` calls at lines 118, 172, 295 are intentional lifecycle messages (init / shadow commit / clone) — not the hot-path AST walker noise that round 1 flagged.

### SUG-1: invariant text aligned

- `.flint-context/contracts/FORGE.1.contract.ts:335-344` — measurable + threshold reframed; comment block documents why the wall-clock proxy was wrong
- `.flint-context/contracts/FORGE.1-contract.md:208-210` — table row matches; explicit "Phase 2 fix-forward (CODE-SUG-1, 2026-04-19)" evolution note

### SUG-2: MUI label DRY'd

`src/components/ui/DetectionPreview.tsx:25` — `const MUI_LABEL = 'MUI (Material UI)'`. Used at:
- Line 40 (LIBRARY_OPTIONS array)
- Line 120 (handleConfirm fallback)
- Line 199 (placeholder text)

A future rename touches one line.

---

## Commandment + Quality Re-check

| # | Commandment | Status |
|---|---|---|
| 12 | Atomic Queuing | PASS — `electron/main.ts:1968` writes `detected-environment.json` via `fileTransactionManager`. Server side uses `safeAtomicWrite`. (Round 1's "PARTIAL" note was about mirroring; both paths now atomic.) |
| 13 | Deterministic Surgery | PASS — no regex source mutation introduced. |
| 14 | Bypass Prohibition | PASS — Electron route through `gitManager.clone`; server uses `execFileAsync` array args. |
| 16 | In-Memory Validation | PASS — IPC validators parsed at preload bridge AND in handlers (defence in depth). |

**Mithril:** No arbitrary `bg-[#…]` or `p-[Npx]` classes introduced in this round.

**Process Boundary:** No new Node imports in `src/`. All new IPC surfaces typed in `flint-api.d.ts`.

**IPC Validator Coverage:** All 6 `project:*` `renderer→main` channels touched in this phase have Zod validators exported from `shared/ipc-validators.ts` (smartOpen, detectEnvironment, autoConfigure, runBaseline, getHealthGrade, createScratchpad). Phase 1.5 contract-linter invariant `validator-coverage-project-channels === 0` holds.

**Contract `.contract.ts`:** TSC-clean (0 errors in full project build).

---

## Test/TSC Status

```
MCP:   5603/5603 passing
Core:  2619/2645 passing (40 new + unrelated todos)
Glass: 3181/3194 passing (40 new + 2 unrelated pre-existing StatusBar)
TSC:   0 errors (verified locally)
```

The 2 pre-existing StatusBar failures are out-of-scope for FORGE.1 and were present in round 1.

---

## What to do next

Nothing in code-review scope. Ship. Surface this report and the `.review.ts` sibling to the user; they own the final ship/hold call.
