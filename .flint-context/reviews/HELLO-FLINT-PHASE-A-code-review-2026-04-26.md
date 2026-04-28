# Code Review — HELLO-FLINT-PHASE-A (Phase A)

**Reviewer:** flint-code-reviewer
**Date:** 2026-04-26
**Round:** 1
**Phase:** HELLO-FLINT-A
**Verdict:** FIX-FORWARD (derived — 0 blocking, 6 warnings, 4 suggestions)

---

## Summary

Phase A landed cleanly against the most load-bearing parts of the contract: the
process boundary holds (no `fs/path/electron` imports in `src/`), Commandment 14
is honored end-to-end (mcpConfigWriter routes every byte through the
server-side FileTransactionManager and a static-grep test enforces it), the
existing-config preservation property test runs the merge across 20 randomized
fixtures with zero entries lost, and the JSONC stripper handles both `//` and
`/* */` forms before parse. TSC is clean (`npx tsc -b` passes with zero
diagnostics). The render-gate ordering in `App.tsx` correctly threads
`setupComplete → consent → HelloFlintWelcome → RestoringSplash → LaunchScreen`
and the alreadyConnected fast-path uses an immediate `setHasSeenWelcome(true)`
that closes the gate before the screen ever paints.

That said, six warnings need to be resolved before this should be considered
done — none are architectural and all are tractable in one or two files. The
two most consequential are:

1. **The contract specifies that the `hello` namespace is "routed through
   `validateIPC`" and the IPC table assigns named Zod validators to all three
   channels — but the actual `web-api.ts` adapter calls `invoke()` directly
   with no payload OR response validation.** The validators exist as named
   exports that satisfy the contract linter's grep, but they are never invoked
   at the boundary. This is a real gap against the contract's "Design by
   Contract at the process boundary" principle even though it's not a
   security-critical blocker.

2. **The Beta-info `useEffect` in `App.tsx` reads only the component's own
   storage key (`flint-hello-welcome-seen`) and ignores the v1 sentinel
   (`flint:has-seen-hello-welcome:v1`) used by the gate.** A returning beta
   tester whose v1 key is set but whose component-key is not will see the
   welcome screen flash open again because `setBetaWelcomeDone(false)` runs
   unconditionally for beta builds. The contract intends "returning users
   never see the welcome again" — this regresses on that.

The remaining four warnings cover schema-vs-doc drift, the dual `.ts`/`.js`
mirror that future phases will keep desyncing, and a pair of
type-discipline / UX-copy issues in the component.

Tests passed (3600/3600 React; 47 new server tests) and TSC is clean. None of
the findings invalidate that — they are gaps and refinements on top of a
working implementation.

---

## Verdict Math

```
blocking:    0
warnings:    6
suggestions: 4
```

Per `deriveVerdict(findings, 'code')`: zero blockings + at least one warning →
**FIX-FORWARD**.

---

## Findings

### W-1 — `web-api.ts` `hello` namespace bypasses `validateIPC` at the renderer boundary

**Severity:** warning
**Scope:** one-file
**Commandment:** — (process-boundary discipline; not numbered C9, which is
ΔE perceptual color)

**Evidence:**
- `src/adapters/web-api.ts:643-689` — the entire `hello` namespace returns
  `invoke('hello:...') as Promise<...>` without calling `validateIPC` on the
  payload or `validateIPCResponse` on the result.
- `shared/ipc-validators.ts:608-651` — `helloDetectEditorsSchema`,
  `helloWriteMcpConfigBulkSchema`, `helloWriteMcpConfigBulkResponseSchema`,
  and `helloAlreadyConnectedSchema` exist as named exports.
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md:38` — "Add `hello`
  namespace on `window.flintAPI` (`detectEditors`, `writeMcpConfigBulk`,
  `alreadyConnected`) routed through `validateIPC`".
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts:188-213` — IPC
  table lists `validator: 'helloDetectEditorsSchema'` (etc.) for every channel.

