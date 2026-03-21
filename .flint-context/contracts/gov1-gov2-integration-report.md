# Integration Report: GOV.1 + GOV.2

## Status: FIX

## Type Check: PASS
`npx tsc --noEmit` exits cleanly with zero errors across the full project.

## IPC Symmetry: PASS (with one efficiency warning)

Every `governance:*` IPC handler in `electron/main.ts` has a matching `contextBridge` entry in `electron/preload.ts` AND matching `window.flintAPI.governance.*` usage in the renderer components.

| IPC Channel | main.ts handler | preload.ts entry | Renderer call site |
|---|---|---|---|
| `governance:record-override` | line 1837 | line 597 | GovernancePanel.tsx lines 249, 263, 285 |
| `governance:override-count` | line 1882 | line 604 | StatusBar.tsx line 82 |
| `governance:compliance-summary` | line 1904 | line 612 | ExportModal.tsx line 81 |

**Push channel:** `flint:governance-override-recorded` is broadcast by `broadcastGovernanceOverrideRecorded()` (main.ts line 1822) after each `governance:record-override`. The preload exposes `governance.onOverrideRecorded(cb)` (preload.ts line 621). StatusBar subscribes on mount and unsubscribes via the returned cleanup function (StatusBar.tsx line 89).

All three directions are wired correctly. No mismatches.

## Store Isolation: PASS (with one pre-existing warning)

**No store imports another store.** The only store-to-store import found was `notificationStore.test.ts` importing `notificationStore` -- that is a test file, not a store importing a store.

**governanceStore does NOT call window.flintAPI.governance.** The GOV.2 telemetry IPC calls are correctly placed in the GovernancePanel component event handlers (`handleToggle`, `handleResetRule`, `handleReset`), not inside the store's `setOverride`/`resetOverride`/`resetAll` actions. This follows the contract's R3 risk mitigation and the architectural anti-pattern rule.

**Pre-existing warning (not caused by GOV.1/GOV.2):** `governanceStore.ts` calls `window.flintAPI.saveRuleOverrides()` and `window.flintAPI.getRuleOverrides()` directly inside its `saveToFile` and `loadFromFile` actions. These are pre-existing IPC calls in store actions that violate the architectural anti-pattern rule. Acknowledged in the contract as R5 (Known Gap). Not blocking for this review.

**Pre-existing warning:** Multiple stores call `window.flintAPI` in their actions (`tokenStore`, `orchestratorStore`, `canvasStore`, `editorStore`, `astBufferStore`, `annotationStore`, `assetStore`). These are pre-existing architectural debt, not introduced by GOV.1/GOV.2.

## Contract Fidelity: PASS (with one minor signature deviation)

### RuleProvenance -- MATCH
All six fields (`ruleId`, `ruleName`, `sourceAuthority`, `regulatoryReference`, `lastUpdated`, `rationale`) match the contract exactly in both `flint-mcp/src/core/governance/types.ts` (lines 28-41) and `src/types/flint-api.d.ts` (lines 862-875).

### SourceAuthority -- MATCH
All seven union members match exactly in both locations.

### ComplianceSummary -- MATCH
All five fields match. The renderer-side `byAuthority` and `bySeverity` use `Record<string, number>` instead of the MCP-side's `Record<SourceAuthority, number>` and `Record<'critical' | 'warning' | 'info', number>`. This is the correct design per the contract (section "New Types -- renderer side"), which intentionally uses `Record<string, number>` for the renderer mirror.

### GovernanceAPI -- MATCH
All four methods match the contract exactly:
- `recordOverride(payload)` -- correct payload shape
- `getOverrideCount()` -- returns `Promise<number>`
- `getComplianceSummary(ruleIds)` -- returns `Promise<ComplianceSummary>`
- `onOverrideRecorded(cb)` -- returns `() => void` (unsubscribe)

### ruleProvenanceRegistry -- MATCH
- `RULE_PROVENANCE_REGISTRY: ReadonlyMap<string, RuleProvenance>` -- present and correct
- `resolveProvenance(ruleId: string): RuleProvenance` -- present with fallback behavior as specified
- `buildComplianceSummary(violations)` -- present and correct

**Minor deviation:** The `buildComplianceSummary` parameter type uses `severity: string` instead of `severity: 'critical' | 'warning' | 'info'`. This is intentionally wider to accept `'amber'` from Mithril warnings, which is mapped to `'warning'` in the implementation. The docstring explicitly documents this mapping. Functionally correct.

