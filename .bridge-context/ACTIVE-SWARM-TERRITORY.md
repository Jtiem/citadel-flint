# Active Swarm Territory Map

**Purpose:** Prevents concurrent swarms from creating merge conflicts by claiming file ownership.
**Protocol:** Before editing any file, check this map. If it's claimed, coordinate or wait.

---

## How to use this map

1. **Before starting a new swarm:** Read this file
2. **If your swarm needs a file in the MODIFY list:** Either wait for ACX to finish, or coordinate by adding your changes to a separate section of the file (e.g., append new IPC handlers, don't restructure existing ones)
3. **If your swarm creates new files:** Add them to this map under your own swarm section
4. **When a swarm completes:** Remove its section from this file

---

## Template for new swarm entry

```markdown
## Swarm: Phase [NAME]

**Status:** [CONTRACTS APPROVED / IN PROGRESS / COMPLETE]

### Files to CREATE
| File | Purpose |

### Files to MODIFY
| File | What changes |
```

---

## Swarm: Sprint 2 Security (SEC.1 + SEC.2 + SEC.3 + P0-4)

**Status:** CONTRACTS APPROVED

### Files to CREATE

| File | Purpose | Contract |
|------|---------|----------|
| `electron/mcp-policy.ts` | MCP tool allowlist constant | SEC3 |
| `electron/__tests__/mcp-policy.test.ts` | Allowlist enforcement tests | SEC3 |
| `electron/__tests__/ingestion-secret.test.ts` | Secret hygiene tests | SEC2 |
| `electron/__tests__/main-csp.test.ts` | CSP registration test | SEC1 |

### Files to MODIFY

| File | What changes | Contract |
|------|-------------|----------|
| `src/components/editor/LivePreview.tsx` | Add `sandbox` attr to iframe; add origin check in `handleMessage` | SEC1 |
| `electron/main.ts` | CSP via `session.webRequest` (SEC1); generate per-session secret + pass to ingestion server (SEC2); simplify `figma:status` handler (SEC2); import + enforce MCP allowlist in `mcp:call-tool` (SEC3) | SEC1, SEC2, SEC3 |
| `electron/ingestion-server.ts` | Remove hardcoded secret; accept secret via `startIngestionServer(secret)`; remove secret from `getFigmaStatus()`; remove console.log of secret | SEC2 |
| `electron/preload.ts` | Remove `secret` from `figma.status()` return type | SEC2 |
| `src/types/bridge-api.d.ts` | Remove `secret` from `FigmaStatus` interface | SEC2 |
| `src/components/editor/StatusBar.tsx` | Remove dead `secret`/`secretTruncated` code | SEC2 |
| `src/components/ui/FigmaSetupWizard.tsx` | Remove dead `secret` code | SEC2 |
| `electron/orchestrator.ts` | Add provider guard rejecting non-Anthropic providers; remove OpenAI/Gemini branches | P0-4 |
