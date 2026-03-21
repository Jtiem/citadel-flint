import { describe, it, expect, beforeEach } from "vitest";
import { createNode, resetIdCounter, walk, findById, findByType } from "../flintNode.js";
import type { FlintNode, FlintVisitor } from "../flintNode.js";

describe("FlintNode", () => {
    beforeEach(() => resetIdCounter());

    function makeTree(): FlintNode {
        const root = createNode({ type: "Program", name: "root" });
        const div = createNode({ type: "JSXElement", name: "div", parent: root });
        const span = createNode({ type: "JSXElement", name: "span", parent: div });
        const text = createNode({ type: "JSXText", name: "#text", parent: span, metadata: { value: "hello" } });
        span.children.push(text);
        div.children.push(span);
        root.children.push(div);
        return root;
    }

    describe("createNode", () => {
        it("assigns auto-increment ids", () => {
            const a = createNode({ type: "A", name: "a" });
            const b = createNode({ type: "B", name: "b" });
            expect(a.id).toBe("bn_1");
            expect(b.id).toBe("bn_2");
        });

        it("allows explicit id", () => {
            const n = createNode({ id: "custom", type: "X", name: "x" });
            expect(n.id).toBe("custom");
        });

        it("defaults to empty children and attributes", () => {
            const n = createNode({ type: "T", name: "t" });
            expect(n.children).toEqual([]);
            expect(n.attributes.size).toBe(0);
            expect(n.parent).toBeNull();
        });
    });

    describe("walk", () => {
        it("visits all nodes depth-first", () => {
            const root = makeTree();
            const visited: string[] = [];
            walk(root, { enter(node) { visited.push(node.name); } });
            expect(visited).toEqual(["root", "div", "span", "#text"]);
        });

        it("skips subtree when enter returns false", () => {
            const root = makeTree();
            const visited: string[] = [];
            walk(root, {
                enter(node) {
                    visited.push(node.name);
                    if (node.name === "div") return false;
                },
            });
            expect(visited).toEqual(["root", "div"]);
        });

        it("calls exit in reverse order", () => {
            const root = makeTree();
            const exits: string[] = [];
            walk(root, { exit(node) { exits.push(node.name); } });
            expect(exits).toEqual(["#text", "span", "div", "root"]);
        });

        it("handles empty tree", () => {
            const root = createNode({ type: "Empty", name: "empty" });
            const visited: string[] = [];
            walk(root, { enter(node) { visited.push(node.name); } });
            expect(visited).toEqual(["empty"]);
        });
    });

    describe("findById", () => {
        it("finds existing node", () => {
            const root = makeTree();
            const span = findById(root, "bn_3");
            expect(span).not.toBeNull();
            expect(span!.name).toBe("span");
        });

        it("returns null for missing id", () => {
            const root = makeTree();
            expect(findById(root, "nonexistent")).toBeNull();
        });
    });

    describe("findByType", () => {
        it("returns all matching nodes", () => {
            const root = makeTree();
            const elements = findByType(root, "JSXElement");
            expect(elements).toHaveLength(2);
            expect(elements.map(n => n.name)).toEqual(["div", "span"]);
        });

        it("returns empty array when no match", () => {
            const root = makeTree();
            expect(findByType(root, "Nonexistent")).toEqual([]);
        });
    });
});
