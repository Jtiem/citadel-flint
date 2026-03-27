# Flint Governance Configuration

**One file. Any industry. Governance that ships.**

Flint replaces scattered governance config with a single `flint.config.yaml` that declares how AI-generated UI code is governed, audited, and approved before it reaches production.

---

## The Simplest Case

```yaml
project: My App
```

That's a valid config. Flint applies sensible defaults: WCAG 2.1 AA enforcement, CIEDE2000 color drift detection at delta-E 2.0, export blocked on violations, all agents at standard trust.

## The Industry Case

```yaml
project: MedChart Pro
extends:
  - "@flint/healthcare"
```

Three lines. The `@flint/healthcare` preset activates:

- HIPAA-aligned color thresholds (delta-E 1.5, tighter than default)
- Restricted data classification (audit thresholds tightened by 50%)
- 6-year audit retention
- Conservative trust model with 10-session promotion gates
- Escalation rules that block on hallucination loops

Six official presets ship with Flint: `general`, `healthcare`, `fintech`, `e-commerce`, `government`, `enterprise-saas`. Each applies governance thresholds appropriate for regulated industries — tighter color drift detection, longer audit retention, stricter trust models, and domain-specific escalation rules. For accessibility, Flint's 50 WCAG 2.1 rules directly enforce Section 508 compliance at the AST level.

## The Enterprise Case

```yaml
project: Acme Dashboard
domain: fintech
classification: confidential

extends:
  - "@flint/fintech"
  - "acme-corp/internal-standards"
  - "./team-overrides.yaml"

tighten_only: true

rules:
  mithril:
    mode: coercive
    delta_e: 1.5
  accessibility:
    level: AA
    mode: coercive

trust:
  default_tier: junior
  profiles:
    - id: claude-code
      tier: principal
    - id: cursor-agent
      tier: senior
      max_mutations: 100
  approval:
    - condition: { risk_score: { gt: 60 } }
      action: require_approval
    - condition: { risk_score: { lt: 25 } }
      action: auto_approve

environments:
  ci:
    rules:
      mithril: { mode: coercive }
    trust:
      default_tier: intern
  development:
    rules:
      mithril: { mode: advisory }
    trust:
      default_tier: senior
```

One config. Layered inheritance. Different enforcement per environment.

---

## What This Governs

### Three-Mode Rule Enforcement

Every governance rule operates in one of three modes:

| Mode | Blocks Export | Auto-Fixable | Overridable |
|------|:---:|:---:|:---:|
| **Coercive** | Yes | No | No |
| **Normative** | Configurable | Yes | With justification |
| **Advisory** | No | Optional | Yes |

This replaces binary blocking/advisory with the semantic precision that real compliance programs need. A color that's 0.5 delta-E off a token is normative (auto-fix it). A color that's 15 delta-E off is coercive (block the export).

### Data Classification

Projects declare their sensitivity level. The governance engine adjusts automatically:

| Classification | Audit Threshold | Min Retention | Approval Required Above |
|---|---|---|---|
| Public | Standard | 30 days | Risk score 80 |
| Internal | Standard | 90 days | Risk score 70 |
| Confidential | 20% tighter | 1 year | Risk score 50 |
| Restricted | 50% tighter | 6 years | Risk score 30 |

A `restricted` healthcare project gets delta-E thresholds halved, 6-year audit trails, and human approval required for any mutation scoring above 30. All from one line: `classification: restricted`.

### Agent Trust Model

Zero-trust by default. Every AI agent starts with minimum permissions and earns autonomy through demonstrated behavior:

| Tier | What It Can Do |
|------|---|
| **Intern** | Audit, read, query. No mutations. |
| **Junior** | Recommend fixes. Cannot mutate. |
| **Senior** | Fix with guardrails. Structural changes need approval. |
| **Principal** | Full autonomy within project scope. |

