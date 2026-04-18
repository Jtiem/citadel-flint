# Contract: Phase 1 — Tailwind Config + Class Composition Expansion

**Phase:** PHASE1
**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-18
**Audience:** `engine` (MCP-only; zero Glass UI, zero IDE changes)

## Purpose

Close the two biggest false-negative paths for React + Tailwind projects exposed by Phase 0's honesty-first classifier:

1. **Tailwind config extensions were invisible.** `tailwind.config.{js,ts,mjs,cjs}` extensions (`theme.colors.primary = "#0066cc"`) were silently skipped. Files using `bg-primary` produced false positives (drift against a known token) or false negatives (passed without token verification).
2. **Dynamic class expressions were whole-skipped.** `clsx`, `cva`, `classnames`, `cn`, `twMerge`, `tw` calls were marked `dynamic-class-expression` and bypassed Mithril entirely. Most modern Tailwind components in the wild were partially ungoverned.

Phase 1 introduces two pure services to `flint-mcp/src/core/`:

- **`tailwindConfigLoader.ts`** — loads + resolves Tailwind configs via Tailwind's own `resolveConfig` helper, returning a normalized `ResolvedTailwindTheme` with a `knownClasses` set Mithril consumes.
- **`classExpressionExpander.ts`** — partial-evaluates class-utility calls into `{ definite, possible, unresolvable }` sets Mithril reads as additional class sources.

The coverage classifier flips matching `partial` verdicts to `parsed` when these services resolve successfully. MithrilLinter integrates both via additive `AuditAllOptions` fields — the existing 46 `auditAll` call sites compile and pass unchanged.

## Impact Map

| File | Change Type | Owner Agent | Summary |
|---|---|---|---|
| `flint-mcp/src/core/tailwindConfigLoader.ts` | CREATE | flint-mcp-specialist | Load + resolve `tailwind.config.{js,ts,mjs,cjs}` via Tailwind's `resolveConfig`; return `ResolvedTailwindTheme` with mtime cache and `v3 / v4-js / v4-css-unsupported` version detection |
| `flint-mcp/src/core/classExpressionExpander.ts` | CREATE | flint-ast-surgeon | Partial-evaluate clsx/cva/classnames/cn/twMerge/tw into `{ definite, possible, unresolvable }`. Local const StringLiteral/ObjectExpression/ArrayExpression identifiers resolve; non-local imports mark `unresolvable: true` |
| `flint-mcp/src/core/coverageClassifier.ts` | MODIFY | flint-ast-surgeon | Accept optional `tailwindConfig` + `classExpansions` inputs (additive). When loader returns `ok` and every expansion is resolvable, upgrade the matching `partial` verdict to `parsed` |
| `flint-mcp/src/core/MithrilLinter.ts` | MODIFY | flint-mcp-specialist | Append optional `tailwindTheme` + `classExpansions` to `AuditAllOptions` (additive only — signature preserved). Merge theme tokens into existing token set; iterate expanded classes in the `getClassString`-equivalent path |
| `flint-mcp/src/core/__tests__/tailwindConfigLoader.test.ts` | CREATE | flint-test-writer | v3 + v4-JS load, v4-CSS flagged unsupported, malformed config fails cleanly, missing config returns `config-not-found`, mtime cache round-trip, sandbox rejects fs/env reads |
| `flint-mcp/src/core/__tests__/classExpressionExpander.test.ts` | CREATE | flint-test-writer | 50-fixture corpus covering literal/object/array clsx, ternary + logical, renamed imports, cva variants, unresolvable identifiers, nested calls, tw-merge precedence |
| `flint-mcp/src/core/__tests__/coverageClassifier.test.ts` | MODIFY | flint-test-writer | Add cases: resolvable clsx literals flip to `parsed`; mixed `clsx(foo, bar)` stays `partial` with `dynamic-class-expression`; resolved `tailwind.config.js` flips to `parsed` |
| `flint-mcp/src/core/__tests__/MithrilLinter.tailwind-theme.test.ts` | CREATE | flint-test-writer | Extended theme `primary` token via `tailwindTheme` → `bg-primary` passes drift; absent token → drift fires. Expanded classes feed `visitClassNames`/`visitSpacing` |
| `flint-mcp/package.json` | MODIFY | flint-mcp-specialist | Add `tailwindcss` (for `resolveConfig`) and `esbuild` (for sandboxed TS config loading). PR check: bundle size delta < 5MB |

