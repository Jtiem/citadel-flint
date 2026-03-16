# Bridge Strategic Expansion Plan — 7 Use Cases

**Date:** 2026-03-12
**Status:** PLANNING
**Baseline:** 347/347 bridge-mcp tests passing · 14 test files · TSC 0 errors
**Branch:** feature/mcp-pivot

---

## Executive Summary

Bridge's governance engine — AST parsing, DTCG token enforcement, CIEDE2000 perceptual distance, WCAG accessibility linting, and deterministic auto-fix — is currently scoped to design-to-code fidelity for a single project. This plan extends Bridge into **7 new use cases** that transform it from a developer tool into an enterprise platform. Each phase builds on existing infrastructure with minimal new dependencies.

---

## Phase 1: CI/CD Design Governance Gate

**Priority:** HIGHEST — lowest effort, largest market
**Effort:** 1 sprint (5 days)
**Depends on:** Existing `audit_ui_component` MCP tool, existing Export Gate logic

### What It Does

A GitHub Action (and generic CLI command) that runs `bridge audit` on every PR. Blocks merge when design violations exist — same as the Export Gate, but in CI instead of the desktop app.

### Why It Matters

- Turns Bridge from single-developer to **team-scale** infrastructure
- Every team using Tailwind + a design system is a potential user
- "Design linting in CI" is an emerging category with no dominant player
- The entire audit engine already exists — this is packaging, not building

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| CLI audit command | 1.1 | `bridge-mcp/src/cli.ts` | `bridge-mcp audit <glob> --tokens <path> --format json|sarif|github` — runs `audit_ui_component` logic headlessly, exits non-zero on violations |
| SARIF output formatter | 1.2 | `bridge-mcp/src/core/formatters.ts` | Output violations in SARIF format for GitHub Code Scanning integration |
| GitHub Action wrapper | 1.3 | `.github/actions/bridge-audit/action.yml` | Composite action: install bridge-mcp, run audit, post PR comment with violation summary |
| PR comment formatter | 1.4 | `bridge-mcp/src/core/formatters.ts` | Markdown table: severity, rule code, file:line, description, suggested fix |
| Threshold configuration | 1.5 | `bridge-mcp/src/core/config.ts` | `.bridge/ci-config.json` — configurable thresholds: `blockOn: ["CRITICAL"]`, `warnOn: ["AMBER"]`, `allowList: ["SPC-001"]` |
| Exit code semantics | 1.6 | `bridge-mcp/src/cli.ts` | `0` = clean, `1` = violations found, `2` = config error |

### Tests

