/**
 * BuggyComponent — demos/02-self-correcting/buggy-component.tsx
 *
 * HALLUCINATION OUTPUT: what an AI might generate when it misreads the
 * prop contract for a data table component. Contains three deliberate
 * type errors that Bridge's in-memory TSC loop catches before the user
 * ever sees a diff:
 *
 *   1. `pageSize` declared as `number` but the call-site passes a string
 *      literal ("25") — caught by: TS2322 (Type 'string' not assignable
 *      to type 'number').
 *
 *   2. `onRowClick` prop signature expects `(row: Row) => void` but the
 *      implementation passes a second `index: string` parameter that is
 *      not in the contract — caught by: TS2345 (Argument of type
 *      '(row: Row, index: string) => void' is not assignable).
 *
 *   3. `sortColumn` is typed `keyof Row` (one of the union of known
 *      column keys) but is initialised with `"created_by"` which is not
 *      a member of the Row interface — caught by: TS2322.
 */

import React, { useState } from 'react';

interface Row {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  lastModified: string;
  owner: string;
}

interface DataTableProps {
  rows: Row[];
  /** Number of rows to display per page. */
  pageSize: number;
  /** Called when the user clicks a data row. */
  onRowClick: (row: Row) => void;
  /** Whether the table is in a loading state. */
  loading?: boolean;
  /** Column to sort by on initial render. */
  initialSortColumn?: keyof Row;
}

const STATUS_LABELS: Record<Row['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
};

const STATUS_CLASSES: Record<Row['status'], string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-800',
};

// ── TYPE ERROR 1 ──────────────────────────────────────────────────────────────
// pageSize is `number` in the interface but the consumer passes "25" (string).
// In this file the error manifests here as the default prop initializer.
const DEFAULT_PAGE_SIZE: number = "25"; // TS2322: string not assignable to number

// ── TYPE ERROR 2 ──────────────────────────────────────────────────────────────
// onRowClick contract is (row: Row) => void. The handler below has an extra
// `index: string` parameter that does not appear in the interface.
function handleRowClick(row: Row, index: string): void {
  console.log(`Clicked row ${index}:`, row.id);
}

export default function DataTable({
  rows,
  pageSize = DEFAULT_PAGE_SIZE,
  onRowClick,
  loading = false,
  initialSortColumn = 'name',
}: DataTableProps) {
  // ── TYPE ERROR 3 ────────────────────────────────────────────────────────────
  // `keyof Row` is 'id' | 'name' | 'status' | 'lastModified' | 'owner'.
  // "created_by" is not in that union — should be initialSortColumn ?? 'name'.
  const [sortColumn, setSortColumn] = useState<keyof Row>("created_by");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortColumn] as string;
    const bv = b[sortColumn] as string;
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(col: keyof Row) {
    if (col === sortColumn) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {(['name', 'status', 'lastModified', 'owner'] as const).map((col) => (
              <th
                key={col}
                scope="col"
                onClick={() => toggleSort(col)}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
              >
                {col === 'lastModified' ? 'Modified' : col.charAt(0).toUpperCase() + col.slice(1)}
                {sortColumn === col && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visible.map((row) => (
            <tr
              key={row.id}
              // Passes handleRowClick directly — TS catches the extra `index` param
              onClick={() => onRowClick(row)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                {row.name}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[row.status]}`}>
                  {STATUS_LABELS[row.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                {row.lastModified}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                {row.owner}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
