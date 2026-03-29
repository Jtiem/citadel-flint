# Integration Report: BUILD Remediation (Phases A-D)

## Status: FAIL (1 blocking, 2 warnings)

| Check | Result | Details |
|-------|--------|---------|
| IPC Triangle (loadDemoProject) | PASS | Signature `(demoName?: string)` consistent across all 5 files: flint-api.d.ts, web-api.ts, preload.ts, main.ts, server/index.ts. Payload shape `{ demoName }` matches in all handlers. |
| SessionContext Coherence | PASS | `coldStartHint?: string` present in types.ts (line 269), set conditionally in sessionContext.ts (line 434-437), read in onboard-project.ts (line 49-51). |
| Phantom Tool Names | PASS | `flint_vpat_report`, `flint_platform_export`, `flint_theme_validate`, `flint_consensus_status` removed from workflow-guide.ts and capabilities/index.ts. Only remain in test assertions (correct -- tests verify absence). |
| Demo Directory Structure | PASS | All 4 directories present with all required files. |
| flint-ci Build Chain | PASS | tsconfig.json has outDir:dist, package.json has build script, github-action.ts exists, build-release.yml has `cd flint-ci && npm ci && npm run build` in both job matrices. |
| LaunchScreen Integrity | PASS | All 3 sections present: demoError amber banner (line 346), Figma prerequisite callout (line 479-500), DEMO_PROJECTS gallery strip (line 603-638). No duplicates or conflicts. |
| TSC | PASS | 0 errors |
| Glass Tests | PASS | 1454/1454 passing (78 test files) |
| MCP Tests | FAIL | 1 test file failed, 4109/4109 individual tests passed |

## Issues Found

1. **[BLOCKING]** `flint-mcp/src/__tests__/workflowGuide.test.ts` missing vitest imports -- `ReferenceError: describe is not defined`. The Phase C agent created this test file without `import { describe, it, expect } from 'vitest'`, which is required because `flint-mcp/vitest.config.ts` does not set `globals: true`. Every other test file in flint-mcp imports vitest globals explicitly.

2. **[WARNING]** `onLoadDemo` prop in LaunchScreen.tsx is dead code -- destructured as `_onLoadDemo` and never referenced. The demo gallery strip calls `window.flintAPI.beta?.loadDemoProject(demo.name)` directly instead. App.tsx still wires `onLoadDemo={() => handleLoadDemo()}` but that handler is never invoked. Harmless but confusing for future maintainers.

3. **[WARNING]** `flint_annotate` appears in `electron/agentPolicy.ts` (line 93) and `electron/mcp-policy.ts` (line 40) allowlists but is NOT a registered MCP tool in `server.ts`. This is a pre-existing phantom tool name not introduced by Phases A-D -- it predates this work. Flagged for awareness but not a blocker for this validation.

## Verdict: FIX

### Fix Table

| Issue # | Assigned Agent | Fix Description |
|---------|---------------|----------------|
| 1 | Phase C agent (MCP) | Add `import { describe, it, expect } from 'vitest'` to `flint-mcp/src/__tests__/workflowGuide.test.ts` |

### Test Counts

```
Glass: 1454/1454 passing
MCP:   4109/4109 passing (1 test FILE failed due to missing import, 0 individual test failures)
TSC:   0 errors
```

### Notes

- Phase A infrastructure changes (node22, .nvmrc, engines field, flint-ci build chain, ambient.d.ts) are all coherent.
- Phase B UI changes (LaunchScreen demoError banner, SetupWizard retry/timeout, Figma prerequisite callout) are present and correct.
- Phase C MCP changes (coldStartHint, phantom tool cleanup, onboard-project prompt) are functionally correct but the test file has a missing import.
- Phase D demo projects (4 directories, 20 files, server/cli.ts --demo flag, VALID_DEMO_NAMES guard) are complete and consistent.
- The IPC triangle for `loadDemoProject` is fully symmetric across Electron, web adapter, and type definitions.
