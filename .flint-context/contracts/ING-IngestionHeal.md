# Contract Artifact: Phase ING -- Ingestion-Time Audit & Auto-Heal

**Version:** 1.0
**Date:** 2026-03-15
**Status:** CONTRACT -- Binding specification for Phase 2 agents
**Spec:** `docs/strategy/FEATURE-SPEC-INGESTION-HEAL.md`
**Depends on:** Phase O (Figma Ingestion) ONLINE, Module B v2 (Mithril Enterprise Linter) ONLINE

---

## 1. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `electron/ingestion/IngestionAuditor.ts` | NEW | `flint-electron-ipc` | Core heal logic: classify + fix. Main process only. |
| `src/store/importSummaryStore.ts` | NEW | `flint-state-architect` | Zustand store for IngestionSummary |
| `src/components/ui/ImportSummary.tsx` | NEW | `flint-design-engineer` | Toast + panel variants |
| `electron/ingestion-server.ts` | MODIFY | `flint-electron-ipc` | Insert heal pass in `/ingest-ast` handler |
| `electron/preload.ts` | MODIFY | `flint-electron-ipc` | Add `importSummary` IPC namespace |
| `src/types/flint-api.d.ts` | MODIFY | `flint-electron-ipc` | Add ING type declarations + ImportSummaryAPI |
| `src/components/editor/LivePreview.tsx` | MODIFY | `flint-design-engineer` | Listen for `flint:import-summary`, populate store |
| `flint-mcp/src/tools/audit.ts` | MODIFY | `flint-ast-surgeon` | Add optional `healOnAudit` parameter (ING.3) |
| `flint-mcp/src/core/MithrilLinter.ts` | UNCHANGED | -- | Reused by IngestionAuditor (MCP-side copy used in main process) |
| `src/core/MithrilLinter.ts` | UNCHANGED | -- | Renderer-side. NOT used by IngestionAuditor (process boundary). |
| `src/core/ASTService.ts` | UNCHANGED | -- | `applyTokenFix` reused via astModifier. Renderer-side only. |
| `electron/normalizer.ts` | UNCHANGED | -- | Token normalization. Already ONLINE. |
| `electron/store.ts` | UNCHANGED | -- | SQLite database. Token reads via prepared statement. |
| `electron/__tests__/IngestionAuditor.test.ts` | NEW | `flint-test-writer` | Unit tests ING-01 through ING-12 |
| `src/store/__tests__/importSummaryStore.test.ts` | NEW | `flint-test-writer` | Store state transition tests |
| `src/components/ui/__tests__/ImportSummary.test.tsx` | NEW | `flint-test-writer` | Component render + interaction tests ING-15, ING-16, ING-17 |
| `electron/__tests__/ingestion-integration.test.ts` | NEW | `flint-test-writer` | Integration tests ING-13, ING-14 |

---

## 2. Type Contracts

### 2.1 Core ING Types (new, in `src/types/flint-api.d.ts`)

These types are the binding specification. Every agent implements against these exact shapes.

