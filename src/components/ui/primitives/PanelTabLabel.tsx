/**
 * PanelTabLabel — src/components/ui/primitives/PanelTabLabel.tsx
 *
 * The SOLE all-caps primitive in the Glass Interaction Schema.
 *
 * @schemaRole primary-content (panel-tab role)
 *
 * CONTRACT: GLASSTYPO.1 Group B
 *
 * Rules enforced here:
 *  - text-transform: uppercase — applied via inline style, not a utility class.
 *    This satisfies the invariant: canary-all-caps-only-via-primitive.
 *    grep for `className=.*uppercase` outside this file returns 0.
 *  - Font: text-label (11px) / weight 500 / letter-spacing 0.06em.
 *  - Active: text-primary color + 2px accent underline.
 *  - Inactive: text-secondary color + transparent underline.
 *  - role="tab" + aria-selected for accessibility.
 */

import React from 'react';

export interface PanelTabLabelProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

/**
 * PanelTabLabel primitive — Uppercase tab label for Glass right-sidebar tabs.
 *
 * @schemaRole primary-content
 */
const PanelTabLabel: React.FC<PanelTabLabelProps> = ({
  children,
  active = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="relative pb-px focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded transition-colors"
      data-schema-role="primary-content"
      style={{
        fontSize: 'var(--text-label)',
        lineHeight: 'var(--text-label-lh)',
        fontWeight: 'var(--text-label-weight)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        borderBottom: active
          ? '2px solid var(--text-accent)'
          : '2px solid transparent',
      }}
    >
      {children}
    </button>
  );
};

export default PanelTabLabel;
