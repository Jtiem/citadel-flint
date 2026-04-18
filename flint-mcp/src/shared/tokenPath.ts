/**
 * Proxy re-export for shared/tokenPath.ts
 *
 * flint-mcp has rootDir=./src in tsconfig, which prevents direct imports from
 * the monorepo root shared/ directory. This thin proxy keeps the TSC project
 * boundary clean while providing access to the shared validators.
 *
 * All callers inside flint-mcp/src should import from this file, not directly
 * from ../../../shared/tokenPath.
 */
export {
    SAFE_TOKEN_PATH_RE,
    TokenPathValidationError,
    FilePathValidationError,
    validateTokenPath,
    validateProjectRoot,
} from '../../../shared/tokenPath.js'
