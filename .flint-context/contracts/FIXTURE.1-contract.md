# FIXTURE.1 — Audit Context System (Contract Artifact)

**Phase:** FIXTURE.1
**Status:** APPROVED
**Audience:** engine (with a small designer surface)
**Owner:** flint-architect
**Date:** 2026-04-19
**Closes:** Beta Gate 1 items #3 (zero false-positive regressions on `demos/**`) and #4 (audit→fix→re-audit clean run on demos)

Companion executable contract: [`FIXTURE.1.contract.ts`](./FIXTURE.1.contract.ts)

---

## 1. Background

A 2026-04-19 diagnostic audit of `demos/**/*.tsx` revealed two interlocking root causes that make every demo audit identical regardless of fixture quality:

1. **No audit context.** The auditor reports `Tokens Loaded: 0` for every demo file because there is no resolved `design-tokens.json` for `demos/`. With an empty token registry, every literal pixel value (`text-[12px]`, `p-[48px]`) becomes a `MITHRIL-TYP-002` / `MITHRIL-SPC-001` false positive. Compliant and broken demos report identical violation counts.
2. **Document-level rules fire on component fixtures.** Warden rules like `A11Y-050` (no `<main>` landmark) and `A11Y-051` (no `<nav>` landmark) cannot be satisfied by a single banner / card / button export. Every component fixture fails these rules irrespective of quality.

Justin's directive: no half measures. Reject annotation comments, ad-hoc skip lists, and a single hard-coded `design-tokens.json` for the demos folder. Build the architectural answer that beta testers in multi-design-system monorepos will also need.

## 2. Architectural Answer (two interlocking pieces)

### 2.1 — Per-directory `.flint-fixture.json`

A JSON file declaring the audit context for a directory and its descendants. Walked-up resolution like `tsconfig.json` (nearest-wins).

```ts
interface FlintFixture {
  tokens?: string                  // path to design-tokens.json (relative to this fixture file)
  surface: 'document' | 'section' | 'component'
  ruleProfile?: string             // rule pack profile (default: project default)
  label?: string                   // human label shown in StatusBar
  ruleOverrides?: Record<string, 'error' | 'warn' | 'off' | 'ignore'>
}
```

### 2.2 — Rule applicability metadata

Every Mithril rule and every Warden rule declares its surface scope:

```ts
appliesTo: 'document' | 'section' | 'component' | 'any'
```

The audit pipeline filters rules **before** invoking. A rule whose `appliesTo` does not match the resolved fixture surface is **silently** skipped — not recorded as a violation, not logged as suppressed. Hard-skip means "the rule does not apply here."

**Mithril rules all default to `'any'`** — token compliance is a universal concern. The metadata bucket is established for future flexibility but no Mithril rule is downgraded today.

**Warden landmark / page-structure rules become `'document'`** — `A11Y-050`, `A11Y-051`, `A11Y-052`, plus heading-order / page-title / skip-link rules in `structure.ts` and `wcag22.ts`. All other Warden rules remain `'any'`.

## 3. Impact Map

See [`FIXTURE.1.contract.ts`](./FIXTURE.1.contract.ts) `CONTRACT.impact` for the authoritative list of 33 affected files. Summary by category:

| Category | Files | Owner |
|---|---|---|
| Schema + resolver | 4 (2 create, 2 test) | flint-state-architect, flint-test-writer |
| Mithril applicability | 3 (1 create map, 1 modify linter, 1 test) | flint-ast-surgeon, flint-test-writer |
| Warden applicability | 12 (1 modify types.ts, 9 rule modules, 1 modify A11yLinter, 1 test) | flint-ast-surgeon, flint-test-writer |
| Audit pipeline integration | 3 (modify server.ts audit_ui_component + flint_audit handlers, modify swarm.ts, create server.audit-fixture.test.ts) | flint-ast-surgeon, flint-test-writer |
| Demo fixture files | 9 | flint-test-writer |
| Glass StatusBar pill | 2 (modify + test) | flint-design-engineer, flint-test-writer |

**Coordination:** A11yLinter.ts is also touched by RUNTIME.1 (runtime-dom source authority) and FIGMA-LINT.1 (Universal AST adapter). All three swarms commit append-only to that file. Sequence via `.flint-context/ACTIVE-SWARM-TERRITORY.md`.

## 4. Type Contracts

All exported from `FIXTURE.1.contract.ts` for Phase 2 to import directly:

- `FlintFixture` — schema for `.flint-fixture.json`
- `FlintFixtureSurface = 'document' | 'section' | 'component'`
- `FlintFixtureRuleMode = 'error' | 'warn' | 'off' | 'ignore'`
- `ResolvedFixture` — return shape of `resolveFixture(filePath, projectRoot)`
- `RuleAppliesTo = 'document' | 'section' | 'component' | 'any'`
- `MithrilAppliesToMap = Record<string, RuleAppliesTo>`
- `ApplicabilityDecision` — used by the filter; surfaced in trace logs only

## 5. IPC Channels

**None.** The audit response already flows back via the existing MCP tool surface (`audit_ui_component`, `flint_audit`, `flint_swarm_audit_fix`). The new `fixtureContext: { label, source }` field rides inside that existing payload. No `window.flintAPI` additions, no preload-bridge changes, no Zod validators required.

