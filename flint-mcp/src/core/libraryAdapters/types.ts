/**
 * Library Theme Adapter types — flint-mcp/src/core/libraryAdapters/types.ts
 *
 * Defines the contract for adapters that convert Flint's DTCG design tokens
 * into library-specific theme configurations (PrimeNG definePreset, Shadcn
 * globals.css, MUI createTheme, Tailwind config, etc.).
 *
 * Architecture:
 *   DTCG tokens (canonical) → LibraryAdapter → library theme override code
 *
 * Each adapter is a pure function: tokens in, themed code out. No I/O.
 */

import type { DesignToken, TokenType } from '../../types.js'

// Re-export for convenience
export type { DesignToken, TokenType }

// ---------------------------------------------------------------------------
// Supported library targets
// ---------------------------------------------------------------------------

/**
 * Component libraries with structured theming APIs.
 * Adding a new library requires:
 *   1. A new adapter file implementing LibraryAdapter
 *   2. Registration in the adapter registry (index.ts)
 */
export type LibraryTarget =
    | 'primeng'       // PrimeNG / PrimeReact / PrimeVue — definePreset()
    | 'shadcn'        // shadcn/ui — CSS variables in globals.css
    | 'mui'           // Material UI — createTheme()
    | 'tailwind'      // Tailwind CSS — tailwind.config.ts theme.extend
    | 'antd'          // Ant Design — ConfigProvider token (future)
    | 'radix'         // Radix Themes — CSS variables (future)
    | 'chakra'        // Chakra UI — extendTheme() (future)
    | 'carbon'        // IBM Carbon — SASS/CSS tokens (future)

// ---------------------------------------------------------------------------
// Adapter output
// ---------------------------------------------------------------------------

/**
 * The result of mapping DTCG tokens to a library theme configuration.
 */
export interface LibraryThemeOutput {
    /** Which library this output targets. */
    library: LibraryTarget
    /** The generated theme code (ready to paste into a project). */
    code: string
    /** Suggested filename for this output. */
    filename: string
    /** Number of tokens successfully mapped. */
    tokenCount: number
    /** Tokens that could not be mapped to this library's token schema. */
    skippedTokens: SkippedToken[]
    /** MIME type of the output file. */
    mimeType: string
    /**
     * Structured token mapping for audit/diff purposes.
     * Keys are library-native token paths, values are the resolved DTCG values.
     * e.g. { "primitive.blue.500": "#3b82f6", "semantic.primary.color": "#3b82f6" }
     */
    tokenMap: Record<string, string>
}

/**
 * A token that could not be mapped for a specific library.
 */
export interface SkippedToken {
    tokenPath: string
    tokenType: TokenType
    reason: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
}

export interface ValidationError {
    line: number | null
    message: string
}

// ---------------------------------------------------------------------------
// Adapter options
// ---------------------------------------------------------------------------

/**
 * Options passed to the adapter's mapTokens method.
 */
export interface MapOptions {
    /** Filter tokens by mode (e.g. 'Light', 'Dark'). */
    mode?: string
    /** Filter tokens by collection name. */
    collection?: string
    /**
     * Base preset to extend (library-specific).
     * e.g. 'aura' for PrimeNG, 'default' for Shadcn.
     */
    basePreset?: string
    /**
     * Whether to include dark mode mappings where applicable.
     * Defaults to true.
     */
    includeDarkMode?: boolean
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * Result of a library detection match attempt.
 */
export interface LibraryMatchResult {
    /** How well this adapter matches the token set (0-100). */
    score: number
    /** Human-readable reasons explaining why this score was assigned. */
    reasons: string[]
}

/**
 * Contract for a library-specific token adapter.
 *
 * Design constraints:
 *   - mapTokens() is a PURE FUNCTION: tokens in, LibraryThemeOutput out. No I/O.
 *   - validate() checks the output string for syntactic correctness.
 *   - seedTokens() returns the library's canonical base token set. No I/O.
 *   - getIdiomBlock() returns AI prompt constraints for this library. No I/O.
 *   - matchTokens() scores how well a token set matches this library. No I/O.
 *   - Each adapter is a standalone module with no cross-adapter dependencies.
 */
export interface LibraryAdapter {
    /** Which library this adapter targets. */
    readonly library: LibraryTarget
    /** The default filename for this library's theme output. */
    readonly defaultFilename: string
    /** Human-readable library name for UI display. */
    readonly displayName: string
    /** Brief description of what the adapter generates. */
    readonly description: string

