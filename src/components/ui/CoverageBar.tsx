/**
 * CoverageBar — src/components/ui/CoverageBar.tsx
 *
 * Per-jurisdiction compliance coverage progress bars.
 * Rendered in GovernanceDashboard (Health tab) below the health score ring.
 *
 * Layout:
 *   Section header
 *   For each jurisdiction: label | covered/total | progress bar | percentage
 *
 * Bar color thresholds:
 *   > 80%  → emerald (green)
 *   50-80% → amber (yellow)
 *   < 50%  → red
 *
 * Mithril Safety: all classes from the Flint token palette only.
 */

import { useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface JurisdictionCoverageEntry {
  /** Jurisdiction name, e.g. "EU/EAA" */
  jurisdiction: string;
  /** Rules currently active for this jurisdiction */
  covered: number;
  /** Total rules addressing this jurisdiction */
  total: number;
}
interface CoverageBarProps {
  /**
   * Per-jurisdiction coverage data.
   * When null, shows a loading / empty state.
   */
  coverages: Record<string, {
    covered: number;
    total: number;
  }> | null;
  /** True while coverage data is being fetched */
  isLoading?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function coveragePercent(covered: number, total: number): number {
  if (total === 0) return 0;
  return Math.round(covered / total * 100);
}
function barColorClass(percent: number): string {
  if (percent > 80) return 'bg-emerald-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}
function barTrackClass(percent: number): string {
  if (percent > 80) return 'bg-emerald-900/20';
  if (percent >= 50) return 'bg-amber-900/20';
  return 'bg-red-900/20';
}
function percentTextClass(percent: number): string {
  if (percent > 80) return 'text-emerald-400';
  if (percent >= 50) return 'text-amber-400';
  return 'text-red-400';
}

// ── Single jurisdiction row ────────────────────────────────────────────────

interface JurisdictionRowProps {
  jurisdiction: string;
  covered: number;
  total: number;
}
function JurisdictionRow({
  jurisdiction,
  covered,
  total
}: JurisdictionRowProps) {
  const percent = coveragePercent(covered, total);
  return <div className="flex items-center gap-2 py-1">
            {/* Jurisdiction label */}
            <span className="w-20 shrink-0 truncate font-mono text-[var(--spacing.2, 8px)] text-zinc-400" title={jurisdiction}>
                {jurisdiction}
            </span>

            {/* Covered / total */}
            <span className="w-12 shrink-0 text-right font-mono text-[var(--spacing.2, 8px)] text-zinc-500">
                {covered}/{total}
            </span>

            {/* Progress bar */}
            <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${barTrackClass(percent)}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${jurisdiction} coverage: ${percent}%`}>
                <div className={`h-full rounded-full transition-all duration-300 ${barColorClass(percent)}`} style={{
        width: `${percent}%`
      }} />
            </div>

            {/* Percentage */}
            <span className={`w-8 shrink-0 text-right font-mono text-[10px] font-medium ${percentTextClass(percent)}`}>
                {percent}%
            </span>
        </div>;
}

// ── CoverageBar ────────────────────────────────────────────────────────────

export function CoverageBar({
  coverages,
  isLoading
}: CoverageBarProps) {
  // Sort jurisdictions: highest coverage first, then alphabetically
  const sortedEntries = useMemo<JurisdictionCoverageEntry[]>(() => {
    if (!coverages) return [];
    return Object.entries(coverages).map(([jurisdiction, {
      covered,
      total
    }]) => ({
      jurisdiction,
      covered,
      total
    })).filter(({
      total
    }) => total > 0).sort((a, b) => {
      const pa = coveragePercent(a.covered, a.total);
      const pb = coveragePercent(b.covered, b.total);
      if (pb !== pa) return pb - pa;
      return a.jurisdiction.localeCompare(b.jurisdiction);
    });
  }, [coverages]);

  // Overall coverage across all jurisdictions
  const overall = useMemo(() => {
    if (sortedEntries.length === 0) return null;
    const totalCovered = sortedEntries.reduce((s, e) => s + e.covered, 0);
    const totalRules = sortedEntries.reduce((s, e) => s + e.total, 0);
    return coveragePercent(totalCovered, totalRules);
  }, [sortedEntries]);
  return <>
            {/* ── Section header ── */}
            <div className="border-b border-t border-zinc-800 px-3 py-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Compliance Coverage
                    </h3>
                    {overall !== null && <span className={`text-[10px] font-mono font-medium ${percentTextClass(overall)}`}>
                            {overall}% overall
                        </span>}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="px-3 py-2">
                {isLoading ? <p className="py-2 text-center text-xs text-zinc-600">Loading…</p> : sortedEntries.length === 0 ? <p className="py-2 text-center text-xs text-zinc-600">
                        No compliance profiles active
                    </p> : <div className="space-y-0.5">
                        {sortedEntries.map(entry => <JurisdictionRow key={entry.jurisdiction} jurisdiction={entry.jurisdiction} covered={entry.covered} total={entry.total} />)}
                    </div>}
            </div>
        </>;
}