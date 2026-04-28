import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title: 'Install guide describes old BetaWelcome flow, not HelloFlintWelcome',
    severity: 'blocking',
    evidence: [
      {
        file: 'docs/beta/INSTALL-GUIDE.md',
        line: 55,
        excerpt:
          'After that, you land on the launch screen. Choose **Open Demo Project** to start with something ready to explore right away.',
        note:
          'Closed-beta testers will read this guide before launch. After consent they actually land on HelloFlintWelcome, not LaunchScreen, and the primary action is "Let\'s go →" not "Open Demo Project."',
      },
      {
        file: 'src/App.tsx',
        line: 1028,
        excerpt:
          "if (!hasSeenWelcome) {\n    return (\n        <HelloFlintWelcome\n            buildId={betaInfo?.buildId}\n            daysRemaining={betaInfo?.daysRemaining ?? null}\n            onComplete={() => setHasSeenWelcome(true)}\n        />\n    );\n}",
        note: 'Welcome gate fires before LaunchScreen — guide must reflect this.',
      },
    ],
    observed:
      'docs/beta/INSTALL-GUIDE.md tells testers they "land on the launch screen" after consent and to "Choose Open Demo Project," but App.tsx renders HelloFlintWelcome between the consent dialog and LaunchScreen. The guide describes the pre-Phase-A flow.',
    rationale:
      'Closed-beta testers use this guide to install Flint. If the guide and the app disagree at the very first step, the tester forms a "this is half-shipped" impression before they\'ve done anything. The fix is a one-paragraph rewrite of the "First launch" section to describe the new sequence: consent → welcome → IDE setup (or skip) → launch screen → demo.',
    proposedFix:
      'Replace the "First launch" section with: 1) consent dialog (existing copy), 2) welcome screen offering "Let\'s go" (Flint sets up your IDE), 3) launch screen where you can pick a project or load the demo. Mention that "Skip" is fine and they can run the connection later from the StatusBar.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-1',
    title: 'Welcome card visually editorializes the spec\'s inline pitch',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 342,
        excerpt:
          '<div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5 text-left space-y-2">\n  <p className="text-sm font-medium text-zinc-100">\n    Let\'s build your first screen\n  </p>\n  <p className="text-xs leading-relaxed text-zinc-400">\n    Guided, about 5 minutes. ...',
      },
      {
        file: 'docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md',
        line: 44,
        excerpt:
          '**Let\'s build your first screen** — guided, about 5 minutes. I\'ll walk you through the full loop ...',
        note:
          'Spec presents this as an inline bolded sentence in the welcome paragraph flow, not a bordered card.',
      },
    ],
    observed:
      'The implementation extracts the "Let\'s build your first screen" pitch into a bordered, padded card with its own visual frame. The spec writes this as an inline bolded sentence in the welcome copy.',
    rationale:
      'The card adds visual weight that reads as a "feature panel" rather than the natural pre-amble to the CTA. The spec\'s flow is conversational — explain, invite, button. The card creates a small but real interruption between the "fastest way to understand Flint" sentence and the "Let\'s go" button. Not a behavior bug, but the spec voice was deliberately inline.',
    proposedFix:
      'Either (a) drop the card entirely and inline the bolded "Let\'s build your first screen" + the 5-minute description in the welcome paragraph block, OR (b) keep the card but make it visually quieter (no border, just slightly elevated bg) so it reads as a continuation of the copy rather than a separate panel.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title: '"Both" button activation rule and action are inconsistent',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 409,
        excerpt:
          'const hasBoth =\n  present.some(e => e.editor === \'cursor\') &&\n  present.some(e => e.editor === \'claude-code\');',
        note: '"Both" only appears when Cursor AND Claude Code are present.',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 443,
        excerpt: 'onClick={() => onChoose(present.map(e => e.editor))}',
        note:
          '"Both" sends every present editor — so when 3 are present, "Both" actually writes to all 3.',
      },
    ],
    observed:
      'The condition that renders the "Both" button (`hasBoth`) is "Cursor AND Claude Code both present." But the action sends `present.map(e => e.editor)` — every detected editor. With Cursor + Claude Code + VS Code all present, the user sees a button labeled "Both" that writes to three editors. Conversely, a user with Cursor + VS Code but no Claude Code does not see "Both" at all and must select each editor separately.',
    rationale:
      'The label promises pairing; the behavior is "all of them." Designers reading the button will form expectations from the word "Both" — a tester with three editors clicks it and discovers a third write happened, which reads as a quiet bug. As Flint adds editors (Antigravity, Zed, etc.) the mismatch will compound.',
    proposedFix:
      'Either rename to "All present" / "Connect all" when ≥ 2 are present, OR keep the "Both" semantics strictly to two editors and show separate per-editor buttons when 3+ are present. The cleanest fix is to count present editors and show "Both" iff present.length === 2, "All three" iff present.length === 3, etc.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title: '"Looking for…" copy reads as in-progress after detection has finished',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 476,
        excerpt:
          "{editor.present\n  ? `Found ${EDITOR_LABELS[editor.editor]} ✓`\n  : `Looking for ${EDITOR_LABELS[editor.editor]}… not found`}",
      },
    ],
    observed:
      'In `connect-confirm` state, missing editors render with the copy "Looking for VS Code… not found." The connect-confirm state only renders AFTER `detectEditors()` has resolved — at this point, nothing is "Looking" anymore.',
    rationale:
      'The "Looking for…" prefix tells the user the system is still searching when it has already finished. This is a small honesty leak: the spec used "Looking for VS Code… not found" as part of a streaming sequence where each line filled in over time. In the static panel, the leading word is misleading. Designers notice when copy implies live action that isn\'t happening.',
    proposedFix:
      'Use "VS Code — not found" or "VS Code (not installed)" in the static connect-confirm panel. Reserve the "Looking for…" framing for the `detecting` panel where it would be true.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-4',
    title: 'No timeout guard on detectEditors — slow disk hangs the spinner forever',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 175,
        excerpt:
          "const handleLetsGo = useCallback(async () => {\n  setState('detecting');\n  try {\n    const api = (window as any).flintAPI?.hello;\n    const result: DetectEditorsResponse = await api.detectEditors();\n    setDetection(result);\n    setState('connect-confirm');\n  } catch {\n    // Detection failed — offer manual fallback with empty detection",
        note:
          'No setTimeout race; detection is awaited indefinitely. The catch only fires on rejection, not stall.',
      },
    ],
    observed:
      '`handleLetsGo` awaits `detectEditors()` with no timeout. If the IPC call hangs (slow disk, FUSE filesystem, IPC channel deadlock), the user sees the "Let me set this up for you…" spinner forever with no recovery path.',
    rationale:
      'Detection is a local existsSync — under normal conditions it completes in < 50ms (per the contract\'s detection-latency-p95 invariant). But in the long tail (network home dirs, sleeping disks, IPC anomalies), the user is stuck. Phase C lists "stuck for 30s inline help" as future scope, but that\'s for the walkthrough — this is the welcome where the stuck case has no graceful exit at all.',
    proposedFix:
      'Wrap `detectEditors()` in a `Promise.race` with a 5–10 second timeout. On timeout, fall through to the same `connect-confirm` panel with empty detection (the existing catch path). The user then sees "I\'ll do this manually" as their only enabled action — graceful, honest.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'WARN-5',
    title: 'Manual snippet Copy button has no success feedback',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 611,
        excerpt:
          'const handleCopy = () => {\n  navigator.clipboard.writeText(snippet).catch(() => {});\n};',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 636,
        excerpt:
          '<button\n  type="button"\n  onClick={handleCopy}\n  aria-label="Copy snippet"\n  className="absolute right-3 top-3 ...">\n  Copy\n</button>',
        note:
          'Button label stays "Copy" before/after click — no transient "Copied!" or checkmark.',
      },
    ],
    observed:
      'The Copy button on the manual-snippet view writes the JSON to the clipboard but provides no visible feedback that the copy succeeded (or failed). The `.catch(() => {})` swallows errors silently.',
    rationale:
      'The whole point of the manual flow is the user is going to paste this elsewhere. Without confirmation, they\'ll either re-click defensively or paste blindly into their settings file and hope. Both outcomes erode trust at the moment Flint asks the user to do something it couldn\'t. Standard pattern is "Copy" → "Copied ✓" for ~1.5s.',
    proposedFix:
      'Add a `copied` boolean state that flips true on success, renders "Copied ✓" with the checkmark icon for 1.5s via setTimeout, then resets. On clipboard failure (caught), surface a toast or inline error instead of swallowing.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-6',
    title: 'No focus management on state transitions inside the welcome',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 150,
        excerpt:
          "useEffect(() => {\n  headingRef.current?.focus();\n}, []);",
        note:
          'Empty deps — fires only on initial mount. State transitions do not move focus.',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 268,
        excerpt:
          "{state === 'connect-confirm' && detection && (\n  <ConnectConfirmPanel ... />\n)}",
        note:
          'Connect-confirm renders a new heading and button group, but no ref is focused when this state mounts.',
      },
    ],
    observed:
      'Focus is moved to the welcome heading on initial mount only. When the state transitions welcome → detecting → connect-confirm → writing → verify → help, focus does not follow into the new panel. After clicking "Let\'s go," a keyboard or screen-reader user has focus on a now-unmounted button (which falls back to body), then has to Tab from the document top into the new panel.',
    rationale:
      'WCAG 2.1 AA (success criterion 2.4.3 Focus Order) wants focus to move with intent. For multi-step sequences inside one component, the standard pattern is: on each state change, move focus to the new panel\'s heading or first interactive element. Without this, the welcome is keyboard-hostile from the second panel onward.',
    proposedFix:
      'Add a useEffect that watches `state` and calls focus() on the new panel\'s heading or first button. Each panel can take an optional ref prop, or use a per-state ref map keyed on state name.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-7',
    title: 'Build footer text-zinc-600 on bg-zinc-950 fails WCAG AA contrast',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 372,
        excerpt:
          '{buildId && (\n  <p className="text-xs text-zinc-600">\n    Build {buildId}\n    {daysRemaining != null ? ` · Expires in ${daysRemaining} days` : \'\'}\n  </p>\n)}',
      },
    ],
    observed:
      'The build footer renders `text-zinc-600` (#52525b) on `bg-zinc-950` (#09090b). Contrast ratio ≈ 3.96:1, below the 4.5:1 WCAG AA threshold for normal text.',
    rationale:
      'The spec calls for low-emphasis footer styling, and a designer who looks at the build/expiry once a session can read it fine. But "expires in 60 days" is product-relevant info, not pure decoration — testers in particular will want to verify which build they\'re on. Failing AA means low-vision testers and macOS users with reduced display contrast may not be able to read it at all.',
    proposedFix:
      'Bump to `text-zinc-500` (#71717a) — contrast ≈ 4.97:1, passes AA, still reads as low-emphasis. The visual hierarchy is preserved (footer is still much quieter than body copy at zinc-400).',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: 'LaunchScreen still surfaces "Connect to IDE" — duplicate path to a now-deprecated flow',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 1063,
        excerpt:
          'onConnectIDE={() => setShowSetupWizardModal(true)}',
        note:
          'LaunchScreen still offers a "Connect to IDE" entry that opens the legacy SetupWizard.',
      },
      {
        file: 'docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md',
        line: 4,
        excerpt:
          'Replaces: BetaWelcome.tsx and the buried StatusBar "Connect to IDE" affordance',
        note:
          'Spec calls out the "Connect to IDE" affordance as something the welcome replaces.',
      },
    ],
    observed:
      'After the user dismisses the HelloFlintWelcome (skip or success), the LaunchScreen still renders a "Connect to IDE" entry that opens the legacy SetupWizard modal. Two paths now lead to the same outcome with different UIs.',
    rationale:
      'The Phase A contract is explicit that the legacy SetupWizard stays accessible via the OS menu Reset State path for power users. Surfacing it on the LaunchScreen too means a returning tester who skipped the welcome will see two competing "set up your IDE" entry points (one in StatusBar, one on LaunchScreen). Phase A acceptance #4 says the SetupWizard "continues to function for the menu Reset State path" — promoting it on LaunchScreen exceeds that scope.',
    proposedFix:
      'Either (a) remove the LaunchScreen `Connect to IDE` button now that HelloFlintWelcome covers the case, or (b) re-route LaunchScreen\'s "Connect to IDE" to re-open HelloFlintWelcome (clear the localStorage flag and show the welcome again) so there\'s a single path. Decide as part of Phase B / Phase C consolidation.',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'Help panel "Re-run connection" requires app restart; should offer in-panel retry',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 580,
        excerpt:
          '<span className="font-medium text-zinc-200">Re-run the connection.</span>{\' \'}\nClose this screen, reopen Flint, and click "Let\'s go →" again.',
      },
    ],
    observed:
      'The help panel\'s third fix instructs the user to close and reopen Flint to retry the connection. There is no in-panel retry button.',
    rationale:
      'The user is one click away from the connect-confirm panel — the back-button to verify still works. Asking them to quit and relaunch the whole app for what is technically a re-run of `writeMcpConfigBulk()` is heavier than the situation needs. A simple `[ Try again ]` button would re-render the connect-confirm state and let them retry without leaving the screen.',
    proposedFix:
      'Add a `[ Try again ]` button to the help panel that calls `setState(\'connect-confirm\')`. Keep the "close and reopen" instruction as an escalation if retry doesn\'t work.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'alreadyConnected fires from both App.tsx and HelloFlintWelcome — redundant',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 792,
        excerpt:
          "useEffect(() => {\n  if (typeof window.flintAPI?.hello?.alreadyConnected !== 'function') return;\n  void window.flintAPI.hello.alreadyConnected()\n    .then((result) => {\n      if (result.connected) setHasSeenWelcome(true);\n    })",
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 130,
        excerpt:
          "useEffect(() => {\n  let cancelled = false;\n  const checkConnected = async () => {\n    try {\n      const api = (window as any).flintAPI?.hello;\n      if (!api?.alreadyConnected) return;\n      const result = await api.alreadyConnected();\n      if (!cancelled && result?.connected) {\n        onComplete();\n      }\n    } catch {}\n  };\n  checkConnected();\n  return () => { cancelled = true; };\n}, [onComplete]);",
      },
    ],
    observed:
      'Both `src/App.tsx` (parent) and `src/components/ui/HelloFlintWelcome.tsx` (child) fire `alreadyConnected()` independently on mount. The parent\'s call dismisses the welcome before the child even mounts (often), but the child\'s call still runs whenever the parent\'s race lost.',
    rationale:
      'Functionally harmless — both paths converge on `onComplete()`/`setHasSeenWelcome(true)`. But the double-call doubles IPC traffic on first launch and means whichever resolves first wins. Single-source-of-truth would be cleaner: the parent owns the gate decision; the child trusts it.',
    proposedFix:
      'Remove the `useEffect` at HelloFlintWelcome.tsx:130–146. The parent gate in App.tsx already handles the fast path. If a future caller of HelloFlintWelcome wants the self-check, expose it as an opt-in prop (`autoCheckConnected?: boolean`).',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'SUG-4',
    title: 'Welcome wrapper uses role="region" not role="dialog" — landmark accuracy',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 236,
        excerpt:
          '<div className="flex h-screen flex-col bg-zinc-950" role="region" aria-label="Welcome screen">',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 19,
        excerpt:
          '* A11y notes:\n*   - Single <main> landmark; outer wrapper uses role="region" not "main"',
        note:
          'The choice of role="region" is intentional, per the file\'s own comments.',
      },
    ],
    observed:
      'The component takes the full screen and blocks all other interaction (it gates the whole App render path before LaunchScreen) — it is functionally a modal dialog. But the outer wrapper uses `role="region"` rather than `role="dialog"` with `aria-modal="true"`.',
    rationale:
      'Screen reader users navigating by landmarks will see "Welcome screen region" instead of "Welcome screen dialog." For a first-launch surface that\'s effectively modal (no escape to other content while it\'s mounted), `dialog` more accurately describes the experience. This is an area where Warden\'s landmark check passes but the underlying intent is closer to dialog semantics.',
    proposedFix:
      'Change `role="region"` to `role="dialog"` and add `aria-modal="true"`. Keep the `aria-label="Welcome screen"`. Verify Warden still passes — most landmark linters accept dialog as a valid top-level wrapper when aria-modal is set.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-5',
    title: 'Rapidly-mounted live regions may not announce reliably across screen readers',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 386,
        excerpt:
          '<div\n  className="flex flex-col items-center gap-4 py-12"\n  aria-live="polite"\n  aria-atomic="true"\n>',
        note:
          'DetectingPanel — only mounted for the duration of one IPC call (typically < 100ms).',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 484,
        excerpt: 'WritingPanel uses identical aria-live + aria-atomic pattern',
      },
    ],
    observed:
      'The `DetectingPanel` and `WritingPanel` both carry `aria-live="polite"` regions, but they are typically mounted for < 100ms (one IPC round-trip). Some screen readers (NVDA in some configs, VoiceOver under load) coalesce or drop announcements when a live region appears for shorter than ~150ms.',
    rationale:
      'A blind tester running the welcome flow may not hear "Let me set this up for you…" or "Writing config…" because the regions mount and unmount faster than the announcement queue can drain. The visible spinner gives sighted users feedback; non-visual users rely on these announcements.',
    proposedFix:
      'Either (a) keep a single, persistent live region at the component root that updates its text content as state changes (more reliable across screen readers), or (b) defer the state transition by ~300ms after mounting the live panel so the announcement has time to fire. Option (a) is the cleaner long-term fix.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-6',
    title: 'Several headings drift from the spec\'s designer-to-designer voice',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 493,
        excerpt: '<p className="text-sm text-zinc-400">Writing config…</p>',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 553,
        excerpt: '<h2 className="text-lg font-semibold text-zinc-100">Troubleshooting</h2>',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 618,
        excerpt: '<h2 className="text-lg font-semibold text-zinc-100">Manual setup</h2>',
      },
    ],
    observed:
      'The welcome and connect-confirm copy hits the spec\'s designer-to-designer voice, but downstream panels drift toward institutional language: "Writing config…", "Troubleshooting", "Manual setup".',
    rationale:
      'The spec calls for a friendly voice throughout: "Let me set this up for you," "Done. I added Flint…". A user moving from welcome → writing → help → manual hears the voice flatten as they go deeper into the flow — exactly when they\'re most likely to need reassurance. Phase B will rework voice for the coach panel; Phase A could land closer to that tone.',
    proposedFix:
      'Replace: "Writing config…" → "One sec — adding Flint." / "Troubleshooting" → "Hmm, let\'s check three things." / "Manual setup" → "Doing it by hand." Voice is the cheapest UX upgrade and the spec is clear about wanting it.',
    scope: 'one-file',
    status: 'open',
  },
];

