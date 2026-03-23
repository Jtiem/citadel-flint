/**
 * flint-vscode/src/__tests__/governancePanel.test.ts
 *
 * Unit tests for GovernancePanelProvider.
 *
 * Tests cover:
 *   - Provider instantiation
 *   - HTML structure (expected elements, CSP nonce)
 *   - resolveWebviewView wiring
 *   - Message handling (audit, fix, debtReport)
 *   - updateForFile pushes messages to the webview
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GovernancePanelProvider } from '../webview/governancePanel';

// -- Helpers ----------------------------------------------------------------

/** Builds a minimal mock of vscode.Uri */
function mockUri(fsPath: string) {
    return { fsPath, toString: () => fsPath } as unknown as import('vscode').Uri;
}

/** Builds a minimal mock of vscode.WebviewView for resolveWebviewView */
function createMockWebviewView() {
    const postedMessages: unknown[] = [];
    const messageHandlers: Array<(msg: unknown) => void> = [];

    const webview = {
        options: {} as Record<string, unknown>,
        html: '',
        postMessage: (msg: unknown) => {
            postedMessages.push(msg);
            return Promise.resolve(true);
        },
        onDidReceiveMessage: (handler: (msg: unknown) => void) => {
            messageHandlers.push(handler);
            return { dispose: () => {} };
        },
        asWebviewUri: (uri: unknown) => uri,
        cspSource: 'https://test.csp',
    };

    const view = {
        webview,
        _messageHandlers: messageHandlers,
        _postedMessages: postedMessages,
    };

    return view;
}

// -- Tests ------------------------------------------------------------------

describe('GovernancePanelProvider', () => {
    let callMcp: ReturnType<typeof vi.fn>;
    let provider: GovernancePanelProvider;

    beforeEach(() => {
        callMcp = vi.fn().mockResolvedValue({});
        provider = new GovernancePanelProvider(mockUri('/test'), callMcp);
    });

    it('instantiates without error', () => {
        expect(provider).toBeDefined();
        expect(GovernancePanelProvider.viewType).toBe('flint.governancePanel');
    });

    it('generates HTML with expected structural elements', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const html = mock.webview.html;
        expect(html).toContain('id="grade"');
        expect(html).toContain('id="violations-list"');
        expect(html).toContain('id="file-name"');
        expect(html).toContain('id="fix-btn"');
        expect(html).toContain('id="audit-btn"');
        expect(html).toContain('id="mithril-count"');
        expect(html).toContain('id="a11y-count"');
        expect(html).toContain('Governance Health');
    });

    it('includes a CSP nonce in both style and script tags', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const html = mock.webview.html;
        // Extract nonce from Content-Security-Policy meta tag
        const cspMatch = html.match(/script-src 'nonce-([A-Za-z0-9]+)'/);
        expect(cspMatch).not.toBeNull();
        const nonce = cspMatch![1];

        // Same nonce must appear on the style and script tags
        expect(html).toContain(`<style nonce="${nonce}">`);
        expect(html).toContain(`<script nonce="${nonce}">`);
    });

    it('enables scripts on the webview', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        expect(mock.webview.options.enableScripts).toBe(true);
    });

    it('registers an onDidReceiveMessage handler', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        expect(mock._messageHandlers.length).toBeGreaterThan(0);
    });

    it('updateForFile posts fileChanged message to webview', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const violations = [{ ruleId: 'A11Y-001', message: 'Missing alt', severity: 'critical' }];
        provider.updateForFile(violations, '/test/Component.tsx');

        const lastMsg = mock._postedMessages[mock._postedMessages.length - 1] as {
            type: string;
            data: { violations: unknown[]; filePath: string };
        };
        expect(lastMsg.type).toBe('fileChanged');
        expect(lastMsg.data.filePath).toBe('/test/Component.tsx');
        expect(lastMsg.data.violations).toEqual(violations);
    });

    it('updateForFile is a no-op before resolveWebviewView is called', () => {
        // Should not throw when no view is resolved yet
        expect(() => {
            provider.updateForFile([], '/test/Foo.tsx');
        }).not.toThrow();
    });

    it('handles audit message by calling flint_audit via MCP', async () => {
        const mock = createMockWebviewView();

        // Mock the active text editor via the vscode mock
        const vscode = await import('vscode');
        const originalEditor = vscode.window.activeTextEditor;
        (vscode.window as Record<string, unknown>).activeTextEditor = {
            document: {
                getText: () => '<div>Test</div>',
                uri: { fsPath: '/test/Component.tsx' },
                positionAt: (offset: number) => ({ line: 0, character: offset }),
            },
        };

        callMcp.mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify({ violations: [], mithrilCount: 0, a11yCount: 0 }) }],
        });

        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        // Simulate webview sending an audit message
        const handler = mock._messageHandlers[0]!;
        await handler({ type: 'audit' });

        expect(callMcp).toHaveBeenCalledWith('flint_audit', {
            source: '<div>Test</div>',
            filePath: '/test/Component.tsx',
        });

        // Restore original
        (vscode.window as Record<string, unknown>).activeTextEditor = originalEditor;
    });

    it('handles debtReport message by calling flint_debt_report via MCP', async () => {
        const mock = createMockWebviewView();

        callMcp.mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify({ grade: 'B', score: 78 }) }],
        });

        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const handler = mock._messageHandlers[0]!;
        await handler({ type: 'debtReport' });

        expect(callMcp).toHaveBeenCalledWith('flint_debt_report', { format: 'json' });
    });

    it('posts error message when audit fails', async () => {
        const mock = createMockWebviewView();

        const vscode = await import('vscode');
        const originalEditor = vscode.window.activeTextEditor;
        (vscode.window as Record<string, unknown>).activeTextEditor = {
            document: {
                getText: () => '<div/>',
                uri: { fsPath: '/test/Fail.tsx' },
                positionAt: (offset: number) => ({ line: 0, character: offset }),
            },
        };

        callMcp.mockRejectedValueOnce(new Error('MCP connection lost'));

        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const handler = mock._messageHandlers[0]!;
        await handler({ type: 'audit' });

        const errorMsg = mock._postedMessages.find(
            (m) => (m as { type: string }).type === 'error',
        ) as { type: string; message: string } | undefined;
        expect(errorMsg).toBeDefined();
        expect(errorMsg!.message).toContain('MCP connection lost');

        (vscode.window as Record<string, unknown>).activeTextEditor = originalEditor;
    });

    it('generates valid HTML document structure', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const html = mock.webview.html;
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('</html>');
        expect(html).toContain('Content-Security-Policy');
    });

    it('HTML contains acquireVsCodeApi call', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        expect(mock.webview.html).toContain('acquireVsCodeApi()');
    });
});
