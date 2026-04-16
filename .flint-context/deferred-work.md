# Deferred Work

Work items intentionally pushed out of the sprint they were discovered in. Each entry records what was blocked, why it was deferred, the current no-op / stopgap state, and what a proper fix looks like so a future sprint can pick it up without re-discovering the problem.

---

## `flintConfig` → `ResolvedPolicy` migration in `server.ts`

**Deferred from:** Sprint 3 — Policy Engine Unification (2026-04-14)
**Decision source:** Sprint 3 architect note; contract non-goals.
**Blocking reason:** `server.ts` still calls `loadConfig(projectRoot)` after policy updates and keeps a `flintConfig` variable in the legacy v1 `FlintConfig` shape, adapted via `toLegacyFlintPolicy`. Migrating all downstream audit-threshold consumers to `ResolvedPolicy` would cascade into multiple tool handlers and is Sprint 4 territory (MCP Server + Registrations).

### Current state (Sprint 3 stopgap)
- `loadAndResolvePolicy()` is the unified surface; all new callers use it.
- `server.ts` retains one `loadConfig` + `toLegacyFlintPolicy` adapter call to keep audit thresholds working.
- v1 `FlintConfig` shape is NOT deleted — the adapter keeps it alive.

### Proper fix (Sprint 4)
- Replace the `flintConfig` variable with the `ResolvedPolicy` result from `loadAndResolvePolicy`.
- Update every downstream tool handler that reads `flintConfig.*` threshold fields to read from the equivalent `ResolvedPolicy` path.
- Remove the `toLegacyFlintPolicy` adapter and the v1 `FlintConfig` shape.

---

## MITHRIL-SPC-TOUCH visitor (Mithril fintech touch-target rule)

**Deferred from:** Sprint 1 — Governor Linters + Services Fixes (2026-04-12)
**Decision source:** R1 Assert+Defer, see `.flint-context/contracts/sprint-1-governor-fixes.md` Decisions Log.
**Blocking reason:** Implementing the rule requires a new `visitTouchTargets` visitor on `MithrilLinter.ts` with JSX tap-surface computation — this is net-new rule surface, not a review-driven patch. Out of scope for a correctness/safety sprint.

### Current state (Sprint 1 stopgap)

- `MITHRIL-SPC-TOUCH: 'blocking'` is preserved in `flint-mcp/src/core/domains/fintech.ts`.
- The rule ID is declared in `flint-mcp/src/core/policyEngine.ts`.
- `policy.mithril.minTouchTargetPx` (`FINTECH_MIN_TOUCH_TARGET_PX`) is written into policy but consumed by nothing.
- `MithrilLinter.ts` emits a once-per-process startup warning when the rule is declared but no visitor is registered:
  `"[Flint] MITHRIL-SPC-TOUCH declared in policy but no visitor registered — deferred to Mithril expansion sprint"`
- The warning is suppressible in tests via `FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS=1` and resettable via `__resetDeferredWarningState()`.

### What a proper fix looks like

1. Add a `visitTouchTargets` visitor to `MithrilLinter.ts` that traverses JSX elements with interactive roles (`button`, `a`, `input[type=button|submit|checkbox|radio]`, `role="button"`, `onClick` on any element).
2. Compute an estimated tap-surface from the element's Tailwind sizing utilities (`h-*`, `w-*`, `p-*`, `min-h-*`, `min-w-*`). This is approximate — mark as a Mithril advisory if dimensions are non-deterministic (arbitrary values, runtime-computed).
3. Compare the estimated tap-surface against `policy.mithril.minTouchTargetPx`. Emit a `touch-target-too-small` warning with severity `amber` by default, escalated to `blocking` when the fintech preset is active.
4. Remove the deferred-rule startup warning for `MITHRIL-SPC-TOUCH` once the visitor is registered (or let the reconciler auto-suppress when it detects a registered visitor).
5. Add tests under `flint-mcp/src/core/__tests__/MithrilLinter.touchTargets.test.ts`.
6. Document the rule in the Warden/Mithril rule reference alongside the other MITHRIL-SPC-* rules.

### Owner when picked up

