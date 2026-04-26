/**
 * GovernanceHeader.tsx — C5 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Header row for the governance health dashboard. Contains the Run Audit
 * button (CTA-primary), Delta Mode badge, override count, Autopilot toggle,
 * and the "Undo to clean" Rewind button (CTA-secondary).
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 *
 * @schemaRole cta-primary (Run Audit button)
 * @schemaRole cta-secondary (Autopilot toggle, Undo to clean)
 * @schemaRole state-signal (baseline badge, override count)
 */

import { Loader2, Play, Undo2 } from 'lucide-react';
import { formatRelativeTime } from '../../../utils/relativeTime';

// ── Clean state snapshot shape ────────────────────────────────────────────────

export interface CleanStateSnapshot {
  score: number;
  timestamp: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GovernanceHeaderProps {
  isAuditing: boolean;
  activeFilePath: string | null;
  totalViolations: number;
  lastAuditRanAt: number | null;
  isBaselineSet: boolean;
  govOverrideCount: number;
  autopilotEnabled: boolean;
  lastCleanState: CleanStateSnapshot | null;
  score: number;
  onRunAudit: () => void;
  onToggleAutopilot: () => void;
  onRewindToClean: () => void;
}

// ── Shared token styles ───────────────────────────────────────────────────────

const CTA_PRIMARY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-body)',
  fontWeight: 500,
  color: 'var(--text-accent)',
};

const CTA_SECONDARY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-accent)',
};

const CTA_DISABLED_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-body)',
  fontWeight: 500,
  color: 'var(--text-tertiary)',
  cursor: 'not-allowed',
};

const STATE_SIGNAL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * GovernanceHeader — panel header with audit CTA and secondary actions.
 *
 * @schemaRole primary-content (container)
 */
export function GovernanceHeader({
  isAuditing,
  activeFilePath,
  totalViolations,
  lastAuditRanAt,
  isBaselineSet,
  govOverrideCount,
  autopilotEnabled,
  lastCleanState,
  score,
  onRunAudit,
  onToggleAutopilot,
  onRewindToClean,
}: GovernanceHeaderProps) {
  const isStale =
    totalViolations > 0 &&
    lastAuditRanAt !== null &&
    Date.now() - lastAuditRanAt > 120_000;

  const isDisabled = isAuditing || !activeFilePath;

  return (
    <div className="border-b border-zinc-800 px-3 py-2 flex items-end justify-end">
      <div className="flex items-center gap-1.5">
        {/* CTA-primary: Run Audit — the one prominent action in this header */}
        <button
          type="button"
          onClick={onRunAudit}
          disabled={isDisabled}
          data-schema-role="cta-primary"
          data-testid="run-audit-button"
          aria-label={isAuditing ? 'Auditing in progress' : 'Run governance audit'}
          title="Live linting runs continuously. Run Audit performs a deeper check and syncs results to your IDE."
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          style={isDisabled ? CTA_DISABLED_STYLE : CTA_PRIMARY_STYLE}
        >
          {isAuditing ? (
            <Loader2 size={10} className="animate-spin" aria-hidden="true" />
          ) : (
            <Play size={10} aria-hidden="true" />
          )}
          {isAuditing ? 'Auditing...' : isStale ? 'Refresh Audit' : 'Run Audit'}
        </button>

        {/* State-signal: baseline badge */}
        {isBaselineSet && (
          <span
            className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-900/20 px-1.5 py-0.5"
            data-schema-role="state-signal"
            title="New Issues Only — issues present at baseline are excluded"
            style={{
              ...STATE_SIGNAL_STYLE,
              color: 'var(--text-accent)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
            New Issues Only
          </span>
        )}

        {/* State-signal: override count */}
        {govOverrideCount > 0 && (
          <span
            data-schema-role="state-signal"
            aria-label={`${govOverrideCount} governance rule ${govOverrideCount === 1 ? 'override' : 'overrides'} recorded this session`}
            style={{ ...STATE_SIGNAL_STYLE, color: 'var(--text-secondary)' }}
          >
            {govOverrideCount} {govOverrideCount === 1 ? 'override' : 'overrides'}
          </span>
        )}

        {/* CTA-secondary: Autopilot toggle */}
        {totalViolations > 0 && (
          <button
            type="button"
            data-schema-role="cta-secondary"
            data-testid="autopilot-header-toggle"
            onClick={onToggleAutopilot}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition border ${
              autopilotEnabled
                ? 'bg-indigo-600/20 border-indigo-500/30'
                : 'bg-zinc-800 border-zinc-700'
            }`}
            style={{
              ...CTA_SECONDARY_STYLE,
              color: autopilotEnabled ? 'var(--text-accent)' : 'var(--text-tertiary)',
            }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                autopilotEnabled ? 'bg-indigo-400' : 'bg-zinc-600'
              }`}
            />
            Autopilot {autopilotEnabled ? 'On' : 'Off'}
          </button>
        )}

        {/* CTA-secondary: Undo to clean */}
        <button
          type="button"
          data-schema-role="cta-secondary"
          data-testid="undo-to-clean-btn"
          onClick={onRewindToClean}
          disabled={!lastCleanState || score >= 95}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          aria-label={
            lastCleanState
              ? `Undo to last clean state from ${formatRelativeTime(lastCleanState.timestamp)}`
              : 'No clean baseline recorded'
          }
          title={
            lastCleanState
              ? `Revert to clean state from ${formatRelativeTime(lastCleanState.timestamp)}`
              : 'No clean baseline recorded'
          }
          style={
            !lastCleanState || score >= 95
              ? CTA_DISABLED_STYLE
              : CTA_SECONDARY_STYLE
          }
        >
          <Undo2 size={10} aria-hidden="true" />
          Undo to clean
        </button>
      </div>
    </div>
  );
}
