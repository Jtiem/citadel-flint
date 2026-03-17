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

## Swarm: Sprint 4 — MDA.1 + AGV.3

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
|------|---------|
| `bridge-mcp/src/core/mithrilBaseline.ts` | MDA.1: Baseline snapshot + delta audit |
| `bridge-mcp/src/core/__tests__/mithrilBaseline.test.ts` | MDA.1 tests |
| `electron/agentEscalation.ts` | AGV.3: Auto-escalation rule engine |
| `electron/__tests__/agentEscalation.test.ts` | AGV.3 tests |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `electron/agentPolicy.ts` | AGV.3: Add escalation trigger after mutation risk check |
| `electron/orchestrator.ts` | AGV.3: Wire escalation check into approval flow |

### Files NOT touched
- `bridge-mcp/src/server.ts` — CX.3/GOV.1/GOV.2 territory
- `bridge-mcp/src/tools/*` — CX.3/GOV.1 territory

---

## Swarm: Sprint 3 — AGV.1 + V.1 Orchestrator Wiring

**Status:** COMPLETE (2026-03-16)

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

---

## Swarm: GOV.1 — Rule Provenance

**Status:** IN PROGRESS

### Files to MODIFY
| File | What changes |
|------|-------------|
| `bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts` | Add EXP.6a A11y rules (A11Y-011..073), add query functions (getProvenance, getAllProvenance, getByAuthority, getByCategory) |
| `bridge-mcp/src/core/governance/__tests__/ruleProvenanceRegistry.test.ts` | Expand tests for new rules + query functions |
| `bridge-mcp/src/core/governance/types.ts` | Add AuditReport type, add 'Section 508' to SourceAuthority |
| `bridge-mcp/src/tools/audit.ts` | Attach provenance metadata to each violation in bridge_audit results |
| `bridge-mcp/src/server.ts` | Attach provenance to audit_ui_component and bridge://violations resource |
| `bridge-mcp/src/tools/auditReport.ts` | Add sourceAuthority filter parameter |

### Coordination Note
- `server.ts` shared with CX.3 — GOV.1 adds provenance fields to violations (additive, no restructuring). No conflict with CX.3 explanation fields.
- `tools/audit.ts` shared with CX.3 — GOV.1 adds provenance fields to AuditResult violations. No conflict with CX.3 explanation fields.

---

## Swarm: GOV.2 — Override Telemetry

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
|------|---------|
| `bridge-mcp/src/core/governance/overrideTelemetryService.ts` | SQLite-backed override event recording + queries |
| `bridge-mcp/src/core/governance/__tests__/overrideTelemetryService.test.ts` | Full unit test suite |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `bridge-mcp/src/core/governance/types.ts` | Add `OverrideEvent`, `OverrideSummary` types |
| `bridge-mcp/src/server.ts` | Register `bridge_override_telemetry` tool + `bridge://overrides` resource + wire into audit/fix |

### Coordination Note
- `server.ts` shared with CX.3 — GOV.2 adds new tool/resource registrations (appended, not restructuring). No conflict.
