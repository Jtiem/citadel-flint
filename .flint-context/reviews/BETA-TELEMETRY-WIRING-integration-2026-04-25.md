# Integration Report: BETA-TELEMETRY-WIRING

**Date:** 2026-04-25
**Validator:** flint-integration-validator (regression canary, post-domain-split)
**Phase:** Phase 3 (Cheaper-Pilot canary after UX/Code/Security scoped reviewers)

## Status: FIX

| Check | Result | Details |
|-------|--------|---------|
| Type Check (`tsc --noEmit`) | PASS | 0 errors |
| IPC Symmetry | PASS | `telemetry:get-consent` + `telemetry:set-consent` exist in preload, electron main, and server/index — wire is intact end-to-end |
| Store Isolation | PASS | No telemetry Zustand slice introduced; renderer reads consent imperatively from `App.tsx` (matches contract §4) |
| Contract Fidelity | FAIL | 2 deviations — see findings 1 + 2 |
| Commandment Compliance | FAIL | C2 (Hallucinated Styling) — see finding 2 |
| Test Coverage | PARTIAL | All 12 `testBoundaries` covered, but 11 `it.todo` remain in scaffold files (contract Phase 3 Check 6 item 4 forbids this) |
| Process Boundary | PASS | No `fs`/`electron` imports in `src/`; renderer reaches main only via `window.flintAPI.telemetry.*` |
| Import Hygiene | PASS | No new `@ts-ignore` / circular imports introduced |

### Test Suite Counts (full runs)

```
Glass (npm run test:react):  3537/3537 passing (18 todo total project-wide;  7 added by this feature)
Core  (npm test):            2776/2814 passing — 38 failures, 30 todo (4 added by this feature)
                             ALL 38 FAILURES ARE PRE-EXISTING — better-sqlite3 NODE_MODULE_VERSION
                             mismatch in server/__tests__/governanceApproval.chron1.test.ts +
                             server/services/__tests__/ragStore.test.ts; last touched in commit
                             7511d75, before BETA.TEL began. Not a regression.
TSC:                         0 errors
Telemetry-specific:          electron/betaTelemetry.test.ts          39/39 passing (0 todo)
                             electron/__tests__/telemetryIpc.test.ts 31/35 passing (4 todo)
                             src/components/ui/__tests__/TelemetryConsentDialog.test.tsx
                                                                    12/19 passing (7 todo)
```

## Issues Found

### 1. **[BLOCKING — contract violation]** Initial focus is on Decline, contract specifies Accept

`src/components/ui/TelemetryConsentDialog.tsx:38` keeps a ref on the Decline button and passes it to `<FocusTrap initialFocusRef={declineRef} ...>`. The contract is explicit at two places:

* Section 5 (Component Contracts): "Initial focus on Accept button"
* `testBoundaries[6]` ("TelemetryConsentDialog a11y focus trap") `given:` "the dialog is mounted and **Accept has initial focus**"

The implementer self-justifies the deviation in a code comment ("most defensive first"), but a Phase 2 agent does not have authority to override the architect — that is a Phase 1 redesign decision. Either the contract is wrong (return to architect) or the implementation is wrong. **This was missed by all 3 scoped reviewers** — UX would be the natural owner. *Fix path:* swap the ref onto the Accept button and update the test fixture; or re-open the contract if Justin prefers Decline-first as a privacy default.

### 2. **[WARNING — Commandment 2]** Dialog uses raw color literals, not token-backed Tailwind classes

`TelemetryConsentDialog.tsx` lines 68, 81–139 use `bg-zinc-900`, `border-zinc-800`, `text-zinc-100/400`, `text-indigo-400`, `bg-indigo-600`, `bg-amber-900/20`, `text-amber-400`. The contract Section 6 (Commandment Checklist row 2) states: *"TelemetryConsentDialog uses token-backed Tailwind classes only (e.g. `bg-surface`, `text-primary`); no hex literals or arbitrary values."*

