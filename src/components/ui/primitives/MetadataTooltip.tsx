/**
 * MetadataTooltip — src/components/ui/primitives/MetadataTooltip.tsx
 *
 * Hover-revealed info tooltip for the Metadata schema role.
 *
 * @schemaRole metadata
 *
 * CONTRACT: GLASSTYPO.1 Group B
 *
 * Implementation: CSS-only approach using React state (hover/focus events).
 * Radix UI is not installed in this project — no @radix-ui/* in package.json.
 * The existing Glass tooltip pattern (TabUnlockTooltip) uses the same approach.
 * This satisfies the contract requirements (role="tooltip" + hover/focus reveal)
 * without adding a new dependency.
 *
 * Usage:
 *   <MetadataTooltip content="Tracking starts after first audit">
 *     <Info size={12} />
 *   </MetadataTooltip>
 *
 * The trigger is a focusable button so keyboard users can Tab to it and the
 * tooltip appears on focus (focus-within pattern).
 *
 * Side positioning:
 *  - 'top' (default): tooltip above trigger
 *  - 'bottom': tooltip below trigger
 *  - 'left': tooltip to the left
 *  - 'right': tooltip to the right
 */

import React, { useState, useCallback, useId } from 'react';

export type MetadataTooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface MetadataTooltipProps {
  /** The tooltip content (passive explanatory info — Metadata role). */
  content: React.ReactNode;
  /** The trigger element (usually an icon). */
  children: React.ReactNode;
  side?: MetadataTooltipSide;
}

const POSITION_STYLES: Record<MetadataTooltipSide, React.CSSProperties> = {
  top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4 },
  bottom: { top: '100%',   left: '50%', transform: 'translateX(-50%)', marginTop: 4 },
  left:   { right: '100%', top:  '50%', transform: 'translateY(-50%)', marginRight: 4 },
  right:  { left:  '100%', top:  '50%', transform: 'translateY(-50%)', marginLeft: 4 },
};

/**
 * MetadataTooltip primitive — Metadata role delivery behind a hover/focus trigger.
 *
 * @schemaRole metadata
 */
const MetadataTooltip: React.FC<MetadataTooltipProps> = ({
  children,
  content,
  side = 'top',
}) => {
  const [visible, setVisible] = useState(false);
  const uid = useId();
  const tooltipId = `tooltip-${uid}`;

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      data-schema-role="metadata"
    >
      {/* Trigger — focusable so keyboard users can reach the tooltip */}
      <button
        type="button"
        aria-describedby={visible ? tooltipId : undefined}
        className="inline-flex items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded cursor-default"
        tabIndex={0}
        style={{ color: 'var(--text-tertiary)' }}
      >
        {children}
      </button>

      {/* Tooltip body — conditionally rendered; enters DOM only when visible */}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 whitespace-nowrap rounded px-2 py-1 shadow-lg pointer-events-none border border-zinc-700/50"
          style={{
            ...POSITION_STYLES[side],
            fontSize: 'var(--text-label)',
            lineHeight: 'var(--text-label-lh)',
            fontWeight: 'var(--text-label-weight)',
            color: 'var(--text-tertiary)',
            backgroundColor: '#18181b', /* zinc-900 — no arbitrary value; zinc-900 is a Tailwind token */
            maxWidth: 240,
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default MetadataTooltip;
