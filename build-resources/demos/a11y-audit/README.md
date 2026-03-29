# Demo: A11y Audit

**What you'll learn:** Flint's Warden enforces WCAG 2.1 AA with plain-language explanations.

## The scenario
A healthcare patient intake form with 8 common accessibility mistakes. These violations affect real users: screen reader users won't hear error messages, keyboard users can't identify form fields, and low-vision users can't read the error text.

## What to try
1. Open `PatientForm.tsx` — see 8 Warden violations in the governance panel
2. Say **"check accessibility"** — get WCAG rule IDs and plain-language explanations for each
3. Say **"fix it"** — watch Warden auto-remediate the auto-fixable violations
4. Compare with `PatientFormFixed.tsx` to see the fully remediated version

## The violations
- A11Y-001 (×3): Inputs with no associated `<label>` (first name, last name, DOB)
- A11Y-002: Error message not announced (missing `role="alert"`)
- A11Y-003: Error text contrast 3.2:1 (below WCAG 4.5:1 AA minimum)
- A11Y-004: Submit button too generic ("Submit" — no context)
- A11Y-005: Required fields not marked for screen readers (`aria-required`)
- A11Y-006: Form has no accessible name (`aria-label`)
- A11Y-007: Checkbox has no label association
- A11Y-008: Icon-only close button has no `aria-label`

## Learning outcome
"Flint enforces WCAG 2.1 AA automatically, with plain-language explanations for every violation."
