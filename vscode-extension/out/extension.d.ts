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
import * as vscode from 'vscode';
export declare function activate(context: vscode.ExtensionContext): Promise<void>;
export declare function deactivate(): Promise<void>;
//# sourceMappingURL=extension.d.ts.map