/**
 * vscode-extension/src/configuration.ts
 *
 * Reads and exposes Bridge extension settings from VS Code configuration.
 */
import * as vscode from 'vscode';
export interface BridgeConfiguration {
    enabled: boolean;
    auditOnSave: boolean;
    deltaEThreshold: number;
    conformanceLevel: 'A' | 'AA' | 'AAA';
    serverPath: string;
}
/**
 * Reads all Bridge configuration values from VS Code settings.
 */
export declare function getConfiguration(): BridgeConfiguration;
/**
 * Registers a listener for configuration changes affecting Bridge settings.
 * Returns a disposable that should be added to the extension context.
 */
export declare function onConfigurationChanged(callback: (config: BridgeConfiguration) => void): vscode.Disposable;
//# sourceMappingURL=configuration.d.ts.map