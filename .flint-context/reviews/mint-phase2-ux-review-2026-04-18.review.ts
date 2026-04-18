/**
 * MINT.5 Phase 2 — UX Review (machine-readable)
 *
 * Reviewer: flint-ux-reviewer (parallel with code + security)
 * Scope: 9 Phase 2 UI surfaces (sync cluster, confirm dialogs, drift sub-tab,
 * empty state, health bar integration, TokenManager orchestration, useSyncActions
 * hook copy paths).
 *
 * Round 1 surfaced 2 BLK + 3 WARN findings. This report reflects the state
 * AFTER the consensus-fix pass landed — all 5 findings are marked `fixed`.
 */

import {
    countFindings,
    deriveVerdict,
    type ReviewFinding,
    type ReviewReport,
} from '../../shared/review-schema';

/**
 * NOTE on severity: this report reflects the post-consensus-fix state. Round 1
 * surfaced 2 blocking + 3 warning findings; all 5 shipped fixes in this
 * branch. Per reviewer convention, resolved findings are downgraded to
 * `suggestion` so `deriveVerdict()` reflects the current shippable state
 * (no blocking, no warnings). The resolution notes preserve the round-1
 * severity and the fix scope for audit continuity.
 */
const findings: ReviewFinding[] = [
    {
        id: 'BLK-1',
        title: 'Push flow permanently disabled — localEditCount hardcoded to 0 (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 696,
                note: 'Original: `localEditCount={0}` hardcoded on TokenHealthBar forced Push disabled.',
            },
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 885,
                note: 'Original: `localEditCount={0}` hardcoded on ConfirmPushDialog. Dialog would render "Send 0 token changes" if opened.',
            },
            {
                file: 'src/components/ui/TokenManager.tsx',
                note: 'Fix: `syncCheckCounts` state fetched from `flint_sync_check`; derives localEditCount from `tokensDrifted` when recommendation is `push_needed`. Both call sites now pass real count.',
            },
        ],
        observed:
            'TokenManager wired localEditCount={0} to both <TokenHealthBar> (which disables Push when localEditCount === 0) and <ConfirmPushDialog>. Push was visible but permanently non-interactive in production. 8 ConfirmPushDialog tests exercised copy ("Send 0 token changes...") that the user could not trigger.',
        rationale:
            'This is a BLK — the contract\'s 2.1 impact explicitly promised a live Push flow, and the shipped code gated it behind a hardcoded zero. The integration validator SHIPped on an inline TODO that was not tracked in HANDOFF.md. User-facing impact: the Push button communicates an available action that silently does nothing.',
        proposedFix:
            'Fetch counts from flint_sync_check (which already returns pendingConflicts + tokensDrifted + recommendation). Derive localEditCount = recommendation === "push_needed" ? tokensDrifted : 0. Pass through to both render sites.',
        scope: 'one-file',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. TokenManager.tsx now fetches syncCheckCounts via a new `fetchSyncCheckCounts` callback; both TokenHealthBar and ConfirmPushDialog receive the live count. New test in TokenManager.phase2.test.tsx covers the enabled-on-non-zero path.',
    },
    {
        id: 'BLK-2',
        title: 'Persistent auth-expired state set in hook but never rendered in UI (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 150,
                note: 'Original: hook correctly set `lastError.persistent = true` on auth-expired and emitted a sticky critical toast.',
            },
            {
                file: 'src/components/ui/TokenHealthBar.tsx',
                note: 'Original: TokenHealthBarProps had no lastError prop. No render path consumed `lastError.persistent`.',
            },
            {
                file: 'src/components/ui/TokenHealthBar.tsx',
                note: 'Fix: new `lastError?: SyncActionError | null` prop; renders <SeverityChip severity="critical" label="Connection expired" /> when `lastError.persistent === true`.',
            },
            {
                file: 'src/components/ui/TokenManager.tsx',
                note: 'Fix: forwards `syncActions.lastError` to <TokenHealthBar>.',
            },
        ],
        observed:
            'Phase 2 contract §Open-Questions-5 specified: "Persistent badge for structural errors (Figma connection expired / revoked) — a <SeverityChip severity=\'critical\' label=\'sync error\'> appears in the bar until dismissed or connection restored." The hook set the signal (lastError.persistent=true) but no UI subscriber existed. Once the toast auto-dismissed or was evicted, the bar looked green despite a broken connection.',
        rationale:
            'BLK — the contract-promised persistent UI state was not implemented. Auth-expired is a structural error; the user cannot fix it by retrying blindly. A transient toast alone is insufficient narration.',
        proposedFix:
            'Add lastError prop to TokenHealthBar. Render a SeverityChip with severity="critical" label="Connection expired" between the grade pill and the total-tokens pill when persistent===true. Forward syncActions.lastError from TokenManager.',
        scope: 'cross-file',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. New lastError prop on TokenHealthBar plus new render branch for the persistent chip. Integration test in TokenManager.phase2.test.tsx simulates auth-expired Pull and asserts the chip appears.',
    },
    {
        id: 'WARN-1',
        title: 'Connect toast leaked Citadel vocabulary ("Alliance OAuth flow started") (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 286,
                note: 'Original: title "Figma connected", message "Alliance OAuth flow started."',
            },
            {
                file: 'src/hooks/useSyncActions.ts',
                note: 'Fix: title "Opening Figma", message "Complete the approval in your browser to finish connecting."',
            },
        ],
        observed:
            '"Alliance" is a Citadel internal name (CLAUDE.md §Feature Names explicitly forbids surfacing it). "OAuth" is technical jargon. "Figma connected" implied a completed handshake but actually fired the moment the OAuth tab opened, not when the user approved.',
        rationale:
            'Plain-language-output feedback in memory says: "Format all output for a non-technical audience — plain English, no jargon, clear next steps." This copy failed all three tests. Designers and PMs see "Alliance" and have no idea what it means.',
        proposedFix:
            'Rewrite title + message. Do not advertise premature success. No Citadel names in UI.',
        scope: 'one-file',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. Copy changed to "Opening Figma" / "Complete the approval in your browser to finish connecting." New test in useSyncActions.test.ts asserts no "Alliance" or "OAuth" in the toast.',
    },
    {
        id: 'WARN-2',
        title: 'Silent auto-revert from drift sub-tab stranded the user after successful Pull (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 349,
                note: 'Original: useEffect auto-flipped viewMode from "drift" to "grid" when driftedTokens.length === 0.',
            },
            {
                file: 'src/components/ui/TokenManager.tsx',
                note: 'Fix: effect removed; drift radio stays visible while viewMode === "drift" so DriftGroupSection can render its empty state.',
            },
        ],
        observed:
            'User on drift sub-tab clicks Pull-this on every row, drift empties, viewMode silently flips to grid, drift radio hides. DriftGroupSection\'s "No drift detected · Your local tokens match Figma" empty state never renders. User has no signal that the Pull succeeded — they just find themselves in a different view.',
        rationale:
            'UX principle: do not change user location without narration. The empty state is a better teacher than the auto-revert — it confirms the action worked AND shows the healthy state.',
        proposedFix:
            'Delete the auto-revert effect. Extend the drift-radio render gate from `driftedTokens.length > 0` to `driftedTokens.length > 0 || viewMode === "drift"` so the radio stays visible until the user navigates away.',
        scope: 'one-line',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. Auto-revert effect removed; radio gate updated. Test in TokenManager.phase2.test.tsx now asserts the radio stays visible and drift-group-empty renders instead of viewMode swapping.',
    },
    {
        id: 'WARN-3',
        title: 'Resolve button label did not telegraph consequence — reflex Enter-press bulk-overwrote local tokens (fixed)',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/mint/ConfirmResolveDialog.tsx',
                line: 149,
                note: 'Original: button label always read "Resolve" regardless of selected strategy.',
            },
            {
                file: 'src/components/ui/mint/ConfirmResolveDialog.tsx',
                note: 'Fix: button label dynamically reads "Use Figma values" when prefer-figma is selected, "Keep local values" when prefer-local is selected.',
            },
        ],
        observed:
            'Initial focus was on Confirm and default strategy was prefer-figma. A keyboard user pressing Enter reflexively (fastest dismissal pattern) would bulk-overwrite their local tokens with Figma values before reading the radio. The button text "Resolve" gave no indication of outcome.',
        rationale:
            'Destructive-action buttons must telegraph their consequence. "Resolve" is neutral; either direction is destructive. Labeling the button with the selected outcome keeps the fast keyboard flow (initial focus on Confirm) while ensuring the user sees what is about to happen.',
        proposedFix:
            'Swap the static "Resolve" label for a conditional: strategy === "prefer-figma" ? "Use Figma values" : "Keep local values". Keep initial focus on Confirm.',
        scope: 'one-line',
        status: 'accepted',
        resolution:
            'FIXED in consensus-fix pass. Two new test cases in ConfirmResolveDialog.test.tsx assert both label variants.',
    },
];

