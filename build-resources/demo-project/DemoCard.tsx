import React from 'react';

/**
 * DemoCard — A product card with intentional design system violations.
 *
 * This component is bundled with beta builds so testers can immediately
 * see Flint's governance engine in action. It contains:
 *
 *   1. Color drift  — #0055EE on the price text, ΔE drift from token color.primary (#0066FF)
 *   2. Typography   — arbitrary font-size 15px on the description (no matching token)
 *   3. Spacing      — hardcoded p-[20px] container padding instead of token spacing.lg (24px)
 *   4. A11y         — missing alt text on the image (A11Y-001)
 *   5. A11y         — icon-only "favorite" button has no accessible label (A11Y-button-name)
 *   6. Hardcoded    — inline style with arbitrary box-shadow instead of token shadow.md
 *
 * After opening this file in Flint, the governance panel should light up
 * with violations. Click "Auto-Fix" to watch Flint resolve them.
 *
 * The component renders standalone with sensible default props so testers
 * see a populated card immediately, not an empty skeleton.
 */

interface DemoCardProps {
  title?: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  onAddToCart?: () => void;
  onFavorite?: () => void;
}

// Inline SVG placeholder — never 404s, always visible, no external CSP load.
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
       <rect width="400" height="200" fill="#E5E7EB"/>
       <text x="200" y="105" font-family="system-ui" font-size="18" fill="#6B7280" text-anchor="middle">Acme Pro · Product Image</text>
     </svg>`,
  );

export default function DemoCard({
  title = 'Acme Pro Plan',
  description = 'Everything your team needs to ship faster — unlimited projects, real-time collaboration, and priority support.',
  price = '$49 / month',
  imageUrl = PLACEHOLDER_IMG,
  onAddToCart = () => {},
  onFavorite = () => {},
}: DemoCardProps) {
  return (
    <div
      data-flint-id="card-root"
      // Violation 3 (intentional): hardcoded p-[20px] instead of token spacing.lg (24px)
      // Violation 6 (intentional): inline style with arbitrary shadow instead of token shadow.md
      className="bg-[var(--color-surface,#FFFFFF)] rounded-[var(--borderRadius-lg,12px)] p-[20px] max-w-[360px] border border-[var(--color-border,#E5E7EB)]"
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
    >
      {/* Violation 4 (intentional): img missing alt attribute (A11Y-001) */}
      <img
        data-flint-id="card-image"
        src={imageUrl}
        className="w-full h-[200px] object-cover rounded-[var(--borderRadius-md,8px)] mb-[var(--spacing-md,16px)]"
        alt=""
      />

      <h3
        data-flint-id="card-title"
        className="text-[var(--color-on-surface,#111827)] text-[var(--fontSize-lg,20px)] font-bold leading-[1.3] m-0"
      >
        {title}
      </h3>

      {/* Violation 2 (intentional): arbitrary font-size 15px not in token set */}
      <p
        data-flint-id="card-description"
        className="text-[var(--color-on-surface-muted,#6B7280)] text-[15px] leading-[1.5] mt-[var(--spacing-sm,8px)] mb-[var(--spacing-md,16px)]"
      >
        {description}
      </p>

      <div data-flint-id="card-footer" className="flex items-center justify-between">
        {/* Violation 1 (intentional): #0055EE is not token color.primary (#0066FF) — ΔE drift */}
        <span
          data-flint-id="card-price"
          className="text-[#0055EE] text-[var(--fontSize-xl,24px)] font-bold"
        >
          {price}
        </span>

        <div className="flex items-center gap-[var(--spacing-sm,8px)]">
          {/* Violation 5 (intentional): icon-only button missing accessible name */}
          <button
            data-flint-id="card-favorite"
            onClick={onFavorite}
            className="w-[36px] h-[36px] flex items-center justify-center rounded-[var(--borderRadius-md,8px)] border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] text-[var(--color-on-surface-muted,#6B7280)] cursor-pointer"
          >
            ♥
          </button>

          <button
            data-flint-id="card-cta"
            onClick={onAddToCart}
            className="px-[var(--spacing-lg,24px)] py-[var(--spacing-sm,8px)] bg-[var(--color-primary-hover,#0052CC)] text-[var(--color-on-primary,#FFFFFF)] rounded-[var(--borderRadius-md,8px)] text-[var(--fontSize-sm,14px)] font-semibold cursor-pointer border-none"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
