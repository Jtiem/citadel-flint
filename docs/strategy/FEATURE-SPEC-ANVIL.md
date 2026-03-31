# Feature Spec: Anvil — Brilliant CLI Experience

**Date:** 2026-03-31
**Citadel Name:** Anvil
**Phase IDs:** ANVIL.1 (Identity + Output), ANVIL.2 (Interactive Fix + Diff), ANVIL.3 (Watch + Missing Commands), ANVIL.4 (Polish)
**Author:** flint-product-planner
**Status:** PROPOSED

---

## Problem

The Flint CLI (`flint-ci/`) is architecturally sound — it delegates all governance logic to the MCP engine, produces SARIF, and integrates with GitHub Actions. But the *experience* of using it is utilitarian. Compared to modern CLIs (Biome, oxlint, Vitest, Astro), Flint's terminal output is basic, the interaction model is batch-only, and several MCP capabilities have no CLI surface at all.

The CLI is the developer's primary touchpoint. Glass serves designers. The VS Code extension serves passive monitoring. But when a developer sits down to fix governance issues, adopt Flint in a new project, or debug a CI failure — they're in the terminal. That experience should be as considered as Glass.

**Current gaps:**

1. **Brand confusion.** The binary is `flint-gate`, not `flint`. Developers type the product name, not an internal concept.
2. **Silent scanning.** No progress indicator. Scanning 500 files produces no output until done.
3. **Flat violation output.** No inline source code, no suggested fix preview, no tree-style grouping.
4. **No interactive fix.** `fix` is all-or-nothing. No step-through approval.
5. **No local diff.** GitHub Action computes deltas but the CLI can't. Developers can't answer "what did I just break?"
6. **No watch mode.** Every other linter has one.
7. **Missing commands.** `migrate`, `pack`, `validate-config` exist as MCP tools but not CLI commands.
8. **Health formula duplication.** GitHub Action has its own `calculateHealthScore()` diverging from shared formula.

---

## Solution

### ANVIL.1 — Identity + Beautiful Output

**Rename + branding:**

- Binary name: `flint` (alias: `flint-gate` kept for backwards compatibility)
- Package name: `@flinthq/cli` (or `flint-cli`)
- Version banner: `Flint v2.1.0 — design governance for code`

**Rich terminal output:**

Replace the current `printSummary` with a formatted output inspired by Biome/Vitest:

```
 Flint v2.1.0

 src/components/Button.tsx
   12 │ className="bg-[#1a73e8] text-white"
      │            ~~~~~~~~~~~~
      │  MITHRIL-COL  Color #1a73e8 drifts from token
      │  Why: Hardcoded color bypasses your design system
      │  Fix: bg-primary (ΔE 1.4)

   28 │ <input type="text" />
      │  A11Y-001  Missing accessible name
      │  Why: Screen readers can't identify this input
      │  Fix: Add aria-label or associated <label>

 src/components/Card.tsx ✓ clean

 ──────────────────────────────────────
  3 files scanned  ·  2 violations  ·  1 auto-fixable

  Health: 85/100 (B)  ·  Fidelity: 90  ·  A11y: 80

  BLOCKED — run `flint fix` to auto-remediate
 ──────────────────────────────────────
```

Key improvements:
- **Inline source snippets** with caret underlining (like Rust compiler errors)
- **Suggested fix inline** — not just "there's a problem" but "here's the answer"
- **Clean files acknowledged** with a checkmark (positive reinforcement)
- **Health signal** using the shared formula (not a local duplicate)
- **Actionable footer** — tells you exactly what to type next

**Progress indicator:**

```
 Scanning... 147/523 files  [▓▓▓▓▓▓░░░░░░░░░] 28%
```

Spinner for small scans (<50 files), progress bar for larger scans.

**Implementation:**

| Layer | Changes |
|-------|---------|
| `cli.ts` | Rename `.name('flint')`, add `flint-gate` alias via bin field |
| `commands/audit.ts` | Replace `printSummary` with rich formatter |
| New: `utils/render.ts` | Source snippet extraction, caret underlining, progress bar |
| `utils/ansi.ts` | Add `underline`, `strikethrough`, box-drawing characters |
| `engine.ts` | Return source line numbers + column ranges with violations |
| `github-action.ts` | Replace `calculateHealthScore` with shared `formatHealthSignal` |

**Effort:** M (3–5 days)

---

### ANVIL.2 — Interactive Fix + Local Diff

**Interactive fix mode:**