`zinc`/`indigo`/`amber` are Tailwind palette literals, not project semantic tokens. Mithril treats palette references the same as hex. The other modals in the codebase (e.g., ExportModal) follow the same anti-pattern, so this isn't worse than the surrounding code — but the contract called it out and the implementation didn't comply. **This was missed by the UX reviewer** (it's a styling/Mithril concern that would normally land in their lane). *Fix path:* either map to `bg-surface`/`text-primary` semantic tokens if they exist in the project's Tailwind config, or relax the contract on a follow-up note acknowledging palette-class precedent across Glass.

### 3. **[WARNING — test hygiene]** 11 `it.todo` markers remain in scaffolded test files

* `electron/__tests__/telemetryIpc.test.ts:375–399` — 4 todos asserting `telemetryGetConsentResponseSchema` / `telemetrySetConsentPayloadSchema` are exported and registered in `ipcSchemas`. Group A landed; the assertions can now be filled (or deleted as redundant since TSC already proves the exports exist).
* `src/components/ui/__tests__/TelemetryConsentDialog.test.tsx:133, 141, 177, 182, 197, 236, 417` — 7 todos for "does not render when accepted/declined" (caller logic, arguably out of dialog's scope), double-click guard, IPC rejection, and no-focusable-children edge case. Several of these correspond to `testBoundaries.edgeCases` listed in the contract (TCDLG-09 maps to `'double-click → only one IPC call'`; TCDLG-10 maps to `'IPC rejection → dialog stays open with retry copy'`; TCDLG-18b maps to `'dialog mounts with no focusable children'`).

Phase 3 Check 6 item 4: *"No `it.todo()` or `it.skip()` markers remain from the test scaffold phase."* This was missed by the code reviewer. *Fix path:* fill the 3 contract-mapped todos (TCDLG-09, TCDLG-10, TCDLG-18b) and delete the rest as redundant scaffolding noise.

### 4. **[WARNING — web parity drift, contract §1 + §3]** server/index.ts mirrors the IPC channels but not the emit sites

`server/index.ts:3409–3425` exposes both `telemetry:get-consent` and `telemetry:set-consent` — channel mirror is complete. But the contract's impact map for `server/index.ts` is: *"Mirror telemetry:get-consent and telemetry:set-consent over WS; **call startTelemetry() at server boot; same emit sites as electron/main.ts.**"* The emit sites are not present in the web build:

* No `emit('mcp.tool_called', ...)` in the web's MCP dispatch path
* No `emit('audit.completed', ...)` in the web's audit completion path
* No `emit('session.ended', ...)` on server shutdown

The implementer noted (line 3381) *"betaTelemetry.ts imports `electron` so it cannot be imported here"* — a real architectural constraint, but the contract still requires parity. The web build's `startTelemetry()` is an explicit no-op stub. The `web-parity` invariant in the contract is narrowly defined as "channel count parity" (= 0 missing mirrors) so the invariant technically passes, but the spirit of the invariant ("same emit sites") is violated. Per `feedback_web_parity_drift.md`, this drift is exactly the failure mode the rule exists to prevent.

**This was missed by all 3 scoped reviewers** because it requires comparing two files the security and code reviewers each read in isolation. The canary caught it.

*Fix path:* either (a) extract the emit() function into a shared module that doesn't import `electron`, or (b) explicitly amend the contract to scope web-parity to channels only and document the shutdown-hook constraint as a known gap.

## What the scoped reviewers missed (log for cheaper-pilot protocol)

Per the cheaper-pilot rule: when the canary surfaces findings the scoped reviewers missed, widen scope for the next phase and log the miss in HANDOFF.md.

| # | Finding | Domain owner | Why missed |
|---|---------|--------------|-----------|
| 1 | Initial focus on wrong button | UX | Reviewer focused on a11y mechanics (focus trap exists, ARIA correct) and didn't cross-check against the contract's `given:` clauses |
| 2 | Palette classes vs semantic tokens | UX | Reviewer didn't run a Commandment-2 grep against the new file |
| 3 | 11 leftover `it.todo` markers | Code | Reviewer didn't re-read Phase 3 Check 6 item 4; treated todos as pre-existing scaffolds rather than new ones |
| 4 | Web-build emit sites missing | Security or Code | Both reviewers had `server/index.ts` in scope individually but neither cross-compared `electron/main.ts` emit sites against `server/index.ts` |

**Recommended scope widening for next phase:**
- UX reviewer: add explicit step "for every `testBoundary` whose `given:` mentions UI state, assert the implementation matches that exact state."
- Code reviewer: add explicit step "grep `it.todo|it.skip` in every test file modified by this phase and report counts."
- Security or Code: add explicit step "for any `electron/main.ts` change touching telemetry/observability, diff against `server/index.ts` for parity per `feedback_web_parity_drift.md`."

## Verdict: FIX

| Issue # | Assigned Agent | Fix Description |
|---------|---------------|----------------|
| 1 | flint-design-engineer | Move `initialFocusRef` from `declineRef` to a new `acceptRef`; update TCDLG-18 test fixture; OR escalate to flint-architect if Decline-first is the actual intended behavior |
| 2 | flint-design-engineer | Map `bg-zinc-900` → `bg-surface`, `text-zinc-100` → `text-primary`, etc., to project semantic tokens; OR amend contract with palette-precedent waiver |
| 3 | flint-test-writer | Fill TCDLG-09 (double-click guard), TCDLG-10 (IPC rejection), TCDLG-18b (no-focusable-children); delete the 4 ipc.test todos and the 4 dialog rendering todos as redundant scaffolds |
| 4 | flint-electron-ipc | Either extract a shared emit module, or amend `web-parity` invariant to scope to channels-only with documented shutdown gap |

None of these are SHIP-blocking for a closed beta with ~10 users — but they are all contract deviations. Recommend Justin make the call on issues 1 and 2 (UX/policy decisions); 3 and 4 are mechanical cleanups.
