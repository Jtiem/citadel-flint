/**
 * flint-vscode/src/__tests__/activityPanel.test.ts
 *
 * Unit tests for ActivityPanelProvider.
 *
 * Tests cover:
 *   - Provider instantiation
 *   - HTML structure (expected elements, CSP nonce)
 *   - resolveWebviewView wiring
 *   - logToolCall pushes toolCall messages to the webview
 *   - logToolCall is a no-op before resolveWebviewView
 *   - HTML contains expected CSS and script elements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityPanelProvider } from '../webview/activityPanel';

// -- Helpers ----------------------------------------------------------------

function mockUri(fsPath: string) {
    return { fsPath, toString: () => fsPath } as unknown as import('vscode').Uri;
}

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

    return {
        webview,
        _messageHandlers: messageHandlers,
        _postedMessages: postedMessages,
    };
}

// -- Tests ------------------------------------------------------------------

describe('ActivityPanelProvider', () => {
    let provider: ActivityPanelProvider;

    beforeEach(() => {
        provider = new ActivityPanelProvider(mockUri('/test'));
    });

    it('instantiates without error', () => {
        expect(provider).toBeDefined();
        expect(ActivityPanelProvider.viewType).toBe('flint.activityPanel');
    });

    it('generates HTML with expected structural elements', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const html = mock.webview.html;
        expect(html).toContain('id="activity-list"');
        expect(html).toContain('id="clear-btn"');
        expect(html).toContain('id="count"');
        expect(html).toContain('id="empty"');
        expect(html).toContain('No activity yet');
    });

    it('includes a CSP nonce in both style and script tags', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const html = mock.webview.html;
        const cspMatch = html.match(/script-src 'nonce-([A-Za-z0-9]+)'/);
        expect(cspMatch).not.toBeNull();
        const nonce = cspMatch![1];

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

    it('logToolCall posts toolCall message to webview', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        provider.logToolCall('flint_audit', 'success', 42);

        const lastMsg = mock._postedMessages[mock._postedMessages.length - 1] as {
            type: string;
            data: { toolName: string; status: string; durationMs: number; timestamp: string };
        };
        expect(lastMsg.type).toBe('toolCall');
        expect(lastMsg.data.toolName).toBe('flint_audit');
        expect(lastMsg.data.status).toBe('success');
        expect(lastMsg.data.durationMs).toBe(42);
        expect(lastMsg.data.timestamp).toBeTruthy();
    });

    it('logToolCall posts error status correctly', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        provider.logToolCall('flint_fix', 'error', 1500);

        const lastMsg = mock._postedMessages[mock._postedMessages.length - 1] as {
            type: string;
            data: { toolName: string; status: string; durationMs: number };
        };
        expect(lastMsg.data.status).toBe('error');
        expect(lastMsg.data.toolName).toBe('flint_fix');
        expect(lastMsg.data.durationMs).toBe(1500);
    });

    it('logToolCall is a no-op before resolveWebviewView is called', () => {
        // Should not throw when no view is resolved yet
        expect(() => {
            provider.logToolCall('flint_audit', 'success', 100);
        }).not.toThrow();
    });

    it('logToolCall includes ISO timestamp', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        provider.logToolCall('flint_audit', 'success', 50);

        const lastMsg = mock._postedMessages[mock._postedMessages.length - 1] as {
            type: string;
            data: { timestamp: string };
        };
        // Should be a valid ISO date string
        const date = new Date(lastMsg.data.timestamp);
        expect(date.getTime()).not.toBeNaN();
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

    it('HTML contains activity-specific CSS classes', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        const html = mock.webview.html;
        expect(html).toContain('.activity-list');
        expect(html).toContain('.activity-item');
        expect(html).toContain('.activity-time');
        expect(html).toContain('.activity-tool');
        expect(html).toContain('.toolbar');
    });

    it('multiple logToolCall invocations post separate messages', () => {
        const mock = createMockWebviewView();
        provider.resolveWebviewView(
            mock as unknown as import('vscode').WebviewView,
            {} as import('vscode').WebviewViewResolveContext,
            {} as import('vscode').CancellationToken,
        );

        provider.logToolCall('flint_audit', 'success', 10);
        provider.logToolCall('flint_fix', 'success', 20);
        provider.logToolCall('flint_debt_report', 'error', 30);

        const toolCallMessages = mock._postedMessages.filter(
            (m) => (m as { type: string }).type === 'toolCall',
        );
        expect(toolCallMessages).toHaveLength(3);
    });
});
