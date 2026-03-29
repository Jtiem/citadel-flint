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
