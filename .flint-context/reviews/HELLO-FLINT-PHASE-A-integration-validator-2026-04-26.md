# Integration Validator (Canary) — HELLO-FLINT-PHASE-A

**Reviewer:** flint-integration-validator (regression canary)
**Date:** 2026-04-26
**Round:** 1 (post-domain-reviewers)
**Verdict (derived):** FIX-BEFORE-SHIP — 3 blocking, 6 warnings, 4 suggestions

---

## Role

This is the cheaper-pilot canary. The three scoped domain reviewers (UX, code, security) have surfaced 3 blocking + 17 warnings + 13 suggestions across their dimensions. My job is to find what no single reviewer could see from their scoped vantage point — cross-cutting issues, contract-fidelity drift, and shipping-readiness gaps. I do not re-litigate findings already in the scoped reports; I cross-reference them where my findings overlap and otherwise add net-new evidence.

---

## Net-new findings (not surfaced by any scoped reviewer)

### BLK-INT-1 — `dist-web/` build artifacts are stale; closed-beta package would ship without Phase A wired in

**Severity:** blocking
**Scope:** cross-file (build pipeline)

**Evidence:**
- `dist-web/assets/` last rebuilt 2026-04-26 20:02
- `shared/ipc-validators.ts` last edited 2026-04-26 21:53 (the schemas Phase A added)
- `grep "Welcome to Flint" dist-web/assets/*.js` → 0 matches
- `grep "alreadyConnected\|detectEditors\|writeMcpConfigBulk" dist-web/assets/*.js` → 0 matches
- `grep "HelloFlintWelcome\|hello-welcome" dist-web/assets/index-jgT4Ysmo.js` → 0 matches

**Observed:** The committed `dist-web/` bundle (`index-jgT4Ysmo.js`, `web-api-ROSoah7m.js`) does NOT contain any HELLO-FLINT-PHASE-A code. Source files added the welcome surface, the hello namespace, and the schemas roughly 2 hours after the last bundle build. The bundle that would ship to the closed-beta tester carries the OLD `BetaWelcome` flow, not the new one — even though the source has been refactored away from it.

**Rationale:** Closed-beta-blocking. If a tester opens the web build (`docs/beta/INSTALL-GUIDE.md` is the first surface they see), they will land on the deleted `BetaWelcome` UI shape, the install guide will describe nothing they can use (BLK-1 in UX review compounds with this), and the entire Phase A effort is invisible. The `BetaWelcome.tsx` source file is deleted, so the bundle was actually built BEFORE deletion landed — meaning any user running the bundle will see references to a missing component if any code path tries to lazy-load it. This isn't a code defect — Phase A wrote correct source — but it IS a shipping-pipeline gap that no domain reviewer was scoped to catch.

