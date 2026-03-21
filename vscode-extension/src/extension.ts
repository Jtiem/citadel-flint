/**
 * vscode-extension/src/extension.ts
 *
 * VS Code extension entry point for Flint Governance.
 *
 * Activation:
 *   - onLanguage:typescriptreact / javascriptreact
 *   - When workspace contains flint-manifest.json or .flint/
 *
 * On activation:
 *   1. Resolves the Flint MCP server path
 *   2. Spawns the MCP server as a child process (JSON-RPC stdio)
 *   3. Registers DiagnosticsProvider (amber squiggles + hover text)
 *   4. Registers CodeActionProvider (quick-fix actions)
 *   5. Registers FlintStatusBar (violation count + color)
 *   6. Registers user commands (flint.auditFile, flint.auditWorkspace, flint.fixFile)
 */

import * as vscode from 'vscode';
import { FlintClient } from './flintClient';
import { DiagnosticsProvider } from './diagnostics';
import { FlintCodeActionProvider } from './codeActions';
import { FlintStatusBar } from './statusBar';
import { getConfiguration, onConfigurationChanged } from './configuration';

const SUPPORTED_LANGUAGES = [
    { language: 'typescriptreact' },
    { language: 'javascriptreact' },
    { language: 'typescript' },
    { language: 'javascript' },
];

let outputChannel: vscode.OutputChannel;

function log(msg: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
}

let client: FlintClient | null = null;
let diagnosticsProvider: DiagnosticsProvider | null = null;

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('Flint');
    context.subscriptions.push(outputChannel);

    log('Flint extension activating...');

    const config = getConfiguration();
    if (!config.enabled) {
        log('Flint extension is disabled via settings.');
        registerCommandsWithoutServer(context);
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        log('No workspace folder open. Flint extension will not start.');
        return;
    }

    const workspaceRoot = workspaceFolders[0]!.uri.fsPath;

    const serverPath = FlintClient.resolveServerPath(
        workspaceRoot,
        config.serverPath || undefined,
    );

    if (!serverPath) {
        const message =
            'Flint MCP server not found. Ensure flint-mcp/dist/server.js exists ' +
            'or set flint.serverPath in settings.';
        log(message);
        vscode.window.showWarningMessage(message);
        registerCommandsWithoutServer(context);
        return;
    }

    log(`Flint MCP server found at: ${serverPath}`);

    client = new FlintClient({ onLog: log });

    try {
        await client.start(serverPath, workspaceRoot);
        log('Flint MCP client started successfully');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`Failed to start Flint MCP server: ${message}`);
        vscode.window.showWarningMessage(
            `Flint: Failed to start MCP server. ${message}`,
        );
        registerCommandsWithoutServer(context);
        return;
    }

    // Diagnostics provider
    diagnosticsProvider = new DiagnosticsProvider(client);
    context.subscriptions.push(diagnosticsProvider);

    // Code action provider
    const codeActionProvider = new FlintCodeActionProvider(
        client,
        diagnosticsProvider.getDiagnosticCollection(),
    );

    for (const selector of SUPPORTED_LANGUAGES) {
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                selector,
                codeActionProvider,
                { providedCodeActionKinds: FlintCodeActionProvider.providedCodeActionKinds },
            ),
        );
    }

    for (const d of codeActionProvider.registerCommands()) {
        context.subscriptions.push(d);
    }

    // Status bar
    const statusBar = new FlintStatusBar(
        diagnosticsProvider.getDiagnosticCollection(),
    );
    context.subscriptions.push(statusBar);

    // Configuration change listener
    context.subscriptions.push(
        onConfigurationChanged((newConfig) => {
            log(`Configuration changed: enabled=${newConfig.enabled}`);
            if (statusBar) statusBar.update();
        }),
    );

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flint.auditFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active file to audit.');
                return;
            }
            if (!diagnosticsProvider) return;

            log(`Auditing file: ${editor.document.uri.fsPath}`);
            await diagnosticsProvider.auditDocument(editor.document);
            statusBar.update();
            log('Audit complete');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flint.auditWorkspace', async () => {
            if (!client?.isConnected()) {
                vscode.window.showWarningMessage('Flint MCP server is not connected.');
                return;
            }

            log('Auditing workspace...');

            const files = await vscode.workspace.findFiles(
                '**/*.{tsx,jsx,ts,js}',
                '**/node_modules/**',
                100,
            );

            if (files.length === 0) {
                vscode.window.showInformationMessage('No auditable files found in workspace.');
                return;
            }

            const audited = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Flint: Auditing workspace',
                    cancellable: true,
                },
                async (progress, token) => {
                    let count = 0;
                    for (const file of files) {
                        if (token.isCancellationRequested) break;
                        progress.report({
                            message: `${count}/${files.length} files`,
                            increment: (1 / files.length) * 100,
                        });
                        try {
                            const doc = await vscode.workspace.openTextDocument(file);
                            await diagnosticsProvider!.auditDocument(doc);
                        } catch {
                            // Skip files that fail
                        }
                        count++;
                    }
                    return count;
                },
            );

            statusBar.update();
            log(`Workspace audit complete: ${audited} files audited`);
            vscode.window.showInformationMessage(`Flint: Audited ${audited} files.`);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flint.fixFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active file to fix.');
                return;
            }
            if (!client?.isConnected()) {
                vscode.window.showWarningMessage('Flint MCP server is not connected.');
                return;
            }

            log(`Fixing file: ${editor.document.uri.fsPath}`);
            await vscode.commands.executeCommand(
                'flint.applyFixAll',
                editor.document.uri,
            );
        }),
    );

    // Audit all currently open documents
    for (const doc of vscode.workspace.textDocuments) {
        diagnosticsProvider.auditDocument(doc);
    }

    log('Flint extension activated successfully');
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
        client = null;
    }
    diagnosticsProvider = null;
}

function registerCommandsWithoutServer(context: vscode.ExtensionContext): void {
    const showNotConnected = () => {
        vscode.window.showWarningMessage(
            'Flint MCP server is not available. ' +
                'Ensure flint-mcp is built and the workspace contains flint-manifest.json.',
        );
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('flint.auditFile', showNotConnected),
        vscode.commands.registerCommand('flint.auditWorkspace', showNotConnected),
        vscode.commands.registerCommand('flint.fixFile', showNotConnected),
    );
}
