# ARM.1 — Armory Library Bootstrap

**Status:** Proposed  
**Author:** Justin Tiemann (UX), diagnosed 2026-04-15  
**Phase Tag:** ARM.1  
**Citadel Components:** Armory (registry), Mason (D2C), Gate (export)  

---

## Problem Statement

When a user runs the full `/figma` pipeline for the first time, they hit an immediate contradiction:

1. They tell Flint "use MUI" (or Flint picks it as the default).
2. Mason generates MUI code — correctly.
3. Armory immediately blocks the output with REG-001 ("Unregistered Component Usage") for every MUI primitive it used.

**The system generated the code, then blocked itself for using it.**

This pattern repeats for every new project that uses any npm component library. The Armory only knows about components the user has manually registered or that exist in their `src/` tree. It has no concept of "these components come from a trusted library that I already know about."

The result for a first-time user: confusion, friction, and a blocked export on a file they never touched. This is the highest-priority onboarding gap in the current pipeline.

---

## User Journey — Before ARM.1

```
User runs /figma on a Nomad Vault pricing frame
  ↓
Mason generates PricingPageClean.tsx using Box, Stack, Typography, Accordion (MUI)
  ↓
audit_ui_component runs on the output
  ↓
BLOCKED — 6 × REG-001: Box, Stack, Typography, Accordion, AccordionSummary, AccordionDetails
  ↓
"Add this component to your Armory, or replace it with a registered alternative"
  ↓
User: "But... you just used those components?"
```

**What the user experiences:** A tool that contradicts itself on first use.

---

## User Journey — After ARM.1

```
User runs /connect → selects MUI as their library
  ↓
Armory auto-seeds MUI primitive set (one-time, silent)
  ↓
User runs /figma on any Figma frame
  ↓
Mason generates MUI code
  ↓
audit_ui_component runs
  ↓
REG-001 is quiet — MUI components are recognized as library-trusted
  ↓
Violations shown are real governance issues, not false positives
  ↓
User: "These 2 issues are mine to fix. Everything else is clean."
```

---

## Feature Budget Framework

### Gate 1 — Who is this for?

**Both audiences.** Developers hit this in CI when they run `flint-gate audit` on any new MUI project. Designers hit it the first time they run `/figma`. The onboarding friction is identical.

### Gate 2 — What behavior does this enable?

> A designer can run the full `/figma` pipeline on any Figma frame and receive a governance audit that reflects their actual design decisions — not false positives from the library they chose.

> A developer can run `flint-gate audit` on a new MUI project without pre-seeding the registry.

### Gate 3 — Is this the 80% use case?

**Yes.** Every new project using a known library (MUI, shadcn, Tailwind, PrimeNG) hits this. It is not an edge case. REG-001 false positives are the #1 source of confusion in the D2C pipeline.

### Gate 4 — What is the maintenance cost?

**Medium.** Two changes required:

1. Library adapter updates (each adapter gains a `getComponentManifest()` method — self-contained, pure function)
2. REG-001 rule logic update (one conditional added — MithrilLinter.ts)

No new IPC channels. No new stores. No new UI.

### Gate 5 — Can we validate without building it?

We already validated it. Justin ran the full pipeline and hit the exact gap this spec addresses. No further validation needed — this is a confirmed blocker, not a hypothesis.

### Gate 6 — What do we stop doing to make room?

`flint_add_remote_library` remains available for non-standard libraries, but it is no longer the required path for libraries that Flint already knows about. We stop asking users to manually register components that Flint generated.

---

## Solution Design

Two parts. Both are required.

### Part A — Library Primitive Auto-Seed

When `flint_set_library` is called with a known library (`mui`, `shadcn`, `primeng`, `tailwind`), automatically seed the library's component manifest into the Armory alongside the token seed that already happens today.

The manifest is a static, bundled list of the library's primary exports — not fetched from the network, not pulled from GitHub. It ships with Flint.

