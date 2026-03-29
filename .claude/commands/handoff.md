# /handoff — Session End Documentation Gate

Updates HANDOFF.md with what was built this session, clears ACTIVE-SWARM-TERRITORY.md, and flags any stale entries in CLAUDE.md. Run at the end of every implementation session.

## Usage

- `/handoff` — Standard session-end update (HANDOFF.md + territory clear)
- `/handoff full` — Also diff CLAUDE.md module table against actual code state and flag drift
- `/handoff start` — Session START mode: declare territory and add a new HANDOFF.md session entry

## Behavior

### Session END (default)

1. **Read current state**
   - Read `HANDOFF.md` (last session entry and in-progress sections)
   - Read `.flint-context/ACTIVE-SWARM-TERRITORY.md` (claimed files)
   - Run `git log --oneline -10` to enumerate what was committed this session
   - Run `git diff HEAD~5..HEAD --name-only` to see touched files

2. **Invoke `flint-docs-keeper`** with:
   - The git log and diff output
   - Current HANDOFF.md content
   - Instructions to write a new session entry covering: phase/feature name, files changed, what shipped, what remains, any known issues
   - Instruction to clear all entries in ACTIVE-SWARM-TERRITORY.md that match files touched this session

3. **Apply patches**
   - Prepend the new session entry to HANDOFF.md (newest-first ordering)
   - Overwrite ACTIVE-SWARM-TERRITORY.md with remaining (untouched) claims only, or empty it if all work is complete

4. **Report**: Show the new HANDOFF.md session entry to the user for confirmation

### Session START (`/handoff start`)

1. Read HANDOFF.md to understand what's in progress from the last session
2. Prompt the user: "What are you working on this session?" (or infer from arguments)
3. Write a new in-progress entry to HANDOFF.md
4. Add file claims to ACTIVE-SWARM-TERRITORY.md
5. Present a session brief: last session's status + current goal

### Full CLAUDE.md diff (`/handoff full`)

After the standard END flow, additionally:
1. Read the Module Status tables in CLAUDE.md
2. For each module marked **ONLINE**, spot-check that its key file(s) exist on disk
3. Flag any modules referencing files that don't exist (likely renamed or deleted)
4. Present a drift report — do NOT auto-edit CLAUDE.md (that requires explicit approval)

## Implementation

### Step 1: Gather context

```bash
git log --oneline -10
git diff HEAD~5..HEAD --name-only 2>/dev/null || git diff --name-only HEAD
```

Read these files:
- `HANDOFF.md`
- `.flint-context/ACTIVE-SWARM-TERRITORY.md`

### Step 2: Launch flint-docs-keeper

Spawn a `flint-docs-keeper` agent with the gathered context and this directive:

> "Write a new session entry for HANDOFF.md. Format:
>
> ## Session [DATE] — [Phase/Feature Name]
> **Status:** COMPLETE | IN-PROGRESS | BLOCKED
> **Files changed:** [list]
> **What shipped:** [bullet list]
> **What remains:** [bullet list or 'Nothing — phase complete']
> **Known issues / next agent notes:** [or 'None']
>
> Then clear any file entries in ACTIVE-SWARM-TERRITORY.md that were touched this session.
> Do NOT modify CLAUDE.md unless `/handoff full` was requested."

### Step 3: Apply and confirm

Apply the agent's output:
- Prepend the session entry to HANDOFF.md (above the previous most-recent entry)
- Update ACTIVE-SWARM-TERRITORY.md

Show the written entry to the user. If the user says "looks good" or similar, the handoff is complete.

## Output Format

```
## Handoff Complete

### Session Entry Written to HANDOFF.md:
---
## Session 2026-03-28 — [Phase Name]
**Status:** COMPLETE
**Files changed:** electron/foo.ts, flint-mcp/src/bar.ts
**What shipped:**
- Feature X is now ONLINE
- Bug Y fixed
**What remains:** Nothing — phase complete
**Known issues:** None
---

### Territory Cleared:
- electron/foo.ts ✓
- flint-mcp/src/bar.ts ✓

ACTIVE-SWARM-TERRITORY.md is now empty.
```

## Notes

- This command is the mandatory last step of the Session Start Protocol defined in CLAUDE.md.
- If you ran `/handoff start` at the beginning of this session, `/handoff` (end) will use that territory declaration to auto-populate the "files changed" list.
- For read-only research sessions, this command is not required but still useful for logging context.
