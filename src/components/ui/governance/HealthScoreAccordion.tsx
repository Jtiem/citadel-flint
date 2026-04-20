/**
 * HealthScoreAccordion.tsx — C4 extraction from GovernanceDashboard
 *
 * Renders the collapsible "Score breakdown" accordion including:
 *   - Next-step coaching sentence
 *   - Score trend hint
 *   - COUNSEL.4.2: Sparkline trajectory
 *   - Rewind to clean button
 *   - Sub-score breakdown rows (Fidelity, Accessibility, Overrides)
 *   - "How is this calculated?" modal
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 *
 * Per contract §Governance Panel Mapping:
 *   Score breakdown → `expandedWhen: () => false` (passive metric, no user lever).
 *   "Tracking starts after first audit" → MetadataTooltip (not inline text).
 *   Breakdown rows → PropertyRow (support-evidence inside Section body).
 *
 * @schemaRole primary-content (Section container — passive, collapses by default)
 * @schemaRole support-evidence (breakdown rows, coaching text)
 * @schemaRole metadata (sparkline empty state, sub-score legacy note)
 * @schemaRole cta-secondary (Rewind to clean, How is this calculated)
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Modal } from '../Modal';
import { GRADE_TEXT } from './ScoreSection';
import { Sparkline } from './ScoreSection';
import Section from '../primitives/Section';
import PropertyRow from '../primitives/PropertyRow';
import MetadataTooltip from '../primitives/MetadataTooltip';
import type { SectionContext } from '../primitives/Section';
import { HEALTH_SCORE_WEIGHTS } from '../../../../shared/healthScore';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HealthScoreAccordionProps {
  score: number;
  grade: string;
  mithrilCount: number;
  a11yCount: number;
  overrideCount: number;

  // Sparkline + trend
  healthHistory: Array<{
    date: string;
    score: number;
    grade: string;
  }>;
  scoreTrendHint: string | null;
  nextStep: {
    variant: string;
    text: string;
  };

  // Rewind to clean (COUNSEL.3.1)
  lastCleanState: {
    timestamp: string;
    score: number;
  } | null;
  onRewindToClean: () => void;

  // Sub-scores (passed as derived numbers so component stays pure)
  fidelityScore: number;
  a11yScore: number;

  /**
   * Canonical severity-bucketed counts driving the score (CHRON.1-repair / C2).
   */
  criticalCount?: number;
  amberCount?: number;
  advisoryCount?: number;
}

// ── Token styles ──────────────────────────────────────────────────────────────

const BODY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-body)',
  lineHeight: 'var(--text-body-lh)',
  fontWeight: 'var(--text-body-weight)',
  color: 'var(--text-secondary)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
};

const CTA_SEC_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-accent)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Score breakdown is always passive — the predicate ALWAYS returns false.
// This encodes the contract rule structurally: passive info must not use Section
// in the expanded-by-default sense.
const SCORE_BREAKDOWN_EXPANDED_WHEN = (_ctx: SectionContext): boolean => false;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * HealthScoreAccordion — passive score breakdown.
 *
 * @schemaRole primary-content
 */
