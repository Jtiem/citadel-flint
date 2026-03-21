/**
 * vscode-extension/src/configuration.ts
 *
 * Reads and exposes Flint extension settings from VS Code configuration.
 */

import * as vscode from 'vscode';

export interface FlintConfiguration {
    enabled: boolean;
    auditOnSave: boolean;
    deltaEThreshold: number;
    conformanceLevel: 'A' | 'AA' | 'AAA';
    serverPath: string;
}

/**
 * Reads all Flint configuration values from VS Code settings.
 */
export function getConfiguration(): FlintConfiguration {
    const config = vscode.workspace.getConfiguration('flint');
    return {
        enabled: config.get<boolean>('enabled', true),
        auditOnSave: config.get<boolean>('auditOnSave', true),
        deltaEThreshold: config.get<number>('deltaEThreshold', 2.0),
        conformanceLevel: config.get<string>('conformanceLevel', 'AA') as FlintConfiguration['conformanceLevel'],
        serverPath: config.get<string>('serverPath', ''),
    };
}

/**
 * Registers a listener for configuration changes affecting Flint settings.
 * Returns a disposable that should be added to the extension context.
 */
export function onConfigurationChanged(
    callback: (config: FlintConfiguration) => void,
): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('flint')) {
            callback(getConfiguration());
        }
    });
}
