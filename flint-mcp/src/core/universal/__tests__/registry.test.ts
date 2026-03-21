import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "../registry.js";
import { JSXAdapter } from "../adapters/jsx-adapter.js";
import { JSONSchemaAdapter } from "../adapters/json-schema-adapter.js";
import type { LinterPlugin, LinterRule, LintViolation } from "../linterPlugin.js";
import type { FlintNode, FlintDocument } from "../flintNode.js";

describe("PluginRegistry", () => {
    let registry: PluginRegistry;

    beforeEach(() => {
        registry = new PluginRegistry();
    });

    describe("registerAdapter", () => {
        it("registers and resolves JSX adapter by extension", () => {
            registry.registerAdapter(new JSXAdapter());
            expect(registry.getAdapterForFile("App.tsx")).not.toBeNull();
            expect(registry.getAdapterForFile("App.tsx")!.id).toBe("jsx");
        });

        it("resolves JSON Schema adapter", () => {
            registry.registerAdapter(new JSONSchemaAdapter());
            expect(registry.getAdapterForFile("user.schema.json")).not.toBeNull();
            expect(registry.getAdapterForFile("user.schema.json")!.id).toBe("json-schema");
        });

        it("returns null for unknown extension", () => {
            registry.registerAdapter(new JSXAdapter());
            expect(registry.getAdapterForFile("style.css")).toBeNull();
        });

        it("getAdapter by id", () => {
            registry.registerAdapter(new JSXAdapter());
            expect(registry.getAdapter("jsx")).not.toBeNull();
            expect(registry.getAdapter("nope")).toBeNull();
        });
    });

    describe("registerPlugin", () => {
        it("registers and returns plugins", () => {
            const plugin: LinterPlugin = { id: "test", name: "Test Plugin", rules: [] };
            registry.registerPlugin(plugin);
            expect(registry.getPlugins()).toHaveLength(1);
            expect(registry.getPlugins()[0].id).toBe("test");
        });
    });

    describe("audit", () => {
        it("audits JSX source with registered plugin", () => {
            registry.registerAdapter(new JSXAdapter());

            const rule: LinterRule = {
                id: "no-div",
                severity: "warning",
                visit(node: FlintNode): LintViolation | null {
                    if (node.type === "JSXElement" && node.name === "div") {
                        return { ruleId: "no-div", nodeId: node.id, message: "Avoid div", severity: "warning", fixable: false };
                    }
                    return null;
                },
            };
            registry.registerPlugin({ id: "test-lint", name: "Test Lint", rules: [rule] });

            const result = registry.audit(
                `const X = () => <div><span>Hi</span></div>;`,
                "X.tsx",
            );
            expect(result.language).toBe("jsx");
            expect(result.violations.length).toBeGreaterThanOrEqual(1);
            expect(result.violations[0].ruleId).toBe("no-div");
            expect(result.pluginsRun).toContain("test-lint");
        });

        it("audits JSON Schema source", () => {
            registry.registerAdapter(new JSONSchemaAdapter());
            const result = registry.audit(
                JSON.stringify({ type: "object", properties: { x: { type: "string" } } }),
                "test.schema.json",
            );
            expect(result.language).toBe("json-schema");
            expect(result.violations).toEqual([]);
        });

        it("uses adapterOverride when provided", () => {
            registry.registerAdapter(new JSXAdapter());
            registry.registerAdapter(new JSONSchemaAdapter());

            // Force JSX adapter on a .json file
            const result = registry.audit(
                `const X = () => <div />;`,
                "weird.json",
                {},
                "jsx",
            );
            expect(result.language).toBe("jsx");
        });

        it("throws when no adapter found", () => {
            expect(() => registry.audit("content", "unknown.xyz")).toThrow("No adapter registered");
        });

        it("throws when override adapter not found", () => {
            expect(() => registry.audit("content", "file.tsx", {}, "missing")).toThrow("No adapter registered");
        });
    });
});