```typescript
// ── Phase ING: Ingestion-Time Audit & Auto-Heal ────────────────────────────

/**
 * Tier classification for a single ingestion violation.
 *
 *   tier1 -- Exact match: auto-fix applied silently.
 *   tier2 -- Near-match: flagged for one-click review.
 *   tier3 -- Unknown: no close token; standard governance handles it.
 */
export type IngestionTier = 'tier1' | 'tier2' | 'tier3'

/**
 * Result of the ingestion heal pass.
 * Returned by IngestionAuditor.heal() in the main process.
 * The `healedCode` is the canonical source written to disk (C1).
 */
export interface IngestionHealResult {
    /** Generated code from the healed AST (tier-1 fixes applied). */
    healedCode: string
    /** What happened during healing -- sent to renderer via IPC. */
    summary: IngestionSummary
}

/**
 * Summary of the ingestion heal pass.
 * Pushed from main -> renderer via `flint:import-summary` IPC.
 * Stored in importSummaryStore. Rendered by ImportSummary component.
 */
export interface IngestionSummary {
    /** Total arbitrary style values found in the hydrated AST. */
    totalValues: number
    /** Auto-healed items (exact token match, deltaE = 0.0 or exact string). */
    tier1Fixed: IngestionFix[]
    /** Near-match items needing one-click review. */
    tier2Flagged: IngestionFlag[]
    /** Count of values with no close token (standard governance). */
    tier3Unknown: number
    /** Total heal pass duration in milliseconds. */
    healTimeMs: number
    /** Original un-healed code, retained in memory for "Undo all heals". */
    preHealCode: string
}

/**
 * A single tier-1 auto-fix applied during ingestion.
 */
export interface IngestionFix {
    /** data-flint-id of the element that was fixed. */
    nodeId: string
    /** Mithril rule that was resolved, e.g. "MITHRIL-COL", "MITHRIL-SPC-001". */
    ruleId: string
    /** The original arbitrary value, e.g. "#3B82F6", "16px". */
    originalValue: string
    /** The token that matched exactly, e.g. "color.blue.500". */
    fixedToToken: string
    /** The Tailwind class that replaced the arbitrary one, e.g. "bg-blue-500". */
    fixedToClass: string
}

/**
 * A single tier-2 near-match flagged during ingestion.
 */
export interface IngestionFlag {
    /** data-flint-id of the element. */
    nodeId: string
    /** Mithril rule that triggered, e.g. "MITHRIL-COL", "MITHRIL-SPC-001". */
    ruleId: string
    /** The original arbitrary value, e.g. "#3A81F5", "15px". */
    originalValue: string
    /** The nearest token, e.g. "color.blue.500". */
    suggestedToken: string
    /** The Tailwind class that would replace it, e.g. "bg-blue-500". */
    suggestedClass: string
    /** Distance metric: deltaE for colors, pixel diff for spacing. */
    distance: number
    /** Unit of the distance metric. */
    distanceUnit: 'deltaE' | 'px'
}

/**
 * Payload for the `import:snap-to-token` IPC channel.
 * Sent from renderer -> main when the user clicks "Snap" on a tier-2 flag.
 */
export interface SnapToTokenPayload {
    /** data-flint-id of the target element. */
    nodeId: string
    /** The token_path of the token to snap to. */
    tokenPath: string
    /** The Tailwind class to apply. */
    className: string
    /** The original arbitrary class to replace. */
    originalClass: string
}
```

### 2.2 Compatibility Verification Against Existing Types

**LinterWarning (renderer-side, `src/types/flint-api.d.ts` line 109):**
```typescript
interface LinterWarning {
    id: string                    // data-flint-id
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y'
    severity: 'amber' | 'critical'
    value: number                 // deltaE for color, 1 for others
    message: string
    nearestToken: string | null
    nearestTokenValue: string | null
}
```

**CRITICAL FINDING:** The renderer-side `LinterWarning` does NOT include `ruleId`. The MCP-side version (`flint-mcp/src/types.ts` line 44) does include `ruleId?: string`. The `IngestionAuditor` runs in the main process and uses the MCP-side `MithrilLinter.ts` (which produces warnings WITH `ruleId`). The `classifyViolation` function will rely on `ruleId` being present. This is compatible because:
- IngestionAuditor imports from `flint-mcp/src/core/MithrilLinter.ts` (main process)
- That linter produces `LinterWarning` with `ruleId` populated
- IngestionFix/IngestionFlag both carry their own `ruleId` field derived from the warning

**DesignToken (electron-side, `electron/token-types.ts`):**
```typescript
type TokenType = 'color' | 'dimension' | 'string' | 'boolean'
```

**CRITICAL FINDING:** The electron-side `TokenType` is missing the expanded types (`fontFamily`, `fontWeight`, `lineHeight`, `letterSpacing`, `shadow`, `opacity`). The MCP-side and renderer-side have the full set. Since `IngestionAuditor` reads tokens from SQLite via `electron/store.ts` which uses the electron-side types, and the Figma normalizer maps `FLOAT` to `'dimension'` (not to `fontWeight` etc.), the heal pass will correctly match all tokens as stored. Typography/spacing/shadow/opacity violations use exact string matching against `token_value`, not `token_type` filtering (each visitor already filters by type). The MCP-side `DesignToken` type (used by the MCP MithrilLinter) includes the expanded `TokenType`, so the IngestionAuditor must import `DesignToken` from `flint-mcp/src/types.ts`, not from `electron/token-types.ts`.

