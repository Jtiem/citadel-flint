---
description: Plan a new module or feature with full architectural impact analysis
---

# /architect — Architecture Planning Workflow

Run this workflow when designing a new module, feature, or Phase for Flint IDE.

## Steps

1. Read `.flint-context/FLINT-PULSE.md` for the current session state and pending transactions.

2. Read `CLAUDE.md` for the v5.7 architecture specification and module breakdown.

3. Read `HANDOFF.md` for the current implementation status and file map.

4. Read `.antigravityrules` to review the 14 Commandments and verify the proposed feature does not violate any guardrails.

5. Identify which existing Modules (A–F) are affected by the proposed feature. List:
   - Files that will be **modified** (with the specific function or interface impacted).
   - Files that will be **created** (with proposed location and purpose).
   - Files that will be **deleted** (if any).

6. Analyze **AST Impact**: Identify which `data-flint-id` nodes, Babel visitor patterns, or store actions will change. Cross-reference against the `ASTService.ts` mutation types.

7. Verify **Mithril Compliance**: Check if the feature introduces any new `className` patterns that need token mapping. If so, note which tokens must be added to the SQLite store.

8. Draft an **Implementation Plan** artifact with:
   - Goal description and background context.
   - Proposed changes grouped by component.
   - A verification plan with specific commands and test strategies.

9. Present the plan to the user for review before proceeding to execution.

## Guardrails
- Never skip the `.antigravityrules` review (Step 4).
- Never propose changes that bypass the Atomic Write Queue (`FileTransactionManager`).
- Always include a ΔE impact assessment if the feature touches styling or tokens.
