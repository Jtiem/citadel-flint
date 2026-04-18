/**
 * Proxy re-export for shared/coverage-types.ts
 *
 * flint-mcp has rootDir=./src in tsconfig, which prevents direct imports from
 * the monorepo root shared/ directory. This thin proxy keeps the TSC project
 * boundary clean while providing access to the shared coverage types.
 *
 * All callers inside flint-mcp/src should import from this file, not directly
 * from ../../../shared/coverage-types.
 */
export type {
    CoverageStatus,
    CoverageReason,
    CoverageVerdict,
    SkippedFilesByReason,
    CoverageSummary,
} from '../../../shared/coverage-types.js'
