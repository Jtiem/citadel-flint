# Flint Chat Experience: A Critical Audit
**Status:** Working Document
**Date:** 2026-03-16
**Author:** Design critique / product strategy

---

## Framing

Flint is a headless governance engine. Its "UI" for AI agents and developers is a conversation — tool calls, responses, error messages, resource payloads. This document treats that conversation as a product surface and audits it with the same rigor Flint applies to code.

The standard: **a person who has never used Flint should be able to accomplish a real governance task in their first session, entirely through chat, without reading the documentation.**

Flint does not currently meet this standard. Here is why, and what to do about it.

---

## 1. The Discovery Cliff

**What happens:** An agent connects. It calls `list_tools` and gets 13 names.

```
flint_status
audit_ui_component
flint_audit
flint_ast_mutate
flint_fix
flint_query_registry
flint_debt_report
flint_sync_tokens
flint_ingest_figma
hydrate_figma_data
read_design_intent
flint_audit_report
flint_debt_report
```

**The problem:** Two tools both have "audit" in their name. `audit_ui_component` vs `flint_audit` — what is the difference? The agent has no way to know without reading the full description of both. Tool names are internal implementation vocabulary, not user-intent vocabulary.

**The deeper problem:** The tools are organized around Flint's architecture, not around the tasks a user wants to accomplish. A user wants to: *check my component*, *fix my violations*, *see my design health*, *migrate my tokens*. None of those map cleanly to a single tool.

**What's already there:** `flint://capabilities` returns a full surface inventory and `flint-workflow-guide` provides onboarding. Neither is discovered automatically — the agent has to know to look for them.

**The fix:** The server `initialize` response should include a one-sentence directive: *"New to Flint? Start with the `flint-workflow-guide` prompt or read `flint://capabilities`."* Cost: 1 line of code. Payoff: every agent gets the map before it wanders.

---

## 2. The Vocabulary Tax

Flint has its own dialect. It is precise, correct, and completely opaque to non-experts.

| What Flint says | What the user asked |
|-----------------|-------------------|
| `MITH-001: color-drift detected, ΔE=5.2` | "Is my button the right color?" |
| `tier-1 auto-fix applied via healOnAudit` | "Did you fix it?" |
| `Shadow Storybook artifact returned` | "What does this component look like?" |
| `SARIF 2.1.0 output` | "Can I use this in GitHub?" |
| `assembleLayout op batched` | "Did you move that element?" |

This is the **translation debt** Flint places on agents. An agent mediating between Flint and a human designer has to silently translate every response. Some agents do this well. Many don't. When they don't, the user sees raw governance vocabulary and feels like they've opened the wrong door.

**The asymmetry:** Flint's input accepts natural language intent (via `flint-intent-composer`). Its output is always governance vocabulary. The channel is asymmetric.

**The fix:** Every tool response should include a `summary` field alongside the technical output — a one-sentence human-readable statement of what happened. Not instead of the technical output. In addition to it. The technical output serves CI/CD pipelines and expert agents. The summary serves everyone else.

```json
{
  "summary": "Found 3 violations in Button.tsx. 2 can be auto-fixed.",
  "violations": [...],
  "sarif": {...}
}
```

---

## 3. The Silent State Problem

Flint Glass, right now, might be showing:
- 47 active violations across 12 files
- A health score of 62/100 (Grade D)
- 3 files that are blocked from export

The chat agent knows none of this unless it asks.

Flint has `flint://session-context` (Phase ACX) — live project state. This is the right idea. But it's a pull resource, not a push signal. An agent doing a focused task on `Button.tsx` doesn't know it's one of 12 broken files unless it polls.

**The consequence:** Agents optimize locally. They fix what they were asked to fix and report success, while 46 other violations remain. From the project's perspective, the governance posture didn't change. From the agent's perspective, the task is complete.

**The fix:** Tool responses from `flint_audit` and `flint_fix` should include a **project-level context footer**:

```json
{
  "file_result": {...},
  "project_context": {
    "total_violations": 47,
    "blocked_files": 3,
    "health_score": 62,
    "grade": "D"
  }
}
```

This costs nothing to generate (the data already exists). It transforms every local task response into a window onto project health.

---

## 4. The Confirmation Void

Flint's Commandment 16: the orchestrator runs an in-memory TSC validation loop before surfacing confirmation UI. The confirmation UI lives in Flint Glass.

**The problem:** Chat has no confirmation step. From the chat perspective:

```
User: Fix the color violation in Button.tsx
Agent: [calls flint_fix]
Flint: [applies AST mutation, saves file]
Agent: Done.
```

The mutation happened. The file changed. The user was never asked.

This is by design for simple fixes — and correct. But for complex mutations (`assembleLayout`, cross-file moves, bulk token migrations), the same pattern applies. An agent can restructure an entire component tree without a confirmation checkpoint in the chat flow.

**The nuance:** Flint does have `healOnAudit` as an explicit opt-in flag, which is the right pattern for automation. But there's no graduated confirmation model — no way for a tool to say "this is a high-impact change, please confirm before I proceed."

**The fix:** Add a `risk_level` field to mutation responses and a `dry_run` flag to mutation tools. An agent can call `flint_ast_mutate` with `dry_run: true` to get a preview of changes, then call again to confirm. This gives agents — and the users behind them — a natural checkpoint.

---

## 5. The Multi-Step Task Problem

Real governance tasks are not one tool call deep.

*"Migrate all hardcoded colors in src/components/ to design tokens."*

This requires:
1. Audit all files (`flint_audit` per file, or batch)
2. Review violations, group by type
3. For each violation, select the correct token
4. Apply mutations (`flint_ast_mutate` per file)
5. Re-audit to verify no regressions
6. Report results

That is 5 distinct phases, potentially hundreds of tool calls, and requires judgment at step 3 (which token?). Flint provides excellent tools for each individual step. It provides no support for the orchestration layer.

**The consequence:** Every agent reinvents this loop from scratch. Some get it right. Some miss the re-audit step. Some stop after step 4 and report success without verifying.

**The fix:** A `flint_plan` tool that accepts a high-level intent and returns a structured execution plan — the sequence of tool calls, the decision points, the expected outcomes. The agent doesn't have to guess the workflow. Flint tells it the workflow.

This is a significant build, but it's the natural next evolution of `flint-intent-composer`. The prompt already structures intent. The plan tool would structure execution.

---

## 6. The Error Signal Problem

When `flint_ast_mutate` fails, what does the agent see?

If the error message is *"Cannot read property 'body' of undefined"* — that's a stack trace, not a signal. The agent cannot self-correct from that. It will retry, fail again, and eventually give up or hallucinate an alternative approach.

If the error message is *"Target node flint-id-42 not found in current AST. The file may have been modified outside of Flint since the last audit. Run flint_audit first to refresh the AST state."* — that's actionable. The agent knows exactly what to do.

**Flint's Commandment 13 (deterministic surgery) and Commandment 10 (pre-flight checks) exist precisely to prevent these failures.** But when they don't prevent them, the error output is the last line of defense for recovery. It must be diagnostic, not descriptive.

**The fix:** A Flint error taxonomy. Every tool failure gets a code (`FLINT-ERR-001`), a plain-language description, and a recovery instruction. Not nice-to-have — this is what separates tools that agents can use autonomously from tools that require human babysitting.

---

## 7. The "I Did Something" Problem

After a successful `flint_ast_mutate`, the agent receives a JSON response confirming the operation. The file changed. In chat, you see:

```json
{
  "success": true,
  "op": "updateClassName",
  "nodeId": "flint-id-42",
  "before": "bg-[#3B82F6]",
  "after": "bg-brand-blue"
}
```

