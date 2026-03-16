/**
 * ViolatingUX — demos/04-sentinel/violating-ux.tsx
 *
 * An "order management" screen that violates nearly every cognitive load
 * principle the Bridge Sentinel enforces. This is the kind of output an
 * AI produces when given only a feature list and no UX constraints.
 *
 * SENTINEL VIOLATIONS:
 *
 *   SENTINEL-CL-001  Toolbar overload — 10 action buttons visible simultaneously.
 *                    Hick's Law: decision time grows logarithmically with choices.
 *                    Threshold: > 5 primary actions without grouping/overflow.
 *
 *   SENTINEL-CL-002  Form density — 16 fields rendered simultaneously with no
 *                    progressive disclosure, no section grouping, no stepped flow.
 *                    Miller's Law: working memory handles 7 ± 2 items.
 *
 *   SENTINEL-VH-001  No visual hierarchy — all text is the same weight and size.
 *                    Labels, values, headings, and helper text are
 *                    indistinguishable.
 *
 *   SENTINEL-PD-001  No progressive disclosure — advanced fields (tax exempt ID,
 *                    customs HS code, ERP reference) are always visible alongside
 *                    primary fields.
 *
 *   SENTINEL-A11Y-NAV  No landmark regions — the entire screen is a flat <div>
 *                      tree with no <main>, <nav>, <aside>, or <header>.
 */

import React, { useState } from 'react';

interface OrderFormState {
  // Basic order fields
  orderNumber: string;
  orderDate: string;
  requiredDate: string;
  shipDate: string;
  // Customer fields
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  // Shipping fields
  shipToName: string;
  shipToAddress: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  shipToCountry: string;
  // Advanced fields (should be hidden behind progressive disclosure)
  taxExemptId: string;
  customsHsCode: string;
  erpReference: string;
  internalNotes: string;
}

const initialState: OrderFormState = {
  orderNumber: '',
  orderDate: '',
  requiredDate: '',
  shipDate: '',
  customerId: '',
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  shipToName: '',
  shipToAddress: '',
  shipToCity: '',
  shipToState: '',
  shipToZip: '',
  shipToCountry: 'US',
  taxExemptId: '',
  customsHsCode: '',
  erpReference: '',
  internalNotes: '',
};

export default function OrderManagementScreen() {
  const [form, setForm] = useState<OrderFormState>(initialState);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  function handleChange(field: keyof OrderFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  // SENTINEL-CL-001: 10 toolbar actions — all primary, no grouping, no overflow
  return (
    <div style={{ padding: '16px', fontFamily: 'Inter, sans-serif' }}>

      {/* Toolbar with 10 simultaneous action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => {}}>New Order</button>
        <button onClick={() => {}}>Save Draft</button>
        <button onClick={() => {}}>Submit Order</button>
        <button onClick={() => {}}>Duplicate</button>
        <button onClick={() => {}}>Export CSV</button>
        <button onClick={() => {}}>Export PDF</button>
        <button onClick={() => {}}>Print</button>
        <button onClick={() => {}}>Archive</button>
        <button onClick={() => {}}>Delete</button>
        <button onClick={() => {}}>Request Approval</button>
      </div>

      {/* SENTINEL-VH-001: flat typography — no hierarchy, all same weight */}
      <div style={{ marginBottom: '16px' }}>
        <span>Order Management</span>
        <span>Create and manage orders</span>
        <span>All fields required unless marked optional</span>
      </div>

      {/* SENTINEL-CL-002 + SENTINEL-PD-001: 16 fields, no grouping, no disclosure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        <div>
          <label>Order Number</label>
          <input value={form.orderNumber} onChange={handleChange('orderNumber')} />
        </div>

        <div>
          <label>Order Date</label>
          <input type="date" value={form.orderDate} onChange={handleChange('orderDate')} />
        </div>

        <div>
          <label>Required Date</label>
          <input type="date" value={form.requiredDate} onChange={handleChange('requiredDate')} />
        </div>

        <div>
          <label>Ship Date</label>
          <input type="date" value={form.shipDate} onChange={handleChange('shipDate')} />
        </div>

        <div>
          <label>Customer ID</label>
          <input value={form.customerId} onChange={handleChange('customerId')} />
        </div>

        <div>
          <label>Customer Name</label>
          <input value={form.customerName} onChange={handleChange('customerName')} />
        </div>

        <div>
          <label>Customer Email</label>
          <input type="email" value={form.customerEmail} onChange={handleChange('customerEmail')} />
        </div>

        <div>
          <label>Customer Phone</label>
          <input type="tel" value={form.customerPhone} onChange={handleChange('customerPhone')} />
        </div>

        <div>
          <label>Ship To Name</label>
          <input value={form.shipToName} onChange={handleChange('shipToName')} />
        </div>

        <div>
          <label>Ship To Address</label>
          <input value={form.shipToAddress} onChange={handleChange('shipToAddress')} />
        </div>

        <div>
          <label>City</label>
          <input value={form.shipToCity} onChange={handleChange('shipToCity')} />
        </div>

        <div>
          <label>State</label>
          <input value={form.shipToState} onChange={handleChange('shipToState')} />
        </div>

        <div>
          <label>ZIP</label>
          <input value={form.shipToZip} onChange={handleChange('shipToZip')} />
        </div>

        {/* Advanced fields — should be behind "Show advanced options" disclosure */}
        <div>
          <label>Tax Exempt ID (optional)</label>
          <input value={form.taxExemptId} onChange={handleChange('taxExemptId')} />
        </div>

        <div>
          <label>Customs HS Code (optional)</label>
          <input value={form.customsHsCode} onChange={handleChange('customsHsCode')} />
        </div>

        <div>
          <label>ERP Reference (optional)</label>
          <input value={form.erpReference} onChange={handleChange('erpReference')} />
        </div>

      </div>

      {/* Internal notes — also always visible */}
      <div style={{ marginTop: '12px' }}>
        <label>Internal Notes (optional)</label>
        <textarea
          value={form.internalNotes}
          onChange={handleChange('internalNotes')}
          rows={3}
          style={{ display: 'block', width: '100%' }}
        />
      </div>

      {/* Submit row — identical visual weight to all the toolbar buttons above */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => {}}>Submit Order</button>
        <button onClick={() => {}}>Save as Draft</button>
        <button onClick={() => {}}>Cancel</button>
      </div>
    </div>
  );
}
