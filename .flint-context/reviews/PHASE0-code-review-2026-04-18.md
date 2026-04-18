# PHASE 0 — Coverage Honesty: Code Review

- **Phase:** PHASE0
- **Dimension:** code
- **Reviewer:** flint-code-reviewer
- **Date:** 2026-04-18
- **Round:** 1
- **Verdict:** FIX-FORWARD (0 blocking, 5 warnings, 4 suggestions)

## Executive Summary

Phase 0 lands the "Coverage Honesty" observability layer cleanly. The implementation is **deterministic, additive, and well-tested**, respects all 16 Commandments where applicable, and avoids the most common architectural anti-patterns (no store-IPC coupling, no regex source surgery, no stray `fs`/`ipcRenderer` in React). The contract-to-implementation correspondence is strong: every testBoundary has a real assertion, the 8-rule classifier is purely AST-driven, and the `coverage-grade-independence = 0` invariant is structurally guaranteed by the code ordering in `debtReportService.ts` (coverage is computed AFTER the health score is finalized).

The IPC handlers are currently **stubbed to return zero-state** — they validate the wire format end-to-end but do not yet delegate to `DebtReportService.getCoverageSummary()`. This is explicitly documented in both handlers and is called out in the phase as "swap is a one-line change." The contract's `coverage-emit-parity = 1.0` invariant is satisfied *within* `generateDebtReport` (every file scanned gets a verdict) but the StatusBar badge will show `0% / idle` until the handlers are wired to `debtReportService`. Users running a scan today will not see a non-zero number — flagged WARN-1.

A few smaller concerns sit in the warning tier: the `CoverageBadgeProps` contract type is unused (the actual component reads from the hook directly, taking no props — a reasonable deviation from the contract, but it means the typed prop contract is dead code), `non-jsx-framework` doubles as the reason for both framework mismatches and parse failures (misleading), Angular `.component.ts` detection is documented but not implemented, and `coverage-badge-click-latency < 50ms at p95` has no benchmark file in the suite.

The 4 suggestions are style-grade: dead-code trim in the contract types, a `non-parseable` reason code for future Phase 1 work, richer JSDoc on the classifier helpers, and a clean-up pass on the duplicate coverage type declarations between `shared/coverage-types.ts` and `src/types/flint-api.d.ts`.

**TSC:** 0 errors (verified).
**Tests:** MCP 5287/5287, Glass 2834/2836 (2 pre-existing StatusBar failures unrelated to Phase 0), Core 2368/2368.

## Rubric

| Criterion | Result |
|-----------|--------|
| C2 — Dot colors come from a declared map, no raw hex/literal Tailwind in className string construction | pass |
| C4 — No external network URLs introduced; classifier is pure | pass |
| C5 — CoverageBadge carries aria-label conveying percentage and hinting at popover | pass |
| C5 — Badge is a real `<button>` (not a clickable div); Escape key dismisses popover | pass |
| C13 — Classifier uses Babel AST traversal only; no regex on source code | pass |
| C13 — `VAR_NO_FALLBACK` regex is against a CSS variable *value* string (not source code) | pass |
| C14 — No new `fs`/`git`/SQLite imports in `src/` | pass |
| C14 — `.flint/coverage-cache.json` write lives inside MCP engine process, not Glass | pass |
| Every renderer→main IPC channel has a Zod validator in `shared/ipc-validators.ts` | pass |
| Zod validator is referenced by name in the `.contract.ts` `validator` field | pass |
| Web build (`server/index.ts`) mirrors the Electron handler with the same Zod schema | pass |
| Hook does not call `window.flintAPI` inside a Zustand store action | pass |
| No Zustand store imports another store | pass (no store added) |
| Every `CoverageReason` enum value has at least one classifier unit test | pass |
| Property-based test covers the parsed/reason-null invariant over 100 inputs | pass |
| `npx tsc --noEmit` exits 0 | pass |
| `coverage-grade-independence = 0` is structurally enforced (coverage computed AFTER healthScore) | pass |
| `coverage-emit-parity = 1.0` enforced inside `generateDebtReport` | pass |
| `coverage-emit-parity = 1.0` visible to the user via the StatusBar | fail — handler returns zero-state until wired to `DebtReportService` (WARN-1) |
| `coverage-badge-click-latency < 50ms at p95` is benchmarked | fail — no benchmark file (`CoverageBadge.bench.test.tsx` absent) (WARN-2) |
| `CoverageBadgeProps` type from the contract is actually used by the component | fail — component takes no props, reads from hook (WARN-3) |
| Classifier distinguishes "wrong framework" from "parse failure" in its reason code | fail — both emit `non-jsx-framework` (WARN-4) |
| `isAngularComponent` matches `.component.ts` per its JSDoc | fail — only `.component.html` matched (WARN-5) |

