# Phase 2 Security Review — PostCSS + CSS Modules + Tailwind v4

**Date:** 2026-04-18
**Reviewer:** flint-security-reviewer
**Scope:** cssStylesheetLoader.ts, cssModulesResolver.ts, cssCustomPropertyMap.ts, tailwindV4ThemeParser.ts + test suites
**Verdict:** FIX

## Risk Summary
- CRITICAL: 0
- HIGH: 2
- MEDIUM: 3
- LOW: 2

---

## Findings

### [HIGH] H1 — Symlink escape bypasses path-traversal gate
- **Location:** `flint-mcp/src/core/cssModulesResolver.ts:171-174` (`isOutsideProject`)
- **Description:** The traversal gate uses `path.relative(resolve(projectRoot), resolve(absolutePath))` on the lexical path. `path.resolve` does NOT follow symlinks. If the project contains a symlink (e.g. `node_modules/evil-pkg/link → /etc`), an import like `./node_modules/evil-pkg/link/passwd.module.css` passes the gate because the resolved lexical path still starts with `projectRoot`, but `fs.readFile` follows the symlink and reads `/etc/passwd`.
- **Impact:** Path-traversal defense can be defeated by any attacker who can plant a symlink inside the project (common when ingesting third-party npm packages or governance packs).
- **Remediation:** After the lexical check passes, call `fs.realpath(absoluteModulePath)` and re-run `isOutsideProject(realPath, realpath(projectRoot))` before `fs.readFile`. Catch ENOENT to preserve the `module-not-found` branch.
- **Commandment:** C14 (Bypass Prohibition — file reads must stay inside the workspace)

### [HIGH] H2 — No parse-time CPU/timeout guard on PostCSS
- **Location:** `cssStylesheetLoader.ts:219-227`, `cssModulesResolver.ts:127-131`
- **Description:** Both modules call `postcss.parse(content)` inside a try/catch with no wall-clock timeout. The 2MB size cap bounds memory but not CPU. PostCSS is robust, but a malicious 1.9MB file with pathological nesting or selector lists can still consume many seconds of CPU per parse. In an MCP server shared across tenants, that stalls the entire event loop.
- **Impact:** Denial-of-service via CPU exhaustion on ingestion of hostile CSS (e.g. a governance pack sourced from an untrusted marketplace).
- **Remediation:** Wrap PostCSS parse in `Promise.race([parsePromise, timeoutPromise(2000ms)])` — returning `parse-error` / `module-parse-error` on timeout. Phase 1 already established a 2000ms CPU budget for `vm.Script`; mirror it here.
- **Commandment:** C4 (Local-First Only implies bounded resource use on locally-processed input)

### [MEDIUM] M1 — Size cap not enforced in cssModulesResolver
- **Location:** `cssModulesResolver.ts:285-298`
- **Description:** `cssModulesResolver.resolve` calls `fs.promises.readFile(absoluteModulePath, 'utf8')` without first calling `fs.stat` and without routing through `cssStylesheetLoader.load`. The 2MB size cap defined in the loader is bypassed entirely on the CSS Modules read path. A 500MB `.module.css` OOMs Node.
- **Impact:** Size-cap invariant (`size-cap-enforced`) only holds for the stylesheet loader; the modules resolver is a second, unguarded file-reading surface.
- **Remediation:** Either (a) route modules through `cssStylesheetLoader.load` and extract classes from the already-parsed `ParsedStylesheet`, or (b) add the same stat-before-read gate with `MAX_STYLESHEET_SIZE_BYTES`. Option (a) unifies cache + size invariants.
- **Commandment:** C4, C14

### [MEDIUM] M2 — Tests do not assert the 10ms timing invariant rigorously
- **Location:** `cssModulesResolver.test.ts:120-134` (test 3)
- **Description:** The timing assertion uses `Date.now()` with `expect(elapsed).toBeLessThan(10)`. On CI under load this is flaky and will silently pass for much slower implementations. The contract invariant `path-traversal-rejected-within-10ms` is not actually being enforced — only the "no I/O happened" side of it is.
- **Impact:** A regression that adds `fs.stat` or `fs.access` before the gate would still pass the timing bound on a fast dev machine but could creep past 10ms on CI.
- **Remediation:** Replace the wall-clock check with a spy-based assertion: assert `fs.promises.stat`, `fs.promises.access`, and `fs.promises.readFile` received zero calls for the evil path. Keep a generous wall-clock bound (100ms) for sanity only.

