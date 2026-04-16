# /flint — Smart Command Reference

Context-aware command reference. Reads your current project state and highlights what's most relevant right now.

## Behavior

### Step 1: Read project state

Call `flint_get_context` and `flint_status` in parallel. Determine:
- Is Figma connected?
- Are there open violations?
- What's the health score?
- Are tokens in sync?
- Is there an active file?

### Step 2: Present the smart reference

Start with a **"Right now"** section that surfaces the 2-3 most relevant commands based on current state. Then show the full reference below.

#### Contextual "Right now" logic:

**If Figma is NOT connected:**
```
## Right Now

You're not connected to Figma yet. Start here:
  /connect          Link your Figma project (one-time setup)
  /getting-started  Guided tour of what Flint can do
```

**If violations are open:**
```
## Right Now

[N] violations open across [M] files. Top issue: [rule] in [file].
  /fix [worst-file]   Fix the most violated file
  /sweep              Fix everything at once
  /health             Full health breakdown
```

**If tokens are out of sync:**
```
## Right Now

Token drift detected — [N] tokens out of sync with Figma.
  /tokens pull     Sync from Figma
  /tokens check    See what drifted
```

**If everything is healthy:**
```
## Right Now

Project health: [score]/100 ([grade]) — looking good.
  /figma <url>     Add a new component from Figma
  /review          Pre-commit check before shipping
  /dbom            Generate a bill of materials
```

**If no project state is available (server offline, etc.):**
```
## Right Now

Flint server isn't responding. Check your setup:
  /status           Server health check
  /getting-started  Setup walkthrough
```

### Step 3: Full reference card

After the contextual section, always show the complete reference:

```
## All Commands

### Figma Pipeline
  /figma <url>                 Figma URL → working code
  /connect                    Link Figma project via OAuth
  /ingest                     Process Figma plugin payload
  /tokens pull|push|emit|check|map   Token sync lifecycle

### Inspect
  /audit <file>               Governance audit on a component
  /health                     Full project health dashboard
  /report [glob]              Design debt score and trends
  /context                    Current session state snapshot
  /dbom [glob]                Design Bill of Materials
  /query <term>               Search the component registry
  /status                     Server health check

### Fix
  /fix <file>                 Auto-fix violations (dry-run first)
  /sweep [glob]               Batch audit + auto-fix
  /migrate <file>             Tailwind v3→v4 migration

### Plan + Ship
  /plan <task>                Execution plan with complexity routing
  /review                     Pre-commit code review gate
  /handoff                    Session end documentation

### Learn
  /getting-started            Adaptive onboarding tour
  /workflows [topic]          Step-by-step task recipes
  /flint                      This reference (you are here)

### Demo
  /demo:audit-good            Audit a compliant component
  /demo:audit-bad             Audit a non-compliant component
  /demo:fix                   Auto-fix a drifted component
  /demo:sweep                 Sweep all demo fixtures
  /demo:report                Demo debt report
```

### Step 4: Footer

End with:

```
Tip: Most commands accept file paths (/audit src/Button.tsx) or
globs (/sweep src/**/*.tsx). /fix does a dry-run first.
New here? Try /getting-started for a guided tour.
```

## Design Principles

1. **State-aware first:** The "Right Now" section is the whole point — it answers "what should I do?" not "what can I do?"
2. **One glance:** The full reference uses a compact, scannable format — no tables, just aligned columns.
3. **Escape velocity:** New users get pointed to `/getting-started`, not a wall of commands.
4. **Always complete:** The full reference is always shown below the contextual section — power users can scan past the suggestions.

Arguments: $ARGUMENTS