**ASTMutation / ApplyTokenFixMutation (from `src/core/ASTService.ts`):**
```typescript
interface ApplyTokenFixMutation {
    op: 'applyTokenFix'
    nodeId: string
    hardcodedClass: string
    tokenClass: string
}
```

The IngestionAuditor does NOT use `ASTService.applyMutationBatch` because that is a renderer-side module. Instead, it must use the MCP-side `applyTokenFix` from `flint-mcp/src/core/ast-modifier.ts` or implement equivalent AST surgery directly using Babel (Commandment 13). The heal pass operates on the Babel AST in-memory in the main process, before the code crosses the IPC boundary.

### 2.3 classifyViolation Signature

```typescript
/**
 * Classifies a single LinterWarning into a tier for the ingestion heal pass.
 *
 * Classification logic:
 *   - color-drift with deltaE = 0.0:     tier1 (exact hex match)
 *   - color-drift with 0.0 < deltaE <= 2.0: tier2 (near-match, perceptually indistinguishable)
 *   - color-drift with deltaE > 2.0:     tier3 (too far -- standard governance)
 *   - spacing-drift with nearestToken and px diff = 0: tier1 (exact match)
 *   - spacing-drift with nearestToken and px diff <= 1: tier2
 *   - spacing-drift with no nearestToken or px diff > 1: tier3
 *   - typography-drift with nearestToken and exact value match: tier1
 *   - typography-drift with nearestToken and size diff <= 2px: tier2
 *   - typography-drift without nearestToken: tier3
 *   - shadow-drift / opacity-drift with exact match: tier1
 *   - shadow-drift / opacity-drift without: tier3 (no fuzzy matching)
 *   - a11y: always tier3 (never auto-fixed at ingestion)
 *
 * @param warning  The LinterWarning from auditAll()
 * @param tokens   The full token list (for distance calculations)
 * @returns        The tier classification
 */
function classifyViolation(
    warning: LinterWarning,
    tokens: DesignToken[]
): { tier: IngestionTier; distance?: number; distanceUnit?: 'deltaE' | 'px' }
```

**IMPORTANT:** The existing `auditAll()` in MithrilLinter only flags violations ABOVE the threshold (deltaE > 2.0 for colors, no exact match for others). It does NOT report exact matches or near-matches because those are "passing" values. The IngestionAuditor therefore CANNOT rely on `auditAll()` alone for tier-1 and tier-2 classification.

**Revised approach:** The IngestionAuditor must implement its own AST visitor that:
1. Finds ALL arbitrary-value classes (using the same regexes as MithrilLinter)
2. For each arbitrary value, computes the closest token match
3. Classifies based on distance:
   - distance = 0 (exact) -> tier 1 -> auto-fix
   - distance within tolerance -> tier 2 -> flag
   - distance beyond tolerance -> tier 3 -> standard governance
4. Only applies AST mutations for tier-1 items

This means the IngestionAuditor reuses the CIEDE2000 math and regex patterns from MithrilLinter but implements a different visitor that captures ALL arbitrary values, not just violations.

### 2.4 IngestionAuditor.heal() Signature

```typescript
/**
 * Core entry point for the ingestion heal pass.
 * Runs in the main process (electron/) after hydration and injectFlintIds.
 *
 * @param code    The hydrated JSX source code (with flint IDs already injected)
 * @param tokens  Design tokens read from SQLite at call time
 * @returns       IngestionHealResult with healed code and summary
 *
 * Performance: Must complete in < 200ms for a 50-node component.
 * Safety: If token list is empty, returns code unchanged (no-op).
 * Safety: If violation count > 100, skips tier-1 auto-fix (classify only).
 */
function heal(
    code: string,
    tokens: DesignToken[]
): IngestionHealResult
```

---

## 3. IPC Channels

| Channel | Direction | Payload Type | Return Type | Purpose |
|---------|-----------|-------------|-------------|---------|
| `flint:import-summary` | main -> renderer | `IngestionSummary` | -- (push event) | Pushes heal results to renderer for toast |
| `import:snap-to-token` | renderer -> main | `SnapToTokenPayload` | `Promise<{ ok: boolean; updatedSummary?: IngestionSummary }>` | User clicks "Snap" on tier-2 flag |
| `import:undo-all-heals` | renderer -> main | `{ preHealCode: string }` | `Promise<{ ok: boolean }>` | User clicks "Undo all heals" |

