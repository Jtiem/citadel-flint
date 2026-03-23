# Contract: GPX.1 -- Governance Pack Export

**Phase:** GPX.1
**Date:** 2026-03-21
**Status:** READY FOR PHASE 2
**Spec Source:** `docs/strategy/FEATURE-SPEC-GOVERNANCE-PACK-EXCHANGE.md` (lines 151-206)

---

## Summary

GPX.1 implements the `.flint-pack/` directory format and the `flint_pack_export` MCP tool. The tool reads the active project's governance configuration, validates it, and bundles it into a portable `.flint-pack.zip` archive. This is MCP-only -- no Glass UI, no IPC, no stores.

---

## Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `flint-mcp/src/tools/packExport.ts` | NEW FILE -- tool definition + handler | flint-ast-surgeon |
| `flint-mcp/src/core/packAssembler.ts` | NEW FILE -- pack assembly pipeline (collect, validate, zip) | flint-ast-surgeon |
| `flint-mcp/src/core/packTypes.ts` | NEW FILE -- shared type contracts | flint-ast-surgeon |
| `flint-mcp/src/core/packSecurityScanner.ts` | NEW FILE -- secret/path detection | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | MODIFY -- register `flint_pack_export` tool | flint-ast-surgeon |
| `flint-mcp/src/tools/__tests__/packExport.test.ts` | NEW FILE -- tool handler tests | flint-test-writer |
| `flint-mcp/src/core/__tests__/packAssembler.test.ts` | NEW FILE -- assembler unit tests | flint-test-writer |
| `flint-mcp/src/core/__tests__/packSecurityScanner.test.ts` | NEW FILE -- scanner unit tests | flint-test-writer |

---

## Type Contracts (source of truth for Phase 2)

### `flint-mcp/src/core/packTypes.ts`

```typescript
/**
 * Pack Types -- flint-mcp/src/core/packTypes.ts
 *
 * Shared type definitions for the Governance Pack Exchange system.
 * These types define the `.flint-pack/` manifest format and all
 * intermediate data structures used during pack assembly.
 */

// ── Manifest Schema ─────────────────────────────────────────────────────────

export interface PackAuthor {
    name: string;
    email?: string;
    org?: string;
}

export interface PackCompatibility {
    flint_min_version: string;
    flint_max_version: string | null;
}

export interface PackContentsDeclaration {
    policy: boolean;
    agent_policy: boolean;
    rules: string[];           // Rule IDs that are included
    claude_fragments: string[]; // Relative paths within claude-fragments/
}

/**
 * The canonical manifest.json that lives at the root of every .flint-pack/ bundle.
 * Matches the schema defined in FEATURE-SPEC-GOVERNANCE-PACK-EXCHANGE.md.
 */
export interface PackManifest {
    schema_version: 1;
    id: string;                 // Globally unique slug. Lowercase, hyphens only.
    name: string;
    version: string;            // Semver
    description: string;
    author: PackAuthor;
    trust_tier: 'community';    // Always 'community' for local exports (trust_tier is registry-assigned)
    domain: GovernanceDomain;
    stack_tags: string[];
    compatibility: PackCompatibility;
    dependencies: string[];
    contents: PackContentsDeclaration;
    checksums: Record<string, string>;  // filename -> "sha256:<hex>" for each file in the pack
    published_at: string;       // ISO 8601 UTC
}

// Re-export for convenience
export type { GovernanceDomain } from './policyEngine.js';

// ── Pack Assembly Types ─────────────────────────────────────────────────────

/**
 * A single file entry to be included in the pack archive.
 */
export interface PackFileEntry {
    /** Relative path within the pack (e.g. "policy.json", "rules/MITHRIL-COL.json") */
    packPath: string;
    /** The file content as a string */
    content: string;
    /** SHA-256 hex digest of content */
    checksum: string;
}

/**
 * The collected contents of a pack before archiving.
 * This is the intermediate representation between collection and zip generation.
 */
export interface PackContents {
    policy: PackFileEntry | null;
    agentPolicy: PackFileEntry | null;
    rules: PackFileEntry[];
    claudeFragments: PackFileEntry[];
}

// ── Validation Types ────────────────────────────────────────────────────────

export type PackValidationSeverity = 'error' | 'warning';

/**
 * A single validation error or warning found during pack assembly.
 */
export interface PackValidationError {
    severity: PackValidationSeverity;
    file: string;              // The file where the issue was found
    line?: number;             // Optional line number
    message: string;           // Human-readable description
    code: PackValidationCode;  // Machine-readable error code
}

/**
 * Machine-readable validation error codes.
 */
export type PackValidationCode =
    | 'POLICY_INVALID'         // policy.json fails validatePolicy()
    | 'AGENT_POLICY_INVALID'   // agent-policy.json fails shape validation
    | 'ABSOLUTE_PATH'          // File contains an absolute local path
    | 'SECRET_DETECTED'        // File contains an API key or secret pattern
    | 'NODE_BUILTIN_IMPORT'    // Skill file imports Node.js builtins
    | 'FILE_NOT_FOUND'         // Referenced file does not exist
    | 'INVALID_PACK_ID'        // Pack ID does not match slug format
    | 'INVALID_SEMVER';        // Version string is not valid semver

// ── Export Result Types ─────────────────────────────────────────────────────

/**
 * Result returned by flint_pack_export on dry_run: true.
 */
export interface PackExportDryRunResult {
    dry_run: true;
    manifest: PackManifest;
    files: Array<{
        path: string;
        size_bytes: number;
        checksum: string;
    }>;
    validation_errors: PackValidationError[];
    summary: string;
}

/**
 * Result returned by flint_pack_export on dry_run: false (actual export).
 */
export interface PackExportWriteResult {
    dry_run: false;
    manifest: PackManifest;
    archive_path: string;      // Absolute path to the written .flint-pack.zip
    archive_size_bytes: number;
    file_count: number;
    validation_errors: PackValidationError[];  // Warnings only (errors block export)
    summary: string;
}

export type PackExportResult = PackExportDryRunResult | PackExportWriteResult;
```

