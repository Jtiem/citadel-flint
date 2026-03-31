# Feature Spec: Chronicle — Narrated Governance History

**Date:** 2026-03-31
**Citadel Name:** Chronicle
**Phase IDs:** CHRON.1 (Reason-on-Override), CHRON.2 (Git-Backed Ledger)
**Author:** flint-product-planner
**Status:** PROPOSED

---

## Problem

Flint's governance engine records every mutation, override, and violation in the Ledger (SQLite). Stamp tracks provenance — who changed what, when, and from where. But two gaps undermine the audit story:

1. **No "why."** When a developer overrides a governance rule or makes a Red-tier mutation, the system records *that* it happened but not *why*. In a compliance review, "who" and "when" are table stakes — "why" is the question that matters. Without a reason, auditors cannot distinguish intentional design decisions from careless overrides.

2. **Local-only history.** The Ledger lives in `flint.db` on one machine. When multiple developers work on the same project, each has an independent governance history. There is no shared audit trail, no way to see what rules a teammate overrode, and no cross-developer anomaly detection. The Flare anomaly engine can only detect patterns within a single developer's session.

---

## Solution

### CHRON.1 — Reason-on-Override (Risk-Tiered Annotation)

**What it does:** Adds a required or optional reason field to governance overrides and high-risk mutations, tiered by Sentry risk score.

**How it works:**

| Sentry Risk Tier | Reason Requirement | UX |
|-----------------|-------------------|-----|
| Green (0–39) | Auto-logged | No prompt. The system infers context from the mutation itself (which token, which rule, which file). Stored in Stamp as `reason: "auto"`. |
| Amber (40–69) | Soft prompt | A small input field appears: "Add a note?" Skippable. If skipped, `reason: "skipped"` is recorded — the skip itself is the data point. |
| Red (70–100) | Hard gate | Reason is required before the mutation is accepted. A text input blocks the confirmation button until non-empty. Stored in Stamp with the developer's exact text. |
| Override (any tier) | Hard gate | Any governance rule override — regardless of risk tier — requires a reason. This is the compliance-critical case. |

**Where it surfaces:**

- **MRS Approval Flow:** The existing Green/Amber/Red confirmation UI in the orchestrator gains a reason field at Amber and Red tiers.
- **Override Telemetry:** The existing override recording path (`override_events` table) gains a `reason TEXT` column.
- **Stamp Provenance:** `recordProvenance()` gains an optional `reason` parameter, stored in the `mutations_ledger` table.
- **Counsel UI:** Violation cards in GovernanceDashboard show the reason when a past override exists for that rule+file combination. This closes the "why was this allowed?" question visually.
- **Audit Report:** `flint_audit_report` includes override reasons in the provenance section. `flint_mutation_provenance` returns reasons in audit trail queries.

**What it does NOT do:**

- Does not require reasons for routine Green-tier mutations (too much friction, developers will write garbage).
- Does not add a separate approval workflow — it extends the existing MRS flow.
- Does not change the export gate logic — Gate still blocks on violations regardless of reasons.

---

### CHRON.2 — Git-Backed Governance Ledger

**What it does:** Extends GitManager's shadow commit system to include governance events, creating a distributed audit trail that travels with the repository.

**How it works:**

1. **Governance events → `.flint/chronicle.jsonl`**: After each governance event (override, Red mutation, escalation, deferral), the system appends a structured JSON line to `.flint/chronicle.jsonl` in the project directory. This file is human-readable and git-trackable.

2. **Shadow commits include Chronicle**: GitManager's existing `shadowCommit()` — which already commits AST mutations — now also stages `.flint/chronicle.jsonl` changes. The governance history becomes part of the git history.

3. **Cross-developer visibility**: When a developer pulls from the shared repository, they receive the full governance history from all contributors. `git log --follow .flint/chronicle.jsonl` shows the complete audit trail. `git blame .flint/chronicle.jsonl` shows who recorded each entry.

4. **Flare cross-developer anomaly detection**: With the Chronicle file tracked in git, Flare's anomaly detection can operate on the merged history — detecting patterns like "overrides spiked across the team last week" rather than only "overrides spiked on my machine."

**Chronicle entry format:**

```jsonl
{"ts":"2026-03-31T14:22:00Z","type":"override","rule":"MITHRIL-001","file":"src/Button.tsx","agent":"claude-sonnet-4-6","reason":"Brand team approved this color for Q2 campaign","risk":72,"session":"abc123"}
{"ts":"2026-03-31T14:23:00Z","type":"mutation","op":"setProp","file":"src/Button.tsx","agent":"claude-sonnet-4-6","reason":"auto","risk":12,"session":"abc123"}
```

**What travels in git vs. what stays local:**

