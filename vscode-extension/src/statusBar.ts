/**
 * vscode-extension/src/statusBar.ts
 *
 * Manages the Flint status bar item showing violation count for the active file.
 * Color-coded: green (0), yellow (warnings only), red (has errors).
 */

import * as vscode from 'vscode';

export class FlintStatusBar implements vscode.Disposable {
    private item: vscode.StatusBarItem;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];

    constructor(diagnosticCollection: vscode.DiagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;

        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100,
        );
        this.item.command = 'workbench.action.problems.focus';
        this.item.show();

        // Update on active editor change
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.update()),
        );

        // Update when any diagnostics change globally
        this.disposables.push(
            vscode.languages.onDidChangeDiagnostics(() => this.update()),
        );

        this.update();
    }

    /**
     * Refreshes the status bar text and color based on current diagnostics.
     */
    update(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.item.text = '$(shield) Flint';
            this.item.tooltip = 'Flint Governance — no active file';
            this.item.backgroundColor = undefined;
            return;
        }

        const diagnostics =
            this.diagnosticCollection.get(editor.document.uri) ?? [];
        const errorCount = diagnostics.filter(
            (d) => d.severity === vscode.DiagnosticSeverity.Error,
        ).length;
        const warningCount = diagnostics.filter(
            (d) => d.severity === vscode.DiagnosticSeverity.Warning,
        ).length;
        const total = diagnostics.length;

        if (total === 0) {
            this.item.text = '$(shield) Flint: 0';
            this.item.tooltip = 'Flint Governance — no violations';
            this.item.backgroundColor = undefined;
        } else if (errorCount > 0) {
            this.item.text = `$(shield) Flint: ${total}`;
            this.item.tooltip = `Flint: ${errorCount} error(s), ${warningCount} warning(s)`;
            this.item.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.errorBackground',
            );
        } else {
            this.item.text = `$(shield) Flint: ${total}`;
            this.item.tooltip = `Flint: ${warningCount} warning(s)`;
            this.item.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground',
            );
        }
    }

    dispose(): void {
        this.item.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
