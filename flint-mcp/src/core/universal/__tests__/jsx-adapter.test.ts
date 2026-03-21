import { describe, it, expect } from "vitest";
import { JSXAdapter } from "../adapters/jsx-adapter.js";
import { findByType } from "../flintNode.js";

describe("JSXAdapter", () => {
    const adapter = new JSXAdapter();

    it("has correct id and extensions", () => {
        expect(adapter.id).toBe("jsx");
        expect(adapter.fileExtensions).toContain(".tsx");
        expect(adapter.fileExtensions).toContain(".jsx");
    });

    describe("parse", () => {
        it("parses simple JSX into FlintNode tree", () => {
            const source = `const App = () => <div className="container"><span>Hello</span></div>;`;
            const doc = adapter.parse(source, "App.tsx");

            expect(doc.language).toBe("jsx");
            expect(doc.filePath).toBe("App.tsx");
            expect(doc.root.type).toBe("Program");
            expect(doc.root.children.length).toBeGreaterThan(0);
        });

        it("extracts JSX attributes", () => {
            const source = `const X = () => <button disabled className="btn">Click</button>;`;
            const doc = adapter.parse(source, "X.tsx");
            const buttons = findByType(doc.root, "JSXElement");
            expect(buttons.length).toBeGreaterThan(0);
            const btn = buttons.find(n => n.name === "button");
            expect(btn).toBeDefined();
            expect(btn!.attributes.get("className")).toBe("btn");
            expect(btn!.attributes.get("disabled")).toBe(true);
        });

        it("handles self-closing elements", () => {
            const source = `const X = () => <img src="logo.png" />;`;
            const doc = adapter.parse(source, "X.tsx");
            const imgs = findByType(doc.root, "JSXElement");
            expect(imgs.length).toBe(1);
            expect(imgs[0].name).toBe("img");
        });

        it("sets parseTimestamp", () => {
            const before = Date.now();
            const doc = adapter.parse(`const X = () => <div />;`, "X.tsx");
            expect(doc.parseTimestamp).toBeGreaterThanOrEqual(before);
        });
    });

    describe("generate", () => {
        it("produces JSX string from FlintNode tree", () => {
            const source = `const App = () => <div className="container"><span>Hello</span></div>;`;
            const doc = adapter.parse(source, "App.tsx");
            const output = adapter.generate(doc);
            expect(output).toContain("<div");
            expect(output).toContain("className");
        });
    });

    describe("mutate", () => {
        it("setAttribute modifies an attribute", () => {
            const source = `const X = () => <div className="old" />;`;
            const doc = adapter.parse(source, "X.tsx");
            const divs = findByType(doc.root, "JSXElement");
            const div = divs.find(n => n.name === "div")!;

            adapter.mutate(doc, {
                type: "setAttribute",
                targetId: div.id,
                args: { key: "className", value: "new" },
            });

            expect(div.attributes.get("className")).toBe("new");
        });

        it("rename changes element name", () => {
            const source = `const X = () => <div />;`;
            const doc = adapter.parse(source, "X.tsx");
            const divs = findByType(doc.root, "JSXElement");
            const div = divs[0];

            adapter.mutate(doc, {
                type: "rename",
                targetId: div.id,
                args: { name: "section" },
            });

            expect(div.name).toBe("section");
        });

        it("throws on unknown node id", () => {
            const doc = adapter.parse(`const X = () => <div />;`, "X.tsx");
            expect(() =>
                adapter.mutate(doc, { type: "setAttribute", targetId: "missing", args: { key: "a", value: "b" } }),
            ).toThrow("Node not found");
        });
    });
});