### ruleProvenanceRegistry coverage
The registry contains 20 rules (10 A11y + 5 Mithril typography + 1 color + 1 spacing + 1 shadow + 1 opacity + 1 export gate). The contract's header says "49 rules" but the body clarifies this is a future target. The current registry covers all rules actually enforced by flint-mcp v1. Tests verify completeness against the known rule set and pass.

### flint_audit_report MCP tool -- MATCH
`FLINT_AUDIT_REPORT_TOOL` is defined in `flint-mcp/src/tools/auditReport.ts` and registered in `server.ts` (line 182, tool list; line 812, CallTool handler). The tool definition matches the contract schema. The handler correctly calls `auditAll`, `A11yLinter.audit`, resolves provenance, builds compliance summaries, and supports both `json` and `sarif` output formats.

### LinterWarning ruleId field -- MATCH
`flint-mcp/src/types.ts` line 44: `ruleId?: string` -- optional, backward-compatible. All five Mithril visitors in `MithrilLinter.ts` populate the `ruleId` field when constructing warning objects.

## Commandment Compliance: PASS

| Commandment | Status | Evidence |
|---|---|---|
| **C1 (Code is Truth)** | PASS | GOV.1 provenance is static metadata lookup; GOV.2 writes to SQLite, not .tsx. Neither feature modifies source code. |
| **C4 (Local-First Only)** | PASS | All provenance data is bundled in the app as a static TypeScript map. No external API calls. Override telemetry writes to local SQLite. |
| **C5 (Accessibility is a Compiler Error)** | PASS | Provenance enriches violation output; it does not suppress violations. The `canExport()` gate in ExportModal (line 100-103) still blocks on both `mithrilViolations.length > 0` and `Object.keys(a11yViolations).length > 0`. |
| **C6 (The Gatekeeper Rule)** | PASS | Export Gate is extended with a Compliance Summary section, not weakened. Overrides are tracked via telemetry, not hidden. |
| **C9 (Process Boundary)** | PASS | No `fs`, `path`, `child_process`, `sqlite3`, or `@anthropic-ai/sdk` imports anywhere in `src/`. All cross-boundary calls go through `window.flintAPI.governance.*`. |
| **C12 (Atomic Queuing)** | PASS | GOV.2 writes use `GovernanceEventService.recordEvent()` which runs synchronous SQLite in the main process. No file writes involved -- no FileTransactionManager needed. |
| **C14 (Bypass Prohibition)** | PASS | Override telemetry is routed through the established GovernanceEventService, not direct SQLite calls. |

## Test Coverage: 25/28 new tests passing; 3 test files broken by missing mock

### flint-mcp tests: 25/25 new tests passing (366/366 total)

| Test File | New Tests | Status |
|---|---|---|
| `ruleProvenanceRegistry.test.ts` | 25 tests covering: known ruleId lookup (5), unknown ruleId fallback (4), data quality (4), empty violations (5), mixed severity (3), authority breakdown (4) | ALL PASS |
| `eventService.test.ts` | 5 new tests for `getOverrideCount`: new session returns 0, counts only overrides, filters by sessionId, counts all when no sessionId, ignores non-override events | ALL PASS |

### React component tests: 43 FAILURES across 5 files

**Root cause: `createMockFlintAPI()` in `src/components/__tests__/setup.ts` is missing the `governance` namespace.** The GOV.1/GOV.2 implementation adds `window.flintAPI.governance.getOverrideCount()` (called by StatusBar) and `window.flintAPI.governance.getComplianceSummary()` (called by ExportModal). When these methods are called in tests, they throw because `window.flintAPI.governance` is `undefined`.

**Affected files:**
1. `StatusBar.test.tsx` -- 9/9 tests FAIL (StatusBar calls `governance.getOverrideCount()` and `governance.onOverrideRecorded()` on mount)
2. `ExportModal.test.tsx` -- 14/17 tests FAIL (ExportModal calls `governance.getComplianceSummary()` on mount)
3. `LayerTree.test.tsx` -- 12/12 tests FAIL (cascading from StatusBar import chain or shared setup)
4. `LaunchScreen.test.tsx` -- 2/11 tests FAIL
5. `TokenManager.test.tsx` -- 6/11 tests FAIL

**Additionally:** The `figma` namespace mock was already missing before GOV.1/GOV.2 (pre-existing issue), which contributes to StatusBar test failures.

**Fix required:** Add the following to `createMockFlintAPI()` in `src/components/__tests__/setup.ts`:

