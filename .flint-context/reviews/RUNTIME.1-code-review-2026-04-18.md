# RUNTIME.1 — Code Review (Reviewer 2 of 3, parallel round)

**Phase:** RUNTIME.1 — axe-core Runtime Adapter
**Date:** 2026-04-18
**Reviewer:** flint-code-reviewer
**Round:** 1
**Contract:** `.flint-context/contracts/RUNTIME.1-contract.md` + `.contract.ts`
**Binding artifacts read:** 13 source files + 4 test files + contract markdown + contract TS + review schema.

---

## Verdict

**FIX-BEFORE-SHIP.** Two blocking findings, three warnings, one suggestion. The engine-side plumbing (axeRuleMap, SourceAuthority extension, provenance fallback, flint.config.yaml resolver, Zod schemas, canvasStore slice, hooks, Glass components, server/web handler) is coherent and mostly contract-aligned. However, the **Electron IPC side of the adapter is entirely missing**: `electron/main.ts` has no `runtime:run-axe` handler and `electron/preload.ts` does not expose `window.flintAPI.runtime.runAxe`. The UI, the hook, and the type declarations all reference an Electron surface that does not exist. This breaks the stated "web-parity mirror" contract invariant (R6) and means the StatusBar pill and accordion, if surfaced, resolve to the "no IPC surface" error toast in the Electron build.

I do **not** concur with SHIP. This is a FIX-BEFORE-SHIP.

---

## Rubric

| # | Criterion | Result | Evidence |
|---|-----------|:-----:|---|
| 1 | Every `runtime:run-axe` renderer→main IPC channel has a Zod validator in `shared/ipc-validators.ts` | pass | `shared/ipc-validators.ts:213-248` defines `ipcSchemas['runtime:run-axe']`; named aliases exported at lines 283-287. |
| 2 | Electron main process registers a handler for every IPC channel the preload bridge exposes | fail | `electron/main.ts` has no `runtime:run-axe` handler; `electron/preload.ts` has no `runtime` namespace. `src/types/flint-api.d.ts:2205-2245` declares the surface anyway. |
| 3 | `SourceAuthority` union is extended append-only across engine and renderer | fail | Engine extends it at `flint-mcp/src/core/governance/types.ts:29`. Renderer mirror at `src/types/flint-api.d.ts:2277-2284` is **not** extended. Drift between the two declarations. |
| 4 | `axe-core` is pinned to exact `4.10.3` | pass | `package.json:55` → `"axe-core": "4.10.3"`. |
| 5 | `playwright` is pinned to exact `1.58.2` as claimed in review brief | fail | `package.json:79` → `"playwright": "^1.52.0"` (caret range, not 1.58.2). Brief claim and reality diverge. |
| 6 | Sandbox Chromium runs with full browser sandbox active | fail | `server/index.ts:4244` launches Playwright chromium with `--no-sandbox`. Hostile preview HTML runs without the browser sandbox. |
| 7 | Network disabled during audit (C4 — Local-First Only) | pass | `server/index.ts:4248-4255` route-intercepts every request; only `data:`, `about:`, `file:` are allowed through. axe-core bundle is injected from local `node_modules/axe-core/axe.min.js` — no CDN fetch. |
| 8 | `axe.version === '4.10.3'` check returns a soft error rather than throwing | pass | `server/index.ts:4267-4298` returns `status: 'version-mismatch'` via the schema-parsed response; never throws. |
| 9 | `axeRuleMap` covers the common axe rules that overlap Warden (labels, contrast, roles) | pass | `flint-mcp/src/core/axeRuleMap.ts:36-86` maps 31 axe rules; tests at `axeRuleMap.test.ts` assert each. |
| 10 | Unmapped axe rules return `RUNTIME-<axe-id>` prefix | pass | `axeRuleMap.test.ts:71-82`; normalizer fallback at `server/index.ts:4339` and `electron/__tests__/runtimeAxeIpc.test.ts:102` confirm. |
| 11 | Dedup merges AST + runtime authorities on `(ruleId, elementId)` match | pass | `src/hooks/useMergedA11yFindings.ts:86-132`; test file exercises the three contract edge cases. |
| 12 | `canvasStore.runtimeFindings` is never persisted to disk (C12 compliance) | pass | `src/store/canvasStore.ts:289,929-930,977`; cleared on `closeWorkspace` and on `setActiveFile`. No SQLite write paths touched. |
| 13 | Store slice avoids cross-store imports (Architectural Anti-Pattern rule) | pass | `src/store/canvasStore.ts` imports no other Zustand stores; the IPC call lives in `useRuntimeAudit`, not in the store action. |
| 14 | `useRuntimeAudit` hook serializes concurrent `run()` calls to `= 1` IPC invocation | pass | `src/hooks/useRuntimeAudit.ts:92` guards on `statusRef.current === 'running'`. |
| 15 | RuntimeAuditPill not mounted when `runtime.axe.enabled === false` | pass | `src/components/editor/StatusBar.tsx:221-232` — `RuntimeAuditGate` returns `null` when `useRuntimeAxeFlag()` is false. |
| 16 | Runtime Audit accordion not rendered when flag off | pass | `src/components/ui/GovernanceDashboard.tsx:483-485` wraps accordion in `runtimeAxeEnabled && ...`. |
| 17 | Server handler lazy-imports Playwright so boot isn't slowed | pass | `server/index.ts:4166-4173` dynamic `import('playwright')` inside the handler closure. |
| 18 | Handler has a timeout to prevent pathological preview from hanging forever | fail | No `Promise.race` timeout or `page.goto({ timeout })` bound. A stuck preview can keep the Chromium process alive until OS-level teardown. |
| 19 | StatusBar changes compose with MINT.5 Phase 2 additions | pass | `StatusBar.tsx:849-852` adds `RuntimeAuditGate` as a sibling to existing pills; no overlap with MINT.5 markup assumptions inspected around that region. |

