/**
 * MINT.5 Phase 3 UX Review — Sync Polish + Type Safety
 * Pilot run (Lever A+B+E). Findings surfaced inline by flint-ux-critic
 * (which lacks the Write tool — see pilot feedback section); persisted by
 * the parent orchestrator into this structured form so scripts/render-review.ts
 * can produce the .md sibling deterministically.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Invalid <li>-inside-<li> HTML nesting in EmitDropdown menu structure',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    commandment: 5,
    evidence: [
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 261,
        note: 'Outer <li role="none"> is the platform-group wrapper.',
      },
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 274,
        note: 'Nested <li role="menuitem"> child for preview mode.',
      },
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 297,
        note: 'Nested <li role="menuitem"> child for write mode.',
      },
    ],
    observed:
      'The menu renders <ul role="menu"> → <li role="none"> (platform group wrapper) → nested <li role="menuitem"> children. <li> inside <li> without an intervening <ul>/<ol> is invalid HTML.',
    rationale:
      'Some screen readers (NVDA, JAWS) treat invalid list nesting inconsistently. Focus order works because tabIndex is managed manually, but assistive-tech announcement of "list with N items" can become "list with 5 items" instead of "menu with 10 items." Commandment 5 (Accessibility is a Compiler Error) treats this as a fail.',
    proposedFix:
      'Replace the outer <li role="none" key={platform}> with <React.Fragment key={platform}> so the menuitem children are direct children of the parent <ul role="menu">. Alternatively switch the parent to <div role="menu"> and use <div role="none"> wrappers throughout.',
  },
  {
    id: 'SUG-1',
    title: 'EmitDropdown trigger label "Emit" is engineer vocabulary, not designer vocabulary',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 237,
        note: 'Button text is the bare word "Emit"; only the title="Emit tokens" tooltip clarifies.',
      },
    ],
    observed:
      'Designers reading the TokenHealthBar see "Pull / Push / Resolve / Emit". The first three are sync verbs they recognize. "Emit" is engineer/compiler vocabulary ("emit JSON", "emit tokens to disk"). The tooltip helps hover users but not first-glance scannability.',
    rationale:
      'Plain-language-output principle. Phase 2 already removed Citadel/jargon copy ("Alliance OAuth"); Phase 3 reintroduces low-level vocabulary at the visible button label. Contract meta declares audience: \'designer\'. "Export" or "Hand off" reads more naturally to that audience.',
    proposedFix:
      'Change visible label to "Export" (verb parity with Pull/Push) or "Hand off"; keep the menu items as-is.',
  },
  {
    id: 'SUG-2',
    title: 'SyncStalenessBanner has redundant action vocabulary ("Pull to refresh." body + "Pull now" CTA)',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/mint/SyncStalenessBanner.tsx',
        line: 56,
        note: 'Body reads "Pull to refresh."',
      },
      {
        file: 'src/components/ui/mint/SyncStalenessBanner.tsx',
        line: 68,
        note: 'CTA reads "Pull now".',
      },
    ],
    observed:
      'Two near-identical phrasings 30px apart. The body sentence is descriptive ("Pull to refresh"), the button says "Pull now". Mild redundancy; a designer scanning the banner reads the same verb twice with slightly different surface forms.',
    rationale:
      'Copy density matters in narrow sidebars. Either drop the trailing "Pull to refresh." from the body (let the button carry the action) or change the CTA to a non-redundant label like "Refresh now."',
    proposedFix:
      'Trim the body to "Last synced 26 hours ago." and let the "Pull now" button be the only action vocabulary.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'MINT.5-phase3',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-19',
    round: 1,
    scope: [
      'EmitDropdown + ConfirmEmitDialog + SyncStalenessBanner (3 new presentational components)',
      'TokenHealthBar.tsx Phase 3 additions (emit cluster, lines ~120-295)',
      'TokenManager.tsx Phase 3 additions (emit + staleness wiring, lines 220-600, 820-855, 1047-1054)',
      'UX coverage scan of test files (not for code style)',
    ],
    markdownFile: 'MINT.5-phase3-ux-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'EmitDropdown has role="menu" + ARIA labelling + keyboard nav + outside-click + Escape close', result: 'pass', evidence: 'EmitDropdown.tsx:96-133, 156-196' },
    { criterion: 'ConfirmEmitDialog has FocusTrap + role="dialog" + aria-modal + Escape cancels + asymmetric initial focus on Cancel', result: 'pass', evidence: 'ConfirmEmitDialog.tsx:58, 84-94' },
    { criterion: 'ConfirmEmitDialog confirm button telegraphs consequence ("Emit to disk", not "Confirm")', result: 'pass', evidence: 'ConfirmEmitDialog.tsx:143' },
    { criterion: 'SyncStalenessBanner has role="status" + aria-live="polite"', result: 'pass', evidence: 'SyncStalenessBanner.tsx:49-50' },
    { criterion: 'Banner returns null when !isStale || isDismissed', result: 'pass', evidence: 'SyncStalenessBanner.tsx:40' },
    { criterion: 'Asymmetric confirm flow for emit (preview fires immediately, write opens confirm)', result: 'pass', evidence: 'TokenManager.tsx:572-580' },
    { criterion: 'No Citadel codenames in user-visible copy (no "Scout", "Envoy")', result: 'pass' },
    { criterion: 'No MCP/OAuth jargon in user-visible copy', result: 'fail', evidence: 'EmitDropdown trigger label "Emit" is engineer vocabulary', relatedFindings: ['SUG-1'] },
    { criterion: 'Staleness copy reads naturally, no "stale" jargon, no thresholds exposed', result: 'pass', evidence: 'SyncStalenessBanner.tsx:56 — "Last synced 26 hours ago"' },
    { criterion: 'Phase 2 SyncActionCluster layout/spacing not regressed', result: 'pass', evidence: 'TokenHealthBar.tsx:284-292 emit cluster appended trailing with ml-auto fallback' },
    { criterion: 'Menu HTML structure is valid + ARIA-conformant', result: 'fail', evidence: 'Invalid <li>-inside-<li> nesting at EmitDropdown.tsx:261/274/297', relatedFindings: ['WARN-1'] },
    { criterion: 'EmitDropdown trigger keyboard activation (Space + Enter open menu)', result: 'pass', evidence: 'EmitDropdown.tsx:144' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/components/ui/mint/EmitDropdown.tsx',
      'src/components/ui/mint/ConfirmEmitDialog.tsx',
      'src/components/ui/mint/SyncStalenessBanner.tsx',
      'src/components/ui/TokenHealthBar.tsx (Phase 3 additions only)',
      'src/components/ui/TokenManager.tsx (Phase 3 additions only)',
      'src/components/ui/mint/__tests__/EmitDropdown.test.tsx (UX coverage scan)',
      'src/components/ui/mint/__tests__/ConfirmEmitDialog.test.tsx (UX coverage scan)',
      'src/components/ui/mint/__tests__/SyncStalenessBanner.test.tsx (UX coverage scan)',
    ],
    skipped: [
      'src/hooks/* — code reviewer scope',
      'src/store/* — code reviewer scope',
      'shared/ipc-validators.ts + electron/preload.ts + electron/mcpClient.ts + server/* — security reviewer scope',
      'shared/syncStaleness.ts + shared/mcp-classification.ts — code reviewer scope (pure helpers)',
    ],
  },
};
