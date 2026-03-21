/**
 * V.3 — Plugin Registry
 *
 * Central registry for language adapters and linter plugins.
 * Provides a single `audit()` entry point that:
 *   1. Resolves the adapter for the file
 *   2. Parses into a FlintDocument
 *   3. Runs all registered linter plugins
 *   4. Returns a unified audit result
 */

import type { LanguageAdapter } from "./adapter.js";
import type { LinterPlugin, LintViolation } from "./linterPlugin.js";
import { walk } from "./flintNode.js";
import type { FlintDocument } from "./flintNode.js";
import path from "node:path";

// ---------------------------------------------------------------------------
// Audit Result
// ---------------------------------------------------------------------------

export interface UniversalAuditResult {
    filePath: string;
    language: string;
    violations: LintViolation[];
    pluginsRun: string[];
    parseTimestamp: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class PluginRegistry {
    private adapters: Map<string, LanguageAdapter> = new Map();
    private extensionMap: Map<string, string> = new Map();
    private plugins: LinterPlugin[] = [];

    /** Register a language adapter. */
    registerAdapter(adapter: LanguageAdapter): void {
        this.adapters.set(adapter.id, adapter);
        for (const ext of adapter.fileExtensions) {
            this.extensionMap.set(ext.startsWith(".") ? ext : `.${ext}`, adapter.id);
        }
    }

    /** Register a linter plugin. */
    registerPlugin(plugin: LinterPlugin): void {
        this.plugins.push(plugin);
    }

    /** Resolve adapter by file path extension, or by explicit id. */
    getAdapterForFile(filePath: string): LanguageAdapter | null {
        const basename = path.basename(filePath).toLowerCase();
        // Sort by length descending so compound extensions (.schema.json) match before simple (.json)
        const sorted = [...this.extensionMap.entries()].sort((a, b) => b[0].length - a[0].length);
        for (const [ext, adapterId] of sorted) {
            if (basename.endsWith(ext)) {
                return this.adapters.get(adapterId) ?? null;
            }
        }
        return null;
    }

    /** Get adapter by id. */
    getAdapter(id: string): LanguageAdapter | null {
        return this.adapters.get(id) ?? null;
    }

    /** Return all registered plugins. */
    getPlugins(): LinterPlugin[] {
        return [...this.plugins];
    }

    /**
     * Audit a source file through the universal engine.
     *
     * 1. Resolve adapter (by extension or explicit override)
     * 2. Parse source into FlintDocument
     * 3. Walk the tree, running all plugin rules on every node
     * 4. Return unified result
     */
    audit(
        source: string,
        filePath: string,
        config?: Record<string, unknown>,
        adapterOverride?: string,
    ): UniversalAuditResult {
        // Resolve adapter
        const adapter = adapterOverride
            ? this.adapters.get(adapterOverride) ?? null
            : this.getAdapterForFile(filePath);

        if (!adapter) {
            throw new Error(
                `No adapter registered for file "${filePath}"${adapterOverride ? ` (override: ${adapterOverride})` : ""}`,
            );
        }

        // Parse
        const document: FlintDocument = adapter.parse(source, filePath);

        // Lint
        const violations: LintViolation[] = [];
        const pluginsRun: string[] = [];
        const effectiveConfig = config ?? {};

        for (const plugin of this.plugins) {
            pluginsRun.push(plugin.id);
            const ctx = { document, config: effectiveConfig };
            walk(document.root, {
                enter(node) {
                    for (const rule of plugin.rules) {
                        const v = rule.visit(node, ctx);
                        if (v) violations.push(v);
                    }
                },
            });
        }

        return {
            filePath,
            language: document.language,
            violations,
            pluginsRun,
            parseTimestamp: document.parseTimestamp,
        };
    }
}