export function HealthScoreAccordion({
  score,
  grade,
  mithrilCount,
  a11yCount,
  overrideCount,
  healthHistory,
  scoreTrendHint,
  nextStep,
  lastCleanState,
  onRewindToClean,
  fidelityScore,
  a11yScore,
  criticalCount,
  amberCount,
  advisoryCount,
}: HealthScoreAccordionProps) {
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  // Canonical severity-bucketed counts with safe fallbacks for legacy callers.
  const criticalBucket = criticalCount ?? a11yCount;
  const amberBucket = amberCount ?? mithrilCount;
  const advisoryBucket = advisoryCount ?? 0;

  // Sparkline (i) tooltip content — replaces the former inline "Tracking starts" text
  const sparklineTooltipContent = (
    <span style={LABEL_STYLE}>
      Tracking starts after first audit
    </span>
  );

  return (
    <div data-schema-role="primary-content">
      <Section
        title={`Score breakdown — ${grade}`}
        schemaRole="primary-content"
        expandedWhen={SCORE_BREAKDOWN_EXPANDED_WHEN}
        id="score-breakdown-section"
      >
        <div className="px-3 pb-2 space-y-1.5">
          {/* Support-evidence: coaching sentence */}
          <p
            data-testid="next-step-prompt"
            style={BODY_STYLE}
            className="pt-1"
          >
            {nextStep.text}
          </p>

          {/* Support-evidence: Score trend hint */}
          {scoreTrendHint && (
            <p
              data-testid="score-trend-hint"
              style={{ ...BODY_STYLE, color: 'var(--text-primary)' }}
            >
              {scoreTrendHint}
            </p>
          )}

          {/* Sparkline with (i) metadata tooltip for empty state */}
          <div className="flex items-center gap-1">
            {healthHistory.length >= 2 ? (
              <Sparkline data={healthHistory} />
            ) : (
              <MetadataTooltip content={sparklineTooltipContent} side="right">
                <span
                  data-testid="sparkline-empty"
                  style={{ ...LABEL_STYLE, color: 'var(--text-tertiary)' }}
                >
                  No history yet
                </span>
              </MetadataTooltip>
            )}
          </div>

          {/* CTA-secondary: Rewind to clean */}
          {score < 95 && lastCleanState && (
            <button
              type="button"
              onClick={onRewindToClean}
              data-schema-role="cta-secondary"
              data-testid="rewind-to-clean"
              className="text-left underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={CTA_SEC_STYLE}
            >
              Rewind to clean (score {lastCleanState.score},{' '}
              {relativeTime(lastCleanState.timestamp)})
            </button>
          )}

          {/* Support-evidence: Sub-score breakdown rows */}
          {(criticalBucket > 0 ||
            amberBucket > 0 ||
            advisoryBucket > 0 ||
            overrideCount > 0) && (
            <div className="space-y-0.5 pt-0.5">
              {criticalBucket > 0 && (
                <div data-testid="critical-score-row">
                  <PropertyRow
                    label="Critical issues"
                    value={`${criticalBucket} (−${criticalBucket * HEALTH_SCORE_WEIGHTS.critical} pts)`}
                    schemaRole="support-evidence"
                  />
                </div>
              )}
              {amberBucket > 0 && (
                <div data-testid="amber-score-row">
                  <PropertyRow
                    label="Design drift"
                    value={`${amberBucket} (−${amberBucket * HEALTH_SCORE_WEIGHTS.amber} pts)`}
                    schemaRole="support-evidence"
                  />
                </div>
              )}
              {advisoryBucket > 0 && (
                <div data-testid="advisory-score-row">
                  <PropertyRow
                    label="Advisory"
                    value={`${advisoryBucket} (−${advisoryBucket * HEALTH_SCORE_WEIGHTS.advisory} pts)`}
                    schemaRole="support-evidence"
                  />
                </div>
              )}
              {overrideCount > 0 && (
                <div data-testid="override-score-row">
                  <PropertyRow
                    label="Overrides"
                    value={`${overrideCount} active (−${overrideCount * HEALTH_SCORE_WEIGHTS.override} pts)`}
                    schemaRole="support-evidence"
                  />
                </div>
              )}
            </div>
          )}

          {/* CTA-secondary: How is this calculated? */}
          <button
            type="button"
            onClick={() => setIsScoreModalOpen(true)}
            data-schema-role="cta-secondary"
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={CTA_SEC_STYLE}
          >
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            How is this calculated?
          </button>

          {/* Score formula modal */}
          <Modal
            isOpen={isScoreModalOpen}
            onClose={() => setIsScoreModalOpen(false)}
            title="How Your Score Is Calculated"
            size="sm"
            data-testid="score-formula-modal"
          >
            <div className="space-y-4">
              <div>
                <p
                  className="mb-2"
                  style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
                >
                  Deductions
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Critical violations</span>
                    <span className="font-mono text-red-400">−10 per issue</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Amber violations</span>
                    <span className="font-mono text-amber-400">−3 per issue</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Advisory violations</span>
                    <span className="font-mono [color:var(--text-secondary)]">−1 per issue</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Unapplied overrides</span>
                    <span className="font-mono text-amber-400">−3 per change</span>
                  </li>
                </ul>
              </div>
              <div>
                <p
                  className="mb-2"
                  style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
                >
                  Grade Scale
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className={`font-medium ${GRADE_TEXT['A']}`}>A</span>
                    <span className="[color:var(--text-secondary)]">90–100</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className={`font-medium ${GRADE_TEXT['B']}`}>B</span>
                    <span className="[color:var(--text-secondary)]">80–89</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className={`font-medium ${GRADE_TEXT['C']}`}>C</span>
                    <span className="[color:var(--text-secondary)]">70–79</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className={`font-medium ${GRADE_TEXT['D']}`}>D</span>
                    <span className="[color:var(--text-secondary)]">60–69</span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className={`font-medium ${GRADE_TEXT['F']}`}>F</span>
                    <span className="[color:var(--text-secondary)]">&lt;60</span>
                  </li>
                </ul>
              </div>
              <div>
                <p
                  className="mb-2"
                  style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
                >
                  Live Deductions
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Critical</span>
                    <span className="font-mono text-zinc-300">
                      −{criticalBucket * HEALTH_SCORE_WEIGHTS.critical}
                    </span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Design drift</span>
                    <span className="font-mono text-zinc-300">
                      −{amberBucket * HEALTH_SCORE_WEIGHTS.amber}
                    </span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Advisory</span>
                    <span className="font-mono text-zinc-300">
                      −{advisoryBucket * HEALTH_SCORE_WEIGHTS.advisory}
                    </span>
                  </li>
                  <li className="flex items-center justify-between [font-size:var(--text-body)]">
                    <span className="text-zinc-300">Overrides</span>
                    <span className="font-mono text-zinc-300">
                      −{overrideCount * HEALTH_SCORE_WEIGHTS.override}
                    </span>
                  </li>
                </ul>
                {(fidelityScore !== undefined || a11yScore !== undefined) && (
                  <p
                    className="mt-2"
                    style={{ ...LABEL_STYLE, color: 'var(--text-tertiary)' }}
                  >
                    Legacy type sub-scores — Fidelity {fidelityScore}/100, Accessibility{' '}
                    {a11yScore}/100.
                  </p>
                )}
              </div>
            </div>
          </Modal>
        </div>
      </Section>
    </div>
  );
}
