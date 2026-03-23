# GPX.2 — Governance Pack Import + Conflict Resolution

**Phase:** GPX.2
**Priority:** P1
**Effort:** M
**Dependencies:** GPX.1 (BACKLOG — pack format + export), D.1 (ONLINE — undo/rollback)
**Status:** CONTRACT APPROVED
**Date:** 2026-03-21
**Author:** flint-architect

---

## 1. Impact Map

Every file to create or modify. Agent assignments determine parallelism groups.

### Files to CREATE

| File | Purpose | Owner Agent |
|------|---------|-------------|
| `flint-mcp/src/core/packImportService.ts` | Core import engine: unzip, validate manifest, conflict detection, merge, snapshot, rollback | `flint-ast-surgeon` |
| `flint-mcp/src/tools/packImport.ts` | `flint_pack_import` MCP tool handler + `flint_pack_rollback` handler + tool definitions | `flint-ast-surgeon` |
| `flint-mcp/src/core/packImportService.test.ts` | Unit tests for the import service (conflict detection, merge strategies, snapshot/rollback) | `flint-test-writer` |
| `flint-mcp/src/tools/__tests__/packImport.test.ts` | Integration tests for MCP tool handlers | `flint-test-writer` |

### Files to MODIFY

| File | Change | Owner Agent |
|------|--------|-------------|
| `flint-mcp/src/server.ts` | Import tool definitions + handler routing for `flint_pack_import` and `flint_pack_rollback` | `flint-ast-surgeon` |
| `flint-mcp/src/core/governance/types.ts` | Add `PackConflict`, `ConflictResolution`, `MergeStrategy`, `PackImportResult`, `PackSnapshot`, `PackManifest` types | `flint-state-architect` |
| `flint-mcp/src/core/policyEngine.ts` | Export `coerceToResolved` as a public function for merge operations (currently private) | `flint-ast-surgeon` |

---

## 2. Type Contracts

All cross-boundary types. These are the binding specification that Phase 2 agents implement against.

### 2.1 Pack Manifest (read from pack archive)

```typescript
/**
 * Canonical manifest.json schema inside a .flint-pack/ bundle.
 * This type is for deserialization — the pack author writes raw JSON,
 * Flint validates it into this shape.
 */
export interface PackManifest {
    schema_version: number                      // Must be 1
    id: string                                  // Lowercase slug, hyphens only
    name: string                                // Human-readable display name
    version: string                             // Semver
    description: string
    author: {
        name: string
        email?: string
        org?: string
    }
    trust_tier: 'community' | 'verified' | 'official'
    domain: GovernanceDomain                    // From policyEngine.ts
    stack_tags: string[]
    compatibility: {
        flint_min_version: string               // Semver floor
        flint_max_version: string | null         // Null = no ceiling
    }
    dependencies: string[]                      // Other pack IDs required first
    contents: {
        policy: boolean
        agent_policy: boolean
        rules: string[]                         // Rule IDs (e.g. 'MITHRIL-COL')
        skills: string[]                        // Skill filenames
        claude_fragments: string[]              // Relative paths under claude-fragments/
    }
    checksum: string                            // "sha256:<hex>"
    published_at: string                        // ISO 8601 UTC
    registry_url?: string                       // Absent for local packs
}
```

### 2.2 Merge Strategy

```typescript
/**
 * User-selected strategy for resolving conflicts during pack import.
 */
export type MergeStrategy = 'override' | 'skip-conflicts' | 'interactive'
```

### 2.3 Pack Conflict

```typescript
/**
 * Describes a single conflict detected between the incoming pack
 * and the active project's existing configuration.
 */
export type ConflictDomain =
    | 'policy_value'      // e.g. deltaE_threshold differs
    | 'rule_mode'         // e.g. MITHRIL-COL: 'blocking' vs 'advisory'
    | 'agent_id'          // e.g. agent already registered with different tier
    | 'fragment_file'     // e.g. .claude/agents/sentinel.md already exists

export interface PackConflict {
    /** Machine-readable conflict domain. */
    domain: ConflictDomain
    /** Human-readable key path (e.g. 'mithril.deltaE_threshold', 'agent:hipaa-sentinel'). */
    key: string
    /** The value currently in the project. */
    currentValue: unknown
    /** The value the pack wants to set. */
    incomingValue: unknown
    /** Human-readable description of the conflict. */
    message: string
    /** Severity hint for UI rendering. */
    severity: 'blocking' | 'advisory'
}
```