    /**
     * Map DTCG design tokens to a library-specific theme configuration.
     *
     * @param tokens   The full set of DTCG-normalized design tokens.
     * @param options  Adapter-specific options (optional).
     * @returns        The generated theme code with metadata.
     */
    mapTokens(tokens: DesignToken[], options?: MapOptions): LibraryThemeOutput

    /**
     * Validate the generated output for syntactic correctness.
     */
    validate(output: LibraryThemeOutput): ValidationResult

    /**
     * Return the library's canonical base DTCG token set.
     * Used to seed a new project with sensible defaults when this library is selected.
     * Pure function — no I/O. Token data is static and bundled in the adapter.
     */
    seedTokens(): DesignToken[]

    /**
     * Return a compact markdown block describing this library's import conventions,
     * utility patterns, and composition rules. Injected into the AI system prompt
     * when this library is the active selection.
     */
    getIdiomBlock(): string

    /**
     * Score how well a given set of design tokens matches this library's patterns.
     * Used for reverse detection: pull tokens from Figma → detect which library.
     * Higher score = better match. 0 = no match.
     */
    matchTokens(tokens: DesignToken[]): LibraryMatchResult
}

// ---------------------------------------------------------------------------
// Token classification helpers (shared across adapters)
// ---------------------------------------------------------------------------

/** Semantic color role keywords detected from token paths. */
export type SemanticColorRole =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'surface'
    | 'background'
    | 'foreground'
    | 'text'
    | 'border'
    | 'muted'

/**
 * Detect a semantic role from a token path.
 * Returns null if no role can be inferred.
 */
export function detectSemanticRole(tokenPath: string): SemanticColorRole | null {
    const lower = tokenPath.toLowerCase()
    const roles: SemanticColorRole[] = [
        'primary', 'secondary', 'success', 'warning', 'error', 'info',
        'surface', 'background', 'foreground', 'text', 'border', 'muted',
    ]
    for (const role of roles) {
        if (lower.includes(role)) return role
    }
    return null
}

/**
 * Detect a shade/step number from a token path.
 * e.g. "colors.blue.500" → 500, "brand.primary.light" → null
 */
export function detectShade(tokenPath: string): number | null {
    const match = tokenPath.match(/\.(\d{2,3})$/)
    return match ? parseInt(match[1], 10) : null
}

/**
 * Extract the color family name from a token path.
 * e.g. "colors.brand.blue.500" → "blue", "palette.emerald.100" → "emerald"
 */
export function extractColorFamily(tokenPath: string): string | null {
    const segments = tokenPath.split('.')
    // Look for the segment before a numeric shade
    for (let i = segments.length - 1; i >= 0; i--) {
        if (/^\d{2,3}$/.test(segments[i]) && i > 0) {
            return segments[i - 1]
        }
    }
    // No shade found — use the last non-type segment
    if (segments.length >= 2) {
        return segments[segments.length - 1]
    }
    return null
}

/**
 * Filter tokens by mode and collection.
 * Shared by all adapters to avoid duplication.
 */
export function filterTokens(
    tokens: DesignToken[],
    options?: MapOptions,
): DesignToken[] {
    let result = tokens
    if (options?.mode) {
        result = result.filter(t => t.mode === options.mode)
    }
    if (options?.collection) {
        result = result.filter(t => t.collection_name === options.collection)
    }
    return result
}
