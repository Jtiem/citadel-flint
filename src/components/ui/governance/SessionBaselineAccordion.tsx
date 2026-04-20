/**
 * SessionBaselineAccordion.tsx — C11
 *
 * Session & Baseline accordion section.
 * Shows the active file, baseline/delta controls, and override warning.
 * Also renders the inline confirmation toast (confirmationMsg).
 * Pure presentational — all state and callbacks passed as props.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';

// ── Prop shape ────────────────────────────────────────────────────────────────

export type BaselineStatus = 'idle' | 'setting' | 'clearing';
export interface SessionBaselineAccordionProps {
  /** Whether the accordion is expanded. */
  isOpen: boolean;
  /** Toggle callback. */
  onToggle: () => void;
  /** Whether delta mode is active. */
  isBaselineSet: boolean;
  /** Current baseline operation status. */
  baselineStatus: BaselineStatus;
  /** Active file path (null = no file open). */
  activeFilePath: string | null;
  /** Derived short filename shown in the row. */
  activeFileName: string | null;
  /** Sum of mithril + a11y violations in active file. */
  violationCount: number;
  /** Number of baselined entries. */
  baselineEntries: number;
  /** Total raw violation count (before delta filter). */
  totalRaw: number;
  /** Whether any component overrides are active. */
  overridesExist: boolean;
  /** Number of active overrides. */
  overrideCount: number;
  /** Inline confirmation message, or null. */
  confirmationMsg: string | null;
  /** Handler: set baseline. */
  onSetBaseline: () => void;
  /** Handler: clear baseline. */
  onClearBaseline: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SessionBaselineAccordion({
  isOpen,
  onToggle,
  isBaselineSet,
  baselineStatus,
  activeFilePath,
  activeFileName,
  violationCount,
  baselineEntries,
  totalRaw,
  overridesExist,
  overrideCount,
  confirmationMsg,
  onSetBaseline,
  onClearBaseline
}: SessionBaselineAccordionProps) {
  return <>
            <div className="border-t border-zinc-800/60">
                <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors" aria-expanded={isOpen} aria-controls="session-accordion">
                    {isOpen ? <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />}
                    <span className="flex-1" style={{ fontSize: 'var(--text-label)', color: 'var(--text-secondary)' }}>Session &amp; Baseline</span>
                    {isBaselineSet && <span style={{ fontSize: 'var(--text-label)', color: 'var(--text-accent)' }}>Delta on</span>}
                </button>
                {isOpen && <div id="session-accordion" className="px-3 py-2 space-y-2">
                        {activeFileName ? <div className="flex items-center gap-2 rounded px-2 py-1.5 bg-zinc-800/40">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                                <span className="flex-1 truncate font-mono [font-size:var(--text-label)] [color:var(--text-primary)]" title={activeFilePath ?? ''}>
                                    {activeFileName}
                                </span>
                                {violationCount > 0 && <span className="[font-size:var(--text-label)] px-1.5 py-0.5 rounded bg-zinc-800 [color:var(--text-secondary)] font-mono" data-schema-role="metadata">
                                        {violationCount}
                                    </span>}
                            </div> : <p className="py-1 [font-size:var(--text-label)] [color:var(--text-tertiary)]">No file open</p>}
                        <div className="flex items-center gap-2" data-testid="delta-mode-section">
                            {!isBaselineSet ? <button type="button" onClick={onSetBaseline} disabled={baselineStatus !== 'idle' || !activeFilePath} data-schema-role="cta-secondary" className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 [font-size:var(--text-label)] [color:var(--text-secondary)] transition-colors hover:border-indigo-500/60 hover:bg-indigo-900/20 disabled:cursor-not-allowed disabled:opacity-40">
                                    {baselineStatus === 'setting' ? 'Setting baseline...' : `Show only new issues${totalRaw > 0 ? ` (${totalRaw} baselined)` : ''}`}
                                </button> : <>
                                    <span className="flex-1 [font-size:var(--text-label)] [color:var(--text-accent)]" data-schema-role="state-signal">
                                        Showing new issues only ({baselineEntries} baselined)
                                    </span>
                                    <button type="button" onClick={onClearBaseline} disabled={baselineStatus !== 'idle'} className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 transition-colors hover:border-red-500/40 hover:bg-red-900/10 disabled:cursor-not-allowed disabled:opacity-40" style={{ fontSize: 'var(--text-label)', color: 'var(--text-secondary)' }}>
                                        {baselineStatus === 'clearing' ? 'Clearing...' : 'Show All'}
                                    </button>
                                </>}
                        </div>
                        {overridesExist && <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-900/20 px-3 py-2">
                                <span className="flex-1 [font-size:var(--text-label)] text-amber-400" data-schema-role="state-signal">
                                    Manual Style Overrides active — export blocked
                                </span>
                                <span className="[font-size:var(--text-label)] px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono" data-schema-role="metadata">
                                    {overrideCount}
                                </span>
                            </div>}
                    </div>}
            </div>

            {/* Inline confirmation toast (lives outside the border-t wrapper in the original) */}
            {confirmationMsg && <div className="mx-3 mt-2 flex items-center gap-2 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-2" role="status" aria-live="polite" data-testid="baseline-confirmation-msg">
                    <span className="flex-1 [font-size:var(--text-label)] [color:var(--text-accent)]" data-schema-role="state-signal">{confirmationMsg}</span>
                </div>}
        </>;
}