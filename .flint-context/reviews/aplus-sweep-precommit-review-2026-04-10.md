# Pre-Commit Review: A+ Sweep (2026-04-10)

**Reviewer:** Quality Gate  
**Scope:** 66 modified files, ~70 new files  
**TSC:** 0 errors  

---

## Verdict: FIX (3 items before ship)

---

## BLOCKERS

### B1. Missing type declaration for `governance.applyFix` (C3 — Process Boundary)

**Files:** `electron/preload.ts`, `src/adapters/web-api.ts`, `src/components/ui/GovernanceDashboard.tsx`, `src/types/flint-api.d.ts`

`governance.applyFix` is exposed in preload.ts (line ~956) and web-api.ts (line ~485), and called in GovernanceDashboard.tsx (line 1249), but has **no corresponding type declaration** in `GovernanceAPI` inside `src/types/flint-api.d.ts`. TSC passes because the `governance` property on `FlintAPI` is loosely typed enough to allow it, but this violates the rule that all `window.flintAPI` calls must have corresponding type declarations.

**Fix:** Add to `GovernanceAPI` in `src/types/flint-api.d.ts`:
```typescript
applyFix?: (filePath: string) => Promise<{ fixesApplied: number; status: string } | null>
```

### B2. Dead duplicate: `shared/ciede2000.ts` vs `flint-mcp/src/core/colorMath.ts`

**Files:** `shared/ciede2000.ts`, `flint-mcp/src/core/colorMath.ts`

Two new files contain near-identical CIEDE2000 implementations. `colorMath.ts` is the one actually imported by MithrilLinter and fix.ts. `shared/ciede2000.ts` is imported by nothing -- it is dead code that will confuse future maintainers about which is canonical.

**Fix:** Delete `shared/ciede2000.ts` or consolidate into one location. The contract in `.flint-context/contracts/mithril-unification.md` references `shared/ciede2000.ts` but the implementation went to `colorMath.ts` instead. Pick one and remove the other.

### B3. Several new web-api.ts governance handlers missing from `flint-api.d.ts`

**Files:** `src/adapters/web-api.ts`, `src/types/flint-api.d.ts`

The following new governance methods are defined in web-api.ts but have no type declarations:
- `governance.applyFix`
- `governance.getProvenanceSummary`
- `governance.getAnomalies`
- `governance.getLastCleanState`
- `governance.previewTokenImpact`
- `governance.getHealthHistory`
- `governance.recordHealth`
- `governance.getPendingMutations`
- `governance.approveMutation`
- `governance.rejectMutation`
- `governance.getAuditLog`

Also missing for tokens:
- `tokens.scanUsage`
- `tokens.auditContrast`
- `tokens.getPendingApprovals`
- `tokens.approveToken`
- `tokens.rejectToken`

**Fix:** Add all of these to the appropriate interfaces in `flint-api.d.ts`.

---

## WARNINGS

### W1. `tokens:audit-contrast` has O(n^2) token pair explosion

**File:** `server/index.ts` (tokens:audit-contrast handler)

With N color tokens, this generates N*(N-1) pairs. 50 color tokens = 2,450 pairs sent over the wire. Consider limiting to pairs where the contrast ratio fails AA, or capping the output.

### W2. `tokens:scan-usage` does naive string matching

**File:** `server/index.ts` (tokens:scan-usage handler)

Uses `content.includes(te.cssVar)` which will match inside comments, strings, and unrelated variable names. Not a blocker since it is informational only, but the counts may overreport.

### W3. Dead code: `shared/__tests__/mrsWeights.test.ts`, `shared/__tests__/mithrilParity.test.ts`

New test files in `shared/__tests__/` for new shared modules. Verify these actually run in the test suite -- the vitest config may not include `shared/`.

### W4. `canvasStore.ts` calls `window.flintAPI` inside store action

**File:** `src/store/canvasStore.ts` (auto-save timer, line ~774+)

The auto-save path calls `window.flintAPI.saveFile(...)` inside a Zustand store action. This is a pre-existing pattern (not introduced in this diff) but the diff touches adjacent lines. Noting for awareness -- the architectural anti-pattern list calls this out but this is inherited, not new.

### W5. Ingestion server `d2c:apply` tightened path validation (good)

**File:** `server/index.ts`

The path validation for `d2c:apply` was tightened from `home + sep` to `activeProjectRoot + sep`, and `isSafePathSegment` was added. This is a positive security improvement.

### W6. Server now binds to `127.0.0.1` instead of `0.0.0.0` (good)

**File:** `server/index.ts` (bottom)

`server.listen(port, '127.0.0.1', ...)` -- good security hardening, prevents remote access.

### W7. WebSocket auth token served via unauthenticated GET

**File:** `server/index.ts`

`GET /api/ws-token` returns the session token without authentication. This is acceptable because the server binds to localhost only (W6), but if the bind address ever changes, this becomes an open WS auth bypass.

### W8. Error messages sanitized (good security practice)

Multiple handlers in `server/index.ts` changed from `err.message` to generic `'Operation failed'` in client-facing responses while logging the real error server-side. Good pattern.

---

## Checklist Results

| Check | Result |
|-------|--------|
| C3 Fresh Parse | PASS -- no direct AST mutation found |
| C4 Local-First | PASS -- no external URLs in preview |
| C7 ID Preservation | PASS -- no structural ops missing injectFlintIds |
| C9 CIEDE2000 | PASS -- colorMath.ts extracts shared impl correctly |
| C12 Atomic Queuing | PASS -- atomicWrite used everywhere, improved with unique tmp names |
| C13 No Regex Surgery | PASS -- all code changes via Babel AST |
| Process Boundary | **FAIL** -- type declarations missing (B1, B3) |
| Mithril Safety | PASS -- no hardcoded hex in UI components |
| TSC | PASS -- 0 errors |
| Cross-store imports | PASS -- no store imports another store |
| Node.js in src/ | PASS -- only in test files (acceptable) |
| @anthropic-ai/sdk in src/ | PASS -- not found |

---

## Summary

The changeset is large but architecturally sound. Major positives:
- CIEDE2000 deduplication into `colorMath.ts` (was copy-pasted in 2 files)
- WebSocket authentication added
- Server binds to localhost only
- Path validation hardened across multiple handlers
- Error messages sanitized for client responses
- Exponential backoff on WS reconnect
- atomicWrite race condition fixed with unique temp names

The three blockers are all type declaration gaps -- quick to fix, but mandatory before commit to maintain the type safety contract.
