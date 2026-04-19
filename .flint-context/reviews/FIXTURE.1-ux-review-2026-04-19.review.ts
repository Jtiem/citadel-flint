/**
 * FIXTURE.1 UX Review — Audit Context System
 * Pilot REPLICATION run. Surfaced inline by flint-ux-critic (Write tool still
 * unavailable in this session despite agent-definition update — pilot meta-finding
 * for post-replication report). Persisted by parent orchestrator.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Truncation threshold of 12 chars cuts useful audit-context labels mid-word',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 272,
        excerpt: 'const AUDIT_LABEL_MAX_CHARS = 12',
        note: 'Hardcoded 12-char limit on visible pill label.',
      },
      {
        file: 'src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx',
        line: 77,
        note: 'Test fixture uses "MUI demo context" which collapses to "MUI demo con…" — the most informative word ("context") is truncated.',
      },
    ],
    observed:
      'AUDIT_LABEL_MAX_CHARS is set to 12. The contract\'s own example fixture label "MUI demo context" renders as "MUI demo con…", cutting the most informative word.',
    rationale:
      'Contract §13 frames the pill as a "small but visible trust signal" so a designer doesn\'t need to read JSON to know which audit context applies. Truncating below typical fixture-label length defeats that goal — designers see a fragment that could mean anything.',
    proposedFix:
      'Raise to ~24 chars or drop the char-cap entirely and use Tailwind utilities like `max-w-[160px] truncate`. The CSS-truncated version handles variable-width fonts more honestly than a hardcoded char count.',
  },
  {
    id: 'WARN-2',
    title: 'Bare label without prefix or icon reads as a brand badge, not an audit-context signal',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 313,
        note: 'Pill renders {displayLabel} with no prefix, no icon, no visible context indicator.',
      },
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 308,
        note: 'aria-label correctly says "Audit context: …" but sighted users get no equivalent.',
      },
    ],
    observed:
      'A small chip showing just "MUI" next to CoverageBadge + RuntimeAuditPill reads as "this project uses MUI" rather than "the auditor is interpreting this file under the MUI fixture context."',
    rationale:
      'Citadel-vocabulary gate: visible UI must match audience mental model. The pill is meant to convey audit context, not project tech stack. Without a prefix or icon, the semantic intent is invisible to sighted users — only screen-reader users get the framing.',
    proposedFix:
      'Prepend a small icon (Crosshair, Target, or similar) OR render as `Context · ${displayLabel}`. The aria-label can stay as-is.',
  },
  {
    id: 'SUG-1',
    title: 'Tooltip is mouse-only via native title=; sighted keyboard users get nothing for truncated labels',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    commandment: 5,
    evidence: [
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 309,
        note: 'Uses native `title=` attribute.',
      },
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 306,
        note: 'Span is `role="status"` and not focusable — keyboard users cannot trigger native title tooltip.',
      },
    ],
    observed:
      'Native `title` only fires on mouse hover. With WARN-1 unfixed, sighted keyboard users have no way to reveal the full label of a truncated audit-context pill.',
    rationale:
      'Glass already has hover-only popovers in StatusBar (CoveragePopover) so this is consistent precedent. Marked suggestion rather than warning because Commandment 5 floor is met (aria-label carries full text for screen reader users); raising to focus-revealable would exceed the floor.',
    proposedFix:
      'Either widen the pill (per WARN-1, removing the truncation problem entirely) OR make the span focusable (tabindex=0) with an on-focus tooltip matching the existing Figma popover pattern.',
  },
  {
    id: 'SUG-2',
    title: 'No integration test exercises the MCP → store → pill data path; setLatestAudit action never invoked in tests',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx',
        line: 43,
        note: 'All 10 tests drive the pill via useCanvasStore.setState(...) directly, bypassing the setLatestAudit action.',
      },
      {
        file: 'src/store/canvasStore.ts',
        line: 962,
        note: 'setLatestAudit action exists but is never exercised by test code.',
      },
    ],
    observed:
      'All 10 tests bypass the store action by calling setState directly. The setLatestAudit action — the actual production data-flow entry point — has zero test coverage.',
    rationale:
      'A future refactor that narrowed the action signature could silently drop fixtureContext from incoming MCP responses while every existing test still passes. The action is the contract surface; bypassing it in tests creates a silent divergence risk.',
    proposedFix:
      'Add one test calling `useCanvasStore.getState().setLatestAudit({...payload})` and asserting the pill renders with the expected fixtureContext. ~6 lines.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FIXTURE.1',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-19',
    round: 1,
    scope: [
      'AuditContextPill component (StatusBar.tsx lines 269-316)',
      'canvasStore.ts latestAudit slice + setLatestAudit action (lines 291-308, 517, 703, 962)',
      'StatusBar.fixtureContext.test.tsx (10 tests)',
      'Contract §7 (acceptance criteria) + §13 (designer surface intent)',
    ],
    markdownFile: 'FIXTURE.1-ux-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'Audience match — pill is genuinely valuable to designer, not engineer-noise', result: 'pass', evidence: 'Pill conveys audit context label without exposing internal type names like FlintFixture or appliesTo' },
    { criterion: 'Behavior clarity — designer can state in one sentence what pill tells them', result: 'fail', evidence: 'Bare label reads as brand badge; semantic intent invisible to sighted users', relatedFindings: ['WARN-2'] },
    { criterion: '80% case priority — optimized for single-fixture project, not rare multi-fixture monorepo', result: 'pass' },
    { criterion: 'Accessibility — role="status" + aria-label decorated', result: 'pass', evidence: 'StatusBar.tsx:306-308' },
    { criterion: 'Tooltip accessible to keyboard users', result: 'fail', evidence: 'Native title attribute is mouse-only; pill not focusable', relatedFindings: ['SUG-1'] },
    { criterion: 'Truncation preserves full text in tooltip + aria-label', result: 'pass', evidence: 'Both title and aria-label carry the full label string' },
    { criterion: 'No engineer jargon in user-visible copy ("FlintFixture", "ResolvedFixture", "appliesTo")', result: 'pass' },
    { criterion: 'Truncation threshold appropriate for typical fixture labels', result: 'fail', evidence: '12-char limit cuts contract example "MUI demo context" mid-word', relatedFindings: ['WARN-1'] },
    { criterion: 'Renderless when null — zero DOM, no whitespace badge', result: 'pass' },
    { criterion: 'No regression on Phase 2 surface — CoverageBadge + RuntimeAuditGate unchanged', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/components/editor/StatusBar.tsx (Phase 3 additions only — AuditContextPill at lines 269-316)',
      'src/store/canvasStore.ts (Phase 3 additions only — latestAudit + setLatestAudit)',
      'src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx (10 tests)',
      '.flint-context/contracts/FIXTURE.1-contract.md (§7 + §13 only)',
    ],
    skipped: [
      'shared/fixture-schema.ts + flint-mcp/src/core/fixtureResolver.ts — code reviewer scope',
      'Rule applicability metadata (mithrilAppliesTo, A11y rule modules) — code reviewer scope',
      'Audit pipeline (server.ts, swarm.ts) — code reviewer scope',
      'Demo .flint-fixture.json files — code reviewer scope',
      'Path-traversal guard, untrusted JSON parsing — security reviewer scope',
      'Pre-existing 2 StatusBar.test.tsx Figma popover failures — owned by RUNTIME.1, out of FIXTURE.1 scope',
    ],
  },
};
