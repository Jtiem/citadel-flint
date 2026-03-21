/**
 * healthcare.ts — HIPAA + FDA SaMD domain rules module
 *
 * Exported as a DomainRules object referenced by the sentinel prompt
 * and the domain registry. These are prompt-layer constraints, not
 * runtime linter rules — they inform the AI agent's governance persona.
 */

export interface DomainRuleEntry {
    id: string
    category: 'forbidden' | 'required' | 'halt'
    description: string
    complianceRef?: string
}

export interface DomainRules {
    id: string
    name: string
    complianceFrame: string
    rules: DomainRuleEntry[]
}

export const healthcareDomainRules: DomainRules = {
    id: 'healthcare',
    name: 'Healthcare UI Governance',
    complianceFrame: 'WCAG 2.1 AA (minimum) + HIPAA UI patterns + FDA SaMD visual standards',
    rules: [
        // Forbidden — PHI exposure
        {
            id: 'HC-F-001',
            category: 'forbidden',
            description:
                'Never render raw SSN, MRN, or insurance ID values in plain text. ' +
                'Any display must use a masking component with an explicit unmask interaction.',
            complianceRef: 'HIPAA § 164.514',
        },
        {
            id: 'HC-F-002',
            category: 'forbidden',
            description:
                'Never display patient date of birth as a sortable table column without explicit ' +
                'access control UI indicating the field is restricted.',
            complianceRef: 'HIPAA § 164.514',
        },
        {
            id: 'HC-F-003',
            category: 'forbidden',
            description:
                'Never use color as the sole differentiator for clinical status values. ' +
                'All clinical status indicators must also include a text label or icon with aria-label.',
            complianceRef: 'WCAG 2.1 SC 1.4.1',
        },
        {
            id: 'HC-F-004',
            category: 'forbidden',
            description:
                'Never render patient lists with full name visible in a component that lacks ' +
                'an access control wrapper (data-flint-access-level attribute or equivalent).',
            complianceRef: 'HIPAA § 164.514',
        },
        {
            id: 'HC-F-005',
            category: 'forbidden',
            description:
                'Never display dosage or medication fields inline in a summary card without ' +
                'a "sensitive data" visual treatment (lock icon + truncation by default).',
            complianceRef: 'HIPAA § 164.514',
        },
        {
            id: 'HC-F-006',
            category: 'forbidden',
            description:
                'Never use placeholder text as the only label for PHI input fields. ' +
                'A permanent visible label is required.',
            complianceRef: 'WCAG 2.1 SC 3.3.2',
        },
        {
            id: 'HC-F-007',
            category: 'forbidden',
            description:
                'Never implement autocomplete="on" for fields collecting SSN, MRN, ' +
                'diagnosis codes, or medication names.',
            complianceRef: 'HIPAA Technical Safeguards',
        },
        // Forbidden — Accessibility (AAA threshold for clinical)
        {
            id: 'HC-F-008',
            category: 'forbidden',
            description:
                'Never approve a contrast ratio below 7:1 for any text displaying clinical values.',
            complianceRef: 'WCAG 2.1 SC 1.4.6 (AAA)',
        },
        {
            id: 'HC-F-009',
            category: 'forbidden',
            description:
                'Never approve alert dialogs for critical clinical notifications that lack ' +
                'role="alertdialog" and aria-live="assertive".',
            complianceRef: 'WCAG 2.1 SC 4.1.3',
        },
        {
            id: 'HC-F-010',
            category: 'forbidden',
            description:
                'Never approve a loading state for clinical data that does not include ' +
                'aria-busy="true" and a visible spinner with aria-label.',
            complianceRef: 'WCAG 2.1 SC 4.1.3',
        },
        // Required
        {
            id: 'HC-R-001',
            category: 'required',
            description:
                'All PHI display fields must have a data-phi="true" attribute so Flint ' +
                'can track PHI surface area.',
            complianceRef: 'HIPAA § 164.514',
        },
        {
            id: 'HC-R-002',
            category: 'required',
            description:
                'All clinical status badges must include both a color token AND an icon or text ' +
                'with an aria-label that explicitly states the status.',
            complianceRef: 'WCAG 2.1 SC 1.4.1',
        },
        {
            id: 'HC-R-003',
            category: 'required',
            description:
                'All form fields collecting PHI must include autocomplete="off" or a HIPAA-safe ' +
                'autocomplete token.',
            complianceRef: 'HIPAA Technical Safeguards',
        },
        // Halt criteria
        {
            id: 'HC-H-001',
            category: 'halt',
            description:
                'HALT if any component renders a PHI field without masking and without ' +
                'a data-phi="true" attribute.',
            complianceRef: 'HIPAA § 164.514',
        },
        {
            id: 'HC-H-002',
            category: 'halt',
            description:
                'HALT if a clinical status indicator uses color alone (no text/icon fallback).',
            complianceRef: 'WCAG 2.1 SC 1.4.1',
        },
        {
            id: 'HC-H-003',
            category: 'halt',
            description: 'HALT if a form collecting PHI omits autocomplete="off".',
            complianceRef: 'HIPAA Technical Safeguards',
        },
        {
            id: 'HC-H-004',
            category: 'halt',
            description: 'HALT if contrast ratio for clinical text is below 7:1.',
            complianceRef: 'WCAG 2.1 SC 1.4.6 (AAA)',
        },
    ],
}
