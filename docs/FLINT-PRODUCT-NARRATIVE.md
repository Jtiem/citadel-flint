# Flint — The Governance Layer for AI-Generated Code

## The Problem Nobody Talks About

AI agents write code faster than any human. Claude, Cursor, Copilot — they can scaffold an entire UI in seconds. But speed without standards is chaos.

Here's what happens when an AI agent builds your product's interface:

- It picks colors that are *close* to your brand, but not exact. Off by 3% on every shade.
- It generates buttons that look correct but are invisible to screen readers.
- It creates components that pass type checks but violate your design system's spacing rules.
- It writes code that works today but drifts further from your standards with every iteration.

No one catches these problems until a designer reviews the output, or a compliance audit flags them, or a user with a disability can't navigate your product. By then, the damage is compounded across hundreds of AI-generated components.

**Flint exists to make this problem structurally impossible.**

---

## What Flint Does

Flint is the governance infrastructure layer that sits between AI agents and your production codebase. It enforces your design system, accessibility standards, and brand compliance *deterministically* — before code ships.

Think of it this way: AI agents are the engine. Flint is the guardrails.

### Three guarantees Flint provides:

**1. Every color, every font, every spacing value is verified against your design system.**

Flint doesn't guess. It uses perceptual color science (CIEDE2000 Delta-E) to measure the actual visual distance between what the AI generated and what your design system specifies. A human eye can't detect a difference below Delta-E 2.0 — but Flint can. If a color drifts beyond your threshold, the code is flagged before it reaches production.

**2. Accessibility is enforced as a build-time constraint, not a post-launch audit.**

Flint checks 50 WCAG 2.1 AA rules — from missing alt text to keyboard navigation to live region announcements — every time code is generated. Accessibility violations block export. Your team never ships inaccessible UI because the system won't allow it.

**3. AI agents operate within defined permission boundaries.**

Not all AI agents should have the same capabilities. Flint's agent governance system assigns trust tiers to each agent, controls which operations they can perform, and escalates high-risk mutations for human review. A junior agent proposing to delete a component triggers a different review flow than a trusted agent updating a text label.

---

## How It Works (Without the Technical Details)

### The Governance Engine

At its core, Flint is a headless engine that reads your code at the structural level — not as text, but as a tree of components, properties, and relationships. When an AI agent proposes a change, Flint evaluates it against your rules before the change takes effect.

This evaluation is deterministic. The same input always produces the same verdict. There's no AI in the governance layer itself — it's pure logic applied to your standards.

### The Observability Layer

Flint Glass is a desktop application that gives you a visual window into your governance state. It shows you:

- Which components comply with your design system and which don't
- What the AI agent is proposing to change, with a risk assessment
- Your project's overall design health score (A through F)
- Which accessibility rules are being violated and where

Glass is read-only by design. It observes and reports — it doesn't edit your code. Your IDE (Claude Code, Cursor, VS Code) remains your editing environment. Flint watches from the side and ensures nothing ships that shouldn't.

### The Risk Scoring System

Every mutation an AI agent proposes receives a Mutation Risk Score (MRS). Simple changes — updating a text label, adjusting a class — score low and can proceed automatically. Structural changes — inserting new components, wrapping elements, deleting nodes — score higher and require human review.

For the highest-risk mutations, Flint employs a Multi-Agent Consensus Gate: an independent secondary evaluator assesses the proposed change *without seeing the original agent's reasoning*. This prevents confirmation bias. If the two evaluators disagree, the mutation is flagged for manual review.

---

## Built for Every Domain

Flint understands that governance isn't one-size-fits-all. A healthcare application has different compliance requirements than an e-commerce storefront.

### Domain Profiles

| Domain | What Flint enforces |
|--------|-------------------|
| **Healthcare** | Strict color fidelity (patients depend on accurate color coding), AAA accessibility, AI agents default to read-only |
| **Financial Services** | Immutable audit trail for every mutation, elevated agent approval required for financial UI components |
| **Government** | WCAG 2.1 AA minimum with Section 508 supplements, all exports require accessibility sign-off |
| **E-commerce** | Brand color precision, conversion-critical component protection, relaxed agent permissions for rapid iteration |
| **Enterprise SaaS** | Design system token enforcement, multi-brand theme validation, cross-team consistency |
| **General** | Baseline governance with configurable strictness — suitable for startups and small teams |

