/**
 * flint-vscode/src/__tests__/diagnosticsProvider.test.ts
 *
 * Unit tests for the pure transformation functions in diagnosticsProvider.ts.
 * These functions do not depend on the VS Code API and can be tested directly.
 */

import { describe, it, expect } from 'vitest';
import {
    mapSeverity,
    extractDeltaE,
    extractSuggestedToken,
    buildDiagnosticMessage,
    parseAuditResponse,
} from '../diagnosticsProvider';
import type { FlintViolation, AuditResponse } from '../diagnosticsProvider';
import type { MCPCallResult } from '../flintClient';

// -- mapSeverity ------------------------------------------------------------

describe('mapSeverity', () => {
    it('maps a11y critical violations to Error (0)', () => {
        const violation: FlintViolation = {
            id: 'node:5:0',
            ruleId: 'A11Y-001',
            severity: 'critical',
            message: 'A11Y-001 Missing alt text',
            type: 'a11y',
        };
        expect(mapSeverity(violation)).toBe(0);
    });

    it('maps Mithril amber violations to Warning (1)', () => {
        const violation: FlintViolation = {
            id: 'div:3:0',
            ruleId: 'MITHRIL-COLOR',
            severity: 'amber',
            message: 'Color drift detected (Delta-E: 12.34)',
            type: 'color-drift',
        };
        expect(mapSeverity(violation)).toBe(1);
    });

    it('maps Mithril critical violations to Warning (1)', () => {
        const violation: FlintViolation = {
            id: 'div:3:0',
            ruleId: 'MITHRIL-COLOR',
            severity: 'critical',
            message: 'Color drift critical',
            type: 'color-drift',
        };
        expect(mapSeverity(violation)).toBe(1);
    });

    it('maps a11y warning violations to Warning (1)', () => {
        const violation: FlintViolation = {
            id: 'span:10:0',
            ruleId: 'A11Y-005',
            severity: 'warning',
            message: 'Low contrast ratio',
            type: 'a11y',
        };
        expect(mapSeverity(violation)).toBe(1);
    });

    it('maps unknown severity to Warning (1)', () => {
        const violation: FlintViolation = {
            id: 'p:1:0',
            ruleId: 'UNKNOWN',
            severity: 'info',
            message: 'Some info',
            type: 'other',
        };
        expect(mapSeverity(violation)).toBe(1);
    });
});

// -- extractDeltaE ----------------------------------------------------------

describe('extractDeltaE', () => {
    it('extracts Delta-E from "(Delta-E: 12.34)" pattern', () => {
        expect(extractDeltaE('Color drift detected (Delta-E: 12.34)')).toBe(12.34);
    });

    it('extracts Delta-E from "ΔE: 5.67" pattern', () => {
        expect(extractDeltaE('Hardcoded color #FF0000, ΔE: 5.67 from nearest token')).toBe(5.67);
    });

    it('extracts Delta-E from "ΔE = 3.21" pattern', () => {
        expect(extractDeltaE('ΔE = 3.21')).toBe(3.21);
    });

    it('extracts Delta-E from "deltaE 8.9" pattern', () => {
        expect(extractDeltaE('Color #abc, deltaE 8.9 from token/primary')).toBe(8.9);
    });

    it('returns null when no Delta-E is present', () => {
        expect(extractDeltaE('Missing alt text on img element')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractDeltaE('')).toBeNull();
    });

    it('handles decimal-only Delta-E values', () => {
        expect(extractDeltaE('Delta-E: 0.5')).toBe(0.5);
    });

    it('handles integer Delta-E values', () => {
        expect(extractDeltaE('Delta-E: 15')).toBe(15);
    });
});

// -- extractSuggestedToken --------------------------------------------------

describe('extractSuggestedToken', () => {
    it('extracts from "nearest token: color/primary/500"', () => {
        expect(
            extractSuggestedToken(
                'Color drift, nearest token: color/primary/500',
            ),
        ).toBe('color/primary/500');
    });

    it('extracts from "suggested: --color-primary"', () => {
        expect(
            extractSuggestedToken('Fix available. suggested: --color-primary'),
        ).toBe('--color-primary');
    });

    it('extracts from "replace with `token/name`"', () => {
        expect(
            extractSuggestedToken('Replace with `token/spacing/md`'),
        ).toBe('token/spacing/md');
    });

    it('returns null when no suggestion present', () => {
        expect(extractSuggestedToken('Missing alt text')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractSuggestedToken('')).toBeNull();
    });
});

// -- buildDiagnosticMessage -------------------------------------------------