- CLI audit on clean file → exit 0, empty violations array
- CLI audit on drifted file → exit 1, correct violation count and codes
- SARIF output validates against SARIF 2.1.0 schema
- Threshold config: AMBER violations + `blockOn: ["CRITICAL"]` → exit 0 (warn only)
- PR comment formatter produces valid Markdown with correct counts

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-architect` | Validate CLI/CI architecture before implementation |
| `cli-developer` | Build the CLI audit command and exit code semantics |
| `cicd-engineer` | Build GitHub Action wrapper and SARIF integration |
| `bridge-test-writer` | Write Vitest tests for all formatters and CLI paths |
| `bridge-code-reviewer` | Final review before merge |

### Deliverables

- `npx bridge-mcp audit "src/**/*.tsx" --tokens design-tokens.json` works standalone
- GitHub Action posts violation summary as PR comment
- SARIF upload enables GitHub Code Scanning "Security" tab integration

---

## Phase 2: Design Debt Quantification Report

**Priority:** HIGH — lowest effort, immediate business value
**Effort:** 1 sprint (3-5 days)
**Depends on:** Phase 1 CLI audit command

### What It Does

`bridge-mcp report <glob>` scans an entire codebase and produces a design debt report: total violations, breakdown by severity/category/file, trend over time, and a "Design Health Score" (0-100).

### Why It Matters

- Product managers and design leads use this to **justify design system investment**
- "Your codebase has 847 token violations — 23% are CRITICAL color drift" is a compelling artifact
- Nobody else quantifies design debt — this creates a new category
- Builds directly on Phase 1's CLI audit (just aggregation + scoring)

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| Report aggregator | 2.1 | `bridge-mcp/src/core/violations/reporter.ts` | Scan glob, collect all violations, aggregate by file/severity/category/rule |
| Health score algorithm | 2.2 | `bridge-mcp/src/core/violations/scorer.ts` | `score = 100 - (criticals * 10 + ambers * 3 + warnings * 1)` clamped to 0-100. Weighted by file count for normalization |
| Report output formats | 2.3 | `bridge-mcp/src/core/formatters.ts` | JSON, Markdown, HTML dashboard (single-file, Tailwind CDN) |
| Trend tracking | 2.4 | `bridge-mcp/src/core/violations/history.ts` | `.bridge/debt-history.json` — append score + violation counts per run with timestamp. CLI `--track` flag |
| CLI report command | 2.5 | `bridge-mcp/src/cli.ts` | `bridge-mcp report "src/**/*.tsx" --tokens <path> --format html --track` |
| MCP tool | 2.6 | `bridge-mcp/src/server.ts` | `bridge_debt_report` MCP tool — returns aggregated report as structured JSON |

### Tests

- Report on demo/ reference files → score 100, zero violations
- Report on demo/ drifted files → score < 100, correct category breakdown
- Health score edge cases: 0 files, all critical, mixed severity
- Trend history: multiple runs append correctly, JSON stays valid
- Markdown output matches expected format

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-ast-surgeon` | Build aggregator and scorer (works with existing violation types) |
| `cli-developer` | Wire CLI report command |
| `bridge-design-engineer` | Build HTML dashboard output (single-file Tailwind CDN page) |
| `bridge-test-writer` | Write tests for scorer, aggregator, and trend tracking |

### Deliverables

- `npx bridge-mcp report "src/**/*.tsx" --format html` generates a shareable design debt dashboard
- `bridge_debt_report` MCP tool returns structured data for AI-driven analysis
- Design Health Score: single number that communicates codebase quality to non-engineers

---

## Phase 3: Tailwind Version Migration (v3 → v4)

**Priority:** HIGH — timely market opportunity
**Effort:** 2 sprints (10 days)
**Depends on:** Existing AST parser, token matcher, class mapper

### What It Does

`bridge-mcp migrate-tw <glob> --from 3 --to 4` scans Tailwind v3 code and surgically transforms it to v4 syntax. Uses AST-level transforms (not regex), validates output against the design token set, and reports what changed.

### Why It Matters

- Every Tailwind project will face this migration — massive addressable audience
- Most migration tools use regex codemods that break on edge cases
- Bridge's AST approach produces **provably correct** output validated against design tokens
- Demonstrates Bridge's AST surgery capabilities to a new audience

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| TW migration rule set | 3.1 | `bridge-mcp/src/core/migrations/tailwind-v3-to-v4.ts` | Map of deprecated/changed classes: `bg-opacity-X` → `bg-color/X`, `flex-grow` → `grow`, config-based color names, etc. |
| AST class transformer | 3.2 | `bridge-mcp/src/core/migrations/classTransformer.ts` | Babel visitor: traverse JSX `className` attributes, apply migration rules, preserve non-Tailwind classes |
| Config migrator | 3.3 | `bridge-mcp/src/core/migrations/configMigrator.ts` | Transform `tailwind.config.js` → CSS-based config (Tailwind v4 pattern) |
| Migration report | 3.4 | `bridge-mcp/src/core/migrations/report.ts` | Per-file diff: old class → new class, line number, confidence level |
| Post-migration audit | 3.5 | Integration | Run `audit_ui_component` on migrated output to verify zero token violations |
| CLI migrate command | 3.6 | `bridge-mcp/src/cli.ts` | `bridge-mcp migrate-tw "src/**/*.tsx" --from 3 --to 4 --dry-run` |
| MCP tool | 3.7 | `bridge-mcp/src/server.ts` | `bridge_migrate_tailwind` MCP tool |

