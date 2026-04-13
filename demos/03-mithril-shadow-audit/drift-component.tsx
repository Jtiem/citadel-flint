import React from 'react';

/**
 * PricingCard — Demo fixture for CIEDE2000 color drift detection.
 *
 * This component was produced by an AI that eyeballed colors from a Figma
 * screenshot instead of reading design tokens. Three color values are subtly
 * wrong:
 *
 *   Header bg:  #0055EE — nearest: color.primary-hover (#0052CC)  ΔE 4.6
 *   Badge bg:   #FF3333 — nearest: color.danger (#DC2626)      ΔE 8.1
 *   Button bg:  #0055EE — nearest: color.primary-hover (#0052CC)  ΔE 4.6
 *
 * Inline style values are literal strings (not ternary expressions) so the
 * Mithril linter can extract and compare them via CIEDE2000.
 * Spacing / layout are Tailwind standard scale classes to avoid masking the
 * color violations with MITHRIL-IST-SPC hits.
 */

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  planName: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  features: PricingFeature[];
  onSelectPlan: (planName: string) => void;
}

export default function PricingCard({
  planName,
  price,
  billingPeriod,
  features,
  onSelectPlan,
}: PricingCardProps) {
  return (
    <article
      data-flint-id="pricing-card-root"
      className="relative flex flex-col overflow-hidden rounded-xl border-0 shadow-2xl"
    >
      {/* Badge — DRIFT: #FF3333 used instead of color.danger (#DC2626) */}
      <div
        data-flint-id="pricing-card-badge"
        style={{ backgroundColor: '#FF3333' }}
        className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wide"
      >
        Most popular
      </div>

      {/* Header — DRIFT: #0055EE used instead of color.primary (#0066FF) */}
      <div
        data-flint-id="pricing-card-header"
        style={{ backgroundColor: '#0055EE' }}
        className="px-6 py-7"
      >
        <h3
          data-flint-id="pricing-card-plan-name"
          className="text-white text-lg font-semibold m-0"
        >
          {planName}
        </h3>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-white text-5xl font-bold leading-none">
            ${price}
          </span>
          <span className="text-white/70 text-sm">
            / {billingPeriod === 'annual' ? 'mo, billed annually' : 'month'}
          </span>
        </div>
      </div>

      {/* Features */}
      <div
        data-flint-id="pricing-card-features"
        className="flex-1 px-6 py-6"
      >
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {features.map((feature, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm"
              style={{
                color: feature.included ? '#374151' : '#9CA3AF',
                textDecoration: feature.included ? 'none' : 'line-through',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
                className="shrink-0 mt-px"
                style={{ color: feature.included ? '#00AAFF' : 'transparent' }}
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

      {/* CTA — DRIFT: #0055EE used instead of color.primary (#0066FF) */}
      <div className="px-6 pb-7">
        <button
          data-flint-id="pricing-card-cta"
          onClick={() => onSelectPlan(planName)}
          style={{ backgroundColor: '#0055EE' }}
          className="w-full py-3 rounded-lg text-white text-sm font-semibold border-0 cursor-pointer"
        >
          Get started with {planName}
        </button>
      </div>
    </article>
  );
}
