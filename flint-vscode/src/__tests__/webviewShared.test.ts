/**
 * flint-vscode/src/__tests__/webviewShared.test.ts
 *
 * Unit tests for shared webview utilities (getBaseStyles, getNonce).
 */

import { describe, it, expect } from 'vitest';
import { getBaseStyles, getNonce } from '../webview/shared';

describe('getBaseStyles', () => {
    it('returns a non-empty CSS string', () => {
        const css = getBaseStyles();
        expect(typeof css).toBe('string');
        expect(css.length).toBeGreaterThan(0);
    });

    it('uses VS Code CSS variables for theming', () => {
        const css = getBaseStyles();
        expect(css).toContain('var(--vscode-font-family)');
        expect(css).toContain('var(--vscode-foreground)');
        expect(css).toContain('var(--vscode-sideBar-background)');
        expect(css).toContain('var(--vscode-editor-background)');
        expect(css).toContain('var(--vscode-button-background)');
    });

    it('includes badge color classes', () => {
        const css = getBaseStyles();
        expect(css).toContain('.badge-green');
        expect(css).toContain('.badge-amber');
        expect(css).toContain('.badge-red');
    });

    it('includes violation-item and severity classes', () => {
        const css = getBaseStyles();
        expect(css).toContain('.violation-item');
        expect(css).toContain('.violation-item.critical');
        expect(css).toContain('.violation-item.warning');
    });

    it('includes health-score and health-grade classes', () => {
        const css = getBaseStyles();
        expect(css).toContain('.health-score');
        expect(css).toContain('.health-grade');
        expect(css).toContain('.health-label');
    });

    it('includes stat-row and stat-value classes', () => {
        const css = getBaseStyles();
        expect(css).toContain('.stat-row');
        expect(css).toContain('.stat-value');
    });

    it('includes button classes', () => {
        const css = getBaseStyles();
        expect(css).toContain('.btn');
        expect(css).toContain('.btn-secondary');
        expect(css).toContain('.btn:hover');
    });
});

describe('getNonce', () => {
    it('returns a 32-character string', () => {
        const nonce = getNonce();
        expect(nonce).toHaveLength(32);
    });

    it('contains only alphanumeric characters', () => {
        const nonce = getNonce();
        expect(nonce).toMatch(/^[A-Za-z0-9]{32}$/);
    });

    it('generates unique values across calls', () => {
        const nonces = new Set<string>();
        for (let i = 0; i < 100; i++) {
            nonces.add(getNonce());
        }
        // With 62^32 possible values, 100 calls should never collide
        expect(nonces.size).toBe(100);
    });

    it('is non-empty', () => {
        const nonce = getNonce();
        expect(nonce.length).toBeGreaterThan(0);
    });
});
