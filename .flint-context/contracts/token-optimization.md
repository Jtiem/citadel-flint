# Contract: Token Usage Optimization

**Phase:** OPT.1
**Status:** DRAFT
**Author:** flint-architect
**Date:** 2025-03-18

---

## 1. Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `flint-mcp/package.json` | Add `test:changed` script | flint-code-reviewer |
| `package.json` (root) | Add `test:changed` + `test:changed:react` scripts | flint-code-reviewer |
| `flint-mcp/src/tools/universalAudit.ts` | Add `autoFix` param, inline fix pass | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | Update `flint_universal_audit` case to pass `autoFix` | flint-ast-surgeon |
| `flint-mcp/src/core/sessionContext.ts` | Add request-scoped cache layer (export helper) | flint-state-architect |

---

## 2. Change 1: `test:changed` npm Scripts

### Rationale

Vitest supports `--changed` natively (compares against `HEAD` by default). No new dependencies needed.

### Exact Changes

**`flint-mcp/package.json`** — add to `scripts`:
```json
"test:changed": "vitest run --changed"
```

**Root `package.json`** — add to `scripts`:
```json
"test:changed": "vitest run --config vitest.config.ts --changed",
"test:changed:react": "vitest run --config vitest.config.react.ts --changed"
```

### Risks
- None. `--changed` is a stable Vitest flag (v1+). Falls through to running zero tests if no files changed (safe no-op).
- Full suite still runs at commit time via pre-commit gate (no regression risk).

---

## 3. Change 2: `autoFix` on `flint_universal_audit`

### Interface Changes

**Tool input schema addition** (`flint-mcp/src/tools/universalAudit.ts`):
```typescript
// Add to FLINT_UNIVERSAL_AUDIT_TOOL.inputSchema.properties:
autoFix: {
    type: "boolean",
    description: "When true, run flint_fix inline after audit and return combined results. Default false.",
}
```

**Handler signature change** (`handleUniversalAudit`):
```typescript
export function handleUniversalAudit(args: {
    filePath: string;
    projectRoot: string;
    adapterOverride?: string;
    autoFix?: boolean;  // NEW — defaults to false
}): { content: Array<{ type: string; text: string }>; isError?: boolean }
```

**Return shape when `autoFix: true`:**
```typescript
{
    filePath: string;
    language: string;
    violationCount: number;
    violations: UniversalViolation[];
    pluginsRun: string[];
    // NEW — only present when autoFix: true
    autoFixResult?: {
        fixesApplied: number;
        status: string;
        summary: string;
    };
}
```

### Implementation Logic

When `autoFix` is truthy and `violations.length > 0`:
1. Load config via `loadConfig(projectRoot)` (already imported in server.ts, needs import in universalAudit.ts).
2. Call `handleFlintFix({ file: absPath, dryRun: false }, config)`.
3. Attach `autoFixResult` to the JSON response.

### server.ts Update

```typescript
case "flint_universal_audit": {
    const uaArgs = request.params.arguments as {
        filePath: string;
        projectRoot: string;
        adapterOverride?: string;
        autoFix?: boolean;  // NEW
    };
    return handleUniversalAudit(uaArgs);
}
```

No structural change needed in server.ts beyond widening the cast type — the handler reads `autoFix` directly from `args`.

### Dependencies
- `handleFlintFix` from `./fix.js` — already exists, well-tested.
- `loadConfig` from `../core/config-loader.js` — already exists.
- `autoFix` defaults to `false` — no behavior change for existing callers.

### Commandment Checklist
| # | Commandment | Applies? | Satisfied? |
|---|-------------|----------|------------|
| 12 | Atomic Queuing | Yes | `handleFlintFix` writes via its own path (reads file, AST transform, writes back). Not routed through `FileTransactionManager` because this is MCP-side, not Electron-side. Consistent with existing `flint_fix` behavior. |
| 13 | Deterministic Surgery | Yes | Fix pass uses Babel AST traversal (same as `flint_fix`). |
| 14 | Bypass Prohibition | N/A | MCP process, not Electron. `fs.readFileSync/writeFileSync` is the standard pattern in flint-mcp tools. |

