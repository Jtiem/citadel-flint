import React, { Component, useState } from 'react';
import BannerCompliant from '../01-rag-ui-builder/banner-compliant';
import BannerBroken from '../01-rag-ui-builder/banner-broken';
import DriftComponent from '../03-mithril-shadow-audit/drift-component';
import ViolatingUX from '../04-sentinel/violating-ux';

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
            This is an intentionally broken fixture. Run <code style={{ color: '#60a5fa' }}>flint_fix</code> to auto-repair.
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

// Drift component: featured Pro plan — always highlighted so drift colors are always visible.
// Header + CTA button use #0055EE (ΔE 4.6 from color.primary-hover)
// Badge uses #FF3333 (ΔE 8.1 from color.danger)
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
  badge?: 'blocked' | 'warning' | 'ok';
  render: () => React.ReactNode;
};

const demos: DemoEntry[] = [
  {
    id: 'banner-compliant',
    label: 'Banner (Compliant?)',
    badge: 'blocked',
    render: () => (
      <DemoErrorBoundary name="BannerCompliant">
        <div className="w-full max-w-2xl">
          <BannerCompliant {...bannerProps} />
        </div>
      </DemoErrorBoundary>
    ),
  },
  {
    id: 'banner-broken',
    label: 'Banner (Broken)',
    badge: 'blocked',
    render: () => (
      <DemoErrorBoundary name="BannerBroken">
        <div className="flex flex-col gap-6 items-center w-full max-w-2xl">
          <div className="text-sm text-gray-400 self-start">
            <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">#0066FF</span>
            {' '}→ brand primary
          </div>
          <BannerCompliant {...bannerProps} />
          <div className="text-sm text-gray-400 self-start">
            <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-red-400">#0055EE</span>
            {' '}→ eyeballed from screenshot
          </div>
          <BannerBroken {...bannerProps} />
        </div>
      </DemoErrorBoundary>
    ),
  },
  {
    id: 'drift',
    label: 'Pricing (Color Drift)',
    badge: 'blocked',
    render: () => (
      <DemoErrorBoundary name="PricingCard">
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="text-xs text-gray-400 text-center">
            3 MITHRIL-IST-COL violations · ΔE 4.6 header, ΔE 8.1 badge
          </div>
          <DriftComponent {...pricingProps} />
        </div>
      </DemoErrorBoundary>
    ),
  },
  {
    id: 'violating-ux',
    label: 'Order Form (31 violations)',
    badge: 'blocked',
    render: () => (
      <DemoErrorBoundary name="ViolatingUX">
        <div className="w-full">
          <ViolatingUX />
        </div>
      </DemoErrorBoundary>
    ),
  },
];

const BADGE_STYLES: Record<NonNullable<DemoEntry['badge']>, React.CSSProperties> = {
  blocked: { background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' },
  warning: { background: '#451a03', color: '#fcd34d', border: '1px solid #78350f' },
  ok:      { background: '#052e16', color: '#86efac', border: '1px solid #166534' },
};

export function DemoPreview() {
  const [active, setActive] = useState(demos[0].id);
  const activeDemo = demos.find(d => d.id === active);

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', opacity: 0.6, flexShrink: 0 }}>FLINT DEMO</span>
        <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {demos.map(d => (
            <button
              key={d.id}
              onClick={() => setActive(d.id)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: active === d.id ? '1px solid #0066FF' : '1px solid #333',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: active === d.id ? 600 : 400,
                background: active === d.id ? '#0066FF' : '#1a1a1a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {d.label}
              {d.badge && (
                <span style={{ ...BADGE_STYLES[d.badge], fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700, letterSpacing: '0.04em' }}>
                  {d.badge === 'blocked' ? 'BLOCKED' : d.badge === 'warning' ? 'WARN' : 'OK'}
                </span>
              )}
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
