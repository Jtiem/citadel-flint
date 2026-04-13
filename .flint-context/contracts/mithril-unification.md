# Contract: Mithril Linter Unification

**Phase:** Infrastructure / Technical Debt
**Status:** CONTRACT READY
**Date:** 2026-04-05

## Problem

Two copies of MithrilLinter exist and have drifted:

| | `flint-mcp/src/core/MithrilLinter.ts` (MCP) | `src/core/MithrilLinter.ts` (Glass) |
|---|---|---|
| Visitors | 8 (COL, TYP, SPC, SHD, OPC, IST, DTO, REG) | 6 (COL, TYP, SPC, SHD, OPC, INL) |
| PolicyOptions | Yes (deltaE threshold, critical threshold, per-rule modes) | No |
| Coverage stats | Yes (InlineStyleCoverage, buildTokenCoverage) | No |
| Error taxonomy | Yes (ruleId, explanation, recovery on every warning) | No |
| Local token objects | Yes (visitLocalTokenObjects / MITHRIL-DTO-001) | No |
| Registry usage | Yes (visitRegistryUsage / REG-001) | No |
| Sync violations | Yes (SYNC-001/002 via syncDb) | No |
| Line/column reporting | Yes | No |
| Color parser | `parseCssColorToHex` (hex + rgb/rgba, no hsl) | `cssColorToHex` (hex + rgb/rgba + hsl/hsla) |
| findClosestToken | Inlined (uses shared/ciede2000) | Delegates to `src/utils/tokenMatcher.ts` |
| severity() | Accepts `criticalThreshold` param | Hardcoded threshold 10 |
| Rule IDs in messages | MITHRIL-IST-COL/TYP/SPC/SHD/OPC | MITHRIL-INL-COL/TYP/SPC/SHD/OPC |

## Architecture Decision

Move all **pure linting logic** (Babel AST + tokens in, warnings out) to `shared/mithrilCore.ts`. Both MCP and Glass import from there. Environment-specific wrappers remain as thin re-export modules.

### What is "pure" here

A function is pure (shareable) if it depends ONLY on:
- `@babel/traverse`, `@babel/types` (available in both environments)
- `shared/ciede2000.ts` (already shared)
- Design token data passed as arguments
- No `fs`, `path`, `better-sqlite3`, `Database`, or any Node.js API
- No MCP-specific imports (`errorTaxonomy`, `syncViolationChecker`, `htmlIntrinsics`)

---

## 1. Impact Map

| File | Change Type | Owner Agent |
|------|-------------|-------------|
| `shared/mithrilCore.ts` | **CREATE** | `flint-ast-surgeon` |
| `shared/mithrilTypes.ts` | **CREATE** | `flint-ast-surgeon` |
| `flint-mcp/src/core/MithrilLinter.ts` | **REWRITE to thin wrapper** | `flint-ast-surgeon` |
| `src/core/MithrilLinter.ts` | **REWRITE to thin wrapper** | `flint-ast-surgeon` |
| `src/utils/tokenMatcher.ts` | **DELETE or deprecate** | `flint-ast-surgeon` |
| `flint-mcp/tsconfig.json` | **MODIFY** (include shared/) | `flint-ast-surgeon` |
| `src/types/flint-api.d.ts` | **MODIFY** (align LinterWarning) | `flint-state-architect` |
| `flint-mcp/src/types.ts` | **MODIFY** (import from shared) | `flint-state-architect` |
| All MCP test files importing MithrilLinter | **NO CHANGE** (re-exports preserve API) | -- |
| `src/components/mithril/MithrilProvider.tsx` | **NO CHANGE** (re-exports preserve API) | -- |
| `src/components/ui/PropertiesPanel.tsx` | **NO CHANGE** (re-exports preserve API) | -- |

## 2. Type Contracts

### 2a. Types moving to `shared/mithrilTypes.ts`

These types are currently duplicated or split across `flint-mcp/src/types.ts` and `src/types/flint-api.d.ts`. The shared version becomes the single source of truth.