### 3.1 IPC Registration Locations

**Main process (`electron/main.ts`):**
- `ipcMain.handle('import:snap-to-token', ...)` -- handler applies token fix to active file, re-audits, returns updated summary
- `ipcMain.handle('import:undo-all-heals', ...)` -- handler restores preHealCode via FileTransactionManager, sends updated code to renderer

**Preload (`electron/preload.ts`):**
```typescript
// ── Phase ING: Import Summary IPC ────────────────────────────────────────
importSummary: {
    /**
     * Subscribes to 'flint:import-summary' push events from the main process.
     * Fired after each /ingest-ast heal pass completes.
     * Returns an unsubscribe function for useEffect cleanup.
     */
    onSummary: (callback: (summary: IngestionSummary) => void): (() => void) => {
        const listener = (_event: Electron.IpcRendererEvent, data: IngestionSummary) => callback(data)
        ipcRenderer.on('flint:import-summary', listener)
        return () => { ipcRenderer.removeListener('flint:import-summary', listener) }
    },

    /**
     * Applies a tier-2 "snap to token" fix. Returns updated summary.
     */
    snapToToken: (payload: SnapToTokenPayload): Promise<{ ok: boolean; updatedSummary?: IngestionSummary }> =>
        ipcRenderer.invoke('import:snap-to-token', payload),

    /**
     * Reverts all tier-1 heals by restoring the pre-heal code.
     */
    undoAllHeals: (preHealCode: string): Promise<{ ok: boolean }> =>
        ipcRenderer.invoke('import:undo-all-heals', preHealCode),

    /** Removes all import-summary listeners. */
    removeListeners: (): void => {
        ipcRenderer.removeAllListeners('flint:import-summary')
    },
},
```

### 3.2 FlintAPI Type Addition (`src/types/flint-api.d.ts`)

```typescript
export interface ImportSummaryAPI {
    /** Subscribe to post-heal summary push events. Returns unsubscribe fn. */
    onSummary: (callback: (summary: IngestionSummary) => void) => () => void
    /** Apply a tier-2 snap-to-token fix. */
    snapToToken: (payload: SnapToTokenPayload) => Promise<{ ok: boolean; updatedSummary?: IngestionSummary }>
    /** Revert all tier-1 heals. */
    undoAllHeals: (preHealCode: string) => Promise<{ ok: boolean }>
    /** Remove all import-summary listeners. */
    removeListeners: () => void
}
```

Add to the `FlintAPI` interface:
```typescript
importSummary: ImportSummaryAPI
```

---

## 4. Store Contracts

### 4.1 importSummaryStore (NEW)

| Property | Type | Initial | Description |
|----------|------|---------|-------------|
| `summary` | `IngestionSummary | null` | `null` | Current import summary (null = no active import) |
| `isVisible` | `boolean` | `false` | Whether the summary panel/toast is showing |
| `isPanelMode` | `boolean` | `false` | `true` = full panel; `false` = toast |

| Action | Signature | Description |
|--------|-----------|-------------|
| `setSummary` | `(summary: IngestionSummary) => void` | Receives summary from IPC, sets isVisible=true |
| `dismiss` | `() => void` | Hides toast/panel, clears summary |
| `openPanel` | `() => void` | Switches from toast to panel mode |
| `removeTier2Item` | `(nodeId: string) => void` | Removes a tier2 flag after successful snap |
| `replaceWithPreHeal` | `() => void` | Clears summary after undo-all-heals |

| Selector | Returns | Description |
|----------|---------|-------------|
| `hasTier2Items` | `boolean` | `summary?.tier2Flagged.length > 0` |
| `isAllClean` | `boolean` | `tier2Flagged.length === 0 && tier3Unknown === 0` |

**Anti-pattern guard:** This store does NOT call `window.flintAPI`. IPC calls happen in the LivePreview.tsx or App.tsx listener hooks that populate this store.

### 4.2 editorStore (UNCHANGED)

No changes to editorStore. The heal pass runs in the main process. The healed code arrives at the renderer via the existing `flint:hydro-paste-auto` flow, which ultimately calls `editorStore.setCode()`. The importSummaryStore is a separate concern.