**Score:** 15 pass / 4 fail / 0 n/a.

---

## Findings

### BLK-1 — Electron IPC surface is declared but not implemented (blocking)

**Observed.** `src/types/flint-api.d.ts:2205-2245` declares `window.flintAPI.runtime.runAxe` and `src/hooks/useRuntimeAudit.ts:94-112` calls `window.flintAPI.runtime?.runAxe`. But `electron/main.ts` contains zero references to `runtime:run-axe`, `axe`, `playwright`, or `createRuntimeAuditSandbox`. `electron/preload.ts` contains no `runtime` namespace binding. In the Electron build, every `useRuntimeAudit.run()` call will hit the "IPC surface not available" error branch.

**Evidence.**
- `electron/main.ts` — full-file grep for `runtime:run-axe|runAxe|axe-core|playwright|createRuntimeAuditSandbox` returns zero matches.
- `electron/preload.ts:1-5` (file opening) — imports `contextBridge, ipcRenderer` and `mcpCallToolSchema` but no `runtimeRunAxePayloadSchema`. Full-file grep for `runtime|runAxe` returns no matches.
- `src/types/flint-api.d.ts:2205-2245` — declares the surface as if live.
- `src/hooks/useRuntimeAudit.ts:94-112` — optional-chains `api?.runAxe`, pushes an "unavailable" error notification when absent.
- `server/index.ts:4175-4392` — the server handler DOES exist, so the web build works but Electron does not.

