# Feature Budget Framework

**Date:** 2026-03-22
**Purpose:** Decision framework for evaluating every new feature proposal against Flint's dual-audience strategy.

---

## The Rule

Every feature competes for the same engineering time. Before building anything, it must pass this framework. If it can't answer these questions clearly, it doesn't get built.

---

## Question 1: Who is this for?

| Answer | What it means |
|--------|--------------|
| **Engine** (both audiences) | Goes into `flint-mcp/`. Gets full investment. Examples: new linter rule, new MCP tool, governance pack format change. |
| **Designer** (Glass) | Goes into `electron/` + `src/`. Must serve one of the 5 core Glass actions (Preview, Verify, Fix, Score, Export). If it doesn't, reject. |
| **Developer** (VS Code extension) | Goes into `flint-vscode/`. Must serve one of the 4 core extension actions (Diagnostics, Quick Fix, Status, Panel). If it doesn't, reject. |
| **CI** (automation) | Goes into `flint-ci/`. Must be headless, zero-interaction, machine-readable output. |
| **"Both" / "Everyone"** | Suspicious. Almost always means it serves neither audience well. Challenge it: which audience would be disappointed if this feature disappeared? If the answer is "neither," don't build it. |

---

## Question 2: What user behavior does this enable?

State the behavior as: **"[User] can now [action] which they couldn't do before."**

Examples that pass:
- "A designer can now see which colors in the generated component don't match the design system" (clear, visual, verification)
- "A developer can now fix a11y violations with one click in VS Code" (clear, inline, action)
- "A team lead can now export their governance config and import it on a new project" (clear, portable, reusable)

Examples that fail:
- "Users can now see a sticker on a component card" (what does the sticker enable them to do?)
- "The canvas now has dependency edges between components" (what decision does this help make?)
- "The agent dashboard shows consensus statistics" (who acts on this information and how?)

If you can't state the behavior clearly, the feature is a solution looking for a problem.

---

## Question 3: Is this the 80% use case or the 5% demo moment?

| 80% use case | 5% demo moment |
|-------------|----------------|
| Run audit on active file | Drag component card from canvas into live preview |
| Apply auto-fix for token violation | Responsive preview snapping with Shift+scroll |
| See health grade for the project | Governance stickers on component cards |
| Import a governance pack on a new project | Annotation engine with multiplayer presence |
| Check a11y violations inline in editor | Design system coverage heat map |

**Rule:** Build 80% features first. Demo moments are only justified when you have users to demo to.

---

## Question 4: What's the maintenance cost?

Every feature has a build cost and a forever cost. The forever cost includes:

- Tests to maintain (how many new tests?)
- Mocks to update when adjacent code changes (does this make `setup.ts` more complex?)
- Cross-interface consistency (does this need to work in Glass AND the extension?)
- Documentation to keep current (CLAUDE.md, HANDOFF.md, backlog)
- Edge cases that will surface in production

**Scoring:**

| Maintenance burden | Description | Example |
|-------------------|-------------|---------|
| **Low** | Pure function, no I/O, no state, self-contained tests | Token emitter, security scanner |
| **Medium** | Zustand store slice, IPC channel, SQLite table, React component | Governance dashboard, agent trust tiers |
| **High** | Cross-process feature, multiple interfaces, real-time sync | Multiplayer presence, context sync, bidirectional Figma |

**Rule:** High-maintenance features require 3x the user signal to justify. If only 2 users ask for it, it's not worth the ongoing cost.

---

## Question 5: Can we validate this without building it?

Before writing code, ask:

| Validation method | When to use |
|------------------|-------------|
| **Ask users directly** | "Would you use X?" — weakest signal but fastest |
| **Show a mockup/prototype** | Figma prototype of the UI. Designer-tested, zero engineering cost. |
| **Ship a minimal version** | Build the smallest possible version, ship it, measure usage |
| **Fake door test** | Add a button that says "Export Governance Pack." Track clicks. Build if clicked. |
| **Manual process first** | Before automating pack import, have users manually copy `.flint/` directories. See if they bother. |

**Rule:** If a feature takes more than 1 week to build, it must be validated first. Features under 1 day can be shipped speculatively.

---

## Question 6: What do we stop doing to make room?

Engineering time is zero-sum. Every new feature means less time on something else.

Before approving any feature, explicitly state what gets deprioritized:

- "Building the VS Code quick-fix provider means we're NOT building the Figma plugin this sprint."
- "Adding Vue adapter support means we're NOT polishing the Glass onboarding flow."
- "Building GPX.3 registry means we're NOT improving the core linter rules."

If you can't name what you're giving up, you haven't actually prioritized — you've just added to the pile.

---

## The Checklist (Print This)

Before any feature gets a green light:

- [ ] **Who:** Audience identified (engine / designer / developer / CI)
- [ ] **Behavior:** User behavior stated as "[User] can now [action]"
- [ ] **80/5:** Confirmed as 80% use case, not demo moment
- [ ] **Cost:** Maintenance burden assessed (low / medium / high)
- [ ] **Validated:** User signal exists, or validation plan defined
- [ ] **Trade-off:** What we're NOT building is explicitly named

Features that check all 6 boxes get built. Features that don't get parked until they can.

---

## How to Use This Document

1. Feature idea surfaces (from user feedback, team brainstorm, competitive pressure)
2. Run it through the 6 questions above
3. If it passes: add to the sprint backlog with the answers documented
4. If it fails: add to a "parking lot" file with the reason it was deferred
5. Revisit the parking lot monthly — user signals may change the calculus
