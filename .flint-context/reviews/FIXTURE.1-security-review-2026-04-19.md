# FIXTURE.1 Security Review

- **Phase:** FIXTURE.1
- **Dimension:** security
- **Reviewer:** flint-security-reviewer
- **Date:** 2026-04-19
- **Round:** 1
- **Scope:** flint-mcp/src/core/fixtureResolver.ts (full file); shared/fixture-schema.ts (Zod schema + types); flint-mcp/src/server.ts (FIXTURE.1 block L2023-2046, L2135); flint-mcp/src/tools/swarm.ts (L206-222); flint-mcp/src/core/A11yLinter.ts (FIXTURE.1 block L180-266); flint-mcp/src/core/a11y/rules/*.ts (appliesTo classifications); fixtureResolver.test.ts + server.audit-fixture.test.ts (security-critical assertions)

## Verdict

**FIX-FORWARD** — 0 blocking · 2 warnings · 3 suggestions

## Findings

### WARN-1 — No realpath/symlink canonicalization in fixtureResolver — symlink-escape attack vector

**Severity:** warning · **Scope:** one-file · **Status:** open · **Commandment:** 14

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:50` — startsWith(projectRoot) check is purely lexical — no fs.realpath canonicalization on the candidate path.
- `flint-mcp/src/core/fixtureResolver.ts:167` — tokens path resolution uses startsWith only — symlinks at the resolved tokens path can escape projectRoot.
- `flint-mcp/src/core/__tests__/fixtureResolver.test.ts:303` — Contract testBoundary mentions "symlink that escapes projectRoot ⇒ blocked" but no actual symlink test exists in the file.

**Observed:** fixtureResolver uses lexical `startsWith(projectRoot)` to gate path-traversal but does not canonicalize via `fs.realpath`. A symlink inside the project pointing outside (e.g., `demos/escape -> /etc`) would pass the lexical check and trigger fs.readFileSync on the canonicalized target.

**Rationale:** Commandment 14 forbids bypassing controlled access. The path-traversal guard is the security boundary for fixture-driven token loading; without realpath canonicalization, the guard can be bypassed by symlinks. The contract testBoundary at fixtureResolver.test.ts:303 explicitly names this scenario.

**Proposed fix:** Apply fs.realpathSync to fixturePath and resolved tokensCandidate before the containment check. Add a symlink vitest using vi.spyOn(fs, "readFileSync") to assert no read occurs on the escape target.

### WARN-2 — Error envelope echoes attacker-controlled resolved path into MCP response

**Severity:** warning · **Scope:** one-line · **Status:** open

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:171` — Throws an error containing the canonical resolved tokensCandidate path.
- `flint-mcp/src/server.ts:2044` — Error reflected into auditWarnings → forwarded as MCP response payload to renderer/MCP client.

**Observed:** When path-traversal guard rejects a tokens path, the thrown error embeds the canonicalized escape target. server.ts catches and reflects this into auditWarnings, which becomes part of the MCP response.

**Rationale:** Information leak: a malicious or misconfigured fixture can probe for filesystem layout outside the project root via the audit response. The user-authored fixture.tokens string is what the client supplied; echoing back the resolved canonical target is gratuitous and discloses absolute paths.

**Proposed fix:** Echo only the user-authored fixture.tokens string and the fixturePath that contained the bad reference. Drop the resolved escape target from the error message.

### SUG-1 — Resolver cache is not project-scoped — cross-project bleed in long-running MCP server

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:34` — Module-global Map.
- `flint-mcp/src/core/fixtureResolver.ts:113` — Cache key is startDir only — does not include projectRoot.

**Observed:** The fixtureResolver cache is a module-global Map keyed on startDir alone. Two MCP clients in a long-running server (or two sequential project loads) sharing an absolute directory path can cross-read each other's fixture resolution.

**Rationale:** Edge case in single-project Glass usage; real concern in shared/long-running MCP deployments where multiple projects open in sequence. As a governance product, Flint cannot have cross-project state bleed in its own audit pipeline.

**Proposed fix:** Key cache on `${resolvedRoot}\0${startDir}` so resolutions are project-scoped. Add clearFixtureCache(projectRoot?) so callers can scope-clear.

### SUG-2 — Walk-up loop has no depth cap and cache has no eviction policy

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:66` — while (true) loop walking up the directory tree with no iteration guard.

**Observed:** Walk-up uses an unbounded while(true) loop. If projectRoot is somehow misconfigured to be deeper than startDir, the loop terminates only on `dirname(currentDir) === currentDir` (root). Combined with cache having no eviction, a long-running MCP processing many distinct project trees can grow the cache without bound.

**Rationale:** Resource-exhaustion concern. Not exploitable in normal use but unbounded cache growth in a long-running server is a code-smell that beta deployments will eventually hit.

**Proposed fix:** Cap walk-up at 64 iterations. Add LRU eviction at ~1024 entries to the cache.

### SUG-3 — TOCTOU catch-all silently masks EACCES, EISDIR, and other non-ENOENT errors

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `flint-mcp/src/core/fixtureResolver.ts:132` — Catch-all returns DEFAULT_FIXTURE on any error, including permission-denied.

**Observed:** Any error thrown during fixture file read silently returns DEFAULT_FIXTURE. ENOENT (file genuinely doesn't exist) is the expected case; EACCES (permission denied) and EISDIR (target is directory) silently masquerade as "no fixture found."

**Rationale:** A misconfigured fixture (wrong permissions, name collision with a directory) appears identical to "no fixture defined" in the audit pipeline. Designers will see "auditing in default context" with no signal that their fixture was unreadable.

**Proposed fix:** Differentiate ENOENT (silent fall-through) from other errors. Surface non-ENOENT errors into auditWarnings so the user sees "fixture file present but unreadable: <reason>" instead of silent fallback.

## Rubric

| Criterion | Result | Evidence / Related findings |
|-----------|--------|-----------------------------|
| Path-traversal guard with realpath canonicalization | **fail** | Lexical startsWith only; no fs.realpath |
| Realpath canonical check on symlinks before fs.readFile | **fail** | fixtureResolver.ts:50, 167 — no canonicalization |
| Untrusted JSON parsing — Zod .strict() rejects unknown keys | pass | fixture-schema.ts uses .strict() |
| Critical security a11y rules (A11Y-001..006, contrast) NOT silently skippable via "surface": "component" | pass | All names-labels, aria, contrast rules → appliesTo: "any" |
| No information leak in error envelopes | **fail** | fixtureResolver.ts:171 echoes resolved path; reflected via server.ts:2044 into MCP response |
| Cache project-scoped (no cross-project bleed) | **fail** | Module-global Map keyed on startDir only |
| No new IPC surface | pass | Phase 3 declares zero new IPC channels; verified |
| Append-only on shared MithrilLinter + A11yLinter | pass | auditAllWithSurface() and auditWithSurface() are net-new methods; existing visitors untouched |
| Resource exhaustion bounded (depth cap, cache eviction) | **fail** | while(true) walk-up + unbounded cache |
| End-to-end tests use public API (no guard bypass) | pass |  |

## Scope Coverage

**Reviewed:**
- flint-mcp/src/core/fixtureResolver.ts (full file — security-critical primary surface)
- shared/fixture-schema.ts (Zod schema)
- flint-mcp/src/server.ts (FIXTURE.1 lines only)
- flint-mcp/src/tools/swarm.ts (FIXTURE.1 lines only)
- flint-mcp/src/core/A11yLinter.ts (FIXTURE.1 block only)
- flint-mcp/src/core/a11y/rules/*.ts (appliesTo audit)
- fixtureResolver.test.ts + server.audit-fixture.test.ts (security-critical assertions)

**Skipped:**
- StatusBar.tsx + canvasStore.ts (UX reviewer scope)
- Demo .flint-fixture.json content (test data, not user input — code reviewer scope)
- Pure type definitions and rule appliesTo metadata content (code reviewer scope)
- wcag22.ts rule-by-rule appliesTo audit (sampled, all "any" — code reviewer owns full audit)
