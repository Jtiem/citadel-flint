/**
 * V.3 — JSON Schema Language Adapter (second reference implementation)
 *
 * Parses JSON Schema files into FlintNode trees.
 * Properties become child nodes, $ref becomes a reference node.
 * Proves the abstraction works for non-web domains.
 */

import type { LanguageAdapter, FlintMutation } from "../adapter.js";
import type { FlintDocument, FlintNode } from "../flintNode.js";
import { createNode, findById, resetIdCounter } from "../flintNode.js";

// ---------------------------------------------------------------------------
// Schema → FlintNode
// ---------------------------------------------------------------------------

function schemaToNode(
    key: string,
    schema: Record<string, unknown>,
    parent: FlintNode | null,
): FlintNode {
    const type = (schema.type as string) ?? (schema.$ref ? "$ref" : "schema");
    const attrs = new Map<string, unknown>();

    // Copy scalar schema keywords into attributes
    for (const [k, v] of Object.entries(schema)) {
        if (k === "properties" || k === "items" || k === "required") continue;
        attrs.set(k, v);
    }

    const node = createNode({
        type: type === "$ref" ? "Reference" : `Schema:${type}`,
        name: key,
        attributes: attrs,
        parent,
        metadata: {},
    });

    // Recurse into properties
    if (schema.properties && typeof schema.properties === "object") {
        const props = schema.properties as Record<string, Record<string, unknown>>;
        const requiredArr = Array.isArray(schema.required) ? (schema.required as string[]) : [];
        for (const [propKey, propSchema] of Object.entries(props)) {
            const child = schemaToNode(propKey, propSchema, node);
            if (requiredArr.includes(propKey)) {
                child.metadata.required = true;
            }
            node.children.push(child);
        }
    }

    // Recurse into array items
    if (schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)) {
        const itemNode = schemaToNode("items", schema.items as Record<string, unknown>, node);
        node.children.push(itemNode);
    }

    return node;
}

// ---------------------------------------------------------------------------
// FlintNode → JSON Schema
// ---------------------------------------------------------------------------

function nodeToSchema(node: FlintNode): Record<string, unknown> {
    const schema: Record<string, unknown> = {};

    // Restore attributes as schema keywords
    for (const [k, v] of node.attributes) {
        schema[k] = v;
    }

    // Rebuild properties from children
    const propChildren = node.children.filter(c => c.name !== "items");
    const itemChild = node.children.find(c => c.name === "items");

    if (propChildren.length > 0) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        for (const child of propChildren) {
            properties[child.name] = nodeToSchema(child);
            if (child.metadata.required) {
                required.push(child.name);
            }
        }
        schema.properties = properties;
        if (required.length > 0) {
            schema.required = required;
        }
    }

    if (itemChild) {
        schema.items = nodeToSchema(itemChild);
    }

    return schema;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class JSONSchemaAdapter implements LanguageAdapter {
    id = "json-schema";
    fileExtensions = [".schema.json"];

    parse(source: string, filePath: string): FlintDocument {
        resetIdCounter();

        const raw = JSON.parse(source) as Record<string, unknown>;
        const root = schemaToNode("root", raw, null);

        return {
            root,
            filePath,
            language: "json-schema",
            parseTimestamp: Date.now(),
        };
    }

    generate(document: FlintDocument): string {
        const schema = nodeToSchema(document.root);
        return JSON.stringify(schema, null, 2) + "\n";
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
            case "addProperty": {
                const { name, schema } = mutation.args as { name: string; schema: Record<string, unknown> };
                const child = schemaToNode(name, schema, target);
                target.children.push(child);
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