## Type Contracts (binding specification — see `.contract.ts`)

All TypeScript interfaces are defined in `PHASE1-tailwind-config-class-composition.contract.ts`. Phase 2 agents MUST import types from there, not duplicate them.

Key exports:
- `ResolvedTailwindThemeSection`, `ResolvedTailwindTheme`, `TailwindConfigLoadResult`, `TailwindConfigLoadError`
- `TailwindConfigLoader` (service interface)
- `ClassUtilityName`, `ExpandedClassExpression`, `ClassExpressionExpander` (service interface)
- `ClassifierInputV2` (additive fields on `ClassifierInput`)
- `AuditAllOptionsV2Additive` (additive fields on `AuditAllOptions`)

## IPC Channels

**None.** Phase 1 is MCP-engine-only. No IPC channels added, no preload changes, no Glass UI changes. Coverage % updates automatically through Phase 0's pipeline when classifier verdicts change.

## Store Contracts

**None.** No renderer-side state.

## Component Contracts

**None.** No new React components.

## Commandment Checklist

- [x] **C2 — No Hallucinated Styling.** Extended theme tokens become legitimate drift-free classes, closing a false-negative gap. Mithril now checks `bg-primary-500` against the resolved theme instead of flagging it as unmapped.
- [x] **C8 — Audit-First Execution.** The classifier upgrade step is itself an audit pass; complexity routing is unaffected but coverage signaling is now accurate.
- [x] **C9 — CIEDE2000 ΔE Logic.** Drift detection against expanded class sets uses the existing CIEDE2000 engine unchanged — no new color math.
- [x] **C13 — Deterministic Surgery.** classExpressionExpander traverses the pre-parsed Babel AST read-only, never regex on source. tailwindConfigLoader uses Tailwind's own `resolveConfig` helper — no source-string hacks.
- [x] **C14 — Bypass Prohibition.** tailwindConfigLoader sandboxes config evaluation via `vm.runInNewContext` with a stripped sandbox (no `process`, no `fs`, no `http`, no `fetch`, no unrestricted `require`). A custom `require` resolver allowlists ONLY `tailwindcss` / `@tailwindcss/*` / `tailwindcss-*`. Any config that attempts direct fs/env/network I/O returns `sandbox-violation` — codified via three dedicated test boundaries (fs, env, network). This is the single most security-critical invariant in Phase 1 and MUST be asserted by the integration validator.

Commandments in the `.contract.ts` commandments array: `[2, 8, 9, 13, 14]`.

Commandments NOT applicable: C1/C7/C11/C12 (no file writes, no git surgery, no save transactions), C3/C4/C5/C6 (no mutations, preview, a11y block, export gate), C10 (no undo surface), C15/C16 (no AI orchestrator path).

## Test Boundaries

Full set defined in `.contract.ts` `testBoundaries` array — 21 boundaries covering:

- **tailwindConfigLoader.load** (9 boundaries) — v3 config, v4-JS config, v4-CSS-first flagged unsupported, malformed config (syntax-error only), missing config `config-not-found`, mtime cache round-trip, AND three dedicated sandbox-violation boundaries: **fs access**, **env access**, **network access** (BLOCKING-3 fix — the most security-critical path now has executable contracts)
- **classExpressionExpander.expandAll** (6 boundaries) — literal clsx, object clsx, ternary + logical, renamed imports, cva variants, unresolvable identifier
- **coverageClassifier upgrade** (3 boundaries) — clsx literals → parsed, mixed clsx stays partial, tailwind.config resolved → parsed
- **MithrilLinter integration** (3 boundaries) — extended theme drift-free, expanded classes feed drift, auditAll signature stability