`flint fix --interactive` (or `flint fix -i`) steps through each fixable violation one at a time:

```
 src/components/Button.tsx:12

  Before:  className="bg-[#1a73e8] text-white"
  After:   className="bg-primary text-white"

  Rule: MITHRIL-COL  ·  ΔE: 1.4  ·  Token: primary

  [y] Apply  [n] Skip  [a] Apply all  [q] Quit
```

For each violation:
- Show the before/after inline diff
- Show the rule, the distance metric, and the target token
- Accept single-key input: y/n/a/q
- Track applied vs skipped for summary

This is the "brilliant moment" — the developer sees exactly what will change and feels in control. No black-box batch mutation.

**Local diff mode:**

`flint diff` compares the current working tree against the git merge base (same logic as the GitHub Action's `computeDelta`, extracted to shared code):

```
 Flint Diff (vs main)

  +2 new violations introduced
  -1 violation fixed
   3 unchanged

  New:
    src/Button.tsx:12  MITHRIL-COL  Color #1a73e8 drifts
    src/Card.tsx:45    A11Y-003     Missing heading structure

  Fixed:
    src/Nav.tsx:8      A11Y-001     Missing aria-label (resolved)
```

This answers "what did I just break?" before pushing. Critical for developer trust.

**Implementation:**

| Layer | Changes |
|-------|---------|
| New: `commands/interactive-fix.ts` | Step-through fix UI with stdin key handling |
| New: `commands/diff.ts` | Local delta computation (extract from `github-action.ts`) |
| `cli.ts` | Add `diff` command, add `--interactive` / `-i` flag to `fix` |
| `engine.ts` | Extract `computeDelta` to shared function usable from both CLI and GitHub Action |
| `utils/render.ts` | Inline diff renderer (before/after with color highlighting) |

**Effort:** L (1–2 weeks)

---

### ANVIL.3 — Watch Mode + Missing Commands

**Watch mode:**

`flint watch` runs the audit continuously, re-scanning on file changes:

```
 Flint watching src/**/*.tsx  (Ctrl+C to stop)

 14:32:01  src/Button.tsx changed
           MITHRIL-COL  Color #1a73e8 drifts  ·  Fix: bg-primary
           1 violation  ·  Health: 85/100 (B)

 14:32:15  src/Button.tsx changed
           ✓ All clean  ·  Health: 100/100 (A)
```

Uses `fs.watch` (or `chokidar` if cross-platform reliability is needed). Only re-scans changed files (content-hash dedup against audit cache). Debounced at 300ms.

**Missing CLI commands:**

| Command | MCP Tool | What it does |
|---------|----------|-------------|
| `flint migrate <glob>` | `flint_migrate_tw` | Tailwind v3→v4 AST migration |
| `flint pack export` | `flint_pack_export` | Export governance pack |
| `flint pack import <path>` | `flint_pack_import` | Import governance pack |
| `flint validate` | `configValidator` | Validate `flint.config.yaml` |
| `flint rules` | `flint_list_rule_packs` | List available rule packs + status |

Each command is a thin wrapper that loads the MCP module and calls the existing handler — same pattern as `debt` and `fix` already use.

**Implementation:**

| Layer | Changes |
|-------|---------|
| New: `commands/watch.ts` | File watcher + incremental audit loop |
| New: `commands/migrate.ts` | Tailwind migration wrapper |
| New: `commands/pack.ts` | Pack export/import subcommands |
| New: `commands/validate.ts` | Config validation |
| New: `commands/rules.ts` | Rule pack listing |
| `cli.ts` | Register all new commands |

**Effort:** L (1–2 weeks)

---

### ANVIL.4 — Polish + Developer Delight

**Shell completions:**

`flint completions bash` / `flint completions zsh` / `flint completions fish`

Generates shell completion scripts. Commander has plugins for this (`commander-completions` or manual generation).

**Smart error recovery:**

When a command fails, suggest the fix:

```
 Error: No design tokens found at .flint/design-tokens.json

  To get started:
    1. Run `flint init` to generate a config
    2. Add tokens manually, or connect to Figma:
       `flint sync`
```

Every error message ends with a concrete next step. No dead ends.

**npx zero-install experience:**

```
npx @flinthq/cli audit src/
npx @flinthq/cli init
```

Works without global install. Package.json script suggestion in `flint init` output:

```json
{
  "scripts": {
    "lint:design": "flint audit src/",
    "lint:design:fix": "flint fix src/"
  }
}
```

**CI-optimized output:**

Auto-detect CI environment (`process.env.CI`) and switch to compact output:
- No progress bars (they spam CI logs)
- No color (unless `FORCE_COLOR` is set)
- Machine-parseable summary line at the end

**Summary table:**

`flint audit --summary` outputs a compact table for README badges or Slack notifications:

```
| Metric     | Value |
|------------|-------|
| Health     | 85/100 (B) |
| Violations | 12 |
| Auto-fix   | 9 (75%) |
| Files      | 47 |
```

**Implementation:**

| Layer | Changes |
|-------|---------|
| New: `commands/completions.ts` | Shell completion generator |
| `utils/ansi.ts` | CI detection, `NO_COLOR` / `FORCE_COLOR` support |
| `commands/init.ts` | Add package.json script suggestion |
| All commands | Smart error messages with recovery suggestions |
| `cli.ts` | `--summary` global flag |

**Effort:** M (3–5 days)

---

## Feature Budget Gates

1. **Who is this for?** Developers — the CLI is their primary governance touchpoint. CI pipelines — the CLI runs in every PR. Neither audience is served by Glass or the VS Code extension.

2. **What behavior does this enable?**
   - ANVIL.1: Developers can *read* violations and *understand* fixes at a glance — which they can't with flat text output.
   - ANVIL.2: Developers can *approve fixes individually* and *see what they broke* — which they can't today.
   - ANVIL.3: Developers can *get live feedback while coding* — which requires stopping to manually re-run today.
   - ANVIL.4: Developers can *adopt Flint with zero friction* — which today requires reading docs.

3. **80% or 5%?** ANVIL.1 (beautiful output) is 100% — every CLI user sees it. ANVIL.2 (interactive fix) is 80% — most developers want to review before applying. ANVIL.3 (watch) is 80% for active development, less for CI-only. ANVIL.4 (polish) is cumulative quality.

4. **Maintenance cost?**
   - ANVIL.1: Low — output formatting, no new data flows
   - ANVIL.2: Medium — interactive stdin handling, delta extraction
   - ANVIL.3: Medium — file watcher, new command wrappers
   - ANVIL.4: Low — polish, no new architecture

5. **Can we validate without building?** ANVIL.1: Ship the new output format and measure whether developers share screenshots (the "Vitest effect"). ANVIL.2: Ship `flint diff` first (read-only, no risk) and see if adoption increases. ANVIL.3: `flint watch` can be validated by dogfooding on Flint's own codebase.

6. **What do we stop doing?** ANVIL.1-2 ship in Sprint 9 alongside Chronicle. ANVIL.3-4 ship in Sprint 10. No displacement needed — this is the developer experience track that has been absent while Counsel handled the designer experience.

---

## Sprint Placement

| ID | Name | Priority | Effort | Sprint | Dependencies | Status |
|----|------|----------|--------|--------|-------------|--------|
| ANVIL.1 | Identity + Beautiful Output | P1 | M | Sprint 9 | None | PROPOSED |
| ANVIL.2 | Interactive Fix + Local Diff | P1 | L | Sprint 9 | ANVIL.1 | PROPOSED |
| ANVIL.3 | Watch Mode + Missing Commands | P2 | L | Sprint 10 | ANVIL.1 | PROPOSED |
| ANVIL.4 | Polish + Developer Delight | P2 | M | Sprint 10 | ANVIL.1 | PROPOSED |

**Rationale:** ANVIL.1 is the foundation — every other phase builds on the new output renderer. ANVIL.2 is P1 because interactive fix and local diff are the two features that change developer behavior. ANVIL.3-4 are P2 — valuable but not blocking adoption.

---

## Citadel Name Rationale

**Anvil** — the blacksmith's workbench. Where Forge ignites new projects and Gate controls what ships, Anvil is where the developer does the hands-on work: shaping, fixing, inspecting. It's the surface where governance becomes tangible — not a dashboard you read, but a tool you use. The CLI is the anvil; each command is a hammer stroke.

---

## Competitive Positioning

No design governance tool has a CLI that developers *want* to use. Stylelint's output is plain. axe-core's CLI is functional but clinical. ESLint's formatters are pluggable but none show inline fixes. Biome set the bar for beautiful linter output in 2024 — Flint should match it and then exceed it with interactive fix and governance-specific features (health score, delta mode, pack management) that no general-purpose linter can offer.

The goal: a developer runs `flint audit` for the first time, sees the output, and thinks "I want this in every project."
