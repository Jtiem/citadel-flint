/**
 * V.3 — Canonical FlintNode Schema
 *
 * Domain-agnostic AST representation that decouples the mutation/linting
 * engine from any specific parser (Babel, JSON Schema, HTML, etc.).
 */

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export interface SourceRange {
    start: { line: number; column: number };
    end: { line: number; column: number };
}

export interface FlintNode {
    id: string;
    type: string;
    name: string;
    attributes: Map<string, unknown>;
    children: FlintNode[];
    parent: FlintNode | null;
    metadata: Record<string, unknown>;
    sourceRange?: SourceRange;
}

export interface FlintDocument {
    root: FlintNode;
    filePath: string;
    language: string;
    parseTimestamp: number;
}

// ---------------------------------------------------------------------------
// Visitor Pattern
// ---------------------------------------------------------------------------

export interface FlintVisitor {
    enter?(node: FlintNode): void | false;
    exit?(node: FlintNode): void;
}

/**
 * Walk the FlintNode tree depth-first. If `visitor.enter` returns `false`,
 * the subtree is skipped.
 */
export function walk(node: FlintNode, visitor: FlintVisitor): void {
    const skip = visitor.enter?.(node);
    if (skip === false) return;

    for (const child of node.children) {
        walk(child, visitor);
    }

    visitor.exit?.(node);
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

export function findById(root: FlintNode, id: string): FlintNode | null {
    let result: FlintNode | null = null;
    walk(root, {
        enter(node) {
            if (node.id === id) {
                result = node;
                return false;
            }
        },
    });
    return result;
}

export function findByType(root: FlintNode, type: string): FlintNode[] {
    const results: FlintNode[] = [];
    walk(root, {
        enter(node) {
            if (node.type === type) {
                results.push(node);
            }
        },
    });
    return results;
}

// ---------------------------------------------------------------------------
// Factory Helper
// ---------------------------------------------------------------------------

let _idCounter = 0;

export function createNode(partial: Partial<FlintNode> & { type: string; name: string }): FlintNode {
    return {
        id: partial.id ?? `bn_${++_idCounter}`,
        type: partial.type,
        name: partial.name,
        attributes: partial.attributes ?? new Map(),
        children: partial.children ?? [],
        parent: partial.parent ?? null,
        metadata: partial.metadata ?? {},
        sourceRange: partial.sourceRange,
    };
}

/** Reset the auto-increment counter (useful for tests). */
export function resetIdCounter(): void {
    _idCounter = 0;
}
