/**
 * FIXTURE.1.1 — DTCG Token Shape Adapter
 *
 * Closes the documented drift from FIXTURE.1's integration report
 * (SHIP-WITH-DOCUMENTED-DRIFT, 2026-04-19). `resolveFixture` loads
 * `design-tokens.json` correctly, but the linter's token consumer expects
 * flat `DesignToken[]`. Demo token files are DTCG-nested, so
 * `Object.values(raw)` at server.ts:2038 yields groups, not tokens. Every
 * literal pixel becomes a MITHRIL-TYP-002 false positive.
 *
 * Fix: a pure adapter module that detects DTCG vs. flat shape and flattens
 * DTCG → `DesignToken[]`. Integration is a one-line swap at the two fixture
 * token-load sites in server.ts and swarm.ts. Zero changes to any visitor or
 * rule.
 *
 * See companion: FIXTURE.1.1-contract.md
 */

import type { FlintContract } from '../../shared/contract-schema'

// ─── Type contracts (Phase 2 imports these) ─────────────────────────────────

/** A DTCG leaf node — the actual token payload in W3C DTCG documents.
 *  `$value` may be a literal string ("12px"), a ref object ({ $ref: "fontSize.xs" }),
 *  or the DTCG bare-string ref form ("{fontSize.xs}"). All three are handled by
 *  the adapter's alias resolver. */
export interface DTCGLeaf {
    $value: string | { $ref: string }
    $type?: string
    $description?: string
}

/** Recursive DTCG document shape. Groups contain either more groups or leaves. */
export interface DTCGDocument {
    [groupOrTokenName: string]: DTCGDocument | DTCGLeaf
}

/** Typed error emitted when alias resolution fails. Adapter never throws. */
export interface TokenAdapterError {
    code: 'ALIAS_CYCLE' | 'ALIAS_BROKEN_REF'
    /** Dotted path of the leaf whose $ref could not be resolved. */
    tokenPath: string
    /** The unresolved ref string (target path). */
    ref: string
    /** For ALIAS_CYCLE: the ordered visit chain that closed the loop. */
    chain?: string[]
}

/**
 * Diagnostic-rich return from `normalizeTokenShape`. Server.ts consumes `.tokens`
 * and may log `unknownShape` / `leafCount` / `errors` at debug verbosity.
 */
export interface TokenAdapterResult {
    /** Flat DesignToken[] ready for MithrilLinter consumption. */
    tokens: unknown[] // DesignToken[] — kept as unknown[] here to avoid src/ coupling
    /** True when input matched neither DTCG nor flat-array shape. */
    unknownShape: boolean
    /** Count of DTCG leaves successfully flattened (0 for flat-array input). */
    leafCount: number
    /** Alias resolution errors (cycles, broken refs). Empty on clean docs. */
    errors: TokenAdapterError[]
}

