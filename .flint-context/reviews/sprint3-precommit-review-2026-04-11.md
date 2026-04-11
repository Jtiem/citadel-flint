# Sprint 3 Pre-Commit Review

**Date:** 2026-04-11
**Scope:** 69 files, ~3200 insertions / ~3800 deletions
**TSC:** 0 errors
**Core tests:** 1378/1382 passing (4 failures, 2 files)
**MCP tests:** 4383/4411 passing (28 failures, 1 file)

---

## BLOCKERS

### B1. Mithril parity test regression (3 failures)
`shared/__tests__/mithrilParity.test.ts` -- MCP added `checkStyleProps` and `visitInlineStyles` exports that Glass does not re-export. The parity allowlist needs updating or the functions need porting to the Glass-side linter.

### B2. `suggestedAction` test regression (28 failures)
`src/__tests__/suggestedAction.test.ts` -- `assembleSuggestedAction is not a function`. The function was either renamed or its export was broken. Must fix before commit.

### B3. `provenanceDbCache` module-level Map never cleaned up
`flint-mcp/src/core/governance/riskScoringService.ts:715` -- Read-only SQLite connections accumulate in a `Map` with no eviction or shutdown hook. In a long-running MCP server auditing multiple projects, this leaks file handles. Add a `closeAll()` or use an LRU with a small cap.

---

## WARNINGS

### W1. C13 regex in LivePreview (waiver documented -- acceptable)
`src/components/editor/LivePreview.tsx:679` -- `js.replace(/^import\s[\s\S]*?/gm, '')` on Babel output. The C13 waiver comment is present and the primary path is Babel-based. Acceptable.

### W2. `useNotificationStore.getState()` called from web-api adapter
`src/adapters/web-api.ts:12,157,215` -- Directly calling a Zustand store from the adapter layer (not a component or hook). This is the web-api boundary adapter, not a store action, so the anti-pattern is minor -- but worth noting for future refactors.

### W3. `dbomService.ts` uses `fs.writeFileSync` + `fs.renameSync` instead of FileTransactionManager
`flint-mcp/src/core/governance/dbomService.ts:420-422` -- The atomic tmp+rename pattern is correct, but C12 says all writes go through `FileTransactionManager`. This is MCP-side (not Electron) so FTM is not available; the manual atomic write is the best available option. Acceptable.

### W4. VS Code governancePanel webview uses `var` instead of `let`/`const`
`flint-vscode/src/webview/governancePanel.ts:168` -- `var hasDebtGrade = false`. Minor -- webview script context, not module scope. Cosmetic.

---

## GOOD

- SQL injection hardening in `anomalyDetectionService.ts` (table/column/clause allowlists) -- strong security improvement.
- `rulePackRegistry.ts` replaced fragile regex YAML parsing with proper `yaml` parser -- eliminates a class of config parsing bugs.
- `trustTierService.ts` sliding-window promotion -- cumulative red counts no longer permanently block agents.
- `flintClient.ts` proper MCP handshake (initialize then notifications/initialized) instead of 3s timeout guess.
- `diagnosticsProvider.ts` debounced audits prevent flood on rapid tab switches.
- `LivePreview.tsx` Zustand selector pattern fix (individual selectors instead of destructuring).
- `server/index.ts` symlink-aware path validation and canonical path return -- closes a path traversal vector.
- `StatusBar.tsx` layout reorganized into 3 zones; `py-[3px]` replaced with `py-1` (Mithril-clean).
- No process boundary violations: zero `fs`/`path`/`child_process`/`@anthropic-ai/sdk` imports in `src/`.
- No direct AST mutations found.
- `governance:apply-fix` IPC has type declarations in `flint-api.d.ts` and web parity in `server/index.ts`.

---

## VERDICT: FIX

Three blockers must be resolved: the parity test allowlist (B1), the broken `suggestedAction` export (B2), and the unbounded DB cache (B3). All three are small fixes -- likely under 10 lines each. After those, this is ready to ship.
