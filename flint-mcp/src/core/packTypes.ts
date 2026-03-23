/**
 * Pack Types -- flint-mcp/src/core/packTypes.ts
 *
 * Shared type definitions for the Governance Pack Exchange system.
 * These types define the `.flint-pack/` manifest format and all
 * intermediate data structures used during pack assembly.
 */

import type { GovernanceDomain } from './policyEngine.js'

// ── Manifest Schema ─────────────────────────────────────────────────────────

export interface PackAuthor {
    name: string;
    email?: string;
    org?: string;
}

export interface PackCompatibility {
    flint_min_version: string;
    flint_max_version: string | null;
}

export interface PackContentsDeclaration {
    policy: boolean;
    agent_policy: boolean;
    rules: string[];           // Rule IDs that are included
    claude_fragments: string[]; // Relative paths within claude-fragments/
}

/**
 * The canonical manifest.json that lives at the root of every .flint-pack/ bundle.
 * Matches the schema defined in FEATURE-SPEC-GOVERNANCE-PACK-EXCHANGE.md.
 */
export interface PackManifest {
    schema_version: 1;
    id: string;                 // Globally unique slug. Lowercase, hyphens only.
    name: string;
    version: string;            // Semver
    description: string;
    author: PackAuthor;
    trust_tier: 'community';    // Always 'community' for local exports (trust_tier is registry-assigned)
    domain: GovernanceDomain;
    stack_tags: string[];
    compatibility: PackCompatibility;
    dependencies: string[];
    contents: PackContentsDeclaration;
    checksums: Record<string, string>;  // filename -> "sha256:<hex>" for each file in the pack
    published_at: string;       // ISO 8601 UTC
}

// Re-export for consumers
export type { GovernanceDomain };

// ── Pack Assembly Types ─────────────────────────────────────────────────────

/**
 * A single file entry to be included in the pack archive.
 */
export interface PackFileEntry {
    /** Relative path within the pack (e.g. "policy.json", "rules/MITHRIL-COL.json") */
    packPath: string;
    /** The file content as a string */
    content: string;
    /** SHA-256 hex digest of content */
    checksum: string;
}

/**
 * The collected contents of a pack before archiving.
 * This is the intermediate representation between collection and zip generation.
 */
export interface PackContents {
    policy: PackFileEntry | null;
    agentPolicy: PackFileEntry | null;
    rules: PackFileEntry[];
    claudeFragments: PackFileEntry[];
}

// ── Validation Types ────────────────────────────────────────────────────────

export type PackValidationSeverity = 'error' | 'warning';

/**
 * A single validation error or warning found during pack assembly.
 */
export interface PackValidationError {
    severity: PackValidationSeverity;
    file: string;              // The file where the issue was found
    line?: number;             // Optional line number
    message: string;           // Human-readable description
    code: PackValidationCode;  // Machine-readable error code
}

/**
 * Machine-readable validation error codes.
 */
export type PackValidationCode =
    | 'POLICY_INVALID'         // policy.json fails validatePolicy()
    | 'AGENT_POLICY_INVALID'   // agent-policy.json fails shape validation
    | 'ABSOLUTE_PATH'          // File contains an absolute local path
    | 'SECRET_DETECTED'        // File contains an API key or secret pattern
    | 'NODE_BUILTIN_IMPORT'    // Skill file imports Node.js builtins
    | 'FILE_NOT_FOUND'         // Referenced file does not exist
    | 'INVALID_PACK_ID'        // Pack ID does not match slug format
    | 'INVALID_SEMVER';        // Version string is not valid semver

// ── Export Result Types ─────────────────────────────────────────────────────

/**
 * Result returned by flint_pack_export on dry_run: true.
 */
export interface PackExportDryRunResult {
    dry_run: true;
    manifest: PackManifest;
    files: Array<{
        path: string;
        size_bytes: number;
        checksum: string;
    }>;
    validation_errors: PackValidationError[];
    summary: string;
}

/**
 * Result returned by flint_pack_export on dry_run: false (actual export).
 */
export interface PackExportWriteResult {
    dry_run: false;
    manifest: PackManifest;
    archive_path: string;      // Absolute path to the written .flint-pack.zip
    archive_size_bytes: number;
    file_count: number;
    validation_errors: PackValidationError[];  // Warnings only (errors block export)
    summary: string;
}

export type PackExportResult = PackExportDryRunResult | PackExportWriteResult;
