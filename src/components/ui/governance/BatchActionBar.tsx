/**
 * BatchActionBar.tsx — Extracted from GovernanceDashboard (Sprint 3A refactor)
 *
 * Renders the batch action buttons above the violations list:
 * - Apply N accepted fixes
 * - Auto-fix N Mithril issues
 * - Fix all a11y (N)
 * - Review N manually (expands those cards)
 * - Session fix progress indicator
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 * Note: "Issues" section label uses text-title + text-secondary (NOT uppercase).
 * All-caps is exclusively via PanelTabLabel per canary-zero-inline-uppercase invariant.
 *
 * @schemaRole primary-content (section label)
 * @schemaRole cta-secondary (action buttons)
 * @schemaRole metadata (session progress, effort estimate)
 */

import { Check, Wand2 } from 'lucide-react';

export interface BatchActionBarProps {
  acceptedCount: number;
  autoFixableCount: number;
  a11yFixableCount: number;
  manualCount: number;
  onApplyAccepted: () => void;
  onAutoFixMithril: () => void;
  onFixAllA11y: () => void;
  onReviewManual: () => void;
  sessionProgress?: {
    fixed: number;
    total: number;
  };
  isBaselineSet?: boolean;
  /** COUNSEL.2.4: Effort estimate text (detailed breakdown) */
  effortEstimate?: string;
}

// ── Token styles ──────────────────────────────────────────────────────────────

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-title)',
  lineHeight: 'var(--text-title-lh)',
  fontWeight: 'var(--text-title-weight)',
  color: 'var(--text-primary)',
};

const CTA_SEC_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
};

const METADATA_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-tertiary)',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * BatchActionBar — CTA group for batch violation fixes.
 *
 * @schemaRole primary-content
 */
export function BatchActionBar({
  acceptedCount,
  autoFixableCount,
  a11yFixableCount,
  manualCount,
  onApplyAccepted,
  onAutoFixMithril,
  onFixAllA11y,
  onReviewManual,
  sessionProgress,
  isBaselineSet = false,
  effortEstimate,
}: BatchActionBarProps) {
  const allFixed =
    sessionProgress &&
    sessionProgress.total > 0 &&
    sessionProgress.fixed >= sessionProgress.total;

  return (
    <div className="border-b border-zinc-800">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        {/* Primary-content section label — title-case, NOT uppercase */}
        <h3 className="flex-1" style={TITLE_STYLE}>
          Issues
          {isBaselineSet && (
            <span
              className="ml-1.5"
              style={{ fontSize: 'var(--text-label)', color: 'var(--text-accent)' }}
            >
              (new only)
            </span>
          )}
        </h3>

        {/* Metadata: session progress */}
        {sessionProgress && sessionProgress.total > 0 && !allFixed && (
          <span
            data-testid="session-progress-indicator"
            aria-live="polite"
            style={METADATA_STYLE}
          >
            Fixed {Math.max(0, sessionProgress.fixed)} of {sessionProgress.total} this session
          </span>
        )}

        {/* CTA-secondary: Apply accepted fixes */}
        {acceptedCount > 0 && (
          <button
            type="button"
            onClick={onApplyAccepted}
            data-schema-role="cta-secondary"
            data-testid="apply-accepted-fixes-button"
            className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-900/20 px-2.5 py-1 hover:bg-emerald-900/40 transition-colors"
            aria-label={`Apply ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'}`}
            style={{ ...CTA_SEC_STYLE, color: 'var(--text-accent)' }}
          >
            <Check size={9} aria-hidden="true" style={{ color: 'inherit' }} />
            Apply {acceptedCount} {acceptedCount === 1 ? 'fix' : 'fixes'}
          </button>
        )}

        {/* CTA-secondary: Auto-fix Mithril issues */}
        {autoFixableCount > 0 && (
          <button
            type="button"
            onClick={onAutoFixMithril}
            data-schema-role="cta-secondary"
            className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/20 px-2.5 py-1 hover:bg-indigo-900/40 transition-colors"
            aria-label={`Fix all ${autoFixableCount} auto-fixable issues`}
            style={{ ...CTA_SEC_STYLE, color: 'var(--text-accent)' }}
          >
            <Wand2 size={9} aria-hidden="true" />
            Auto-fix {autoFixableCount} {autoFixableCount === 1 ? 'issue' : 'issues'}
          </button>
        )}

        {/* CTA-secondary: Fix all a11y */}
        {a11yFixableCount > 0 && (
          <button
            type="button"
            onClick={onFixAllA11y}
            data-schema-role="cta-secondary"
            data-testid="fix-all-a11y-button"
            className="flex items-center gap-1 rounded border border-red-500/30 bg-red-900/20 px-2.5 py-1 hover:bg-red-900/40 transition-colors"
            aria-label={`Fix all ${a11yFixableCount} auto-fixable accessibility issues`}
            style={{ ...CTA_SEC_STYLE, color: 'var(--text-secondary)' }}
          >
            <Wand2 size={9} aria-hidden="true" />
            Fix all a11y ({a11yFixableCount})
          </button>
        )}

        {/* CTA-secondary: Review manual a11y */}
        {manualCount > 0 && (
          <button
            type="button"
            onClick={onReviewManual}
            data-schema-role="cta-secondary"
            data-testid="review-manual-a11y-button"
            className="underline-offset-2 hover:underline transition-colors"
            aria-label={`Review ${manualCount} accessibility issues that need manual input`}
            style={{ ...CTA_SEC_STYLE, color: 'var(--text-tertiary)' }}
          >
            Review {manualCount} manually
          </button>
        )}
      </div>

      {/* Metadata: Effort estimate */}
      {effortEstimate && !allFixed && (
        <p
          data-testid="effort-estimate"
          className="px-3 pb-1"
          style={METADATA_STYLE}
        >
          {effortEstimate}
        </p>
      )}

      {/* COUNSEL.2.5: Progress bar */}
      {sessionProgress &&
        sessionProgress.total > 0 &&
        !allFixed && (
          <div
            className="mx-3 mb-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.max(0, sessionProgress.fixed)}
            aria-valuemin={0}
            aria-valuemax={sessionProgress.total}
            aria-label={`Fix progress: ${Math.max(0, sessionProgress.fixed)} of ${sessionProgress.total}`}
            data-testid="session-progress-bar"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  (Math.max(0, sessionProgress.fixed) / sessionProgress.total) * 100
                )}%`,
              }}
            />
          </div>
        )}

      {/* COUNSEL.2.5: Celebration state */}
      {allFixed && (
        <div
          data-testid="session-all-fixed"
          className="flex items-center gap-2 px-3 pb-2"
          role="status"
          aria-live="polite"
        >
          <Check size={12} className="shrink-0 text-emerald-400" aria-hidden="true" />
          <span
            style={{
              fontSize: 'var(--text-body)',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            All clear! Zero violations.
          </span>
        </div>
      )}
    </div>
  );
}