**Proposed fix:** Re-run `npm run build:web` and commit the new `dist-web/` bundles in the same commit as the Phase A changes (or delete `dist-web/` from the working tree if it's not meant to be committed and add it to `.gitignore`). Add a pre-commit hook that warns when `src/` source has been modified more recently than `dist-web/assets/*.js`.

**Status:** open

---

### BLK-INT-2 — `betaWelcomeDone` legacy alias breaks one-way persistence semantics; returning beta tester can have welcome re-open mid-session

**Severity:** blocking
**Scope:** one-file (root cause), cross-file (effects)

**Evidence:**
- `src/App.tsx:151-156` — `setHasSeenWelcome` is a one-way ratchet: it only persists `'true'` to localStorage; calling it with `false` updates React state but writes nothing.
- `src/App.tsx:159-160` — `setBetaWelcomeDone = setHasSeenWelcome` (alias to the same one-way ratchet).
- `src/App.tsx:813-819` — beta info effect calls `setBetaWelcomeDone(false)` after the IPC resolves and `info.isBeta` is true.
- `src/App.tsx:1028-1035` — gate is `if (!hasSeenWelcome)`; flipping React state to `false` re-mounts the welcome immediately.

**Observed:** A returning beta tester whose v1 key is set in localStorage:
1. t=0: `hasSeenWelcome` initialises `true` from `localStorage[HELLO_WELCOME_KEY]`. Welcome gate is closed.
2. t=20ms: User is looking at LaunchScreen / RestoringSplash. The beta-info effect IPC resolves, `info.isBeta === true`, calls `setBetaWelcomeDone(false)`.
3. t=21ms: React state is now `false`. Welcome screen pops up over the LaunchScreen.
4. User dismisses again via "I see the green dot". `setHasSeenWelcome(true)` persists `'true'` again.

This is a UX regression on every launch for beta users whose only persisted key is the v1 sentinel. Before Phase A, the gate was `if (!betaWelcomeDone && betaInfo)` — gated on BOTH the flag AND `betaInfo` resolving, so the screen only opened after the IPC returned. Phase A simplified the gate to `if (!hasSeenWelcome)` but kept the prior IPC effect that flips `betaWelcomeDone` to `false`. The two changes are individually fine but combine into a regression.

**Rationale:** The code reviewer's W-2 caught the storage-key duplication symptom but didn't surface the deeper structural cause: the alias is a two-way toggle while the underlying setter is a one-way ratchet, and Phase A inherited the prior code's toggle semantics without checking whether they still apply. This is exactly the kind of cross-cutting integration bug the scoped reviewers can't see — UX reviewer doesn't read App.tsx state machinery, code reviewer flagged the keys but treated them as a hygiene issue, security reviewer is looking at IPC and writes.

**Proposed fix:** Choose ONE of:
- (a) Make `setHasSeenWelcome` a true two-way setter that persists `'false'` when `value === false` (and remove the v1 key on `false` so the next launch re-evaluates from a clean slate).
- (b) Delete the `setBetaWelcomeDone(false)` call at line 819 entirely. The beta-info effect should ONLY populate `betaInfo` for the welcome's footer; it should not flip the gate. The gate is owned by HelloFlintWelcome's `onComplete`/`onSkip` paths.
- (c) Drop the alias and refactor the auto-resume dependency at line 934 + the beta effect at 819 to use `hasSeenWelcome` directly. Forcing the rename surfaces the design tension.

(b) is the smallest-blast-radius fix. The footer's `buildId` will still appear when `betaInfo` populates; only the unwanted gate-reopen disappears.

**Status:** open

---

### BLK-INT-3 — Four `hello*` Zod schemas exist as named exports but are NOT registered in `ipcSchemas`; `createValidatedInvoker` cannot dispatch any hello channel

**Severity:** blocking
**Scope:** architectural (whole IPC validation surface)

**Evidence:**
- `shared/ipc-validators.ts:39-279` — the canonical `ipcSchemas` registry contains 15 channels: `tokens:*`, `figma:*`, `saveFile`, `readFile`, `server:get-status`, `ping`, `governance:*`, `flint:getCoverageSummary`, `runtime:run-axe`, `mcp:call-tool`. **No `hello:*` keys.**
- `shared/ipc-validators.ts:608-651` — the four `hello*Schema` exports are defined OUTSIDE the registry, after the `} satisfies …` close at line 279.
- `shared/ipc-validators.ts:664-683` — `createValidatedInvoker(channel)` does `ipcSchemas[channel]` lookup. For `channel === 'hello:detect-editors'`, this returns `undefined` and the function throws.
- `shared/ipc-validators.ts:288-307` — the established pattern (used by Phase 0, RUNTIME.1, MINT.5) is to register the schema INSIDE `ipcSchemas` and then re-export an alias by name to satisfy the contract linter's grep: `export const runtimeRunAxePayloadSchema = ipcSchemas['runtime:run-axe'].payload`. HELLO-FLINT-PHASE-A did not follow this pattern.
- `src/adapters/web-api.ts:643-689` — `hello` namespace calls `invoke()` with bare `as Promise<…>` casts. No `validateIPC` calls anywhere.
- `src/adapters/web-api.ts:13` — imports `validateIPC, mcpCallToolSchema` (so the validator is reachable) but no hello schema imports.

**Observed:** The four hello validators satisfy the Phase 1.5 contract linter's grep (the linter checks that the named exports exist) but are architecturally orphaned. They cannot be used through the standard `createValidatedInvoker` path because they are not in the registry. The renderer adapter doesn't import them. The server uses `helloWriteMcpConfigBulkSchema` directly via dynamic import (server/index.ts:3352), which works but bypasses the standard validation pipeline that every other phase wires through.

This is the structural cause of code review's W-1. W-1 said "web-api.ts skips validateIPC." The deeper finding is that the schemas were never made dispatchable from validateIPC in the first place — even if web-api.ts wanted to use the standard pattern, it couldn't, because the registry doesn't know about hello channels.

**Rationale:** Architectural-scope. Two consequences:
1. The contract's IPC table named `helloDetectEditorsSchema` etc. as the channel `validator` field. Future readers (and future agents) expect these to be wired into the standard validation flow. They are not. Anyone reading the contract today and trying to extend Phase A in Phase B will follow the contract pattern and either duplicate the orphan-schema mistake or be forced to refactor.
2. The Phase 1.5 contract linter rule "validator export name on every renderer→main / bidirectional IPC channel linking to shared/ipc-validators.ts" passed because the export exists, but the linter does not check registry membership. This is a known linter gap that Phase A is the first to exploit (likely unintentionally).

**Proposed fix:** Move the four `hello*` schemas INTO `ipcSchemas`:

```ts
// inside ipcSchemas { ... }
'hello:detect-editors': {
  payload: z.undefined(),
  response: helloDetectEditorsSchema,  // existing named export becomes the response
},
'hello:write-mcp-config-bulk': {
  payload: helloWriteMcpConfigBulkSchema,
  response: helloWriteMcpConfigBulkResponseSchema,
},
'hello:already-connected': {
  payload: z.undefined(),
  response: helloAlreadyConnectedSchema,
},
```

Then either (a) leave the existing named exports as-is (they continue to point at the schema objects), or (b) re-export them as aliases pointing into the registry, matching the Phase 0 / RUNTIME.1 pattern.

After the registry is populated, update `web-api.ts:643-689` to use the standard `validateIPC` pattern (per code review's W-1 fix). Both fixes need to land together — fixing W-1 alone would not work because the registry lookup would still fail.

Lift the Phase 1.5 contract linter check to also assert `validator export ∈ ipcSchemas` so this class of error gets caught before review next time.

**Status:** open

---

### WARN-INT-1 — Test files mirror handler logic instead of invoking it; "the WebSocket IPC server is running" testBoundary is downgraded to a unit re-implementation

**Severity:** warning
**Scope:** cross-file

**Evidence:**
- Contract testBoundaries `hello:detect-editors handler`, `hello:write-mcp-config-bulk handler`, `hello:already-connected handler` all have `given: the WebSocket IPC server is running with <channel> registered` (HELLO-FLINT-PHASE-A.contract.ts:413, 423, 433).
- `server/__tests__/helloFlintIpc.test.ts:728-768` — `helloDetectEditorsHandler()` is a function defined IN THE TEST FILE that re-implements the production handler logic verbatim. The test then calls this mirror, not the registered handler.
- `server/__tests__/helloFlintIpc.test.ts:774-790` — `hello:write-mcp-config-bulk handler — payload validation` describe block constructs an inline Zod schema with `.nonempty()` instead of importing the production schema. The justification at line 776 ("Zod v4 named-export resolution quirk in the vitest bundler") is suspect because the production server (line 3352) successfully dynamic-imports the schema at runtime.
- `server/__tests__/helloFlintIpc.test.ts:824-826` — the validator check is just `expect(validators.helloDetectEditorsSchema).toBeDefined()`, which is the exact "tests that only check `toBeDefined()`" anti-pattern the validator framework warns against.
- `src/__tests__/App.renderOrder.test.tsx:36-74` — `computeInitialHasSeenWelcome`, `runAlreadyConnectedFastPath`, and `makeSetHasSeenWelcome` are simulations of the App.tsx logic, not tests of the real component. Marked invariants RO-01 through RO-10 all run against the simulation.

**Observed:** The contract's testBoundary intent — "the IPC server is running, the renderer invokes the channel, the round-trip returns the contract-shaped response" — has been weakened across three test files into "the test re-implements what the handler is supposed to do, then asserts the re-implementation is consistent with itself." If the production handler drifts from the test mirror, the test will pass while production breaks. This is the inverse of what the testBoundary requires.

**Rationale:** Contract risk #2 (BLK-1 in security review) is the canonical example: the contract told the architect that "Atomic merge corrupts existing JSONC config" needed a test fixture, and the test added covers the happy path but not the actual mitigation requirement (refuse-to-write on parse failure). Why? Because the test exercises a "mirror" of the writer rather than the writer's full contract surface. When the handler under test is a simulation, the gaps the security reviewer found don't have anywhere to fall through.

This compounds with WARN-INT-2 below: the `web-api.ts` adapter has zero tests for the hello namespace. So the renderer→server boundary is exercised only at the component level (mock IPC) and the server level (mirror handler). Nothing tests the wire.

**Proposed fix:** Two paths, pick one or both:
- (a) Add a true integration test that boots `server/index.ts` (or its handler-registration function) on a test port, then makes real `/api/ipc` POST requests against the registered handlers. The existing `server/__tests__/index.test.ts` may already have the harness for this.
- (b) Replace the inline-Zod test at line 779-790 with one that imports `helloWriteMcpConfigBulkSchema` from the production module. If the import truly fails in vitest, file the bundler issue and document it; do not paper over with a different schema.

The integration test would have caught the `ipcSchemas` registry omission (BLK-INT-3) instantly because `createValidatedInvoker` would have thrown.

**Status:** open

---

### WARN-INT-2 — `web-api.ts` adapter has zero unit tests for the hello namespace

**Severity:** warning
**Scope:** one-file

**Evidence:**
- `src/adapters/__tests__/web-api.test.ts` — `grep "hello\|detect-editors\|write-mcp-config"` → 0 matches.
- `src/components/ui/__tests__/HelloFlintWelcome.test.tsx:78` — component tests bypass the adapter entirely by mocking `(window as any).flintAPI.hello` directly with vi.fn objects.
- Server-side mirror tests do not invoke through the adapter either.

**Observed:** The renderer-side adapter — the only thing that wraps the wire-format `invoke()` call into the typed `window.flintAPI.hello.*` surface — has no test coverage at all for any of its three new methods. Together with WARN-INT-1, this means there is exactly zero automated coverage of the actual round-trip from renderer to server. Every test in the suite either mocks the adapter or mirrors the handler.

**Rationale:** The combination of "no adapter test" + "handler tested via mirror" + "schemas not in registry" means a future agent could remove a method from `web-api.ts:643-689` entirely and the test suite would still report 3600/3600 passing. The architectural seam between the renderer and the server is invisible to the test suite. This is the kind of gap the Lever A "code reviewer scope = modified files + tests + callers" was supposed to cover — the code reviewer DID note that web-api.ts skips validateIPC (W-1) but did not flag the test coverage gap because there are no tests to point at.

**Proposed fix:** Add `src/adapters/__tests__/web-api.hello.test.ts` (or extend the existing `web-api.test.ts`) with tests that:
1. Mock the underlying `invoke()` and assert each `window.flintAPI.hello.*` method calls it with the expected channel name.
2. Assert the typed return shape is preserved for typical responses.
3. Assert the method propagates rejections correctly (the component depends on this for the `error` state path).

Five to seven tests, ~80 lines.

**Status:** open

---

### WARN-INT-3 — Implementation files redeclare contract types instead of importing them; only HelloFlintWelcome.tsx imports from the contract

**Severity:** warning
**Scope:** cross-file

**Evidence:**
- Contract section 2: "All types defined in `HELLO-FLINT-PHASE-A.contract.ts` — Phase 2 agents import from there." Executable contract line 13-15: "Phase 2 agents: import the type aliases below directly. Do not redeclare them in implementation files — the contract is the source of truth."
- `src/components/ui/HelloFlintWelcome.tsx:34` — imports types correctly: `from '../../../.flint-context/contracts/HELLO-FLINT-PHASE-A.contract'`.
- `server/services/ideDetection.ts:14, 22` — comment says "mirrors HELLO-FLINT-PHASE-A.contract.ts" then redeclares `EditorName`, `DetectedEditor`, `DetectEditorsResponse` locally.
- `server/services/mcpConfigWriter.ts` — also redeclares the types locally (search for `interface WriteMcpConfigResult`).
- `src/types/flint-api.d.ts:2125-2171` — inlines the type signatures verbatim instead of importing.
- `src/adapters/web-api.ts:643-689` — inlines the types in the `invoke()` casts.

**Observed:** Of the five files in scope that touch the hello surface, only one (`HelloFlintWelcome.tsx`) imports types from the executable contract. The other four duplicated the type declarations. The contract explicitly forbade this in its preamble.

**Rationale:** Phase 1.5 contract linting and Phase 3 integration validation are predicated on the assumption that "the contract is the source of truth and Phase 2 imports it." When implementation files drift to local declarations, the binding between contract and code weakens — a rename in the contract no longer surfaces as a TS error in the implementation, the contract becomes documentation rather than executable, and future agents see four "valid" places to declare a type and pick one based on proximity. This is the long-tail erosion that the v2 contract framework was designed to prevent.

This was not flagged by the code reviewer (their rubric checked `flint-api.d.ts:2125-2171` for shape correctness, not provenance) or the security reviewer (out-of-scope).

**Proposed fix:** Replace the redeclared types in `ideDetection.ts`, `mcpConfigWriter.ts`, `flint-api.d.ts`, and `web-api.ts` with imports from `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract`. For the `.d.ts` ambient declaration, the import has to go inside the module declaration or the file needs to switch from `declare global` ambient style — pick whichever matches the existing pattern in `flint-api.d.ts` for other contract-derived types.

**Status:** open

---

### WARN-INT-4 — Server `await import('../shared/ipc-validators.js')` couples runtime to the .js mirror; any drift between .ts and .js becomes a server-side runtime failure

**Severity:** warning
**Scope:** cross-file (architectural)

**Evidence:**
- `server/index.ts:3352` — `const { helloWriteMcpConfigBulkSchema } = await import('../shared/ipc-validators.js')`. The `.js` extension is explicit (Node ESM resolution).
- `shared/ipc-validators.ts` — 685 lines, last modified 2026-04-26 21:53.
- `shared/ipc-validators.js` — 521 lines, last modified 2026-04-26 21:46. (7-minute mtime gap visible at the time of review.)
- `package.json` — no `validators:sync` script, no `prebuild` step that emits `.js` from `.ts`.

**Observed:** Code review's W-5 named the dual-file mirror drift as a future risk. The integration validator can confirm it is more than future risk: the server runtime code path **explicitly depends** on the `.js` mirror (not the `.ts` source). For the renderer adapter (which goes through the TypeScript build pipeline), the `.ts` is the source of truth. Two consumers, two source files, hand-maintained — and the consumer that needs the most immediate correctness (the server) is bound to the file that lacks compile-time checks.

**Rationale:** Phase A happened to remember to update both files. Phase B will be a different agent in a different session who reads only the `.ts` and assumes a build step makes the `.js`. When that agent adds a schema and ships, the server will throw on the missing `helloFooSchema` import at runtime — never at build, never in tests (because tests run TypeScript). This is the structural failure code review's W-5 was warning about.

**Proposed fix:** Pick one — either delete `ipc-validators.js` and configure the server's TS pipeline to import the `.ts` source, or add `"sync:validators": "tsx ./scripts/sync-ipc-validators.ts"` to package.json + a pre-commit hook. If the `.js` exists because the server's runtime cannot consume `.ts` directly, the build step should be authoritative and the `.js` should NOT be hand-edited (it should be generated).

**Status:** open

---

### WARN-INT-5 — `AppMountGate.test.tsx` beforeEach uses conditional mock setup that leaks state across tests

**Severity:** warning
**Scope:** one-line (root cause), cross-test (consequences)

**Evidence:**
- `src/components/__tests__/AppMountGate.test.tsx:189-197`:
  ```ts
  beforeEach(() => {
      if ((window as any).flintAPI && !(window as any).flintAPI.hello) {
          ;(window as any).flintAPI.hello = { ... }
      }
  })
  ```

**Observed:** The hello mock is only installed when `flintAPI.hello` is absent. Once a prior test has installed it (or another test has mutated its methods), the conditional skips re-installation. If a test mutates `(window as any).flintAPI.hello.alreadyConnected = vi.fn().mockRejectedValue(...)`, the next test inherits the rejected mock instead of getting a fresh `connected: true` resolution.

**Rationale:** The contract testBoundary `HelloFlintWelcome:already-connected fast path: alreadyConnected resolves after user clicks Let's go (must not double-trigger)` and `alreadyConnected rejects` both require deterministic mock state per test. The conditional installation pattern works when no test mutates the mock, but Phase B will inevitably need to test rejection paths, and the leak surfaces only when a prior test failure leaves the mock in a non-default state.

This compounds with the broader point that `(window as any).flintAPI.hello` is a global singleton across the whole test process. The `vi.restoreAllMocks()` in afterEach restores spies but does not reassign the namespace.

**Proposed fix:** Drop the conditional and always reinstall a fresh mock:
```ts
beforeEach(() => {
    if (!(window as any).flintAPI) (window as any).flintAPI = {}
    ;(window as any).flintAPI.hello = {
        alreadyConnected: vi.fn().mockResolvedValue({ connected: true, editors: ['cursor'] }),
        detectEditors: vi.fn().mockResolvedValue({ editors: [], mcpServerPath: '', platform: 'darwin' }),
        writeMcpConfigBulk: vi.fn().mockResolvedValue({ written: [], failed: [] }),
    }
})
```
Apply the same pattern in `HelloFlintWelcome.test.tsx:72-79` (which already does this correctly).

**Status:** open

---

### WARN-INT-6 — Risk #2 mitigation requirement is not exercised by any test fixture; the contract→test binding broke

**Severity:** warning
**Scope:** cross-file (contract enforcement)

**Evidence:**
- Contract risk #2 (HELLO-FLINT-PHASE-A.contract.md:191): "Atomic merge corrupts existing config when file is JSONC with comments. Severity: high. Mitigation: `mcpConfigWriter.test.ts` MUST include a fixture with JSONC comments. Reuse `stripJsoncComments` helper from existing handler. Round-trip the parse → merge → serialize chain in the test."
- Contract risk in .contract.ts:474: "Atomic merge corrupts existing JSONC config (comments cause parse to throw). … mcpConfigWriter must call stripJsoncComments before JSON.parse. Test fixture with mixed // and /* */ comments is required."
- `server/__tests__/helloFlintIpc.test.ts:466-504` — the JSONC test fixtures cover the **happy path**: comments + valid JSON → strip → parse → merge → write. They do NOT cover the failure path: comments + INVALID JSON → strip → parse fails → handler swallows the parse error and silently overwrites (security review's BLK-1).
- The `mcpConfigWriter.ts` source at line 121-134 explicitly catches parse failure and returns `{}`, replacing the user's config with a flint-only config on the next write.

**Observed:** The contract said "round-trip the parse → merge → serialize chain in the test" and the implementation tested the happy chain. The actual high-severity risk (parse throws → user data destroyed) was not made into a test fixture. Security review's BLK-1 found the bug in the implementation; this finding identifies the upstream reason: the contract's risk-to-test binding was not enforced. The Phase 1.5 contract linter rule "every risk has a corresponding testBoundary" did not catch it because there IS a JSONC testBoundary — it just doesn't test the actual mitigation.

**Rationale:** This is the integration validator's specific value-add over the scoped reviewers. The security reviewer found the corruption bug. The architect named it in the contract. The test author added the fixture but reduced its scope. The integration validator is the only role positioned to detect that the chain broke — none of the three are looking at all four artifacts at once.

**Proposed fix:**
1. Fix the implementation per security review's BLK-1 proposed fix (refuse-to-overwrite on parse failure).
2. Add a test fixture: `mcpConfigWriter:refuses to overwrite unparseable config` that asserts byte-identical preservation of the original file after a write attempt against malformed JSON.
3. Add a Phase 1.5 contract linter rule: "every Risk with severity:high references at least one testBoundary by name" so the architect cannot ship a contract whose risks are linked to nothing testable.

**Status:** open

---

### SUG-INT-1 — `detectInstalled({ platformOverride: 'darwin' })` test at line 250 reads the developer's real homedir; non-deterministic across machines

**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `server/__tests__/helloFlintIpc.test.ts:250-254` — `detectInstalled({ platformOverride: 'darwin' })` with no `homeDir` override.
- `server/services/ideDetection.ts:86` — `const home = options?.homeDir ?? os.homedir()`.

**Observed:** The test asserts `result.mcpServerPath.length > 0` after calling detection without a sandbox homedir. `existsSync` then probes the developer's real `~/.claude`, `~/Library/Application Support/Cursor/User/settings.json`, etc. The asserted property (mcpServerPath nonempty) is not affected by the developer's editor configuration, so the assertion is stable, but the test does cause real disk I/O against the developer's home directory.

**Rationale:** Not destructive (`existsSync` does not modify), but creates flaky-test risk if a developer's machine has unusual permissions on those paths and reads block. Also, the test surfaces nothing the `homeDir: tmpDir` variant doesn't already cover.

**Proposed fix:** Change to `detectInstalled({ homeDir: tmpDir, platformOverride: 'darwin' })`. Same assertion holds, no developer homedir touched.

**Status:** open

---

### SUG-INT-2 — `setBetaWelcomeDone` legacy alias is documented as compat-shim but is the active wire connection between the beta-info IPC and the welcome gate

**Severity:** suggestion
**Scope:** one-file

**Evidence:**
- `src/App.tsx:157-160` — comment "Legacy alias — used by the beta info effect and auto-resume dependency below. Kept to avoid touching code outside the scope of this group."
- `src/App.tsx:819` — only call site: `setBetaWelcomeDone(false)` inside the beta info effect.
- `src/App.tsx:872, 934` — `betaWelcomeDone` is the dependency name in the auto-resume effect's gate condition AND its dep array.

**Observed:** The alias is not actually a legacy compat shim — the only consumer (line 819) was specifically modified by Phase A's diff (the change point at App.tsx:813 in the diff). Line 819 is part of the same logical change. Calling it a "legacy alias" hides that this is the active integration with the beta-info IPC.

**Rationale:** Comments that describe code as "legacy / preserved as-is" but were actually modified in the same change set are a smell. They lead future agents to assume they shouldn't touch the alias, and the structural defect at BLK-INT-2 is hidden behind that comment. Also informs the BLK-INT-2 fix path: if the comment honestly said "this is the IPC bridge between beta-info and the welcome gate," the one-way-ratchet defect would be more obvious.

**Proposed fix:** Either rename `setBetaWelcomeDone` → `setBetaInfoLoaded` (or just inline the only call site) OR rewrite the comment to honestly describe the wiring.

**Status:** open

---

### SUG-INT-3 — Test files collapsed to one file contradicting the contract impact map; explicit two-file split was specified

**Severity:** suggestion
**Scope:** one-file

**Evidence:**
- HELLO-FLINT-PHASE-A.contract.ts:148-159 explicitly names two test files: `server/services/__tests__/ideDetection.test.ts` and `server/services/__tests__/mcpConfigWriter.test.ts`.
- Filesystem: `server/services/__tests__/` does not exist. All hello tests live in `server/__tests__/helloFlintIpc.test.ts` (916 lines, 47 tests across multiple domains).

**Observed:** The contract impact map specified two files. The implementation collapsed to one. Code review's S-3 noted this. From the integration-validator scope, the additional concern is that the `helloFlintIpc.test.ts` location is not the conventional location for unit tests of `server/services/*`; future agents will look for `server/services/__tests__/` and not find tests there, even though tests do exist. Discoverability cost.

**Proposed fix:** Per code review S-3 — split the file at section boundaries (each `describe` block is already domain-scoped). Mechanical change.

**Status:** open

---

### SUG-INT-4 — `setup:detect-ides` legacy handler bypasses the detection service for Antigravity; subtle two-source-of-truth pattern

**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `server/index.ts:3220-3258` — the refactored legacy handler. Antigravity (line 3229-3232) uses `existsSync` directly instead of going through `detectInstalled()`.

**Observed:** The Phase A refactor delegated 3 of 4 legacy editors to `detectInstalled()` but left Antigravity with inline path-probing. This is consistent with the contract's open question Q3 ("Antigravity remains in the legacy SetupWizard path"), but means future agents who add Antigravity to the new hello surface will need to remember to also remove the inline probing in this legacy handler. Documentation, not defect.

**Proposed fix:** Add a `// TODO` comment on line 3229 referencing contract Q3 so the next agent knows the carve-out is deliberate.

**Status:** open

---

## Cross-cutting observations (informational, not findings)

These are observations that span multiple findings and may inform the user's triage:

1. **Three independent failure modes converge on the same code path: BLK-INT-2 (one-way ratchet), code review's W-2 (storage key duplication), and code review's W-3 (dual-key drift) are facets of the same design defect — Phase A added a new persistence path without fully removing the prior beta-welcome wiring.** A single fix that drops the alias and the v1 key entirely (option (b) in BLK-INT-2's proposed fix) resolves all three.

2. **The contract→test→runtime binding broke in three places: the contract said types must be imported (WARN-INT-3), tests must invoke the running server (WARN-INT-1), and the validators must be in the registry (BLK-INT-3). All three were architectural directives in the contract; all three were silently dropped in implementation. The Phase 1.5 contract linter caught none of them.** Lift the linter; this round of failures is a roadmap for what to add.

3. **Lever A's "code reviewer scope = modified impl + tests + callers" did its job.** Code review's W-1, W-2, W-3, W-4, W-5, W-6 cover the bulk of the gaps the canary would otherwise have found. The canary's value-add this round is concentrated in: BLK-INT-1 (build pipeline — outside any reviewer's scope), BLK-INT-3 (cross-file architectural — visible only when looking at the registry vs. the named exports vs. the adapter together), and WARN-INT-6 (contract→test binding — visible only when reading all four artifacts).

4. **Security review's BLK-1 and BLK-2 are the most severe findings of the entire ceremony.** They are both about the writer corrupting user data on edge-case inputs. WARN-INT-6 traces those defects upstream to a contract-test-binding gap. Whoever fixes BLK-1/BLK-2 should ALSO add the missing test fixtures so the next agent cannot regress them.

---

## Findings table (canary-net-new only — does not duplicate scoped reviewer findings)

| ID | Severity | Title | Scope | Cross-ref |
|----|----------|-------|-------|-----------|
| BLK-INT-1 | blocking | dist-web bundles stale; closed-beta would ship without Phase A | cross-file | none (scoped reviewers can't see build artifacts) |
| BLK-INT-2 | blocking | betaWelcomeDone alias breaks one-way persistence; welcome reopens mid-session for returning beta testers | one-file | extends code W-2/W-3 with timing pathology |
| BLK-INT-3 | blocking | Four hello* schemas not in ipcSchemas registry; createValidatedInvoker cannot dispatch hello channels | architectural | root cause of code W-1 |
| WARN-INT-1 | warning | Tests mirror handler logic instead of invoking it; testBoundary "given the WS server is running" downgraded to unit re-implementation | cross-file | extends code W-4 |
| WARN-INT-2 | warning | web-api.ts has zero tests for the hello namespace | one-file | net-new |
| WARN-INT-3 | warning | Implementation files redeclare contract types instead of importing them; only HelloFlintWelcome.tsx imports correctly | cross-file | net-new |
| WARN-INT-4 | warning | Server uses `await import('.../ipc-validators.js')`; runtime is bound to the .js mirror that has no compile-time check | cross-file | extends code W-5 with concrete consumer |
| WARN-INT-5 | warning | AppMountGate.test.tsx beforeEach uses conditional mock that leaks state across tests | one-line | net-new |
| WARN-INT-6 | warning | Contract risk #2 mitigation requirement is not exercised by any test; contract→test binding broke | cross-file | upstream cause of security BLK-1 |
| SUG-INT-1 | suggestion | detection-latency test reads the developer's real homedir; non-deterministic | one-line | net-new |
| SUG-INT-2 | suggestion | setBetaWelcomeDone documented as legacy compat-shim but is the active IPC-to-gate bridge | one-file | net-new |
| SUG-INT-3 | suggestion | Test files collapsed to one file contradicting contract two-file split | one-file | reinforces code S-3 |
| SUG-INT-4 | suggestion | setup:detect-ides Antigravity carve-out bypasses detection service | one-line | net-new |

---

## Rubric (canary scope)

| Criterion | Result | Evidence / related finding |
|-----------|--------|-----------------------------|
| Phase A diff does not touch electron/main.ts or electron/preload.ts | pass | git diff --stat shows zero electron/ modifications |
| Welcome gate and consent gate ordering is correct (consent → welcome → resume → launch) | pass | App.tsx:1014 → 1028 → 1043 → 1055 |
| Both gates use mutually consistent state shape (consent state separate from welcome state) | pass | showTelemetryConsent and hasSeenWelcome are independent useState slots |
| betaWelcomeDone alias preserves prior persistence semantics | **fail** | one-way ratchet on a two-way alias — BLK-INT-2 |
| ipc-validators.ts and ipc-validators.js mirrors are byte-equivalent for the four hello schemas | pass (today) | matched at lines 467-498 of .js / 608-651 of .ts; structural drift risk per WARN-INT-4 |
| All four hello*Schema named exports are reachable through `ipcSchemas[channel]` | **fail** | BLK-INT-3 — schemas exist as orphan exports |
| Phase A does not introduce a third localStorage key for the welcome state | pass | only two keys; key duplication is code W-3 from prior code review |
| Phase A's App.tsx changes do not undo the prior consent-dialog timing fix in TelemetryConsentDialog.tsx | pass | TelemetryConsentDialog.tsx is unmodified in working tree |
| Test isolation: each test gets a fresh tmpdir, no leak across describe blocks | pass | helloFlintIpc.test.ts:70-83 implements per-test tmpdir + cleanup |
| Test isolation: `window.flintAPI.hello` mock state is reset per test | **fail** | WARN-INT-5 — AppMountGate uses conditional mock setup |
| Mocking patchwork: tests use a consistent IPC mock pattern across files | partial | HelloFlintWelcome.test.tsx (correct) and AppMountGate.test.tsx (conditional) diverge |
| Contract risk #2 (JSONC parse failure) has a test fixture that exercises the mitigation | **fail** | WARN-INT-6 — only happy-path tests exist; security BLK-1 is the consequence |
| Contract risk #3 (file-doesn't-exist) has a test fixture | pass | helloFlintIpc.test.ts:443-461 |
| Implementation files import types from the executable contract | partial | HelloFlintWelcome.tsx imports; ideDetection.ts, mcpConfigWriter.ts, flint-api.d.ts, web-api.ts all redeclare — WARN-INT-3 |
| dist-web/ bundles include Phase A source changes | **fail** | BLK-INT-1 — bundle was built before source landed |
| `npm run test:react` reports 3600/3600 passing as documented in HANDOFF.md | not re-verified by canary | scoped reviewers reported this; canary did not rerun the suite |
| `npx tsc --noEmit` (or `tsc -b`) clean | not re-verified by canary | code review reported pass |

---

## Scope coverage

**Reviewed (canary scope):**
- `src/App.tsx:130-200, 770-940, 1000-1075, 1518-1530` (gates, alreadyConnected effect, beta info effect, consent gate, render returns, sibling modal block)
- `src/components/ui/HelloFlintWelcome.tsx:55-230` (storage key, useEffects, handlers)
- `src/__tests__/App.renderOrder.test.tsx` (full file)
- `src/components/__tests__/AppMountGate.test.tsx:108-200` (mock setup region)
- `src/components/ui/__tests__/HelloFlintWelcome.test.tsx:1-120` (mock setup region)
- `src/adapters/web-api.ts:640-690` (hello namespace) + grep across file for validateIPC usage
- `src/adapters/__tests__/web-api.test.ts` (full file — confirmed zero hello coverage)
- `src/types/flint-api.d.ts:2117-2175` (hello namespace declaration)
- `server/index.ts:3217-3402` (legacy setup handlers + new hello handlers)
- `server/services/ideDetection.ts` (full file)
- `server/services/mcpConfigWriter.ts:115-200` (read/write/error paths)
- `server/__tests__/helloFlintIpc.test.ts:60-100, 250-285, 440-540, 725-830` (setup, latency, JSONC, atomic-write, mirror handlers)
- `shared/ipc-validators.ts:39-80, 270-310, 590-690` (registry, named exports, hello schemas)
- `shared/ipc-validators.js:35-50, 460-520` (mirror match)
- `shared/contract-schema.ts:1-40` (header — for context on what the linter checks)
- `shared/review-schema.ts:1-180` (header — for severity model)
- `dist-web/assets/` directory listing + grep on the two new bundle files
- `electron/main.ts`, `electron/preload.ts` (greps to confirm Phase A did not touch them)
- All three prior reviewer reports (UX, code, security)
- HELLO-FLINT-PHASE-A.contract.md and .contract.ts (full read)

**Skipped:**
- Phase B / Phase C work — not built yet, out of scope.
- The Tailwind-token-only static-grep test — code review verified this; not re-checked.
- `electron/` legacy `setup:*` handlers — confirmed unmodified, no further audit.
- Pre-existing TSC errors in `electron/thumbnailGenerator.ts` and `electron/visualAuditor.ts` — explicitly excluded by the canary brief.
- Re-running the full vitest suite — scoped reviewers reported 3600/3600; canary trusts that pending fix to WARN-INT-1 since the suite passing does not, in this case, prove what the contract said it should prove.

---

## Counts
- blocking: 3
- warning: 6
- suggestion: 4

**Total ceremony rollup (across all four reports — for the user's triage):**
- blocking: 3 (UX) + 2 (security) + 0 (code) + 3 (canary) = **8 blocking** (UX BLK-1 is install-guide drift, security BLK-1/2 are corruption defects, canary BLK-INT-1 is dist-web staleness, BLK-INT-2 is welcome reopen, BLK-INT-3 is registry orphan)
- warning: 7 (UX) + 4 (security) + 6 (code) + 6 (canary) = **23 warnings**
- suggestion: 6 (UX) + 3 (security) + 4 (code) + 4 (canary) = **17 suggestions**

Note that some canary findings extend or root-cause prior reviewer findings (cross-references in the table above). The 8 blocking count is the upper bound; real triage will collapse the entries that fix together.

---

## Verdict

**FIX-BEFORE-SHIP** — derived from `deriveVerdict(findings, 'integration')`. Three blocking findings are tractable in one or two files each:

- BLK-INT-1: rebuild dist-web (or .gitignore it).
- BLK-INT-2: drop `setBetaWelcomeDone(false)` at line 819 (or fix the alias semantics).
- BLK-INT-3: move four schemas into `ipcSchemas`, then wire `web-api.ts` through `validateIPC` (which also closes code W-1).

Combined with the security review's BLOCK verdict (BLK-1 + BLK-2), this is **the critical path for closed-beta readiness:** four blocking defects in the user-data corruption + first-launch-rendering + build-pipeline space. None of them are architectural — all are one-day fixes — but all four MUST land before any tester sees a build.

The seventeen warnings and suggestions are a fast-follow roadmap. WARN-INT-1, WARN-INT-2, and WARN-INT-6 in particular should be addressed before Phase B because Phase B's testBoundaries will inherit the same broken contract→test binding if it isn't fixed.

---

## Recommendations (canary perspective)

1. **Single-commit fix bundle for the four blocking defects across the ceremony.** Security BLK-1, security BLK-2, canary BLK-INT-2, canary BLK-INT-3 all touch a small slice of files (`mcpConfigWriter.ts`, `App.tsx`, `ipc-validators.ts`, `web-api.ts`). One agent, one commit, one re-test pass. This is a half-day of work, not a phase.

2. **Then a separate commit to rebuild + commit dist-web** (BLK-INT-1) so the wire is uncoupled from the source fixes. Or remove dist-web from the working tree.

3. **Defer everything else to a Phase A.1 or Phase B fast-follow.** WARN-INT-1, WARN-INT-3, WARN-INT-6 should land in Phase A.1 because they protect future phases from re-hitting the same gaps.

4. **Update the Phase 1.5 contract linter with three new rules:**
   - "Every named `*Schema` export referenced from a contract `validator` field must be a member of `ipcSchemas`."
   - "Implementation files that the contract impact map names must include an import from the executable `.contract.ts`."
   - "Every Risk with `severity: 'high'` must reference at least one `testBoundaries[i].target` by name."
   Each rule is enforceable as a regex/AST check. Together they would have caught BLK-INT-3, WARN-INT-3, and WARN-INT-6 at lint time.

5. **Lever A scope held this round.** The domain reviewers did their job within their scope; the canary surfaced findings that genuinely required cross-file or build-pipeline visibility. Continue Lever A as standardized; do NOT widen the code reviewer's scope to include build artifacts (BLK-INT-1) — that's the canary's lane and adding it to the code reviewer would dilute their domain focus.