**Observed:** The Zod validators are exported by name (so the contract linter's
grep is satisfied) but are not called anywhere in the renderer→main path.
`server/index.ts:3350-3360` does parse the bulk payload — but the renderer
adapter, which is the named `validator` site in the contract IPC table, does
not.

**Rationale:** The contract uses Design by Contract at the preload bridge as a
deliberate architecture choice — the renderer pre-validates payload before
crossing the process boundary, and the main process re-validates as an
independent invariant. Skipping the renderer side weakens the boundary against
a compromised renderer (CSP bypass, embedded iframe, etc.) and breaks
consistency with other namespaces (`tokens:*`, `flint:getCoverageSummary`,
`runtime:run-axe`) that do route through `validateIPC`. It also means the
named validator exports are decorative — they pass the lint gate but
contribute zero runtime safety.

**Proposed fix:** In `src/adapters/web-api.ts:643-689`, wrap each call:

```ts
import {
  helloDetectEditorsSchema,
  helloWriteMcpConfigBulkSchema,
  helloWriteMcpConfigBulkResponseSchema,
  helloAlreadyConnectedSchema,
} from '../../shared/ipc-validators'

hello: {
  detectEditors: async () => {
    const raw = await invoke('hello:detect-editors')
    return helloDetectEditorsSchema.parse(raw)
  },
  writeMcpConfigBulk: async (payload) => {
    const valid = helloWriteMcpConfigBulkSchema.parse(payload)
    const raw = await invoke('hello:write-mcp-config-bulk', valid)
    return helloWriteMcpConfigBulkResponseSchema.parse(raw)
  },
  alreadyConnected: async () => {
    const raw = await invoke('hello:already-connected')
    return helloAlreadyConnectedSchema.parse(raw)
  },
},
```

That removes the `as Promise<...>` casts and gives the contract its actual
runtime gate.

---

### W-2 — Beta `useEffect` in `App.tsx` re-opens welcome for returning beta testers

**Severity:** warning
**Scope:** one-line
**Commandment:** —

**Evidence:**
- `src/App.tsx:144-150` — `hasSeenWelcome` initial state reads BOTH keys
  (`flint:has-seen-hello-welcome:v1` AND `flint-hello-welcome-seen`).
- `src/App.tsx:813-824` — Beta info `useEffect` reads ONLY
  `getHasSeenHelloWelcome()` (which is the component's own
  `flint-hello-welcome-seen` key) and calls
  `setBetaWelcomeDone(false)` whenever `info.isBeta` is true.
- `src/components/ui/HelloFlintWelcome.tsx:700-706` — `hasSeenHelloWelcome()`
  reads only `flint-hello-welcome-seen`, not the v1 sentinel.

**Observed:** A returning user whose `flint:has-seen-hello-welcome:v1` is
`'true'` but whose `flint-hello-welcome-seen` is unset (this happens for
anyone who completed the welcome by clicking "I see the green dot" on a build
where only App.tsx wrote the v1 key — i.e. ANY user who landed before the
component-side persistence existed, or any user who skipped via Escape on a
state where the component's `handleSkip` didn't run) will have
`hasSeenWelcome` initialise to `true`, then have the beta effect call
`setBetaWelcomeDone(false)`, re-opening the welcome.

**Rationale:** The contract acceptance criteria #3 says "A tester whose editor
already has Flint configured never sees the welcome screen — `alreadyConnected()`
short-circuits to `onComplete()`." Acceptance criteria #1 implicitly extends
this to "returning users". The current beta-effect inverts the gate
unconditionally for beta builds and only consults one of the two persistence
keys. For returning testers on a beta build, this is a UX regression they
will hit on the second launch.

