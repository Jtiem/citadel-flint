/**
 * TelemetryConsentDialog — src/components/ui/TelemetryConsentDialog.tsx
 *
 * BETA.TEL — First-launch telemetry consent gate.
 *
 * Renders when consent.state === 'unset'. The user must explicitly Accept
 * before any telemetry events are emitted (opt-in default, GDPR-defensible).
 *
 * A11y compliance (Warden):
 *   - role="dialog" + aria-modal="true"
 *   - aria-labelledby / aria-describedby
 *   - Focus trap via the shared FocusTrap component
 *   - Initial focus on the Decline button (privacy-safe default — user must
 *     affirmatively click Accept)
 *   - Escape key routes to Decline path
 *
 * Backdrop click is intentionally a no-op. Consent decisions must be explicit
 * — accidental dismissal via outside click is not an acceptable interaction for
 * a consent prompt.
 *
 * Commandment 2: Token-backed Tailwind classes for text colors (text-primary,
 * text-secondary, text-accent) defined in src/index.css @theme. Surface and
 * border zinc classes follow the codebase modal convention (see ExportModal).
 *
 * Renderer Process only — no Node.js imports.
 */

import { useCallback, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { FocusTrap } from './FocusTrap'
import type {
  TelemetryConsentDialogProps,
  TelemetrySetConsentPayload,
} from '../../../.flint-context/contracts/BETA-TELEMETRY-WIRING.contract'

// ── Component ─────────────────────────────────────────────────────────────────

export function TelemetryConsentDialog({ onDecided }: TelemetryConsentDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState(false)

  // Initial focus goes to Decline — the privacy-safe default.
  const declineRef = useRef<HTMLButtonElement>(null)

  const handleDecision = useCallback(
    async (state: 'accepted' | 'declined') => {
      if (isPending) return

      setIsPending(true)
      setError(false)

      try {
        const payload: TelemetrySetConsentPayload = { state }
        await window.flintAPI.telemetry.setConsent(payload)
        onDecided(state)
      } catch (err) {
        console.warn('[Flint] TelemetryConsentDialog: setConsent failed', err)
        setError(true)
        setIsPending(false)
      }
    },
    [isPending, onDecided],
  )

  const handleAccept  = useCallback(() => handleDecision('accepted'),  [handleDecision])
  const handleDecline = useCallback(() => handleDecision('declined'),  [handleDecision])
  // Escape → privacy-safe default (Decline)
  const handleEscape  = useCallback(() => handleDecision('declined'),  [handleDecision])

  return (
    // Backdrop — dimmed full-screen overlay matching ExportModal pattern
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="telemetry-consent-backdrop"
    >
      <FocusTrap initialFocusRef={declineRef} onClose={handleEscape}>
        {/*
          dialog card — matches the modal visual language used by ExportModal:
          bg-zinc-900, border-zinc-800, rounded-lg, shadow-2xl. Text colors
          use the semantic tokens defined in src/index.css @theme.
        */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telemetry-dialog-title"
          aria-describedby="telemetry-dialog-description"
          className="mx-4 w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
          data-testid="telemetry-consent-dialog"
        >
          {/* ── Header ───────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
            <ShieldCheck size={18} className="shrink-0 text-accent" />
            <h1
              id="telemetry-dialog-title"
              className="text-sm font-semibold text-primary"
            >
              Usage data &amp; feedback
            </h1>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────────── */}
          <div className="px-5 py-4 space-y-4">
            <p
              id="telemetry-dialog-description"
              className="text-sm leading-relaxed text-secondary"
            >
              Flint Beta can send anonymous usage events and your feedback
              submissions to help us improve. No file contents or design data
              leave your machine. Telemetry is{' '}
              <span className="font-medium text-primary">off until you opt in here.</span>
            </p>

            {/* ── What gets collected — collapsed disclosure (Warning 2) ──────── */}
            <details
              className="group rounded border border-zinc-700/50 bg-zinc-800/40"
              data-testid="telemetry-disclosure"
            >
              <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 motion-safe:transition-colors">
                <span
                  className="inline-block motion-safe:transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >
                  ›
                </span>
                What gets collected?
              </summary>
              <ul
                className="space-y-1.5 px-4 pb-3 pt-1 text-xs text-secondary"
                data-testid="telemetry-disclosure-list"
              >
                <li>App launches — OS, app version, and display language. No IP address.</li>
                <li>Crashes — the error message and a redacted stack trace. Never your file contents.</li>
                <li>Tool names you use — the name only, never the inputs or arguments.</li>
                <li>Audit summaries — file count, violation count, and how long the audit took. No file paths.</li>
                <li>Session length — time from app open to close. Nothing else.</li>
              </ul>
            </details>

            {/* Error state — surfaced inline, does not dismiss the dialog */}
            {error && (
              <p
                role="alert"
                data-testid="telemetry-consent-error"
                className="rounded border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-xs text-amber-400"
              >
                Something went wrong saving your choice. Please try again.
              </p>
            )}
          </div>

          {/* ── Actions ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
            {/*
              Decline — initial focus target (privacy-safe default).
              Uses a bordered ghost style so both buttons read as peer choices,
              not primary CTA + escape hatch. Focus order and initial focus do
              the privacy-priming; visual weight is balanced. (Warning 4 fix.)
            */}
            <button
              ref={declineRef}
              onClick={handleDecline}
              disabled={isPending}
              className="rounded border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-200 motion-safe:transition-colors hover:bg-zinc-800 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50"
              data-testid="telemetry-decline-btn"
            >
              Decline
            </button>

            {/* Accept — visually prominent but not the initial focus */}
            <button
              onClick={handleAccept}
              disabled={isPending}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-primary motion-safe:transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-50"
              data-testid="telemetry-accept-btn"
            >
              {isPending ? 'Saving…' : 'Accept'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