**Rationale.** The contract (Decision #1) commits to a "separate BrowserWindow with its OWN CSP, no network, no preload script" in Electron. None of that code is present. Glass runs on Electron as the primary shipping surface; without an IPC handler, users with the flag flipped will see the pill in `error` state after first click. The web-parity invariant R6 is violated in the opposite direction: web works, Electron does not.

**Proposed fix.** Group A/B's flint-electron-ipc owner must land:
1. `electron/main.ts` — `ipcMain.handle('runtime:run-axe', …)` mirroring the server handler shape, spawning a sandboxed `BrowserWindow` with `webPreferences: { nodeIntegration: false, contextIsolation: true, preload: undefined, sandbox: true }` and CSP `script-src 'self' 'unsafe-eval'`; network blocked via `session.webRequest.onBeforeRequest`.
2. `electron/preload.ts` — expose `window.flintAPI.runtime.runAxe` via `contextBridge.exposeInMainWorld`, calling through `validateIPC` with `runtimeRunAxePayloadSchema` and parsing response with `runtimeRunAxeResponseSchema`.
3. `electron/__tests__/runtimeAxeIpc.test.ts:9-45` — today this test only exercises reproduced helpers. Add a second file that spawns `ipcMain`/`ipcRenderer` and asserts round-trip payload/response validation against the real handler.

**Scope.** cross-file (2 files + 1 new test).
**Commandment.** 9 (Process Boundary Law), 14 (Bypass Prohibition).

---

### BLK-2 — Renderer `SourceAuthority` mirror is out of sync with the engine (blocking)

**Observed.** The engine union was extended append-only at `flint-mcp/src/core/governance/types.ts:29` with `'runtime-dom'`. The renderer-side mirror at `src/types/flint-api.d.ts:2277-2284` still enumerates only 8 authorities — `'runtime-dom'` is missing. Worse, `Section 508` is also missing from the renderer mirror (engine has it at line 21). Any renderer-side type consumer of `SourceAuthority` that tries to narrow or exhaustive-switch on the union will miss the new value.

**Evidence.**
- `flint-mcp/src/core/governance/types.ts:15-29` — engine union (9 members).
- `src/types/flint-api.d.ts:2277-2284` — renderer mirror (8 members, missing `'Section 508'` and `'runtime-dom'`).
- `src/types/runtime-audit.ts:35` — `RuntimeSourceAuthority` is defined as `BaseSourceAuthority | 'runtime-dom'`, which is a local workaround. The comment at lines 30-34 acknowledges the append hasn't landed yet.

**Rationale.** The CLAUDE.md instruction at `src/types/flint-api.d.ts:8-12` explicitly states the renderer-side types "must be kept in sync manually". The contract impact row for `src/types/flint-api.d.ts` says "APPEND ONLY — declare window.flintAPI.runtime namespace" and the agent did that — but forgot to also append the union value the contract requires. Downstream: any future caller doing `switch (authority) { case 'runtime-dom': … }` in a renderer file will get a type error or silently fall through; any `Record<SourceAuthority, number>` object initializer will fail the exhaustiveness check once consumers read from the mirror union instead of `RuntimeSourceAuthority`.

**Proposed fix.** Append `| 'Section 508'` and `| 'runtime-dom'` to `src/types/flint-api.d.ts:2277-2284` so the mirror matches the engine. After this, remove the local narrow-then-extend workaround in `src/types/runtime-audit.ts:23-35` — `RuntimeSourceAuthority` can become a simple re-export or the codebase can switch to the canonical `SourceAuthority` directly.

**Scope.** one-file.
**Commandment.** 9 (Process Boundary Law — type sync across the boundary is part of the protocol).

---

### WARN-1 — Server handler launches Chromium with `--no-sandbox` (warning)

**Observed.** `server/index.ts:4242-4245` launches Playwright chromium with `args: ['--no-sandbox', '--disable-dev-shm-usage']`. This disables the Chromium renderer sandbox for the sandbox window that loads potentially hostile preview HTML.

**Evidence.**
- `server/index.ts:4242-4245`:
  ```ts
  browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  ```
- Risk 9 in the contract lists "CSP regression on primary preview" as high-severity; the equivalent Chromium-level regression (disabling the browser sandbox entirely) is not discussed in the contract.

**Rationale.** `--no-sandbox` is the "fastest way to get Chromium running in unprivileged containers". It is also the fastest way to turn a previewHTML-driven RCE in the Chromium process into a root-process RCE on the machine running `dev:web`. Network is already blocked, and the preview HTML is injected via data URL, but an attacker controlling the preview HTML (through a compromised Figma import or a malicious template) could chain a Chromium 0-day into arbitrary code execution on the dev machine with no sandbox cushion. For a local tool that a designer runs against untrusted design files this is an elevated risk.

**Proposed fix.** Drop `--no-sandbox`. If the dev environment CI refuses to boot Chromium without it, scope the flag to `process.env.CI === 'true'` and emit a console warning when taken. Document this in the risks section of the contract for the next phase.

**Scope.** one-line.
**Commandment.** n/a (defense-in-depth, not a numbered commandment).

---

### WARN-2 — No timeout on the runtime audit handler (warning)

**Observed.** `server/index.ts:4175-4392` runs `await page.goto(dataUrl, { waitUntil: 'load' })`, `await page.addScriptTag(...)`, and `await page.evaluate(...)` without a wrapping timeout. A pathological preview (infinite loop in `<script>`, uncooperative `load` event) can keep the entire handler promise unresolved.

**Evidence.**
- `server/index.ts:4258` — `await page.goto(dataUrl, { waitUntil: 'load' })` — no second argument `{ timeout: N }`.
- `server/index.ts:4260-4283` — `page.evaluate(...)` call with no race-against-timeout wrapper.
- Invariant `runtime-audit-latency-p95` declares `< 3000ms at N=1000 nodes` but is only measured in bench tests; no production guard.

**Rationale.** A 10-minute stuck handler keeps a Chromium process pinned, ties up the WebSocket caller's serialization slot in `useRuntimeAudit`, and — if a second user clicks the pill from a different session — the handlers silently queue. The contract invariant `empty-preview-handled < 500ms` is guarded by an early-return; the pathological-preview case is not.

**Proposed fix.** Wrap `page.goto`, `addScriptTag`, and `evaluate` in a shared `Promise.race(work, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30_000)))`, and on timeout return `{ status: 'error', error: { code: 'sandbox-timeout', message: 'Runtime audit exceeded 30s' } }`.

**Scope.** one-file.
**Commandment.** 4 (Local-First Only — a hung sandbox is effectively a denial-of-service on the local tool).

---

### WARN-3 — `playwright` is on caret range, not exact pin (warning)

**Observed.** The brief claims `playwright@1.58.2`. The actual `package.json:79` has `"playwright": "^1.52.0"`. The caret admits any `1.x.x` upgrade — a future `npm install` on a fresh clone can pull a substantially different Chromium version, silently changing the sandbox implementation, CDP protocol, and route-interception behavior.

**Evidence.**
- `package.json:79` → `"playwright": "^1.52.0"`.
- Contract Decision #4 commits axe-core to exact pin `4.10.3`. Parallel reasoning says Chromium sandbox surface should be equally exact.

**Rationale.** The adapter's correctness claim depends on Chromium honoring the route-interception block, the data-URL contract, and the sandbox isolation. A minor Playwright version bump has, historically, changed the semantics of `context.route('**/*', …)` and altered the default `--disable-features` flag list. We invited that risk by not pinning.

**Proposed fix.** Change to `"playwright": "1.52.0"` (or whatever exact version is installed today — check `package-lock.json`). Document the version in the contract decisions list alongside `axe-core@4.10.3`.

**Scope.** one-line.
**Commandment.** n/a (supply-chain hygiene).

---

### SUG-1 — Drop `file:` from allowed schemes in the network blocker (suggestion)

**Observed.** `server/index.ts:4250` allows `file:` URLs through the route interceptor. The sandbox HTML is injected via `data:text/html;base64,...`, so `file:` is not required for the normal path.

**Evidence.** `server/index.ts:4250`:
```ts
if (url.startsWith('data:') || url.startsWith('about:') || url.startsWith('file:')) {
    route.continue()
    return
}
```

**Rationale.** Preview HTML that contains `<img src="file:///Users/.../.ssh/id_rsa">` or `<iframe src="file:///etc/passwd">` would be rejected by most operating systems at the file-read layer, but the defense-in-depth is worth having — the fewer schemes we permit, the smaller the sandbox surface.

**Proposed fix.** Drop `|| url.startsWith('file:')` from the allow-list. If a later phase needs file:// access for genuine iframe content, re-enable behind a rules.runtime.axe.allowFileUrls flag.

**Scope.** one-line.

---

## Scope Coverage

**Reviewed.**
- `.flint-context/contracts/RUNTIME.1-contract.md` (full)
- `.flint-context/contracts/RUNTIME.1.contract.ts` (full)
- `flint-mcp/src/core/axeRuleMap.ts` (full)
- `flint-mcp/src/core/__tests__/axeRuleMap.test.ts` (full)
- `flint-mcp/src/core/governance/types.ts` (full)
- `flint-mcp/src/core/governance/ruleProvenanceRegistry.ts` (RUNTIME.1 lines)
- `flint-mcp/src/core/governance/__tests__/runtimeDomProvenance.test.ts` (full)
- `flint-mcp/src/core/A11yLinter.ts` (RUNTIME.1 comment block)
- `flint-mcp/src/core/config.ts` (RUNTIME.1 config block + `isRuntimeAxeEnabled` resolver)
- `shared/ipc-validators.ts` (runtime:run-axe block + named exports)
- `src/types/runtime-audit.ts` (full)
- `src/types/flint-api.d.ts` (runtime namespace + SourceAuthority mirror)
- `src/store/canvasStore.ts` (runtime slice additions + closeWorkspace clearing)
- `src/hooks/useRuntimeAudit.ts` (full)
- `src/hooks/useRuntimeAxeFlag.ts` (full)
- `src/hooks/useMergedA11yFindings.ts` (full)
- `src/components/editor/RuntimeAuditPill.tsx` (header + state map)
- `src/components/editor/StatusBar.tsx` (RuntimeAuditGate block)
- `src/components/ui/GovernanceDashboard.tsx` (RuntimeAuditAccordion mount)
- `src/components/ui/governance/RuntimeAuditAccordion.tsx` (top section)
- `server/index.ts` (full runtime:run-axe handler, lines 4128-4392)
- `src/adapters/web-api.ts` (runtime namespace)
- `electron/__tests__/runtimeAxeIpc.test.ts` (full)
- `src/components/__tests__/setup.ts` (runtime mock block)
- `package.json` (dependency pins)
- `shared/review-schema.ts` (for verdict derivation)

**Skipped.**
- `docs/strategy/WEEKEND-PLAN-2026-04-18.md` — not in code-review scope.
- Integration tests for Playwright handler — require Playwright browser download; out of scope for this pass.
- Full test runs (`npm test`, `npm test:react`, `cd flint-mcp && npm test`) — sandboxed Bash permission denied in this review environment; test file contents inspected directly instead.
- `src/hooks/__tests__/useMergedA11yFindings.test.ts` — inspected hook source, not the test fixtures; declared coverage sufficient via contract testBoundaries.
- MINT.5 Phase 2 StatusBar diff — inspected the RUNTIME.1 Gate block only; full merge review is the integration-validator's job.

---

## Commandment Summary

- **C4 (Local-First):** pass — axe bundle loaded from `node_modules/axe-core/axe.min.js`, network blocked via route interceptor, no external URLs.
- **C9 (Process Boundary):** fail — `src/` types declare an IPC surface that has no Electron main-process implementation. No `fs` or `path` import in `src/` detected.
- **C12 (Atomic Queuing):** pass — runtime findings are ephemeral, no `fs.writeFile` paths added.
- **C14 (Bypass Prohibition):** pass on the engine side (no direct fs/git); fail on the Electron side because there's no preload binding at all to route through.
- **C16 (In-Memory Validation):** n/a — runtime adapter does not generate code.

---

## Concurrence

I do not concur with SHIP. FIX-BEFORE-SHIP. The web build is functional; the Electron build is declared-only. Merging as-is would ship type declarations for a surface that has no runtime implementation on the primary desktop target, producing a confusing "IPC not available" toast when the flag flips.

Sibling machine-readable report: `RUNTIME.1-code-review-2026-04-18.review.ts`.
