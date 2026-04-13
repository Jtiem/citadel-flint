import React, { useState } from 'react';

// ─── WARDEN VIOLATIONS (WCAG 2.1 AA) ────────────────────────────────────────
// A11Y-001 (×3): <input> has no associated <label> (firstName, lastName, dob)
// A11Y-002: Error message not announced to screen readers (no role="alert")
// A11Y-003: Error text contrast 3.2:1 — WCAG minimum is 4.5:1
// A11Y-004: Submit button has no accessible name beyond generic "Submit"
// A11Y-005: Required fields not marked for screen readers (no aria-required)
// A11Y-006: Form has no accessible name (no aria-label or aria-labelledby)
// A11Y-007: Consent checkbox has no label association
// A11Y-008: Icon-only close button has no aria-label
//
// ─── MITHRIL VIOLATIONS (Brand Token Drift) ──────────────────────────────────
// MITHRIL-001: Button color #1d4ed8 is not a design token.
//              Brand primary is #005B94 (Summit Health Corporate Blue).
//              CIEDE2000 ΔE ≈ 28.7 — visible difference under standard lighting.
// MITHRIL-002: Error text color #b91c1c is not a design token.
//              Brand error is #C41E1E (Summit Health Red).
//              CIEDE2000 ΔE ≈ 4.1 — below human detection threshold but above
//              Flint's 2.0 enforcement limit. Invisible to human review.
//
// ─── TOTAL: 10 violations. Export Gate: BLOCKED. ────────────────────────────

export function PatientForm() {
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const firstName = (form.elements.namedItem('firstName') as HTMLInputElement)?.value;
    if (!firstName) {
      setError('First name is required');  // A11Y-002: not announced (no role="alert")
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return <div>Form submitted successfully.</div>;
  }

  return (
    // A11Y-006: form has no aria-label
    <form onSubmit={handleSubmit} style={{ maxWidth: '480px', padding: '24px' }}>
      <button type="button" style={{ float: 'right', border: 'none', background: 'none' }}>
        {/* A11Y-008: no aria-label on icon-only button */}
        ✕
      </button>

      <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>Patient Intake</h2>

      {error && (
        // A11Y-002: no role="alert"
        // A11Y-003: color contrast 3.2:1 — fails AA
        // MITHRIL-002: #b91c1c is not brand token color.feedback.error (#C41E1E). ΔE ≈ 4.1
        <p data-flint-id="patient-form-error" style={{ color: '#b91c1c', marginBottom: '16px' }}>{error}</p>
      )}

      <div style={{ marginBottom: '16px' }}>
        {/* A11Y-001: input has no associated label */}
        <input
          name="firstName"
          placeholder="First name"
          // A11Y-005: no aria-required="true"
          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0' }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        {/* A11Y-001: input has no associated label */}
        <input
          name="lastName"
          placeholder="Last name"
          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0' }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        {/* A11Y-001: input has no associated label */}
        <input
          name="dob"
          type="date"
          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0' }}
        />
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* A11Y-007: checkbox has no label association */}
        <input type="checkbox" id="consent" />
        <span style={{ fontSize: '14px', color: '#64748b' }}>I consent to treatment</span>
      </div>

      {/* A11Y-004: button has generic "Submit" text — no context for screen readers */}
      {/* MITHRIL-001: #1d4ed8 is not brand token color.brand.primary (#005B94). ΔE ≈ 28.7 */}
      <button
        data-flint-id="patient-form-submit"
        type="submit"
        style={{ backgroundColor: '#1d4ed8', color: '#fff', padding: '10px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        Submit
      </button>
    </form>
  );
}
