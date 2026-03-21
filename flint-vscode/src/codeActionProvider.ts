/**
 * flint-vscode/src/codeActionProvider.ts
 *
 * Provides quick-fix code actions for Flint governance violations.
 * When a Mithril token violation is detected, offers:
 *   "Fix: Replace with design token `{tokenName}`"
 *
 * The fix calls flint_fix via MCP and applies the returned source
 * as a full-document replacement (Babel AST surgery ensures correctness).
 */

import * as vscode from 'vscode';
import type { FlintClient } from './flintClient';
import type { DiagnosticWithViolation } from './diagnosticsProvider';
import { extractSuggestedToken, parseAuditResponse } from './diagnosticsProvider';

// -- Violation type checks --------------------------------------------------

/** Mithril violations are fixable via flint_fix. A11y violations require manual intervention. */
function isFixableViolation(violation: { type: string; ruleId: string }): boolean {
    // Mithril violations (color-drift, typography-drift, spacing-drift, etc.)
    // are auto-fixable. A11y violations are not.
    return violation.type !== 'a11y';
}

// -- CodeActionProvider -----------------------------------------------------

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
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'Flint') continue;

            const violation = (diagnostic as DiagnosticWithViolation)
                .flintViolation;
            if (!violation) continue;
            if (!isFixableViolation(violation)) continue;

            const tokenName =
                extractSuggestedToken(violation.message) ??
                violation.ruleId;

            const action = new vscode.CodeAction(
                `Fix: Replace with design token \`${tokenName}\``,
                vscode.CodeActionKind.QuickFix,
            );

            action.diagnostics = [diagnostic];
            action.isPreferred = true;

            // Lazy command -- the fix is applied when the user selects the action
            action.command = {
                command: 'flint.applyFix',
                title: 'Apply Flint Fix',
                arguments: [document.uri, violation],
            };

            actions.push(action);
        }

        // Add a "Fix all Flint violations" action when there are multiple fixable violations
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

    /**
     * Registers the internal commands used by code actions.
     * Returns disposables that should be added to the extension context.
     */
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

    // -- Internal -----------------------------------------------------------

    /**
     * Calls flint_fix via MCP for the entire document and applies the result.
     * flint_fix operates on the full source and fixes all detected violations
     * in a single Babel AST pass, so both single-fix and fix-all use this path.
     */
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

            const textContent = result.content?.find(
                (c) => c.type === 'text',
            );
            if (!textContent?.text) {
                vscode.window.showWarningMessage(
                    'Flint fix returned no content.',
                );
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

            // Apply the fixed source as a full-document edit
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

            // Re-audit after fix to refresh diagnostics
            // Small delay to let the file save propagate
            setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.toString() === uri.toString()) {
                    vscode.commands.executeCommand('flint.auditFile');
                }
            }, 500);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Flint fix failed: ${message}`);
        }
    }
}
