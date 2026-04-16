/**
 * Sprint 5 — Component Registry + RAG (A+ Sweep)
 * Executable contract artifact. Phase 2 agents import types from this file.
 *
 * Companion markdown: sprint-5-registry-rag.md
 */

import type { FlintContract } from '../../shared/contract-schema';

// ─── Type Contracts ─────────────────────────────────────────────────
// These are the binding specifications. Phase 2 implementations MUST
// export types that are assignable to these.

/**
 * Extended PropDefinition with description, enum, deprecated, translatesFrom.
 * All new fields are optional → backwards compatible with existing manifests.
 */
export interface PropDefinitionV2 {
    type: string;
    required: boolean;
    default?: string;
    /** Human-readable prop description, surfaced in Shadow Storybook. */
    description?: string;
    /** String-literal union values (e.g. ['sm', 'md', 'lg']). */
    enum?: string[];
    /** When true, prop is rendered strikethrough in Shadow Storybook. */
    deprecated?: boolean;
    /** Native HTML attr this prop replaces, for rogue-intrinsic remediation. */
    translatesFrom?: string;
}

/**
 * sourceId tag for multi-library conflict detection.
 * Known values are conventional, not enforced, to allow future libraries.
 */
export type RegistrySourceId =
    | 'local-manifest'
    | 'team-overlay'
    | `remote:${string}`
    | (string & {});

/**
 * Return shape for detectRegistryConflicts — pure reporter, no throws.
 */
export interface RegistryConflictReport {
    name: string;
    existingSourceId?: RegistrySourceId;
    incomingSourceId?: RegistrySourceId;
}

/**
 * Atomic cache state for ragRegistryService.
 * Module-level pointer is replaced atomically; generation monotonically increments.
 */
export interface RegistryCacheState {
    entries: Record<string, unknown>; // ComponentEntry — kept loose to avoid cross-import cycle
    generation: number;
}

/**
 * Public accessor added to ragRegistryService — consumers detect stale reads.
 */
export type GetRegistryGenerationFn = () => number;

/**
 * Renamed ragStore API surface — only comment/log strings change.
 * Types are unchanged; included here to make the no-rename commitment explicit.
 */
export interface LexicalRAGSurface {
    /** NOT renamed — function name stays `query`. */
    queryFnName: 'query';
    /** NOT renamed — tool param alias `semantic_query` preserved for backwards compat. */
    preservedAlias: 'semantic_query';
}

/**
 * Clamp range for ragStore.query() limit parameter (M5).
 */
export const RAG_QUERY_LIMIT_MIN = 1;
export const RAG_QUERY_LIMIT_MAX = 100;

/**
 * Field-weighted scoring weights for registryService.queryRegistry (M1).
 */
export const REGISTRY_SCORE_WEIGHTS = {
    name: 5,
    description: 3,
    variants: 2,
    tokens: 1,
    notes: 1, // compositionNotes | a11yNotes | relatedComponents
} as const;

