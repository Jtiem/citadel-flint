/**
 * Phase 2 Code Review — PostCSS + CSS Modules + Tailwind v4 CSS-First
 * Machine-readable sibling of PHASE2-code-review-2026-04-18.md
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title:
      '`customPropertyMap` and `stylesheetThemes` declared on AuditAllOptions but never consumed in auditAll',
    severity: 'blocking',
    scope: 'cross-file',
    status: 'open',
    commandment: 2,
    evidence: [
      {
        file: 'flint-mcp/src/core/MithrilLinter.ts',
        line: 1923,
        excerpt: 'customPropertyMap?: ReadonlyMap<string, string>',
        note: 'Field declared with JSDoc asserting Mithril consults it; no consumer in file.',
      },
      {
        file: 'flint-mcp/src/core/MithrilLinter.ts',
        line: 1929,
        excerpt:
          'stylesheetThemes?: ReadonlyArray<Partial<Record<string, Record<string, string>>>>',
        note: 'Field declared with JSDoc asserting merge with tailwindTheme; no consumer in file.',
      },
      {
        file: 'flint-mcp/src/core/MithrilLinter.ts',
        line: 2059,
        note:
          'auditAll body spans through ~line 2250; grep finds zero references to customPropertyMap or stylesheetThemes after the interface block.',
      },
      {
        file: 'flint-mcp/src/core/MithrilLinter.ts',
        line: 324,
        excerpt: 'export function parseCssColorToHex(value: string): string | null',
        note:
          'No customPropertyMap parameter. var(--primary) without inline fallback still returns null.',
      },
      {
        file: '.flint-context/contracts/PHASE2-postcss-css-modules.contract.ts',
        line: 1044,
        excerpt:
          "When customPropertyMap is supplied and contains `--primary: #0066cc`, parseCssColorToHex('var(--primary)') returns '#0066cc' instead of null.",
        note: 'Contract integration invariant — unimplemented.',
      },
      {
        file: '.flint-context/contracts/PHASE2-postcss-css-modules.contract.ts',
        line: 589,
        excerpt:
          'var(--primary) resolves via customPropertyMap to a drift-y hex → MITHRIL-IST-COL fires',
        note: 'Behavior invariant — unimplemented.',
      },
    ],
    observed:
      'AuditAllOptions.customPropertyMap and AuditAllOptions.stylesheetThemes are declared and typed at MithrilLinter.ts:1923 and :1929. No code path inside auditAll or any visitor destructures, forwards, or reads these fields. parseCssColorToHex has no customPropertyMap parameter. No __tests__ file passes these options into an auditAll call.',
    rationale:
      'Phase 2 coverage-classifier upgrades flip file verdicts from partial to parsed when customPropertyMap resolves a var() or when stylesheetThemes are present. Because the fields are not plumbed into Mithril itself, a file marked parsed after Phase 2 is still unlinted for CSS-declared color drift — the detector sees null from parseCssColorToHex. This produces a false "governed" signal, which Commandment 2 (No Hallucinated Styling) forbids. stylesheetThemes has the symmetric gap: Tailwind v4 CSS-first projects get the coverage upgrade but no drift checks against @theme-declared tokens.',
    proposedFix:
      'In auditAll, immediately after the existing Phase 1 tailwindTheme merge block (MithrilLinter.ts:2068-2074), iterate options.stylesheetThemes and call mergeThemeTokens for each. Add an optional customPropertyMap parameter to parseCssColorToHex; when the input matches var(--name) without fallback and the map is supplied, look up the name and recurse on the resolved value. Thread options.customPropertyMap through visitInlineStyles and every other parseCssColorToHex call site (lines 363, 424, 1194-1195). Add at least one integration test per field: auditAll with customPropertyMap containing --primary: #ff0000 and tokens containing brand-blue: #0000ff produces MITHRIL-IST-COL drift on JSX with style={{ color: "var(--primary)" }}.',
  },
  {
    id: 'WARN-1',
    title:
      '`extendedCustom` population skips whenever any standard @theme section has entries',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/tailwindV4ThemeParser.ts',
        line: 174,
        excerpt:
          'function isInSomeSectionOfBlock(varName, sections) { for (const sectionValues of Object.values(sections)) if (sectionValues && Object.keys(sectionValues).length > 0) return true; return false; }',
        note:
          'Helper ignores varName; returns true if any section has any entry.',
      },
      {
        file: 'flint-mcp/src/core/tailwindV4ThemeParser.ts',
        line: 125,
        note:
          'Enclosing loop uses isInSomeSectionOfBlock to decide whether to add to extendedCustom; short-circuits for virtually every real @theme block.',
      },
    ],
    observed:
      'The enclosing loop collects decl into extendedCustom only when isInSomeSectionOfBlock returns false. Because that helper returns true as soon as ANY section has any entry, no declaration is ever added to extendedCustom when a block contains at least one standard token.',
    rationale:
      'extendedCustom is documented as diagnostic-only and not fed into drift detection, so this does not break the contract. But the code claims to surface custom-prefix declarations and effectively never does — dead diagnostic.',
    proposedFix:
      'Replace isInSomeSectionOfBlock with a direct call to the existing mapThemeVarToSection(decl.name); if it returns null, add to extendedCustom. Drop isInSomeSectionOfBlock entirely.',
  },
  {
    id: 'WARN-2',
    title:
      'Corpus runner silently skips when fixtures directory missing (corpus-fidelity invariant unenforced)',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/__tests__/cssModulesResolver.test.ts',
        line: 444,
        excerpt:
          "} catch (_e) { console.warn('Corpus fixtures directory not found — skipping corpus runner:', FIXTURES_DIR); return; }",
        note: 'Silent early return. Contract invariant is not evaluated in that run.',
      },
    ],
    observed:
      'When the corpus fixtures directory cannot be read, the test logs a warning and returns early. No expect() runs; Vitest reports the test as passing.',
    rationale:
      'Contract invariant cssModulesResolver-fidelity >= 0.95 depends on this test running end to end. A future refactor that relocates the fixtures directory would silently disable the entire corpus check with no red signal in CI.',
    proposedFix:
      'Replace the console.warn + return with: throw new Error(`Corpus fixtures directory required for contract invariant cssModulesResolver-fidelity >= 0.95: ${FIXTURES_DIR}`).',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'PHASE2-postcss-css-modules',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-18',
    round: 2,
    scope: [
      '4 new engine services (cssStylesheetLoader, cssCustomPropertyMap, cssModulesResolver, tailwindV4ThemeParser)',
      '4 classifier upgrade paths in coverageClassifier.ts',
      'MithrilLinter AuditAllOptions additive fields',
      '~64 new unit tests + 20-fixture corpus runner + 2 benchmarks',
    ],
    markdownFile: 'PHASE2-code-review-2026-04-18.md',
  },
  rubric: [
    {
      criterion:
        'No path.replaceWith or AST mutation in Phase 2 files (Commandment 13)',
      result: 'pass',
    },
    {
      criterion:
        'No child_process, http, vm, eval, Function() in Phase 2 files (Commandment 14 kin)',
      result: 'pass',
    },
    {
      criterion:
        'No fs.writeFile / fs.appendFile / fs.unlink in Phase 2 files',
      result: 'pass',
    },
    {
      criterion:
        '2MB size cap enforced via fs.stat BEFORE fs.readFile (SECURITY-CRITICAL)',
      result: 'pass',
      evidence:
        'cssStylesheetLoader.ts:361-380 stats then rejects; bounded tests at cssStylesheetLoader.test.ts:128-164',
    },
    {
      criterion:
        'Path-traversal gate runs BEFORE any I/O, with spy-asserted zero readFile calls (SECURITY-CRITICAL)',
      result: 'pass',
      evidence:
        'cssModulesResolver.ts:271 runs isOutsideProject before readFile; cssModulesResolver.test.ts:110-146 & 150-174 spy-assert',
    },
    {
      criterion: 'Boundary tests at exactly 2_000_000 (accepted) and 2_000_001 (rejected)',
      result: 'pass',
    },
    {
      criterion:
        'Cycle detection terminates with null on --a: var(--b); --b: var(--a)',
      result: 'pass',
      evidence: 'cssCustomPropertyMap.test.ts:150-177',
    },
    {
      criterion:
        'auditAll signature stability — all existing callers unaffected (additive optional fields only)',
      result: 'pass',
    },
    {
      criterion: 'Phase 0 coverage rules 1-4 and parse-failure path preserved',
      result: 'pass',
      evidence: 'coverageClassifier.test.ts test 55 at line 1031',
    },
    {
      criterion: 'Phase 1 tailwindConfig and classExpansions upgrade paths preserved',
      result: 'pass',
      evidence: 'coverageClassifier.test.ts test 55b at line 1043',
    },
    {
      criterion:
        'All 4 Phase 2 upgrade scenarios have positive + negative tests',
      result: 'pass',
      evidence: 'coverageClassifier.test.ts tests 46-57',
    },
    {
      criterion:
        '.module.css double-trigger suppressed when CSS Modules fully resolved',
      result: 'pass',
      evidence: 'coverageClassifier.ts:642-645',
    },
    {
      criterion:
        'Corpus runner genuinely diffs against expected.json (import count, resolved flag, failureReason, bindingName, namedImports length, classBindings keys)',
      result: 'pass',
      evidence: 'cssModulesResolver.test.ts:497-567',
    },
    {
      criterion:
        'AuditAllOptions.customPropertyMap is consumed by parseCssColorToHex or visitInlineStyles when supplied',
      result: 'fail',
      evidence:
        'MithrilLinter.ts: field declared at 1923; zero references in auditAll body or parseCssColorToHex',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion:
        'AuditAllOptions.stylesheetThemes is merged into workingTokens before visitors run',
      result: 'fail',
      evidence:
        'MithrilLinter.ts: field declared at 1929; zero references after the interface declaration',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion:
        'At least one test exercises auditAll({ customPropertyMap }) and asserts MITHRIL-IST-COL fires on a drift-y var()',
      result: 'fail',
      evidence:
        'Grep of flint-mcp/src/core/__tests__/ for customPropertyMap returns zero matches inside auditAll( call sites',
      relatedFindings: ['BLK-1'],
    },
    { criterion: 'TSC exits 0', result: 'pass' },
    {
      criterion:
        'No hardcoded secrets, API keys, or renderer-side Node imports',
      result: 'pass',
      evidence: 'Changes confined to flint-mcp/src/core/; no renderer or IPC surface touched',
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'flint-mcp/src/core/cssStylesheetLoader.ts',
      'flint-mcp/src/core/cssCustomPropertyMap.ts',
      'flint-mcp/src/core/cssModulesResolver.ts',
      'flint-mcp/src/core/tailwindV4ThemeParser.ts',
      'flint-mcp/src/core/coverageClassifier.ts (Phase 2 upgrade paths only)',
      'flint-mcp/src/core/MithrilLinter.ts (AuditAllOptions + auditAll body)',
      'flint-mcp/src/core/__tests__/cssStylesheetLoader.test.ts',
      'flint-mcp/src/core/__tests__/cssStylesheetLoader.bench.ts',
      'flint-mcp/src/core/__tests__/cssCustomPropertyMap.test.ts',
      'flint-mcp/src/core/__tests__/cssModulesResolver.test.ts',
      'flint-mcp/src/core/__tests__/tailwindV4ThemeParser.test.ts',
      'flint-mcp/src/core/__tests__/coverageClassifier.test.ts (Phase 2 cases only)',
      '.flint-context/contracts/PHASE2-postcss-css-modules.contract.ts (signatures + invariants cross-referenced)',
    ],
    skipped: [
      'flint-mcp/src/core/__tests__/fixtures/css-modules/** — fidelity at 20/20 per brief; structure spot-checked only',
      'Phase 1 classifier paths — out of Phase 2 scope; regression covered by test 55b',
      'Glass UI / IPC / preload — Phase 2 declares zero IPC or UI changes',
    ],
  },
};
