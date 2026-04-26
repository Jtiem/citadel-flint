/**
 * SyncStalenessBanner — src/components/ui/mint/SyncStalenessBanner.tsx
 *
 * MINT.5 Phase 3 — Sync Staleness Banner (Envoy)
 *
 * Amber banner shown above TokenHealthBar when `isStale && !isDismissed`.
 * Provides a "Pull now" CTA that fires onPull and a dismiss X button that
 * fires onDismiss. Returns null when not stale or dismissed.
 *
 * Contract satisfied:
 *   - role="status" + aria-live="polite" (status region, not alert)
 *   - Renders nothing when !isStale || isDismissed
 *   - CTA fires onPull exactly once per click (no extra state)
 *   - Dismiss fires onDismiss exactly once per click
 *   - hoursSinceSync drives the copy ("Last synced 26 hours ago")
 *   - Dismiss button has visible focus ring (accessible keyboard activation)
 *
 * Purely presentational — no store access, no IPC. Caller (TokenManager)
 * supplies all props from useSyncStaleness + useSyncStalenessStore.
 *
 * Contract: MINT.5-phase3.contract.ts — SyncStalenessBannerProps
 * Commandment 5 (Accessibility): role=status + aria-live=polite
 *
 * Renderer Process only — no Node.js imports.
 */

import { X, RefreshCw } from 'lucide-react'
import type { SyncStalenessBannerProps } from '../../../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Component ─────────────────────────────────────────────────────────────────

export function SyncStalenessBanner({
  hoursSinceSync,
  isStale,
  isDismissed,
  onPull,
  onDismiss,
}: SyncStalenessBannerProps) {
  // Short-circuit: render nothing when not stale or already dismissed.
  if (!isStale || isDismissed) return null

  // Format duration copy — matches the human-readable pattern from
  // shared/syncStaleness.ts but derived directly from the hours prop so this
  // component remains a pure presentational leaf with no shared module dependency.
  const durationCopy = formatHours(hoursSinceSync)

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sync-staleness-banner"
      className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-900/20 px-3 py-2"
    >
      {/* ── Duration copy ── */}
      <p className="flex-1 text-xs text-amber-400">
        Last synced {durationCopy} ago. Pull to refresh.
      </p>

      {/* ── Pull CTA ── */}
      <button
        type="button"
        onClick={onPull}
        data-testid="staleness-pull-cta"
        aria-label="Pull now to refresh tokens"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-zinc-900"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Pull now
      </button>

      {/* ── Dismiss ── */}
      <button
        type="button"
        onClick={onDismiss}
        data-testid="staleness-dismiss-btn"
        aria-label="Dismiss staleness warning"
        className="flex shrink-0 items-center justify-center rounded p-1 text-amber-400/70 transition-colors hover:bg-amber-900/30 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-zinc-900"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Format hoursSinceSync into a human-readable duration string.
 * Mirrors the shape of shared/syncStaleness.ts formatStaleness but works
 * from pre-computed hours rather than milliseconds.
 */
function formatHours(hours: number): string {
  // Guard against negative hours (clock skew, future timestamps).
  // Without this, formatHours(-0.5) returns "-30 minutes" (W3, code review 2026-04-20).
  if (hours < 0) return 'a few moments'
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
  // Show hours until 48h (2 days); above that switch to days.
  if (hours < 48) {
    const h = Math.round(hours)
    return `${h} hour${h !== 1 ? 's' : ''}`
  }
  const days = Math.round(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''}`
}
