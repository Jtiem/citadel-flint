"use strict";
/**
 * vscode-extension/src/configuration.ts
 *
 * Reads and exposes Bridge extension settings from VS Code configuration.
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
exports.getConfiguration = getConfiguration;
exports.onConfigurationChanged = onConfigurationChanged;
const vscode = __importStar(require("vscode"));
/**
 * Reads all Bridge configuration values from VS Code settings.
 */
function getConfiguration() {
    const config = vscode.workspace.getConfiguration('bridge');
    return {
        enabled: config.get('enabled', true),
        auditOnSave: config.get('auditOnSave', true),
        deltaEThreshold: config.get('deltaEThreshold', 2.0),
        conformanceLevel: config.get('conformanceLevel', 'AA'),
        serverPath: config.get('serverPath', ''),
    };
}
/**
 * Registers a listener for configuration changes affecting Bridge settings.
 * Returns a disposable that should be added to the extension context.
 */
function onConfigurationChanged(callback) {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('bridge')) {
            callback(getConfiguration());
        }
    });
}
//# sourceMappingURL=configuration.js.map