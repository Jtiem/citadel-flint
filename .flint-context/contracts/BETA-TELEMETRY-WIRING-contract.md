# BETA-TELEMETRY-WIRING — Contract Artifact

**Phase:** BETA.TEL
**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-25
**Audience:** designer (cross-process: Electron main + web server + renderer)

## Purpose

Wire the existing `electron/betaTelemetry.ts` module into the running Flint app and close every BLK + WARN finding from `.flint-context/reviews/beta-telemetry-review-2026-04-25.md`:

- **BLK-2** Module not wired → `startTelemetry()` runs from `app.whenReady()` (Electron) and server boot (web). Emit sites added at MCP dispatch, audit completion, and session end.
- **BLK-3** No IPC contract → two new channels with Zod validators, mirrored in preload + web bridge.
- **WARN-1** Queue path → `app.getPath('userData')` with one-time migration of legacy `~/.flint/` queue.
- **WARN-2** Sync fs in hot path → in-memory buffer; persist on flush + before-quit + uncaughtException only.
- **WARN-3** Stack-trace path leak → redact `/Users/<name>/`, `/home/<name>/`, and `C:\Users\<name>\` to `<homedir>/`.
- **WARN-4** Untyped payload → `emit()` becomes a discriminated-union signature; tool-name only, never args.
- **WARN-5** Test gaps → 4 new tests (network failure, malformed queue, secret header, uncaughtException registration).
- **First-launch consent dialog** — new React component mounted from `App.tsx` when consent state is `unset`. The plan now specifies opt-in default (consent gates `emit()`).

## 1. Impact Map

| File | Change | Owner | Summary |
|---|---|---|---|
| `shared/ipc-validators.ts` | MODIFY | flint-electron-ipc | Append `telemetry:get-consent` + `telemetry:set-consent` schemas; export named validators. |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Add `window.flintAPI.telemetry.{getConsent,setConsent}` via contextBridge. |
| `electron/main.ts` | MODIFY | flint-electron-ipc | Register handlers; call `startTelemetry()` in `app.whenReady()`; add `mcp.tool_called` + `audit.completed` emit sites; populate `session.ended` duration. |
| `electron/betaTelemetry.ts` | MODIFY | flint-electron-ipc | userData/ queue path + legacy migration; in-memory buffer; stack redaction; discriminated-union emit signature. |
| `electron/betaTelemetry.test.ts` | MODIFY | flint-test-writer | +4 tests covering WARN-5 + redaction + path migration. |
| `server/index.ts` | MODIFY | flint-electron-ipc | Web parity: mirror IPC channels over WS; same emit sites. |
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | Add `telemetry` namespace to FlintAPI declaration. |
| `src/components/ui/TelemetryConsentDialog.tsx` | CREATE | flint-design-engineer | First-launch modal; a11y-clean (focus trap, Escape, aria-modal). |
| `src/components/ui/__tests__/TelemetryConsentDialog.test.tsx` | CREATE | flint-test-writer | Render, click handlers, focus trap, Escape. |
| `src/App.tsx` | MODIFY | flint-design-engineer | Mount dialog when `consent.state === 'unset'` on first render. |

## 2. Type Contracts

All Phase 2 agents import these directly from `BETA-TELEMETRY-WIRING.contract.ts`:

```ts
type ConsentState = 'unset' | 'accepted' | 'declined';

interface ConsentRecord {
  state: ConsentState;
  decidedAt?: string;       // ISO 8601, absent until decided
  sessionId: string;        // uuid v4
}

interface TelemetrySetConsentPayload {
  state: 'accepted' | 'declined';
}

type TelemetryEvent =
  | { name: 'app.launched';    payload: { locale: string } }
  | { name: 'app.crashed';     payload: { message: string; stack: string } }
  | { name: 'mcp.tool_called'; payload: { toolName: string } }     // never args
  | { name: 'audit.completed'; payload: { fileCount: number; violationCount: number; durationMs: number } }
  | { name: 'session.ended';   payload: { durationMs: number } };

interface EmitFunction {
  <E extends TelemetryEvent>(name: E['name'], payload: E['payload']): void;
}

interface TelemetryConsentDialogProps {
  onDecided: (state: 'accepted' | 'declined') => void;
}

