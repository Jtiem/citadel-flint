import React from 'react';

// MIGRATION: This component uses deprecated Tailwind v3 classes.
// VIOLATION: shadow-sm → shadow (v4 renamed)
// VIOLATION: text-gray-600 → text-zinc-600 (v4 palette rename)
// VIOLATION: bg-gray-100 → bg-zinc-100 (v4 palette rename)
// VIOLATION: hover:bg-gray-200 → hover:bg-zinc-200 (v4 palette rename)
// VIOLATION: ring-offset-2 → ring-2 ring-offset-2 (v4 API change)
// VIOLATION: colors.primary token → colors.brand.primary (renamed in DTCG migration)

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ children, variant = 'primary', disabled, onClick }: ButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm font-medium
                   hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md shadow-sm font-medium
                 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
