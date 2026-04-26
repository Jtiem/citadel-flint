/**
 * StatBadge — src/components/ui/primitives/StatBadge.tsx
 *
 * Semantic pill for the State-signal schema role.
 *
 * @schemaRole state-signal
 *
 * CONTRACT: GLASSTYPO.1 Group B
 *
 * Variants — token-derived Tailwind classes only (C2 compliant):
 *  - success:  bg-emerald-900/20 / text-emerald-400 / border-emerald-700/40
 *  - warning:  bg-amber-900/20   / text-amber-400   / border-amber-500/30
 *  - critical: bg-red-900/10     / text-red-400     / border-red-700/40
 *  - neutral:  bg-zinc-800       / text-zinc-400    / border-zinc-700/50
 *
 * Note: neutral uses text-zinc-400 (not text-secondary CSS var) because the
 * Tailwind class must be static for Tailwind v4 to include it in the build.
 */

import React from 'react';

export type StatBadgeVariant = 'success' | 'warning' | 'critical' | 'neutral';

export interface StatBadgeProps {
  /** Role fixed to 'state-signal'. */
  variant: StatBadgeVariant;
  compact?: boolean;
  dot?: boolean;
  children: React.ReactNode;
}

interface VariantConfig {
  container: string;
  dot: string;
}

const VARIANT_CONFIG: Record<StatBadgeVariant, VariantConfig> = {
  success: {
    container: 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400',
    dot: 'bg-emerald-400',
  },
  warning: {
    container: 'bg-amber-900/20 border-amber-500/30 text-amber-400',
    dot: 'bg-amber-400',
  },
  critical: {
    container: 'bg-red-900/10 border-red-700/40 text-red-400',
    dot: 'bg-red-400',
  },
  neutral: {
    container: 'bg-zinc-800 border-zinc-700/50 text-zinc-400',
    dot: 'bg-zinc-500',
  },
};

/**
 * StatBadge primitive — State-signal semantic pill.
 *
 * @schemaRole state-signal
 */
const StatBadge: React.FC<StatBadgeProps> = ({
  variant,
  compact = false,
  dot = false,
  children,
}) => {
  const config = VARIANT_CONFIG[variant];
  const paddingClass = compact ? 'px-1 py-0' : 'px-1.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border ${config.container} ${paddingClass}`}
      style={{
        fontSize: 'var(--text-label)',
        lineHeight: 'var(--text-label-lh)',
        fontWeight: 'var(--text-label-weight)',
      }}
      data-schema-role="state-signal"
      data-variant={variant}
    >
      {dot && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

export default StatBadge;
