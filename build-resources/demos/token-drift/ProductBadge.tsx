import React from 'react';

// This component is fully compliant with the design system.
// Compare with ProductCard.tsx to see the difference.

interface ProductBadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'error';
}

const variantStyles = {
  primary: { backgroundColor: '#1a56db', color: '#ffffff' },    // brand.primary ✓
  success: { backgroundColor: '#0e9f6e', color: '#ffffff' },    // brand.accent ✓
  error:   { backgroundColor: '#f05252', color: '#ffffff' },    // feedback.error ✓
};

export function ProductBadge({ label, variant = 'primary' }: ProductBadgeProps) {
  return (
    <span style={{
      ...variantStyles[variant],
      fontSize: '14px',       // typography.size.sm ✓
      fontWeight: '500',      // typography.weight.medium ✓
      padding: '4px 8px',     // within spacing.sm (8px) ✓
      borderRadius: '4px',
      display: 'inline-block'
    }}>
      {label}
    </span>
  );
}