`flint-ast-surgeon` (JSX visitor + tap-surface computation) paired with `flint-test-writer`. Estimated scope: ~half-day, potentially more if tap-surface heuristics need review consensus.

---

## fluidInterpolator.ts MINOR cleanup

**Deferred from:** Sprint 1 — Governor Linters + Services Fixes (2026-04-12)
**Decision source:** R5, see `.flint-context/contracts/sprint-1-governor-fixes.md` Decisions Log.
**Blocking reason:** Both findings are MINOR cosmetic fixes. Including them would inflate Sprint 1 scope without fixing any MAJOR defect.

### Current state (Sprint 1 stopgap)

`flint-mcp/src/core/fluidInterpolator.ts` is untouched. Two known issues:

1. `BREAKPOINTS` still contains `'base'`. `'base'` is not a real Tailwind breakpoint — Tailwind uses an implicit mobile-first base with no prefix. Having it in `BREAKPOINTS` risks emitting advisories against a non-existent class prefix.
2. vw decimal formatting produces values like `1.2345678vw` in some paths. These should be clamped to 3 decimal places (e.g., `1.235vw`) for deterministic output and cleaner diffs.

### What a proper fix looks like

1. Strip `'base'` from the `BREAKPOINTS` array. Verify no code path in `fluidInterpolator.ts` or its callers depends on the `'base'` key (grep for the literal string).
2. Add a `formatVw(value: number): string` helper that runs `value.toFixed(3)` and strips trailing zeros, applied everywhere a vw value is emitted.
3. Existing `fluidInterpolator.test.ts` cases must pass with updated expected strings. Add a regression test for the decimal clamp.

### Owner when picked up

`coder` — plain-TypeScript refactor, no AST involvement. Pair with next linter cleanup pass.

---

## `audit.ts` → `ResolvedPolicy` migration (C6 architectural closure)

**Deferred from:** Sprint 4 — MCP Server + Registrations (2026-04-14)
**Decision source:** Sprint 4 Phase 2.5 review gate — CONDITIONAL-PASS follow-up #1.
**Blocking reason:** Sprint 4 eliminated `toLegacyFlintPolicy` and migrated 13 server.ts sites to `ResolvedPolicy`, but `flint-mcp/src/tools/audit.ts` L272/L460 still reads disabled a11y rules via the legacy `policy.a11y.disabled_rules` carrier. The setPolicy handler writes through both paths so per-rule modes DO reach the audit gate functionally (C6 closure verified), but the architectural path is still legacy-shaped.

### Current state (Sprint 4 stopgap)
- `setPolicy.handler.ts` writes both legacy and new paths.
- `audit.ts` still consumes the legacy `policy.a11y.disabled_rules` carrier.
- `reloadFlintConfig` ensures the next audit picks up policy changes.

### Proper fix (Sprint 5)
- Rewrite `handleFlintAudit` signature to accept `ResolvedPolicy` directly.
- Derive disabled rule IDs from `resolved.a11y.rules` (per-rule mode === 'off').
- Delete the dual-write in `setPolicy.handler.ts` once audit.ts no longer reads the legacy shape.

---

## `server-helpers.ts` extraction (circular import cleanup)

**Deferred from:** Sprint 4 — MCP Server + Registrations (2026-04-14)
**Decision source:** Sprint 4 Phase 2.5 review gate — CONDITIONAL-PASS follow-up #2.
**Blocking reason:** During the 5-handler extraction, `audit.handler.ts` needed `buildAuditSummary` and `getOverrideTelemetryService`, both still resident in `server.ts`. The handler imports them from `../../server.js` with a comment acknowledging "circular but safe — not referenced at module-init time". Works at runtime but is architectural debt.

### Current state (Sprint 4 stopgap)
- `audit.handler.ts` imports helpers from `server.js` (circular via barrel).
- Runtime-safe because the symbols are only dereferenced inside the async handler body.

### Proper fix (Sprint 5)
- Create `flint-mcp/src/tools/handlers/server-helpers.ts` exporting `buildAuditSummary`, `getOverrideTelemetryService`, and any other cross-handler utilities.
- Re-point `audit.handler.ts` (and any future handlers) at the new module.
- Delete the circular-import comment once the cycle is broken.

---
