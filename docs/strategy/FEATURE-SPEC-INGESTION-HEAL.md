# Feature Spec: Ingestion-Time Audit & Auto-Heal (Phase ING)

**Version:** 1.0  
**Date:** 2026-03-15  
**Author:** UX + Architecture Review  
**Status:** APPROVED — Ready for contract design  
**Priority:** HIGH  
**Depends on:** Phase O (Figma Ingestion) — ONLINE, Module B v2 (Mithril Enterprise Linter) — ONLINE  
**Companion docs:** `JOURNEY-MAPS-UX.md` (J8), `02-Figma-Accuracy-Strategy.md`, `13-Success-Metrics-KPIs.md`

---

## 1. Problem Statement

Today, every Figma import follows a punishing pattern:

```
Figma → hydrate → canvas shows 14 red badges → designer spends 5 min fixing → export
```

Governance only activates *after* hydration. Bridge creates technical debt at the exact moment of creation, then immediately asks the user to pay it down. This produces an anxiety dip at J8.3–J8.5 in the journey map and undermines the core promise of Figma-to-canvas speed.

The MithrilLinter, A11yLinter, and `ASTService.applyMutationBatch` already know how to detect and fix token violations. They just run too late — after the code hits `editorStore`, after badges render, after the designer's confidence drops.

## 2. Proposed Solution

Insert a three-tier audit-and-heal pass into the hydration pipeline, **between** AST hydration and `editorStore.setCode()`. The pass runs against the in-memory hydrated AST before it ever touches the canvas.

**Design principles:**

- **Never block the import.** Total added latency budget: < 200ms. The 3s Figma-to-canvas target is sacred.
- **Never silently alter ambiguous values.** Only auto-fix when the match is mathematically certain (ΔE = 0.0 or exact non-color token match).
- **Respect C1 (Code is Truth).** Auto-healed code is written to disk as the canonical truth. The designer sees the healed version, not the raw import — because the healed version *is* the import.
- **Surface everything transparently.** A post-import summary shows exactly what was auto-fixed, what needs review, and what was flagged.

## 3. The Three-Tier Ingestion Gate

### Tier 1: Silent auto-heal (exact match)

| Property | Detail |
|----------|--------|
| **Trigger** | Raw value is an exact match to an existing token (ΔE = 0.0 for colors, exact string match for spacing/typography/shadow/opacity) |
| **Action** | Replace the arbitrary Tailwind class with the token class in the AST. No user interaction required |
| **Confidence** | 100%. There is zero ambiguity — the designer clearly intended this token |
| **Analogy** | Spell-check auto-correcting a known typo |
| **Example** | `bg-[#3B82F6]` → `bg-blue-500` (when `color.blue.500` token has value `#3B82F6`) |
| **Example** | `text-[16px]` → `text-base` (when `typography.body.fontSize` token has value `16px`) |
| **Example** | `gap-[16px]` → `gap-4` (when `spacing.4` token has value `16px`) |

### Tier 2: Flagged near-match (needs one-click review)

| Property | Detail |
|----------|--------|
| **Trigger** | Value is within snap tolerance but not exact. For colors: 0.0 < ΔE ≤ 2.0 (perceptually indistinguishable). For spacing: within 1px. For font size: within 2px |
| **Action** | Import proceeds with the raw value intact. The value is flagged in the Import Summary with a one-click "Snap to token" button |
| **Confidence** | High but not certain — the designer probably meant the token, but may have intentionally used a slight variation |
| **Analogy** | Spell-check highlighting a word with a wavy underline and suggesting a correction |
| **Example** | `bg-[#3A81F5]` flagged as "ΔE 0.4 from `color.blue.500` (#3B82F6) — snap?" |
| **Example** | `gap-[15px]` flagged as "1px from `spacing.4` (16px) — snap?" |

### Tier 3: Unknown value (standard governance flag)

| Property | Detail |
|----------|--------|
| **Trigger** | No token is close enough for tier 1 or tier 2 |
| **Action** | Import proceeds with the raw value. Standard `MithrilLinter` violation appears on canvas (existing behavior). Falls through to the existing Fallback Hierarchy from `02-Figma-Accuracy-Strategy.md` |
| **Confidence** | Low — this is either intentional deviation or a missing token |
| **Analogy** | Spell-check can't suggest anything — the word might be correct or might be gibberish |
| **Example** | `bg-[#7B2D8E]` — no color token within ΔE 2.0 |

## 4. Architecture

### 4.1 Insertion point

The heal pass inserts into the existing J8.3 (AST Hydration) pipeline:

