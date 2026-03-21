# Workflow: Contract-First Feature Build

> Mandatory for any feature that touches 2+ files or crosses a module boundary.
> Single-file bug fixes and cosmetic changes are exempt from this workflow
> but are NOT exempt from the Session Start Protocol.

## Why Contract-First
When multiple agents implement a feature in parallel, they need a shared
specification to avoid diverging. The contract is that specification. It's
written before any code and serves as the binding definition of what "done"
means. If the contract is wrong, return to Phase 1 — do not patch around it.

---

## Phase 1: Contract

**Who:** The architect agent (or you, if working solo)

**Output:** A contract artifact saved to `.governance/contracts/[feature-name].md`

**Contract must define:**
- The feature's scope (what's in, what's explicitly out)
- All files that will be created or modified
- The module or process boundary each change crosses
- Public API surface: types, function signatures, IPC channel names
- Test requirements: what scenarios must be covered
- Any commandments that are particularly relevant

**Gate:** No one writes implementation code until the contract exists and is approved.

---

## Phase 2: Parallel Implementation

**Who:** Specialist agents, each assigned to non-overlapping files

**Rules:**
- Each agent implements exactly what the contract defines — no scope additions
- Each agent owns their declared files (from Session Start territory claim)
- If you discover the contract is wrong, stop and return to Phase 1
- Every agent runs TSC and their relevant test suite before handing off

**Handoff format per agent:**
```
Files modified: [list]
Tests written: [list]
Test result: [Package]: X/X passing (Y new)
TSC: 0 errors
Commandment notes: [any C-violations found or avoided]
```

---

## Phase 3: Integration Validation

**Who:** The reviewer agent (or you)

**Checks:**
- [ ] All contract requirements are satisfied
- [ ] No cross-file coherence gaps (types match, IPC symmetry, store isolation)
- [ ] All commandments checked
- [ ] Test suite passes: full count, zero regressions
- [ ] TSC: 0 errors
- [ ] HANDOFF.md updated

**Verdicts:**
- **SHIP** — all checks pass, proceed to commit
- **FIX** — specific issues found, return to Phase 2
- **REDESIGN** — architectural problem, return to Phase 1

---

## Git Ceremonies

At each phase boundary, commit the output:
- After Phase 1: commit the contract artifact
- After Phase 2: commit per agent with conventional commit messages
- After Phase 3 SHIP: create PR

Commit message format:
```
feat(scope): short description of what changed

Why: one sentence explaining the motivation
```

---

## Active Territory File Template

`.governance/ACTIVE-TERRITORY.md`:
```
# Active Development Territory

## [Agent] — [Date]
Files in scope: [list]
Phase: [1 / 2 / 3]
Goal: [one sentence]
```

Clear your entry when your phase is complete.
