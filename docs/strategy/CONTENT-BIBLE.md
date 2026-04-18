# Flint Content Bible

> **Status:** ACTIVE — Single source of truth for all content work
> **Last Updated:** 2026-04-16
> **Owner:** Content Team

This document is the authoritative reference for anyone creating content about Flint — marketing copy, blog posts, documentation, social media, investor materials, or internal communications. When in doubt, this document wins.

---

## 1. Voice & Tone

### The Flint Voice

Flint sounds like a senior engineer who also happens to be a great communicator. We are:

| We Are | We Are Not |
|--------|------------|
| **Confident** — We know what we built and why it matters | **Arrogant** — We don't trash competitors or claim exclusivity |
| **Technical** — We use precise language and real terminology | **Jargon-heavy** — We explain terms; we don't gatekeep |
| **Urgent** — The problem is real and growing | **Fearful** — We present facts, not FUD |
| **Specific** — We cite numbers, name algorithms, show examples | **Vague** — "Advanced" and "powerful" are banned words |
| **Builder energy** — We help you ship with confidence | **Gatekeeper energy** — We're not here to slow you down |

### Tone Adjustments by Audience

| Audience | Tone Shift |
|----------|-----------|
| **Developers** | More technical, show code examples, emphasize DX and integration speed |
| **Designers** | More visual, emphasize confidence in output quality, less code |
| **Team Leads** | Emphasize consistency across team, measurability, and compliance |
| **Compliance Officers** | Lead with regulatory data, audit trails, deterministic guarantees |
| **Investors** | Lead with market size, competitive moat, and category creation |
| **General Public** | Lead with the problem ("AI writes code, but who checks it?"), minimal technical detail |

---

## 2. Messaging Hierarchy

### Primary Message
**AI agents write your UI code. Flint makes sure it's correct.**

### Supporting Messages (in priority order)

1. **Design system enforcement is now automated.** Every color, font, and spacing value is verified against your tokens using perceptual color science — not pixel-diffing, not eyeballing.

2. **Accessibility becomes a build-time constraint.** 50 WCAG 2.1 AA rules checked on every generation. Violations block shipping. Your team never deploys inaccessible UI because the system won't allow it.

3. **AI agents earn trust through behavior.** Not all agents should have the same permissions. Flint assigns trust tiers, scores mutation risk, and escalates high-risk changes for human review.

4. **Governance is deterministic.** The same code always produces the same verdict. No AI in the governance layer — pure logic applied to your standards. Required for compliance.

5. **One engine, every surface.** Flint MCP runs in Claude Code, Cursor, VS Code, and CI/CD. Same rules everywhere. No configuration drift between environments.

### Proof Points

Each supporting message has verified proof points:

| Message | Proof Point |
|---------|------------|
| Design system enforcement | CIEDE2000 Delta-E color science; human eye can't detect ΔE < 2.0, Flint can |
| Accessibility as build constraint | 50 WCAG 2.1 AA rules, 9 rule modules (names-labels, keyboard, structure, aria, landmarks, contrast, forms, live-regions, motion) |
| Agent trust | 4 trust tiers (restricted → standard → elevated → admin), 5-factor Mutation Risk Score (0-100) |
| Deterministic | Babel AST traversal, not regex or LLM-based; same input = same output every time |
| One engine everywhere | MCP protocol — 6,400+ servers in ecosystem, adopted by every major AI platform |

---

## 3. Audience-Specific Messaging

### For Developers

**Key concern:** "Will this slow me down?"

**Lead with:**
> Install in 2 minutes. Add 3 lines to your MCP config. Every time an AI agent writes UI code, Flint checks it against your design system and accessibility rules. Say "audit my component" — done.

**Emphasize:**
- Zero-config MCP integration
- Inline diagnostics in VS Code/Cursor
- CI/CD gate with SARIF output
- Auto-fix for token violations (not just warnings)
- The 16 Commandments (nerdy, resonates with engineering culture)

**Avoid:**
- Talking about "design" or "designers" as the primary audience
- Over-emphasizing Glass (developers care about the engine)

---

### For Designers

**Key concern:** "Can I trust what the AI built?"

**Lead with:**
> Generate frontend code with AI, then verify it matches your design system before it ships. Flint catches what AI gets wrong — colors, accessibility, spacing — so you can ship with confidence.