```
[ingestion-server.ts receives /ingest-ast]
         |
         v
[Validate against BridgeSDIPayload schema]
         |
         v
[hydrate_figma_data → React JSX AST]       ← existing
         |
         v
[injectBridgeIds(hydratedAST)]              ← existing
         |
         v
┌─────────────────────────────────────────┐
│  NEW: IngestionAuditor.heal(ast, tokens) │  ← Phase ING
│                                          │
│  1. auditAll(ast, tokens) → violations   │
│  2. Classify each: tier1 / tier2 / tier3 │
│  3. Apply tier1 fixes via applyTokenFix  │
│  4. Package tier2 + tier3 into summary   │
│  5. Return { healedAST, summary }        │
└─────────────────────────────────────────┘
         |
         v
[editorStore.setCode(healedCode)]           ← existing (now receives cleaner code)
         |
         v
[MithrilLinter + A11yLinter re-run]         ← existing (now finds fewer violations)
         |
         v
[ImportSummaryToast renders]                ← NEW: shows heal results
```

### 4.2 Token ordering guarantee

**Problem:** Tokens arrive via `/ingest` and AST via `/ingest-ast`. If AST arrives first, the heal pass has no tokens to compare against.

**Solution:** The `IngestionAuditor` reads tokens directly from SQLite via `tokenStore.getTokens()` at heal time. If the token table is empty (no prior `/ingest` call), the heal pass is a no-op — it skips tier 1 and tier 2 entirely, and all values fall through to tier 3 (standard governance). This is the correct degradation: without tokens, Bridge can't know what's correct, so it doesn't guess.

**Recommended workflow for Figma plugin:** Send `/ingest` (tokens) first, then `/ingest-ast` (components). Document this ordering in the plugin UI. The ingestion server should log a warning if `/ingest-ast` arrives with zero tokens in the database.

### 4.3 Component ownership

| Component | Location | Role |
|-----------|----------|------|
| `IngestionAuditor` | `electron/ingestion/IngestionAuditor.ts` (NEW) | Core heal logic: classify + fix |
| `classifyViolation` | `electron/ingestion/IngestionAuditor.ts` (NEW) | Determines tier 1/2/3 per violation |
| `ingestion-server.ts` | `electron/ingestion-server.ts` (MODIFIED) | Calls `IngestionAuditor.heal()` after hydration |
| `ImportSummary` | `src/components/ui/ImportSummary.tsx` (NEW) | Post-import summary toast/panel |
| `importSummaryStore` | `src/store/importSummaryStore.ts` (NEW) | Zustand store for summary data |
| `MithrilLinter.ts` | `src/core/MithrilLinter.ts` (UNCHANGED) | Reused for audit — not modified |
| `ASTService.ts` | `src/core/ASTService.ts` (UNCHANGED) | Reused for `applyTokenFix` — not modified |
| `tokenMatcher.ts` | `src/utils/tokenMatcher.ts` (UNCHANGED) | Reused for `findClosestToken` + CIEDE2000 |

### 4.4 Data flow

```typescript
interface IngestionHealResult {
  healedAST: File                    // Babel AST with tier-1 fixes applied
  healedCode: string                 // Generated code from healedAST
  summary: IngestionSummary          // What happened during healing
}

interface IngestionSummary {
  totalValues: number                // Total style values found in hydrated AST
  tier1Fixed: IngestionFix[]         // Auto-healed (exact match)
  tier2Flagged: IngestionFlag[]      // Near-match, needs review
  tier3Unknown: number               // Count of values with no close token
  healTimeMs: number                 // Total heal pass duration
}

interface IngestionFix {
  nodeId: string                     // data-bridge-id
  ruleId: string                     // e.g. MITHRIL-COL-001
  originalValue: string              // e.g. "#3B82F6"
  fixedToToken: string               // e.g. "color.blue.500"
  fixedToClass: string               // e.g. "bg-blue-500"
}

interface IngestionFlag {
  nodeId: string
  ruleId: string
  originalValue: string
  suggestedToken: string
  suggestedClass: string
  distance: number                   // ΔE for colors, px diff for spacing
  distanceUnit: 'deltaE' | 'px'
}
```

### 4.5 IPC additions

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `bridge:import-summary` | main → renderer | `IngestionSummary` | Pushes heal results to renderer for toast |
| `import:snap-to-token` | renderer → main | `{ nodeId, tokenPath, className }` | User clicks "snap" on a tier-2 flag |

