# Flint MCP Engine — Gap Remediation Plan

**Date:** 2026-03-13
**Version:** 1.0
**Status:** PLANNING
**Source:** Architecture Review — Acceptance & Execution

---

## 1. Executive Summary

This document outlines a structured approach to resolve architectural gaps in Flint's headless MCP engine when evaluated against current hallucination-control standards in LLM systems.

Flint's existing architecture excels in several areas: constrained generation, pre-commit interception, mandatory tool use, and deterministic validation. However, the analysis identified two structural gaps and two strategic gaps requiring attention before Flint can function as a "general-purpose AI Governance Engine beyond the web development vertical."

**Strategic Context:** The plan focuses exclusively on the headless MCP server direction. IDE-specific elements (canvas, Electron shell, LivePreview) are out of scope. The objective is creating a domain-agnostic engine suitable for any regulated, high-stakes AI workflow.

---

## 2. Gap Summary

| Phase | Gap Addressed | Effort | Priority |
|-------|---------------|--------|----------|
| V.1 | Probabilistic Risk Scoring (Confidence Estimation) | 2–3 sprints | CRITICAL |
| V.2 | Mutation Provenance & Citation Trail | 1–2 sprints | CRITICAL |
| V.3 | Domain-Agnostic AST Abstraction | 3–4 sprints | HIGH |
| V.4 | Multi-Agent Epistemic Consensus | 2–3 sprints | MEDIUM |

---

## 3. Phase V.1 — Probabilistic Risk Scoring

**GAP:** "Flint's validation engine is binary: BLOCKED or APPROVED. There is no risk gradient."

### What

Introduce a Mutation Risk Score (MRS) accompanying every proposed AST mutation through the linter pipeline. Rather than simple pass/fail, each mutation receives a composite risk score (0.0–1.0) derived from:
- Linter violation severity weighting
- AST blast radius — quantity of downstream nodes affected
- Registry confidence — component familiarity status
- Deviation from baseline state

### Why It Matters

The current binary gate provides human reviewers with insufficient information for triage. A single-node text modification and complete component restructuring both register identically as "APPROVED." In high-stakes non-web sectors — clinical trials, financial instruments, infrastructure — the human approval process requires meaningful risk signals, not merely green-light approval. Without MRS, Flint lacks credibility as a governance engine for senior decision-makers.

### How to Close It

Extend LinterResult schema with `riskScore` (float) and `riskFactors` (string[]) payloads. Create a `RiskCompositor` service aggregating MithrilLinter, A11yLinter, and new `BlastRadiusAnalyzer` outputs into unified scoring. Surface the score in MCP tool_result enabling risk-tiered responses in host IDEs and approval interfaces. Define three tiers:
- **Green (0.0–0.3):** auto-approve eligible
- **Amber (0.31–0.69):** requires human review
- **Red (0.7–1.0):** requires senior sign-off with mandatory justification logging

**Effort:** 2–3 sprints
**Success KPI:** 100% of mutation approvals carry an MRS; Amber and Red tiers trigger documented human review

---

## 4. Phase V.2 — Mutation Provenance & Citation Trail

**GAP:** "Flint has no mechanism to record why a mutation was proposed — only that it was validated."

### What

Implement a Provenance Ledger recording, for every committed mutation:
- Source intent (SDI payload, user prompt, agent reasoning trace)
- Registry artifact grounding (component ID, token ID)
- Linter result and risk score at approval time
- Approver identity (human or auto-approved)

Store as append-only SQLite table in `flint-registry.db`. Expose via `flint://provenance` MCP resource.

### Why It Matters

Regulated industries — healthcare, finance, legal, government — mandate audit trails as compliance requirements, not optional features. Without provenance, Flint cannot answer "Why does this component look like this, and who approved it?" This gap also prevents implementation of Grounded Citation Enforcement patterns, standard in legal and medical AI systems.

### How to Close It

Add `mutations_ledger` table to `flint-registry.db` schema with fields: `id`, `timestamp`, `file_path`, `node_id`, `operation_type`, `source_intent_hash`, `registry_artifact_id`, `mrs_score`, `approved_by`, `justification`. Update `FileTransactionManager` to write provenance records on every successful atomic commit. Implement `flint://provenance` as paginated MCP resource. Add `flint_query_provenance` MCP tool for forensic lookups by node_id or time range.

**Effort:** 1–2 sprints
**Success KPI:** Every committed mutation has provenance record; provenance queryable within 200ms

---

## 5. Phase V.3 — Domain-Agnostic AST Abstraction

**GAP:** "The AST engine is tightly coupled to Babel/JSX. The linter is tightly coupled to Tailwind/CIEDE2000."

### What

Introduce Universal AST Adapter layer decoupling the mutation engine from specific syntax formats. Define canonical `FlintNode` schema — syntax-neutral intermediate representation — populated by domain-specific parsers:
- Babel for JSX
- HCL parser for Terraform
- Custom parser for legal clause trees
- JSON-schema parser for clinical trial protocols

The `LinterPlugin` interface accepts any rule set, not exclusively MithrilLinter's visual rules. AST Tool Catalog operations (`insertNode`, `updateProperty`, `deleteNode`) operate on `FlintNode`, not JSX-specific constructs.

