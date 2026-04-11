/**
 * flint-vscode/src/diagnosticsProvider.ts
 *
 * Converts Flint audit violations into VS Code Diagnostic objects.
 * Responsible for:
 *   - Mapping violation severity to DiagnosticSeverity
 *   - Building hover text with rule ID, Delta-E score, suggested token, provenance
 *   - Triggering audits on file save and file open
 *
 * Pure transformation functions are exported separately for unit testing.
 */

import * as vscode from 'vscode';
import type { FlintClient, MCPCallResult } from './flintClient';

// -- Types ------------------------------------------------------------------

/**
 * A single violation from the flint_audit tool response.
 * Mirrors AuditResult.violations[n] from flint-mcp/src/tools/audit.ts.
 */
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

/**
 * The parsed response from flint_audit tool call.
 */
export interface AuditResponse {
    violations: FlintViolation[];
    mithrilCount: number;
    a11yCount: number;
    summary: string;
}

// -- Pure transformation functions (testable without VS Code API) -----------

/**
 * Maps a Flint violation severity string to a VS Code DiagnosticSeverity.
 *
 * - Mithril violations (amber/warning) -> Warning (amber squiggles)
 * - A11y critical -> Error
 * - A11y warning -> Warning
 * - Fallback -> Warning
 */
export function mapSeverity(
    violation: FlintViolation,
): typeof vscode.DiagnosticSeverity extends { Error: infer E } ? number : never {
    // A11y violations marked as critical -> Error
    if (violation.type === 'a11y' && violation.severity === 'critical') {
        return 0; // vscode.DiagnosticSeverity.Error
    }

    // Everything else -> Warning (amber squiggles)
    return 1; // vscode.DiagnosticSeverity.Warning
}

/**
 * Extracts the Delta-E score from a Mithril violation message.
 * Messages follow the pattern: "... (Delta-E: 12.34)" or "... ΔE = 12.34"
 */
export function extractDeltaE(message: string): number | null {
    // Pattern 1: "Delta-E: 12.34" or "ΔE: 12.34"
    const match1 = /(?:Delta-E|ΔE)\s*[:=]\s*([\d.]+)/i.exec(message);
    if (match1) {
        return parseFloat(match1[1]!);
    }

    // Pattern 2: "deltaE 12.34" (from Mithril linter messages)
    const match2 = /deltaE\s+([\d.]+)/i.exec(message);
    if (match2) {
        return parseFloat(match2[1]!);
    }

    return null;
}

/**
 * Extracts the suggested token name from a violation message.
 * Messages typically include "nearest token: color/primary/500" or
 * "suggested: --color-primary-500".
 */
export function extractSuggestedToken(message: string): string | null {
    const match = /(?:nearest token|suggested|replace with)\s*[:=]?\s*[`"]?([^\s`",.]+)/i.exec(message);
    return match ? match[1]! : null;
}

/**
 * Builds a human-readable diagnostic message with full context.
 * Includes: rule ID, Delta-E score (if present), suggested token, provenance authority.
 */
export function buildDiagnosticMessage(violation: FlintViolation): string {
    const parts: string[] = [];

    // Rule ID prefix
    parts.push(`[${violation.ruleId}]`);

    // Core message
    parts.push(violation.message);

    // Delta-E score for color drift violations
    const deltaE = extractDeltaE(violation.message);
    if (deltaE !== null) {
        parts.push(`(Delta-E: ${deltaE.toFixed(2)})`);
    }

    // Suggested token
    const suggestedToken = extractSuggestedToken(violation.message);
    if (suggestedToken) {
        parts.push(`| Suggested: ${suggestedToken}`);
    }

    // Provenance authority
    if (violation.provenance?.sourceAuthority) {
        parts.push(`| Authority: ${violation.provenance.sourceAuthority}`);
    }

    return parts.join(' ');
}

/**
 * Parses the text content of an MCP tool call result into an AuditResponse.
 * The flint_audit tool returns JSON in content[0].text.
 */
export function parseAuditResponse(
    result: MCPCallResult,
): AuditResponse | null {
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

/** Debounce delay for audit triggers (ms). Exported for testing. */
export const AUDIT_DEBOUNCE_MS = 300;

export class DiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];
    private client: FlintClient;
    /** Per-file debounce timers keyed by URI string. */
    private auditTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(client: FlintClient) {
        this.client = client;
        this.diagnosticCollection =
            vscode.languages.createDiagnosticCollection('Flint');

        // Audit on file save (debounced)
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((doc) => {
                const config = vscode.workspace.getConfiguration('flint');
                if (config.get<boolean>('autoAuditOnSave', true)) {
                    this.debouncedAudit(doc);
                }
            }),
        );

        // Audit on file open (debounced)
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                if (this.isAuditableDocument(doc)) {
                    this.debouncedAudit(doc);
                }
            }),
        );

        // Clear diagnostics when a file is closed
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument((doc) => {
                this.diagnosticCollection.delete(doc.uri);
            }),
        );
    }

    /**
     * Runs flint_audit on a document and publishes diagnostics.
     */
    async auditDocument(document: vscode.TextDocument): Promise<void> {
        if (!this.isAuditableDocument(document)) return;
        if (!this.client.isConnected()) return;

        try {
            const source = document.getText();
            const filePath = document.uri.fsPath;

            const result = await this.client.callTool('flint_audit', {
                source,
                filePath,
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
        } catch (err) {
            // Audit failure should not block the user -- silently clear diagnostics
            this.diagnosticCollection.delete(document.uri);
        }
    }

    /**
     * Returns the diagnostic collection (used by CodeActionProvider to match).
     */
    getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    /**
     * Schedules an audit with debounce. Resets the timer if called again
     * for the same file within AUDIT_DEBOUNCE_MS, preventing audit floods
     * from rapid tab switching or concurrent open+save events.
     */
    debouncedAudit(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        const existing = this.auditTimers.get(key);
        if (existing) clearTimeout(existing);
        this.auditTimers.set(
            key,
            setTimeout(() => {
                this.auditTimers.delete(key);
                this.auditDocument(document);
            }, AUDIT_DEBOUNCE_MS),
        );
    }

    dispose(): void {
        // Clear all pending debounce timers
        for (const timer of this.auditTimers.values()) {
            clearTimeout(timer);
        }
        this.auditTimers.clear();
        this.diagnosticCollection.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    // -- Internal -----------------------------------------------------------

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
        // Flint violations do not currently carry line/column info.
        // Default to line 0, full first line. When the violation id
        // contains a line hint (e.g., "node:5:0"), extract it.
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

        // Store the full violation in the diagnostic for CodeActionProvider
        (diagnostic as DiagnosticWithViolation).flintViolation = violation;

        return diagnostic;
    }

    /**
     * Attempts to extract a source range from the violation.
     * Falls back to the first line if no positional info is available.
     */
    private extractRange(
        violation: FlintViolation,
        document: vscode.TextDocument,
    ): vscode.Range {
        // Flint node IDs use format "tagName:line:col" (1-based)
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

        // Fallback: full first line
        return new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER);
    }
}

/**
 * Extended Diagnostic type that carries the original Flint violation data.
 * Used by CodeActionProvider to identify fixable violations.
 */
export interface DiagnosticWithViolation extends vscode.Diagnostic {
    flintViolation?: FlintViolation;
}