The `import:snap-to-token` handler reuses the existing `applyTokenFix` path in ASTService — no new mutation logic needed. After snapping, it re-audits the single node and updates the summary.

## 5. Performance Budget

The 3-second Figma-to-canvas target must hold. Current pipeline:

| Step | Current | With ING |
|------|---------|----------|
| HTTP receive | < 50ms | < 50ms (unchanged) |
| Schema validation | < 10ms | < 10ms (unchanged) |
| Hydration | < 1s | < 1s (unchanged) |
| `injectBridgeIds` | < 50ms | < 50ms (unchanged) |
| **Heal pass** | **N/A** | **< 200ms** (NEW) |
| `editorStore.setCode` | < 200ms | < 200ms (unchanged) |
| Lint + render | < 500ms | **< 300ms** (FASTER — fewer violations to render) |

**Net impact:** +200ms for heal, −200ms for fewer badges to position and render. **Net zero.**

The heal pass is fast because it reuses `auditAll()` (already < 150ms) and applies tier-1 fixes via simple AST property swaps (no re-parse needed — mutate in place, then generate once).

### 5.1 Performance safeguards

- If token count is zero: skip heal entirely (no-op path, 0ms added)
- If violation count exceeds 100: skip tier-1 auto-fix (just classify and summarize — prevents mutation storm on extremely dirty imports)
- Heal pass runs synchronously in the main process before IPC to renderer. No async waterfall

## 6. UX: Import Summary

### 6.1 Toast variant (default — small imports)

When tier-1 fixes + tier-2 flags total ≤ 10:

```
┌──────────────────────────────────────────────────┐
│  ✓ Imported Card component                        │
│  11 tokens auto-matched · 2 need review · 1 flagged │
│                                         [Review]  │
└──────────────────────────────────────────────────┘
```

- Auto-dismisses after 8 seconds if no interaction
- "Review" opens the Import Summary panel (see below)
- If zero tier-2 and zero tier-3: toast says "All clean — 14 tokens matched" with no Review button

### 6.2 Panel variant (large imports or when user clicks Review)

Slides in from right sidebar (replaces GovernanceOverlay temporarily):

```
Import summary: Card component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Auto-healed (11)
  bg-[#3B82F6] → bg-blue-500         ✓
  text-[16px]  → text-base            ✓
  gap-[16px]   → gap-4                ✓
  ... (8 more)

Needs review (2)
  bg-[#3A81F5]  ΔE 0.4 from blue-500  [Snap]
  gap-[15px]    1px from gap-4         [Snap]

Flagged (1)
  bg-[#7B2D8E]  No matching token      [View on canvas]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Healed in 142ms · [Dismiss]  [Undo all heals]
```

- "Snap" buttons trigger `import:snap-to-token` IPC
- "Undo all heals" reverts the AST to pre-heal state (the original hydrated code is retained in memory until dismissed)
- "View on canvas" scrolls to and highlights the flagged node
- Panel auto-closes when all tier-2 items are resolved

### 6.3 Emotional arc transformation

| Phase | Before ING | After ING |
|-------|-----------|-----------|
| J8.3 Tokens arrive | Delighted | Delighted (unchanged) |
| J8.4 Component hydrates | Delighted → immediately sees red badges | Delighted — sees clean canvas with summary toast |
| J8.5 Governance kicks in | "I have 14 violations to fix" (Anxious) | "11 auto-matched, 2 to review" (Confident) |

The anxiety dip between J8.4 and J8.5 is eliminated.

## 7. Commandment Compliance

| Commandment | How ING complies |
|-------------|-----------------|
| C1 (Code is Truth) | Healed code is written to `.tsx` as the canonical source. Pre-heal code is never persisted to disk |
| C2 (No Hallucinated Styling) | Tier-1 fixes enforce token compliance at ingestion time, not just at lint time |
| C4 (Local-First) | All heal logic runs locally in the main process. No external calls |
| C7 (ID Preservation) | `injectBridgeIds` runs before the heal pass. Heal mutates values, never structure — IDs are untouched |
| C8 (Audit-First) | The heal pass IS an audit. It runs `auditAll()` before the code reaches the editor |
| C9 (CIEDE2000) | Tier classification uses the same `findClosestToken` + CIEDE2000 math as MithrilLinter |
| C12 (Atomic Queuing) | Healed file written via `FileTransactionManager` (existing auto-save path) |
| C13 (Deterministic Surgery) | All fixes use Babel AST traversal via existing `applyTokenFix`, never regex |

## 8. MCP Integration

