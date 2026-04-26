/**
 * FIXTURE.1 — Audit Context System
 *
 * Beta Gate 1, items #3 + #4. Solves two interlocking root causes that
 * presently prevent demo fixtures from differentiating compliant from broken:
 *
 *   1. No resolved design-tokens.json for `demos/**` ⇒ every literal pixel
 *      becomes a MITHRIL-TYP-002 / MITHRIL-SPC-001 false positive.
 *   2. Document-level Warden rules (A11Y-050 no-main, A11Y-051 no-nav, etc.)
 *      run against component fixtures that fundamentally cannot satisfy them.
 *
 * Architectural answer:
 *   • `.flint-fixture.json` per directory, walked-up like tsconfig (nearest-wins).
 *   • Every governance rule declares `appliesTo: 'document'|'section'|'component'|'any'`.
 *   • Audit pipeline filters rules by surface match BEFORE invoking.
 *
 * See companion: FIXTURE.1-contract.md
 */

import type { FlintContract } from '../../shared/contract-schema'

// ─── Type contracts (Phase 2 imports these) ─────────────────────────────────

/**
 * Surface kind drives rule applicability filtering.
 * - document  → full page; landmark / structure rules apply
 * - section   → page section; some structure rules apply
 * - component → single export, fixture/library entry; only component-scope rules apply
 */
export type FlintFixtureSurface = 'document' | 'section' | 'component'

/**
 * Rule mode used in `ruleOverrides` (last-resort escape hatch).
 * Applicability filtering (`appliesTo`) is preferred over overrides.
 */
export type FlintFixtureRuleMode = 'error' | 'warn' | 'off' | 'ignore'

/**
 * Schema for `.flint-fixture.json`. Walked-up resolution: the nearest fixture
 * file at-or-above the audited file wins (like tsconfig.json).
 */
export interface FlintFixture {
    /** Absolute path or path relative to the fixture file. Falsy ⇒ "no tokens loaded" honestly (rules that need tokens self-skip rather than mass-flag). */
    tokens?: string
    /** What kind of surface this directory represents — drives rule applicability. */
    surface: FlintFixtureSurface
    /** Which rule pack profile to apply (default: project default). */
    ruleProfile?: string
    /** Optional human label shown in dashboard ("MUI demo context", "tailwind-default"). */
    label?: string
    /** Last-resort per-rule mode override. Applies AFTER applicability filtering — never resurrects a hard-skipped rule. */
    ruleOverrides?: Record<string, FlintFixtureRuleMode>
}

/**
 * Output of `resolveFixture(filePath)`. The `source` field tells the caller
 * which fixture file (if any) won the walk-up — enabling the StatusBar label.
 */
export interface ResolvedFixture {
    /** The resolved fixture (always populated; defaults applied if no file found). */
    fixture: FlintFixture
    /** Absolute path to the .flint-fixture.json that won the walk-up; null if defaults. */
    source: string | null
    /** Absolute path to the resolved tokens file (if `fixture.tokens` set and existed). */
    resolvedTokensPath: string | null
}

/**
 * Applicability metadata attached to every governance rule.
 * Default for unspecified rules is `'any'` (no behavior change).
 *
 * - 'document'  → only run on fixtures with surface='document'
 * - 'section'   → run on 'document' or 'section'
 * - 'component' → run on 'component' (and broader, by inclusion)
 * - 'any'       → run on all surfaces (default)
 */
export type RuleAppliesTo = 'document' | 'section' | 'component' | 'any'

/**
 * Mithril rules are registered as visitors inside MithrilLinter.ts (not per-file
 * exports), so the appliesTo metadata for Mithril is a map keyed by ruleId.
 * Phase 2 implementer adds this map next to the linter and consults it during
 * the visit loop.
 */
export type MithrilAppliesToMap = Record<string, RuleAppliesTo>

/**
 * Decision returned by the applicability filter for one (rule, fixture) pair.
 * Used by the audit pipeline; surfaced in trace logs but NOT recorded as a
 * suppressed violation (commitment: hard-skip is silent — the rule simply
 * doesn't apply).
 */
