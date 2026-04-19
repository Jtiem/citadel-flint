/**
 * FIXTURE.1 Code Review — Audit Context System
 * Replication run of Cheaper-Pilot ceremony.
 *
 * Original reviewer output used a non-standard severity vocabulary
 * (major/minor/info) and field shapes (lineStart/lineEnd/snippet, recommendation).
 * Normalized to shared/review-schema.ts canonical types so scripts/render-review.ts
 * can produce the .md sibling deterministically. Severity mapping:
 *   major → warning · minor → suggestion · info → suggestion
 * Field mapping:
 *   recommendation → proposedFix · lineStart → line · snippet → excerpt
 *
 * Status: all 7 findings addressed in fix-sweep commit (FIXTURE.1.1 follow-up
 * tracked separately for the DTCG → linter token-shape adapter gap).
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'CODE-001',
    title: 'Demo fixtures omit `tokens` field — Beta Gate item #3 (compliant=0 / broken≥5) is not driven by demo files in the repo',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'demos/01-rag-ui-builder/.flint-fixture.json',
        line: 1,
        excerpt: '{ "surface": "component", "label": "RAG UI demo (Tailwind defaults)" }',
        note: 'No tokens field; production audit falls back to project default token set.',
      },
      { file: 'demos/02-self-correcting/.flint-fixture.json', line: 1 },
      { file: 'demos/03-mithril-shadow-audit/.flint-fixture.json', line: 1 },
      { file: 'demos/04-sentinel/.flint-fixture.json', line: 1 },
      { file: 'demos/05-semantic-refactor/.flint-fixture.json', line: 1 },
      { file: 'demos/06-macro-recovery/.flint-fixture.json', line: 1 },
      {
        file: '.flint-context/contracts/FIXTURE.1.contract.ts',
        line: 283,
        excerpt: 'summary: surface:"component", tokens:"../design-tokens.json", label:"..."',
        note: 'Contract impact rows specify tokens path; implementation omitted them.',
      },
    ],
    observed:
      'Seven of nine demo .flint-fixture.json files contain only `surface` + `label`; none declare a `tokens` path. The end-to-end test in server.audit-fixture.test.ts uses synthetic tokens, masking the missing field. A real `audit_ui_component` invocation against demos/01-rag-ui-builder/banner-compliant.tsx will not load demos/01-rag-ui-builder/design-tokens.json automatically.',
    rationale:
      'The contract claim "demos differentiate compliant vs broken because tokens are now resolved" depends on each fixture pointing at the right tokens file. Without the `tokens` field, server.ts falls back to the project default. The synthetic-token test path masks the gap, so beta canary passes by accident, not by design.',
    proposedFix:
      'Add `"tokens": "./design-tokens.json"` to demos/01 and demos/06 fixtures (the two with both compliant + broken variants). Create demos/<dir>/design-tokens.json for any demo missing it. Lower-priority demos (02, 03, 04, 05, figma-d2c/{mui,shadcn,tailwind}) can be wired in a follow-up phase.',
  },
  {
    id: 'CODE-002',
    title: 'Mithril surface filter implementation duplicates branch logic instead of delegating to a shared matcher',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      { file: 'flint-mcp/src/core/MithrilLinter.ts', line: 2440, note: 'Inline 3-branch if/else inclusion table.' },
      { file: 'flint-mcp/src/core/A11yLinter.ts', line: 201, note: 'Identical semantics already encoded in ruleMatchesSurface.' },
    ],
    observed:
      'MithrilLinter.auditAllWithSurface (lines 2440-2450) reimplements the inclusion table inline. A11yLinter exports `ruleMatchesSurface` (lines 201-209) that already encodes the same semantics.',
    rationale:
      'Two parallel implementations of a single security/correctness-relevant predicate (silent-skip semantics) drift over time. Risk register #3 explicitly calls out misclassification harm. Centralizing eliminates a class of future bugs.',
    proposedFix:
      'Move `ruleMatchesSurface` to shared/fixture-schema.ts (or a sibling pure module) and import it from both linters. Keeps the inclusion table single-source.',
  },
  {
    id: 'CODE-003',
    title: 'Fixture cache stores result only at startDir — JSDoc claims intermediate caching that does not exist',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 191,
        excerpt: '// If the fixture was found at an ancestor directory, we also cache the\n// intermediate directories to avoid redundant walk-ups on the next call.\n_cache.set(startDir, resolved)',
        note: 'JSDoc claims intermediate ancestor caching; implementation only caches the original startDir.',
      },
    ],
    observed:
      'fixtureResolver caches the resolved fixture under the `startDir` key only. Sibling files in the same directory hit cache (good), but cousin files in a child directory re-run the full walk-up. JSDoc claims intermediate ancestor caching that the code does not perform.',
    rationale:
      'Invariant `resolver-walkup-latency-warm-cache` is satisfied (sibling files hit). The cache miss on cousin directories is benign for the swarm pre-warm path (which iterates unique dirs anyway). Flagging only because comment vs implementation drift is a future-bug attractor.',
    proposedFix:
      'Either (a) update the comment to match implementation (only startDir cached — chosen path, lower risk), or (b) implement what the comment said by walking back down from fixtureDir to startDir setting each directory in the chain. Option (a) recommended.',
  },
  {
    id: 'CODE-004',
    title: 'Mithril filter passes `appliesTo === "component"` unconditionally — matches A11y semantics',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      { file: 'flint-mcp/src/core/MithrilLinter.ts', line: 2442 },
      { file: 'flint-mcp/src/core/A11yLinter.ts', line: 205 },
      { file: 'shared/fixture-schema.ts', line: 33 },
    ],
    observed:
      'In MithrilLinter.ts:2442, `appliesTo === "component"` is treated as universal pass-through (same as "any"). A11yLinter ruleMatchesSurface line 205 has the identical rule. Matches contract JSDoc ("present for symmetry; most permissive").',
    rationale:
      'Confirms the two filters agree on this corner case. Logging because the contract uses prose that could read either way; current semantics are "component appliesTo = any". No action needed — documenting consensus.',
  },
  {
    id: 'CODE-005',
    title: 'Silent-skip semantics correctly preserved — no suppressed-log emission on hard-skip path',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    commandment: 5,
    evidence: [
      { file: 'flint-mcp/src/core/A11yLinter.ts', line: 244, note: 'Array.filter; no log statement.' },
      { file: 'flint-mcp/src/core/MithrilLinter.ts', line: 2439, note: 'Map population skip; no log statement.' },
    ],
    observed:
      'A11yLinter.auditWithSurface filters violations post-audit via Array.filter; no log statement. MithrilLinter.auditAllWithSurface skips entries via Map population; no log statement. Both have JSDoc contract noting "silently skipped — no log, no suppressed entry."',
    rationale:
      'Invariant `no-suppressed-log-spam` holds at the source level. Compiles with C5 obligation: silent-skip does not bypass enforcement on the matching surface (rules still run on document/section as appropriate).',
  },
  {
    id: 'CODE-006',
    title: 'Append-only discipline preserved on shared linter files',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      { file: 'flint-mcp/src/core/MithrilLinter.ts', line: 2406, note: 'FIXTURE.1 block starts after existing exports.' },
      { file: 'flint-mcp/src/core/A11yLinter.ts', line: 181, note: 'FIXTURE.1 block starts after existing default export.' },
    ],
    observed:
      'MithrilLinter.ts FIXTURE.1 block starts at line 2406 after existing exports. A11yLinter.ts FIXTURE.1 block starts at line 181 after the existing default export. Neither modifies pre-existing visitors or rule-loading.',
    rationale:
      'Coordinated with RUNTIME.1 + FIGMA-LINT.1 territory per risk register #2 mitigation. No conflict surface.',
  },
  {
    id: 'CODE-007',
    title: 'Path-traversal guard correctly applied to fixture.tokens, not just fixture file location',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    commandment: 14,
    evidence: [
      { file: 'flint-mcp/src/core/fixtureResolver.ts', line: 167, note: 'Tokens path resolved against fixture dir; isWithinRoot check before any I/O.' },
    ],
    observed:
      'fixtureResolver.resolveFixture lines 167-176 resolve `fixture.tokens` against the fixture file directory and assert the result startsWith projectRoot via `isWithinRoot`. Throws actionable error on traversal attempt.',
    rationale:
      'Risk register #4 (high severity) is mitigated as specified. Note: trust boundary on the fixture JSON itself is in security reviewer scope, flagged there.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FIXTURE.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'shared/fixture-schema.ts (Zod schema, types, defaults)',
      'flint-mcp/src/core/fixtureResolver.ts (walk-up + cache + path-traversal guard)',
      'flint-mcp/src/core/mithrilAppliesTo.ts (static map; all rules → any)',
      'flint-mcp/src/core/MithrilLinter.ts (auditAllWithSurface, append-only)',
      'flint-mcp/src/core/A11yLinter.ts (auditWithSurface + ruleMatchesSurface, append-only)',
      'flint-mcp/src/core/a11y/types.ts (appliesTo? field)',
      'flint-mcp/src/core/a11y/rules/* (per-rule classification across 11 modules)',
      'flint-mcp/src/server.ts (audit_ui_component fixture wiring at line ~2023)',
      'flint-mcp/src/tools/swarm.ts (per-directory cache pre-warm)',
      'demos/**/.flint-fixture.json (9 files)',
      'flint-mcp/src/__tests__/server.audit-fixture.test.ts (24 tests incl. beta-gate canaries)',
    ],
    markdownFile: 'FIXTURE.1-code-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'C5 (silent-skip does not bypass critical a11y on matching surface)', result: 'pass', evidence: 'auditWithSurface filter only drops surface-mismatched rules; document-surface still runs A11Y-050' },
    { criterion: 'C13 (no regex on source code)', result: 'pass', evidence: 'fixtureResolver uses path/JSON.parse only; linters use Babel AST' },
    { criterion: 'C14 (no fs/git bypass)', result: 'pass', evidence: 'fs.readFileSync/existsSync only inside resolver; no git access' },
    { criterion: 'C16 (in-memory validation)', result: 'pass', evidence: 'N/A — no AI surface in this phase' },
    { criterion: 'Invariant: applicability-zero-false-escalations', result: 'pass', evidence: 'auditWithSurface filter unit tests assert zero leakage on component surface' },
    { criterion: 'Invariant: no-suppressed-log-spam', result: 'pass', evidence: 'no log statements in either filter path' },
    { criterion: 'Invariant: demo-compliant-clean (=== 0 violations)', result: 'fail', evidence: 'Test harness asserts via synthetic tokens; real demo fixtures lacked tokens field — see CODE-001', relatedFindings: ['CODE-001'] },
    { criterion: 'Invariant: demo-broken-distinguishable (>= 5)', result: 'fail', evidence: 'Synthetic test passes but real fixture wiring incomplete — see CODE-001', relatedFindings: ['CODE-001'] },
    { criterion: 'TestBoundary coverage (9/9 boundaries have it() blocks)', result: 'pass', evidence: 'server.audit-fixture.test.ts includes ruleMatchesSurface, auditWithSurface, auditAllWithSurface, beta-gate canaries' },
    { criterion: 'Type discipline (string-literal unions; Zod .strict())', result: 'pass', evidence: 'shared/fixture-schema.ts:99-118' },
    { criterion: 'Append-only on MithrilLinter.ts and A11yLinter.ts', result: 'pass', evidence: 'New blocks added after existing exports; no visitor restructure' },
    { criterion: 'Cache discipline (module-local Map + clearFixtureCache exported)', result: 'pass', evidence: 'fixtureResolver.ts:34, 40' },
    { criterion: 'Demo fixture correctness (valid JSON; surfaces accurate; tokens wired)', result: 'fail', evidence: 'JSON valid, surfaces correct; tokens fields missing on 7/9 — see CODE-001', relatedFindings: ['CODE-001'] },
    { criterion: 'A11y rule classification covers all 11 modules', result: 'pass', evidence: '70 appliesTo entries across 11 rule files' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'shared/fixture-schema.ts',
      'flint-mcp/src/core/fixtureResolver.ts',
      'flint-mcp/src/core/mithrilAppliesTo.ts',
      'flint-mcp/src/core/MithrilLinter.ts (FIXTURE.1 block)',
      'flint-mcp/src/core/A11yLinter.ts (FIXTURE.1 block)',
      'flint-mcp/src/core/a11y/types.ts',
      'flint-mcp/src/core/a11y/rules/landmarks.ts',
      'flint-mcp/src/core/a11y/rules/structure.ts',
      'flint-mcp/src/server.ts (audit_ui_component fixture wiring)',
      'flint-mcp/src/tools/swarm.ts (cache pre-warm)',
      'flint-mcp/src/__tests__/server.audit-fixture.test.ts',
      'demos/**/.flint-fixture.json (9 files spot-checked)',
    ],
    skipped: [
      'src/components/editor/StatusBar.tsx — UX reviewer scope',
      'src/store/canvasStore.ts — UX reviewer scope',
      'Trust boundary / malicious fixture parsing — security reviewer scope',
      'Per-rule a11y classifications across non-landmark/structure modules — sampled, not exhaustively re-verified',
      'TSC + test execution — Bash invocation denied this round; verdict relies on source-level review',
    ],
  },
};
