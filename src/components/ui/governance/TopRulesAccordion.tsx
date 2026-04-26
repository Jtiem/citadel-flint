/**
 * TopRulesAccordion.tsx — C10
 *
 * Top-5 violated rules accordion section.
 * Renders inside MoreDetailsPanel as a collapsible accordion.
 * Pure presentational — all data passed as props.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LinterWarning } from '../../../types/flint-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuleRow {
  type: LinterWarning['type'];
  severity: LinterWarning['severity'];
  count: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<LinterWarning['severity'], string> = {
  critical: 'bg-red-400',
  amber: 'bg-amber-400',
  advisory: 'bg-indigo-400'
};
const SEVERITY_BADGE: Record<LinterWarning['severity'], string> = {
  critical: 'bg-red-900/30 text-red-400 border border-red-700/40',
  amber: 'bg-amber-900/20 text-amber-400 border border-amber-500/30',
  advisory: 'bg-indigo-900/20 text-indigo-400 border border-indigo-500/30'
};
const TYPE_LABEL: Record<LinterWarning['type'], string> = {
  'color-drift': 'Color Drift',
  'typography-drift': 'Typography',
  'spacing-drift': 'Spacing',
  'shadow-drift': 'Shadow',
  'opacity-drift': 'Opacity',
  'a11y': 'A11y',
  'semantic-drift': 'Semantic',
  'sync': 'Token Sync',
  'inline-style-drift': 'Inline Style',
  'registry': 'Registry'
};

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface TopRulesAccordionProps {
  /** Whether the accordion is expanded. */
  isOpen: boolean;
  /** Toggle callback. */
  onToggle: () => void;
  /** Aggregated top-5 rule rows to display. */
  topRules: RuleRow[];
  /** Callback when a rule row is clicked (to scroll to that violation type). */
  onRuleRowClick: (type: LinterWarning['type']) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopRulesAccordion({
  isOpen,
  onToggle,
  topRules,
  onRuleRowClick
}: TopRulesAccordionProps) {
  return <div className="border-t border-zinc-800/60">
            <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors" aria-expanded={isOpen} aria-controls="top-rules-accordion">
                {isOpen ? <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />}
                <span className="flex-1" style={{ fontSize: 'var(--text-label)', color: 'var(--text-secondary)' }}>Top Triggered Rules</span>
                {topRules.length > 0 && <span className="font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>{topRules.length}</span>}
            </button>
            {isOpen && <div id="top-rules-accordion" className="px-3 py-2 space-y-1">
                    {topRules.length === 0 ? <p className="[font-size:var(--text-label)] text-emerald-400" data-schema-role="state-signal">No issues</p> : topRules.map(row => <button key={`${row.type}-${row.severity}`} type="button" onClick={() => onRuleRowClick(row.type)} data-schema-role="nav-link" className="flex w-full items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-zinc-800/50 transition-colors text-left" data-testid={`rule-row-${row.type}`} title={`Scroll to ${TYPE_LABEL[row.type]} issues`}>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[row.severity]}`} aria-hidden="true" data-schema-role="state-signal" />
                                <span className="flex-1 truncate [font-size:var(--text-label)] [color:var(--text-primary)]" data-schema-role="support-evidence">
                                    {TYPE_LABEL[row.type]}
                                </span>
                                <span data-schema-role="state-signal" className={`[font-size:var(--text-micro)] px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[row.severity]}`}>
                                    {row.severity}
                                </span>
                                <span className="[font-size:var(--text-label)] px-1.5 py-0.5 rounded bg-zinc-800 [color:var(--text-secondary)] font-mono" data-schema-role="metadata">
                                    {row.count}
                                </span>
                            </button>)}
                </div>}
        </div>;
}