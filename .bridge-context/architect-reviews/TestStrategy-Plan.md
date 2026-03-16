# Test Strategy: Amazing, Not Many

**Philosophy:** Test the promises, not the plumbing. If TypeScript catches it, don't test it. If a failure would ship broken governance, test it ruthlessly.

---

## The 25 Tests That Matter

### Tier 1: Safety Promises (10 tests)

These prove Bridge's core value proposition. If any of these break, the product is lying.

| # | Test | What it proves | Domain |
|---|------|---------------|--------|
| 1 | File with hardcoded `#ff0000` → MithrilLinter flags MITHRIL-COL → ExportGate blocks | **Color drift gets caught** | Governance |
| 2 | File with missing `alt` on `<img>` → A11yLinter flags A11Y-001 → ExportGate blocks | **A11y violations block export** | Governance |
| 3 | File with `aria-label` on every element → clean audit → ExportGate allows | **Clean code ships** | Governance |
| 4 | Override a rule → override recorded in governance_events → badge count increments | **Every bypass is logged** | Telemetry |
| 5 | `bridge_audit` tool → returns violations with correct ruleIds and severity | **MCP audit works headless** | MCP |
| 6 | `bridge_fix` tool → auto-fixes token violation → re-audit passes | **Auto-fix actually fixes** | MCP |
| 7 | `bridge_debt_report` → scans project → returns score 0-100 with correct grade | **Debt report is accurate** | MCP |
| 8 | `bridge_accessibility_report` → returns WCAG criterion pass/fail breakdown | **A11y report is structured** | MCP |
| 9 | `bridge_audit_report` → violations enriched with provenance metadata | **Compliance trail works** | MCP |
| 10 | CIEDE2000 ΔE for known color pairs matches published reference values | **Color science is correct** | Core |

### Tier 2: Data Integrity (8 tests)

These prove mutations and state don't corrupt.

| # | Test | What it proves | Domain |
|---|------|---------------|--------|
| 11 | `applyMutationBatch([move, inject, fixToken])` → AST valid → `data-bridge-id` preserved | **Batch mutations are atomic** | AST |
| 12 | `applyMutationBatch` → inverse generated → apply inverse → original code restored | **Undo is mathematically correct** | AST |
| 13 | `FileTransactionManager.write()` → tmp file → rename → content matches | **Writes don't corrupt** | Persistence |
| 14 | `GitManager.shadowCommit()` → `gitShow(HEAD)` → returns committed content | **Git recovery works** | Recovery |
| 15 | `GovernanceEventService.recordEvent()` → `queryEvents()` → round-trip fidelity | **Events don't drop** | Database |
| 16 | `MutationLedgerService.recordMutation()` → `queryMutations()` → round-trip fidelity | **Ledger doesn't lose records** | Database |
| 17 | Design tokens CRUD → token value change → Mithril re-audit detects drift | **Token changes trigger re-evaluation** | Integration |
| 18 | `injectBridgeIds(ast)` → every JSXElement has unique `data-bridge-id` | **ID preservation holds** | AST |

### Tier 3: Boundary Contracts (7 tests)

These prove the process boundary doesn't silently swallow data.

| # | Test | What it proves | Domain |
|---|------|---------------|--------|
| 19 | IPC `governance:record-override` → event in SQLite → count incremented | **Override IPC reaches DB** | IPC |
| 20 | IPC `governance:compliance-summary` → returns correct ComplianceSummary shape | **Compliance IPC returns typed data** | IPC |
| 21 | `.bridge/context.json` written by useContextSync → readable by MCP server | **Context Bridge file is valid JSON** | Integration |
| 22 | `.bridge/annotations.json` written by MCP → readable by Glass annotationStore | **Annotation sync works** | Integration |
| 23 | `bridge://dashboard` resource → returns DashboardData with score + history | **MCP resource is live** | MCP |
| 24 | `bridge://violations/{filePath}` resource → returns audit for that file | **Per-file violations work** | MCP |
| 25 | `bridge://capabilities` resource → lists all 13 tools with descriptions | **Tool discovery works** | MCP |

---

## What We Don't Test (and Why)

| Skip | Reason |
|------|--------|
| React component rendering | TypeScript + visual review catches layout bugs. Testing "does this div render" adds noise. |
| Zustand getter/setter boilerplate | TypeScript enforces the shape. If `setFoo(x)` doesn't work, TSC fails. |
| Individual CSS classes | Tailwind is deterministic. If the class exists, it works. |
| Every IPC channel | Test the 5 that carry governance data. The rest are CRUD plumbing. |
| AI response parsing | Mock the AI. Test the constraint enforcement, not the stream parsing. |
| Figma ingestion payload shapes | Schema validation at the boundary is sufficient. |

---

## Implementation Plan

### Test Runner: Vitest (already configured)

No new test framework needed. The 25 tests split across 3 files:

| File | Tests | Runner |
|------|-------|--------|
| `bridge-mcp/src/__tests__/safety-promises.test.ts` | 1-10 | vitest (Node) |
| `bridge-mcp/src/__tests__/data-integrity.test.ts` | 11-18 | vitest (Node) |
| `bridge-mcp/src/__tests__/boundary-contracts.test.ts` | 19-25 | vitest (Node) |

All 25 run in Node.js (not jsdom). They test real Babel parsing, real SQLite, real file I/O. No mocks except for the AI API.

### What Stays

The existing 366 MCP tests and 409 Glass tests stay. They're good unit coverage. The 25 new tests are the integration layer that proves the units compose correctly.

### Target

```
Unit:        775 tests (existing) — catches regressions
Integration:  25 tests (new)     — proves the promises
TSC:           0 errors           — catches type drift
Total:       800 tests, ~30s runtime
```
