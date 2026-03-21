import React, { Component, useState } from 'react';
import BannerCompliant from '../01-rag-ui-builder/banner-compliant';
import BannerBroken from '../01-rag-ui-builder/banner-broken';
import BuggyComponent from '../02-self-correcting/buggy-component';
import DriftComponent from '../03-mithril-shadow-audit/drift-component';

class DemoErrorBoundary extends Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#2a1215', border: '1px solid #f87171', borderRadius: 12, padding: 32, maxWidth: 560 }}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            Runtime Error in {this.props.name}
          </div>
          <pre style={{ color: '#fca5a5', fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>
            {this.state.error.message}
          </pre>
          <div style={{ color: '#888', fontSize: 12, marginTop: 16 }}>
            This is an intentionally buggy component. Run <code style={{ color: '#60a5fa' }}>flint_fix</code> to auto-repair.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const bannerProps = {
  label: 'New Feature',
  headline: 'Introducing Flint Governance',
  body: 'Ship AI-generated UI code with confidence. Flint enforces design systems, accessibility, and brand compliance at the AST level.',
  ctaText: 'Learn More',
  onCta: () => alert('CTA clicked'),
};

const dataTableProps = {
  rows: [
    { id: '1', name: 'Alice Johnson', status: 'active' as const, value: 1250 },
    { id: '2', name: 'Bob Smith', status: 'pending' as const, value: 890 },
    { id: '3', name: 'Carol White', status: 'inactive' as const, value: 2100 },
    { id: '4', name: 'Dave Brown', status: 'active' as const, value: 450 },
  ],
  pageSize: 10,
  onRowClick: (row: any) => alert(`Clicked: ${row.name}`),
};

const pricingProps = {
  planName: 'Pro',
  price: 49,
  billingPeriod: 'monthly' as const,
  features: [
    { text: 'Unlimited audits', included: true },
    { text: 'Mithril linter', included: true },
    { text: 'A11y gate', included: true },
    { text: 'Custom rules', included: false },
  ],
  onSelectPlan: (plan: string) => alert(`Selected: ${plan}`),
};

type DemoEntry = {
  id: string;
  label: string;
  render: () => React.ReactNode;
};

const demos: DemoEntry[] = [
  { id: 'banner-compliant', label: 'Banner (Compliant)', render: () => <DemoErrorBoundary name="BannerCompliant"><BannerCompliant {...bannerProps} /></DemoErrorBoundary> },
  { id: 'banner-broken', label: 'Banner (Broken)', render: () => <DemoErrorBoundary name="BannerBroken"><BannerBroken {...bannerProps} /></DemoErrorBoundary> },
  { id: 'buggy', label: 'Data Table (Buggy)', render: () => <DemoErrorBoundary name="DataTable"><BuggyComponent {...dataTableProps} /></DemoErrorBoundary> },
  { id: 'drift', label: 'Pricing (Drift)', render: () => <DemoErrorBoundary name="PricingCard"><DriftComponent {...pricingProps} /></DemoErrorBoundary> },
];

export function DemoPreview() {
  const [active, setActive] = useState(demos[0].id);
  const activeDemo = demos.find(d => d.id === active);

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', opacity: 0.6 }}>FLINT DEMO</span>
        <nav style={{ display: 'flex', gap: 8 }}>
          {demos.map(d => (
            <button
              key={d.id}
              onClick={() => setActive(d.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active === d.id ? 600 : 400,
                background: active === d.id ? '#0066FF' : '#1a1a1a',
                color: '#fff',
              }}
            >
              {d.label}
            </button>
          ))}
        </nav>
      </header>

      <main key={active} style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        {activeDemo?.render()}
      </main>
    </div>
  );
}
