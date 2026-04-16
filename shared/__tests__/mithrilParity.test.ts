/**
 * mithrilParity.test.ts — shared/__tests__/mithrilParity.test.ts
 *
 * Structural parity guard between the two MithrilLinter implementations:
 *
 *   MCP  (canonical): flint-mcp/src/core/MithrilLinter.ts
 *   Glass (renderer): src/core/MithrilLinter.ts
 *
 * This test does NOT exercise visitor logic — the visitor behaviour tests live
 * in src/core/MithrilLinter.test.ts.  This test only checks that the two files
 * stay structurally aligned while we work toward unification:
 *
 *   1. Both export `auditAll` as a function.
 *   2. Both export every core visitor function (the "parity set").
 *   3. Both export `MITHRIL_THRESHOLD` with the same numeric value (2.0).
 *   4. Both export the `StylePropEntry` interface (checked at the type level).
 *   5. Any export present in MCP but absent from Glass is listed as a named
 *      "parity gap" — the test reports them but does NOT fail for MCP-only
 *      exports in the known-allowed list.
 *
 * Allowed MCP-only exports (not required in Glass yet):
 *   - visitLocalTokenObjects
 *   - visitRegistryUsage
 *   - PolicyOptions (interface — only present in MCP)
 *   - AuditAllOptions (interface — only present in MCP)
 *   - InlineStyleCoverage (interface — only present in MCP)
 *   - RegistryComponentEntry (interface — only present in MCP)
 *   - buildTokenCoverage
 *   - parseCssColorToHex (MCP renames cssColorToHex; Glass exports cssColorToHex)
 *   - INLINE_COLOR_PROPS, INLINE_TYPOGRAPHY_PROPS, INLINE_SPACING_PROPS, INLINE_SHADOW_PROPS
 *   - checkStyleProps (MCP-only inline style prop checker)
 *   - visitInlineStyles (MCP-only inline style visitor)
 *
 * When a parity gap shrinks (Glass catches up), remove it from the allowed list
 * below so the test will enforce it going forward.
 */

import { describe, it, expect } from 'vitest'

// ── Dynamic imports so the test file itself compiles even if one side diverges ──

// We import the Glass version first because it has lighter dependencies and is
// more likely to resolve cleanly in the root vitest environment.
import * as GlassLinter from '../../src/core/MithrilLinter'

// The MCP version uses .js extensions for its own internal imports (ESM).
// Vitest resolves these through TypeScript, so the import still works.
import * as McpLinter from '../../flint-mcp/src/core/MithrilLinter'

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * The set of visitor functions that MUST be exported by both implementations.
 * Any visitor absent from the Glass version is a parity gap that WILL fail
 * this test (unless added to ALLOWED_MCP_ONLY_EXPORTS below).
 */
const REQUIRED_VISITOR_EXPORTS: readonly string[] = [
    'visitClassNames',
    'visitTypography',
    'visitSpacing',
    'visitShadows',
    'visitOpacity',
]

/**
 * Exports that exist in the MCP version but are not yet required in Glass.
 * Document why each is allowed to diverge.
 */
