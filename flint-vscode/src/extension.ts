/**
 * flint-vscode/src/extension.ts
 *
 * VS Code extension entry point for Flint Governance.
 *
 * Activation:
 *   - When workspace contains `flint-manifest.json` or `.flint/` directory
 *
 * On activation:
 *   1. Resolves the Flint MCP server path
 *   2. Spawns the MCP server as a child process (JSON-RPC stdio)
 *   3. Registers DiagnosticsProvider (amber squiggles + hover text)
 *   4. Registers CodeActionProvider (quick-fix actions)
 *   5. Registers user commands (flint.auditFile, flint.auditWorkspace)
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FlintClient } from './flintClient';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { FlintCodeActionProvider } from './codeActionProvider';
import { GovernancePanelProvider } from './webview/governancePanel';
import { ActivityPanelProvider } from './webview/activityPanel';

// -- Supported languages for code action provider ---------------------------

const SUPPORTED_LANGUAGES = [
    { language: 'typescriptreact' },
    { language: 'javascriptreact' },
    { language: 'typescript' },
    { language: 'javascript' },
];

// -- Output channel for logging ---------------------------------------------

let outputChannel: vscode.OutputChannel;

function log(msg: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
}

// -- MCP auto-registration (all VS Code-family hosts) -----------------------

import { execSync } from 'node:child_process';

/**
 * Finds the system Node.js binary.
 *
 * `process.execPath` in a VS Code extension host is the Electron app binary,
 * NOT Node.js — so we must locate node separately.
 *
 * Priority:
 *   1. `which node` using the current process PATH
 *   2. Common macOS install locations (Homebrew, nvm, system)
 */
function resolveNodePath(): string | null {
    // Common macOS locations first — more reliable than `which` in Electron extension hosts
    // where PATH is often restricted to the app's own binaries.
    const candidates = [
        '/usr/local/bin/node',        // Intel Mac standard
        '/opt/homebrew/bin/node',     // Apple Silicon Homebrew
        `${process.env['HOME'] ?? ''}/.nvm/versions/node/current/bin/node`,
        '/usr/bin/node',
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }

    // Last resort: try PATH lookup (may return the Electron binary in some hosts)
    try {
        const result = execSync('which node', { encoding: 'utf8', timeout: 3000 }).trim();
        // Reject if it's clearly an Electron/app binary rather than real Node.js
        if (result && !result.includes('.app/') && fs.existsSync(result)) return result;
    } catch { /* fall through */ }

    return null;
}

type RegistrationResult = 'registered' | 'already-current' | 'skipped';

interface McpTarget {
    /** Absolute path to the config file that must be written. */
    filePath: string;
    /**
     * Top-level key that holds the server map.
     * Claude Code / Cursor / Windsurf use "mcpServers".
     * Native VS Code uses "servers".
     */
    serversKey: 'mcpServers' | 'servers';
    /**
     * When true the config file is created if absent (global user configs).
     * When false we only write if the file already exists (project configs).
     */
    createIfMissing: boolean;
}

/**
 * Returns the list of MCP config targets for the running host application.
 *
 * Detection strategy: `vscode.env.appName` returns the human-readable product
 * name ("Cursor", "Windsurf", "Visual Studio Code", "Claude Code", …).
 *
 * Exported for unit testing.
 */
