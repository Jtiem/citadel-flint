import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Broken/compliant delta is numerically detectable but visually invisible',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'demos/01-rag-ui-builder/banner-broken.tsx',
        line: 16,
        excerpt: 'bg-[#0D5FD9] rounded-[13px] p-[47px] flex flex-col gap-[15px]',
        note: 'Every drift is ±1px vs compliant (48px, 12px, 16px). Color ΔE ≈ 3.4 vs #0066FF — above Mithril threshold but visually near-identical.',
      },
      {
        file: 'demos/01-rag-ui-builder/banner-compliant.tsx',
        line: 16,
        excerpt: 'bg-[#0066FF] rounded-[12px] p-[48px] flex flex-col gap-[16px]',
        note: 'Counterweight — the two files render nearly identically.',
      },
      {
        file: 'demos/01-rag-ui-builder/banner-broken.tsx',
        line: 17,
        excerpt: 'text-[11px] ... tracking-[0.08em]',
        note: '11 vs 12 — 1px font-size drift repeats across lines 17/21/25/29.',
      },
    ],
    observed:
      'All 12 drifts in banner-broken.tsx are ±1px or ΔE ≈ 3 deviations from the compliant counterpart. Rendered side-by-side, a designer cannot tell them apart.',
    rationale:
      'The demo\'s job is to produce an "aha, my eyes missed it but Mithril caught it" moment. When the drift is visually invisible, the moment collapses into "trust the tool\'s numbers." A mixed set — one or two loud drifts plus the current subtle set — would let the beta tester see the broken render first, then discover the report caught more than they noticed.',
    proposedFix:
      'Change one or two drifts to visually unmissable values: e.g. p-[64px] (fat banner padding) and bg-[#D90D0D] (unmistakably off-brand red, ΔE > 40). Keep the other 10 subtle to showcase forensic depth.',
  },
  {
    id: 'WARN-2',
    title: 'TokenAdapterError codes are SHOUT_CASE engine identifiers, not designer-readable',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 35,
        excerpt: "code: 'ALIAS_CYCLE' | 'ALIAS_BROKEN_REF'",
        note: 'Error code union — no plain-English label or remediation hint attached.',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 246,
        excerpt: "code: 'ALIAS_CYCLE', tokenPath: originPath, ref: initialRef, chain: [...]",
        note: 'Cycle error payload is engine-flavoured; no user-facing message.',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 257,
        excerpt: "code: 'ALIAS_BROKEN_REF', tokenPath: originPath, ref: currentRef",
        note: 'Broken-ref error — same issue.',
      },
    ],
    observed:
      'The two TokenAdapterError codes are raw SHOUT_CASE strings. If a beta tester\'s tokens file has an alias typo, the error will reach a Glass StatusBar popover or CLI as the literal text "ALIAS_BROKEN_REF" with no remediation hint.',
    rationale:
      'CX.3 ErrorTaxonomy (50 rule explanations) sets the plain-English bar for user-facing engine errors. Designers read "Unresolved token reference: fontSize.bigly doesn\'t exist. Did you mean fontSize.base?" — not ALIAS_BROKEN_REF. FIXTURE.1.1\'s non-goals exclude new telemetry, so this is a follow-up dependency, not a blocker. But before these errors reach any user surface, they must be mapped to the taxonomy.',
    proposedFix:
      'In a follow-up phase, add ALIAS_CYCLE and ALIAS_BROKEN_REF entries to src/core/ErrorTaxonomy with plain-English messages and fix suggestions. Out of scope for FIXTURE.1.1.',
  },
  {
    id: 'SUG-1',
    title: 'Broken fixture exercises zero alias-resolution logic',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'demos/01-rag-ui-builder/design-tokens.json',
        line: 94,
        excerpt: '"fontSize": { "xs": {...}, "sm": {...}, "base": {...}, "lg": {...}, "xl": {...} }',
        note: 'No alias leaves anywhere in the fixture document.',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 233,
        excerpt: '_resolveAlias — iterative resolver with visited-set guard, cycle + broken-ref emission',
        note: '~60 LOC of alias machinery with no demo coverage.',
      },
    ],
    observed:
      'The adapter invests meaningful complexity in alias resolution (single-hop, multi-hop, cycle, broken ref) but the demo fixture contains zero aliases. A beta tester will never see the feature work or fail.',
    rationale:
      'Demo fixtures are the product\'s "try this at home" narrative. If alias resolution is worth building, it\'s worth teaching. Adding one alias leaf to design-tokens.json doubles as a living regression test and a story beat.',
    proposedFix:
      'Add fontSize.cta: { $value: "{fontSize.sm}" } to demos/01-rag-ui-builder/design-tokens.json and reference 14px via that alias in the compliant banner. Verify banner-compliant.tsx still audits to 0.',
  },
  {
    id: 'SUG-2',
    title: "collection_name: 'fixture' hard-code limits reuse beyond fixture loading",
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 221,
        excerpt: "collection_name: 'fixture', mode: 'default'",
        note: 'Every flattened token is tagged as a fixture collection.',
      },
    ],
    observed:
      "All synthesized DesignToken entries get collection_name: 'fixture', regardless of any top-level DTCG collection grouping in the source document.",
    rationale:
      "Fine for FIXTURE.1.1 (contract explicitly constrains to fixture-loaded documents). Flagged for the eventual 'bring your own DTCG file' story — multi-collection documents will lose their provenance, which brushes against Commandment 2.",
    proposedFix:
      'When the adapter is reused outside fixture loading, accept a { collectionName } option on normalizeTokenShape or detect $metadata.collection DTCG extensions.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FIXTURE.1.1',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-19',
    round: 1,
    scope: [
      'demos/01-rag-ui-builder/banner-broken.tsx (demo fixture storytelling)',
      'demos/01-rag-ui-builder/banner-compliant.tsx (storytelling counterweight)',
      'flint-mcp/src/core/dtcgTokenAdapter.ts (error-code UX surface only)',
      'demos/01-rag-ui-builder/design-tokens.json (token provenance surface)',
    ],
    markdownFile: 'FIXTURE.1.1-ux-review-2026-04-19.md',
  },
  rubric: [
    {
      criterion: 'banner-broken.tsx produces >=5 violations (contract demo-broken-distinguishable)',
      result: 'pass',
    },
    {
      criterion: 'banner-compliant.tsx produces 0 violations once adapter flattens DTCG doc',
      result: 'pass',
    },
    {
      criterion: 'Broken vs compliant delta is visually legible to a non-technical beta tester',
      result: 'fail',
      evidence:
        'All 12 drifts are +/-1px or DeltaE ~3; see banner-broken.tsx:16-29 vs banner-compliant.tsx:16-29. Rendered side-by-side the files look identical.',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'TokenAdapterError codes are plain-English-friendly for a Glass StatusBar popover',
      result: 'fail',
      evidence:
        "dtcgTokenAdapter.ts:35 defines 'ALIAS_CYCLE' | 'ALIAS_BROKEN_REF' as raw SHOUT_CASE; no taxonomy entry, no remediation hint.",
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Violation reporting preserves author-intended token descriptions (Commandment 2)',
      result: 'pass',
      evidence:
        "dtcgTokenAdapter.ts:220 preserves leaf.$description into DesignToken.description; Mithril's nearestToken suggestions surface author intent.",
    },
    {
      criterion: 'No new UI surface introduced without journey justification',
      result: 'pass',
    },
    {
      criterion: 'Demo fixture exercises the adapter features it builds (alias resolution)',
      result: 'fail',
      evidence:
        'design-tokens.json has zero alias leaves; adapter _resolveAlias (dtcgTokenAdapter.ts:233) is unexercised by the demo.',
      relatedFindings: ['SUG-1'],
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'demos/01-rag-ui-builder/banner-broken.tsx',
      'demos/01-rag-ui-builder/banner-compliant.tsx',
      'demos/01-rag-ui-builder/design-tokens.json',
      'flint-mcp/src/core/dtcgTokenAdapter.ts (UX surface only — error codes)',
      '.flint-context/contracts/FIXTURE.1.1-contract.md',
    ],
    skipped: [
      'flint-mcp/src/server.ts — one-line engine swap, no UX surface',
      'flint-mcp/src/__tests__/server.audit-fixture.test.ts — internal canary, no UX surface',
      'flint-mcp/src/tools/swarm.ts — engine parity, no UX surface',
    ],
  },
};
