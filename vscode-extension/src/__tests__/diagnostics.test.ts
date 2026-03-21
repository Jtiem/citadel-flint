/**
 * Unit tests for pure transformation functions in diagnostics.ts.
 */

import { describe, it, expect } from 'vitest';
import {
    mapSeverity,
    extractDeltaE,
    extractSuggestedToken,
    buildDiagnosticMessage,
    parseAuditResponse,
} from '../diagnostics';
import type { FlintViolation, AuditResponse } from '../diagnostics';
import type { MCPCallResult } from '../flintClient';

// -- mapSeverity ------------------------------------------------------------

describe('mapSeverity', () => {
    it('maps a11y critical to Error (0)', () => {
        const v: FlintViolation = {
            id: 'node:5:0', ruleId: 'A11Y-001', severity: 'critical',
            message: 'Missing alt text', type: 'a11y',
        };
        expect(mapSeverity(v)).toBe(0);
    });

    it('maps Mithril amber to Warning (1)', () => {
        const v: FlintViolation = {
            id: 'div:3:0', ruleId: 'MITHRIL-COLOR', severity: 'amber',
            message: 'Color drift', type: 'color-drift',
        };
        expect(mapSeverity(v)).toBe(1);
    });

    it('maps advisory to Information (2)', () => {
        const v: FlintViolation = {
            id: 'p:1:0', ruleId: 'INFO-001', severity: 'advisory',
            message: 'Informational', type: 'other',
        };
        expect(mapSeverity(v)).toBe(2);
    });

    it('maps info severity to Information (2)', () => {
        const v: FlintViolation = {
            id: 'p:1:0', ruleId: 'INFO-002', severity: 'info',
            message: 'Some info', type: 'other',
        };
        expect(mapSeverity(v)).toBe(2);
    });

    it('maps a11y warning to Warning (1)', () => {
        const v: FlintViolation = {
            id: 'span:10:0', ruleId: 'A11Y-005', severity: 'warning',
            message: 'Low contrast', type: 'a11y',
        };
        expect(mapSeverity(v)).toBe(1);
    });

    it('maps Mithril critical to Warning (1) — not Error', () => {
        const v: FlintViolation = {
            id: 'div:3:0', ruleId: 'MITHRIL-COLOR', severity: 'critical',
            message: 'Critical drift', type: 'color-drift',
        };
        expect(mapSeverity(v)).toBe(1);
    });
});

// -- extractDeltaE ----------------------------------------------------------

describe('extractDeltaE', () => {
    it('extracts from "(Delta-E: 12.34)"', () => {
        expect(extractDeltaE('Color drift (Delta-E: 12.34)')).toBe(12.34);
    });

    it('extracts from "ΔE: 5.67"', () => {
        expect(extractDeltaE('Hardcoded #FF0000, ΔE: 5.67')).toBe(5.67);
    });

    it('extracts from "ΔE = 3.21"', () => {
        expect(extractDeltaE('ΔE = 3.21')).toBe(3.21);
    });

    it('extracts from "deltaE 8.9"', () => {
        expect(extractDeltaE('Color #abc, deltaE 8.9')).toBe(8.9);
    });

    it('returns null when absent', () => {
        expect(extractDeltaE('Missing alt text')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractDeltaE('')).toBeNull();
    });

    it('handles integer values', () => {
        expect(extractDeltaE('Delta-E: 15')).toBe(15);
    });

    it('handles small decimal values', () => {
        expect(extractDeltaE('Delta-E: 0.5')).toBe(0.5);
    });
});

// -- extractSuggestedToken --------------------------------------------------

describe('extractSuggestedToken', () => {
    it('extracts from "nearest token: color/primary/500"', () => {
        expect(extractSuggestedToken('nearest token: color/primary/500')).toBe('color/primary/500');
    });

    it('extracts from "suggested: --color-primary"', () => {
        expect(extractSuggestedToken('suggested: --color-primary')).toBe('--color-primary');
    });

    it('extracts from "replace with `token/spacing/md`"', () => {
        expect(extractSuggestedToken('Replace with `token/spacing/md`')).toBe('token/spacing/md');
    });

    it('returns null when no suggestion', () => {
        expect(extractSuggestedToken('Missing alt text')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractSuggestedToken('')).toBeNull();
    });
});

// -- buildDiagnosticMessage -------------------------------------------------

