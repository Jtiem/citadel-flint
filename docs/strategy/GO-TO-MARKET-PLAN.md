# Flint — Go-to-Market Plan

**Date:** 2026-03-22
**Status:** ACTIVE
**Premise:** One engine, two entry points, ship fast, learn from real users.

---

## Phase 1: Ship the Engine (Weeks 1-2)

**Goal:** Get Flint into real hands with zero UI dependency.

### 1a. Publish `@flinthq/mcp` to npm

The MCP engine is the product. Package `flint-mcp/` as a standalone npm module that any AI agent can use.

**What ships:**
- `npx @flinthq/mcp` starts the governance server
- Works immediately with Claude Code, Cursor, VS Code + MCP client
- All 45 tools available: audit, fix, emit tokens, pack export/import, debt report, etc.
- README with 2-minute setup: add 3 lines to your MCP config, done

**What this proves:**
- Do people install it?
- Which tools do they actually call?
- What's the first thing they try to do?

### 1b. Ship the CLI gate

`npx @flinthq/cli audit ./src` runs a governance audit from the command line. Outputs SARIF for CI integration.

**What ships:**
- `flint audit <glob>` — run Mithril + A11y audit, exit code 1 on violations
- `flint fix <file>` — auto-fix token violations
- `flint report <glob>` — design debt health report (A-F grade)
- GitHub Actions example in README

**What this proves:**
- Do teams add it to CI?
- What violation types are most common in the wild?

### 1c. Find 5 users

**Where to look:**
- Design Systems Slack/Discord communities
- People tweeting/posting about AI-generated UI quality problems
- Figma community — design system maintainers
- IndieHackers / Product Hunt — designers building with AI

**What to ask:**
- "What breaks when AI agents build your UI?"
- "How do you verify AI-generated components match your design system?"
- "Would you try a tool that checks AI output against your tokens and a11y rules?"

**What NOT to do:**
- Don't pitch Glass
- Don't pitch Governance Packs
- Don't pitch the canvas
- Just get the MCP server in their project and watch what happens

---

## Phase 2: VS Code Extension (Weeks 3-5)

**Goal:** Inline governance for developers where they already work.

### What ships:

1. **Diagnostics provider** — amber squiggles on Mithril/A11y violations in `.tsx` files
2. **Quick-fix code actions** — "Replace #3B82F6 with token primary-500" as a one-click fix
3. **Status bar item** — health grade (A-F) + violation count for the active file
4. **Governance webview panel** — 3-panel sidebar:
   - Health score ring + grade
   - Activity feed (MCP tool invocations)
   - Agent dashboard (risk posture, consensus stats)

### What this proves:

- Do developers use inline diagnostics or ignore them?
- Do they apply quick fixes or dismiss them?
- Do they open the governance panel or forget it exists?
- How does usage compare to the raw MCP engine (Phase 1)?

### Distribution:

VS Code Marketplace. Free tier. No account required.

---

## Phase 3: Glass for Designers (Weeks 5-8)

**Goal:** Visual verification tool for designers who generate code through AI.

### Scope Glass down to 5 core actions:

1. **Preview** — see the generated component rendered live
2. **Verify** — governance overlay shows what matches the design system and what doesn't
3. **Fix** — one-click auto-fix for violations, before/after diff
4. **Score** — health grade, trend, "is this getting better?"
5. **Export** — gate that blocks shipping until violations are resolved

### What Glass is NOT (enforce this):

- Not a code editor
- Not a Figma replacement
- Not an agent orchestrator
- Not a project manager

### Distribution:

Direct download (`.dmg` / `.exe`). Self-updating. Free tier.

### What this proves:

- Do designers open Glass after generating code, or do they just trust the AI?
- Which of the 5 actions do they use most?
- Do they care about the canvas or just the governance dashboard?
- Is the preview useful or do they just check in the browser?

---

## Phase 4: Validate or Kill (Weeks 6-10)

**Goal:** Make hard calls based on real data.

### Decision framework:

| Signal | If YES | If NO |
|--------|--------|-------|
| MCP tools called >100x/week across users | Double down on engine | Rethink value prop |
| VS Code diagnostics used daily | Invest in extension UX | Keep minimal, focus elsewhere |
| Glass opened >3x/week per designer | Invest in canvas features | Freeze Glass, redirect to extension |
| Governance Packs exported >5 times total | Build GPX.3 (registry) | Defer entire GPX track |
| Consensus gate disagrees >5% of the time | Keep it, optimize latency | Remove it, save API costs |
| Token emitters used (Swift/Kotlin) | Keep all 5 platforms | Drop unused platforms |
| `flint audit` in CI pipelines | Build GitHub App integration | Keep as manual CLI |

### What gets killed if nobody uses it:

- Component thumbnails
- Build/Govern canvas modes
- Stickers
- Annotation engine
- Multiplayer presence
- Anything that adds complexity without proven demand

---

## Phase 5: Double Down (Weeks 10+)

**Goal:** Invest heavily in what's working.

This phase is defined by Phase 4 data. Three possible directions:

### Path A: "Developer Guardrails"

Users are mostly developers using the MCP engine + VS Code extension. Glass gets minimal investment.

**Invest in:**
- Deep IDE integration (diagnostics for more file types, smarter quick fixes)
- CI/CD GitHub App (auto-comment on PRs with violation reports)
- Framework adapters (Vue, Svelte — if users ask)
- More linter rules (custom rule authoring)

### Path B: "Designer Confidence"

Users are mostly designers using Glass + AI agents. The extension is secondary.

**Invest in:**
- Glass UX polish (match Figma quality bar)
- Figma plugin for bidirectional sync
- Design intent comparison (Figma frame vs generated component)
- Simplified governance (preset packs, not manual config)
- Onboarding flow optimized for non-developers

### Path C: "Team Governance Platform"

Users are design system teams (designers + developers). Both interfaces matter.

**Invest in:**
- Governance Packs registry (GPX.3)
- Team dashboards (org-wide health scores)
- Pack compliance enforcement (GPX.4)
- Role-based access (designers see Glass, developers see extension, both governed by same packs)

---

## What's NOT in This Plan

- No new MCP tools until user signals arrive
- No new canvas features until Glass usage is validated
- No GPX.3/GPX.4 until pack export/import is used in practice
- No framework adapters (Vue/Svelte) until users request them
- No "AI Operating System" branding

---

## Positioning

**For developers:**
"Every time an AI agent writes UI code, Flint checks it against your design system and a11y rules. Install in 2 minutes. Works with Claude Code, Cursor, and VS Code."

**For designers:**
"Generate frontend code with AI, then verify it matches your design system before it ships. Flint catches what AI gets wrong — colors, accessibility, spacing — so you can ship with confidence."

**For teams:**
"One governance standard across your entire team. Designers verify in Glass. Developers get inline feedback. CI blocks violations. Same rules everywhere."

---

## Success Metrics

| Metric | Target (Week 8) | How measured |
|--------|-----------------|-------------|
| npm installs | 100+ | npm stats |
| Weekly active MCP users | 20+ | Telemetry (opt-in) |
| VS Code extension installs | 50+ | Marketplace |
| Glass downloads | 25+ | Download count |
| Governance Packs created | 5+ | Telemetry |
| CI pipelines with `flint audit` | 3+ | Telemetry |
| User conversations completed | 10+ | Manual tracking |

These are intentionally small. The goal is learning, not scale.
