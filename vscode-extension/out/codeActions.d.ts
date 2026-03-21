/**
 * vscode-extension/src/codeActions.ts
 *
 * Quick-fix code actions for Bridge governance violations.
 * - "Fix: Replace with design token `{tokenName}`" for Mithril violations
 * - "Fix: Add {attribute}" for a11y violations with recovery hints
 * - "Fix all Bridge violations" when multiple fixable violations exist
 */
import * as vscode from 'vscode';
import type { BridgeClient } from './bridgeClient';
/** Mithril violations are fixable via bridge_fix. */
export declare function isFixableViolation(violation: {
    type: string;
    ruleId: string;
}): boolean;
export declare class BridgeCodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds: vscode.CodeActionKind[];
    private client;
    private diagnosticCollection;
    constructor(client: BridgeClient, diagnosticCollection: vscode.DiagnosticCollection);
    provideCodeActions(document: vscode.TextDocument, _range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext): vscode.CodeAction[];
    registerCommands(): vscode.Disposable[];
    private applyFix;
}
//# sourceMappingURL=codeActions.d.ts.map