**Emphasize:**
- Visual health score (A-F grade)
- One-click auto-fix for violations
- Figma token sync (your design system stays connected)
- The Export Gate (nothing ships unchecked)
- Glass as the "window into your code's health"

**Avoid:**
- Technical details about AST, Babel, or MCP protocol
- Code examples
- CI/CD integration details

---

### For Team Leads / Design System Maintainers

**Key concern:** "How do I enforce consistency across the whole team?"

**Lead with:**
> One governance standard across your entire organization. Designers verify in Glass. Developers get inline feedback. CI blocks violations. Same rules everywhere.

**Emphasize:**
- Governance Packs (portable rule bundles across projects)
- Design debt scoring (A-F grade, trend tracking)
- Override telemetry (who bypassed what, and when)
- Multi-brand theme validation
- Cross-platform token sync (web, iOS, Android, React Native)

---

### For Compliance Officers

**Key concern:** "Can we prove compliance?"

**Lead with:**
> Every action is recorded. Every mutation scored. Every governance decision logged. The complete chain of custody for your AI-generated code — who proposed it, what was proposed, how risky it was, and what the verdict was.

**Emphasize:**
- Deterministic (same input = same output, required for compliance)
- 5,100+ ADA lawsuits/year, EU Accessibility Act EUR 3M fines
- Design Bill of Materials (DBOM) in CycloneDX format
- SARIF output for audit trail integration
- Domain profiles: Healthcare, Financial, Government

---

### For Investors

**Key concern:** "Is this a feature or a company?"

**Lead with:**
> AI is writing 41% of code today — headed to 90% by early 2027. But nobody checks whether that code matches the design system, passes accessibility, or preserves brand integrity. Flint is the governance layer that sits inside the AI generation loop.

**Use the 5 Headline Narratives** (see Section 4 below).

---

## 4. The Narrative Arsenal

Five battle-tested narratives. Use the one that matches your audience and context.

### Narrative 1: "The Type Checker for Design Systems" ★ STRONGEST LEAD

**When to use:** Developer audiences, engineering blog posts, technical landing pages, HN/Reddit

**The pitch:**
> Every engineer understands what TypeScript did: turned runtime errors into compile-time errors. Flint does the same for design compliance. "Wrong blue in production" becomes "wrong blue blocked before commit."

**Why it works:** Instant comprehension for anyone who's used TypeScript. Maps a known concept to Flint's value.

---

### Narrative 2: "AI Generates Code. Flint Governs It."

**When to use:** General marketing, social media, conference talks, broad audience

**The pitch:**
> Every dollar invested in Cursor, Copilot, v0, and Claude Code increases the need for governance. Flint is the picks-and-shovels play for the AI code generation gold rush.

**Why it works:** Positions Flint as the inevitable complement to AI code generation. TAM grows as AI adoption grows.

---

### Narrative 3: "The Missing Safety Layer for AI-Generated UI"

**When to use:** Compliance-focused audiences, healthcare/fintech, enterprise procurement

**The pitch:**
> Who is responsible when AI-generated UI violates ADA or the EU Accessibility Act? With 5,100+ lawsuits per year and EUR 3M fines, Flint is the answer.

**Why it works:** Fear-based but factual. Resonates with anyone who has compliance responsibility.

---

### Narrative 4: "Design Debt is the Next Technical Debt"

**When to use:** Design system conferences, design leadership, category-creation content

**The pitch:**
> Technical debt has SonarQube. Design debt has nothing. Flint's HealthScore (0-100, grade A-F) makes design debt visible, measurable, and actionable for the first time.

**Why it works:** Creates a new category. Positions Flint as the first mover.

---

### Narrative 5: "The Snyk for Design Compliance"

**When to use:** Investor pitches, analyst briefings, comp-based positioning

**The pitch:**
> Snyk proved deterministic AST scanning + CI/CD blocking = multi-billion-dollar business ($8.5B valuation). Flint applies the identical pattern to design/accessibility compliance. Same architecture, adjacent market, proven model.

**Why it works:** De-risks the business model by pointing to a proven comp. Investors immediately understand the playbook.

---

## 5. Competitive Positioning

### The Matrix

