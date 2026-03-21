import { describe, it, expect } from "vitest";
import { JSONSchemaAdapter } from "../adapters/json-schema-adapter.js";
import { findByType } from "../flintNode.js";

describe("JSONSchemaAdapter", () => {
    const adapter = new JSONSchemaAdapter();

    const sampleSchema = JSON.stringify({
        type: "object",
        properties: {
            name: { type: "string", description: "User name" },
            age: { type: "number", minimum: 0 },
            address: {
                type: "object",
                properties: {
                    street: { type: "string" },
                    city: { type: "string" },
                },
                required: ["street"],
            },
        },
        required: ["name"],
    });

    it("has correct id and extensions", () => {
        expect(adapter.id).toBe("json-schema");
        expect(adapter.fileExtensions).toContain(".schema.json");
    });

    describe("parse", () => {
        it("parses schema into FlintNode tree", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            expect(doc.language).toBe("json-schema");
            expect(doc.root.type).toBe("Schema:object");
            expect(doc.root.name).toBe("root");
        });

        it("creates child nodes for properties", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            expect(doc.root.children.length).toBe(3);
            const names = doc.root.children.map(c => c.name);
            expect(names).toContain("name");
            expect(names).toContain("age");
            expect(names).toContain("address");
        });

        it("marks required properties in metadata", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            const nameNode = doc.root.children.find(c => c.name === "name")!;
            expect(nameNode.metadata.required).toBe(true);
            const ageNode = doc.root.children.find(c => c.name === "age")!;
            expect(ageNode.metadata.required).toBeUndefined();
        });

        it("recurses into nested object properties", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            const addr = doc.root.children.find(c => c.name === "address")!;
            expect(addr.children.length).toBe(2);
            const street = addr.children.find(c => c.name === "street")!;
            expect(street.metadata.required).toBe(true);
        });

        it("stores schema keywords as attributes", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            const age = doc.root.children.find(c => c.name === "age")!;
            expect(age.attributes.get("minimum")).toBe(0);
            expect(age.attributes.get("type")).toBe("number");
        });

        it("handles $ref nodes", () => {
            const refSchema = JSON.stringify({
                type: "object",
                properties: {
                    role: { $ref: "#/definitions/Role" },
                },
            });
            const doc = adapter.parse(refSchema, "ref.schema.json");
            const role = doc.root.children.find(c => c.name === "role")!;
            expect(role.type).toBe("Reference");
            expect(role.attributes.get("$ref")).toBe("#/definitions/Role");
        });

        it("handles array items", () => {
            const arrSchema = JSON.stringify({
                type: "array",
                items: { type: "string" },
            });
            const doc = adapter.parse(arrSchema, "arr.schema.json");
            expect(doc.root.children.length).toBe(1);
            expect(doc.root.children[0].name).toBe("items");
        });
    });

    describe("generate", () => {
        it("round-trips schema back to JSON", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            const output = adapter.generate(doc);
            const parsed = JSON.parse(output);
            expect(parsed.type).toBe("object");
            expect(parsed.properties.name.type).toBe("string");
            expect(parsed.properties.address.properties.street.type).toBe("string");
            expect(parsed.required).toContain("name");
        });
    });

    describe("mutate", () => {
        it("setAttribute modifies a schema keyword", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            const age = doc.root.children.find(c => c.name === "age")!;
            adapter.mutate(doc, {
                type: "setAttribute",
                targetId: age.id,
                args: { key: "minimum", value: 18 },
            });
            expect(age.attributes.get("minimum")).toBe(18);
        });

        it("addProperty adds a new child", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            adapter.mutate(doc, {
                type: "addProperty",
                targetId: doc.root.id,
                args: { name: "email", schema: { type: "string", format: "email" } },
            });
            const email = doc.root.children.find(c => c.name === "email");
            expect(email).toBeDefined();
            expect(email!.attributes.get("format")).toBe("email");
        });

        it("throws on unknown node id", () => {
            const doc = adapter.parse(sampleSchema, "user.schema.json");
            expect(() =>
                adapter.mutate(doc, { type: "setAttribute", targetId: "nope", args: { key: "a", value: 1 } }),
            ).toThrow("Node not found");
        });
    });
});
