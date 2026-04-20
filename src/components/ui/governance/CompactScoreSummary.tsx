/**
 * CompactScoreSummary.tsx — C3 extraction from GovernanceDashboard
 *
 * Renders:
 *   - COUNSEL.1.1: Category filter chips (design-system, accessibility, token-sync)
 *   - Score summary row: mini ring + grade letter + score/100 + export badge
 *   - Effort framing text
 *   - COUNSEL.1.2: Delta mode auto-enable banner
 *   - Export-ready banner (when not blocked)
 *
 * Pure presentational — zero Zustand reads, zero IPC, zero side-effects.
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 * - Score number → text-display + text-primary (primary-content)
 * - Category chips → state-signal via StatBadge-like pattern
 * - Export badges → StatBadge (state-signal)
 * - Effort text → text-body + text-secondary (support-evidence)
 * - Delta banner text → text-label + text-secondary (metadata)
 *
 * @schemaRole primary-content (score number)
 * @schemaRole state-signal (export badge, category chips)
 * @schemaRole support-evidence (effort text)
 * @schemaRole metadata (delta banner)
 * @schemaRole cta-secondary (Export button, Show all, Dismiss)
 */

import { ShieldCheck, SendHorizonal } from 'lucide-react';
import StatBadge from '../primitives/StatBadge';
import { GRADE_TEXT, GRADE_RING } from './ScoreSection';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CompactScoreSummaryProps {
  score: number;
  grade: string;
  exportBlocked: boolean;
  ringPulse: boolean;

  // Category chips
  mithrilCount: number;
  a11yCount: number;
  syncCount: number;
  activeCategory: 'design-system' | 'accessibility' | 'token-sync' | null;
  onSetCategory: (cat: 'design-system' | 'accessibility' | 'token-sync' | null) => void;

  // Blocking dot counts (GAP-11)
  designSystemBlockingCount?: number;
  a11yBlockingCount?: number;
  syncBlockingCount?: number;

  // Effort framing
  effortText: string;

  // Delta mode banner (COUNSEL.1.2)
  initialViolationCount?: number;
  isBaselineSet: boolean;
  bannerDismissed: boolean;
  onDismissBanner: () => void;
  onShowAllViolations: () => void;

  // Export gate
  onOpenExportModal?: () => void;
}

// ── Token styles ──────────────────────────────────────────────────────────────

const BODY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-body)',
  lineHeight: 'var(--text-body-lh)',
  fontWeight: 'var(--text-body-weight)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
};

const DISPLAY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-display)',
  lineHeight: 'var(--text-display-lh)',
  fontWeight: 'var(--text-display-weight)',
  color: 'var(--text-primary)',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CompactScoreSummary — score ring + category chips + effort framing.
 *
 * @schemaRole primary-content
 */
