/**
 * Library Adapter registry — flint-mcp/src/core/libraryAdapters/index.ts
 *
 * Central registry for library-specific token adapters. Factory-based,
 * lazy instantiation — same pattern as the platform emitter registry.
 *
 * Adding a new library requires:
 *   1. A new adapter file implementing LibraryAdapter
 *   2. A registerAdapter() call in this file
 */

import type { LibraryTarget, LibraryAdapter, LibraryMatchResult } from './types.js'
import type { DesignToken } from '../../types.js'

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ADAPTER_REGISTRY = new Map<LibraryTarget, () => LibraryAdapter>()

/**
 * Register a library adapter factory.
 */
export function registerAdapter(
    library: LibraryTarget,
    factory: () => LibraryAdapter,
): void {
    ADAPTER_REGISTRY.set(library, factory)
}

/**
 * Get the adapter for a specific library.
 * Throws if the library is not registered.
 */
export function getAdapter(library: LibraryTarget): LibraryAdapter {
    const factory = ADAPTER_REGISTRY.get(library)
    if (!factory) {
        const available = getAvailableLibraries().join(', ')
        throw new Error(
            `No adapter registered for library: ${library}. Available: ${available}`,
        )
    }
    return factory()
}

/**
 * Get all registered library targets.
 */
export function getAvailableLibraries(): LibraryTarget[] {
    return [...ADAPTER_REGISTRY.keys()]
}

/**
 * Check whether a specific library has an adapter registered.
 */
export function hasAdapter(library: LibraryTarget): boolean {
    return ADAPTER_REGISTRY.has(library)
}

/**
 * Get display info for all registered adapters.
 * Useful for MCP tool listings and UI dropdowns.
 */
export function getAdapterCatalog(): Array<{
    library: LibraryTarget
    displayName: string
    description: string
    defaultFilename: string
}> {
    return getAvailableLibraries().map(lib => {
        const adapter = getAdapter(lib)
        return {
            library: adapter.library,
            displayName: adapter.displayName,
            description: adapter.description,
            defaultFilename: adapter.defaultFilename,
        }
    })
}

// ---------------------------------------------------------------------------
// Adapter registrations
// ---------------------------------------------------------------------------

import { PrimeAdapter } from './primeAdapter.js'
registerAdapter('primeng', () => new PrimeAdapter())

import { ShadcnAdapter } from './shadcnAdapter.js'
registerAdapter('shadcn', () => new ShadcnAdapter())

import { MuiAdapter } from './muiAdapter.js'
registerAdapter('mui', () => new MuiAdapter())

import { TailwindAdapter } from './tailwindAdapter.js'
registerAdapter('tailwind', () => new TailwindAdapter())

// ---------------------------------------------------------------------------
// Library detection (reverse flow — Figma-first)
// ---------------------------------------------------------------------------

/**
 * LIB.1: Detect which library a set of design tokens most likely belongs to.
 *
 * Runs matchTokens() on all registered adapters and returns the top scorer.
 * Used in the reverse workflow: pull tokens from Figma → detect library → set active.
 *
 * @param tokens  The design tokens to analyze.
 * @returns       The detected library, confidence score, and all adapter scores.
 *                Returns undefined for library if confidence < 60% (ambiguous).
 */
export function detectLibraryFromTokens(tokens: DesignToken[]): {
    library: LibraryTarget | undefined
    confidence: number
    scores: Record<string, { score: number; reasons: string[] }>
} {
    const scores: Record<string, { score: number; reasons: string[] }> = {}
    let topLibrary: LibraryTarget | undefined
    let topScore = 0

    for (const lib of getAvailableLibraries()) {
        const adapter = getAdapter(lib)
        const result: LibraryMatchResult = adapter.matchTokens(tokens)
        scores[lib] = result

        if (result.score > topScore) {
            topScore = result.score
            topLibrary = lib
        }
    }

    // Require >= 60% confidence for auto-detection
    const confidence = topScore
    return {
        library: confidence >= 60 ? topLibrary : undefined,
        confidence,
        scores,
    }
}

// Re-export all types
export * from './types.js'
