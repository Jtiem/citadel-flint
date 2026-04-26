import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'SUG-1',
    title: 'Figma URL hand-off uses window global instead of typed channel',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/LaunchScreen.tsx',
        line: 284,
        excerpt: "(window as unknown as { __FLINT_PENDING_FIGMA_URL?: string }).__FLINT_PENDING_FIGMA_URL = trimmed;",
        note: 'Captured URL is stashed on a window global for the host IDE / Mason path to read on canvas mount.',
      },
      {
        file: 'src/components/ui/LaunchScreen.tsx',
        line: 259,
        note: 'Comment block honestly explains the Sprint 1 deferral.',
      },
    ],
    observed:
      'The from-figma channel writes the captured URL to a window global for downstream consumption rather than passing it through a typed event or context-store slice.',
    rationale:
      'Window globals are untyped, untestable, and easy to lose in refactors. The W4 ask explicitly required no new IPC infra, so this is acceptable for Sprint 1, but a typed surface would be cleaner if Sprint 2 expands the Figma path.',
    proposedFix:
      'Sprint 2: replace window global with either (a) a CustomEvent dispatched on canvas mount, (b) a transient slice on canvasStore, or (c) a launch-payload prop passed through onNewProject.',
    scope: 'one-file',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FORGE.1',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-19',
    round: 2,
    scope: [
      'LaunchScreen 3-channel layout',
      'DetectionPreview plain-language labels',
      'createScratchpad libraryDefault plumbing',
      'Figma channel inline URL input',
      'Override hint correctness',
    ],
    markdownFile: 'FORGE.1-ux-review-2026-04-19-round2.md',
  },
  rubric: [
    { criterion: '3 channels rendered, no 4th channel reintroduced', result: 'pass', evidence: 'LaunchScreen.tsx:59-74' },
    { criterion: 'createScratchpad receives { libraryDefault: "mui" } from from-idea handler', result: 'pass', evidence: 'LaunchScreen.tsx:247' },
    { criterion: 'projectCreateScratchpadSchema accepts libraryDefault payload', result: 'pass', evidence: 'shared/ipc-validators.ts:486-491' },
    { criterion: 'Main process handler parses payload via Zod schema', result: 'pass', evidence: 'electron/main.ts:1923-1924' },
    { criterion: 'Web server mirrors main process handler', result: 'pass', evidence: 'server/index.ts:1199-1202' },
    { criterion: 'DetectionPreview rows use plain-language labels (Built with, Component kit, Styling, Code type, Design tokens)', result: 'pass', evidence: 'DetectionPreview.tsx:175,187,205,219,221' },
    { criterion: 'MUI default surfaces with CheckCircle + emerald, not AlertTriangle + amber', result: 'pass', evidence: 'DetectionPreview.tsx:188-193' },
    { criterion: 'MUI default copy is confident ("Using MUI (change if needed)")', result: 'pass', evidence: 'DetectionPreview.tsx:191' },
    { criterion: 'Figma channel uses inline URL input (no new modal)', result: 'pass', evidence: 'LaunchScreen.tsx:494-513' },
    { criterion: 'Figma URL validation rejects non-figma.com URLs', result: 'pass', evidence: 'LaunchScreen.tsx:273' },
    { criterion: 'Override hint hidden when effective value equals detected value', result: 'pass', evidence: 'DetectionPreview.tsx:100-103,226' },
    { criterion: 'Audit-only journey deferral commented in code with Sprint-2 TODO', result: 'pass', evidence: 'LaunchScreen.tsx:55-58' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/components/ui/LaunchScreen.tsx',
      'src/components/ui/DetectionPreview.tsx',
      'shared/ipc-validators.ts (projectCreateScratchpadSchema)',
      'electron/main.ts (project:create-scratchpad handler)',
      'server/index.ts (web parity handler)',
      'electron/preload.ts (createScratchpad bridge)',
      'src/adapters/web-api.ts (web adapter)',
    ],
    skipped: [
      'PasteAuditModal — unchanged in FORGE.1 round 2',
      'DemoScenarioPicker — unchanged in FORGE.1 round 2',
      'SetupWizard — unchanged in FORGE.1 round 2',
    ],
  },
};