export interface ApplicabilityDecision {
    ruleId: string
    appliesTo: RuleAppliesTo
    fixtureSurface: FlintFixtureSurface
    /** True ⇒ rule is invoked. False ⇒ rule is silently skipped. */
    invoke: boolean
}

// ─── Contract ───────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'FIXTURE.1-AuditContextSystem',
        phase: 'FIXTURE.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-19',
        audience: 'engine',
    },

    impact: [
        // ── Schema + resolver (net-new files) ─────────────────────────────
        {
            file: 'shared/fixture-schema.ts',
            changeType: 'CREATE',
            owner: 'flint-state-architect',
            summary:
                'Zod schema + TypeScript types for FlintFixture (surface, tokens, ruleProfile, label, ruleOverrides). Re-exports the type names declared in this contract.',
        },
        {
            file: 'shared/__tests__/fixture-schema.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Unit tests for FlintFixture Zod parser: required surface, optional tokens/label, ruleOverrides keys/values, rejects unknown fields.',
        },
        {
            file: 'flint-mcp/src/core/fixtureResolver.ts',
            changeType: 'CREATE',
            owner: 'flint-state-architect',
            summary:
                'resolveFixture(filePath, projectRoot): ResolvedFixture. Walk-up from filePath looking for .flint-fixture.json (nearest-wins), parse via Zod schema, resolve tokens path relative to fixture file, return typed default if no file found. Per-directory cache. Path-traversal guard (do not escape projectRoot).',
        },
        {
            file: 'flint-mcp/src/core/__tests__/fixtureResolver.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Tests: walk-up finds nearest fixture; defaults returned when no file; tokens path resolved relative to fixture file; cache hits within same directory; path-traversal blocked; malformed JSON surfaces actionable error; missing tokens file does not throw (resolvedTokensPath: null).',
        },

        // ── Mithril applicability metadata (single map; rules are visitor-registered, not per-file) ─
        {
            file: 'flint-mcp/src/core/mithrilAppliesTo.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Static MithrilAppliesToMap of ruleId → RuleAppliesTo for every Mithril rule (MITHRIL-COL, MITHRIL-TYP-001..005, MITHRIL-SPC-001, MITHRIL-SPC-TOUCH, MITHRIL-SHA, MITHRIL-OPC, etc.). All Mithril rules default appliesTo:"any" — Mithril is concerned with token compliance which applies at every surface.',
        },
        {
            file: 'flint-mcp/src/core/MithrilLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND-ONLY: accept optional `surface: FlintFixtureSurface` in linter options. Before recording each violation, consult MithrilAppliesToMap and skip if not applicable. No restructuring of existing visitors. Coordinated append-only with RUNTIME.1 + FIGMA-LINT.1.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/mithrilAppliesTo.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Map covers every ruleId emitted by MithrilLinter (asserted by intersecting with the ruleId set extracted from a corpus run). Default is "any". No rule is missing.',
        },

        // ── Warden A11y applicability metadata (one append per rule module) ─
        {
            file: 'flint-mcp/src/core/a11y/types.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND-ONLY: add `appliesTo?: RuleAppliesTo` field to A11yRule interface. Default behavior preserved when undefined ⇒ treated as "any".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/landmarks.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Add appliesTo:"document" to A11Y-050 (no-main), A11Y-051 (no-nav), A11Y-052 (multiple-main). A11Y-053 (distinct aria-label on duplicate landmarks) → appliesTo:"section".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/structure.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Add appliesTo to each rule. Heading-order / page-title / skip-link rules → "document". Component-scope rules → "any".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/names-labels.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any" to every rule (component-safe).',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/keyboard.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any" to every rule (component-safe).',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/aria.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any" to every rule (component-safe).',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/contrast.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any" to every rule (component-safe).',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/forms.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any" to every rule (component-safe). form-as-document rules ⇒ "section".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/live-regions.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/motion.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/coga.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo:"any".',
        },
        {
            file: 'flint-mcp/src/core/a11y/rules/wcag22.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary: 'Add appliesTo per-rule. Page-context rules ⇒ "document"; component-safe ⇒ "any".',
        },
        {
            file: 'flint-mcp/src/core/A11yLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND-ONLY: accept optional `surface: FlintFixtureSurface` in audit options. Before invoking each rule, check rule.appliesTo (default "any") against surface. Hard-skip rules whose appliesTo does not match — silently, no violation recorded, no suppressed-log entry. Coordinated append-only with RUNTIME.1 (runtime-dom source authority) and FIGMA-LINT.1 (Universal AST adapter) — no restructuring.',
        },
        {
            file: 'flint-mcp/src/core/__tests__/a11yAppliesTo.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'For each surface ∈ {document, section, component}, assert: rules with appliesTo="document" are invoked iff surface=="document"; "section" iff surface in {document, section}; "any" always; "component" always (it is the most permissive scope, present for symmetry/future use).',
        },

        // ── Audit pipeline integration (3 tools) ───────────────────────────
        {
            file: 'flint-mcp/src/server.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'audit_ui_component handler (inline case at ~line 1941) — wire in fixture resolution + appliesTo filtering before invoking rules. Call resolveFixture(filePath, projectRoot); load tokens from resolvedTokensPath if set; pass fixture.surface into MithrilLinter and A11yLinter options; apply ruleOverrides last (overrides win over rule mode but NOT over appliesTo filtering). Include `fixtureContext: { label, source }` in tool response so Glass can render the StatusBar pill. Same wiring applied to flint_audit handler in the same file.',
        },
        {
            file: 'flint-mcp/src/tools/swarm.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'flint_swarm_audit_fix — resolve fixture per file in glob; share the resolver cache across the swarm run so cold-cache cost is paid once per directory.',
        },
        {
            file: 'flint-mcp/src/__tests__/server.audit-fixture.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'New test suite for audit_ui_component + flint_audit fixture wiring (handlers live inline in server.ts). Assertions: a component fixture with surface:"component" no longer reports A11Y-050; a document fixture continues to report it. Demo regression tests assert banner-compliant.tsx returns 0 MITHRIL-TYP/SPC violations and banner-broken.tsx returns ≥5. flint_audit code path mirrors the same expectations.',
        },

        // ── Demo fixtures (data files; per-directory) ──────────────────────
        {
            file: 'demos/01-rag-ui-builder/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'surface:"component", tokens:"../design-tokens.json", label:"RAG UI demo (Tailwind defaults)".',
        },
        {
            file: 'demos/02-self-correcting/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens:"../design-tokens.json", label:"Self-correcting demo".',
        },
        {
            file: 'demos/03-mithril-shadow-audit/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens:"../design-tokens.json", label:"Mithril shadow-audit demo".',
        },
        {
            file: 'demos/04-sentinel/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens:"../design-tokens.json", label:"Sentinel demo".',
        },
        {
            file: 'demos/05-semantic-refactor/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens:"../design-tokens.json", label:"Semantic refactor demo".',
        },
        {
            file: 'demos/06-macro-recovery/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens:"../design-tokens.json", label:"Macro recovery demo".',
        },
        {
            file: 'demos/figma-d2c/expected-output/mui/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens points to MUI default token JSON, label:"MUI demo context".',
        },
        {
            file: 'demos/figma-d2c/expected-output/shadcn/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens points to shadcn default token JSON, label:"shadcn demo context".',
        },
        {
            file: 'demos/figma-d2c/expected-output/tailwind/.flint-fixture.json',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'surface:"component", tokens points to Tailwind defaults token JSON, label:"Tailwind demo context".',
        },

        // ── Glass surface (small but visible) ──────────────────────────────
        {
            file: 'src/components/editor/StatusBar.tsx',
            changeType: 'MODIFY',
            owner: 'flint-design-engineer',
            summary:
                'APPEND-ONLY: render a small "Audit context: <label>" pill when the latest audit response includes fixtureContext.label. Coordinate with RUNTIME.1 (runtime-mode toggle pill) — both append, both should compose without restructuring.',
        },
        {
            file: 'src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Renders the pill iff fixtureContext.label is present on the latest audit; renders nothing otherwise; clicking the pill (future hook) does not crash.',
        },
    ],

    // No new IPC channels. Audit results already flow back via the existing
    // MCP tool response surface; fixtureContext rides inside that payload.
    ipc: [],

    // No new stores. The fixtureContext label is consumed transiently from
    // the latest audit response; no need to persist it as a slice.
    stores: [],

    components: [
        {
            name: 'StatusBar (fixture-context pill)',
            file: 'src/components/editor/StatusBar.tsx',
            propsType: 'StatusBarProps (existing — no signature change)',
            consumesStores: ['canvasStore (latest audit response)'],
            emitsIPC: [],
        },
    ],

    commandments: [
        // 5 — Accessibility is a Compiler Error: applicability filtering REFINES
        //      which rules apply but never weakens enforcement on the right surface.
        5,
        // 6 — Gatekeeper Rule: export gate continues to read severity counts; this
        //      change reduces the false-positive count without changing the gate.
        6,
        // 13 — Deterministic Surgery: fixture resolver and applicability filter
        //      are pure functions over file paths and rule metadata — no regex
        //      mutation of source code.
        13,
        // 14 — Bypass Prohibition: fs reads in fixture resolver use the standard
        //      project-root-bounded reader; no direct network or git calls.
        14,
        // 15 — Granular AST Tools Only: not directly relevant, but applicability
        //      filtering keeps the tool catalog from emitting nonsensical fixes
        //      on the wrong surface (e.g., insert-main on a button fixture).
        15,
    ],

    testBoundaries: [
        {
            target: 'shared/fixture-schema.ts::FlintFixture (Zod parse)',
            kind: 'service',
            behavior: 'Parses valid fixture JSON; rejects unknown surface values and unknown top-level fields.',
            assertion: 'returns FlintFixture or throws ZodError with actionable path',
            edgeCases: [
                'surface is required',
                'ruleOverrides values restricted to error|warn|off|ignore',
                'unknown top-level fields rejected (strict mode)',
                'tokens may be omitted',
            ],
            given: 'JSON { "surface": "component", "label": "Demo", "tokens": "../design-tokens.json" }',
            when: 'FlintFixtureSchema.parse runs',
            then: 'returns the typed FlintFixture object with surface="component"',
        },
        {
            target: 'flint-mcp/src/core/fixtureResolver.ts::resolveFixture',
            kind: 'service',
            behavior: 'Walks up from filePath to projectRoot, returns nearest .flint-fixture.json or typed default.',
            assertion: 'returns ResolvedFixture with source=null when no file found, with absolute source path when found',
            edgeCases: [
                'file at project root with no fixture ⇒ defaults',
                'fixture two directories up ⇒ that one wins',
                'two fixtures in walk-up chain ⇒ nearest wins',
                'malformed JSON ⇒ thrown error names the offending file',
                'tokens path is resolved relative to the fixture file location, not the audited file',
                'symlink that escapes projectRoot ⇒ blocked',
            ],
            given: 'filePath=demos/01-rag-ui-builder/banner-broken.tsx and a fixture at demos/01-rag-ui-builder/.flint-fixture.json',
            when: 'resolveFixture is called',
            then: 'returns ResolvedFixture with fixture.surface==="component" and resolvedTokensPath ending in design-tokens.json',
        },
        {
            target: 'flint-mcp/src/core/fixtureResolver.ts (cache)',
            kind: 'service',
            behavior: 'Per-directory cache prevents repeated walk-ups within a swarm run.',
            assertion: 'reads disk once per directory across N calls in same process',
            edgeCases: [
                'two files in same directory ⇒ one fs.readFile call total for the fixture',
                'cache invalidated when explicitly cleared (test helper)',
            ],
            given: '100 audit calls against files in the same directory',
            when: 'resolveFixture is invoked for each',
            then: 'calls fs.readFile at most once for that directory\'s fixture',
        },
        {
            target: 'flint-mcp/src/core/A11yLinter.ts (applicability filter)',
            kind: 'service',
            behavior: 'Skips rules whose appliesTo does not match the fixture surface — silently.',
            assertion: 'returns violation list with zero entries from skipped rules',
            edgeCases: [
                'surface="component" + rule.appliesTo="document" ⇒ rule never invoked',
                'surface="document" + rule.appliesTo="document" ⇒ rule invoked',
                'rule with no appliesTo defaults to "any" and always runs',
                'no suppressed-log entry is emitted for hard-skipped rules',
            ],
            given: 'a component fixture and rule A11Y-050 (appliesTo:"document")',
            when: 'A11yLinter audits the file with surface:"component"',
            then: 'returns violations array containing no A11Y-050 entry and emits no suppressed-log line for it',
        },
        {
            target: 'flint-mcp/src/core/MithrilLinter.ts (token-aware audit)',
            kind: 'service',
            behavior: 'When fixture.tokens resolves to a real tokens file, MITHRIL-TYP-002 / SPC-001 only fire on values that have no matching token.',
            assertion: 'returns zero MITHRIL-TYP-002 violations on demos/01-rag-ui-builder/banner-compliant.tsx',
            edgeCases: [
                'banner-compliant.tsx ⇒ 0 MITHRIL-TYP-002 + 0 MITHRIL-SPC-001',
                'banner-broken.tsx ⇒ ≥5 violations across MITHRIL-TYP/SPC',
                'fixture present but tokens path missing ⇒ resolvedTokensPath null, audit proceeds with empty registry (existing behavior)',
            ],
            given: 'demos/01-rag-ui-builder/banner-compliant.tsx audited with the demo fixture wired',
            when: 'audit_ui_component runs',
            then: 'returns audit response where verdict="APPROVED" and Mithril count === 0',
        },
        {
            target: 'flint-mcp/src/server.ts::audit_ui_component handler (response shape)',
            kind: 'ipc-handler',
            behavior: 'Audit response includes fixtureContext when a fixture was resolved.',
            assertion: 'returns response with fixtureContext.label and fixtureContext.source set when fixture file found',
            edgeCases: [
                'no fixture file ⇒ fixtureContext omitted (or null)',
                'fixture without label ⇒ fixtureContext.label === undefined but source is set',
            ],
            given: 'an audit run on demos/figma-d2c/expected-output/mui/AccountSettings.tsx with the MUI fixture wired',
            when: 'audit_ui_component completes',
            then: 'returns response.fixtureContext with label==="MUI demo context"',
        },
        {
            target: 'flint-mcp/src/tools/swarm.ts (cache reuse)',
            kind: 'ipc-handler',
            behavior: 'Swarm run shares the fixture-resolver cache across files.',
            assertion: 'calls resolveFixture once per unique directory across the glob',
            edgeCases: [
                'glob hits 50 files across 6 demo directories ⇒ resolver disk reads ≤ 6',
            ],
            given: 'a glob covering all six demo directories',
            when: 'flint_swarm_audit_fix runs',
            then: 'reads each .flint-fixture.json from disk at most once',
        },
        {
            target: 'src/components/editor/StatusBar.tsx (audit-context pill)',
            kind: 'component',
            behavior: 'Renders the audit context label when the latest audit response carries fixtureContext.label.',
            assertion: 'renders pill text equal to fixtureContext.label',
            edgeCases: [
                'no latest audit ⇒ no pill',
                'audit with no fixtureContext ⇒ no pill',
                'long label truncates with ellipsis at fixed width',
            ],
            given: 'canvasStore.latestAudit.fixtureContext.label === "MUI demo context"',
            when: 'StatusBar renders',
            then: 'renders an element with text "MUI demo context"',
        },
        {
            target: 'demos/01-rag-ui-builder regression (compliant vs broken differentiation)',
            kind: 'service',
            behavior: 'After fixture wiring, compliant and broken demos audit to materially different verdicts.',
            assertion: 'returns APPROVED for banner-compliant.tsx and BLOCKED for banner-broken.tsx',
            edgeCases: [
                'banner-compliant.tsx total violations === 0',
                'banner-broken.tsx total violations >= 5',
            ],
            given: 'both demos audited via flint_audit with the demo-01 fixture in place',
            when: 'verdicts are compared',
            then: 'returns APPROVED for compliant and BLOCKED for broken — the gate now distinguishes them',
        },
    ],

    invariants: [
        {
            name: 'resolver-walkup-latency-warm-cache',
            measurable: 'p95 resolveFixture wall-clock latency for a path whose directory is already in the cache',
            threshold: '< 5ms at N=1000',
            measuredBy: 'flint-mcp/src/core/__tests__/fixtureResolver.bench.ts (vitest bench, CI baseline runner)',
        },
        {
            name: 'resolver-walkup-latency-cold-cache',
            measurable: 'p95 resolveFixture wall-clock latency on a cold cache walking up to project root',
            threshold: '< 50ms at depth=10',
            measuredBy: 'fixtureResolver.bench.ts cold-cache scenario',
        },
        {
            name: 'applicability-zero-false-escalations',
            measurable: 'Count of violations recorded for rules whose appliesTo does not match the fixture surface across the demo corpus',
            threshold: '=== 0 across all demos/** files',
            measuredBy: 'flint-mcp/src/core/__tests__/a11yAppliesTo.test.ts corpus run',
        },
        {
            name: 'demo-compliant-clean',
            measurable: 'Number of MITHRIL-TYP-002 + MITHRIL-SPC-001 violations on demos/01-rag-ui-builder/banner-compliant.tsx after fixture wiring',
            threshold: '=== 0',
            measuredBy: 'flint-mcp/src/__tests__/server.audit-fixture.test.ts demo regression block',
        },
        {
            name: 'demo-broken-distinguishable',
            measurable: 'Total violation count on demos/01-rag-ui-builder/banner-broken.tsx after fixture wiring',
            threshold: '>= 5',
            measuredBy: 'server.audit-fixture.test.ts demo regression block',
        },
        {
            name: 'audit-loop-clean-on-demos',
            measurable: 'After flint_swarm_audit_fix runs against demos/** with fixtures in place, re-audit total violation count on the post-fix tree',
            threshold: '=== 0 (matches Beta Gate 1 item #4: audit→fix→re-audit clean run)',
            measuredBy: 'flint-mcp/src/tools/__tests__/swarm.test.ts end-to-end demo loop',
        },
        {
            name: 'no-suppressed-log-spam',
            measurable: 'Count of suppressed-log entries emitted for hard-skipped (appliesTo-mismatched) rules during a corpus audit',
            threshold: '=== 0 (hard-skip is silent — only ruleOverride-skips log, by design)',
            measuredBy: 'a11yAppliesTo.test.ts log assertion',
        },
        {
            name: 'audit-overhead-budget',
            measurable: 'Wall-clock overhead added to a single-file audit by fixture resolution + applicability filtering, warm cache',
            threshold: '< 10ms p95 vs pre-FIXTURE.1 baseline',
            measuredBy: 'server.audit-fixture.bench.ts comparison test',
        },
    ],

    risks: [
        {
            risk: 'Mithril rules are visitor-registered inside MithrilLinter.ts, not per-file. The MithrilAppliesToMap can drift out of sync when a new rule is added.',
            severity: 'medium',
            commandment: 13,
            mitigation:
                'mithrilAppliesTo.test.ts intersects the map keys with the ruleId set extracted from a corpus audit and fails if a rule is missing from the map. New rules force a map entry as part of the same PR.',
        },
        {
            risk: 'A11yLinter changes collide with RUNTIME.1 (runtime-dom source authority) and FIGMA-LINT.1 (Universal AST adapter use).',
            severity: 'medium',
            commandment: 14,
            mitigation:
                'All three swarms commit append-only to A11yLinter.ts. FIXTURE.1 only adds an `surface` option and an applicability filter check; it does not restructure existing rule invocations. Coordinate sequencing via ACTIVE-SWARM-TERRITORY.md.',
        },
        {
            risk: 'A document-level rule is mistakenly classified as appliesTo:"any", causing component fixtures to keep flagging it.',
            severity: 'medium',
            commandment: 5,
            mitigation:
                'Per-rule classification reviewed in code review. Phase 1.5 contract linter spot-checks the landmarks module. Demo regression tests catch mis-classifications by asserting banner-compliant.tsx is APPROVED.',
        },
        {
            risk: 'fixtureResolver could be tricked into reading a file outside projectRoot via "../" in fixture.tokens.',
            severity: 'high',
            commandment: 14,
            mitigation:
                'After path.resolve, assert resolved path startsWith(projectRoot). Reject otherwise and surface an actionable error. Test case included in fixtureResolver.test.ts.',
        },
        {
            risk: 'Existing integration tests that exercised demo fixtures may now report different (lower) violation counts and snapshot-fail.',
            severity: 'low',
            mitigation:
                'Snapshot updates are the bug being fixed. Each updated number documented in the test commit message. The integration validator (Phase 3) re-runs all suites and verifies the new numbers are intentional.',
        },
        {
            risk: 'Glass StatusBar pill collides with the RUNTIME.1 runtime-mode pill.',
            severity: 'low',
            mitigation:
                'Both pills are append-only additions to the same StatusBar. Designer-engineer arranges them in a stable left-to-right order: [coverage] [audit context] [runtime mode]. Tests assert the audit-context pill renders independently.',
        },
        {
            risk: 'Authors may rely on ruleOverrides to silence document-level rules instead of fixing surface classification.',
            severity: 'low',
            mitigation:
                'Documentation in the contract md and FlintFixture JSDoc explicitly states ruleOverrides is a last resort and does NOT resurrect a hard-skipped rule. Code review enforces.',
        },
        {
            risk: 'A11y rule modules grow new rules in parallel branches and forget to set appliesTo.',
            severity: 'low',
            mitigation:
                'Default of undefined ⇒ "any" preserves existing behavior — never makes a rule incorrectly stricter. Worst case is missing a future document-only classification; caught in code review and by demo regression tests.',
        },
    ],

    parallelismGroups: {
        // Group A: schema + resolver + Mithril applicability
        A: ['flint-state-architect', 'flint-ast-surgeon'],
        // Group B: tests (after A signatures land)
        B: ['flint-test-writer'],
        // Group C: Glass surface
        C: ['flint-design-engineer'],
    },

    nonGoals: [
        'No GUI editor for .flint-fixture.json (authoring is JSON-only in this phase)',
        'No fixture sharing across projects (each project owns its own fixtures)',
        'No migration tool for existing demos beyond the fixture files explicitly created in this contract',
        'No per-file overrides — fixtures are per-directory only (use a deeper directory if needed)',
        'No fixture inheritance beyond walk-up resolution (no extends, no merges; nearest-wins is total)',
        'No new MCP tools or resources (audit response carries fixtureContext via existing surface)',
        'No new IPC channels (Glass reads fixtureContext from existing audit response)',
        'No new Zustand stores or store-slice additions',
        'No restructuring of MithrilLinter.ts visitor architecture (append-only)',
        'No restructuring of A11yLinter.ts rule-loading architecture (append-only)',
        'No changes to export-gate logic (Commandment 6 preserved unchanged)',
        'No changes to coverage-classifier (Phase 0 CoverageVerdict remains authoritative)',
        'No re-classification of Mithril rules — every Mithril rule stays appliesTo:"any" (token compliance is universal)',
        'No automatic fixture creation on project open — explicit author opt-in only',
    ],
}
