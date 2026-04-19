# PHASE 2 — PostCSS Parser + CSS Modules + Tailwind v4 CSS-First

**Status:** APPROVED
**Architect:** flint-architect
**Date:** 2026-04-18
**Audience:** engine
**Companion:** [`PHASE2-postcss-css-modules.contract.ts`](./PHASE2-postcss-css-modules.contract.ts)

Phase 2 is the third and final phase of the CSS/styling governance expansion. Phase 0 made coverage honest; Phase 1 closed Tailwind config + class composition. Phase 2 closes the four remaining CSS/styling reasons that still silently skip in mainstream React projects.

After Phase 2, the ONLY remaining coverage reasons are genuinely out-of-scope:
- `css-in-js-detected` → Phase 3
- `non-jsx-framework` → Phase 4
- `non-literal-ternary-branch` with truly dynamic branches → inherent static-analysis limit
- `parse-failure` → user syntax errors, not a Flint gap

---

## 1. Impact Map

| # | File | Change | Owner | Summary |
|---|------|--------|-------|---------|
| 1 | `flint-mcp/src/core/cssStylesheetLoader.ts` | CREATE | `flint-mcp-specialist` | PostCSS parser for `.css`/`.scss`/`.sass`/`.less`/`.pcss`/`.module.*` files. Extracts `:root` custom properties, `@theme` blocks, `@keyframes`, `@apply`. mtime cache. Graceful `parse-error` handling — never throws. Pure parsing, zero JS execution. |
| 2 | `flint-mcp/src/core/cssCustomPropertyMap.ts` | CREATE | `flint-mcp-specialist` | Builds a project-wide `Map<'--name', value>` from ParsedStylesheets. Walks `var(--a, var(--b, <lit>))` fallback chains. Last-import-wins on conflicts. `.resolve(expr)` helper for MithrilLinter. |
| 3 | `flint-mcp/src/core/cssModulesResolver.ts` | CREATE | `flint-ast-surgeon` | Walks ImportDeclarations from a pre-parsed Babel AST; resolves each `*.module.*` import via postcss-modules. Accepts `projectRoot` and rejects any path whose resolution escapes it (SECURITY: `path-outside-project`). Returns per-import `localClassName → scopedClassName` maps. Missing/malformed modules degrade to `resolved: false`. |
| 4 | `flint-mcp/src/core/tailwindV4ThemeParser.ts` | CREATE | `flint-ast-surgeon` | Normalizes `@theme {}` declarations into the Phase 1 `ResolvedTailwindTheme.sections` shape. Emits `knownClasses` so MithrilLinter treats v4 CSS-first themes identically to JS configs. |
| 5 | `flint-mcp/src/core/coverageClassifier.ts` | MODIFY | `flint-ast-surgeon` | Accept new optional inputs from `ClassifierInputV3`. Upgrade four reasons to `parsed` on successful resolution. Phase 0 + Phase 1 upgrade paths preserved. |
| 6 | `flint-mcp/src/core/MithrilLinter.ts` | MODIFY | `flint-mcp-specialist` | Append optional `customPropertyMap` + `cssModulesMaps` to `AuditAllOptions` (additive only). Extend `parseCssColorToHex` to consult the map for bare `var(--x)`. Treat `s.active` member-expressions as literal class strings when `cssModulesMaps` is present. |
| 7 | `flint-mcp/package.json` | MODIFY | `flint-mcp-specialist` | Add `postcss` (^8.4.0), `postcss-scss` (^4.0.0), `postcss-modules` (^6.0.0). Bundle size delta asserted < 3MB. |
| 8 | `flint-mcp/src/core/__tests__/cssStylesheetLoader.test.ts` | CREATE | `flint-test-writer` | Plain CSS, SCSS, CSS Modules variant, malformed → parse-error, missing → file-not-found, `:root` extraction, `@layer base { :root }`, `@theme` capture, `@keyframes` capture, non-root ignored, mtime cache, too-large. |
| 9 | `flint-mcp/src/core/__tests__/cssStylesheetLoader.bench.ts` | CREATE | `flint-test-writer` | 50 cold-cache parses on a 10KB token CSS; 1000 cache-hit calls. |
| 10 | `flint-mcp/src/core/__tests__/cssCustomPropertyMap.test.ts` | CREATE | `flint-test-writer` | Single-file, multi-file merge (last-wins), chained fallback, unresolvable chain, empty input. Bench: `< 50ms` per stylesheet. |
| 11 | `flint-mcp/src/core/__tests__/cssModulesResolver.test.ts` | CREATE | `flint-test-writer` | Fidelity suite against 20-fixture corpus. Default/namespace/named imports, missing module, parse error, no classes, kebab-case, nested dir, scss module, non-module filename, alias path (skipped), path-traversal (SECURITY — rejects `../../../etc/passwd.module.css`). |
| 12 | `flint-mcp/src/core/__tests__/fixtures/css-modules/` | CREATE | `flint-test-writer` | ≥ 20 `.module.css` + `.tsx` + `expected.json` triples covering every resolver edge case. |
| 13 | `flint-mcp/src/core/__tests__/tailwindV4ThemeParser.test.ts` | CREATE | `flint-test-writer` | Basic `@theme`, dark variants, empty `@theme`, multiple blocks merged, `@theme` inside `@layer`, malformed block. |
| 14 | `flint-mcp/src/core/__tests__/coverageClassifier.test.ts` | MODIFY | `flint-test-writer` | Add Phase 2 upgrade cases (+ negative regression guards for each of the 4 reasons). |
| 15 | `flint-mcp/src/core/__tests__/MithrilLinter.css-integration.test.ts` | CREATE | `flint-test-writer` | `var(--primary)` resolves via map → drift fires / suppresses; `s.active` via cssModulesMaps linted as class `"active"`; auditAll signature unchanged. |