Each domain profile adjusts thresholds, rule severity, and agent permissions to match the regulatory and quality standards of that industry.

---

## Cross-Platform Design Tokens

Your design system shouldn't stop at the web. Flint's token sync engine takes your design tokens and generates native implementations for every platform your team targets:

- **Web:** Tailwind CSS theme config and CSS custom properties
- **iOS:** Swift UIColor extensions with precise RGB values
- **Android:** Kotlin Compose Color objects with correct ARGB encoding
- **React Native:** TypeScript constants with proper dimension conversion

One source of truth. Five platform outputs. A cross-platform audit verifies that every color, spacing value, and typography token is consistent across all targets — flagging any platform where a token is missing or divergent.

---

## Governance Packs: Share Standards, Not Just Components

This is where Flint's value multiplies across your organization.

A Governance Pack is a portable bundle of your governance configuration — your rules, your agent permissions, your domain-specific policies, your CLAUDE.md instructions — packaged into a single artifact that any project can import.

### How teams use Governance Packs

**The compliance officer** configures Flint for a healthcare project: strict color fidelity, AAA accessibility, agents restricted to read-only unless manually approved. They export this as the `HIPAA Governance Pack`.

**A new project starts.** Instead of spending hours re-configuring governance from scratch, the team imports the HIPAA pack. In seconds, the new project inherits every rule, every agent permission, every threshold that was battle-tested on the original project.

**Conflicts are detected automatically.** If the new project already has governance settings that contradict the pack — say, AA accessibility when the pack requires AAA — Flint surfaces the conflict and lets the team decide: accept the pack's stricter standard, keep the current setting, or review each conflict individually.

**Nothing is irreversible.** Before applying any pack, Flint snapshots your current configuration. If something goes wrong, a single rollback command restores everything to its pre-import state.

### What makes Governance Packs secure

Packs are scanned for secrets before export — API keys, credentials, private tokens, and absolute file paths are all detected and blocked. Community packs cannot escalate agent permissions beyond standard trust levels. Your governance configuration is portable but never compromised.

### Example packs

- **ACME Brand Pack** — Company-specific color thresholds, approved agent list, brand-aligned CLAUDE.md instructions
- **HIPAA Healthcare Pack** — AAA accessibility, strict Delta-E, read-only agents by default
- **SOX Financial Pack** — Full mutation audit trail, elevated approval for financial components
- **Section 508 Government Pack** — WCAG 2.1 AA + Section 508 supplements, mandatory accessibility sign-off
- **Startup Fast-Move Pack** — Relaxed rules, full agent permissions, minimum viable governance

---

## The Audit Trail

Every action Flint takes is recorded. Every mutation an AI agent proposes, every governance decision, every override, every pack import — it's all in the provenance ledger.

This isn't just logging. It's a complete chain of custody for your AI-generated code:

- **Who** proposed the change (which agent, which session)
- **What** was proposed (the exact mutation)
- **How risky** it was scored (the MRS assessment with factor breakdown)
- **Whether** a second opinion was sought (consensus gate outcome)
- **What** the governance verdict was (approved, flagged, blocked)

For regulated industries, this audit trail is the difference between "we think our AI-generated code is compliant" and "we can prove it."

---

## Design Bill of Materials

Flint can generate a complete inventory of every design decision in your project — every token used, every component instantiated, every accessibility rule evaluated. This Design Bill of Materials (DBOM) is exportable in standard formats including CycloneDX, making it compatible with existing supply chain security workflows.

For enterprise procurement and compliance teams, the DBOM answers: "What exactly is in this UI, and does it meet our standards?"

---

## The Bottom Line

AI agents are going to write most of your UI code. That's not a prediction — it's already happening.

The question isn't whether to use AI for UI development. The question is whether you can trust the output. Flint makes the answer yes — not through hope, not through manual review, but through deterministic enforcement of the standards you've already defined.

Your design system. Your accessibility requirements. Your brand rules. Your agent permissions. Enforced automatically, audited completely, portable across every project.

That's what Flint does.
