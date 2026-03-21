/**
 * vscode-extension/src/codeActions.ts
 *
 * Quick-fix code actions for Flint governance violations.
 * - "Fix: Replace with design token `{tokenName}`" for Mithril violations
 * - "Fix: Add {attribute}" for a11y violations with recovery hints
 * - "Fix all Flint violations" when multiple fixable violations exist
 */

import * as vscode from 'vscode';
import type { FlintClient } from './flintClient';
import type { DiagnosticWithViolation } from './diagnostics';
import { extractSuggestedToken, parseAuditResponse } from './diagnostics';

/** Mithril violations are fixable via flint_fix. */
export function isFixableViolation(violation: { type: string; ruleId: string }): boolean {
    return violation.type !== 'a11y';
}

/** Builds a human-readable action title for a violation. */
function buildActionTitle(violation: { type: string; ruleId: string; message: string; recovery?: string }): string {
    if (violation.type === 'a11y' && violation.recovery) {
        return `Fix: ${violation.recovery}`;
    }
    const tokenName = extractSuggestedToken(violation.message) ?? violation.ruleId;
    return `Fix: Replace with design token \`${tokenName}\``;
}

export class FlintCodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];

    private client: FlintClient;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(
        client: FlintClient,
        diagnosticCollection: vscode.DiagnosticCollection,
    ) {
        this.client = client;
        this.diagnosticCollection = diagnosticCollection;
    }

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'Flint') continue;

            const violation = (diagnostic as DiagnosticWithViolation).flintViolation;
            if (!violation) continue;
            if (!isFixableViolation(violation)) continue;

            const action = new vscode.CodeAction(
                buildActionTitle(violation),
                vscode.CodeActionKind.QuickFix,
            );

            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            action.command = {
                command: 'flint.applyFix',
                title: 'Apply Flint Fix',
                arguments: [document.uri, violation],
            };

            actions.push(action);
        }

        // "Fix all" when multiple fixable violations
        const fixableDiagnostics = context.diagnostics.filter((d) => {
            if (d.source !== 'Flint') return false;
            const v = (d as DiagnosticWithViolation).flintViolation;
            return v ? isFixableViolation(v) : false;
        });

        if (fixableDiagnostics.length > 1) {
            const fixAll = new vscode.CodeAction(
                `Fix all Flint violations (${fixableDiagnostics.length})`,
                vscode.CodeActionKind.QuickFix,
            );
            fixAll.diagnostics = fixableDiagnostics;
            fixAll.command = {
                command: 'flint.applyFixAll',
                title: 'Apply All Flint Fixes',
                arguments: [document.uri],
            };
            actions.push(fixAll);
        }

        return actions;
    }

    registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand(
                'flint.applyFix',
                async (uri: vscode.Uri) => {
                    await this.applyFix(uri);
                },
            ),
            vscode.commands.registerCommand(
                'flint.applyFixAll',
                async (uri: vscode.Uri) => {
                    await this.applyFix(uri);
                },
            ),
        ];
    }

    private async applyFix(uri: vscode.Uri): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showWarningMessage(
                'Flint MCP server is not connected. Cannot apply fix.',
            );
            return;
        }

        const document = await vscode.workspace.openTextDocument(uri);
        const source = document.getText();
        const filePath = uri.fsPath;

        try {
            const result = await this.client.callTool('flint_fix', {
                source,
                filePath,
                dryRun: false,
            });

            const textContent = result.content?.find((c) => c.type === 'text');
            if (!textContent?.text) {
                vscode.window.showWarningMessage('Flint fix returned no content.');
                return;
            }

            const fixResult = JSON.parse(textContent.text) as {
                fixedSource: string;
                fixesApplied: number;
                status: string;
                summary: string;
            };

            if (fixResult.fixesApplied === 0) {
                vscode.window.showInformationMessage(
                    fixResult.summary || 'No fixable violations found.',
                );
                return;
            }

            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(source.length),
            );
            edit.replace(uri, fullRange, fixResult.fixedSource);
            await vscode.workspace.applyEdit(edit);

            vscode.window.showInformationMessage(
                fixResult.summary ||
                    `Flint: Fixed ${fixResult.fixesApplied} violation(s).`,
            );

            // Re-audit after fix
            setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.toString() === uri.toString()) {
                    vscode.commands.executeCommand('flint.auditFile');
                }
            }, 500);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Flint fix failed: ${message}`);
        }
    }
}