const counts = countFindings(findings);
const verdict = deriveVerdict(findings, 'ux');

export const REPORT: ReviewReport = {
    meta: {
        phase: 'MINT.5.2',
        dimension: 'ux',
        reviewer: 'flint-ux-reviewer',
        date: '2026-04-18',
        round: 1,
        scope: [
            'Phase 2 user paths: connect from empty state, drift sub-tab, Pull/Push/Resolve, confirm dialogs, auth-expired state surfaces, keyboard flows',
            '9 production UI files reviewed',
        ],
        markdownFile: 'mint-phase2-ux-review-2026-04-18.md',
    },
    rubric: [
        { criterion: 'Every user-facing button has a matching test that clicks it and asserts a side effect', result: 'pass', evidence: 'Pull / Push / Resolve / Connect / per-row PullOne all have integration tests' },
        { criterion: 'Confirm dialogs use role="dialog" + aria-modal="true" + FocusTrap', result: 'pass', evidence: 'ConfirmPushDialog.tsx:60, ConfirmResolveDialog.tsx:60' },
        { criterion: 'No Citadel feature names surface in user-facing copy', result: 'pass', evidence: 'Connect toast rewritten after WARN-1 fix — no "Alliance" / "Envoy" / "Mint" in UI strings', relatedFindings: ['WARN-1'] },
        { criterion: 'Destructive-action button labels communicate consequence', result: 'pass', evidence: 'Resolve dialog now reads "Use Figma values" / "Keep local values" after WARN-3 fix', relatedFindings: ['WARN-3'] },
        { criterion: 'Empty states render human-readable guidance, not mechanical text', result: 'pass', evidence: 'ConnectFigmaEmptyState + DriftGroupSection both ship human-readable messaging' },
        { criterion: 'Sync error surfaces both transient (toast) and persistent (chip) states', result: 'pass', evidence: 'Persistent chip wired in TokenHealthBar after BLK-2 fix', relatedFindings: ['BLK-2'] },
        { criterion: 'User location in the UI is not silently changed by background events', result: 'pass', evidence: 'Auto-revert effect removed after WARN-2 fix', relatedFindings: ['WARN-2'] },
        { criterion: 'Push flow is reachable with real counts in production (not gated on a hardcoded 0)', result: 'pass', evidence: 'flint_sync_check wired through syncCheckCounts state after BLK-1 fix', relatedFindings: ['BLK-1'] },
    ],
    findings,
    counts,
    verdict,
    scopeCoverage: {
        reviewed: [
            'src/components/ui/TokenManager.tsx',
            'src/components/ui/TokenHealthBar.tsx',
            'src/components/ui/mint/SyncActionCluster.tsx',
            'src/components/ui/mint/ConfirmPushDialog.tsx',
            'src/components/ui/mint/ConfirmResolveDialog.tsx',
            'src/components/ui/mint/TokenDriftRow.tsx',
            'src/components/ui/mint/DriftGroupSection.tsx',
            'src/components/ui/mint/ConnectFigmaEmptyState.tsx',
            'src/hooks/useSyncActions.ts (copy paths only)',
            '.flint-context/contracts/MINT.5-phase2-contract.md',
        ],
        skipped: [
            'Internal hook architecture (serialization guard, Zod parse) — handled by code reviewer',
            'IPC validators and preload bridge — handled by security reviewer',
            'MCP tool handlers — out of Phase 2 scope',
            'Web parity server — handled by code reviewer',
            'Notification store internals — pre-existing, unchanged',
        ],
    },
};
