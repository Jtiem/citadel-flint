# Contract Artifact: SEC.2 -- Secret Hygiene

**Version:** 1.0
**Date:** 2026-03-16
**Status:** CONTRACT -- Binding specification for Phase 2 agents
**Priority:** P1
**Depends on:** None (no phase dependencies)
**Security Review Ref:** `.bridge-context/reviews/SEC-surface-review.md` findings: "Hardcoded webhook secret in production binary", "Secret logged to console", "Webhook secret returned to renderer via IPC"

---

## 1. Summary

The ingestion server authenticates Figma plugin requests via an `x-bridge-secret` header. Currently, the secret is a hardcoded compile-time constant (`'bridge-dev-secret-phase2'`) that ships in every binary, is logged to the console on startup, and is returned to the renderer via IPC. This contract replaces the hardcoded secret with a per-session cryptographic random value, removes all console logging of the secret, removes the secret from the renderer-facing IPC surface, and cleans up the stale type declarations and renderer code that reference it.

**Partial fix already in place:** The `figma:status` IPC handler in `electron/main.ts` (line 2351-2353) already strips the `secret` field before returning to the renderer. However, the `FigmaStatus` type in `bridge-api.d.ts`, the `preload.ts` return type, and two renderer files (`StatusBar.tsx`, `FigmaSetupWizard.tsx`) still reference `secret`. These must be cleaned up.

---

## 2. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `electron/ingestion-server.ts` | MODIFY | `bridge-electron-ipc` | Replace hardcoded secret with injected per-session secret; remove `secret` from `getFigmaStatus()` return; remove console.log of secret |
| `electron/main.ts` | MODIFY | `bridge-electron-ipc` | Generate random secret in `app.whenReady()`; pass to ingestion server init; no changes to `figma:status` handler (already strips secret) |
| `electron/preload.ts` | MODIFY | `bridge-electron-ipc` | Remove `secret: string` from `figma.status()` return type |
| `src/types/bridge-api.d.ts` | MODIFY | `bridge-electron-ipc` | Remove `secret` field from `FigmaStatus` interface |
| `src/components/editor/StatusBar.tsx` | MODIFY | `bridge-design-engineer` | Remove `secret` and `secretTruncated` variables (dead code since handler already strips it) |
| `src/components/ui/FigmaSetupWizard.tsx` | MODIFY | `bridge-design-engineer` | Remove `secret` variable usage |
| `electron/__tests__/ingestion-secret.test.ts` | CREATE | `bridge-test-writer` | Tests for per-session secret generation and hygiene |

---

## 3. Detailed Behavior Specification

### 3.1 Per-session secret generation

**File:** `electron/main.ts`, inside the `app.whenReady()` block (near line 2340)

Generate a cryptographically random secret once per application session:

```typescript
import { randomBytes } from 'node:crypto'

// Inside app.whenReady():
const sessionSecret = randomBytes(32).toString('hex')
```

`randomBytes` is already available in the Node.js `crypto` module. The result is a 64-character hex string (256 bits of entropy), regenerated on every app launch.

**Passing to ingestion server:** The secret is passed to the ingestion server as a direct function argument, NOT via IPC, environment variables, or global state. The `startIngestionServer` function signature changes to accept the secret:

```typescript
// Before (current):
startIngestionServer()

// After:
startIngestionServer(sessionSecret)
```

The startup sequence in `app.whenReady()` becomes:

```
1. Generate sessionSecret via randomBytes(32).toString('hex')
2. Import ingestion-server module
3. Call setPreHealCodeCallback(...)
4. Call startIngestionServer(sessionSecret)
```

### 3.2 ingestion-server.ts changes

**File:** `electron/ingestion-server.ts`

#### 3.2.1 Remove hardcoded secret constant

Remove line 35:
```typescript
// REMOVE: const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? 'bridge-dev-secret-phase2'
```

Replace with a module-level `let` that is set by `startIngestionServer`:

```typescript
let bridgeSecret: string | null = null
```

#### 3.2.2 Change startIngestionServer signature

```typescript
// Before:
export function startIngestionServer(): void

// After:
export function startIngestionServer(secret: string): void
```

Inside the function body, set the module-level secret:

```typescript
export function startIngestionServer(secret: string): void {
    if (server) {
        console.warn('[Bridge] Ingestion server already running.')
        return
    }
    if (!secret || secret.length < 32) {
        throw new Error('startIngestionServer requires a secret of at least 32 characters')
    }
    bridgeSecret = secret
    tryListen(BASE_PORT)
}
```

#### 3.2.3 Update handleRequest to use the injected secret

In `handleRequest`, line 135, replace `BRIDGE_SECRET` with `bridgeSecret`:

```typescript
if (!secret || secret !== bridgeSecret) {
```

Add a guard at the top of `handleRequest` in case the server somehow receives a request before the secret is set:

