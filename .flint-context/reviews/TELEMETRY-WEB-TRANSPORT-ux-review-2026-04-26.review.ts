/**
 * UX review — TELEMETRY-WEB-TRANSPORT (web-mode consent dialog wiring).
 * Sibling of TELEMETRY-WEB-TRANSPORT-ux-review-2026-04-26.md.
 *
 * Scope: Phase 2 fix added `telemetry: { getConsent, setConsent }` to
 * src/adapters/web-api.ts so the closed-beta web build can read consent state
 * and surface the TelemetryConsentDialog on first launch.
 *
 * Verdict is derived by deriveVerdict() — do not override.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema'
import { countFindings, deriveVerdict } from '../../shared/review-schema'

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title:
      'Consent dialog appears AFTER demo workspace loads, not at first launch as the install guide promises',
    severity: 'warning',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 970,
        note:
          'BetaWelcome early return — fires before the JSX containing TelemetryConsentDialog mounts.',
      },
      {
        file: 'src/App.tsx',
        line: 1009,
        note: 'LaunchScreen early return — fires before TelemetryConsentDialog renders.',
      },
      {
        file: 'src/App.tsx',
        line: 1483,
        excerpt:
          '{showTelemetryConsent === true && (\n    <TelemetryConsentDialog onDecided={() => setShowTelemetryConsent(false)} />\n)}',
        note:
          'Dialog rendered inside the main workspace return only — deferred until after BetaWelcome + demo load.',
      },
      {
        file: 'docs/beta/INSTALL-GUIDE.md',
        line: 53,
        excerpt:
          'Flint will show a consent dialog asking whether it can send anonymous usage events …',
        note: 'Install guide promises a first-launch prompt; current code shows it post-demo.',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 11,
        excerpt:
          'first launch shows a consent dialog; events only emit after the user clicks Accept',
        note: 'Plan also specifies first-launch positioning.',
      },
    ],
    observed:
      'Tester sees: BetaWelcome → "Try Demo" → demo workspace loads → THEN consent dialog pops over the workspace. Privacy contract still holds (webEmit short-circuits at server/index.ts:3508), but the prompt is no longer at first launch.',
    rationale:
      'The closed-beta plan and install guide both position the consent prompt as a first-launch gate. The current ordering shows it after the user has already engaged with the demo, which reads as a post-hoc nag and undermines the GDPR-defensible "explicit Accept covers closed beta" posture.',
    proposedFix:
      'Hoist the showTelemetryConsent gate above the !betaWelcomeDone early return, OR render the dialog as a sibling of BetaWelcome/LaunchScreen so it shows before the demo auto-load. Alternatively, update the install guide to describe the actual flow ("After the demo loads, Flint will ask…"). Code change is the better fix — matches stated intent.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title:
      'Install guide promises a Settings affordance to change consent later that does not exist',
    severity: 'warning',
    evidence: [
      {
        file: 'docs/beta/INSTALL-GUIDE.md',
        line: 53,
        excerpt: 'Accept or decline; either is fine, and you can change it later in Settings.',
        note: 'Promised affordance.',
      },
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        note: 'No companion Settings component exists; the dialog is the only caller of setConsent.',
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 611,
        excerpt:
          'telemetry: {\n  getConsent: () => invoke(\'telemetry:get-consent\') ...,\n  setConsent: (payload: ...) => invoke(\'telemetry:set-consent\', payload) ...,\n}',
        note: 'IPC exists; no Glass UI surface invokes it after the first decision.',
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 111,
        note: 'setConsent() is exposed via IPC but unused after first launch.',
      },
    ],
    observed:
      'Install guide tells testers they can change consent later in Settings. There is no Settings UI in Glass, no menu item, no IPC reset path. A user who declines today cannot opt in tomorrow without manually editing ~/.flint/beta-consent.json.',
    rationale:
      'The install guide is making a promise the app cannot keep. Either the promise is misleading (and should be removed) or the affordance is missing (and should be added). For closed beta, removing the doc claim is acceptable; for public beta, an affordance becomes a regulatory expectation.',
    proposedFix:
      'For closed beta: delete "and you can change it later in Settings" from docs/beta/INSTALL-GUIDE.md:53. Mid-term: add a one-row toggle to a Settings/About surface that calls window.flintAPI.telemetry.setConsent({ state }). Reset to "unset" would require an additional IPC verb; defer to public-beta scope.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title:
      '"Skip silently if API not wired" branch is now dead code that masks real regressions',
    severity: 'warning',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 795,
        excerpt:
          "if (typeof telemetryApi?.getConsent !== 'function') {\n    // IPC not wired yet — skip silently\n    setShowTelemetryConsent(false)\n    return\n}",
        note:
          'Runtime existence check on a now-required surface. Will never trigger in shipping builds because the typed FlintAPI declares telemetry as non-optional.',
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 611,
        note: 'telemetry namespace defined unconditionally in the web adapter.',
      },
      {
        file: 'src/types/flint-api.d.ts',
        line: 2088,
        excerpt:
          'telemetry: {\n  getConsent: () => Promise<ConsentRecord>\n  setConsent: (payload: TelemetrySetConsentPayload) => Promise<ConsentRecord>\n}',
        note:
          'Typed surface declares telemetry as required (no optional `?`) — TSC enforces presence.',
      },
    ],
    observed:
      'The runtime existence check fires only if a future regression drops the telemetry namespace from the adapter. With the typed FlintAPI marking it required, that regression is caught by TSC at build time. The check now silently suppresses the dialog if the regression slips past TSC, which means we appear to respect privacy while actually hiding a real bug.',
    rationale:
      'Defensive code should defend against realistic failures, not against developer mistakes already caught by TSC. The catch block on line 805 already covers the realistic IPC failure mode (server down, handler errors). The existence check is strictly worse than letting the typed surface enforce presence.',
    proposedFix:
      'Replace the existence-check branch with a direct call: void window.flintAPI.telemetry.getConsent().then(record => setShowTelemetryConsent(record.state === \'unset\')).catch(err => { console.warn(...); setShowTelemetryConsent(false) }). The catch already covers IPC failure.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'WARN-4',
    title: 'Backdrop is aria-hidden="true" while containing the focused dialog — brittle pattern',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 76,
        excerpt: 'aria-hidden="true"',
        note: 'Backdrop marked hidden from AT.',
      },
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 88,
        excerpt: 'aria-hidden="false"',
        note:
          'Inner dialog overrides parent — relies on AT honouring child overrides, which is inconsistent across NVDA/JAWS/VoiceOver.',
      },
      {
        file: 'src/App.tsx',
        line: 1028,
        excerpt:
          'const isAnyModalOpen = showExportModal || showGovernancePanel || showSetupWizardModal || showTelemetryConsent === true',
        note:
          'isAnyModalOpen already includes the consent dialog and triggers aria-hidden on the main wrapper at line 1034.',
      },
      {
        file: 'src/App.tsx',
        line: 1034,
        excerpt: 'aria-hidden={isAnyModalOpen || undefined}',
        note: 'Main app wrapper already aria-hides correctly when the dialog is open.',
      },
    ],
    observed:
      'The dialog uses two aria-hidden mechanisms simultaneously: (1) backdrop sets aria-hidden="true" and the inner dialog overrides with aria-hidden="false"; (2) App.tsx separately sets aria-hidden on the main app wrapper. The override-with-false pattern works on Chromium but is historically inconsistent in JAWS and VoiceOver.',
    rationale:
      'The Warden a11y suite enforces WCAG 2.2 aria-hidden interactions. A consent dialog must be reliably reachable by AT. The current dual mechanism is fragile — pick one (the App.tsx wrapper, which already works) and drop the other.',
    proposedFix:
      'Remove aria-hidden="true" from the backdrop at TelemetryConsentDialog.tsx:76. Drop the corresponding aria-hidden="false" override on the dialog at line 88. The App.tsx-level wrapper aria-hidden is sufficient because isAnyModalOpen includes showTelemetryConsent.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: '"What gets collected?" disclosure is collapsed by default for closed-beta',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 126,
        excerpt:
          '<details\n  className="group rounded border border-zinc-700/50 bg-zinc-800/40"\n  data-testid="telemetry-disclosure"\n>',
        note: '<details> defaults to collapsed.',
      },
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 142,
        note:
          '5 specific, plain-English bullets — short enough to render inline without overwhelming the dialog.',
      },
    ],
    observed:
      'The dialog headline says "anonymous usage events and your feedback submissions to help us improve" — vague enough that a privacy-conscious tester clicks Decline rather than expand the disclosure to see the actual list. The hidden list is genuinely good (specific, plain-English, no IP, no file contents).',
    rationale:
      'For closed beta with 10 known-friendly testers, surfacing the data list by default would likely raise Accept rates, not lower them — privacy-conscious users reward transparency. The default-collapsed pattern fits public-beta where the list is longer.',
    proposedFix:
      'Add the `open` attribute to the <details> element (one character). Optional: replace <details> with a static <ul> for closed beta. Revisit before public beta.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'Decline path provides no acknowledgement that the choice persisted',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/TelemetryConsentDialog.tsx',
        line: 55,
        excerpt: 'onDecided(state)',
        note: 'Successful decision fires onDecided; no toast or inline confirmation follows.',
      },
      {
        file: 'src/App.tsx',
        line: 1485,
        excerpt: 'onDecided={() => setShowTelemetryConsent(false)}',
        note: 'Callback only hides the dialog; no notification dispatch.',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 103,
        excerpt: 'Decline → feedback widget falls back to clipboard; telemetry stays off permanently.',
        note: '"Stays off permanently" is invisible to the user with no confirmation.',
      },
    ],
    observed:
      'After clicking Decline, the dialog vanishes with no toast, inline message, or visible "Telemetry off" indicator. The user has no way to verify the click was processed without re-launching to see the dialog gone.',
    rationale:
      'Successful destructive-default actions deserve a brief acknowledgement. notificationStore is already imported in App.tsx; a 4-second info toast closes the loop without nagging.',
    proposedFix:
      'In src/App.tsx where onDecided is wired, push a brief notification: pushNotification({ type: \'info\', title: state === \'accepted\' ? \'Telemetry on — thanks!\' : \'Telemetry off\', message: state === \'accepted\' ? \'Anonymous usage data will help us improve.\' : \'No usage data will be sent.\', autoDismissMs: 4000 }). Pass the decision into the callback by changing onDecided signature from () => void to (state: \'accepted\' | \'declined\') => void — already typed that way in the contract.',
    scope: 'one-file',
    status: 'open',
  },
]

export const REPORT: ReviewReport = {
  meta: {
    phase: 'TELEMETRY-WEB-TRANSPORT',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-26',
    round: 1,
    scope: [
      'src/components/ui/TelemetryConsentDialog.tsx',
      'src/App.tsx (telemetry consent useEffect + render gate, lines ~785-811, 1483-1487)',
      'src/types/flint-api.d.ts (telemetry namespace, lines ~1744-1764, 2088-2099)',
      'src/adapters/web-api.ts (telemetry IPC wiring, lines 611-616)',
      'docs/strategy/BETA-CLOSED-PLAN.md Phase 3.3 (consent copy spec)',
      'docs/beta/INSTALL-GUIDE.md (first-launch user expectation)',
      'server/index.ts (web-side handlers, lines 3456-3611)',
    ],
    markdownFile: 'TELEMETRY-WEB-TRANSPORT-ux-review-2026-04-26.md',
  },
  rubric: [
    {
      criterion:
        'Consent dialog renders before any telemetry-emitting action happens (privacy contract)',
      result: 'pass',
      evidence:
        'webEmit() at server/index.ts:3508 reads consent state on every emit and short-circuits unless state === "accepted". Privacy contract holds even when dialog ordering is wrong.',
    },
    {
      criterion:
        'Consent dialog is positioned at first launch as promised by BETA-CLOSED-PLAN.md and INSTALL-GUIDE.md',
      result: 'fail',
      evidence:
        'src/App.tsx:970 (BetaWelcome) and 1009 (LaunchScreen) early-return before the dialog mounts. Dialog renders only after demo workspace hydrates. See WARN-1.',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'Decline is the privacy-safe initial focus target',
      result: 'pass',
      evidence:
        'TelemetryConsentDialog.tsx:43, 79, 171 — declineRef passed as initialFocusRef to FocusTrap.',
    },
    {
      criterion: 'Escape key routes to Decline, not Accept',
      result: 'pass',
      evidence: 'TelemetryConsentDialog.tsx:68 — handleEscape = handleDecision("declined").',
    },
    {
      criterion: 'Backdrop click does not dismiss the dialog (consent must be explicit)',
      result: 'pass',
      evidence: 'TelemetryConsentDialog.tsx:17-19 explicit comment + no onClick on backdrop.',
    },
    {
      criterion: 'Action buttons are visually balanced (no dark-pattern bias toward Accept)',
      result: 'pass',
      evidence:
        'TelemetryConsentDialog.tsx:170-188 — both buttons px-4 py-1.5; Accept gets indigo-600 fill while Decline gets a peer ghost border. Initial focus on Decline does the privacy-priming.',
    },
    {
      criterion: 'aria-hidden on the dialog backdrop is the standard implementation',
      result: 'fail',
      evidence:
        'TelemetryConsentDialog.tsx:76 sets aria-hidden="true" on backdrop and 88 overrides with aria-hidden="false" on the dialog. App.tsx:1034 already aria-hides the main wrapper. Dual mechanism is brittle. See WARN-4.',
      relatedFindings: ['WARN-4'],
    },
    {
      criterion: 'Install guide describes the actual first-launch experience',
      result: 'fail',
      evidence:
        'INSTALL-GUIDE.md:53 promises a Settings affordance to change consent later — none exists. Implies dialog appears first — actually appears post-demo. See WARN-1, WARN-2.',
      relatedFindings: ['WARN-1', 'WARN-2'],
    },
    {
      criterion: 'Failure modes degrade safely (server down, corrupted consent file)',
      result: 'pass',
      evidence:
        'electron/betaTelemetry.ts:95-107 and server/index.ts:3578-3593 fall through to fresh "unset" record on parse failure. App.tsx:805 catches IPC failure and defaults to not showing the dialog (privacy-safe).',
    },
    {
      criterion: 'Quiet-failure fallback is justified given current API guarantees',
      result: 'fail',
      evidence:
        'src/App.tsx:795 runtime existence check is dead code now that the typed FlintAPI surface declares telemetry as required (src/types/flint-api.d.ts:2088). Masks real regressions. See WARN-3.',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion:
        'Decline-path produces a user-visible acknowledgement that the choice persisted',
      result: 'fail',
      evidence:
        'TelemetryConsentDialog.tsx:55 + App.tsx:1485 — successful decline returns no toast or inline message. See SUG-2.',
      relatedFindings: ['SUG-2'],
    },
    {
      criterion: 'Data-collection list is visible without requiring a click',
      result: 'fail',
      evidence:
        'TelemetryConsentDialog.tsx:126 — <details> default-collapsed. Closed-beta-only consideration. See SUG-1.',
      relatedFindings: ['SUG-1'],
    },
    {
      criterion: 'Privacy payload (mcp.tool_called) cannot leak tool arguments',
      result: 'pass',
      evidence:
        'server/index.ts:3470-3475 + electron/betaTelemetry.ts:47-52 — discriminated-union signature; toolName is the only field allowed for that event. TSC enforces.',
    },
    {
      criterion: 'Double-click protection on Accept/Decline (no duplicate setConsent calls)',
      result: 'pass',
      evidence: 'TelemetryConsentDialog.tsx:47 — isPending guard on handleDecision.',
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/components/ui/TelemetryConsentDialog.tsx — full file',
      'src/App.tsx — consent useEffect (lines 786-811) and render gate (lines 1481-1487)',
      'src/App.tsx — early-return ordering (lines 960-1023)',
      'src/types/flint-api.d.ts — telemetry namespace + ConsentRecord types',
      'src/adapters/web-api.ts — telemetry namespace wiring (lines 611-616)',
      'server/index.ts — web-side telemetry IPC handlers and webEmit (lines 3456-3611)',
      'electron/betaTelemetry.ts — consent file read/write semantics',
      'docs/strategy/BETA-CLOSED-PLAN.md — Phase 3.3 consent spec',
      'docs/beta/INSTALL-GUIDE.md — first-launch user-facing copy',
    ],
    skipped: [
      'src/components/ui/FocusTrap.tsx — unchanged in this phase; only verified onClose=Escape contract',
      'Visual regression check — not in scope for transport fix; would need clickthrough',
      'Performance / network behaviour of telemetry queue flushing — covered by previous review rounds',
      'Cross-browser AT testing (NVDA/JAWS/VoiceOver) — recommended manual follow-up for WARN-4',
    ],
  },
}