describe('buildDiagnosticMessage', () => {
    it('includes rule ID prefix', () => {
        const violation: FlintViolation = {
            id: 'div:1:0',
            ruleId: 'MITHRIL-COLOR',
            severity: 'amber',
            message: 'Hardcoded color #FF0000',
            type: 'color-drift',
        };
        const msg = buildDiagnosticMessage(violation);
        expect(msg).toContain('[MITHRIL-COLOR]');
    });

    it('includes the original message', () => {
        const violation: FlintViolation = {
            id: 'div:1:0',
            ruleId: 'MITHRIL-COLOR',
            severity: 'amber',
            message: 'Hardcoded color #FF0000',
            type: 'color-drift',
        };
        const msg = buildDiagnosticMessage(violation);
        expect(msg).toContain('Hardcoded color #FF0000');
    });

    it('includes Delta-E score when present in message', () => {
        const violation: FlintViolation = {
            id: 'div:1:0',
            ruleId: 'MITHRIL-COLOR',
            severity: 'amber',
            message: 'Color drift (Delta-E: 7.89)',
            type: 'color-drift',
        };
        const msg = buildDiagnosticMessage(violation);
        expect(msg).toContain('(Delta-E: 7.89)');
    });

    it('includes suggested token when present in message', () => {
        const violation: FlintViolation = {
            id: 'div:1:0',
            ruleId: 'MITHRIL-COLOR',
            severity: 'amber',
            message: 'Color drift, nearest token: color/blue/500',
            type: 'color-drift',
        };
        const msg = buildDiagnosticMessage(violation);
        expect(msg).toContain('Suggested: color/blue/500');
    });

    it('includes provenance authority when present', () => {
        const violation: FlintViolation = {
            id: 'img:2:0',
            ruleId: 'A11Y-001',
            severity: 'critical',
            message: 'Missing alt text',
            type: 'a11y',
            provenance: {
                sourceAuthority: 'WCAG 2.1 AA',
                regulatoryReference: 'SC 1.1.1',
                rationale: 'Images must have alternative text',
            },
        };
        const msg = buildDiagnosticMessage(violation);
        expect(msg).toContain('Authority: WCAG 2.1 AA');
    });

    it('omits Delta-E, token, and provenance when not present', () => {
        const violation: FlintViolation = {
            id: 'div:1:0',
            ruleId: 'A11Y-003',
            severity: 'critical',
            message: 'Button has no accessible name',
            type: 'a11y',
        };
        const msg = buildDiagnosticMessage(violation);
        expect(msg).toBe('[A11Y-003] Button has no accessible name');
    });
});

// -- parseAuditResponse -----------------------------------------------------

describe('parseAuditResponse', () => {
    it('parses a valid audit response', () => {
        const auditData: AuditResponse = {
            violations: [
                {
                    id: 'div:1:0',
                    ruleId: 'MITHRIL-COLOR',
                    severity: 'amber',
                    message: 'Color drift',
                    type: 'color-drift',
                },
            ],
            mithrilCount: 1,
            a11yCount: 0,
            summary: 'Found 1 violation(s).',
        };

        const result: MCPCallResult = {
            content: [{ type: 'text', text: JSON.stringify(auditData) }],
        };

        const parsed = parseAuditResponse(result);
        expect(parsed).not.toBeNull();
        expect(parsed!.violations).toHaveLength(1);
        expect(parsed!.violations[0]!.ruleId).toBe('MITHRIL-COLOR');
        expect(parsed!.mithrilCount).toBe(1);
        expect(parsed!.a11yCount).toBe(0);
    });

    it('returns null for error results', () => {
        const result: MCPCallResult = {
            content: [{ type: 'text', text: '{}' }],
            isError: true,
        };
        expect(parseAuditResponse(result)).toBeNull();
    });

    it('returns null when content has no text', () => {
        const result: MCPCallResult = {
            content: [{ type: 'image' }],
        };
        expect(parseAuditResponse(result)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
        const result: MCPCallResult = {
            content: [{ type: 'text', text: 'not json' }],
        };
        expect(parseAuditResponse(result)).toBeNull();
    });

    it('returns null when violations is not an array', () => {
        const result: MCPCallResult = {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ violations: 'not-array' }),
                },
            ],
        };
        expect(parseAuditResponse(result)).toBeNull();
    });

    it('returns null for empty content array', () => {
        const result: MCPCallResult = {
            content: [],
        };
        expect(parseAuditResponse(result)).toBeNull();
    });

    it('parses response with zero violations', () => {
        const auditData: AuditResponse = {
            violations: [],
            mithrilCount: 0,
            a11yCount: 0,
            summary: 'No violations found.',
        };

        const result: MCPCallResult = {
            content: [{ type: 'text', text: JSON.stringify(auditData) }],
        };

        const parsed = parseAuditResponse(result);
        expect(parsed).not.toBeNull();
        expect(parsed!.violations).toHaveLength(0);
    });

    it('parses response with multiple violation types', () => {
        const auditData: AuditResponse = {
            violations: [
                {
                    id: 'div:1:0',
                    ruleId: 'MITHRIL-COLOR',
                    severity: 'amber',
                    message: 'Color drift (Delta-E: 5.5)',
                    type: 'color-drift',
                },
                {
                    id: 'img:3:0',
                    ruleId: 'A11Y-001',
                    severity: 'critical',
                    message: 'Missing alt text',
                    type: 'a11y',
                },
                {
                    id: 'p:7:0',
                    ruleId: 'MITHRIL-TYPOGRAPHY',
                    severity: 'amber',
                    message: 'Typography drift, nearest token: font/body',
                    type: 'typography-drift',
                },
            ],
            mithrilCount: 2,
            a11yCount: 1,
            summary: 'Found 3 violation(s).',
        };

        const result: MCPCallResult = {
            content: [{ type: 'text', text: JSON.stringify(auditData) }],
        };

        const parsed = parseAuditResponse(result);
        expect(parsed).not.toBeNull();
        expect(parsed!.violations).toHaveLength(3);
        expect(parsed!.mithrilCount).toBe(2);
        expect(parsed!.a11yCount).toBe(1);
    });

    it('handles content with extra fields gracefully', () => {
        const result: MCPCallResult = {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        violations: [],
                        mithrilCount: 0,
                        a11yCount: 0,
                        summary: 'Clean.',
                        project_context: { healthScore: 95 },
                        healOnAudit: { skipped: true },
                    }),
                },
            ],
        };

        const parsed = parseAuditResponse(result);
        expect(parsed).not.toBeNull();
        expect(parsed!.violations).toHaveLength(0);
    });
});
