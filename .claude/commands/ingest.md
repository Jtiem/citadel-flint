# /ingest — Figma Design Ingestion

Process a Figma design into governance-compliant components. Uses Figma MCP (no plugin required).

## Usage

- `/ingest <figma-url>` — Full pipeline: fetch design → generate code → audit → fix → register
- `/ingest <file>` — Re-run ingestion audit on an already-ingested component file
- `/ingest --heal` — Force heal pass on all pending ingestion results

## Behavior

### Step 1: Resolve the source

If a Figma URL was provided, delegate to the `/figma` pipeline (which calls `get_design_context` → `flint_design_to_code` → audit → fix).

If a file path was provided, skip to Step 3.

If no argument was provided:
- Say: "Paste a Figma URL to ingest a design, or provide a file path to re-audit."

### Step 2: Design-to-Code (via /figma)

The `/figma` skill handles the full pipeline. See `/figma` for details.

Present a brief summary:
- Components generated (count and names)
- Tokens extracted
- Files created

### Step 3: Ingestion audit and auto-heal

Run `audit_ui_component` on each generated file. The audit classifies violations into 3 tiers:
- **Tier 1** (auto-heal): Token drift within ΔE ≤ 2.0 — fixed automatically
- **Tier 2** (snap): ΔE 2.0–5.0 — snapped to nearest token with warning
- **Tier 3** (flag): ΔE > 5.0 — flagged for manual review

If violations are found, call `flint_fix` to auto-remediate.

Present the heal summary:
```
## Ingestion Complete

**Components:** 4 generated
**Auto-healed:** 12 token violations (Tier 1)
**Snapped:** 3 near-misses (Tier 2) — review recommended
**Flagged:** 1 unresolvable (Tier 3) — manual fix needed
```

### Step 4: Registry seeding

Call `flint_reindex_registry` to update the Armory with newly ingested components.

Present: "Registry updated with N new components."

### Final summary

```
## Ingestion Pipeline Complete

**Source:** Figma MCP
**Components:** 4 ingested, 4 approved
**Tokens:** 28 extracted, 12 auto-healed
**Registry:** 4 components added to Armory

All components are governance-compliant and ready to use.
```

If Tier 2/3 issues remain: "Review the flagged tokens, or run `/audit <file>` on flagged files."

## Notes

- Uses Citadel vocabulary: Mason (code gen), Oracle (classification), Scout (token extraction), Mithril (audit), Armory (registry)
- Figma MCP is the only Figma integration path. No plugin setup required.
- Auto-heal uses CIEDE2000 perceptual color distance (Commandment 9)

Arguments: $ARGUMENTS
