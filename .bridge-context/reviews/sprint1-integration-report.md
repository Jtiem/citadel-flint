# Integration Report: Sprint 1 — Security Fixes & Code Review Remediation

## Status: FAIL

### Test Suite Results

```
Core:  447/447 passing (22 new — mainSecurityFixes.test.ts)
Glass: 491/491 passing (19 new — ImportAuditToast 10, editorStore.applyBatch 9)
MCP:   845/845 passing (0 new)
TSC:   0 errors (top-level `npx tsc --noEmit`)
```

Note: `npx tsc --noEmit` uses composite project references and reports 0 errors.
However, `npx tsc --noEmit -p tsconfig.node.json` reports 24 errors (most pre-existing).
5 of these are TS2339 for `fileTransactionManager.writeFile` — 4 pre-existing, 1 new (Agent A).

### Validation Matrix

| Check | Result | Details |
|-------|--------|---------|
| Type Check | PASS (qualified) | 0 errors via `npx tsc --noEmit`. See Issue #3 for per-project detail. |
| IPC Symmetry | FAIL | `figma:status` handler strips `secret` but preload + type declaration still promise it. 2 renderer files read a field that is now always `undefined`. |
| Store Isolation | PASS (qualified) | `importSummaryStore` has no cross-store imports and no `window.bridgeAPI` calls. `editorStore` imports `canvasStore` + `historyStore` — pre-existing, not introduced by Sprint 1. Multiple stores call `window.bridgeAPI` — also pre-existing. |
| Contract Fidelity | PASS | Agent B's `injectBridgeIds` addition matches Commandment 7. Agent C's exhaustiveness check matches the contract for ASTService. Agent D's `status: 'active' \| 'planned'` field is correctly typed and rendered. |
| Commandment Compliance | PASS | C7 (ID Preservation) now enforced in `applyBatch`. C12 (Atomic Queuing) addressed for annotations (but uses wrong method name — see Issue #3). C14 (Bypass Prohibition) annotation writes now route through FTM. |
| Test Coverage | 51/51 new | All 3 new test files exercise real behavior with assertions, not just `toBeDefined()`. |
| Process Boundary | PASS | No new `fs`/`path`/`electron` imports in `src/`. |
| Import Hygiene | WARN | Agent C added `as any` in the exhaustiveness default case (see Issue #4). |

---

## Issues Found

### 1. [BLOCKING] IPC Symmetry Break — `figma:status` strips `secret` but preload and type system still expose it

**What happened:** Agent A correctly stripped `secret` from the `figma:status` IPC handler in `electron/main.ts:2434-2437`. However, the following files were NOT updated:

- `/Users/tiemann/Lunar-Elevator-Bridge/electron/preload.ts:30` — Return type still includes `secret: string`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/types/bridge-api.d.ts:408-418` — `FigmaStatus` interface still includes `secret: string`

**Downstream breakage:**
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/StatusBar.tsx:214` — `figmaStatus?.secret ?? ''` now reads `undefined`, truncated secret display is silently empty
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/FigmaSetupWizard.tsx:298` — `figmaStatus?.secret ?? ''` now reads `undefined`, "Copy secret" button copies empty string

**Impact:** The secret is no longer leaked to the renderer (good), but the "Copy secret to clipboard" UX in StatusBar popover and FigmaSetupWizard is silently broken. Users cannot configure their Figma plugin because the secret is never displayed.

**Fix required:**
1. Remove `secret: string` from `FigmaStatus` in `src/types/bridge-api.d.ts`
2. Remove `secret: string` from the preload return type on line 30
3. Remove all `figmaStatus.secret` references from `StatusBar.tsx` and `FigmaSetupWizard.tsx`
4. Determine where the secret SHOULD be displayed (it must come through a separate, intentional IPC channel if the user needs it for Figma plugin configuration — or provide it via a different mechanism like writing it to a config file the Figma plugin reads)

---

### 2. [BLOCKING] `fileTransactionManager.writeFile()` does not exist — annotation resolve will throw at runtime

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/electron/main.ts:1711`
**Code:** `await fileTransactionManager.writeFile(filePath, JSON.stringify(annotations, null, 2))`

**What happened:** Agent A changed the annotation write from a raw `fs.writeFile` call to `fileTransactionManager.writeFile(...)` to comply with Commandment 12 (Atomic Queuing). However, the `FileTransactionManager` class only exposes `write()` and `writeBatch()` — there is no `writeFile()` method.

**Impact:** Resolving an annotation will throw `TypeError: fileTransactionManager.writeFile is not a function` at runtime. The top-level `npx tsc --noEmit` does not catch this because the composite project reference build does not propagate sub-project errors in non-build mode.

**Evidence:** `npx tsc --noEmit -p tsconfig.node.json` reports:
```
electron/main.ts(1711,38): error TS2339: Property 'writeFile' does not exist on type 'FileTransactionManager'.
```

**Fix:** Change `fileTransactionManager.writeFile(` to `fileTransactionManager.write(` at line 1711.

**Note:** The same bug exists at lines 896, 900, 952, and 956, but those are PRE-EXISTING (they were present before Sprint 1). Agent A should fix line 1711; the other 4 instances should be tracked as a separate backlog item.

---

### 3. [WARNING] `as any` cast in ASTService.ts exhaustiveness check

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/core/ASTService.ts:428`
**Code:** `throw new Error(\`Unhandled mutation type: ${(_exhaustive as any).type}\`)`

**What happened:** Agent C added the exhaustiveness check (which is correct and valuable), but used `as any` to access `.type` on the `never`-typed value for the error message.

**Impact:** Not a functional bug — this line only executes if the type system is violated (new op added without a case). However, `as any` is flagged by the project's Import Hygiene standards. The idiomatic alternative is `(mutation as { type?: string }).type ?? 'unknown'` or `JSON.stringify(mutation)`.

---

### 4. [WARNING] `tokenMapper` deletion: references remain in documentation

**File deleted:** `electron/tokenMapper.ts` — confirmed deleted, no code imports remain.

**Remaining references** (documentation only, non-blocking):
- `docs/strategy/BRIDGE-EXPANSION-PLAN.md:202`
- `.bridge-context/reviews/mass-commit-audit.md` (7 references)
- `.bridge-context/reviews/BACKLOG.md` (4 references)

These are informational and do not affect builds or runtime. The backlog entry (P2-3) can be marked as resolved.

---

### 5. [INFO] Pre-existing Store Isolation violations (NOT introduced by Sprint 1)

The following cross-store imports and `window.bridgeAPI` calls in stores predate Sprint 1. They are documented here for awareness but are NOT Sprint 1 regressions:

**Cross-store imports:**
- `editorStore.ts` imports `canvasStore` and `historyStore`
- `orchestratorStore.ts` imports `editorStore` and `canvasStore`
- `astBufferStore.ts` imports `historyStore`

**`window.bridgeAPI` in stores:**
- `orchestratorStore.ts` — 15 calls
- `tokenStore.ts` — 10 calls
- `canvasStore.ts` — 5 calls
- `astBufferStore.ts` — 3 calls
- `annotationStore.ts` — 4 calls
- `governanceStore.ts` — 2 calls
- `assetStore.ts` — 2 calls
- `editorStore.ts` — 1 call (`window.bridgeAPI.gitShow`)

`importSummaryStore.ts` correctly has ZERO `window.bridgeAPI` calls and ZERO cross-store imports, as specified in its contract.

---

### 6. [INFO] Pre-existing `tsconfig.node.json` errors unrelated to Sprint 1

24 errors in `tsconfig.node.json` — all unused variable declarations and the 4 pre-existing `writeFile` method errors. These are not Sprint 1 regressions but should be addressed in a hygiene pass.

---

## Verdict: FIX

Two blocking issues require targeted fixes before this can ship. Both are isolated to Agent A's scope.

### Fix Assignments

| Issue # | Severity | Assigned Agent | Fix Description |
|---------|----------|---------------|----------------|
| 1 | BLOCKING | Agent A (electron-ipc) | Remove `secret` from preload return type (`electron/preload.ts:30`), remove `secret` from `FigmaStatus` interface (`src/types/bridge-api.d.ts:417-418`), remove all `.secret` reads from `StatusBar.tsx` and `FigmaSetupWizard.tsx`. Decide on an alternative secret delivery mechanism (e.g., a dedicated `figma:get-secret` IPC that only fires on explicit user action). |
| 2 | BLOCKING | Agent A (electron-ipc) | Change `fileTransactionManager.writeFile(` to `fileTransactionManager.write(` at `electron/main.ts:1711`. |
| 3 | WARNING | Agent C (ast-service) | Replace `as any` with a safer cast in `src/core/ASTService.ts:428`. Suggested: `(mutation as { op?: string }).op ?? 'unknown'`. |
| 4 | INFO | Any (docs) | Update `docs/strategy/BRIDGE-EXPANSION-PLAN.md` to note tokenMapper.ts was deleted. Mark BACKLOG P2-3 as resolved. |

### Pre-existing Issues (Not Sprint 1 — track separately)

| Issue | Description | Suggested Fix |
|-------|-------------|---------------|
| FTM method name | Lines 896, 900, 952, 956 in `electron/main.ts` call `fileTransactionManager.writeFile()` which does not exist | Change all 4 to `.write()` |
| Store isolation | 7 stores use `window.bridgeAPI` directly | Refactor to service layer (large effort, separate initiative) |
| TSC node config | 24 errors in `tsconfig.node.json` | Hygiene pass to clean unused declarations |

---

## Agent Performance Summary

| Agent | Scope | Quality | Notes |
|-------|-------|---------|-------|
| Agent A | electron/main.ts security fixes | Good intent, incomplete execution | Correctly stripped secret from handler and added FTM routing, but failed to update the preload type, the d.ts, and the 2 renderer consumers. Used wrong FTM method name. |
| Agent B | editorStore + ImportAuditToast | Excellent | Clean rewiring, proper Commandment 7 implementation, good test coverage (19 tests). |
| Agent C | ASTService exhaustiveness | Good | Correct exhaustiveness check with proper `default: never` pattern. Minor `as any` usage. 20 new tests. |
| Agent D | GovernancePanel + rule manifest | Excellent | Clean type addition, proper "Coming soon" badge, no `as any`, fixed pre-existing test bugs. |

---

*Generated by bridge-integration-validator | Phase 3 of Contract-First Feature Build*
*Validated against: feat/demo-superpowers @ Sprint 1 code review fixes*