export function CompactScoreSummary({
  score,
  grade,
  exportBlocked,
  ringPulse,
  mithrilCount,
  a11yCount,
  syncCount,
  activeCategory,
  onSetCategory,
  designSystemBlockingCount = 0,
  a11yBlockingCount = 0,
  syncBlockingCount = 0,
  effortText,
  initialViolationCount,
  isBaselineSet,
  bannerDismissed,
  onDismissBanner,
  onShowAllViolations,
  onOpenExportModal,
}: CompactScoreSummaryProps) {
  const totalViolations = mithrilCount + a11yCount;

  return (
    <>
      {/* COUNSEL.1.1: Category chips — state-signal role */}
      {totalViolations > 0 && (
        <div
          className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800"
          data-testid="category-chips"
        >
          {mithrilCount > 0 && (
            <button
              type="button"
              aria-pressed={activeCategory === 'design-system'}
              onClick={() =>
                onSetCategory(activeCategory === 'design-system' ? null : 'design-system')
              }
              data-schema-role="state-signal"
              data-testid="chip-design-system"
              className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 hover:border-amber-500/50 hover:bg-amber-900/20 aria-pressed:border-amber-500/50 aria-pressed:bg-amber-900/20 transition-colors"
              style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
            >
              {designSystemBlockingCount > 0 && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                  aria-label="blocks export"
                  data-testid="chip-design-system-blocking-dot"
                  title="Contains violations that block export"
                />
              )}
              Design System {mithrilCount}
            </button>
          )}

          {a11yCount > 0 && (
            <button
              type="button"
              aria-pressed={activeCategory === 'accessibility'}
              onClick={() =>
                onSetCategory(activeCategory === 'accessibility' ? null : 'accessibility')
              }
              data-schema-role="state-signal"
              data-testid="chip-accessibility"
              className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 hover:border-red-500/50 hover:bg-red-900/20 aria-pressed:border-red-500/50 aria-pressed:bg-red-900/20 transition-colors"
              style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
            >
              {a11yBlockingCount > 0 && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                  aria-label="blocks export"
                  data-testid="chip-accessibility-blocking-dot"
                  title="Contains violations that block export"
                />
              )}
              Accessibility {a11yCount}
            </button>
          )}

          {syncCount > 0 && (
            <button
              type="button"
              aria-pressed={activeCategory === 'token-sync'}
              onClick={() =>
                onSetCategory(activeCategory === 'token-sync' ? null : 'token-sync')
              }
              data-schema-role="state-signal"
              data-testid="chip-token-sync"
              className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 hover:border-indigo-500/50 hover:bg-indigo-900/20 aria-pressed:border-indigo-500/50 aria-pressed:bg-indigo-900/20 transition-colors"
              style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
            >
              {syncBlockingCount > 0 && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                  aria-label="blocks export"
                  data-testid="chip-token-sync-blocking-dot"
                  title="Contains violations that block export"
                />
              )}
              Token Sync {syncCount}
            </button>
          )}
        </div>
      )}

      {/* Score summary row: mini ring + grade + score/100 + export badge */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800">
        {/* Mini ring — 32px inline SVG */}
        {(() => {
          const RADIUS = 13;
          const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
          const filled = (score / 100) * CIRCUMFERENCE;
          const gap = CIRCUMFERENCE - filled;
          return (
            <svg
              width={32}
              height={32}
              viewBox="0 0 32 32"
              className={`shrink-0${ringPulse ? ' motion-safe:animate-pulse' : ''}`}
              aria-label={`Health score ${score} out of 100`}
              role="img"
              data-testid="score-ring"
            >
              <circle
                cx={16}
                cy={16}
                r={RADIUS}
                fill="none"
                className="stroke-zinc-800"
                strokeWidth={3}
              />
              <circle
                cx={16}
                cy={16}
                r={RADIUS}
                fill="none"
                className={GRADE_RING[grade]}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${gap}`}
                transform="rotate(-90 16 16)"
              />
            </svg>
          );
        })()}

        {/* Grade + score — primary-content */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`font-bold ${GRADE_TEXT[grade]}`}
            aria-label={`Grade ${grade}`}
            data-schema-role="primary-content"
            style={DISPLAY_STYLE}
          >
            {grade}
          </span>
          <span
            style={{ ...LABEL_STYLE, color: 'var(--text-tertiary)' }}
          >
            {score}/100
          </span>
          {/* State-signal: export gate badge */}
          {exportBlocked ? (
            <StatBadge variant="critical" compact>
              Export blocked
            </StatBadge>
          ) : (
            <StatBadge variant="success" compact>
              Ready to export
            </StatBadge>
          )}
        </div>
      </div>

      {/* Support-evidence: Effort text */}
      <p
        className="px-3 py-1.5"
        data-testid="effort-framing"
        data-schema-role="support-evidence"
        style={{ ...BODY_STYLE, color: 'var(--text-secondary)' }}
      >
        {effortText}
      </p>

      {/* Metadata: Delta mode auto-enable banner (COUNSEL.1.2) */}
      {(initialViolationCount ?? 0) > 10 && isBaselineSet && !bannerDismissed && (
        <div
          className="mx-3 mb-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-3 py-2"
          data-testid="delta-mode-auto-banner"
          data-schema-role="metadata"
        >
          <p style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}>
            Delta mode active — showing new issues only. There are{' '}
            {initialViolationCount} existing violations being filtered.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              aria-label="Show all violations"
              onClick={onShowAllViolations}
              data-schema-role="cta-secondary"
              className="underline hover:opacity-80 transition-opacity"
              style={{ ...LABEL_STYLE, color: 'var(--text-accent)' }}
            >
              Show all violations
            </button>
            <button
              type="button"
              aria-label="Dismiss delta mode banner"
              onClick={onDismissBanner}
              data-schema-role="cta-secondary"
              className="hover:opacity-80 transition-opacity"
              style={{ ...LABEL_STYLE, color: 'var(--text-tertiary)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Export gate — full-width banner when not blocked */}
      {!exportBlocked && (
        <div className="px-3 py-1.5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-900/10 px-3 py-1.5">
            <ShieldCheck
              size={12}
              className="shrink-0 text-emerald-400"
              aria-hidden="true"
            />
            <span
              className="flex-1"
              style={{ ...BODY_STYLE, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              {isBaselineSet ? 'No new issues — export ready' : 'All clear — export ready'}
            </span>
            <button
              type="button"
              onClick={() => onOpenExportModal?.()}
              data-schema-role="cta-secondary"
              className="flex items-center gap-1 rounded bg-emerald-600/20 px-2.5 py-1 hover:bg-emerald-600/30 transition-colors"
              aria-label="Open export modal"
              style={{ ...BODY_STYLE, color: 'var(--text-accent)' }}
            >
              Export
              <SendHorizonal size={10} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
