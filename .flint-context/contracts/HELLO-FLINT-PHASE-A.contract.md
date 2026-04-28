# Contract Artifact — HELLO-FLINT-PHASE-A: Welcome Screen + Smart IDE Auto-Connect

**Phase:** HELLO-FLINT-A
**Status:** APPROVED
**Date:** 2026-04-26
**Owner:** flint-architect
**Audience:** designer (Glass first-launch surface)
**Source spec:** `docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md`
**Replaces:** `src/components/ui/BetaWelcome.tsx` (and the `SetupWizard`-style multi-step flow as the user-facing welcome surface)

---

## 0. Executive Summary

Phase A of "Hello, Flint" replaces the existing `BetaWelcome.tsx` screen with a single primary-path welcome surface, and folds the prior multi-step `SetupWizard` IDE setup into a **silent auto-connect** that runs on a single click. The user sees one button (`Let's go →`), then a single confirmation panel that lists what was detected, asks which IDE to connect, writes the MCP config atomically while preserving every other entry, and lands on a "I see the green dot ✓ / Help" verification panel. There is no multi-step wizard surface anymore — Phase A is one screen with two states (welcome / connect-confirmation) plus an inline manual-fallback path.

Phase A is web-transport-first: every new IPC channel is added to `server/index.ts` and `src/adapters/web-api.ts`. The Electron preload path (`electron/main.ts` / `electron/preload.ts`) keeps its existing `setup:*` channels but is NOT extended for these new ones — the closed beta is the web build.

Phase A does NOT include the guided walkthrough (Phase B), drift detection (Phase B), token-promotion UI (Phase B), or progress save/resume (Phase C).

---

## 1. Impact Map

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/HelloFlintWelcome.tsx` | CREATE | flint-design-engineer | New single-path welcome component (replaces BetaWelcome surface) — welcome state, connect-confirmation state, help panel, manual-snippet fallback |
| `src/components/ui/__tests__/HelloFlintWelcome.test.tsx` | CREATE | flint-test-writer | Component tests scaffolded from `testBoundaries` |
| `src/App.tsx` | MODIFY | flint-design-engineer | Replace `<BetaWelcome>` render gate with `<HelloFlintWelcome>`; add already-connected detection branch that skips the screen entirely |
| `src/components/ui/BetaWelcome.tsx` | DELETE | flint-design-engineer | Remove old welcome surface (one consumer in `App.tsx`) |
| `src/components/ui/__tests__/BetaWelcome.test.tsx` | DELETE | flint-test-writer | Remove old tests |
| `server/services/ideDetection.ts` | CREATE | flint-electron-ipc | IDE detection service (existence checks for Claude Code, Cursor, VS Code on macOS; platform stubs return `present: false`) |
| `server/services/mcpConfigWriter.ts` | CREATE | flint-electron-ipc | Adapter-per-IDE config readers + atomic mergers; routes every disk write through `FileTransactionManager` (Commandment 14) |
| `server/services/__tests__/ideDetection.test.ts` | CREATE | flint-test-writer | Detection unit tests (present, absent, alternate path, non-macOS stub) |
| `server/services/__tests__/mcpConfigWriter.test.ts` | CREATE | flint-test-writer | Merge fixtures: empty file, file with multiple existing MCP entries, file that does not exist yet, JSONC comment preservation |
| `server/index.ts` | MODIFY | flint-electron-ipc | Add 3 new handlers: `hello:detect-editors`, `hello:write-mcp-config-bulk`, `hello:already-connected`. Refactor existing `setup:detect-ides` and `setup:write-mcp-config` handlers to delegate to the new services so we don't fork logic |
| `src/adapters/web-api.ts` | MODIFY | flint-electron-ipc | Add `hello` namespace on `window.flintAPI` (`detectEditors`, `writeMcpConfigBulk`, `alreadyConnected`) routed through `validateIPC` |
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | Declare the new `hello` namespace on `FlintAPI` |
| `shared/ipc-validators.ts` | MODIFY | flint-electron-ipc | Add Zod schemas: `hello:detect-editors` (no payload, response shape), `hello:write-mcp-config-bulk` (payload + response), `hello:already-connected` (no payload, response shape) |

**Reference (no change in Phase A):** `electron/preload.ts` is intentionally untouched. Closed beta runs on the web build; the Electron preload retains its existing `setup:*` channels solely for the legacy reset-state menu path. Phase A's three new IPC channels live exclusively on the web transport.

Note: the existing `SetupWizard.tsx` is not deleted in this phase. It remains addressable via the menu "Reset State → reopen wizard" path used by power users. Phase A makes `HelloFlintWelcome` the default first-launch surface; the legacy wizard becomes a manual override discoverable only through the OS menu. Phase C may consolidate further.

---

## 2. Type Contracts

All types defined in `HELLO-FLINT-PHASE-A.contract.ts` — Phase 2 agents import from there.

```typescript
type EditorName = 'claude-code' | 'cursor' | 'vscode'

