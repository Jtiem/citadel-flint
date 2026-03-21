# Integration Report: Sprint 2 Security (SEC.1, SEC.2, SEC.3, P0-4)

## Status: PASS (with 2 warnings)

| Check | Result | Details |
|-------|--------|---------|
| Type Check | PASS | `npx tsc --noEmit` = 0 errors |
| IPC Symmetry | PASS | `figma:status` return type aligned across main/preload/flint-api.d.ts; `mcp:call-tool` allowlist enforced in main.ts |
| Store Isolation | PASS | No store files modified; pre-existing `window.flintAPI` usage in stores is out of scope |
| Contract Fidelity | PASS | All 4 contracts implemented faithfully (see details below) |
| Commandment Compliance | PASS | C4 (Local-First), C15/C16 (provider guard), C14 (no direct fs in src/) all verified |
| Test Coverage | 81/81 new tests | SEC1: 19 tests, SEC2: 18 tests, SEC3: 30 tests, P04: 14 tests |
| Process Boundary | PASS | No `fs`/`path`/`child_process`/`electron` imports in `src/`; no `src/store` or `src/components` imports in `electron/` |
| Import Hygiene | PASS | No `@ts-ignore` or `@ts-expect-error` in any modified or new file; no circular imports introduced |

## Test Suite Results

```
Core/Electron:  527/527 passing (81 new)
Glass (React):  496/496 passing (0 new -- SEC1 LivePreview tests counted in core)
MCP Engine:     903/903 passing (0 new)
TSC:            0 errors
```

## Detailed Verification

### Check 1: IPC Symmetry -- figma:status (SEC.2)

- **Main process handler** (`electron/main.ts:2579`): `ipcMain.handle('figma:status', () => getFigmaStatus())` -- returns `{ running, lastWebhookAt, tokenCount, port }`. No `secret` field.
- **Source function** (`electron/ingestion-server.ts:430`): `getFigmaStatus()` returns `{ running, lastWebhookAt, tokenCount, port }`. The `secret` field has been removed from the return type and body.
- **Preload exposure** (`electron/preload.ts:31`): `status: (): Promise<{ running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number }>` -- no `secret` field.
- **Type declaration** (`src/types/flint-api.d.ts:410`): `FigmaStatus` interface has 4 fields: `running`, `lastWebhookAt`, `tokenCount`, `port`. No `secret`.
- **Renderer consumers**: `StatusBar.tsx` and `FigmaSetupWizard.tsx` -- no runtime references to `.secret` or `secretTruncated` variables.
- **VERDICT**: All 5 legs of the IPC triangle are consistent. PASS.

### Check 2: IPC Symmetry -- mcp:call-tool (SEC.3)

- **Policy file** (`electron/mcp-policy.ts`): Exports `RENDERER_ALLOWED_MCP_TOOLS` as a frozen `readonly string[]` with 7 entries.
- **Import** (`electron/main.ts:90`): `import { RENDERER_ALLOWED_MCP_TOOLS } from './mcp-policy.js'`
- **Handler** (`electron/main.ts:1993-2014`): `mcp:call-tool` handler checks `RENDERER_ALLOWED_MCP_TOOLS.includes(name)` before forwarding. Rejects with descriptive error.
- **Preload** (`electron/preload.ts:614`): `callTool: (name: string, args: Record<string, unknown>)` -- unchanged, passes through to main.
- **VERDICT**: Allowlist is imported, enforced server-side, and the error path returns via IPC rejection. PASS.

### Check 3: ingestion-server.ts Signature (SEC.2)

- **Signature** (`electron/ingestion-server.ts:388`): `export function startIngestionServer(secret: string): void` -- accepts `secret` parameter.
- **Validation**: Lines 394-396 enforce `secret.length < 32` guard.
- **Caller** (`electron/main.ts:2572-2573`): `const ingestionSecret = randomBytes(32).toString('hex')` then `startIngestionServer(ingestionSecret)`.
- **Secret lifecycle**: `flintSecret` set on start, cleared to `null` on `stopIngestionServer()`.
- **VERDICT**: Per-session random secret, injected by function argument, validated for strength. PASS.

### Check 4: LivePreview.tsx Sandbox (SEC.1)

- **iframe element** (`src/components/editor/LivePreview.tsx:933`): `sandbox="allow-scripts allow-forms"` -- confirmed present.
- **No allow-same-origin**: The `sandbox` attribute value is exactly `"allow-scripts allow-forms"`. The string `allow-same-origin` does not appear anywhere in the sandbox attribute. Comments at lines 931-932 explicitly document why it is omitted.
- **VERDICT**: PASS.

### Check 5: LivePreview.tsx Origin Check (SEC.1)

- **Origin validation** (`src/components/editor/LivePreview.tsx:642-646`):
  ```
  if (e.origin !== 'null' && !e.origin.startsWith('http://localhost:')) return
  ```
- **Placement**: First meaningful line of `handleMessage`, before any data processing.
- **Test coverage**: 4 tests cover: external origin rejected, non-null-URL rejected, srcdoc origin `'null'` accepted, `http://localhost:5173` accepted.
- **VERDICT**: PASS.