| Data | Location | In git? |
|------|----------|---------|
| Chronicle entries (overrides, Red mutations, escalations) | `.flint/chronicle.jsonl` | Yes |
| Full Ledger (all governance events, queries, reads) | `flint.db` SQLite | No — too noisy, binary format |
| Stamp provenance details | `flint.db` SQLite | No — references Chronicle entries by ID |

**What it does NOT do:**

- Does not replace the SQLite Ledger — the Ledger remains the high-fidelity local store. Chronicle is the portable subset.
- Does not require a server or sync service — git is the transport.
- Does not force `chronicle.jsonl` into the main branch — teams can `.gitignore` it if they prefer local-only governance. Default: tracked.
- Does not change Commandment 14 (Bypass Prohibition) — writes go through FileTransactionManager like everything else.

---

## Feature Budget Gates

1. **Who is this for?** Both audiences. Developers see override reasons in their IDE (Stamp queries). Designers see them in Glass (Counsel violation cards). CI reads Chronicle for compliance reports.

2. **What behavior does this enable?** Teams can now answer "why was this governance rule overridden?" in a compliance review — which they couldn't before. And teams with multiple developers can see each other's governance history — which was impossible before.

3. **80% or 5%?** CHRON.1 (reasons) is 80% — every team doing compliance reviews needs this. CHRON.2 (git-backed) is 80% for multi-developer teams, which is the enterprise target.

4. **Maintenance cost?** CHRON.1: Low — adds a column and a UI field to existing flows. CHRON.2: Medium — new file format, GitManager integration, Flare adapter.

5. **Can we validate without building?** CHRON.1: Ship the Amber/Red reason prompt first. If developers actually write useful reasons (vs. "asdf"), the system works. Measure reason quality in the first week. CHRON.2: Can validate by manually committing `.flint/chronicle.jsonl` in a multi-developer test before automating shadow commits.

6. **What do we stop doing?** CHRON.1 ships alongside Counsel Wave 3 (it extends the same UI surfaces). CHRON.2 is independent — no displacement needed, but it should ship after BETA.1 (distribution) so there are real multi-developer teams to test with.

---

## Implementation Shape

### CHRON.1 — Reason-on-Override

| Layer | Changes |
|-------|---------|
| **SQLite** | Add `reason TEXT` column to `override_events` and `mutations_ledger` tables |
| **MCP** | `mutationProvenanceService.recordProvenance()` gains `reason` param; `flint_mutation_provenance` returns it |
| **Electron** | `mrsEngine.ts` approval flow passes reason to Stamp; `agentEscalation.ts` captures reason on escalation |
| **Glass** | Orchestrator confirmation dialog gains reason input (Amber: optional, Red: required); GovernanceDashboard violation cards show past override reasons |
| **CI** | `flint_audit_report` includes reasons in SARIF `message.text` |

**Effort:** M (3–5 days)
**Dependencies:** COUNSEL.1 (PROPOSED — extends same UI surfaces)

### CHRON.2 — Git-Backed Governance Ledger

| Layer | Changes |
|-------|---------|
| **Shared** | New `shared/chronicleFormat.ts` — entry types, serializer, parser |
| **Electron** | `chronicleWriter.ts` — appends entries via FileTransactionManager; `GitManager.shadowCommit()` stages `.flint/chronicle.jsonl` |
| **MCP** | `flint_mutation_provenance` gains `source: "chronicle"` option to query git-backed history |
| **Flare** | `anomalyDetectionService.ts` gains `loadChronicle()` adapter for cross-developer baseline |
| **Glass** | No changes — reads provenance via existing MCP resources |

**Effort:** L (1–2 weeks)
**Dependencies:** CHRON.1 (reason data must exist before it's worth distributing)

---

## Sprint Placement

| ID | Name | Priority | Effort | Sprint | Status |
|----|------|----------|--------|--------|--------|
| CHRON.1 | Reason-on-Override (risk-tiered annotation) | P1 | M | Sprint 8 | PROPOSED |
| CHRON.2 | Git-Backed Governance Ledger (Chronicle) | P2 | L | Sprint 9 | PROPOSED |

**Rationale:** CHRON.1 is P1 because compliance reviews are a near-term enterprise need — every SOC 2 auditor will ask "why was this rule overridden?" CHRON.2 is P2 because it depends on multi-developer adoption (BETA.1) to be meaningful. Both are high-value for the enterprise story but CHRON.2 has a softer urgency.

---

## Citadel Name Rationale

**Chronicle** — the castle's narrative history. Where Ledger is the raw book of record and Stamp is the official seal of provenance, Chronicle is the annotated story: who did what, why they did it, and what the kingdom learned. It extends both without replacing either.