### [MEDIUM] M3 — projectRoot is not required to be absolute/canonical
- **Location:** `cssModulesResolver.ts:250-262`
- **Description:** `resolve()` accepts any string as `projectRoot` and only calls `path.resolve(projectRoot)` internally. If the caller passes `'.'` or a relative subdir, `path.resolve` expands against `process.cwd()` — which may be unrelated to the intended workspace. Worse, if cwd changes between calls, the gate's effective root drifts.
- **Impact:** Inconsistent traversal defense depending on caller context; silent security downgrade with no error.
- **Remediation:** At function entry, assert `path.isAbsolute(projectRoot)` and throw a typed error otherwise. The caller (orchestrator, audit tool) must canonicalize once via `fs.realpathSync`.

### [LOW] L1 — Error `details` may leak absolute filesystem paths in MCP responses
- **Location:** `cssStylesheetLoader.ts:367, 377, 395, 413, 427`
- **Description:** `details` strings embed `absolutePath` (e.g. `"File not found: /Users/justin/secret-project/tokens.css"`). When surfaced through `flint_audit` → MCP client → IDE, this exposes the user's directory layout to any process that reads MCP transcripts.
- **Impact:** Minor info disclosure. Acceptable for single-user Flint Glass; noteworthy if Flint MCP ever runs as a shared service (GaaS roadmap).
- **Remediation:** Make absolute paths in `details` relative to `projectRoot` when a projectRoot context is available. Not blocking for Phase 2.

### [LOW] L2 — Scoped-name hash is non-cryptographic but documented as stable
- **Location:** `cssModulesResolver.ts:96-103, 109-114`
- **Description:** `simpleHash` is djb2 over `${modulePath}:${localName}` — stable given the same absolute modulePath. However absolute modulePath varies per developer machine, so two developers auditing the same repo get different scoped names. This is only used for drift detection (not security), but the header comment says the hash is "stable" — it's only stable per-machine.
- **Impact:** None (hash is not security-sensitive; Mithril only uses `localClassName`). Flag as a correctness note.
- **Remediation:** Hash over `path.relative(projectRoot, modulePath)` instead of the absolute path, so scoped names are reproducible across machines. Update JSDoc to match.

---

## Verified Controls (PASS)

- Path-traversal gate executes BEFORE any `fs.*` call (cssModulesResolver.ts:271-281 — `isOutsideProject` check precedes readFile on line 287). Test 11 confirms spy was not called.
- Size-cap gate in stylesheet loader is correctly ordered: `fs.stat` at line 362, size check at line 373, `readFile` at line 408. Test 4 confirms `readFile` is not called when size exceeds limit.
- Boundary tests present: exactly 2_000_000 accepted (test 5), 2_000_001 rejected (test 4).
- Cycle detection in custom-property resolution works correctly (cssCustomPropertyMap.ts:118-122, visited-set scoped per-resolve).
- AST is treated as read-only: resolver iterates `ast.program.body` directly with no `path.replaceWith`, `insertBefore`, `remove`, or any mutation API. Commandment 13 intact.
- Zero `fs` imports introduced in `src/` — Glass process boundary unchanged.
- `postcss-modules` is NOT invoked. The resolver uses plain PostCSS plus a regex over selectors, eliminating the risk of plugin-supplied `generateScopedName` hooks executing arbitrary code.
- New deps (postcss, postcss-scss) are first-party packages from the PostCSS org; no concerning transitive additions.
- All error paths return structured results (`{ok: false, error, details}`) without throwing — no unhandled rejections.

---

## Process Boundary

- Violations found: 0
- Both new modules live in `flint-mcp/src/core/` (trusted tier). No renderer exposure, no new IPC, no new preload surface.

---

## Recommendations (priority order)

1. **BLOCKER for trust model:** Fix H1 (realpath-based traversal check) before any feature that ingests third-party CSS (governance packs, remote libraries).
2. **BLOCKER for multi-tenant use:** Fix H2 (parse timeout). Not strictly required for single-user Glass, but required before any Flint-as-a-Service deployment.
3. Fix M1 (unify the modules resolver on `cssStylesheetLoader.load`) — eliminates the second size-cap hole and gets caching for free.
4. Tighten M2 (spy-based test) alongside H1/H2 fixes.
5. Harden M3 (assert absolute projectRoot) — cheap, prevents future regression.
6. Defer L1/L2 to a follow-up.

---

## Commandment Review
- C4 (Local-First): partial — size cap present, CPU cap missing (H2).
- C13 (Deterministic Surgery): PASS — AST is read-only.
- C14 (Bypass Prohibition): partial — workspace boundary enforced lexically but not against symlinks (H1) and not in modules resolver (M1).