// ─── Contract Metadata ──────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'sprint-5-registry-rag',
        phase: 'sprint-5-registry-rag',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-15',
    },

    impact: [
        {
            file: 'flint-mcp/src/core/componentClassification.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'CRIT C4: validate componentType against STRICT_COMPONENT_TYPES before early return; warn + fall through on invalid hint',
        },
        {
            file: 'flint-mcp/src/core/registryService.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'CRIT C5 (deep-merge compositionRules + require importPath on new entries) + M1 (field-weighted scoring) + M2 (extend PropDefinition) + M3 (sourceId tagging + detectRegistryConflicts helper)',
        },
        {
            file: 'flint-mcp/src/core/ragRegistryService.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'M7: atomic cache rebuild via RegistryCacheState pointer swap + getRegistryGeneration() export + conflict logging on merge',
        },
        {
            file: 'server/services/ragStore.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'CRIT C1 (rebrand semantic → lexical in header + comments) + M4 (collapse docs sources to single entry) + M5 (clamp limit to [1,100])',
        },
        {
            file: 'flint-mcp/src/server.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'C1 carry: rebrand "Semantic search unavailable" warning at line 2573; preserve semantic_query param alias',
        },
        {
            file: 'electron/store.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'C1 carry: update "semantic search" comment at line 214 for web-side consistency; electron/ragService.ts left unchanged (it is a real neural embedding)',
        },
        {
            file: 'flint-mcp/src/core/registryResolver.ts',
            changeType: 'MODIFY',
            owner: 'coder',
            summary: 'M6: path-traversal sandbox — reject "..", backslash, absolute paths; add boundary check with realpathSync following Sprint 3 config-loader pattern',
        },
        {
            file: 'flint-mcp/src/core/__tests__/componentClassification.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'C3: full truth table for ORDERED_SUBSTRING_KEYS + STRICT_CLASSIFICATION_RULES + adversarial negatives + C4 regression tests',
        },
        {
            file: 'server/services/__tests__/ragStore.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'C2: ingest/query round-trip, empty-table guard, seedFromProject 3 sources, symlink skip, M5 clamp, M4 docs collapse',
        },
        {
            file: 'flint-mcp/src/core/__tests__/registryOverlay.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'C5: deep-merge compositionRules, require importPath, sourceId stamping, detectRegistryConflicts cases',
        },
        {
            file: 'flint-mcp/src/core/__tests__/ragRegistryService.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'M7: generation counter monotonic, atomic pointer swap (no half-populated reads), clearRegistryCache bumps generation',
        },
    ],

    ipc: [],

    stores: [],

    components: [],

    commandments: [4, 14],

    testBoundaries: [
        {
            target: 'classifyComponentName',
            kind: 'service',
            behavior: 'Validates componentType parameter against STRICT_COMPONENT_TYPES before early return',
            assertion: 'classifyComponentName("foo", "button") does not return { type: "button" } because "button" is not in STRICT_COMPONENT_TYPES',
            edgeCases: [
                'Invalid hint "widget" falls through to keyword classification with warning',
                'Valid hint "input" returns early match',
                'No hint given falls through to normal classification',
                'Adversarial input "table" does NOT match "tab" rule',
                '"form field" does NOT match input via substring',
                '"hr" exact match returns separator',
            ],
        },
        {
            target: 'mergeTeamRegistryOverlay',
            kind: 'service',
            behavior: 'Deep-merges compositionRules and requires importPath on net-new entries',
            assertion: 'Base compositionRules fields survive when overlay provides partial compositionRules',
            edgeCases: [
                'Base { allowedChildren, maxDepth } + overlay { forbiddenChildren } = all three fields',
                'addEntries with missing importPath throws with clear error message',
                'addEntries with importPath succeeds',
                'Updating existing entry without importPath inherits from prev',
                'importOverrides applied after addEntries',
                'Empty overlay returns a fresh shallow copy (not same reference)',
                'sourceId stamped as "team-overlay" on addEntries',
            ],
        },
        {
            target: 'queryRegistry scoring',
            kind: 'service',
            behavior: 'Field-weighted scoring: name=5, description=3, variants=2, tokens=1, notes=1',
            assertion: 'Component matching on name scores strictly higher than component matching only in compositionNotes',
            edgeCases: [
                'Single-word query: name > description > variants > tokens > notes',
                'Tie-break alphabetical by name',
                'Deterministic ordering across runs',
            ],
        },
        {
            target: 'detectRegistryConflicts',
            kind: 'service',
            behavior: 'Pure reporter for multi-library conflict detection',
            assertion: 'Returns RegistryConflictReport[] for keys with differing sourceIds',
            edgeCases: [
                'Same sourceId overwrite produces no conflict',
                'Different sourceId overwrite produces conflict entry',
                'Missing sourceId on either side is handled without throwing',
            ],
        },
        {
            target: 'ragRegistryService atomic cache',
            kind: 'service',
            behavior: 'Atomic cache rebuild with monotonically increasing generation counter',
            assertion: 'getRegistryGeneration() increments on every setRegistryCache and clearRegistryCache call',
            edgeCases: [
                'Two sequential setRegistryCache calls with overlapping keys → generation +2',
                'clearRegistryCache bumps generation',
                'Reader observing cache pointer never sees half-populated state',
                'Conflict warning logged when setRegistryCache would overwrite different sourceId',
            ],
        },
        {
            target: 'ragStore.query',
            kind: 'service',
            behavior: 'Clamps limit parameter to [1, 100] and guards empty table',
            assertion: 'query("foo", 0) clamps to 1, query("foo", 999) clamps to 100, query against empty table returns []',
            edgeCases: [
                'limit=0 → clamped to 1, no throw',
                'limit=1000 → clamped to 100',
                'Empty table returns [] without calling vec0 MATCH',
                'Round-trip ingest → query → clear → count=0',
            ],
        },
        {
            target: 'ragStore.seedFromProject',
            kind: 'service',
            behavior: 'Collapses docs sources into single aggregated entry; per-chunk source preserved',
            assertion: 'seedFromProject with 5 doc files returns sources containing one "docs (5 files)" entry, not 5 entries',
            edgeCases: [
                'Manifest only',
                'Tokens only',
                'Docs only',
                'All three sources',
                'Symlink in docs/ is skipped with warning',
                'Malformed design-tokens.json survives without throw',
            ],
        },
        {
            target: 'resolveRegistryRef path sandbox',
            kind: 'service',
            behavior: 'Rejects path-traversal refs and enforces .flint-packs boundary',
            assertion: 'resolveRegistryRef("../../etc/passwd", root) throws with clear error',
            edgeCases: [
                '".." in ref → throws',
                'Backslash in ref → throws',
                'Leading "/" → throws',
                'Invalid char outside [a-zA-Z0-9_/-] → throws',
                'Valid "acme/pack" resolves correctly',
                'Symlink escape via .flint-packs/evil-link → null (boundary check)',
                'Non-existent pack returns null (unchanged behavior)',
            ],
        },
    ],

    risks: [
        {
            risk: 'Rebrand removes semantic_query legacy param alias, breaking existing MCP callers',
            severity: 'medium',
            commandment: 14,
            mitigation: 'Decision log item #1 explicitly preserves the alias. Acceptance criterion grep-checks it.',
        },
        {
            risk: 'Field-weighted scoring changes existing snapshot ordering',
            severity: 'medium',
            mitigation: 'Existing tests expect name > notes ordering — new weights amplify, not invert. Update any broken snapshots as part of the sprint.',
        },
        {
            risk: 'PropDefinition extension drifts from Glass UI types',
            severity: 'low',
            mitigation: 'Grep confirms PropDefinition is only re-declared in electron/__tests__/reindex.test.ts (test-local). No Glass UI import.',
        },
        {
            risk: 'Deep-merge compositionRules changes merge semantics for consumers relying on replace-whole behavior',
            severity: 'low',
            mitigation: 'Review explicitly classifies the current shallow-merge as a defect. New behavior is the intended semantics.',
        },
        {
            risk: 'classifyComponentName fallthrough-after-warning breaks upstream callers relying on the trusted path',
            severity: 'medium',
            mitigation: 'Known callers (hydroPaste, figmaMcpParser, figmaJsxTransformer) use strict types or omit the hint. Phase 2 must grep-verify before shipping.',
        },
        {
            risk: 'detectRegistryConflicts adds log noise for legitimate multi-library projects',
            severity: 'low',
            mitigation: 'Dedupe once-per-conflict-key; log at warn level; non-fatal.',
        },
        {
            risk: 'registryResolver boundary check blocks pre-existing valid pack installs',
            severity: 'low',
            commandment: 14,
            mitigation: 'Pattern copied verbatim from Sprint 3 config-loader which is already in production. Test adversarial + happy path.',
        },
    ],

    parallelismGroups: {
        A: ['coder'], // classification + ragStore + registryResolver — independent
        B: ['coder'], // registryService then ragRegistryService — sequential
        C: ['flint-test-writer'], // 4 new test files in parallel with A+B
    },

    nonGoals: [
        'Wiring ONNX / MiniLM / transformer embeddings into the web build',
        'Unifying Electron and web RAG implementations behind a single interface',
        'Adding network registry resolution to registryResolver (GPX.3 still deferred)',
        'Rewriting tokenImporter.ts (B+ in review, out of scope)',
        'Exposing detectRegistryConflicts as a Glass UI surface',
        'Changing flint_query_registry tool request or response schema',
        'Renaming any exported function, type, or IPC channel',
    ],
};
