"use strict";
/**
 * vscode-extension/src/statusBar.ts
 *
 * Manages the Bridge status bar item showing violation count for the active file.
 * Color-coded: green (0), yellow (warnings only), red (has errors).
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
exports.BridgeStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class BridgeStatusBar {
    item;
    diagnosticCollection;
    disposables = [];
    constructor(diagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'workbench.action.problems.focus';
        this.item.show();
        // Update on active editor change
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.update()));
        // Update when any diagnostics change globally
        this.disposables.push(vscode.languages.onDidChangeDiagnostics(() => this.update()));
        this.update();
    }
    /**
     * Refreshes the status bar text and color based on current diagnostics.
     */
    update() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.item.text = '$(shield) Bridge';
            this.item.tooltip = 'Bridge Governance — no active file';
            this.item.backgroundColor = undefined;
            return;
        }
        const diagnostics = this.diagnosticCollection.get(editor.document.uri) ?? [];
        const errorCount = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length;
        const warningCount = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning).length;
        const total = diagnostics.length;
        if (total === 0) {
            this.item.text = '$(shield) Bridge: 0';
            this.item.tooltip = 'Bridge Governance — no violations';
            this.item.backgroundColor = undefined;
        }
        else if (errorCount > 0) {
            this.item.text = `$(shield) Bridge: ${total}`;
            this.item.tooltip = `Bridge: ${errorCount} error(s), ${warningCount} warning(s)`;
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        else {
            this.item.text = `$(shield) Bridge: ${total}`;
            this.item.tooltip = `Bridge: ${warningCount} warning(s)`;
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }
    dispose() {
        this.item.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.BridgeStatusBar = BridgeStatusBar;
//# sourceMappingURL=statusBar.js.map