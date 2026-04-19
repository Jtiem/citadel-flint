# Integration Report: FORGE.1 — Channel Consolidation + Smart Detection

**Reviewer:** flint-integration-validator
**Date:** 2026-04-19
**Phase:** FORGE.1 (Phase 3)
**Verdict:** SHIP

## Check Summary

| Check | Result | Details |
|-------|--------|---------|
| Type Check | PASS | `npx tsc --noEmit` → 0 errors |
| IPC Symmetry | PASS | All 3 new channels (`project:smart-open`, `project:create-scratchpad` w/ libraryDefault, `project:auto-configure` w/ overrides) wired Glass → preload → main + server with matching Zod payload validators (`projectSmartOpenSchema`, `projectCreateScratchpadSchema`, `projectAutoConfigureSchema`) |
| Web Parity | PASS | `server/index.ts:1699-1846` mirrors `electron/main.ts:2491-2592` — same anchored regex, same slug hardening (UUID fallback for `.`/`..`/separators), same destination prefix assertion, same realpath-aware home prefix check, same askpass scrub, same 120s timeout, `core.symlinks=false`. Web build adds the SEC-MED-2 SSRF DNS guard (RFC1918/loopback/link-local rejection) — accepted carve-out per round 2 review. Electron path delegates to `GitManager.clone()` (Commandment 14), web path uses `execFileAsync` with array args (no shell interp). |
| Store Isolation | PASS | Zero matches for `smartOpen`/`smart-open`/`libraryDefault`/`FORGE.1`/`DetectionPreview` in `src/store/**`. No new store contamination. |
| Contract Fidelity | PASS | All 5 IPC channels in contract have validator exports in `shared/ipc-validators.ts:449-503`. Cross-boundary types `SmartOpenPayload`/`SmartOpenResult`/`DetectionPreviewProps`/`ForgeChannel` consumed in implementation. `projectAutoConfigureSchema` widened in fix-forward to `z.union([z.undefined(), {overrides…}])`; `projectCreateScratchpadSchema` added — both documented inline, both matching live handler shapes. Invariant `from-idea-ipc-roundtrip` reframed away from wall-clock timing — change documented in both `.contract.ts:336-343` and `-contract.md:208-210`. |
| Commandment Compliance | PASS | C2 (deterministic detection — `projectDetector` reads JSON, MUI default is static map, DetectionPreview uses Tailwind tokens only). C4 (git clone is local binary, scratchpad is local template). C8 (detection runs before orchestrator engagement). C12 (web path uses `safeAtomicWrite`; Electron path writes non-source metadata `.flint/detected-environment.json` via `fs/promises.writeFile` — consistent with existing `project:auto-configure` / `project:detect-environment` patterns). C13 (regex only on URL/path classification, not source code). C14 (Electron routes through `GitManager.clone`, web uses `execFile` array-args; no `exec` with concatenated strings, no `fs.writeFile` for source code). |
| Test Coverage | PASS | 1,318 lines of test code across 3 files; 153 `expect(` assertions; **0** `it.todo`/`it.skip` remaining. All 10 `testBoundaries` from the contract have at least one corresponding assertion. |
| Process Boundary | PASS | `LaunchScreen.tsx` and `DetectionPreview.tsx` import only React + lucide + types — no `fs`/`path`/`electron`/`child_process`. All Node access flows through `window.flintAPI`. |
| Import Hygiene | PASS | No new `// @ts-ignore`/`// @ts-expect-error` in the FORGE.1 surface. No circular imports. Orphan `setFigmaSetupOpen` reference confirmed removed (grep returns 0 hits). |

## Issues Found

1. **[SUG]** (out of scope, already accepted) — Round 2 SUG: `DetectionPreview` Figma URL is stashed on `window.__FLINT_PENDING_FIGMA_URL` (LaunchScreen.tsx:284) — noted as Sprint 2 cleanup, not blocking.
2. **[INFO]** — `SmartOpenResult.environment` is typed as `unknown` at the preload bridge surface (preload.ts:594, web-api.ts:425) but as `ProjectEnvironment` at the handler return and the renderer's call-site cast. Intentional layering (preload doesn't import `src/types/`). DetectionPreview gets the typed value via call-site narrowing (LaunchScreen.tsx:318-322). No action required; flagged for Sprint 2 if a dedicated `SmartOpenResult` type export is desired in `flint-api.d.ts`.

No BLOCKING findings.

## Verdict: SHIP

**Beta-blocker #2 is closed.** A Beta invitee opening LaunchScreen will see exactly 3 primary channels (Start from idea / Start from Figma / Start from existing code), can hit "Start from idea" to land directly on the canvas with MUI pre-selected and zero `dialog:openFolder` calls in the click flow, can paste a folder path or git URL into one channel, and will see DetectionPreview with plain-language labels (Built with / Component kit / Styling), the confident MUI default badge when detection returns null, and a successful end-to-end clone into `~/Flint Projects/<slug>` for a public git URL — sandboxed by slug-traversal hardening, destination prefix assertion, symlink-disabled clone, askpass scrub, and a 120s timeout. Web parity is intact with an additional SSRF gate for the public-facing build. The pre-existing StatusBar Figma test failures (2) are unrelated — `src/components/editor/StatusBar.tsx` was last touched by Phase 0 and Fixture.1, not by FORGE.1.

## Files In Scope

- `.flint-context/contracts/FORGE.1.contract.ts`
- `.flint-context/contracts/FORGE.1-contract.md`
- `electron/main.ts` (handlers at 1918, 2286, 2491)
- `server/index.ts` (handlers at 1199, 1537, 1699)
- `electron/preload.ts:508-599`
- `electron/GitManager.ts:255-296`
- `shared/ipc-validators.ts:427-505`
- `src/adapters/web-api.ts:414-425`
- `src/components/ui/LaunchScreen.tsx`
- `src/components/ui/DetectionPreview.tsx`
- `electron/__tests__/projectSmartOpen.test.ts`
- `src/components/ui/__tests__/LaunchScreen.test.tsx`
- `src/components/ui/__tests__/DetectionPreview.test.tsx`
