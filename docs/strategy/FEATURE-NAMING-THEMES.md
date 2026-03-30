# Flint Feature Names — The Citadel

> **Status: LOCKED IN** (2026-03-27)
> Theme: The Citadel — Flint is the fortress. Every feature is a layer of defense or a builder within the walls.

## The Citadel

*"Every wall. Every gate. Every guard."*

### Foundation

| Name | Feature | What it does |
|------|---------|-------------|
| **Flint** | The product | Governance infrastructure for AI-generated UI code |
| **Glass** | Observability layer | Visual read-only layer (Electron app) — transparent, you see through to the truth |

### Defense (Governance)

| Name | Feature | One-liner |
|------|---------|-----------|
| **Mithril** | Perceptual linter | CIEDE2000 color drift, typography, spacing, shadow, opacity |
| **Warden** | A11y linter | 50 WCAG 2.1 AA rules — the jailer who ensures compliance |
| **Ghost** | Hardcoded class detection | Phantom patrol — sees what hides in your classNames |
| **Shield** | Spatial governance badges | Heraldry on the canvas — visible defense status per node |
| **Gate** | Export gate | Nothing ships unchecked — blocks while violations remain |
| **Sentry** | Risk scoring | Evaluates threat level — 5-factor weighted MRS (0-100) |
| **Flare** | Anomaly detection | Signal fire — 3-sigma statistical anomaly on mutations/overrides |
| **Proof** | Snippet validator | Tests the gold before it's stamped — Babel parse + type check |
| **Ledger** | Governance event log | The castle's official book of record — every event, every action |
| **Stamp** | Provenance tracking | Certifies origin and lineage — who changed what, when, from where |
| **Manifest** | Design Bill of Materials | The census — token/component/violation inventory (JSON/CycloneDX) |

### Creation (D2C Pipeline)

| Name | Feature | One-liner |
|------|---------|-----------|
| **Mason** | JSX transformer | Builds the walls from raw quarry stone — Figma JSX to library components |
| **Sage** | AI refinement | The wise advisor — Sonnet improves scaffold, never overrides (opt-in) |
| **Oracle** | AI classification | The seer — Haiku identifies what each component truly is |
| **Cipher** | CSS variable resolver | Decodes the designer's sealed message — `var(--name)` to semantic class |
| **Scout** | Token extraction | Rides out to map the territory — discovers tokens with approval gateway |
| **Decoy** | Component shims | Garrison mannequins — look real in preview, weigh nothing |
| **Envoy** | Token sync (Figma) | Diplomatic messenger — push/pull tokens between Figma and code |
| **Bridge** | Code Connect | The connection between Figma's castle and yours |
| **Armory** | Component registry | The collection of known patterns — search, match, constrain |
| **Mint** | Token experience | Where tokens are forged, verified, and certified for circulation |

### Infrastructure

| Name | Feature | One-liner |
|------|---------|-----------|
| **Beacon** | Context sync | Signal fires between towers — Glass writes state every 200ms |
| **Rewind** | Undo/recovery | Reverses a judgment — Git Time Machine + AST inversions |
| **Alliance** | OAuth flow | The treaty between kingdoms — one-click Figma connection |
| **Garrison** | Setup wizard | Establishing initial defenses — IDE detection, MCP config, connection test |
| **Forge** | Project initiation | Where new projects are ignited — environment detected, governance activated |
| **Counsel** | Governance experience | Where governance advises rather than judges — triage, deferral, intelligence surface |

## Usage Guidelines

### Where names appear
- **User-facing UI text**: StatusBar, panel headers, notifications, tooltips
- **Agent prompts**: MCP tool descriptions, workflow guides, sentinel persona
- **Documentation**: CLAUDE.md, HANDOFF.md, strategy docs, README
- **Conversation**: "Mithril flagged 3 drifts", "Gate blocked export", "Mason produced 5 components"

### Where names do NOT appear
- **File names**: `GovernanceOverlay.tsx` stays — renaming files is churn
- **Function names**: `classifyComponent()` stays — code reads better with descriptive names
- **IPC channels**: `ast:applyBatch` stays — protocol names are for machines
- **Test descriptions**: use descriptive test names, not branded names

### Examples in conversation

```
"Mithril found 3 color drifts — 2 within ΔE threshold, 1 needs manual review."

"Gate is blocking export: 2 Warden violations (missing aria-label on input,
missing alt text on image). Say 'fix it' to auto-remediate."

"Mason produced 5 components from the Figma design. Cipher resolved 18
CSS variables directly. Scout proposed 6 new tokens for your approval."

"Oracle classified the Input and Select components. Sage refined the Card
layout — CardHeader/CardContent/CardFooter split applied."

"Flare detected an anomaly: 47 mutations in the last hour vs baseline of 12.
Sentry risk score elevated to Amber."
```

## Quick Reference Card

```
THE CITADEL — "Every wall. Every gate. Every guard."

DEFENSE                          CREATION
  Mithril  — perceptual lint       Mason   — JSX transform
  Warden   — a11y lint             Sage    — AI refinement
  Ghost    — hardcoded detection   Oracle  — AI classification
  Shield   — spatial badges        Cipher  — CSS var resolver
  Gate     — export gate           Scout   — token extraction
  Sentry   — risk scoring          Decoy   — component shims
  Flare    — anomaly detection     Envoy   — token sync
  Proof    — snippet validator     Bridge  — Code Connect
  Ledger   — governance log        Armory  — component registry
  Stamp    — provenance
  Manifest — DBOM

FOUNDATION
  Flint    — the product     Beacon   — context sync
  Glass    — observability   Rewind   — undo/recovery
                             Alliance — OAuth flow
                             Garrison — setup wizard
```
