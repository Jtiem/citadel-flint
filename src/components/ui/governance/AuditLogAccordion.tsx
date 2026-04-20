/**
 * AuditLogAccordion.tsx — C15
 *
 * COUNSEL.4.5 Lazy Audit Log accordion section.
 * Shows governance events with per-entry type icons and "Load more" pagination.
 * Pure presentational — all data, loading state, and callbacks passed as props.
 */

import { ChevronDown, ChevronRight, Loader2, ClipboardList, Wand2, ShieldCheck, ShieldOff, CheckCircle2 } from 'lucide-react';
import { formatRelativeTime } from '../../../utils/relativeTime';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number | string;
  timestamp: string;
  action: string;
  filePath: string;
  description: string;
}

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface AuditLogAccordionProps {
  /** Whether the accordion is expanded. */
  isOpen: boolean;
  /** Toggle callback (also triggers lazy load on first open). */
  onToggle: () => void;
  /** Audit log entries currently loaded. */
  auditLog: AuditLogEntry[];
  /** Whether the initial load has completed. */
  auditLogLoaded: boolean;
  /** Whether a load/page operation is in progress. */
  auditLogLoading: boolean;
  /** Whether more entries are available beyond the current page. */
  auditLogHasMore: boolean;
  /** Callback to load the next page. */
  onLoadMore: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type LucideIcon = typeof ClipboardList;
function getEntryIcon(action: string): {
  IconEl: LucideIcon;
  iconColor: string;
} {
  const lower = action.toLowerCase();
  if (lower.includes('fix') || lower.includes('heal')) {
    return {
      IconEl: Wand2,
      iconColor: 'text-emerald-400'
    };
  }
  if (lower.includes('audit') || lower.includes('scan')) {
    return {
      IconEl: ShieldCheck,
      iconColor: 'text-indigo-400'
    };
  }
  if (lower.includes('override') || lower.includes('defer')) {
    return {
      IconEl: ShieldOff,
      iconColor: 'text-amber-400'
    };
  }
  if (lower.includes('approve') || lower.includes('accept')) {
    return {
      IconEl: CheckCircle2,
      iconColor: 'text-emerald-400'
    };
  }
  return {
    IconEl: ClipboardList,
    iconColor: '[color:var(--text-tertiary)]'
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuditLogAccordion({
  isOpen,
  onToggle,
  auditLog,
  auditLogLoaded,
  auditLogLoading,
  auditLogHasMore,
  onLoadMore
}: AuditLogAccordionProps) {
  return <div className="border-t border-zinc-800/60" data-testid="audit-log-section">
            <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors" aria-expanded={isOpen} aria-controls="audit-log-accordion" data-testid="audit-log-toggle">
                {isOpen ? <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />}
                <ClipboardList size={11} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                <span className="flex-1" style={{ fontSize: 'var(--text-label)', color: 'var(--text-secondary)' }}>Audit Log</span>
                {auditLogLoaded && auditLog.length > 0 && <span className="font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>
                        {auditLog.length}{auditLogHasMore ? '+' : ''}
                    </span>}
            </button>
            {isOpen && <div id="audit-log-accordion" className="overflow-y-auto" style={{
      maxHeight: 240
    }} data-testid="audit-log-list">
                    {auditLogLoading && !auditLogLoaded ? <div className="flex items-center justify-center gap-2 px-4 py-4">
                            <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                            <span style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>Loading audit log...</span>
                        </div> : auditLog.length === 0 ? <p className="px-4 py-4 text-center" data-testid="audit-log-empty" style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>
                            No audit events yet
                        </p> : <div className="divide-y divide-zinc-800/40">
                            {auditLog.map(entry => {
          const {
            IconEl,
            iconColor
          } = getEntryIcon(entry.action);
          return <div key={entry.id} className="flex items-start gap-2 px-3 py-2 hover:bg-zinc-800/30 transition-colors" data-testid={`audit-log-entry-${entry.id}`}>
                                        <IconEl size={11} className={`mt-0.5 shrink-0 ${iconColor}`} aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span style={{ fontSize: 'var(--text-label)', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                    {entry.action}
                                                </span>
                                                <span className="font-mono truncate" style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', maxWidth: 48 }} title={entry.filePath}>
                                                    {entry.filePath.split('/').pop() ?? entry.filePath}
                                                </span>
                                            </div>
                                            <p className="line-clamp-1" style={{ fontSize: 'var(--text-label)', color: 'var(--text-secondary)' }}>
                                                {entry.description}
                                            </p>
                                        </div>
                                        <span className="shrink-0 tabular-nums" style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>
                                            {formatRelativeTime(entry.timestamp)}
                                        </span>
                                    </div>;
        })}
                            {auditLogHasMore && <div className="px-3 py-2 text-center">
                                    <button type="button" onClick={onLoadMore} disabled={auditLogLoading} style={{ fontSize: 'var(--text-label)', color: 'var(--text-accent)' }} className="hover:opacity-80 transition-opacity disabled:opacity-40" data-testid="audit-log-load-more">
                                        {auditLogLoading ? 'Loading...' : 'Load more'}
                                    </button>
                                </div>}
                        </div>}
                </div>}
        </div>;
}