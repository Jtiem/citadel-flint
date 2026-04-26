# Governance Service Test Backfill — 2026-04-25

Beta-safe test-only backfill for the three thinnest-tested governance services
under `flint-mcp/src/core/governance/`. No implementation changed; only
unit tests were added, following the existing patterns in
`flint-mcp/src/core/governance/__tests__/`.

## Coverage analysis

Ranked by `test_lines / src_lines` ratio, lowest (thinnest) first:

| Service | Src lines | Test lines (before) | Ratio | Notes |
|---|---|---|---|---|
| **mutationProvenanceService** | 383 | 195 (chron1 only) | 0.51 | Only CHRON.1 reason-on-override path was tested. `recordProvenanceBatch`, `getProvenanceBySource`, `getProvenanceSummary`, `pruneProvenance`, and `getAuditTrail` date filtering were entirely uncovered. |
| **trustTierService** | 366 | 331 | 0.90 | Decent coverage, but `manualDemote`, the sliding-window promotion fix (MAJOR-8), and several `evaluate*` edges were untested. |
| **agentRiskService** | 169 | 301 | 1.78 | Smaller surface but several mapping branches missing — `tier='high'` → `amberCount`, unknown tier exclusion, `getAgentProfile` period passthrough, `avgRiskScore` rounding boundary, multi-agent override matching by id. |

(Other governance services such as `eventService` (550 test lines for 277
src), `consensusQueryService` (519/170), `enforcementService` (542/245),
`mutationLedgerService` (514/329), and `driftTrendService` (479/334) all
sit at ratios of 1.4 or higher and were skipped.)

## Targeted services and tests added

### 1. `mutationProvenanceService` — new file

`flint-mcp/src/core/governance/__tests__/mutationProvenanceService.test.ts`

**27 new tests** across:

- `recordProvenance` + `getProvenance`: minimal round-trip, fully-populated
  round-trip, unknown-id null return, all 5 source enum values, invalid
  source rejected by CHECK constraint, confidence outside `[0,1]` rejected.
- `recordProvenanceBatch`: multi-row insert, empty-batch no-op, rollback
  atomicity on PRIMARY KEY collision.
- `getProvenanceBySource`: filter correctness, newest-first ordering,
  explicit limit, default limit of 100, empty-result case.
- `getProvenanceSummary`: empty-table zero state, total + bySource
  aggregation, last-24h boundary, top-agents descending order, null
  agent_id exclusion, 5-entry cap.
- `getAuditTrail` date filtering: empty-file case, `startDate` lower
  bound, `endDate` upper bound, both bounds together.
- `pruneProvenance`: no-match returns 0, deletes older rows and returns
  count, strict less-than boundary (rows at cutoff survive).

### 2. `trustTierService` — new sibling file

`flint-mcp/src/core/governance/__tests__/trustTierService.extra.test.ts`

**12 new tests** across:

- `manualDemote`: elevated→standard, admin→elevated, no-op at restricted,
  full step-by-step demotion chain, unknown-id creates restricted record.
- Sliding-window promotion (MAJOR-8): historical red >30 days does not
  block promotion; recent red within window does.
- `evaluatePromotion` edges: no advance below threshold.
- `evaluateDemotion` edges: 3+ reds force restricted regardless of
  escalation flag; already-restricted with reds stays restricted.
- `getAgentTrustProfile` idempotency: repeated lookups create no
  duplicate rows; counters preserved across lookups.

### 3. `agentRiskService` — new sibling file

`flint-mcp/src/core/governance/__tests__/agentRiskService.extra.test.ts`

**8 new tests** across:

- Tier mapping: `tier='high'` → `amberCount`; `tier='low'`/`tier='medium'`
  both → `greenCount`; mixed-tier summary; unknown tiers excluded from
  all counters.
- `getAgentProfile`: custom `periodDays` correctly forwarded; returns
  null when activity is outside the requested window.
- `avgRiskScore` rounding to 2 decimal places (33.33 boundary).
- Multi-agent override matching: counts attach to the correct
  `agent_id` and not by row index.

## Test results

```
MCP:   5699/5699 passing (47 new). TSC: 0 errors.
```

Per file:

```
mutationProvenanceService.test.ts   27 tests  35ms
trustTierService.extra.test.ts      12 tests   7ms
agentRiskService.extra.test.ts       8 tests   9ms
```

No pre-existing test was modified or deleted. No implementation file
under `flint-mcp/src/core/governance/` was touched.

## Suggested commit message

```
test(governance): backfill unit tests for thinnest-tested services

Adds 47 tests covering previously uncovered branches in three governance
services identified by lowest test/src ratio:

- mutationProvenanceService: recordProvenanceBatch atomicity,
  getProvenanceBySource ordering/limits, getProvenanceSummary
  aggregation, getAuditTrail date filtering, pruneProvenance boundary
- trustTierService: manualDemote chain, sliding-window promotion
  (MAJOR-8), evaluate* edges, getAgentTrustProfile idempotency
- agentRiskService: tier='high'→amberCount mapping, unknown-tier
  exclusion, getAgentProfile period passthrough, avgRiskScore rounding,
  multi-agent override matching by id

No implementation changes — tests only. Follows the existing in-memory
SQLite pattern used elsewhere in flint-mcp/src/core/governance/__tests__/.

MCP: 5699/5699 passing (47 new). TSC: 0 errors.
```

## Files added

- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/governance/__tests__/mutationProvenanceService.test.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/governance/__tests__/trustTierService.extra.test.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/governance/__tests__/agentRiskService.extra.test.ts`