### Risks
- **Fix writes to disk** — same risk profile as calling `flint_fix` standalone. No new risk introduced.
- **Import cycle** — `universalAudit.ts` will import from `fix.ts`. Both are leaf tool modules with no circular dependency. Safe.

---

## 4. Change 3: Request-Scoped MCP Resource Cache

### Problem

`assembleSessionContext` already has a 500ms TTL cache keyed by `projectRoot`. Multiple tools in the same MCP request batch will hit this cache and only read from disk once.

**Assessment: The existing cache already satisfies the requirement.**

The 500ms TTL in `sessionContext.ts` (line 36) means:
- Within a single agent turn (typically < 500ms of tool resolution), all `flint_get_context` / `flint://session-context` calls share one disk read.
- Between requests (> 500ms apart), the cache naturally expires.

This is effectively request-scoped behavior without explicit request lifecycle hooks.

### Recommendation: No code change needed

If the team lead still wants an explicit request-scoped cache (belt-and-suspenders), the minimal implementation would be:

**Option A — Expose a `withRequestCache` wrapper in `sessionContext.ts`:**
```typescript
export function withRequestScope<T>(fn: () => Promise<T>, projectRoot: string): Promise<T> {
    // Extend TTL to cover the full request, then invalidate after
    // Not needed given 500ms TTL already covers typical request duration
}
```

**Decision: Ship without additional caching code.** The 500ms TTL already provides the behavior described in the requirements. If profiling later shows multi-second MCP requests where the cache expires mid-batch, we can add explicit request-scoped invalidation at that point.

If the team lead overrides this recommendation, the implementation would be:
1. Add a `requestId` counter to `server.ts` (incremented per `CallToolRequestSchema` handler entry).
2. Pass `requestId` to `assembleSessionContext`.
3. Cache keyed by `(projectRoot, requestId)` instead of just `projectRoot`.
4. Clear previous `requestId` entries on new request.

---

## 5. Implementation Order

| Step | Agent | Depends On | Parallelism Group |
|------|-------|-----------|-------------------|
| 1 | flint-code-reviewer | None | A |
| 2 | flint-ast-surgeon | None | A |
| 3 | flint-test-writer | Steps 1-2 | B |

Steps 1 and 2 can run in parallel (Group A). Step 3 (tests) runs after both complete.

### Test Requirements

| Change | Required Tests |
|--------|---------------|
| `test:changed` scripts | Manual verification only (npm script, no unit test needed) |
| `autoFix` on universal_audit | 1. `autoFix: false` (default) returns audit-only result, no `autoFixResult` key. 2. `autoFix: true` with violations runs fix pass, returns `autoFixResult`. 3. `autoFix: true` with zero violations returns `autoFixResult` with `fixesApplied: 0`. 4. `autoFix: true` with missing tokens still returns audit result (graceful degradation). |
| Resource caching | No change, no test needed. |

---

## 6. Files NOT Touched

- `flint-mcp/src/core/sessionContext.ts` — existing 500ms TTL cache is sufficient.
- `electron/` — no process boundary crossing.
- `src/` — no Glass changes.
- No new dependencies added.

---

## 7. Summary of Key Decisions

1. **`test:changed` uses Vitest's native `--changed` flag** — zero-config, compares against git HEAD.
2. **`autoFix` calls the existing `handleFlintFix` function** — no new fix logic, reuses the battle-tested Babel AST fix pipeline.
3. **Resource caching is already handled** — `sessionContext.ts` has a 500ms TTL cache that provides effective request-scoping. No additional code needed.
4. **`autoFix` defaults to `false`** — zero behavior change for existing callers. Opt-in only.