---

## 5. Component Contracts

### 5.1 ImportSummary (NEW)

| Component | `src/components/ui/ImportSummary.tsx` |
|-----------|---------------------------------------|
| **Props** | None (reads from `importSummaryStore`) |
| **Store deps** | `importSummaryStore` (summary, isVisible, isPanelMode, actions) |
| **IPC calls** | `window.flintAPI.importSummary.snapToToken()` on "Snap" click |
| | `window.flintAPI.importSummary.undoAllHeals()` on "Undo all heals" click |

**Renders:**
- **Toast variant** (default when `tier1Fixed.length + tier2Flagged.length <= 10`):
  - Single-line summary: "{N} tokens auto-matched, {M} need review, {K} flagged"
  - "Review" button opens panel mode
  - Auto-dismisses after 8 seconds if no interaction
  - No "Review" button if tier2 = 0 and tier3 = 0 (all clean)

- **Panel variant** (when user clicks Review or item count > 10):
  - Slides into right sidebar (same slot as GovernanceOverlay -- uses `canvasStore.rightTab`)
  - Three collapsible sections: "Auto-healed (N)", "Needs review (M)", "Flagged (K)"
  - "Snap" button on each tier-2 item
  - "Undo all heals" button in footer
  - "Dismiss" button in footer
  - Panel auto-closes when all tier-2 items are resolved

**Tailwind classes only.** No inline styles. All colors from token palette.

### 5.2 LivePreview.tsx (MODIFY)

Add a `useEffect` that subscribes to `flint:import-summary` via `window.flintAPI.importSummary.onSummary()` and calls `importSummaryStore.getState().setSummary(summary)`. This listener sits alongside the existing `onHydroPasteAuto` subscription. Cleanup on unmount.

---

## 6. Implementation Detail: IngestionAuditor

### 6.1 Process Boundary

The `IngestionAuditor` runs **entirely in the main process** (`electron/`). It must NOT import from `src/`. It uses:

- `@babel/parser` -- parse hydrated code to AST
- `@babel/traverse` -- walk JSX elements
- `@babel/generator` -- regenerate code after tier-1 fixes
- `flint-mcp/src/core/MithrilLinter.ts` patterns -- regex patterns for arbitrary value detection, CIEDE2000 math

Since importing from `flint-mcp/src/` directly creates a dependency coupling, the IngestionAuditor should **inline the necessary functions** (CIEDE2000 distance calculation, `cssColorToHex`, the regex patterns) rather than importing from MithrilLinter. This keeps the module self-contained within `electron/`.

Alternatively, extract a shared `electron/ingestion/colorMath.ts` utility that both can consume.

### 6.2 Token Read

Tokens are read synchronously from SQLite at heal time:

```typescript
import db from '../store.js'

function readTokens(): DesignToken[] {
    return db.prepare('SELECT * FROM design_tokens').all() as DesignToken[]
}
```

### 6.3 AST Surgery for Tier-1 Fixes

Tier-1 fixes use the same `applyTokenFix` pattern from `src/utils/astModifier.ts` but implemented locally (process boundary). The operation:
1. Find the JSXElement by `data-flint-id`
2. Find the `className` attribute
3. Split class string, find the arbitrary-value class, replace with token class
4. Update the AST in-place

This is a simple string replacement within a StringLiteral node's `value` -- no structural AST mutation needed.

### 6.4 Arbitrary Value -> Token Class Mapping

The IngestionAuditor needs a reverse lookup: given an exact token match, what is the correct Tailwind class? This mapping depends on the utility prefix:

- `bg-[#3B82F6]` + token `color.blue.500` -> `bg-blue-500`
- `text-[16px]` + token `typography.body.fontSize` = `16px` -> `text-base`
- `gap-[16px]` + token `spacing.4` = `16px` -> `gap-4`

**This is the hardest part of the implementation.** The arbitrary-value class encodes BOTH the CSS property (via utility prefix like `bg-`, `text-`, `gap-`) AND the value. The token replacement must preserve the prefix while swapping the value.

