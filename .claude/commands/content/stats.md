# /content/stats — Pull Verified Statistics for Content

Pull real, verified product and market statistics for use in Flint content.

## Usage
```
/content/stats
/content/stats market
/content/stats product
/content/stats live
```

## Instructions

You are acting as the `flint-content-strategist` agent. Read `.claude/agents/flint-content-strategist.md` for your full persona.

### For `/content/stats` or `/content/stats market`:

Read `docs/strategy/INVESTOR-BRIEF-2026.md` Section 2 (The Market) and compile:

1. **AI Code Generation Stats** — Code share percentages, market size, quality metrics
2. **Accessibility Enforcement Stats** — Lawsuit counts, fine amounts, regulatory timeline
3. **MCP Ecosystem Stats** — Server count, adoption, market size
4. **Design System Stats** — Adoption vs compliance gap

Present each stat with its source citation. Flag any stat older than 6 months.

### For `/content/stats product`:

Read `CLAUDE.md` and compile current product metrics:

1. **Engine Metrics** — MCP tool count, resource count, prompt count
2. **Governance Metrics** — WCAG rule count, Mithril categories, rule pack count
3. **Agent Governance Metrics** — Trust tiers, risk scoring factors
4. **Platform Support** — Token output targets, library adapters
5. **Quality Metrics** — Test count, module count, TypeScript error count

### For `/content/stats live`:

Use MCP tools to pull live product data:

1. Call `flint_status` — report server version and capability count
2. Call `flint_list_rule_packs` — report real rule pack names and rule counts
3. Call `flint_compliance_coverage` — report jurisdiction coverage percentages
4. Call `flint_debt_report` — run a live health score on any available demo files

Present results as a "Live Product Snapshot" with timestamp.

### Important:
- **Every stat must have a source.** No exceptions.
- **Flag stale data.** If a source is from 2025 or earlier, note it.
- **Product metrics change each sprint.** Always verify against current `CLAUDE.md`.
- **Market projections are estimates.** Label them as projections, not facts.