---

## 2. Type Contracts

All exported TypeScript types live in [`PHASE2-postcss-css-modules.contract.ts`](./PHASE2-postcss-css-modules.contract.ts). Phase 2 agents import them directly — this markdown section summarizes the surface for human review.

### cssStylesheetLoader

```ts
export type StylesheetSyntax = 'css' | 'scss' | 'sass' | 'less' | 'pcss'

export interface CustomPropertyDeclaration {
  name: string       // includes leading '--'
  value: string
  selector: string   // ':root', 'html', ':where(:root)', etc.
  line: number
}

export interface TailwindV4ThemeBlock {
  rawDeclarations: ReadonlyArray<{ name: string; value: string; line: number }>
  sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
  startLine: number
}

export interface KeyframeDeclaration { name: string; line: number }

export interface ParsedStylesheet {
  sourcePath: string
  syntax: StylesheetSyntax
  mtimeMs: number
  customProperties: readonly CustomPropertyDeclaration[]
  themeBlocks: readonly TailwindV4ThemeBlock[]
  keyframes: readonly KeyframeDeclaration[]
  applyDirectives: readonly { selector: string; classes: readonly string[]; line: number }[]
}

export type StylesheetLoadError =
  | 'file-not-found' | 'parse-error' | 'unsupported-syntax' | 'too-large' | 'unknown'

export type StylesheetLoadResult =
  | { ok: true; stylesheet: ParsedStylesheet }
  | { ok: false; error: StylesheetLoadError; details: string; sourcePath: string }

export interface CssStylesheetLoader {
  load(absolutePath: string): Promise<StylesheetLoadResult>
  invalidate(absolutePath: string): void
  reset(): void
}
```

### cssCustomPropertyMap

```ts
export interface CustomPropertyMap {
  readonly map: ReadonlyMap<string, string>     // key includes leading '--'
  resolve(varExpression: string): string | null // walks fallback chain
  readonly sourcePaths: readonly string[]
}

export interface CustomPropertyMapBuilder {
  build(input: { stylesheets: readonly ParsedStylesheet[] }): CustomPropertyMap
}
```

### cssModulesResolver

```ts
export interface CssModuleClassBinding {
  localClassName: string
  scopedClassName: string
  line: number
}

export interface ResolvedCssModuleImport {
  bindingName: string                        // local JS import name
  modulePath: string                         // absolute .module.css path
  classBindings: readonly CssModuleClassBinding[]
  namedImports: readonly { imported: string; local: string }[]
  resolved: boolean
  failureReason:
    | 'module-not-found'
    | 'module-parse-error'
    | 'no-classes-exported'
    | 'path-outside-project'   // SECURITY: resolved path escapes projectRoot
    | null
}

export interface CssModulesResolution {
  sourcePath: string
  imports: readonly ResolvedCssModuleImport[]
}

export interface CssModulesResolver {
  // projectRoot is SECURITY-CRITICAL — rejects imports whose resolved path
  // falls outside the project boundary (no filesystem probe of /etc/passwd etc.).
  resolve(input: {
    sourcePath: string
    projectRoot: string
    ast: t.File
  }): Promise<CssModulesResolution>
}
```

### tailwindV4ThemeParser

```ts
export interface TailwindV4ThemeParseResult {
  sourcePath: string
  sections: Partial<Record<ResolvedTailwindThemeSection, Record<string, string>>>
  knownClasses: ReadonlySet<string>
  blockCount: number
}

export interface TailwindV4ThemeParser {
  parse(stylesheet: ParsedStylesheet): TailwindV4ThemeParseResult
}
```

### Classifier additive inputs

