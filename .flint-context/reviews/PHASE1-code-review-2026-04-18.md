# PHASE 1 — Code Review

**Phase:** PHASE1-tailwind-config-class-composition
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-18
**Round:** 1
**Dimension:** code
**Verdict:** FIX-FORWARD (derived — 0 blocking, 3 warnings, 3 suggestions)

---

## Scope

Reviewed:

- `flint-mcp/src/core/tailwindConfigLoader.ts` (675 LOC, new)
- `flint-mcp/src/core/classExpressionExpander.ts` (680 LOC, new)
- `flint-mcp/src/core/coverageClassifier.ts` (classifier upgrade diff)
- `flint-mcp/src/core/MithrilLinter.ts` (auditAll + visitClassNames diff)
- `flint-mcp/src/core/__tests__/tailwindConfigLoader.test.ts` (29 tests)
- `flint-mcp/src/core/__tests__/classExpressionExpander.test.ts` (51 tests)
- `flint-mcp/src/core/__tests__/fixtures/tailwind-configs/` (10 configs)
- `flint-mcp/src/core/__tests__/fixtures/class-expressions/` (50 fixtures)
- `flint-mcp/package.json` (dep additions)
- Contract artifact: `.flint-context/contracts/PHASE1-tailwind-config-class-composition.contract.ts`

Skipped (out of Phase 1 scope):

- `flint-mcp/src/core/A11yLinter.ts` — RUNTIME.1 axe-core comment append, not Phase 1
- `flint-mcp/src/core/config.ts` — RUNTIME.1 `isRuntimeAxeEnabled` helper, not Phase 1
- `flint-mcp/src/core/governance/ruleProvenanceRegistry.ts` — RUNTIME.1 `runtime-dom` authority
- `flint-mcp/src/core/governance/types.ts` — RUNTIME.1 `SourceAuthority` union extension
- `src/`, `server/`, `shared/ipc-validators.ts`, `electron/` — RUNTIME.1 runtime/axe UI + IPC work

---

## Narrative

Phase 1 lands a tight, well-bounded engine change. The sandbox implementation is the
highest-risk surface and it holds up under inspection: `vm.runInNewContext` is used
with a minimal sandbox object, the custom `require` enforces the documented allowlist,
and three security tests explicitly verify that `fs`, `process.env`, `http`, and `fetch`
all fail closed and that error details do not leak file contents or env var values.
The 2000ms timeout is enforced both at the `vm.Script` level (CPU) and via a
Promise.race wall-clock fallback with a 100ms grace.

The class expression expander is a well-structured partial evaluator. It reads the
AST without mutation (Commandment 13), builds a binding table from ImportDeclarations
only, and evaluates `clsx` / `cva` / `classnames` / `twMerge` call sites with
clear, documented rules for each expression kind. All 51 test cases pass. cva handling
correctly skips `defaultVariants` and extracts `compoundVariants` leaf strings into
`possible`.

The MithrilLinter integration is additive: `AuditAllOptions` gains two optional
fields (`tailwindTheme`, `classExpansions`) and the existing signature is preserved.
A new internal `_knownTailwindClasses` option threads the theme's class set through
every visitor that checks class strings, short-circuiting drift detection for
theme-derived utilities. Theme sections are merged into the `tokens` array as
synthetic `collection_name: "tailwind"` entries. The coverage classifier upgrade
correctly suppresses `tailwind-config-extension` when `tailwindConfig.ok === true`
and suppresses `dynamic-class-expression` only when **all** expansions are resolvable
and the array is non-empty.

Three concerns prevent an immediate SHIP verdict:

1. **Unscoped edits in the same branch.** `A11yLinter.ts`, `config.ts`,
   `governance/ruleProvenanceRegistry.ts`, `governance/types.ts`, and most of
   `src/`, `server/`, and `electron/` contain changes labeled `RUNTIME.1` for an
   axe-core runtime adapter. This is a second in-progress swarm bleeding into the
   Phase 1 commit. The contract's `auditAll-signature-stability = 0` invariant
   is still met by the Phase 1 diff alone, but mixing two phases in a single
   commit makes the artifact non-atomic and violates the Contract-First workflow.

2. **Fixture corpus is not executed.** The 50-fixture class-expression corpus in
   `__tests__/fixtures/class-expressions/` exists and has matching `.expected.json`
   siblings, but `classExpressionExpander.test.ts` never reads them. All 51 tests
   use inline source strings. The contract's fidelity invariant
   (`classExpressionExpander-fidelity >= 0.95`) is therefore unverifiable from
   the current test suite — it is claimed but not measured.

