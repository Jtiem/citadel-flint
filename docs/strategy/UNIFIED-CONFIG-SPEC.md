# Unified Configuration: `flint.config.yaml`

**Status:** Proposal (Research Complete)
**Date:** 2026-03-25
**Replaces:** `.flint/policy.json` + `.flint/agent-policy.json` + `.flint/escalation-rules.json`

---

## Research Sources

This spec synthesizes patterns from seven external sources, validated against industry direction:

| Source | Key Contribution |
|--------|-----------------|
| [design-jarvis](https://github.com/renfei-design/design-jarvis) | Single YAML config for entire team governance |
| [Auton/AgenticFormat](https://arxiv.org/html/2602.23720v1) | Cognitive Blueprint schema, tighten-only invariant, specification/runtime separation |
| [Agent Format Spec](https://eng.snap.com/agent-format) (Snap) | `governance_policies` as external refs, conditional approval gates, `data_classification`, JSON Schema |
| [GaaS/GUARDIAN](https://arxiv.org/html/2508.18765v1) | Three-mode rule taxonomy (coercive/normative/mimetic), domain-tunable scoring weights |
| [CSA Agentic Trust Framework](https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents) | Named trust tiers with promotion/demotion gates, zero-trust-by-default |
| [NexaStack Policy-as-Code](https://www.nexastack.ai/blog/agent-governance-at-scale) | PDP/PEP separation, hybrid centralized/distributed enforcement |
| [ESLint Flat Config `extends`](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) | Reintroduced `extends` for composition after flat config proved too hard to share without it |
| [DTCG v2025.10](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) | First stable W3C design token spec — canonical format for token exchange |

---

## Problem

Flint's governance configuration is fragmented across 3+ JSON files, each with its own schema, loader, and file-watcher. New users must discover and edit multiple files to configure a project. Governance packs must bundle and merge each file separately.

| Today | Proposed |
|-------|----------|
| `.flint/policy.json` | `flint.config.yaml` |
| `.flint/agent-policy.json` | *(merged in)* |
| `.flint/escalation-rules.json` | *(merged in)* |
| Sentinel domain (enum in policy) | *(merged in)* |
| Library selection (IPC, no file) | *(merged in)* |
| Content style guide (nowhere) | *(merged in)* |
| Data classification (nowhere) | *(new — from Agent Format)* |
| Scoring weights (hardcoded) | *(new — from GaaS)* |

## Design Principles

1. **Progressive disclosure** — A 1-line config works. A 150-line config gives total control.
2. **Composable inheritance** — `extends` pulls presets, team overlays, or published packs. (Validated by ESLint's reintroduction of `extends` after flat config proved insufficient for sharing.)
3. **Tighten-only invariant** — Child configs can add strictness but never relax parent governance. (From Auton/AgenticFormat — prevents accidental weakening of inherited rules.)
4. **Environment-aware** — Different enforcement for CI vs. development vs. staging.
5. **Config IS the pack** — `flint_pack_export` bundles `flint.config.yaml` + `design-tokens.json`. No separate format.
6. **Specification/runtime separation** — Pure declaration, no executable code. (From Auton — "static, versionable, machine-readable and human-readable specification.")
7. **Backward compatible** — Legacy JSON files still work. YAML takes precedence when present.
8. **YAML for humans** — Comments, readable nesting, industry standard for governance configs (Kubernetes, Ansible, GitHub Actions).

---

## Specification

### Minimum Viable Config

```yaml
project: My Product
```

Everything else inherits defaults. Equivalent to today's behavior when no `.flint/policy.json` exists.

### Full Schema

```yaml
# ═══════════════════════════════════════════════════════════════
# flint.config.yaml — Project Governance Configuration
# Schema: https://flint.dev/schema/config/v1
# ═══════════════════════════════════════════════════════════════
schema_version: "1.0.0"


# ─── Identity ─────────────────────────────────────────────────

project: "My Product"

# Governance domain — activates industry-specific Sentinel persona
# and compliance rules (HIPAA, PCI-DSS, Section 508, etc.)
domain: general
# general | healthcare | fintech | e-commerce | government | enterprise-saas

# Data classification — scopes governance strictness.
# 'restricted' components get tighter audit thresholds than 'public' ones.
# (From Agent Format spec — enables classification-based policy binding.)
classification: internal
# public | internal | confidential | restricted

# Kubernetes-style labels for policy matching and filtering.
# Governance packs can target projects by label selector.
labels: {}
  # brand: acme
  # audience: external
  # tier: critical


# ─── Inheritance ──────────────────────────────────────────────
# Compose governance from upstream configs. Deep-merged in order.
# Later entries override earlier ones. This file overrides all.
#
# Tighten-only invariant (default: true):
#   When true, child configs can ADD rules or RAISE severity
#   but cannot DISABLE a parent rule or LOWER severity.
#   Set to false only for local development overrides.
#   (From Auton AgenticFormat — prevents accidental weakening.)

extends: []
  # - "@flint/healthcare"           # Official Flint preset
  # - "acme-corp/fintech-v2"        # Published governance pack (GPX registry)
  # - "./team-overrides.yaml"       # Local file (relative to project root)

tighten_only: true


# ─── Design System ───────────────────────────────────────────

tokens:
  # Path to DTCG token file (relative to project root).
  # Conforms to W3C DTCG v2025.10 stable specification.
  source: .flint/design-tokens.json

  # Active component library for token mapping and system prompt constraints.
  # 'auto' detects from package.json dependencies.
  library: auto
  # auto | primeng | shadcn | mui | tailwind | none

  # Figma connection for token sync (SYNC.1-4)
  figma:
    file_key: null
    component_library: null
    icon_library: null


# ─── Governance Rules ────────────────────────────────────────
# Rules are classified into three enforcement modes:
#
#   coercive   — Non-negotiable. Blocks export. Cannot be overridden.
#   normative  — Standard enforcement. Warns or blocks. Can be overridden with justification.
#   advisory   — Best-practice guidance. Informational only.
#
# (Three-mode taxonomy from GaaS/GUARDIAN research paper.
#  Maps to Flint's existing blocking/advisory/off with richer semantics.)

rules:
  mithril:
    mode: coercive              # coercive | normative | advisory | off
    delta_e: 2.0                # CIEDE2000 amber threshold
    delta_e_critical: 10.0      # CIEDE2000 red threshold
    ignore:                     # Glob patterns to skip
      - "**/node_modules/**"

  accessibility:
    level: AA                   # A | AA | AAA
    mode: coercive              # coercive | normative | advisory | off
    disabled: []                # Rule IDs to skip, e.g. ["A11Y-019"]

  export_gate:
    block_on: coercive          # Block export when any coercive violation exists
    warn_on: normative          # Show warning for normative violations
    block_on_overrides: true    # Block if active rule overrides exist

  baseline:
    enabled: false              # Suppress pre-existing violations

  # External governance policy references (from Agent Format spec).
  # These are resolved from official presets or GPX registry.
  # Each policy adds rules that merge with the rules above.
  policies: []
    # - ref: "flint/wcag-aa-v2"
    #   required: true            # Fail if policy can't be resolved
    # - ref: "acme-corp/brand-colors-v3"
    #   required: true
    # - ref: "team/naming-conventions-v1"
    #   required: false           # Advisory — don't fail if missing


# ─── Scoring ─────────────────────────────────────────────────
# Risk and debt scoring weights, tunable per domain.
# (From GaaS/GUARDIAN — different domains need different weights.
#  Healthcare weighs coercive violations at 0.95; consumer apps at 0.7.)

scoring:
  weights:
    coercive: 0.8               # Weight for coercive (blocking) violations
    normative: 0.6              # Weight for normative (standard) violations
    advisory: 0.3               # Weight for advisory (informational) violations
    recency: 0.4                # Decay factor — recent violations weigh more

  # Named presets override weights by domain (selected via 'domain' field above).
  # Custom presets can be defined here.
  presets:
    healthcare: { coercive: 0.95, normative: 0.8, advisory: 0.5, recency: 0.7 }
    fintech:    { coercive: 0.9,  normative: 0.7, advisory: 0.4, recency: 0.6 }
    government: { coercive: 0.95, normative: 0.85, advisory: 0.6, recency: 0.8 }


# ─── Trust & Agents ──────────────────────────────────────────
# Zero-trust-by-default: no agent is trusted until it earns trust
# through demonstrated behavior.
# (From CSA Agentic Trust Framework — trust is earned, not granted.)
#
# Four named tiers (more intuitive than numeric levels):
#   intern     — Observe only. Can audit, read, query.
#   junior     — Can recommend fixes. Cannot mutate.
#   senior     — Can fix with guardrails. Structural changes need approval.
#   principal  — Full autonomy within project scope.

trust:
  default_tier: junior
  # intern | junior | senior | principal

  # Allow automatic demotion when trust assumptions fail.
  # (From CSA ATF — agents that regress in quality lose privileges.)
  allow_demotion: true

  # Named agent profiles (override default tier)
  profiles: []
    # - id: claude-code
    #   name: "Claude Code"
    #   tier: principal
    # - id: cursor-agent
    #   name: "Cursor"
    #   tier: senior
    #   max_mutations: 100

  # Conditional approval gates (from Agent Format spec).
  # Uses operator-based conditions: gt, gte, lt, lte, eq, ne.
  approval:
    - condition: { risk_score: { gt: 70 } }
      action: require_approval
      message: "High-risk mutation (score {{risk_score}}). Approve?"

    - condition: { risk_score: { lt: 30 } }
      action: auto_approve

  # Auto-escalation triggers
  escalation:
    - when: { red_count: ">= 3", window: session }
      then: require_review

    - when: { amber_count: ">= 5", window: 1h }
      then: alert
      message: "High amber mutation rate detected"

    - when: { session_risk_avg: "> 0.6" }
      then: downgrade
      to: junior

    - when: { mutation_velocity: ">= 20", window: 5m }
      then: block
      # Hallucination loop detection

  # Promotion gates — what an agent needs to earn a higher tier.
  # (From CSA ATF — five criteria for trust promotion.)
  promotion:
    clean_sessions: 5           # Consecutive sessions with 0 coercive violations
    security_validation: true   # Must pass security scan
    governance_signoff: false   # Require human approval for promotion


# ─── Enforcement ─────────────────────────────────────────────
# Explicit separation of WHERE rules are evaluated (decision points)
# vs. WHERE decisions are enforced (enforcement points).
# (PDP/PEP pattern from NexaStack policy-as-code research.)

enforcement:
  # Decision points — where governance rules are evaluated
  decision_points:
    - mcp_audit                 # flint_audit / audit_ui_component
    - ci_gate                   # Headless CI/CD check

  # Enforcement points — where decisions manifest
  points:
    export_gate:
      block_on: coercive
    auto_fix:
      apply_on: [normative]     # Auto-fix normative violations
    ci_gate:
      fail_on: coercive
      warn_on: normative


# ─── Review ──────────────────────────────────────────────────

review:
  # Multi-agent epistemic consensus gate (V.4)
  consensus: false
  # Or configure per-domain:
  # consensus:
  #   domains: [mithril, a11y]
  #   threshold: 0.7


# ─── Content Standards ───────────────────────────────────────

content:
  # UI text and documentation style guide
  style_guide: null
  # google | microsoft | apple | ./path/to/custom-guide.md


# ─── Audit Trail ─────────────────────────────────────────────
# Structured audit configuration.
# (From GaaS — every governance decision is logged with full context.)

audit:
  retention: 90d                # How long to keep audit records
  export: [json, sarif]         # Available export formats: json, csv, sarif, cyclonedx


# ─── Environment Overlays ────────────────────────────────────
# Override any setting per deployment context.
# Active overlay selected by FLINT_ENV environment variable.
# Environment overlays ignore tighten_only — they can relax rules
# for development contexts while keeping CI strict.

environments:
  ci:
    rules:
      mithril: { mode: coercive }
      export_gate: { block_on_overrides: true }
    trust:
      default_tier: intern      # CI agents get minimum permissions
  development:
    rules:
      mithril: { mode: advisory }
      export_gate: { block_on_overrides: false }
    trust:
      default_tier: senior      # Trust dev agents more
  # staging:
  #   rules:
  #     mithril: { mode: normative }
```

---

## Key Design Decisions

### Why YAML over JSON or TOML

| Factor | JSON | YAML | TOML |
|--------|------|------|------|
| Comments | No | Yes | Yes |
| Deep nesting | Verbose | Clean | Awkward past 3 levels |
| Industry precedent for governance | Low | High (K8s, Ansible, GH Actions) | Low |
| Human editing | Error-prone (trailing commas) | Natural | Good for flat config |
| Multi-line strings | Requires escaping | Block scalars | Multi-line literals |

YAML wins for governance config: it handles deep nesting well, supports inline documentation via comments, and is the established format for declarative governance in DevOps (Kubernetes, Terraform, GitHub Actions, ESLint).

### Why Three Rule Modes (coercive/normative/advisory) over Two (blocking/advisory)

The GaaS/GUARDIAN research demonstrates that a binary blocking/advisory split loses important semantic information. The three-mode taxonomy maps to clear enforcement behavior:

| Mode | Blocks Export? | Auto-fixable? | Overridable? | Example |
|------|---------------|---------------|--------------|---------|
| **coercive** | Yes | No | No | Color contrast below WCAG AA |
| **normative** | Configurable | Yes | With justification | Using non-token color that's visually close |
| **advisory** | No | Optional | Yes | Naming convention mismatch |

This is backward-compatible: `blocking` maps to `coercive`, `advisory` maps to `advisory`, and `normative` is the new middle ground that today's `blocking` mode often mishandles.

### Why Tighten-Only Invariant Matters

Without it, a team-level config can accidentally disable an org-level safety rule:

```yaml
# org-base.yaml
rules:
  accessibility:
    mode: coercive    # Must pass WCAG AA

# team-override.yaml (extends org-base)
rules:
  accessibility:
    mode: advisory    # ← DANGEROUS: silently disables org requirement
```

With `tighten_only: true` (default), the loader rejects the override and logs a warning. The team must explicitly set `tighten_only: false` to relax inherited rules — making the relaxation intentional and auditable.

### Why Named Trust Tiers (intern/junior/senior/principal) over Current (untrusted/standard/elevated/admin)

| Current | Proposed | Why |
|---------|----------|-----|
| `untrusted` | `intern` | "Untrusted" implies malice. "Intern" implies learning — same restrictions, better mental model. |
| `standard` | `junior` | Clearer that this is a progression, not a default. |
| `elevated` | `senior` | Maps to real-world permission escalation. |
| `admin` | `principal` | "Admin" implies system access. "Principal" implies earned autonomy within scope. |

Both naming schemes are supported during migration. The loader accepts either.

---

## Resolution Order

```
1. Built-in defaults (DEFAULT_POLICY)
         ↓  deep-merge
2. extends[0] → extends[1] → extends[N]  (inheritance chain, tighten-only)
         ↓  deep-merge
3. flint.config.yaml                       (project config)
         ↓  deep-merge
4. environments[FLINT_ENV]                 (environment overlay, bypasses tighten-only)
         ↓  result
5. Final resolved config (immutable for session)
```

When `flint.config.yaml` is absent, the loader falls back to legacy files:
```
.flint/policy.json + .flint/agent-policy.json + .flint/escalation-rules.json
```
A deprecation notice is logged once per session.

## `extends` Resolution

| Prefix | Source | Example |
|--------|--------|---------|
| `@flint/` | Official preset bundled with Flint MCP | `@flint/healthcare` |
| `org/name` | Published pack from GPX registry (GPX.3) | `acme-corp/fintech-v2` |
| `./` or `../` | Local file relative to project root | `./team-overrides.yaml` |
| Absolute path | Direct file reference | `/shared/governance/base.yaml` |

Official presets ship as YAML files inside `flint-mcp/presets/`:
```
flint-mcp/presets/
  general.yaml
  healthcare.yaml      # HIPAA + PHI masking + FDA SaMD
  fintech.yaml         # PCI-DSS + SOC 2 Type II
  e-commerce.yaml      # GDPR + consent patterns
  government.yaml      # Section 508 + WCAG AAA
  enterprise-saas.yaml # SOC 2 + SAML/OIDC patterns
```

---

## Impact on Governance Packs (GPX)

### Before (GPX.1)

```
.flint-pack/
  manifest.json          # Pack metadata + checksums
  policy.json            # Governance rules
  agent-policy.json      # Trust tiers
  rules/*.json           # Per-rule overrides
  claude-fragments/*.md  # CLAUDE.md fragments
```

### After

```
.flint-pack/
  manifest.json          # Pack metadata + checksums
  flint.config.yaml      # Everything in one file
  design-tokens.json     # Token definitions (optional, DTCG v2025.10)
  claude-fragments/*.md  # CLAUDE.md fragments (optional)
```

Installing a pack = adding one line to `extends`:
```yaml
extends:
  - "acme-corp/hipaa-governance-v2"
```

---

## Consumer Changes

| Consumer | Current | After |
|----------|---------|-------|
| `config-loader.ts` | Reads `policy.json` | Reads `flint.config.yaml` (YAML parser), falls back to JSON |
| `agentPolicy.ts` | Reads `agent-policy.json`, file watcher | Reads `trust` section from unified config |
| `agentEscalation.ts` | Reads `escalation-rules.json` | Reads `trust.escalation` from unified config |
| `server.ts` | `loadConfig()` → `FlintConfig` | Same interface, loader reads YAML instead |
| `sessionContext.ts` | Reads individual `.flint/` files | Unchanged (reads runtime state, not config) |
| `contextPush.ts` | Watches `context.json`, `tokens.json` | Unchanged (watches runtime state) |
| `preload.ts` IPC | `get-policy` returns `FlintPolicy` | Same shape, source is YAML |
| `packExport.ts` | Bundles 3 JSON files | Bundles `flint.config.yaml` |
| `packImport.ts` | Merges 3 JSON files | Merges single YAML file |

**Key insight:** The `FlintConfig` TypeScript interface does NOT change. Only the loader changes. All downstream consumers are unaffected.

---

## Type Definition

```typescript
// flint-mcp/src/core/config.ts — EXTENDED, not replaced

type RuleMode = 'coercive' | 'normative' | 'advisory' | 'off';
type TrustTier = 'intern' | 'junior' | 'senior' | 'principal';
type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
type Operator = { gt?: number; gte?: number; lt?: number; lte?: number; eq?: number; ne?: number };

export interface FlintProjectConfig {
  schema_version?: string;
  project: string;
  domain?: GovernanceDomain;
  classification?: DataClassification;
  labels?: Record<string, string>;

  extends?: string[];
  tighten_only?: boolean;            // default: true

  tokens?: {
    source?: string;
    library?: 'auto' | 'primeng' | 'shadcn' | 'mui' | 'tailwind' | 'none';
    figma?: {
      file_key?: string | null;
      component_library?: string | null;
      icon_library?: string | null;
    };
  };

  rules?: {
    mithril?: {
      mode?: RuleMode;
      delta_e?: number;
      delta_e_critical?: number;
      ignore?: string[];
    };
    accessibility?: {
      level?: 'A' | 'AA' | 'AAA';
      mode?: RuleMode;
      disabled?: string[];
    };
    export_gate?: {
      block_on?: RuleMode;           // Block when violations of this mode exist
      warn_on?: RuleMode;            // Warn for violations of this mode
      block_on_overrides?: boolean;
    };
    baseline?: { enabled?: boolean };
    policies?: PolicyRef[];
  };

  scoring?: {
    weights?: {
      coercive?: number;
      normative?: number;
      advisory?: number;
      recency?: number;
    };
    presets?: Record<string, ScoringWeights>;
  };

  trust?: {
    default_tier?: TrustTier;
    allow_demotion?: boolean;
    profiles?: AgentProfile[];
    approval?: ApprovalGate[];
    escalation?: EscalationRule[];
    promotion?: PromotionGates;
  };

  enforcement?: {
    decision_points?: string[];
    points?: Record<string, EnforcementPoint>;
  };

  review?: {
    consensus?: boolean | ConsensusConfig;
  };

  content?: {
    style_guide?: string | null;
  };

  audit?: {
    retention?: string;
    export?: string[];
  };

  environments?: Record<string, DeepPartial<FlintProjectConfig>>;
}

interface PolicyRef {
  ref: string;                       // e.g. "flint/wcag-aa-v2"
  required?: boolean;                // default: true
  description?: string;
}

interface ApprovalGate {
  condition: Record<string, Operator>;
  action: 'require_approval' | 'auto_approve' | 'escalate';
  message?: string;
}

interface PromotionGates {
  clean_sessions?: number;
  security_validation?: boolean;
  governance_signoff?: boolean;
}

// Resolved config maps 1:1 to existing FlintConfig + AgentPolicyFile
// No downstream interface changes required.
```

---

## What This Enables

1. **One-line governance:** `extends: ["@flint/healthcare"]` — HIPAA compliance in one line.
2. **Tighten-only composition:** Teams layer overrides without accidentally weakening parent rules. Inheritance is safe by default.
3. **Three-mode rule semantics:** `coercive` blocks export. `normative` auto-fixes. `advisory` informs. Clearer than binary blocking/advisory.
4. **Named trust tiers:** intern → junior → senior → principal. Intuitive progression, earned autonomy, automatic demotion.
5. **Conditional approval gates:** Risk-based approval with operator conditions. High-risk mutations require approval; low-risk auto-approve.
6. **Environment overlays:** Advisory in dev, blocking in CI, elevated agents in staging. One config, many contexts.
7. **Config IS the pack:** Share governance by sharing one YAML file. Install a pack with one line.
8. **Data classification:** `restricted` components get tighter thresholds. Policy binding by classification level.
9. **Domain-tunable scoring:** Healthcare weighs coercive violations at 0.95; consumer apps at 0.7. Customizable per project.
10. **PDP/PEP clarity:** Explicit separation of where rules are evaluated vs. where they're enforced.
11. **DTCG v2025.10 alignment:** Token source references the stable W3C standard.
12. **Zero-config start:** `project: My App` is a valid config. Everything else has sensible defaults.

---

## Migration Path

### Automatic

```bash
# New MCP tool: generates flint.config.yaml from existing JSON files
flint_migrate_config --project-root .
```

Reads all three JSON files, merges into YAML, writes `flint.config.yaml`, renames legacy files to `*.json.bak`.

### Mode Mapping

| Legacy `mode` | New `mode` | Rationale |
|---------------|-----------|-----------|
| `blocking` | `coercive` | Same behavior: blocks export, no override |
| `advisory` | `advisory` | Same behavior: informational only |
| *(no equivalent)* | `normative` | New middle ground: warns, auto-fixable, overridable |
| `off` | `off` | Same behavior |

### Trust Tier Mapping

| Legacy tier | New tier | Both accepted during migration |
|-------------|---------|-------------------------------|
| `untrusted` | `intern` | Yes |
| `standard` | `junior` | Yes |
| `elevated` | `senior` | Yes |
| `admin` | `principal` | Yes |

### Backward Compatibility Timeline

| Phase | Behavior |
|-------|----------|
| v7.3 | YAML supported, JSON still works, deprecation notice logged |
| v8.0 | YAML is default for new projects, JSON still supported |
| v9.0 | JSON support removed, migration tool auto-runs on first load |

---

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| **UCFG.1** | YAML parser + loader + type definitions + fallback to JSON + mode mapping | 1 session |
| **UCFG.2** | `extends` resolution (local files + bundled presets) + tighten-only enforcement | 1 session |
| **UCFG.3** | Environment overlays (`FLINT_ENV`) + three-mode rule taxonomy | 1 session |
| **UCFG.4** | `flint_migrate_config` MCP tool + trust tier renaming | 0.5 session |
| **UCFG.5** | Conditional approval gates + scoring weights + data classification | 1 session |
| **UCFG.6** | Official presets (`@flint/healthcare`, etc.) + GPX pack format migration | 1.5 sessions |

Total: ~6 sessions. No breaking changes at any phase.
