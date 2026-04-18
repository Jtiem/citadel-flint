/**
 * PHASE 0 — Coverage Honesty: Code Review (machine-readable sibling)
 *
 * Markdown: ./PHASE0-code-review-2026-04-18.md
 * Verdict derived from findings via deriveVerdict() — do not edit by hand.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'StatusBar will display 0% / idle until IPC handler is wired to DebtReportService',
    severity: 'warning',
    evidence: [
      {
        file: 'electron/main.ts',
        line: 6557,
        excerpt:
          "ipcMain.handle('flint:getCoverageSummary', async (): Promise<...> => { const zeroState = { ... }; return ipcSchemas['flint:getCoverageSummary'].response.parse(zeroState) })",
        note: 'Handler returns a hard-coded zero-state; never reads coverage-cache.json or calls DebtReportService.',
      },
      {
        file: 'server/index.ts',
        line: 4080,
        excerpt:
          "handlers.set('flint:getCoverageSummary', async () => { const zeroState = { ... }; return ipcSchemas['flint:getCoverageSummary'].response.parse(zeroState) })",
        note: 'Web-parity mirror has the same stub — StatusBar badge shows idle in browser too.',
      },
      {
        file: 'flint-mcp/src/core/dashboard/debtReportService.ts',
        line: 519,
        excerpt:
          "fs.writeFileSync(path.join(flintDir, 'coverage-cache.json'), JSON.stringify(coverage, null, 2), 'utf-8')",
        note: 'Cache IS written by generateDebtReport but never read by the IPC handlers.',
      },
    ],
    observed:
      'Both the Electron main handler and the Express/WS handler return a hard-coded zero-state CoverageSummary. Neither delegates to DebtReportService nor reads .flint/coverage-cache.json, even though the cache file is produced by generateDebtReport on every run.',
    rationale:
      'Phase 0\'s user-facing value proposition is "see what Flint is governing." With stubbed handlers, users running a debt scan will see the StatusBar badge render idle with a "—" placeholder regardless of actual coverage. The wire format is exercised end-to-end by tests but the production signal is 0% until this is wired.',
    proposedFix:
      "Replace the zero-state block in both handlers with a read of .flint/coverage-cache.json (falling back to zero-state when absent). Preferred: import DebtReportService and call a new .getCoverageSummary() getter so the Electron and web paths share one source.",
    scope: 'one-file',
    status: 'open',
    commandment: 14,
  },
  {
    id: 'WARN-2',
    title: 'coverage-badge-click-latency invariant has no benchmark file',
    severity: 'warning',
    evidence: [
      {
        file: '.flint-context/contracts/PHASE0-coverage-honesty.contract.ts',
        line: 638,
        excerpt:
          "name: 'coverage-badge-click-latency', measurable: 'Time between CoverageBadge mousedown and onClick firing', threshold: '< 50ms at p95 under a 100-click benchmark', measuredBy: 'React Testing Library + performance.now() in CoverageBadge.bench.test.tsx'",
        note: 'Contract declares the benchmark file; no such file exists in the tree.',
      },
      {
        file: 'src/components/editor/__tests__/CoverageBadge.test.tsx',
        note: 'Existing test file verifies click correctness but not p95 latency.',
      },
    ],
    observed:
      'The contract declares an invariant measured by CoverageBadge.bench.test.tsx, but that file does not exist. The CoverageBadge.test.tsx file tests click correctness (fires onClick exactly once, keyboard Enter, double-click) but has no latency assertion.',
    rationale:
      'An invariant without a measurement is aspirational, not enforced. The handler path is pure memoized state derivation so real latency is almost certainly <1ms, but the contract promise is unfalsifiable as written. A future regression (e.g., a heavy computation added to deriveAriaLabel) would not be caught.',
    proposedFix:
      'Add a minimal bench test: fire 100 clicks via RTL fireEvent, record performance.now() around each, assert p95 < 50ms. Or amend the contract to say the invariant is satisfied structurally by useMemo + React\'s button synthetic event path and drop the benchmark requirement.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title: 'CoverageBadgeProps declared in the contract is never imported — dead type',
    severity: 'warning',
    evidence: [
      {
        file: '.flint-context/contracts/PHASE0-coverage-honesty.contract.ts',
        line: 195,
        excerpt:
          'export interface CoverageBadgeProps { summary: CoverageSummary | null; onClick: () => void }',
        note: 'Contract exports a props type that receives summary externally and emits onClick upward.',
      },
      {
        file: 'src/components/editor/CoverageBadge.tsx',
        line: 75,
        excerpt:
          'export function CoverageBadge() { const { summary } = useCoverageSummary(); ... }',
        note: 'Component takes zero props; calls the hook internally and owns its own popover state.',
      },
    ],
    observed:
      'The contract\'s CoverageBadgeProps interface is not imported anywhere. The real CoverageBadge implementation encapsulates the hook call and popover state internally and takes no props.',
    rationale:
      'Documentation drift. The contract states one shape; the code ships another. Both are defensible in isolation (encapsulation is fine for a single-mount component), but a future contributor reading the contract will assume CoverageBadge is a presentational component and may propose refactors that break the current coupling with useCoverageSummary.',
    proposedFix:
      'Either (a) update the contract to reflect the actual no-props shape, or (b) refactor CoverageBadge to accept props and move the hook call to a small wrapper in StatusBar. Option (a) is lower-risk and preserves the current architecture.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'WARN-4',
    title: 'non-jsx-framework reason conflates wrong-framework and parse-failure',
    severity: 'warning',
    evidence: [
      {
        file: 'flint-mcp/src/core/coverageClassifier.ts',
        line: 441,
        excerpt:
          "if (isNonJsxFramework(filePath, ast)) { return { status: 'skipped-unsupported', reason: 'non-jsx-framework', ... } }",
        note: 'Rule 1 branch — triggers for .vue/.svelte/.component.html OR unparseable non-JS extensions.',
      },
      {
        file: 'flint-mcp/src/core/coverageClassifier.ts',
        line: 451,
        excerpt:
          "if (ast === null) { return { status: 'skipped-unsupported', reason: 'non-jsx-framework', details: `Could not parse file: '${filePath}'` } }",
        note: 'Secondary branch — catches .tsx/.ts/.jsx where Babel.parse() returned null. Uses the same reason code.',
      },
    ],
    observed:
      'Both "file extension is Vue/Svelte/Angular" and "file is TSX but failed to parse" return the same reason code non-jsx-framework. A syntactically-invalid .tsx file contributes to the "Non-JSX framework (Vue, Svelte, Angular)" bucket in the CoveragePopover.',
    rationale:
      'The popover legend promises Vue/Svelte/Angular but may silently include TSX files with parse errors. Users debugging their coverage number will not realise some of their "Vue/Svelte" files are actually their own broken TSX. The reason list is append-only (wire-stability), so the fix is to add a new reason in a later phase, not rename.',
    proposedFix:
      'In Phase 1, append reason "parse-failure" to CoverageReason. For Phase 0, either (a) render the details field under each reason count in the popover so users can see the real cause, or (b) adjust the popover legend to "Non-JSX framework or unparseable file" until the new reason ships.',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'WARN-5',
    title: 'isAngularComponent JSDoc claims .component.ts support but only .component.html matches',
    severity: 'warning',
    evidence: [
      {
        file: 'flint-mcp/src/core/coverageClassifier.ts',
        line: 84,
        excerpt:
          "function isAngularComponent(filePath: string): boolean {\n    // Angular component templates: *.component.html or *.component.ts with @Component decorator\n    return filePath.endsWith('.component.html')\n}",
        note: 'Doc comment claims two patterns; implementation checks only one.',
      },
    ],
    observed:
      'isAngularComponent documents handling both .component.html files and .component.ts files with @Component decorators, but the implementation only matches .component.html suffix. Angular component TS files with inline templates pass straight through to Rules 2–8 and will typically land as parsed.',
    rationale:
      'Misleading documentation. An Angular user will assume their component.ts files are detected as non-jsx-framework (skipped) when in fact they are being scored as if they were ordinary React. Not a security or correctness issue, just a documentation/coverage gap.',
    proposedFix:
      'Either (a) remove the second half of the comment, or (b) extend the check to traverse the AST for a ClassDeclaration whose decorator callee is Component and whose argument is an object with a template property.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: 'CoveragePopoverProps duplicated between contract export and component-local interface',
    severity: 'suggestion',
    evidence: [
      {
        file: '.flint-context/contracts/PHASE0-coverage-honesty.contract.ts',
        line: 202,
        excerpt:
          'export interface CoveragePopoverProps { summary: CoverageSummary; onClose: () => void }',
      },
      {
        file: 'src/components/editor/CoveragePopover.tsx',
        line: 40,
        excerpt:
          'interface CoveragePopoverProps { summary: CoverageSummary; onClose: () => void }',
        note: 'Component redeclares the same interface locally rather than importing the contract export.',
      },
    ],
    observed:
      'CoveragePopoverProps is declared twice with identical shape — once in the contract and once locally in the component file.',
    rationale:
      'Two sources of truth can drift. Low-severity because the shape is small, but the pattern scales badly.',
    proposedFix:
      'Import CoveragePopoverProps from the contract (or move it to shared/coverage-types.ts and import from there).',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'Classifier rule-checker JSDoc is sparse on edge-case intent',
    severity: 'suggestion',
    evidence: [
      {
        file: 'flint-mcp/src/core/coverageClassifier.ts',
        line: 130,
        excerpt: '/** Rule 2: css-in-js-detected */',
      },
      {
        file: 'flint-mcp/src/core/coverageClassifier.ts',
        line: 279,
        excerpt: '/** Rule 6: dynamic-class-expression */',
      },
    ],
    observed:
      'Each rule checker has a one-line comment naming the rule but does not document priority, false-positive defenses (e.g., "only matches the imported clsx binding, not a local variable called clsx"), or known limitations.',
    rationale:
      'The property-based test (test 30) catches the invariant but not the intent. A maintainer refactoring these helpers will lack context on why, for example, the dynamic-class check falls back to DYNAMIC_CLASS_CALLEE_NAMES even when no matching import is present.',
    proposedFix:
      'Add 2–3 bullets to each rule checker\'s JSDoc covering: (a) which imports/patterns trigger it, (b) what is intentionally excluded, (c) ordering with respect to other rules.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'CoverageSummary duplicated between shared/coverage-types.ts and src/types/flint-api.d.ts',
    severity: 'suggestion',
    evidence: [
      {
        file: 'shared/coverage-types.ts',
        line: 97,
        excerpt: 'export interface CoverageSummary { ... }',
      },
      {
        file: 'src/types/flint-api.d.ts',
        line: 1612,
        note: 'Renderer-side mirror of the same type, comment says "for parallel agent coordination."',
      },
    ],
    observed:
      'CoverageSummary, CoverageReason, SkippedFilesByReason, and CoverageVerdict are declared in shared/coverage-types.ts and mirrored in src/types/flint-api.d.ts. The mirror was justified during the parallel Group A work.',
    rationale:
      'Phase 0 has shipped; the coordination justification is resolved. Two sources of truth is friction for future maintainers; any change to the enum will require editing both.',
    proposedFix:
      "Delete the renderer-side mirror in flint-api.d.ts and replace with `import type { CoverageSummary } from '../../shared/coverage-types'`.",
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-4',
    title: 'mithrilParity.test.ts allowlist needs a comment explaining why auditAllWithCoverage is MCP-only',
    severity: 'suggestion',
    evidence: [
      {
        file: 'shared/__tests__/mithrilParity.test.ts',
        note: 'auditAllWithCoverage is allowlisted as MCP-only without an inline justification.',
      },
    ],
    observed:
      'The parity test allowlists auditAllWithCoverage so that Electron-side Mithril doesn\'t fail drift detection. No comment explains the design choice.',
    rationale:
      'A future contributor seeing the allowlist may interpret it as a drift debt to fix, and port auditAllWithCoverage into the Electron linter — thereby re-introducing a parallel classifier invocation and violating the contract\'s "classify once" intent.',
    proposedFix:
      'Add a one-line comment to the allowlist entry: "Glass consumes coverage via flint:getCoverageSummary IPC, not via direct Mithril call. Do not port to the renderer linter."',
    scope: 'one-line',
    status: 'open',
  },
];