interface TelemetryFlintAPI {
  telemetry: {
    getConsent: () => Promise<ConsentRecord>;
    setConsent: (payload: TelemetrySetConsentPayload) => Promise<ConsentRecord>;
  };
}
```

## 3. IPC Channels

| Channel | Direction | Payload | Return | Handler | Validator |
|---|---|---|---|---|---|
| `telemetry:get-consent` | renderer→main | `void` | `ConsentRecord` | `electron/main.ts` | `telemetryGetConsentResponseSchema` |
| `telemetry:set-consent` | renderer→main | `TelemetrySetConsentPayload` | `ConsentRecord` | `electron/main.ts` | `telemetrySetConsentPayloadSchema` |

Both mirrored in `server/index.ts` over WebSocket per `feedback_web_parity_drift.md`. The web build's `src/adapters/web-api.ts` exposes the same `window.flintAPI.telemetry` shape.

## 4. Store Contracts

None. Telemetry state lives on disk and in the `betaTelemetry.ts` module's in-memory buffer. The renderer reads consent imperatively at App mount; there is no Zustand slice for it.

## 5. Component Contracts

| Component | Props | Stores | IPC |
|---|---|---|---|
| `TelemetryConsentDialog` | `TelemetryConsentDialogProps` | none | `telemetry:set-consent` |

Accessibility requirements (Warden audits this component against itself):
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Focus trap on Tab/Shift+Tab cycle
- Escape key triggers Decline path (privacy-safe default)
- Initial focus on Decline button (privacy-safe default — user must affirmatively click Accept)
- All buttons reachable by keyboard alone

## 6. Commandment Checklist

| # | Commandment | How this contract satisfies it |
|---|---|---|
| 2 | No Hallucinated Styling | TelemetryConsentDialog uses token-backed Tailwind classes only (e.g. `bg-surface`, `text-primary`); no hex literals or arbitrary values. |
| 5 | Accessibility is a Compiler Error | Consent dialog is a11y-clean; component test asserts focus trap + aria attributes. |
| 12 | Atomic Queuing | In-memory buffer + single atomic write at flush time; matches FileTransactionManager spirit even though telemetry queue isn't a `.tsx` file. |
| 14 | Bypass Prohibition | Renderer never touches `~/.flint/` or userData/ directly; only main + server processes write. All renderer access goes through `window.flintAPI.telemetry`. |
| 16 | In-Memory Validation | Zod validates payload at preload bridge; discriminated-union `EmitFunction` makes the privacy promise a TSC error. |

Commandments 1, 3, 4, 6–11, 13, 15 don't apply (no AST mutations, no Git transplants, no array-keyed renders).

## 7. Implementation Order

**Group A (parallel):**
1. `flint-electron-ipc`
   - Add Zod schemas + named exports to `shared/ipc-validators.ts`
   - Harden `electron/betaTelemetry.ts` (path + buffer + redaction + typed emit + migration)
   - Wire `startTelemetry()` + handlers + emit sites in `electron/main.ts`
   - Mirror in `server/index.ts`
   - Update `electron/preload.ts` + `src/types/flint-api.d.ts`
2. `flint-test-writer`
   - Extend `electron/betaTelemetry.test.ts` with the 4 WARN-5 tests + redaction + migration tests
   - Scaffold `TelemetryConsentDialog.test.tsx` from contract testBoundaries (it.todo first)

**Group B (depends on Group A's IPC types) — `flint-design-engineer` + `flint-test-writer`:**
3. `flint-design-engineer`
   - Build `TelemetryConsentDialog.tsx` against `TelemetryConsentDialogProps`
   - Mount in `src/App.tsx` (read consent on mount, render dialog if unset)
4. `flint-test-writer`
   - Fill in real assertions on the consent dialog tests

Group A can run fully in parallel because the IPC channel types and the test scaffolds depend only on the contract `.ts` file — not on each other.

## 8. Risks

| Risk | Severity | Commandment | Mitigation |
|---|---|---|---|
| UI ships before IPC wired → runtime error | high | — | Group A blocks Group B; integration validator confirms wiring before ship. |
| Open-payload `emit()` regression leaks args | high | 16 | Discriminated-union signature replaces overload; old call sites must be updated or TSC fails. |
| Redaction misses Linux/Windows paths | medium | — | Regex covers all 3 OS conventions; fixture set asserts each. |
| Hard crash loses in-memory buffer | medium | — | `uncaughtException` synchronously persists then flushes before propagating. |
| Web build drift | medium | — | Impact map requires `server/index.ts` mirror; invariant `web-parity` blocks ship. |
| Dialog itself fails Warden | medium | 5 | Component test asserts a11y; flint-design-engineer self-audits with `audit_ui_component`. |

## 9. Non-Goals

- Cloudflare Worker telemetry sink (Phase A.4, separate review).
- Feedback widget UI (separate phase).
- Expiry kill switch (separate phase).
- Adding new telemetry events beyond the 5 enumerated in the discriminated union — that requires a new contract.
- Sampling / rate-limiting — out of scope for ~10-user closed beta.

## 10. Verification (Phase 3 will check)

- `grep -n "telemetryGetConsentResponseSchema\|telemetrySetConsentPayloadSchema" shared/ipc-validators.ts` returns both exports.
- `grep -n "startTelemetry()" electron/main.ts server/index.ts` returns at least one match per file.
- `grep -n "emit('mcp.tool_called'\|emit(\"mcp.tool_called\"" electron/main.ts` returns ≥ 1 match at the MCP dispatch site.
- `cd flint-mcp && npm test` and `npm test` and `npm run test:react` all green; new tests counted.
- `npx tsc --noEmit` exits 0.
- Manual: clean userData, launch app, dialog appears, click Accept, restart → dialog does not reappear.
