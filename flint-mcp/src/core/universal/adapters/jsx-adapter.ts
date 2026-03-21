/**
 * V.3 — JSX Language Adapter (reference implementation)
 *
 * Wraps Babel parse/traverse/generate to translate JSX/TSX source
 * into the canonical FlintNode tree and back.
 */

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { LanguageAdapter, FlintMutation } from "../adapter.js";
import type { FlintDocument, FlintNode, SourceRange } from "../flintNode.js";
import { createNode, resetIdCounter, findById } from "../flintNode.js";

// Handle CJS/ESM interop
// @ts-ignore
const traverse: typeof _traverse = (_traverse as any).default ?? _traverse;
// @ts-ignore
const generate: typeof _generate = (_generate as any).default ?? _generate;

// ---------------------------------------------------------------------------
// Babel AST → FlintNode conversion
// ---------------------------------------------------------------------------

function locToRange(node: t.Node): SourceRange | undefined {
    if (!node.loc) return undefined;
    return {
        start: { line: node.loc.start.line, column: node.loc.start.column },
        end: { line: node.loc.end.line, column: node.loc.end.column },
    };
}

function babelNodeToFlint(node: t.Node, parent: FlintNode | null): FlintNode {
    const attrs = new Map<string, unknown>();
    const metadata: Record<string, unknown> = {};

    // Extract JSX-specific data
    if (t.isJSXOpeningElement(node)) {
        const nameNode = node.name;
        const name = t.isJSXIdentifier(nameNode) ? nameNode.name
            : t.isJSXMemberExpression(nameNode) ? generate(nameNode as any).code
            : "unknown";

        for (const attr of node.attributes) {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const val = attr.value;
                if (t.isStringLiteral(val)) {
                    attrs.set(attr.name.name, val.value);
                } else if (t.isJSXExpressionContainer(val) && t.isExpression(val.expression)) {
                    attrs.set(attr.name.name, generate(val.expression as any).code);
                } else if (val === null) {
                    attrs.set(attr.name.name, true); // boolean attribute
                }
            }
        }

        const flintNode = createNode({
            type: "JSXElement",
            name,
            attributes: attrs,
            parent,
            metadata,
            sourceRange: locToRange(node),
        });
        return flintNode;
    }

    if (t.isJSXText(node)) {
        const text = node.value.trim();
        if (!text) {
            return createNode({ type: "JSXText", name: "#text", parent, metadata: { empty: true } });
        }
        return createNode({
            type: "JSXText",
            name: "#text",
            parent,
            metadata: { value: text },
            sourceRange: locToRange(node),
        });
    }

    // Generic fallback
    return createNode({
        type: node.type,
        name: node.type,
        parent,
        metadata,
        sourceRange: locToRange(node),
    });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class JSXAdapter implements LanguageAdapter {
    id = "jsx";
    fileExtensions = [".tsx", ".jsx", ".ts", ".js"];

    parse(source: string, filePath: string): FlintDocument {
        resetIdCounter();

        const ast = parse(source, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
            sourceFilename: filePath,
        });

        const root = createNode({ type: "Program", name: "Program", metadata: {} });

        // Walk Babel AST and build FlintNode tree for JSX elements
        traverse(ast, {
            JSXElement(path) {
                const opening = path.node.openingElement;
                const flintEl = babelNodeToFlint(opening, root);

                // Process children (text nodes, nested elements handled by recursion)
                for (const child of path.node.children) {
                    if (t.isJSXText(child)) {
                        const textNode = babelNodeToFlint(child, flintEl);
                        if (!textNode.metadata.empty) {
                            flintEl.children.push(textNode);
                        }
                    }
                    // Nested JSXElements are handled by nested traverse calls
                }

                // Attach top-level JSX elements to root
                if (!path.parentPath?.isJSXElement()) {
                    root.children.push(flintEl);
                } else {
                    // Find parent flint node — for simplicity, attach to root
                    // A production implementation would maintain a stack
                }
            },
        });

        return {
            root,
            filePath,
            language: "jsx",
            parseTimestamp: Date.now(),
        };
    }

    generate(document: FlintDocument): string {
        // Reconstruct JSX from FlintNode tree
        const lines: string[] = [];

        function emitNode(node: FlintNode, indent: number): void {
            const pad = "  ".repeat(indent);
            if (node.type === "JSXText") {
                const text = node.metadata.value as string | undefined;
                if (text) lines.push(`${pad}${text}`);
                return;
            }
            if (node.type === "JSXElement") {
                const attrParts: string[] = [];
                for (const [k, v] of node.attributes) {
                    if (v === true) {
                        attrParts.push(k);
                    } else if (typeof v === "string") {
                        attrParts.push(`${k}="${v}"`);
                    } else {
                        attrParts.push(`${k}={${String(v)}}`);
                    }
                }
                const attrStr = attrParts.length > 0 ? " " + attrParts.join(" ") : "";

                if (node.children.length === 0) {
                    lines.push(`${pad}<${node.name}${attrStr} />`);
                } else {
                    lines.push(`${pad}<${node.name}${attrStr}>`);
                    for (const child of node.children) {
                        emitNode(child, indent + 1);
                    }
                    lines.push(`${pad}</${node.name}>`);
                }
                return;
            }
            // Program or generic node — emit children
            for (const child of node.children) {
                emitNode(child, indent);
            }
        }

        emitNode(document.root, 0);
        return lines.join("\n") + "\n";
    }

    mutate(document: FlintDocument, mutation: FlintMutation): FlintDocument {
        const target = findById(document.root, mutation.targetId);
        if (!target) {
            throw new Error(`Node not found: ${mutation.targetId}`);
        }

        switch (mutation.type) {
            case "setAttribute": {
                const { key, value } = mutation.args as { key: string; value: unknown };
                target.attributes.set(key, value);
                break;
            }
            case "removeAttribute": {
                const { key } = mutation.args as { key: string };
                target.attributes.delete(key);
                break;
            }
            case "rename": {
                const { name } = mutation.args as { name: string };
                target.name = name;
                break;
            }
            case "removeChild": {
                const { childId } = mutation.args as { childId: string };
                target.children = target.children.filter(c => c.id !== childId);
                break;
            }
            default:
                throw new Error(`Unknown mutation type: ${mutation.type}`);
        }

        return document;
    }
}
