# /health — Full Project Health Dashboard

One-command project health check combining design debt, sync status, anomaly detection, and governance posture into a single report.

## Usage

- `/health` — Full health dashboard
- `/health --trend` — Include trend tracking (compare to last check)

## Behavior

### Step 1: Gather health data (parallel)

Call these MCP tools in parallel:
1. `flint_debt_report` with glob `"src/**/*.tsx"` and format `"markdown"`
2. `flint_sync_check` for token sync health
3. `flint_anomaly_report` with mode `"detect"` for anomaly detection
4. `flint_get_context` for session state

If `--trend` was passed, also call `flint_debt_report` with `track: true`.

### Step 2: Present the dashboard

```
## Project Health Dashboard

### Overall
**Score:** 78/100
**Grade:** C+
**Trend:** ↑ 4 points since last check

### Design Debt
| Metric | Value |
|--------|-------|
| Health score | 78/100 |
| Grade | C+ |
| Total violations | 23 |
| Files with issues | 8/34 |
| Top violated rule | DRIFT-001 (11 occurrences) |

### Top 5 Problem Files
| File | Violations | Grade |
|------|-----------|-------|
| HeroSection.tsx | 6 | D |
| PricingTable.tsx | 5 | D |
| Footer.tsx | 4 | C |
| NavBar.tsx | 4 | C |
| FeatureCard.tsx | 4 | C |

### Token Sync
**Status:** DRIFT_DETECTED
**Drifted tokens:** 3 (SYNC-001)
**Orphaned tokens:** 1 (SYNC-002)
**Last sync:** 4 hours ago

### Anomalies (Flare)
**Detected:** 1 anomaly
- Override rate spiked 3σ above baseline in last hour

### Governance Posture
**Export gate:** BLOCKED (3 violations remain)
**Active overrides:** 2
**Agent trust tiers:** 3 agents at Trusted, 1 at Restricted
```

### Step 3: Recommend actions

Based on the data, prioritize the top 3 actions:

```
### Recommended Actions (priority order)

1. **Fix token drift** — Run `/tokens pull` to sync 3 drifted tokens
2. **Clean up HeroSection.tsx** — Run `/fix src/components/HeroSection.tsx` (6 violations)
3. **Review override spike** — Flare detected unusual override activity this session
```

### Step 4: Export gate status

Always end with the export gate verdict:
- If APPROVED: "Export gate: CLEAR — project is shippable."
- If BLOCKED: "Export gate: BLOCKED — N issues must be resolved before export. Run `/sweep` to batch-fix."

## Notes

- Uses Citadel vocabulary: Mithril (visual lint), Warden (a11y), Sentry (risk), Flare (anomalies), Gate (export), Envoy (sync)
- This combines 4 MCP tools into one view — the individual tools are still available for deeper dives
- Trend tracking persists via `flint_debt_report` with `track: true` (SQLite-backed)
- For CI environments, use `flint-gate audit` instead (headless, SARIF output)

Arguments: $ARGUMENTS