const counts = countFindings(findings);
const verdict = deriveVerdict(findings, 'ux');

export const REPORT: ReviewReport = {
  meta: {
    phase: 'HELLO-FLINT-PHASE-A',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-26',
    round: 1,
    scope: [
      'HelloFlintWelcome component (welcome / detecting / connect-confirm / writing / verify / help / manual / error)',
      'HelloFlintWelcome.test.tsx coverage of state machine and IPC mocks',
      'App.tsx gate ordering and alreadyConnected fast-path',
      'docs/beta/INSTALL-GUIDE.md alignment with new first-launch sequence',
      'docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md fidelity check',
    ],
    markdownFile: 'HELLO-FLINT-PHASE-A-ux-review-2026-04-26.md',
  },
  rubric: [
    {
      criterion: 'Welcome copy matches spec verbatim (heading, two-halves paragraph, 5-min framing, CTA, skip, footer)',
      result: 'pass',
    },
    {
      criterion: 'Skip is a small text link, low-friction, no shame styling',
      result: 'pass',
    },
    {
      criterion: 'alreadyConnected fast-path skips the screen silently for returning users (< 250ms invariant)',
      result: 'pass',
      evidence:
        'App.tsx:145 initializes hasSeenWelcome from localStorage synchronously; HelloFlintWelcome never renders for returning users.',
    },
    {
      criterion: 'Smart auto-connect honors all spec beats (detection list, picker, "your other servers untouched", green-dot/help, manual)',
      result: 'pass',
    },
    {
      criterion: 'Detection failure (no editors / IPC error) falls through to a usable connect-confirm with manual reachable',
      result: 'pass',
    },
    {
      criterion: 'Partial bulk-write failure shows both written and failed editors honestly',
      result: 'pass',
      evidence: 'describeWriteResult at HelloFlintWelcome.tsx:81 + HFW-06 test coverage.',
    },
    {
      criterion: 'Slow detection has a timeout / recovery path',
      result: 'fail',
      evidence: 'No timeout race in handleLetsGo (HelloFlintWelcome.tsx:175); spinner hangs forever on stalled IPC.',
      relatedFindings: ['WARN-4'],
    },
    {
      criterion: 'Manual snippet Copy button confirms success to the user',
      result: 'fail',
      evidence: 'navigator.clipboard.writeText at line 612; no visible confirmation, button text never changes.',
      relatedFindings: ['WARN-5'],
    },
    {
      criterion: 'Focus moves into the new panel on each state transition',
      result: 'fail',
      evidence: 'useEffect at line 150 has empty deps; only fires on initial mount, not on state changes.',
      relatedFindings: ['WARN-6'],
    },
    {
      criterion: 'All text colors meet WCAG 2.1 AA contrast (4.5:1 for normal text, 3:1 for large)',
      result: 'fail',
      evidence: 'text-zinc-600 on bg-zinc-950 ≈ 3.96:1 in the build footer (line 372–376).',
      relatedFindings: ['WARN-7'],
    },
    {
      criterion: 'Voice is consistently designer-to-designer across all states',
      result: 'fail',
      evidence:
        '"Writing config…", "Troubleshooting", "Manual setup" headings drift institutional (lines 493, 553, 618).',
      relatedFindings: ['SUG-6'],
    },
    {
      criterion: 'Install guide first-launch description matches the new sequence',
      result: 'fail',
      evidence:
        'docs/beta/INSTALL-GUIDE.md:55 still describes the old "land on the launch screen → Open Demo Project" flow.',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion: 'Token-only styling — zero raw hex literals or arbitrary bracket colors in source',
      result: 'pass',
      evidence: 'HFW-09 test asserts via static grep against the file source.',
    },
    {
      criterion: 'Escape is blocked during writing state to prevent mid-transaction cancellation',
      result: 'pass',
      evidence: 'isWriting check at line 158; HFW-10 test confirms.',
    },
    {
      criterion: 'aria-live regions present on async-state panels (detecting, writing, verify)',
      result: 'pass',
    },
    {
      criterion: '"Both" button label and action are consistent with each other',
      result: 'fail',
      evidence:
        'hasBoth gate (line 409) requires Cursor + Claude Code; click action (line 443) sends every present editor.',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: '"Looking for…" copy only appears while detection is actually in flight',
      result: 'fail',
      evidence:
        'connect-confirm panel renders "Looking for VS Code… not found" after detection has resolved (line 476).',
      relatedFindings: ['WARN-3'],
    },
  ],
  findings,
  counts,
  verdict,
  scopeCoverage: {
    reviewed: [
      'src/components/ui/HelloFlintWelcome.tsx',
      'src/components/ui/__tests__/HelloFlintWelcome.test.tsx',
      'src/App.tsx (gates between consent dialog and LaunchScreen)',
      'docs/beta/INSTALL-GUIDE.md',
      'docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md',
      '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md',
      '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
    ],
    skipped: [
      'server/services/ideDetection.ts — server-side detection logic (code reviewer scope)',
      'server/services/mcpConfigWriter.ts — atomic write logic (security + code reviewer scope)',
      'shared/ipc-validators.ts — Zod schema verification (security reviewer scope)',
      'src/adapters/web-api.ts — IPC adapter wiring (code reviewer scope)',
      'Phase B walkthrough — not built yet, separate spec',
      'Linux/Windows detection — non-darwin paths explicitly out of scope per contract nonGoals',
      'Live screen-reader testing with NVDA/VoiceOver — UX critic flagged SUG-5 from analysis; live test deferred to QA',
    ],
  },
};
