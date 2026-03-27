# Flint — IDE Chat Onboarding Strategies
**Date:** 2026-03-23
**Author:** flint-product-planner
**Status:** Strategy Document — Approved for Phase Planning
**Companion documents:** CHAT-UX-CRITIQUE.md, BACKLOG-PRIORITIZED.md, GO-TO-MARKET-PLAN.md

---

## The Problem This Document Solves

A new user adds Flint's MCP server to their IDE. The first thing they see is a list of 45 tool names. Nothing says hello. Nothing explains what Flint is for, what to try first, or how to speak to it. Users who already know what "audit_ui_component" means will figure it out. Everyone else closes the tab.

This document defines eight distinct onboarding strategies for the IDE chat surface. Each one addresses a different moment in the user journey — from the first tool-list render to the hundredth session. They are designed to compound: implementing all eight produces a qualitatively different product, not just a slightly better one.

These strategies do not require new MCP tools or a new UI layer. They are principally interventions in what Flint says, when it says it, and how it structures its responses.

---

## Framing: The Two Users We Are Onboarding

Every strategy in this document must serve both users well, or it must explicitly state which one it is for.

**The Designer** uses Flint Glass for visual work and drops into IDE chat to ask about governance, get health scores, and understand violations. She speaks in design language: "does this component match our brand?", "is this accessible?", "why is this blocked from export?" She does not know what `MITH-001` means. She should not need to.

**The Developer** codes in the IDE all day. She wants violations caught inline, quick fixes that don't break her git flow, and assurance that her PR will pass the governance gate. She speaks in code language: "audit this file", "what's blocking export?", "fix the linter errors." She can read a SARIF file but does not want to.

Neither user should have to read documentation to accomplish their first real task.

---

## Strategy Index

| # | Name | When | Audience | Complexity |
|---|------|------|----------|------------|
| 1 | The Greeter | First tool-list render | Both | Low |
| 2 | Persona Handshake | Session 1 — after first user message | Both | Low |
| 3 | The Five-Tool Aperture | Every session | Both | Medium |
| 4 | Context-First Briefing | Session start when project state exists | Both | Low |
| 5 | Natural Language Router | Every user message | Both | Medium |
| 6 | The Momentum Loop | After any resolved violation | Both | Low |
| 7 | The Breadcrumb Trail | After successful task completion | Both | Medium |
| 8 | Graceful Darkness | When Flint cannot help | Both | Low |

---

## Strategy 1: The Greeter

**Name:** The Greeter

**The Moment:** The very first time an MCP client calls `list_tools` and receives the Flint tool catalog. This is the first contact event.

**The User Sees:**

In Claude Code / Cursor / VS Code Copilot Chat, after the tool list is loaded, the system message includes a directive from the Flint MCP server's initialization response:

```
Flint is connected. 45 governance tools are available.

You are new here. Before using any tools, read flint://capabilities
for a 90-second orientation, or say "what can Flint do?" to get started.

If you already know Flint, read flint://session-context for your
project's current state.
```

This message appears as a system-level annotation in the tool list, not as a chat message. In Claude Code it renders as a note in the tool panel. In Cursor it appears as a tooltip on the MCP provider. The exact rendering depends on the host.

**What Happens Behind the Scenes:**

The MCP SDK allows a server to return a `meta` or `instructions` field in the `initialize` response. Flint populates this field with a one-paragraph welcome message and the pointer to `flint://capabilities`. No new tools or resources needed. This is a change to one field in `server.ts`.

The critical addition: the welcome message branches on whether `.flint/context.json` exists and has a non-trivial `healthGrade`. If it does, the project has prior Flint history and the user is likely returning — skip the "you are new here" framing and jump directly to the context briefing (Strategy 4). If it does not, the full welcome message runs.

**Why It's Brilliant:**

The behavioral insight here is that people who feel lost do not explore — they leave. The greeter does not teach Flint. It removes the initial paralysis by naming two specific next moves: read the capabilities resource, or ask a natural language question. Both paths lead to the same place: understanding what Flint can do. But one requires the user to know they should read a resource, and the other requires them to do nothing but type a sentence they already know how to type.

The secondary insight: routing returning users past the greeter entirely respects their time. Nothing destroys trust in a tool faster than a tutorial you have already completed appearing again uninvited.

