# Flint Landing Page Copy

**Date:** 2026-04-18
**Angle:** A — "The governance layer for AI-generated UI"
**Voice:** Plain English, specific not abstract, zero marketing fluff, audience is designers and developers (not infra engineers)
**Status:** Internal copy draft — not yet public

---

## Hero

### One-line pitch

**The governance layer for AI-generated UI.**

### Subhead

Flint checks that the code your AI assistant just wrote actually matches your design system, passes accessibility, and does not invent colors that are not in your tokens. It runs deterministically, at the AST level, before the code reaches production.

### Call to action

**Primary:** Install Flint MCP → one command, works with Claude Code, Cursor, VS Code
**Secondary:** See a 90-second demo

---

## Section 1 — The problem

### AI ships UI faster than anyone can review it

Your design system took years to build. Your accessibility checklist took months. Your brand guidelines are a hundred pages of careful work.

Now a junior developer types "build me a signup form" into Cursor and gets a working component in nine seconds. The component looks right. It ships. Nobody noticed that the primary button is hex `#2662d9` instead of your token `#2563eb`. Nobody noticed the password field is missing `aria-describedby`. Nobody noticed the heading jumped from `h2` to `h4`.

Three months later your design system lead is drowning in drift. Your accessibility compliance report flags violations that were not there at the last audit. Your brand looks almost-right in a thousand small places, and almost-right is indistinguishable from wrong once it compounds.

Drift used to be a visual problem. Now it is a mathematical one. AI-generated UI is not going to slow down, and human code review cannot keep pace.

---

## Section 2 — How Flint is different

### Three things that set Flint apart

#### Deterministic

Every check runs on the code's abstract syntax tree, not on the text of the code. Same input, same diff, every time. No probabilistic "the AI thought this looked right" — Flint's rules are executable, not persuasive.

Competitors in the generator category run post-hoc autofix with statistical models. That is better than nothing, but it is not verifiable. Flint gives a design system lead something they can actually reason about: "this code either passes the rules or it does not."

#### Perceptual

Flint's color drift detector — **Mithril** — uses the CIE Delta-E 2000 formula. That is the same color-difference math the print industry and display calibration industry have used for decades. String-matching `#2563eb` against `#2662d9` would say "not equal." Delta-E says "close enough to be indistinguishable to the human eye, but 2.3 units off — and your policy blocks anything above 2.0."

That distinction matters. It is the difference between "your brand has drifted" as a vague claim and "your brand has drifted by a measurable, defensible, auditable amount."

#### Unified

Design system compliance, accessibility enforcement, and brand governance usually live in three tools from three vendors. Flint runs all three in one engine, against the same AST, on the same file, in one pass. Token drift, WCAG violation, and unregistered component reference come back in a single governance report with a single exit gate.

One engine is easier to reason about than three. It is also faster, because the AST only gets parsed once.

---

## Section 3 — What you get

### The Citadel — every wall, every gate, every guard

Flint ships as a set of named modules. Each one does one thing well. You do not have to know the names to use Flint, but knowing them helps when you are reading the governance report.

- **Mithril** catches design drift — colors, spacing, typography, shadows, opacity — using perceptual color math (CIEDE2000). If your button is close-but-not-quite the brand primary, Mithril flags it and, where possible, fixes it.
- **Warden** runs 50 WCAG 2.1 AA rules at AST level. Missing alt text, bad heading order, insufficient contrast, bad ARIA, missing form labels, unsafe motion — caught before the code reaches a browser.
- **Mason** turns a Figma frame into React code that provably uses only your approved components and tokens. No prompt. Your design system is the constraint.
- **Scout** pulls your Figma variables out as W3C DTCG design tokens and emits them to Tailwind, CSS, Swift, Kotlin, React Native, and adapter formats for MUI, shadcn, and PrimeNG.
- **Gate** is the export gate. If any audit fails or overrides remain, Gate blocks the export. Ship only clean code.
- **GPX** is portable, shareable governance. Export your rules, tokens, and policies as a signed pack file. Hand it to another team; they import it with conflict detection and rollback. Share governance the way you already share design system files — team-to-team, no hosted service required.
- **Sentry** scores the risk of every mutation (five factors, weighted 0–100). Green, amber, or red tier. Red requires review. Amber requires justification. Green flows through.
- **Stamp** records provenance — which agent touched which file, with which tokens, at which timestamp. When the audit question comes in three months later, the answer is one query away.

