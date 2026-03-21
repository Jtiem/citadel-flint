import React from 'react';

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  planName: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  features: PricingFeature[];
  highlighted?: boolean;
  onSelectPlan: (planName: string) => void;
}

const HIGHLIGHTED_BG = '#1a1a2e';

export default function PricingCard({
  planName,
  price,
  billingPeriod,
  features,
  highlighted = false,
  onSelectPlan,
}: PricingCardProps) {
  return (
    <article
      data-flint-id="pricing-card-root"
      style={{
        backgroundColor: highlighted ? HIGHLIGHTED_BG : '#FFFFFF',
        borderRadius: '12px',
        overflow: 'hidden',
        border: highlighted ? 'none' : '1px solid #E5E7EB',
        boxShadow: highlighted
          ? '0 20px 40px rgba(0,0,0,0.25)'
          : '0 1px 3px rgba(0,0,0,0.08)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {highlighted && (
        <div
          data-flint-id="pricing-card-badge"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: '#FF3333',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '9999px',
          }}
        >
          Most popular
        </div>
      )}

      <div
        data-flint-id="pricing-card-header"
        style={{
          backgroundColor: highlighted ? '#0055EE' : '#F8F9FA',
          padding: '28px 24px',
        }}
      >
        <h3
          style={{
            color: highlighted ? '#FFFFFF' : '#111827',
            fontSize: '18px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          {planName}
        </h3>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              color: highlighted ? '#FFFFFF' : '#111827',
              fontSize: '40px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ${price}
          </span>
          <span
            style={{
              color: highlighted ? 'rgba(255,255,255,0.7)' : '#6B7280',
              fontSize: '14px',
            }}
          >
            / {billingPeriod === 'annual' ? 'mo, billed annually' : 'month'}
          </span>
        </div>
      </div>

      <div
        data-flint-id="pricing-card-features"
        style={{ padding: '24px', flex: 1 }}
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {features.map((feature, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '15px',
                color: feature.included
                  ? (highlighted ? '#FFFFFF' : '#374151')
                  : (highlighted ? 'rgba(255,255,255,0.35)' : '#9CA3AF'),
                textDecoration: feature.included ? 'none' : 'line-through',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                style={{
                  flexShrink: 0,
                  marginTop: '1px',
                  color: feature.included
                    ? (highlighted ? '#00AAFF' : '#00AAFF')
                    : 'transparent',
                }}
              >
                {feature.included && (
                  <path
                    d="M3.5 9.5l3.5 3.5 7-8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
              {feature.text}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ padding: '0 24px 28px' }}>
        <button
          onClick={() => onSelectPlan(planName)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            transition: 'background-color 0.15s',
            backgroundColor: highlighted ? '#0055EE' : '#F3F4F6',
            color: highlighted ? '#FFFFFF' : '#374151',
          }}
        >
          Get started with {planName}
        </button>
      </div>
    </article>
  );
}