const rubric: ReviewReport['rubric'] = [
  { criterion: 'C2 — Dot colors come from a declared map, no raw hex/literal Tailwind in className string construction', result: 'pass' },
  { criterion: 'C4 — No external network URLs introduced; classifier is pure', result: 'pass' },
  { criterion: 'C5 — CoverageBadge carries aria-label conveying percentage and hinting at popover', result: 'pass' },
  { criterion: 'C5 — Badge is a real <button>; Escape dismisses popover', result: 'pass' },
  { criterion: 'C13 — Classifier uses Babel AST traversal only; no regex on source code', result: 'pass' },
  { criterion: 'C13 — VAR_NO_FALLBACK regex targets a CSS variable value, not source code', result: 'pass' },
  { criterion: 'C14 — No new fs/git/SQLite imports in src/', result: 'pass' },
  { criterion: 'C14 — .flint/coverage-cache.json write is inside the MCP engine process, not Glass', result: 'pass' },
  { criterion: 'Every renderer→main IPC channel has a Zod validator in shared/ipc-validators.ts', result: 'pass' },
  { criterion: 'Zod validator is referenced by name in the .contract.ts validator field', result: 'pass' },
  { criterion: 'Web build (server/index.ts) mirrors the Electron handler with the same Zod schema', result: 'pass' },
  { criterion: 'Hook does not call window.flintAPI inside a Zustand store action', result: 'pass' },
  { criterion: 'No Zustand store imports another store', result: 'pass' },
  { criterion: 'Every CoverageReason enum value has at least one classifier unit test', result: 'pass' },
  { criterion: 'Property-based test covers the parsed/reason-null invariant over 100 inputs', result: 'pass' },
  { criterion: 'npx tsc --noEmit exits 0', result: 'pass' },
  { criterion: 'coverage-grade-independence = 0 is structurally enforced (coverage computed AFTER healthScore)', result: 'pass' },
  { criterion: 'coverage-emit-parity = 1.0 inside generateDebtReport', result: 'pass' },
  {
    criterion: 'coverage-emit-parity = 1.0 visible via StatusBar badge',
    result: 'fail',
    evidence: 'IPC handler in electron/main.ts:6557 and server/index.ts:4080 returns hard-coded zero-state; StatusBar badge will render idle until wired to DebtReportService.',
    relatedFindings: ['WARN-1'],
  },
  {
    criterion: 'coverage-badge-click-latency < 50ms at p95 is benchmarked',
    result: 'fail',
    evidence: 'No CoverageBadge.bench.test.tsx file exists; contract declares it but it was not shipped.',
    relatedFindings: ['WARN-2'],
  },
  {
    criterion: 'CoverageBadgeProps from the contract is actually used by the component',
    result: 'fail',
    evidence: 'src/components/editor/CoverageBadge.tsx:75 declares `export function CoverageBadge()` with zero parameters; the contract prop type is imported nowhere.',
    relatedFindings: ['WARN-3'],
  },
  {
    criterion: 'Classifier distinguishes wrong-framework from parse-failure in its reason code',
    result: 'fail',
    evidence: 'flint-mcp/src/core/coverageClassifier.ts:441-457 — both branches emit reason=non-jsx-framework.',
    relatedFindings: ['WARN-4'],
  },
  {
    criterion: 'isAngularComponent matches .component.ts per its JSDoc',
    result: 'fail',
    evidence: 'flint-mcp/src/core/coverageClassifier.ts:86 — implementation returns filePath.endsWith(".component.html") only.',
    relatedFindings: ['WARN-5'],
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'PHASE0',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-18',
    round: 1,
    scope: [
      '14 production files (shared types, MCP classifier + linter integrations, debt report, session context, IPC layer, StatusBar badge, hook)',
      '6 test files (classifier, Mithril coverage, A11y coverage, debt report aggregation, IPC round-trip, badge + popover + hook)',
      'Contract artifacts (.md prose + .contract.ts executable)',
    ],
    markdownFile: 'PHASE0-code-review-2026-04-18.md',
  },
  rubric,
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'shared/coverage-types.ts',
      'shared/ipc-validators.ts',
      'flint-mcp/src/core/coverageClassifier.ts',
      'flint-mcp/src/core/MithrilLinter.ts',
      'flint-mcp/src/core/A11yLinter.ts',
      'flint-mcp/src/core/dashboard/debtReportService.ts',
      'flint-mcp/src/core/sessionContext.ts',
      'flint-mcp/src/core/__tests__/coverageClassifier.test.ts',
      'flint-mcp/src/core/__tests__/MithrilLinter.coverage.test.ts',
      'flint-mcp/src/core/__tests__/A11yLinter.coverage.test.ts',
      'flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts',
      'electron/main.ts (Phase 0 handler)',
      'electron/preload.ts (Phase 0 bridge)',
      'electron/__tests__/coverageIpc.test.ts',
      'server/index.ts (Phase 0 handler)',
      'src/adapters/web-api.ts',
      'src/types/flint-api.d.ts',
      'src/hooks/useCoverageSummary.ts',
      'src/hooks/__tests__/useCoverageSummary.test.ts',
      'src/components/editor/CoverageBadge.tsx',
      'src/components/editor/CoveragePopover.tsx',
      'src/components/editor/StatusBar.tsx',
      'src/components/editor/__tests__/CoverageBadge.test.tsx',
      'src/components/editor/__tests__/CoveragePopover.test.tsx',
      '.flint-context/contracts/PHASE0-coverage-honesty-contract.md',
      '.flint-context/contracts/PHASE0-coverage-honesty.contract.ts',
    ],
    skipped: [
      'flint-mcp/src/core/__tests__/fixtures/coverage/* — existence/count verified (9 fixtures match contract), not line-reviewed',
      'Full Mithril linter outside Phase 0 additions — out of scope',
      'Full A11y linter outside Phase 0 additions — out of scope',
      'Full sessionContext outside the coverage-cache.json read — out of scope',
      'Full shared/ipc-validators.ts outside the Phase 0 schema entry — out of scope',
      'Pre-existing 2 StatusBar failures — confirmed unrelated to Phase 0 (predate the <CoverageBadge /> mount)',
    ],
  },
};
