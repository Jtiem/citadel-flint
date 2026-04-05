# Security + IPC Review: electron/main.ts (UX Audit Burn-Down)

**Reviewer:** Quality Gate (Opus)
**Date:** 2026-04-04
**Scope:** `git diff HEAD -- electron/main.ts` (UX audit burn-down changes)

## Domain: Security + IPC

| File | Rating | Issues |
|------|--------|--------|
| `electron/main.ts` | A | 0 BLOCKER, 0 WARNING |

## Change Summary

The diff contains exactly **one line added**:

```
sourceType: 'module',
```

This is added to the Babel `transformSync` options inside the `code:transform` IPC handler (line 525). It explicitly sets the Babel source type to `module`, which ensures ES module syntax (`import`/`export`) is parsed correctly rather than relying on Babel's auto-detection heuristic.

## Checklist Results

### IPC Surface

- [x] **Channel typed in `flint-api.d.ts`:** The `code:transform` channel is exposed as `transformCode: (code: string) => Promise<{ js: string | null; error: string | null }>` at line 1539 of `src/types/flint-api.d.ts`. No new channels introduced.
- [x] **Preload bridge:** Exposed via `ipcRenderer.invoke('code:transform', code)` at line 217 of `electron/preload.ts`. No `ipcRenderer` leakage to renderer.
- [x] **Input validation:** The handler validates `typeof code !== 'string'` at line 519 before processing. Unchanged by this diff.

### Secrets

- [x] **No secrets exposed:** The change adds a Babel config option. No API keys, tokens, or credentials involved.

### ACL / Path Validation

- [x] **Not applicable:** This handler transforms in-memory code strings, not file paths. No filesystem access.

### Process Boundary

- [x] **No process boundary violations:** The change is entirely within `electron/main.ts` (Node.js main process). No new imports in `src/`.

### Commandment Compliance

- [x] **C3 (Fresh Parse):** Not applicable -- this handler produces preview JS, not AST mutations.
- [x] **C12 (Atomic Queuing):** Not applicable -- no file writes.
- [x] **C13 (No Regex Surgery):** The existing `js.replace()` calls on lines 543 and 548 operate on Babel's compiled output for iframe injection, not on user source code. This is post-compilation output munging for the preview renderer, not source-level surgery. Acceptable.
- [x] **C4 (Local-First):** No external URLs introduced.

## Risk Assessment

**Minimal.** The change makes Babel's source type explicit rather than relying on auto-detection. This is a correctness improvement: without `sourceType: 'module'`, Babel may misparse files that use `import`/`export` at the top level when its heuristic fails. The change has no security implications.

## Issues Found

None.

## Verdict: SHIP

The single-line change is a safe Babel configuration improvement with no security, IPC, or Commandment concerns. All existing input validation and type declarations remain intact. No new attack surface introduced.
