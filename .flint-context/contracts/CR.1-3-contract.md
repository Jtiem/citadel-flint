# Contract: CR.1-3 — Constrained Registry (Proactive Generation Constraints)

**Phase:** CR.1-3
**Status:** APPROVED
**Owner:** flint-orchestrator
**Date:** 2026-03-20

---

## Problem

The AI orchestrator can propose components and styles that don't exist in the project's design system. Governance catches violations _after_ code is generated (Mithril, A11y). The user's vision: describe what they want built, and Flint ensures only allowed components and styles are used. This requires flipping governance from reactive to proactive.

## Scope

Three changes to `electron/orchestrator.ts`, all within the existing architecture:

### CR.1: System Prompt Injection (Component Registry + Design Tokens)

**What:** After `loadComponentRegistry(workspaceRoot)` at line ~1442, serialize the project's registered components and design tokens into the system prompt as a BINDING constraint block.

**Where:** `electron/orchestrator.ts` — new function `buildConstraintBlock()` + injection into `systemPromptForCall` at line ~1547.

**Behavior:**
1. New exported function `serializeRegistryConstraints(registry, scope?)` → returns a markdown string listing allowed components with their props, variants, and consumed tokens.
2. New exported function `serializeTokenConstraints(tokens)` → returns a markdown string listing the allowed token palette (colors, spacing, typography).
3. At `sendChatMessage()` time, after loading registry and before the Anthropic call:
   - Load tokens via existing `loadMithrilTokens()` (line ~1186)
   - Read optional `componentScope` from policy.json (CR.3)
   - Filter registry by scope if present
   - Build constraint block from filtered registry + tokens
   - Prepend to `systemPromptForCall`

**System Prompt Addition (template):**
```
## Project Component Registry (BINDING)

You MUST only compose UI from components in this registry. Do NOT reference, create, or import components not listed here. If the user's request cannot be fulfilled with these components, explain what's missing.

Available components:
- Button (props: variant[required], size, disabled) (variants: primary, secondary, ghost) (tokens: color.primary, color.surface)
- Card (props: title, elevation) (variants: default, outlined)
- Input (props: label[required], type, required, error) (variants: text, email, password)

## Design Token Palette (BINDING)

All visual properties MUST use these tokens. Do NOT use arbitrary hex colors, pixel values, or spacing values not in this list.

Colors: primary-500 (#2563EB), neutral-100 (#F5F5F5), error-500 (#EF4444)
Spacing: 4, 8, 12, 16, 24, 32, 48, 64
Typography: heading-lg (24/32 Inter 700), body-md (16/24 Inter 400)
```

**Edge cases:**
- Empty registry → omit the component constraint block entirely (backward compatible)
- Empty tokens → omit the token constraint block (backward compatible)
- Very large registry (50+ components) → truncate to first 40 with a note: "40 of N components shown. Use flint_search_design_system for the full catalog."

### CR.2: Hard Rejection in Validation Loop

**What:** Extend `validateToolInput()` to reject mutation ops targeting components not in the registry.

**Where:** `electron/orchestrator.ts` — new function `validateRegistryMembership(toolName, input)` called at the top of `validateToolInput()`, after the `MUTATION_TOOL_NAMES` check.

**Behavior:**
1. New exported function `validateRegistryMembership(toolName, input, registry)` → returns `string | null`
2. For these tools, extract the component name and check registry membership:
   - `flint_insert_node` → check `input.nodeType` (skip HTML intrinsics: div, span, p, h1-h6, section, article, nav, main, header, footer, aside, ul, ol, li, a, img, button, input, textarea, select, form, label, table, tr, td, th, thead, tbody, tfoot, details, summary, dialog, figure, figcaption, blockquote, pre, code, hr, br, svg, path)
   - `flint_wrap_node` → check `input.wrapperType` (same HTML intrinsic skip list)
   - `flint_compose_slot` → check the root component of `input.slotName` (e.g., "Dialog" from "Dialog.Header")
   - `flint_emit_hook` → no check (hooks are not components)
   - `flint_emit_handler` → no check (handlers are not components)
   - `flint_emit_callback` → no check (callbacks are not components)
   - `flint_emit_import` → no check (imports may be utilities, not just components)
3. If the component is NOT an HTML intrinsic AND NOT in `cachedRegistry`:
   - Return error: `"Component '${name}' is not in the project registry. Available components: ${registryNames.join(', ')}. Use only registered components or HTML intrinsics."`
4. If registry is empty → skip validation entirely (no registry = no constraint)

**Integration point:** Called inside `validateToolInput()` at line ~1229, immediately after the `MUTATION_TOOL_NAMES` check and before all existing guards.

### CR.3: Per-Project Component Scope

**What:** Read `componentScope` from `.flint/policy.json` to filter which registry entries are available.

**Where:** `electron/orchestrator.ts` — extend the existing policy.json read at line ~1549.

**Behavior:**
1. Extend the `policy` type to include `componentScope?: string[]`
2. If `componentScope` is present and non-empty, filter `cachedRegistry` to only entries whose key is in the scope array
3. The filtered registry is used for both system prompt injection (CR.1) and validation (CR.2)
4. If `componentScope` is absent → full registry is available (backward compatible)

**Policy.json schema extension:**
```json
{
  "domain": "ecommerce",
  "componentScope": ["Button", "Card", "Input", "Modal", "ProductTile"],
  "tokenSet": "brand-primary"
}
```

## Files Modified

| File | Changes |
|------|---------|
| `electron/orchestrator.ts` | `serializeRegistryConstraints()`, `serializeTokenConstraints()`, `validateRegistryMembership()`, system prompt injection, policy scope filter |

## Files Created

| File | Purpose |
|------|---------|
| `electron/__tests__/constrainedRegistry.test.ts` | Unit tests for all three CR features |

## Test Requirements

### CR.1 Tests
1. `serializeRegistryConstraints` returns correct markdown for a 3-component registry
2. `serializeRegistryConstraints` returns empty string for empty registry
3. `serializeRegistryConstraints` with scope filters to only scoped components
4. `serializeRegistryConstraints` truncates at 40 components for large registries
5. `serializeTokenConstraints` returns correct palette summary for color + spacing + typography tokens
6. `serializeTokenConstraints` returns empty string for empty token array

### CR.2 Tests
7. `validateRegistryMembership` returns null for HTML intrinsics (div, span, button)
8. `validateRegistryMembership` returns null for registered components
9. `validateRegistryMembership` returns error string for unregistered PascalCase components
10. `validateRegistryMembership` returns null when registry is empty (no-op)
11. `validateRegistryMembership` extracts root component from compose_slot slotName ("Dialog.Header" → "Dialog")
12. `validateRegistryMembership` skips non-component tools (emit_hook, emit_handler)

### CR.3 Tests
13. Scope filter reduces registry from 5 to 2 entries when componentScope has 2 items
14. Absent componentScope returns full registry
15. Empty componentScope array returns full registry

## Commandment Compliance

- **Cmd 15:** No change — still using AST Tool Catalog exclusively
- **Cmd 16:** Extended — validation loop now includes registry membership
- **Cmd 8:** No change — complexity router untouched
- **Cmd 13:** No change — still Babel-only

## Non-Goals

- No Glass UI changes (CR.4 is a separate phase)
- No new IPC channels
- No database schema changes
- No changes to flint-mcp (the MCP server's own audit tools are unaffected)
