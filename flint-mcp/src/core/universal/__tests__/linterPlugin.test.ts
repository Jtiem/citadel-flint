import { describe, it, expect, beforeEach } from "vitest";
import { createNode, resetIdCounter, walk } from "../flintNode.js";
import type { FlintNode, FlintDocument } from "../flintNode.js";
import type { LinterPlugin, LinterRule, LintViolation, LintContext } from "../linterPlugin.js";

describe("LinterPlugin", () => {
    beforeEach(() => resetIdCounter());

    function makeDoc(): FlintDocument {
        const root = createNode({ type: "Program", name: "root" });
        const div = createNode({ type: "JSXElement", name: "div", parent: root });
        div.attributes.set("className", "hardcoded-red");
        const img = createNode({ type: "JSXElement", name: "img", parent: root });
        // img has no alt attribute
        root.children.push(div, img);
        return { root, filePath: "test.tsx", language: "jsx", parseTimestamp: Date.now() };
    }

    it("rule visits nodes and produces violations", () => {
        const rule: LinterRule = {
            id: "no-hardcoded-class",
            severity: "warning",
            visit(node: FlintNode): LintViolation | null {
                if (node.type === "JSXElement") {
                    const cls = node.attributes.get("className");
                    if (typeof cls === "string" && cls.includes("hardcoded")) {
                        return {
                            ruleId: "no-hardcoded-class",
                            nodeId: node.id,
                            message: `Hardcoded class: ${cls}`,
                            severity: "warning",
                            fixable: true,
                        };
                    }
                }
                return null;
            },
        };

        const doc = makeDoc();
        const violations: LintViolation[] = [];
        walk(doc.root, {
            enter(node) {
                const v = rule.visit(node, { document: doc, config: {} });
                if (v) violations.push(v);
            },
        });

        expect(violations).toHaveLength(1);
        expect(violations[0].ruleId).toBe("no-hardcoded-class");
        expect(violations[0].fixable).toBe(true);
    });

    it("multiple rules across a plugin", () => {
        const noImg: LinterRule = {
            id: "img-alt-required",
            severity: "error",
            visit(node: FlintNode): LintViolation | null {
                if (node.name === "img" && !node.attributes.has("alt")) {
                    return {
                        ruleId: "img-alt-required",
                        nodeId: node.id,
                        message: "img must have alt attribute",
                        severity: "error",
                        fixable: false,
                    };
                }
                return null;
            },
        };

        const noHardcoded: LinterRule = {
            id: "no-hardcoded",
            severity: "warning",
            visit(node: FlintNode): LintViolation | null {
                if (node.attributes.has("className")) {
                    return {
                        ruleId: "no-hardcoded",
                        nodeId: node.id,
                        message: "Hardcoded class",
                        severity: "warning",
                        fixable: true,
                    };
                }
                return null;
            },
        };

        const plugin: LinterPlugin = {
            id: "a11y-basic",
            name: "Basic A11y",
            rules: [noImg, noHardcoded],
        };

        const doc = makeDoc();
        const violations: LintViolation[] = [];
        walk(doc.root, {
            enter(node) {
                for (const rule of plugin.rules) {
                    const v = rule.visit(node, { document: doc, config: {} });
                    if (v) violations.push(v);
                }
            },
        });

        expect(violations).toHaveLength(2);
        const ruleIds = violations.map(v => v.ruleId);
        expect(ruleIds).toContain("img-alt-required");
        expect(ruleIds).toContain("no-hardcoded");
    });

    it("rule can use config from context", () => {
        const rule: LinterRule = {
            id: "max-children",
            severity: "info",
            visit(node: FlintNode, ctx: LintContext): LintViolation | null {
                const max = (ctx.config.maxChildren as number) ?? 5;
                if (node.children.length > max) {
                    return {
                        ruleId: "max-children",
                        nodeId: node.id,
                        message: `Too many children: ${node.children.length} > ${max}`,
                        severity: "info",
                        fixable: false,
                    };
                }
                return null;
            },
        };

        const doc = makeDoc();
        // root has 2 children, set max to 1
        const v = rule.visit(doc.root, { document: doc, config: { maxChildren: 1 } });
        expect(v).not.toBeNull();
        expect(v!.message).toContain("2 > 1");
    });

    it("rule returns null for passing nodes", () => {
        const rule: LinterRule = {
            id: "pass-all",
            severity: "error",
            visit(): LintViolation | null {
                return null;
            },
        };
        const doc = makeDoc();
        const violations: LintViolation[] = [];
        walk(doc.root, {
            enter(node) {
                const v = rule.visit(node, { document: doc, config: {} });
                if (v) violations.push(v);
            },
        });
        expect(violations).toHaveLength(0);
    });
});
