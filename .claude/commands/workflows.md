# /workflows — Task Recipes

Shows complete step-by-step workflows for common tasks. Not individual command docs — these are the real paths people take through Flint, end to end.

## Usage

- `/workflows` — Show all available workflows with one-line descriptions
- `/workflows figma` — Figma design-to-code workflow
- `/workflows ship` — Pre-ship checklist workflow
- `/workflows tokens` — Token management workflow
- `/workflows session` — Session start/end workflow
- `/workflows migrate` — Design system migration workflow
- `/workflows ci` — CI/CD governance gate workflow

## Behavior

### /workflows (no args) — Index

Present the workflow index as a menu:

```
## Workflows

Pick a workflow to see the full recipe:

  /workflows figma     "I have a Figma design and want working code"
  /workflows ship      "I need to ship — is this ready?"
  /workflows tokens    "Tokens changed in Figma, sync them"
  /workflows session   "Starting or ending a work session"
  /workflows migrate   "Moving to a new design system version"
  /workflows ci        "Set up governance in CI/CD"

Each workflow shows the exact commands in order with what to expect
at each step.
```

### /workflows figma — Design to Code

```
## Figma → Code Workflow

Goal: Turn a Figma design into a governance-compliant component.

STEP 1 — Connect (one-time setup)
  /connect
  Links your Figma project via OAuth. Pulls tokens and seeds the
  component registry. You only do this once per project.

STEP 2 — Generate code
  /figma <paste-your-figma-url>
  Fetches the design, classifies components, maps to your library
  (MUI by default), generates JSX, audits, and auto-fixes in one shot.

  What you'll see:
  • The generated component code
  • An audit result (violations found → fixed)
  • The final file path

STEP 3 — Verify
  /audit src/components/YourComponent.tsx
  Double-check the output. If anything was missed, you'll see it here.

STEP 4 — Fine-tune (if needed)
  /fix src/components/YourComponent.tsx
  Runs auto-fix with a dry-run preview first. You approve before
  changes are applied.

DONE — Your component is ready to use.

Shortcut: If you just want code fast, /figma <url> handles steps 2-4
automatically. Steps 3-4 are for when you want manual control.
```

### /workflows ship — Pre-Ship Checklist

```
## Ship Checklist Workflow

Goal: Confirm this project is ready to ship.

STEP 1 — Health check
  /health
  Full dashboard: design debt score, token sync status, anomalies,
  and export gate verdict. If the score is above 80 and the gate
  says CLEAR, you're likely good.

STEP 2 — Fix remaining issues
  /sweep
  Batch audit + auto-fix across all component files. Catches
  anything hiding in files you haven't touched recently.

STEP 3 — Code review
  /review
  Pre-commit review gate. Checks for Commandment violations, IPC
  security gaps, missing tests, and architectural anti-patterns.
  Returns SHIP, SHIP-WITH-FIXES, or BLOCK.

STEP 4 — Generate Bill of Materials
  /dbom
  Produces a Design Bill of Materials — every token, component,
  and governance status in one exportable document. Useful for
  handoff to stakeholders.

STEP 5 — Document
  /handoff
  Records what shipped, clears territory claims, and prepares
  context for the next session.

Quick version: If you're confident, /health → /review → /handoff
is the minimum path.
```

### /workflows tokens — Token Management

```
## Token Sync Workflow

Goal: Keep design tokens in sync between Figma and code.

STEP 1 — Check sync health
  /tokens check
  Shows whether tokens are in sync, drifted, or disconnected.
  Tells you exactly what's off.

STEP 2 — Pull changes from Figma
  /tokens pull
  Fetches any token changes from Figma. If conflicts exist,
  you'll walk through resolution one by one (or bulk-accept).

STEP 3 — Emit to platform formats
  /tokens emit
  Generates token files for all platforms: CSS variables,
  Tailwind config, Swift, Kotlin. Or specify one:
  /tokens emit css

STEP 4 — Audit affected components
  /sweep
  After token changes, some components may have new violations.
  Sweep catches and fixes them.

STEP 5 — Push local changes to Figma (optional)
  /tokens push
  If you've modified tokens locally and want to push back
  to Figma as the source of truth.

Quick version: /tokens pull → /tokens emit is the 80% path.
```

### /workflows session — Session Management

```
## Session Workflow

Goal: Start and end work sessions cleanly.

STARTING A SESSION
  /handoff start
  Declares what you're working on, claims files in the territory
  tracker, and shows what the last session left behind.

  Then:
  /context
  Quick snapshot of current project state — where you left off.

DURING A SESSION
  /plan <what you want to do>
  Before starting non-trivial work, generate a structured plan
  with complexity assessment. Helps you (and agents) stay aligned.

ENDING A SESSION
  /handoff
  Updates HANDOFF.md with what you built, clears territory claims,
  and flags anything left in progress.

  Optional:
  /handoff full
  Also checks if CLAUDE.md has drifted from actual code state.
```

### /workflows migrate — Design System Migration

```
## Design System Migration Workflow

Goal: Migrate to a new version of your design system or switch systems.

STEP 1 — Migrate Tailwind classes (if applicable)
  /migrate src/components/YourComponent.tsx
  AST-level Tailwind v3→v4 class migration. Runs a post-migration
  audit automatically.

STEP 2 — Migrate design system tokens
  Ask: "Migrate my design system from [old] to [new]"
  Uses flint_migrate_ds for token diff + AST rename + ΔE scoring.

STEP 3 — Verify migration
  /sweep
  Audit all migrated files for violations introduced by the migration.

STEP 4 — Update token mapping
  /tokens map <new-library>
  Re-map DTCG tokens to the new library format.

STEP 5 — Health check
  /health --trend
  Compare before/after health scores to confirm the migration
  didn't degrade quality.
```

### /workflows ci — CI/CD Setup

```
## CI/CD Governance Gate Workflow

Goal: Add Flint governance checks to your CI pipeline.

STEP 1 — Verify Flint works locally
  /health
  Confirm the governance engine runs clean on your codebase.

STEP 2 — Add the CI gate
  The flint-gate CLI runs headless in CI. Add to your pipeline:

  npx flint-gate audit --glob "src/**/*.tsx" --format sarif
  npx flint-gate debt --threshold 70
  npx flint-gate sync-check

STEP 3 — Configure thresholds
  Set minimum health score and sync requirements in flint.config.yaml.
  Ask: "Show me the CI gate config options"

STEP 4 — Test locally
  Run the same commands locally to verify they pass before pushing.

STEP 5 — Generate DBOM for compliance
  /dbom
  Attach to releases for audit trail and compliance documentation.
```

## Design Principles

1. **Goal-first:** Every workflow starts with "Goal:" so the user knows if this is what they need.
2. **Numbered steps:** Linear, no branching. Each step has one command.
3. **Quick version:** Every workflow ends with the shortest path for confident users.
4. **Plain English:** Explain what each step does and what to expect — not just the command.
5. **Escape hatches:** Users can skip steps or jump to `/flint` for the full reference.

Arguments: $ARGUMENTS
