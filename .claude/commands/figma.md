# /figma — Figma Design-to-Code Pipeline

Turn a Figma URL into working, governance-compliant code in one step. Orchestrates Mason (D2C), Mithril (audit), and auto-fix into a single flow.

## Usage

- `/figma <figma-url>` — Full pipeline: fetch design → generate code → audit → fix → show result
- `/figma <figma-url> --lib <library>` — Override the component library (e.g., `--lib mui`, `--lib shadcn`)
- `/figma <figma-url> --dry-run` — Generate code but skip auto-fix (show violations only)

## Behavior

### Step 1: Parse the Figma URL

Extract `fileKey` and `nodeId` from the URL:
- `figma.com/design/:fileKey/:fileName?node-id=:nodeId` → convert `-` to `:` in nodeId
- `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use branchKey as fileKey

If no URL was provided, ask: "Paste a Figma URL and I'll turn it into code."

### Step 2: Fetch the design

Call the Figma MCP `get_design_context` tool with the extracted `fileKey` and `nodeId`.

Present a brief summary of what was fetched:
- Component name(s) detected
- Layer count
- Whether Code Connect mappings were found

### Step 3: Generate code with Mason

Call `flint_design_to_code` with the Figma data. If `--lib` was specified, pass that as the library. Otherwise use the project's configured library (check `flint_get_context` for active library, default to MUI).

Present the generated component code in a fenced code block.

### Step 4: Audit the output

Call `audit_ui_component` on the generated file to run Mithril + Warden checks.

Present:
1. Verdict (APPROVED or BLOCKED)
2. Violation summary (count by severity)

### Step 5: Auto-fix (unless --dry-run)

If violations were found and `--dry-run` was NOT passed:
1. Call `flint_fix` on the file
2. Re-run `audit_ui_component` to confirm fixes landed
3. Present the final verdict

### Step 6: Summary

Present a clean summary:
```
## Design → Code Complete

**Source:** [Figma link](url)
**Component:** ComponentName
**Library:** MUI (or whatever was used)
**Violations:** 3 found → 3 fixed
**Status:** APPROVED — ready to use

The component is at `src/components/ComponentName.tsx`.
```

If any violations remain after auto-fix, suggest: "Say `/fix <file>` to try manual remediation, or `/audit <file>` to see details."

## Notes

- This skill combines 4 MCP tools into one flow: `get_design_context` → `flint_design_to_code` → `audit_ui_component` → `flint_fix`
- Uses Citadel vocabulary: Mason (code gen), Mithril (visual audit), Warden (a11y), Gate (export readiness)
- The generated code respects the project's design tokens and component registry (Armory)

Arguments: $ARGUMENTS
