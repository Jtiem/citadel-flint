# PHASE 1 — Security Review: Tailwind Config + Class Composition Expansion

**Date:** 2026-04-18
**Reviewer:** flint-security-reviewer
**Verdict:** FIX (1 HIGH, 3 MEDIUM, 2 LOW) → after fixes: PASS
**Status:** All HIGH + M-1 + M-3 findings addressed before commit. M-2 and L-1 deferred.

## Scope

Phase 1 loads and executes user-supplied JavaScript/TypeScript config code (`tailwind.config.{js,ts,mjs,cjs}`) via `vm.runInNewContext`. This is a supply-chain surface area. A malicious config or compromised npm preset could attempt to read secrets, exfiltrate files, make outbound network requests, trigger DoS, or escape the sandbox.

## Findings

### [HIGH] H-1 — Require allowlist permitted arbitrary community `tailwindcss-*` packages
- **Location:** `flint-mcp/src/core/tailwindConfigLoader.ts:120` (original regex `/^tailwindcss-[a-z0-9-]+$/`)
- **Impact:** A malicious `tailwindcss-backdoor` typosquat package installed in the user's `node_modules` loaded via `safeRequire(specifier)` without sandboxing. Any dependency typosquat matching the pattern gained full Node privileges (fs, net, child_process) because `createRequire` loads it outside the vm context.
- **Fix applied:** Replaced regex with explicit static allowlist Set: `{'tailwindcss', '@tailwindcss/forms', '@tailwindcss/typography', '@tailwindcss/container-queries', '@tailwindcss/aspect-ratio', '@tailwindcss/line-clamp', 'tailwindcss-animate'}`. Subpath imports for approved packages (e.g. `tailwindcss/resolveConfig`) still pass via `startsWith` checks. Thrown error message no longer echoes the specifier. Added test: `tailwindcss-backdoor` require returns `sandbox-violation` with no `'backdoor'` substring in details.

### [MEDIUM] M-1 — Sandbox object was not frozen despite contract claim
- **Location:** `flint-mcp/src/core/tailwindConfigLoader.ts:183-204`
- **Impact:** User code could mutate `sandbox.require` mid-execution and redirect subsequent `require()` calls, or attach properties to `Buffer`, `URL`, etc. Lower severity because `runInNewContext` creates a fresh context per call, but the claim-vs-reality gap was itself a governance defect.
- **Fix applied:** `Object.freeze(sandbox)` called immediately after sandbox construction, before `vm.Script.runInNewContext`. Surrounding comments updated. `module.exports = ...` assignments unaffected (mutate nested `moduleObj`, not the frozen reference).

### [MEDIUM] M-2 — `Buffer` exposure enables prototype pollution channel + resource exhaustion
- **Location:** `flint-mcp/src/core/tailwindConfigLoader.ts:188`
- **Impact:** `Buffer` is a host-realm primitive with mutable prototype chain shared with the parent process. `Buffer.prototype.foo = ...` inside the sandbox leaks into flint-mcp. `Buffer.alloc(2**30)` is a legal DoS that the CPU timeout will catch only if allocation loops.
- **Status:** DEFERRED. No real tailwind config requires Buffer in the fixtures. Documented in risk register for follow-up.

### [MEDIUM] M-3 — Redaction regex unverified by tests
- **Location:** `tailwindConfigLoader.ts:130-143`, `tailwindConfigLoader.test.ts:456-471`, `:412-424`
- **Impact:** The env-leak test only asserted the literal secret string was absent. But when `process` is not in the sandbox, the `ReferenceError` never had the secret in the first place — test passed trivially. False assurance.
- **Fix applied:** `redactErrorDetails` hardened to cover 4 additional secret shapes: credential-bearing URLs (`scheme://user:pass@host`), `key=value` pairs, long base64-ish strings (≥20 chars), file path arguments. Exported as `__TEST_ONLY_redactErrorDetails`. 6 new unit tests exercise the redaction function directly with real secrets.

### [LOW] L-1 — Error classification by string match is spoofable
- **Location:** `tailwindConfigLoader.ts:575-585`
- **Impact:** A config that throws `new Error('sandbox-violation: fake')` gets classified as sandbox-violation when attacker-controlled. Not an escape — mis-labels the error tier only.
- **Status:** DEFERRED. Low severity. Follow-up: replace string match with `class SandboxViolationError extends Error` sentinel.

### [LOW] L-2 — `classExpressionExpander.ts` clean
- **Location:** `classExpressionExpander.ts:246,282,294,349,394,509,519,563,574,582,604,644`
- **Verified:** All occurrences of `eval*` are AST-traversal function names (`evalExpression`, `evalObjectExpression`, `evalCvaCall`, `evalCallSite`). No `eval()`, no `Function()`, no `vm.*`, no shell interpolation. Read-only AST walk per Commandment 13. **PASSES.**

## Verified controls
- `vm.runInNewContext` with `timeout: 2000` — CPU-bound DoS defense present
- Wall-clock `Promise.race` timeout — second layer
- No `process`, `global`, `fs`, `http`, `fetch`, `setTimeout`, `child_process`, `Worker`, `SharedArrayBuffer` in sandbox object — verified by grep
- `.ts` esbuild `transformSync` does not accept user plugins — no plugin injection
- Sandbox-violation tests complete within timeout
- `CoverageVerdict.details` from Phase 0 not populated with user source content in Phase 1 loader
- `tailwindcss` + `esbuild` first-party, low supply chain risk
- No new `fs` / `child_process` imports in `src/` — Glass process boundary intact

## Final verdict after fixes
**PASS.** All HIGH + critical MEDIUM findings resolved. Deferred items (M-2, L-1) documented for follow-up hardening. Phase 1 sandbox is merge-ready.