The MCP agent workflow (J7) should also benefit. Add an optional `healOnAudit` parameter to `bridge_audit`:

```typescript
// Existing: audit only
bridge_audit({ filePath: "src/Card.tsx" })
// → { violations: [...], sarif: {...} }

// New: audit + auto-heal tier-1
bridge_audit({ filePath: "src/Card.tsx", healOnAudit: true })
// → { violations: [...], sarif: {...}, healed: { tier1Fixed: [...], tier2Flagged: [...] } }
```

This lets an agent import from Figma via MCP, heal automatically, and report the summary — without needing a human to click anything.

## 9. Test Strategy

### 9.1 Unit tests (IngestionAuditor)

| # | Test | Tier | Priority |
|---|------|------|----------|
| ING-01 | Exact hex match → tier-1 auto-fix applied | T1 | HIGH |
| ING-02 | Exact spacing value match → tier-1 auto-fix | T1 | HIGH |
| ING-03 | Exact typography match → tier-1 auto-fix | T1 | HIGH |
| ING-04 | ΔE 0.5 color → classified as tier-2 | T2 | HIGH |
| ING-05 | 1px spacing drift → classified as tier-2 | T2 | HIGH |
| ING-06 | No matching token → classified as tier-3 | T3 | HIGH |
| ING-07 | Zero tokens in DB → heal pass is no-op | Edge | HIGH |
| ING-08 | 100+ violations → auto-fix skipped, classify only | Edge | MEDIUM |
| ING-09 | Mixed tiers in single file → correct classification per node | Mixed | HIGH |
| ING-10 | Healed AST preserves all `data-bridge-id` values | C7 | HIGH |
| ING-11 | Healed code generates valid JSX (parse round-trip) | C13 | HIGH |
| ING-12 | Heal duration < 200ms for 50-node component | Perf | MEDIUM |

### 9.2 Integration tests

| # | Test | Priority |
|---|------|----------|
| ING-13 | Full pipeline: `/ingest` tokens → `/ingest-ast` → healed code in editorStore | HIGH |
| ING-14 | `/ingest-ast` with no prior `/ingest` → heal is no-op, standard governance | HIGH |
| ING-15 | Import Summary toast renders with correct counts | HIGH |
| ING-16 | "Snap to token" IPC → value updated → re-audit passes | HIGH |
| ING-17 | "Undo all heals" → original hydrated code restored | MEDIUM |
| ING-18 | MCP `bridge_audit({ healOnAudit: true })` → tier-1 fixes applied | MEDIUM |

### 9.3 Journey map coverage

| Journey Phase | Test IDs |
|---------------|----------|
| J8.3 (AST hydration) | ING-01 through ING-12 |
| J8.4 (Component renders) | ING-13, ING-14 |
| J8.5 (Governance kicks in) | ING-15, ING-16, ING-17 |
| J7.2 (MCP audit) | ING-18 |

## 10. Implementation Plan

### Phase ING.1 — Core heal logic (Sprint 1)

**Agent:** bridge-architect (contract) → bridge-electron-ipc (implementation)  
**Model tier:** Sonnet/Pro (AST traversal logic requires high reasoning)

1. Create `electron/ingestion/IngestionAuditor.ts`
2. Implement `classifyViolation()` — takes a `LinterWarning` + token list, returns tier
3. Implement `heal()` — runs `auditAll()`, classifies, applies tier-1 via `applyTokenFix`, returns `IngestionHealResult`
4. Wire into `ingestion-server.ts` `/ingest-ast` handler, between hydration and IPC
5. Add `bridge:import-summary` IPC channel
6. Tests: ING-01 through ING-12

**Deliverable:** Healed code reaches `editorStore`. No UI yet.

### Phase ING.2 — Import Summary UI (Sprint 1, parallel)

**Agent:** bridge-design-engineer  
**Model tier:** Sonnet/Pro (React state + UX precision)

1. Create `src/store/importSummaryStore.ts` — Zustand store for `IngestionSummary`
2. Create `src/components/ui/ImportSummary.tsx` — toast + panel variants
3. Listen for `bridge:import-summary` IPC in `App.tsx`, populate store
4. Implement "Snap to token" click handler → `import:snap-to-token` IPC
5. Implement "Undo all heals" — store pre-heal code, restore on click
6. Tests: ING-15, ING-16, ING-17

**Deliverable:** Full UX flow from import to summary to resolution.

### Phase ING.3 — Integration + MCP (Sprint 2)

**Agent:** bridge-integration-validator + bridge-mcp-architect  
**Model tier:** Sonnet/Pro

