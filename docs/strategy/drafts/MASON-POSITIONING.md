# Mason: A Governed Generator

**Date:** 2026-04-18
**Status:** Internal positioning draft — not for public release
**Audience:** Justin, go-to-market partners, investors evaluating the generator category
**Companion docs:** [COMPETITIVE-LANDSCAPE-2026-04-18.md](COMPETITIVE-LANDSCAPE-2026-04-18.md), [INVESTOR-BRIEF-2026-Q2.md](INVESTOR-BRIEF-2026-Q2.md), [LANDING-PAGE-COPY.md](LANDING-PAGE-COPY.md)

---

## The one-line position

Mason is Flint's governed generator. It turns a Figma frame into React code that provably matches your design system. Not a prompt box. Not a clean-room app generator. A compiler from design to code, constrained by the tokens and components you already ship.

## Why this doc exists

The competitive landscape research ([section 1.1](COMPETITIVE-LANDSCAPE-2026-04-18.md#11-ai-ui-generators-the-generate-first-govern-never-camp)) flagged a specific risk: if Flint sits purely downstream of v0, Lovable, and Bolt, the market reads Flint as "the thing that yells at v0 output." That framing makes Flint adjunct to the real product. It also cedes the generator conversation entirely.

That framing is wrong. Flint has a generator — Mason — and it solves a different problem than v0. The problem Mason solves is the one enterprises actually have: "I have a design system. I have a Figma frame. I need code that matches both, not a clever-looking screen built against shadcn defaults." This doc establishes Mason as a first-class product, not a feature footnote.

## Who Mason is for

Mason serves teams with three things already in place:

1. **An existing design system** with tokens (color, spacing, typography) and a component library (MUI, shadcn, PrimeNG, an internal library, or any combination).
2. **Figma as the source of design truth** — frames that represent real UI, not sketches.
3. **Code standards** — a React/TypeScript codebase with conventions about imports, file structure, and component boundaries.

If all three are present, Mason produces code that fits on first try. If one is missing, a general prompt-to-app tool will probably serve you better for a minute, and cost you a week of cleanup afterward.

Mason is **not** for:

- Greenfield weekend projects. v0 and Lovable are better for "build me a dashboard from scratch." They are purpose-built to make the first version pretty. Mason has no view on what a pretty-from-nothing dashboard should look like.
- Zero-design-system teams. Mason's entire value is constraint from an existing system. Without tokens and a component registry, Mason is a strictly worse version of the general generators.
- Non-React stacks today. The Universal AST ([V.3, ONLINE](../../CLAUDE.md)) makes multi-framework feasible, but Mason's transformer (`hydroPaste`, `figmaJsxTransformer`) targets React+JSX today. Vue and Svelte are roadmap, not shipped.

## Why Mason is not v0

The input changes the product. Full stop.

| | Mason | v0 / Lovable / Bolt |
|---|---|---|
| **Input** | Figma frame + design tokens + component registry | Text prompt |
| **Output constraint** | Must use approved components and tokens, verified at AST level | "Should" use shadcn (prompt-shaped) |
| **Failure mode** | Blocks or flags non-compliance; will not silently invent a new button | Ships whatever the model thinks looks right |
| **Repeatability** | Same frame + same tokens → same AST diff (deterministic) | Probabilistic by construction |
| **Post-generation check** | Mithril + Warden audit is part of the pipeline, not a separate tool | Optional, bolted on (Vercel AutoFix runs after) |
| **Who writes the prompt** | Nobody. The Figma frame and the registry are the prompt. | The user |

The headline difference is that Mason has no text prompt. You do not tell Mason what you want. Mason reads a Figma frame, looks up what components and tokens the project has approved, and produces code that only uses those. If the frame contains something the registry does not cover, Mason surfaces the gap explicitly instead of hallucinating a replacement. ([Commandment 2](../../CLAUDE.md#the-16-commandments) — No Hallucinated Styling.)

This is closer in spirit to a compiler than to a generator. Compilers do not try to be creative; they translate faithfully. That is exactly what an enterprise design system team needs.

## The "governed generation" pitch

Three things happen when Mason runs. All three are deterministic, which is the load-bearing word.

### 1. Read the design

Mason pulls design context through the Figma MCP (`get_design_context`, per the [2026-04-15 decision](../../CLAUDE.md#identity) to use Figma MCP as the only integration path). The payload includes the Figma node tree, any Code Connect mappings, design tokens as CSS variables, and a screenshot for fallback. Per CLAUDE.md, `figmaMcpParser.ts` and `figmaJsxTransformer.ts` normalize that into a JSX AST draft.

### 2. Constrain the output

Before a single character of code is emitted, Mason injects three constraints into the generation context (this is the Constrained Registry work, [CR.1–3 ONLINE](../../CLAUDE.md)):

- The **component registry** (Armory) — only approved components can be referenced.
- The **design tokens** — every color, spacing value, and typography style must resolve to a token path.
- The **governance policy** — the project's active `flint.config.yaml` rules, including severity and enforcement modes.

If the Figma frame contains a button that does not exist in the registry, Mason does not invent one. It surfaces the mismatch, suggests the closest registered component, and waits for a human call.

### 3. Verify before shipping

The output is parsed back through Babel AST, then audited by Mithril and Warden in-process ([Commandment 16](../../CLAUDE.md#the-16-commandments) — In-Memory Validation). If anything fails — a hardcoded hex that should have been a token, a WCAG rule violation, an unregistered component reference — the code does not land. The user sees the violation with rule provenance and the next action.

Same input → same output → same verification path. That is what "deterministic" means in practice, and it is what a design system lead cannot get from a probabilistic generator.

## How Mason composes with the rest of the Citadel

Mason is not a standalone product. It is one module in a larger engine, and most of its power comes from composition.

- **Scout** extracts design tokens from Figma variables and emits them to the project's token formats (CSS, Tailwind, Swift, Kotlin, React Native, and adapter formats for MUI, shadcn, PrimeNG). Mason reads from the resulting `.flint/design-tokens.json`. If Scout has not run, Mason has no tokens to constrain against, which means the constraint layer degrades to heuristics. The flow is: Scout feeds Mason.
- **Armory** is the component registry — a per-project allowlist with AI-drafted enrichment (usage examples, composition notes, a11y notes, related components). Mason queries Armory for component matches. Armory is seeded from the project manifest on open ([CK.1 RAG Auto-Seeding, ONLINE](../../CLAUDE.md)) and re-indexed on demand.
- **Bridge** resolves Code Connect mappings. When Figma has already mapped a node to a specific codebase component, Mason uses that mapping directly instead of guessing a match.
- **Mithril** runs perceptual drift detection on the emitted code. If a color Mason chose is ΔE > 2.0 from the closest token, Mithril flags or auto-fixes before the code lands.
- **Warden** runs the 50 WCAG 2.1 AA rules against the emitted AST. Missing alt text, bad heading order, insufficient contrast, bad ARIA — caught at generation time, not at DOM runtime.
- **Gate** is the export gate. If anything Mason produced fails audit, Gate blocks. If overrides or drift remain, Gate blocks. The exit path is the gate; Mason cannot bypass it.
- **Stamp** (provenance) records that Mason produced this code, against this Figma node, with this set of tokens, at this timestamp. Every mutation is traceable — useful when auditors ask "how did this component get written."

The story this composition tells: Mason does not guess. It reads (Figma MCP), it constrains (Armory + tokens), it emits (AST transformer), it verifies (Mithril + Warden), it records (Stamp), and it is gated (Gate). Every step is inspectable.

## A walkthrough (plain English)

Say a designer in your team has a Figma frame representing a sign-up form. It has a heading, two text fields, a primary button, a secondary link, and an error state. The tokens used are your design system's tokens. The components referenced are MUI components already in your codebase. Here is what happens when the developer asks Flint to generate the code.

1. The developer invokes `flint_design_to_code` with the Figma URL and node ID (typically through Claude Code, Cursor, or the Glass UI).
2. Mason calls Figma MCP `get_design_context` and receives the node tree, tokens as CSS variables, and (if present) Code Connect mappings.
3. Mason looks up the active library adapter — in this case, MUI — and maps Figma node types to MUI component types (`Frame` → `Box` or `Stack`, `Text` → `Typography`, `Input` → `TextField`, `Button` → `Button`).
4. Mason queries Armory to confirm all targeted components are in the project's registered allowlist. They are.
5. Mason emits the JSX AST. Every color, spacing, and typography reference resolves to a token path from the project's `.flint/design-tokens.json`. Nothing is hardcoded.
6. The draft goes through an in-memory TSC type-check. Passes.
7. Mithril runs. No perceptual drift.
8. Warden runs. One violation: the password field is missing an `aria-describedby` linking it to the error state. The fix is obvious — `warden` auto-fixes it at Tier 1.
9. Stamp records the provenance. Gate sees a clean audit and permits the file to land.
10. Save happens through FileTransactionManager — atomic, with full rollback capability via Rewind.

The developer never typed a prompt. The designer's Figma frame plus the project's existing system were the entire specification. And the result is a file that — by construction — uses only approved components and tokens, and passes the 50 WCAG 2.1 AA rule pack.

## Where Mason fits in the design-to-code market

Looking at [section 1.1 of the competitive landscape](COMPETITIVE-LANDSCAPE-2026-04-18.md#11-ai-ui-generators-the-generate-first-govern-never-camp), the Figma-to-code category is crowded: Anima, Builder.io Visual Copilot, Locofy Lightning, Tempo Labs, and smaller players. They differ from Mason in one consistent way: they optimize for fidelity to the Figma frame and let the design system conform to the output. Mason inverts that. The design system is fixed; the output conforms to the system.

That inversion matters at enterprise scale. A company with a shipped design system does not want a tool that produces "pixel-perfect" code using components that do not exist in their codebase. They want a tool that produces code their existing codebase accepts. Mason is the only generator on the landscape research where that is the core stance.

- **Anima** generates React/HTML/Tailwind from Figma. Very good at fidelity. Has no notion of an existing component registry to constrain against. ([Anima pricing](https://www.animaapp.com/pricing))
- **Builder.io Visual Copilot** supports "component mapping" from Figma to a codebase. Closest to Mason in ambition. The mapping is prompt-shaped — Builder's model is instructed to prefer mapped components, but there is no AST-level verification that it did, and no hard fail if it did not. ([Builder.io Visual Copilot 2](https://www.builder.io/blog/visual-copilot-2))
- **Locofy Lightning** uses a "Large Design Model" and reports ~80% automation of Figma-to-code. Enterprise pilots with Toyota, Deloitte, Bupa. No public documentation of AST-level constraint enforcement against a registry. ([TechCrunch](https://techcrunch.com/2024/01/15/locofy-lightning/))
- **v0 by Vercel** is prompt-to-React, not Figma-to-React. Uses shadcn as a registry but is a different product shape entirely — no design-system-agnosticism, no Figma-first input. ([Vercel — AI-powered prototyping with design systems](https://vercel.com/blog/ai-powered-prototyping-with-design-systems))

The niche Mason occupies: Figma-frame-in, constrained-to-your-system-out, verified-by-AST, MCP-native. The competitors each overlap on one axis; nobody overlaps on all four.

## What Mason is not

To keep positioning honest, here is what Mason explicitly does not do. Internal teams should never pitch it against these use cases.

- **Mason is not a general-purpose AI coding assistant.** It does not refactor. It does not write business logic. It does not wire up state management. It translates designs to components.
- **Mason is not an app generator.** There is no "build me an app" prompt. If you want to go from nothing to a working prototype in one afternoon, Lovable is a better answer.
- **Mason is not a design tool.** It does not render or author designs. Figma is upstream; Mason only reads.
- **Mason is not style-agnostic.** It only generates code that fits the system. If the system is wrong, the code will be wrong-but-compliant, and the fix is in the system, not in Mason.
- **Mason is not a replacement for human review.** Mason produces code that passes Flint's governance engine. That is a high bar, but it is not a judgment that the code is the right design choice.

## Risks and honest limitations

1. **Registry dependency.** Mason is only as good as the project's Armory registry and design tokens. Teams with incomplete registries will see Mason block a lot. The answer is registry enrichment (EN.1–4 ONLINE) and AI-drafted completion, but the project still needs a real system underneath. See the [onboarding docs](../../HANDOFF.md) for how new projects bootstrap Armory.
2. **Figma frame quality.** Figma frames that ignore auto-layout, use detached styles, or have no semantic structure produce lossy output even from best-in-class generators. Mason does not magically fix bad source designs. Tokens Studio, Figma variables, and Code Connect are prerequisites for great output.
3. **Framework coverage.** React+TypeScript today. Vue, Svelte, Angular, plain HTML are the Universal AST roadmap, not shipped. Do not promise multi-framework at enterprise pitches until the adapters ship.
4. **No creative branding.** Mason will never say "this button would look nicer with a gradient." If the design system says buttons are flat, Mason ships flat. Creative iteration is a human job.
5. **Performance ceiling.** Figma frames with hundreds of nested nodes take multiple seconds to process through the full pipeline (transform → audit → verify). Acceptable for a design-to-code flow; not acceptable for a real-time canvas preview. Users expecting the latter will be frustrated.

## The durable claim

Mason reframes the generator conversation. v0 made "prompt to screen in one click" the category. Mason is making "frame to your system, provably" the next category. The former optimizes for the founder demo. The latter optimizes for the Monday-morning design system lead who has to ship a new page that does not break the brand.

Both products are legitimate. They serve different people. But they are not the same market, and Flint has a generator — not downstream of v0, next to it, pointed at a different customer.

## Next steps (internal)

Concrete actions to back Mason as a product motion, each scoped to a specific flint-* agent per the Contract-First Feature Build workflow.

1. **Demo script.** flint-product-planner to draft a 90-second demo script that shows a Figma frame → Mason → governed React output, with the audit pass visible on screen. No narration about "AI magic"; narration about constraint and determinism. Reference asset for investor conversations and landing page.
2. **Registry seeding pack.** flint-architect to propose a GPX pack for MUI and a GPX pack for shadcn, each containing tokens + component allowlist + usage examples. These are the starter kits that make Mason useful from day one on a new project.
3. **Framework roadmap disclosure.** flint-product-planner to decide what to publicly commit to for Vue/Svelte/Angular support. Current Universal AST (V.3) status is ONLINE in the core engine; transformers are not. Avoid promising; describe the foundation.
4. **Competitive response plan for Builder.io Visual Copilot.** flint-release-researcher follow-up: what exactly is Builder's AST verification layer (if any)? The research-so-far indicates it is prompt-shaped, but this should be confirmed with a hands-on product walkthrough before Mason pitches make that claim publicly.
5. **Pricing implications.** flint-product-planner to assess whether Mason should be a separate product SKU or bundled into Flint's core. Current thinking: bundled, because the value proposition depends on the rest of the engine (registry, tokens, audit) being present.

---

## Sources

Technical claims in this document are grounded in the live codebase (see [CLAUDE.md — Module Status](../../CLAUDE.md) and [HANDOFF.md](../../HANDOFF.md) for online/offline state of each module). Competitive claims are cited inline to [COMPETITIVE-LANDSCAPE-2026-04-18.md](COMPETITIVE-LANDSCAPE-2026-04-18.md) and its primary sources.

- [Competitive Landscape 2026-04-18](COMPETITIVE-LANDSCAPE-2026-04-18.md)
- [Builder.io — Visual Copilot 2](https://www.builder.io/blog/visual-copilot-2)
- [Anima Pricing](https://www.animaapp.com/pricing)
- [TechCrunch — Locofy Lightning](https://techcrunch.com/2024/01/15/locofy-lightning/)
- [Vercel — AI-powered prototyping with design systems](https://vercel.com/blog/ai-powered-prototyping-with-design-systems)
- [Figma — Introducing Dev Mode MCP server](https://www.figma.com/blog/introducing-figma-mcp-server/)