export function getMcpTargets(workspaceRoot: string): McpTarget[] {
    const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
    const appName = vscode.env.appName;

    const targets: McpTarget[] = [];

    if (appName.includes('Cursor')) {
        // Cursor: global ~/.cursor/mcp.json (created on first server add)
        targets.push({
            filePath: path.join(home, '.cursor', 'mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
    } else if (appName.toLowerCase().includes('windsurf')) {
        // Windsurf: global ~/.codeium/windsurf/mcp_config.json
        targets.push({
            filePath: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
    } else if (appName === 'Claude Code') {
        // Running inside Claude Code extension host — register both locations.
        // User-level global (~/.claude/mcp.json): always loaded, no approval needed.
        targets.push({
            filePath: path.join(home, '.claude', 'mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
        // Project-level (.mcp.json): requires user approval via Claude Code trust dialog.
        targets.push({
            filePath: path.join(workspaceRoot, '.mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
    } else if (appName.includes('Visual Studio Code')) {
        // Native VS Code: workspace-level .vscode/mcp.json (different schema key)
        targets.push({
            filePath: path.join(workspaceRoot, '.vscode', 'mcp.json'),
            serversKey: 'servers',
            createIfMissing: true,
        });
        // Claude Code reads MCP servers from two locations — register both so
        // Flint shows up in /mcp regardless of whether Claude Code is the host.
        // User-level global: always loaded, no approval needed.
        targets.push({
            filePath: path.join(home, '.claude', 'mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
        // Project-level: requires user approval via Claude Code trust dialog.
        targets.push({
            filePath: path.join(workspaceRoot, '.mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
    } else {
        // Unknown VS Code-family host — register Claude Code locations as a safe default.
        targets.push({
            filePath: path.join(home, '.claude', 'mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
        targets.push({
            filePath: path.join(workspaceRoot, '.mcp.json'),
            serversKey: 'mcpServers',
            createIfMissing: true,
        });
    }

    return targets;
}

/**
 * Writes the Flint MCP entry into a single config file.
 * Idempotent — skips if the entry already matches exactly.
 *
 * Exported for unit testing.
 */
export function writeMcpEntry(
    target: McpTarget,
    serverPath: string,
    workspaceRoot: string,
): RegistrationResult {
    const nodeExec = resolveNodePath();
    if (!nodeExec) return 'skipped'; // can't locate node — leave config alone
    const { filePath, serversKey, createIfMissing } = target;

    if (!fs.existsSync(filePath)) {
        if (!createIfMissing) return 'skipped';
        // Ensure parent directory exists
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    let settings: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
        try {
            settings = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
        } catch {
            return 'skipped'; // malformed JSON — leave it alone
        }
    }

    const servers = (settings[serversKey] ?? {}) as Record<string, unknown>;
    const existing = servers['flint'] as Record<string, unknown> | undefined;

    if (
        existing &&
        existing['command'] === nodeExec &&
        Array.isArray(existing['args']) &&
        (existing['args'] as string[])[0] === serverPath &&
        existing['cwd'] === workspaceRoot
    ) {
        return 'already-current';
    }

    servers['flint'] = { command: nodeExec, args: [serverPath], cwd: workspaceRoot };
    settings[serversKey] = servers;

    try {
        fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    } catch {
        return 'skipped';
    }

    return 'registered';
}

/**
 * Registers Flint MCP in every config file relevant to the running host.
 * Returns an array of `[filePath, result]` pairs for logging.
 */
function registerFlintMCP(
    workspaceRoot: string,
    serverPath: string,
): Array<[string, RegistrationResult]> {
    return getMcpTargets(workspaceRoot).map(target => [
        target.filePath,
        writeMcpEntry(target, serverPath, workspaceRoot),
    ]);
}

// -- Extension lifecycle ----------------------------------------------------

let client: FlintClient | null = null;
let diagnosticsProvider: DiagnosticsProvider | null = null;

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('Flint');
    context.subscriptions.push(outputChannel);

    log('Flint extension activating...');

    // Resolve workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        log('No workspace folder open. Flint extension will not start.');
        return;
    }

    const workspaceRoot = workspaceFolders[0]!.uri.fsPath;

    // Resolve server path
    const config = vscode.workspace.getConfiguration('flint');
    const customServerPath = config.get<string>('serverPath', '');
    const serverPath = FlintClient.resolveServerPath(
        workspaceRoot,
        customServerPath || undefined,
    );

    if (!serverPath) {
        const message =
            'Flint MCP server not found. Ensure flint-mcp/dist/server.js exists ' +
            'or set flint.serverPath in settings.';
        log(message);
        vscode.window.showWarningMessage(message);

        // Still register commands so the user gets helpful error messages
        registerCommandsWithoutServer(context);
        return;
    }

    log(`Flint MCP server found at: ${serverPath}`);

    // Auto-register Flint MCP in all relevant host config files
    const mcpResults = registerFlintMCP(workspaceRoot, serverPath);
    const anyRegistered = mcpResults.some(([, r]) => r === 'registered');
    for (const [filePath, result] of mcpResults) {
        log(`MCP registration [${path.basename(filePath)}]: ${result}`);
    }
    if (anyRegistered) {
        // Determine if any project-level .mcp.json was written so we can
        // mention the Claude Code trust prompt in the message.
        const wroteProjectMcp = mcpResults.some(
            ([filePath, result]) =>
                result === 'registered' && path.basename(filePath) === '.mcp.json',
        );
        const message = wroteProjectMcp
            ? 'Flint: MCP server registered. If Claude Code shows a trust prompt for .mcp.json, approve it. ' +
              'The global ~/.claude/mcp.json entry requires no approval. Reload to connect.'
            : 'Flint: MCP server registered. Reload the window to connect.';
        vscode.window.showInformationMessage(message, 'Reload Window').then(choice => {
            if (choice === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
    }

    // Create and start the MCP client
    const nodePath = resolveNodePath();
    client = new FlintClient({ onLog: log });

    try {
        await client.start(serverPath, workspaceRoot, nodePath ?? undefined);
        log('Flint MCP client started successfully');
    } catch (err) {
        const message =
            err instanceof Error ? err.message : String(err);
        log(`Failed to start Flint MCP server: ${message}`);
        vscode.window.showWarningMessage(
            `Flint: Failed to start MCP server. ${message}`,
        );
        registerCommandsWithoutServer(context);
        return;
    }

    // Register diagnostics provider
    diagnosticsProvider = new DiagnosticsProvider(client);
    context.subscriptions.push(diagnosticsProvider);

    // Register code action provider
    const codeActionProvider = new FlintCodeActionProvider(
        client,
        diagnosticsProvider.getDiagnosticCollection(),
    );

    for (const selector of SUPPORTED_LANGUAGES) {
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                selector,
                codeActionProvider,
                {
                    providedCodeActionKinds:
                        FlintCodeActionProvider.providedCodeActionKinds,
                },
            ),
        );
    }

    // Register code action internal commands
    const actionDisposables = codeActionProvider.registerCommands();
    for (const d of actionDisposables) {
        context.subscriptions.push(d);
    }

    // Register user-facing commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flint.auditFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage(
                    'No active file to audit.',
                );
                return;
            }
            if (!diagnosticsProvider) return;

            log(`Auditing file: ${editor.document.uri.fsPath}`);
            await diagnosticsProvider.auditDocument(editor.document);
            log('Audit complete');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'flint.auditWorkspace',
            async () => {
                if (!client?.isConnected()) {
                    vscode.window.showWarningMessage(
                        'Flint MCP server is not connected.',
                    );
                    return;
                }

                log('Auditing workspace...');

                // Find all auditable files
                const files = await vscode.workspace.findFiles(
                    '**/*.{tsx,jsx,ts,js}',
                    '**/node_modules/**',
                    100, // Limit to 100 files for performance
                );

                if (files.length === 0) {
                    vscode.window.showInformationMessage(
                        'No auditable files found in workspace.',
                    );
                    return;
                }

                const progress = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Flint: Auditing workspace',
                        cancellable: true,
                    },
                    async (progress, token) => {
                        let audited = 0;
                        for (const file of files) {
                            if (token.isCancellationRequested) break;

                            progress.report({
                                message: `${audited}/${files.length} files`,
                                increment: (1 / files.length) * 100,
                            });

                            try {
                                const doc =
                                    await vscode.workspace.openTextDocument(
                                        file,
                                    );
                                await diagnosticsProvider!.auditDocument(doc);
                            } catch {
                                // Skip files that fail to open or audit
                            }

                            audited++;
                        }

                        return audited;
                    },
                );

                log(`Workspace audit complete: ${progress} files audited`);
                vscode.window.showInformationMessage(
                    `Flint: Audited ${progress} files.`,
                );
            },
        ),
    );

    // Audit all currently open documents
    for (const doc of vscode.workspace.textDocuments) {
        diagnosticsProvider.auditDocument(doc);
    }

    // Show status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
    );
    statusBarItem.text = '$(shield) Flint';
    statusBarItem.tooltip = 'Flint Governance is active';
    statusBarItem.command = 'flint.auditFile';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Track whether we've already shown a Glass sync warning this session.
    // One warning is enough — don't spam on every file switch.
    let glassSyncWarningShown = false;

    // ── Herald: "Open in Flint Glass" command ────────────────────────────────
    // Shared sync write function used by both auto-follow and explicit command.
    function sendFileToGlass(filePath: string, opts?: { explicit?: boolean }): void {
        const flintDir = path.join(workspaceRoot, '.flint');
        const syncFile = path.join(flintDir, 'ide-active-file.json');
        const ts = Date.now();
        // Include `explicit: true` when the user deliberately invoked "Open in
        // Flint Glass". The server tick uses this flag to bypass the lastPath
        // dedup guard so Glass always receives an explicit command broadcast,
        // even when the same file was previously loaded.
        const syncPayload = JSON.stringify(
            opts?.explicit
                ? { path: filePath, ts, explicit: true }
                : { path: filePath, ts },
        );
        log(`[IDE-SYNC-DEBUG] sendFileToGlass called — path=${filePath} ts=${ts} explicit=${opts?.explicit ?? false}`);
        const writeSync = () =>
            fs.promises.mkdir(flintDir, { recursive: true })
                .then(() => fs.promises.writeFile(syncFile, syncPayload, 'utf8'));

        writeSync()
            .then(() => {
                log(`[IDE-SYNC-DEBUG] sendFileToGlass write OK — path=${filePath} ts=${ts}`);
                if (opts?.explicit) {
                    // Brief status bar flash for intentional sends
                    const prev = statusBarItem.text;
                    statusBarItem.text = '$(eye) Sent to Glass';
                    setTimeout(() => { statusBarItem.text = prev; }, 2000);
                    log(`Sent to Glass: ${filePath}`);
                }
            })
            .catch(() => {
                // Retry once after 500ms — handles transient filesystem issues
                setTimeout(() => {
                    writeSync().catch((err: unknown) => {
                        const msg = err instanceof Error ? err.message : String(err);
                        log(`Glass sync write failed: ${msg}`);
                        if (opts?.explicit) {
                            vscode.window.showWarningMessage(
                                `Could not send file to Glass. Is the .flint/ directory writable?`,
                            );
                        }
                        if (!glassSyncWarningShown) {
                            glassSyncWarningShown = true;
                            statusBarItem.text = '$(warning) Flint: Glass sync paused';
                            statusBarItem.tooltip = 'Could not write .flint/ide-active-file.json — Glass will not follow IDE focus. Check the Flint output channel for details.';
                            setTimeout(() => {
                                statusBarItem.text = '$(shield) Flint';
                                statusBarItem.tooltip = 'Flint Governance is active';
                            }, 10_000);
                        }
                    });
                }, 500);
            });
    }

    // Register the "Open in Flint Glass" command — accessible from:
    //   - Explorer context menu (right-click a file)
    //   - Editor context menu (right-click in code)
    //   - Editor tab context menu (right-click a tab)
    //   - Keyboard shortcut: Cmd+Shift+G / Ctrl+Shift+G
    //   - Command palette: "Open in Flint Glass"
    context.subscriptions.push(
        vscode.commands.registerCommand('flint.openInGlass', (uri?: vscode.Uri) => {
            // Determine the file path from the command context:
            // 1. URI passed directly (from explorer/tab context menu)
            // 2. Active editor (from editor context menu or keyboard shortcut)
            const filePath = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
            if (!filePath) {
                vscode.window.showWarningMessage('No file selected. Open a file first.');
                return;
            }
            // Guard: only source files
            if (!/\.(tsx?|jsx?)$/.test(filePath)) {
                vscode.window.showWarningMessage(
                    'Flint Glass previews .tsx, .ts, .jsx, and .js files.',
                );
                return;
            }
            sendFileToGlass(filePath, { explicit: true });
        }),
    );

    // -- Webview panels --------------------------------------------------------

    // MCP tool call wrapper with activity logging
    const activityProvider = new ActivityPanelProvider(context.extensionUri);

    const callMcpTool = async (
        tool: string,
        params: Record<string, unknown>,
    ): Promise<unknown> => {
        const start = Date.now();
        try {
            const result = await client!.callTool(tool, params);
            const durationMs = Date.now() - start;
            log(`MCP tool ${tool}: success (${durationMs}ms)`);
            activityProvider.logToolCall(tool, 'success', durationMs);
            return result;
        } catch (err) {
            const durationMs = Date.now() - start;
            log(`MCP tool ${tool}: error (${durationMs}ms) -- ${String(err)}`);
            activityProvider.logToolCall(tool, 'error', durationMs);
            throw err;
        }
    };

    const governanceProvider = new GovernancePanelProvider(
        context.extensionUri,
        callMcpTool,
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            GovernancePanelProvider.viewType,
            governanceProvider,
        ),
        vscode.window.registerWebviewViewProvider(
            ActivityPanelProvider.viewType,
            activityProvider,
        ),
    );

    // Update governance panel when active editor changes (debounced)
    let editorChangeTimer: ReturnType<typeof setTimeout> | null = null;
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (!editor) return;

            const filePath = editor.document.uri.fsPath;

            // IDE->Glass file sync: write active file so Flint Glass can follow focus.
            // Runs unconditionally -- Glass sync works even when MCP is not connected.
            // Uses the shared sendFileToGlass function (same path as the explicit command).
            sendFileToGlass(filePath);

            // Debounce the governance audit to prevent flooding on rapid tab switching
            if (editorChangeTimer) clearTimeout(editorChangeTimer);
            editorChangeTimer = setTimeout(async () => {
                editorChangeTimer = null;
                // Governance audit requires MCP connection.
                if (!client?.isConnected()) return;
                try {
                    const result = await callMcpTool('flint_audit', {
                        source: editor.document.getText(),
                        filePath,
                    });
                    // Extract violations from MCP response
                    let violations: unknown[] = [];
                    const raw = result as { content?: Array<{ text?: string }> };
                    if (raw?.content?.[0]?.text) {
                        try {
                            const parsed = JSON.parse(raw.content[0].text) as {
                                violations?: unknown[];
                            };
                            violations = parsed.violations ?? [];
                        } catch {
                            // Non-JSON response -- leave violations empty
                        }
                    }
                    governanceProvider.updateForFile(violations, filePath);
                } catch {
                    // Audit failed -- update with empty violations
                    governanceProvider.updateForFile([], filePath);
                }
            }, 300);
        }),
    );

    log('Flint extension activated successfully');
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
        client = null;
    }
    diagnosticsProvider = null;
}

// -- Fallback commands when server is not available -------------------------

function registerCommandsWithoutServer(
    context: vscode.ExtensionContext,
): void {
    const showNotConnected = () => {
        vscode.window.showWarningMessage(
            'Flint MCP server is not available. ' +
                'Ensure flint-mcp is built and the workspace contains flint-manifest.json.',
        );
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('flint.auditFile', showNotConnected),
        vscode.commands.registerCommand(
            'flint.auditWorkspace',
            showNotConnected,
        ),
    );
}
