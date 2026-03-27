# Workflow: Contract-First Feature Build (v2)

> Mandatory 5-phase workflow for any feature touching 2+ files or crossing a process boundary. v2 adds executable contracts, contract linting, test-from-contract scaffolding, and IPC runtime validation.

## What Changed in v2

| Improvement | What | Why |
|---|---|---|
| **Executable Contracts** | Architect produces `.contract.ts` alongside markdown | Phase 2 agents import real types instead of copy-pasting from prose — TSC enforces alignment |
| **Phase 1.5 — Contract Lint** | New gate between architect and implementation | Catches incomplete contracts before they cascade to 4 parallel agents |
| **Test-from-Contract** | Test writer generates scaffolds from `testBoundaries` | TDD's "red phase" without manual test authoring — edge cases guaranteed by contract |
| **IPC Runtime Validation** | Zod schemas at the preload bridge | Design by Contract (Meyer) at the highest-risk seam — catches serialization drift TSC can't see |

## When This Workflow Applies

- Any feature request that touches 2+ source files
- Any change crossing the electron/preload/renderer boundary
- Any new IPC channel, store slice, or MCP tool
- Any phase implementation from the roadmap

Single-file bug fixes and cosmetic changes are exempt.

---

## Phase 1: Contract Design (Sequential — flint-architect)

The architect reads all affected files and produces TWO artifacts. No code is written in this phase.

### Artifact 1: Contract Markdown

Human-readable specification at `.flint-context/contracts/<feature-name>.md`:

```markdown
# Contract: <Feature Name>

## Impact Map
| File | Change Type | Owner Agent |
|------|------------|-------------|
| electron/main.ts | MODIFY — Add IPC handler `flint:new-channel` | flint-electron-ipc |
| electron/preload.ts | MODIFY — Expose `newChannel` on flintAPI | flint-electron-ipc |
| src/store/editorStore.ts | MODIFY — Add `newSlice` state + action | flint-state-architect |
| src/components/ui/NewPanel.tsx | CREATE — render newSlice | flint-design-engineer |

## Type Contracts (binding specification — see .contract.ts)

All TypeScript interfaces are defined in the companion `.contract.ts` file.
Phase 2 agents MUST import types from there, not duplicate them.

## IPC Channels
| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `flint:new-channel` | renderer→main | `NewChannelPayload` | `{ success: boolean }` |

## Store Contracts
| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| editorStore | `newSlice: NewSlice` | `addItem(p: NewChannelPayload)` | `getItems()` |

## Component Contracts
| Component | Props | Consumes Store | Emits IPC |
|-----------|-------|---------------|-----------|
| NewPanel | `{ visible: boolean }` | editorStore.newSlice | flint:new-channel |

## Commandment Checklist
- [ ] C1 Code is Truth — mutations save to .tsx via AST
- [ ] C4 Local-First Only — no external URLs
- [ ] C12 Atomic Queuing — saves via FileTransactionManager
- [ ] (list only applicable commandments)

## Test Boundaries
(Mirrored from .contract.ts — see testBoundaries array)

## Implementation Order
Group A (parallel): flint-electron-ipc, flint-state-architect
Group B (after A):  flint-test-writer (scaffolds → full tests), flint-design-engineer
Group C (after B):  flint-code-reviewer

## Risks
| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| ... | ... | ... | ... |

## Non-Goals
- (What this feature explicitly does NOT do)
```

### Artifact 2: Executable Contract

Machine-readable TypeScript at `.flint-context/contracts/<feature-name>.contract.ts`:

```typescript
import type { FlintContract } from '../../shared/contract-schema';

// ─── Type Contracts (Phase 2 agents import these) ───────────────

export interface NewChannelPayload {
  id: string;
  data: SomeType;
}

export interface NewSlice {
  items: NewChannelPayload[];
  loading: boolean;
}

// ─── IPC Zod Schemas (for runtime validation) ───────────────────
//
// If this feature adds IPC channels, define their Zod schemas here.
// After Phase 2, these get merged into shared/ipc-validators.ts.

// import { z } from 'zod';
// export const newChannelPayloadSchema = z.object({ ... });

// ─── Machine-Readable Contract ──────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'NewFeature',
    phase: 'X.1',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-03-27',
  },
  impact: [
    { file: 'electron/main.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Add IPC handler' },
    { file: 'src/store/editorStore.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'Add newSlice' },
    { file: 'src/components/ui/NewPanel.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Render newSlice' },
  ],
  ipc: [
    { channel: 'flint:new-channel', direction: 'renderer→main', payloadType: 'NewChannelPayload', returnType: '{ success: boolean }', handler: 'electron/main.ts' },
  ],
  stores: [
    { store: 'editorStore', newState: { newSlice: 'NewSlice' }, newActions: { addItem: '(p: NewChannelPayload) => void' }, newSelectors: { getItems: '() => NewChannelPayload[]' } },
  ],
  components: [
    { name: 'NewPanel', file: 'src/components/ui/NewPanel.tsx', propsType: 'NewPanelProps', consumesStores: ['editorStore'], emitsIPC: ['flint:new-channel'] },
  ],
  commandments: [1, 4, 12],
  testBoundaries: [
    {
      target: 'flint:new-channel handler',
      kind: 'ipc-handler',
      behavior: 'Accepts NewChannelPayload and persists item',
      assertion: 'returns { success: true }',
      edgeCases: ['empty payload', 'duplicate id', 'missing required field'],
    },
    {
      target: 'editorStore.addItem',
      kind: 'store-action',
      behavior: 'Adds item to newSlice.items array',
      assertion: 'getItems() includes the new item',
      edgeCases: ['adding to empty array', 'duplicate item'],
    },
    {
      target: 'NewPanel',
      kind: 'component',
      behavior: 'Renders item list from editorStore.newSlice',
      assertion: 'renders one <li> per item',
      edgeCases: ['empty items array', 'visible=false hides panel'],
    },
  ],
  risks: [
    { risk: 'IPC payload too large for frequent updates', severity: 'medium', commandment: 12, mitigation: 'Debounce at 200ms' },
  ],
  parallelismGroups: {
    A: ['flint-electron-ipc', 'flint-state-architect'],
    B: ['flint-design-engineer', 'flint-test-writer'],
  },
  nonGoals: ['Real-time sync', 'Undo support for this feature'],
};
```

### Phase 1 Completion Gate

The contract is complete when:
- [ ] Every affected file is listed with its owner agent
- [ ] All cross-boundary types are defined as TypeScript interfaces in `.contract.ts`
- [ ] `.contract.ts` compiles: `npx tsc --noEmit .flint-context/contracts/<name>.contract.ts`
- [ ] IPC channels have explicit direction, payload, and return types
- [ ] Store changes have explicit state shape, actions, and selectors
- [ ] Component props and store dependencies are declared
- [ ] `testBoundaries` covers every new public API with edge cases
- [ ] Applicable Commandments are checked
- [ ] Implementation order accounts for dependencies
- [ ] Zod schemas defined for any new IPC channels

**Do not proceed to Phase 1.5 until the contract is reviewed.**

---

## Phase 1.5: Contract Lint (Sequential — flint-contract-linter)

**NEW in v2.** Catches architect mistakes before they cascade to parallel agents.

Spawn `flint-contract-linter` with the contract path. It validates:

| Check | What It Catches |
|---|---|
| Compiles | Type errors in `.contract.ts` |
| Completeness | Missing required sections |
| Impact Map | References to files that don't exist, CREATE on existing files |
| IPC Triangles | Missing legs of the handler/preload/renderer triangle |
| Store Coherence | Store doesn't exist, cross-store references |
| Test Boundaries | New APIs without test coverage plan |
| Commandments | Missing applicable commandments, irrelevant ones listed |
| Parallelism Safety | Two agents in same group touching same file |
| MD ↔ TS Consistency | Markdown and `.contract.ts` disagree |

### Phase 1.5 Output

Report at `.flint-context/contracts/<name>-lint.md` with verdict:
- **APPROVED** → proceed to Phase 2
- **REVISE** → return to flint-architect with specific issues