3. **Preset-trust escape is noted but under-documented.** `sandboxRequire` at
   line 166 returns `safeRequire(specifier)` for allowlisted specifiers, which
   will load a community `tailwindcss-*` preset with full Node privileges. Line
   173 says "tailwindcss internals are trusted" but does not explicitly flag
   the community-preset risk surface or link it to a security note / risk entry.
   Contract non-goals don't mention it either. If an attacker publishes
   `tailwindcss-evil`, a project that installs it bypasses the sandbox.

None of the findings block merge — all are fix-forward. Two tests flipping from
`.skip` to live in `coverageClassifier.test.ts` also increased real coverage,
which is a positive signal.

---

## Findings

### WARN-1 · Unscoped edits outside Phase 1 contract in the same working tree

**Severity:** warning
**Scope:** cross-file
**Commandment:** —

**Evidence:**

- `flint-mcp/src/core/A11yLinter.ts:15-34` — RUNTIME.1 appended comment block referencing `RUNTIME-<axe-id>` rule IDs and `runtime-dom` authority
- `flint-mcp/src/core/config.ts:287-293, 459-501` — `rules.runtime.axe` config block + `isRuntimeAxeEnabled` helper
- `flint-mcp/src/core/governance/ruleProvenanceRegistry.ts:685-713` — `RUNTIME-` prefix branch in `resolveProvenance`
- `flint-mcp/src/core/governance/types.ts:24-29` — `'runtime-dom'` added to `SourceAuthority`
- `src/store/canvasStore.ts`, `src/components/editor/StatusBar.tsx`, `src/types/flint-api.d.ts`, `server/index.ts` — also dirty per `git status`
- `.flint-context/contracts/RUNTIME.1-contract.md`, `RUNTIME.1.contract.ts` — untracked contract files from the parallel swarm

**Observed:** The working tree contains two distinct phases — Phase 1 (Tailwind
config + class composition) and RUNTIME.1 (axe-core runtime adapter) — under a
single branch. The Phase 1 review scope per the prompt excludes RUNTIME.1 files,
but a naive `git commit` from this tree would ship both.

**Rationale:** The Contract-First workflow demands that a phase's commit contains
only its contract-attributed changes. Mixing swarms breaks bisect-ability, makes
rollback surgical rather than atomic, and weakens the claim that Phase 1 is
"additive only." The Phase 1 contract's `auditAll-signature-stability = 0`
invariant is still upheld by the Phase 1 slice, but the commit as a whole needs
to be split before it lands.

**Proposed fix:** Stash or split the RUNTIME.1 files into their own branch
(`feat/runtime.1-axe-adapter`) before committing Phase 1. `git add` only the files
attributed to Phase 1:
`flint-mcp/src/core/tailwindConfigLoader.ts`,
`flint-mcp/src/core/classExpressionExpander.ts`,
`flint-mcp/src/core/MithrilLinter.ts`,
`flint-mcp/src/core/coverageClassifier.ts`,
`flint-mcp/src/core/__tests__/tailwindConfigLoader.test.ts`,
`flint-mcp/src/core/__tests__/tailwindConfigLoader.bench.ts`,
`flint-mcp/src/core/__tests__/classExpressionExpander.test.ts`,
`flint-mcp/src/core/__tests__/MithrilLinter.tailwind-theme.test.ts`,
`flint-mcp/src/core/__tests__/coverageClassifier.test.ts`,
`flint-mcp/src/core/__tests__/fixtures/**`,
`flint-mcp/package.json`,
and the Phase 1 contract artifacts.

---

### WARN-2 · Fixture corpus exists on disk but is not executed by the test suite

**Severity:** warning
**Scope:** one-file
**Commandment:** —

**Evidence:**

- `flint-mcp/src/core/__tests__/fixtures/class-expressions/` — 50 `.tsx` + 50 `.expected.json` files
- `flint-mcp/src/core/__tests__/classExpressionExpander.test.ts:1-670` — 51 `describe()` blocks, none read from the fixture directory
- `grep "fixtures/class-expressions" classExpressionExpander.test.ts` returns zero matches
- Contract invariant `classExpressionExpander-fidelity >= 0.95` (from
  `PHASE1-tailwind-config-class-composition.contract.ts`)

