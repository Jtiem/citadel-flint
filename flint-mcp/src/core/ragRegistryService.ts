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
 */

import { queryRegistry, type ComponentEntry } from './registryService.js';

// ── In-memory cache ──────────────────────────────────────────────────────────

let registryCache: Record<string, ComponentEntry> = {};

/**
 * Replace (or extend) the in-memory cache.
 * New entries are merged on top of existing ones so that successive calls from
 * multiple remote libraries accumulate rather than overwrite.
 */
export function setRegistryCache(components: Record<string, ComponentEntry>): void {
    registryCache = { ...registryCache, ...components };
}

/**
 * Clear the entire cache.  Useful in tests that need hermetic isolation.
 */
export function clearRegistryCache(): void {
    registryCache = {};
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
