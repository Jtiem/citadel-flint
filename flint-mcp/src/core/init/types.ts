/**
 * Shared types for the Flint init subsystem.
 * flint-mcp/src/core/init/types.ts
 *
 * These types are used by stackDetector.ts and tokenExtractor.ts to describe
 * the auto-discovery result and the extracted token set, respectively.
 */

import type { DesignToken } from '../../types.js'

export type { DesignToken }

// ── Stack detection ──────────────────────────────────────────────────────────

/**
 * Identifies which CSS/design-system framework a project uses.
 * Priorities (highest to lowest): dtcg > tokens-studio > tailwind-v4 >
 * tailwind-v3 > css-custom-props > chakra > mui > radix > none.
 */
export type DetectedFramework =
    | 'tailwind-v3'
    | 'tailwind-v4'
    | 'css-custom-props'
    | 'dtcg'
    | 'tokens-studio'
    | 'chakra'
    | 'mui'
    | 'radix'
    | 'none'

export type DetectedUIFramework = 'react' | 'vue' | 'svelte' | 'unknown'

export interface StackDetectionResult {
    /** Primary design-system framework detected. */
    framework: DetectedFramework
    /** Absolute path to the primary config / token file found, or null. */
    configPath: string | null
    /** Absolute paths to CSS/SCSS files that contain `:root` custom properties. */
    cssFiles: string[]
    /** Absolute paths to DTCG/Tokens Studio JSON token files. */
    tokenFiles: string[]
    /** Relevant design-system package names found in package.json dependencies. */
    packageDeps: string[]
    /** UI framework detected from package.json. */
    uiFramework: DetectedUIFramework
    /** Whether a tsconfig.json exists in the project root. */
    typescript: boolean
}

// ── Token extraction ─────────────────────────────────────────────────────────

export interface TokenExtractionResult {
    /** Extracted design tokens in Flint DesignToken format. */
    tokens: DesignToken[]
    /** Human-readable description of where the tokens came from. */
    source: string
    /** Non-fatal extraction warnings (e.g. skipped items, fallback defaults). */
    warnings: string[]
}
