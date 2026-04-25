/**
 * UX Review — BETA-TELEMETRY-WIRING (Phase BETA.TEL)
 *
 * Sibling to BETA-TELEMETRY-WIRING-ux-review-2026-04-25.md.
 * Verdict is derived via deriveVerdict(); do not override.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'No "you can change this later" affordance in dialog or plan copy',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 97,
        excerpt:
          'Telemetry is off until you opt in.',
        note: 'Body copy ends here — no reversibility statement.',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 101,
        note: 'Plan-level consent copy also omits reversibility.',
      },
    ],
    observed:
      'The consent dialog body explains what telemetry covers and that it is off until opt-in, but never tells the user the choice is reversible. There is no "change this later in Settings" line and no Settings entry-point linked.',
    rationale:
      'Without a reversibility cue, loss-aversion biases users toward Decline ("if this is permanent I will say no"). For a closed beta that needs telemetry signal, that is self-inflicted. It also weakens GDPR posture — withdrawal of consent should be as easy as granting it, and we should signal that up front.',
    proposedFix:
      'Append: "You can change this any time in Settings → Privacy." Verify the toggle exists in Settings or file a follow-up.',
  },
  {
    id: 'WARN-2',
    title: 'No disclosure of which events are collected',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 99,
        excerpt:
          'Flint Beta can send anonymous usage events and your feedback submissions to help us improve.',
        note: 'No "Learn more" link, no expandable disclosure of the 5 enumerated events.',
      },
      {
        file: '.flint-context/contracts/BETA-TELEMETRY-WIRING.contract.ts',
        note: 'TelemetryEvent discriminated union enumerates the exact 5 events — invisible to the user.',
      },
    ],
    observed:
      'The body uses the phrase "anonymous usage events" without enumerating them or linking to a disclosure. The contract enumerates 5 events (app.launched, app.crashed, mcp.tool_called name-only, audit.completed, session.ended) but nothing in the UI exposes that scope.',
    rationale:
      'Designer-trust issue. "Anonymous usage events" is the exact phrase that makes a privacy-conscious designer assume the worst. Flint\'s product philosophy is "show your work" — the consent dialog should do the same. A designer who can read the event list will trust us; one who cannot will Decline by default.',
    proposedFix:
      'Add a collapsed <details>/<summary> "What gets collected?" listing the 5 events in plain language (e.g. "When the app starts (version + OS, no IP)", "When you run an audit (file count + violations, not file names)"). Keep it collapsed by default so 5-second scan stays fast.',
  },
  {
    id: 'WARN-3',
    title: 'Contract specifies initial focus on Accept; implementation focuses Decline',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    commandment: 5,
    evidence: [
      {
        file: '.flint-context/contracts/BETA-TELEMETRY-WIRING-contract.md',
        line: 100,
        excerpt: 'Initial focus on Accept button',
        note: 'Contract §5 Component Contracts.',
      },
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 13,
        excerpt:
          'Initial focus on the Decline button (most defensive first — per contract note; the Accept button is visually prominent but Decline is safer default)',
        note: 'Component comment acknowledges inversion but cites a "contract note" that does not exist in the artifact.',
      },
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 122,
        excerpt: 'ref={declineRef}',
        note: 'declineRef is wired to FocusTrap initialFocusRef.',
      },
    ],
    observed:
      'The contract artifact (§5) requires initial focus on Accept. The implementation focuses Decline as the privacy-safe default and routes Escape to Decline. The implementation choice is correct; the contract is the source of truth that drifted.',
    rationale:
      'The implementation is right (Decline first is the privacy-respecting default), but contract/code drift makes the artifact unfalsifiable for the next reviewer or agent. flint-contract-linter (Phase 1.5) should have caught this and did not. Either the contract is corrected or the component points at a canonical override.',
    proposedFix:
      'Update BETA-TELEMETRY-WIRING-contract.md:100 to "Initial focus on Decline button (privacy-safe default)." Drop the orphaned "per contract note" wording in the component comment.',
  },
  {
    id: 'WARN-4',
    title: 'Decline button has noticeably less visual weight than Accept',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 125,
        excerpt:
          'rounded px-4 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800',
        note: 'Decline: ghost-only treatment, no border, no background.',
      },
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 135,
        excerpt:
          'rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-zinc-100',
        note: 'Accept: filled primary, perceptually dominant.',
      },
    ],
    observed:
      'Accept renders as bg-indigo-600 filled primary. Decline renders as ghost text-zinc-400 with no background and no border. The body copy says "off until you opt in" but the button hierarchy reads as "we prefer the blue one."',
    rationale:
      'Decline gets initial focus + Escape route, which partially counterbalances. But for a designer audience that reads visual hierarchy as intent, the asymmetry undercuts the privacy-first framing the body works hard to establish. Designers using Flint will read this in seconds — the visual hierarchy must match the verbal hierarchy.',
    proposedFix:
      'Give Decline a ghost-but-visible treatment: border border-zinc-700 text-zinc-200 (or equivalent token-backed pair). Keep Accept indigo-filled. Goal: both read as "two real choices," not "primary CTA + escape hatch."',
  },
  {
    id: 'SUG-1',
    title: 'Consent modal pops back-to-back with BetaWelcome on first launch',
    severity: 'suggestion',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 780,
        excerpt:
          'useEffect(() => { ... void telemetryApi.getConsent!() ... }, [])',
        note: 'Consent IPC fires on mount unconditionally — not gated on BetaWelcome dismissal.',
      },
      {
        file: 'src/App.tsx',
        line: 958,
        excerpt: 'if (!betaWelcomeDone && betaInfo) { return <BetaWelcome ... /> }',
        note: 'BetaWelcome short-circuits render; no visual overlap, but consent pops the moment BetaWelcome dismisses.',
      },
      {
        file: 'src/App.tsx',
        line: 1015,
        excerpt:
          'const isAnyModalOpen = showExportModal || showGovernancePanel || showSetupWizardModal || showTelemetryConsent === true',
        note: 'Aria-hidden gating includes consent — overlap is technically handled, sequencing is back-to-back.',
      },
    ],
    observed:
      'First-launch sequence: SetupWizard skipped → demo loads → BetaWelcome modal → RestoringSplash → main app + consent modal pops. Two-to-three modal moments before the user touches the canvas.',
    rationale:
      'Functionally correct (no visual overlap), but emotionally heavy. A new beta tester sees a modal, dismisses it, sees another modal — the pattern called "modal hell" in onboarding teardowns. Consent does not have to be the literal first thing; it can wait until the user has seen value worth opting in to.',
    proposedFix:
      'Defer setShowTelemetryConsent until either (a) the user has been in the canvas ≥30s, or (b) they trigger their first MCP tool call. One-line change in the consent effect.',
  },
  {
    id: 'SUG-2',
    title: 'Title "Usage data & feedback" is accurate but flat',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 91,
        excerpt: 'Usage data & feedback',
        note: 'h2 title text.',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 101,
        note: 'BETA-CLOSED-PLAN voice is "short, friendly, designer-facing"; current title reads as cookie-banner.',
      },
    ],
    observed:
      'Header reads "Usage data & feedback." Body opens "Flint Beta can send anonymous usage events and your feedback submissions to help us improve."',
    rationale:
      'Tone is fine but misses the partnership register the closed-beta plan calls for. "Usage data & feedback" reads as a cookie banner; "Help us improve Flint?" reads as a beta partnership question.',
    proposedFix:
      'Title: "Help us improve Flint?" Body opens: "We\'d like to send anonymous usage events and your feedback so we can make Flint better. No file contents or design data leave your machine." Same scope, friendlier register.',
  },
  {
    id: 'SUG-3',
    title: 'Backdrop click is unhandled (silent no-op)',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 67,
        excerpt:
          '<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="telemetry-consent-backdrop">',
        note: 'No onClick handler on the backdrop.',
      },
    ],
    observed:
      'Clicking the dimmed backdrop does nothing. Escape routes to Decline (correct). ExportModal behaves the same way, so this is consistent — but for a consent dialog, the silence reads as "trapped."',
    rationale:
      'Either backdrop-click should explicitly route to Decline (matches Escape, "outside click = no thanks") or it should be intentionally a no-op for "every consent decision must be explicit." Either is defensible; the current state is implicit.',
    proposedFix:
      'Add a code comment explaining why backdrop is intentionally non-dismissive, OR route it to handleDecline. Either is acceptable; the silence is the issue.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'BETA.TEL',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-25',
    round: 1,
    scope: [
      'TelemetryConsentDialog component',
      'App.tsx consent mount + IPC effect',
      'BETA-CLOSED-PLAN consent copy alignment',
      'Contract §5 component contract',
    ],
    markdownFile: 'BETA-TELEMETRY-WIRING-ux-review-2026-04-25.md',
  },
  rubric: [
    { criterion: 'Dialog uses role="dialog" + aria-modal="true" + labelled/described', result: 'pass' },
    { criterion: 'Focus trap is mounted via shared FocusTrap component', result: 'pass' },
    { criterion: 'Escape key routes to privacy-safe default (Decline)', result: 'pass' },
    { criterion: 'Initial focus is on the privacy-safe choice', result: 'pass' },
    { criterion: 'Error state is human-readable and inline (does not dismiss)', result: 'pass' },
    { criterion: 'Body copy is scannable in 5 seconds', result: 'pass' },
    { criterion: 'Body explicitly states telemetry is off until opt-in', result: 'pass' },
    {
      criterion: 'User is told they can change their mind later',
      result: 'fail',
      evidence: 'TelemetryConsentDialog.tsx:97-105 — body has no reversibility copy; BETA-CLOSED-PLAN.md:101 also omits it.',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'User can see what events get collected',
      result: 'fail',
      evidence: 'TelemetryConsentDialog.tsx:99 — "anonymous usage events" with no enumeration or Learn-more link.',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Contract and implementation agree on initial-focus target',
      result: 'fail',
      evidence: 'Contract §5 says Accept; TelemetryConsentDialog.tsx:38,122 focuses Decline.',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion: 'Decline button has visual weight comparable to Accept',
      result: 'fail',
      evidence: 'TelemetryConsentDialog.tsx:125 ghost vs :135 bg-indigo-600 filled primary.',
      relatedFindings: ['WARN-4'],
    },
    { criterion: 'Dialog uses no Citadel jargon (Mithril, Warden, Gate, etc.)', result: 'pass' },
    { criterion: 'Tone matches BETA-CLOSED-PLAN voice (short, friendly)', result: 'n/a', relatedFindings: ['SUG-2'] },
    { criterion: 'Modal sequencing on first launch avoids stacking', result: 'n/a', relatedFindings: ['SUG-1'] },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/components/ui/TelemetryConsentDialog.tsx (full component)',
      'src/App.tsx:46-47,143-147,776-801,1015,1468-1474 (mount + IPC effect + render gate)',
      'docs/strategy/BETA-CLOSED-PLAN.md:80-128 (consent copy + telemetry phases)',
      '.flint-context/contracts/BETA-TELEMETRY-WIRING-contract.md (component contract §5)',
      'src/components/ui/FocusTrap.tsx (a11y plumbing review)',
    ],
    skipped: [
      'electron/betaTelemetry.ts — engine path/redaction logic, code reviewer scope',
      'electron/main.ts IPC handlers — code reviewer scope',
      'shared/ipc-validators.ts — security reviewer scope',
      'electron/betaTelemetry.test.ts — test files, not in UX scope',
      'src/components/ui/__tests__/TelemetryConsentDialog.test.tsx — test files, not in UX scope',
      'server/index.ts web-parity wiring — code reviewer scope',
      'electron/preload.ts contextBridge surface — security reviewer scope',
    ],
  },
};
