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

## Swarm: Sprint 3 — AGV.1 + V.1 Orchestrator Wiring

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
|------|---------|
| `electron/agentPolicy.ts` | AGV.1: Per-agent ACL registry + permission checks |
| `electron/__tests__/agentPolicy.test.ts` | AGV.1 tests |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `electron/mcp-policy.ts` | AGV.1: Extend allowlist to per-agent model |
| `electron/orchestrator.ts` | V.1: Wire MRS Green/Amber/Red tiers into mutation approval flow |

### Files NOT touched
- `bridge-mcp/src/server.ts` — CX.3 territory
- `bridge-mcp/src/tools/*` — CX.3 territory

---

## Swarm: CX.3 — Error Taxonomy + Rule Explanations

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
|------|---------|
| `bridge-mcp/src/core/errorCodes.ts` | Structured error codes, descriptions, recovery instructions |
| `bridge-mcp/src/__tests__/errorCodes.test.ts` | Error taxonomy tests |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `bridge-mcp/src/core/MithrilLinter.ts` | Add `explanation` field to each rule |
| `bridge-mcp/src/core/A11yLinter.ts` | Add `explanation` field to each rule |
| `bridge-mcp/src/tools/audit.ts` | Surface `explanation` in violation output; use error taxonomy on failures |
| `bridge-mcp/src/server.ts` | Use error taxonomy on tool-level failures |