If REVISE: architect fixes both markdown and `.contract.ts`, then re-lint. Repeat until APPROVED.

---

## Phase 2: Parallel Implementation (Parallel — specialist agents)

Spawn the specialist agents listed in the contract's Impact Map. Each agent receives:
1. The full contract artifact (read from `.flint-context/contracts/<feature-name>.md`)
2. Its assigned files from the Impact Map
3. **Import path for types**: `import type { ... } from '../../.flint-context/contracts/<name>.contract'`

### Agent Instructions Template

When spawning each Phase 2 agent, include this preamble:

```
You are implementing against a pre-defined contract. Read the contract at:
.flint-context/contracts/<feature-name>.md

Your assigned files: [list from Impact Map]

RULES:
- Import types from .flint-context/contracts/<feature-name>.contract.ts — do NOT duplicate type definitions.
- Implement EXACTLY the interfaces defined in the contract. Do not deviate.
- If the contract is wrong or incomplete, STOP and report the gap. Do not improvise.
- If your feature adds IPC channels, add Zod schemas to shared/ipc-validators.ts matching the contract.
- Run type-check (npx tsc --noEmit) on your changes before reporting done.
- Write tests for all new code. Run the full test suite and report exact pass/fail counts.
- Report results in the format: [Package]: X/Y passing (Z new)
```

### Parallelism Rules

Agents that share no files can run in parallel. The implementation order in the contract defines which groups can be parallelized:

```
Group A (parallel):  flint-electron-ipc (IPC channels + Zod schemas in shared/ipc-validators.ts)
                     flint-state-architect (store slices — imports contract types)
                     flint-test-writer (test SCAFFOLDS from testBoundaries — it.todo() stubs)

Group B (parallel, after A):  flint-design-engineer (UI — needs store + IPC to exist)
                              flint-test-writer (fills in scaffolds with real assertions)

Group C (after B):  flint-code-reviewer (review all changes)
```

**Key change in v2**: `flint-test-writer` runs in TWO groups:
- **Group A**: Generates test scaffolds from `testBoundaries` using `it.todo()` — these compile but don't pass yet
- **Group B**: Fills in scaffolds with real assertions now that implementation exists — all tests must pass

### Phase 2 Completion Gate

Each agent reports:
- [ ] Files modified/created
- [ ] Type-check passes (`npx tsc --noEmit`)
- [ ] Test suite passes (with exact counts)
- [ ] Any contract gaps discovered (triggers a Phase 1 revision)

If any agent reports a contract gap, return to Phase 1 for a targeted revision, then re-run only the affected Phase 2 agents.

---

## Phase 2.5: Review Gate (Sequential — /review)

**Run `/review` on all changes before committing.** This gate is mandatory for all agent-produced code.

The review catches issues that TSC and tests miss:
- Commandment violations
- IPC security gaps
- Architectural anti-patterns
- Missing test coverage
- Scope creep beyond the contract

Code that fails review must be fixed before proceeding.

---

## Phase 3: Integration Validation (Sequential — flint-integration-validator)

After all Phase 2 agents complete and review passes, spawn `flint-integration-validator` with the contract artifact, the executable contract, and the list of all modified files.

### Validation Checks

1. **Type Coherence** — `npx tsc --noEmit` passes across the full project
2. **IPC Symmetry** — every `ipcMain.handle` has a matching `contextBridge.exposeInMainWorld` entry and a matching `window.flintAPI` call in the renderer
3. **Store Isolation** — no store imports another store; no store calls `window.flintAPI`
4. **Contract Fidelity** — every interface in `.contract.ts` is imported and used in implementation; no `it.todo()` remains in tests; no phantom types
5. **Commandment Compliance** — re-check the commandments listed in the contract against actual code
6. **Test Coverage** — every `testBoundary` has a corresponding test with real assertions and edge cases
7. **Process Boundary** — no `fs`, `path`, or Node.js imports in `src/`
8. **Import Hygiene** — no circular imports, no unused imports, no unjustified `// @ts-ignore`
9. **IPC Validation** — new IPC channels have Zod schemas in `shared/ipc-validators.ts` *(new in v2)*