---

## MCP Tool Design: `flint_pack_export`

### Tool Definition

```typescript
// flint-mcp/src/tools/packExport.ts

export const FLINT_PACK_EXPORT_TOOL = {
    name: toolName('pack_export'),
    description:
        'Bundle the active project\'s governance configuration into a portable ' +
        '.flint-pack.zip archive. Collects policy.json, agent-policy.json, ' +
        'customized rules, and optional CLAUDE.md fragments. Validates that no ' +
        'secrets or absolute paths are included. Use dry_run to preview contents ' +
        'without writing.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            id: {
                type: 'string',
                description:
                    'Pack identifier slug. Lowercase, hyphens only (e.g. "acme-healthcare-governance"). ' +
                    'Used as the manifest.id field.',
            },
            name: {
                type: 'string',
                description: 'Human-readable display name for the pack.',
            },
            version: {
                type: 'string',
                description: 'Semver version string (e.g. "1.0.0").',
            },
            description: {
                type: 'string',
                description: 'Plain-language summary of what this governance pack enforces.',
            },
            author: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    org: { type: 'string' },
                },
                required: ['name'],
                description: 'Pack author identity.',
            },
            stack_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Searchable technology tags (e.g. ["react", "tailwind"]).',
            },
            include_claude_fragments: {
                type: 'array',
                items: { type: 'string' },
                description:
                    'Relative paths within .claude/ to include (e.g. ["agents/hipaa-sentinel.md"]). ' +
                    'Files are scrubbed for local paths before inclusion.',
            },
            output_path: {
                type: 'string',
                description:
                    'Absolute path where the .flint-pack.zip should be written. ' +
                    'Defaults to <project-root>/.flint-pack.zip.',
            },
            dry_run: {
                type: 'boolean',
                description:
                    'When true, reports what would be bundled without writing the archive. ' +
                    'Default: false.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root. Defaults to process.cwd().',
            },
        },
        required: ['id', 'name', 'version', 'description', 'author'],
    },
} as const;
```

### Input Args Interface