## Findings

### WARN-1 — StatusBar will display 0% / idle in production until IPC handler is wired to DebtReportService

**File:** `electron/main.ts:6557-6578`, `server/index.ts:4080-4101`

The `flint:getCoverageSummary` handler in both the Electron main process and the Express/WS web server returns a hard-coded zero-state summary. The real `debtReportService.computeCoverageSummary()` is implemented and `generateDebtReport()` writes `.flint/coverage-cache.json` — but neither handler reads that cache or calls into `DebtReportService`. Consequence: when a user runs `flint_debt_report` and the StatusBar badge fires its initial `getSummary()` on mount, the badge will render `idle` with the "—" placeholder even though a debt scan just completed.

The code comments acknowledge this:

```ts
// Until the flint-mcp-specialist lands `debtReportService.getCoverageSummary()`, this
// handler returns a zero-state CoverageSummary so the StatusBar badge has a
// valid shape to render. The swap to the real service is a one-line change.
```

This is a FIX-FORWARD warning (the plumbing is correct; only the final integration call is missing), but it breaks the user-visible value promise of Phase 0 — which is "see what Flint is actually governing." Without the wire-up, users see 0% / idle regardless.

**Proposed fix:** Read `.flint/coverage-cache.json` from the handler body. The cache is already written by `generateDebtReport()` at `debtReportService.ts:519-523`. Something like:

```ts
const cachePath = path.join(activeProjectRoot, '.flint/coverage-cache.json')
if (fs.existsSync(cachePath)) {
  const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
  return ipcSchemas['flint:getCoverageSummary'].response.parse(cached)
}
return zeroState
```

Or, preferred: import `DebtReportService` and call the getter directly. This also unifies the Electron and web handlers.

**Scope:** one-file × 2 (electron/main.ts + server/index.ts).

### WARN-2 — Missing `CoverageBadge.bench.test.tsx` — the click-latency invariant is declared but not measured

**File:** `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts:638-641`

The contract declares invariant `coverage-badge-click-latency < 50ms at p95`, measured by `CoverageBadge.bench.test.tsx` + `performance.now()`. No such file exists in the suite. The existing `CoverageBadge.test.tsx` verifies correctness of click propagation but not the p95 latency floor. Since the handler path is `useMemo → derived constants`, latency is almost certainly under 50ms, but the invariant is currently unfalsifiable.

**Proposed fix:** Either (a) add a minimal benchmark that fires 100 clicks and asserts p95 with `performance.now()`, or (b) downgrade the invariant in the contract to a derived expectation (memoized values + button element = <1ms) with a note that the full benchmark is deferred.

**Scope:** one-file (new bench file) OR contract text revision.

### WARN-3 — `CoverageBadgeProps` from the contract is dead — actual component takes no props

**File:** `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts:195-200`, `src/components/editor/CoverageBadge.tsx:75`

