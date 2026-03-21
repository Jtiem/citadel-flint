import React from 'react';

/**
 * DemoCard — A product card with intentional design system violations.
 *
 * This component is bundled with beta builds so testers can immediately
 * see Flint's governance engine in action. It contains:
 *
 *   1. Color drift  — #0055EE instead of token color.primary (#0066FF)
 *   2. Typography   — arbitrary font-size 15px instead of spacing token
 *   3. Spacing      — hardcoded p-[20px] instead of token spacing.lg (24px)
 *   4. A11y         — missing alt text on the image
 *   5. A11y         — button with no accessible label
 *   6. Hardcoded    — inline style with arbitrary shadow
 *
 * After opening this file in Flint, the governance panel should light up
 * with violations. Click "Auto-Fix" to watch Flint resolve them.
 */

interface DemoCardProps {
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
  onAddToCart: () => void;
}

export default function DemoCard({
  title,
  description,
  price,
  onAddToCart,
}: DemoCardProps) {
  return (
    <div
      data-flint-id="card-root"
      className="bg-[#FEFEFE] rounded-[10px] p-[20px] max-w-[360px] border border-[#E0E0E0]"
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
    >
      {/* Violation: img missing alt attribute (A11Y-001) */}
      <img
        data-flint-id="card-image"
        src="/placeholder.png"
        className="w-full h-[200px] object-cover rounded-[8px] mb-[16px]"
      />

      <h3
        data-flint-id="card-title"
        className="text-[#111827] text-[20px] font-bold leading-[1.3] m-0"
      >
        {title}
      </h3>

      {/* Violation: arbitrary font-size 15px, not in token set */}
      <p
        data-flint-id="card-description"
        className="text-[#6B7280] text-[15px] leading-[1.5] mt-[8px] mb-[16px]"
      >
        {description}
      </p>

      <div
        data-flint-id="card-footer"
        className="flex items-center justify-between"
      >
        {/* Violation: #0055EE is not token color.primary (#0066FF) — ΔE drift */}
        <span
          data-flint-id="card-price"
          className="text-[#0055EE] text-[24px] font-bold"
        >
          {price}
        </span>

        {/* Violation: button missing accessible name for icon-only button */}
        <button
          data-flint-id="card-cta"
          onClick={onAddToCart}
          className="px-[20px] py-[10px] bg-[#0055EE] text-[#FFFFFF] rounded-[8px] text-[14px] font-semibold cursor-pointer border-none"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