```typescript
export interface PackExportArgs {
    id: string;
    name: string;
    version: string;
    description: string;
    author: PackAuthor;
    stack_tags?: string[];
    include_claude_fragments?: string[];
    output_path?: string;
    dry_run?: boolean;
    projectRoot?: string;
}
```

### Handler Signature

```typescript
export async function handlePackExport(
    args: PackExportArgs,
    defaultProjectRoot: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }>;
```

### Handler Logic (pseudocode)

```
1. Resolve projectRoot from args or default
2. Validate pack ID format (lowercase, hyphens, no spaces)
3. Validate version is valid semver
4. Call collectPackContents(projectRoot, args)
5. Call validatePackContents(contents) → PackValidationError[]
6. If any error-severity validations: return error result immediately
7. Build PackManifest from args + collected contents + checksums
8. If dry_run: return PackExportDryRunResult
9. Generate zip archive from contents + manifest
10. Write archive to output_path (or default)
11. Return PackExportWriteResult
```

---

## Pack Assembly Pipeline: `flint-mcp/src/core/packAssembler.ts`

### Step-by-step pipeline

#### Step 1: Read Policy

```typescript
export async function collectPolicy(projectRoot: string): Promise<PackFileEntry | null>
```

- Read `.flint/policy.json` using `fs.readFileSync` (the MCP engine runs in Node.js; this is the same pattern as `loadPolicy()` in `policyEngine.ts`)
- If file does not exist: return `null` (pack will have `contents.policy = false`)
- Validate against `validatePolicy()` from `policyEngine.ts`
- If invalid: add `PackValidationError` with code `POLICY_INVALID` but still include the file (the error will block export unless it is a warning)
- Compute SHA-256 of the file content
- Return `PackFileEntry` with `packPath: "policy.json"`

#### Step 2: Read Agent Policy

```typescript
export async function collectAgentPolicy(projectRoot: string): Promise<{
    entry: PackFileEntry | null;
    errors: PackValidationError[];
}>
```

- Read `.flint/agent-policy.json`
- If file does not exist: return `null`
- Validate shape matches `AgentPolicyFile` interface (check: top-level object, optional `version` number, optional `agents` array of objects with `agentId` string, optional `defaultTier` string in valid tier set)
- Compute SHA-256
- Return `PackFileEntry` with `packPath: "agent-policy.json"`

#### Step 3: Collect Customized Rules

```typescript
export async function collectCustomizedRules(
    projectRoot: string,
    policy: ResolvedPolicy,
): Promise<PackFileEntry[]>
```

- Read the `mithril.rules` and `a11y.rules` maps from the resolved policy
- For each rule ID that has a non-default mode override (i.e., any entry in `mithril.rules` or `a11y.rules`), create a rule config JSON file:
  ```json
  { "id": "MITHRIL-COL", "mode": "advisory", "source": "policy" }
  ```
- Each file goes to `packPath: "rules/<RULE-ID>.json"`
- Compute SHA-256 for each

#### Step 4: Collect CLAUDE.md Fragments

```typescript
export async function collectClaudeFragments(
    projectRoot: string,
    fragmentPaths: string[],
): Promise<{ entries: PackFileEntry[]; errors: PackValidationError[] }>
```

- For each path in `include_claude_fragments`:
  - Resolve against `<projectRoot>/.claude/`
  - If file does not exist: add `FILE_NOT_FOUND` error
  - Read file content
  - Run security scanner on content
  - Scrub any absolute paths found (replace with `<PROJECT_ROOT>` placeholder)
  - Place at `packPath: "claude-fragments/<relative-path>"`
  - Compute SHA-256

#### Step 5: Security Validation

Run `packSecurityScanner.scanContent()` on every collected file's content. This step is performed after collection but before manifest generation.

#### Step 6: Generate Manifest

```typescript
export function generateManifest(
    args: PackExportArgs,
    contents: PackContents,
    policy: ResolvedPolicy,
): PackManifest
```