### 2.4 Conflict Resolution (for interactive mode)

```typescript
/**
 * A single user resolution for an interactive-mode conflict.
 * Passed back to the import engine after the user has reviewed conflicts.
 */
export interface ConflictResolution {
    /** The conflict key (matches PackConflict.key). */
    key: string
    /** User decision: accept the pack value, keep the project value, or provide a custom value. */
    action: 'accept_incoming' | 'keep_current' | 'custom'
    /** Custom value, required when action is 'custom'. */
    customValue?: unknown
}
```

### 2.5 Pack Snapshot (for rollback)

```typescript
/**
 * Records a pre-import snapshot of the .flint/ directory.
 * Stored in .flint/pack-snapshots/<timestamp>/ as a directory copy.
 */
export interface PackSnapshot {
    /** UUID for this snapshot. */
    id: string
    /** Pack ID that triggered this snapshot. */
    packId: string
    /** Pack version. */
    packVersion: string
    /** ISO 8601 timestamp when the snapshot was taken. */
    createdAt: string
    /** Absolute path to the snapshot directory. */
    snapshotPath: string
    /** Files that were backed up (relative to .flint/). */
    backedUpFiles: string[]
    /** Provenance mutation_id recorded for this import event. */
    provenanceMutationId: string
}
```

### 2.6 Pack Import Result

```typescript
/**
 * Result returned by the pack import engine and surfaced by the MCP tool.
 */
export interface PackImportResult {
    /** Whether the import completed successfully. */
    success: boolean
    /** The pack manifest that was imported. */
    manifest: PackManifest
    /** Merge strategy used. */
    strategy: MergeStrategy
    /** Conflicts detected. Empty when no conflicts exist. */
    conflicts: PackConflict[]
    /** Conflicts that were skipped (for 'skip-conflicts' strategy). */
    skippedConflicts: PackConflict[]
    /** Conflicts resolved (for 'interactive' strategy). */
    resolvedConflicts: ConflictResolution[]
    /** Files written to the project. */
    filesWritten: string[]
    /** Snapshot ID for rollback. Null if import did not proceed. */
    snapshotId: string | null
    /** Error message, if import failed. */
    error?: string
    /** Human-readable summary. */
    summary: string
}
```

### 2.7 Pack Rollback Result

```typescript
export interface PackRollbackResult {
    /** Whether rollback succeeded. */
    success: boolean
    /** Snapshot that was restored. */
    snapshotId: string
    /** Files restored. */
    filesRestored: string[]
    /** Error message, if rollback failed. */
    error?: string
    /** Human-readable summary. */
    summary: string
}
```

---

## 3. MCP Tools

### 3.1 `flint_pack_import`

| Field | Value |
|-------|-------|
| Name | `flint_pack_import` |
| Direction | MCP client -> MCP server |
| Registration | `flint-mcp/src/server.ts` via `FLINT_PACK_IMPORT_TOOL` constant |

**Input Schema:**

```typescript
{
    type: 'object',
    properties: {
        source: {
            type: 'string',
            description: 'Path to a .flint-pack.zip archive or an unpacked .flint-pack/ directory.'
        },
        projectRoot: {
            type: 'string',
            description: 'Absolute path to the target project root.'
        },
        strategy: {
            type: 'string',
            enum: ['override', 'skip-conflicts', 'interactive'],
            description: 'Merge strategy for resolving conflicts. Default: skip-conflicts.'
        },
        resolutions: {
            type: 'array',
            description: 'Array of ConflictResolution objects. Required when strategy is interactive and conflicts were previously returned.',
            items: {
                type: 'object',
                properties: {
                    key: { type: 'string' },
                    action: { type: 'string', enum: ['accept_incoming', 'keep_current', 'custom'] },
                    customValue: {}
                },
                required: ['key', 'action']
            }
        },
        dry_run: {
            type: 'boolean',
            description: 'When true, reports conflicts and planned changes without writing files. Default: false.'
        }
    },
    required: ['source', 'projectRoot']
}
```

