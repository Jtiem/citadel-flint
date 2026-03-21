/**
 * V.3 — Language Adapter Interface
 *
 * Each adapter translates between a specific file format and the canonical
 * FlintNode tree, enabling the universal engine to operate on any language.
 */

import type { FlintDocument, FlintNode } from "./flintNode.js";

// ---------------------------------------------------------------------------
// Mutation Descriptor
// ---------------------------------------------------------------------------

export interface FlintMutation {
    /** Mutation operation type (e.g., 'setAttribute', 'removeChild', 'rename'). */
    type: string;
    /** The `id` of the target FlintNode. */
    targetId: string;
    /** Operation-specific arguments. */
    args: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Language Adapter
// ---------------------------------------------------------------------------

export interface LanguageAdapter {
    /** Unique identifier, e.g. 'jsx', 'json-schema', 'html'. */
    id: string;

    /** File extensions this adapter handles, e.g. ['.tsx', '.jsx']. */
    fileExtensions: string[];

    /** Parse source text into a FlintDocument. */
    parse(source: string, filePath: string): FlintDocument;

    /** Generate source text from a FlintDocument. */
    generate(document: FlintDocument): string;

    /** Apply a mutation to a document, returning the updated document. */
    mutate(document: FlintDocument, mutation: FlintMutation): FlintDocument;
}
