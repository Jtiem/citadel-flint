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

## Swarm: Sprint 5 Group B — GovernancePanel EDU improvements

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
| none | — |

### Files to MODIFY
| File | What changes |
| `src/components/ui/GovernancePanel.tsx` | S5.6: rule description tests; S5.7: save vs. auto-apply visual distinction |
| `src/components/ui/__tests__/GovernancePanel.test.tsx` | Tests for S5.6 description lines and S5.7 unsaved state badge |

---

## Swarm: Sprint 5 Group A — GovernanceDashboard S5 items

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
| `src/components/ui/__tests__/GovernanceDashboard.s5.test.tsx` | Tests for S5.1–S5.5, S5.8, S5.10 |

### Files to MODIFY
| File | What changes |
| `src/components/ui/GovernanceDashboard.tsx` | S5.1: zero-state guard; S5.2: action framing labels (already done); S5.3: rule row navigation (already done); S5.4: Fix All button (already done); S5.5: Override/Defer actions on violation rows; S5.8: Configure rules link; S5.10: violation expand on click |

---

## Swarm: Sprint 5 Group C (S5.9 + S5.11)

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
| `src/components/ui/__tests__/GovernanceDashboard.s5gc.test.tsx` | Tests for S5.9 pin mode + S5.11 undo link |

### Files to MODIFY
| File | What changes |
| `src/components/ui/GovernanceDashboard.tsx` | S5.9: pin mode on violation cards; S5.11: Undo this link on activity entries |

---

## Swarm: Sprint Clarity (Phase 1 — Contract)

**Status:** SHIPPED

### Files to CREATE

| File | Purpose |
| `docs/contracts/SPRINT-CLARITY.md` | Contract artifact |
| `docs/contracts/sprint-clarity.contract.ts` | Executable contract |

### Files to MODIFY

| File | What changes |
| `HANDOFF.md` | Session entry for Sprint Clarity |

---

## Swarm: Sprint Clarity 2 (Phase 1 — Contract)

**Status:** CONTRACTS APPROVED

### Files to CREATE

| File | Purpose |
| `docs/contracts/SPRINT-CLARITY-2.md` | Contract artifact |
| `docs/contracts/sprint-clarity-2.contract.ts` | Executable contract |
| `shared/healthSignal.ts` | Shared health signal pure function (Item 4) |
| `shared/__tests__/healthSignal.test.ts` | Tests for health signal |
| `src/components/ui/TabUnlockTooltip.tsx` | Tab unlock tooltip component (Item 2) |
| `flint-mcp/src/core/toolSuggester.ts` | Tool suggestion engine (Item 5) |

### Files to MODIFY

| File | What changes |
| `src/components/ui/GovernanceDashboard.tsx` | Items 1 + 4: next-step prompt + health signal labels |
| `src/App.tsx` | Item 2: TabUnlockTooltip wrapper on dynamic tabs |
| `flint-mcp/src/tools/fix.ts` | Item 3: recommendation field |
| `flint-mcp/src/tools/debtReport.ts` | Item 3: recommendation field |
| `flint-mcp/src/tools/accessibility.ts` | Item 3: recommendation field |
| `flint-mcp/src/tools/swarm.ts` | Item 3: recommendation field |
| `flint-mcp/src/tools/sync.ts` | Item 3: recommendation field |
| `flint-mcp/src/tools/dbom.ts` | Item 3: recommendation field |
| `flint-mcp/src/server.ts` | Item 3: recommendation on risk_score |
| `flint-mcp/src/core/sessionContext.ts` | Item 5: suggestedTools |
| `flint-mcp/src/types.ts` | Item 5: suggestedTools type |
| `flint-ci/src/commands/debt.ts` | Item 4: shared health signal labels |
| `HANDOFF.md` | Session entry |

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
