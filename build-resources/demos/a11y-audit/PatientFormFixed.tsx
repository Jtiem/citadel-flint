import React, { useState } from 'react';

// This is the same form after Flint remediation.
// Compare with PatientForm.tsx to see every fix.
//
// ─── ALL VIOLATIONS RESOLVED ─────────────────────────────────────────────────
// Warden: 8 WCAG 2.1 AA violations → 0
// Mithril: 2 brand token drift violations → 0
// Export Gate: APPROVED
//
// Key changes from PatientForm.tsx:
// 1. All inputs have explicit <label> elements with htmlFor
// 2. Error message has role="alert" for screen reader announcement
// 3. Error text uses var(--color-feedback-error) — brand token, contrast 5.9:1
// 4. Form has aria-label="Patient intake form"
// 5. Close button has aria-label="Close form"
// 6. Required field marked with aria-required="true"
// 7. Consent checkbox properly associated via htmlFor/id
// 8. Submit button has descriptive text "Submit intake form"
// 9. Button uses var(--color-brand-primary) — Summit Health Corporate Blue
// ─────────────────────────────────────────────────────────────────────────────

export function PatientFormFixed() {
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const firstName = (form.elements.namedItem('firstName') as HTMLInputElement)?.value;
    if (!firstName) {
      setError('First name is required');
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return <div>Form submitted successfully.</div>;
  }

  return (
    <main>
      <nav aria-label="Site navigation">
        <a href="/" style={{ fontSize: '14px', color: 'var(--color-brand-primary, #005B94)' }}>← Back to Summit Health</a>
      </nav>
      <form onSubmit={handleSubmit} aria-label="Patient intake form" style={{ maxWidth: '480px', padding: '24px' }}>
      <button type="button" aria-label="Close form" style={{ float: 'right', border: 'none', background: 'none' }}>
        ✕
      </button>

      <h1 id="form-title" style={{ color: 'var(--color-text-primary, #1e293b)', marginBottom: '24px' }}>
        Patient Intake
      </h1>

      {error && (
        <p role="alert" style={{ color: 'var(--color-feedback-error, #C41E1E)', marginBottom: '16px' }}>
          {error}
        </p>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="firstName" style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
          First name <span aria-hidden="true">*</span>
        </label>
        <input
          id="firstName"
          name="firstName"
          aria-required="true"
          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0' }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="lastName" style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
          Last name
        </label>
        <input
          id="lastName"
          name="lastName"
          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0' }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="dob" style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
          Date of birth
        </label>
        <input
          id="dob"
          name="dob"
          type="date"
          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0' }}
        />
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" id="consent" />
        <label htmlFor="consent" style={{ fontSize: '14px', color: 'var(--color-text-muted, #64748b)' }}>
          I consent to treatment
        </label>
      </div>

      <button
        type="submit"
        style={{
          backgroundColor: 'var(--color-brand-primary, #005B94)',
          color: '#fff',
          padding: '10px 24px',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        Submit intake form
      </button>
    </form>
    </main>
  );
}