### Tests

- Each deprecated class maps correctly (30+ individual class transforms)
- Mixed className strings preserve non-Tailwind classes
- Dynamic/computed classNames left untouched with WARNING
- Config migration produces valid v4 CSS config
- End-to-end: v3 file → migrate → audit → zero violations
- Dry-run mode produces diff without modifying files

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-architect` | Design migration rule format and transformer architecture |
| `bridge-ast-surgeon` | Build AST class transformer and Babel visitors |
| `bridge-test-writer` | Write comprehensive class mapping tests |
| `bridge-code-reviewer` | Review migration accuracy |

### Deliverables

- `npx bridge-mcp migrate-tw "src/**/*.tsx" --from 3 --to 4` performs safe, AST-level migration
- Post-migration governance audit proves output is design-system compliant
- Migration report shows exactly what changed, where, and why

---

## Phase 4: White-Label / Multi-Brand Theming

**Priority:** MEDIUM — high value for SaaS companies
**Effort:** 2 sprints (10 days)
**Depends on:** Existing token system, audit engine

### What It Does

`bridge-mcp theme-validate <glob> --themes brand-a.json,brand-b.json` validates that a single codebase renders correctly under multiple brand token sets. Each theme is a DTCG token file; Bridge swaps tokens and re-audits to catch violations specific to each brand.

### Why It Matters

- SaaS companies building white-label products need to prove N brands work correctly
- Currently done manually or with visual regression (slow, flaky)
- Bridge's token-based approach is **deterministic** — "Brand B's primary color is #FF6600, and line 47 uses hardcoded #2563EB which won't resolve under this theme"
- Creates a new revenue stream: per-brand licensing

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| Multi-theme config | 4.1 | `bridge-mcp/src/core/config.ts` | `.bridge/themes/` directory, each file a DTCG token set with a theme name |
| Theme-aware audit | 4.2 | `bridge-mcp/src/core/violations/themeAuditor.ts` | Loop: load theme tokens → run audit → tag violations with theme name |
| Cross-theme report | 4.3 | `bridge-mcp/src/core/violations/themeReporter.ts` | Matrix output: violation × theme. "This violation appears in Brand B only because Brand B has no green-100 token" |
| Theme diff tool | 4.4 | `bridge-mcp/src/core/tokenMapper.ts` | Compare two theme token sets: missing tokens, value differences, coverage gaps |
| CLI command | 4.5 | `bridge-mcp/src/cli.ts` | `bridge-mcp theme-validate "src/**/*.tsx" --themes themes/` |
| MCP tool | 4.6 | `bridge-mcp/src/server.ts` | `bridge_validate_themes` MCP tool |

### Tests

- Single theme validation matches standard audit results
- Two themes: file using Brand A's unique token passes A, fails B
- Theme diff: correctly identifies missing/changed tokens
- Cross-theme report: correct matrix of violations per theme
- Zero-violation codebase passes all themes

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-architect` | Design theme configuration and audit loop architecture |
| `bridge-ast-surgeon` | Extend audit pipeline with theme context |
| `bridge-design-engineer` | Build cross-theme HTML report |
| `bridge-test-writer` | Write multi-theme test scenarios |

### Deliverables

- `npx bridge-mcp theme-validate "src/**/*.tsx" --themes themes/` validates all brands in one pass
- Cross-theme matrix report: "Brand B has 12 violations Brand A doesn't"
- Theme diff tool for comparing token coverage across brands

---

## Phase 5: Design System Version Migration

**Priority:** MEDIUM — recurring enterprise need
**Effort:** 2 sprints (10 days)
**Depends on:** Phase 3 class transformer pattern, token system

### What It Does