- Build the `PackManifest` from:
  - `args.id`, `args.name`, `args.version`, `args.description`, `args.author`
  - `schema_version: 1`
  - `trust_tier: 'community'` (always -- trust tier is registry-assigned per spec)
  - `domain`: from the resolved policy's `domain` field
  - `stack_tags`: from args or default `[]`
  - `compatibility.flint_min_version`: hardcode to current Flint version (`"7.0.0"`)
  - `compatibility.flint_max_version`: `null`
  - `dependencies`: `[]` (no dependency resolution in GPX.1)
  - `contents`: declaration object built from what was collected
  - `checksums`: map of `packPath -> "sha256:<hex>"` for every file
  - `published_at`: current UTC ISO 8601 timestamp

#### Step 7: Write Zip Archive

```typescript
export async function writePackArchive(
    manifest: PackManifest,
    contents: PackContents,
    outputPath: string,
): Promise<{ archivePath: string; archiveSizeBytes: number }>
```

- Use Node.js built-in `zlib` and the `archiver` npm package (or `yazl` -- choose a zero-dependency zip writer)
- **Decision: use `yazl`** -- it is a minimal, zero-dependency zip writer that is already battle-tested in the Node.js ecosystem. If adding a dependency is undesirable, use the built-in `zlib` with manual zip construction, but `yazl` is strongly preferred for correctness.
- **Alternative (no new dependency):** Use a manual zip buffer builder. The pack will contain at most ~10 small JSON/MD files. A simple approach using Node.js `Buffer` and the ZIP format spec is feasible but error-prone. **Recommendation: add `yazl` as a dependency of `flint-mcp`.**
- Write `manifest.json` first, then all collected files in deterministic alphabetical order
- Write to `outputPath`

---

## Security Validation: `flint-mcp/src/core/packSecurityScanner.ts`

### Secret Detection Patterns

```typescript
/**
 * Patterns that indicate potential secrets or API keys.
 * These are applied to every file included in the pack.
 */
export const SECRET_PATTERNS: ReadonlyArray<{
    name: string;
    pattern: RegExp;
}> = [
    { name: 'Generic API Key',        pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { name: 'Generic Secret',         pattern: /(?:secret|password|passwd|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { name: 'AWS Access Key',         pattern: /AKIA[0-9A-Z]{16}/g },
    { name: 'AWS Secret Key',         pattern: /(?:aws_secret_access_key|secret_key)\s*[:=]\s*['"][^'"]{20,}['"]/gi },
    { name: 'GitHub Token',           pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
    { name: 'Anthropic API Key',      pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    { name: 'OpenAI API Key',         pattern: /sk-[A-Za-z0-9]{20,}/g },
    { name: 'Slack Token',            pattern: /xox[baprs]-[0-9]{10,}-[A-Za-z0-9]{10,}/g },
    { name: 'Private Key Block',      pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
    { name: 'Env Variable Assignment',pattern: /^[A-Z][A-Z0-9_]{2,}=\S{8,}$/gm },
    { name: 'Bearer Token',           pattern: /(?:bearer|authorization)\s*[:=]\s*['"][^'"]{20,}['"]/gi },
];
```

### Absolute Path Detection

```typescript
/**
 * Detect absolute local file paths.
 * Matches Unix-style (/Users/..., /home/..., /tmp/...) and
 * Windows-style (C:\..., D:\...) absolute paths.
 */
export const ABSOLUTE_PATH_PATTERNS: ReadonlyArray<RegExp> = [
    /(?:^|["'\s=:])\/(?:Users|home|tmp|var|opt|etc|root)\/[^\s"']+/gm,
    /(?:^|["'\s=:])[A-Z]:\\[^\s"']+/gm,
];
```

### Node.js Builtin Import Detection

```typescript
/**
 * Detect imports of Node.js built-in modules in skill files.
 * Skills are sandboxed to the MCP tool surface.
 */
export const NODE_BUILTIN_PATTERN = /(?:require|import)\s*\(?['"](?:node:)?(?:fs|path|child_process|os|crypto|net|http|https|dgram|cluster|dns|tls|readline|repl|vm|worker_threads)['"]/g;
```

### Scanner API

