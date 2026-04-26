import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'FooterLink.href accepts unvalidated URL strings (javascript: latent risk)',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/primitives/FooterActionBar.tsx',
        line: 73,
        excerpt: 'href={href}',
        note: 'Raw string prop passed straight to <a href> with no scheme allowlist.',
      },
      {
        file: 'src/components/ui/primitives/FooterActionBar.tsx',
        line: 36,
        excerpt: 'href?: string;',
        note: 'Props typed as arbitrary string; javascript:/data:/vbscript: URLs not rejected.',
      },
    ],
    observed:
      'FooterLink renders <a href={href} target=...> with no validation of the URL scheme. rel="noopener noreferrer" is only attached when `external` is true, so a same-tab javascript: URL would execute in the Glass renderer origin, which has access to window.flintAPI and the IPC bridge.',
    rationale:
      'No current caller passes user-controlled data into href, but FooterLink is a reusable primitive. Future callers (MCP-supplied links, registry docsUrl fields, policy-settings URLs) could flow untrusted data through this prop. Blocking the scheme inside the primitive is strictly safer than auditing every future call site.',
    proposedFix:
      'Add a scheme allowlist inside FooterLink: const SAFE_SCHEMES = /^(https?:|mailto:|\\/|#)/i; const safeHref = href && SAFE_SCHEMES.test(href) ? href : undefined. Also set rel="noopener noreferrer" unconditionally on anchors that can be external.',
    scope: 'one-file',
    status: 'open',
    commandment: 5,
  },
  {
    id: 'SUG-1',
    title: 'Primitives accepting ReactNode children lack documented trust boundary',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/primitives/MetadataTooltip.tsx',
        line: 37,
        excerpt: 'content: React.ReactNode;',
        note: 'Docblock does not state that content is auto-escaped and must not wrap dangerouslySetInnerHTML.',
      },
      {
        file: 'src/components/ui/primitives/Section.tsx',
        line: 67,
        excerpt: 'children: React.ReactNode;',
      },
      {
        file: 'src/components/ui/primitives/StatBadge.tsx',
        line: 29,
        excerpt: 'children: React.ReactNode;',
      },
    ],
    observed:
      'Three primitives accept children: React.ReactNode and render them directly. React escapes string children, so there is no XSS path today. However, none of the docblocks state the trust contract ("rendered as React children; do not pass pre-rendered HTML strings"). A future contributor using MetadataTooltip content={someMarkdownRendered} with a homegrown markdown->HTML helper could accidentally introduce dangerouslySetInnerHTML in a wrapper.',
    rationale:
      'Documentation hygiene, not an active vulnerability. Stating the trust boundary once at the primitive is cheaper than catching the regression in code review every time the primitive is adopted.',
    proposedFix:
      'Add a one-line JSDoc to each children/content prop: "Rendered as React children (auto-escaped). Do not wrap with dangerouslySetInnerHTML."',
    scope: 'one-line',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'GLASSTYPO.1',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'src/index.css',
      'src/components/ui/primitives/',
      'src/components/ui/GovernanceDashboard.tsx',
      'src/components/ui/governance/',
      'src/components/ui/PropertiesPanel.tsx',
      'src/components/inspector/',
    ],
    markdownFile: 'GLASSTYPO.1-security-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'No dangerouslySetInnerHTML in canary scope', result: 'pass' },
    { criterion: 'No eval / new Function / document.write / innerHTML= patterns', result: 'pass' },
    { criterion: 'No Node.js imports (fs, path, child_process, electron, os, crypto) in src/', result: 'pass' },
    { criterion: 'color-mix() expressions use literal strings; no user input flows into CSS', result: 'pass' },
    { criterion: 'Inline style= props contain no template interpolation of untrusted data', result: 'pass' },
    { criterion: 'No regex-on-source patterns introduced (Commandment 13)', result: 'pass' },
    { criterion: 'Accordion deletion is complete; no orphaned imports from inspector/primitives', result: 'pass' },
    { criterion: 'MetadataTooltip stays inside component subtree (no createPortal / document.body append)', result: 'pass' },
    { criterion: 'Event handlers are bound callbacks; no dynamic function composition', result: 'pass' },
    { criterion: 'Anchor href props validate URL scheme against an allowlist', result: 'fail', evidence: 'FooterActionBar.tsx:73 passes raw string through', relatedFindings: ['WARN-1'] },
    { criterion: 'Primitives document the trust boundary for ReactNode children', result: 'fail', evidence: 'No JSDoc on children/content props', relatedFindings: ['SUG-1'] },
    { criterion: 'Process boundary (Node <-> preload <-> React) is untouched', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'src/components/ui/primitives/Section.tsx',
      'src/components/ui/primitives/PropertyRow.tsx',
      'src/components/ui/primitives/FooterActionBar.tsx',
      'src/components/ui/primitives/MetadataTooltip.tsx',
      'src/components/ui/primitives/StatBadge.tsx',
      'src/components/ui/primitives/PanelTabLabel.tsx',
      'src/components/ui/GovernanceDashboard.tsx',
      'src/components/ui/governance/ (directory grep)',
      'src/components/ui/PropertiesPanel.tsx',
      'src/components/inspector/primitives.tsx',
      'src/components/inspector/ClassBuilder.tsx',
      'src/components/inspector/DriftDetector.tsx',
      'src/components/inspector/LayoutPanel.tsx',
      'src/index.css',
    ],
    skipped: [
      'electron/** — contract declares no Electron changes; no diff against canary scope',
      'server/** — contract non-goal',
      'flint-mcp/** — contract non-goal',
      'shared/** — contract non-goal',
      'src/components/ui/_settings-test.tsx — imports Accordion from primeng/accordion (vendored, unrelated)',
      'Panels outside canary (Tokens/Assets/StatusBar/ExportModal/ComponentPanel/Command Palette) — non-goal #2',
    ],
  },
};