**Decision:** For Phase ING.1, tier-1 auto-fix is LIMITED to cases where the `fixedToClass` can be deterministically computed. This means:
- Color tokens: the IngestionAuditor maintains a small lookup of Tailwind color scale classes (e.g., `blue-500`) and maps `color.blue.500` -> `blue-500`. The utility prefix (`bg-`, `text-`, `border-`, etc.) is preserved from the original class.
- Dimension tokens: defer to tier-2 flagging for now (Tailwind spacing scale is convention-dependent).

If the reverse lookup cannot be resolved, the item falls to tier-2 instead of tier-1. This is the safe default -- never guess.

### 6.5 Violation Cap

If `auditAll()` reports more than 100 violations, the heal pass skips tier-1 auto-fix entirely. All items are classified but no AST mutations are applied. This prevents a mutation storm on extremely dirty imports. The summary reports the classification counts so the user knows what happened.

---

## 7. Commandment Compliance Checklist

| # | Commandment | Applies | How ING Complies |
|---|-------------|---------|-----------------|
| C1 | Code is Truth | YES | Healed code is the canonical source written to `.tsx` via FileTransactionManager. Pre-heal code is never persisted to disk. It exists only in memory within `IngestionSummary.preHealCode` for undo. |
| C2 | No Hallucinated Styling | YES | Tier-1 fixes enforce token compliance at ingestion time. Every fix maps an arbitrary value to an exact token -- no fabricated values. |
| C7 | ID Preservation | YES | `injectFlintIds` runs BEFORE the heal pass. Heal mutates className values only, never adds/removes/reorders elements. All `data-flint-id` attributes remain intact. |
| C8 | Audit-First Execution | YES | The heal pass IS an audit. It runs a full token match scan before the code reaches editorStore. |
| C9 | CIEDE2000 deltaE Logic | YES | Tier classification for colors uses the same CIEDE2000 perceptual distance formula as MithrilLinter. Tier-1 = deltaE 0.0. Tier-2 = 0.0 < deltaE <= 2.0. |
| C12 | Atomic Queuing | YES | Healed file is written via the existing auto-save path which routes through `FileTransactionManager`. The `import:snap-to-token` handler also saves via FTM. |
| C13 | Deterministic Surgery | YES | All tier-1 fixes use Babel AST traversal to locate the className StringLiteral and perform the class swap. No regex-based source code modification. |
| C4 | Local-First Only | YES | All heal logic runs locally in the main process. No external URLs or API calls. |
| C14 | Bypass Prohibition | YES | No direct `fs.writeFile`. All writes through FileTransactionManager. Token reads through the SQLite prepared statement in `electron/store.ts`. |

---

## 8. Implementation Order

### Phase ING.1 -- Core Heal Logic (Parallel Group A)

**Agents:** `flint-electron-ipc` + `flint-test-writer`
**Blocking:** Nothing -- can start immediately.

1. Create `electron/ingestion/IngestionAuditor.ts`
   - Implement `classifyViolation()` with CIEDE2000 inlined
   - Implement `heal()` with tier-1 AST surgery
   - Implement violation cap (> 100 = classify only)
   - Implement empty-token no-op path
2. Modify `electron/ingestion-server.ts` `/ingest-ast` handler:
   - After payload extraction, before `windows[0].webContents.send('flint:hydro-paste-auto', ...)`
   - Read tokens from SQLite
   - Call `IngestionAuditor.heal(figmaPayload, tokens)`
   - If heal produced changes, send the healed code instead of raw code
   - Send `flint:import-summary` IPC with the summary
3. Add IPC handlers in `electron/main.ts`:
   - `ipcMain.handle('import:snap-to-token', ...)`
   - `ipcMain.handle('import:undo-all-heals', ...)`
4. Modify `electron/preload.ts`:
   - Add `importSummary` namespace with `onSummary`, `snapToToken`, `undoAllHeals`, `removeListeners`
5. Modify `src/types/flint-api.d.ts`:
   - Add all ING types (Section 2.1)
   - Add `ImportSummaryAPI` interface
   - Add `importSummary: ImportSummaryAPI` to `FlintAPI`
6. Tests: ING-01 through ING-12

### Phase ING.2 -- Import Summary UI (Parallel Group A -- runs simultaneously with ING.1)

**Agents:** `flint-state-architect` + `flint-design-engineer` + `flint-test-writer`
**Blocking:** Needs the type contracts from Section 2.1 (committed first as a standalone types-only change).