---

## Section 4 — Integrations

### MCP-native, works with the AI tools your team already uses

Flint is built on Model Context Protocol from the ground up. That means Flint speaks the same language as every modern AI coding assistant.

- **Claude Code** — Flint MCP registers as a server. Claude Code calls Flint's audit, fix, and design-to-code tools directly.
- **Cursor** — Same MCP server. Same tools. Same results.
- **VS Code** — Flint ships a VS Code / Cursor extension with diagnostics, quick fixes, and a status bar indicator.
- **Figma MCP** — Flint reads designs through Figma's official Dev Mode MCP server. Code Connect mappings, design tokens, screenshots — all flow through the same integration path.
- **CI / CD** — `flint-gate` is a headless CLI that emits SARIF. Plug it into GitHub Actions, GitLab, or any CI that reads SARIF. Fail the build, ship the report.

Install once, run everywhere. Flint does not care which IDE the developer uses, only that the code eventually passes the rules.

---

## Section 5 — Proof

### Receipts, not promises

Every claim on this page is backed by code that ships today, not roadmap.

- **61 MCP tools + 13 resources** — the largest MCP governance surface in the design and UI space. Full inventory at [flint://capabilities](#).
- **50 WCAG 2.1 AA rules** — covering names and labels, keyboard access, structure, ARIA, landmarks, contrast, forms, live regions, and motion. All enforced at AST level.
- **10 rule packs, 64 rules** — grouped by domain and jurisdiction. Enable what you need, disable what you do not. Share via GPX.
- **CIEDE2000 drift detection** — perceptual color math, not string matching. The same formula print QA has used for twenty years.
- **Multi-framework tokens** — DTCG-compliant tokens emit to Tailwind, CSS, Swift, Kotlin, React Native, MUI, shadcn, and PrimeNG.
- **4 surfaces, 1 engine** — Flint Glass (observability), VS Code extension (diagnostics), `flint-gate` (CI), MCP server (agents). Same rules everywhere.

### Try it

**Install Flint MCP:** one command for Claude Code, Cursor, or any MCP client.

<!--
INSTALL COMMAND — TBD, BLOCKED ON: confirm @flint-gov/mcp npm publication status.
If published: `claude mcp add flint -- npx -y @flint-gov/mcp`
If not yet published: link to repo at https://github.com/Jtiem/lunar-elevator-flint for manual install
-->
```
<!-- TODO: insert verified install command here -->
```

**See what Flint finds in your codebase:** point it at a file and ask `audit my component`.

**Check the governance health of a whole project:** run `flint-gate audit` in CI, get a 0–100 health score and A–F grade with SARIF output.

---

## Voice notes for future edits

- No "revolutionary" or "game-changing." Flint does a specific thing; that specificity is the value.
- No "unlock." Flint does not unlock productivity; it catches drift.
- Em dashes used sparingly — one per paragraph at most, never two in a row.
- Citadel names (Mithril, Warden, Mason, Scout, Gate, Sentry, Stamp, GPX) are introduced with a plain-English gloss. Never make the reader guess.
- Every proof number on this page is live today. If a module goes offline or a count changes, this copy must be updated. Source of truth: [CLAUDE.md — Module Status](../../CLAUDE.md#module-status).

## Sources

Technical claims grounded in [CLAUDE.md](../../CLAUDE.md), [HANDOFF.md](../../HANDOFF.md), and the [competitive landscape report](COMPETITIVE-LANDSCAPE-2026-04-18.md). See [INVESTOR-BRIEF-2026-Q2.md](INVESTOR-BRIEF-2026-Q2.md) for full citation trail.