**What gets seeded for MUI:**

| Component | Import Path | Description |
|-----------|------------|-------------|
| Box | @mui/material/Box | Layout container, accepts sx prop |
| Stack | @mui/material/Stack | Flex/grid stack layout |
| Typography | @mui/material/Typography | All text rendering |
| Button | @mui/material/Button | Primary action element |
| TextField | @mui/material/TextField | Form input |
| Accordion | @mui/material/Accordion | Expandable disclosure |
| AccordionSummary | @mui/material/AccordionSummary | Accordion header |
| AccordionDetails | @mui/material/AccordionDetails | Accordion body |
| Dialog | @mui/material/Dialog | Modal overlay |
| DialogTitle | @mui/material/DialogTitle | Modal title |
| DialogContent | @mui/material/DialogContent | Modal body |
| DialogActions | @mui/material/DialogActions | Modal footer |
| Card | @mui/material/Card | Card container |
| CardContent | @mui/material/CardContent | Card body |
| CardActions | @mui/material/CardActions | Card footer |
| Chip | @mui/material/Chip | Tag/badge label |
| Alert | @mui/material/Alert | Status message |
| Snackbar | @mui/material/Snackbar | Toast notification |
| CircularProgress | @mui/material/CircularProgress | Loading indicator |
| Divider | @mui/material/Divider | Horizontal rule |
| List | @mui/material/List | Unordered list |
| ListItem | @mui/material/ListItem | List row |
| ListItemText | @mui/material/ListItemText | List row content |
| Menu | @mui/material/Menu | Dropdown container |
| MenuItem | @mui/material/MenuItem | Dropdown option |
| Select | @mui/material/Select | Native select input |
| Switch | @mui/material/Switch | Toggle |
| Checkbox | @mui/material/Checkbox | Checkbox input |
| Radio | @mui/material/Radio | Radio input |
| Tabs | @mui/material/Tabs | Tab group |
| Tab | @mui/material/Tab | Tab item |
| Tooltip | @mui/material/Tooltip | Hover hint |
| IconButton | @mui/material/IconButton | Icon-only button |
| Avatar | @mui/material/Avatar | User image |
| Badge | @mui/material/Badge | Count indicator |
| Breadcrumbs | @mui/material/Breadcrumbs | Path trail |
| Skeleton | @mui/material/Skeleton | Loading placeholder |
| Stepper | @mui/material/Stepper | Step sequence |
| Step | @mui/material/Step | Single step |
| StepLabel | @mui/material/StepLabel | Step header |
| Paper | @mui/material/Paper | Elevated surface |
| AppBar | @mui/material/AppBar | Top navigation bar |
| Toolbar | @mui/material/Toolbar | AppBar inner layout |
| Drawer | @mui/material/Drawer | Side panel |
| FormControl | @mui/material/FormControl | Form field wrapper |
| FormLabel | @mui/material/FormLabel | Field label |
| FormHelperText | @mui/material/FormHelperText | Field hint/error |
| InputLabel | @mui/material/InputLabel | Select/TextField label |
| Grid | @mui/material/Grid | CSS grid layout |
| Container | @mui/material/Container | Max-width wrapper |
| Link | @mui/material/Link | Styled anchor |
| Table | @mui/material/Table | Data table |
| TableHead | @mui/material/TableHead | Table header |
| TableBody | @mui/material/TableBody | Table body |
| TableRow | @mui/material/TableRow | Table row |
| TableCell | @mui/material/TableCell | Table cell |

Equivalent manifests will be defined for shadcn, PrimeNG, and Tailwind base components.

**Entry format:** Each seeded entry uses `source: 'library'` (new value, see Part B) and does not include `usageExample`, `compositionNotes`, or `a11yNotes` — those are added by Armory enrichment later if desired.

**Seeding is idempotent.** Running `flint_set_library mui` twice does not duplicate entries. Library entries are keyed by `name + source`, and library entries never overwrite local (project-authored) entries.

