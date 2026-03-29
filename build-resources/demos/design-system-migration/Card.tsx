import React from 'react';

// MIGRATION: Token references use v3 names. Run flint_migrate_ds to update.
// VIOLATION: colors.primary → colors.brand.primary
// VIOLATION: colors.gray.600 → colors.neutral.600

interface CardProps {
  title: string;
  description: string;
  footer?: React.ReactNode;
}

export function Card({ title, description, footer }: CardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="p-6">
        {/* VIOLATION: using old token path colors.primary */}
        <h3 className="text-lg font-semibold" style={{ color: 'var(--colors-primary)' }}>
          {title}
        </h3>
        {/* VIOLATION: using old token path colors.gray.600 */}
        <p className="mt-2 text-sm" style={{ color: 'var(--colors-gray-600)' }}>
          {description}
        </p>
      </div>
      {footer && (
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200">
          {footer}
        </div>
      )}
    </div>
  );
}
