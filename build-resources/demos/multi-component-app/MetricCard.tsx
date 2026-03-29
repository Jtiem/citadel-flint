import React from 'react';

// Grade B — 2 violations
// VIOLATION: color #f97316 (orange-500, not in token set)
// VIOLATION: font-size 13px (not in typography scale)

interface MetricCardProps {
  label: string;
  value: string | number;
  change: number;
}

export function MetricCard({ label, value, change }: MetricCardProps) {
  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '16px' }}>
      <p style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>{/* VIOLATION: 13px */}
        {label}
      </p>
      <p style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>{value}</p>
      <p style={{ fontSize: '14px', color: change >= 0 ? '#10b981' : '#f97316', marginTop: '4px' }}>
        {/* VIOLATION: #f97316 not in token set */}
        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
      </p>
    </div>
  );
}