interface DetectedEditor {
  editor: EditorName
  present: boolean
  configPath: string | null  // null if platform not supported or file resolution failed
}

interface DetectEditorsResponse {
  editors: DetectedEditor[]   // exactly 3 entries, order: claude-code, cursor, vscode
  mcpServerPath: string       // resolved path to flint-mcp/dist/server.js
  platform: 'darwin' | 'linux' | 'win32'
}

interface WriteMcpConfigBulkPayload {
  editors: EditorName[]       // 1..3 entries; deduped by handler
  mcpServerPath: string       // must match the value returned by hello:detect-editors
}

interface WriteMcpConfigBulkResponse {
  written: Array<{
    editor: EditorName
    configPath: string
    preservedEntries: number  // count of MCP entries preserved (excluding flint)
  }>
  failed: Array<{
    editor: EditorName
    reason: string            // human-readable, never includes raw fs error stack
  }>
}

interface AlreadyConnectedResponse {
  connected: boolean          // true if ANY editor already has a 'flint' MCP entry
  editors: EditorName[]       // editors where flint was found
}

// Component-local prop type
interface HelloFlintWelcomeProps {
  onComplete: () => void      // called when user dismisses the screen (any path)
  buildId?: string
  daysRemaining?: number | null
}
```

---

## 3. IPC Channels

All web-transport-first. Validators live in `shared/ipc-validators.ts`.

| Channel | Direction | Payload | Return | Handler | Validator |
|---------|-----------|---------|--------|---------|-----------|
| `hello:detect-editors` | renderer→main | `undefined` | `DetectEditorsResponse` | `server/index.ts` | `helloDetectEditorsSchema` |
| `hello:write-mcp-config-bulk` | renderer→main | `WriteMcpConfigBulkPayload` | `WriteMcpConfigBulkResponse` | `server/index.ts` | `helloWriteMcpConfigBulkSchema` |
| `hello:already-connected` | renderer→main | `undefined` | `AlreadyConnectedResponse` | `server/index.ts` | `helloAlreadyConnectedSchema` |

Note: `hello:write-mcp-config-bulk` is the only channel that mutates disk. It MUST route every write through `fileTransactionManager.writeBatch()` per Commandment 14. Direct `writeFileSync` is forbidden in the new code path even though the legacy `setup:write-mcp-config` handler still uses it.

---

## 4. Store Contracts

No new Zustand stores. `HelloFlintWelcome` uses local `useState` for screen state, mirroring the pattern in `SetupWizard.tsx`.

---

## 5. Component Contracts

| Component | File | Props | Stores | IPC |
|-----------|------|-------|--------|-----|
| `HelloFlintWelcome` | `src/components/ui/HelloFlintWelcome.tsx` | `HelloFlintWelcomeProps` | none | `hello.detectEditors`, `hello.writeMcpConfigBulk`, `hello.alreadyConnected` |

### Render states (local state machine)

1. `welcome` — initial. Shows the spec's welcome copy + `[ Let's go → ]` + `Skip` text link. On mount, fires `alreadyConnected()` in parallel; if it resolves `connected: true` BEFORE the user clicks anything, immediately calls `onComplete()` and the screen is never seen.
2. `detecting` — after user clicks "Let's go". Shows a brief spinner while `detectEditors()` resolves.
3. `connect-confirm` — shows the detection list (`◦ Found Claude Code ✓ / ◦ Found Cursor ✓ / ◦ Looking for VS Code… not found`) plus four buttons (`Cursor`, `Claude Code`, `Both`, `I'll do this manually`). Only present editors are clickable.
4. `writing` — after user picks one or more editors. Shows the same panel with a spinner on the chosen button and an aria-live status. Escape key blocked during this state.
5. `verify` — after `writeMcpConfigBulk()` resolves with at least one success. Shows "Done. I added Flint to your Cursor settings — your other MCP servers are untouched." plus `[ I see the green dot ✓ ]` and `[ Help — I don't see it ]`. Clicking the green-dot button calls `onComplete()`.
6. `help` — if user clicks "Help — I don't see it". Three concrete fix instructions inline (full restart, check MCP menu, re-run connection). Includes a "Back to verify" button.
7. `manual` — if user clicks "I'll do this manually" from connect-confirm. Shows the JSON snippet inline (the same format the writer produces) plus the resolved `mcpServerPath`. A `[ Done ]` button calls `onComplete()`.
8. `error` — if `writeMcpConfigBulk()` returns all failures. Shows the per-editor `reason` strings + a `[ Try manual instead ]` button that transitions to `manual`.

### Visible copy

Welcome state copy uses the exact text from the spec under "Welcome screen" — including build info footer when `buildId` is set. The component does NOT introduce any new product terminology beyond what the spec already defines.

### Skip behaviour

The "Skip — I'll find my way around" text link sets the `flint-hello-welcome-seen` localStorage flag and calls `onComplete()`. No IPC writes occur.

---

## 6. Commandment Checklist

| # | Commandment | Applies | How Phase A satisfies it |
|---|------------|---------|--------------------------|
| 1 | Code is Truth | NO | No AST mutations in this phase |
| 2 | No Hallucinated Styling | YES | `HelloFlintWelcome.tsx` MUST use only design-token-mapped Tailwind utilities (zinc/indigo/emerald/red ladder + standard spacing/typography scale). No raw hex literals, no off-ladder utility values. Enforced by `audit_ui_component` in CI and by the `HelloFlintWelcome:token-only styling` testBoundary |
| 4 | Local-First Only | YES | All detection is local `existsSync`. No network calls. The verification step is user-confirmed; no remote handshake |
| 5 | Accessibility is a Compiler Error | YES | `aria-live="polite"` on the writing/verify panels; focus management on state transitions; keyboard escape (except during write) |
| 12 | Atomic Queuing | YES | Every config write goes through `fileTransactionManager.write()` / `writeBatch()` — no direct `writeFileSync` in the new code path |
| 13 | Deterministic Surgery | NO | No source-code modification; merging JSON via `JSON.parse` + structured rebuild, not regex |
| 14 | Bypass Prohibition | YES | New `mcpConfigWriter` service uses ONLY `fileTransactionManager`. The old `setup:write-mcp-config` handler keeps its `writeFileSync` path for legacy callers but is NOT used by the new flow |
| 16 | In-Memory TSC Validation | NO | No AI-generated code in this phase |

**Note on process boundary:** "Process Boundary Law" (Critical AI Directive #9) governs this phase — the renderer never touches `fs`, all disk I/O lives in `server/services/*`, and the renderer reaches the main process only through `window.flintAPI.hello.*`. This is a Critical AI Directive, NOT a numbered Commandment. Commandment 9 is "CIEDE2000 ΔE Logic" and does not apply to Phase A.

Commandments 3, 6, 7, 8, 9, 10, 11, 15 do not apply.

---

## 7. Implementation Order

### Group A1 — UI (parallel to A2)
- **flint-design-engineer**: build `HelloFlintWelcome.tsx` against the typed mocks of `window.flintAPI.hello.*` from the contract. State machine + copy + a11y.
- **flint-electron-ipc**: extend `src/adapters/web-api.ts` with the `hello` namespace (renderer side only — handler stubs throw). Extend `src/types/flint-api.d.ts`.
- **flint-test-writer**: scaffold `HelloFlintWelcome.test.tsx` from `testBoundaries` (it.todo → real assertions when component is ready).

### Group A2 — Server (parallel to A1)
- **flint-electron-ipc**: build `server/services/ideDetection.ts`, `server/services/mcpConfigWriter.ts`, and the 3 new handlers in `server/index.ts`. Refactor existing `setup:detect-ides` to delegate to `ideDetection.ts`.
- **flint-electron-ipc**: add Zod schemas to `shared/ipc-validators.ts`.
- **flint-test-writer**: write `ideDetection.test.ts` and `mcpConfigWriter.test.ts` with fixtures (empty config, multi-server config, no file, JSONC comments).

### Group A3 — Integration (depends on A1 and A2)
- **flint-design-engineer**: replace `<BetaWelcome>` with `<HelloFlintWelcome>` in `App.tsx`. Wire the already-connected fast-path. Delete `BetaWelcome.tsx` and its tests.
- **flint-test-writer**: connect the component-test it.todos to real assertions now that handlers and component exist.

**Scheduling note:** `flint-electron-ipc` appears in both A1 (renderer adapter on `web-api.ts` + `flint-api.d.ts`) and A2 (server services + IPC handlers). A single agent session works these two streams sequentially within its own context — the parallelism is between `flint-design-engineer` (A1 UI) and `flint-electron-ipc` (A1 + A2 infra), not within `flint-electron-ipc` itself. A3 starts only after both A1 and A2 are green.

After all three groups: Phase 2.5 `/review` gate, then `flint-integration-validator` for Phase 3.

---

## 8. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Cross-platform editor paths (Linux, Windows) not implemented in closed beta | medium | — | Detection service returns `present: false` and `configPath: null` on non-darwin platforms. Documented in `nonGoals`. Manual-snippet fallback path covers any user the detector misses |
| Atomic merge corrupts existing config when file is JSONC with comments | high | 14 | `mcpConfigWriter.test.ts` MUST include a fixture with JSONC comments. Reuse `stripJsoncComments` helper from existing handler. Round-trip the parse → merge → serialize chain in the test |
| Atomic merge loses entries on file-doesn't-exist case | high | 14 | Test fixture: `configPath` does not exist → writer creates parent dir, writes a fresh config containing only the flint entry, returns `preservedEntries: 0` |
| User clicks "I see the green dot" before the editor's MCP handshake actually completes — false-positive verification | medium | — | Acceptable for closed beta per spec ("user-confirmed is acceptable"). Real handshake observation is Phase B+. The Help panel's "Re-run connection" button gives them an out |
| Existing `SetupWizard` gate in `App.tsx` collides with the new welcome | medium | — | App.tsx integration step must remove the BetaWelcome render path and KEEP the SetupWizard reset-state path (menu only). Order of gates: telemetry consent → `HelloFlintWelcome` (skipped if alreadyConnected) → LaunchScreen |
| Bulk writes partially fail (one editor succeeds, another fails) | medium | 14 | Handler returns both `written` and `failed` arrays. Component shows the partial result honestly: "Wrote to Cursor. Couldn't write to VS Code: <reason>." User can retry the failed one or proceed with the success |
| The `mcpServerPath` returned by detect differs from what the renderer sends to the bulk writer | low | — | Bulk-write handler validates that `payload.mcpServerPath === getMCPServerPath()` and rejects mismatches. Prevents path-injection via a stale renderer payload |
| FileTransactionManager only exists in `electron/`, not `server/` | medium | 14 | Move `FileTransactionManager` to `shared/` OR create a parallel `server/services/fileTransactionManager.ts` with identical semantics. Phase 2 implementer chooses; recommend extracting to `shared/` so both paths share the contract. **Defer the path choice to Phase 2 — flint-electron-ipc decides during implementation, and the choice is part of the integration validator's check** |

---

## 9. Non-Goals (Phase A explicitly does NOT include)

- The four-step guided walkthrough (Phase B)
- The custom-red drift detection panel and three-choice UI (Phase B)
- The "add #DC2626 to my tokens as red-danger" affordance (Phase B)
- Real-time token-highlight animation in the canvas (Phase B)
- Click-to-source affordance polish (Phase B)
- Progress save/resume across app restarts (Phase C)
- The "stuck for 30s" inline help (Phase C)
- LaunchScreen "Sample Projects" section (Phase C)
- File menu "Open Sample" item (Phase C)
- Real-time MCP-handshake observation to auto-confirm the green dot (future)
- Linux and Windows IDE path tables (closed beta is macOS-only; non-darwin returns `present: false` and the manual-snippet path remains usable)
- Telemetry events for the welcome flow (Phase C)
- Localization (English-only)

---

## 10. Open Questions (resolved)

- **Q: Do we delete the legacy `SetupWizard.tsx`?** Resolved: NO in Phase A. It stays addressable via the menu "Reset State" path. Phase C may consolidate.
- **Q: Where does `FileTransactionManager` live for the web server?** Resolved: defer to Phase 2 implementer. Either extract to `shared/` or add a sibling in `server/services/`. The integration validator confirms whichever choice was made satisfies Commandment 14.
- **Q: Does Phase A add Antigravity?** Resolved: NO. The spec lists only Claude Code, Cursor, VS Code. Antigravity remains in the legacy SetupWizard path. Adding Antigravity to Hello is a Phase C decision once we know which editors closed-beta testers actually use.

---

## 11. Acceptance — Phase A "done" criteria

1. A first-time tester opening Flint sees `HelloFlintWelcome` (not BetaWelcome).
2. Clicking `Let's go →` and choosing an installed editor (e.g. Cursor) results in a Flint MCP entry being written into that editor's config file with every other entry preserved byte-for-byte.
3. A tester whose editor already has Flint configured never sees the welcome screen — `alreadyConnected()` short-circuits to `onComplete()`.
4. The legacy `SetupWizard.tsx` and `setup:*` handlers continue to function for the menu "Reset State" path.
5. All Phase 2 agents' tests pass (`npm run test:react`, `npm test`, `npx tsc --noEmit` clean).
6. The `fileTransactionManager` is observable in writes — `mcpConfigWriter` does not call `fs.writeFileSync` directly.