```ts
export interface ClassifierInputV3 {
  externalStylesheets?: readonly StylesheetLoadResult[]
  cssModules?: CssModulesResolution
  customPropertyMap?: CustomPropertyMap
  tailwindV4Theme?: TailwindV4ThemeParseResult
}
```

### MithrilLinter additive options

```ts
export interface AuditAllOptionsV3Additive {
  customPropertyMap?: CustomPropertyMap
  cssModulesMaps?: CssModulesResolution
  // tailwindTheme (Phase 1 field) is REUSED — callers pre-merge v4 @theme
  // into it before invoking auditAll.
}
```

---

## 3. IPC Channels

**None.** Phase 2 is MCP-engine-only. Zero IPC channels added. Zero preload changes. Zero Glass UI changes. Coverage % updates automatically via Phase 0's pipeline once classifier verdicts change.

---

## 4. Store Contracts

**None.** No new state slices, no new actions, no new selectors.

---

## 5. Component Contracts

**None.** Zero React component changes.

---

## 6. Commandment Checklist

| # | Commandment | Rationale |
|---|-------------|-----------|
| **C2** | No Hallucinated Styling | v4 `@theme` tokens + resolved custom properties become legitimate drift-free values, closing a false-negative gap. |
| **C8** | Audit-First Execution | Stylesheet parse is an audit step before any linter runs; mtime cache avoids redundant work. |
| **C9** | CIEDE2000 ΔE Logic | Resolved custom-property + v4 theme values feed the existing CIEDE2000 engine unchanged. |
| **C13** | Deterministic Surgery | PostCSS is a pure AST parser. No regex on CSS source; no regex on source code anywhere. `cssModulesResolver` reads ImportDeclarations from a pre-parsed Babel AST — never re-parses. |
| **C14** | Bypass Prohibition | Phase 2 is pure READ (no disk writes → no FileTransactionManager needed). Critically, Phase 2 adds NO JS execution surface: no `vm`, no `eval`, no `new Function()`. This is the security delta vs Phase 1. No sandbox is needed because there is nothing to sandbox. Path-traversal closed via `projectRoot`-bounded resolution in `cssModulesResolver`. |

---

## 7. Implementation Order

### Phase 2.A (parallel) — Pure services
- **`flint-mcp-specialist`** — create `cssStylesheetLoader.ts`, `cssCustomPropertyMap.ts`, update `package.json` (add postcss deps). Wire MithrilLinter `AuditAllOptionsV3Additive` fields.
- **`flint-ast-surgeon`** — create `cssModulesResolver.ts`, `tailwindV4ThemeParser.ts`. Update `coverageClassifier.ts` to accept `ClassifierInputV3`.

These two agents can run in parallel — they share no files. The classifier modification depends only on the type surface in the `.contract.ts`, which is already frozen.

### Phase 2.B (parallel with 2.A, finalized after) — Tests
- **`flint-test-writer`** — scaffold from `testBoundaries` (it.todo first), then fill in real assertions after 2.A lands. Build the 20-fixture CSS Modules corpus immediately (no dependency on implementation).

### Phase 2.5 — Review gate
- `/review` runs pre-commit. TSC + full test suite must pass.

### Phase 3 — Integration validation
- `flint-integration-validator` confirms the invariants are met and SHIPs.

---

## 8. Risks