describe('buildDiagnosticMessage', () => {
    it('includes rule ID prefix', () => {
        const v: FlintViolation = {
            id: 'div:1:0', ruleId: 'MITHRIL-COLOR', severity: 'amber',
            message: 'Hardcoded color #FF0000', type: 'color-drift',
        };
        expect(buildDiagnosticMessage(v)).toContain('[MITHRIL-COLOR]');
    });

    it('includes Delta-E when present', () => {
        const v: FlintViolation = {
            id: 'div:1:0', ruleId: 'MITHRIL-COLOR', severity: 'amber',
            message: 'Color drift (Delta-E: 7.89)', type: 'color-drift',
        };
        expect(buildDiagnosticMessage(v)).toContain('(Delta-E: 7.89)');
    });

    it('includes suggested token when present', () => {
        const v: FlintViolation = {
            id: 'div:1:0', ruleId: 'MITHRIL-COLOR', severity: 'amber',
            message: 'nearest token: color/blue/500', type: 'color-drift',
        };
        expect(buildDiagnosticMessage(v)).toContain('Suggested: color/blue/500');
    });

    it('includes provenance authority', () => {
        const v: FlintViolation = {
            id: 'img:2:0', ruleId: 'A11Y-001', severity: 'critical',
            message: 'Missing alt text', type: 'a11y',
            provenance: { sourceAuthority: 'WCAG 2.1 AA' },
        };
        expect(buildDiagnosticMessage(v)).toContain('Authority: WCAG 2.1 AA');
    });

    it('plain message when no extras', () => {
        const v: FlintViolation = {
            id: 'div:1:0', ruleId: 'A11Y-003', severity: 'critical',
            message: 'Button has no accessible name', type: 'a11y',
        };
        expect(buildDiagnosticMessage(v)).toBe('[A11Y-003] Button has no accessible name');
    });
});

// -- parseAuditResponse -----------------------------------------------------

describe('parseAuditResponse', () => {
    it('parses valid response', () => {
        const data: AuditResponse = {
            violations: [{ id: 'div:1:0', ruleId: 'MITHRIL-COLOR', severity: 'amber', message: 'drift', type: 'color-drift' }],
            mithrilCount: 1, a11yCount: 0, summary: '1 violation.',
        };
        const result: MCPCallResult = { content: [{ type: 'text', text: JSON.stringify(data) }] };
        const parsed = parseAuditResponse(result);
        expect(parsed).not.toBeNull();
        expect(parsed!.violations).toHaveLength(1);
    });

    it('returns null for error results', () => {
        expect(parseAuditResponse({ content: [{ type: 'text', text: '{}' }], isError: true })).toBeNull();
    });

    it('returns null for no text content', () => {
        expect(parseAuditResponse({ content: [{ type: 'image' }] })).toBeNull();
    });

    it('returns null for invalid JSON', () => {
        expect(parseAuditResponse({ content: [{ type: 'text', text: 'bad' }] })).toBeNull();
    });

    it('returns null when violations not array', () => {
        expect(parseAuditResponse({ content: [{ type: 'text', text: '{"violations":"no"}' }] })).toBeNull();
    });

    it('returns null for empty content', () => {
        expect(parseAuditResponse({ content: [] })).toBeNull();
    });

    it('parses zero violations', () => {
        const data: AuditResponse = { violations: [], mithrilCount: 0, a11yCount: 0, summary: 'Clean.' };
        const parsed = parseAuditResponse({ content: [{ type: 'text', text: JSON.stringify(data) }] });
        expect(parsed!.violations).toHaveLength(0);
    });

    it('parses multiple violation types', () => {
        const data: AuditResponse = {
            violations: [
                { id: 'div:1:0', ruleId: 'MITHRIL-COLOR', severity: 'amber', message: 'drift', type: 'color-drift' },
                { id: 'img:3:0', ruleId: 'A11Y-001', severity: 'critical', message: 'alt', type: 'a11y' },
            ],
            mithrilCount: 1, a11yCount: 1, summary: '2 violations.',
        };
        const parsed = parseAuditResponse({ content: [{ type: 'text', text: JSON.stringify(data) }] });
        expect(parsed!.violations).toHaveLength(2);
        expect(parsed!.mithrilCount).toBe(1);
        expect(parsed!.a11yCount).toBe(1);
    });
});
