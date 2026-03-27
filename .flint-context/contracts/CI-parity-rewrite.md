# Contract: CI/CD Parity Rewrite (Phase CI.2)

**Date:** 2026-03-26
**Author:** Opus (approved by Justin Tiemann)
**Status:** APPROVED

---

## Problem

`bridge-ci/` is a frozen v1 fork with manually inlined linter copies. It has:
- 10 a11y rules (MCP has 50)
- No `flint.config.yaml` support (reads legacy `.flint/policy.json`)
- No enforcement service (PDP/PEP `ci_gate` decision point)
- No DTCG token format support
- No debt scoring, sync check, DBOM, or auto-fix
- Still named `bridge-ci` (pre-rename)
- Separate Babel AST linters that drift from MCP engine

A file that **passes CI** can be **blocked by MCP**. This is a governance integrity gap.

## Solution

Rewrite `flint-ci/` as a thin CLI shell that imports the MCP engine as a workspace dependency. Zero duplicated linter logic.

### Architecture

```
flint-ci/
  src/
    cli.ts              # Commander entrypoint with subcommands
    commands/
      audit.ts          # flint-gate audit (default) — Mithril + A11y + SARIF
      debt.ts           # flint-gate debt — design debt report (A-F grade)
      sync-check.ts     # flint-gate sync — token drift CI check
      dbom.ts           # flint-gate dbom — Design Bill of Materials
      fix.ts            # flint-gate fix — auto-fix (dry-run default)
    formatters/
      terminal.ts       # ANSI-colored terminal output
      sarif.ts          # SARIF 2.1.0 builder (all 50+ rule IDs)
      pr-comment.ts     # GitHub PR comment markdown
    github-action.ts    # @actions/core wrapper (reads inputs, posts comment)
    engine.ts           # Thin adapter: loads config, calls MCP linters
  package.json          # depends on @flint-gov/mcp (workspace:*)
  tsconfig.json
  vitest.config.ts
```

### Dependency chain

```
flint-ci/src/engine.ts
  imports from @flint-gov/mcp:
    - loadConfig, loadProjectConfig, projectConfigToPolicy
    - MithrilLinter.auditAll (6 visitors, CIEDE2000)
    - A11yLinter.audit / auditStructured (50 rules, 9 modules)
    - resolveEnforcement, getEnforcementAction (PDP/PEP)
    - generateDebtReport, computeHealthScore, scoreToGrade
    - generateDBOM, formatDBOMOutput
    - @babel/parser (parse)
```

### CLI commands

| Command | What it does | MCP parity |
|---------|-------------|------------|
| `flint-gate audit [paths...]` | Mithril + A11y audit, SARIF output, PR comment | `audit_ui_component` / `flint_audit` |
| `flint-gate audit --changed` | Audit only git-changed files | Same, scoped |
| `flint-gate debt [paths...]` | Design debt report (0-100 score, A-F grade) | `flint_debt_report` |
| `flint-gate sync` | Token sync health check (Figma drift detection) | `flint_sync_check` |
| `flint-gate dbom` | Design Bill of Materials (JSON/CycloneDX) | `flint_generate_dbom` |
| `flint-gate fix [paths...]` | Auto-fix violations (--dry-run default) | `flint_fix` |

### Enforcement integration

The `ci_gate` decision point from `flint.config.yaml` controls blocking behavior:

```yaml
enforcement:
  decision_points: [mcp_audit, export_gate, ci_gate]
  points:
    ci_gate:
      block_on: [coercive]
      warn_on: [normative]
      auto_fix_on: [normative, advisory]
```

When no YAML config exists, falls back to DEFAULT_POLICY (identical to current behavior).

### SARIF rule coverage

The SARIF builder must include rule definitions for ALL rules the MCP engine can emit:
- MITHRIL-COL (color drift, CIEDE2000)
- MITHRIL-TYP-001..005 (typography)
- MITHRIL-SPC-001 (spacing)
- MITHRIL-SHD-001 (shadow)
- MITHRIL-OPC-001 (opacity)
- MITHRIL-INL-001 (inline styles)
- SYNC-001 (token drift)
- SYNC-002 (orphaned token)
- A11Y-001..050 (all 50 WCAG 2.1 AA rules)

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Governance violations found (blocked by enforcement) |
| 2 | CLI usage error |
| 3 | Configuration error (invalid YAML, missing project root) |

### What gets deleted

- `bridge-ci/src/mithril-linter.ts` (replaced by MCP import)
- `bridge-ci/src/a11y-linter.ts` (replaced by MCP import)
- `bridge-ci/src/color-engine.ts` (replaced by MCP import)
- `bridge-ci/src/types.ts` (replaced by MCP type imports)
- All inlined linter logic

### What gets preserved

- SARIF output format (GitHub Code Scanning compatible)
- GitHub Actions integration (@actions/core, PR comments)
- CLI interface (`flint-gate` binary name)
- Exit code semantics (0 = pass, 1 = fail, 2 = usage error)

## Files

| File | Action | Owner |
|------|--------|-------|
| `flint-ci/package.json` | REWRITE — new deps, workspace link to @flint-gov/mcp | CI agent |
| `flint-ci/tsconfig.json` | REWRITE — project references to flint-mcp | CI agent |
| `flint-ci/src/cli.ts` | NEW — Commander-based CLI with subcommands | CI agent |
| `flint-ci/src/engine.ts` | NEW — MCP engine adapter | CI agent |
| `flint-ci/src/commands/audit.ts` | NEW — audit command (replaces old cli-gate.ts) | CI agent |
| `flint-ci/src/commands/debt.ts` | NEW — debt report command | CI agent |
| `flint-ci/src/commands/sync-check.ts` | NEW — sync health command | CI agent |
| `flint-ci/src/commands/dbom.ts` | NEW — DBOM export command | CI agent |
| `flint-ci/src/commands/fix.ts` | NEW — auto-fix command | CI agent |
| `flint-ci/src/formatters/terminal.ts` | NEW — ANSI terminal output | CI agent |
| `flint-ci/src/formatters/sarif.ts` | REWRITE — expanded rule catalog | CI agent |
| `flint-ci/src/formatters/pr-comment.ts` | REWRITE — richer report | CI agent |
| `flint-ci/src/github-action.ts` | REWRITE — uses new engine | CI agent |
| `bridge-ci/` | DELETE (replaced by flint-ci/) | CI agent |
| `CLAUDE.md` | UPDATE — CI section | Docs agent |

## Test plan

- Happy path: audit clean file → exit 0, no violations
- Mithril violations: color drift → SARIF + terminal output
- A11y violations: all 50 rules trigger on known-bad input
- Enforcement: ci_gate decision point honors coercive/normative/advisory
- UCFG: flint.config.yaml loaded and respected
- Legacy: .flint/policy.json fallback works
- Debt: generates score and grade
- SARIF: valid 2.1.0 schema, all rule IDs present
- PR comment: well-formed markdown
- Exit codes: 0, 1, 2, 3 all correct
- --changed: only git-changed files scanned
- --fix --dry-run: prints what would change, no file writes