The contract exports `CoverageBadgeProps` with `summary: CoverageSummary | null` and `onClick: () => void`, but the real component signature is `export function CoverageBadge()` — it calls `useCoverageSummary()` directly inside the component and manages its own popover state. The typed prop contract is not imported anywhere. This is a reasonable implementation choice (encapsulation beats prop drilling for a self-contained badge) but the contract is now documenting a shape that does not exist in production.

**Proposed fix:** Either update `CoverageBadgeProps` in the contract to reflect the actual no-props design, or — if the uncontrolled-badge pattern is preferred — delete `CoverageBadgeProps` from the contract so it doesn't confuse future readers.

**Scope:** one-line (contract revision).

### WARN-4 — `non-jsx-framework` reason conflates "wrong framework" with "parse failure"

**File:** `flint-mcp/src/core/coverageClassifier.ts:441-457`

Rule 1 returns `{ status: 'skipped-unsupported', reason: 'non-jsx-framework' }` both when the file extension is a known non-JSX framework (`.vue`, `.svelte`) AND when the file is a `.tsx`/`.ts`/`.jsx` that failed to parse (ast === null). A `.tsx` with a syntax error gets reason `non-jsx-framework` with details `"Could not parse file"`. This is misleading in the popover — users seeing 5 files skipped for "Non-JSX framework (Vue, Svelte, Angular)" will have no way to know 2 of them are actually parse failures in their own TSX code.

The reason list is append-only (wire-stability rule), so the fix is to add a new reason code in a later phase, not rename. For Phase 0 the workable fix is either (a) a popover copy revision that acknowledges both failure modes under the same label, or (b) smuggle the real cause into `details` and surface it in the popover.

**Proposed fix:** Add a `parse-failure` reason in Phase 1 (append-only). For Phase 0, surface `details` in the popover beneath each reason count so the difference is observable even if the bucket is shared.

**Scope:** one-file (popover) + one-line (add to reason enum in Phase 1).

### WARN-5 — `isAngularComponent` JSDoc claims `.component.ts` support but only `.component.html` matches

**File:** `flint-mcp/src/core/coverageClassifier.ts:84-87`

```ts
function isAngularComponent(filePath: string): boolean {
    // Angular component templates: *.component.html or *.component.ts with @Component decorator
    return filePath.endsWith('.component.html')
}
```

The comment documents two code paths but only one is implemented. An Angular `.component.ts` with a `@Component` decorator + inline `template:` string will parse as TS and slip through to Rules 2–8 (likely landing as `parsed`). Not catastrophic — Angular TS files are rare in Flint-governed projects — but the doc lies.

**Proposed fix:** Either implement the `.component.ts` + `@Component` decorator check (would need to traverse the AST for a `ClassDeclaration` with a `Decorator` whose expression is a `CallExpression` with callee name `Component`), or strip the outdated comment.

**Scope:** one-line (strip comment) or one-file (add decorator detection).

### SUG-1 — Dead `CoveragePopoverProps` duplication

**File:** `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts:202-207`, `src/components/editor/CoveragePopover.tsx:40-45`

`CoveragePopoverProps` is defined in both the contract (exported) and inside the component file (local interface). The component uses its own local type, not the contract export. Same dead-code pattern as WARN-3 but for the popover.