---

### Part B — REG-001 Scope Correction

REG-001 should only fire when a component is **unrecognized** — meaning it is not in the Armory as any entry type. If it is registered as a library component, it is trusted.

**Current behavior:**  
REG-001 fires when `componentName` is not found in the registry set.

**New behavior:**  
REG-001 fires when `componentName` is not found in the registry set AND is not from a registered library package.

**Implementation:** The `ComponentEntry.source` field gains a third value: `'library'` (in addition to existing `'local'` and `'remote'`). The `visitRegistryUsage` function in MithrilLinter skips REG-001 for entries where `source === 'library'`.

**Source taxonomy after ARM.1:**

| Source Value | Meaning | Seeded by |
|---|---|---|
| `'local'` (existing) | Project-authored component in `src/` | `flint_reindex_registry` |
| `'remote'` (existing) | Fetched from a GitHub manifest | `flint_add_remote_library` |
| `'library'` (new) | Bundled library primitive (MUI, shadcn, etc.) | `flint_set_library` |

Library entries appear in Armory search results so users can discover what's available, but they do not count as "unregistered" for governance purposes.

---

## Technical Approach

### Files Changed

| File | Change |
|------|--------|
| `flint-mcp/src/core/libraryAdapters/types.ts` | Add `getComponentManifest(): ComponentEntry[]` to `LibraryAdapter` interface |
| `flint-mcp/src/core/libraryAdapters/mui.ts` | Implement `getComponentManifest()` returning ~55 MUI entries with `source: 'library'` |
| `flint-mcp/src/core/libraryAdapters/shadcn.ts` | Implement `getComponentManifest()` returning shadcn/ui entries |
| `flint-mcp/src/core/libraryAdapters/primeng.ts` | Implement `getComponentManifest()` returning PrimeNG/PrimeReact entries |
| `flint-mcp/src/core/libraryAdapters/tailwind.ts` | Implement `getComponentManifest()` returning Tailwind base elements (minimal — Tailwind is utility-first, not component-based) |
| `flint-mcp/src/core/registryService.ts` | Add `'library'` to `ComponentEntry.source` union type |
| `flint-mcp/src/tools/setLibrary.ts` | After `adapter.seedTokens()`, also call `adapter.getComponentManifest()` and merge into registry cache; write library entries to `flint-manifest.json` under a `libraryComponents` key |
| `flint-mcp/src/core/MithrilLinter.ts` | In `visitRegistryUsage`, skip REG-001 when the matched registry entry has `source === 'library'` |
| `flint-mcp/src/core/errorTaxonomy.ts` | Update REG-001 explanation to mention library trust |

### Files Not Changed

- `flint-manifest.json` schema: library entries stored under a new top-level `libraryComponents` key to keep them separate from project-authored `components`
- `electron/main.ts`, `server/index.ts`: No IPC changes required
- Glass UI: No changes — REG-001 results simply stop appearing for library components
- `flint-ci/`: No changes — CI uses the same MithrilLinter, fix flows through naturally

### Data Flow

```
flint_set_library(library="mui")
  ↓
MUI adapter.seedTokens() → merges tokens into design-tokens.json [existing today]
  ↓
MUI adapter.getComponentManifest() → returns ~55 ComponentEntry[] [new]
  ↓
setRegistryCache() merges entries (source='library')
  ↓
Writes libraryComponents[] to flint-manifest.json [new]
  ↓
(Later) audit_ui_component runs on generated code
  ↓
MithrilLinter.visitRegistryUsage() checks each JSX component
  ↓
Box found in registry with source='library' → no REG-001 [new behavior]
  ↓
Audit passes — only real violations reported
```

---

## What This Does NOT Change

- **REG-001 still fires for genuinely unknown components.** If someone uses `<MyUndocumentedWidget>` and it is not in the Armory, REG-001 fires correctly.
- **Local project components are unaffected.** `source: 'local'` entries behave exactly as today.
- **The governance standard for custom components does not change.** Teams should still register their own components via `flint_reindex_registry`.
- **`flint_add_remote_library` is still useful** for libraries that don't have bundled manifests in Flint yet.

