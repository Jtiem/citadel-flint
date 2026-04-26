import React, { useState } from 'react';
interface OrderFormState {
  orderNumber: string;
  orderDate: string;
  requiredDate: string;
  shipDate: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipToName: string;
  shipToAddress: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  shipToCountry: string;
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
  internalNotes: ''
};
export default function OrderManagementScreen() {
  const [form, setForm] = useState<OrderFormState>(initialState);
  function handleChange(field: keyof OrderFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({
        ...prev,
        [field]: e.target.value
      }));
    };
  }
  return <div style={{
    padding: '16px',
    fontFamily: 'Inter, sans-serif'
  }}>

      {/* VIOLATION: 10 undifferentiated actions, no visual priority */}
      <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '16px',
      flexWrap: 'wrap'
    }}>
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

      {/* VIOLATION: span elements instead of heading hierarchy */}
      <div style={{
      marginBottom: '16px'
    }}>
        <span>Order Management</span>
        <span>Create and manage orders</span>
        <span>All fields required unless marked optional</span>
      </div>

      {/* VIOLATION: no fieldset/legend grouping, no label associations */}
      <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px'
    }}>

        <div>
          <label>Order Number</label>
          <input value={form.orderNumber} onChange={handleChange('orderNumber')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Order Date</label>
          <input type="date" value={form.orderDate} onChange={handleChange('orderDate')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Required Date</label>
          <input type="date" value={form.requiredDate} onChange={handleChange('requiredDate')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Ship Date</label>
          <input type="date" value={form.shipDate} onChange={handleChange('shipDate')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Customer ID</label>
          <input value={form.customerId} onChange={handleChange('customerId')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Customer Name</label>
          <input value={form.customerName} onChange={handleChange('customerName')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Customer Email</label>
          <input type="email" value={form.customerEmail} onChange={handleChange('customerEmail')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Customer Phone</label>
          <input type="tel" value={form.customerPhone} onChange={handleChange('customerPhone')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Ship To Name</label>
          <input value={form.shipToName} onChange={handleChange('shipToName')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Ship To Address</label>
          <input value={form.shipToAddress} onChange={handleChange('shipToAddress')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>City</label>
          <input value={form.shipToCity} onChange={handleChange('shipToCity')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>State</label>
          <input value={form.shipToState} onChange={handleChange('shipToState')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>ZIP</label>
          <input value={form.shipToZip} onChange={handleChange('shipToZip')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Tax Exempt ID (optional)</label>
          <input value={form.taxExemptId} onChange={handleChange('taxExemptId')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>Customs HS Code (optional)</label>
          <input value={form.customsHsCode} onChange={handleChange('customsHsCode')} aria-label="[NEEDS LABEL]" />
        </div>

        <div>
          <label>ERP Reference (optional)</label>
          <input value={form.erpReference} onChange={handleChange('erpReference')} aria-label="[NEEDS LABEL]" />
        </div>

      </div>

      <div style={{
      marginTop: '12px'
    }}>
        <label>Internal Notes (optional)</label>
        <textarea value={form.internalNotes} onChange={handleChange('internalNotes')} rows={3} style={{
        display: 'block',
        width: '100%'
      }} aria-label="[NEEDS LABEL]" />
      </div>

      {/* VIOLATION: duplicates toolbar actions, no clear primary CTA */}
      <div style={{
      marginTop: '16px',
      display: 'flex',
      gap: '8px'
    }}>
        <button onClick={() => {}}>Submit Order</button>
        <button onClick={() => {}}>Save as Draft</button>
        <button onClick={() => {}}>Cancel</button>
      </div>
    </div>;
}