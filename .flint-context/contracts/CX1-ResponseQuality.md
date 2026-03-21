# Contract Artifact: Phase CX.1 -- Response Quality Baseline

**Phase:** CX.1
**Status:** CONTRACT (Phase 1 complete -- awaiting Phase 2 implementation)
**Date:** 2026-03-16
**Author:** flint-architect
**Critique Source:** `docs/strategy/CHAT-UX-CRITIQUE.md` Sections 2, 3, 4

---

## 1. Scope

Four changes, all within `flint-mcp/src/`. Zero Glass/Electron changes. Zero new IPC channels.

| Change | Tools Affected |
|--------|---------------|
| `summary` field on tool responses | `flint_audit`, `flint_fix`, `flint_ast_mutate`, `flint_debt_report`, `audit_ui_component`, `flint_swarm_audit_fix` |
| `project_context` footer | `flint_audit`, `flint_fix`, `flint_ast_mutate` |
| `dry_run` flag formalization | `flint_fix` (existing schema, missing implementation), `flint_ast_mutate` (new `dryRun` param) |
| Onboarding hint in server init | Server constructor `instructions` field |

---

## 2. Impact Map

| File | Change Type | Owner Agent |
|------|-------------|-------------|
| `flint-mcp/src/server.ts` | Modify -- add `instructions` to Server constructor; update `flint_ast_mutate` case to support `dryRun`; wire `summary` + `project_context` into tool response assembly for `flint_audit`, `flint_fix`, `flint_ast_mutate`, `flint_debt_report`, `audit_ui_component` | `flint-ast-surgeon` |
| `flint-mcp/src/tools/audit.ts` | Modify -- add `generateAuditSummary()` function; add `summary` and `project_context` fields to `AuditResult` and `BatchAuditResult` interfaces; populate them in handlers | `flint-ast-surgeon` |
| `flint-mcp/src/tools/fix.ts` | Modify -- add `generateFixSummary()` function; add `summary` and `project_context` fields to `FixResult`; implement `dryRun` guard in handler body; populate summary | `flint-ast-surgeon` |
| `flint-mcp/src/tools/debtReport.ts` | Modify -- add `summary` field to debt report handler output | `flint-ast-surgeon` |
| `flint-mcp/src/tools/swarm.ts` | Modify -- add `summary` field to `SwarmReport` | `flint-ast-surgeon` |
| `flint-mcp/src/core/projectContext.ts` | **New file** -- `loadProjectContext()` utility that reads debt history + runs a fast aggregate to produce `ProjectContext` | `flint-ast-surgeon` |
| `flint-mcp/src/__tests__/responseQuality.test.ts` | **New file** -- tests for summary generation, project_context population, dry_run behavior, server instructions | `flint-test-writer` |
| `flint-mcp/src/__tests__/safety-promises.test.ts` | Modify -- update Test 5 (`flint_audit`) and Test 6 (`flint_fix`) assertions to account for new `summary` field in response shape | `flint-test-writer` |

---

## 3. Type Contracts

### 3.1 `ProjectContext` (new shared type)

```typescript
// flint-mcp/src/core/projectContext.ts

export interface ProjectContext {
  health_score: number;
  grade: string;
  total_violations: number;
  blocked_files: number;
}

/**
 * Loads project-level health context from the debt history file or runs a
 * quick scan. Returns null if no data is available (graceful omission).
 *
 * Data source priority:
 *   1. .flint/debt-history.json -- read the most recent entry (O(1) file read)
 *   2. If no history file exists, return null (do NOT run a full scan --
 *      that is expensive and would violate the < 50ms response budget)
 *
 * blocked_files: count of files in the most recent DebtReport's byFile array
 * that have at least one 'critical' violation. If sourced from debt-history.json
 * (which lacks byFile), default to 0.
 *
 * This function MUST NOT throw. On any error, return null.
 */
export function loadProjectContext(projectRoot: string): ProjectContext | null;
```

