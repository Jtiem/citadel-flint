# Project Commandments v1.0

> Non-negotiable rules. If any is violated, the code is NOT shippable.
> Each commandment is binary (violated or not), numbered (for citation), and maps to an enforcement mechanism.

---

## The 8 Universal Commandments

### 1. Persistence Rule
If it isn't saved to the canonical format, it doesn't exist. No ephemeral demo states, no in-memory-only mutations, no "it works if you refresh." Every change must be persisted to the source of truth before it's considered real.

**Enforcement:** Architecture (all mutations route through a single persistence layer)

---

### 2. Environment Constraints
Define what the runtime cannot touch. Document the hard boundaries: no network calls from the renderer, no filesystem access from the client, no external URLs in offline mode — whatever your project's security surface requires.

**Enforcement:** Architecture (process isolation, sandboxing, CSP headers)

---

### 3. Quality Blocks Shipping
Violations at defined severity levels block export, deploy, or merge. Not "warn and continue" — actually blocked. The gate cannot be bypassed without explicitly overriding with documented justification.

**Enforcement:** Gate (CI/CD quality gate, export blocker, merge check)

---

### 4. The Gatekeeper
Output is blocked while any override or drift from the source of truth remains. If the code has diverged from the specification (design system, schema, contract), it cannot ship until alignment is restored.

**Enforcement:** Gate (diff-based compliance check)

---

### 5. Audit Before Execution
Assess complexity before choosing the execution strategy. Not all tasks need the same resources, model tier, or review depth. Route work based on measured complexity, not assumption.

**Enforcement:** Orchestrator (complexity scoring before dispatch)

---

### 6. Atomic Operations
All writes are atomic. Batch operations are transactional — they either all succeed or all roll back. No partial writes, no half-applied migrations, no orphaned state.

**Enforcement:** Architecture (transaction manager, atomic file writes)

---

### 7. Deterministic Transformations
Use structured tools (AST parsers, schema validators, typed transforms) for all code modifications. Never use string manipulation (regex, string replace) to modify source code. Same input must produce same output, every time.

**Enforcement:** Architecture (transformation engine choice)

---

### 8. Documentation Autopilot
No code change is "done" until its architectural impact is documented. The architecture spec, health report, and relevant agent prompts must reflect the change before the task is closed.

**Enforcement:** Workflow (session-end audit) + Review (reviewer checklist)

---

## Adding Domain-Specific Commandments

Add 4-8 more commandments specific to your project's domain. Examples:

- **Accessibility is a Compiler Error** — a11y violations block export (from Flint)
- **No Raw SQL** — all queries through the ORM/query builder
- **Type Coverage Floor** — no PR merges below 95% type coverage
- **API Contract First** — no endpoint implementation without an OpenAPI spec

For each, specify:
- The rule (binary, unambiguous)
- The enforcement mechanism (architecture > gate > linter > workflow > documentation)
- The graduation path (if it starts as documentation, when does it get tooling?)

---

## Commandment Lifecycle

### Adding a Commandment
1. A bug, violation, or architectural risk is identified
2. Propose the rule as a numbered commandment (binary, enforceable)
3. Assess impact on existing code
4. Select enforcement mechanism (prefer Tier 1-2 over Tier 5-6)
5. Add tests or gate logic
6. Update all agent prompts that reference commandments
7. Document in this file with version bump

### Retiring a Commandment
When a commandment becomes irrelevant (project pivot, technology change):
1. Mark as `[DEPRECATED v1.x]` — do not delete
2. Remove from enforcement gates
3. Update agent prompts
4. Document the reason for deprecation
