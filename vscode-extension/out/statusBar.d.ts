/**
 * vscode-extension/src/statusBar.ts
 *
 * Manages the Bridge status bar item showing violation count for the active file.
 * Color-coded: green (0), yellow (warnings only), red (has errors).
 */
import * as vscode from 'vscode';
export declare class BridgeStatusBar implements vscode.Disposable {
    private item;
    private diagnosticCollection;
    private disposables;
    constructor(diagnosticCollection: vscode.DiagnosticCollection);
    /**
     * Refreshes the status bar text and color based on current diagnostics.
     */
    update(): void;
    dispose(): void;
}
//# sourceMappingURL=statusBar.d.ts.map