**Data source:** `.flint/debt-history.json` (the file already written by `generateDebtReport({ track: true })`). Read the **last entry** in the array for `health_score`, `grade`, `total_violations`. `blocked_files` defaults to 0 when sourced from history (history entries don't carry file-level data). When `.flint/debt-history.json` does not exist, return `null`.

**Why not run a full scan?** `generateDebtReport` walks the file tree, parses every TSX file, and runs Mithril + A11y linters. That can take seconds. The `project_context` footer must be < 50ms overhead. History-file read is O(1).

### 3.2 Updated `AuditResult`

```typescript
// flint-mcp/src/tools/audit.ts

export interface AuditResult {
  // ... existing fields unchanged ...
  violations: Array<{
    id: string;
    ruleId: string;
    severity: string;
    message: string;
    type: string;
  }>;
  mithrilCount: number;
  a11yCount: number;
  policyMode: { mithril: string; a11y: string };
  healOnAudit?: HealOnAuditStatus;

  // NEW -- CX.1
  /** One-sentence human-readable summary of audit findings. */
  summary: string;
  /** Project-level health context. Omitted when unavailable. */
  project_context?: ProjectContext;
}
```

### 3.3 Updated `BatchAuditResult`

```typescript
// flint-mcp/src/tools/audit.ts

export interface BatchAuditResult {
  summary: {
    totalFiles: number;
    totalViolations: number;
    healthScore: number;
    grade: string;
    // NEW -- CX.1
    /** One-sentence human-readable summary. */
    text: string;
  };
  files: BatchFileResult[];
  policyMode: { mithril: string; a11y: string };
  // NEW -- CX.1
  project_context?: ProjectContext;
}
```

Note: `BatchAuditResult.summary` already exists as a structured object. CX.1 adds a `text` sub-field rather than a top-level `summary` string, to avoid collision with the existing `summary` object.

### 3.4 Updated `FixResult`

```typescript
// flint-mcp/src/tools/fix.ts

export interface FixResult {
  fixedSource: string;
  fixesApplied: number;
  status: string;

  // NEW -- CX.1
  /** One-sentence human-readable summary of what was fixed. */
  summary: string;
  /** True when the caller passed dryRun: true. */
  dryRun: boolean;
  /** Project-level health context. Omitted when unavailable. */
  project_context?: ProjectContext;
}
```

### 3.5 Updated `SwarmReport`

```typescript
// flint-mcp/src/tools/swarm.ts -- add to existing SwarmReport

export interface SwarmReport {
  // ... existing fields unchanged ...
  // NEW -- CX.1
  summary: string;
}
```

### 3.6 Mutate Response Shape

The `flint_ast_mutate` handler in `server.ts` does not have a dedicated return type -- it builds the response inline. CX.1 adds a `summary` text content block and an optional `project_context` JSON block to the response array. No new interface needed; the contract is defined by the insertion points in `server.ts`.

---

## 4. Summary Generation Rules

Each tool's `summary` field is a single plain-English sentence. The generation function lives in the same file as the handler (co-located, not centralized).

### 4.1 `flint_audit` (single-file)

```
function generateAuditSummary(
  filePath: string,
  violations: AuditResult['violations'],
  mithrilCount: number,
  a11yCount: number,
): string
```

**Template rules:**

| Condition | Output |
|-----------|--------|
| 0 violations | `"No violations found in {basename}. This file is export-ready."` |
| N violations, all fixable (type !== 'a11y') | `"Found {N} violation(s) in {basename} -- {fixable} auto-fixable."` |
| N violations, some a11y | `"Found {N} violation(s) in {basename} -- {mithrilCount} design drift, {a11yCount} accessibility. {fixable} auto-fixable."` |

Where `{basename}` is `path.basename(filePath)`, `{fixable}` is `mithrilCount` (Mithril violations are auto-fixable by `flint_fix`; a11y violations require manual fix).

### 4.2 `flint_audit` (batch)

```
function generateBatchAuditSummary(
  totalFiles: number,
  totalViolations: number,
  healthScore: number,
  grade: string,
): string
```

**Template:** `"Audited {totalFiles} files. {totalViolations} total violation(s). Health: {healthScore}/100 (Grade {grade})."`

### 4.3 `flint_fix`

```
function generateFixSummary(
  filePath: string,
  fixesApplied: number,
  status: string,
  dryRun: boolean,
): string
```

**Template rules:**

| Condition | Output |
|-----------|--------|
| dryRun + fixes > 0 | `"DRY RUN -- would fix {N} violation(s) in {basename}. No changes written."` |
| dryRun + fixes == 0 | `"DRY RUN -- no fixable violations found in {basename}. No changes written."` |
| fixes > 0 | `"Fixed {N} violation(s) in {basename}."` |
| fixes == 0 | `"No fixable violations found in {basename}."` |
| status == 'parse-error' | `"Could not parse {basename}. No fixes applied."` |
| status == 'generate-error' | `"AST generation failed for {basename}. No fixes applied."` |

### 4.4 `flint_ast_mutate`

Summary is generated in `server.ts` inline, not in a separate function.

**Template:** `"Applied {N} mutation(s) to {basename}: {opList}."` when `dryRun` is false.
**Dry run template:** `"DRY RUN -- {N} mutation(s) previewed for {basename}: {opList}. No changes written."`

Where `{opList}` is a comma-separated list of mutation types (e.g., `"updateClassName, updateProp"`). Deduplicated (if 3 updateClassName ops, show `"updateClassName (x3)"`).

### 4.5 `flint_debt_report`

Summary is generated in `server.ts` inline, appended to the existing content block.

**Template:** `"Project health: {healthScore}/100 (Grade {grade}). {totalViolations} violation(s) across {scannedFiles} files."`

If `track` was true: append `" Snapshot saved to debt history."`

### 4.6 `audit_ui_component`

Summary is generated in `server.ts` inline.

**Template (clean):** `"No violations in {basename}. Component is export-ready."`
**Template (blocked):** `"Blocked: {mithrilCount} Mithril + {a11yCount} A11y violation(s) in {basename}."`

### 4.7 `flint_swarm_audit_fix`

```
function generateSwarmSummary(report: SwarmReport): string
```

**Template:** `"Scanned {filesScanned} files. {totalViolations} violation(s) found, {fixesApplied} fixed. Health: {healthBefore} -> {healthAfter}."`

---

## 5. `project_context` Population Contract

### 5.1 Which tools include it

| Tool | Includes `project_context` |
|------|---------------------------|
| `flint_audit` (single) | Yes -- in `AuditResult` |
| `flint_audit` (batch) | Yes -- in `BatchAuditResult` |
| `flint_fix` | Yes -- in `FixResult` |
| `flint_ast_mutate` | Yes -- as a separate JSON content block |
| `flint_debt_report` | **No** -- the tool IS the project context; redundant |
| `audit_ui_component` | **No** -- legacy tool, minimal changes |
| `flint_swarm_audit_fix` | **No** -- already returns before/after health |

### 5.2 How it's loaded

In `flint_audit` and `flint_fix` handlers (in `audit.ts` and `fix.ts`):
```typescript
import { loadProjectContext } from '../core/projectContext.js';

// Inside handler, after computing result:
const projectCtx = loadProjectContext(config.projectRoot);
if (projectCtx !== null) {
  result.project_context = projectCtx;
}
```

In `server.ts` for `flint_ast_mutate`:
```typescript
import { loadProjectContext } from './core/projectContext.js';

// Inside the flint_ast_mutate case, after building mutateResult:
try {
  const projectCtx = loadProjectContext(projectRoot);
  if (projectCtx !== null) {
    mutateResult.content.push({
      type: "text",
      text: JSON.stringify({ project_context: projectCtx }, null, 2),
    });
  }
} catch {
  // project_context is best-effort -- never block the mutation result
}
```

### 5.3 Graceful omission

`loadProjectContext` returns `null` when:
- `.flint/debt-history.json` does not exist
- The file is empty or unparseable
- The array has zero entries
- Any unexpected error occurs

When `null` is returned, the `project_context` key is simply absent from the response. No error, no empty object, no placeholder. The consuming agent sees a response without the field and operates normally.

---

## 6. `dry_run` Contract

### 6.1 `flint_fix`

**Current state:** `dryRun` exists in the input schema and `FixArgs` type, but `handleFlintFix` ignores it. The handler always produces `fixedSource` by traversing and mutating the AST. No file writing happens in the handler itself -- writing is the caller's responsibility.

**CX.1 change:** The handler behavior stays the same (it never writes). The change is in **response semantics**:

1. Add `dryRun: boolean` to `FixResult` so the caller can distinguish responses.
2. Adjust the `summary` field to reflect dry-run status (see Section 4.3).
3. In `server.ts` `flint_fix` case: skip provenance recording when `dryRun: true` (already done).
4. In `server.ts` `flint_fix` case: skip file write when `dryRun: true` (note: `flint_fix` currently never writes to disk in server.ts -- it returns fixed source for the caller to write. This means `dryRun` is already effectively true. The flag's purpose is the **summary text** and the **agent's behavioral signal**).

**What dry_run executes:**
- Babel parse: YES
- AST traversal + mutation: YES (to compute what would change)
- Babel generate: YES (to produce the fixed source string)
- `fixedSource` in response: YES
- `fixesApplied` count: YES
- File write: NO (same as default)
- Provenance recording: NO

**What dry_run does NOT execute:**
- Nothing is skipped at the handler level. The semantic difference is entirely in the response labeling.

### 6.2 `flint_ast_mutate`

**Current state:** Has `writeFile?: boolean` (default `false`). When `false`, the AST is mutated in-memory and the generated code is returned without writing. This is already a dry-run mechanism.

**CX.1 change:** Add a `dryRun?: boolean` alias parameter to the input schema. When `dryRun: true`:

1. Force `writeFile = false` regardless of what the caller passed.
2. Skip provenance recording.
3. Skip risk scoring (MRS).
4. Adjust the `summary` text to say "DRY RUN".

**Implementation:** In `server.ts` `flint_ast_mutate` case, near the top:
```typescript
const dryRun = !!(request.params.arguments as any).dryRun;
const effectiveWriteFile = dryRun ? false : !!writeFile;
```

Then use `effectiveWriteFile` everywhere `writeFile` is currently referenced, and gate provenance/MRS recording on `!dryRun`.

**Schema addition:**
```typescript
dryRun: {
  type: "boolean",
  description:
    "When true, returns the full mutation result (what would change) " +
    "without writing to disk, recording provenance, or computing risk scores. " +
    "Use this for previewing mutations before committing them.",
},
```

---

## 7. Server Onboarding Hint

### 7.1 MCP SDK Field

The `@modelcontextprotocol/sdk` `Server` constructor accepts `ServerOptions` with an `instructions?: string` field. This string is returned to the client in the `InitializeResult` response and is displayed to the agent as a system-level directive.

### 7.2 Current State

```typescript
const server = new Server(
  { name: "flint-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);
```

### 7.3 CX.1 Change

```typescript
const server = new Server(
  { name: "flint-mcp-server", version: "1.0.0" },
  {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    instructions:
      "Flint is a governance engine that enforces design systems, accessibility, " +
      "and brand compliance at the AST level. " +
      "New to Flint? Start with the flint-workflow-guide prompt or read " +
      "flint://capabilities for the full tool catalog. " +
      "For project health at a glance, call flint_get_context with your projectRoot.",
  }
);
```

**Exact string (83 words):** As shown above. Three sentences: identity, onboarding pointer, quick-start action.

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|---------------|
| 1 | Code is Truth | No | CX.1 modifies tool response shapes only, not source code files |
| 4 | Local-First Only | Yes | `loadProjectContext` reads a local JSON file. No network calls. |
| 8 | Audit-First Execution | No | No complexity routing changes |
| 12 | Atomic Queuing | No | No file writes introduced (dry_run is read-only; existing write paths unchanged) |
| 13 | Deterministic Surgery | No | No AST mutations introduced |
| 14 | Bypass Prohibition | Yes | `loadProjectContext` uses `fs.readFileSync` on `.flint/debt-history.json`. This is acceptable: the function runs in the MCP server process (Node.js), not in the renderer. It reads a Flint-managed metadata file, not user source code. It does not write. |
| 15 | Granular AST Tools Only | No | No AI orchestrator changes |
| 16 | In-Memory Validation | No | No AI output changes |

All other commandments are not applicable to this phase.

---

## 9. Test Matrix

### 9.1 New Tests (`flint-mcp/src/__tests__/responseQuality.test.ts`)

| Test ID | Description | What it asserts |
|---------|-------------|----------------|
| CX1-01 | `generateAuditSummary` -- zero violations | Returns "No violations found..." |
| CX1-02 | `generateAuditSummary` -- Mithril only | Returns "Found N violation(s)...N auto-fixable" |
| CX1-03 | `generateAuditSummary` -- mixed Mithril + A11y | Returns "Found N...design drift...accessibility" |
| CX1-04 | `generateBatchAuditSummary` -- multiple files | Returns "Audited N files..." |
| CX1-05 | `generateFixSummary` -- fixes applied | Returns "Fixed N violation(s)..." |
| CX1-06 | `generateFixSummary` -- dry run with fixes | Returns "DRY RUN -- would fix N..." |
| CX1-07 | `generateFixSummary` -- dry run with zero fixes | Returns "DRY RUN -- no fixable..." |
| CX1-08 | `generateFixSummary` -- parse error | Returns "Could not parse..." |
| CX1-09 | `generateFixSummary` -- generate error | Returns "AST generation failed..." |
| CX1-10 | `loadProjectContext` -- with valid history file | Returns `{ health_score, grade, total_violations, blocked_files }` |
| CX1-11 | `loadProjectContext` -- no history file | Returns `null` |
| CX1-12 | `loadProjectContext` -- corrupt history file | Returns `null` (no throw) |
| CX1-13 | `loadProjectContext` -- empty array in history | Returns `null` |
| CX1-14 | `handleFlintAudit` includes `summary` field | `result.summary` is a non-empty string |
| CX1-15 | `handleFlintAudit` includes `project_context` when history exists | `result.project_context.health_score` is a number |
| CX1-16 | `handleFlintAudit` omits `project_context` when no history | `result.project_context` is `undefined` |
| CX1-17 | `handleFlintFix` includes `summary` and `dryRun` fields | Both present in result |
| CX1-18 | `handleFlintFix` with `dryRun: true` -- summary says DRY RUN | `result.summary.includes('DRY RUN')` |
| CX1-19 | `handleFlintFix` with `dryRun: true` -- still returns fixedSource | `result.fixedSource` is non-empty |
| CX1-20 | `BatchAuditResult.summary.text` is populated | Non-empty string |
| CX1-21 | `SwarmReport` includes `summary` field | Non-empty string |
| CX1-22 | Server `instructions` field is set | Verify by instantiating Server and checking options |
| CX1-23 | Mutate summary -- single op | Summary says "Applied 1 mutation(s)..." |
| CX1-24 | Mutate summary -- dry run | Summary says "DRY RUN..." |
| CX1-25 | Mutate summary -- multiple same-type ops | Summary deduplicates: "updateClassName (x3)" |

### 9.2 Existing Tests Requiring Updates

| File | Test | Change |
|------|------|--------|
| `flint-mcp/src/__tests__/safety-promises.test.ts` | Test 5 ("flint_audit returns structured violations") | Assert `result.summary` exists and is a string |
| `flint-mcp/src/__tests__/safety-promises.test.ts` | Test 6 ("flint_fix auto-fixes and re-audit passes") | Assert `result.summary` exists; assert `result.dryRun` is `false` |
| `flint-mcp/src/__tests__/healOnAudit.test.ts` | Any test checking `AuditResult` shape | Add `summary` to expected shape |
| `flint-mcp/src/__tests__/toolEnricher.test.ts` | Tests that mock/assert tool result shapes | Update expected shapes if they assert on the full `FixResult` or `AuditResult` |

---

## 10. Implementation Order

### Group A (parallel -- no dependencies between them)

| Step | Agent | What | Blocked By |
|------|-------|------|------------|
| A1 | `flint-ast-surgeon` | Create `flint-mcp/src/core/projectContext.ts` with `loadProjectContext()` | Nothing |
| A2 | `flint-ast-surgeon` | Add summary generation functions and new type fields to `flint-mcp/src/tools/audit.ts` | Nothing |
| A3 | `flint-ast-surgeon` | Add summary generation function, `dryRun` field, and new type fields to `flint-mcp/src/tools/fix.ts` | Nothing |
| A4 | `flint-ast-surgeon` | Add `summary` field to `SwarmReport` in `flint-mcp/src/tools/swarm.ts` | Nothing |

### Group B (depends on Group A)

| Step | Agent | What | Blocked By |
|------|-------|------|------------|
| B1 | `flint-ast-surgeon` | Wire `server.ts`: add `instructions` to Server constructor; update `flint_audit` case to use new summary + project_context; update `flint_fix` case; update `flint_ast_mutate` case (dryRun alias, summary block, project_context block); update `flint_debt_report` case (summary); update `audit_ui_component` case (summary) | A1, A2, A3 |

### Group C (depends on Group A; can run parallel with B)

| Step | Agent | What | Blocked By |
|------|-------|------|------------|
| C1 | `flint-test-writer` | Write `flint-mcp/src/__tests__/responseQuality.test.ts` (CX1-01 through CX1-25) | A1, A2, A3 |
| C2 | `flint-test-writer` | Update existing tests in `safety-promises.test.ts`, `healOnAudit.test.ts`, `toolEnricher.test.ts` | A2, A3 |

### Group D (depends on B and C)

| Step | Agent | What | Blocked By |
|------|-------|------|------------|
| D1 | `flint-test-writer` | Run full MCP test suite (`cd flint-mcp && npm test`), report counts | B1, C1, C2 |
| D2 | `flint-test-writer` | Run `npx tsc --noEmit`, confirm 0 errors | B1 |

---

## 11. Risks

| Risk | Commandment Threatened | Mitigation |
|------|----------------------|------------|
| `loadProjectContext` reads `.flint/debt-history.json` which may not exist on fresh projects | C.4 (Local-First) | Returns `null` gracefully. All `project_context` usage is guarded by `!= null` check. |
| Adding fields to `AuditResult` / `FixResult` could break downstream consumers that do strict shape checks | None (additive change) | All new fields are optional (`summary` has a default; `project_context` is `?:`). No existing field is removed or renamed. |
| `BatchAuditResult.summary` name collision -- existing `summary` is an object, not a string | Type safety | CX.1 adds `summary.text: string` inside the existing object rather than a top-level `summary: string`. No collision. |
| `flint_ast_mutate` dryRun + writeFile interaction | C.12 (Atomic Queuing) | `dryRun: true` forces `writeFile = false`. No ambiguity. Explicit precedence rule documented above. |
| Summary strings could leak internal vocabulary (rule IDs) | UX quality | Summary functions use `path.basename` and counts. Rule IDs appear in the technical payload, not the summary. |
| Performance overhead of `loadProjectContext` on every audit/fix call | Response latency | Single `readFileSync` of a < 50KB JSON file. Budget: < 5ms. Measured risk: negligible. |
| `flint_fix` handler already ignores `dryRun` -- CX.1 doesn't change that | Expectation mismatch | The contract explicitly documents that `dryRun` affects **response labeling and provenance**, not handler behavior. The handler never wrote to disk anyway. |

---

## 12. What Is NOT In Scope

These are explicitly deferred from CX.1. They appear in `CHAT-UX-CRITIQUE.md` but belong to later phases:

- **Error taxonomy** (Section 6) -- requires an error code registry and changes to every tool's catch blocks. Deferred to CX.3.
- **Rule explanations** (Section 10) -- documentation task across all Mithril and A11y rules. Deferred to CX.4.
- **Persona switching hints** (Section 8) -- requires domain detection logic in audit responses. Deferred to CX.5.
- **Streaming progress** (Section 11) -- requires MCP streaming response support. Deferred to CX.6.
- **Session journal** (Section 12) -- requires new SQLite table + IPC. Deferred to CX.7.
- **`flint_plan`** (Section 5) -- already implemented as Phase CX.2.

---

## 13. Acceptance Criteria

Phase CX.1 is SHIP when:

1. Every tool listed in Section 4 returns a `summary: string` in its response.
2. `flint_audit`, `flint_fix`, and `flint_ast_mutate` include `project_context` when `.flint/debt-history.json` exists.
3. `flint_fix` and `flint_ast_mutate` respect `dryRun: true` with correct summary labeling and no side effects (no provenance, no file write, no MRS).
4. The MCP server's `InitializeResult` includes the `instructions` string.
5. All 25 new tests pass.
6. All pre-existing tests pass (no regressions).
7. `npx tsc --noEmit` returns 0 errors.
8. Test report format: `MCP: X/Y passing (25 new), TSC: 0 errors`.
