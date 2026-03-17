# Workflow: Contract-First Feature Build

> Mandatory 3-phase workflow for any feature touching 2+ files or crossing a process boundary. This replaces ad-hoc multi-file implementation with structured contract-first parallelism.

## When This Workflow Applies

- Any feature request that touches 2+ source files
- Any change crossing the electron/preload/renderer boundary
- Any new IPC channel, store slice, or MCP tool
- Any phase implementation from the roadmap

Single-file bug fixes and cosmetic changes are exempt.

## Phase 1: Contract Design (Sequential — bridge-architect)

The architect reads all affected files and produces a **Contract Artifact** at `.bridge-context/contracts/<feature-name>.md`. No code is written in this phase.

### Contract Artifact Format

```markdown
# Contract: <Feature Name>

## Impact Map
| File | Change Type | Owner Agent |
|------|------------|-------------|
| electron/main.ts | Add IPC handler `bridge:new-channel` | bridge-electron-ipc |
| electron/preload.ts | Expose `newChannel` on bridgeAPI | bridge-electron-ipc |
| src/store/editorStore.ts | Add `newSlice` state + action | bridge-state-architect |
| src/components/ui/NewPanel.tsx | NEW FILE — render newSlice | bridge-design-engineer |

## Type Contracts (the source of truth for Phase 2)

### New Types
\```typescript
// Shared between main and renderer via IPC
interface NewChannelPayload {
  id: string;
  data: SomeType;
}

// Store shape
interface NewSlice {
  items: NewChannelPayload[];
  loading: boolean;
}
\```

### IPC Channels
| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `bridge:new-channel` | renderer → main | `NewChannelPayload` | `{ success: boolean }` |
| `bridge:new-channel-update` | main → renderer | `NewChannelPayload[]` | void (broadcast) |

### Store Contracts
| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| editorStore | `newSlice: NewSlice` | `addItem(p: NewChannelPayload)` | `getItems()` |

### Component Contracts
| Component | Props | Consumes Store | Emits IPC |
|-----------|-------|---------------|-----------|
| NewPanel | `{ visible: boolean }` | editorStore.newSlice | bridge:new-channel |

## Commandment Checklist
- [ ] C1 Code is Truth — mutations save to .tsx via AST
- [ ] C4 Local-First Only — no external URLs
- [ ] C9 Process Boundary — no fs/sqlite in src/
- [ ] C12 Atomic Queuing — saves via FileTransactionManager
- [ ] (list only applicable commandments)

## Implementation Order
1. Types (can be done inline or in a shared types file)
2. IPC channels (bridge-electron-ipc)
3. Store slices (bridge-state-architect) — depends on types
4. UI components (bridge-design-engineer) — depends on store
5. Tests (bridge-test-writer) — parallel with UI

## Risks
- (Architect lists specific risks and which commandment they threaten)
```

### Phase 1 Completion Gate

The contract is complete when:
- [ ] Every affected file is listed with its owner agent
- [ ] All cross-boundary types are defined as TypeScript interfaces
- [ ] IPC channels have explicit direction, payload, and return types
- [ ] Store changes have explicit state shape, actions, and selectors
- [ ] Component props and store dependencies are declared
- [ ] Applicable Commandments are checked
- [ ] Implementation order accounts for dependencies

**Do not proceed to Phase 2 until the contract is reviewed.**

---

## Phase 2: Parallel Implementation (Parallel — specialist agents)

Spawn the specialist agents listed in the contract's Impact Map. Each agent receives:
1. The full contract artifact (read from `.bridge-context/contracts/<feature-name>.md`)
2. Its assigned files from the Impact Map
3. The Type Contracts section as the interface it must implement against

### Parallelism Rules

Agents that share no files can run in parallel. The implementation order in the contract defines which groups can be parallelized:

```
Group A (parallel):  bridge-electron-ipc (IPC channels)
                     bridge-state-architect (store slices — uses type contracts, no IPC dependency)

Group B (parallel, after A):  bridge-design-engineer (UI — needs store to exist)
                              bridge-test-writer (tests — can start with unit tests immediately)

Group C (after B):  bridge-code-reviewer (review all changes)
```

