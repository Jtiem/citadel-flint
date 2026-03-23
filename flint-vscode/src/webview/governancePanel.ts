/**
 * flint-vscode/src/webview/governancePanel.ts
 *
 * WebviewViewProvider for the Governance panel in the Flint sidebar.
 *
 * Displays:
 *   - Health grade (A-F) with color coding and numeric score
 *   - Violations list for the active file with severity badges
 *   - Mithril / A11y violation counts
 *   - "Fix All" and "Re-Audit" action buttons
 *
 * Communication:
 *   - Extension -> Webview: postMessage with audit results, file changes, errors
 *   - Webview -> Extension: postMessage requesting audit, fix, or debt report
 */

import * as vscode from 'vscode';
import { getBaseStyles, getNonce } from './shared';

// Type for the MCP tool call function injected from extension.ts
type McpCaller = (tool: string, params: Record<string, unknown>) => Promise<unknown>;

export class GovernancePanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'flint.governancePanel';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _callMcp: McpCaller,
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtml(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (msg: { type: string }) => {
            if (msg.type === 'audit') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;
                try {
                    const result = await this._callMcp('flint_audit', {
                        source: editor.document.getText(),
                        filePath: editor.document.uri.fsPath,
                    });
                    webviewView.webview.postMessage({ type: 'auditResult', data: result });
                } catch (e) {
                    webviewView.webview.postMessage({ type: 'error', message: String(e) });
                }
            }

            if (msg.type === 'fix') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;
                try {
                    const result = (await this._callMcp('flint_fix', {
                        source: editor.document.getText(),
                        filePath: editor.document.uri.fsPath,
                    })) as { fixedSource?: string } | null;

                    if (result?.fixedSource) {
                        const fullRange = new vscode.Range(
                            editor.document.positionAt(0),
                            editor.document.positionAt(editor.document.getText().length),
                        );
                        await editor.edit((editBuilder) => {
                            editBuilder.replace(fullRange, result.fixedSource!);
                        });
                        // Re-audit after fix
                        const reauditResult = await this._callMcp('flint_audit', {
                            source: result.fixedSource,
                            filePath: editor.document.uri.fsPath,
                        });
                        webviewView.webview.postMessage({ type: 'auditResult', data: reauditResult });
                    }
                } catch (e) {
                    webviewView.webview.postMessage({ type: 'error', message: String(e) });
                }
            }

            if (msg.type === 'debtReport') {
                try {
                    const result = await this._callMcp('flint_debt_report', { format: 'json' });
                    webviewView.webview.postMessage({ type: 'debtResult', data: result });
                } catch {
                    // Debt report is optional -- swallow errors silently
                }
            }
        });
    }

    /**
     * Called from extension.ts when the active editor changes.
     * Pushes the new file's violations into the webview.
     */
    public updateForFile(violations: unknown[], filePath: string): void {
        this._view?.webview.postMessage({
            type: 'fileChanged',
            data: { violations, filePath },
        });
    }

    // -- HTML generation -------------------------------------------------------

    private _getHtml(_webview: vscode.Webview): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">${getBaseStyles()}</style>
