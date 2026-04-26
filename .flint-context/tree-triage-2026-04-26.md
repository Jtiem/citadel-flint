# Tree Triage — 2026-04-26

**Working tree at session start:** 149 modified, 35 untracked = **184 entries**.

This document is the priority-0 task carried over from the prior session
(see HANDOFF.md "Tree triage finding — action required next session").
The previous count was 57; the current 184 is partly inherited and partly
new (TSC cleanup ran across the whole repo).

**Rule of engagement:** Do **not** delete anything. When unsure, leave the
file in place and add a `VERIFY-BEFORE-COMMIT.md` note in its directory.

---

## Theme A — TSC strictness sweep (this session, 2026-04-25 → 26)

**Status:** Verified — `npx tsc -b` reports 0 errors with these in place.
**Confidence:** High. Safe to commit as one bundle or per-subgroup.

### A.1 Type infrastructure
- `tsconfig.tests.json` (NEW) — test-only config, relaxes `noUnusedParameters`, keeps `noUnusedLocals`
- `tsconfig.json` — added `tsconfig.tests.json` to project references
- `tsconfig.app.json` — exclude tests so they go through `tsconfig.tests.json`
- `tsconfig.node.json` — minor scope adjustment
- `shared/contract-schema.ts` — `LegacyFlintContract` grandfather types for pre-v2.1 contracts

### A.2 Production type fixes (real bugs, not just satisfying TSC)
- `src/utils/tokenMatcher.ts` — `CATEGORY_TO_TOKEN_TYPE` corrected: `spacing` and `borderRadius` map to `'dimension'` (was using invalid TokenType strings)
- `src/types/flint-api.d.ts` — extended unions: `TokenType` += `'fontSize'`, `SourceAuthority` += `'Section 508'`, `RightTab` += `'notes'`, `ProvenanceInfo` and `FixableItem` got optional fields they were already being used with
- `shared/ipc-validators.ts` — Zod 4 fix (`z.record(z.string(), z.unknown())`) + new `tokens:seed-from-project` schema

### A.3 autoUpdater hardening (security WARN-1 + code WARN-4 from review)
- `electron/autoUpdater.ts` — replaced env-var bypass with `opts?.forceForTesting` parameter; added `app-update.yml` existence check before scheduling network calls
- `electron/__tests__/autoUpdater.test.ts` — switched all 8 tests to pass `{ forceForTesting: true }`

### A.4 Test-file unused-import sweep (~25 files)
After re-tightening `noUnusedLocals` per security WARN-3, swept unused
imports / variables across test files. Each is a one-line edit. Files
in this group span `src/components/**/__tests__/`,
`src/components/ui/__tests__/`, `src/components/ui/governance/__tests__/`,
`src/components/ui/mint/__tests__/`, `src/components/ui/primitives/__tests__/`,
`src/hooks/__tests__/`, `src/store/__tests__/`,
`src/adapters/__tests__/`, `electron/__tests__/`,
`shared/__tests__/`.

### A.5 Triple-cast cleanup (Map setter type widening)
- `.flint-context/contracts/sprint-2-glass-ui-fixes.contract.ts` — widened
  `setDeferReasons` / `setDeferDurations` to
  `Dispatch<SetStateAction<Map<string, string>>>` (was over-narrowed to plain setter)
- `src/components/ui/GovernanceDashboard.tsx` — removed misleading
  `as unknown as Record<...>` casts now that source type is correct

### A.6 Review ceremony artifacts (untracked, NEW)
- `.flint-context/reviews/TSC-CLEANUP-code-review-2026-04-25.md` + `.review.ts`
- `.flint-context/reviews/TSC-CLEANUP-security-review-2026-04-25.md` + `.review.ts`
- `.flint-context/reviews/TSC-CLEANUP-integration-2026-04-25.md`

**Suggested commit:** `chore(tsc): drive baseline 505 → 0 errors with tests-config split + grandfather contracts`
or split A.1–A.3 (real fixes) from A.4 (mechanical sweep).

---

## Theme B — Claude Code PostToolUse audit hook (this session)

**Status:** Verified — hook runs on `.tsx`/`.jsx` Edit/Write, surfaces audit results.
**Confidence:** High. Self-contained.

- `.claude/settings.json` — PostToolUse matcher entry
- `.claude/hooks/` (NEW directory) — `flint-audit-on-edit.sh`

**Suggested commit:** `feat(claude-hooks): wire flint-audit on Edit/Write of .tsx|.jsx`

---

## Theme C — Inherited from prior session (the original "57 files")

**Status:** Modified by a previous session's work; never committed because
the prior agent could not verify each was complete. Some of these became
prerequisites for Theme A (e.g., the `as unknown as Record<...>` strictness
casts), so they are entangled.

**Confidence:** Medium. Each subgroup needs verification (TSC + relevant
test suite) before commit.

### C.1 flint-mcp core strictness fixes
- `flint-mcp/src/core/MithrilLinter.ts`
- `flint-mcp/src/core/policyEngine.ts`
- `flint-mcp/src/core/tailwindConfigLoader.ts`
- `flint-mcp/src/core/tailwindMigrator.ts`
- `flint-mcp/src/core/coverageClassifier.ts`
- `flint-mcp/src/core/darkModeSafety.ts`
- `flint-mcp/src/core/projectContext.ts`
- `flint-mcp/src/core/registryService.ts`
- `flint-mcp/src/core/registryResolver.ts`
- `flint-mcp/src/core/config-loader.ts`
- `flint-mcp/src/core/dashboard/debtReportService.ts`
- `flint-mcp/src/core/governance/dbomService.ts`
- `flint-mcp/src/core/libraryAdapters/muiAdapter.ts`