```typescript
// shared/mithrilTypes.ts

/** W3C DTCG token type union. */
export type TokenType =
    | 'color' | 'dimension' | 'fontFamily' | 'fontWeight'
    | 'lineHeight' | 'letterSpacing' | 'shadow' | 'opacity'
    | 'duration' | 'cubicBezier' | 'number' | 'other'

/** Minimal DesignToken shape needed by Mithril linting. */
export interface MithrilDesignToken {
    token_path: string
    token_type: TokenType
    token_value: string
}

/** Result of findClosestToken color matching. */
export interface TokenMatch {
    tokenPath: string
    tokenValue: string
    deltaE: number
}

/** A single resolved inline style property, framework-independent. */
export interface StylePropEntry {
    prop: string
    stringValue: string | null
    numericValue: number | null
}

/** Optional policy overrides for threshold-dependent linter behavior. */
export interface PolicyOptions {
    deltaE_threshold?: number
    deltaE_critical_threshold?: number
    ruleModes?: Record<string, 'blocking' | 'advisory' | 'off'>
}

/** Coverage statistics returned by visitInlineStyles. */
export interface InlineStyleCoverage {
    inlinePropsScanned: number
    inlinePropsSkipped: number
    inlineViolations: number
}

/**
 * Linter warning — the FULL shape with all optional enrichment fields.
 * This is the superset. Glass was missing ruleId/explanation/recovery/line/column.
 */
export interface MithrilWarning {
    id: string
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift'
        | 'opacity-drift' | 'a11y' | 'semantic-drift' | 'sync'
        | 'inline-style-drift' | 'registry'
    severity: 'amber' | 'critical' | 'advisory'
    value: number
    message: string
    nearestToken: string | null
    nearestTokenValue: string | null
    ruleId?: string
    wcag?: string
    fixable?: boolean
    explanation?: string
    recovery?: string
    line?: number
    column?: number
}

/** Token coverage report for audit results. */
export interface TokenCoverage {
    colorTokens: number
    dimensionTokens: number
    shadowTokens: number
    fontWeightTokens: number
    inlinePropsScanned: number
    inlinePropsSkipped: number
    inlineViolations: number
}
```

**IMPORTANT:** Both `flint-mcp/src/types.ts` `LinterWarning` and `src/types/flint-api.d.ts` `LinterWarning` should re-export or extend `MithrilWarning` from shared. This way existing imports throughout the codebase do not break.

### 2b. Decision: `MithrilDesignToken` vs full `DesignToken`

The shared linting functions only need `token_path`, `token_type`, and `token_value`. They do NOT need `id`, `description`, `mode`, or `collection_name`. Using a minimal interface means the shared module has zero dependency on either environment's full DesignToken shape. Both environments' `DesignToken` structurally satisfies `MithrilDesignToken` so no casting is needed at call sites.

## 3. Functions Moving to `shared/mithrilCore.ts`

### Pure functions (MOVE)

