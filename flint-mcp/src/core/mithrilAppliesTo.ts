/**
 * mithrilAppliesTo — flint-mcp/src/core/mithrilAppliesTo.ts
 *
 * FIXTURE.1 — Audit Context System
 *
 * Static map of every Mithril ruleId → RuleAppliesTo.
 *
 * Design decision: ALL Mithril rules are 'any'.
 * Token compliance (color drift, typography, spacing, shadow, opacity, inline
 * styles, layout objects, registry membership, Tailwind version) is a universal
 * concern that must be checked at every surface — document, section, and
 * component alike. The metadata bucket is established here for future
 * flexibility but no Mithril rule is downgraded in FIXTURE.1.
 *
 * When a new Mithril rule is added, add an entry here in the same PR.
 * The mithrilAppliesTo.test.ts intersection test will fail CI if a ruleId
 * emitted by the linter is missing from this map.
 */

import type { MithrilAppliesToMap } from '../../../shared/fixture-schema.js'

// ─── FIXTURE.1: MithrilAppliesToMap ─────────────────────────────────────────

export const MITHRIL_APPLIES_TO: MithrilAppliesToMap = {
    // ── Color drift ─────────────────────────────────────────────────────────
    'MITHRIL-COL': 'any',

    // ── Typography ──────────────────────────────────────────────────────────
    'MITHRIL-TYP-001': 'any',
    'MITHRIL-TYP-002': 'any',
    'MITHRIL-TYP-003': 'any',
    'MITHRIL-TYP-004': 'any',
    'MITHRIL-TYP-005': 'any',
    'MITHRIL-TYP-HIERARCHY': 'any',

    // ── Spacing ─────────────────────────────────────────────────────────────
    'MITHRIL-SPC-001': 'any',
    'MITHRIL-SPC-TOUCH': 'any',

    // ── Shadow ──────────────────────────────────────────────────────────────
    'MITHRIL-SHD-001': 'any',

    // ── Opacity ─────────────────────────────────────────────────────────────
    'MITHRIL-OPC-001': 'any',

    // ── Inline style props ───────────────────────────────────────────────────
    'MITHRIL-IST-COL': 'any',
    'MITHRIL-IST-TYP': 'any',
    'MITHRIL-IST-SPC': 'any',
    'MITHRIL-IST-SHD': 'any',
    'MITHRIL-IST-OPC': 'any',

    // ── Local design-token objects ───────────────────────────────────────────
    'MITHRIL-DTO-001': 'any',

    // ── Registry / rogue intrinsics ──────────────────────────────────────────
    'MITHRIL-REG-001': 'any',

    // ── Tailwind version drift ────────────────────────────────────────────────
    'MITHRIL-TW-001': 'any',
    'MITHRIL-TW-002': 'any',

    // ── Dark-mode safety ─────────────────────────────────────────────────────
    'MITHRIL-DARK-001': 'any',

    // ── Fluid interpolation advisory ─────────────────────────────────────────
    'MITHRIL-FLUID-001': 'any',

    // ── Composition validation ────────────────────────────────────────────────
    'MITHRIL-COMP-001': 'any',
    'MITHRIL-COMP-002': 'any',
    'MITHRIL-COMP-003': 'any',

    // ── Motion drift ─────────────────────────────────────────────────────────
    'MITHRIL-MOTION-001': 'any',

    // ── Sync violations (SYNC-001, SYNC-002 ride through Mithril output) ─────
    'SYNC-001': 'any',
    'SYNC-002': 'any',
} satisfies MithrilAppliesToMap