**Verify:** `cd flint-mcp && npm test` should still pass.

### C.2 Glass component strictness casts + small UX changes
- `src/components/ui/GovernanceDashboard.tsx` (also touched in Theme A)
- `src/components/ui/LaunchScreen.tsx`
- `src/components/ui/TokenManager.tsx`
- `src/components/ui/CommandPalette.tsx`
- `src/components/ui/ComponentPanel.tsx`
- `src/components/ui/ContrastAuditPanel.tsx`
- `src/components/ui/DetectionBanner.tsx`
- `src/components/ui/DetectionPreview.tsx`
- `src/components/ui/ExportModal.tsx`
- `src/components/ui/FileExplorer.tsx`
- `src/components/ui/FixPreviewDrawer.tsx`
- `src/components/ui/GovernancePanel.tsx`
- `src/components/ui/LayerTree.tsx`
- `src/components/ui/TokenGrid.tsx`
- `src/components/ui/governance/ScoreSection.tsx`
- `src/components/ui/mint/ConfirmPushDialog.tsx`
- `src/components/ui/mint/ConfirmResolveDialog.tsx`
- `src/components/ui/mint/EmitDropdown.tsx`
- `src/components/ui/mint/SyncActionCluster.tsx`
- `src/components/editor/CoveragePopover.tsx`
- `src/components/editor/LivePreview.tsx`
- `src/components/editor/XYCanvas.tsx`
- `src/components/ui/_settings-test.tsx` — **unclear if intentional, has _ prefix**

**Verify:** `npm run test:react` should still pass.

### C.3 Editor / hooks / adapters / store
- `src/App.tsx`
- `src/main.tsx`
- `src/hooks/useContrastAudit.ts`
- `src/hooks/useGovernanceFixActions.ts`
- `src/hooks/useIDEFileSync.ts`
- `src/store/canvasStore.ts` (RightTab += `'notes'`)
- `src/store/editorStore.ts`
- `src/lib/autoResume.ts`
- `src/utils/resetOnboarding.ts`
- `src/core/adapters/SvelteAdapter.ts`
- `src/core/adapters/VueAdapter.ts`
- `shared/ast-utils.ts`

### C.4 Beta build / telemetry
- `electron/betaTelemetry.ts`
- `electron/betaTelemetry.test.ts`
- `electron-builder.yml`
- `scripts/build-beta.sh` (NEW, untracked)
- `main-CWA_ercw.js` (NEW, untracked) — **unclear if this is build output that escaped a build dir**

### C.5 Demo project
- `build-resources/demo-project/DemoCard.tsx`
- `build-resources/demo-project/.flint/design-tokens.json` (NEW, untracked)

### C.6 Contract files (prior sessions)
- `.flint-context/contracts/CHRON.1.contract.ts`
- `.flint-context/contracts/MINT.5-phase1.contract.ts`
- `.flint-context/contracts/MINT.5-phase3.contract.ts`
- `docs/contracts/sprint-clarity-2.contract.ts`

### C.7 New IPC tests, untracked
- `electron/__tests__/governance-ipc.test.ts`
- `electron/__tests__/governanceOverridesIpc.test.ts`
- `shared/__tests__/dtcgFlatten.test.ts`

### C.8 Documentation, untracked
- `.flint-context/contracts/UX-P0-contract.md` + `.contract.ts`
- `.flint-context/dead-code-audit-2026-04-25.md`
- `.flint-context/doc-audit-2026-04-24/`
- `.flint-context/playbook-research/`
- `.flint-context/reviews/UX-P0-{code,security,ux}-review-2026-04-21.md` + `.review.ts`
- `.flint-context/sentinel-brief/`
- `.flint-context/test-triage-2026-04-25.md`
- `docs/beta/`
- `docs/legal/`
- `docs/playbook/`
- `docs/strategy/FEATURE-SPEC-{AUTOPILOT,COUNSEL,WCAG22}.md`

### C.9 Build artifacts (do not delete per rule of engagement)
- `dist-web/index.html` (modified)
- `dist-web/assets/index-BradarZT.css` (untracked)
- `dist-web/assets/index-DyewfNiX.js` (untracked)
- `dist-web/assets/web-api-Btn5ts2v.js` (untracked)

These look like the output of a recent web build. They are typically
regenerable (`npm run build:web`) and historically not committed, but
the user has asked we not delete files until verified.

### C.10 HANDOFF.md
Updated continuously through this and the prior session.

---

## Action items

1. **Justin to decide** what to commit and in what groupings.
2. Recommended order:
   - Theme A (this session, fully verified) → safest first commit
   - Theme B (hook wiring, self-contained) → second
   - Theme C subgroups one at a time, with `npm test` between each
3. Files explicitly flagged for verification:
   - `src/components/ui/_settings-test.tsx` — what is this?
   - `main-CWA_ercw.js` (root) — escaped build output?
   - `dist-web/` — regenerate or commit as snapshot?
   - `build-resources/demo-project/.flint/design-tokens.json` — new project token file, intentional?

Once Justin confirms a grouping, run TSC + relevant test suite per group
and commit with conventional-commit messages.
