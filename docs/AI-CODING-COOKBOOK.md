# The AI Coding Cookbook

> Working examples, templates, and copy-paste recipes for the practical mechanics referenced in the [AI Coding Playbook](./AI-CODING-PLAYBOOK.md).

**Status:** Mixed. **5 recipes are fully worked** (Part 15, #75–79) with real code, file references, and steps. The other 74 are still one-line stubs that fill in across subsequent rounds.

**Companion to:** [AI-CODING-PLAYBOOK.md](./AI-CODING-PLAYBOOK.md) — the playbook teaches the *thinking*; the cookbook teaches the *doing*.

**Audience:** People who read the playbook, agreed with the principles, and want to implement them. Bring a working AI coding setup (Claude Code, Cursor, or similar) and follow along.

**Format per recipe:**
- **What it does** — one-paragraph summary
- **When to use** — situations where this recipe applies
- **Working example** — actual code/config, not pseudo-code
- **How to customize** — parameters and variations
- **Pitfalls** — what goes wrong, how to recover

**Tool-neutral where possible.** Where tool-specific (Claude Code hooks, MCP servers, etc.), labeled clearly so non-Claude-Code users can adapt or skip.

---

## Start here — fully worked recipes

If you only have time for the working content, jump straight to these. Each is grounded in real Flint source files, includes the actual code, and explains the pitfalls. The rest of the cookbook is a roadmap of recipes still being filled in.

| # | Recipe | What you'll come away with |
|---|--------|-----------------------------|
| [75](#75-setting-up-a-contract-first-feature-end-to-end) | Setting up a contract-first feature end-to-end | A working `.contract.ts` plus the surrounding workflow — branch, declare territory, lint, parallel implementation, review |
| [76](#76-writing-a-review-ceremony-reviewer-agent) | Writing a review-ceremony reviewer agent | Three-reviewer dispatch pattern, a reusable reviewer prompt skeleton, and the `.review.ts` output shape |
| [77](#77-wiring-a-sessionstart-hook) | Wiring a SessionStart hook | A working hook script + `settings.json` entry that runs at every session start |
| [78](#78-adding-an-mcp-tool) | Adding an MCP tool | Tool registration, handler file, wiring, and tests — end to end |
| [79](#79-running-an-ab-test-on-your-prompts) | Running an A/B test on your prompts | A falsifiable-hypothesis template plus the actual measured results from Flint's MINT.5 test |

Stubs throughout the cookbook link back to these where they apply.

---

## Table of Contents

### Part 1 — Workflow scaffolding
1. [HANDOFF.md template and flow](#1-handoffmd-template-and-flow)
2. [Territory declaration template](#2-territory-declaration-template)
3. [Architectural constitution starter](#3-architectural-constitution-starter)
4. [Architecture Decision Record (ADR) template](#4-architecture-decision-record-adr-template)

### Part 2 — Contract-First development
5. [Prose contract template](#5-prose-contract-template)
6. [Executable `.contract.ts` template](#6-executable-contractts-template)
7. [Contract linter — the Phase 1.5 gate](#7-contract-linter--the-phase-15-gate)
8. [Test scaffolding from contract](#8-test-scaffolding-from-contract)

### Part 3 — Review ceremonies
9. [Three-reviewer parallel ceremony](#9-three-reviewer-parallel-ceremony)
10. [Review schema — `ReviewFinding` and `.review.ts`](#10-review-schema--reviewfinding-and-reviewts)
11. [Verdict derivation from severity counts](#11-verdict-derivation-from-severity-counts)
12. [Regression canary configuration](#12-regression-canary-configuration)

### Part 4 — Building agents
13. [Anatomy of an agent definition (annotated)](#13-anatomy-of-an-agent-definition-annotated)
14. [Specialist agent — debugger](#14-specialist-agent--debugger)
15. [Specialist agent — reviewer](#15-specialist-agent--reviewer)
16. [Specialist agent — researcher](#16-specialist-agent--researcher)
17. [Specialist agent — architect](#17-specialist-agent--architect)
18. [Tool allowlist patterns](#18-tool-allowlist-patterns)
19. [Trust tier configuration](#19-trust-tier-configuration)
20. [Agent escalation rules](#20-agent-escalation-rules)

### Part 5 — MCP servers
21. [Minimal MCP server scaffold](#21-minimal-mcp-server-scaffold)
22. [Adding tools to an MCP server](#22-adding-tools-to-an-mcp-server)
23. [Adding resources to an MCP server](#23-adding-resources-to-an-mcp-server)
24. [Adding prompts to an MCP server](#24-adding-prompts-to-an-mcp-server)
25. [MCP server testing patterns](#25-mcp-server-testing-patterns)

### Part 6 — Hooks and automation
26. [SessionStart hook — auto memory import](#26-sessionstart-hook--auto-memory-import)
27. [UserPromptSubmit hook — context injection](#27-userpromptsubmit-hook--context-injection)
28. [PreToolUse hook — validation gate](#28-pretooluse-hook--validation-gate)
29. [PostToolUse hook — logging and audit](#29-posttooluse-hook--logging-and-audit)
30. [File watcher pattern (event-driven automation)](#30-file-watcher-pattern-event-driven-automation)
31. [Background process lifecycle (start, monitor, kill)](#31-background-process-lifecycle-start-monitor-kill)
32. [Scheduled task with cache-aware cadence](#32-scheduled-task-with-cache-aware-cadence)

### Part 7 — Slash commands and shortcuts
33. [Minimal slash command](#33-minimal-slash-command)
34. [Slash command with arguments](#34-slash-command-with-arguments)
35. [Slash command that calls an MCP tool](#35-slash-command-that-calls-an-mcp-tool)
36. [Slash command that dispatches an agent](#36-slash-command-that-dispatches-an-agent)

### Part 8 — Memory file templates
37. [User memory template](#37-user-memory-template)
38. [Feedback memory template](#38-feedback-memory-template)
39. [Project memory template](#39-project-memory-template)
40. [Reference memory template](#40-reference-memory-template)
41. [Memory index (`MEMORY.md`) format](#41-memory-index-memorymd-format)

### Part 9 — Settings and configuration
42. [`settings.json` — common patterns](#42-settingsjson--common-patterns)
43. [Permissions: allow / deny / ask](#43-permissions-allow--deny--ask)
44. [Environment variables for agents and hooks](#44-environment-variables-for-agents-and-hooks)
45. [Project-scoped vs user-scoped settings](#45-project-scoped-vs-user-scoped-settings)

### Part 10 — Observability and debugging
46. [Structured logging starter](#46-structured-logging-starter)
47. [React error boundary with logging](#47-react-error-boundary-with-logging)
48. [Diagnostic mode toggle](#48-diagnostic-mode-toggle)
49. [Cross-boundary call logging (IPC / network / file I/O)](#49-cross-boundary-call-logging-ipc--network--file-io)
50. [Telemetry event schema](#50-telemetry-event-schema)
51. [Dev-only state inspector panel](#51-dev-only-state-inspector-panel)
52. [Crash reporter wiring (Sentry / Bugsnag)](#52-crash-reporter-wiring-sentry--bugsnag)
53. [The "saw / expected / did" failure-report template (for users)](#53-the-saw--expected--did-failure-report-template-for-users)

### Part 11 — Security
54. [IPC validator (Zod schema at the preload bridge)](#54-ipc-validator-zod-schema-at-the-preload-bridge)
55. [Renderer hardening: sandbox + CSP](#55-renderer-hardening-sandbox--csp)
56. [Per-session secret pattern](#56-per-session-secret-pattern)
57. [Rate limiter (token bucket per route)](#57-rate-limiter-token-bucket-per-route)
58. [Safe storage for credentials](#58-safe-storage-for-credentials)
59. [Prompt injection defense — input quoting and source tagging](#59-prompt-injection-defense--input-quoting-and-source-tagging)
60. [Tool allowlist enforcement at the orchestrator](#60-tool-allowlist-enforcement-at-the-orchestrator)

### Part 12 — Shipping
61. [Code signing setup (macOS / Windows)](#61-code-signing-setup-macos--windows)
62. [Auto-update wiring (electron-updater)](#62-auto-update-wiring-electron-updater)
63. [Beta build with self-expiration](#63-beta-build-with-self-expiration)
64. [In-app feedback channel](#64-in-app-feedback-channel)
65. [License audit script](#65-license-audit-script)
66. [Release checklist (changelog, version bump, smoke test)](#66-release-checklist-changelog-version-bump-smoke-test)
67. [Deprecation cycle template](#67-deprecation-cycle-template)

### Part 13 — Efficiency
68. [Model tier router (Flash / Sonnet / Opus by complexity)](#68-model-tier-router-flash--sonnet--opus-by-complexity)
69. [Cache-aware polling pattern (270s / 1200s)](#69-cache-aware-polling-pattern-270s--1200s)
70. [Granular tool catalog vs raw code generation](#70-granular-tool-catalog-vs-raw-code-generation)
71. [Cost measurement per session](#71-cost-measurement-per-session)

### Part 14 — Process measurement
72. [A/B testing your workflow (the Lever E pattern)](#72-ab-testing-your-workflow-the-lever-e-pattern)
73. [Process post-mortem template](#73-process-post-mortem-template)
74. [Workflow metrics worth tracking](#74-workflow-metrics-worth-tracking)

### Part 15 — Working recipes (Round 2)
75. [Setting up a contract-first feature end-to-end](#75-setting-up-a-contract-first-feature-end-to-end)
76. [Writing a review-ceremony reviewer agent](#76-writing-a-review-ceremony-reviewer-agent)
77. [Wiring a SessionStart hook](#77-wiring-a-sessionstart-hook)
78. [Adding an MCP tool](#78-adding-an-mcp-tool)
79. [Running an A/B test on your prompts](#79-running-an-ab-test-on-your-prompts)

---

## Part 1 — Workflow scaffolding

### 1. HANDOFF.md template and flow
**What:** A canonical handoff document structure that future-you (or the next session) can pick up cold. Pairs with [Playbook Theme 6](./AI-CODING-PLAYBOOK.md#6-session-protocol-and-territory).

### 2. Territory declaration template
**What:** A simple file that declares which areas of the codebase you're touching. Prevents swarm conflicts when running multiple agents.

### 3. Architectural constitution starter
**What:** A markdown template for writing your project's invariants — the equivalent of our 16 Commandments. Includes a "retire a Commandment" mechanism to prevent dogmatic decay.

### 4. Architecture Decision Record (ADR) template
**What:** Nygard-style ADR format for documenting individual decisions. Pairs with the constitution: the constitution holds invariants, ADRs hold the reasoning behind them.

---

## Part 2 — Contract-First development

### 5. Prose contract template
**What:** Markdown contract structure (`.flint-context/contracts/<feature>-contract.md`) — the v1 form. Useful for simple features and as the human-readable companion to the executable contract.

### 6. Executable `.contract.ts` template
**What:** The TypeScript contract (`<feature>.contract.ts`) that Phase 2 implementers import. Includes `meta`, `Invariant[]`, `TestBoundary[]`, `IPCTriangle[]`, and `nonGoals[]`.

### 7. Contract linter — the Phase 1.5 gate
**What:** A linter that validates a contract before implementation. Checks that invariants have measurable thresholds, tests have given/when/then, IPC triangles link to validators.

### 8. Test scaffolding from contract
**What:** Generator that reads a `.contract.ts` and emits `it.todo` stubs in your test file. Implementers fill in the assertions; the test list is locked to the contract.

---

## Part 3 — Review ceremonies

### 9. Three-reviewer parallel ceremony
**What:** Orchestration pattern for dispatching UX, Code, and Security reviewers in parallel, plus a regression canary as backstop.

### 10. Review schema — `ReviewFinding` and `.review.ts`
**What:** TypeScript types for structured review output. Each reviewer emits a `.review.ts` sibling next to their markdown report.

### 11. Verdict derivation from severity counts
**What:** Function that takes a list of `ReviewFinding[]` and returns a verdict (`approve`/`fix`/`block`) based on severity counts. Removes reviewer subjectivity from the grading step.

### 12. Regression canary configuration
**What:** Setup for running an integration validator after the scoped reviewers finish. Catches what domain-scoped reviewers miss.

---

## Part 4 — Building agents

### 13. Anatomy of an agent definition (annotated)
**What:** A complete agent definition with every field annotated — what it does, why it matters, common mistakes.

### 14. Specialist agent — debugger
**What:** A debugger agent that knows your project's failure modes. Demonstrates Read+Bash+Grep tool allowlist, escalation prompt, instrumentation-first system prompt.

### 15. Specialist agent — reviewer
**What:** A reviewer agent that produces structured `.review.ts` output. Demonstrates Write tool, severity-based finding format, evidence requirement.

### 16. Specialist agent — researcher
**What:** A researcher agent for web validation. Demonstrates WebSearch/WebFetch, citation discipline, "say so when you can't find it" framing.

### 17. Specialist agent — architect
**What:** An architect agent that produces contracts. Demonstrates contract-first output, falsifiability checks, IPC triangle generation.

### 18. Tool allowlist patterns
**What:** Common tool-allowlist recipes by agent role: read-only research, write-allowed implementation, bash-allowed debugging, restricted-bash for security-sensitive contexts.

### 19. Trust tier configuration
**What:** A simple trust-tier service that promotes/demotes agents based on track record. Schema, transitions, persistence.

### 20. Agent escalation rules
**What:** Rules engine for "one failed fix → escalate." Pattern-matches agent failure modes to specialist routing.

---

## Part 5 — MCP servers

### 21. Minimal MCP server scaffold
**What:** A working MCP server in TypeScript using `@modelcontextprotocol/sdk`. Hello-world tool, hello-world resource, ready to extend.

### 22. Adding tools to an MCP server
**What:** Pattern for tool registration: schema, handler, error handling, response format.

### 23. Adding resources to an MCP server
**What:** Pattern for resource registration: URI scheme, list/read handlers, when to use resources vs tools.

### 24. Adding prompts to an MCP server
**What:** Pattern for prompt registration: arguments, message generation, when prompts beat tools.

### 25. MCP server testing patterns
**What:** Vitest patterns for MCP tool handlers, resource handlers, and end-to-end protocol testing.

---

## Part 6 — Hooks and automation

### 26. SessionStart hook — auto memory import
**What:** A hook that loads memory files at session start. Demonstrates the hook lifecycle, exit-code semantics, file path patterns.

### 27. UserPromptSubmit hook — context injection
**What:** A hook that injects relevant context (recent files, active branch, status) before each prompt. Pattern for keeping the model oriented.

### 28. PreToolUse hook — validation gate
**What:** A hook that gates risky tool calls (Bash, Write) by validating arguments before execution. Pattern for adding deterministic guardrails.

### 29. PostToolUse hook — logging and audit
**What:** A hook that logs every tool call (or a filtered subset) for audit/forensics. Pattern for compliance and debugging.

### 30. File watcher pattern (event-driven automation)
**What:** `fs.watch` setup for triggering work on file changes. Pairs with the MCP push channel pattern (Flint's `mcp-events.jsonl`).

### 31. Background process lifecycle (start, monitor, kill)
**What:** Patterns for background work: starting cleanly, monitoring health, killing reliably, recovering from crashes.

### 32. Scheduled task with cache-aware cadence
**What:** Cron / wake-up pattern that respects the LLM cache TTL — sleep under 270s or commit to 1200s+, never 300s.

---

## Part 7 — Slash commands and shortcuts

### 33. Minimal slash command
**What:** Simplest possible slash command: a markdown file in `.claude/commands/` that runs a fixed prompt.

### 34. Slash command with arguments
**What:** Slash command that takes `$ARGUMENTS` and forwards them into the prompt.

### 35. Slash command that calls an MCP tool
**What:** Slash command shaped as `/audit src/foo.tsx` that wraps an MCP tool invocation.

### 36. Slash command that dispatches an agent
**What:** Slash command that spawns a specialist agent with a pre-formatted brief.

---

## Part 8 — Memory file templates

### 37. User memory template
**What:** Frontmatter + body shape for `user_*.md` memories. Examples for role, expertise, communication preferences.

### 38. Feedback memory template
**What:** Frontmatter + body shape for `feedback_*.md` memories. Includes "Why" and "How to apply" structure to make rules portable.

### 39. Project memory template
**What:** Frontmatter + body shape for `project_*.md` memories. Examples for ongoing initiatives, deadlines, stakeholder asks.

### 40. Reference memory template
**What:** Frontmatter + body shape for `reference_*.md` memories. Examples for external systems, dashboards, account IDs.

### 41. Memory index (`MEMORY.md`) format
**What:** The shape of `MEMORY.md` — line-per-entry, under 150 chars per line, organized by topic not chronology.

---

## Part 9 — Settings and configuration

### 42. `settings.json` — common patterns
**What:** Annotated `settings.json` covering hooks, permissions, env vars, theme, model selection.

### 43. Permissions: allow / deny / ask
**What:** Pattern for setting tool-level and command-level permissions. Examples for common allowlists (npm, git, gh, jq).

### 44. Environment variables for agents and hooks
**What:** Common env vars (`ANTHROPIC_API_KEY`, `DEBUG`, project-specific paths) and how to scope them.

### 45. Project-scoped vs user-scoped settings
**What:** When to put a setting in `.claude/settings.json` (project) vs `~/.claude/settings.json` (user). Inheritance rules.

---

## Part 10 — Observability and debugging

### 46. Structured logging starter
**What:** A minimal structured-log setup with levels, JSON payloads, source tags. Pino, winston, and console.log baseline.

### 47. React error boundary with logging
**What:** Working error boundary that catches render errors, shows a fallback UI, logs to telemetry.

### 48. Diagnostic mode toggle
**What:** A debug flag (env var or settings flag) that turns on verbose logging without rebuilding.

### 49. Cross-boundary call logging (IPC / network / file I/O)
**What:** The "log before, log after" pattern for cross-process and cross-network calls.

### 50. Telemetry event schema
**What:** A minimal telemetry event shape (name, timestamp, properties, session ID) plus opt-in handling.

### 51. Dev-only state inspector panel
**What:** A panel that shows store state, IPC traffic, recent events. Visible only with the diagnostic flag set.

### 52. Crash reporter wiring (Sentry / Bugsnag)
**What:** Minimum setup to wire a crash reporter into a web or Electron app. Includes source map upload.

### 53. The "saw / expected / did" failure-report template (for users)
**What:** A copy-pasteable template designers and non-technical users can fill in when reporting a bug to AI. Pairs with [Playbook Theme 13](./AI-CODING-PLAYBOOK.md#13-when-things-break--describing-failure-to-ai).

---

## Part 11 — Security

### 54. IPC validator (Zod schema at the preload bridge)
**What:** A Zod schema setup for validating every IPC call at the boundary. Pattern from Flint's `shared/ipc-validators.ts`.

### 55. Renderer hardening: sandbox + CSP
**What:** Working sandbox + Content Security Policy for an Electron renderer or iframe preview surface.

### 56. Per-session secret pattern
**What:** Generate a secret at session start, hold in main process, never expose to renderer. For ingestion endpoints, internal APIs.

### 57. Rate limiter (token bucket per route)
**What:** A simple token-bucket rate limiter wrapped around an HTTP route or IPC channel.

### 58. Safe storage for credentials
**What:** Using Electron `safeStorage`, macOS Keychain, or Windows Credential Manager for API keys.

### 59. Prompt injection defense — input quoting and source tagging
**What:** Patterns for handling untrusted input that ends up in prompts (file contents, web data, tool results). Source-tag and quote.

### 60. Tool allowlist enforcement at the orchestrator
**What:** Where to enforce per-agent tool allowlists. Belt-and-suspenders with the agent's declared tools.

---

## Part 12 — Shipping

### 61. Code signing setup (macOS / Windows)
**What:** electron-builder configuration for signing on both platforms. Apple Developer ID + Windows EV cert.

### 62. Auto-update wiring (electron-updater)
**What:** Working auto-update setup with GitHub releases or S3 as the update channel.

### 63. Beta build with self-expiration
**What:** Pattern for builds that refuse to launch after N days. Forces iteration cadence on beta users.

### 64. In-app feedback channel
**What:** Minimal in-product feedback widget that posts to a webhook or email. No external services required.

### 65. License audit script
**What:** Script that scans dependencies for license compliance. Flag GPL/AGPL in commercial products.

### 66. Release checklist (changelog, version bump, smoke test)
**What:** A working release checklist that runs through TSC, tests, signing, smoke test, tag, and publish.

### 67. Deprecation cycle template
**What:** "Deprecated in N.M.0, removed in (N+1).0.0" pattern with migration notes and warning instrumentation.

---

## Part 13 — Efficiency

### 68. Model tier router (Flash / Sonnet / Opus by complexity)
**What:** A complexity classifier that routes tasks to the cheapest viable model. Pattern from Flint's `flint_assess_complexity`.

### 69. Cache-aware polling pattern (270s / 1200s)
**What:** Polling/wake-up logic that respects the 5-minute prompt cache TTL. Stay under 270s or commit to 1200s+.

### 70. Granular tool catalog vs raw code generation
**What:** Pattern for replacing "generate a file" with "emit a small structured op." Dramatically cuts tokens.

### 71. Cost measurement per session
**What:** Instrumentation for tracking tokens-per-feature, tokens-per-bug, tokens-per-review. Patterns for finding waste.

---

## Part 14 — Process measurement

### 72. A/B testing your workflow (the Lever E pattern)
**What:** How to A/B test your own process — define a hypothesis, run two arms, measure honestly, kill what doesn't work.

### 73. Process post-mortem template
**What:** Post-mortem template focused on *process failures* rather than code failures. What went wrong in your workflow, not just your output.

### 74. Workflow metrics worth tracking
**What:** Metrics that aggregate into useful patterns (rounds-of-rework, escalations, sessions-per-feature). Excludes vanity metrics.

---

## Part 15 — Working recipes (Round 2)

> These are fully worked examples — commands, file contents, and concrete steps — not just descriptions. Everything here has been done on the Flint project; file paths and commit references are real.

---

### 75. Setting up a contract-first feature end-to-end

**When to use this:** Any time you need to build something that touches more than one file, crosses the boundary between Electron and the React UI, or fans out to multiple AI agents working at the same time. Single-file fixes don't need this. Anything bigger does.

**What it solves:** Without a contract, two agents build parts that don't fit together. The contract is the shared blueprint both agents import — TypeScript enforces that they built the same thing.

**Reference:** `.claude/workflows/feature-build.md`, `shared/contract-schema.ts`, `.flint-context/contracts/UX-P0.contract.ts`

---

**Step 1 — Branch and declare territory**

```bash
# Create a feature branch (flint-git-guru handles this, but here's the manual form)
git checkout -b feat/N1-my-feature

# Declare which files you'll touch so other agents don't collide
# Edit .flint-context/ACTIVE-SWARM-TERRITORY.md and add your entries
```

**Step 2 — Write the contract (two files)**

Create `.flint-context/contracts/my-feature.md` (human-readable) and `.flint-context/contracts/my-feature.contract.ts` (machine-readable). The `.contract.ts` is what agents actually import.

Minimal `.contract.ts` shape — copy this and fill in the blanks:

```typescript
import type { FlintContract } from '../../shared/contract-schema';

// Export any shared types here so Phase 2 agents import from ONE place
export interface MyFeaturePayload {
  id: string;
  value: string;
}

export const CONTRACT: FlintContract = {
  meta: {
    name: 'MyFeature',
    phase: 'N.1',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-24',
    audience: 'designer', // one of: engine | designer | developer | ci
  },
  impact: [
    { file: 'electron/main.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Add IPC handler' },
    { file: 'src/store/editorStore.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'Add state slice' },
  ],
  ipc: [{
    channel: 'my-feature:do-thing',
    direction: 'renderer→main',
    payloadType: 'MyFeaturePayload',
    returnType: '{ ok: boolean }',
    handler: 'electron/main.ts',
    validator: 'myFeaturePayloadSchema', // Zod export in shared/ipc-validators.ts
  }],
  stores: [{
    store: 'editorStore',
    newState: { myFeature: 'MyFeatureSlice' },
    newActions: { setMyFeature: '(p: MyFeaturePayload) => void' },
    newSelectors: {},
  }],
  components: [],
  commandments: [1, 4, 12],
  testBoundaries: [{
    target: 'my-feature:do-thing handler',
    kind: 'ipc-handler',
    behavior: 'Accepts payload and writes to store',
    assertion: 'returns { ok: true }',
    edgeCases: ['missing id', 'empty value'],
    given: 'the IPC handler is registered',
    when: 'a valid MyFeaturePayload arrives from the renderer',
    then: 'returns { ok: true } and editorStore reflects the update',
  }],
  invariants: [{
    name: 'handler-latency-p95',
    measurable: 'p95 round-trip for my-feature:do-thing',
    threshold: '< 150ms at N=500',
    measuredBy: 'vitest bench',
  }],
  risks: [],
  parallelismGroups: {
    A: ['flint-electron-ipc', 'flint-state-architect'],
    B: ['flint-design-engineer'],
  },
  nonGoals: ['Cross-file undo for this feature', 'Real-time sync'],
};
```

**Step 3 — Lint the contract before you build**

```bash
# Spawn flint-contract-linter on your contract.
# It checks: falsifiable invariants, executable given/when/then,
# IPC triangle completeness, audience declared, nonGoals non-empty.
# Verdict is APPROVED or REVISE.
```

The linter checks 12 rules defined in `shared/contract-schema.ts` — the helpers `validateTestBoundaries`, `validateInvariants`, and `validateIPCTriangles` are what it calls.

**Step 4 — Parallel implementation**

Spawn Group A agents simultaneously, each with: "Read `.flint-context/contracts/my-feature.md`. Your file is [X]. Import types from `.flint-context/contracts/my-feature.contract.ts`. Do not duplicate type definitions."

**Step 5 — Run the review ceremony and integrate**

After both agents finish: run the 3-reviewer ceremony (recipe 76), then `flint-integration-validator`. Once SHIP: `npx tsc --noEmit`, run tests, create PR.

**Pitfall:** If an agent discovers the contract is wrong during Phase 2, stop that agent, fix the contract, re-lint, then re-run only the affected agent. Never patch implementation to work around a broken contract.

---

### 76. Writing a review-ceremony reviewer agent

**When to use this:** Every time you finish a feature and want to catch what TypeScript and tests miss — scope creep, IPC security gaps, confusing UI flows, Commandment violations. Run three at once (UX, code, security), collect structured output, surface findings to the human.

**Reference:** `shared/review-schema.ts`, `.flint-context/reviews/UX-P0-code-review-2026-04-21.review.ts`

---

**The three reviewer roles and what each one looks at:**

| Role | Scope | What it finds |
|------|-------|---------------|
| `flint-ux-critic` | Components, hooks, stores the user touches; copy surfaces | Confusing flows, empty states, missing feedback |
| `flint-code-reviewer` | All modified files + their test files + direct callers | Logic errors, missing edge cases, test gaps |
| `flint-security-reviewer` | IPC handlers, `preload.ts`, `shared/ipc-validators.ts`, anything crossing the process boundary | Unvalidated inputs, exposed secrets, missing Zod schemas |

**Dispatch all three at once** in a single message. They run in parallel — faster wall clock, same cost. Sub-agents do not share prompt cache, so there is no cache benefit to running them in sequence.

**The reviewer agent skeleton** (adapt per role, shown here for code review):

```
You are a code reviewer for the Flint project. Your job is to find real problems,
not give reassurance.

Review scope: [list files from the contract's impact map]
You MUST also review: their test files and any file that directly calls them.
Do NOT review files outside this scope — it dilutes focus.

For every problem you find, you MUST cite:
- The file path and line number (file:line)
- The verbatim code excerpt
- Why it's a problem (one sentence, specific)
- A proposed fix (optional but helpful)

Severity levels:
- blocking  — must fix before shipping (logic error, security gap, broken test)
- warning   — should fix soon (missing edge case, unclear naming, test gap)
- suggestion — nice to have (style, minor improvement)

After assembling your findings, write TWO files:
1. .flint-context/reviews/[phase]-code-review-[date].md   (human-readable)
2. .flint-context/reviews/[phase]-code-review-[date].review.ts  (machine-readable)

The .review.ts MUST export a const REPORT matching the ReviewReport type from
shared/review-schema.ts. Do NOT assign the verdict yourself — call deriveVerdict()
with your findings array and let the math decide.

Missing .review.ts = incomplete ceremony. The orchestrator checks for it.
```

**The `.review.ts` output shape** (paste this, fill in the blanks):

```typescript
import type { ReviewReport } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings = [
  {
    id: 'BLK-1',
    title: 'IPC handler missing Zod validator',
    severity: 'blocking' as const,
    evidence: [{ file: 'electron/main.ts', line: 142, excerpt: 'ipcMain.handle("foo:bar", async (_, args) => {' }],
    observed: 'The handler foo:bar has no Zod schema in shared/ipc-validators.ts.',
    rationale: 'Unvalidated IPC payloads at the preload bridge violate Commandment 14 and expose main to malformed renderer input.',
    proposedFix: 'Add fooBarSchema to shared/ipc-validators.ts and call validate() at handler entry.',
    scope: 'one-file' as const,
    status: 'open' as const,
    commandment: 14,
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'N.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-24',
    round: 1,
    scope: ['electron/main.ts', 'src/store/editorStore.ts'],
  },
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  rubric: [
    { criterion: 'All renderer→main IPC channels have a Zod validator in shared/ipc-validators.ts', result: 'fail', evidence: 'foo:bar missing', relatedFindings: ['BLK-1'] },
  ],
  scopeCoverage: {
    reviewed: ['electron/main.ts', 'src/store/editorStore.ts', 'src/store/__tests__/editorStore.test.ts'],
    skipped: [],
  },
};
```

**After all three finish:** call `aggregateConsensus([uxReport, codeReport, secReport])` from `shared/review-schema.ts` to get the overall verdict and surface disagreements. Present findings to the human — they make the grade call, not you.

**Pitfall:** The A/B test on MINT.5 Phase 3 showed that narrowing the code reviewer's scope below "impl + tests + callers" missed about six warnings per phase. Always include callers.

---

### 77. Wiring a SessionStart hook

**When to use this:** You want something to happen automatically at the start of every Claude Code session — loading memory files, restoring context, writing a status line, printing a reminder. This is how Flint auto-imports memory and restores session state on every launch.

**Reference:** `.claude/settings.json` (lines 67–82), `.claude/helpers/auto-memory-hook.mjs`

---

**How hooks work (plain English):** Claude Code runs a shell command before, during, or after specific events. `SessionStart` fires once when a new session opens. Your command reads from stdin (Claude passes a JSON payload), does its work, and exits. Exit code 0 = success. Exit code 2 = block the session (don't use this unless you mean it).

**The settings.json entry** (already in place on Flint at `/Users/tiemann/Lunar-Elevator-Bridge/.claude/settings.json`, lines 67–82):

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "node .claude/helpers/hook-handler.cjs session-restore",
        "timeout": 15000
      },
      {
        "type": "command",
        "command": "node .claude/helpers/auto-memory-hook.mjs import",
        "timeout": 8000
      }
    ]
  }
]
```

Two commands run in sequence. The first (`session-restore`) writes context back into Claude's visible state. The second (`auto-memory-hook.mjs import`) loads the project's memory index.

**A minimal hook script** (save as `.claude/helpers/my-session-hook.mjs`):

```javascript
#!/usr/bin/env node
// SessionStart hook — reads JSON from stdin, does work, exits 0.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Claude passes a JSON payload on stdin. Read it even if you don't use it —
// some versions hang if you don't consume stdin.
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  const cwd = payload.cwd ?? process.cwd();

  // Example: print a reminder to Claude's context
  const handoffPath = join(cwd, 'HANDOFF.md');
  if (existsSync(handoffPath)) {
    const handoff = readFileSync(handoffPath, 'utf-8').slice(0, 500);
    // Output goes to Claude's context as an injected message
    console.log(`[Session restored]\n${handoff}`);
  }

  process.exit(0); // Always exit 0 unless you want to block the session
});
```

**Wire it in `settings.json`:**

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "node .claude/helpers/my-session-hook.mjs",
        "timeout": 10000
      }
    ]
  }
]
```

**What to put in a SessionStart hook:**
- Load memory files and print their contents so Claude sees them
- Write current git branch and status to context
- Print the last HANDOFF.md entry as a reminder
- Validate that required environment variables exist and fail loudly if they don't

**What not to put in a SessionStart hook:**
- Long-running operations (network calls, large file scans) — use the timeout wisely
- Anything that writes to the codebase — hooks are for reading context, not changing state
- Secrets — the hook output is visible in Claude's context window

**Pitfall:** If your hook exits with code 2, the entire session is blocked. Be conservative — only use exit 2 for a genuinely broken environment (missing required config, corrupted state file). For informational failures, log and exit 0.

---

### 78. Adding an MCP tool

**When to use this:** You want Claude and other AI agents to be able to call a new capability — something like "run a lint pass on this file" or "look up a token by name" — without you copy-pasting the logic into each prompt. MCP tools are the right abstraction: register once, available everywhere.

**Reference:** `flint-mcp/src/server.ts` (tool list starts around line 595), `flint-mcp/src/tools/handlers/setPolicy.handler.ts`

---

**Three things every tool needs:**

1. A registration entry in `ListToolsRequestSchema` — this is the name, description, and input shape the model sees
2. A handler in `CallToolRequestSchema` — the actual code that runs
3. A test in `flint-mcp/src/__tests__/` or a sibling `__tests__/` folder

**Step 1 — Register the tool** (in `flint-mcp/src/server.ts`, inside the `ListToolsRequestSchema` handler's `tools` array):

```typescript
{
  name: toolName("my_tool"),          // becomes "flint_my_tool"
  description: "One sentence: what this does and when to call it.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: {
        type: "string",
        description: "Absolute path to the project root.",
      },
      myParam: {
        type: "string",
        description: "What this parameter controls.",
      },
    },
    required: ["projectRoot", "myParam"],
  },
},
```

The `toolName()` helper (from `flint-mcp/src/brand.ts`) prepends `flint_` so names stay consistent. Use it for every new tool.

**Step 2 — Write the handler** in a new file at `flint-mcp/src/tools/handlers/myTool.handler.ts`:

```typescript
import type { ResolvedToolContext } from './types.js';
import { toolError, HINTS } from '../../core/errorResponse.js';

export interface MyToolArgs {
  projectRoot: string;
  myParam: string;
}

export async function handleMyTool(
  args: MyToolArgs,
  ctx: ResolvedToolContext,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { projectRoot, myParam } = args;

  if (!myParam.trim()) {
    return toolError('flint_my_tool', new Error('myParam cannot be empty'), HINTS.missingParam('myParam'));
  }

  // Your logic here
  const result = `Did the thing with: ${myParam}`;

  return {
    content: [{ type: 'text', text: result }],
  };
}
```

**Step 3 — Wire the handler** in the `CallToolRequestSchema` switch block in `server.ts`:

```typescript
case toolName("my_tool"): {
  const { projectRoot, myParam } = args as MyToolArgs;
  return handleMyTool({ projectRoot, myParam }, ctx);
}
```

**Step 4 — Write the test** at `flint-mcp/src/tools/handlers/__tests__/myTool.handler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleMyTool } from '../myTool.handler.js';

const mockCtx = { projectRoot: '/tmp/test-project' } as any;

describe('handleMyTool', () => {
  it('returns expected text for valid input', async () => {
    const result = await handleMyTool({ projectRoot: '/tmp', myParam: 'hello' }, mockCtx);
    expect(result.content[0].text).toContain('hello');
  });

  it('returns toolError when myParam is empty', async () => {
    const result = await handleMyTool({ projectRoot: '/tmp', myParam: '' }, mockCtx);
    expect(result.content[0].text).toMatch(/error|empty/i);
  });
});
```

Run `cd flint-mcp && npm test` after adding your test. Report the exact pass count.

**Pitfall:** The `description` field is not just documentation — it's the signal the model uses to decide whether to call your tool. Write it for the routing decision: "When should the model reach for this?" A vague description means the model will guess wrong or skip your tool entirely.

---

### 79. Running an A/B test on your prompts

**When to use this:** You think a change to your workflow — a new reviewer scope, a different hook, a restructured prompt — will produce better results, but you're not sure. Instead of guessing, run two arms, measure a real outcome, and let the data decide. This is how the Cheaper-Pilot levers were validated on Flint (MINT.5 Phase 3, April 2026).

**Reference:** `CLAUDE.md` (Cheaper-Pilot Levers section), `docs/playbook/AI-CODING-PLAYBOOK.md` (Theme 16)

---

**The method in plain terms:**

You have a current way of doing something (Control arm) and a proposed change (Treatment arm). You run both on comparable tasks, collect a specific metric on each, and compare. You keep the change only if the treatment arm wins on the metric you actually care about — not the metric you hoped would move.

**Step 1 — Write a falsifiable hypothesis**

Bad: "The new reviewer prompt will be better."
Good: "Splitting reviewers by domain (UX / code / security) will surface at least as many findings as a single generalist reviewer while using fewer tokens per review ceremony."

The hypothesis names: the change, the metric, and the direction. If you can't write the hypothesis this way, you're not ready to test yet.

**Step 2 — Choose ONE primary metric**

On the MINT.5 test, the primary metric was: findings per ceremony (did we catch the same bugs?). The secondary metric was: tokens per ceremony (did it cost less?). The test was only valid because the primary metric held — if findings had dropped, a lower token count would have been irrelevant.

Common metrics for prompt A/B tests:
- Findings per review (for review prompts)
- Rounds of rework per feature (for implementation prompts)
- Test pass rate on first agent run (for agent system prompts)
- Token count per completed task (for efficiency)

**Step 3 — Design comparable tasks**

Pick 2–4 tasks that are similar in scope and have already been completed (so you know the "right answer"). Run Control on half, Treatment on the other half. If you only have one task, run both arms on the same task in separate sessions.

**What the MINT.5 test actually measured:**

| | Control (1 unscoped reviewer) | Treatment (3 domain-scoped reviewers) |
|--|--|--|
| Findings | 9 | 9 |
| Missed findings | 0 | 0 |
| Tokens | Baseline | -53.9% |
| New findings | — | +2 (security found things generalist missed) |

Result: domain partition kept finding parity and cut tokens by half. Lever A (domain partition) was kept. Lever E (cache window) was tested separately and failed — sub-agents run in isolated contexts, so cache sharing across reviewers does not exist. The hypothesis was wrong; the test caught it before the workflow was locked in.

**Step 4 — Record the raw data, not just the conclusion**

For each arm, note: task name, metric value, any surprises. Don't throw away the raw data. The MINT.5 test revealed the code reviewer scope regression (narrowed scope missed 6 warnings) only because we kept the raw finding lists, not just the counts.

**Step 5 — Make a binary decision**

At the end: keep the treatment or revert. No partial keeps, no "we'll fix this part of it later." If the test is inconclusive (the metric didn't move either direction), that's a valid result — it means the change doesn't matter and you don't need it.

**Template for a one-page A/B test plan:**

```
Hypothesis: [change] will [direction] [metric] by at least [threshold].
Control:    [current prompt/workflow]
Treatment:  [proposed change]
Tasks:      [2-4 comparable tasks]
Primary metric: [one thing]
Secondary metrics: [optional]
Run date:   [date]
Result:     [keep / revert / inconclusive]
Raw data:   [table of task x metric x arm]
Decision:   [one sentence]
```

**Pitfall:** The most common mistake is measuring the wrong thing. Token count feels objective, but if the treatment cuts tokens by dropping findings, you're optimizing for cost at the expense of quality. Always measure finding parity first, cost second.

---

## Changelog

- **2026-04-24** — Round 1.6: Cookbook skeleton committed. 74 recipe titles + one-line descriptions, organized into 14 parts. No working code yet.
- **2026-04-24** — Round 2.0: Added Part 15 with 5 fully worked recipes (75–79): contract-first feature setup, reviewer agent skeleton, SessionStart hook wiring, MCP tool addition, and A/B testing methodology. All grounded in Flint source files and real measurements.
