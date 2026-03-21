# Workflow: Session Start

> Run at the beginning of every development session before writing any code.
> Prevents swarm collisions, preserves continuity across context limits, and
> ensures every agent starts from a shared understanding of current project state.

## Trigger
- Start of every coding session
- Before any implementation, refactoring, or file modification
- When picking up work from a previous session or handoff

## Steps

### 1. Declare Territory
Open `.governance/ACTIVE-TERRITORY.md` (create it if it doesn't exist).

Add an entry for your session:
```
## [Agent/Person Name] — [Date]
Files in scope: [list the files you intend to touch]
Modules: [list the modules you will modify]
Goal: [one sentence — what you're shipping this session]
```

**If another agent or session has already claimed a file you need:**
Stop. Coordinate before proceeding. Do not touch a claimed file without explicit handoff.

### 2. Update HANDOFF.md
Open `HANDOFF.md` (create it at the project root if it doesn't exist).

Add a session entry:
```
## [Date] — [Phase/Feature Name]
**Status:** In Progress
**Files in scope:** [list]
**Goal:** [what this session will complete]
**Depends on:** [any prior work this builds on]
```

This is the continuity record. If your session is interrupted, the next agent reads this and picks up exactly where you left off.

### 3. Read Context
In this order:
1. `HANDOFF.md` — what was in progress
2. `.governance/COMMANDMENTS.md` — the non-negotiables
3. `.governance/ARCHITECTURE.md` — the module map and constraints
4. `.governance/HEALTH-PULSE.md` — current system health and known risks

### 4. Begin Work

---

## Session End Counterpart
When your session is complete:
- Update `HANDOFF.md`: change status to Done, add what changed, note what remains
- Clear your entry from `.governance/ACTIVE-TERRITORY.md`
- Run the `session-end` workflow

---

## Why This Exists
In AI-assisted development, multiple agents may work in parallel or in rapid
sequence across context resets. Without explicit territory declaration and a
continuity file, two agents will modify the same file simultaneously (causing
merge conflicts), or a new agent will re-do work that was just completed.

The Session Start Protocol converts implicit assumptions into an explicit shared
state record. The cost is 2 minutes. The saved cost is hours of debugging
mysterious conflicts and re-done work.