</head>
<body>
    <div class="section">
        <div class="health-score" id="health">
            <div class="health-grade" id="grade" style="color: var(--vscode-descriptionForeground)">--</div>
            <div class="health-label">Governance Health</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Active File</div>
        <div id="file-name" style="font-size: 12px; margin-bottom: 8px; color: var(--vscode-descriptionForeground);">No file open</div>
        <div id="violations-list"></div>
        <div id="actions" style="display: none; margin-top: 8px;">
            <button class="btn" id="fix-btn">Fix All</button>
            <button class="btn btn-secondary" id="audit-btn" style="margin-left: 4px;">Re-Audit</button>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Stats</div>
        <div class="stat-row"><span>Mithril violations</span><span class="stat-value" id="mithril-count">0</span></div>
        <div class="stat-row"><span>Accessibility violations</span><span class="stat-value" id="a11y-count">0</span></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Request initial audit
        vscode.postMessage({ type: 'audit' });
        vscode.postMessage({ type: 'debtReport' });

        window.addEventListener('message', event => {
            const msg = event.data;

            if (msg.type === 'auditResult') {
                renderAuditResult(msg.data);
            }
            if (msg.type === 'fileChanged') {
                document.getElementById('file-name').textContent = msg.data.filePath?.split('/').pop() || 'No file open';
                if (msg.data.violations) {
                    renderViolations(msg.data.violations);
                }
            }
            if (msg.type === 'debtResult') {
                renderDebtScore(msg.data);
            }
            if (msg.type === 'error') {
                document.getElementById('violations-list').innerHTML =
                    '<div class="empty-state">' + escapeHtml(msg.message) + '</div>';
            }
        });

        function renderAuditResult(data) {
            if (!data) return;
            let parsed = data;
            if (typeof data === 'string') {
                try { parsed = JSON.parse(data); } catch { return; }
            }
            if (parsed && parsed.content && parsed.content[0] && parsed.content[0].text) {
                try { parsed = JSON.parse(parsed.content[0].text); } catch { return; }
            }

            const violations = parsed.violations || [];
            const mithrilCount = parsed.mithrilCount || 0;
            const a11yCount = parsed.a11yCount || 0;

            document.getElementById('mithril-count').textContent = mithrilCount;
            document.getElementById('a11y-count').textContent = a11yCount;

            renderViolations(violations);
        }

        function renderViolations(violations) {
            const list = document.getElementById('violations-list');
            const actions = document.getElementById('actions');

            if (!violations || violations.length === 0) {
                list.innerHTML = '<div class="empty-state">No violations found</div>';
                actions.style.display = 'none';
                updateGrade('A', '#10b981');
                return;
            }

            actions.style.display = 'block';

            const total = violations.length;
            if (total <= 2) updateGrade('A', '#10b981');
            else if (total <= 5) updateGrade('B', '#10b981');
            else if (total <= 10) updateGrade('C', '#f59e0b');
            else if (total <= 20) updateGrade('D', '#ef4444');
            else updateGrade('F', '#ef4444');

            list.innerHTML = violations.map(function(v) {
                var severity = (v.severity === 'critical' || v.type === 'a11y') ? 'critical' : 'warning';
                var badge = severity === 'critical'
                    ? '<span class="badge badge-red">a11y</span>'
                    : '<span class="badge badge-amber">mithril</span>';
                return '<div class="violation-item ' + severity + '">'
                    + badge + ' '
                    + '<strong>' + escapeHtml(v.ruleId || v.id || 'unknown') + '</strong><br>'
                    + '<span style="color: var(--vscode-descriptionForeground)">' + escapeHtml(v.message || '') + '</span>'
                    + '</div>';
            }).join('');
        }

        function renderDebtScore(data) {
            if (!data) return;
            var parsed = data;
            if (typeof data === 'string') {
                try { parsed = JSON.parse(data); } catch { return; }
            }
            if (parsed && parsed.content && parsed.content[0] && parsed.content[0].text) {
                try { parsed = JSON.parse(parsed.content[0].text); } catch { return; }
            }
            if (parsed && parsed.grade && parsed.score !== undefined) {
                var colors = { A: '#10b981', B: '#10b981', C: '#f59e0b', D: '#ef4444', F: '#ef4444' };
                updateGrade(parsed.grade, colors[parsed.grade] || '#a1a1aa');
            }
        }

        function updateGrade(grade, color) {
            var el = document.getElementById('grade');
            el.textContent = grade;
            el.style.color = color;
        }

        function escapeHtml(str) {
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        document.getElementById('fix-btn').addEventListener('click', function() {
            vscode.postMessage({ type: 'fix' });
        });

        document.getElementById('audit-btn').addEventListener('click', function() {
            vscode.postMessage({ type: 'audit' });
        });
    </script>
</body>
</html>`;
    }
}