**Observed:** The 50-fixture corpus is committed but not driven by the tests.
The contract defines a fidelity invariant of >=0.95 (47.5/50 minimum), but the
test suite measures that threshold against inline sources that happen to loosely
correspond to fixtures 1-51, not against the fixture files themselves.

**Rationale:** Fidelity is a headline contract invariant and one of the key
reasons Phase 1 justifies its own phase gate. If the fixtures are reference
cases, they should be iterated by the suite so a delta in the expander silently
changes an expected output and fails loudly. As is, a developer could edit
`02-clsx-single-arg.expected.json` to anything and nothing would fail.

**Proposed fix:** Add a fixture runner in `classExpressionExpander.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
const FIX_DIR = path.join(__dirname, 'fixtures/class-expressions')
const cases = readdirSync(FIX_DIR).filter(f => f.endsWith('.tsx')).sort()
describe.each(cases)('fixture %s', (tsx) => {
  it('matches expected.json', () => {
    const source = readFileSync(path.join(FIX_DIR, tsx), 'utf8')
    const expected = JSON.parse(readFileSync(
      path.join(FIX_DIR, tsx.replace('.tsx', '.expected.json')), 'utf8'))
    const got = expand(source)
    expect(got.map(stripLine)).toEqual(expected)
  })
})
```

Fidelity can then be measured as `passing / total >= 0.95` and reported as a
single assertion the contract can verify.

---

### WARN-3 · Community preset-trust escape surface is not documented as a risk

**Severity:** warning
**Scope:** one-line
**Commandment:** 14

**Evidence:**

- `flint-mcp/src/core/tailwindConfigLoader.ts:115-122` — `isAllowedSpecifier` allows `/^tailwindcss-[a-z0-9-]+$/`
- `flint-mcp/src/core/tailwindConfigLoader.ts:166-175` — `sandboxRequire` returns
  `safeRequire(specifier)` unchanged for allowed specifiers
- `flint-mcp/src/core/tailwindConfigLoader.ts:173` — inline comment reads
  `"tailwindcss internals are trusted"` — does not call out community presets
- `.flint-context/contracts/PHASE1-tailwind-config-class-composition.contract.ts` —
  `nonGoals` does not list community preset trust

**Observed:** Any npm package whose name matches `tailwindcss-<kebab>` is loaded
with full Node privileges. The sandbox prevents top-level `require('fs')` in the
user's `tailwind.config.js`, but not `require('tailwindcss-evil')` where the
preset itself calls `fs` or spawns a child process.

**Rationale:** Commandment 14 (Bypass Prohibition) is about Flint-code paths,
not third-party npm packages — this escape is a trust model, not a bug. But the
user may reasonably expect that "vm.runInNewContext with frozen sandbox" blocks
all file/network/env access, including transitively. The risk surface should be
documented explicitly so a security-conscious user can disable it by project
policy (e.g. by locking the allowlist to `tailwindcss` + `@tailwindcss/*` only).

**Proposed fix:** Add a JSDoc note to `sandboxRequire` (line 166) explaining the
trust boundary, and add an explicit entry to contract `nonGoals`:

```ts
/**
 * SECURITY NOTE: Allowlisted npm packages (tailwindcss, @tailwindcss/*,
 * tailwindcss-<name> community presets) load with full Node privileges.
 * The sandbox prevents the user's config.js from calling fs/http/process
 * directly, but NOT from loading a preset that does. Lock the allowlist
 * or audit presets before installing.
 */
```

Also add to contract `nonGoals`: `"Community-preset trust model — allowlisted
tailwindcss-* packages run with full Node privileges; project is expected to
audit its npm dependencies."`

---

### SUG-1 · `detectTailwindVersion` heuristic is fragile

**Severity:** suggestion
**Scope:** one-file

**Evidence:**

- `flint-mcp/src/core/tailwindConfigLoader.ts:642-661` — detection checks for
  `@tailwindcss/vite` / `@tailwindcss/postcss` import strings in source text

**Observed:** The v3/v4-js detection reads the raw source for substring matches
and a `_v4` / `__isTailwindV4` escape hatch on the config object. A v4 config
that uses a different postcss plugin name or a v3 config that imports
`@tailwindcss/vite` (unusual but possible) will be mis-classified.

**Rationale:** Low-impact — only affects the `version` label on the result, not
behavior. But worth a note for Phase 2.

**Proposed fix:** Read `require('tailwindcss/package.json').version` inside the
sandbox where possible, or defer version detection to Phase 2 when v4 CSS-first
is implemented.