`bridge-mcp migrate-ds <glob> --from tokens-v4.json --to tokens-v5.json` maps old design tokens to new ones and surgically updates all consuming code. Handles renamed tokens, changed values, deprecated tokens, and new tokens.

### Why It Matters

- Every enterprise with a design system upgrades every 12-18 months
- Current process: manual search-and-replace, visual regression, weeks of QA
- Bridge makes it **deterministic**: "These 47 files reference `color.brand-blue` which was renamed to `color.primary` in v5"
- Same AST transform pipeline as Tailwind migration (Phase 3) — amortized effort

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| Token diff engine | 5.1 | `bridge-mcp/src/core/migrations/tokenDiff.ts` | Compare two DTCG token files: renamed, removed, value-changed, added tokens |
| Token migration map | 5.2 | `bridge-mcp/src/core/migrations/tokenMigrationMap.ts` | User-defined or auto-detected renames: `{ "color.brand-blue": "color.primary" }` |
| Class migration visitor | 5.3 | `bridge-mcp/src/core/migrations/classTransformer.ts` | Extend Phase 3 transformer: old Tailwind class (from old token) → new Tailwind class (from new token) |
| Migration validation | 5.4 | Integration | Post-migration audit against new token set → zero violations |
| CLI command | 5.5 | `bridge-mcp/src/cli.ts` | `bridge-mcp migrate-ds "src/**/*.tsx" --from old-tokens.json --to new-tokens.json --map renames.json` |
| MCP tool | 5.6 | `bridge-mcp/src/server.ts` | `bridge_migrate_design_system` MCP tool |

### Tests

- Token diff: correctly identifies renamed, removed, changed, and added tokens
- Auto-detection: tokens with same value but different name → suggest rename
- Class migration: old token's Tailwind class → new token's Tailwind class
- Mixed: some tokens renamed, some values changed, some removed → correct transforms + warnings for removed
- Post-migration audit on new tokens → zero violations

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-architect` | Design token diff algorithm and migration map format |
| `bridge-ast-surgeon` | Build token-aware class transformer |
| `bridge-test-writer` | Write token diff and migration tests |
| `bridge-code-reviewer` | Validate migration accuracy |

### Deliverables

- `npx bridge-mcp migrate-ds "src/**/*.tsx" --from v4.json --to v5.json` performs safe design system migration
- Token diff report: clear summary of what changed between versions
- Post-migration governance proves output is compliant with the new token set

---

## Phase 6: Accessibility Compliance Automation

**Priority:** MEDIUM-HIGH — large regulated market
**Effort:** 3 sprints (15 days)
**Depends on:** Existing A11yLinter (10 WCAG 2.1 AA rules)

### What It Does

Extend Bridge's 10-rule A11yLinter to full WCAG 2.1 AA coverage (~50 rules) with auto-fix capabilities, compliance reporting formats (VPAT, ACR), and domain-specific rule sets for Section 508 (government), HIPAA (healthcare), and ADA (general).

### Why It Matters

- Legal mandates: Section 508, ADA Title III, EU Accessibility Act (2025)
- Existing tools (axe, Lighthouse) detect but don't fix — Bridge does both
- Compliance reports (VPAT) are manually written today — Bridge can auto-generate from audit data
- The A11yLinter already exists with 10 rules — this is extension, not greenfield

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| Extended WCAG rules | 6.1 | `bridge-mcp/src/core/A11yLinter.ts` | Add 40+ rules: focus management, color contrast (APCA), ARIA roles, landmark regions, live regions, keyboard navigation, motion preferences |
| Auto-fix for a11y | 6.2 | `bridge-mcp/src/tools/fix.ts` | Extend `bridge_fix` with a11y auto-fixes: add missing labels, fix heading hierarchy, add ARIA attributes, add role landmarks |
| VPAT generator | 6.3 | `bridge-mcp/src/core/compliance/vpat.ts` | Generate Voluntary Product Accessibility Template from audit results — maps violations to WCAG success criteria |
| Domain rule sets | 6.4 | `bridge-mcp/src/domains/` | `healthcare/` (HIPAA UI requirements), `government/` (Section 508), `legal/` (ADA Title III) |
| Contrast checker (APCA) | 6.5 | `bridge-mcp/src/core/validators/strategies/apca.ts` | APCA (Advanced Perceptual Contrast Algorithm) — next-gen contrast ratio for WCAG 3.0 readiness |
| CLI and MCP | 6.6 | `bridge-mcp/src/cli.ts`, `server.ts` | `bridge-mcp a11y-audit`, `bridge_accessibility_report` MCP tool |

### Tests

- Each new WCAG rule has positive (violation) and negative (clean) test cases
- Auto-fix: each fixable rule produces correct output
- VPAT generator: output matches expected template format
- APCA contrast: calculations match reference implementation
- Domain rules: healthcare-specific rules only fire when healthcare domain is active

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-architect` | Design rule extension architecture and domain system |
| `bridge-accessibility` | Build new WCAG rules and APCA contrast checker |
| `bridge-ast-surgeon` | Build a11y auto-fix AST transforms |
| `compliance-auditor` | Validate VPAT output format and regulatory accuracy |
| `bridge-test-writer` | Write tests for all 40+ new rules |