**Handler behavior:**

1. Validate `source` exists (file or directory)
2. If zip: extract to temp directory
3. Read and validate `manifest.json` (schema, checksum, compatibility)
4. Run conflict detection pipeline (section 4)
5. If `dry_run`: return `PackImportResult` with conflicts and planned changes, `success: false`
6. If `strategy === 'interactive'` and conflicts exist and no `resolutions` provided: return conflicts for user resolution, `success: false`
7. If `strategy === 'interactive'` and `resolutions` provided: apply resolutions
8. Snapshot current `.flint/` directory (section 6)
9. Execute merge engine (section 5)
10. Record provenance (section 7)
11. Return `PackImportResult` with `success: true`

**Return type:** `PackImportResult` (wrapped in MCP content block)

### 3.2 `flint_pack_rollback`

| Field | Value |
|-------|-------|
| Name | `flint_pack_rollback` |
| Direction | MCP client -> MCP server |
| Registration | `flint-mcp/src/server.ts` via `FLINT_PACK_ROLLBACK_TOOL` constant |

**Input Schema:**

```typescript
{
    type: 'object',
    properties: {
        snapshotId: {
            type: 'string',
            description: 'UUID of the snapshot to restore. Use the snapshotId from the import result.'
        },
        projectRoot: {
            type: 'string',
            description: 'Absolute path to the target project root.'
        }
    },
    required: ['snapshotId', 'projectRoot']
}
```

**Handler behavior:**

1. Read snapshot index at `.flint/pack-snapshots/index.json`
2. Locate snapshot directory by `snapshotId`
3. Verify snapshot directory exists and is not corrupted
4. Copy all files from snapshot directory back to `.flint/`, overwriting current files
5. Remove files that were added by the import but did not exist in the snapshot
6. Record rollback provenance
7. Return `PackRollbackResult`

**Return type:** `PackRollbackResult` (wrapped in MCP content block)

---

## 4. Conflict Detection Pipeline

Step-by-step pipeline that runs before any files are written.

### Step 1: Unpack

- If `source` is a `.zip` file: extract to a temporary directory using Node.js `zlib` + `tar` (or `adm-zip` if a dependency is acceptable; prefer `node:zlib` for zero-dep)
- If `source` is a directory: read directly
- Validate that `manifest.json` exists at root

### Step 2: Parse Manifest

