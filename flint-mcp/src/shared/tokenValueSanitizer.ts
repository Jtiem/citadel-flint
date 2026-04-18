/**
 * Proxy re-export for shared/tokenValueSanitizer.ts
 *
 * flint-mcp has rootDir=./src in tsconfig, which prevents direct imports from
 * the monorepo root shared/ directory. This thin proxy keeps the TSC project
 * boundary clean while providing access to the shared sanitizers.
 *
 * All callers inside flint-mcp/src should import from this file, not directly
 * from ../../../shared/tokenValueSanitizer.
 */
export {
    TOKEN_VALUE_MAX_LENGTH,
    TOKEN_DESCRIPTION_MAX_LENGTH,
    SANITIZER_VERSION,
    SECRET_PATTERNS_EXT,
    sanitizeTokenValue,
    sanitizeTokenDescription,
} from '../../../shared/tokenValueSanitizer.js'

export type {
    TokenShapeCategory,
    SanitizeTokenValueResult,
} from '../../../shared/tokenValueSanitizer.js'
