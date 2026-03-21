# Strategic Moat — [Project Name]

> This document defines the 2-3 strategic advantages that make this project defensible.
> Every proposed feature must deepen at least one moat. If it doesn't, it's out of scope.

---

## Moat 1: [Name]

**What it is:** [One sentence describing the structural advantage]

**Why it's defensible:** [Why competitors can't easily replicate this]

**Depth test:** Before building any feature, ask: "Does this make Moat 1 deeper?"
- If yes → proceed to architecture review
- If no → check Moat 2 and 3
- If none → reject or defer

**Current depth indicators:**
- [ ] [Metric 1]
- [ ] [Metric 2]

---

## Moat 2: [Name]

**What it is:** [One sentence]

**Why it's defensible:** [Why competitors can't replicate]

**Depth test:** "Does this make Moat 2 deeper?"

**Current depth indicators:**
- [ ] [Metric 1]
- [ ] [Metric 2]

---

## Moat 3: [Name]

**What it is:** [One sentence]

**Why it's defensible:** [Why competitors can't replicate]

**Depth test:** "Does this make Moat 3 deeper?"

**Current depth indicators:**
- [ ] [Metric 1]
- [ ] [Metric 2]

---

## Feature Filter

When evaluating any feature proposal:

1. **Does it deepen a moat?** → Which one? How?
2. **Does it create a new moat?** → Justify why this is strategically necessary
3. **Does it deepen no moat?** → Reject unless it's pure maintenance/infrastructure

This filter prevents feature creep by tying every decision to strategic defensibility.

---

## Example (from Flint)

**Moat 1: Determinism** — AST-driven mutation (not LLM guessing). Same input always produces same output. Compliance-grade reproducibility.

**Moat 2: Governance** — Mithril safety layer + a11y as compiler error. The only tool that blocks AI-generated code from shipping if it violates design system or accessibility rules.

**Moat 3: Ecosystem Agnostic** — Headless MCP server works inside any IDE. Not locked to one editor, one framework, or one AI provider.
