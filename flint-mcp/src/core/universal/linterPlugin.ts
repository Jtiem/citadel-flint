/**
 * V.3 — LinterPlugin Interface
 *
 * Domain-agnostic linting abstraction. Plugins declare rules that visit
 * FlintNode trees and produce violations without coupling to any parser.
 */

import type { FlintNode, FlintDocument } from "./flintNode.js";

// ---------------------------------------------------------------------------
// Lint Types
// ---------------------------------------------------------------------------

export type LintSeverity = "error" | "warning" | "info";

export interface LintViolation {
    ruleId: string;
    nodeId: string;
    message: string;
    severity: LintSeverity;
    fixable: boolean;
}

export interface LintContext {
    document: FlintDocument;
    config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Rule & Plugin
// ---------------------------------------------------------------------------

export interface LinterRule {
    id: string;
    severity: LintSeverity;
    /** Visit a single node; return a violation or null. */
    visit(node: FlintNode, context: LintContext): LintViolation | null;
}

export interface LinterPlugin {
    id: string;
    name: string;
    rules: LinterRule[];
}