- Read `manifest.json` and validate against `PackManifest` interface
- Validate `schema_version === 1`
- Validate `id` format: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/`
- Validate `version` is valid semver
- Validate `domain` is a valid `GovernanceDomain`
- Validate `compatibility.flint_min_version` against current Flint version
- If `compatibility.flint_max_version` is set, validate current version is below it

### Step 3: Validate Checksum

- Compute SHA-256 of all non-manifest files in the bundle, sorted by relative path
- Compare against `manifest.checksum` field
- If mismatch: return error, do not proceed

### Step 4: Validate Pack Contents

- If `contents.policy === true`: validate `policy.json` via `validatePolicy()` from `policyEngine.ts`
- If `contents.agent_policy === true`: validate `agent-policy.json` conforms to `AgentPolicyFile` shape
- Validate no absolute paths in any file (scan all text files for patterns: `/^\/[a-zA-Z]|^[A-Z]:\\/`)
- Validate no secrets in `claude-fragments/` files (scan for API key patterns: `/(?:sk-|api[_-]?key|ANTHROPIC|OPENAI|AWS_SECRET|password\s*[:=])/i`)

### Step 5: Read Current Project State

- Load current policy: `loadPolicy(projectRoot)` from `policyEngine.ts`
- Load current agent policy: read `.flint/agent-policy.json` if exists, parse as `AgentPolicyFile`
- Inventory current `.claude/` fragment files (relative paths)
- Inventory current `.flint/rules/` custom rule files

### Step 6: Compare and Generate Conflict List

For each artifact type:

**Policy conflicts** (`contents.policy === true`):
- Compare `mithril.deltaE_threshold` — conflict if values differ
- Compare `mithril.deltaE_critical_threshold` — conflict if values differ
- Compare `mithril.mode` — conflict if values differ
- Compare `a11y.level` — conflict if values differ
- Compare `a11y.mode` — conflict if values differ
- Compare `exportGate.severity_floor` — conflict if values differ
- Compare `exportGate.block_on_overrides` — conflict if values differ
- Compare `domain` — conflict if values differ (severity: blocking)

**Rule mode conflicts** (`contents.rules` array):
- For each rule ID in the pack's `contents.rules`:
  - Check if the project's policy has a per-rule override for this rule
  - If yes and modes differ: conflict

**Agent ID conflicts** (`contents.agent_policy === true`):
- For each agent in the pack's `agent-policy.json`:
  - Check if the project already has an agent with the same `agentId`
  - If yes and tier differs: conflict
  - If yes and allowedTools/deniedTools differ: conflict

**Fragment file conflicts** (`contents.claude_fragments` array):
- For each fragment path in the pack:
  - Check if `.claude/<fragment_path>` already exists in the project
  - If yes: read both files, compare content
  - If content differs: conflict

**Trust tier constraint check:**
- If pack `trust_tier === 'community'`:
  - Any agent in the pack requesting tier `elevated` or `admin`: conflict (blocking)
  - Message: "Community packs cannot grant elevated/admin agent tiers"

Return: `PackConflict[]`

---

## 5. Merge Engine

How each merge strategy operates for each artifact type.

### 5.1 Strategy: `override`

Pack values win everywhere. For each artifact type:

| Artifact | Behavior |
|----------|----------|
| `policy.json` | Deep-merge pack policy into project policy. Pack values overwrite on conflict. Use `coerceToResolved()` on the merged result to normalize. Serialize back via `writePolicy()`. |
| `agent-policy.json` | For each pack agent: call `registerAgent()` with the pack's tier and overrides, replacing any existing entry. Write merged `AgentPolicyFile` to disk. |
| `rules/*.json` | Copy pack rule files into `.flint/rules/`, overwriting existing files with same names. |
| `claude-fragments/**` | Copy pack fragment files into `.claude/`, overwriting existing files at the same paths. |
| `skills/**` | Copy pack skill files into `.flint/skills/`, overwriting existing files. |

### 5.2 Strategy: `skip-conflicts`

Non-conflicting values are applied. Conflicting values are skipped and logged.

| Artifact | Behavior |
|----------|----------|
| `policy.json` | Deep-merge pack policy into project policy. For each field that conflicts: keep project value, add to `skippedConflicts`. Non-conflicting fields from the pack are applied. |
| `agent-policy.json` | For new agents (not in project): register via `registerAgent()`. For existing agents with conflicts: skip, add to `skippedConflicts`. |
| `rules/*.json` | Copy only rule files that do not already exist in `.flint/rules/`. Skip existing files. |
| `claude-fragments/**` | Copy only fragments that do not already exist in `.claude/`. Skip existing files. |
| `skills/**` | Copy only skill files that do not already exist in `.flint/skills/`. Skip existing files. |

### 5.3 Strategy: `interactive`

Two-phase process:

**Phase A (first call):** Run conflict detection only. Return `PackImportResult` with `success: false`, `conflicts: [...]`, and no files written. The caller (Glass wizard or MCP client) presents the conflicts to the user.

**Phase B (second call):** Caller passes `resolutions: ConflictResolution[]`. For each resolution:
- `accept_incoming`: apply the pack value
- `keep_current`: skip, keep project value
- `custom`: apply the user-provided `customValue`

Non-conflicting values are always applied (same as `skip-conflicts` for non-conflicting fields).

### 5.4 Policy Merge Implementation

The merge must use `policyEngine.ts` primitives:

```
1. packPolicy = validatePolicy(packPolicyJson)  // validate incoming
2. projectPolicy = loadPolicy(projectRoot)        // load current
3. mergedRaw = deepMerge(projectPolicy, packPolicy, strategy, resolutions)
4. resolvedMerged = coerceToResolved(mergedRaw)   // normalize to v2
5. writePolicy(projectRoot, resolvedMerged)        // write atomically
```

`coerceToResolved` must be exported from `policyEngine.ts` as a public function. Currently it is a private function — the contract requires this change.

### 5.5 Agent Policy Merge Implementation

```
1. packAgentPolicy = JSON.parse(packAgentPolicyJson) as AgentPolicyFile
2. projectAgentPolicy = readAgentPolicyFile(projectRoot) // read .flint/agent-policy.json
3. For each agent in packAgentPolicy.agents:
   a. If agent exists in project AND conflict AND strategy resolves to "skip": skip
   b. If agent exists in project AND conflict AND strategy resolves to "apply": overwrite entry
   c. If agent does NOT exist in project: add entry
   d. Trust tier cap: if pack trust_tier === 'community', cap agent tier at 'standard'
4. Write merged AgentPolicyFile to .flint/agent-policy.json
```

### 5.6 File Copy Behavior

All file copies (rules, fragments, skills) use synchronous `fs.copyFileSync` within a try/catch. Errors on individual file copies do not abort the entire import — they are collected and reported in the result. The `.flint/` directory structure is created recursively as needed.

---

## 6. Snapshot + Rollback

### 6.1 Snapshot Creation

Before any files are modified during import:

1. Generate a UUID for the snapshot
2. Create directory: `.flint/pack-snapshots/<uuid>/`
3. Copy the following files from `.flint/` into the snapshot directory:
   - `policy.json` (if exists)
   - `agent-policy.json` (if exists)
   - `rules/` directory (recursive, if exists)
   - `skills/` directory (recursive, if exists)
4. Copy the following from the project root into the snapshot directory:
   - `.claude/agents/` (if exists)
   - `.claude/workflows/` (if exists)
5. Write `snapshot-meta.json` into the snapshot directory with `PackSnapshot` data
6. Update `.flint/pack-snapshots/index.json` (append to array)

**index.json schema:**

```typescript
interface PackSnapshotIndex {
    snapshots: PackSnapshot[]
}
```

Maximum 10 snapshots retained. When creating the 11th, delete the oldest snapshot directory and remove its entry from the index.

### 6.2 Rollback Execution

1. Read `.flint/pack-snapshots/index.json`
2. Find snapshot entry by `snapshotId`
3. If not found: return error
4. For each file in `snapshot.backedUpFiles`:
   - Copy from `<snapshotPath>/<relativePath>` to `.flint/<relativePath>` (or `.claude/<relativePath>` for fragments)
5. Identify files that were added by the import (files in `.flint/` that are NOT in `snapshot.backedUpFiles`):
   - Compare current `.flint/` file list against `snapshot.backedUpFiles`
   - Delete files that were added by the import
6. Record rollback provenance (section 7)
7. Remove the used snapshot from the index (a snapshot can only be rolled back once)
8. Return `PackRollbackResult`

### 6.3 Storage Location

```
.flint/
  pack-snapshots/
    index.json                    # Snapshot registry
    <uuid-1>/
      snapshot-meta.json          # PackSnapshot metadata
      policy.json                 # Backed up policy
      agent-policy.json           # Backed up agent policy
      rules/                     # Backed up rule overrides
      claude-agents/             # Backed up .claude/agents/ fragments
      claude-workflows/          # Backed up .claude/workflows/ fragments
    <uuid-2>/
      ...
```

---

## 7. Provenance Integration

Every pack import and rollback event is recorded in the mutation provenance ledger using the existing `MutationProvenanceService`.

### 7.1 Import Event

```typescript
provenanceService.recordProvenance(
    mutationId,                          // UUID
    'import' as ProvenanceSource,        // source type
    `pack:${manifest.id}`,              // agentId: "pack:<pack-id>"
    sessionId,                           // current session
    `Imported governance pack "${manifest.name}" v${manifest.version} ` +
        `(strategy: ${strategy}, conflicts: ${conflicts.length})`,  // reasoning
    1.0,                                 // confidence: always 1.0 for imports
)
```

### 7.2 Rollback Event

```typescript
provenanceService.recordProvenance(
    mutationId,                          // UUID
    'import' as ProvenanceSource,        // source type — reuse 'import' for rollback
    `pack-rollback:${snapshot.packId}`,  // agentId
    sessionId,
    `Rolled back governance pack "${snapshot.packId}" v${snapshot.packVersion} ` +
        `to pre-import snapshot`,        // reasoning
    1.0,
)
```

The `'import'` provenance source already exists in the `ProvenanceSource` type. No schema change needed.

---

## 8. Commandment Compliance

| # | Commandment | Applies? | How satisfied |
|---|-------------|----------|---------------|
| 1 | Code is Truth | No | GPX.2 modifies `.flint/` config files, not `.tsx` source. Config changes are persisted to JSON on disk. |
| 2 | No Hallucinated Styling | No | No visual edits. |
| 3 | Composite IDs for Arrays | No | No JSX rendering. |
| 4 | Local-First Only | **Yes** | Pack import reads from local file path only. No network calls. (HTTPS/registry deferred to GPX.3.) |
| 5 | Accessibility is a Compiler Error | No | No a11y changes in this phase (pack may change a11y *policy*, but not a11y *rules*). |
| 6 | The Gatekeeper Rule | **Yes** | Pack import does not bypass the export gate. If a pack changes policy to less strict, the user explicitly chose that. |
| 7 | ID Preservation | No | No AST mutations. |
| 8 | Audit-First Execution | No | Not an AI orchestrator operation. |
| 9 | CIEDE2000 Delta-E | No | Pack may change deltaE_threshold policy value, but this is a policy config, not a lint operation. |
| 10 | Targeted Micro-Recovery | **Yes** | Rollback uses snapshot-based full restoration, not incremental undo. Pre-flight check: verify snapshot directory exists and index entry is valid before executing. |
| 11 | Surgical Git Transplants | No | Not git-based. |
| 12 | Atomic Queuing | **Yes** | Pack import snapshots before writing. Policy writes use `writePolicy()`. Agent policy writes use atomic JSON serialization. Individual file copy failures do not corrupt the import. |
| 13 | Deterministic Surgery | **Yes** | Policy merge uses `validatePolicy()` + `coerceToResolved()` — structured object manipulation, not string/regex. |
| 14 | Bypass Prohibition | **Yes** | Policy files use `writePolicy()` from `policyLoader.ts`. File copies use `fs.copyFileSync` (acceptable for config files; Commandment 14 scopes `FileTransactionManager` to source code mutations, and `policyLoader.ts` already uses direct `fs.writeFileSync`). |
| 15 | Granular AST Tools Only | No | No AST tool calls. |
| 16 | In-Memory Validation | **Yes** | Pack policy validated via `validatePolicy()` before merge. Agent policy validated against `AgentPolicyFile` shape before merge. Checksum verified before import. |

---

## 9. Implementation Order

### Group 1 — Types (must complete first)

| Step | File | Agent | Blocks |
|------|------|-------|--------|
| 1.1 | `flint-mcp/src/core/governance/types.ts` — add `PackManifest`, `MergeStrategy`, `ConflictDomain`, `PackConflict`, `ConflictResolution`, `PackSnapshot`, `PackImportResult`, `PackRollbackResult` | `flint-state-architect` | 1.2, 1.3 |
| 1.2 | `flint-mcp/src/core/policyEngine.ts` — export `coerceToResolved` as public | `flint-ast-surgeon` | 1.3 |

### Group 2 — Core Service (after Group 1)

| Step | File | Agent | Blocks |
|------|------|-------|--------|
| 2.1 | `flint-mcp/src/core/packImportService.ts` — full import engine implementation | `flint-ast-surgeon` | 2.2, 3.1 |

### Group 3 — Tool Handler + Registration (after Group 2)

| Step | File | Agent | Blocks |
|------|------|-------|--------|
| 3.1 | `flint-mcp/src/tools/packImport.ts` — tool definitions + handlers | `flint-ast-surgeon` | 3.2 |
| 3.2 | `flint-mcp/src/server.ts` — register both tools in ListTools + CallToolRequest | `flint-ast-surgeon` | 4.1 |

### Group 4 — Tests (after Group 3)

| Step | File | Agent | Can parallelize? |
|------|------|-------|-------------------|
| 4.1 | `flint-mcp/src/core/packImportService.test.ts` | `flint-test-writer` | Parallel with 4.2 |
| 4.2 | `flint-mcp/src/tools/__tests__/packImport.test.ts` | `flint-test-writer` | Parallel with 4.1 |

### Parallelism Summary

```
Group 1 (types) ──> Group 2 (service) ──> Group 3 (tool + registration) ──> Group 4 (tests)
  [1.1, 1.2]           [2.1]                  [3.1, 3.2]                      [4.1 || 4.2]
```

Groups 1 and 2 are sequential. Group 3 is sequential (tool before registration). Group 4 tests can run in parallel.

---

## 10. Test Plan

### 10.1 `packImportService.test.ts` — Core Service Tests

**Manifest validation:**
- Valid manifest passes validation
- Missing `schema_version` fails
- Invalid `id` format (uppercase, spaces) fails
- Invalid semver `version` fails
- Invalid `domain` fails
- Incompatible `flint_min_version` fails
- Checksum mismatch fails

**Content validation:**
- Absolute path detection in pack files
- Secret pattern detection in claude-fragments
- Invalid policy.json in pack fails `validatePolicy()`
- Invalid agent-policy.json shape fails

**Conflict detection:**
- No conflicts when project has default policy and pack is compatible
- Policy value conflict detected: `deltaE_threshold` differs
- Policy value conflict detected: `a11y.level` differs (AA vs AAA)
- Policy value conflict detected: `domain` differs (blocking severity)
- Rule mode conflict detected: same rule ID, different modes
- Agent ID conflict detected: same agentId, different tier
- Fragment file conflict detected: file exists with different content
- Trust tier cap: community pack requesting elevated agent → blocking conflict
- No conflict when fragment file exists with identical content

**Merge — override strategy:**
- Pack policy values overwrite project policy
- Pack agents replace existing agents
- Pack rule files overwrite existing rule files
- Pack fragments overwrite existing fragments

**Merge — skip-conflicts strategy:**
- Non-conflicting values applied
- Conflicting values skipped (project values retained)
- `skippedConflicts` array populated correctly
- New agents added, conflicting agents skipped
- New fragments copied, existing fragments skipped

**Merge — interactive strategy (phase A):**
- Returns conflicts without writing files
- `success` is `false`
- `conflicts` array is populated

**Merge — interactive strategy (phase B):**
- `accept_incoming` resolution applies pack value
- `keep_current` resolution keeps project value
- `custom` resolution applies custom value
- Missing resolution for a conflict → error

**Snapshot:**
- Snapshot directory created with correct files
- `index.json` updated with new entry
- 11th snapshot prunes oldest
- Snapshot contains correct backed-up files

**Rollback:**
- Files restored from snapshot to `.flint/`
- Files added by import are deleted
- Snapshot entry removed from index after use
- Rollback with invalid snapshotId returns error
- Rollback with deleted snapshot directory returns error

**Dry run:**
- No files written to disk
- Conflicts detected and returned
- Planned changes listed

**Edge cases:**
- Empty pack (no policy, no agents, no fragments) succeeds as no-op
- Pack with only fragments (no policy) merges correctly
- Project with no `.flint/` directory (greenfield) — directory created
- Pack directory (not zip) as source

### 10.2 `packImport.test.ts` — MCP Tool Handler Tests

- `flint_pack_import` with valid source returns success
- `flint_pack_import` with missing `source` param returns error
- `flint_pack_import` with nonexistent source path returns error
- `flint_pack_import` with `dry_run: true` returns conflicts without writing
- `flint_pack_import` with `strategy: 'interactive'` returns conflicts first
- `flint_pack_import` with `strategy: 'interactive'` + resolutions writes files
- `flint_pack_rollback` with valid snapshotId restores files
- `flint_pack_rollback` with invalid snapshotId returns error
- Provenance recorded after successful import
- Provenance recorded after successful rollback

### 10.3 Expected Test Count

Target: ~50 new tests across both test files.

### 10.4 Acceptance Gate

```
MCP:   XXXX/XXXX passing (50+ new)
Glass: 983/983 passing (0 new — no Glass changes in this phase)
Core:  966/966 passing (0 new)
TSC:   0 errors
```

---

## 11. Risks

| Risk | Commandment Threatened | Mitigation |
|------|----------------------|------------|
| Pack contains malicious claude-fragment that modifies agent behavior | Commandment 16 (validation) | Secret scan + absolute path scan before import. Fragment preview in Glass wizard (GPX.2 Glass scope). Trust tier caps agent escalation. |
| Checksum verification bypassed for directory-source imports | Commandment 16 | Skip checksum verification for unpacked directory sources (they are local, user-controlled). Only enforce for `.zip` archives. |
| Snapshot directory fills disk over time | Commandment 12 (atomic queuing) | Maximum 10 snapshots retained. Oldest pruned on overflow. |
| `coerceToResolved` export introduces breaking change | Commandment 13 | Function is already pure and stateless. Exporting it does not change its behavior. No callers affected. |
| Policy merge produces invalid state | Commandment 16 | After merge, run `validatePolicy()` on the merged result. If invalid, abort import and return error. |
| Race condition: two concurrent imports to same project | Commandment 12 | MCP server is single-threaded (stdio transport). Concurrent imports are impossible in the current architecture. If PowerSync (C.1) enables concurrent MCP sessions in the future, a file lock on `.flint/pack-snapshots/index.json` will be needed. |

---

## 12. Glass Import Wizard (Deferred Scope)

The Glass import wizard UI is documented in the GPX.2 spec (lines 253-263) but is deferred to a follow-up contract. The MCP tools (`flint_pack_import` with `strategy: 'interactive'`) provide the full conflict resolution capability via the two-phase interactive flow, which the Glass wizard will consume when built.

**When the Glass wizard is built, it will need:**
- A new IPC channel: `flint:pack-import` (invokes `flint_pack_import` via `mcpClient.ts`)
- A new IPC channel: `flint:pack-rollback` (invokes `flint_pack_rollback` via `mcpClient.ts`)
- A new modal component: `PackImportWizard.tsx` (pattern: `ExportModal.tsx`)
- A new Zustand store or state slice is NOT needed — the wizard is a transient modal that holds local React state during the import flow
- Toast notification after import with "Undo import" action wired to rollback

These Glass items will be specified in a separate `GPX.2-glass-contract.md` when the MCP engine scope is validated.

---

## 13. Dependency: GPX.1 (Pack Format + Export)

GPX.2 depends on GPX.1 for the pack format definition. However, the GPX.1 *export tool* does not need to be built first. GPX.2 can be implemented and tested using hand-crafted test fixtures (manually created `.flint-pack/` directories and `.zip` archives). The `PackManifest` type defined in this contract IS the format definition that GPX.1 will also use.

If GPX.1 is built first, this contract's `PackManifest` type must be used as-is (or GPX.1's contract must be updated to match). The type is defined in `governance/types.ts` and shared by both phases.

---

## 14. Files NOT Modified

These files are explicitly out of scope for GPX.2:

- `electron/main.ts` — no new IPC channels (MCP-only phase)
- `electron/preload.ts` — no new IPC channels
- `src/` (any file) — no Glass UI changes
- `electron/agentPolicy.ts` — existing `registerAgent()` and `resetAgentRegistry()` APIs are sufficient; no modifications needed
- `electron/FileTransactionManager.ts` — config file writes use `policyLoader.writePolicy()` pattern, not FTM
