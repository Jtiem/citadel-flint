import React from 'react';

// Grade F — 8 violations
// VIOLATION: table has no <caption>
// VIOLATION: th elements have no scope attribute
// VIOLATION: header text color #6b6b6b (contrast 3.8:1 on white, below 4.5:1 AA)
// VIOLATION: link color #2979c4 (ΔE 3.2 from brand.primary #2563eb)
// VIOLATION: font-size 13px (not in scale)
// VIOLATION: status colors hardcoded (#16a34a, #ca8a04) — not in token set
// VIOLATION: row hover color #e8f0fe — not in neutral scale
// VIOLATION: missing aria-sort on sortable columns

interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
}
export function DataTable({
  headers,
  rows
}: DataTableProps) {
  return (
    // VIOLATION: no caption
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '13px'
    }}>
      <thead>
        <tr style={{
          backgroundColor: '#f9fafb'
        }}>
          {headers.map((h, i) =>
          // VIOLATION: no scope="col", no aria-sort
          <th key={i} style={{
            padding: '12px 16px',
            textAlign: 'left',
            color: "var(--color.on-surface-muted, #6B7280)",
            fontWeight: '500'
          }}>
              {h}
            </th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => <tr key={ri} style={{
          borderTop: '1px solid #f3f4f6'
        }}>
            {row.map((cell, ci) => <td key={ci} style={{
            padding: '12px 16px',
            color: "var(--color.on-surface, #111827)"
          }}>
                {cell === 'Active' ? <span style={{
              color: '#16a34a',
              fontWeight: '500'
            }}>{cell}</span> : cell === 'Pending' ? <span style={{
              color: "var(--color.warning, #D97706)",
              fontWeight: '500'
            }}>{cell}</span> : cell}
              </td>)}
          </tr>)}
      </tbody>
    </table>
  );
}