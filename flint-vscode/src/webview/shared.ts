/**
 * flint-vscode/src/webview/shared.ts
 *
 * Shared utilities for Flint webview panels.
 * Provides base CSS that uses VS Code's CSS variables for native theming,
 * and a nonce generator for Content Security Policy headers.
 */

/**
 * Returns CSS that uses VS Code's CSS variables for native theming.
 * Every webview panel should include this in its `<style>` tag.
 */
export function getBaseStyles(): string {
    return `
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 12px;
            margin: 0;
        }
        .section { margin-bottom: 16px; }
        .section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 8px;
        }
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
        }
        .badge-green { background: color-mix(in srgb, var(--vscode-testing-iconPassed, #10b981) 15%, transparent); color: var(--vscode-testing-iconPassed, #10b981); }
        .badge-amber { background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #f59e0b) 15%, transparent); color: var(--vscode-editorWarning-foreground, #f59e0b); }
        .badge-red { background: color-mix(in srgb, var(--vscode-testing-iconFailed, #ef4444) 15%, transparent); color: var(--vscode-testing-iconFailed, #ef4444); }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .btn:hover { background: var(--vscode-button-hoverBackground); }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .violation-item {
            padding: 6px 8px;
            border-left: 3px solid var(--vscode-widget-border);
            margin-bottom: 4px;
            font-size: 12px;
        }
        .violation-item.critical { border-left-color: var(--vscode-testing-iconFailed, #ef4444); }
        .violation-item.warning { border-left-color: var(--vscode-editorWarning-foreground, #f59e0b); }
        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 24px;
            font-size: 12px;
        }
        .health-score {
            text-align: center;
            padding: 16px;
        }
        .health-grade {
            font-size: 48px;
            font-weight: 700;
            line-height: 1;
        }
        .health-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 12px;
        }
        .stat-value {
            font-weight: 600;
        }
    `;
}

/**
 * Generates a cryptographic nonce string for Content Security Policy.
 * Each webview page render should use a unique nonce.
 */
export function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}
