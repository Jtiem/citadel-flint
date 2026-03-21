---
description: Synchronize CLAUDE.md, HANDOFF.md, and FLINT-PULSE.md after code changes
---

# /sync-docs — Documentation Synchronization Workflow

Run this workflow after any significant code change to keep project documentation in sync.

## Steps

1. Read `.flint-context/FLINT-PULSE.md` to understand the current session state.

2. Read `CLAUDE.md` and `HANDOFF.md` to understand what is currently documented.

3. Scan `src/core/`, `src/store/`, `src/utils/`, `src/components/`, `src/hooks/`, `src/services/`, and `electron/` for any files NOT listed in `HANDOFF.md` Section 2 (File Map).

4. For each undocumented file found:
   - Read the file's JSDoc header to determine its purpose and phase.
   - Add it to the appropriate table in `HANDOFF.md` Section 2.

5. If any new **Module** (A–F) was introduced or a Module's scope changed, update the "Core Modules" section in `CLAUDE.md`.

6. If the implementation phase advanced (e.g., Phase F.2 → Phase G), update the "Status" line at the top of `HANDOFF.md`.

// turbo
7. Run `npx tsc --noEmit` to verify zero TypeScript errors.

8. Update `.flint-context/FLINT-PULSE.md` with:
   - Current "Active Buffer" (the primary file being worked on).
   - Updated "Pending Transactions" list.
   - Updated "Last Session Synchronization" block with today's date and modified files.

9. Report the sync results to the user, including any new files documented and the current phase status.
