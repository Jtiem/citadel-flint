/**
 * axe-core Rule ID → Warden Rule ID Map
 * flint-mcp/src/core/axeRuleMap.ts
 *
 * RUNTIME.1 — Gap #3 closure (DOM-layer governance).
 *
 * This module provides a curated 1:1 mapping from axe-core rule IDs (as emitted
 * by `axe.run()` at version 4.10.3) to Warden (Flint a11y) rule IDs. It powers
 * the deduplication key used by the runtime adapter:
 *
 *     dedup key = (mappedWardenRuleId, elementId)
 *
 * When an axe-core rule has a direct Warden equivalent (this map), its runtime
 * finding collapses into the matching AST finding, producing a single row with
 * `sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom']`.
 *
 * Axe-only rules (no Warden counterpart, null return) get a `RUNTIME-*` prefix
 * and surface alone with `sourceAuthorities: ['runtime-dom']`.
 *
 * All ruleIds in this map must match valid Warden rule IDs defined in:
 *   flint-mcp/src/core/a11y/rules/*.ts
 *
 * Verified against the runtime registry at implementation time. When axe-core
 * releases new rules, this map is expected to be explicitly updated — the
 * tests fail-fast on drift (see axeRuleMap.test.ts).
 *
 * Contract: .flint-context/contracts/RUNTIME.1.contract.ts
 *           (AxeRuleMap, MapAxeRuleToWarden exports)
 */

// ── Curated map (axe-core 4.10.3) ─────────────────────────────────────────────
//
// Casing matches axe's rule-id output verbatim (lowercase, hyphenated).
// Every value is a Warden rule ID verified present in the live rule modules.

export const AXE_RULE_MAP: Readonly<Record<string, string>> = Object.freeze({
    // ── Names and Labels (names-labels.ts) ─────────────────────────────────
    'image-alt': 'A11Y-001',                 // Image Missing Alt
    'button-name': 'A11Y-002',               // Button Missing Accessible Name
    'link-name': 'A11Y-003',                 // Link Missing Discernible Text
    'label': 'A11Y-004',                     // Form Control Missing Label
    'select-name': 'A11Y-004',               // <select> accessible name → form label rule
    'input-image-alt': 'A11Y-005',           // <input type="image"> Missing Alt
    'area-alt': 'A11Y-006',                  // <area> Missing Alt
    'frame-title': 'A11Y-018',               // IFrame Missing Title

    // ── Keyboard (keyboard.ts) ─────────────────────────────────────────────
    'accesskeys': 'A11Y-007',                // Accesskey Attribute Duplicated
    'tabindex': 'A11Y-007',                  // tabindex > 0 mapped to same Warden rule
    'focus-order-semantics': 'A11Y-020',     // Non-Interactive Element With Click Handler

    // ── Structure (structure.ts) ───────────────────────────────────────────
    'heading-order': 'A11Y-008',             // Heading Level Skipped
    'empty-heading': 'A11Y-009',             // Heading Has No Content
    'document-title': 'A11Y-010',            // Document Missing Title
    'page-has-heading-one': 'A11Y-017',      // Page Must Have Exactly One H1
    'list': 'A11Y-015',                      // List Contains Non-List-Item Children
    'listitem': 'A11Y-015',                  // Listitem outside <ul>/<ol> → list structure
    'definition-list': 'A11Y-016',           // Definition List Contains Invalid Children

    // ── ARIA (aria.ts) ─────────────────────────────────────────────────────
    'aria-roles': 'A11Y-030',                // Invalid ARIA Role
    'aria-required-children': 'A11Y-031',    // Required ARIA Children Missing
    'aria-required-parent': 'A11Y-032',      // Element Outside Required ARIA Parent
    'aria-required-attr': 'A11Y-033',        // Required ARIA Attribute Missing
    'aria-valid-attr': 'A11Y-034',           // Invalid ARIA Attribute Name
    'aria-valid-attr-value': 'A11Y-035',     // Invalid ARIA Attribute Value
    'aria-hidden-focus': 'A11Y-036',         // Aria-Hidden On Focusable Element
    'aria-allowed-attr': 'A11Y-037',         // ARIA Attribute Not Allowed For Role
    'aria-allowed-role': 'A11Y-038',         // ARIA Role Not Allowed For Element

    // ── Landmarks (landmarks.ts) ───────────────────────────────────────────
    'landmark-one-main': 'A11Y-050',         // Missing Main Landmark
    'landmark-no-duplicate-main': 'A11Y-052', // Multiple Main Landmarks
    'landmark-unique': 'A11Y-053',           // Duplicate Landmark Without Distinct Label

    // ── Contrast (contrast.ts) ─────────────────────────────────────────────
    'color-contrast': 'A11Y-060',            // Normal Text Insufficient Contrast (WCAG 1.4.3 AA)
    'color-contrast-enhanced': 'A11Y-061',   // Large Text Insufficient Contrast

    // ── Forms (forms.ts) ───────────────────────────────────────────────────
    'fieldset': 'A11Y-070',                  // Fieldset Missing Legend
    'aria-input-field-name': 'A11Y-071',     // Required Input Missing aria-required
    // NOTE: axe's `form-field-multiple-labels` has no 1:1 Warden mapping.
    // It surfaces under the RUNTIME-* fallback.
})

/**
 * Map an axe-core rule ID to its Warden equivalent.
 *
 * @param axeRuleId — axe-core rule identifier, e.g. 'color-contrast', 'image-alt'.
 * @returns The Warden rule ID (e.g. 'A11Y-060') when a mapping exists, or null
 *          when the axe rule has no Warden counterpart. Callers use the null
 *          return to apply the `RUNTIME-*` prefix fallback.
 *
 * Edge cases:
 *   - Null/undefined → null
 *   - Empty string → null
 *   - Whitespace-only string → null
 *   - Unknown rule ID → null
 *   - Case-sensitive: axe emits lowercase rule IDs; case variants return null.
 */
export function mapAxeRuleToWardenRule(axeRuleId: string): string | null {
    if (typeof axeRuleId !== 'string') return null
    if (axeRuleId.length === 0) return null
    if (axeRuleId.trim().length === 0) return null
    return AXE_RULE_MAP[axeRuleId] ?? null
}

/**
 * Contract-facing alias — the RUNTIME.1.contract.ts type surface names this
 * function `mapAxeRuleToWarden`. Both identifiers point at the same
 * implementation so either import works.
 */
export const mapAxeRuleToWarden = mapAxeRuleToWardenRule
