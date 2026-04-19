/**
 * FORGE.1 — Machine-readable code review report (Round 1)
 *
 * Sibling to FORGE.1-code-review-2026-04-19.md.
 * Verdict is derived from finding severity counts via deriveVerdict() —
 * not assigned by hand.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title: 'Group A scaffold tests never converted to real assertions in Group B fill pass',
    severity: 'blocking',
    scope: 'one-file',
    status: 'open',
    commandment: 16,
    evidence: [
      {
        file: 'electron/__tests__/projectSmartOpen.test.ts',
        line: 1,
        excerpt: 'All 28 cases use it.todo(...). 0 cases use it(...) or test(...).',
        note: 'grep -c "it.todo" returns 28; grep -c "it(" returns 0',
      },
      {
        file: '.flint-context/contracts/FORGE.1-contract.md',
        line: 180,
        excerpt: 'flint-test-writer — Group B fill pass: convert it.todo → real assertions in projectSmartOpen.test.ts',
      },
      {
        file: '.flint-context/contracts/FORGE.1.contract.ts',
        line: 322,
        excerpt: "name: 'smart-open-routing-precision', threshold: '>= 0.95', measuredBy: 'electron/__tests__/projectSmartOpen.test.ts — fixture matrix'",
        note: 'Three contract invariants depend on this file containing real assertions',
      },
    ],
    observed:
      'Every test case in electron/__tests__/projectSmartOpen.test.ts is an it.todo placeholder. The Group B fill pass mandated by the contract did not run.',
    rationale:
      'The contract names three invariants (smart-open-routing-precision >= 0.95, validator-coverage-project-channels === 0, detection-coverage-existing-code >= 0.10) whose measuredBy is exactly this file. With every case as it.todo, none of those invariants are actually measured in CI — the contract\'s falsifiability claim is broken.',
    proposedFix:
      'Convert at minimum the 5 cases backing the three invariants: the 20-fixture heuristic matrix, the 5 validator-coverage cases, and the base-vite-tailwind detection case. Other cases may stay it.todo if the team explicitly carves them out for Sprint 2.',
  },
  {
    id: 'WARN-1',
    title: 'handleFromIdea does not pass libraryDefault: "mui" to project:create-scratchpad',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    commandment: 2,
    evidence: [
      {
        file: 'src/components/ui/LaunchScreen.tsx',
        line: 266,
        excerpt: 'await window.flintAPI.project.createScratchpad()',
        note: 'No payload passed',
      },
      {
        file: 'electron/main.ts',
        line: 1902,
        excerpt: "ipcMain.handle('project:create-scratchpad', async (): Promise<FileTreeNode> => { ... })",
        note: 'Handler accepts no payload',
      },
      {
        file: '.flint-context/contracts/FORGE.1.contract.ts',
        line: 300,
        excerpt: "behavior: 'project:create-scratchpad called from from-idea channel passes libraryDefault: \"mui\"'",
      },
    ],
    observed:
      'LaunchScreen.handleFromIdea calls createScratchpad() with no argument. The IPC handler signature accepts no payload and the preload bridge takes no input. There is no libraryDefault plumbing anywhere in the FORGE.1 diff.',
    rationale:
      'The contract testBoundary "Start from idea defaults to MUI library" requires the IPC payload to carry libraryDefault: "mui". The MUI default is preserved downstream by DetectionPreview.handleConfirm for the from-existing-code channel, but the from-idea channel never enters DetectionPreview — its scratchpad inherits whatever the base-vite-tailwind template ships with. The contract assertion is unsatisfiable as wired.',
    proposedFix:
      'Either (a) extend project:create-scratchpad to accept { libraryDefault?: string }, add a Zod validator, plumb it through initializeProject, and call it from handleFromIdea; or (b) amend the contract testBoundary to record the MUI default as a Sprint-2 carve-out.',
  },
  {
    id: 'WARN-2',
    title: 'DetectionPreview overrides discarded by handleDetectionConfirm',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/LaunchScreen.tsx',
        line: 340,
        excerpt: 'const handleDetectionConfirm = async (overrides?: Partial<ProjectEnvironment>) => { ... await window.flintAPI.project.autoConfigureProject(); ... void overrides',
        note: 'overrides param explicitly thrown away with `void overrides`',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 456,
        excerpt: 'export const projectAutoConfigureSchema = z.undefined()',
        note: 'auto-configure validator accepts no payload — overrides cannot pass through',
      },
      {
        file: '.flint-context/contracts/FORGE.1.contract.ts',
        line: 281,
        excerpt: "assertion: 'project:auto-configure is invoked once with merged environment'",
      },
    ],
    observed:
      'DetectionPreview.handleConfirm builds a Partial<ProjectEnvironment> with user-selected library/framework/CSS overrides and calls onConfirm(overrides). LaunchScreen.handleDetectionConfirm receives the overrides parameter and immediately discards it with `void overrides`. The auto-configure IPC channel has no payload schema.',
    rationale:
      'The user\'s manual library, framework, and CSS choices in DetectionPreview are silently discarded. auto-configure runs against whatever was originally detected. The contract testBoundary "DetectionPreview — confirm calls auto-configure with overrides" is not satisfied.',
    proposedFix:
      'Extend project:auto-configure to accept an optional Partial<ProjectEnvironment> override payload, replace projectAutoConfigureSchema = z.undefined() with a partial schema, plumb the overrides through, OR amend the testBoundary to mark overrides as advisory-only for Sprint 1.',
  },
  {
    id: 'WARN-3',
    title: 'Stale console.log in GitManager.findFlintIdOffsets fires on every Rewind call',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/GitManager.ts',
        line: 51,
        excerpt: "console.log('found data-flint-id attr:', attr.value)",
      },
    ],
    observed:
      'Inside the AST walker findFlintIdOffsets, an unconditional console.log fires for every JSXAttribute named data-flint-id, regardless of whether it matches the target ID.',
    rationale:
      'Floods the main-process console during Rewind / Git Time Machine recovery. The file was modified in this phase (clone() method added), so this trivially-removable noise is in scope for FORGE.1 cleanup.',
    proposedFix: 'Delete line 51, or guard with a DEBUG env flag.',
  },
  {
    id: 'SUG-1',
    title: 'Architect deviation note (<100ms → "same async flush") not reflected in committed contract',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: '.flint-context/contracts/FORGE.1.contract.ts',
        line: 337,
        excerpt: "threshold: '< 100ms'",
        note: 'Reviewer prompt indicated architect rewrote this to "handler fires in same async flush"',
      },
    ],
    observed:
      'The from-idea-ipc-roundtrip invariant in the committed contract still reads "< 100ms", but the reviewer prompt reports the architect rewrote the threshold to "handler fires in same async flush". Either the deviation note is stale or the contract was not updated.',
    rationale:
      'A synchronous-flush assertion is genuinely stronger than a millisecond budget (no CI flake risk), but the contract file should record the threshold actually being measured. Documentation/code skew makes Phase 1.5 lint and Phase 3 validation imprecise.',
    proposedFix: 'Update the invariant text in FORGE.1.contract.ts to match the implemented assertion and add an evolution: note explaining the substitution.',
  },
  {
    id: 'SUG-2',
    title: 'DetectionPreview library labels duplicated between LIBRARY_OPTIONS and handleConfirm',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/DetectionPreview.tsx',
        line: 35,
        excerpt: "const LIBRARY_OPTIONS = [ ... { value: 'mui', label: 'MUI (Material UI)' }, ... ]",
      },
      {
        file: 'src/components/ui/DetectionPreview.tsx',
        line: 111,
        excerpt: "overrides.componentLibraryLabel = 'MUI (Material UI)'",
        note: 'Same label repeated in fallback path',
      },
    ],
    observed:
      'The string "MUI (Material UI)" appears in both the option array and the override-builder fallback. Same pattern for the other library labels.',
    rationale:
      'Low-risk drift surface — if the label changes in one place, the other will silently de-sync.',
    proposedFix: 'Hoist labels into a const LIBRARY_LABELS: Record<string, string> and reuse from both sites.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FORGE.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'Group A IPC plumbing (5 files: GitManager, electron/main, server/index, preload, validators)',
      'Group A test scaffold (electron/__tests__/projectSmartOpen.test.ts)',
      'Group B UI (LaunchScreen.tsx, DetectionPreview.tsx)',
      'Group B tests (LaunchScreen + DetectionPreview)',
      'Contract artifacts (.md + .contract.ts) for spec/code consistency',
    ],
    markdownFile: 'FORGE.1-code-review-2026-04-19.md',
  },
  rubric: [
    {
      criterion: 'project:smart-open Electron handler routes git URLs through GitManager (no raw exec)',
      result: 'pass',
      evidence: 'electron/main.ts:2466 calls gitManager.clone(input, projectPath); GitManager.ts:251 uses execFile array args',
    },
    {
      criterion: 'project:smart-open server-parity handler uses execFile array args (no shell interpolation)',
      result: 'pass',
      evidence: "server/index.ts:1690 — execFileAsync('git', ['clone', '--', input, projectPath])",
    },
    {
      criterion: 'Smart-open URL heuristic regex is start-anchored',
      result: 'pass',
      evidence: 'electron/main.ts:2435 + server/index.ts:1664 — /^(https?:\\/\\/|git@|ssh:\\/\\/)/',
    },
    {
      criterion: 'Folder-path branch validates absolute path inside home directory',
      result: 'pass',
      evidence: 'electron/main.ts:2473-2481 + server/index.ts:1695-1703',
    },
    {
      criterion: 'All 5 project:* renderer→main channels declare a Zod validator in shared/ipc-validators.ts',
      result: 'pass',
      evidence: 'shared/ipc-validators.ts:442-468 — projectSmartOpen, projectDetectEnvironment, projectAutoConfigure, projectRunBaseline, projectGetHealthGrade all exported',
    },
    {
      criterion: 'Preload bridge validates payload before invoking smartOpen',
      result: 'pass',
      evidence: 'electron/preload.ts:591 — projectSmartOpenSchema.parse({ input }) before ipcRenderer.invoke',
    },
    {
      criterion: 'Web adapter exposes smartOpen with matching signature',
      result: 'pass',
      evidence: 'src/adapters/web-api.ts:423',
    },
    {
      criterion: 'Orphan setFigmaSetupOpen reference removed from LaunchScreen.tsx',
      result: 'pass',
      evidence: 'grep returns 0 hits in src/components/ui/LaunchScreen.tsx',
    },
    {
      criterion: 'LaunchScreen renders exactly 3 channels (from-idea / from-figma / from-existing-code)',
      result: 'pass',
      evidence: 'src/components/ui/LaunchScreen.tsx:71-90 — CHANNELS const',
    },
    {
      criterion: 'DetectionPreview defaults to MUI when componentLibrary is null',
      result: 'pass',
      evidence: "DetectionPreview.tsx:86 effectiveLibrary fallback to 'mui'; lines 108-112 emit { name: 'mui', version: 'latest' } in handleConfirm",
    },
    {
      criterion: 'Group A scaffold (projectSmartOpen.test.ts) converted to real assertions by Group B',
      result: 'fail',
      evidence: 'electron/__tests__/projectSmartOpen.test.ts — 28/28 cases still it.todo',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion: 'from-idea channel passes libraryDefault: "mui" to project:create-scratchpad per contract',
      result: 'fail',
      evidence: 'src/components/ui/LaunchScreen.tsx:266 — createScratchpad() called with no payload',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'DetectionPreview overrides flow through to project:auto-configure',
      result: 'fail',
      evidence: 'src/components/ui/LaunchScreen.tsx:353 — `void overrides` discards user choices',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'No arbitrary Tailwind hex/spacing in new UI (Mithril)',
      result: 'pass',
      evidence: 'DetectionPreview.tsx uses zinc/indigo/amber tokens only; spacing on the scale (p-4, py-2.5)',
    },
    {
      criterion: 'No Node module imports in src/',
      result: 'pass',
      evidence: 'DetectionPreview.tsx + LaunchScreen.tsx changes touch only React + types/flint-api',
    },
    {
      criterion: 'TSC clean (npx tsc --noEmit reports 0 errors)',
      result: 'pass',
      evidence: 'Team-reported as 0 errors; not re-verified locally',
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'electron/GitManager.ts',
      'electron/main.ts (project:smart-open block 2415-2506)',
      'server/index.ts (project:smart-open block 1653-1723)',
      'electron/preload.ts (smartOpen surface 578-594)',
      'shared/ipc-validators.ts (FORGE.1 additions 425-470)',
      'src/types/flint-api.d.ts (smartOpen + ProjectEnvironment)',
      'src/adapters/web-api.ts (smartOpen adapter)',
      'src/components/ui/LaunchScreen.tsx',
      'src/components/ui/DetectionPreview.tsx',
      'electron/__tests__/projectSmartOpen.test.ts',
      '.flint-context/contracts/FORGE.1-contract.md',
      '.flint-context/contracts/FORGE.1.contract.ts',
    ],
    skipped: [
      'src/components/ui/__tests__/LaunchScreen.test.tsx — Group B test bodies not opened; test counts trusted from team report',
      'src/components/ui/__tests__/DetectionPreview.test.tsx — same as above',
      'src/components/ui/__tests__/NewProjectFlow.test.tsx — Journey-10 update; trust report',
      'shared/__tests__/mithrilParity.test.ts — allowlist edit unrelated to FORGE.1 surface',
      'Live test execution — accepted team report (MCP 5550/5550, Core 2579/2579, Glass 3179/3181, TSC 0)',
    ],
  },
};
