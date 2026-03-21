/**
 * Annotation Types — flint-mcp/src/core/annotations/types.ts
 *
 * Canonical type definitions for the Flint annotation system (COLLAB.1).
 * These are the MCP-side source of truth. The renderer-side mirror lives in
 * src/types/flint-api.d.ts and must be kept in sync manually — cross-boundary
 * imports between the electron/src layers are prohibited.
 *
 * An annotation is a structured note, decision, approval, or handoff comment
 * attached to a specific node in the visual tree via its data-flint-id.
 * Annotations are persisted to .flint/annotations.json by the MCP tool
 * (flint_annotate, COLLAB.3) and read by Glass via IPC (COLLAB.4).
 */

/** The set of annotation categories supported by flint_annotate. */
export type AnnotationType =
    | 'note'       // General design/code comment
    | 'decision'   // Architectural or design decision record
    | 'approval'   // Sign-off or review approval
    | 'handoff'    // Hand-off instructions from one role to another

/** Resolution status of an annotation. */
export type AnnotationStatus = 'open' | 'resolved'

/**
 * A single Flint annotation anchoring a structured comment to a node.
 *
 * id        — Stable UUID. Never changes after creation.
 * nodeId    — The data-flint-id of the anchored JSX element.
 * filePath  — Absolute path to the file containing the anchored element.
 * type      — Category of annotation (note | decision | approval | handoff).
 * author    — Display name of the annotation author (MCP session handle or user).
 * body      — The human-readable annotation content.
 * status    — 'open' (default) or 'resolved'. Resolved annotations are hidden
 *             from Glass by default but preserved in the file for audit purposes.
 * visibility — 'public' (default) or 'private'. Private annotations from other
 *              authors are excluded from the renderer (single-user v1 scope).
 * createdAt  — ISO 8601 timestamp of creation.
 * resolvedAt — ISO 8601 timestamp when status was set to 'resolved', or null.
 */
export interface FlintAnnotation {
    id: string
    nodeId: string
    filePath: string
    type: AnnotationType
    author: string
    body: string
    status: AnnotationStatus
    visibility: 'public' | 'private'
    createdAt: string
    resolvedAt: string | null
}