| Tool | Tokens | AST Gov | WCAG Gate | Figma | MCP | Deterministic | Color Science |
|------|--------|---------|-----------|-------|-----|---------------|---------------|
| **Flint** | **Full** | **Full** | **Yes** | **Full** | **Yes** | **Yes** | **CIEDE2000** |
| Knapsack | Docs | None | None | Docs | No | N/A | None |
| Supernova | Files | None | None | Import | No | N/A | None |
| Chromatic | None | None | None | None | No | N/A | Pixel diff |
| SonarQube | None | Generic | None | None | No | Yes | None |
| Snyk Code | None | Security | CI block | None | No | Yes | None |
| axe-core | None | DOM | Post-render | None | No | Yes | None |
| Figma Dev Mode | Ref | None | None | Read | No | N/A | None |

### How to Talk About Competitors

| Competitor | What to say | What NOT to say |
|-----------|------------|-----------------|
| **axe-core** | "axe-core checks accessibility *after* rendering. Flint checks *during* generation — shift-left by an entire phase." | Don't trash axe-core — it's respected. Position as complementary at a different stage. |
| **SonarQube** | "SonarQube is spell-check. Flint is a legal contract reviewer. Different depth, different domain." | Don't claim Flint replaces SonarQube — it doesn't do security scanning. |
| **Chromatic** | "Chromatic uses pixel diffing. Flint uses perceptual color science (CIEDE2000). One detects rounding errors. The other detects brand violations." | Don't position against visual regression testing broadly — it's a valid use case. |
| **Figma** | "Figma optimizes for keeping designers in Figma. Flint works across all tools — structurally impossible for a single-platform vendor." | Don't position against Figma — many users will use both. |
| **ESLint** | "ESLint can't calculate CIEDE2000 color distance, traverse JSX semantics, or participate in MCP agent loops." | Don't claim Flint replaces ESLint — it's complementary. |

---

## 6. Verified Statistics

### Market Data (Sources in `docs/strategy/INVESTOR-BRIEF-2026.md`)

| Stat | Value | Source |
|------|-------|--------|
| AI-generated code share (2025) | 41% of all code | Multiple sources |
| AI-generated code share (2027 projected) | 90% | Vocal Media |
| AI code quality issues multiplier | 1.7x more issues than human code | Second Talent |
| AI code security vulnerabilities | 48% contain vulnerabilities | Second Talent |
| ADA lawsuits (2025) | 5,114 filed | UsableNet |
| ADA lawsuit growth | 37% YoY increase | EcomBack |
| EU Accessibility Act fines | Up to EUR 3M | Level Access |
| MCP servers registered | 6,400+ | CData |
| AI code generation market | $4.91B (2024) → $30.1B (2032) | NetCorp |
| Design system compliance gap | 80% have systems, 30% sustain compliance | Industry research |

### Product Metrics (Verify against `CLAUDE.md`)

| Metric | Value | Notes |
|--------|-------|-------|
| MCP tools | 54 registered | Headless governance engine |
| MCP resources | 13 | Live state exposure |
| WCAG 2.1 AA rules | 50 | 9 rule modules |
| Mithril rule categories | 5 | Color, typography, spacing, shadow, opacity |
| Governance rule packs | 10 packs, 64 rules | Domain/jurisdiction grouping |
| Test cases | 800+ | Across MCP engine + Glass + integration |
| Production modules | 80+ | All status: ONLINE |
| Trust tiers | 4 | restricted → standard → elevated → admin |
| Cross-platform token output | 5 targets | Tailwind, CSS, React Native, Swift, Kotlin |

> **⚠️ Always verify product metrics against `CLAUDE.md` before publishing.** Module counts change with each sprint.

---

## 7. Words We Use / Words We Don't

### Use These

| Word/Phrase | Why |
|------------|-----|
| **Governance infrastructure** | Accurate, differentiated |
| **AI code quality** | Clear category |
| **Deterministic** | Core differentiator |
| **Shift-left** | Engineers understand this instantly |
| **Perceptual color science** | Impressive and accurate |
| **Design system enforcement** | Action-oriented |
| **Build-time constraint** | Makes accessibility concrete |
| **Trust tiers** | More intuitive than "agent permissions" |
| **Health score** | Universal, non-threatening metric |

### Don't Use These

| Word/Phrase | Why | Use Instead |
|------------|-----|-------------|
| **AI governance** | Political baggage, sounds regulatory | AI code quality infrastructure |
| **AI Operating System** | Retired branding | Governance infrastructure |
| **Powerful** | Empty adjective | Be specific about what it does |
| **Advanced** | Empty adjective | Name the specific technology |
| **Revolutionary** | Hyperbolic | "Shift-left" or "first-of-its-kind" |
| **Best-in-class** | Unverifiable | Use the competitive matrix instead |
| **Seamless** | Overused, meaningless | "2-minute setup" or "3 lines of config" |
| **Enterprise-grade** | Meaningless until you have enterprises | "Production-ready" if needed |
| **Cutting-edge** | Empty | Name the specific innovation |
| **Leverage** | Corporate jargon | "Use" |

