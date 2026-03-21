/**
 * vscode-extension/src/diagnostics.ts
 *
 * Converts Bridge audit violations into VS Code Diagnostic objects.
 * Pure transformation functions are exported separately for unit testing.
 */
import * as vscode from 'vscode';
import type { BridgeClient, MCPCallResult } from './bridgeClient';
export interface BridgeViolation {
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
    violations: BridgeViolation[];
    mithrilCount: number;
    a11yCount: number;
    summary: string;
}
/**
 * Maps a Bridge violation severity to a VS Code DiagnosticSeverity number.
 * - A11y critical -> Error (0)
 * - Everything else -> Warning (1)
 * - Advisory -> Information (2)
 */
export declare function mapSeverity(violation: BridgeViolation): number;
/**
 * Extracts the Delta-E score from a Mithril violation message.
 */
export declare function extractDeltaE(message: string): number | null;
/**
 * Extracts the suggested token name from a violation message.
 */
export declare function extractSuggestedToken(message: string): string | null;
/**
 * Builds a diagnostic message with rule ID, Delta-E, suggested token, provenance.
 */
export declare function buildDiagnosticMessage(violation: BridgeViolation): string;
/**
 * Parses an MCP tool call result into an AuditResponse.
 */
export declare function parseAuditResponse(result: MCPCallResult): AuditResponse | null;
export declare class DiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection;
    private disposables;
    private client;
    constructor(client: BridgeClient);
    auditDocument(document: vscode.TextDocument): Promise<void>;
    getDiagnosticCollection(): vscode.DiagnosticCollection;
    dispose(): void;
    private isAuditableDocument;
    private violationToDiagnostic;
    private extractRange;
}
export interface DiagnosticWithViolation extends vscode.Diagnostic {
    bridgeViolation?: BridgeViolation;
}
//# sourceMappingURL=diagnostics.d.ts.map