1. End-to-end integration test: Figma plugin → tokens → AST → heal → canvas
2. Add `healOnAudit` parameter to `bridge_audit` MCP tool
3. Update `bridge-mcp/src/tools/audit.ts` to optionally run heal pass
4. Tests: ING-13, ING-14, ING-18
5. Update `JOURNEY-MAPS-UX.md` J8 phases with ING behavior
6. Update `HANDOFF.md` and `CLAUDE.md`

**Deliverable:** Feature complete, tested, documented.

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Heal pass exceeds 200ms budget | Low | HIGH | Early-exit if > 100 violations. Benchmark in ING-12 |
| Token ordering: AST arrives before tokens | Medium | LOW | No-op degradation. Log warning. Document in plugin |
| Designer confusion: "I sent X but see Y" | Medium | MEDIUM | Import Summary shows every change with undo option |
| Tier-1 false positive: exact hex match but designer intended raw | Very Low | LOW | "Undo all heals" escape hatch. Also: if you have an exact token and used the raw hex, you made a mistake — the fix is correct |
| Conflict with existing governance overlay | Low | LOW | Import Summary is temporary — auto-closes, then GovernanceOverlay resumes for any remaining tier-3 items |

## 12. Success Metrics

| Metric | Before ING | Target After ING |
|--------|-----------|-----------------|
| Post-import violation count (median) | 8-15 per component | 0-3 per component |
| Time from Figma click to clean canvas | ~8s (3s import + 5s manual fixes) | ~3.2s (3s import + 0.2s heal) |
| Token Integrity Ratio at import time | ~60% (raw values from Figma) | > 90% (tier-1 heals the obvious ones) |
| Designer satisfaction (J8 anxiety dip) | Present at J8.4-J8.5 | Eliminated |

## 13. Relationship to Existing Strategy Docs

| Document | Relationship |
|----------|-------------|
| `02-Figma-Accuracy-Strategy.md` | ING implements the "Negotiate & Heal" tier (Section 2A: AI Token Negotiator). Tier-1 is the auto-snap. Tier-2 is the negotiation workspace. The Fallback Hierarchy (Section 4) maps directly to tier-3 handling |
| `13-Success-Metrics-KPIs.md` | ING directly improves Token Integrity Ratio (TIR) at ingestion time. TIR measurement should be captured pre-heal and post-heal for reporting |
| `05-Fidelity-Validation-Test-Plan.md` | The "Production Gate Auditor" (Section 3) now has a partner: the "Ingestion Gate Auditor" that runs the same checks earlier in the pipeline |
| `04-Production-Readiness-Strategy.md` | ING moves Bridge further from "Detect & Warn" toward "Heal & Ship" — the code is production-closer at the moment of creation |
| `JOURNEY-MAPS-UX.md` | J8 phases updated. New phase J8.3a (Heal pass) inserted. J8.5 emotional state changes from Anxious to Confident |

---

## Appendix: Updated Journey J8 with ING

### J8.4 — Component hydrates (MODIFIED)

| Lane | Detail |
|------|--------|
| **Doing** | Sees new component appear on canvas — cleaner than expected |
| **Thinking** | "It imported AND cleaned up my tokens? Nice." |
| **Feeling** | Delighted (was: Delighted then immediately Anxious) |
| **Touchpoints** | `LivePreview.tsx`, ImportSummary toast, clean `ShieldOverlay.tsx` |
| **System** | After hydration + `injectBridgeIds`: `IngestionAuditor.heal(ast, tokens)` runs. Tier-1 fixes applied to AST. `editorStore.setCode(healedCode)`. `bridge:import-summary` IPC fires with summary. ImportSummary toast renders |
| **Performance** | Hydration: < 1s. Heal: < 200ms. Total: < 1.2s (within 3s budget) |
| **Opportunity** | Celebrate zero-violation imports with a clean-sweep animation |

### J8.5 — Review + resolve (MODIFIED)

| Lane | Detail |
|------|--------|
| **Doing** | Glances at summary toast. If tier-2 items exist, clicks Review to see near-matches |
| **Thinking** | "11 auto-matched, just 2 to check. Let me snap those." |
| **Feeling** | Confident (was: Anxious) |
| **Touchpoints** | ImportSummary panel, "Snap to token" buttons, GovernanceOverlay (for remaining tier-3) |
| **Off-ramps** | Dismiss → canvas editing (J5). Snap all → clean canvas. View flagged → J3 governance loop |
| **Opportunity** | "Snap all near-matches" batch button for fast resolution |