**Implementation Complexity:** Low

- Add `instructions` field to MCP `initialize` response in `flint-mcp/src/server.ts`
- Read `.flint/context.json` to detect returning vs new session
- Two branches: new-project welcome (Strategy 1) vs context briefing (Strategy 4)
- No new files, no new tools, no schema changes
- Estimated: half a day including tests

**Audience:** Both

---

## Strategy 2: The Persona Handshake

**Name:** The Persona Handshake

**The Moment:** Session 1 — specifically, after the user sends their very first message to Flint. The content of that message is the signal.

**The User Sees:**

If the user's first message is design-flavored ("does this look right?", "is this accessible?", "does this match our brand?", "check my component"):

```
Got it — you're asking from a design perspective. I'll give you
answers in plain language: no MITH codes, no SARIF, just what's
working and what isn't.

Let me check your active file...

[calls flint_get_context, then flint_audit]

Your Button component has 2 issues:

  Brand color drift — the button's blue is slightly off from your
  brand. Easy fix, one click.

  Missing accessible name — screen readers can't identify this
  button. Also auto-fixable.

Say "fix both" to resolve them, or "explain the color one" if
you want to understand what's happening.
```

If the user's first message is developer-flavored ("audit this file", "what's blocking CI", "check for WCAG violations"):

```
Running audit on the active file...

[calls flint_get_context, then flint_audit]

Button.tsx — 2 violations:
  MITH-001  color-drift    ΔE=3.8   auto-fixable
  A11Y-014  missing-label           auto-fixable

Health: 78/100 (C). Export is not blocked.

Run `flint_fix` with healOnAudit:true to auto-resolve both,
or review individual violations with flint://violations/Button.tsx.
```

Same tool calls. Same underlying data. Two completely different voices.

**What Happens Behind the Scenes:**

