# /context — Session State Summary

Show the current Flint session state at a glance: active file, violations, health score, sync status, and what's happening on the canvas.

## Usage

- `/context` — Full session snapshot
- `/context brief` — One-line status summary

## Behavior

### /context (full)

#### Step 1: Fetch session state

Call `flint_get_context` to get the full Beacon session context.

#### Step 2: Present as a dashboard

Format the context as a clean, scannable summary:

```
## Session Context

**Active file:** src/components/HeroSection.tsx
**Canvas mode:** Build
**Library:** MUI v6

### Health
**Score:** 82/100 (B)
**Violations:** 3 open (2 Mithril, 1 Warden)
**Overrides:** 1 active

### Tokens
**Count:** 42 loaded
**Sync:** In sync (last pull 2h ago)
**Figma:** Connected

### Recent Activity
- [12:34] audit_ui_component → HeroSection.tsx — 2 violations
- [12:31] flint_fix → FeatureCard.tsx — 3 fixed
- [12:28] flint_design_to_code → PricingTable.tsx — generated

### Open Violations
| File | Rule | Severity |
|------|------|----------|
| HeroSection.tsx | DRIFT-001 | warning |
| HeroSection.tsx | DRIFT-003 | warning |
| HeroSection.tsx | A11Y-001 | error |
```

If any section has no data (e.g., no active file, no Figma connection), show a one-line note instead of an empty table:
- "No active file — open a component to get started"
- "Figma not connected — run `/connect` to link your project"

#### Step 3: Suggest next actions

Based on the state, suggest the most relevant next step:
- Violations open → "Run `/fix <file>` to auto-remediate"
- Drift detected → "Run `/tokens pull` to sync"
- No active file → "Open a component file, or run `/figma <url>` to generate one"
- Health score < 60 → "Run `/report` for a full health breakdown"

### /context brief

Call `flint_get_context` and condense to one line:

```
HeroSection.tsx | B (82) | 3 violations | MUI | Figma synced
```

## Notes

- Uses Citadel vocabulary: Beacon (context sync), Mithril (visual lint), Warden (a11y), Gate (export readiness)
- The context comes from `.flint/context.json` which Glass writes every 200ms (debounced)
- For MCP clients without Glass, context still works via the `flint://session-context` resource

Arguments: $ARGUMENTS