```typescript
if (bridgeSecret === null) {
    sendJson(res, 503, { error: 'Server not fully initialized' })
    return
}
```

#### 3.2.4 Remove secret from getFigmaStatus return

The `getFigmaStatus()` function currently returns `secret: BRIDGE_SECRET`. Remove this field entirely:

```typescript
// Before:
export function getFigmaStatus(): { running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number; secret: string }

// After:
export function getFigmaStatus(): { running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number }
```

Return object drops the `secret` field.

Note: The `figma:status` IPC handler in `main.ts` already destructures `{ secret: _secret, ...safeStatus }`, so removing `secret` from the source function means the destructuring becomes a no-op on a nonexistent key. The handler should be simplified to just `return getFigmaStatus()` since the secret is no longer present.

#### 3.2.5 Remove console.log of secret

Remove line 368:
```typescript
// REMOVE: console.log(`[Bridge] x-bridge-secret: ${BRIDGE_SECRET}`)
```

The server start log on line 367 (`[Bridge] Ingestion server listening on http://127.0.0.1:${port}`) remains.

#### 3.2.6 stopIngestionServer clears the secret

When the server stops, clear the secret to prevent stale references:

```typescript
export function stopIngestionServer(): void {
    if (server) {
        server.close(() => {
            console.log('[Bridge] Ingestion server stopped.')
        })
        server = null
        bridgeSecret = null  // Clear secret on stop
    }
}
```

### 3.3 main.ts figma:status handler simplification

**File:** `electron/main.ts`, line 2351-2354

Since `getFigmaStatus()` no longer returns `secret`, simplify the handler:

```typescript
// Before:
ipcMain.handle('figma:status', () => {
    const { secret: _secret, ...safeStatus } = getFigmaStatus()
    return safeStatus
})

// After:
ipcMain.handle('figma:status', () => getFigmaStatus())
```

Remove the associated comment block (lines 2347-2350) about stripping the secret since the source no longer provides it.

### 3.4 Type and preload cleanup

**File:** `src/types/bridge-api.d.ts` (near line 408-418)

Remove the `secret` field from the `FigmaStatus` interface:

```typescript
// Before:
export interface FigmaStatus {
    running: boolean
    lastWebhookAt: number | null
    tokenCount: number
    port: number
    secret: string  // REMOVE this line
}

// After:
export interface FigmaStatus {
    running: boolean
    lastWebhookAt: number | null
    tokenCount: number
    port: number
}
```

Remove the JSDoc comments for the `secret` field (lines 406 and 417-418).

**File:** `electron/preload.ts` (line 30)

Remove `secret: string` from the `figma.status()` return type:

```typescript
// Before:
status: (): Promise<{ running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number; secret: string }> =>

// After:
status: (): Promise<{ running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number }> =>
```

### 3.5 Renderer cleanup (dead code removal)

**File:** `src/components/editor/StatusBar.tsx` (line 214-215)

Remove the two lines that extract and truncate the secret:

```typescript
// REMOVE:
const secret = figmaStatus?.secret ?? ''
const secretTruncated = secret.length > 15 ? `${secret.slice(0, 15)}...` : secret
```

Search for any usage of `secret` or `secretTruncated` further down in the component's JSX and remove those references. If there is a "copy secret" button or a display of `secretTruncated`, remove it.

**File:** `src/components/ui/FigmaSetupWizard.tsx` (line 298)

Remove:

```typescript
// REMOVE:
const secret = figmaStatus?.secret ?? ''
```

Search for any usage of `secret` in the component's JSX and remove those references.

---

## 4. IPC Changes

| Channel | Direction | Change | Notes |
|---------|-----------|--------|-------|
| `figma:status` | renderer -> main | Return type loses `secret` field | No new channel; existing channel returns less data |

No new IPC channels are added. The `figma:status` handler already strips the secret (line 2351-2353); this contract removes it from the source, making the stripping unnecessary.

---

## 5. Store Contracts

None. No Zustand stores are modified.

---

## 6. Component Contracts

| Component | Change | Store Dependencies | IPC Calls |
|-----------|--------|-------------------|-----------|
| `StatusBar` | Remove dead `secret`/`secretTruncated` code | No change | `figma:status` return type loses `secret` |
| `FigmaSetupWizard` | Remove dead `secret` code | No change | `figma:status` return type loses `secret` |

---

## 7. Test Requirements

### 7.1 Per-session secret uniqueness

**File:** `electron/__tests__/ingestion-secret.test.ts`

Test SEC2-01: Two calls to the secret generation logic produce different values.

```
- Call randomBytes(32).toString('hex') twice
- Assert: result1 !== result2
- Assert: both are 64 characters long
- Assert: both match /^[0-9a-f]{64}$/
```

(This test validates the generation pattern, not the ingestion server itself.)

### 7.2 Ingestion server accepts injected secret

