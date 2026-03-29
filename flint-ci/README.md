# Flint Governance Gate — CI/CD

Flint CI is the headless governance gate for your CI/CD pipeline. It audits React/TypeScript components for design system compliance, accessibility (WCAG 2.1 AA), and brand drift — failing builds when violations exceed thresholds. All checks run deterministically via AST analysis with no external network calls required.

## Quick Start — GitHub Actions

```yaml
name: Governance Gate

on: [push, pull_request]

jobs:
  flint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: jtiem/citadel-flint@v1
        id: flint
        with:
          project_root: .
          fail_on_warning: false
          sarif_output: flint-results.sarif

      - name: Upload SARIF to GitHub Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: flint-results.sarif
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `project_root` | Project root directory | No | `.` |
| `token_file` | Path to design tokens JSON file | No | `.flint/design-tokens.json` |
| `fail_on_warning` | Fail on amber-level (warning) violations | No | `false` |
| `sarif_output` | Path to write SARIF report (enables GitHub Code Scanning) | No | _(disabled)_ |
| `github_token` | GitHub token for PR comments | No | `${{ github.token }}` |

## Outputs

| Name | Description |
|------|-------------|
| `total_violations` | Total number of violations found |
| `critical_count` | Number of critical violations |
| `amber_count` | Number of amber-level violations |
| `health_score` | Design health score (0–100) |
| `sarif_file` | Path to the generated SARIF file (if `sarif_output` was set) |

## Grade Interpretation

Grades are computed from a health score (0–100). The score starts at 100 and is reduced by severity: critical violations cost 10 points each, warnings cost 3 points, info cost 1 point.

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent — minimal drift, ship confidently |
| B | 80–89 | Good — a few warnings, no blockers |
| C | 70–79 | Needs attention — growing technical debt |
| D | 60–69 | Unhealthy — CI exit code 1, team review required |
| F | 0–59 | Critical — blocked from export, must fix before shipping |

`flint-gate debt` exits 1 for D and F grades.

## CLI Usage

Install via npm or use directly from the repo:

```sh
npm install -g flint-ci   # or: node flint-ci/dist/cli.js
```

### `flint-gate audit [paths...]`

Scan source files for Mithril (design system) and Warden (WCAG 2.1 AA) violations.

```sh
# Audit the entire src/ tree
flint-gate audit src/

# Audit only files changed in this branch
flint-gate audit --changed

# Write SARIF output for GitHub Code Scanning
flint-gate audit src/ --sarif flint.sarif

# Fail on amber warnings as well as critical violations
flint-gate audit src/ --fail-on-warning

# Suppress known violations while adopting incrementally
flint-gate audit src/ --baseline

# Skip files unchanged since last audit (faster in large repos)
flint-gate audit src/ --cache
```

### `flint-gate debt [paths...]`

Generate a design debt health report with a score (0–100) and letter grade.

```sh
flint-gate debt src/
flint-gate debt src/ --format markdown
flint-gate debt src/ --track   # appends snapshot to .flint/debt-history.json
```

### `flint-gate sync`

Check token sync health — detects drift between local design tokens and Figma.

```sh
flint-gate sync
```

### `flint-gate dbom`

Generate a Design Bill of Materials: token inventory, component compliance, and governance status.

```sh
flint-gate dbom
flint-gate dbom --format markdown
flint-gate dbom --format cyclonedx
```

### `flint-gate fix [paths...]`

Auto-fix governance violations using AST surgery. Dry-run by default.

```sh
flint-gate fix src/              # preview changes only
flint-gate fix src/ --no-dry-run # apply fixes
```

### `flint-gate baseline [paths...]`

Snapshot current violations into `.flint/baseline.json` to enable incremental adoption — only new violations fail CI.

```sh
flint-gate baseline src/
flint-gate baseline src/ --update   # merge with existing baseline
```

### `flint-gate init`

Generate a starter `flint.config.yaml` for your project.

```sh
flint-gate init
flint-gate init --force   # overwrite existing config
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Pass — no blocking violations |
| `1` | Blocked — violations found (or grade D/F for `debt`) |
| `2` | Usage error |
| `3` | Config error |

## SARIF and GitHub Code Scanning

When `sarif_output` is set (GitHub Actions input) or `--sarif <file>` is passed (CLI), the action writes a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) report. Upload it with `github/codeql-action/upload-sarif` to get inline violation annotations directly on pull request diffs.

Each violation appears as a code scanning alert with rule ID, severity, and a plain-language explanation of why it matters.

## Configuration

Flint reads `flint.config.yaml` from your project root. Generate a starter config with `flint-gate init`, or see the [Flint MCP documentation](../flint-mcp/README.md) for the full configuration reference.

Key fields for CI:

```yaml
gates:
  export:
    blockOnCritical: true
    blockOnAmber: false

mithril:
  deltaEThreshold: 2.0   # CIEDE2000 color drift tolerance

a11y:
  mode: strict            # strict | standard | advisory
```
