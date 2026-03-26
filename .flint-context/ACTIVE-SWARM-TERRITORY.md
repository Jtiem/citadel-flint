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

---

---

## Swarm: Phase D2C.2 -- LivePreview Integration

**Status:** CONTRACTS IN PROGRESS

### Files to CREATE
| File | Purpose |
| `src/hooks/useDesignToCodeApply.ts` | React hook orchestrating D2C apply flow |
| `src/hooks/__tests__/useDesignToCodeApply.test.ts` | Tests for D2C apply hook |

### Files to MODIFY
| File | What changes |
| `electron/main.ts` | New `d2c:apply` IPC handler |
| `electron/preload.ts` | New `designToCode.apply` surface method |
| `src/types/flint-api.d.ts` | D2C apply types |
| `src/store/canvasStore.ts` | No store changes -- uses existing setActiveFile |
| `src/store/editorStore.ts` | No store changes -- uses existing setCode |
| `src/components/editor/XYCanvas.tsx` | No changes needed -- LivePreview auto-updates |

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