---

### SUG-2 · `resolveConfig` try/catch silently falls through

**Severity:** suggestion
**Scope:** one-line

**Evidence:**

- `flint-mcp/src/core/tailwindConfigLoader.ts:332-340` — `try { resolved = resolveConfig(rawConfig) } catch { /* fall through */ }`

**Observed:** If Tailwind's `resolveConfig` throws (malformed user config, version
skew), we silently use the unresolved raw config. No log, no diagnostic, no
changed return value.

**Rationale:** The user won't see why their `extend` tokens didn't merge. Silent
failure hides bugs.

**Proposed fix:** Capture the error and attach it as `theme._resolveConfigWarning`
or return `{ ok: false, error: 'resolve-config-threw' }` as the existing error
type already accommodates.

---

### SUG-3 · MithrilLinter: theme-token merge does not respect existing token `collection_name` precedence

**Severity:** suggestion
**Scope:** one-file

**Evidence:**

- `flint-mcp/src/core/MithrilLinter.ts:1919-1961` — `mergeThemeTokens` checks
  `token_path` uniqueness only; theme tokens always win if no existing path
  matches, regardless of collection

**Observed:** When a project has its own design-tokens.json with
`collection_name: "brand"` defining `primary.500`, and the Tailwind config also
extends `primary.500`, the merge uses existing-path uniqueness. If there's a
naming collision via different path prefixes (e.g., `primary.500` in brand vs
`tailwind.primary.500` from the theme), both will coexist and CIEDE2000 will
match against both.

**Rationale:** Minor — the prefix `tailwind.` namespaces theme tokens, so true
collisions are rare. But advisory: if a future theme section uses an unprefixed
path, collisions become silent.

**Proposed fix:** Document the precedence rule at the top of `mergeThemeTokens`
or extend the uniqueness check to `(token_path, collection_name)`.

---

## Rubric

| Criterion                                                                  | Result  | Evidence |
|----------------------------------------------------------------------------|---------|----------|
| `vm.runInNewContext` is used for user config evaluation (C14)             | pass    | `tailwindConfigLoader.ts:212` |
| Sandbox object contains zero Node built-ins (process/fs/http/etc)         | pass    | `tailwindConfigLoader.ts:183-204` |
| Custom `require` rejects non-allowlisted specifiers                        | pass    | `tailwindConfigLoader.ts:166-175` + test `returns sandbox-violation when config calls require("fs")` |
| 2000ms timeout enforced at vm.Script and wall-clock AbortController race   | pass    | `tailwindConfigLoader.ts:208-212, 557-566` |
| Error details do not leak file contents or env var values                  | pass    | test `does NOT leak the env var value in details` |
| classExpressionExpander is read-only against AST (C13)                     | pass    | `classExpressionExpander.ts` — no `path.replaceWith` / `insertBefore` / `remove` |
| `AuditAllOptions` signature preserved (all new fields optional)            | pass    | `MithrilLinter.ts:1879-1915` |
| Coverage classifier upgrade suppresses tailwind-config-extension correctly | pass    | `coverageClassifier.ts:509-523` |
| Coverage classifier upgrade suppresses dynamic-class-expression correctly  | pass    | `coverageClassifier.ts:525-544` |
| All 5447 MCP tests pass, TSC exits 0                                       | pass    | `npx vitest run` + `npx tsc --noEmit` |
| Phase 1 commit is atomic (no unrelated file changes)                       | fail    | WARN-1 — RUNTIME.1 files in working tree |
| 50-fixture corpus is executed by the test suite                            | fail    | WARN-2 — fixtures exist but are not read |
| Community-preset trust model is documented as a risk                       | fail    | WARN-3 — no explicit note |
| cva handles compoundVariants correctly                                     | pass    | test `37: cva with compoundVariants` |
| cva skips defaultVariants                                                  | pass    | `classExpressionExpander.ts:549-550` + inline coverage |
| Renamed imports correctly resolve utility kind                             | pass    | tests 31-34 inline |
| Constraint fixtures (41-45 unresolvable) return `unresolvable: true`       | pass    | test suite includes unresolvable-identifier cases |

---

## Counts

- Blocking: 0
- Warning: 3
- Suggestion: 3

**Derived verdict:** FIX-FORWARD (0 blocking, 3 warnings → merge permitted, follow up on the 3 warnings in a follow-on commit)