---

## Test Boundaries

Every changed file requires tests. Minimum coverage:

| Test | Location | Assertion |
|------|----------|-----------|
| MUI adapter `getComponentManifest()` returns ≥55 entries | `flint-mcp/src/core/libraryAdapters/__tests__/mui.test.ts` | Each entry has `name`, `importPath`, `source: 'library'` |
| shadcn/primeng/tailwind adapters return non-empty manifests | `__tests__/shadcn.test.ts`, `primeng.test.ts`, `tailwind.test.ts` | Count > 0, source === 'library' |
| `flint_set_library mui` seeds components into registry | `__tests__/setLibrary.test.ts` | Registry cache contains 'Box' after call |
| Seeding is idempotent (calling twice doesn't duplicate) | `__tests__/setLibrary.test.ts` | Count is same after second call |
| Library entries do not overwrite local entries with same name | `__tests__/setLibrary.test.ts` | A local `Box.tsx` survives MUI seeding |
| REG-001 does NOT fire for `source: 'library'` entries | `flint-mcp/src/core/__tests__/MithrilLinter.test.ts` | Zero REG-001 violations on MUI JSX when library registered |
| REG-001 DOES fire for unknown components even when library is set | `flint-mcp/src/core/__tests__/MithrilLinter.test.ts` | `<MyUnknownWidget>` still triggers REG-001 |
| REG-001 DOES fire when registry is empty (no library set) | `flint-mcp/src/core/__tests__/MithrilLinter.test.ts` | Existing behavior preserved |

---

## Open Questions

1. **Should `flint_reindex_registry` also trigger library seeding?**  
   Currently: reindex only scans `src/`. After ARM.1: if `policy.json` has `selectedLibrary`, should reindex also re-seed the library manifest? Probably yes — keeps the registry consistent after a full reset. Needs a decision before Phase 2 implementation.

2. **Should library components appear in `flint_query_registry` results?**  
   They would appear in Armory search, which is useful ("what MUI components can I use?"). But they might clutter results for teams who only want to see their custom components. A `source` filter parameter on `flint_query_registry` would resolve this cleanly.

3. **Tailwind scope:**  
   Tailwind is utility-first — its "components" are HTML elements with class utilities, not React components. The manifest for Tailwind should probably contain zero entries (REG-001 is irrelevant for Tailwind projects since there are no PascalCase component names). Confirm before implementation.

4. **What happens if a user is on MUI v5 vs v6?**  
   Import paths differ slightly. For now, the manifest targets MUI v5 paths (`@mui/material/Box`), which are valid for both v5 and v6. Flag as a known limitation; a `libraryVersion` field on the manifest entry is the future path.

---

## Implementation Order

This is a Phase 2 parallel implementation. No cross-file dependencies between the two parts.

**Group A (can run in parallel):**
- Library adapter `getComponentManifest()` methods (pure functions, no IPC)
- `registryService.ts` source type update

**Group B (depends on Group A type):**
- `setLibrary.ts` seeding integration
- `MithrilLinter.ts` REG-001 scope correction

**Gate:** `flint-contract-linter` validates the contract before Group B begins.  
**Review:** End-of-round ceremony with 3 parallel reviews (UX, code, security) before marking ONLINE.

---

## Success Criteria

ARM.1 is complete when:

- [ ] Running `/figma` on any Figma frame generates MUI code with zero REG-001 violations
- [ ] `audit_ui_component` on any MUI component returns violations that reflect real governance issues, not library primitives
- [ ] `flint_set_library mui` takes ≤2 seconds and silently seeds both tokens and component manifest
- [ ] All test boundaries pass (unit counts reported per standard)
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] The `/getting-started` onboarding flow produces zero false-positive violations on a fresh MUI project
