/**
 * ScoreSection.tsx — Extracted from GovernanceDashboard (Sprint 3A refactor)
 *
 * Renders the health score ring, grade letter, sparkline, trend hint,
 * next-step coaching sentence, sub-score breakdown rows, and the
 * "How is this calculated?" modal.
 *
 * All state that drives this UI lives in GovernanceDashboard. ScoreSection
 * is intentionally stateless except for the modal open/close toggle so the
 * parent can keep a flat, predictable state shape.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck, ShieldOff, SendHorizonal } from 'lucide-react';
import { Modal } from '../Modal';
import { HEALTH_SCORE_WEIGHTS } from '../../../../shared/healthScore';
import { gradeFromScore } from '../../../hooks/useGovernanceHealth';
import { formatRelativeTime } from '../../../utils/relativeTime';

// ── Grade → token colour maps (ScoreSection owns these) ─────────────────────

export const GRADE_TEXT: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-emerald-400',
  C: 'text-amber-400',
  D: 'text-amber-400',
  F: 'text-red-400'
};
export const GRADE_RING: Record<string, string> = {
  A: 'stroke-emerald-400',
  B: 'stroke-emerald-400',
  C: 'stroke-amber-400',
  D: 'stroke-amber-400',
  F: 'stroke-red-400'
};

// ── COUNSEL.4.2: Sparkline ────────────────────────────────────────────────────

export function Sparkline({
  data
}: {
  data: Array<{
    score: number;
  }>;
}) {
  if (data.length < 2) return null;
  const w = 120,
    h = 32,
    pad = 2;
  const scores = data.slice(-7).map(d => d.score);
  const min = Math.min(...scores),
    max = Math.max(...scores);
  const range = max - min || 1;
  const points = scores.map((s, i) => {
    const x = pad + i / (scores.length - 1) * (w - 2 * pad);
    const y = h - pad - (s - min) / range * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  // Colour routes through Tailwind text-* tokens via `currentColor` — no hardcoded hex.
  // Flint governs its own code (Commandment 2: No Hallucinated Styling).
  const trend = scores[scores.length - 1] - scores[0];
  const trendColorClass = trend > 2 ? 'text-emerald-400' : trend < -2 ? 'text-red-400' : 'text-amber-400';
  const trendLabel = trend > 2 ? 'Trending up' : trend < -2 ? 'Trending down' : 'Stable';
  return <div className="flex items-center gap-2" data-testid="sparkline-container">
            <svg width={w} height={h} className={`shrink-0 ${trendColorClass}`} aria-label="Health trend" role="img" data-testid="sparkline">
                <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
            </svg>
            <span data-testid="sparkline-trend-label" style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>{trendLabel}</span>
        </div>;
}

// ── Score ring (SVG) ─────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  pulse?: boolean;
}
export function ScoreRing({
  score,
  grade,
  pulse
}: ScoreRingProps) {
  const RADIUS = 34;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const filled = score / 100 * CIRCUMFERENCE;
  const gap = CIRCUMFERENCE - filled;
  return <svg width={80} height={80} viewBox="0 0 80 80" className={`shrink-0${pulse ? ' motion-safe:animate-pulse' : ''}`} aria-label={`Health score ${score} out of 100`} role="img" data-testid="score-ring">
            <circle cx={40} cy={40} r={RADIUS} fill="none" className="stroke-zinc-800" strokeWidth={6} />
            <circle cx={40} cy={40} r={RADIUS} fill="none" className={GRADE_RING[grade]} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${filled} ${gap}`} transform="rotate(-90 40 40)" />
            <text x={40} y={44} textAnchor="middle" className="fill-zinc-100" fontSize={16} fontWeight={700} fontFamily="inherit" aria-hidden="true">
                {score}
            </text>
        </svg>;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ScoreSectionProps {
  score: number;
  grade: string;
  trend: number;
  exportBlocked: boolean;
  mithrilCount: number;
  a11yCount: number;
  overridesExist: boolean;
  overrideCount: number;
  onRunAudit: () => void;
  baselineMode: boolean;
  onToggleBaseline: () => void;
  newIssueCount?: number;

  // Derived data passed from parent
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
  effortText: string;
  ringPulse: boolean;
  lastCleanState: {
    timestamp: string;
    score: number;
  } | null;
  onRewindToClean: () => void;

  // Category chips
  activeCategory: 'design-system' | 'accessibility' | 'token-sync' | null;
  onSetCategory: (cat: 'design-system' | 'accessibility' | 'token-sync' | null) => void;
  syncCount: number;

  // Delta mode banner
  initialViolationCount?: number;
  isBaselineSet: boolean;
  bannerDismissed: boolean;
  onDismissBanner: () => void;
  onShowAllViolations: () => void;

  // Export
  onOpenExportModal?: () => void;

  // GAP-11: Per-category export-blocking violation counts (severity: 'critical')
  designSystemBlockingCount?: number;
  a11yBlockingCount?: number;
  syncBlockingCount?: number;

  /**
   * Canonical severity-bucketed counts driving the score.
   * When provided, the sub-score breakdown rows narrate the EXACT deductions
   * applied by shared/healthScore.ts:
   *   Critical issues: −criticalCount × 10 pts
   *   Design drift:    −amberCount    ×  3 pts
   *   Advisory:        −advisoryCount ×  1 pts
   *   Overrides:       −overrideCount ×  3 pts
   * When omitted, callers fall back to the legacy type-based narration
   * (which treats every a11y as critical and every mithril as amber).
   */
  criticalCount?: number;
  amberCount?: number;
  advisoryCount?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScoreSection({
  score,
  grade,
  exportBlocked,
  mithrilCount,
  a11yCount,
  overridesExist,
  overrideCount,
  healthHistory,
  scoreTrendHint,
  nextStep,
  effortText,
  ringPulse,
  lastCleanState,
  onRewindToClean,
  activeCategory,
  onSetCategory,
  syncCount,
  initialViolationCount,
  isBaselineSet,
  bannerDismissed,
  onDismissBanner,
  onShowAllViolations,
  onOpenExportModal,
  designSystemBlockingCount = 0,
  a11yBlockingCount = 0,
  syncBlockingCount = 0,
  criticalCount,
  amberCount,
  advisoryCount
}: ScoreSectionProps) {
  const [isScoreOpen, setIsScoreOpen] = useState(true);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  // Canonical severity-bucketed counts with safe fallbacks for legacy callers.
  // Fallback maps every a11y violation to 'critical' and every mithril to 'amber'
  // (matches the simplified mapping in shared/healthSignal.formatHealthSignal).
  const criticalBucket = criticalCount ?? a11yCount;
  const amberBucket = amberCount ?? mithrilCount;
  const advisoryBucket = advisoryCount ?? 0;
  return <>
            {/* ── EXPORT GATE BANNER ──────────────────────────────────────── */}
            {exportBlocked && <div className="px-3 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 rounded border border-red-700/40 bg-red-900/10 px-3 py-2" role="alert">
                        <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                        <span className="flex-1 [font-size:var(--text-label)] font-medium text-red-300" data-schema-role="state-signal">
                            Export blocked — {mithrilCount + a11yCount} {mithrilCount + a11yCount !== 1 ? 'issues' : 'issue'}
                            {overridesExist ? ' + overrides' : ''}
                        </span>
                    </div>
                </div>}
            {!exportBlocked && <div className="px-3 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-900/10 px-3 py-2">
                        <ShieldCheck size={13} className="shrink-0 text-emerald-400" aria-hidden="true" />
                        <span className="flex-1 [font-size:var(--text-label)] font-medium text-emerald-300" data-schema-role="state-signal">
                            {isBaselineSet ? 'No new issues — export ready' : 'All clear — export ready'}
                        </span>
                        <button type="button" onClick={() => onOpenExportModal?.()} className="flex items-center gap-1 rounded bg-emerald-600/20 px-2.5 py-1 [font-size:var(--text-body)] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors" aria-label="Open export modal">
                            Export
                            <SendHorizonal size={10} aria-hidden="true" />
                        </button>
                    </div>
                </div>}

            {/* ── ACCORDION: Health Score ──────────────────────────────────── */}
            <div className="border-t border-zinc-800">
                <button type="button" onClick={() => setIsScoreOpen(v => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors" aria-expanded={isScoreOpen} aria-controls="score-accordion">
                    {isScoreOpen ? <ChevronDown size={12} className="shrink-0 [color:var(--text-tertiary)]" aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0 [color:var(--text-tertiary)]" aria-hidden="true" />}
                    <span className="flex-1 [font-size:var(--text-label)] [color:var(--text-secondary)]">Health Score</span>
                    <span className={`[font-size:var(--text-label)] font-bold ${GRADE_TEXT[grade]}`} data-schema-role="state-signal" aria-hidden="true">{grade}</span>
                    <span className="font-mono [font-size:var(--text-label)] [color:var(--text-secondary)]" aria-label={`Score ${score} out of 100`}>{score}</span>
                </button>

                {isScoreOpen && <div id="score-accordion">
                        {/* Effort framing */}
                        <p className="px-4 pt-3 pb-1 [font-size:var(--text-label)] [color:var(--text-secondary)]" data-testid="effort-framing">
                            {effortText}
                        </p>

                        {/* COUNSEL.1.1: Category split chips */}
                        <div className="flex items-center gap-1.5 px-4 pb-2" data-testid="category-chips">
                            <button type="button" aria-pressed={activeCategory === 'design-system'} onClick={() => onSetCategory(activeCategory === 'design-system' ? null : 'design-system')} className="flex items-center gap-1 rounded-full border px-2 py-0.5 [font-size:var(--text-label)] transition-colors border-zinc-700 bg-zinc-800/50 [color:var(--text-secondary)] hover:text-zinc-200 aria-pressed:border-amber-500/50 aria-pressed:bg-amber-900/20 aria-pressed:text-amber-300" data-testid="chip-design-system">
                                Design System {mithrilCount}
                                {/* GAP-11: Export-blocking indicator */}
                                {designSystemBlockingCount > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" aria-label="blocks export" data-testid="chip-design-system-blocking-dot" title="Contains violations that block export" />}
                            </button>
                            <button type="button" aria-pressed={activeCategory === 'accessibility'} onClick={() => onSetCategory(activeCategory === 'accessibility' ? null : 'accessibility')} className="flex items-center gap-1 rounded-full border px-2 py-0.5 [font-size:var(--text-label)] transition-colors border-zinc-700 bg-zinc-800/50 [color:var(--text-secondary)] hover:text-zinc-200 aria-pressed:border-red-500/50 aria-pressed:bg-red-900/20 aria-pressed:text-red-300" data-testid="chip-accessibility">
                                Accessibility {a11yCount}
                                {/* GAP-11: Export-blocking indicator — all a11y violations are critical */}
                                {a11yBlockingCount > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" aria-label="blocks export" data-testid="chip-accessibility-blocking-dot" title="Contains violations that block export" />}
                            </button>
                            <button type="button" aria-pressed={activeCategory === 'token-sync'} onClick={() => onSetCategory(activeCategory === 'token-sync' ? null : 'token-sync')} className="flex items-center gap-1 rounded-full border px-2 py-0.5 [font-size:var(--text-label)] transition-colors border-zinc-700 bg-zinc-800/50 [color:var(--text-secondary)] hover:text-zinc-200 aria-pressed:border-indigo-500/50 aria-pressed:bg-indigo-900/20 aria-pressed:text-indigo-300" data-testid="chip-token-sync">
                                Token Sync {syncCount}
                                {/* GAP-11: Export-blocking indicator */}
                                {syncBlockingCount > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" aria-label="blocks export" data-testid="chip-token-sync-blocking-dot" title="Contains violations that block export" />}
                            </button>
                        </div>

                        {/* COUNSEL.1.2: Delta mode auto-enable banner */}
                        {(initialViolationCount ?? 0) > 10 && isBaselineSet && !bannerDismissed && <div className="mx-3 mb-2 rounded border border-indigo-500/30 bg-indigo-900/10 px-3 py-2" data-testid="delta-mode-auto-banner">
                                <p className="[font-size:var(--text-label)] [color:var(--text-secondary)]" data-schema-role="support-evidence">
                                    Delta mode active — showing new issues only. There are {initialViolationCount} existing violations being filtered.
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <button type="button" aria-label="Show all violations" onClick={onShowAllViolations} data-schema-role="nav-link" className="[font-size:var(--text-label)] [color:var(--text-accent)] underline">
                                        Show all violations
                                    </button>
                                    <button type="button" aria-label="Dismiss delta mode banner" onClick={onDismissBanner} className="[font-size:var(--text-label)] [color:var(--text-tertiary)] hover:[color:var(--text-secondary)]">
                                        Dismiss
                                    </button>
                                </div>
                            </div>}

                        {/* Ring + grade label row */}
                        <div className="flex items-center gap-4 px-4 py-4" title={scoreTrendHint ?? undefined}>
                            <div className="flex flex-col items-center gap-1">
                                <ScoreRing score={score} grade={grade as 'A' | 'B' | 'C' | 'D' | 'F'} pulse={ringPulse} />
                                {healthHistory.length >= 2 && <Sparkline data={healthHistory} />}
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className={`text-3xl font-bold leading-none ${GRADE_TEXT[grade]}`} aria-label={`Grade ${grade}`}>{grade}</span>
                                <span className="[font-size:var(--text-label)] [color:var(--text-secondary)]">{isBaselineSet ? 'Delta Score (new issues only)' : 'Governance Health'}</span>
                                {scoreTrendHint && <span className="[font-size:var(--text-label)] [color:var(--text-primary)] mt-0.5" data-testid="score-trend-hint">{scoreTrendHint}</span>}
                                <p className="[font-size:var(--text-label)] [color:var(--text-secondary)] mt-1" data-testid="next-step-prompt">{nextStep.text}</p>
                                {/* COUNSEL.3.1: Rewind to clean */}
                                {score < 95 && lastCleanState && <button type="button" onClick={onRewindToClean} data-schema-role="nav-link" className="mt-1 text-left [font-size:var(--text-label)] [color:var(--text-accent)] underline underline-offset-2 transition-colors" data-testid="rewind-to-clean">
                                        Rewind to clean (score {lastCleanState.score}, {formatRelativeTime(lastCleanState.timestamp)})
                                    </button>}
                            </div>
                        </div>

                        {/* Sub-score breakdown — rows narrate the canonical deductions
                            actually applied by shared/healthScore.ts. Each row's
                            point total matches exactly one term of the formula. */}
                        {(criticalBucket > 0 || amberBucket > 0 || advisoryBucket > 0 || overrideCount > 0) && <div className="px-3 py-2 space-y-1.5 border-t border-zinc-800/50">
                                {criticalBucket > 0 && <div className="flex items-center gap-2 [font-size:var(--text-label)] [color:var(--text-secondary)]" data-testid="critical-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                        <span className="flex-1">
                                            Critical issues: {criticalBucket} {criticalBucket !== 1 ? 'issues' : 'issue'} (−{criticalBucket * HEALTH_SCORE_WEIGHTS.critical} pts)
                                        </span>
                                    </div>}
                                {amberBucket > 0 && <div className="flex items-center gap-2 [font-size:var(--text-label)] [color:var(--text-secondary)]" data-testid="amber-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                        <span className="flex-1">
                                            Design drift: {amberBucket} {amberBucket !== 1 ? 'issues' : 'issue'} (−{amberBucket * HEALTH_SCORE_WEIGHTS.amber} pts)
                                        </span>
                                    </div>}
                                {advisoryBucket > 0 && <div className="flex items-center gap-2 [font-size:var(--text-label)] [color:var(--text-secondary)]" data-testid="advisory-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden="true" />
                                        <span className="flex-1">
                                            Advisory: {advisoryBucket} {advisoryBucket !== 1 ? 'issues' : 'issue'} (−{advisoryBucket * HEALTH_SCORE_WEIGHTS.advisory} pts)
                                        </span>
                                    </div>}
                                {overrideCount > 0 && <div className="flex items-center gap-2 [font-size:var(--text-label)] [color:var(--text-secondary)]" data-testid="override-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                        <span className="flex-1">
                                            Overrides: {overrideCount} active (−{overrideCount * HEALTH_SCORE_WEIGHTS.override} pts)
                                        </span>
                                    </div>}
                            </div>}

                        {/* "How is this calculated?" link + modal */}
                        <div className="px-3 py-2 border-t border-zinc-800/50">
                            <button type="button" onClick={() => setIsScoreModalOpen(true)} className="flex items-center gap-1 [font-size:var(--text-label)] [color:var(--text-tertiary)] hover:[color:var(--text-secondary)] transition-colors">
                                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                How is this calculated?
                            </button>
                            <Modal isOpen={isScoreModalOpen} onClose={() => setIsScoreModalOpen(false)} title="How Your Score Is Calculated" size="sm" data-testid="score-formula-modal">
                                <div className="space-y-4">
                                    <div>
                                        <p className="[font-size:var(--text-label)] font-medium [color:var(--text-secondary)] mb-2">Deductions</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Critical violations</span><span className="font-mono text-red-400">−10 per issue</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Amber violations</span><span className="font-mono text-amber-400">−3 per issue</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Advisory violations</span><span className="font-mono [color:var(--text-secondary)]">−1 per issue</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Unapplied overrides</span><span className="font-mono text-amber-400">−3 per change</span></li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="[font-size:var(--text-label)] font-medium [color:var(--text-secondary)] mb-2">Grade Scale</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-emerald-400 font-medium">A</span><span className="[color:var(--text-secondary)]">90–100</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-emerald-400 font-medium">B</span><span className="[color:var(--text-secondary)]">80–89</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-amber-400 font-medium">C</span><span className="[color:var(--text-secondary)]">70–79</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-amber-400 font-medium">D</span><span className="[color:var(--text-secondary)]">60–69</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-red-400 font-medium">F</span><span className="[color:var(--text-secondary)]">&lt;60</span></li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="[font-size:var(--text-label)] font-medium [color:var(--text-secondary)] mb-2">Live Deductions</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Critical</span><span className="font-mono text-zinc-300">−{criticalBucket * HEALTH_SCORE_WEIGHTS.critical}</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Design drift</span><span className="font-mono text-zinc-300">−{amberBucket * HEALTH_SCORE_WEIGHTS.amber}</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Advisory</span><span className="font-mono text-zinc-300">−{advisoryBucket * HEALTH_SCORE_WEIGHTS.advisory}</span></li>
                                            <li className="flex items-center justify-between [font-size:var(--text-body)]"><span className="text-zinc-300">Overrides</span><span className="font-mono text-zinc-300">−{overrideCount * HEALTH_SCORE_WEIGHTS.override}</span></li>
                                        </ul>
                                    </div>
                                </div>
                            </Modal>
                        </div>
                    </div>}
            </div>
        </>;
}

// Re-export gradeFromScore so callers that import from here also get it
export { gradeFromScore };