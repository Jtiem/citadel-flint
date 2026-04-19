/**
 * FORGE.1 — Machine-readable code review report (Round 2, post fix-forward)
 *
 * Sibling to FORGE.1-code-review-2026-04-19-round2.md.
 * All Round 1 findings (1 BLK + 3 WARN + 2 SUG) verified resolved.
 * Verdict is derived from finding severity counts via deriveVerdict().
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  // No open findings in round 2 scope.
  // Round 1's 6 findings are all resolved; verification detail lives in the
  // sibling .md and in the per-finding evidence below (kept here as historical
  // record, status='accepted' reflects user-direction follow-through).
  {
    id: 'BLK-1-RESOLVED',
    title: 'Round 1 BLK-1: projectSmartOpen.test.ts placeholders converted to real assertions',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'accepted',
    evidence: [
      {
        file: 'electron/__tests__/projectSmartOpen.test.ts',
        line: 196,
        excerpt: "expect(correct).toBeGreaterThanOrEqual(19); expect(correct).toBe(20);",
        note: 'Heuristic fixture matrix locks smart-open-routing-precision >= 0.95 invariant.',
      },
      {
        file: 'electron/__tests__/projectSmartOpen.test.ts',
        line: 270,
        excerpt: "projectAutoConfigureSchema.parse({ overrides: { componentLibrary: 'mui' } })",
        note: 'Validator-coverage-project-channels invariant — all 6 channels covered, including projectCreateScratchpadSchema.',
      },
      {
        file: 'electron/__tests__/projectSmartOpen.test.ts',
        line: 304,
        excerpt: 'detectProjectEnvironment runs on real base-vite-tailwind fixture, asserts framework.name === "react"',
        note: 'detection-coverage-existing-code Sprint 1 floor (>= 0.10) measured.',
      },
    ],
    rationale: '40 real assertions across 9 describe blocks; zero remaining it.todo. Includes deliberate-breakage probes for SEC-HIGH-1 (slug traversal) and SEC-HIGH-2 (symlink attack) following the COUNSEL.1 RED/GREEN pattern.',
    observed: 'grep -c "it.todo" returns 0; grep -c "it(" returns 40.',
    proposedFix: 'Closed.',
  },
  {
    id: 'WARN-1-RESOLVED',
    title: 'Round 1 WARN-1 (CONS-1): createScratchpad libraryDefault wired end-to-end',
    severity: 'suggestion',
    scope: 'cross-file',
    status: 'accepted',
    evidence: [
      { file: 'src/components/ui/LaunchScreen.tsx', line: 247, excerpt: "await window.flintAPI.project.createScratchpad({ libraryDefault: 'mui' });" },
      { file: 'shared/ipc-validators.ts', line: 486, excerpt: 'projectCreateScratchpadSchema = z.union([z.undefined(), z.object({ libraryDefault: z.string()...}).strict()])' },
      { file: 'electron/preload.ts', line: 508, excerpt: 'createScratchpad: (payload?: { libraryDefault?: string }) => ipcRenderer.invoke(\'project:create-scratchpad\', payload)' },
      { file: 'electron/main.ts', line: 1918, excerpt: 'ipcMain.handle(\'project:create-scratchpad\', async (_e, payload?: unknown)' },
      { file: 'electron/main.ts', line: 1957, excerpt: 'if (libraryDefault) { ... componentLibrary: { name: libraryDefault, version: \'latest\' } ... }' },
    ],
    rationale: 'Renderer → preload → Zod → main handler all carry the libraryDefault. Handler persists componentLibrary + componentLibraryLabel into detected-environment.json so the subsequent auto-configure call picks up MUI as the from-idea default.',
    observed: 'Type-checked end-to-end; surface declared in src/types/flint-api.d.ts:535.',
    proposedFix: 'Closed.',
  },
  {
    id: 'WARN-2-RESOLVED',
    title: 'Round 1 WARN-2 (CONS-2): DetectionPreview overrides reach project:auto-configure (Electron + server parity)',
    severity: 'suggestion',
    scope: 'cross-file',
    status: 'accepted',
    evidence: [
      { file: 'src/components/ui/LaunchScreen.tsx', line: 342, excerpt: 'handleDetectionConfirm builds {framework, componentLibrary, cssFramework} payload, strips undefineds, calls autoConfigureProject(payload)' },
      { file: 'shared/ipc-validators.ts', line: 469, excerpt: 'projectAutoConfigureSchema accepts strict { overrides: { framework?, componentLibrary?, cssFramework? } }' },
      { file: 'electron/main.ts', line: 2331, excerpt: 'if (overrides?.componentLibrary) { library = overrides.componentLibrary }', note: 'Overrides win over detected value.' },
      { file: 'server/index.ts', line: 1573, excerpt: 'if (overrides?.componentLibrary) { library = overrides.componentLibrary }', note: 'Web parity preserved — server handler mirrors Electron precedence.' },
    ],
    rationale: 'User-corrected library/framework/CSS choices now reach the configure pipeline instead of being silently discarded.',
    observed: 'Both Electron (electron/main.ts:2286-2340) and Express (server/index.ts:1535-1607) handlers parse the same Zod schema and apply overrides with identical precedence.',
    proposedFix: 'Closed.',
  },
  {
    id: 'WARN-3-RESOLVED',
    title: 'Round 1 WARN-3: stale console.log in findFlintIdOffsets removed',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'accepted',
    evidence: [
      { file: 'electron/GitManager.ts', line: 43, excerpt: 'function findFlintIdOffsets — no console.log inside the AST walker', note: 'Hot-path log gone; only intentional lifecycle logs remain at lines 118 (init), 172 (shadow commit), 295 (clone).' },
    ],
    rationale: 'Recovery hot path no longer floods the main-process console.',
    observed: 'Function body lines 43-77 contain no console.* calls.',
    proposedFix: 'Closed.',
  },
  {
    id: 'SUG-1-RESOLVED',
    title: 'Round 1 SUG-1: from-idea-ipc-roundtrip invariant reframed from < 100ms to "same async flush"',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'accepted',
    evidence: [
      { file: '.flint-context/contracts/FORGE.1.contract.ts', line: 342, excerpt: "threshold: 'same async flush (no dialog:openFolder calls, no extra IPC round-trips)'" },
      { file: '.flint-context/contracts/FORGE.1-contract.md', line: 210, excerpt: 'Phase 2 fix-forward (CODE-SUG-1, 2026-04-19): the original threshold was `< 100ms` mock timing... "same async flush" framing makes that property the falsifiable invariant' },
    ],
    rationale: 'Wall-clock proxy replaced with a deterministic structural property — no flake risk on slow CI runners; the invariant now matches what the test actually asserts.',
    observed: 'Both .md and .contract.ts in sync; explicit evolution note documents why.',
    proposedFix: 'Closed.',
  },
  {
    id: 'SUG-2-RESOLVED',
    title: 'Round 1 SUG-2: MUI label DRY\'d into a constant',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'accepted',
    evidence: [
      { file: 'src/components/ui/DetectionPreview.tsx', line: 25, excerpt: "const MUI_LABEL = 'MUI (Material UI)'" },
      { file: 'src/components/ui/DetectionPreview.tsx', line: 40, excerpt: "{ value: 'mui', label: MUI_LABEL }" },
      { file: 'src/components/ui/DetectionPreview.tsx', line: 120, excerpt: 'overrides.componentLibraryLabel = MUI_LABEL' },
      { file: 'src/components/ui/DetectionPreview.tsx', line: 199, excerpt: "placeholder={detectedLibrary ?? `${MUI_LABEL} (default)`}" },
    ],
    rationale: 'Single source of truth for the user-facing MUI label.',
    observed: '3 reuse sites all reference the constant.',
    proposedFix: 'Closed.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FORGE.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-19',
    round: 2,
    scope: [
      'electron/__tests__/projectSmartOpen.test.ts (re-verified)',
      'src/components/ui/LaunchScreen.tsx (createScratchpad + overrides plumbing)',
      'src/components/ui/DetectionPreview.tsx (MUI_LABEL DRY)',
      'electron/preload.ts (createScratchpad + autoConfigureProject signatures)',
      'electron/main.ts (project:create-scratchpad + project:auto-configure handlers)',
      'server/index.ts (web parity for project:auto-configure overrides)',
      'electron/GitManager.ts (console.log removal in findFlintIdOffsets)',
      'shared/ipc-validators.ts (projectCreateScratchpadSchema + projectAutoConfigureSchema with overrides)',
      'src/types/flint-api.d.ts (typed surfaces)',
      '.flint-context/contracts/FORGE.1.contract.ts (invariant text)',
      '.flint-context/contracts/FORGE.1-contract.md (invariant text + evolution note)',
    ],
    markdownFile: 'FORGE.1-code-review-2026-04-19-round2.md',
  },
  rubric: [
    { criterion: 'Round 1 BLK-1: scaffold tests converted to real assertions', result: 'pass', evidence: '40 real assertions; 0 it.todo' },
    { criterion: 'Round 1 WARN-1: createScratchpad libraryDefault wired end-to-end', result: 'pass', evidence: 'LaunchScreen → preload → Zod → main; typed surface intact' },
    { criterion: 'Round 1 WARN-2: DetectionPreview overrides reach project:auto-configure', result: 'pass', evidence: 'Both Electron and server handlers apply overrides with identical precedence' },
    { criterion: 'Round 1 WARN-3: stale console.log removed from findFlintIdOffsets', result: 'pass', evidence: 'Hot path log gone; only lifecycle logs remain' },
    { criterion: 'Round 1 SUG-1: invariant reframed from < 100ms to same async flush in both .md and .contract.ts', result: 'pass' },
    { criterion: 'Round 1 SUG-2: MUI label DRY\'d into a constant', result: 'pass' },
    { criterion: 'No new Commandment violations introduced by the fix', result: 'pass' },
    { criterion: 'IPC validator coverage 100% for renderer→main project:* channels', result: 'pass', evidence: '6 of 6 channels validated' },
    { criterion: 'Web parity holds — server/index.ts mirrors electron/main.ts for both new handler signatures', result: 'pass', evidence: 'project:auto-configure overrides identical; project:create-scratchpad is Electron-only by design (no server handler exists)' },
    { criterion: 'Contract .contract.ts TSC-clean', result: 'pass', evidence: 'npx tsc --noEmit returns 0 errors on full project' },
    { criterion: 'TSC clean (0 errors)', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'electron/__tests__/projectSmartOpen.test.ts',
      'src/components/ui/LaunchScreen.tsx',
      'src/components/ui/DetectionPreview.tsx',
      'electron/preload.ts',
      'electron/main.ts',
      'server/index.ts',
      'electron/GitManager.ts',
      'shared/ipc-validators.ts',
      'src/types/flint-api.d.ts',
      '.flint-context/contracts/FORGE.1.contract.ts',
      '.flint-context/contracts/FORGE.1-contract.md',
    ],
    skipped: [
      'flint-mcp/** — not in round-2 fix-forward scope',
      'demos/** — fixture data only, not changed in fix-forward',
      'docs/** — not in code review scope',
    ],
  },
};
