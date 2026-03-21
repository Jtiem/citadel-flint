/**
 * vscode-extension/src/diagnostics.ts
 *
 * Converts Flint audit violations into VS Code Diagnostic objects.
 * Pure transformation functions are exported separately for unit testing.
 */

import * as vscode from 'vscode';
import type { FlintClient, MCPCallResult } from './flintClient';
import { getConfiguration } from './configuration';

// -- Types ------------------------------------------------------------------

export interface FlintViolation {
    id: string;
    ruleId: string;
    severity: string;
    message: string;
    type: string;
    explanation?: string;
    recovery?: string;
    provenance?: {
        sourceAuthority?: string;
        regulatoryReference?: string;
        rationale?: string;
    };
}

export interface AuditResponse {
    violations: FlintViolation[];
    mithrilCount: number;
    a11yCount: number;
    summary: string;
}

// -- Pure transformation functions (testable without VS Code API) -----------

/**
 * Maps a Flint violation severity to a VS Code DiagnosticSeverity number.
 * - A11y critical -> Error (0)
 * - Everything else -> Warning (1)
 * - Advisory -> Information (2)
 */
export function mapSeverity(violation: FlintViolation): number {
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
export function extractDeltaE(message: string): number | null {
    const match1 = /(?:Delta-E|ΔE)\s*[:=]\s*([\d.]+)/i.exec(message);
    if (match1) return parseFloat(match1[1]!);

    const match2 = /deltaE\s+([\d.]+)/i.exec(message);
    if (match2) return parseFloat(match2[1]!);

    return null;
}

/**
 * Extracts the suggested token name from a violation message.
 */
export function extractSuggestedToken(message: string): string | null {
    const match = /(?:nearest token|suggested|replace with)\s*[:=]?\s*[`"]?([^\s`",.]+)/i.exec(message);
    return match ? match[1]! : null;
}

/**
 * Builds a diagnostic message with rule ID, Delta-E, suggested token, provenance.
 */
export function buildDiagnosticMessage(violation: FlintViolation): string {
    const parts: string[] = [];
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
export function parseAuditResponse(result: MCPCallResult): AuditResponse | null {
    if (result.isError) return null;

    const textContent = result.content?.find((c) => c.type === 'text');
    if (!textContent?.text) return null;

    try {
        const parsed = JSON.parse(textContent.text);
        if (!Array.isArray(parsed.violations)) return null;
        return parsed as AuditResponse;
    } catch {
        return null;
    }
}

// -- DiagnosticsProvider class ----------------------------------------------

export class DiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];
    private client: FlintClient;

    constructor(client: FlintClient) {
        this.client = client;
        this.diagnosticCollection =
            vscode.languages.createDiagnosticCollection('Flint');

        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((doc) => {
                const config = getConfiguration();
                if (config.enabled && config.auditOnSave) {
                    this.auditDocument(doc);
                }
            }),
        );

        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                const config = getConfiguration();
                if (config.enabled && this.isAuditableDocument(doc)) {
                    this.auditDocument(doc);
                }
            }),
        );

        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument((doc) => {
                this.diagnosticCollection.delete(doc.uri);
            }),
        );
    }

    async auditDocument(document: vscode.TextDocument): Promise<void> {
        if (!this.isAuditableDocument(document)) return;
        if (!this.client.isConnected()) return;

        const config = getConfiguration();
        if (!config.enabled) return;

        try {
            const source = document.getText();
            const filePath = document.uri.fsPath;

            const result = await this.client.callTool('flint_audit', {
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

            const diagnostics = auditResponse.violations.map((violation) =>
                this.violationToDiagnostic(violation, document),
            );

            this.diagnosticCollection.set(document.uri, diagnostics);
        } catch {
            this.diagnosticCollection.delete(document.uri);
        }
    }

    getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private isAuditableDocument(doc: vscode.TextDocument): boolean {
        const auditableLanguages = new Set([
            'typescriptreact',
            'javascriptreact',
            'typescript',
            'javascript',
        ]);
        return auditableLanguages.has(doc.languageId);
    }

    private violationToDiagnostic(
        violation: FlintViolation,
        document: vscode.TextDocument,
    ): vscode.Diagnostic {
        const range = this.extractRange(violation, document);
        const severity = mapSeverity(violation);
        const message = buildDiagnosticMessage(violation);

        const diagnostic = new vscode.Diagnostic(
            range,
            message,
            severity as vscode.DiagnosticSeverity,
        );

        diagnostic.source = 'Flint';
        diagnostic.code = violation.ruleId;
        (diagnostic as DiagnosticWithViolation).flintViolation = violation;

        return diagnostic;
    }

    private extractRange(
        violation: FlintViolation,
        document: vscode.TextDocument,
    ): vscode.Range {
        const lineMatch = /^[^:]+:(\d+):(\d+)$/.exec(violation.id);
        if (lineMatch) {
            const line = Math.max(0, parseInt(lineMatch[1]!, 10) - 1);
            const col = Math.max(0, parseInt(lineMatch[2]!, 10));
            if (line < document.lineCount) {
                const lineText = document.lineAt(line);
                return new vscode.Range(
                    line,
                    col,
                    line,
                    lineText.range.end.character,
                );
            }
        }

        return new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER);
    }
}

export interface DiagnosticWithViolation extends vscode.Diagnostic {
    flintViolation?: FlintViolation;
}