---

## 8. The Citadel in Content

Flint's internal features have Citadel names (medieval fortress theme). Here's when to use them:

### Public Marketing — Use Plain Language

| Citadel Name | Public Name | Usage |
|-------------|------------|-------|
| Mithril | Design system linter / Perceptual linter | "Flint's design system linter uses CIEDE2000 color science..." |
| Warden | Accessibility checker | "50 accessibility rules checked on every generation..." |
| Gate | Export gate | "Nothing ships until violations are resolved..." |
| Glass | Flint Glass (always branded) | "Flint Glass gives you a visual window into your code's health..." |
| Sentry | Risk scoring | "Every AI mutation receives a risk score..." |
| Mason | Design-to-code pipeline | "Import a Figma design, get governed components..." |

### Technical Documentation / Power Users — Use Citadel Names

In technical docs, blog posts targeting developers, and deep-dive content, Citadel names add personality:

> "Mithril flagged 3 color drifts — ΔE 4.2 on the primary button. Gate is blocking export until resolved. Say 'fix it' to auto-remediate."

### Rule of Thumb
- **If your reader might Google the term**, use plain language
- **If your reader is already in the product**, use Citadel names

---

## 9. Content Format Playbooks

### Blog Post Template

```
HEADLINE: [Specific claim or insight]
HOOK (2 sentences): State the problem with a specific, surprising fact
CONTEXT (1 paragraph): Why this matters now — market shift, regulatory change, AI adoption
THE PROBLEM (2-3 paragraphs): What goes wrong without Flint — be specific, use examples
THE SOLUTION (2-3 paragraphs): How Flint solves it — be specific, name technologies
PROOF (1-2 paragraphs): Data, competitive comparison, or live demo
CTA (1 sentence): Clear next step — try it, read more, watch a demo
```

### Landing Page Section Template

```
HEADLINE: [Benefit statement, 8 words or fewer]
SUBHEAD: [How it works, 1 sentence]
PROOF POINT: [Specific number or comparison]
CTA: [Action button text]
```

### Social Post Template (LinkedIn/Twitter)

```
[Surprising stat or provocative question]
[2-3 sentence explanation]
[Specific Flint capability that addresses it]
[Link or CTA]
```

### Email Subject Line Patterns

- "Your AI just shipped [specific violation type]"
- "[Number]% of AI-generated code has [specific problem]"
- "What TypeScript did for runtime errors, Flint does for [specific domain]"
- "The [audience] checklist for AI-generated code quality"

---

## 10. Approved Analogies

These analogies have been tested and work across audiences:

1. **"TypeScript for design systems"** — The strongest. Instant comprehension for engineers.
2. **"Snyk for design compliance"** — Best for investors and analysts. Points to a proven model.
3. **"Spell-check vs. legal contract reviewer"** — Differentiates from ESLint/SonarQube.
4. **"The type checker that catches #3B82F5 when your brand uses #3B82F6"** — Very specific, very memorable.
5. **"AI writes the code. Flint checks the homework."** — Simple, works for general audiences.

---

## 11. Key Objection Responses

| Objection | Response |
|-----------|----------|
| "Can't ESLint do this?" | ESLint can't calculate perceptual color distance, traverse JSX component semantics, or participate in MCP agent loops. It's spell-check vs. legal contract review. |
| "Just use axe-core" | axe-core checks accessibility after rendering in a browser. Flint checks during code generation — before the code is even written to disk. Shift-left by an entire phase. |
| "Figma will build this" | Figma optimizes for keeping designers in Figma. Flint works across every AI tool and IDE. A neutral governance layer is structurally impossible for a single-platform vendor. |
| "We just review PRs" | With AI writing 41% of code and headed to 90%, manual PR review doesn't scale. You need automated, deterministic enforcement. |
| "Our design system is already enforced" | Is it enforced in AI-generated code? When Claude generates a component, does it check your tokens? Flint puts your standards inside the generation loop. |
| "This seems like a lot of overhead" | 3 lines of MCP config. 2-minute setup. Zero runtime overhead — Flint checks at generation time, not at build time. |
