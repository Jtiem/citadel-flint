import type { ReviewReport, ReviewFinding } from '../../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Write-mode emit fails open when confirmWrite is not wired',
    severity: 'warning',
    evidence: [
      {
        file: 'src/hooks/useEmitTokens.ts',
        line: 129,
        excerpt: "if (mode === 'write' && typeof confirmWrite === 'function') { ... }",
        note: 'Only prompts when caller supplies confirmWrite; otherwise proceeds to dryRun:false.',
      },
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 194,
        excerpt: 'function handleItemSelect(item) { onEmit([item.platform], item.mode); ... }',
        note: 'Dropdown never self-gates on write mode.',
      },
    ],
    observed:
      'EmitDropdown fires onEmit immediately for "write to disk" items. useEmitTokens only invokes a confirm dialog when the caller passes confirmWrite. If any consumer wires emit without confirmWrite, a single Enter/click writes files to disk.',
    rationale:
      'Destructive write actions must fail closed. The hook currently fails open — missing confirmation callback = no confirmation. Commandment 1 (Code is Truth) makes file writes durable; they deserve a defense-in-depth gate.',
    proposedFix:
      'Either (a) EmitDropdown renders ConfirmEmitDialog itself for write-mode items, or (b) useEmitTokens refuses write mode when confirmWrite is undefined.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title: 'ConfirmEmitDialog does not surface file count or overwrite risk',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/mint/ConfirmEmitDialog.tsx',
        line: 110,
        excerpt: '"The following platform files will be written to {outputDir}"',
        note: 'No file count, no filenames, no overwrite warning.',
      },
    ],
    observed:
      'Dialog body lists platforms as a comma-delimited string and shows outputDir but never states how many files will be written or whether existing files are overwritten.',
    rationale:
      'A non-technical designer confirming a destructive action needs to know the blast radius. "Tailwind config (write to disk)" is ambiguous — will it clobber my tailwind.config.js? Plain-language output directive (user memory) requires consequences be visible.',
    proposedFix:
      'Add a "N files will be created or overwritten" line and list resolved filenames. Source from the preview dry-run result.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title: 'EmitDropdown menu markup mixes role="menu" on a div with div-based menuitems',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 214,
        excerpt: '<div ... role="menu" aria-label="Emit tokens" ...>',
      },
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 90,
        excerpt: 'const menuRef = useRef<HTMLUListElement>(null);',
        note: 'Ref typed as ul but rendered element is a div.',
      },
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 222,
        excerpt: '<span className="block px-3 py-1 ...">{label}</span>',
        note: 'Span styled as block used as a section header with no grouping semantics.',
      },
    ],
    observed:
      'The menu element is a div, but menuRef is typed HTMLUListElement. Platform section labels are spans styled as block elements with no role or aria-label associating menuitems to their section.',
    rationale:
      'Explicit ARIA roles compensate for the semantic mismatch in most AT stacks, but the type/markup divergence is a latent bug and the section labels do not group their menuitems for screen reader users navigating by group.',
    proposedFix:
      'Use <ul role="menu"> and <li role="menuitem">, or render section headers with id + aria-labelledby on a role="group" wrapper around each platform pair.',
    scope: 'one-file',
    status: 'open',
    commandment: 5,
  },
  {
    id: 'WARN-4',
    title: 'Staleness banner copy omits consequence',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/mint/SyncStalenessBanner.tsx',
        line: 56,
        excerpt: '"Last synced {durationCopy} ago. Pull to refresh."',
      },
    ],
    observed:
      'Banner tells user the elapsed time and the CTA, but never explains what being out of sync means for their work.',
    rationale:
      'Plain-language directive (user feedback memory): surface the consequence, not just the state. "Your tokens may be out of date with Figma — pull to see recent changes." gives the user a reason to act.',
    proposedFix: 'Replace "Pull to refresh" with a consequence-first sentence.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: 'Emit success toast shows platform slugs instead of human labels',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/hooks/useEmitTokens.ts',
        line: 179,
        excerpt: "const platformList = platforms.join(', ')",
      },
      {
        file: 'src/components/ui/mint/ConfirmEmitDialog.tsx',
        line: 33,
        excerpt: 'const PLATFORM_LABELS: Record<string, string> = { ... }',
        note: 'Label map lives only in the dialog.',
      },
    ],
    observed:
      'Success toast emits "css, tailwind, react-native" rather than "CSS variables, Tailwind config, React Native".',
    rationale:
      'Dialog and toast are both user-facing; vocabulary should agree. Slugs in toasts read as technical jargon to a designer.',
    proposedFix: 'Hoist PLATFORM_LABELS to a shared module and use in both sites.',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'EmitDropdown trigger tooltip duplicates the visible label',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/mint/EmitDropdown.tsx',
        line: 207,
        excerpt: 'title="Emit tokens"',
      },
    ],
    observed:
      'Trigger button shows "Emit" text with title="Emit tokens" tooltip — tooltip adds no information.',
    rationale:
      'For a first-time designer encountering the control, a tooltip explaining intent ("Export tokens as code for a platform") would carry more value than the current redundant string.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'SyncStalenessBanner has no Escape-to-dismiss shortcut',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/mint/SyncStalenessBanner.tsx',
        line: 48,
        excerpt: '<div role="status" aria-live="polite" ...>',
        note: 'Status region is not focusable; keyboard users must tab to dismiss.',
      },
    ],
    observed:
      'Banner has only a click-to-dismiss X button. No document-level Escape handler while the banner is visible.',
    rationale:
      'Minor ergonomics — status banners are not modal, so Escape is not expected. Defer unless user signal emerges.',
    scope: 'one-file',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'MINT.5-phase3',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-20',
    round: 1,
    scope: [
      'src/components/ui/TokenHealthBar.tsx',
      'src/components/ui/mint/EmitDropdown.tsx',
      'src/components/ui/mint/ConfirmEmitDialog.tsx',
      'src/components/ui/mint/SyncStalenessBanner.tsx',
      'src/hooks/useEmitTokens.ts',
      'src/hooks/useSyncStaleness.ts',
      'src/hooks/useSyncActions.ts',
      'src/store/syncStalenessStore.ts',
    ],
    markdownFile: 'MINT.5-phase3-ux-review-2026-04-20-scoped.md',
  },
  rubric: [
    { criterion: 'Destructive write actions gated by a confirmation dialog by default', result: 'fail', evidence: 'useEmitTokens only prompts when caller supplies confirmWrite; dropdown never self-gates (WARN-1)', relatedFindings: ['WARN-1'] },
    { criterion: 'Confirmation dialog surfaces blast radius (file count, overwrite risk)', result: 'fail', evidence: 'ConfirmEmitDialog omits file count and overwrite warning (WARN-2)', relatedFindings: ['WARN-2'] },
    { criterion: 'Dropdown has full keyboard support (arrows, Home/End, Enter, Escape)', result: 'pass' },
    { criterion: 'Dialog has focus trap and biases initial focus to Cancel for destructive action', result: 'pass' },
    { criterion: 'Staleness banner uses role="status" + aria-live="polite"', result: 'pass' },
    { criterion: 'Banner copy explains consequence, not just state', result: 'fail', evidence: 'Copy "Pull to refresh" omits why it matters (WARN-4)', relatedFindings: ['WARN-4'] },
    { criterion: 'Platform labels consistent across dialog and toasts', result: 'fail', evidence: 'Success toast uses raw slugs; labels only defined in dialog (SUG-1)', relatedFindings: ['SUG-1'] },
    { criterion: 'Menu markup uses list semantics matching role="menu"', result: 'fail', evidence: 'div-based menu with ul ref typing (WARN-3)', relatedFindings: ['WARN-3'] },
    { criterion: 'Hooks degrade gracefully when window.flintAPI absent', result: 'pass' },
    { criterion: 'Hooks serialize in-flight operations via ref guards', result: 'pass' },
    { criterion: 'Staleness poll clears timer on unmount', result: 'pass' },
    { criterion: 'Dismissal auto-clears after fresh sync', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/components/ui/TokenHealthBar.tsx',
      'src/components/ui/mint/EmitDropdown.tsx',
      'src/components/ui/mint/ConfirmEmitDialog.tsx',
      'src/components/ui/mint/SyncStalenessBanner.tsx',
      'src/hooks/useEmitTokens.ts',
      'src/hooks/useSyncStaleness.ts',
      'src/hooks/useSyncActions.ts',
      'src/store/syncStalenessStore.ts',
      'shared/review-schema.ts (reference only)',
    ],
    skipped: [
      'TokenManager (caller wiring) — outside scoped set; WARN-1 severity assumes worst case',
      'SyncActionCluster — Phase 2 surface, not in Phase 3 diff',
      'ConfirmPushDialog / ConfirmResolveDialog — Phase 2, unchanged',
      'MINT.5-phase3-contract.md — not required to find UX defects in shipped code',
    ],
  },
};
