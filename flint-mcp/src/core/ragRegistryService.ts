/**
 * ragRegistryService — flint-mcp/src/core/ragRegistryService.ts
 *
 * In-memory component registry cache that backs the primary query path for
 * flint_query_registry.  The cache is populated via setRegistryCache, which
 * is called both by flint_add_remote_library (remote ingestion) and by the
 * flint_query_registry handler itself (local manifest hydration).
 *
 * The async interface mirrors the vector-DB signature so that a real embedding
 * search can be dropped in later without changing call sites.
 *
 * M7: Atomic cache rebuild with generation counter.
 */

import { queryRegistry, detectRegistryConflicts, type ComponentEntry } from './registryService.js';

// ── In-memory cache with atomic pointer swap (M7) ───────────────────────────

let registryCache: Record<string, ComponentEntry> = {};

/** Monotonically increasing generation counter. Bumps on every set/clear. */
let generation = 0;

/** Mutex guard for serializing concurrent rebuilds. */
let rebuilding = false;

/**
 * Return the current generation counter.
 * Consumers can use this to detect stale reads.
 */
export function getRegistryGeneration(): number {
    return generation;
}

/**
 * Replace (or extend) the in-memory cache atomically.
 * New entries are merged on top of existing ones so that successive calls from
 * multiple remote libraries accumulate rather than overwrite.
 *
 * M7: Builds the new cache into a temporary variable, then atomically swaps
 * the live pointer. If an error occurs mid-build, the old cache stays intact.
 * Logs a warning when overwriting an entry with a different sourceId.
 */
export function setRegistryCache(components: Record<string, ComponentEntry>): void {
    if (rebuilding) {
        // Serialize: queue is not needed for synchronous operations,
        // but guard against unexpected reentrancy.
        console.warn('[ragRegistryService] setRegistryCache called during rebuild — serializing');
    }

    rebuilding = true;
    try {
        // M7: conflict detection — warn when overwriting with different sourceId
        const conflicts = detectRegistryConflicts(registryCache, components);
        for (const conflict of conflicts) {
            console.warn(
                `[ragRegistryService] sourceId conflict for "${conflict.name}": ` +
                `existing="${conflict.existingSourceId ?? 'undefined'}" ← ` +
                `incoming="${conflict.incomingSourceId ?? 'undefined'}"`,
            );
        }

        // Build new cache atomically into a temp variable
        const newCache: Record<string, ComponentEntry> = { ...registryCache, ...components };

        // Atomic pointer swap — readers always see either old or new, never partial
        registryCache = newCache;
        generation++;
    } finally {
        rebuilding = false;
    }
}

/**
 * Clear the entire cache.  Useful in tests that need hermetic isolation.
 * M7: Bumps the generation counter.
 */
export function clearRegistryCache(): void {
    registryCache = {};
    generation++;
}

/**
 * Return a snapshot of the current cache (shallow copy).
 * Exposed for introspection and testing.
 */
export function getRegistryCache(): Record<string, ComponentEntry> {
    return { ...registryCache };
}

/**
 * Query the cached component registry using text relevance scoring.
 *
 * Async so the signature is compatible with a future vector-embedding
 * implementation.
 *
 * @param query  Natural-language description of the component needed
 * @param limit  Maximum results (default 5)
 */
export async function queryRAGRegistry(
    query: string,
    limit: number = 5,
): Promise<ComponentEntry[]> {
    return queryRegistry(registryCache, query, limit);
}