The agent implementing the session persona reads `flint://session-context` on first user message. It applies a simple intent classifier (matching on vocabulary from the user's message) identical in structure to the one already in `workflow-guide.ts` — the `buildIntentRecommendation` pattern already exists and can be extracted into a shared utility. Based on the classification result, the agent selects one of two response templates: `design-voice` or `developer-voice`.

This is not a new MCP tool. It is a behavior of the agent interpreting Flint's responses, driven by the `flint-workflow-guide` prompt being loaded in the IDE's system context. The prompt already contains the workflow sequences; the handshake extends it with persona detection and output formatting rules.

The key mechanism: write a `persona` hint into `.flint/context.json` once detected (e.g., `"sessionPersona": "designer"`) so that all subsequent tool responses in that session use the same voice. The context push manager (ACX.2 — `contextPush.ts`) already watches this file, so any Glass state update can react to the persona hint as well.

**Why It's Brilliant:**

Most onboarding asks users to configure themselves: "select your role," "pick your experience level." This approach is passive — it reads the user's natural behavior instead of asking them to describe it. The user gets the right voice without ever being asked what kind of user they are. Linear uses this pattern in their issue triage flow. Stripe uses it in their documentation (the language on a page shifts based on whether you arrived from the React SDK docs or the API reference).

The second insight: the handshake happens in response to real work, not a configuration step. By the time the persona is detected, Flint has already done something useful. The user experiences the personalization as a byproduct of getting a good answer, not as a prerequisite to getting any answer at all.

**Implementation Complexity:** Low

- Extend `flint-workflow-guide` prompt with persona detection logic and two response templates
- Add `sessionPersona` field to the `FlintContext` type in `flint-mcp/src/types.ts` and `useContextSync.ts`
- Write persona hint to `.flint/context.json` on first classification (via a lightweight file write in the MCP response handler — not via IPC)
- Extract `containsAny` / intent matching from `workflow-guide.ts` into a shared `intentClassifier.ts` utility
- Estimated: 1–2 days including tests

**Audience:** Both

---

## Strategy 3: The Five-Tool Aperture

**Name:** The Five-Tool Aperture

**The Moment:** Every session — but most importantly, the first 10 sessions. This strategy controls what the agent presents to the user as Flint's capability surface.

**The User Sees:**

The agent, loaded with the `flint-workflow-guide` prompt, never presents the raw list of 45 tools. Instead, it presents task-oriented options derived from the user's intent:

```
Here is what Flint can do right now, based on your project:

  Check my code        — audit violations in the active file
  Fix what's broken    — auto-apply high-confidence fixes
  See project health   — get your design debt score and grade
  Understand a token   — look up what a design token means
  Prepare to ship      — run the pre-release governance gate

What would you like to do?
```

This is not a menu. It is a suggested set of natural language continuations that the agent generates based on project state. "Prepare to ship" only appears if there are no active export blocks. "Fix what's broken" only appears if the last audit found auto-fixable violations.

Behind the 5 starter options is the full 45-tool catalog, accessible by asking "what else can Flint do?" The aperture opens on demand.

**What Happens Behind the Scenes:**

`flint://session-context` already contains enough information to generate these context-sensitive suggestions:
- `activeFile` — know what file is open
- `exportBlocked` — know if export is blocked
- `healthGrade` — know project health state
- `violationTotal` — know if there are violations to fix

The `flint-workflow-guide` prompt is extended with a "session starter" section that maps project state signals to starter option sets. The agent generates the 5 options from this template and the live context — no new tools needed.

The "what else can Flint do?" path loads `flint://capabilities` and presents the full catalog organized by task category, not tool name. Tool names are disclosed in parentheses after the task description: "Audit a file (flint_audit)" so power users can call tools directly.

**Why It's Brilliant:**

45 undifferentiated options produce choice paralysis. 5 context-relevant options produce action. This is the core insight from both Hick's Law and every successful developer tool first-run in the last decade. Stripe's dashboard doesn't show you all 400 API endpoints on login — it shows you "create a payment link," "add a product," "view recent activity." The 400 endpoints are there and accessible. They just don't compete for attention at the moment they are least needed.

The context-sensitivity is the differentiating factor from a static help menu. "Fix what's broken" disappearing when there's nothing to fix reinforces that Flint is live and aware — it's watching the project, not just sitting there waiting to be asked.

**Implementation Complexity:** Medium

- Add "session starter" section to `flint-workflow-guide` prompt in `workflow-guide.ts`
- Define starter option templates mapped to project-state conditions in a new `starterOptions.ts` utility
- Extend `flint://capabilities` response to include task-grouped tool organization alongside the existing full catalog
- Add `starterOptions` field to `getWorkflowGuideContent()` output when `flint://session-context` is available
- Estimated: 2–3 days including tests

**Audience:** Both

---

## Strategy 4: The Context-First Briefing

**Name:** The Context-First Briefing

**The Moment:** Session start — specifically for returning users when `.flint/context.json` exists with substantive project state. Also applicable when the user switches active files in their IDE.

**The User Sees:**

At the start of a session for a returning user, before any user message, the agent sends an unprompted briefing:

```
Flint is connected. Here's where your project stands:

  Health score   B+  (82/100) — up 12 points since last Tuesday
  Active file    src/components/Button/Button.tsx
  Open issues    3 violations, 2 auto-fixable
  Export gate    Open — you can ship when ready

Last session: fixed 6 violations in Card.tsx and Header.tsx.
Still open from last session: 1 contrast violation in Footer.tsx.

What would you like to work on?
```

The "last session" summary is derived from the mutations ledger (INFRA.2 — already online). The health trend requires the debt report service (already online via `flint_debt_report`). Everything here is already computable.

**What Happens Behind the Scenes:**

The `flint://session-context` resource already aggregates `activeFile`, `exportBlocked`, `healthGrade`, and `violationTotal`. The new addition is a `sessionSummary` field that queries the mutations ledger for the most recent session's activity:

```json
{
  "sessionSummary": {
    "lastSessionDate": "2026-03-22",
    "fixedFiles": ["Card.tsx", "Header.tsx"],
    "fixedViolationCount": 6,
    "openFromLastSession": [
      { "file": "Footer.tsx", "rule": "A11Y-010", "description": "insufficient contrast" }
    ]
  }
}
```

The `flint-workflow-guide` prompt reads this field and, when present, opens with the context briefing template before showing any workflow options. This replaces the "new user" greeter (Strategy 1) for returning sessions.

For the health trend, `flint_debt_report` is called with `mode: "trend"` and the result is formatted as a single line: "up 12 points since last Tuesday."

**Why It's Brilliant:**

This is the behavioral pattern Notion uses in their "catch up" feature and Linear uses when you re-open a project: show the delta since you were last here, not the current state in isolation. Current state is table stakes. The delta is the story. "Up 12 points since last Tuesday" triggers a positive emotion that "82/100" alone does not — it contextualizes the number as progress, not just a score.

The open-from-last-session surfacing solves the memory discontinuity problem identified in `CHAT-UX-CRITIQUE.md` section 12. The developer doesn't have to remember that Footer.tsx still has a violation. Flint remembers for her. This is the beginning of a long-term relationship with the codebase, not just a one-off tool call.

**Implementation Complexity:** Low

- Add `sessionSummary` field to the `SessionContext` type in `types.ts`
- Extend `assembleSessionContext()` in `sessionContext.ts` to query the mutations ledger (INFRA.2 already provides the query surface via `mutationProvenanceService.ts`)
- Add context briefing template to `flint-workflow-guide` prompt with conditional rendering on `sessionSummary` presence
- No new tools, no new resources — this is a data surface expansion of an existing resource
- Estimated: 1 day including tests

**Audience:** Both

---

## Strategy 5: The Natural Language Router

**Name:** The Natural Language Router

**The Moment:** Every user message that Flint receives. This is the core translation layer between human intent and tool execution.

**The User Sees:**

The user types a question in plain English. Flint understands it and acts.

Designer path:
```
User: Is this button accessible?

Flint: [reads context, runs audit on active file]

       Your button passes most accessibility checks.

       One issue: it has no accessible name. Screen readers will
       announce it as "button" — which tells the user nothing about
       what clicking it does.

       Fix: add an aria-label or make sure the button has visible
       text content.

       Want me to fix it? I'll add aria-label="Submit form" based
       on the surrounding context.
```

Developer path:
```
User: What's blocking my PR?

Flint: [reads context, checks export gate, runs audit]

       Nothing is currently blocking export.

       2 advisory violations in Button.tsx (not blocking):
         - MITH-001: color drift ΔE=1.8 (below blocking threshold)
         - A11Y-014: missing aria-label (severity: warning)

       Your PR will pass the Flint gate as-is. If you want to
       clean these up anyway: flint_fix with healOnAudit:true
       handles both automatically.
```

**What Happens Behind the Scenes:**

The intent classifier (already scaffolded in `workflow-guide.ts` as `buildIntentRecommendation`) is extended into a full Natural Language Router. The router maps user messages to one of the common workflow patterns and executes them — the agent does not just recommend a workflow, it initiates one.

The router handles these intent families:

| User says | Mapped workflow | Primary tools called |
|-----------|----------------|---------------------|
| "is this accessible?" | audit-accessibility | flint_get_context, flint_audit (a11y only) |
| "does this match our brand?" | audit-mithril | flint_get_context, flint_audit (mithril only) |
| "what's blocking export?" | export-gate-check | flint_get_context, flint_audit (critical only) |
| "fix this" / "clean this up" | audit-then-fix | flint_get_context, flint_audit, flint_fix |
| "how is the project doing?" | health-overview | flint_debt_report, flint://dashboard |
| "what did we ship last sprint?" | provenance-query | flint_mutation_provenance (summary) |
| "migrate tokens" / "update tokens" | token-migration | flint_sync_tokens (diff-only first) |
| "check everything" | full-audit | flint_audit (all rules, all open files) |

For unknown intents, the router falls back gracefully (see Strategy 8).

The persona detection from Strategy 2 feeds into response formatting: the same tool outputs are narrated in design voice or developer voice based on the detected persona.

**Why It's Brilliant:**

The vocabulary tax documented in `CHAT-UX-CRITIQUE.md` section 2 is Flint's biggest adoption barrier. Requiring users to know the difference between `audit_ui_component` and `flint_audit` is asking them to have already learned Flint before they can use Flint. The Natural Language Router removes this prerequisite entirely.

The precedent to study is GitHub Copilot Chat's intent routing for "explain this code," "fix this bug," "write a test" — the user speaks in task language, the agent figures out what API to call. Flint needs this for governance tasks.

The important constraint: the router should be transparent about what it is doing. When it calls `flint_audit` in response to "is this accessible?", it should say so: "Running an accessibility audit on Button.tsx..." This builds user literacy over time — they start to understand the mapping between their natural language and Flint's tools without having to study a manual.

**Implementation Complexity:** Medium

- Extend intent classifier in `intentClassifier.ts` (new shared utility extracted from `workflow-guide.ts`) with the full intent family map above
- Add `executeWorkflow(intent, context)` function that maps intent to tool call sequence and executes it
- Extend `flint-workflow-guide` prompt with NL routing rules: "when the user says X, call Y before responding"
- Add persona-conditioned response formatting to all primary tool call results
- This is primarily prompt engineering plus a shared utility file — no new MCP tools required
- Estimated: 3–4 days including tests

**Audience:** Both

---

## Strategy 6: The Momentum Loop

**Name:** The Momentum Loop

**The Moment:** After any violation is resolved — whether by `flint_fix`, `flint_ast_mutate`, or manual code edit that Flint's context push detects via ACX.2.

**The User Sees:**

```
Fixed. Here's what changed:

  Button.tsx line 4
  Before: bg-[#3B82F6]
  After:  bg-brand-blue

  Color drift: ΔE=5.2 → ΔE=0.1. Resolved.

Project health: 83/100 — up 1 point (C+ → B-)

2 issues remain in this file.
Want to fix the remaining ones? (2 are auto-fixable)
```

The momentum loop has three components:
1. A clear before/after statement of what changed (not raw JSON)
2. A project health delta — not just the score, the movement
3. A natural continuation prompt — what to do next

**What Happens Behind the Scenes:**

This builds directly on the "summary" field proposal in `CHAT-UX-CRITIQUE.md` section 2. The mutation response from `flint_ast_mutate` and `flint_fix` is enriched with:

```json
{
  "summary": "Changed bg-[#3B82F6] → bg-brand-blue on Button (line 4). Color drift ΔE=5.2 → ΔE=0.1. Resolved.",
  "projectDelta": {
    "previousScore": 82,
    "currentScore": 83,
    "previousGrade": "C+",
    "currentGrade": "B-",
    "remainingInFile": 2,
    "remainingAutoFixable": 2
  },
  "nextStep": "2 auto-fixable violations remain in Button.tsx. Say 'fix the rest' to resolve them."
}
```

The `projectDelta` requires a fresh `flint_debt_report` call after each fix. This is a small overhead (the report is already generated by the debt service). The delta between the pre-fix and post-fix score is the motivation signal.

The `summary` field follows the pattern defined in CX.3 (Error Taxonomy, already online) — plain English narration of what the tool did, using the same vocabulary that explains what went wrong.

**Why It's Brilliant:**

This is the Duolingo streak mechanism applied to governance work. Every resolved violation should feel like a small win, not a log entry. The health score movement is the critical element — "up 1 point" sounds trivial but activates the same completion motivation as a progress bar filling. When the user has been at B- for two days and suddenly sees B, they want to keep going.

The "remaining violations" continuation is drawn from Linear's habit design: after closing an issue, Linear immediately shows what's next in the queue. The user never has to ask "what should I do now?" — the system answers the question before it is asked.

This also solves the "I Did Something" problem from `CHAT-UX-CRITIQUE.md` section 7. The mutation confirmation is no longer a JSON blob — it is a sentence that says what happened, why it mattered, and what to do next.

**Implementation Complexity:** Low

- Add `summary`, `projectDelta`, and `nextStep` fields to fix and mutation tool responses
- Implement `buildMutationSummary(beforeState, afterState, projectDelta)` utility in `flint-mcp/src/core/formatters.ts` (already exists, needs extension)
- Call `generateDebtReport()` pre- and post-fix to compute delta (already available via `debtReportService.ts`)
- The response shape is additive — no breaking changes to existing tool consumers
- Estimated: 1–2 days including tests

**Audience:** Both

---

## Strategy 7: The Breadcrumb Trail

**Name:** The Breadcrumb Trail

**The Moment:** After a multi-step task is completed (e.g., an audit-then-fix flow, a Figma import, a token migration). Also: at the start of a new session when the previous session left work incomplete.

**The User Sees:**

After completing an audit-then-fix session:

```
Session summary:

  Files touched      3 (Button.tsx, Card.tsx, Header.tsx)
  Violations fixed   8
  Health change      C (71) → B- (83)

  Still open:
    Footer.tsx — 1 contrast violation (needs manual review —
    auto-fix would change your footer background color)

  Deferred by you:
    Navbar.tsx — 2 spacing violations (you said "not now")

Next time you work on this project, I'll remind you about Footer.tsx.
```

And at the start of the next session:

```
Welcome back. Last session (2 days ago) you fixed 8 violations
and deferred 3.

  Still waiting:
    Footer.tsx — contrast violation you flagged for manual review
    Navbar.tsx — 2 spacing violations you deferred

Want to tackle these now, or keep going on Button.tsx?
```

**What Happens Behind the Scenes:**

This extends Strategy 4 (Context-First Briefing) with a deferred-violation journal. The mutations ledger (INFRA.2) tracks what was fixed. The missing complement is a "deferred" or "acknowledged" state for violations that the user explicitly skips.

A new `deferred_violations` table in `flint.db`:

```
id, file_path, rule_id, node_id, deferred_at, reason, session_id
```

When the user says "not now," "skip this," "I'll handle this later," or explicitly dismisses a violation in the Glass GovernanceOverlay, the violation is written to `deferred_violations`. The Natural Language Router (Strategy 5) detects deferral intent and triggers this write via a new `flint_defer_violation` tool (or via an `acknowledge` flag on the existing `flint_audit` response).

The session context assembler reads `deferred_violations` and includes them in `sessionSummary.openFromLastSession`. This is how the next session knows what was left behind.

The "next time I'll remind you" promise is fulfilled by the Context-First Briefing (Strategy 4) surfacing deferred violations at session start.

**Why It's Brilliant:**

This closes the memory discontinuity identified in `CHAT-UX-CRITIQUE.md` section 12 in the most behaviorally powerful way possible: by making Flint feel like it remembers the conversation, not just the code. The developer doesn't have to maintain a mental model of what's been fixed and what hasn't — Flint maintains it for her.

The deferral mechanism is also important for trust. Governance tools that cannot accept "not now" feel coercive. By recording deferrals explicitly and surfacing them later (rather than re-flagging them every session as if they are new), Flint demonstrates that it respects the developer's judgment while still ensuring that deferred work is not forgotten.

**Implementation Complexity:** Medium

- Add `deferred_violations` table to `flint.db` schema (migration in `electron/store.ts`)
- Add `flint_defer_violation` tool to MCP server — parameters: `file`, `ruleId`, `nodeId`, `reason?`
- Extend `assembleSessionContext()` to query deferred violations and include in `sessionSummary`
- Add deferral intent detection to the Natural Language Router (Strategy 5): "skip this," "not now," "defer"
- Add "Deferred" badge to GovernanceOverlay in Glass for violations in the deferred table
- IPC channel: `governance:defer-violation` — follows existing IPC patterns
- Estimated: 3–4 days including tests

**Audience:** Both

---

## Strategy 8: Graceful Darkness

**Name:** Graceful Darkness

**The Moment:** When Flint cannot satisfy a user's request — the tool returns an error, the intent is outside Flint's scope, or the user asks something Flint fundamentally cannot answer.

**The User Sees — Scenario A: Tool error, recoverable:**

```
Something went wrong running the audit.

The file may have changed since the last context read.
Let me refresh and try again.

[calls flint_get_context, retries flint_audit]

[if retry succeeds]: Got it — running on the fresh version now.
[if retry fails]: Still failing. Error: [human-readable error from
error taxonomy]. Here's what to try next: [recovery instruction].
```

**The User Sees — Scenario B: Out-of-scope request:**

```
User: Can you help me redesign the navigation layout?

Flint: That's outside what I can govern directly. Flint checks
       your existing code against your design system — it doesn't
       generate new layouts from scratch.

       What I can do:
         - Audit your current navigation for design system violations
         - Tell you if your token usage matches your brand
         - Check WCAG compliance on your nav elements

       For layout generation, try Flint's intent composer in
       conjunction with your IDE's code generation tools.

       Want me to audit what you have now?
```

**The User Sees — Scenario C: Ambiguous intent:**

```
User: Fix everything.

Flint: I can do that — want me to:

       A) Fix all auto-fixable violations in the active file (8 violations)
       B) Fix all auto-fixable violations across the whole project (47 violations)
       C) Fix only critical violations that are blocking export (0 right now)

       Which scope? (Or say "all of the above" to start with A.)
```

**What Happens Behind the Scenes:**

Scenario A uses the error taxonomy (CX.3, already online) to translate raw MCP errors into human-readable messages with recovery instructions. The auto-retry pattern (read context, retry once) is defined in the `flint-workflow-guide` prompt as a standing instruction: "if flint_audit returns an error, always call flint_get_context first and retry once before reporting failure."

Scenario B uses a scope boundary definition in the `flint-workflow-guide` prompt: a list of what Flint does and does not do, expressed as natural language, so the agent can recognize out-of-scope requests and redirect gracefully rather than attempting to use tools inappropriately.

Scenario C uses clarification templates in the prompt: when "fix" or "audit" is used without a scope qualifier, the agent generates two or three scope options based on project state rather than guessing or asking an open-ended question.

**Why It's Brilliant:**

Tool abandonment overwhelmingly occurs at the first failure, not the second or third. If the first time something goes wrong, the user sees a stack trace or a terse "error" response, they close the tab. If they see "something went wrong, let me try again," they wait. The behavioral difference between these two experiences is enormous and costs almost nothing to achieve.

Scenario C solves the ambiguity trap. "Fix everything" is a completely reasonable thing to say. An agent that responds with "please be more specific" is unhelpful. An agent that responds with a numbered list of plausible interpretations and a default recommendation is both helpful and educational. The user learns that Flint operates on scopes (file, project, severity) without being lectured about it.

**Implementation Complexity:** Low

- Add auto-retry instruction to `flint-workflow-guide` prompt
- Add scope boundary description to prompt (what Flint does / does not do)
- Add ambiguity resolution templates for the five most common underspecified commands: "fix everything," "audit everything," "check this," "clean this up," "what's wrong?"
- CX.3 error taxonomy is already online — this is prompt configuration that wraps the existing error codes in conversational language
- Estimated: 1 day

**Audience:** Both

---

## Compound Effect: What All Eight Look Like Together

When all eight strategies are active, a first-time user's first session looks like this:

1. Flint connects. They see a one-line greeting that points to two specific next moves (Strategy 1).
2. They type: "Does my button match our brand?" — design language.
3. Flint detects designer persona, acknowledges it implicitly by answering in plain English (Strategy 2).
4. Flint offers 5 context-relevant options for what to do next (Strategy 3).
5. "Check my color" is routed to `flint_get_context` + `flint_audit` without the user knowing the tool names (Strategy 5).
6. The audit finds 2 violations. Flint narrates them in design language with fix suggestions.
7. The user says "fix both." Flint fixes them. The response confirms what changed, shows the health score improved, and suggests what to do next (Strategy 6).
8. Session ends. Flint writes a summary to `.flint/context.json` (Strategy 7).

The next session:

1. Flint opens with a briefing: "Welcome back. You're at B+. You fixed 2 violations Tuesday. One thing is still open in Footer.tsx." (Strategy 4).
2. The user works. At one point says "skip the footer one for now."
3. Flint records the deferral, stops surfacing it. Next session will still surface it as "deferred last week." (Strategy 7).

What was a 45-tool API surface that required documentation to navigate is now a conversation partner that speaks the user's language, remembers their context, and tells them what to do next.

---

## Implementation Priority

Not all eight strategies are equal effort. The following ordering maximizes impact per day of engineering work.

### Tier 1 — Ship in Sprint N (1 week, highest impact):

| Strategy | Why first | Estimated effort |
|----------|-----------|-----------------|
| Strategy 1 (The Greeter) | Removes first-contact paralysis. 1 field in server.ts. | 0.5 days |
| Strategy 6 (The Momentum Loop) | Fixes the "JSON blob confirmation" problem. Every fix feels rewarding. | 1.5 days |
| Strategy 8 (Graceful Darkness) | Prevents abandonment at first failure. Prompt configuration only. | 1 day |
| Strategy 4 (Context-First Briefing) | Returning user experience. Data already exists in session context. | 1 day |

Total Tier 1: approximately 4 days.

### Tier 2 — Sprint N+1 (1 week, medium effort):

| Strategy | Why second | Estimated effort |
|----------|------------|-----------------|
| Strategy 2 (Persona Handshake) | Persona detection unlocks everything downstream. | 1.5 days |
| Strategy 5 (Natural Language Router) | The core translation layer. Requires persona detection from Strategy 2. | 3 days |

Total Tier 2: approximately 4.5 days.

### Tier 3 — Sprint N+2 (1 week, requires new DB work):

| Strategy | Why third | Estimated effort |
|----------|-----------|-----------------|
| Strategy 3 (Five-Tool Aperture) | Requires context-sensitive starter options; best after NL router is working. | 2.5 days |
| Strategy 7 (Breadcrumb Trail) | Requires new DB table; highest behavioral payoff but depends on deferral model. | 3.5 days |

Total Tier 3: approximately 6 days.

---

## Phasing Recommendation

Phase these as **Phase OB.1 (Onboarding Layer — Tier 1)** and **Phase OB.2 (Onboarding Layer — Tier 2/3)** in the BACKLOG-PRIORITIZED.md. Both are P1 priority given the Go-to-Market plan (GO-TO-MARKET-PLAN.md) calls for shipping the MCP engine to real users in weeks 1–2. The first impression of Flint is determined by what Flint says when it connects. That needs to be right before external users see it.

---

## What This Does Not Do

These strategies do not add a visual chat interface to Flint Glass. Chat lives in the IDE (Claude Code, Cursor, VS Code). Glass is the observability layer. These strategies improve the quality of Flint's responses within existing IDE chat surfaces.

These strategies do not require the user to complete a tutorial, fill out a form, or answer configuration questions. Every strategy activates from natural user behavior: connecting, typing their first message, getting their first result.

These strategies do not change the tool catalog. The 45 tools remain. The Natural Language Router adds a translation layer on top of them; it does not replace them. Power users and CI pipelines can still call `flint_audit` directly with full parameter control.

---

## Test Ownership

For any strategy that reaches implementation:

- **Test suite:** `cd flint-mcp && npm test` for all prompt and response shape changes; `npm run test:react` for any Glass-side deferral badges (Strategy 7)
- **Required test types:**
  - Unit: intent classifier — verify correct workflow mapping for each intent family
  - Unit: `buildMutationSummary()` — verify before/after narration for each op type
  - Unit: `assembleSessionContext()` — verify `sessionSummary` includes deferred violations
  - Integration: `flint://session-context` resource — verify full shape including `sessionSummary`
  - Integration: `flint_defer_violation` tool — round-trip write to DB and read via session context
  - IPC round-trip (Strategy 7): `governance:defer-violation` channel — verify write and GovernanceOverlay state update
- **Who writes tests:** The implementing agent writes tests as part of the same task. Not a separate pass.

---

## Appendix: Key Files Affected

| File | Strategy | Change type |
|------|----------|-------------|
| `flint-mcp/src/server.ts` | 1 | Add `instructions` field to initialize response |
| `flint-mcp/src/prompts/workflow-guide.ts` | 2, 3, 5, 8 | Extend with persona detection, starter options, NL routing, graceful darkness |
| `flint-mcp/src/core/intentClassifier.ts` | 2, 5 | New shared utility — extracted from workflow-guide.ts |
| `flint-mcp/src/core/sessionContext.ts` | 4, 7 | Add `sessionSummary` field to SessionContext assembly |
| `flint-mcp/src/core/formatters.ts` | 6 | Add `buildMutationSummary()` and `projectDelta` computation |
| `flint-mcp/src/types.ts` | 2, 4, 7 | Add `sessionPersona`, `sessionSummary` to FlintContext type |
| `electron/store.ts` | 7 | Add `deferred_violations` table migration |
| `src/components/editor/GovernanceOverlay.tsx` | 7 | Add Deferred badge state |
| `src/hooks/useContextSync.ts` | 2 | Write `sessionPersona` hint to `.flint/context.json` |

---

Sources:
- [Linear Onboarding — Hands-on Learning & Cinematic Transition](https://medium.com/design-bootcamp/hands-on-learning-cinematic-transition-linears-thoughtful-onboarding-aa4f16c33d90)
- [54 Patterns for Building Better MCP Tools](https://www.arcade.dev/blog/mcp-tool-patterns)
- [MCP Server Best Practices for 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026)
- [Progressive Disclosure UX — IxDF](https://ixdf.org/literature/topics/progressive-disclosure)
- [MCP Apps — Bringing UI Capabilities to MCP Clients](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
