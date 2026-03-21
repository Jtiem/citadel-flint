/**
 * Unit tests for code action logic.
 * Tests the pure helper functions; the VS Code API-dependent provider
 * is tested via integration in the extension host.
 */

import { describe, it, expect } from 'vitest';
import { extractSuggestedToken } from '../diagnostics';
import { isFixableViolation } from '../codeActions';

describe('code action title logic', () => {
    it('extracts token name for action title from Mithril message', () => {
        const token = extractSuggestedToken(
            'Color drift, nearest token: color/primary/500',
        );
        expect(token).toBe('color/primary/500');
    });

    it('falls back to null when no token in message', () => {
        const token = extractSuggestedToken('Generic violation message');
        expect(token).toBeNull();
    });

    it('extracts token from "suggested:" pattern', () => {
        const token = extractSuggestedToken('suggested: --spacing-lg');
        expect(token).toBe('--spacing-lg');
    });

    it('extracts token from "replace with" pattern', () => {
        const token = extractSuggestedToken('Replace with font/body/regular');
        expect(token).toBe('font/body/regular');
    });
});

describe('isFixableViolation', () => {
    it('returns true for Mithril color-drift violations', () => {
        expect(isFixableViolation({ type: 'color-drift', ruleId: 'mithril/color' })).toBe(true);
    });

    it('returns true for typography violations', () => {
        expect(isFixableViolation({ type: 'typography', ruleId: 'mithril/font' })).toBe(true);
    });

    it('returns true for spacing violations', () => {
        expect(isFixableViolation({ type: 'spacing', ruleId: 'mithril/spacing' })).toBe(true);
    });

    it('returns false for a11y violations', () => {
        expect(isFixableViolation({ type: 'a11y', ruleId: 'a11y/alt-text' })).toBe(false);
    });

    it('returns true for shadow violations', () => {
        expect(isFixableViolation({ type: 'shadow', ruleId: 'mithril/shadow' })).toBe(true);
    });

    it('returns true for opacity violations', () => {
        expect(isFixableViolation({ type: 'opacity', ruleId: 'mithril/opacity' })).toBe(true);
    });
});