**Proposed fix:** Either (a) gate the beta effect on the same dual-key check
as the state initialiser, or (b) collapse to a single source of truth (drop
the v1 key entirely and persist only via the component's own key). Option (b)
is simpler and matches W-3 below.

---

### W-3 — Storage-key duplication invites future drift

**Severity:** warning
**Scope:** cross-file
**Commandment:** —

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:59` —
  `STORAGE_KEY = '${BRAND.productLower}-hello-welcome-seen'` (resolves to
  `'flint-hello-welcome-seen'`).
- `src/App.tsx:144` —
  `HELLO_WELCOME_KEY = 'flint:has-seen-hello-welcome:v1'`.
- `src/App.tsx:147-149` — gate reads both keys.
- `src/App.tsx:154` — gate writes only `HELLO_WELCOME_V1_KEY` on
  `setHasSeenWelcome(true)`.
- `src/components/ui/HelloFlintWelcome.tsx:171,222,227` — component writes
  only its own `STORAGE_KEY` on skip / verify / manual-done.

**Observed:** Two distinct localStorage keys persist the same state. App.tsx
writes one, the component writes the other, and both read the union of both
on init. Naming convention also differs (kebab vs. colon-separated, `v1`
suffix on one and not the other).

**Rationale:** This is a future-drift trap. Phase B will inevitably touch the
welcome flow; the next agent has two keys to keep in sync, two callers to
update when the convention changes, and no comment explaining why both exist.
The `v1` suffix suggests planned versioning, but only one of the two keys
participates in it — bumping to `v2` will leave returning users in a
half-migrated state unless the component key is also bumped.

**Proposed fix:** Pick one. The cleanest option is to delete
`HELLO_WELCOME_V1_KEY` from `App.tsx` and have the gate consult only
`hasSeenHelloWelcome()` from the component. The component is the only place
the welcome flow is ever dismissed; centralising the persistence there
matches Zustand-store/React-component conventions used elsewhere in the
repo. If versioning matters, embed it in the component's key
(`flint-hello-welcome-seen-v1`) and bump there.

---

### W-4 — `helloWriteMcpConfigBulkSchema` payload schema doesn't enforce its own JSDoc

**Severity:** warning
**Scope:** one-file
**Commandment:** —

**Evidence:**
- `shared/ipc-validators.ts:618-626`:
  ```ts
  /**
   * HELLO-FLINT-A — payload validator for `hello:write-mcp-config-bulk`.
   * editors: non-empty array of editor names (1..3; handler dedupes).
   * mcpServerPath: absolute path string, min 1 char.
   */
  export const helloWriteMcpConfigBulkSchema = z.object({
    editors: z.array(z.enum(['claude-code', 'cursor', 'vscode'])),
    mcpServerPath: z.string(),
  })
  ```
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts:421-423` —
  testBoundary `hello:write-mcp-config-bulk handler` edge case: "empty
  editors array rejected by Zod".
- `server/__tests__/helloFlintIpc.test.ts:779-790` — the test asserting
  empty-array rejection constructs its own inline schema with `.nonempty()`
  instead of importing `helloWriteMcpConfigBulkSchema`.

**Observed:** The exported schema does not enforce the constraints documented
in its own JSDoc. `editors: []` and `mcpServerPath: ''` both pass `safeParse`
on the production validator. The handler then delegates to the bulk writer,
which iterates an empty array and returns `{written: [], failed: []}` —
silently no-op-ing instead of rejecting with a contract violation.

The test that "verifies" empty-array rejection bypasses the production
schema by re-constructing one inline, so the test passes while the actual
gate is open.

**Rationale:** The handler's `mcpServerPath !== canonicalMcpPath` check
(`server/index.ts:3365`) catches the empty string downstream, but the Zod
gate is supposed to be the first line of defense. Documented intent and
runtime behavior diverging is exactly the failure mode IPC validators are
supposed to prevent. The test giving false confidence is the more concerning
half — anyone reading it would assume the schema enforces non-empty.

**Proposed fix:**

```ts
export const helloWriteMcpConfigBulkSchema = z.object({
  editors: z.array(z.enum(['claude-code', 'cursor', 'vscode'])).min(1).max(3),
  mcpServerPath: z.string().min(1),
}).strict()
```

Then update the test at `server/__tests__/helloFlintIpc.test.ts:779-790` to
import and use `helloWriteMcpConfigBulkSchema` directly.

---

### W-5 — `ipc-validators.js` mirror will drift; no automated sync

**Severity:** warning
**Scope:** cross-file
**Commandment:** —

**Evidence:**
- `shared/ipc-validators.ts` — 685 lines, last modified 2026-04-26 21:53
- `shared/ipc-validators.js` — 521 lines, last modified 2026-04-26 21:46
- The architect's Phase 2.5 brief explicitly flags: "the architect mentioned
  a JS/TS dual-file issue with `ipc-validators.js`. Is the `.js` mirror likely
  to drift again as Phase B adds more schemas?"
- No `package.json` script or husky hook syncs them — `grep -rn ipc-validators
  package.json scripts/` returns empty.
- The `.js` mirror DOES contain the four HELLO schemas at lines 467-498, so
  Phase A landed in sync. The risk is for the next phase that adds a schema
  and forgets the mirror.

**Observed:** Two source files for the same IPC contract, hand-maintained,
with no compile-time or pre-commit check that the `.js` matches the `.ts`.
The 7-minute mtime gap between the two is the visible artifact of manual
sync — Phase A happened to remember; the next phase may not.

**Rationale:** A schema present in `.ts` but missing from `.js` will fail at
runtime in whichever runtime loads the `.js` (Node ESM imports without TS
loader, or any consumer that imports `ipc-validators.js` directly — e.g.
build tooling). Silent drift means a phase that "passes TSC and tests" can
still ship a runtime failure.

**Proposed fix:** Either (a) delete `ipc-validators.js` and import the `.ts`
everywhere via the project's existing TS transpile path, or (b) generate
`.js` from `.ts` at build time via a script in `package.json` (`prebuild`
or a `validators:sync` step that pre-commit runs). Option (a) is structurally
cleaner if no consumer requires the pre-built `.js`. A 30-second
investigation would confirm whether anything actually imports the `.js`.

---

### W-6 — Three `(window as any)` casts in HelloFlintWelcome bypass the typed surface

**Severity:** warning
**Scope:** one-file
**Commandment:** —

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:134` —
  `const api = (window as any).flintAPI?.hello;`
- `src/components/ui/HelloFlintWelcome.tsx:178` — same pattern.
- `src/components/ui/HelloFlintWelcome.tsx:202` — same pattern.
- `src/types/flint-api.d.ts:2125-2171` — `window.flintAPI.hello` is fully
  typed, including all three method signatures.

**Observed:** The component casts `window` to `any` to access `flintAPI.hello`
even though the property is declared on the global `FlintAPI` interface and
TypeScript would resolve it without any cast.

**Rationale:** The casts hide actual type errors. If a future change to the
contract removes a method or alters its signature, the consumer code in this
component will not surface the breakage at the TS layer — it will only
appear at runtime. This is the exact category of error the typed
`flint-api.d.ts` exists to catch.

**Proposed fix:** Use `window.flintAPI.hello` directly and rely on the
optional-chaining pattern already present (`window.flintAPI?.hello`) for
graceful degradation in pre-A2-landed environments. No `any` cast needed.

---

### S-1 — Manual-snippet output diverges from server-written output (missing `env`)

**Severity:** suggestion
**Scope:** one-file

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:69-79` — manual snippet produces
  `{ command: 'node', args: [mcpServerPath] }`.
- `server/services/mcpConfigWriter.ts:175-179` — writer produces
  `{ command: 'node', args: [mcpServerPath], env: { FLINT_PROJECT_ROOT: ... } }`.

**Observed:** A user copy-pasting the manual snippet gets a config without
the `FLINT_PROJECT_ROOT` env. Behavior diverges from the auto-written path.

**Rationale:** Whether MCP server requires that env at boot determines whether
this is a real bug or a cosmetic one. Either way, the manual fallback path
should produce the same config the writer would produce — that's the contract
guarantee of "the manual-snippet path covers any user the detector misses".

**Proposed fix:** Either include `env: { FLINT_PROJECT_ROOT: '/your/project' }`
in the snippet (with a placeholder), or document below the snippet that the
env is optional. If the server actually requires it, this is a warning, not
a suggestion.

---

### S-2 — "Both" button with three present editors sends all three (label/action mismatch)

**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:409-411` — `hasBoth` is true when
  cursor AND claude-code are present (vscode is irrelevant).
- `src/components/ui/HelloFlintWelcome.tsx:443` —
  `onClick={() => onChoose(present.map(e => e.editor))}` sends ALL present
  editors, not just cursor + claude-code.
- `src/components/ui/__tests__/HelloFlintWelcome.test.tsx:357-358` — the
  test for the Both button asserts only `payload.editors.length >= 2`,
  masking this.

**Observed:** With cursor, claude-code, and vscode all present, clicking
"Both" sends 3 editors. The label says Both but the action is "All".

**Rationale:** Cosmetic copy issue. No correctness problem — writing to all 3
is the user's likely intent — but the label is wrong.

**Proposed fix:** Either rename to `All present editors` (label changes with
count: "Both" when 2, "All" when 3), or change the click handler to
`onChoose(['cursor', 'claude-code'])` so the label and action match. The
former is more user-friendly.

---

### S-3 — Test files collapsed contrary to contract impact map

**Severity:** suggestion
**Scope:** one-file

**Evidence:**
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts:148-159` — impact
  map calls for `server/services/__tests__/ideDetection.test.ts` AND
  `server/services/__tests__/mcpConfigWriter.test.ts` (two separate files).
- Actual filesystem: `server/services/__tests__/` does not exist for these.
  All ideDetection + mcpConfigWriter tests live in
  `server/__tests__/helloFlintIpc.test.ts` (one file, 916 lines).
- The boundaries are still exercised — coverage isn't lost.

**Observed:** A single-file test layout instead of the contract's two-file
layout. The 47 tests cover the same boundaries.

**Rationale:** Not a correctness issue, but the integration-validator and
future test-writers will look for the contract-named files first. A 916-line
mixed-domain file is also harder to scan than two focused ones.

**Proposed fix:** Split into the two files the contract names. Each section
of the current file is already labelled by domain (`ideDetection`,
`mcpConfigWriter — writeMcpConfig`, etc.) — the split is mechanical.

---

### S-4 — `helloDetectEditorsSchema` is named as a payload validator but defines the response shape

**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts:191-196` — IPC
  channel `hello:detect-editors` declares `validator: 'helloDetectEditorsSchema'`.
- `shared/ipc-validators.ts:606` —
  `/** HELLO-FLINT-A — response validator for `hello:detect-editors`. */`
- The schema body validates `{ editors, mcpServerPath, platform }` — that's
  the response, not the (`undefined`) payload.

**Observed:** The contract's `validator` field by convention names a payload
validator; this export names a response validator. The contract linter only
greps for the export name, so the lint passes.

**Rationale:** A future reader following the contract's `validator` reference
will load this schema expecting a payload contract and find a response
contract. Cosmetic but trips up linters and docs.

**Proposed fix:** Rename to `helloDetectEditorsResponseSchema` and either
(a) add a payload schema (`z.undefined()`) for the contract's `validator`
field, or (b) update the contract to name the response validator explicitly
in a `responseValidator` field if the schema permits.

---

## Rubric

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Process boundary holds: no `fs/path/electron/sqlite` imports under `src/` | pass | grep on src/components/ui/HelloFlintWelcome.tsx and src/App.tsx returns no fs/path/electron imports |
| `mcpConfigWriter.ts` contains zero direct `fs.writeFile` / `writeFileSync` calls (Commandment 14) | pass | server/services/mcpConfigWriter.ts:1-278 — only readFileSync, mkdirSync, existsSync. Source-grep test at server/__tests__/helloFlintIpc.test.ts:522-539 enforces. |
| Existing-config preservation: 0 entries lost across randomized fixtures | pass | server/__tests__/helloFlintIpc.test.ts:625-649 — 20-fixture property test |
| JSONC comment stripping handled before parse | pass | server/services/mcpConfigWriter.ts:62-112 + tests at 290-328, 466-505 |
| File-doesn't-exist atomic merge tested | pass | server/__tests__/helloFlintIpc.test.ts:443-461 |
| `mcpServerPath` mismatch rejected server-side | pass | server/index.ts:3362-3367 |
| Render gate ordering: setupComplete → consent → HelloFlintWelcome → RestoringSplash → LaunchScreen | pass | src/App.tsx:1000-1069 |
| Already-connected fast-path runs on mount before any user interaction | pass | src/App.tsx:792-808 + tests at src/__tests__/App.renderOrder.test.tsx:111-147 |
| All 3 hello channels declare a Zod validator named in the contract | pass | shared/ipc-validators.ts:608-651 |
| `web-api.ts` `hello` namespace routes through `validateIPC` per the contract | **fail** | src/adapters/web-api.ts:643-689 calls `invoke()` directly with `as Promise<...>` casts; no validateIPC anywhere in the namespace. See W-1. |
| `helloWriteMcpConfigBulkSchema` enforces its documented constraints (non-empty editors, non-empty mcpServerPath) | **fail** | shared/ipc-validators.ts:623-626 — neither constraint is in the schema. See W-4. |
| Beta-effect respects the welcome's persistence on returning launches | **fail** | src/App.tsx:813-824 — only consults component key, can re-open welcome for v1-only persisted users. See W-2. |
| Component uses typed `window.flintAPI.hello` surface, not `as any` | **fail** | src/components/ui/HelloFlintWelcome.tsx:134, 178, 202. See W-6. |
| Token-only styling — zero raw hex, zero arbitrary bracket color values | pass | tests at src/components/ui/__tests__/HelloFlintWelcome.test.tsx:499-514 enforce static-grep |
| `npx tsc -b` exits 0 | pass | clean run, no diagnostics |

---

## Scope Coverage

**Reviewed:**
- `src/components/ui/HelloFlintWelcome.tsx`
- `src/components/ui/__tests__/HelloFlintWelcome.test.tsx`
- `src/App.tsx` (render-gate region + alreadyConnected useEffect + storage-key region)
- `src/__tests__/App.renderOrder.test.tsx`
- `src/components/__tests__/AppMountGate.test.tsx` (mock updates only)
- `server/services/ideDetection.ts`
- `server/services/mcpConfigWriter.ts`
- `server/services/fileTransactionManager.ts`
- `server/__tests__/helloFlintIpc.test.ts`
- `server/index.ts` (handler region 3220-3402 only)
- `shared/ipc-validators.ts` (HELLO-FLINT region only)
- `shared/ipc-validators.js` (HELLO-FLINT region — drift check)
- `src/adapters/web-api.ts` (hello namespace only, lines 642-689)
- `src/types/flint-api.d.ts` (hello namespace only, lines 2117-2171)
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md`
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts`

**Skipped:**
- `electron/preload.ts` — Phase A is web-transport-first by design (per contract section 1)
- `electron/main.ts` — same; the legacy `setup:*` channels are kept as-is and out of scope per the architect's Phase 2.5 brief
- Pre-existing TSC errors in `electron/thumbnailGenerator.ts` and `electron/visualAuditor.ts` — out of scope per Phase 2.5 brief; full `tsc -b` actually passes here
- The legacy `SetupWizard.tsx` — explicitly retained for menu Reset State path (contract resolved Q1)
- Phase B walkthrough work — separate spec, not built yet

---

## Notes for the parallel reviewers

UX reviewer: please look closely at the "Both" button copy when 3 editors are
present (S-2) and the manual-snippet env-missing footgun (S-1) — both are
copy/UX edges I noted but didn't grade as code blockers.

Security reviewer: W-1 (validateIPC bypass) is the boundary-discipline
finding; please second-opinion whether the renderer-side gap rises to
blocking in your dimension. Also W-4 (Zod schema not enforcing
documented constraints) — the schema is the gate, the gate is open, you'll
have a clearer view of whether that should be FIX-BEFORE-SHIP from the
security angle.
