"use strict";
/**
 * vscode-extension/src/diagnostics.ts
 *
 * Converts Bridge audit violations into VS Code Diagnostic objects.
 * Pure transformation functions are exported separately for unit testing.
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
exports.DiagnosticsProvider = void 0;
exports.mapSeverity = mapSeverity;
exports.extractDeltaE = extractDeltaE;
exports.extractSuggestedToken = extractSuggestedToken;
exports.buildDiagnosticMessage = buildDiagnosticMessage;
exports.parseAuditResponse = parseAuditResponse;
const vscode = __importStar(require("vscode"));
const configuration_1 = require("./configuration");
// -- Pure transformation functions (testable without VS Code API) -----------
/**
 * Maps a Bridge violation severity to a VS Code DiagnosticSeverity number.
 * - A11y critical -> Error (0)
 * - Everything else -> Warning (1)
 * - Advisory -> Information (2)
 */
function mapSeverity(violation) {
    if (violation.type === 'a11y' && violation.severity === 'critical') {
        return 0; // vscode.DiagnosticSeverity.Error
    }
    if (violation.severity === 'advisory' || violation.severity === 'info') {
        return 2; // vscode.DiagnosticSeverity.Information
    }
    return 1; // vscode.DiagnosticSeverity.Warning
}
/**
 * Extracts the Delta-E score from a Mithril violation message.
 */
function extractDeltaE(message) {
    const match1 = /(?:Delta-E|ΔE)\s*[:=]\s*([\d.]+)/i.exec(message);
    if (match1)
        return parseFloat(match1[1]);
    const match2 = /deltaE\s+([\d.]+)/i.exec(message);
    if (match2)
        return parseFloat(match2[1]);
    return null;
}
/**
 * Extracts the suggested token name from a violation message.
 */
function extractSuggestedToken(message) {
    const match = /(?:nearest token|suggested|replace with)\s*[:=]?\s*[`"]?([^\s`",.]+)/i.exec(message);
    return match ? match[1] : null;
}
/**
 * Builds a diagnostic message with rule ID, Delta-E, suggested token, provenance.
 */
function buildDiagnosticMessage(violation) {
    const parts = [];
    parts.push(`[${violation.ruleId}]`);
    parts.push(violation.message);
    const deltaE = extractDeltaE(violation.message);
    if (deltaE !== null) {
        parts.push(`(Delta-E: ${deltaE.toFixed(2)})`);
    }
    const suggestedToken = extractSuggestedToken(violation.message);
    if (suggestedToken) {
        parts.push(`| Suggested: ${suggestedToken}`);
    }
    if (violation.provenance?.sourceAuthority) {
        parts.push(`| Authority: ${violation.provenance.sourceAuthority}`);
    }
    return parts.join(' ');
}
/**
 * Parses an MCP tool call result into an AuditResponse.
 */
function parseAuditResponse(result) {
    if (result.isError)
        return null;
    const textContent = result.content?.find((c) => c.type === 'text');
    if (!textContent?.text)
        return null;
    try {
        const parsed = JSON.parse(textContent.text);
        if (!Array.isArray(parsed.violations))
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
// -- DiagnosticsProvider class ----------------------------------------------
class DiagnosticsProvider {
    diagnosticCollection;
    disposables = [];
    client;
    constructor(client) {
        this.client = client;
        this.diagnosticCollection =
            vscode.languages.createDiagnosticCollection('Bridge');
        this.disposables.push(vscode.workspace.onDidSaveTextDocument((doc) => {
            const config = (0, configuration_1.getConfiguration)();
            if (config.enabled && config.auditOnSave) {
                this.auditDocument(doc);
            }
        }));
        this.disposables.push(vscode.workspace.onDidOpenTextDocument((doc) => {
            const config = (0, configuration_1.getConfiguration)();
            if (config.enabled && this.isAuditableDocument(doc)) {
                this.auditDocument(doc);
            }
        }));
        this.disposables.push(vscode.workspace.onDidCloseTextDocument((doc) => {
            this.diagnosticCollection.delete(doc.uri);
        }));
    }
    async auditDocument(document) {
        if (!this.isAuditableDocument(document))
            return;
        if (!this.client.isConnected())
            return;
        const config = (0, configuration_1.getConfiguration)();
        if (!config.enabled)
            return;
        try {
            const source = document.getText();
            const filePath = document.uri.fsPath;
            const result = await this.client.callTool('bridge_audit', {
                source,
                filePath,
                deltaEThreshold: config.deltaEThreshold,
                conformanceLevel: config.conformanceLevel,
            });
            const auditResponse = parseAuditResponse(result);
            if (!auditResponse) {
                this.diagnosticCollection.delete(document.uri);
                return;
            }
            const diagnostics = auditResponse.violations.map((violation) => this.violationToDiagnostic(violation, document));
            this.diagnosticCollection.set(document.uri, diagnostics);
        }
        catch {
            this.diagnosticCollection.delete(document.uri);
        }
    }
    getDiagnosticCollection() {
        return this.diagnosticCollection;
    }
    dispose() {
        this.diagnosticCollection.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
    isAuditableDocument(doc) {
        const auditableLanguages = new Set([
            'typescriptreact',
            'javascriptreact',
            'typescript',
            'javascript',
        ]);
        return auditableLanguages.has(doc.languageId);
    }
    violationToDiagnostic(violation, document) {
        const range = this.extractRange(violation, document);
        const severity = mapSeverity(violation);
        const message = buildDiagnosticMessage(violation);
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = 'Bridge';
        diagnostic.code = violation.ruleId;
        diagnostic.bridgeViolation = violation;
        return diagnostic;
    }
    extractRange(violation, document) {
        const lineMatch = /^[^:]+:(\d+):(\d+)$/.exec(violation.id);
        if (lineMatch) {
            const line = Math.max(0, parseInt(lineMatch[1], 10) - 1);
            const col = Math.max(0, parseInt(lineMatch[2], 10));
            if (line < document.lineCount) {
                const lineText = document.lineAt(line);
                return new vscode.Range(line, col, line, lineText.range.end.character);
            }
        }
        return new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER);
    }
}
exports.DiagnosticsProvider = DiagnosticsProvider;
//# sourceMappingURL=diagnostics.js.map