Test SEC2-02: `startIngestionServer(secret)` uses the provided secret for authentication.

```
- Call startIngestionServer(testSecret) with a known testSecret
- Send a request to the server with the correct x-bridge-secret header
- Assert: request succeeds (200)
- Send a request with the wrong x-bridge-secret header
- Assert: request fails (401)
- Send a request with no x-bridge-secret header
- Assert: request fails (401)
```

### 7.3 getFigmaStatus does not return secret

Test SEC2-03: `getFigmaStatus()` return value does not contain a `secret` key.

```
- Call startIngestionServer(testSecret)
- Call getFigmaStatus()
- Assert: result does not have a 'secret' property
- Assert: result has 'running', 'lastWebhookAt', 'tokenCount', 'port'
```

### 7.4 No console.log of secret

Test SEC2-04: Starting the ingestion server does not log the secret to console.

```
- Spy on console.log
- Call startIngestionServer(testSecret)
- Assert: no console.log call contains testSecret
- Assert: no console.log call contains 'x-bridge-secret'
```

### 7.5 startIngestionServer rejects weak secrets

Test SEC2-05: `startIngestionServer('')` and `startIngestionServer('short')` throw.

```
- Assert: startIngestionServer('') throws
- Assert: startIngestionServer('abc') throws
- Assert: startIngestionServer('a'.repeat(32)) does not throw
```

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|--------------|
| 4 | Local-First Only | Yes | Secret is generated locally via `crypto.randomBytes`. No network call. |
| 12 | Atomic Queuing | No | No file writes. |
| 14 | Bypass Prohibition | No | No `fs` or `git` usage. |

---

## 9. Implementation Order

| Step | Agent | Parallel Group | Description |
|------|-------|---------------|-------------|
| 1 | `bridge-electron-ipc` | A | Modify `electron/ingestion-server.ts`: remove hardcoded secret, change `startIngestionServer` signature, remove `secret` from `getFigmaStatus`, remove console.log |
| 2 | `bridge-electron-ipc` | A | Modify `electron/main.ts`: generate `sessionSecret`, pass to `startIngestionServer`, simplify `figma:status` handler |
| 3 | `bridge-electron-ipc` | A | Modify `electron/preload.ts`: remove `secret` from `figma.status()` return type |
| 4 | `bridge-electron-ipc` | A | Modify `src/types/bridge-api.d.ts`: remove `secret` from `FigmaStatus` interface |
| 5 | `bridge-design-engineer` | A | Modify `StatusBar.tsx` and `FigmaSetupWizard.tsx`: remove dead `secret` code |
| 6 | `bridge-test-writer` | B (after A) | Write tests SEC2-01 through SEC2-05 |
| 7 | `bridge-test-writer` | B | Run full test suite, TSC, report counts |

All implementation steps (Group A) can run in parallel. Tests (Group B) run after.

---

## 10. Risk Assessment

**Overall Risk:** LOW

| Risk | Severity | Mitigation |
|------|----------|------------|
| Figma plugin cannot authenticate after secret change | Medium | The Figma plugin setup UI must display the new per-session secret so users can copy it. Currently, the secret was displayed via `StatusBar` and `FigmaSetupWizard`. Since the secret is removed from the renderer, a new mechanism is needed for users to discover it. **Resolution:** This is a UX concern for a future sprint. For now, the secret is visible in the Figma Plugin Settings UI (Phase FP.1) which runs in the main process. Users configure their plugin's endpoint and secret in that UI. If the existing Figma plugin settings UI relies on the renderer receiving the secret, a follow-up task will add a dedicated IPC handler gated behind a user gesture (e.g., "Reveal Secret" button that calls a one-shot IPC). |
| Existing Figma plugins stop working on app restart | Low | Expected behavior. Per-session secrets rotate on each launch. The Figma plugin must be re-configured with the new secret. This is the correct security posture. |
| Breaking type changes | Low | TypeScript compiler will flag all usages of `FigmaStatus.secret`. The contract explicitly lists all files that reference it. |

---

## 11. Acceptance Criteria

- [ ] `electron/ingestion-server.ts` contains no hardcoded secret string
- [ ] `startIngestionServer` requires a `secret: string` parameter
- [ ] The secret is generated via `crypto.randomBytes(32).toString('hex')` in `app.whenReady()`
- [ ] `getFigmaStatus()` return type does not include `secret`
- [ ] No `console.log` or `console.info` call in `ingestion-server.ts` outputs the secret value
- [ ] `FigmaStatus` interface in `bridge-api.d.ts` does not include `secret`
- [ ] `preload.ts` `figma.status()` return type does not include `secret`
- [ ] `StatusBar.tsx` and `FigmaSetupWizard.tsx` contain no references to `.secret`
- [ ] Tests SEC2-01 through SEC2-05 pass
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] Full test suite passes with 0 regressions