## 6. Store Contracts

**None.** `fixtureContext` is consumed transiently from the latest audit response on `canvasStore.latestAudit`. No new slices, no new actions.

## 7. Component Contracts

| Component | File | Props | Stores read | IPC |
|---|---|---|---|---|
| StatusBar fixture-context pill | `src/components/editor/StatusBar.tsx` | existing `StatusBarProps` (no signature change) | `canvasStore.latestAudit` | none |

Append-only addition to existing component. Coordinates with RUNTIME.1's runtime-mode pill — both append, designer-engineer arranges them in stable left-to-right order: `[coverage] [audit context] [runtime mode]`.

## 8. Commandment Checklist

| # | Commandment | How this contract satisfies it |
|---|---|---|
| 5 | Accessibility is a Compiler Error | Applicability filtering REFINES which rules apply; never weakens enforcement on the right surface. Document fixtures still see every document-level rule. |
| 6 | The Gatekeeper Rule | Export gate continues to read severity counts. This change reduces false positives without changing the gate. |
| 13 | Deterministic Surgery | `fixtureResolver` and the applicability filter are pure functions over file paths and rule metadata. No regex on source code. |
| 14 | Bypass Prohibition | fs reads bounded to `projectRoot` with explicit `startsWith` check after `path.resolve`. Path-traversal blocked. |
| 15 | Granular AST Tools Only | Applicability filtering keeps the AI Orchestrator from emitting nonsensical fixes on the wrong surface (e.g., `insert-main` on a button fixture). |

## 9. Implementation Order (Parallelism)

| Group | Agents | Work |
|---|---|---|
| A | `flint-state-architect`, `flint-ast-surgeon` | Schema (`shared/fixture-schema.ts`) + resolver (`fixtureResolver.ts`) in parallel with Mithril/Warden applicability metadata. The two halves do not touch the same files. |
| B | `flint-test-writer` | All test files. Starts when Group A signatures land (resolver, MithrilLinter option, A11yLinter option). |
| C | `flint-design-engineer` | StatusBar pill. Independent of B; can run with B in parallel once audit response shape is stable. |

Audit pipeline integration (3 tool files) belongs in Group A — `flint-ast-surgeon` owns it sequentially after Mithril/Warden metadata lands.

## 10. Risks

See [`FIXTURE.1.contract.ts`](./FIXTURE.1.contract.ts) `CONTRACT.risks` for the full register. Summary of the load-bearing items:

- **Drift between MithrilAppliesToMap and visitor-registered rules.** Caught by an intersection test that fails CI when a ruleId emitted in the corpus is missing from the map.
- **Append-only collisions on A11yLinter.ts.** RUNTIME.1, FIGMA-LINT.1, FIXTURE.1 all touch this file. Sequenced via territory map; all changes are append-only.
- **Mis-classified document-level rule.** Caught by demo regression tests that assert `banner-compliant.tsx` is APPROVED.
- **Path traversal via `fixture.tokens: "../../etc/passwd"`.** Blocked by `resolved.startsWith(projectRoot)` assertion in resolver.
- **StatusBar pill collision with RUNTIME.1.** Designer-engineer uses fixed left-to-right pill order.

## 11. Non-Goals

See [`FIXTURE.1.contract.ts`](./FIXTURE.1.contract.ts) `CONTRACT.nonGoals` for the full list. Top items:

- No GUI editor for `.flint-fixture.json` (JSON authoring only).
- No fixture sharing across projects.
- No fixture inheritance beyond walk-up resolution (no `extends`, no merges; nearest-wins is total).
- No per-file overrides — per-directory only.
- No new MCP tools, IPC channels, or Zustand stores.
- No restructuring of MithrilLinter.ts or A11yLinter.ts (append-only).
- No changes to export-gate or Coverage Honesty (Commandment 6 and Phase 0 preserved).
- No re-classification of Mithril rules (all stay `'any'`).

## 12. Verification (Invariants)

See [`FIXTURE.1.contract.ts`](./FIXTURE.1.contract.ts) `CONTRACT.invariants` — 8 falsifiable thresholds. Headlines:

- `resolver-walkup-latency-warm-cache` < 5ms p95 at N=1000
- `applicability-zero-false-escalations` === 0 across the demo corpus
- `demo-compliant-clean` === 0 MITHRIL violations on `banner-compliant.tsx`
- `demo-broken-distinguishable` ≥ 5 violations on `banner-broken.tsx`
- `audit-loop-clean-on-demos` === 0 (closes Beta Gate 1 item #4)
- `audit-overhead-budget` < 10ms p95 vs pre-FIXTURE.1 baseline

## 13. Glass Surface

A small but visible trust signal. When the audit response carries `fixtureContext.label`, StatusBar renders a pill: "Audit context: MUI demo context" / "Auditing in component scope" / etc. Empty label or missing fixture ⇒ no pill. This keeps the architectural change visible to the designer without requiring them to read JSON.

---

**Phase 2 entry condition:** Phase 1.5 lint approves this contract and `FIXTURE.1.contract.ts` compiles cleanly. Phase 2 agents import types from `FIXTURE.1.contract.ts` directly — no prose translation.
