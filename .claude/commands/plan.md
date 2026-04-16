# /plan — Structured Execution Plan

Generate a structured, step-by-step plan for a task with complexity routing and risk assessment. Useful before starting any non-trivial work.

## Usage

- `/plan <description>` — Generate a plan for the described task
- `/plan <description> --assess` — Include AI model complexity assessment (Commandment 8)

## Behavior

### Step 1: Assess complexity (if --assess or always for multi-step tasks)

Call `flint_assess_complexity` with the task description to get:
- Recommended model tier (Flash vs. Thinking)
- Complexity score
- Risk factors

Present briefly: "Complexity: Medium — recommended for Thinking model."

### Step 2: Generate the plan

Call `flint_plan` with the task description.

### Step 3: Present the plan

Format as a clear, actionable breakdown:

```
## Execution Plan

**Task:** [description]
**Complexity:** Medium (score: 6/10)
**Estimated scope:** 4 files, 2 IPC channels

### Steps

1. **[Action]** — [what and why]
   - Files: `path/to/file.ts`
   - Tools: `flint_ast_mutate`, `audit_ui_component`

2. **[Action]** — [what and why]
   - Files: `path/to/other.ts`
   - Depends on: Step 1

3. **[Action]** — [what and why]
   - Files: `path/to/test.ts`

### Risk Factors
- [risk 1 and mitigation]
- [risk 2 and mitigation]

### Governance Impact
- New violations expected: [yes/no]
- Export gate affected: [yes/no]
- Token changes: [yes/no]
```

### Step 4: Ask for approval

End with: "Ready to execute this plan? Say 'go' to start, or adjust any steps first."

Do NOT begin implementation until the user approves. The plan is a proposal, not an action.

## Notes

- Uses Citadel vocabulary where relevant (Sentry for risk, Gate for export impact)
- Plans respect the Feature Budget Framework — if a task fails the 6 gates, flag it
- For tasks crossing process boundaries, the plan will note IPC requirements
- Complex tasks (3+ files, IPC, or store changes) should use the Contract-First workflow — the plan will recommend this when appropriate

Arguments: $ARGUMENTS