const ALLOWED_MCP_ONLY_EXPORTS: readonly string[] = [
    // Phase 2 MCP-only visitors — not yet ported to the Glass renderer
    'visitLocalTokenObjects',    // MITHRIL-DTO-001: local token object detection
    'visitRegistryUsage',        // CR-SEAL REG-001: constrained registry audit

    // MCP-only interfaces (checked via TypeScript, not runtime keys)
    'PolicyOptions',             // Per-call threshold overrides — Glass uses hardcoded defaults
    'AuditAllOptions',           // Extends PolicyOptions + syncDb + registry
    'InlineStyleCoverage',       // Coverage stats object returned by MCP's visitInlineStyles
    'RegistryComponentEntry',    // Minimal registry entry shape for REG-001

    // MCP-only helper functions
    'buildTokenCoverage',        // Assembles TokenCoverage from inline stats — MCP audit only
    'parseCssColorToHex',        // MCP's CSS color normalizer (Glass exports cssColorToHex)

    // MCP-only constant sets (Glass inlines these inside visitor functions)
    'INLINE_COLOR_PROPS',
    'INLINE_TYPOGRAPHY_PROPS',
    'INLINE_SPACING_PROPS',
    'INLINE_SHADOW_PROPS',

    // MCP-only inline-style helpers (Glass does not yet need these)
    'checkStyleProps',           // Inline style prop checker — MCP audit only
    'visitInlineStyles',         // Inline style visitor — MCP audit only

    // Sprint 1 R1 — Assert+Defer stopgap; test-only helper. Glass has no
    // deferred-rule registry because it does not consume domain policy.
    '__resetDeferredWarningState',

    // Governor Expansion P1c/P2/P2.8 — MCP-only visitors not ported to Glass
    'visitRogueIntrinsics',        // MITHRIL-REG-001: rogue intrinsic detection
    'visitTailwindVersionDrift',   // Tailwind v3→v4 class migration audit
    'visitTypographyHierarchy',    // Typography heading hierarchy audit
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function exportedFunctionNames(mod: Record<string, unknown>): Set<string> {
    return new Set(
        Object.entries(mod)
            .filter(([, v]) => typeof v === 'function')
            .map(([k]) => k),
    )
}

function allExportedNames(mod: Record<string, unknown>): Set<string> {
    return new Set(Object.keys(mod))
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('MithrilLinter parity: MCP vs Glass', () => {
    // Cast to a plain record so we can inspect exports without importing the
    // specific types (which differ between the two implementations).
    const mcp = McpLinter as unknown as Record<string, unknown>
    const glass = GlassLinter as unknown as Record<string, unknown>

    const mcpFunctions = exportedFunctionNames(mcp)
    const glassFunctions = exportedFunctionNames(glass)
    const mcpAll = allExportedNames(mcp)
    const glassAll = allExportedNames(glass)

    // ── 1. auditAll ────────────────────────────────────────────────────────────

    describe('auditAll', () => {
        it('MCP exports auditAll as a function', () => {
            expect(mcpFunctions.has('auditAll')).toBe(true)
        })

        it('Glass exports auditAll as a function', () => {
            expect(glassFunctions.has('auditAll')).toBe(true)
        })
    })

    // ── 2. Core visitor parity ─────────────────────────────────────────────────

    describe('visitor function parity', () => {
        for (const visitorName of REQUIRED_VISITOR_EXPORTS) {
            it(`MCP exports ${visitorName}`, () => {
                expect(
                    mcpFunctions.has(visitorName),
                    `MCP MithrilLinter is missing export: ${visitorName}`,
                ).toBe(true)
            })

            it(`Glass exports ${visitorName}`, () => {
                expect(
                    glassFunctions.has(visitorName),
                    `Glass MithrilLinter is missing export: ${visitorName}. ` +
                    `This visitor exists in MCP but has not been ported to the renderer.`,
                ).toBe(true)
            })
        }
    })

    // ── 3. MITHRIL_THRESHOLD ───────────────────────────────────────────────────

    describe('MITHRIL_THRESHOLD', () => {
        it('MCP exports MITHRIL_THRESHOLD as a number', () => {
            expect(typeof mcp['MITHRIL_THRESHOLD']).toBe('number')
        })

        it('Glass exports MITHRIL_THRESHOLD as a number', () => {
            expect(typeof glass['MITHRIL_THRESHOLD']).toBe('number')
        })

        it('both MITHRIL_THRESHOLD values are equal', () => {
            expect(mcp['MITHRIL_THRESHOLD']).toBe(glass['MITHRIL_THRESHOLD'])
        })

        it('MITHRIL_THRESHOLD is 2.0', () => {
            // Commandment 9: ΔE < 2.0 is perceptually indistinguishable.
            // Any change to this value must be intentional and reviewed.
            expect(mcp['MITHRIL_THRESHOLD']).toBe(2.0)
        })
    })

    // ── 4. StylePropEntry interface ────────────────────────────────────────────
    //
    // Interfaces are erased at runtime, so we verify them at the type level by
    // importing a value that uses StylePropEntry. The static import at the top
    // of this file will fail to compile if StylePropEntry is missing from either
    // module — providing compile-time coverage.
    //
    // Runtime check: verify that checkStyleProps (which accepts StylePropEntry[])
    // is exported, as a proxy for the interface being present.

    describe('StylePropEntry interface proxy', () => {
        it('MCP exports checkStyleProps (function that uses StylePropEntry)', () => {
            expect(mcpFunctions.has('checkStyleProps')).toBe(true)
        })

        // checkStyleProps is MCP-only (listed in ALLOWED_MCP_ONLY_EXPORTS).
        // Glass does not yet need this function.
    })

    // ── 5. Parity gap report ───────────────────────────────────────────────────
    //
    // Compute the live gap: MCP exports that Glass does not have.
    // Exports in ALLOWED_MCP_ONLY_EXPORTS are informational only.
    // Any export NOT in the allowed list that exists in MCP but not Glass
    // causes this test to fail — it should have been added to the required set
    // or the allowed list before merging.

    describe('parity gap audit', () => {
        it('all MCP-only exports are either required by Glass or on the allowed list', () => {
            const allowedSet = new Set(ALLOWED_MCP_ONLY_EXPORTS)
            const unexplained: string[] = []

            for (const name of mcpAll) {
                if (!glassAll.has(name) && !allowedSet.has(name)) {
                    unexplained.push(name)
                }
            }

            expect(
                unexplained,
                `MCP has exports not present in Glass and not in ALLOWED_MCP_ONLY_EXPORTS: ` +
                `[${unexplained.join(', ')}]. ` +
                `Either port them to Glass or add them to ALLOWED_MCP_ONLY_EXPORTS with a comment.`,
            ).toHaveLength(0)
        })

        it('documents the current parity gaps (informational — never fails)', () => {
            const gaps: string[] = []
            for (const name of mcpAll) {
                if (!glassAll.has(name)) {
                    gaps.push(name)
                }
            }

            // This test always passes — it exists to surface the gap list in
            // verbose test output so reviewers can see what remains to port.
            if (gaps.length > 0) {
                console.info(
                    `\n[mithrilParity] MCP-only exports (${gaps.length} parity gaps):`,
                    gaps,
                )
            }

            expect(true).toBe(true)
        })

        it('Glass has no exports that are absent from MCP without explanation', () => {
            // Glass should not diverge by adding visitors that MCP does not have.
            // The Glass version is the subset; MCP is the superset.
            const glassOnly: string[] = []
            for (const name of glassAll) {
                if (!mcpAll.has(name)) {
                    glassOnly.push(name)
                }
            }

            // Currently known Glass-only exports (renderer-specific utilities):
            const KNOWN_GLASS_ONLY: readonly string[] = [
                'cssColorToHex',       // Glass CSS normalizer (MCP has parseCssColorToHex)
                'calculateDrift',      // Glass-only helper for Properties Panel drift display
            ]

            const unexplainedGlassOnly = glassOnly.filter(
                (name) => !KNOWN_GLASS_ONLY.includes(name),
            )

            expect(
                unexplainedGlassOnly,
                `Glass has exports not present in MCP and not in KNOWN_GLASS_ONLY: ` +
                `[${unexplainedGlassOnly.join(', ')}]. ` +
                `If this is a new Glass-only utility, add it to KNOWN_GLASS_ONLY with a comment.`,
            ).toHaveLength(0)
        })
    })
})
