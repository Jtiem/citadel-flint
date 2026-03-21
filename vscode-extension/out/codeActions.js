"use strict";
/**
 * vscode-extension/src/codeActions.ts
 *
 * Quick-fix code actions for Bridge governance violations.
 * - "Fix: Replace with design token `{tokenName}`" for Mithril violations
 * - "Fix: Add {attribute}" for a11y violations with recovery hints
 * - "Fix all Bridge violations" when multiple fixable violations exist
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeCodeActionProvider = void 0;
exports.isFixableViolation = isFixableViolation;
const vscode = __importStar(require("vscode"));
const diagnostics_1 = require("./diagnostics");
/** Mithril violations are fixable via bridge_fix. */
function isFixableViolation(violation) {
    return violation.type !== 'a11y';
}
/** Builds a human-readable action title for a violation. */
function buildActionTitle(violation) {
    if (violation.type === 'a11y' && violation.recovery) {
        return `Fix: ${violation.recovery}`;
    }
    const tokenName = (0, diagnostics_1.extractSuggestedToken)(violation.message) ?? violation.ruleId;
    return `Fix: Replace with design token \`${tokenName}\``;
}
class BridgeCodeActionProvider {
    static providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];
    client;
    diagnosticCollection;
    constructor(client, diagnosticCollection) {
        this.client = client;
        this.diagnosticCollection = diagnosticCollection;
    }
    provideCodeActions(document, _range, context) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'Bridge')
                continue;
            const violation = diagnostic.bridgeViolation;
            if (!violation)
                continue;
            if (!isFixableViolation(violation))
                continue;
            const action = new vscode.CodeAction(buildActionTitle(violation), vscode.CodeActionKind.QuickFix);
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            action.command = {
                command: 'bridge.applyFix',
                title: 'Apply Bridge Fix',
                arguments: [document.uri, violation],
            };
            actions.push(action);
        }
        // "Fix all" when multiple fixable violations
        const fixableDiagnostics = context.diagnostics.filter((d) => {
            if (d.source !== 'Bridge')
                return false;
            const v = d.bridgeViolation;
            return v ? isFixableViolation(v) : false;
        });
        if (fixableDiagnostics.length > 1) {
            const fixAll = new vscode.CodeAction(`Fix all Bridge violations (${fixableDiagnostics.length})`, vscode.CodeActionKind.QuickFix);
            fixAll.diagnostics = fixableDiagnostics;
            fixAll.command = {
                command: 'bridge.applyFixAll',
                title: 'Apply All Bridge Fixes',
                arguments: [document.uri],
            };
            actions.push(fixAll);
        }
        return actions;
    }
    registerCommands() {
        return [
            vscode.commands.registerCommand('bridge.applyFix', async (uri) => {
                await this.applyFix(uri);
            }),
            vscode.commands.registerCommand('bridge.applyFixAll', async (uri) => {
                await this.applyFix(uri);
            }),
        ];
    }
    async applyFix(uri) {
        if (!this.client.isConnected()) {
            vscode.window.showWarningMessage('Bridge MCP server is not connected. Cannot apply fix.');
            return;
        }
        const document = await vscode.workspace.openTextDocument(uri);
        const source = document.getText();
        const filePath = uri.fsPath;
        try {
            const result = await this.client.callTool('bridge_fix', {
                source,
                filePath,
                dryRun: false,
            });
            const textContent = result.content?.find((c) => c.type === 'text');
            if (!textContent?.text) {
                vscode.window.showWarningMessage('Bridge fix returned no content.');
                return;
            }
            const fixResult = JSON.parse(textContent.text);
            if (fixResult.fixesApplied === 0) {
                vscode.window.showInformationMessage(fixResult.summary || 'No fixable violations found.');
                return;
            }
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(source.length));
            edit.replace(uri, fullRange, fixResult.fixedSource);
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage(fixResult.summary ||
                `Bridge: Fixed ${fixResult.fixesApplied} violation(s).`);
            // Re-audit after fix
            setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.toString() === uri.toString()) {
                    vscode.commands.executeCommand('bridge.auditFile');
                }
            }, 500);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Bridge fix failed: ${message}`);
        }
    }
}
exports.BridgeCodeActionProvider = BridgeCodeActionProvider;
//# sourceMappingURL=codeActions.js.map