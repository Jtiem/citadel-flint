/**
 * MoreDetailsPanel.tsx — C9
 *
 * Outer accordion container for all secondary "More details" sections.
 * Hosts an expand/collapse toggle that reveals an inner panel slot.
 * Pure presentational — open state and children are passed in as props.
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 *
 * @schemaRole metadata (container — secondary passive info)
 */

import { ChevronDown, ChevronRight } from 'lucide-react';

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface MoreDetailsPanelProps {
  /** Whether the "More details" section is expanded. */
  isOpen: boolean;
  /** Toggle callback. */
  onToggle: () => void;
  /** Whether delta mode is active (shows "Delta on" badge). */
  isBaselineSet?: boolean;
  /** Child accordion sections rendered inside the expanded panel. */
  children?: React.ReactNode;
  /** Visibility guard — hidden when no design system is loaded. */
  tokenCount: number;
}

// ── Token styles ──────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-secondary)',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * MoreDetailsPanel — collapsible container for passive secondary metadata.
 *
 * @schemaRole metadata
 */
export function MoreDetailsPanel({
  isOpen,
  onToggle,
  isBaselineSet = false,
  children,
  tokenCount,
}: MoreDetailsPanelProps) {
  if (tokenCount <= 0) return null;

  return (
    <div
      className="border-t border-zinc-800"
      data-schema-role="metadata"
      data-testid="more-details-disclosure"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
        aria-expanded={isOpen}
        aria-controls="more-details-panel"
        data-testid="more-details-toggle"
      >
        {isOpen ? (
          <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
        ) : (
          <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
        )}
        <span className="flex-1" style={LABEL_STYLE}>
          More details
        </span>
        {isBaselineSet && (
          <span
            style={{
              fontSize: 'var(--text-label)',
              lineHeight: 'var(--text-label-lh)',
              fontWeight: 'var(--text-label-weight)',
              color: 'var(--text-accent)',
            }}
          >
            Delta on
          </span>
        )}
      </button>

      {isOpen && (
        <div id="more-details-panel">
          {children}
        </div>
      )}
    </div>
  );
}
