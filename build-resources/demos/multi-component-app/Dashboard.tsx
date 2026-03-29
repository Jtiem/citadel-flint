import React from 'react';

// Grade A — 0 violations. This is the reference implementation.
// Every color, spacing, and typography value matches the design tokens.

interface DashboardProps {
  title: string;
  children: React.ReactNode;
}

export function Dashboard({ title, children }: DashboardProps) {
  return (
    <main aria-label="Dashboard" style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '24px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>{title}</h1>
      </header>
      <div style={{ display: 'grid', gap: '16px' }}>
        {children}
      </div>
    </main>
  );
}
