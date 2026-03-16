# Active Swarm Territory Map

**Purpose:** Prevents concurrent swarms from creating merge conflicts by claiming file ownership.
**Protocol:** Before editing any file, check this map. If it's claimed, coordinate or wait.

---

## Swarm: Phase ACX (Proactive Agent Context)

**Status:** CONTRACTS APPROVED — Implementation pending
**Contracts:** `.bridge-context/contracts/ACX-*.md` (3 files)

### Files to CREATE (exclusive to ACX)

| File | Phase | Purpose |
|------|-------|---------|
| `bridge-mcp/src/core/sessionContext.ts` | ACX.1 | Session context assembly + caching |
| `bridge-mcp/src/core/contextPush.ts` | ACX.2 | Event-driven delta push manager |
| `bridge-mcp/src/core/complexityRouter.ts` | ACX.4 | Commandment 8 model tier routing |
| `bridge-mcp/src/core/toolEnricher.ts` | ACX.3 | Pre-flight context injection for tools |
| `bridge-mcp/src/prompts/sentinel.ts` | ACX.1 | Domain-configurable governance prompt |
| `bridge-mcp/src/domains/healthcare.ts` | ACX.1 | HIPAA domain rules |
| `bridge-mcp/src/domains/fintech.ts` | ACX.1 | PCI-DSS + SOX domain rules |
| `bridge-mcp/src/domains/ecommerce.ts` | ACX.1 | GDPR + PCI domain rules |
| `bridge-mcp/src/__tests__/sessionContext.test.ts` | ACX.6 | Session context tests |
| `bridge-mcp/src/__tests__/complexityRouter.test.ts` | ACX.6 | Complexity router tests |
| `bridge-mcp/src/__tests__/sentinel.test.ts` | ACX.6 | Sentinel prompt tests |
| `bridge-mcp/src/__tests__/toolEnricher.test.ts` | ACX.6 | Tool enrichment tests |
| `bridge-mcp/src/__tests__/contextPush.test.ts` | ACX.6 | Context push tests |

### Files to MODIFY (ACX will touch — coordinate before editing)

| File | Phase | What ACX changes |
|------|-------|-----------------|
| `bridge-mcp/src/server.ts` | ACX.1 | New resource (`bridge://session-context`), 1 new tool (`bridge_get_context`), enrichment intercept, context push init |
| `bridge-mcp/src/types.ts` | ACX.1 | All ACX type definitions (`SessionContext`, `ContextDelta`, `ComplexityAssessment`, etc.) |
| `bridge-mcp/src/core/events.ts` | ACX.2 | `'context-delta'` added to MCPEventType |
| `bridge-mcp/src/core/capabilities/index.ts` | ACX.1 | New entries in capabilities catalog |
| `bridge-mcp/src/domains/index.ts` | ACX.1 | Register 3 new domain modules |
| `src/types/bridge-api.d.ts` | ACX.5 | Extended `BridgeContext` type |
| `src/hooks/useContextSync.ts` | ACX.5 | Populate new BridgeContext fields |
| `electron/main.ts` | ACX.5 | `context:get-enriched` IPC handler |
| `electron/preload.ts` | ACX.5 | `context.getEnriched()` bridgeAPI method |
| `electron/orchestrator.ts` | ACX.4 | Complexity router integration in `sendChatMessage()`, sentinel prompt prepend |

### Files ACX will NOT touch (safe for other swarms)

These are explicitly safe — ACX has no planned changes:

- `src/App.tsx` (no new mounts needed)
- `src/store/*.ts` (all existing stores unchanged)
- `src/components/**/*.tsx` (no UI changes)
- `electron/ingestion-server.ts` (Phase ING complete, no further changes)
- `electron/ingestion/*.ts` (Phase ING complete)
- `electron/store.ts` (no schema changes)
- `electron/FileTransactionManager.ts`
- `electron/GitManager.ts`
- `src/core/*.ts` (ASTService, MithrilLinter, recoveryController — untouched)
- `bridge-mcp/src/tools/*.ts` (existing tool handlers — untouched)
- `bridge-mcp/src/core/MithrilLinter.ts`
- `bridge-mcp/src/core/A11yLinter.ts`
- `bridge-mcp/src/core/dashboard/*`
- `bridge-mcp/src/core/governance/*`
- All test files outside `bridge-mcp/src/__tests__/`

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