### Agent Instructions Template

When spawning each Phase 2 agent, include this preamble:

```
You are implementing against a pre-defined contract. Read the contract at:
.bridge-context/contracts/<feature-name>.md

Your assigned files: [list from Impact Map]
Your type contracts: [paste the relevant TypeScript interfaces]

RULES:
- Implement EXACTLY the interfaces defined in the contract. Do not deviate.
- If the contract is wrong or incomplete, STOP and report the gap. Do not improvise.
- Do not modify files outside your assignment.
- Run type-check (npx tsc --noEmit) on your changes before reporting done.
```

### Phase 2 Completion Gate

Each agent reports:
- [ ] Files modified/created
- [ ] Type-check passes (`npx tsc --noEmit`)
- [ ] Any contract gaps discovered (triggers a Phase 1 revision)

If any agent reports a contract gap, return to Phase 1 for a targeted revision, then re-run only the affected Phase 2 agents.

---

## Phase 3: Integration Validation (Sequential — bridge-integration-validator)

After all Phase 2 agents complete, spawn `bridge-integration-validator` with the contract artifact and the list of all modified files.

### Validation Checks

1. **Type Coherence** — `npx tsc --noEmit` passes across the full project
2. **IPC Symmetry** — every `ipcMain.handle` has a matching `contextBridge.exposeInMainWorld` entry and a matching `window.bridgeAPI` call in the renderer
3. **Store Isolation** — no store imports another store; no store calls `window.bridgeAPI`
4. **Contract Fidelity** — every interface in the contract is implemented; no phantom types or unused imports
5. **Commandment Compliance** — re-check the commandments listed in the contract against actual code
6. **Test Coverage** — every new public function/action has at least one test
7. **Process Boundary** — no `fs`, `path`, or Node.js imports in `src/`

### Phase 3 Output

```markdown
# Integration Report: <Feature Name>

## Status: PASS | FAIL

## Type Check: PASS | FAIL (with errors)
## IPC Symmetry: PASS | FAIL (list mismatches)
## Store Isolation: PASS | FAIL (list violations)
## Contract Fidelity: PASS | FAIL (list gaps)
## Commandment Compliance: PASS | FAIL (list violations)
## Test Coverage: X/Y public APIs covered
## Process Boundary: PASS | FAIL (list violations)

## Issues Found
1. (description + file:line + recommended fix)

## Verdict
- SHIP: All checks pass
- FIX: Issues found, list which Phase 2 agent should fix what
- REDESIGN: Contract was fundamentally wrong, return to Phase 1
```

If verdict is FIX: re-spawn only the affected Phase 2 agents with specific fix instructions, then re-run Phase 3.
If verdict is REDESIGN: return to Phase 1 with the validator's findings.

---

## Git Ceremonies (bridge-git-guru)

Git operations are handled by `bridge-git-guru` at each phase boundary. Invoke it automatically at these points:

| Moment | Git Ceremony |
|--------|-------------|
| **Before Phase 1** | Create feature branch: `feat/<phase>-<description>` from main |
| **After Phase 1** | Commit contract: `docs(<phase>): add contract for <feature>` |
| **After each Phase 2 agent** | Commit agent's changes: `feat(<scope>): implement <what> per contract` |
| **Before Phase 3** | Run `/review staged` or `/review HEAD~N..HEAD` — code review gate |
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
GIT:    bridge-git-guru → create feature branch
     │
     ▼
Phase 1: bridge-architect → Contract Artifact
     │                        (.bridge-context/contracts/)
     ▼
GIT:    bridge-git-guru → commit contract artifact
     │
     ▼
Phase 2: Parallel specialist agents implement against contract
     │   (bridge-electron-ipc, bridge-state-architect,
     │    bridge-design-engineer, bridge-test-writer)
     ▼
GIT:    bridge-git-guru → commit per agent, run pre-commit gate
     │
     ▼
Phase 3: bridge-integration-validator → Integration Report
     │
     ├── SHIP → bridge-git-guru → create PR → Done
     ├── FIX → Re-run affected Phase 2 agents → Phase 3
     └── REDESIGN → Phase 1 revision → Phase 2 → Phase 3
```
