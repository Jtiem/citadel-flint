---
name: Unified Config Initiative
description: flint.config.yaml — single YAML replacing policy.json + agent-policy.json + escalation-rules.json, informed by 7 external research sources
type: project
---

UCFG initiative approved for research on 2026-03-24. Full spec at docs/strategy/UNIFIED-CONFIG-SPEC.md with examples at docs/strategy/examples/.

**Why:** Config fragmentation (3+ JSON files) slows onboarding and complicates governance pack sharing. Industry is converging on declarative YAML for agent governance (Auton/AgenticFormat, Agent Format Spec, ESLint flat config extends).

**Key design decisions from research:**
- Three-mode rule taxonomy: coercive/normative/advisory (from GaaS/GUARDIAN paper)
- Tighten-only invariant: child configs cannot relax parent rules (from Auton AgenticFormat)
- Named trust tiers: intern/junior/senior/principal (from CSA Agentic Trust Framework)
- Conditional approval gates with operator conditions (from Agent Format Spec)
- Environment overlays via FLINT_ENV (ci/development/staging)
- `extends` for composable governance inheritance (validated by ESLint's reintroduction)
- DTCG v2025.10 stable spec alignment for token source
- Data classification field: public/internal/confidential/restricted

**Status:** ALL 6 PHASES COMPLETE (2026-03-25). 180 new tests, MCP 3167/3167, TSC 0 errors.

**How to apply:** `flint.config.yaml` is now first-class. Legacy JSON still works with deprecation notice. Use `flint_migrate_config` to auto-convert. Governance packs use YAML format with `extends` for installation.
