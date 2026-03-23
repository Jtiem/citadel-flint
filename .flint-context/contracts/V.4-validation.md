# Integration Report: V.4 Multi-Agent Epistemic Consensus Gate

## Status: FIX

| Check | Result | Details |
|-------|--------|---------|
| Type Check | PASS | TSC: 0 errors |
| IPC Symmetry | PASS | No new IPC channel needed; consensus data flows via existing `ai:onChunk` and MCP tool calls |
| Store Isolation | PASS | No new store files; V.4 did not introduce store-to-store imports |
| Contract Fidelity | FAIL | 4 deviations found (1 blocking, 3 warnings) |
| Commandment Compliance | PASS | C9 (Process Boundary), C12 (Atomic Queuing), C14 (Bypass Prohibition) all satisfied |
| Test Coverage | 7/7 | All public functions and query methods tested with meaningful assertions |
| Process Boundary | PASS | No `electron/` imports in `src/`; no `fs`/`path`/`child_process` in renderer |
| Import Hygiene | PASS | No `@ts-ignore`, no unused imports, no circular imports introduced |

---

## Issues Found

### 1. [BLOCKING] Database path mismatch -- consensus writes and reads target different SQLite files

**What:**
- `electron/consensusGateService.ts` writes to `db` imported from `electron/store.ts`, which opens `~/Library/Application Support/flint-ide/flint.db` (the Electron app's userData directory).
- `flint-mcp/src/server.ts` creates a `ConsensusQueryService` backed by `<projectRoot>/.flint/consensus.db` (line 219: `path.join(dbDir, "consensus.db")`).

These are two completely different files. The MCP tool `flint_consensus_report` will **never see any records** written by the consensus gate, because the gate writes to the Electron app database while the MCP query service reads from a per-project file.

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/consensusGateService.ts` -- line 17: `import db from './store.js'`
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/store.ts` -- line 21: `const DB_PATH = path.join(app.getPath('userData'), 'flint.db')`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/server.ts` -- line 219: `const db = new BetterSqlite3(path.join(dbDir, "consensus.db"))`

**Fix:** The `getConsensusQueryService()` in `flint-mcp/src/server.ts` must open the same database file that `electron/store.ts` uses. The cleanest fix is to point the MCP service at the Electron userData path (`flint.db`), OR pass the actual database path as a config parameter. This follows the same pattern as the governance_events and mutations_ledger tables which live in the main `flint.db`. The MCP server needs to resolve the Electron userData path, or the consensus gate needs to write to `<projectRoot>/.flint/consensus.db` instead of `flint.db`. Either direction works, but they must agree.

---

### 2. [WARNING] Contract deviation: `ConsensusGateResult.record` vs `recordId`

**What:** The contract (Section 2.2) specifies `ConsensusGateResult` with `record: ConsensusRecord` (the full persisted record). The implementation returns `recordId: string` instead. This is a simplification that works in practice -- the orchestrator only uses `outcome`, `secondaryVerdict`, and `proceed` from the result. However, it deviates from the contract signature.

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/contracts/V.4-contract.md` -- line 162
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/consensusGateService.ts` -- line 50

**Fix:** Either update the contract to match the implementation (preferred, since `recordId` is sufficient) or update the implementation to return the full record.

---

### 3. [WARNING] Contract deviation: `shouldFireGate` signature change

**What:** The contract specifies `shouldFireGate(mrs: MRSAssessment, config: ConsensusConfig): boolean`. The implementation takes `shouldFireGate(mrsTier: string, config: ConsensusConfig): boolean` -- a simpler signature that accepts only the tier string. The orchestrator calls it as `shouldFireGate(mrs.tier, consensusConfig)`, which works correctly. This avoids importing `MRSAssessment` and breaking the circular dependency the contract flagged as a risk.

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/consensusGateService.ts` -- line 128
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/contracts/V.4-contract.md` -- line 480

**Fix:** Update the contract to reflect the simplified signature. The implementation's approach is actually better -- it avoids the circular import risk the contract itself identified.

---

### 4. [WARNING] Contract deviation: `ConsensusGateInput.includePrimaryReasoning` field omitted

**What:** The contract specifies `includePrimaryReasoning: false` as a field in `ConsensusGateInput` (a type-level enforcement that the primary's reasoning is never passed). The implementation omits this field entirely. The epistemic independence guarantee is still satisfied -- the secondary agent prompt is built from scratch in `buildSystemPrompt()` and the user message only includes the AST snapshot, tool name/input, and MRS assessment. No primary reasoning is passed. The omission of the field is a reasonable simplification since a constant `false` field provides no runtime value.

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/consensusGateService.ts` -- lines 32-44
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/contracts/V.4-contract.md` -- line 144

**Fix:** No code change needed. Update the contract to remove the redundant field.

---

### 5. [WARNING] Model name deviation from contract

**What:** The contract specifies `'claude-3-5-haiku-20241022'` as the default secondary model. The implementation uses `'claude-haiku-4-5-20251001'`. This is likely an intentional update to a newer model identifier, but it deviates from the contract.

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/consensusGateService.ts` -- lines 63-75
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/contracts/V.4-contract.md` -- lines 451-457

**Fix:** Update the contract to reflect the actual model name. The newer model identifier is the correct one to use.

---

### 6. [WARNING] DiffCard missing `error`/`skipped` consensus badge

**What:** The contract (Section 9.1) specifies that `error`/`skipped` outcomes should render a zinc "Consensus: Unavailable" badge. The `ConsensusBadge` component returns `null` for any outcome other than `disagree`, `agree_reject`, and `agree_approve`. This means `error` and `skipped` outcomes render nothing. In practice this is acceptable because the orchestrator only passes `consensusOutcome` to the chunk when the gate actually fired, and `error`/`skipped` outcomes proceed normally without visual indication. However, it deviates from the contract specification.

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/DiffCard.tsx` -- lines 278-328
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/contracts/V.4-contract.md` -- lines 630-632

**Fix:** Add an `error`/`skipped` branch to `ConsensusBadge` that renders a zinc "Consensus: Unavailable" badge, or update the contract to specify that these outcomes render nothing (since the gate is advisory and should not alarm the user).

---

## Additional Observations (Not Issues)

1. **Pre-existing test failure:** `src/components/__tests__/AppMountGate.test.tsx` has 8 failing tests. These failures are NOT related to V.4 -- the file contains no consensus-related code. This is a pre-existing issue.

2. **Pre-existing store isolation violations:** Multiple stores (`orchestratorStore`, `tokenStore`, `canvasStore`, `editorStore`, `componentCardStore`, `annotationStore`, `governanceStore`, `assetStore`) call `window.flintAPI` directly. This is a known pre-existing pattern, not introduced by V.4. V.4 did not add any new store files or modify any stores.

3. **DiffBlock `key={i}` usage:** `DiffCard.tsx` line 261 uses `key={i}` (array index) for diff lines. This is acceptable because diff lines are not reorderable or dynamically inserted -- they are a static derived list.

4. **`agree_reject` dead path:** Per the contract (Section 8.2), the primary verdict is always `approve` (the AI proposed the mutation), so `agree_reject` can never be reached in V.4. However, both the gate service and the orchestrator handle it defensively. This is good forward-looking design for future multi-evaluator extensions.

---

## Test Results

| Suite | Result |
|-------|--------|
| MCP | 2165/2165 passing |
| Core/Electron | 1002/1002 passing |
| Glass | 975/983 passing (8 pre-existing failures in AppMountGate.test.tsx, unrelated to V.4) |
| TSC | 0 errors |

---

## Verdict: FIX

### Fix Assignments

| Issue # | Severity | Assigned Agent | Fix Description |
|---------|----------|---------------|----------------|
| 1 | BLOCKING | `flint-ast-surgeon` | Fix `getConsensusQueryService()` in `flint-mcp/src/server.ts` to open the same database that `electron/store.ts` uses (the Electron userData `flint.db`), OR change `consensusGateService.ts` to write to `<projectRoot>/.flint/consensus.db`. Both sides must agree on the same file path. The simplest fix: change line 219 of `server.ts` from `path.join(dbDir, "consensus.db")` to open the Electron app userData database path. Alternatively, if the MCP server cannot resolve `app.getPath('userData')`, change the consensus gate to write to a per-project `.flint/consensus.db` file (matching the existing pattern used by `provenance.db`, `anomalies.db`, etc.). |
| 6 | LOW | `flint-design-engineer` | Add `error`/`skipped` case to `ConsensusBadge` in `DiffCard.tsx` rendering a zinc badge, OR update the contract to specify no badge for these outcomes. |

Issues 2-5 are contract documentation updates only (no code changes needed). They should be applied to the contract by the architect but do not block shipping.
