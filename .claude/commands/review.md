# /review — Pre-Commit Code Review Gate

Automated code review using `bridge-code-reviewer` agents. Runs on staged or recent changes, groups files by domain, and produces a structured SHIP/SHIP-WITH-FIXES/BLOCK verdict.

## Usage

Invoke with `/review` before committing. Accepts optional arguments:

- `/review` — Review all uncommitted changes (staged + unstaged)
- `/review staged` — Review only staged changes
- `/review HEAD~1` — Review the last commit
- `/review HEAD~3..HEAD` — Review a range of commits
- `/review security` — Review only security-tagged files

## Behavior

1. **Detect scope**: Identify changed files from git diff (uncommitted or commit range)
2. **Classify domains**: Group files into review domains based on path patterns:
   - `electron/` → **Security + IPC** (high scrutiny — process boundary, secrets, ACLs)
   - `bridge-mcp/src/core/governance/` → **Governance** (SQLite services, scoring, provenance)
   - `bridge-mcp/src/server.ts` → **MCP Surface** (tool registration, input validation)
   - `bridge-mcp/src/tools/` → **MCP Tools** (handler logic, response shapes)
   - `src/components/` → **Glass UI** (React components, Commandment compliance)
   - `src/store/` → **State Management** (cross-store contamination, IPC boundary)
   - `src/core/` → **Core Engine** (AST surgery, linter rules)
3. **Launch parallel reviewers**: One `bridge-code-reviewer` agent per domain (max 3 concurrent)
4. **Aggregate verdicts**: Merge results into a single report

## Review Checklist (injected into each reviewer)

### All domains:
- [ ] No Commandment violations (16 Commandments from CLAUDE.md)
- [ ] Process boundary respected (no Node.js APIs in `src/`)
- [ ] Tests cover happy path + error cases + edge cases
- [ ] TSC passes with 0 errors
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Error handling present and doesn't leak internals

### Security domain (electron/):
- [ ] IPC channels typed in `bridge-api.d.ts`
- [ ] No secrets exposed to renderer
- [ ] Input validation on all IPC handlers
- [ ] ACLs enforced (mcp-policy.ts, agentPolicy.ts)
- [ ] Crypto uses proper primitives (randomBytes, not Math.random)

### Governance domain (bridge-mcp/src/core/governance/):
- [ ] All SQL uses parameterized queries
- [ ] DB constraints enforced at schema level
- [ ] Connection lifecycle managed (open/close, DI pattern)
- [ ] Fire-and-forget pattern for non-blocking recording
- [ ] Pruning/retention policy exists

### MCP Surface (server.ts, tools/):
- [ ] Tool registration follows existing patterns
- [ ] Input schema validated with required/optional fields
- [ ] Error responses structured (not raw exceptions)
- [ ] Response shapes are additive (no breaking changes)

### Glass UI (src/components/, src/store/):
- [ ] No cross-store imports (contamination)
- [ ] No direct `window.bridgeAPI` calls inside stores
- [ ] Tailwind tokens only (no hardcoded hex)
- [ ] Accessibility attributes on interactive elements

## Output Format

The review produces a structured report:

```
## Code Review Report
**Scope:** [description of what was reviewed]
**Files:** N files across M domains

### Domain: [name]
| File | Rating | Issues |
|------|--------|--------|
| path/to/file.ts | PASS | 0 |
| path/to/other.ts | MINOR | 2 |

### Issues Found
1. [SEVERITY] file:line — description
2. ...

### Verdict: SHIP / SHIP-WITH-FIXES / BLOCK
- Critical: N
- Major: N
- Minor: N
```

## Integration with Feature Build Workflow

This command is invoked automatically by `bridge-git-guru` as part of the pre-commit gate in Phase 2 of the Contract-First Feature Build workflow. It runs AFTER TSC + tests pass and BEFORE the commit is created.

Manual invocation is also encouraged at any time during development.

## Implementation

When this command is invoked, follow these steps:

### Step 1: Determine scope

```bash
# If argument is "staged":
git diff --cached --name-only

# If argument is a commit range (e.g., HEAD~3..HEAD):
git diff --name-only <range>

# If argument is "security" or another domain filter:
git diff --name-only | grep -E '<domain-pattern>'

# Default (no args): all uncommitted changes
git diff --name-only HEAD
```

### Step 2: Group files by domain

Apply path-based classification:
- `electron/**` (excluding tests) → Security + IPC domain
- `bridge-mcp/src/core/governance/**` → Governance domain
- `bridge-mcp/src/server.ts`, `bridge-mcp/src/tools/**` → MCP Surface domain
- `src/components/**`, `src/store/**`, `src/hooks/**` → Glass UI domain
- `src/core/**` → Core Engine domain
- `**/__tests__/**`, `**/*.test.*` → Tests (reviewed alongside their source domain)

### Step 3: Launch reviewers

For each domain with changed files, spawn a `bridge-code-reviewer` agent with:
- The file list for that domain
- The domain-specific checklist items from above
- The instruction: "This is a CODE REVIEW — do NOT modify any files. Read and analyze only."
- The output format template

Launch up to 3 reviewers in parallel using the Agent tool with `run_in_background: true`.

### Step 4: Aggregate and report

When all reviewers complete:
1. Merge their verdicts (worst verdict wins: BLOCK > SHIP-WITH-FIXES > SHIP)
2. Combine issue lists
3. Present the unified report to the user
4. If verdict is BLOCK, do NOT proceed with commit

### Step 5: Quick fixes (optional)

If verdict is SHIP-WITH-FIXES and only minor issues:
- Offer to fix them automatically
- Re-run affected tests after fixes
- Update verdict to SHIP if all fixes pass