This is technically correct and completely unsatisfying. The user asked for a fix. They got a data structure confirming a fix. Flint Glass shows the change beautifully — the canvas updates, the ghost overlay clears, the health score ticks up. In chat, you see a JSON blob.

**The gap:** Chat and Glass tell completely different stories about the same event. Glass is cinematic. Chat is a log file.

**The partial fix:** The `summary` field proposed in section 2 helps here. But the deeper issue is that Flint's richest feedback loop (Glass) is invisible to chat. There's no way to bring Glass artifacts into the chat — no way to say "here is a before/after snapshot" or "here is the spatial view of what changed."

This is a hard problem. It may not be solvable entirely in text. But a well-crafted mutation summary — *"Changed bg-[#3B82F6] → bg-brand-blue on Button (line 4). Color drift reduced from ΔE=5.2 to ΔE=0.3. This violation is resolved."* — is infinitely better than raw JSON.

---

## 8. The Persona Discontinuity

Flint has three prompts:

| Prompt | Persona |
|--------|---------|
| `flint-intent-composer` | UX/UI Architecture Sentinel — design-to-code translation |
| `flint-sentinel` | Domain governance engine — 6 domain presets |
| `flint-workflow-guide` | Onboarding assistant |

An agent that loads `flint-sentinel` for a healthcare governance task is operating in a fundamentally different mode than one using `flint-intent-composer` for a Figma translation task. The tools are the same. The judgment layer is different.

**The problem:** There's no mechanism for the agent to know which persona is appropriate for a given task, and no graceful transition between them. An agent that started a session with `flint-workflow-guide` and now needs to perform a domain governance audit has to know to switch personas — and there's nothing in the tool responses that suggests this.

**The fix:** Tool responses from `flint_audit` could recommend a persona switch when the task context warrants it: *"This audit triggered 4 HIPAA-related rules. Consider activating the `flint-sentinel` prompt with `domain: healthcare` for domain-specific guidance."* Flint knows what it just found. It can tell the agent how to talk about it.

---

## 9. The Onboarding vs. Expert Bifurcation

Session 1 and Session 100 have the same entry experience. There is no adaptive initialization.

A first-time agent needs the workflow guide. An expert agent needs the session context. Both call `list_tools` and get the same response.

**The fix:** Session context (via `flint://session-context`) should be rich enough that an expert agent can orient instantly — here is the active file, here is the current health score, here are the open violations from last session. Flint already has most of this data. Surfacing it at session start requires no new capabilities, only better defaults.

For true first-sessions (no prior context), `flint-workflow-guide` should be surfaced explicitly in the init response, not buried in the prompt list.

---

## 10. The "Why" Gap

Flint tells you what is wrong. It rarely tells you why the rule exists or why it matters to this specific project.

*"MITH-001: color-drift detected on Button.tsx, ΔE=5.2"* is accurate and terse.

*"Button.tsx uses #3B82F6, which is 5.2 ΔE from your brand-blue token (#2563EB). This is above the 2.0 threshold — your end users will perceive these as different colors. This typically happens when AI tools generate default Tailwind blues instead of reading your token file."* is accurate, educational, and gives the developer context they'll carry into the next task.

**The consequence of the why gap:** Developers who don't understand the rule will work around it instead of internalizing it. They'll accept the auto-fix without learning the pattern. Flint enforces compliance without building competence.

**The fix:** Every rule should have an `explanation` field — a 1-2 sentence statement of the business or user impact, not just the technical violation. This is a documentation task, not a code task, but it compounds over time as the rule library grows.

---

## 11. Progress in the Void

A bulk audit of 200 files is silent until it completes. The agent waits. The user waits. Nothing indicates progress.

For CI/CD pipelines this is fine — they don't watch. For interactive sessions, this is a trust problem. The user doesn't know if Flint is working, hung, or waiting for something.

**The fix:** MCP supports streaming responses. Flint should use them for long-running operations, emitting incremental progress updates as files are processed. The format doesn't need to be elaborate: `{"processed": 47, "total": 200, "violations_found": 12}` every N files is enough to establish that the system is working.