```typescript
export interface ScanResult {
    clean: boolean;
    errors: PackValidationError[];
}

/**
 * Scans a single file's content for security violations.
 */
export function scanContent(
    content: string,
    filePath: string,
    options?: { checkNodeBuiltins?: boolean },
): ScanResult;

/**
 * Scans all files in a PackContents for security violations.
 */
export function scanPackContents(contents: PackContents): PackValidationError[];
```

---

## server.ts Registration

### Import addition

```typescript
import {
    handlePackExport,
    FLINT_PACK_EXPORT_TOOL,
} from "./tools/packExport.js";
```

### ListTools addition

Add `FLINT_PACK_EXPORT_TOOL` to the tools array in the `ListToolsRequestSchema` handler, alongside the existing tools.

### CallTool addition

Add a case in the `CallToolRequestSchema` handler:

```typescript
case "flint_pack_export": {
    const exportArgs = request.params.arguments as {
        id: string;
        name: string;
        version: string;
        description: string;
        author: { name: string; email?: string; org?: string };
        stack_tags?: string[];
        include_claude_fragments?: string[];
        output_path?: string;
        dry_run?: boolean;
        projectRoot?: string;
    };
    return handlePackExport(exportArgs, process.cwd());
}
```

---

## Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|------------|---------|---------------|
| C1 | Code is Truth | No | GPX.1 bundles config files, not source code. No AST mutations. |
| C4 | Local-First Only | Yes | Pack export reads only local files. No network calls. The output zip is a local file. |
| C12 | Atomic Queuing | Partial | The spec note in `policyLoader.ts` says policy.json is metadata, not source code, so direct `fs.writeFile` is acceptable. However, the zip write should use atomic write (write to `.tmp` then rename) to prevent partial archives. |
| C13 | Deterministic Surgery | N/A | No source code modification occurs. JSON files are read/written as structured data, not string-manipulated. |
| C14 | Bypass Prohibition | Partial | The MCP engine (`flint-mcp/`) already uses `fs` directly for policy reads (see `policyEngine.ts`, `policyLoader.ts`, `fix.ts`). This is the established pattern in the MCP process. GPX.1 follows the same pattern. The prohibition against direct `fs` applies to the `src/` renderer process, not the MCP engine. |

### C12 Detail: Atomic Zip Write

The zip archive write must follow the atomic pattern:
1. Write to `<outputPath>.tmp`
2. Rename to `<outputPath>`
3. On failure, clean up the `.tmp` file

This prevents a partially-written zip from appearing at the output path if the process is interrupted.

### C14 Clarification

Commandment 14 as stated in CLAUDE.md says "never use `fs` or `git` directly; route through `FileTransactionManager` / `GitManager`." However, the established MCP engine pattern (visible in `policyEngine.ts`, `fix.ts`, `policyLoader.ts`, `dbom.ts`, rules `loader.ts`, and throughout `server.ts`) uses `fs` directly for reading project files. `FileTransactionManager` lives in `electron/` and is not importable from `flint-mcp/`. GPX.1 follows the established MCP engine pattern: use `fs` for reads and atomic temp+rename for the single write (the zip archive).

---

## Implementation Order

### Group 1 (sequential -- must be first)

1. **Types** (`flint-mcp/src/core/packTypes.ts`) -- Owner: flint-ast-surgeon
   - All type definitions from the Type Contracts section above
   - Zero dependencies beyond re-exporting `GovernanceDomain` from `policyEngine.ts`

### Group 2 (parallel -- after Group 1)

2a. **Security Scanner** (`flint-mcp/src/core/packSecurityScanner.ts`) -- Owner: flint-ast-surgeon
   - Secret patterns, path detection, node builtin detection
   - Pure functions, depends only on packTypes

2b. **Scanner Tests** (`flint-mcp/src/core/__tests__/packSecurityScanner.test.ts`) -- Owner: flint-test-writer
   - Can start immediately after scanner file exists

### Group 3 (after Group 1)

