# Project Governance Template

> Extracted from the Flint project's governance system.
> Copy this entire directory into a new project to bootstrap governance in ~4 hours.

---

## What's Inside

```
.governance/
  COMMANDMENTS.md              ← 8 universal commandments + add your own
  MOAT.md                      ← Strategic filter: what to build (and not build)
  ARCHITECTURE.md              ← Canonical architecture spec (versioned)
  HEALTH-PULSE.md              ← Living health report, updated every session
  ACTIVE-TERRITORY.md          ← Live map of which files are claimed by which agent
  contracts/                   ← Contract artifacts for in-progress features
  enforcement/
    gates.md                   ← What blocks shipping/export/merge
    graduation-protocol.md     ← How rules move from docs → tooling

.claude/
  agents/
    architect.md               ← Plans work, checks commandments
    reviewer.md                ← Quality gate with commandment checklist
    implementor.md             ← Core builder with file ownership
    test-writer.md             ← Test patterns, coverage standards, required report format
    debugger.md                ← Failure diagnosis + mode catalog
    product-planner.md         ← Idea → spec with scope boundaries
  workflows/
    session-start.md           ← Mandatory pre-work: territory + HANDOFF + context read
    session-end.md             ← Health report + HANDOFF update + territory clear
    feature-build.md           ← Contract-First workflow for 2+ file features
    audit.md                   ← Pre-commit compliance check

HANDOFF.md                     ← Session continuity record (project root)
```

---

## Bootstrapping Sequence (~4 hours)

### Hour 1: Foundation (do first, everything depends on these)

**1. Write your Commandments** (30 min)
Open `.governance/COMMANDMENTS.md`. The 8 universal commandments are already there. Add 4-8 domain-specific commandments for your project. The hard part is making them binary — not "try to" but "must / must not."

**2. Write your Moat** (30 min)
Open `.governance/MOAT.md`. Define 2-3 strategic advantages. For each, write a "depth test" — the question you'll ask before building any feature. If you don't have a competitive strategy yet, start with: "What would be hardest for a competitor to replicate?"

### Hour 2: Architecture

**3. Write your Architecture spec** (1 hr)
Open `.governance/ARCHITECTURE.md`. Document:
- Module map (what exists, what owns what)
- Process boundaries (what can't talk to what)
- Data flow (source of truth → transforms → storage → rendering)
- Hard constraints (the "physics" of your project)

### Hour 3: Agents

**4. Customize agent roles** (1-2 hr)
Edit the 6 agent files in `.claude/agents/`. For each:
- Update **file ownership** to match your project structure
- Update **anti-patterns** with your domain's common mistakes
- Embed your commandments into the reviewer checklist
- Add domain-specific agents if needed (e.g., security, accessibility, data)

### Hour 4: Enforcement

**5. Define at least one gate** (30 min)
Open `.governance/enforcement/gates.md`. Define what blocks shipping. Start with one hard gate (TypeScript + tests is the minimum). Add domain-specific gates as needed.

**6. Write the reviewer checklist** (30 min)
The reviewer agent (`.claude/agents/reviewer.md`) is the most impactful single artifact. Map each of your commandments to a checkable code pattern. This is what turns aspirational rules into enforced policy.

**7. Run the audit workflow** (15 min)
Open `.claude/workflows/audit.md`. Run through it once manually to verify it makes sense for your project. Adjust the steps as needed.

---

## The 7-Layer Governance Model

This template implements a 7-layer model extracted from Flint:

| Layer | What | Impact | Where |
|-------|------|--------|-------|
| 1. Commandments | Non-negotiable rules | Highest | `COMMANDMENTS.md` |
| 2. Agent Roles | Who owns what, who refuses what | High | `.claude/agents/` |
| 3. Architecture Docs | Module boundaries, constraints | High | `ARCHITECTURE.md` |
| 4. Enforcement Gates | What blocks shipping | High | `enforcement/gates.md` |
| 5. AI Context Injection | Rules in agent prompts | Medium-High | Agent `.md` files |
| 6. Workflows | Repeatable procedures | Medium | `.claude/workflows/` |
| 7. Strategic Planning | Roadmap, moat, expansion | Foundation | `MOAT.md` |

---

## Enforcement Impact Ranking

Rules enforced by architecture > rules enforced by gates > rules in AI prompts > rules in linters > rules in workflows > rules in documentation only.

**The key insight:** Documentation-only rules decay. Every commandment should have a graduation path to a higher enforcement tier. Use `.governance/enforcement/graduation-protocol.md` to track this.

---

## Ongoing Maintenance

- **Every session start:** Run the `session-start` workflow — declare territory + update HANDOFF.md
- **Every session end:** Run the `session-end` workflow — update Health Pulse + HANDOFF + clear territory
- **Every commit:** Run the `audit` workflow
- **Every 2+ file feature:** Follow the `feature-build` Contract-First workflow
- **Every sprint:** Review governance debt in `HEALTH-PULSE.md`
- **Every pivot:** Review commandments for relevance, retire obsolete ones
- **Every new agent prompt:** Verify it includes the current commandment list

---

## Origin

This governance framework was extracted from the Flint project (flint-mcp), which grew from 0 to 400+ tests, 16 commandments, 15 specialized agents, and a full MCP server while maintaining architectural coherence across multiple major pivots (IDE → headless MCP engine). The framework works because it treats governance as infrastructure, not documentation.