### Check 6: CSP via session.webRequest (SEC.1)

- **Registration** (`electron/main.ts:274`): `session.defaultSession.webRequest.onHeadersReceived(...)` inside `createWindow()`.
- **Dev/Prod split**: `isDev` conditional at line 273 selects between `DEVELOPMENT_CSP` and `PRODUCTION_CSP`.
- **Production CSP** (lines 227-235): No `'unsafe-eval'`, no `ws://localhost:*`. Contains `default-src 'self'`.
- **Development CSP** (lines 217-225): Includes `'unsafe-eval'` and `ws://localhost:*` for Vite HMR.
- **Commandment 4**: Neither CSP includes any external URLs. All `connect-src` entries are `'self'`, `ws://localhost:*` (dev only), `http://localhost:*` (dev), or `http://127.0.0.1:*`.
- **VERDICT**: PASS.

### Check 7: Orchestrator Provider Guard (P0-4)

- **Guard location** (`electron/orchestrator.ts:861-876`): After API key check, before Anthropic branch.
- **Condition**: `if (config.provider && config.provider !== 'anthropic')` -- rejects all non-Anthropic providers.
- **Error message**: Contains "Anthropic API key", "Commandment 15", "Commandment 16", "AI Settings".
- **OpenAI/Gemini branches**: Removed. Comments at lines 879-884 document the removal per ADR P0-4, with a TODO for Option A.
- **VERDICT**: PASS.

### Check 8: Process Boundary

- No `import` from `fs`, `path`, `child_process`, `electron`, or `better-sqlite3` in any `src/` file.
- The `src/core/ASTService.ts` import of `../utils/pathUtils` resolves to `src/utils/pathUtils.ts`, which is a pure browser-safe implementation (no Node.js `path` module).
- No `src/store/` or `src/components/` imports in any `electron/` file.
- **VERDICT**: PASS.

### Check 9: Store Isolation

- No store files were modified in this sprint (`git diff HEAD --name-only -- src/store/` returns empty).
- Pre-existing `window.flintAPI` calls in `orchestratorStore.ts`, `tokenStore.ts`, `canvasStore.ts`, `annotationStore.ts`, `governanceStore.ts`, `assetStore.ts`, `editorStore.ts`, `astBufferStore.ts` are an architectural debt item documented in the CLAUDE.md anti-patterns section. They are NOT regressions from this sprint.
- No cross-store imports exist (the one `import` in `src/store/__tests__/notificationStore.test.ts` is a test file importing its subject, not a store importing another store).
- **VERDICT**: PASS (pre-existing debt acknowledged, not introduced here).

### Check 10: Contract Fidelity

| Contract | Contract Match | Notes |
|----------|---------------|-------|
| SEC1-RendererHardening.md | EXACT | Sandbox attr, origin check, CSP constants and callback all match contract spec |
| SEC2-SecretHygiene.md | EXACT | `startIngestionServer(secret)` signature, `randomBytes(32)` generation, `getFigmaStatus()` shape, preload/type cleanup all match |
| SEC3-MCPAllowlist.md | EXACT | `RENDERER_ALLOWED_MCP_TOOLS` frozen array with 7 tools, `mcp:call-tool` guard, error message format all match |
| P04-ProviderParity-ADR.md | EXACT | Provider guard condition, error message content, OpenAI/Gemini branch removal all match Option B spec |

Minor cosmetic deviation in `mcp-policy.ts`: The contract specified `as readonly string[]` cast after `Object.freeze()`, but the implementation achieves the same type via the `: readonly string[]` annotation on the left side. TypeScript resolves both to the same type. Not a functional deviation.

## Issues Found

1. **[WARNING]** Stale `secret: 'test-secret'` in pre-existing test file -- `src/components/ui/__tests__/LaunchScreen.test.tsx:141` -- The mock return value for `figma.status()` includes `secret: 'test-secret'`, which is a property no longer present in `FigmaStatus`. This does not cause a test failure because JavaScript silently ignores extra properties, but it is stale code that contradicts SEC.2. This file was NOT modified by the Sprint 2 agents and is NOT a regression from this sprint.

2. **[WARNING]** Stale comments referencing "secret copy fields" in `FigmaSetupWizard.tsx` -- Lines 10 and 42 contain comments that say "shows endpoint + secret copy fields" and "showing endpoint + secret copy fields". The actual code correctly renders only the endpoint field (no secret CopyField). These are documentation-only artifacts that do not affect runtime behavior.

## Verdict: SHIP

All 4 security contracts (SEC.1, SEC.2, SEC.3, P0-4) are implemented correctly and match their binding specifications. The IPC triangle is symmetric for all affected channels. Process boundaries are respected. All 1,926 tests across 3 packages pass. TypeScript compilation reports 0 errors.

### Recommended Follow-ups (Non-Blocking)

| Issue | Priority | Description |
|-------|----------|-------------|
| 1 | Low | Clean up `secret: 'test-secret'` from `LaunchScreen.test.tsx:141` mock -- stale property, harmless but inconsistent |
| 2 | Low | Update `FigmaSetupWizard.tsx` comments on lines 10 and 42 to say "endpoint copy fields" instead of "endpoint + secret copy fields" |