// ─── Contract ───────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'FIXTURE.1.1-DTCGTokenShapeAdapter',
        phase: 'FIXTURE.1.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-19',
        audience: 'engine',
    },

    impact: [
        {
            file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Pure adapter module. Exports isDTCGDocument, flattenDTCGTokens, normalizeTokenShape, and the TokenAdapterError type. Recursively walks DTCG groups; emits flat DesignToken[] with token_path = dot-joined group chain, token_type = $type, token_value = $value, description = $description, collection_name = "fixture", mode = "default", stable synthesized negative-integer id (FNV-1a hash of token_path). Alias leaves ({$value:{$ref}} or bare "{a.b}" form) are resolved iteratively within the same document with a visited-set guard; cycles and broken refs emit typed TokenAdapterError entries and the offending leaf is omitted from tokens.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/dtcgTokenAdapter.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Unit tests: DTCG detection (has $value+$type on leaves); flat-array identity (normalizeTokenShape(flatArr) === flatArr by deep equality); nested group flatten (fontSize.xs path); $description preserved; single-hop alias resolves to target literal; multi-hop chain (≥ 3 deep) resolves deterministically; self-reference cycle (a→a) emits ALIAS_CYCLE without stack overflow; two-node cycle (a→b→a) emits ALIAS_CYCLE; broken $ref emits ALIAS_BROKEN_REF; unknown shape returns empty tokens + unknownShape=true; id hash deterministic and collision-free across a 100-token corpus; synthesized ids never collide with a simulated positive-id project token set.',
        },
        {
            file: 'flint-mcp/src/server.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Replace the `Array.isArray(rawFixtureTokens) ? rawFixtureTokens : Object.values(rawFixtureTokens)` line at ~2038 with `normalizeTokenShape(rawFixtureTokens).tokens`. Identical swap in the flint_audit handler if it mirrors the same load path. Zero other changes.',
        },
        {
            file: 'flint-mcp/src/tools/swarm.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Verify token-load parity: `tools/swarm.ts` delegates to `handleFlintAuditBatch` which routes through `server.ts:2038`, so the single-line fix at server.ts should propagate automatically. If swarm has an independent token-load site, apply the same `normalizeTokenShape(rawFixtureTokens).tokens` swap. Otherwise this entry is a verification-only no-op.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/dtcgTokenAdapter.bench.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Vitest bench for the adapter-overhead-budget invariant. Pattern mirrors tailwindConfigLoader.bench.ts / cssStylesheetLoader.bench.ts. Runs normalizeTokenShape over N=100 leaves and asserts p95 < 2ms. Includes a pathological deep-alias-chain run (depth 10) as a belt-and-suspenders check — should remain well under budget because visited-set lookup is O(1).',
        },
        {
            file: 'flint-mcp/src/__tests__/server.audit-fixture.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary:
                'Tighten the drifted canary: banner-compliant.tsx Mithril count === 0 is now asserted (previously documented as SHIP-WITH-DOCUMENTED-DRIFT). banner-broken.tsx total violations >= 5 preserved.',
        },
    ],

    // No new IPC channels — engine-internal change.
    ipc: [],

    // No new stores.
    stores: [],

    // No new components.
    components: [],

    commandments: [
        // 2 — No Hallucinated Styling: preserving $description makes Mithril's
        //     nearestToken suggestions cite author intent accurately.
        2,
        // 13 — Deterministic Surgery: adapter is a pure recursive object walk.
        //      Stable output for stable input; no regex on source code.
        13,
        // 14 — Bypass Prohibition: adapter does zero I/O. Input is a parsed
        //      object from the existing fs.readFileSync call site.
        14,
    ],

    testBoundaries: [
        {
            target: 'flint-mcp/src/core/dtcgTokenAdapter.ts::isDTCGDocument',
            kind: 'service',
            behavior: 'Classifies an input object as DTCG-nested vs flat-array vs unknown.',
            assertion: 'returns true for objects whose leaves have $value+$type; false otherwise',
            edgeCases: [
                'flat DesignToken[] → false',
                'nested DTCG with color/spacing/fontSize → true',
                'empty object {} → false',
                'null/undefined → false',
            ],
            given: 'the contents of demos/01-rag-ui-builder/design-tokens.json parsed as JSON',
            when: 'isDTCGDocument is called',
            then: 'returns true',
        },
        {
            target: 'flint-mcp/src/core/dtcgTokenAdapter.ts::flattenDTCGTokens',
            kind: 'service',
            behavior: 'Recursively flattens a DTCG document into DesignToken[].',
            assertion: 'returns one DesignToken per leaf with token_path = dot-joined group chain',
            edgeCases: [
                'fontSize.xs with $value:"12px" $type:"dimension" → DesignToken { token_path:"fontSize.xs", token_type:"dimension", token_value:"12px" }',
                '$description preserved into DesignToken.description',
                'single-hop alias { $value:{ $ref:"fontSize.xs" } } resolves to "12px"',
                'multi-hop alias chain a→b→c→"12px" resolves to "12px"',
                'bare-string ref form { $value:"{fontSize.xs}" } resolves identically',
                'self-reference a→a emits ALIAS_CYCLE and leaf is omitted',
                'two-node cycle a→b→a emits ALIAS_CYCLE with chain=["a","b","a"]',
                'broken $ref → missing.path emits ALIAS_BROKEN_REF',
                'deeply nested groups (3+ levels) flatten correctly',
                'synthesized id is a stable negative integer derived from token_path',
            ],
            given: 'the DTCG object { fontSize: { xs: { $value: "12px", $type: "dimension", $description: "Uppercase label" } } }',
            when: 'flattenDTCGTokens is called',
            then: 'returns an array of length 1 whose first element has token_path==="fontSize.xs" and token_value==="12px"',
        },
        {
            target: 'flint-mcp/src/core/dtcgTokenAdapter.ts::normalizeTokenShape',
            kind: 'service',
            behavior: 'Single integration point — auto-detects shape and returns a TokenAdapterResult.',
            assertion: 'returns a TokenAdapterResult whose .tokens is ready for MithrilLinter consumption',
            edgeCases: [
                'flat DesignToken[] input → result.tokens === input (by element equality), leafCount === 0',
                'DTCG input → result.tokens has one entry per leaf, unknownShape === false',
                'neither shape → result.tokens === [], unknownShape === true',
                'empty object → result.tokens === [], unknownShape === false',
            ],
            given: 'a DTCG document with 6 fontSize leaves',
            when: 'normalizeTokenShape is called',
            then: 'returns result.tokens.length === 6 and result.unknownShape === false',
        },
        {
            target: 'flint-mcp/src/server.ts::audit_ui_component (post-adapter integration)',
            kind: 'ipc-handler',
            behavior: 'After swap, audit against banner-compliant.tsx produces zero MITHRIL violations.',
            assertion: 'returns audit response with mithrilCount === 0 for banner-compliant.tsx',
            edgeCases: [
                'banner-compliant.tsx Mithril count === 0',
                'banner-broken.tsx Mithril count >= 5 (distinguishability preserved)',
                'fixture present but tokens file missing → auditWarnings pushed, audit proceeds',
            ],
            given: 'demos/01-rag-ui-builder/banner-compliant.tsx audited with the demo fixture and DTCG tokens',
            when: 'audit_ui_component handler runs',
            then: 'returns response with mithrilCount === 0 and verdict === "APPROVED"',
        },
    ],

    invariants: [
        {
            name: 'alias-single-hop-resolves',
            measurable: 'token_value on a DesignToken whose DTCG source was { $value: { $ref: "fontSize.xs" } } where fontSize.xs is "12px"',
            threshold: '=== "12px"',
            measuredBy: 'dtcgTokenAdapter.test.ts alias-single-hop case',
        },
        {
            name: 'alias-multi-hop-resolves',
            measurable: 'Resolution iterations to terminate a chain a→b→c→literal of depth 3',
            threshold: '<= 3 (terminates with correct literal value)',
            measuredBy: 'dtcgTokenAdapter.test.ts alias-multi-hop case',
        },
        {
            name: 'alias-cycle-safe',
            measurable: 'Return behavior of normalizeTokenShape on a DTCG document containing a 2-node $ref cycle (a→b→a)',
            threshold: '=== returns TokenAdapterResult with errors[0].code === "ALIAS_CYCLE" in < 100ms, never throws, never stack-overflows',
            measuredBy: 'dtcgTokenAdapter.test.ts alias-cycle case',
        },
        {
            name: 'alias-broken-ref-typed',
            measurable: 'errors[] emitted for a leaf whose $ref target does not exist in the document',
            threshold: '>= 1 entry with code === "ALIAS_BROKEN_REF" and matching tokenPath',
            measuredBy: 'dtcgTokenAdapter.test.ts alias-broken-ref case',
        },
        {
            name: 'id-no-positive-collision',
            measurable: 'Intersection size of adapter-synthesized id set (100-leaf corpus) with a simulated positive DesignToken.id set {1..10000}',
            threshold: '=== 0',
            measuredBy: 'dtcgTokenAdapter.test.ts id-positive-collision case',
        },
        {
            name: 'demo-compliant-clean',
            measurable: 'Count of MITHRIL-TYP-002 + MITHRIL-SPC-001 violations on demos/01-rag-ui-builder/banner-compliant.tsx after adapter integration',
            threshold: '=== 0',
            measuredBy: 'flint-mcp/src/__tests__/server.audit-fixture.test.ts demo regression block',
        },
        {
            name: 'demo-broken-distinguishable',
            measurable: 'Total violation count on demos/01-rag-ui-builder/banner-broken.tsx after adapter integration',
            threshold: '>= 5',
            measuredBy: 'server.audit-fixture.test.ts demo regression block',
        },
        {
            name: 'adapter-flat-shape-identity',
            measurable: 'normalizeTokenShape(flatArr).tokens vs flatArr by element-wise deep equality',
            threshold: '=== flatArr (zero diff at N=100)',
            measuredBy: 'dtcgTokenAdapter.test.ts flat-identity case',
        },
        {
            name: 'adapter-overhead-budget',
            measurable: 'p95 wall-clock latency of normalizeTokenShape on a DTCG document with N=100 leaves',
            threshold: '< 2ms at N=100',
            measuredBy: 'dtcgTokenAdapter.bench.ts (vitest bench)',
        },
        {
            name: 'id-hash-collision-free',
            measurable: 'Count of duplicate synthesized ids across a 100-leaf DTCG corpus (distinct token_paths)',
            threshold: '=== 0',
            measuredBy: 'dtcgTokenAdapter.test.ts id-collision case',
        },
    ],

    risks: [
        {
            risk: 'Existing flat-shape token files regress because the adapter mangles them.',
            severity: 'high',
            commandment: 13,
            mitigation:
                'adapter-flat-shape-identity invariant — normalizeTokenShape on flat input returns the input by element-wise equality. Fixture test added with a known-good flat token array.',
        },
        {
            risk: 'Alias cycles or broken refs in real-world DTCG token files cause infinite loops or silent data loss.',
            severity: 'medium',
            commandment: 13,
            mitigation:
                'Iterative resolver with visited-set guard keyed on token_path. Cycles terminate with ALIAS_CYCLE; missing targets emit ALIAS_BROKEN_REF. Invariants alias-cycle-safe and alias-broken-ref-typed cover both. Cross-file aliases remain out of scope (documented non-goal).',
        },
        {
            risk: 'Synthesized negative-integer ids collide with real SQLite-sourced positive ids and confuse downstream consumers.',
            severity: 'low',
            commandment: 13,
            mitigation:
                'Engine-side grep evidence (Justin, 2026-04-19): DesignToken.id typed as `number` with no positivity constraint (types.ts:27); consumers (MithrilLinter, library adapters, seed tests) never compare id to zero or use it as a SQL auto-increment. token_source.id in sync schema is a string PK, not the numeric DesignToken.id. FNV-1a hash of token_path with sign-bit OR guarantees deterministic negative range. Invariants id-hash-collision-free + id-no-positive-collision assert safety on a 100-leaf corpus.',
        },
        {
            risk: 'Call-site swap at server.ts:2038 is missed or duplicated when merging with parallel work on the same file (RUNTIME.1, FIGMA-LINT.1).',
            severity: 'low',
            commandment: 14,
            mitigation:
                'Append-only territory discipline via ACTIVE-SWARM-TERRITORY.md. The swap is a single-line change inside the existing FIXTURE.1 try-block; conflicts are textually obvious.',
        },
    ],

    parallelismGroups: {
        A: ['flint-ast-surgeon', 'flint-test-writer'],
    },

    nonGoals: [
        'No cross-file DTCG alias resolution — $ref targets must live in the same loaded document.',
        'No DTCG $extensions mode/theme fan-out.',
        'No new MCP tool, IPC channel, Zustand store, or Glass UI surface.',
        'No changes to any Mithril visitor, rule, or policy engine code.',
        'No changes to electron/normalizer.ts (stays Figma-only).',
        'No migration of existing flat-shape token files to DTCG.',
        'No changes to Coverage Honesty (Phase 0) or the export-gate (Commandment 6).',
        'No changes to the fixture schema, resolver, or applicability filter shipped in FIXTURE.1.',
    ],
}
