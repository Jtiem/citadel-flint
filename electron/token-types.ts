/**
 * Token Types — electron/token-types.ts
 *
 * Shared type definitions for the design_tokens SQLite table and IPC payloads.
 * Consumed by main.ts (CRUD handlers) and normalizer.ts (Figma mapping).
 *
 * Main Process only — MUST NOT be imported from src/.
 * The renderer gets its own mirror declarations in src/types/flint-api.d.ts.
 */

/** The four W3C DTCG $type values that Flint supports. */
export type TokenType = 'color' | 'dimension' | 'string' | 'boolean'

/**
 * A fully-persisted design token as returned by the database.
 * `id` is the SQLite INTEGER PRIMARY KEY (auto-incremented).
 *
 * v2: Uniqueness is defined by the composite key (token_path, mode, collection_name),
 * enabling the same semantic path to hold distinct values for different modes
 * (e.g., Light vs. Dark) and across different Figma collections.
 */
export interface DesignToken {
    id: number
    /** Dot-and-hyphen path, e.g. "color-brand.primary", "spacing.medium" */
    token_path: string
    /** W3C DTCG $type */
    token_type: TokenType
    /** Serialized value: hex for color, CSS string for dimension, etc. */
    token_value: string
    description: string | null
    /** Theme mode, e.g. "Light", "Dark", or "default" for single-mode collections. */
    mode: string
    /** Figma collection name, e.g. "Color Tokens". Stored verbatim for display. */
    collection_name: string
}

/**
 * Input shape for creating a new token.
 * `id` is omitted — SQLite generates it automatically via AUTOINCREMENT.
 * `mode` and `collection_name` default to 'default' at the DB level when omitted.
 */
export interface NewDesignToken {
    token_path: string
    token_type: TokenType
    token_value: string
    description?: string
    /** Defaults to 'default' if omitted. */
    mode?: string
    /** Defaults to 'default' if omitted. */
    collection_name?: string
}

/**
 * The mutable fields accepted by the tokens:update IPC handler.
 * `id`, `token_path`, `mode`, and `collection_name` are intentionally excluded —
 * they form the composite identity key.
 * At least one field must be present per request.
 */
export interface DesignTokenUpdate {
    token_type?: TokenType
    token_value?: string
    description?: string | null
}