**Proposed fix:** Import `CoveragePopoverProps` from the contract (or `shared/coverage-types.ts` once it's moved there) rather than redeclaring locally. Minor.

**Scope:** one-file.

### SUG-2 — Classifier helper JSDoc is sparse

**File:** `flint-mcp/src/core/coverageClassifier.ts:130-426`

Rule checkers (`checkCssInJs`, `checkCssModulesReference`, `checkDynamicClassExpression`, etc.) each have a one-line JSDoc naming the rule but do not document which edge cases are intentionally covered (aliased imports, namespace imports, local utilities with the same name). Given the `reason-completeness = 0` property-based test catches behavior but not intent, a future maintainer changing these will lack context.

**Proposed fix:** Expand each rule's JSDoc with 2–3 bullets describing priority, false-positive defenses, and known limitations. Non-blocking.

**Scope:** one-file.

### SUG-3 — `CoverageSummary` shape is declared twice: in `shared/coverage-types.ts` AND in `src/types/flint-api.d.ts`

**File:** `src/types/flint-api.d.ts:1612-1665` (approx)

The flint-api typings re-declare `CoverageSummary`, `CoverageReason`, etc. as a renderer-side mirror "for parallel agent coordination." With Phase 0 complete, the mirror is no longer serving that purpose and creates two sources of truth that can drift.

**Proposed fix:** Replace the renderer-side mirror with `import type { CoverageSummary } from '../../shared/coverage-types'` and delete the duplicate declarations.

**Scope:** one-file.

### SUG-4 — `mithrilParity.test.ts` allowlists `auditAllWithCoverage` as MCP-only — confirm this is intentional long-term

**File:** `shared/__tests__/mithrilParity.test.ts`

`auditAllWithCoverage` is allowlisted as MCP-only; the Electron Mithril linter does not expose it. This is correct for Phase 0 (Glass reads coverage from IPC, not from a direct linter call) but worth confirming the allowlist persists when/if Electron-side linting ever calls the new entrypoint.

**Proposed fix:** Add a comment in the allowlist explaining *why* `auditAllWithCoverage` is excluded (Glass consumes coverage via IPC from the MCP engine, not via direct Mithril call), so the next contributor doesn't inadvertently "fix the drift."

**Scope:** one-line.

## Scope Coverage

**Reviewed:**
- `shared/coverage-types.ts`
- `shared/ipc-validators.ts`
- `flint-mcp/src/core/coverageClassifier.ts`
- `flint-mcp/src/core/MithrilLinter.ts` (Phase 0 additions)
- `flint-mcp/src/core/A11yLinter.ts` (Phase 0 additions)
- `flint-mcp/src/core/dashboard/debtReportService.ts` (Phase 0 additions)
- `flint-mcp/src/core/sessionContext.ts` (Phase 0 additions)
- `flint-mcp/src/core/__tests__/coverageClassifier.test.ts`
- `flint-mcp/src/core/__tests__/MithrilLinter.coverage.test.ts`
- `flint-mcp/src/core/__tests__/A11yLinter.coverage.test.ts`
- `flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts`
- `electron/main.ts` (Phase 0 handler)
- `electron/preload.ts` (Phase 0 bridge)
- `electron/__tests__/coverageIpc.test.ts`
- `server/index.ts` (Phase 0 handler)
- `src/adapters/web-api.ts` (Phase 0 adapter)
- `src/types/flint-api.d.ts` (Phase 0 type mirror)
- `src/hooks/useCoverageSummary.ts`
- `src/hooks/__tests__/useCoverageSummary.test.ts`
- `src/components/editor/CoverageBadge.tsx`
- `src/components/editor/CoveragePopover.tsx`
- `src/components/editor/StatusBar.tsx` (Phase 0 mount)
- `src/components/editor/__tests__/CoverageBadge.test.tsx`
- `src/components/editor/__tests__/CoveragePopover.test.tsx`
- `.flint-context/contracts/PHASE0-coverage-honesty-contract.md`
- `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts`

**Skipped:**
- `flint-mcp/src/core/__tests__/fixtures/coverage/*` — verified existence and count (9 fixtures match contract); not line-reviewed.
- Full Mithril linter outside Phase 0 additions — out of scope.
- Full A11y linter outside Phase 0 additions — out of scope.
- Full sessionContext outside the `coverage-cache.json` read — out of scope.
- Full `shared/ipc-validators.ts` outside the Phase 0 schema entry — out of scope.
- Pre-existing 2 StatusBar failures — confirmed unrelated to Phase 0 (they predate the `<CoverageBadge />` mount).