Agents are promoted through configurable gates (clean session history, security validation, governance signoff). They can be automatically demoted when trust assumptions fail.

### Conditional Approval Gates

Mutations are risk-scored. Configurable gates decide what proceeds automatically and what requires human approval:

```yaml
approval:
  - condition: { risk_score: { gt: 70 } }
    action: require_approval
  - condition: { risk_score: { lt: 30 } }
    action: auto_approve
```

Low-risk changes flow. High-risk changes pause for review. The threshold is yours to set.

### Auto-Escalation

Session-aware rules detect problematic patterns and respond automatically:

- 3+ coercive violations in a session -> require manual review
- 20+ mutations in 5 minutes -> block (hallucination loop detection)
- Session risk average above 0.6 -> demote agent to lower trust tier

### Configurable Scoring Weights

Different industries weigh violations differently. A coercive violation in healthcare (weight: 0.95) impacts the health score more than the same violation in a consumer app (weight: 0.7). Weights are configurable per-project or inherited from domain presets.

---

## Composable Governance

### Inheritance with Safety

The `extends` array composes governance from multiple sources:

```yaml
extends:
  - "@flint/healthcare"              # Official industry preset
  - "acme-corp/internal-standards"   # Organization pack from registry
  - "./team-overrides.yaml"          # Local team customization
```

Deep-merged in order. Your file wins last.

The **tighten-only invariant** (on by default) prevents child configs from accidentally weakening parent rules. A team config extending an org-wide WCAG requirement cannot disable it. The relaxation must be explicit and auditable.

### Environment Overlays

One config, many contexts:

| Environment | Mithril Mode | Agent Trust |
|---|---|---|
| CI | Coercive (blocks) | Intern (minimum) |
| Development | Advisory (warns) | Senior (trusted) |
| Staging | Normative (auto-fixes) | Junior (standard) |

Selected by the `FLINT_ENV` environment variable. No config duplication.

### Governance Packs

Share governance by sharing a YAML file. Install a published pack with one line in `extends`. The Governance Pack Exchange (GPX) supports:

- Local packs (filesystem)
- Organization packs (team registry)
- Official presets (bundled with Flint)

Import is non-destructive: packs are stored in `.flint-packs/` and referenced via `extends`, so rollback is removing one line.

---

## Parse-Time Validation

Invalid config gets actionable errors, not silent failures:

```
rules.mithril.delta_e: must be a positive number, got "banana"
rules.mithril.delta_e_critical: must be greater than delta_e (1.5), got 1.0
trust.default_tier: must be one of intern|junior|senior|principal, got "superadmin"
```

Validation warns but never blocks. Partially valid configs still load with defaults for invalid fields.

---

## Migration

Existing projects using JSON config files can auto-migrate:

```
flint_migrate_config --project-root .
```

This reads `.flint/policy.json`, `.flint/agent-policy.json`, and `.flint/escalation-rules.json`, generates `flint.config.yaml`, and backs up the originals to `.bak`. Legacy JSON files continue to work with a deprecation notice until removed.

---

## Research Foundation

The unified config design synthesizes patterns from seven external sources, validated against current industry direction:

| Source | Contribution |
|--------|---|
| Auton/AgenticFormat | Tighten-only invariant, specification/runtime separation |
| Snap Agent Format | External policy references, conditional approval gates, data classification |
| GaaS/GUARDIAN | Three-mode rule taxonomy, domain-tunable scoring weights |
| CSA Agentic Trust Framework | Named trust tiers, promotion/demotion gates, zero-trust default |
| NexaStack Policy-as-Code | PDP/PEP separation pattern |
| ESLint Flat Config | Reintroduced `extends` after composition proved too hard without it |
| W3C DTCG v2025.10 | Stable design token specification for token interchange |

---

## Implementation

235 tests across 7 implementation phases. 3221/3221 MCP engine tests passing. Zero TypeScript errors. Zero breaking changes. Full backward compatibility with existing JSON configuration.