3. **Pack Assembler** (`flint-mcp/src/core/packAssembler.ts`) -- Owner: flint-ast-surgeon
   - `collectPolicy`, `collectAgentPolicy`, `collectCustomizedRules`, `collectClaudeFragments`
   - `generateManifest`, `writePackArchive`
   - Depends on: packTypes, packSecurityScanner, policyEngine.ts (for `loadPolicy`, `validatePolicy`)
   - Depends on: `yazl` package (add to `flint-mcp/package.json` devDependencies)

### Group 4 (after Group 3)

4a. **Tool Handler** (`flint-mcp/src/tools/packExport.ts`) -- Owner: flint-ast-surgeon
   - Tool definition constant, args interface, handler function
   - Depends on: packAssembler, packTypes

4b. **server.ts Registration** -- Owner: flint-ast-surgeon
   - Import + ListTools + CallTool additions

### Group 5 (parallel with Group 4)

5a. **Assembler Tests** (`flint-mcp/src/core/__tests__/packAssembler.test.ts`) -- Owner: flint-test-writer

5b. **Tool Handler Tests** (`flint-mcp/src/tools/__tests__/packExport.test.ts`) -- Owner: flint-test-writer

### Effective parallelism

```
Group 1: packTypes.ts                          (sequential)
         |
Group 2: packSecurityScanner.ts  ---|          (parallel)
         scannerTests             ---|
         |
Group 3: packAssembler.ts                      (sequential)
         |
Group 4: packExport.ts + server.ts  ---|       (parallel)
Group 5: assemblerTests + toolTests  ---|
```

---

## Test Plan

### `flint-mcp/src/core/__tests__/packSecurityScanner.test.ts`

| Test Case | Category |
|-----------|----------|
| Detects generic API key pattern in JSON content | Secret detection |
| Detects AWS access key in markdown content | Secret detection |
| Detects Anthropic API key pattern | Secret detection |
| Detects OpenAI API key pattern | Secret detection |
| Detects GitHub token pattern | Secret detection |
| Detects private key block | Secret detection |
| Detects env variable assignment | Secret detection |
| Returns clean for content with no secrets | Happy path |
| Detects Unix absolute path (`/Users/foo/bar`) | Path detection |
| Detects Windows absolute path (`C:\Users\foo`) | Path detection |
| Does not flag relative paths as absolute | False positive guard |
| Does not flag URL paths (`https://example.com/path`) | False positive guard |
| Detects Node.js builtin import (`import fs from 'node:fs'`) | Builtin detection |
| Detects Node.js require (`require('child_process')`) | Builtin detection |
| Does not flag allowed imports (`import { z } from 'zod'`) | False positive guard |
| Reports correct file path and error code in results | Error shape |

### `flint-mcp/src/core/__tests__/packAssembler.test.ts`

| Test Case | Category |
|-----------|----------|
| `collectPolicy` returns entry when `.flint/policy.json` exists and is valid | Happy path |
| `collectPolicy` returns null when `.flint/policy.json` does not exist | Missing file |
| `collectPolicy` returns entry + error when policy is invalid | Validation |
| `collectAgentPolicy` returns entry when valid `agent-policy.json` exists | Happy path |
| `collectAgentPolicy` returns null when file does not exist | Missing file |
| `collectAgentPolicy` returns error for malformed JSON | Validation |
| `collectAgentPolicy` returns error for invalid shape (missing agentId) | Validation |
| `collectCustomizedRules` returns entries for non-default rule modes | Happy path |
| `collectCustomizedRules` returns empty array when no rules are customized | Edge case |
| `collectClaudeFragments` reads and includes specified fragment files | Happy path |
| `collectClaudeFragments` returns FILE_NOT_FOUND for missing fragments | Missing file |
| `collectClaudeFragments` scrubs absolute paths from fragment content | Security |
| `collectClaudeFragments` detects secrets in fragment content | Security |
| `generateManifest` produces correct checksums for all files | Integrity |
| `generateManifest` sets trust_tier to 'community' regardless of input | Security |
| `generateManifest` uses policy domain field | Domain mapping |
| `generateManifest` generates valid ISO 8601 published_at | Format |
| `writePackArchive` produces a valid zip file | Integration |
| `writePackArchive` uses atomic write (tmp + rename) | Atomicity |
| SHA-256 checksums in manifest match actual file contents | Integrity |