### Why It Matters

Every non-web vertical in the expansion strategy — fintech, healthcare, IaC, legal contracts, policy simulation — requires Flint to parse different state representations. Without engine flexibility for new domains, scaling becomes impossible without core reconstruction. This distinction separates a product from a platform. The headless MCP pivot makes this architecturally urgent.

### How to Close It

Define `FlintNode` and `LinterPlugin` interfaces in new `flint-mcp/src/core/universal-ast.ts`. Refactor ASTService to operate through `FlintNode` abstraction with Babel/JSX as first registered adapter. Implement PluginRegistry in `flint-manifest.json` mapping domain profiles (`clinical_samd`, `iac_soc2`, `legal_contract`) to parser and linter plugin configurations. Ship two reference adapter implementations alongside JSX: JSON-schema adapter and plain-text clause parser.

**Effort:** 3–4 sprints
**Success KPI:** New domain adapters register without modifying core engine files; two non-JSX adapters pass integration tests

---

## 6. Phase V.4 — Multi-Agent Epistemic Consensus

**GAP:** "Flint uses a single orchestrator. High-risk mutations have no independent second opinion."

### What

For mutations scoring Amber or Red on MRS (from Phase V.1), introduce optional Consensus Gate routing the proposed mutation to lightweight secondary agent for independent safety evaluation. This is not general-purpose critic LLM — it's constrained evaluator running identical AST Tool Catalog and linter checks from clean context, without primary agent's reasoning history. If agents disagree on safety, mutation escalates to human review regardless of individual scores.

### Why It Matters

Multi-agent epistemic voting is an emerging technique outperforming RAG for hallucination control in high-stakes domains. Flint's single-agent architecture exhibits known failure mode: orchestrator can reason itself into approving mutation sequences that individually pass linting but collectively produce illegal states. Stateless second opinion, operating without primary's conversational context, detects this error class. Hospitals and prime brokers will require this pattern.

### How to Close It

Add `ConsensusGate` module in `flint-mcp/src/core/consensus-gate.ts`. Wire into MCP approval flow so any mutation with MRS >= 0.31 triggers secondary evaluation call. Define secondary agent's system prompt as strict, stateless auditor: receives only current AST snapshot and proposed mutation, nothing else. Log both agent verdicts and disagreements to Provenance Ledger (Phase V.2). Make Consensus Gate configurable per domain profile.

**Effort:** 2–3 sprints
**Success KPI:** Zero cases where Red-tier mutation reaches filesystem without logged second-agent verdict

---

## 7. Implementation Sequencing

| Sprint Window | Phase | Dependency | Rationale |
|---------------|-------|------------|-----------|
| S1–S2 | V.2 — Provenance Ledger | None | Foundational. All other phases write to ledger. Ship first. |
| S2–S4 | V.1 — Risk Scoring | V.2 | Depends on ledger storing scores. Unlocks human review tiers. |
| S3–S6 | V.3 — Universal AST | None (parallel) | Can run parallel with V.1/V.2. Extended lead time. |
| S5–S7 | V.4 — Consensus Gate | V.1, V.2 | Depends on MRS tiers and provenance ledger. |

---

## 8. Acceptance Criteria

**V.1 — Risk Scoring**
- Every orchestrator-emitted mutation carries numeric MRS (0.0–1.0)
- Amber and Red tiers demonstrably trigger in test scenarios
- Auto-approval gates exclusively on Green tier

**V.2 — Provenance**
- `mutations_ledger` table exists, populated on every FileTransactionManager commit
- `flint://provenance` returns queryable results
- Forensic audit of any node's history possible within one MCP tool call

**V.3 — Universal AST**
- Non-JSX domain (JSON-schema or plain-text) registers in flint-manifest.json
- Full mutation pipeline processing occurs without core engine file modifications
- All existing 347 tests continue passing

**V.4 — Consensus Gate**
- Red-tier mutation in test scenario cannot reach filesystem without logged second-agent verdict
- Primary/secondary agent disagreements visible in provenance ledger

---

## 9. Out of Scope

- All IDE/Electron/canvas-specific work — headless MCP exclusively
- Fine-tuning or model training — Flint assumes model hallucination and constructs containment
- Chain-of-Thought prompting strategies — Flint supersedes CoT with deterministic verification
- General-purpose guardrails frameworks — Flint's pre-commit interception is structurally superior

---

## 10. Recommendation

**Accept all four phases.** Initiate V.2 (Provenance Ledger) and V.3 (Universal AST) in parallel as first sprint window. V.2 represents low-risk infrastructure unblocking everything downstream. V.3 carries extended lead time requiring early initiation.

---

## Relationship to EXP.1-7

This Gap Remediation Plan (V.1-V.4) is **orthogonal** to the Strategic Expansion Plan (EXP.1-7). EXP phases extend Flint's use cases horizontally (CI/CD, migration, a11y, cross-platform). V phases deepen Flint's architectural foundation vertically (risk scoring, provenance, domain abstraction, consensus).

**Recommended execution order:** Complete EXP.1-2 first (CI/CD Gate + Design Debt Report), then interleave V.2 and V.3 alongside EXP.3-5. V.1 and V.4 follow once the provenance ledger and risk infrastructure are in place.
