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

## Swarm: Phase CI.2 — CI/CD Parity Rewrite

**Status:** IN PROGRESS

### Files to CREATE
| File | Purpose |
|------|---------|
| `flint-ci/package.json` | Package manifest with @flint-gov/mcp workspace dep |
| `flint-ci/tsconfig.json` | TS config with project references |
| `flint-ci/vitest.config.ts` | Test config |
| `flint-ci/src/cli.ts` | Commander CLI entrypoint |
| `flint-ci/src/engine.ts` | MCP engine adapter |
| `flint-ci/src/commands/audit.ts` | Audit subcommand |
| `flint-ci/src/commands/debt.ts` | Debt report subcommand |
| `flint-ci/src/commands/sync-check.ts` | Sync health subcommand |
| `flint-ci/src/commands/dbom.ts` | DBOM export subcommand |
| `flint-ci/src/commands/fix.ts` | Auto-fix subcommand |
| `flint-ci/src/formatters/terminal.ts` | ANSI output formatter |
| `flint-ci/src/formatters/sarif.ts` | SARIF 2.1.0 builder |
| `flint-ci/src/formatters/pr-comment.ts` | GitHub PR comment formatter |
| `flint-ci/src/github-action.ts` | GitHub Actions wrapper |
| `flint-ci/src/__tests__/*.test.ts` | Tests |

### Files to DELETE
| File | Reason |
|------|--------|
| `bridge-ci/` (entire directory) | Replaced by flint-ci/ |

### Files to MODIFY
| File | What changes |
|------|-------------|
| `CLAUDE.md` | CI section updated |
| `HANDOFF.md` | New session entry |

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