| # | Risk | Severity | Commandment | Mitigation |
|---|------|----------|-------------|------------|
| 1 | Hostile CSS (unterminated, deeply nested, huge files) could throw / OOM / DoS the audit | **High** | C14 | Two-layer defense: fs.stat size cap (2MB) BEFORE reading bytes + try/catch around every PostCSS parse. All errors map to `parse-error`. No error ever bubbles. Explicit security testBoundaries for malformed + too-large. |
| 2 | CSS Modules scoped-name generation varies across bundlers — `scopedClassName` may not match user's actual output | Medium | C9 | Mithril consumes `localClassName` (developer-facing) for drift; `scopedClassName` is advisory. Fidelity invariant asserts ≥ 0.95 on localClassName only. **Corpus downscope note:** 20 fixtures vs Phase 1's 50 is deliberate — fidelity invariant scopes to `localClassName` only (non-goal #9 excludes scoped-name variations), so the smaller corpus still exercises every semantically distinct resolver path. |
| 3 | v4 `@theme` prefix → section-key mapping is easy to get wrong (`--color-*` → colors, `--spacing-*` → spacing, etc.) | Medium | C2 | Implement the official v4 prefix table; unit-test every prefix; unknown prefixes dropped silently. |
| 4 | Last-wins merge in customPropertyMap could shadow the "correct" value if user's import order is unusual | Low | C9 | Document the rule; expose `sourcePaths` for diagnostics; future work can surface resolution path in warnings. |
| 5 | 2MB size cap rejects large bundled CSS — silent coverage loss | Low | — | Log a clear warning on `too-large`; document the cap; future issue to revisit the limit. |
| 6 | cssModulesResolver reads user-controlled paths — risk of probing outside project root | Medium | C14 | `path.resolve(dirname(sourcePath), spec)` + post-resolution `path.relative(projectRoot, resolved)` rejection of any path starting with `..`. Alias paths (`@/...`) fail with `module-not-found` (no filesystem probe). Logged warnings rate-limited. Covered by the dedicated SECURITY-CRITICAL `path-traversal rejected` testBoundary. |
| 7 | postcss + postcss-scss + postcss-modules bloat the flint-gate CLI bundle | Low | — | Dynamic `await import()` inside the loader; tree-shaken when no CSS files audited. Size delta asserted < 3MB. |

---

## 9. Non-Goals (binding — empty is the #1 Phase 2 scope-creep source)

1. **No JavaScript execution.** No `vm`, no `eval`, no `new Function()`. PostCSS is pure parsing. Security delta vs Phase 1.
2. **No cross-stylesheet `@import` transitive resolution.** Each stylesheet parsed in isolation.
3. **No SCSS `@mixin` / `@function` / `$variable` evaluation.** Syntax parsed via postcss-scss; semantics not executed.
4. **No auto-fix for stylesheet drift.** Pure read. CSS rewrites are a future user-initiated pipeline.
5. **No change to the debt grade formula.** Phase 0 non-goal #2 still binding.
6. **No HTML `<style>` / Vue `<style>` / Svelte `<style>` / Angular component styles.** That's Phase 4.
7. **No new MCP tools. No IPC. No Glass UI changes.** Existing `audit_ui_component` / `flint_audit` / `flint_debt_report` benefit automatically.
8. **No CSS Module path-alias resolution.** Only relative paths. `@/styles/...` fails with `module-not-found`.
9. **No honoring user-custom `generateScopedName` functions.** Default postcss-modules template only. `localClassName` is correct regardless.

---

## 10. Invariants (all falsifiable, measurable)

| # | Name | Threshold | Measured by |
|---|------|-----------|-------------|
| 1 | `cssStylesheetLoader-parse-10KB-p95` | `< 100ms at p95 over 50 cold calls` | `cssStylesheetLoader.bench.ts :: cold-parse-10KB` |
| 2 | `cssStylesheetLoader-cache-hit` | `< 10ms at p95 over 1000 calls` | `cssStylesheetLoader.bench.ts :: cache-hit warm` |
| 3 | `cssCustomPropertyMap-build-per-sheet` | `< 50ms avg over 10 stylesheets / 50 decls` | `cssCustomPropertyMap.test.ts :: build-10-sheets bench` |
| 4 | `cssModulesResolver-fidelity` | `>= 0.95` (19/20 fixtures) | `cssModulesResolver.test.ts :: fixture corpus diff` |
| 5 | `coverage-upgrade-parity` | `= 1.0` (all resolvable flip, none unresolved flip) | `coverageClassifier.test.ts :: Phase 2 upgrade describe` |
| 6 | `phase0-grade-formula-stability` | `= 0` delta | `debtReportService.coverage.test.ts :: Phase 2 parity` |
| 7 | `auditAll-signature-stability` | `= 0` call-site modifications | `npx tsc --noEmit` on unchanged call-site fixture |

---

## 11. Parallelism Groups

```
A: flint-mcp-specialist, flint-ast-surgeon   (pure services + classifier)
B: flint-test-writer                         (scaffolds + 20-fixture corpus)
```

---

## 12. Self-Check Results

| # | Check | Result |
|---|-------|--------|
| 1 | `meta.audience` = `'engine'` | ✓ |
| 2 | Every invariant threshold contains `<`, `>`, `=` and a unit | ✓ (7/7) |
| 3 | Every testBoundary has given/when/then with imperative `then` verb | ✓ (28 boundaries — 27 Phase 2 + 1 SECURITY-CRITICAL path-traversal; all verbs: returns/emits/calls) |
| 4 | IPC validators linked | N/A — zero IPC channels |
| 5 | `nonGoals.length >= 1` | ✓ (9 non-goals) |
| 6 | `.contract.ts` compiles standalone (`npx tsc --noEmit`) | ✓ (0 errors) |
| 7 | Every `impact[].owner` is a real agent in `.claude/agents/` | ✓ (flint-mcp-specialist, flint-ast-surgeon, flint-test-writer) |
| 8 | Every owner appears in `parallelismGroups` | ✓ |
| 9 | Commandment audit (C2, C8, C9, C13, C14) — 5 total | ✓ |
| 10 | Markdown ↔ TypeScript agree on IPC count (0), types, commandments | ✓ |