Every boundary has executable `given / when / then` with `then` starting with an imperative verb (returns/emits/blocks).

## Invariants (falsifiable, measurable thresholds)

| Name | Measurable | Threshold | Measured By |
|---|---|---|---|
| `tailwindConfigLoader-load-p95` | p95 wall-clock latency of `load()` on a 10KB config with 3 presets | `< 500ms at p95 over 50 cold-cache calls` | vitest bench |
| `tailwindConfigLoader-cache-hit` | p95 latency of cached load when mtime unchanged | `< 10ms at p95 over 1000 calls` | vitest bench case `cache-hit warm` in `flint-mcp/src/core/__tests__/tailwindConfigLoader.bench.ts` — one cold `load()` populates the cache, then 1000 back-to-back `load()` calls on the same projectRoot with mtime untouched |
| `classExpressionExpander-correctness` | Fraction of 50-fixture corpus where `expandAll` matches real utility runtime output | `>= 0.95 (at least 48/50 match)` | fidelity test suite diffs against runtime |
| `coverage-upgrade-parity` | Fraction of static-resolvable fixtures that flip `dynamic-class-expression → parsed` | `= 1.0 (100% flip)`; 0 unresolvable fixtures flip | coverageClassifier.test.ts Phase 1 upgrade describe block |
| `phase0-grade-formula-stability` | Delta in debt-report `healthScore + grade` for identical fixtures before/after Phase 1 with NO new violations | `= 0` (grade formula MUST NOT read Phase 1 signals — Phase 0 non-goal #2 still binding) | debtReportService.coverage.test.ts parity test |
| `auditAll-signature-stability` | Count of pre-Phase-1 `auditAll(...)` call sites requiring modification to compile | `= 0` (signature unchanged — additive options only) | `npx tsc --noEmit` on unchanged call-site fixture file |

## Implementation Order

**Group A (parallel, after contract approval):**

- `flint-mcp-specialist` — `tailwindConfigLoader.ts` + `MithrilLinter.ts` integration + `package.json` dep add
- `flint-ast-surgeon` — `classExpressionExpander.ts` + `coverageClassifier.ts` upgrade

**Group B (parallel with A, then finalize):**

- `flint-test-writer` — Scaffolds `it.todo` from `testBoundaries` immediately; fills in real assertions once services land

**Phase 2.5 Review gate (after A + B):**

- Run `/review` per the Contract-First Feature Build workflow — this replaces any ad-hoc code-reviewer step. Review findings must be resolved before git commit.

No IPC, no UI, no stores — so no electron-ipc / state-architect / design-engineer needed. No `flint-code-reviewer` agent exists; the workflow's `/review` gate is the only review step.

## Risks

| Risk | Severity | Commandment | Mitigation |
|---|---|---|---|
| Tailwind resolveConfig loads user presets that import Node built-ins, leaking env/fs access. Critical gotcha: esbuild alone only transpiles — it does NOT sandbox the Node runtime, so `require("fs")` inside a preset still works after transpilation. The sandbox must block the runtime, not the syntax. | high | C14 | **Runtime sandbox via `vm.runInNewContext`**. (1) Transpile user config with `esbuild.transformSync({ loader: "ts", format: "cjs", target: "node20" })` — NO bundling. (2) Evaluate inside `vm.runInNewContext(code, sandbox, { timeout: 2000 })` where `sandbox` is a frozen object containing ONLY `{ module, exports, __filename, __dirname, Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, console (noop shim), require (custom) }`. NO `process`, `global`, `fs`, `http`, `fetch`, `import`, `setTimeout`, `child_process`. (3) Custom `require(id)` allowlist: `tailwindcss` and `tailwindcss/*`, `/^@tailwindcss\//`, `/^tailwindcss-[a-z0-9-]+$/`. Any other specifier throws `sandbox-violation`. Allowed presets are re-evaluated in the SAME sandbox to prevent escape. (4) 2000ms CPU timeout + wall-clock `AbortController` race to handle event-loop starvation. (5) Error mapping: any ReferenceError for `process`/`fs`/`require` or thrown "sandbox-violation" maps to `{ ok: false, error: "sandbox-violation", details: <redacted> }` — details MUST NOT leak call arguments (redact to `fs.readFileSync(<redacted>)`). Asserted by the three dedicated fs/env/network test boundaries. |
| v3 vs v4 resolved theme shapes differ; a v4-specific key crashes the token merge | medium | C9 | Version-tag theme (`v3 | v4-js`); branch the normalizer; fall back to empty sections on unknown shapes rather than crash |
| Expander over-reports `possible` classes → sudden drift warning spike overwhelms users with previously clean audits | medium | — | Document that Phase 1 EXPOSES pre-existing drift; surface in release notes; `possible` channel treated as advisory for amber-tier rules |
| Expander mutates or re-traverses the AST, misattributing loc info for later passes | high | C13 | Expander is read-only — accepts pre-parsed AST, no `path.replaceWith`; unit test asserts AST object identity unchanged after `expandAll` |
| v4 CSS-first `@theme` silently fails; users perceive no Phase 1 win | low | — | Explicit `v4-css-first-unsupported` error + popover note pointing to Phase 2 |
| Adding `tailwindcss` dep bloats flint-gate CLI bundle | low | — | Dynamic `await import("tailwindcss/resolveConfig.js")` inside loader; bundler tree-shakes when loader unused; PR asserts < 5MB delta |

## Non-Goals

1. **Not resolving Tailwind v4 CSS-first `@theme` blocks.** v4's `@theme { --color-primary: #0066cc; }` requires a CSS parser; Phase 2.
2. **Not executing arbitrary TypeScript I/O in config files.** Sandboxed load — any `fs` / `env` / network use returns `sandbox-violation`.
3. **Not statically evaluating `cva` returned functions.** Captures variant class strings from the `variants` object only; does NOT evaluate runtime-selected variants.
4. **Not expanding imported non-literal class objects from other files.** Cross-file resolution is Phase 2+.
5. **Not auto-fixing newly-exposed drift.** Phase 1 EXPOSES; `flint_fix` fixes.
6. **Not adding new MCP tools.** Existing `audit_ui_component` / `flint_audit` / `flint_debt_report` benefit automatically.
7. **Not changing the debt-grade formula.** Phase 0 non-goal #2 still binding; coverage remains informational.
8. **Not touching Glass UI.** Zero `src/` changes; `CoverageBadge` / `CoveragePopover` / `StatusBar` update via Phase 0 pipeline.

## Architect Self-Check (10 rows)

| # | Check | Pass? |
|---|---|---|
| 1 | `meta.audience` = exactly one enum value | `'engine'` |
| 2 | Every `threshold` contains `<` / `>` / `=` / `≤` / `≥` and a unit | 6/6 invariants have operators + units |
| 3 | Every `TestBoundary` has given/when/then; `then` starts with imperative verb | 21/21 boundaries; all start with returns/emits/blocks |
| 4 | Every `renderer→main` / `bidirectional` IPC channel names a Zod validator | N/A — zero IPC channels (engine-only) |
| 5 | `nonGoals.length ≥ 1` | 8 non-goals |
| 6 | `.contract.ts` compiles standalone with `npx tsc --noEmit` | Verified — 0 errors |
| 7 | Every `impact[].owner` exists in `.claude/agents/` | flint-mcp-specialist / flint-ast-surgeon / flint-test-writer — all exist |
| 8 | Every `impact[].owner` appears in `parallelismGroups` | All three agents mapped to Group A or B |
| 9 | Applicable 16 Commandments listed with rationale | C2, C8, C9, C13, C14 listed (C14 added in revision — codifies vm.runInNewContext sandbox) |
| 10 | Markdown ↔ TypeScript agree (type names, counts, commandments) | 0 IPC ↔ 0 IPC, 21 boundaries ↔ 21 boundaries, 5 commandments ↔ 5 commandments, status APPROVED ↔ APPROVED |