1. Create `src/store/importSummaryStore.ts`
2. Create `src/components/ui/ImportSummary.tsx` (toast + panel)
3. Modify `src/components/editor/LivePreview.tsx`:
   - Add `useEffect` subscribing to `flint:import-summary` IPC
   - Populate importSummaryStore on receipt
4. Mount `<ImportSummary />` in `src/App.tsx` (inside the main layout, above StatusBar)
5. Tests: ING-15, ING-16, ING-17

### Phase ING.3 -- Integration + MCP (Sequential, after ING.1 + ING.2)

**Agents:** `flint-integration-validator` + `flint-ast-surgeon`
**Blocking:** ING.1 and ING.2 must both be ONLINE.

1. End-to-end integration test: POST /ingest tokens -> POST /ingest-ast -> healed code in editorStore -> summary in importSummaryStore
2. Add `healOnAudit` parameter to `flint_audit` MCP tool
3. Modify `flint-mcp/src/tools/audit.ts` to optionally run heal pass
4. Tests: ING-13, ING-14, ING-18
5. Update `HANDOFF.md` and `CLAUDE.md` with ING as ONLINE

---

## 9. Test ID Map

| Test ID | Test Description | File Location | Priority |
|---------|-----------------|---------------|----------|
| ING-01 | Exact hex match -> tier-1 auto-fix applied | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-02 | Exact spacing value match -> tier-1 auto-fix | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-03 | Exact typography match -> tier-1 auto-fix | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-04 | deltaE 0.5 color -> classified as tier-2 | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-05 | 1px spacing drift -> classified as tier-2 | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-06 | No matching token -> classified as tier-3 | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-07 | Zero tokens in DB -> heal pass is no-op | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-08 | 100+ violations -> auto-fix skipped, classify only | `electron/__tests__/IngestionAuditor.test.ts` | MEDIUM |
| ING-09 | Mixed tiers in single file -> correct per-node classification | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-10 | Healed AST preserves all data-flint-id values | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-11 | Healed code generates valid JSX (parse round-trip) | `electron/__tests__/IngestionAuditor.test.ts` | HIGH |
| ING-12 | Heal duration < 200ms for 50-node component | `electron/__tests__/IngestionAuditor.test.ts` | MEDIUM |
| ING-13 | Full pipeline: /ingest tokens -> /ingest-ast -> healed code | `electron/__tests__/ingestion-integration.test.ts` | HIGH |
| ING-14 | /ingest-ast with no prior /ingest -> heal is no-op | `electron/__tests__/ingestion-integration.test.ts` | HIGH |
| ING-15 | Import Summary toast renders with correct counts | `src/components/ui/__tests__/ImportSummary.test.tsx` | HIGH |
| ING-16 | "Snap to token" IPC -> value updated -> re-audit passes | `src/components/ui/__tests__/ImportSummary.test.tsx` | HIGH |
| ING-17 | "Undo all heals" -> original hydrated code restored | `src/components/ui/__tests__/ImportSummary.test.tsx` | MEDIUM |
| ING-18 | MCP flint_audit({ healOnAudit: true }) -> tier-1 fixes | `flint-mcp/src/__tests__/audit-heal.test.ts` | MEDIUM |

---

## 10. Risks

| Risk | Likelihood | Impact | Commandment Threatened | Mitigation |
|------|-----------|--------|----------------------|------------|
| **Heal pass exceeds 200ms** | Low | HIGH | C8 (Audit-First -- must not block import) | Early-exit if > 100 violations. Performance benchmark in ING-12. Profile the CIEDE2000 loop for large token sets. |
| **Token ordering: AST arrives before tokens** | Medium | LOW | None -- degrades gracefully | No-op path when token count = 0. Log warning. Document ordering in Figma plugin. |
| **Arbitrary class -> token class reverse lookup fails** | Medium | MEDIUM | C2 (No Hallucinated Styling) | When reverse lookup is ambiguous, demote to tier-2 instead of guessing. Never fabricate a class name. |
| **Process boundary violation** | Low | HIGH | C14 (Bypass Prohibition) | IngestionAuditor lives in `electron/`. Type contract enforces no imports from `src/`. Code review gate. |
| **Token type mismatch electron vs. renderer** | Low | MEDIUM | None | IngestionAuditor uses MCP-side DesignToken type (expanded TokenType). SQLite stores whatever normalizer produces. |
| **Cross-store contamination** | Low | HIGH | Anti-pattern | importSummaryStore reads no other stores. IPC calls happen in component useEffect hooks, not in store actions. |
| **Pre-heal code memory leak** | Low | LOW | None | `preHealCode` stored only in importSummaryStore state. Cleared on dismiss. Single string per import. |
| **Conflict with existing governance overlay** | Low | LOW | None | ImportSummary is temporary and occupies its own UI slot. Auto-closes after tier-2 resolution. GovernanceOverlay handles remaining tier-3 items via standard flow. |