### `flint-mcp/src/tools/__tests__/packExport.test.ts`

| Test Case | Category |
|-----------|----------|
| `handlePackExport` with valid project returns success result | Happy path |
| `handlePackExport` dry_run returns preview without writing zip | dry_run |
| `handlePackExport` rejects invalid pack ID (spaces, uppercase) | Input validation |
| `handlePackExport` rejects invalid semver version | Input validation |
| `handlePackExport` blocks export when policy has validation errors | Gating |
| `handlePackExport` blocks export when secrets detected in fragments | Security |
| `handlePackExport` blocks export when absolute paths detected | Security |
| `handlePackExport` succeeds with empty project (no policy, no agent-policy) | Edge case |
| `handlePackExport` includes customized rules in archive | Content |
| `handlePackExport` respects custom output_path | Configuration |
| `handlePackExport` with missing author name throws | Input validation |

---

## Dependency: `yazl`

Add `yazl` (and its types `@types/yazl`) to `flint-mcp/package.json`:

```json
{
  "dependencies": {
    "yazl": "^2.5.1"
  },
  "devDependencies": {
    "@types/yazl": "^2.4.5"
  }
}
```

`yazl` is a pure-JS, zero-dependency zip writer. It is the standard choice for programmatic zip generation in Node.js when the `archiver` package is too heavy. If adding a dependency is rejected, the implementation agent should use a manual Buffer-based ZIP construction (the pack will contain fewer than 15 small text files, making this feasible).

**Alternative (no new dependency):** Use Node.js `child_process.execSync('zip ...')` -- but this violates cross-platform portability (Windows has no `zip` command). **`yazl` is the recommended approach.**

---

## Risks

| Risk | Severity | Mitigation | Commandment |
|------|----------|------------|-------------|
| Partial zip write on crash leaves corrupted archive | Medium | Atomic write pattern: write to `.tmp`, rename on success, clean up on failure | C12 |
| Secret pattern false positives on legitimate config values | Low | Patterns are conservative (require 8+ char values). Warnings only for ambiguous matches; errors only for high-confidence patterns (AWS keys, private key blocks). `dry_run` lets users preview before committing. | -- |
| `validatePolicy()` rejects a valid-but-unusual policy configuration | Low | GPX.1 includes the raw file content, not the resolved policy. Validation errors are reported to the user but only `error`-severity findings block export. | -- |
| Adding `yazl` dependency increases `flint-mcp` install footprint | Low | `yazl` is 15KB, zero dependencies. Acceptable tradeoff for correctness. | C4 |
| CLAUDE.md fragment injection could be used for prompt injection | Medium | Out of scope for GPX.1 (fragments are bundled, not executed). GPX.2 import wizard will show full preview. For GPX.1 export, fragments are just files. The security scanner catches secrets but does not analyze prompt semantics. | -- |
| Pack ID collisions across uncoordinated teams | Low | GPX.1 is local export only. ID uniqueness enforcement deferred to GPX.3 registry. | -- |

---

## Out of Scope for GPX.1

Per the feature spec, the following are explicitly not part of this phase:

- Import / conflict resolution (GPX.2)
- Registry / discovery (GPX.3)
- Enterprise distribution (GPX.4)
- Glass UI for pack management
- IPC channels
- Store slices
- Skill files (the spec mentions them but GPX.1 focuses on config bundling)
- Design tokens in packs (tokens have their own sync pipeline)
- Pack-bundled UI components

---

## Validation Criteria for Phase 3

The implementation is SHIP-ready when:

1. `npx tsc --noEmit` passes with 0 errors
2. `cd flint-mcp && npm test` passes with all existing + new tests
3. The `flint_pack_export` tool appears in the MCP tool list
4. A dry_run call returns a valid `PackExportDryRunResult` with correct checksums
5. A real export produces a valid `.flint-pack.zip` that can be unzipped and contains a valid `manifest.json`
6. Security scanner correctly blocks packs containing secrets
7. Security scanner correctly blocks packs containing absolute paths
8. Atomic write pattern prevents partial archive writes