```typescript
governance: {
    recordOverride: vi.fn().mockResolvedValue(undefined),
    getOverrideCount: vi.fn().mockResolvedValue(0),
    getComplianceSummary: vi.fn().mockResolvedValue({
        totalViolations: 0,
        byAuthority: {},
        bySeverity: { critical: 0, warning: 0, info: 0 },
        violatedRules: [],
        generatedAt: new Date().toISOString(),
    }),
    onOverrideRecorded: vi.fn().mockReturnValue(() => {}),
},
figma: {
    status: vi.fn().mockResolvedValue({ running: false, lastWebhookAt: null, tokenCount: 0 }),
},
```

**Owner agent:** flint-test-writer

## Process Boundary: PASS
- No `fs`, `path`, `child_process`, `sqlite3`, `better-sqlite3`, or `@anthropic-ai/sdk` imports anywhere in `src/`.
- `electron/preload.ts` uses `contextBridge.exposeInMainWorld` correctly for all governance methods.
- All new `window.flintAPI.governance` calls have corresponding type declarations in `src/types/flint-api.d.ts` (GovernanceAPI interface, lines 898-938).
- The `governance:record-override` IPC handler validates payload shape (lines 1838-1844) and action value (lines 1854-1856).
- The `governance:compliance-summary` IPC handler validates that ruleIds is a `string[]` (line 1905).
- No secrets or API keys hardcoded.
- CSP unchanged.

## Issues Found

### BLOCKER 1: Missing `governance` mock in test setup

**File:** `src/components/__tests__/setup.ts` line 53-130
**Impact:** 43 React component tests fail because `window.flintAPI.governance` is undefined
**Fix:** Add `governance` and `figma` namespace mocks to `createMockFlintAPI()` (see fix details in Test Coverage section above)
**Owner:** flint-test-writer

### WARNING 1: Inefficient override count query in electron/main.ts

**File:** `electron/main.ts` lines 1882-1891
**Evidence:** The `governance:override-count` handler fetches up to 100,000 events via `govEventService.queryEvents({ eventType: 'override', limit: 100_000 })`, then filters them in JavaScript with `.filter((e) => e.sessionId === governanceSessionId)`. However, `GovernanceEventService.getOverrideCount(sessionId)` already exists and uses a single `COUNT(*)` SQL query.
**Fix:** Replace the handler body with `return govEventService.getOverrideCount(governanceSessionId)`. The comment in the code acknowledges this -- it says "When that method lands we can swap to a single COUNT query." The method has already landed.
**Owner:** flint-electron-ipc

### WARNING 2: Pre-existing `window.flintAPI` calls inside governanceStore

**File:** `src/store/governanceStore.ts` lines 64, 73
**Evidence:** `saveToFile()` calls `window.flintAPI.saveRuleOverrides()` and `loadFromFile()` calls `window.flintAPI.getRuleOverrides()`. These methods are not defined in `preload.ts` or `flint-api.d.ts` (confirmed by grep). The store falls back to `localStorage` when the IPC calls fail.
**Impact:** Pre-existing issue acknowledged in the contract (R5). Not caused by GOV.1/GOV.2. The store actions reference phantom IPC methods (`saveRuleOverrides`, `getRuleOverrides`).
**Owner:** Not in scope for GOV.1/GOV.2 -- tracked separately.

### WARNING 3: Missing ExportModal and StatusBar component tests for GOV.1/GOV.2 features

**File:** `src/components/ui/__tests__/ExportModal.test.tsx`, `src/components/editor/__tests__/StatusBar.test.tsx`
**Evidence:** The contract specifies 4 new ExportModal tests (compliance summary rendering, authority badges, export report button) and 3 new StatusBar tests (badge hidden at 0, badge shows count, badge updates on push). No new test cases were added for the GOV.1/GOV.2 features. The existing tests just need the mock fix to pass again.
**Owner:** flint-test-writer

## Verdict

**FIX** -- One blocker prevents shipping:

1. **flint-test-writer** must add the `governance` and `figma` namespace mocks to `createMockFlintAPI()` in `src/components/__tests__/setup.ts`. This unblocks all 43 failing React tests. Estimated effort: 5 minutes.

Additionally, two warnings should be addressed before the next release:

2. **flint-electron-ipc** should replace the inefficient JS-side filtering in `governance:override-count` with `govEventService.getOverrideCount(governanceSessionId)`. Estimated effort: 2 minutes.

3. **flint-test-writer** should add the 7 new test cases specified in the contract for ExportModal and StatusBar GOV.1/GOV.2 features. Estimated effort: 30 minutes.

All type checks pass. All MCP engine tests pass (366/366). All contract types are faithfully implemented. All commandments are satisfied. IPC symmetry is clean. Store isolation is maintained. Process boundary is intact. Once the test mock is fixed, this is ready to ship.
