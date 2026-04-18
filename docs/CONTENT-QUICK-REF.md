# Flint — Content Quick Reference Card

> **Print this. Pin it. Keep it open.**
> Everything you need to answer "What is Flint?" in any context.

---

## The One-Liner

**Flint is the governance infrastructure layer that makes AI-generated UI code safe to ship.**

---

## 30-Second Elevator Pitch

> AI agents are writing 41% of all code today — headed toward 90% by early 2027. But nobody is checking whether that code matches the design system, passes accessibility standards, or preserves brand integrity.
>
> Flint is the governance layer that sits inside the AI generation loop. Using perceptual color science and AST-level code analysis, Flint catches design drift, enforces WCAG compliance, and blocks non-compliant code from shipping — deterministically, not probabilistically.
>
> It's the type checker for design systems.

---

## Three Guarantees

| # | Guarantee | How |
|---|-----------|-----|
| 1 | **Every visual value verified** — colors, fonts, spacing | CIEDE2000 perceptual color science (ΔE < 2.0 = undetectable by human eye) |
| 2 | **Accessibility enforced at build time** | 50 WCAG 2.1 AA rules block export on violation |
| 3 | **AI agents operate in permission boundaries** | 4 trust tiers + risk scoring + human review for high-risk changes |

---

## Audience Matrix

| Audience | What they care about | Lead with |
|----------|---------------------|-----------|
| **Developers** | Speed, DX, integration | "Install in 2 minutes. 3 lines of config. Say 'audit my component.'" |
| **Designers** | Output quality, brand fidelity | "Verify AI-generated code matches your design system before it ships." |
| **Team Leads** | Consistency, measurability | "One governance standard. Designers verify in Glass. Devs get inline feedback. CI blocks violations." |
| **Compliance** | Auditability, proof | "Complete chain of custody for AI-generated code. Deterministic verdicts." |
| **Investors** | Market size, moat, model | "The Snyk model ($8.5B) applied to design compliance. Same architecture, adjacent market." |

---

## Five Approved Analogies

1. 🏆 **"TypeScript for design systems"** — Strongest. Use for developers.
2. 💰 **"Snyk for design compliance"** — Use for investors.
3. 📝 **"Spell-check vs. legal contract reviewer"** — Use vs. ESLint.
4. 🎯 **"Catches #3B82F5 when your brand uses #3B82F6"** — Use for specificity.
5. 📚 **"AI writes the code. Flint checks the homework."** — Use for general audiences.

---

## Key Stats (Verified)

### Market
| Stat | Value |
|------|-------|
| AI code share (2025) | **41%** of all code |
| AI code share (2027) | **90%** projected |
| ADA lawsuits (2025) | **5,114** filed |
| EU Accessibility Act fines | Up to **EUR 3M** |
| MCP ecosystem | **6,400+** servers |
| AI code quality issues | **1.7x** more than human code |

### Product
| Stat | Value |
|------|-------|
| MCP tools | **54** |
| WCAG rules | **50** (9 modules) |
| Rule packs | **10** (64 rules) |
| Trust tiers | **4** |
| Token output platforms | **5** (Tailwind, CSS, RN, Swift, Kotlin) |
| Test cases | **800+** |

---

## The Category

✅ **AI code quality infrastructure**

❌ ~~AI governance~~ (political baggage)
❌ ~~Design tool~~ (sounds niche)
❌ ~~Developer tool~~ (saturated)
❌ ~~AI Operating System~~ (retired branding)

---

## Architecture in One Sentence

**Flint MCP** is the headless governance engine (runs anywhere).
**Flint Glass** is the visual observability layer (shows the results).
MCP does all the work. Glass shows the truth. They ship independently.

---

## The Competitive Edge (One-Liner per Competitor)

| vs. | Our edge |
|-----|----------|
| **axe-core** | Checks after render. Flint checks during generation. |
| **SonarQube** | Spell-check vs. legal contract reviewer. |
| **Chromatic** | Pixel diff vs. perceptual color science. |
| **ESLint** | Can't do CIEDE2000, JSX semantics, or MCP agent loops. |
| **Figma** | Single-platform. Flint is tool-agnostic. |

---

> **Source docs:** [Content Bible](docs/strategy/CONTENT-BIBLE.md) · [Product Narrative](docs/FLINT-PRODUCT-NARRATIVE.md) · [Investor Brief](docs/strategy/INVESTOR-BRIEF-2026.md) · [Feature Names](docs/strategy/FEATURE-NAMING-THEMES.md)
