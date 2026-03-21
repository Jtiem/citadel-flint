"use strict";
/**
 * vscode-extension/src/extension.ts
 *
 * VS Code extension entry point for Bridge Governance.
 *
 * Activation:
 *   - onLanguage:typescriptreact / javascriptreact
 *   - When workspace contains bridge-manifest.json or .bridge/
 *
 * On activation:
 *   1. Resolves the Bridge MCP server path
 *   2. Spawns the MCP server as a child process (JSON-RPC stdio)
 *   3. Registers DiagnosticsProvider (amber squiggles + hover text)
 *   4. Registers CodeActionProvider (quick-fix actions)
 *   5. Registers BridgeStatusBar (violation count + color)
 *   6. Registers user commands (bridge.auditFile, bridge.auditWorkspace, bridge.fixFile)
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const bridgeClient_1 = require("./bridgeClient");
const diagnostics_1 = require("./diagnostics");
const codeActions_1 = require("./codeActions");
const statusBar_1 = require("./statusBar");
const configuration_1 = require("./configuration");
const SUPPORTED_LANGUAGES = [
    { language: 'typescriptreact' },
    { language: 'javascriptreact' },
    { language: 'typescript' },
    { language: 'javascript' },
];
let outputChannel;
function log(msg) {
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
}
let client = null;
let diagnosticsProvider = null;
async function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Bridge');
    context.subscriptions.push(outputChannel);
    log('Bridge extension activating...');
    const config = (0, configuration_1.getConfiguration)();
    if (!config.enabled) {
        log('Bridge extension is disabled via settings.');
        registerCommandsWithoutServer(context);
        return;
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        log('No workspace folder open. Bridge extension will not start.');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const serverPath = bridgeClient_1.BridgeClient.resolveServerPath(workspaceRoot, config.serverPath || undefined);
    if (!serverPath) {
        const message = 'Bridge MCP server not found. Ensure bridge-mcp/dist/server.js exists ' +
            'or set bridge.serverPath in settings.';
        log(message);
        vscode.window.showWarningMessage(message);
        registerCommandsWithoutServer(context);
        return;
    }
    log(`Bridge MCP server found at: ${serverPath}`);
    client = new bridgeClient_1.BridgeClient({ onLog: log });
    try {
        await client.start(serverPath, workspaceRoot);
        log('Bridge MCP client started successfully');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`Failed to start Bridge MCP server: ${message}`);
        vscode.window.showWarningMessage(`Bridge: Failed to start MCP server. ${message}`);
        registerCommandsWithoutServer(context);
        return;
    }
    // Diagnostics provider
    diagnosticsProvider = new diagnostics_1.DiagnosticsProvider(client);
    context.subscriptions.push(diagnosticsProvider);
    // Code action provider
    const codeActionProvider = new codeActions_1.BridgeCodeActionProvider(client, diagnosticsProvider.getDiagnosticCollection());
    for (const selector of SUPPORTED_LANGUAGES) {
        context.subscriptions.push(vscode.languages.registerCodeActionsProvider(selector, codeActionProvider, { providedCodeActionKinds: codeActions_1.BridgeCodeActionProvider.providedCodeActionKinds }));
    }
    for (const d of codeActionProvider.registerCommands()) {
        context.subscriptions.push(d);
    }
    // Status bar
    const statusBar = new statusBar_1.BridgeStatusBar(diagnosticsProvider.getDiagnosticCollection());
    context.subscriptions.push(statusBar);
    // Configuration change listener
    context.subscriptions.push((0, configuration_1.onConfigurationChanged)((newConfig) => {
        log(`Configuration changed: enabled=${newConfig.enabled}`);
        if (statusBar)
            statusBar.update();
    }));
    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('bridge.auditFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to audit.');
            return;
        }
        if (!diagnosticsProvider)
            return;
        log(`Auditing file: ${editor.document.uri.fsPath}`);
        await diagnosticsProvider.auditDocument(editor.document);
        statusBar.update();
        log('Audit complete');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('bridge.auditWorkspace', async () => {
        if (!client?.isConnected()) {
            vscode.window.showWarningMessage('Bridge MCP server is not connected.');
            return;
        }
        log('Auditing workspace...');
        const files = await vscode.workspace.findFiles('**/*.{tsx,jsx,ts,js}', '**/node_modules/**', 100);
        if (files.length === 0) {
            vscode.window.showInformationMessage('No auditable files found in workspace.');
            return;
        }
        const audited = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Bridge: Auditing workspace',
            cancellable: true,
        }, async (progress, token) => {
            let count = 0;
            for (const file of files) {
                if (token.isCancellationRequested)
                    break;
                progress.report({
                    message: `${count}/${files.length} files`,
                    increment: (1 / files.length) * 100,
                });
                try {
                    const doc = await vscode.workspace.openTextDocument(file);
                    await diagnosticsProvider.auditDocument(doc);
                }
                catch {
                    // Skip files that fail
                }
                count++;
            }
            return count;
        });
        statusBar.update();
        log(`Workspace audit complete: ${audited} files audited`);
        vscode.window.showInformationMessage(`Bridge: Audited ${audited} files.`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('bridge.fixFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to fix.');
            return;
        }
        if (!client?.isConnected()) {
            vscode.window.showWarningMessage('Bridge MCP server is not connected.');
            return;
        }
        log(`Fixing file: ${editor.document.uri.fsPath}`);
        await vscode.commands.executeCommand('bridge.applyFixAll', editor.document.uri);
    }));
    // Audit all currently open documents
    for (const doc of vscode.workspace.textDocuments) {
        diagnosticsProvider.auditDocument(doc);
    }
    log('Bridge extension activated successfully');
}
async function deactivate() {
    if (client) {
        await client.stop();
        client = null;
    }
    diagnosticsProvider = null;
}
function registerCommandsWithoutServer(context) {
    const showNotConnected = () => {
        vscode.window.showWarningMessage('Bridge MCP server is not available. ' +
            'Ensure bridge-mcp is built and the workspace contains bridge-manifest.json.');
    };
    context.subscriptions.push(vscode.commands.registerCommand('bridge.auditFile', showNotConnected), vscode.commands.registerCommand('bridge.auditWorkspace', showNotConnected), vscode.commands.registerCommand('bridge.fixFile', showNotConnected));
}
//# sourceMappingURL=extension.js.map