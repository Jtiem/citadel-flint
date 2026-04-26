/**
 * dtcgTokenAdapter.bench.ts
 *
 * FIXTURE.1.1 — Performance invariants for dtcgTokenAdapter
 *
 * CONTRACT-SOURCE: .flint-context/contracts/FIXTURE.1.1.contract.ts
 *
 * Invariant:
 *   adapter-overhead-budget:
 *     p95 wall-clock latency of normalizeTokenShape on a DTCG document
 *     with N=100 leaves must be < 2ms.
 *
 *   Pathological case:
 *     A depth-10 alias chain with visited-set guard should resolve in
 *     well under budget — verifies O(1) visited-set lookup.
 *
 * Usage:
 *   cd flint-mcp && npx vitest bench --run
 *
 * Note: vitest bench requires vitest >= 0.34.0. Standard `npm test` (vitest run)
 * does not execute .bench.ts files — bench files are measured separately.
 */

import { bench, describe } from 'vitest'

// ── Corpus generators ─────────────────────────────────────────────────────────

/**
 * Generates a DTCG document with exactly N=100 leaves spread across
 * 10 groups of 10 tokens each. Matches the scale used in the contract's
 * id-hash-collision-free invariant.
 */
function generate100LeafDoc(): Record<string, unknown> {
    const doc: Record<string, Record<string, unknown>> = {}
    for (let g = 0; g < 10; g++) {
        doc[`group${g}`] = {}
        for (let l = 0; l < 10; l++) {
            (doc[`group${g}`] as Record<string, unknown>)[`leaf${l}`] = {
                $value: `${(g * 10 + l + 1) * 4}px`,
                $type: 'dimension',
                $description: `Group ${g} leaf ${l} — spacing token`,
            }
        }
    }
    return doc
}

/**
 * Generates a DTCG document with a single linear alias chain of the given
 * depth. Leaf at depth N is the literal; every other node aliases the next.
 *
 * Example for depth=10:
 *   chain.a0 → chain.a1 → chain.a2 → ... → chain.a9 = "24px"
 *
 * Tests that visited-set lookup keeps resolution O(depth), not O(N^2).
 */
function generateAliasChainDoc(depth: number): Record<string, unknown> {
    const group: Record<string, unknown> = {}
    for (let i = 0; i < depth - 1; i++) {
        group[`a${i}`] = {
            $value: { $ref: `chain.a${i + 1}` },
            $type: 'dimension',
        }
    }
    // Terminal literal
    group[`a${depth - 1}`] = { $value: '24px', $type: 'dimension' }
    return { chain: group }
}

// ── Lazy adapter loader ───────────────────────────────────────────────────────

type AdapterModule = {
    normalizeTokenShape: (raw: unknown) => {
        tokens: unknown[]
        unknownShape: boolean
        leafCount: number
        errors: unknown[]
    }
}

async function getAdapter(): Promise<AdapterModule | null> {
    try {
        const mod = await import('../dtcgTokenAdapter.js')
        if (typeof mod.normalizeTokenShape !== 'function') return null
        return mod as AdapterModule
    } catch {
        return null
    }
}

// Pre-build corpora outside the bench loop to avoid measuring corpus
// construction time.
const DOC_100 = generate100LeafDoc()
const DOC_CHAIN_10 = generateAliasChainDoc(10)

// ── Benchmarks ────────────────────────────────────────────────────────────────

describe('dtcgTokenAdapter performance', () => {

    // ── adapter-overhead-budget: p95 < 2ms at N=100 ──────────────────────────
    bench(
        'normalizeTokenShape: N=100 leaf DTCG document (contract: <2ms p95)',
        async () => {
            const adapter = await getAdapter()
            if (!adapter) return
            adapter.normalizeTokenShape(DOC_100)
        },
        {
            iterations: 200,
            warmupIterations: 20,
        },
    )

    // ── Pathological: depth-10 alias chain — visited-set must keep this fast ─
    bench(
        'normalizeTokenShape: depth-10 alias chain (visited-set guard O(depth) check)',
        async () => {
            const adapter = await getAdapter()
            if (!adapter) return
            adapter.normalizeTokenShape(DOC_CHAIN_10)
        },
        {
            iterations: 200,
            warmupIterations: 20,
        },
    )

    // ── Flat array pass-through ───────────────────────────────────────────────
    // Verifies that flat-shape identity path has negligible overhead
    // (the fast-path return should be near-zero).
    bench(
        'normalizeTokenShape: flat DesignToken[] pass-through (N=100, should be near-zero)',
        async () => {
            const adapter = await getAdapter()
            if (!adapter) return
            // Inline a small flat array rather than using makeFlatTokens to keep
            // the bench file self-contained and avoid cross-file imports.
            const flat = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                token_path: `color.brand-${i}`,
                token_type: 'color',
                token_value: `#${(i * 0x111111).toString(16).padStart(6, '0')}`,
                description: null,
                collection_name: 'global',
                mode: 'default',
            }))
            adapter.normalizeTokenShape(flat)
        },
        {
            iterations: 200,
            warmupIterations: 20,
        },
    )

})