| Function | Current location(s) | Notes |
|----------|---------------------|-------|
| `MITHRIL_THRESHOLD` | Both | Constant = 2.0 |
| `findClosestToken` | MCP (inlined), Glass (in tokenMatcher.ts) | Unify. Uses `shared/ciede2000.ts` |
| `parseCssColorToHex` | MCP only | Merge with Glass `cssColorToHex` — take the **Glass version** which also handles HSL |
| `cssColorToHex` helpers (`clampByte`, `toHex`, `byteToHex`, `hslToRgb`) | Glass only | Move to shared (private) |
| `getFlintId` | Both (identical) | Private helper |
| `getClassString` | Both (identical) | Private helper |
| `severity` | Both (MCP accepts param, Glass hardcodes 10) | Take MCP version with optional param, default 10 |
| `ARBITRARY_COLOR_RE` | Both (identical) | Constant |
| `TYP_REGEXES` | Both (identical) | Constant |
| `SPACING_RE` | Both (identical) | Constant |
| `SHADOW_RE` | Both (identical) | Constant |
| `OPACITY_RE` | Both (identical) | Constant |
| `INLINE_COLOR_PROPS` | Both (identical) | Constant |
| `INLINE_TYPOGRAPHY_PROPS` | Both (identical) | Constant |
| `INLINE_SPACING_PROPS` | Both (identical) | Constant |
| `INLINE_SHADOW_PROPS` | Both (identical) | Constant |
| `checkStyleProps` | Both (MCP has PolicyOptions, Glass doesn't) | Take MCP version with optional PolicyOptions |
| `visitClassNames` | Both (MCP has PolicyOptions + loc, Glass doesn't) | Take MCP version |
| `visitTypography` | Both (MCP has PolicyOptions + loc, Glass doesn't) | Take MCP version |
| `visitSpacing` | Both (MCP has PolicyOptions + loc, Glass doesn't) | Take MCP version |
| `visitShadows` | Both (MCP has PolicyOptions + loc, Glass doesn't) | Take MCP version |
| `visitOpacity` | Both (MCP has PolicyOptions + loc, Glass doesn't) | Take MCP version |
| `visitInlineStyles` | Both (MCP returns `{warnings, coverage}`, Glass returns `Map`) | Take MCP version returning `{warnings, coverage}` |
| `buildTokenCoverage` | MCP only | Move (pure function) |
| `visitLocalTokenObjects` | MCP only | Move (pure, uses only shared/ciede2000) |
| `isTokenLike` | MCP only | Move (private helper) |
| `matchesFlintToken` | MCP only | Move (private helper, uses shared/ciede2000) |
| `HEX_COLOR_RE`, `PX_VALUE_RE` | MCP only | Move (private constants) |

### Functions that CANNOT be shared (stay in wrappers)

| Function | Location | Reason |
|----------|----------|--------|
| `taxonomyFields()` | MCP wrapper | Imports `getErrorEntryByRuleId` from `flint-mcp/src/core/errorTaxonomy.ts` — MCP-only module |
| `visitRegistryUsage` | MCP wrapper | Imports `HTML_INTRINSIC_TAGS`, `REACT_BUILTINS` from `flint-mcp/src/core/htmlIntrinsics.ts` |
| `auditAll` (MCP version) | MCP wrapper | Orchestrates sync violations via `better-sqlite3` `Database`, calls `checkSyncViolations` |
| `auditAll` (Glass version) | Glass wrapper | Simpler orchestration, no sync/registry/DTO |
| `calculateDrift` | Glass wrapper | Convenience function only used by Glass, delegates to shared `findClosestToken` |

### Key design: Taxonomy injection

The shared visitors currently call `...taxonomyFields('MITHRIL-COL')` to attach `explanation` and `recovery` fields. Since `taxonomyFields` depends on MCP-only `errorTaxonomy.ts`, the shared versions will accept an **optional callback** parameter:

```typescript
type TaxonomyLookup = (ruleId: string) => { explanation?: string; recovery?: string }
```

- MCP wrapper passes `taxonomyFields` from errorTaxonomy.
- Glass wrapper passes `undefined` (no taxonomy enrichment in Glass -- it gets enrichment from MCP via IPC).
- All visitors accept this as a trailing optional parameter.

## 4. `visitInlineStyles` return type reconciliation

**MCP version** returns `{ warnings: Map<string, MithrilWarning>; coverage: InlineStyleCoverage }`.
**Glass version** returns `Map<string, LinterWarning>`.

The shared version will return the MCP shape (warnings + coverage). The Glass wrapper will destructure and return just the warnings map for backward compatibility:

```typescript
// src/core/MithrilLinter.ts (Glass wrapper)
export function visitInlineStyles(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const { warnings } = sharedVisitInlineStyles(ast, tokens)
    return warnings
}
```

## 5. Color parser unification

The Glass `cssColorToHex` handles **HSL/HSLA** while the MCP `parseCssColorToHex` does not. The shared version should be the **Glass superset** (hex + rgb + rgba + hsl + hsla), renamed to `parseCssColorToHex` (the MCP name, which is more descriptive). This is a strict improvement -- MCP gains HSL support.

## 6. `src/utils/tokenMatcher.ts` deprecation

Glass's `findClosestToken` and `SYSTEMIZABLE_THRESHOLD` live in `src/utils/tokenMatcher.ts`. After unification:
- `findClosestToken` moves to `shared/mithrilCore.ts` (using `shared/ciede2000.ts`)
- `SYSTEMIZABLE_THRESHOLD` becomes `MITHRIL_THRESHOLD` from shared
- `tokenMatcher.ts` becomes a re-export shim for backward compat, then can be deleted once all callers are updated

Current callers of `tokenMatcher.ts`:
- `src/core/MithrilLinter.ts` -- will import from shared directly
- Any other Glass code importing `findClosestToken` -- needs audit

## 7. `flint-mcp/tsconfig.json` fix

The MCP tsconfig currently has `rootDir: "./src"` which blocks `shared/` imports at type-check time (though runtime works). Fix:

```json
{
  "compilerOptions": {
    "rootDir": "..",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "../shared/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/**/__tests__/**", "src/tests/**"]
}
```

This is a prerequisite for the entire unification. The existing `shared/ciede2000.ts` import is already broken at TSC level.

## 8. Commandment Checklist

| # | Commandment | Applies? | How satisfied |
|---|-------------|----------|---------------|
| 9 | CIEDE2000 Delta-E Logic | YES | Single `findClosestToken` in shared, using canonical `shared/ciede2000.ts` |
| 13 | Deterministic Surgery | YES | All visitors use Babel AST traversal, no regex on source code |
| 16 | In-Memory Validation | YES | No change to validation flow -- shared module is pure functions |

Process Boundary Law: `shared/mithrilCore.ts` contains ZERO Node.js APIs. It is safe to import from both renderer and Node.js processes.

## 9. Implementation Order

### Step 0: Fix `flint-mcp/tsconfig.json` (PREREQUISITE)
- Update rootDir and include to allow `shared/` imports
- Agent: `flint-ast-surgeon`

### Step 1: Create `shared/mithrilTypes.ts` (PARALLEL with Step 2)
- All type definitions listed in Section 2a
- Agent: `flint-ast-surgeon`

### Step 2: Create `shared/mithrilCore.ts` (PARALLEL with Step 1)
- All pure functions listed in Section 3
- Import types from `shared/mithrilTypes.ts`
- Import CIEDE2000 from `shared/ciede2000.ts`
- Accept `TaxonomyLookup` callback for enrichment injection
- Agent: `flint-ast-surgeon`

### Step 3: Rewrite `flint-mcp/src/core/MithrilLinter.ts` as thin wrapper (AFTER Steps 1+2)
- Re-export everything from `shared/mithrilCore.ts`
- Keep: `taxonomyFields()`, `visitRegistryUsage`, `auditAll` (MCP version with sync/registry)
- Keep: `AuditAllOptions`, `RegistryComponentEntry` interfaces
- Wire `taxonomyFields` as the `TaxonomyLookup` callback into shared visitors
- Agent: `flint-ast-surgeon`

### Step 4: Rewrite `src/core/MithrilLinter.ts` as thin wrapper (PARALLEL with Step 3)
- Re-export everything from `shared/mithrilCore.ts`
- Keep: `calculateDrift` (convenience function)
- Keep: `auditAll` (Glass version, simpler orchestration)
- Adapt `visitInlineStyles` re-export to return `Map` only
- Agent: `flint-ast-surgeon`

### Step 5: Update type re-exports (AFTER Steps 3+4)
- `flint-mcp/src/types.ts`: `LinterWarning` extends or re-exports `MithrilWarning`
- `src/types/flint-api.d.ts`: `LinterWarning` extends or re-exports `MithrilWarning`
- Agent: `flint-state-architect`

### Step 6: Deprecate `src/utils/tokenMatcher.ts` (AFTER Step 4)
- Convert to re-export shim
- Agent: `flint-ast-surgeon`

### Step 7: Run full test suites (AFTER all above)
- `cd flint-mcp && npm test`
- `npm run test:react`
- `npx tsc --noEmit`
- Agent: `flint-test-writer`

## 10. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Rule ID mismatch: Glass uses `MITHRIL-INL-*`, MCP uses `MITHRIL-IST-*` for inline style rules | Medium | -- | Standardize on `MITHRIL-IST-*` (MCP convention). Glass was never persisting these IDs externally. |
| `visitInlineStyles` return type change breaks Glass callers | Medium | -- | Glass wrapper destructures and returns Map only. Zero caller changes needed. |
| flint-mcp tsconfig rootDir change may affect dist output paths | Medium | -- | Test that `npm run build` in flint-mcp still produces correct dist/ structure |
| Glass `LinterWarning` gains optional fields (ruleId, line, column) | Low | -- | Fields are optional -- no breaking change, just type widening |
| Taxonomy callback adds a parameter to every visitor signature | Low | -- | Parameter is optional with default undefined -- backward compatible |
| Glass `cssColorToHex` HSL support not tested in MCP context | Low | 9 | HSL tokens are rare but the math is well-tested in Glass. Add 1-2 HSL test cases to shared. |
