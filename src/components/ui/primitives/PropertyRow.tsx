/**
 * PropertyRow — src/components/ui/primitives/PropertyRow.tsx
 *
 * Two-column label-left / value-right row for Glass panels.
 *
 * @schemaRole support-evidence (default) | metadata
 *
 * CONTRACT: GLASSTYPO.1 Group B
 *
 * Token mapping:
 *  - Label: text-label (11px/500) + text-secondary
 *  - Value (support-evidence): text-body (12px/400) + text-primary
 *  - Value (metadata): text-body (12px/400) + text-tertiary  (compression role)
 *  - mono=true: adds font-mono to the value span
 *  - Hover actions: opacity-0 → opacity-100 on row hover / focus-within
 */

import React from 'react';

export interface PropertyRowProps {
  label: string;
  value: React.ReactNode;
  /** Defaults to 'support-evidence'. 'metadata' triggers --text-tertiary compression. */
  schemaRole?: 'support-evidence' | 'metadata';
  hint?: string;
  actions?: React.ReactNode;
  mono?: boolean;
}

const NUMERIC_RE = /^-?\d+(\.\d+)?(%|px|em|rem|deg|vw|vh|s|ms)?$/;

/**
 * PropertyRow primitive.
 *
 * @schemaRole support-evidence | metadata
 */
const PropertyRow: React.FC<PropertyRowProps> = ({
  label,
  value,
  schemaRole = 'support-evidence',
  hint,
  actions,
  mono,
}) => {
  // Auto-detect numeric value when `mono` is not explicitly set
  const isMonoValue =
    mono ?? (typeof value === 'string' && NUMERIC_RE.test(value.trim()));

  // Value color: metadata role → tertiary (compression); default → primary
  const valueColor =
    schemaRole === 'metadata'
      ? 'var(--text-tertiary)'
      : 'var(--text-primary)';

  return (
    <div
      className="group relative flex items-center justify-between gap-2 px-3 py-1 hover:bg-zinc-900/40 transition-colors"
      data-schema-role={schemaRole}
    >
      {/* Label */}
      <span
        className="shrink-0 truncate"
        style={{
          fontSize: 'var(--text-label)',
          lineHeight: 'var(--text-label-lh)',
          fontWeight: 'var(--text-label-weight)',
          color: 'var(--text-secondary)',
        }}
        title={hint}
      >
        {label}
      </span>

      {/* Value — right-anchored */}
      <span
        className={`min-w-0 text-right truncate${isMonoValue ? ' font-mono' : ''}`}
        style={{
          fontSize: 'var(--text-body)',
          lineHeight: 'var(--text-body-lh)',
          fontWeight: 'var(--text-body-weight)',
          color: valueColor,
        }}
      >
        {value}
      </span>

      {/* Hover-revealed actions — opacity transitions, still accessible via focus-within */}
      {actions != null && (
        <div
          className="absolute right-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 flex items-center gap-1"
        >
          {actions}
        </div>
      )}
    </div>
  );
};

export default PropertyRow;