### Deliverables

- 50+ WCAG 2.1 AA rules with auto-fix
- VPAT/ACR report generation for compliance documentation
- Domain-specific rule sets for government, healthcare, and legal verticals
- APCA contrast checking for WCAG 3.0 readiness

---

## Phase 7: Cross-Platform Token Sync

**Priority:** LOWER — high effort, medium market
**Effort:** 3 sprints (15 days)
**Depends on:** Phases 1-6 (token system maturity)

### What It Does

Same DTCG tokens powering multiple output targets: Tailwind (web), React Native StyleSheet (mobile), CSS custom properties (email/docs), Swift/Kotlin (native mobile). Bridge validates each platform's output against the single token source.

### Why It Matters

- "One design system, four platforms, zero drift" — enterprise aspiration, nobody delivers it
- Currently done with Style Dictionary or Theo — these generate tokens but don't **validate usage**
- Bridge adds the validation layer: "Your iOS app uses `UIColor(hex: "#3B82F6")` but the token is `#2563EB`"
- Extends Bridge beyond web into mobile and native — massive TAM expansion

### Implementation

| Task | ID | File(s) | Description |
|------|----|---------|-------------|
| Platform output targets | 7.1 | `bridge-mcp/src/core/platforms/` | Token transformer: DTCG → Tailwind classes, CSS vars, RN StyleSheet, Swift UIColor, Kotlin Color |
| Platform-specific parsers | 7.2 | `bridge-mcp/src/core/parsers/` | Extend parser registry: `.swift` (SwiftUI), `.kt` (Jetpack Compose), `.css` (vanilla), `.tsx` (React Native StyleSheet patterns) |
| Cross-platform audit | 7.3 | `bridge-mcp/src/core/violations/` | Audit non-Tailwind code against DTCG tokens: detect raw hex values that should be token references |
| Platform-specific rules | 7.4 | `bridge-mcp/src/domains/` | `mobile/` domain: RN-specific patterns, SwiftUI modifiers, Compose theme references |
| Sync validation | 7.5 | `bridge-mcp/src/core/platforms/syncValidator.ts` | Compare token usage across platforms: "Web uses `color.primary` in 47 places, iOS uses it in 12, Android uses it in 8 — 3 Android files use hardcoded hex instead" |
| CLI and MCP | 7.6 | `bridge-mcp/src/cli.ts`, `server.ts` | `bridge-mcp cross-platform-audit`, `bridge_cross_platform_report` MCP tool |

### Tests

- Token transformer: DTCG → each platform format matches expected output
- Platform parsers: extract color/spacing values from Swift/Kotlin/RN code
- Cross-platform audit: detect hardcoded values that should be token references
- Sync validation: correct per-platform usage counts and gap identification