---

## 11. Open Design Decisions

### 11.1 Token-to-Class Reverse Mapping Strategy

The spec assumes a deterministic mapping from token path to Tailwind class (e.g., `color.blue.500` -> `blue-500`). In practice this mapping is project-specific and depends on Tailwind config. Two approaches:

**Option A (Recommended for ING.1):** Use a heuristic: extract the last two segments of `token_path`, convert to Tailwind naming convention. Works for standard Tailwind palettes. Falls back to tier-2 for non-standard paths.

**Option B (Phase ING.2+):** Read Tailwind config from the project workspace and build a reverse lookup table. More accurate but adds complexity and a potential async dependency.

Decision: **Option A for ING.1.** Option B is a follow-up enhancement.

### 11.2 Where the Heal Pass Runs in the /ingest-ast Handler

The current `/ingest-ast` handler simply forwards the raw payload to the renderer via `flint:hydro-paste-auto`. The heal pass must run BETWEEN receiving the payload and forwarding it. This means the main process must:

1. Call `window.flintAPI.ai.hydroPaste` equivalent logic (the `hydrateFigmaAST` function in `electron/orchestrator.ts`) to get the hydrated JSX code
2. Run `injectFlintIds` on the hydrated AST
3. Run `IngestionAuditor.heal()` on the injected code
4. Forward the HEALED code (not the raw payload) to the renderer

**IMPORTANT:** Currently the `/ingest-ast` handler sends the raw Figma payload to the renderer, and the renderer calls `hydroPaste` on the main process to get back JSX. This round-trip must be refactored: the main process should hydrate, heal, and send the final JSX code directly. The renderer should receive ready-to-use JSX, not a raw Figma payload that requires another IPC hop.

This is a design change from the current architecture and must be handled carefully in ING.1.

### 11.3 Summary Lifetime

The `IngestionSummary` is retained in memory until the user dismisses it or navigates away. The `preHealCode` field could be large. For ING.1, this is acceptable. For production, consider storing the pre-heal code in a temp file via FileTransactionManager if memory pressure is a concern.

---

## 12. Files to Read Before Implementation

Agents assigned to ING.1 MUST read these files before writing code:

| File | Why |
|------|-----|
| `electron/ingestion-server.ts` | Insertion point for heal pass |
| `flint-mcp/src/core/MithrilLinter.ts` | CIEDE2000 math and regex patterns to inline |
| `src/utils/tokenMatcher.ts` | `findClosestToken` algorithm and SYSTEMIZABLE_THRESHOLD |
| `src/utils/astModifier.ts` lines 391-420 | `applyTokenFix` pattern for className surgery |
| `electron/store.ts` | How to read tokens from SQLite |
| `electron/preload.ts` | Existing IPC patterns for push events and invoke handlers |
| `src/types/flint-api.d.ts` | LinterWarning shape (no ruleId on renderer side) |
| `flint-mcp/src/types.ts` | LinterWarning shape (has ruleId on MCP side) |
| `electron/token-types.ts` | Limited TokenType (missing expanded types) |

Agents assigned to ING.2 MUST read these files:

| File | Why |
|------|-----|
| `src/store/annotationStore.ts` | Pattern for a Zustand store with IPC push subscription |
| `src/components/ui/ActivityFeed.tsx` | Pattern for a toast/panel UI component |
| `src/components/editor/LivePreview.tsx` lines 690-698 | Where to add the import-summary listener |
| `src/App.tsx` lines 1-40 | Where to mount the ImportSummary component |
