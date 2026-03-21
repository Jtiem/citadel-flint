/**
 * ecommerce.ts — E-commerce / GDPR + product accessibility domain rules module
 *
 * Exported as a DomainRules object referenced by the sentinel prompt
 * and the domain registry. These are prompt-layer constraints, not
 * runtime linter rules — they inform the AI agent's governance persona.
 */

import type { DomainRules } from './healthcare.js'

export const ecommerceDomainRules: DomainRules = {
    id: 'e-commerce',
    name: 'E-Commerce UI Governance',
    complianceFrame:
        'WCAG 2.1 AAA (elevated from AA) + international accessibility requirements + ' +
        'product accessibility patterns',
    rules: [
        // Forbidden
        {
            id: 'EC-F-001',
            category: 'forbidden',
            description:
                'Never display a price without a currency symbol AND currency code in contexts ' +
                'where the currency may be ambiguous (e.g., "$12.00 USD" not just "$12.00").',
            complianceRef: 'International accessibility + consumer protection standards',
        },
        {
            id: 'EC-F-002',
            category: 'forbidden',
            description:
                'Never implement an "Add to Cart" or "Buy Now" action that cannot be triggered ' +
                'by keyboard alone.',
            complianceRef: 'WCAG 2.1 SC 2.1.1',
        },
        {
            id: 'EC-F-003',
            category: 'forbidden',
            description:
                'Never use a drag-and-drop interaction without a keyboard-accessible equivalent ' +
                '(e.g., number input, move up/down buttons).',
            complianceRef: 'WCAG 2.1 SC 2.1.1',
        },
        {
            id: 'EC-F-004',
            category: 'forbidden',
            description:
                'Never render a product image without alt text that includes the product name ' +
                'and a brief visual description. Alt text must not be the filename or a generic ' +
                'string like "product image".',
            complianceRef: 'WCAG 2.1 SC 1.1.1',
        },
        {
            id: 'EC-F-005',
            category: 'forbidden',
            description:
                'Never implement a countdown timer or urgency indicator without an aria-live ' +
                'region that announces changes at a reasonable interval (no faster than every ' +
                '60 seconds).',
            complianceRef: 'WCAG 2.2.3 No Timing',
        },
        {
            id: 'EC-F-006',
            category: 'forbidden',
            description:
                'Never use a carousel without: (a) pause/stop controls, (b) keyboard navigation, ' +
                '(c) aria-roledescription="carousel" and aria-label on the container, ' +
                '(d) aria-label on each slide.',
            complianceRef: 'WCAG 2.1 SC 2.2.2',
        },
        {
            id: 'EC-F-007',
            category: 'forbidden',
            description:
                'Never render a star rating display using Unicode characters or emoji stars. ' +
                'Use a component with role="img" and aria-label="[N] out of 5 stars".',
            complianceRef: 'WCAG 2.1 SC 1.1.1',
        },
        {
            id: 'EC-F-008',
            category: 'forbidden',
            description:
                'Never display form error messages inline only in red text without an ' +
                'accompanying icon and aria-describedby linking the error to the input.',
            complianceRef: 'WCAG 2.1 SC 3.3.1 (AAA treatment)',
        },
        // Required
        {
            id: 'EC-R-001',
            category: 'required',
            description:
                'All prices must include currency symbol and, for international contexts, ' +
                'currency code.',
            complianceRef: 'International accessibility + consumer protection standards',
        },
        {
            id: 'EC-R-002',
            category: 'required',
            description:
                'All product images must have descriptive alt text (product name + visual description).',
            complianceRef: 'WCAG 2.1 SC 1.1.1',
        },
        {
            id: 'EC-R-003',
            category: 'required',
            description:
                'All interactive e-commerce actions (add to cart, checkout, apply coupon) must ' +
                'be keyboard-accessible.',
            complianceRef: 'WCAG 2.1 SC 2.1.1',
        },
        {
            id: 'EC-R-004',
            category: 'required',
            description: 'All carousels must have pause controls and keyboard navigation.',
            complianceRef: 'WCAG 2.1 SC 2.2.2',
        },
        {
            id: 'EC-R-005',
            category: 'required',
            description:
                'All star ratings must use role="img" with an aria-label stating the numeric rating.',
            complianceRef: 'WCAG 2.1 SC 1.1.1',
        },
        {
            id: 'EC-R-006',
            category: 'required',
            description: 'All urgency/scarcity messages must use aria-live="polite".',
            complianceRef: 'WCAG 2.2.3 No Timing',
        },
        {
            id: 'EC-R-007',
            category: 'required',
            description: 'Contrast ratio for all body text: minimum 7:1 (WCAG AAA 1.4.6).',
            complianceRef: 'WCAG 2.1 SC 1.4.6 (AAA)',
        },
        {
            id: 'EC-R-008',
            category: 'required',
            description:
                'All form error states must link error messages to inputs via aria-describedby.',
            complianceRef: 'WCAG 2.1 SC 3.3.1',
        },
        // Halt criteria
        {
            id: 'EC-H-001',
            category: 'halt',
            description: 'HALT if a product image lacks descriptive alt text.',
            complianceRef: 'WCAG 2.1 SC 1.1.1',
        },
        {
            id: 'EC-H-002',
            category: 'halt',
            description: 'HALT if a purchase action is not keyboard-accessible.',
            complianceRef: 'WCAG 2.1 SC 2.1.1',
        },
        {
            id: 'EC-H-003',
            category: 'halt',
            description: 'HALT if a carousel lacks pause controls.',
            complianceRef: 'WCAG 2.1 SC 2.2.2',
        },
        {
            id: 'EC-H-004',
            category: 'halt',
            description: 'HALT if contrast ratio for body text is below 7:1.',
            complianceRef: 'WCAG 2.1 SC 1.4.6 (AAA)',
        },
    ],
}
