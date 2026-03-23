/**
 * flint-vscode/src/webview/activityPanel.ts
 *
 * WebviewViewProvider for the Activity panel in the Flint sidebar.
 *
 * Displays a chronological log of MCP tool invocations with:
 *   - Timestamp (HH:MM:SS)
 *   - Tool name
 *   - Status badge (success / error)
 *   - Duration in milliseconds
 *   - Auto-scroll to the newest entry
 *   - "Clear" button to reset the log
 */

import * as vscode from 'vscode';
import { getBaseStyles, getNonce } from './shared';

export class ActivityPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'flint.activityPanel';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
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

        // Handle messages from the webview (only "clear" for now)
        webviewView.webview.onDidReceiveMessage((msg: { type: string }) => {
            if (msg.type === 'clear') {
                // The clear action is handled entirely in the webview JS.
                // This handler exists for future extensibility.
            }
        });
    }

    /**
     * Called from extension.ts after every MCP tool call.
     * Pushes an activity entry into the webview log.
     */
    public logToolCall(toolName: string, status: 'success' | 'error', durationMs: number): void {
        this._view?.webview.postMessage({
            type: 'toolCall',
            data: {
                toolName,
                status,
                durationMs,
                timestamp: new Date().toISOString(),
            },
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
    <style nonce="${nonce}">
        ${getBaseStyles()}
        .activity-list {
            max-height: 400px;
            overflow-y: auto;
        }
        .activity-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-widget-border);
            font-size: 12px;
        }
        .activity-item:last-child {
            border-bottom: none;
        }
        .activity-time {
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            flex-shrink: 0;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 11px;
        }
        .activity-tool {
            font-weight: 500;
            flex-grow: 1;
            word-break: break-word;
        }
        .activity-duration {
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            flex-shrink: 0;
            font-size: 11px;
        }
        .activity-status {
            flex-shrink: 0;
        }
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .count {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <span class="count" id="count">0 calls</span>
        <button class="btn btn-secondary" id="clear-btn">Clear</button>
    </div>
    <div class="activity-list" id="activity-list">
        <div class="empty-state" id="empty">No activity yet</div>
    </div>

    <script nonce="${nonce}">
        var callCount = 0;

        window.addEventListener('message', function(event) {
            var msg = event.data;

            if (msg.type === 'toolCall') {
                addEntry(msg.data);
            }
        });

        function addEntry(data) {
            var list = document.getElementById('activity-list');
            var empty = document.getElementById('empty');
            if (empty) {
                empty.remove();
            }

            callCount++;
            document.getElementById('count').textContent = callCount + ' call' + (callCount === 1 ? '' : 's');

            var item = document.createElement('div');
            item.className = 'activity-item';

            var time = formatTime(data.timestamp);
            var statusBadge = data.status === 'success'
                ? '<span class="badge badge-green">ok</span>'
                : '<span class="badge badge-red">err</span>';
            var duration = data.durationMs !== undefined ? data.durationMs + 'ms' : '';

            item.innerHTML =
                '<span class="activity-time">' + escapeHtml(time) + '</span>'
                + '<span class="activity-tool">' + escapeHtml(data.toolName || 'unknown') + '</span>'
                + '<span class="activity-status">' + statusBadge + '</span>'
                + '<span class="activity-duration">' + escapeHtml(duration) + '</span>';

            list.appendChild(item);

            // Auto-scroll to bottom
            list.scrollTop = list.scrollHeight;
        }

        function formatTime(isoString) {
            if (!isoString) return '--:--:--';
            try {
                var d = new Date(isoString);
                return d.toTimeString().slice(0, 8);
            } catch {
                return '--:--:--';
            }
        }

        function escapeHtml(str) {
            if (!str) return '';
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        document.getElementById('clear-btn').addEventListener('click', function() {
            var list = document.getElementById('activity-list');
            list.innerHTML = '<div class="empty-state" id="empty">No activity yet</div>';
            callCount = 0;
            document.getElementById('count').textContent = '0 calls';
        });
    </script>
</body>
</html>`;
    }
}
