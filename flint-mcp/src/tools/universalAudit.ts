/**
 * V.3 — flint_universal_audit MCP Tool
 *
 * Audits any file using the universal engine (adapter + plugins).
 */

import fs from "node:fs";
import path from "node:path";
import { PluginRegistry } from "../core/universal/registry.js";
import { JSXAdapter } from "../core/universal/adapters/jsx-adapter.js";
import { JSONSchemaAdapter } from "../core/universal/adapters/json-schema-adapter.js";
import type { UniversalAuditResult } from "../core/universal/registry.js";
import { handleFlintFix } from "./fix.js";
import type { FlintConfig } from "../core/config.js";

// ---------------------------------------------------------------------------
// Default registry with built-in adapters
// ---------------------------------------------------------------------------

let _defaultRegistry: PluginRegistry | null = null;

export function getDefaultRegistry(): PluginRegistry {
    if (!_defaultRegistry) {
        _defaultRegistry = new PluginRegistry();
        _defaultRegistry.registerAdapter(new JSXAdapter());
        _defaultRegistry.registerAdapter(new JSONSchemaAdapter());
    }
    return _defaultRegistry;
}

/** Reset for testing. */
export function resetDefaultRegistry(): void {
    _defaultRegistry = null;
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export const FLINT_UNIVERSAL_AUDIT_TOOL = {
    name: "flint_universal_audit",
    description:
        "V.3: Audit any file using the domain-agnostic universal engine. Resolves the language adapter by extension (or explicit override), parses into a canonical FlintNode tree, and runs all registered linter plugins. Returns violations, adapter used, and plugin list.",
    inputSchema: {
        type: "object" as const,
        properties: {
            filePath: {
                type: "string",
                description: "Absolute path to the file to audit.",
            },
            projectRoot: {
                type: "string",
                description: "Absolute path to the project root.",
            },
            adapterOverride: {
                type: "string",
                description:
                    "Force a specific adapter id (e.g. 'jsx', 'json-schema') instead of auto-detecting by extension.",
            },
            autoFix: {
                type: "boolean",
                description:
                    "When true, automatically fix detected violations using the existing Babel AST fix pipeline after the audit completes. Defaults to false.",
            },
        },
        required: ["filePath", "projectRoot"],
    },
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface AutoFixResult {
    applied: boolean;
    fixCount: number;
    errors: string[];
}

export async function handleUniversalAudit(
    args: {
        filePath: string;
        projectRoot: string;
        adapterOverride?: string;
        autoFix?: boolean;
    },
    config?: FlintConfig,
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const { filePath, projectRoot, adapterOverride, autoFix } = args;

    const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);

    if (!fs.existsSync(absPath)) {
        return {
            isError: true,
            content: [{ type: "text", text: `File not found: ${absPath}` }],
        };
    }

    const source = fs.readFileSync(absPath, "utf-8");
    const registry = getDefaultRegistry();

    let result: UniversalAuditResult;
    try {
        result = registry.audit(source, absPath, {}, adapterOverride);
    } catch (err: any) {
        return {
            isError: true,
            content: [{ type: "text", text: `Universal audit error: ${err.message}` }],
        };
    }

    const responsePayload: Record<string, unknown> = {
        filePath: result.filePath,
        language: result.language,
        violationCount: result.violations.length,
        violations: result.violations,
        pluginsRun: result.pluginsRun,
    };

    // autoFix path: when enabled and violations exist, run the existing fix pipeline
    if (autoFix === true && result.violations.length > 0 && config) {
        const autoFixResult: AutoFixResult = { applied: false, fixCount: 0, errors: [] };
        try {
            const fixResult = await handleFlintFix(
                { file: absPath, dryRun: false },
                config,
            );
            autoFixResult.applied = fixResult.fixesApplied > 0;
            autoFixResult.fixCount = fixResult.fixesApplied;
        } catch (err: any) {
            autoFixResult.errors.push(err.message ?? String(err));
        }
        responsePayload.autoFixResult = autoFixResult;
    } else if (autoFix === true && result.violations.length === 0) {
        // No violations — skip fix, but include the result shape for consistency
        responsePayload.autoFixResult = { applied: false, fixCount: 0, errors: [] } satisfies AutoFixResult;
    }

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(responsePayload, null, 2),
            },
        ],
    };
}
