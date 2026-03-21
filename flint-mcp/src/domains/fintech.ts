/**
 * fintech.ts — PCI-DSS + SOX financial services domain rules module
 *
 * Exported as a DomainRules object referenced by the sentinel prompt
 * and the domain registry. These are prompt-layer constraints, not
 * runtime linter rules — they inform the AI agent's governance persona.
 */

import type { DomainRules } from './healthcare.js'

export const fintechDomainRules: DomainRules = {
    id: 'fintech',
    name: 'Financial Services UI Governance',
    complianceFrame: 'WCAG 2.1 AA + PCI-DSS UI surface rules + Financial data display standards',
    rules: [
        // Forbidden — Payment data exposure
        {
            id: 'FT-F-001',
            category: 'forbidden',
            description:
                'Never render a full PAN (card number) in plain text. Display must be masked ' +
                'to show only the last 4 digits. The masking must be in the component JSX, ' +
                'not applied via CSS.',
            complianceRef: 'PCI-DSS Requirement 3.4',
        },
        {
            id: 'FT-F-002',
            category: 'forbidden',
            description:
                'Never render CVV/CVC values in any display context — these must never ' +
                'appear in any UI state.',
            complianceRef: 'PCI-DSS Requirement 3.2',
        },
        {
            id: 'FT-F-003',
            category: 'forbidden',
            description:
                'Never render full card expiration dates in a transaction history list. ' +
                'Show month/year only when required and mask to "**/**" in summary views.',
            complianceRef: 'PCI-DSS Requirement 3.4',
        },
        {
            id: 'FT-F-004',
            category: 'forbidden',
            description:
                'Never implement a "copy to clipboard" action for full PAN values in the UI layer.',
            complianceRef: 'PCI-DSS Requirement 3.4',
        },
        {
            id: 'FT-F-005',
            category: 'forbidden',
            description:
                'Never store or display cardholder name combined with full PAN in the same ' +
                'visible component.',
            complianceRef: 'PCI-DSS Requirement 3.4',
        },
        // Forbidden — Financial data accuracy
        {
            id: 'FT-F-006',
            category: 'forbidden',
            description:
                'Never display a monetary value as a raw number without a currency formatter. ' +
                'All financial values must include currency symbol, thousands separator, ' +
                'and minimum 2 decimal places.',
            complianceRef: 'Financial Data Display Standards',
        },
        {
            id: 'FT-F-007',
            category: 'forbidden',
            description:
                'Never use floating-point arithmetic results directly in financial display. ' +
                'Values must come from a formatted/rounded server value or currency utility.',
            complianceRef: 'Financial Data Display Standards',
        },
        {
            id: 'FT-F-008',
            category: 'forbidden',
            description:
                'Never display percentage values (rates, fees, APR) without a "%" symbol ' +
                'and a visible label identifying what the percentage represents.',
            complianceRef: 'Financial Data Display Standards',
        },
        {
            id: 'FT-F-009',
            category: 'forbidden',
            description:
                'Never display a negative balance or overdue value without a visually distinct ' +
                'treatment (color token for negative + text label for screen readers).',
            complianceRef: 'WCAG 2.1 SC 1.4.1',
        },
        // Required
        {
            id: 'FT-R-001',
            category: 'required',
            description:
                'All monetary values must use a currency formatting pattern: symbol + value ' +
                'with 2 decimal places minimum.',
            complianceRef: 'Financial Data Display Standards',
        },
        {
            id: 'FT-R-002',
            category: 'required',
            description:
                'All PAN display must be masked (last 4 digits only) with ' +
                'aria-label="Card ending in [last 4]".',
            complianceRef: 'PCI-DSS Requirement 3.4',
        },
        {
            id: 'FT-R-003',
            category: 'required',
            description:
                'All transaction status values (pending, settled, declined, reversed) must use ' +
                'the design token color set AND include text that is not dependent on color alone.',
            complianceRef: 'WCAG 2.1 SC 1.4.1',
        },
        {
            id: 'FT-R-004',
            category: 'required',
            description:
                'All financial forms must include visible confirmation steps before submitting ' +
                'irreversible transactions (WCAG 3.3.4 Error Prevention — treat as required).',
            complianceRef: 'WCAG 2.1 SC 3.3.4',
        },
        // Halt criteria
        {
            id: 'FT-H-001',
            category: 'halt',
            description: 'HALT if any PAN value renders without masking.',
            complianceRef: 'PCI-DSS Requirement 3.4',
        },
        {
            id: 'FT-H-002',
            category: 'halt',
            description: 'HALT if any monetary value renders without a currency formatter (raw number only).',
            complianceRef: 'Financial Data Display Standards',
        },
        {
            id: 'FT-H-003',
            category: 'halt',
            description: 'HALT if CVV/CVC appears in any display state.',
            complianceRef: 'PCI-DSS Requirement 3.2',
        },
        {
            id: 'FT-H-004',
            category: 'halt',
            description:
                'HALT if ΔE > 1.0 on any color token in a financial component ' +
                '(fintech Mithril threshold is stricter than the base 2.0).',
            complianceRef: 'Flint Mithril — Fintech Override',
        },
    ],
}
