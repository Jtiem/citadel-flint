# Demo: Token Drift

**What you'll learn:** Flint catches color, typography, and spacing drift that your eyes miss.

## The scenario
A developer hand-coded a product card and deviated from the design system in 7 places. The deviations are subtle — each color is off by just 2-3 ΔE units (the threshold of human perception). Flint catches them all.

## What to try
1. Open `ProductCard.tsx` — see 7 violations flagged in the governance panel
2. Say **"fix it"** in your AI assistant — watch all 7 auto-remediate
3. Open `ProductBadge.tsx` — see a fully compliant component (Grade A) for comparison

## The violations
- 4 color drifts (ΔE 2.1–3.1): badge color, strikethrough price, add-to-cart button, unavailable text
- 1 spacing violation: 20px padding (not in scale: 8/16/24px)
- 1 typography size violation: 15px (not in scale: 14/16/20/24px)
- 1 typography weight violation: 600 (not in scale: 400/500/700)

## Learning outcome
"Flint catches drift that your eyes miss, and fixes it deterministically."