### Agent Assignment

| Agent | Role |
|-------|------|
| `bridge-architect` | Design platform abstraction layer |
| `bridge-ast-surgeon` | Build platform-specific parsers |
| `swift-expert` | Swift/SwiftUI token extraction and validation |
| `kotlin-specialist` | Kotlin/Compose token extraction and validation |
| `mobile-developer` | React Native StyleSheet pattern detection |
| `bridge-test-writer` | Write cross-platform test suites |

### Deliverables

- DTCG → 5 platform output formats (Tailwind, CSS vars, RN, Swift, Kotlin)
- Cross-platform audit: detect token violations in non-web code
- Sync report: per-platform token coverage comparison

---

## Execution Timeline

```
Week 1-2:   Phase 1 — CI/CD Gate (ship fast, prove the model)
Week 2-3:   Phase 2 — Design Debt Report (builds on Phase 1 CLI)
Week 4-5:   Phase 3 — Tailwind Migration (first migration use case)
Week 6-7:   Phase 4 — White-Label Theming (enterprise value)
Week 8-9:   Phase 5 — DS Version Migration (reuses Phase 3 infra)
Week 10-12: Phase 6 — Accessibility Compliance (largest rule expansion)
Week 13-15: Phase 7 — Cross-Platform Sync (TAM expansion)
```

### Swarm Strategy

Each phase uses a **5-agent Expert Tier S squad** via `deploy_elite_swarm.cjs`:

| Role | Agent Type | Responsibility |
|------|-----------|---------------|
| Lead | `bridge-architect` | Architecture validation, design review |
| Builder | `bridge-ast-surgeon` or domain specialist | Core implementation |
| Integrator | `cli-developer` or `cicd-engineer` | CLI/MCP/CI wiring |
| Tester | `bridge-test-writer` | Comprehensive test coverage |
| Reviewer | `bridge-code-reviewer` | Final review, merge readiness |

### Dependency Graph

```
Phase 1 (CI/CD Gate)
  ├── Phase 2 (Design Debt Report) — uses Phase 1 CLI
  └── Phase 3 (Tailwind Migration)
        ├── Phase 5 (DS Version Migration) — reuses class transformer
        └── Phase 4 (White-Label Theming) — reuses audit loop
              └── Phase 7 (Cross-Platform Sync) — extends platform targets

Phase 6 (Accessibility) — independent, can parallelize with 3-5
```

### Success Metrics

| Phase | KPI | Target |
|-------|-----|--------|
| 1. CI/CD Gate | Time to integrate into existing repo | < 5 minutes |
| 2. Design Debt | Report generation time for 1000-file repo | < 30 seconds |
| 3. TW Migration | Class transform accuracy | > 99% |
| 4. White-Label | Themes validated per minute | > 10 |
| 5. DS Migration | Token remap accuracy | > 99% |
| 6. Accessibility | WCAG 2.1 AA rule coverage | > 90% |
| 7. Cross-Platform | Platforms supported | 5 (web, RN, CSS, Swift, Kotlin) |

---

## Competitive Moat

Each phase deepens Bridge's unique advantage:

1. **CI/CD Gate** — "Design linting as infrastructure" (no competitor does this)
2. **Design Debt** — "Quantified design health" (new category)
3. **TW Migration** — "Governance-verified migration" (codemods can't do this)
4. **White-Label** — "Multi-brand token validation" (Style Dictionary generates, Bridge validates)
5. **DS Migration** — "Deterministic token remapping" (manual today)
6. **Accessibility** — "Detect AND fix" (axe/Lighthouse only detect)
7. **Cross-Platform** — "Token governance beyond web" (nobody does this)

The compounding effect: by Phase 5, Bridge has the only tool that can migrate a design system, validate it across multiple brands, audit accessibility, and prove compliance — all through the same AST pipeline. That's an enterprise platform, not a developer tool.
