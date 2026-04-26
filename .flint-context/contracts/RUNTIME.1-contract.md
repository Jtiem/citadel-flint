# RUNTIME.1 — axe-core Runtime Adapter

**Phase:** RUNTIME.1 (weekend sprint — Gap #3 closure)
**Status:** APPROVED — Justin signed off on all 7 design decisions 2026-04-18 (see "Decisions Locked" below)
**Owner:** flint-architect
**Date:** 2026-04-18
**Citadel Name:** Warden (the a11y guard — runtime extension)
**Audience (primary):** designer (Glass adds a DOM-layer check to the GovernanceDashboard)
**Audience (secondary):** engine (A11yLinter surfaces a new `runtime-dom` source authority; identical data shape whether consumed from Glass, VS Code diagnostics, or flint-gate CI)
**Weekend plan source:** `docs/strategy/WEEKEND-PLAN-2026-04-18.md`
**Competitive context:** `docs/strategy/COMPETITIVE-LANDSCAPE-2026-04-18.md` — closes Gap #3 ("No runtime verification — axe-core wins at the DOM layer")
**Feature flag:** `runtime.axe.enabled` (stored in `flint.config.yaml` under `rules.runtime.axe` alongside the existing `mithril` / `accessibility` / `export_gate` blocks — matches the canonical pattern in `flint-mcp/src/core/config.ts:266-287`). **Hidden by default on first ship.** The StatusBar `RuntimeAuditPill` and the GovernanceDashboard "Runtime Audit" accordion render conditionally on the flag being enabled. The IPC handler is wired and can be invoked directly by tests or scripted calls, but the user-facing surface is off until Justin flips the flag in a follow-up release.

---

## Summary

Warden today runs at the AST. Commandment 5 ("Accessibility is a Compiler Error") is satisfied for everything static analysis can see — `alt` attribute presence, `aria-label` on buttons, heading order, landmark structure. Warden cannot see what the browser computes: focus order after the cascade, ARIA live-region announcement behavior, computed color contrast once CSS variables resolve, actual tab sequence once `display: none` and `visibility: hidden` take effect. axe-core, running at the DOM, sees all of it.

RUNTIME.1 wraps axe-core as a runtime adapter. A sandboxed renderer (new `BrowserWindow` in Electron; new hidden iframe in the web build) hosts the rendered preview, runs `axe.run()` against it, and returns raw axe results to the main process. Main normalizes those results into `A11yViolationDetail` shapes and tags each finding with a new `SourceAuthority` value: `'runtime-dom'`. GovernanceDashboard merges AST-time + runtime findings, deduplicating by `(ruleId, elementId)` and combining source authorities into a single pill chip.

This is a "wrap, don't rebuild" adapter. We do NOT fork axe-core. We do NOT add rules to axe. We do NOT touch the existing Warden rule modules. We add exactly one new `SourceAuthority` value, one IPC channel, one hook, and one StatusBar pill.

---

## Decisions Locked (2026-04-18)

All seven design decisions are resolved and binding for Phase 2. Contract status is `APPROVED`.

1. **Sandboxing strategy — separate BrowserWindow.** The adapter spawns its OWN `BrowserWindow` with its OWN CSP (`script-src 'self' 'unsafe-eval'` scoped to the axe bundle only; no network; no preload script). The primary LivePreview CSP in `electron/main.ts:325-343` (SEC.1) is untouched. Web build mirrors this via a hidden iframe with identical tight CSP inside the Express static server. Trade-off accepted: one extra BrowserWindow lifecycle for SEC.1 preservation.

2. **Trigger mode — on-demand only.** No live/always-on mode in RUNTIME.1. Triggered via StatusBar "Runtime Audit" pill click, or programmatically via `useRuntimeAudit.run()`. Aligns with Commandment 8 (Audit-First Execution). A future phase may add an "always on" toggle once cost is measured.

3. **Dedup semantics — `(wardenRuleId, elementId)` via curated map.** A new `flint-mcp/src/core/a11y/axeRuleMap.ts` translates axe-core rule IDs to Warden rule IDs where a 1:1 match exists. Dedup key becomes `(wardenRuleId, elementId)`. AST + runtime agreement → single row with `sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom']`. axe-only rules (e.g., `frame-title`) → `ruleId: 'RUNTIME-<axe-rule-id>'` + `sourceAuthority: 'runtime-dom'` alone. `SourceAuthority` union is extended append-only.

4. **axe-core version — exact pin `4.10.3`.** Declared in `package.json` dependencies (not devDependencies, not caret range). Adapter performs a runtime `axe.version === EXPECTED_AXE_VERSION` check and returns `{ status: 'version-mismatch' }` soft-error rather than throwing on drift. Upgrade path is a tested migration, not silent drift.

5. **Empty-preview semantics — `{ violations: [], status: 'no-preview' }`.** Distinguished from `{ violations: [], status: 'passed' }` (axe ran, nothing found). GovernanceDashboard renders "Runtime audit skipped — no preview" for the `no-preview` sentinel.

6. **Ephemeral findings — Phase 1 no SQLite persistence.** Runtime findings live in `canvasStore.runtimeFindings` (new slice). Rebuilt on every `runtime:run-axe` invocation. No `.flint/debt-history.json` schema migration in this phase. Commandment 14 (Bypass Prohibition) trivially satisfied — ephemeral state never touches disk.

7. **First ship — hidden behind `runtime.axe.enabled` feature flag (disabled by default).** The flag lives in `flint.config.yaml` under `rules.runtime.axe`, matching the canonical nested-rule pattern in `flint-mcp/src/core/config.ts` (see `FlintProjectConfig.rules.mithril`, `rules.accessibility`, `rules.export_gate`). Resolution semantics:
   - `rules.runtime.axe.enabled: false` (default) → StatusBar `RuntimeAuditPill` is not mounted; GovernanceDashboard "Runtime Audit" accordion is not rendered; `useRuntimeAudit.run()` called programmatically still hits the IPC and returns a result (tests and scripted calls work).
   - `rules.runtime.axe.enabled: true` → UI surfaces appear normally.
   - No flag present in YAML → treat as `false` (safe default).
   - The flag is read via the existing `config-loader.ts` path. A new resolver `isRuntimeAxeEnabled(config): boolean` lives in `flint-mcp/src/core/config.ts` alongside the policy helpers and is exposed to Glass via the already-live `flint_get_context` surface (no new IPC channel for the flag itself — it piggybacks on session context).

---

## Scope

### In scope

- Separate sandboxed BrowserWindow (Electron) / hidden iframe (web) that renders the current preview and runs axe-core
- New IPC channel `runtime:run-axe` with Zod validator
- Append-only `runtime-dom` addition to the `SourceAuthority` union
- New `axeRuleMap.ts` curated 1:1 mapping of axe-core rule IDs to Warden rule IDs
- Normalization layer in main process that converts `AxeResults` → `A11yViolationDetail[]`
- New `canvasStore.runtimeFindings` slice, set via hook consuming IPC response
- StatusBar pill: "Runtime Audit" (click to trigger, shows loading + result count)
- GovernanceDashboard merge: deduplicate AST + runtime findings, render combined source-authority chips
- Web build parity via WebSocket message mirroring Electron IPC
- Tests: happy path, CSP iframe blocked, version mismatch, duplicate findings, empty preview, offline

### Out of scope (Non-goals — declared explicitly)

- **No visual regression testing.** Playwright screenshots, pixel diffs, and layout regression are a separate category. Future phase or partnership with Chromatic.
- **No axe-core fork or rule additions.** We consume axe as a library. If Warden needs a new rule, it goes into `flint-mcp/src/core/a11y/rules/*.ts`, not into axe.
- **No native OS accessibility inspection.** macOS Accessibility Inspector, Windows Narrator APIs, Linux AT-SPI are out of scope. Browser-rendered DOM only.
- **No persistence of runtime findings in Phase RUNTIME.1.** Ephemeral only. No SQLite schema changes.
- **No live/always-on mode in Phase RUNTIME.1.** On-demand trigger only. Live mode is a Phase 2 consideration after we measure cost.
- **No changes to Phase 0 coverage calculation.** `governedSurfacePercent` is AST-scope metric. Runtime coverage is a separate number if we ever surface it; not part of this phase.
- **No modification to existing Warden rule modules.** Append-only extension of `SourceAuthority`. Rule files in `flint-mcp/src/core/a11y/rules/*.ts` are untouched.

---

## Impact Map

Owner legend:
- `flint-electron-ipc` — IPC handlers, preload bridge, web adapter parity, CSP-sandboxed BrowserWindow lifecycle, Zod schema stubs (Group 0)
- `flint-ast-surgeon` — MCP-side normalization (`AxeResults` → `A11yViolationDetail`), `SourceAuthority` extension, `axeRuleMap.ts`, feature-flag resolver
- `flint-state-architect` — `canvasStore.runtimeFindings` slice, dedup selector, `useRuntimeAudit` hook
- `flint-design-engineer` — StatusBar pill (flag-gated), GovernanceDashboard merged rendering (flag-gated)
- `flint-test-writer` — component + hook + IPC + adapter tests
- `flint-integration-validator` — Phase 3 gate: writes integration report to `.flint-context/reviews/runtime.1-integration-2026-04-18.md`

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `electron/main.ts` | MODIFY (APPEND ONLY) | flint-electron-ipc | New IPC handler `runtime:run-axe`. Spawns child `BrowserWindow` with tight CSP, loads preview HTML, injects axe bundle, calls `axe.run()`, returns normalized findings. Lifecycle: create on first call, reuse until project closes, teardown on `window-all-closed`. |
| `electron/preload.ts` | MODIFY (APPEND ONLY) | flint-electron-ipc | Expose `window.flintAPI.runtime.runAxe(opts): Promise<RuntimeAuditResult>`. Namespaced under `runtime` to match existing patterns (`window.flintAPI.tokens`, `.figma`, etc.). |
| `server/index.ts` | MODIFY (APPEND ONLY) | flint-electron-ipc | Web-parity WebSocket handler for `runtime:run-axe`. Spawns Puppeteer/Playwright page (server already has Playwright), loads preview HTML, runs axe, returns findings. Reuses the thumbnail service's Puppeteer lifecycle if available. |
| `src/adapters/web-api.ts` | MODIFY (APPEND ONLY) | flint-electron-ipc | Web-side adapter mirror of `window.flintAPI.runtime.runAxe`. HTTP POST + WS response, matching existing pattern. |
| `shared/ipc-validators.ts` | MODIFY (APPEND ONLY) | flint-electron-ipc | Add `runtime:run-axe` Zod schema: payload `{ previewHtml: string; rules?: string[]; previewUrl?: string }`; response `RuntimeAuditResultSchema`. Export name: `runtimeRunAxePayloadSchema`, `runtimeRunAxeResponseSchema`. |
| `flint-mcp/src/core/a11y/axeRuleMap.ts` | CREATE | flint-ast-surgeon | Curated 1:1 map of axe-core rule IDs to Warden rule IDs. E.g. `{ 'color-contrast': 'A11Y-036', 'image-alt': 'A11Y-001', 'label': 'A11Y-004', 'button-name': 'A11Y-002' }`. Exports `mapAxeRuleToWarden(axeRuleId: string): string | null` — returns Warden ID or null if axe-only. |
| `flint-mcp/src/core/a11y/axeNormalizer.ts` | CREATE | flint-ast-surgeon | Pure function `normalizeAxeResults(raw: AxeResults): A11yViolationDetail[]`. Consumes axe's `violations` array, maps each to Warden's `A11yViolationDetail` shape. For axe-only rules, emits `ruleId: 'RUNTIME-<axe-rule-id>'`. Attaches `sourceAuthority: 'runtime-dom'` metadata inline. Deterministic — given same input, same output. |
| `flint-mcp/src/core/governance/types.ts` | MODIFY (APPEND ONLY) | flint-ast-surgeon | Extend `SourceAuthority` union: `\| 'runtime-dom'`. Non-breaking — consumers that did not know about the value will treat it as unknown and render the string, which is the same behavior as any other unknown authority. |
| `flint-mcp/src/core/A11yLinter.ts` | MODIFY (APPEND ONLY) | flint-ast-surgeon | Zero logic change. Comment-only addition documenting that runtime findings flow through a parallel path and share the same violation shape. Ensures future Warden contributors know `sourceAuthority` may be `'runtime-dom'`. |
| `flint-mcp/src/core/governance/ruleProvenanceRegistry.ts` | MODIFY (APPEND ONLY) | flint-ast-surgeon | Register a single fallback entry for `sourceAuthority: 'runtime-dom'` so that audit-report SARIF filter and `resolveProvenance()` know about the value. Keeps existing entries untouched. |
| `flint-mcp/src/core/config.ts` | MODIFY (APPEND ONLY) | flint-ast-surgeon | APPEND ONLY — extend `FlintProjectConfig.rules` with an optional `runtime?: { axe?: { enabled?: boolean } }` block, matching the existing nested-rule pattern (`rules.mithril`, `rules.accessibility`). Export `isRuntimeAxeEnabled(config: FlintConfig): boolean` returning `config.policy` or YAML-resolved `rules.runtime.axe.enabled === true` (default `false`). Extend `flint_get_context` session-context payload with `features.runtimeAxeEnabled: boolean` (via append to the existing Beacon serializer). |
| `src/store/canvasStore.ts` | MODIFY (APPEND ONLY) | flint-state-architect | Add `runtimeFindings: RuntimeAuditResult \| null` state. Add `setRuntimeFindings(result: RuntimeAuditResult \| null)` action. Add `clearRuntimeFindings()` action fired when `activeFilePath` changes. No cross-store imports (per Architectural Anti-Patterns). |
| `src/hooks/useRuntimeAudit.ts` | CREATE | flint-state-architect | Hook owning the runtime audit trigger flow. `const { run, result, status, reset } = useRuntimeAudit()`. `run()` calls `window.flintAPI.runtime.runAxe`, writes into `canvasStore.runtimeFindings` on success, pushes notification on error. Serializes: a second `run()` while `status === 'running'` is a no-op. |
| `src/components/editor/StatusBar.tsx` | MODIFY (APPEND ONLY) | flint-design-engineer | New `<RuntimeAuditPill>` element at trailing edge of StatusBar (after existing CoverageBadge from Phase 0). States: idle / running (spinner) / success (finding count + pass/fail) / error. **Double-gated:** hidden unless (a) `runtime.axe.enabled === true` (feature flag, read from `sessionContext.features.runtimeAxeEnabled`) AND (b) `activeFilePath !== null` (progressive disclosure). When the flag is false, the pill is not mounted at all — no spinner, no placeholder. |
| `src/components/editor/RuntimeAuditPill.tsx` | CREATE | flint-design-engineer | Presentational component. Props: `{ status: RuntimeAuditStatus; findingCount: number; onClick: () => void }`. Styled to match existing pill patterns (MithrilBadge, CoverageBadge). Keyboard: Enter/Space triggers onClick. |
| `src/components/ui/GovernanceDashboard.tsx` | MODIFY | flint-design-engineer | Consume `canvasStore.runtimeFindings`. Merge AST-time + runtime findings via new selector `useMergedA11yFindings()`. For each rendered violation, display source-authority chip(s): `['WCAG 2.1 AA']`, `['runtime-dom']`, or `['WCAG 2.1 AA', 'runtime-dom']` when deduped. Add a "Runtime Audit" accordion section to surface runtime-only findings separate from the primary AST list. **Accordion is flag-gated** — the "Runtime Audit" section is not rendered when `runtime.axe.enabled !== true`. The merged-chip rendering on existing rows is always live (cost is zero when `runtimeFindings === null`). |
| `src/hooks/useMergedA11yFindings.ts` | CREATE | flint-state-architect | Pure derivation hook. Input: `a11yViolations` (AST) + `runtimeFindings` (DOM). Output: `MergedFinding[]` with `sourceAuthorities: SourceAuthority[]`. Dedup key: `(mappedWardenRuleId, elementId)`. Memoized via `useMemo` over stable inputs. |
| `src/types/flint-api.d.ts` | MODIFY (APPEND ONLY) | flint-electron-ipc | Add `runtime` namespace to `window.flintAPI` type. `RuntimeAuditResult`, `RuntimeAuditStatus`, `RuntimeAuditRequest` type exports. Imports `SourceAuthority` from shared types. |
| `electron/__tests__/runtime-adapter.test.ts` | CREATE | flint-test-writer | Adapter happy path: spawn BrowserWindow, load known-bad HTML, assert normalized findings contain expected Warden rule IDs. Version mismatch: mock `axe.version`, assert `{ error: 'axe-version-mismatch' }`. Empty preview: pass empty HTML, assert `{ status: 'no-preview' }`. |
| `flint-mcp/src/core/a11y/__tests__/axeNormalizer.test.ts` | CREATE | flint-test-writer | Given canned `AxeResults` fixtures (one AST-equivalent, one axe-only), assert normalizer output shape, ruleId mapping, and `sourceAuthority: 'runtime-dom'` tagging. |
| `flint-mcp/src/core/a11y/__tests__/axeRuleMap.test.ts` | CREATE | flint-test-writer | For each curated mapping, assert `mapAxeRuleToWarden(axeId) === wardenId`. Unknown axe rule returns null. |
| `src/hooks/__tests__/useRuntimeAudit.test.ts` | CREATE | flint-test-writer | Happy path (trigger → populate store). Serialization (double-click, assert single IPC call). Error surfacing (mock IPC rejection). Reset on `activeFilePath` change. |
| `src/hooks/__tests__/useMergedA11yFindings.test.ts` | CREATE | flint-test-writer | Dedup: AST finding + runtime finding with same ruleId+elementId → one merged row, `sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom']`. No runtime findings → AST unchanged. Runtime-only finding → surfaces alone with `['runtime-dom']`. |
| `src/components/editor/__tests__/RuntimeAuditPill.test.tsx` | CREATE | flint-test-writer | All status states render. Keyboard activation fires onClick. Hidden when activeFilePath is null. |
| `src/components/ui/__tests__/GovernanceDashboard.runtime-merge.test.tsx` | CREATE | flint-test-writer | With mocked `a11yViolations` + `runtimeFindings`, assert merged rows + chip rendering. |
| `.flint-context/reviews/runtime.1-integration-2026-04-18.md` | CREATE (post-Phase-2) | flint-integration-validator | Phase 3 integration report. Records: every `testBoundary` mapped to a matching test file + passing assertion; every `invariant.threshold` measured + verdict; no Phase 0 / MINT.5 regression; flag-off behavior verified (pill absent, accordion absent, IPC still callable). Verdict: SHIP / FIX / REDESIGN. |

**Append-only collisions to coordinate:**
- `flint-mcp/src/core/A11yLinter.ts` — Phase 0 (Coverage Honesty) is modifying this file in parallel. RUNTIME.1's change is a comment-only addition; Phase 0 adds `coverage` return field. Both modifications are strict appends. Sequence-safe; Phase 2 reviewer verifies no semantic collision.
- `src/components/editor/StatusBar.tsx` — Phase 0 is adding `CoverageBadge`. RUNTIME.1 adds `RuntimeAuditPill` after it. Both are append-only renderable children. Sequence-safe.
- `shared/ipc-validators.ts` — every active phase appends here. Append new schemas before the `} satisfies` closing brace. No conflict.

---

## Type Contracts

Full TypeScript surface is in `.flint-context/contracts/RUNTIME.1.contract.ts`. Summary:

```ts
// Extends existing SourceAuthority union in flint-mcp/src/core/governance/types.ts
export type SourceAuthority =
    | 'WCAG 2.1 AA' | 'WCAG 2.2 AA' | 'SOC2' | 'FDA SaMD'
    | 'HIPAA' | 'Section 508' | 'Flint Design System' | 'Custom'
    | 'runtime-dom' // ← appended

export type RuntimeAuditStatus =
    | 'idle'
    | 'running'
    | 'passed'
    | 'violations'
    | 'no-preview'
    | 'version-mismatch'
    | 'error'

export interface RuntimeAuditRequest {
    /** Full HTML doc to render inside the sandboxed BrowserWindow. Empty string triggers no-preview. */
    previewHtml: string
    /** Optional file://-style URL for referring to the preview (used as window title). */
    previewUrl?: string
    /** Optional filter: only run these axe-core rule IDs. When absent, runs all enabled rules. */
    rules?: string[]
}

export interface RuntimeAuditResult {
    status: RuntimeAuditStatus
    /** ISO 8601 timestamp when audit completed. */
    timestamp: string
    /** axe-core version the adapter ran. */
    axeVersion: string
    /** Total nodes axe scanned. */
    nodeCount: number
    /** Wall-clock duration in milliseconds. */
    durationMs: number
    /** Normalized findings. Empty when status !== 'violations'. */
    violations: A11yViolationDetail[]
    /** Populated when status === 'version-mismatch' or 'error'. */
    error?: { code: string; message: string }
}

export interface MergedA11yFinding extends A11yViolationDetail {
    /** One or more authorities — multi-authority means dedup succeeded. */
    sourceAuthorities: SourceAuthority[]
}
```

---

## IPC Channel Contracts

| Channel | Direction | Payload Type | Return Type | Handler | Validator |
|---------|-----------|--------------|-------------|---------|-----------|
| `runtime:run-axe` | renderer→main | `RuntimeAuditRequest` | `RuntimeAuditResult` | `electron/main.ts` (and `server/index.ts` for web) | `runtimeRunAxePayloadSchema` + `runtimeRunAxeResponseSchema` in `shared/ipc-validators.ts` |

No main→renderer broadcast channels. No bidirectional channels. One invoke + response.

---

## Store Contracts

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| `canvasStore` | `runtimeFindings: RuntimeAuditResult \| null` | `setRuntimeFindings(r: RuntimeAuditResult \| null): void`, `clearRuntimeFindings(): void` | — (selector lives in `useMergedA11yFindings` hook) |

No new Zustand stores. Single slice extension on an existing one.

---

## Component Contracts

| Component | File | Props | Stores Read | IPC Emitted |
|-----------|------|-------|-------------|-------------|
| `RuntimeAuditPill` | `src/components/editor/RuntimeAuditPill.tsx` | `RuntimeAuditPillProps` (status, findingCount, onClick) | — (pure presentational) | — |
| `StatusBar` (modified) | `src/components/editor/StatusBar.tsx` | existing | `canvasStore` (existing) | — |
| `GovernanceDashboard` (modified) | `src/components/ui/GovernanceDashboard.tsx` | existing | `canvasStore` (existing) + `canvasStore.runtimeFindings` (new) | — |

IPC emission is owned by `useRuntimeAudit` hook, not components (per Architectural Anti-Patterns — IPC belongs in hooks, not components or stores).

---

## Invariants

Every invariant is falsifiable and has a measurement harness.

| Name | Measurable | Threshold | Measured By |
|------|-----------|-----------|-------------|
| `runtime-audit-latency-p95` | end-to-end latency from `run()` call to `status: 'violations' \| 'passed'` resolution on a preview with 1000 DOM nodes | `< 3000ms` at N=1000 nodes | vitest benchmark with canned HTML fixture + `performance.now()` |
| `dedup-coverage` | percentage of AST+runtime finding pairs that merge into a single MergedA11yFinding when both sources flag the same element for the same rule | `≥ 85%` across a curated 20-pair test fixture | `useMergedA11yFindings.test` asserts merge count / total pairs |
| `csp-sandbox-isolation` | number of `runtime:run-axe` invocations that mutate the primary LivePreview CSP | `= 0` invocations affect the primary preview session | integration test loads primary preview, runs runtime audit, re-verifies primary CSP headers unchanged |
| `version-mismatch-graceful` | number of runtime audit invocations that throw uncaught exceptions when axe.version !== EXPECTED_AXE_VERSION | `= 0` uncaught throws | adapter test injects a shim axe bundle with wrong version, asserts `{ status: 'version-mismatch' }` returned not thrown |
| `empty-preview-handled` | number of runtime audit invocations that throw or hang when previewHtml is empty | `= 0` throws or hangs | adapter test passes previewHtml=''; asserts resolves within 500ms with `{ status: 'no-preview' }` |
| `offline-resilience` | number of runtime audit invocations that require network access | `= 0` network calls made during audit | integration test disables all network (nock.disableNetConnect), runs audit, asserts completion |
| `serialization` | number of concurrent `useRuntimeAudit.run()` invocations that produce more than one IPC call | `= 0` additional calls while status='running' | hook test calls `run()` twice back-to-back, asserts `window.flintAPI.runtime.runAxe` invoked exactly once |
| `flag-off-ui-silent` | DOM node count produced by RuntimeAuditPill + GovernanceDashboard "Runtime Audit" accordion when `features.runtimeAxeEnabled === false` | `= 0` DOM nodes rendered for runtime-axe surfaces | integration test renders both components with flag off; asserts both `queryByTestId("runtime-audit-pill-idle")` and `queryByRole("region", { name: /runtime audit/i })` return null |

---

## Test Boundaries

Every new public API has executable test boundaries. See `.contract.ts` for the `TestBoundary[]` array.

Highlights:

- **adapter-happy-path** — Given known-bad HTML with a missing alt on an `<img>`, when `runtime:run-axe` is invoked, returns a `RuntimeAuditResult` containing `A11Y-001` violation with `sourceAuthority: 'runtime-dom'`.
- **adapter-csp-isolated** — Given the primary LivePreview is rendered with SEC.1 CSP, when runtime audit spawns its own BrowserWindow, writes no CSP header mutation to the primary preview session.
- **adapter-version-mismatch** — Given axe-core shim with `axe.version = '3.0.0'`, when `runtime:run-axe` is invoked, returns `{ status: 'version-mismatch', error: { code, message } }` without throwing.
- **adapter-empty-preview** — Given `previewHtml = ''`, when `runtime:run-axe` is invoked, returns `{ status: 'no-preview', violations: [] }` within 500ms.
- **adapter-offline** — Given network access disabled, when `runtime:run-axe` is invoked, resolves with normal `{ status: 'violations' \| 'passed' }` without attempting network calls.
- **normalizer-mapped-rule** — Given axe violation with `id: 'color-contrast'`, when `normalizeAxeResults` is invoked, returns `A11yViolationDetail[]` with `ruleId: 'A11Y-036'` and `sourceAuthority: 'runtime-dom'`.
- **normalizer-axe-only-rule** — Given axe violation with `id: 'frame-title'` (no Warden equivalent), when `normalizeAxeResults` is invoked, returns finding with `ruleId: 'RUNTIME-frame-title'`.
- **dedup-same-element-same-rule** — Given AST finding + runtime finding with identical elementId and mapped ruleId, when `useMergedA11yFindings` runs, emits one MergedA11yFinding with `sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom']`.
- **dedup-different-elements** — Given two findings with same ruleId but different elementIds, when merged, emits two separate findings.
- **hook-serialization** — Given `status === 'running'`, when `run()` is invoked a second time, blocks the second IPC call.
- **hook-reset-on-file-change** — Given runtime findings are populated, when `activeFilePath` changes, clears runtime findings.
- **pill-hidden-when-no-file** — Given `activeFilePath = null`, when StatusBar renders, does not render RuntimeAuditPill.
- **dashboard-merged-rendering** — Given AST and runtime findings for the same element, when GovernanceDashboard renders, renders one row with two source-authority chips.

---

## Commandment Checklist

| # | Commandment | Applies | How RUNTIME.1 satisfies it |
|---|-------------|---------|---------------------------|
| 1 | Code is Truth | ✓ | Runtime audit does not mutate code. It observes rendered output. No `.tsx` files touched. No ephemeral demo state created. |
| 2 | No Hallucinated Styling | — | No visual edits; read-only audit. |
| 3 | Composite IDs for Arrays | — | No array map rendering of mutations. Finding lists use stable `(ruleId, elementId)` keys. |
| 4 | Local-First Only | ✓ | axe-core is bundled as a local npm dep (`axe-core@4.10.3`), not loaded from CDN. Sandboxed BrowserWindow has network disabled. No external URLs in the adapter sandbox HTML. |
| 5 | Accessibility is a Compiler Error | ✓ | Strengthens Commandment 5: runtime findings merge with AST findings in the same GovernanceDashboard; critical severities still block export via Gate. Runtime-only findings flow through the same severity pipeline. |
| 6 | The Gatekeeper Rule | ✓ | Runtime findings with severity `'critical'` count toward ExportModal's pre-flight block. No new bypass path. **Feature-flag note:** when `runtime.axe.enabled === false`, findings are not generated at all (UI absent, no programmatic callers exercised by the default product flow), so the Gate's input set is unchanged from pre-RUNTIME.1 behaviour on first ship. When the flag flips on, runtime findings immediately become gate-eligible. |
| 7 | ID Preservation | — | No AST mutations, no ID injection. Runtime findings reference existing `data-flint-id` or axe's fallback selector. |
| 8 | Audit-First Execution | ✓ | Manual/on-demand trigger aligns with Commandment 8 — user or agent explicitly requests runtime audit. No automatic firing on every edit. |
| 9 | CIEDE2000 ΔE | — | Color contrast in axe is WCAG 2.0 formula, not CIEDE2000. We do NOT convert — runtime authority is the DOM renderer's computed color; Mithril remains the AST perceptual-drift source of truth. Document this explicitly to avoid Δ-E confusion. |
| 10 | Targeted Micro-Recovery | — | No mutations; no undo needed. |
| 11 | Surgical Git Transplants | — | No git ops. |
| 12 | Atomic Queuing | ✓ | No writes (ephemeral state). When Phase 2 of RUNTIME adds persistence, it must route through `FileTransactionManager`. Documented in contract for future phase. |
| 13 | Deterministic Surgery | ✓ | `normalizeAxeResults` is a pure function — same input produces byte-identical output. No regex on source code; adapter operates on rendered DOM, not code strings. |
| 14 | Bypass Prohibition | ✓ | Zero `fs` imports in the adapter. No direct disk writes. No direct git calls. Sandbox BrowserWindow loads HTML via `webContents.loadURL('data:text/html;base64,...')` not `loadFile`. |
| 15 | Granular AST Tools Only | — | No AI orchestration in RUNTIME.1. Runtime audit is observational, not a mutation tool. |
| 16 | In-Memory Validation | — | No code generation in RUNTIME.1. |

---

## Implementation Order

### Group 0 (single owner, MUST complete before Groups A/B/C) — Pre-Phase-2 Setup

- **flint-electron-ipc** — Add stub Zod schemas to `shared/ipc-validators.ts` as named exports. The file is **APPEND ONLY** — insert new `ipcSchemas['runtime:run-axe']` entry and the two alias exports `runtimeRunAxePayloadSchema` / `runtimeRunAxeResponseSchema` before touching anything else. Shape:
  - Payload: `{ previewHtml: string; previewUrl?: string; rules?: string[] }` (maps to `RuntimeAuditRequest` in `.contract.ts`).
  - Response: `{ status: enum(['idle', 'running', 'passed', 'violations', 'no-preview', 'version-mismatch', 'error']); timestamp: string; axeVersion: string; nodeCount: number; durationMs: number; violations: A11yViolationDetail[]; error?: { code: string; message: string } }` (maps to `RuntimeAuditResult`).
  - Export style must mirror Phase 0's existing `getCoverageSummaryPayloadSchema` / `getCoverageSummaryResponseSchema` pattern at `shared/ipc-validators.ts:209-213`: add the entry to the `ipcSchemas` object, then alias-export the two named schemas.
- **Gate:** Group 0 is a hard gate. Phase 2 agents must not start until these two exports are grep-able in `shared/ipc-validators.ts`. This closes BLOCKING-2 from the Phase 1.5 lint report, which requires the validator exports to exist before the preload bridge imports them at compile time.

### Group A (parallel, after Group 0) — Foundation (no cross-deps)

- **flint-ast-surgeon** — Create `flint-mcp/src/core/a11y/axeRuleMap.ts` + `axeNormalizer.ts` + tests. Append `'runtime-dom'` to `SourceAuthority` union. Register fallback in `ruleProvenanceRegistry.ts`. Add the `rules.runtime.axe.enabled` shape to `FlintProjectConfig` and the `isRuntimeAxeEnabled(config)` resolver in `flint-mcp/src/core/config.ts`. Append `features.runtimeAxeEnabled` to the Beacon session-context payload.
- **flint-electron-ipc** — Scaffold `runtime:run-axe` IPC handler in `electron/main.ts` and parity in `server/index.ts`. Expose `window.flintAPI.runtime.runAxe`. Add BrowserWindow lifecycle management (creation, reuse, teardown). Zod validation wraps the handler body using the Group 0 schemas.
- **flint-state-architect** — Extend `canvasStore` with `runtimeFindings` slice. Create `useRuntimeAudit` hook scaffold with `it.todo` tests.
- **flint-test-writer** — Scaffold test files for all Group B consumers with `it.todo` matching the contract `testBoundaries`.

### Group B (parallel, after Group A) — Wire-up

- **flint-ast-surgeon** — Install `axe-core@4.10.3` as a dev dependency in the root package + bundle location determination (prod `dist-electron/axe/` + dev `node_modules/axe-core/`). Write adapter IPC handler body that injects the bundled axe script into the sandbox BrowserWindow.
- **flint-state-architect** — Fill in `useRuntimeAudit` logic. Create `useMergedA11yFindings` derivation hook + tests.
- **flint-design-engineer** — Create `RuntimeAuditPill.tsx` + tests. Mount inside `StatusBar.tsx` conditional on `sessionContext.features.runtimeAxeEnabled === true`.
- **flint-design-engineer** — Modify `GovernanceDashboard.tsx` to consume merged findings + render source-authority chips. Wrap the "Runtime Audit" accordion in the same flag check.

### Group C (sequential, after Group B) — Validation

- **flint-test-writer** — Replace all `it.todo` with real assertions across all test files. Run full suite. Confirm flag-off path (pill and accordion both absent when `runtime.axe.enabled !== true`).
- **flint-integration-validator** — Execute the full contract boundary set. Confirm every `testBoundary` has a matching test. Confirm every `invariant.threshold` holds. Confirm no Phase 0 or MINT.5 regression. Write findings to the declared report file (`.flint-context/reviews/runtime.1-integration-2026-04-18.md`) with verdict SHIP / FIX / REDESIGN. This entry is its own impact row (closes WARNING-1 from the lint report).
- **/review gate** — Three parallel reviewers (UX + code + security) write findings to `.flint-context/reviews/runtime.1-{ux,code,security}-2026-04-18.md`. Justin surfaces findings, approves threshold.

---

## Risks

| # | Risk | Severity | Commandment | Mitigation |
|---|------|----------|-------------|-----------|
| R1 | Sandbox BrowserWindow leaks resources (never torn down, accumulates across project opens) | medium | 14 | Lifecycle bound to `activeProjectRoot` change. Explicit teardown in `window-all-closed`. Integration test asserts BrowserWindow count after 100 audits ≤ 1. |
| R2 | axe-core bundle adds ~400KB to Electron dist; web build adds comparable gzipped size | low | 4 | Lazy-load the axe bundle — only loaded into sandbox when first audit fires. Unloaded when sandbox tears down. Web build: loaded into hidden iframe on-demand. |
| R3 | axe version bump silently changes finding shape | medium | — | Version pinned exactly. Adapter checks `axe.version === EXPECTED_AXE_VERSION` and returns `{ status: 'version-mismatch' }` on mismatch. Upgrade path is a tested migration, not a silent drift. |
| R4 | `frame-title` and iframe-specific axe rules miss nested iframes because sandbox loads flattened preview HTML | low | — | Documented as a known limitation in the contract. Future phase can inline iframe content into the sandbox. Not a ship-blocker for Saturday. |
| R5 | Dedup ruleId map drifts from axe version — a new axe release adds rules we don't know about | medium | — | Contract explicitly allows `ruleId: 'RUNTIME-<axe-rule-id>'` fallback. `axeRuleMap.ts` tests are expected to fail-fast when a new axe version adds rules, forcing a deliberate map update. |
| R6 | Web-build parity diverges — Electron BrowserWindow sandbox isn't isomorphic with a Puppeteer page | high | — | The adapter surface is the IPC contract, not the implementation. Both implementations return `RuntimeAuditResult`. `web-parity-drift` test loads same HTML on both and asserts identical violations array length + first-finding ruleId. |
| R7 | GovernanceDashboard merge adds render cost that degrades existing finding list performance | medium | — | `useMergedA11yFindings` is memoized. Benchmark: merge of 100 AST + 100 runtime findings must complete in < 20ms. Added to invariants list if this risk surfaces during implementation. |
| R8 | User confuses runtime authority with AST authority — "why does Warden say A11Y-001 but runtime says RUNTIME-image-alt?" | medium | — | `axeRuleMap.ts` covers the common cases so they map to A11Y-xxx consistently. `RUNTIME-*` prefix only appears for axe-only rules. UI chip shows both authorities when deduped, clearly communicating "both sources agree." |
| R9 | CSP regression on primary preview (someone relaxes CSP thinking it's needed for axe) | high | — | Separate BrowserWindow is architecturally enforced — the primary preview CSP is in `createWindow()`, the sandbox CSP is in a new function `createRuntimeAuditSandbox()`. Code review catches any CSP change on the primary path. Invariant `csp-sandbox-isolation` asserts this at test time. |
| R10 | Offline-mode violated if axe-core pulls telemetry or analytics on first run | high | 4 | axe-core@4.x is local-only (verified against source). Adapter sandbox has network disabled via `session.webRequest.onBeforeRequest` reject-all handler. Invariant `offline-resilience` asserts zero network calls. |

---

## Rollout + Rollback Plan

**First ship:** RUNTIME.1 lands with `runtime.axe.enabled: false` as the default. The IPC handler, MCP normalizer, store slice, and hooks are fully wired. The user-facing surfaces (`RuntimeAuditPill` + GovernanceDashboard "Runtime Audit" accordion) are gated behind the flag and are invisible on first ship.

**Enablement path:** Justin flips the flag in a follow-up release once the adapter has soak-time in CI and local dogfood. No code change needed to flip — just a `flint.config.yaml` edit:

```yaml
rules:
  runtime:
    axe:
      enabled: true
```

Per-project enablement is supported because the flag lives in the project config, not a global. A user can opt-in per project.

**Rollback:** RUNTIME.1 is strictly additive. No schema migrations. No existing data transformations. No IPC channel renaming. Three layers of rollback in order of cost:

1. **Flag flip (zero-cost):** set `runtime.axe.enabled: false`. Pill and accordion disappear. IPC handler remains live but user cannot invoke it.
2. **Branch revert (low-cost):** revert the feature branch. All appended code, schema, and resolver removed.
3. **axe-core instability fallback:** if axe itself proves unstable (version drift, network leakage), keep the IPC handler but short-circuit it to return `{ status: 'error', error: { code: 'disabled' } }`. Zero user impact beyond loss of runtime mode.

---

## Dependencies (new)

Add to root `package.json` `dependencies`:
- `axe-core`: `"4.10.3"` (exact pin, not caret)

No devDependency additions. No new build-time tooling.

---

## References

- Contract schema: `shared/contract-schema.ts`
- Sample contract style: `.flint-context/contracts/MINT.5-phase2-contract.md`
- A11y types: `flint-mcp/src/core/a11y/types.ts`
- SourceAuthority registry: `flint-mcp/src/core/governance/ruleProvenanceRegistry.ts`
- SEC.1 CSP constants: `electron/main.ts:325-343`
- IPC Validators registry: `shared/ipc-validators.ts:200+`
- Web build parity feedback: `feedback_web_parity_drift.md`
- Weekend sprint plan: `docs/strategy/WEEKEND-PLAN-2026-04-18.md`
- Competitive landscape: `docs/strategy/COMPETITIVE-LANDSCAPE-2026-04-18.md` § 1.3 (axe/Stark) and § 2 Gap #3