---

## 12. The Memory Discontinuity

Flint tracks design debt trends (health score over time, grade progression). It does not track conversational context. Each session starts cold.

An agent that spent last session fixing 30 violations in `src/components/` doesn't automatically know that 17 remain, that the user deprioritized them, or that a third developer introduced 8 new ones overnight.

`flint://session-context` is the right direction here. The gap is that session context carries *current state*, not *session history* — what was attempted, what was decided, what was deferred.

**The fix:** A lightweight session journal in the Flint DB. Not full conversational history — that belongs in the IDE. Just: which files were audited, which violations were fixed, which were acknowledged/deferred, and when. Flint already has the mutations ledger (INFRA.2). The deferred violations table is the missing half.

---

## 13. The Audience Mismatch

Flint serves three audiences through the same chat surface:

| Audience | Mental model | What they want to say |
|----------|-------------|----------------------|
| Designer | Figma, tokens, visual hierarchy | "Make the button match my design system" |
| Engineer | Files, diffs, CI pipelines | "Audit src/ and give me SARIF" |
| AI agent | Tool calls, structured data | `{ "tool": "flint_audit", "params": {...} }` |

The chat interface optimizes for the AI agent. The vocabulary, the response structures, the error messages — all are designed for programmatic consumption. Designers who interact via natural language get the same response as CI pipelines.

**The fix:** `flint-intent-composer` is the design-facing persona, but it's an optional layer that must be explicitly activated. The default Flint voice is engineering-facing. The default should be neutral — usable by all three audiences — with personas that shift it toward domain-specific vocabulary when invoked.

---

## The Good: What Flint Gets Right

Critique is incomplete without acknowledging what works.

**Determinism as a feature.** Every other tool in this space gives different answers each time. Flint gives the same answer. For compliance use cases, this is not just good — it's the only viable approach. Flint should say this more loudly in its chat responses.

**The AST mutation model.** Chat-driven AST surgery — the ability to move, wrap, and inject nodes through conversation — is genuinely novel. No competing tool does this. Flint undersells it in its tool descriptions.

**The Export Gate as a conversation.** The Export Gate is a blocking dialogue between Flint and the developer: *"You cannot ship until these violations are resolved."* This is exactly the right UX pattern for a governance product — a hard stop with clear resolution steps. It works because it's binary and unambiguous.

**`flint_debt_report` as a progress narrative.** The health score, grade, and trend tracking give the conversation a temporal arc. Instead of "you have 47 violations," it says "you had 62 last week, you have 47 now, your grade improved from D to C." This is the beginning of a conversational relationship with a codebase.

---

## Priority Stack

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Init response missing onboarding pointer | High | Trivial | P0 |
| No `summary` field in tool responses | High | Low | P0 |
| No `project_context` footer on local results | High | Low | P1 |
| Error taxonomy (codes + recovery instructions) | High | Medium | P1 |
| `dry_run` flag on mutation tools | Medium | Low | P1 |
| Per-rule `explanation` field | Medium | Medium | P2 |
| Persona switching hints in tool responses | Medium | Low | P2 |
| Session context: deferred violations journal | Medium | Medium | P2 |
| Streaming progress for bulk operations | Low | Medium | P3 |
| `flint_plan` orchestration tool | High | High | P3 (vision) |

---

## The Thesis

Flint has an excellent governance engine and a primitive conversational interface. The engine is correct. The conversation is an afterthought.

The path forward is not to build a chat UI. Glass is the UI. The path forward is to treat every tool response as a conversational turn — with a voice, a summary, a context signal, and a next-step suggestion. Flint should feel like a senior governance engineer you can talk to, not a JSON API you happen to call through a chat window.

The investment is small. The tool responses are already generated. Adding `summary`, `project_context`, `recovery_instruction`, and `explanation` fields to existing responses requires no new capabilities — only intentional design of what Flint says, and when, and to whom.
