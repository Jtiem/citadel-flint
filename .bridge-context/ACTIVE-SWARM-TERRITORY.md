# Active Swarm Territory Map

**Purpose:** Prevents concurrent swarms from creating merge conflicts by claiming file ownership.
**Protocol:** Before editing any file, check this map. If it's claimed, coordinate or wait.

---

## How to use this map

1. **Before starting a new swarm:** Read this file
2. **If your swarm needs a file in the MODIFY list:** Either wait for ACX to finish, or coordinate by adding your changes to a separate section of the file (e.g., append new IPC handlers, don't restructure existing ones)
3. **If your swarm creates new files:** Add them to this map under your own swarm section
4. **When a swarm completes:** Remove its section from this file

---

## Template for new swarm entry

```markdown
## Swarm: Phase [NAME]

**Status:** [CONTRACTS APPROVED / IN PROGRESS / COMPLETE]

### Files to CREATE
| File | Purpose |

### Files to MODIFY
| File | What changes |
```

---

## Swarm: V.1-rs — Risk Scoring (MRS)

**Status:** COMPLETE (2026-03-16)

### Files to CREATE
| File | Purpose |
|------|---------|
| `bridge-mcp/src/core/governance/riskScoringService.ts` | Risk score calculation per mutation |
| `bridge-mcp/src/core/governance/riskScoringService.test.ts` | Unit tests |
| `bridge-mcp/src/__tests__/riskScoring.test.ts` | Integration tests |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `bridge-mcp/src/core/governance/mutationProvenanceService.ts` | Read provenance for risk input (read-only) |
| `bridge-mcp/src/core/governance/types.ts` | Add RiskScore, RiskFactor types |

### Files NOT touched (avoid conflicts)
- `bridge-mcp/src/server.ts` — CX.2 owns registration. V.1-rs tool registration deferred until CX.2 clears.
- `electron/*` — SEC swarm territory

---

## Swarm: CX.2 — bridge_plan Orchestration Tool

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
|------|---------|
| `.bridge-context/contracts/CX2-BridgePlan.md` | Architecture contract |
| `bridge-mcp/src/core/planService.ts` | Intent → execution plan logic |
| `bridge-mcp/src/tools/plan.ts` | MCP tool handler |
| `bridge-mcp/src/__tests__/planService.test.ts` | Unit tests |
| `bridge-mcp/src/__tests__/plan.tool.test.ts` | Tool handler tests |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `bridge-mcp/src/server.ts` | Register `bridge_plan` tool ⚠️ DEFERRED — wait for ING.3 to clear |

---


## Swarm: ING.3 + V.2-mp (Feature completion sprint)

**Status:** COMPLETE (2026-03-16) — ING.3 + V.2-mp both shipped

### Files CREATED (V.2-mp — done)

| File | Purpose | Phase |
|------|---------|-------|
| `bridge-mcp/src/core/governance/mutationProvenanceService.ts` | Mutation provenance tracking + query | V.2-mp DONE |
| `bridge-mcp/src/__tests__/mutationProvenance.test.ts` | 41 provenance service tests | V.2-mp DONE |

### Files MODIFIED (V.2-mp — done)

| File | What changed | Phase |
|------|-------------|-------|
| `bridge-mcp/src/core/governance/types.ts` | Added ProvenanceSource, MutationProvenance, ProvenanceSummary, AuditTrailEntry types | V.2-mp DONE |
| `bridge-mcp/src/server.ts` | Imported MutationProvenanceService + BetterSqlite3; lazy singleton helper; bridge_mutation_provenance tool registered; provenance wired in bridge_ast_mutate + bridge_fix handlers | V.2-mp DONE |

### Files still to CREATE (ING.3 — in progress)

| File | Purpose | Phase |
|------|---------|-------|
| `bridge-mcp/src/__tests__/healOnAudit.test.ts` | MCP healOnAudit integration tests | ING.3 |

### Files still to MODIFY (ING.3 — in progress)

| File | What changes | Phase |
|------|-------------|-------|
| `bridge-mcp/src/tools/audit.ts` | Add `healOnAudit` optional parameter to `bridge_audit` tool | ING.3 |
| `bridge-mcp/src/server.ts` | Register updated audit tool schema with healOnAudit param | ING.3 |
| `electron/main.ts` | Wire real AST surgery for `import:snap-to-token` IPC (append to existing handler) | ING.3 |