### Phase 3 Output

```markdown
# Integration Report: <Feature Name>

## Status: PASS | FAIL

| Check | Result | Details |
|-------|--------|---------|
| Type Check | PASS/FAIL | (error count or clean) |
| IPC Symmetry | PASS/FAIL | (missing legs) |
| Store Isolation | PASS/FAIL | (violations) |
| Contract Fidelity | PASS/FAIL | (deviations, remaining it.todo count) |
| Commandment Compliance | PASS/FAIL | (violations) |
| Test Coverage | X/Y boundaries covered | (uncovered items) |
| Process Boundary | PASS/FAIL | (violations) |
| Import Hygiene | PASS/FAIL | (issues) |
| IPC Validation | PASS/FAIL | (channels missing Zod schemas) |

## Issues Found
1. **[BLOCKING]** description — file:line — fix: (what to do)
2. **[WARNING]** description — file:line — fix: (what to do)

## Verdict: SHIP | FIX | REDESIGN

### If FIX:
| Issue # | Assigned Agent | Fix Description |
|---------|---------------|----------------|
| 1 | flint-electron-ipc | Add missing Zod schema for channel X |
| 2 | flint-test-writer | Fill in remaining it.todo() for boundary Y |

### If REDESIGN:
(Explain what's fundamentally wrong with the contract and what Phase 1 needs to reconsider)
```

If verdict is FIX: re-spawn only the affected Phase 2 agents with specific fix instructions, then re-run Phase 3.
If verdict is REDESIGN: return to Phase 1 with the validator's findings.

---

## Git Ceremonies (flint-git-guru)

Git operations are handled by `flint-git-guru` at each phase boundary. Invoke it automatically at these points:

| Moment | Git Ceremony |
|--------|-------------|
| **Before Phase 1** | Create feature branch: `feat/<phase>-<description>` from main |
| **After Phase 1** | Commit contract: `docs(<phase>): add contract for <feature>` |
| **After Phase 1.5 APPROVED** | Commit lint report: `docs(<phase>): contract lint passed` |
| **After each Phase 2 agent** | Commit agent's changes: `feat(<scope>): implement <what> per contract` |
| **After Phase 2.5 review** | Fix any review issues, then commit |
| **After Phase 3 SHIP** | Run pre-commit gate (TSC + tests), then create PR |
| **After Phase 3 FIX** | Commit fixes, re-validate, then create PR |
| **After PR merge** | Delete feature branch, pull main |

The git guru handles branch naming, commit message formatting, pre-commit validation, PR body generation (from the contract artifact + validation report), and cleanup. It never force-pushes or amends without confirmation.

---

## Quick Reference

```
Feature Request
     │
     ▼
GIT:      flint-git-guru → create feature branch
     │
     ▼
Phase 1:  flint-architect → Contract Artifact (.md) + Executable Contract (.contract.ts)
     │
     ▼
GIT:      flint-git-guru → commit contract artifacts
     │
     ▼
Phase 1.5: flint-contract-linter → Lint Report (APPROVED / REVISE)
     │                                    │
     │                              REVISE → back to Phase 1
     ▼
Phase 2:  Parallel specialist agents implement against contract
     │    Group A: IPC + Store + Test Scaffolds (it.todo)
     │    Group B: UI + Full Tests (it.todo → real assertions)
     │    Group C: Code Review
     ▼
Phase 2.5: /review → Pre-commit code review gate
     │
     ▼
GIT:      flint-git-guru → commit per agent, run pre-commit gate
     │
     ▼
Phase 3:  flint-integration-validator → Integration Report
     │
     ├── SHIP → flint-git-guru → create PR → Done
     ├── FIX → Re-run affected Phase 2 agents → Phase 3
     └── REDESIGN → Phase 1 revision → Phase 1.5 → Phase 2 → Phase 3
```

---

## Process Improvements Log

| Version | Date | What Changed |
|---|---|---|
| v1 | 2026-02 | Original 3-phase workflow |
| v2 | 2026-03-27 | Executable contracts, Phase 1.5 lint, test-from-contract, IPC runtime validation, Phase 2.5 review |
