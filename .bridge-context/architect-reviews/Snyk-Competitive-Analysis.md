# Snyk Competitive Analysis — Bridge Product Intelligence
**Date:** 2026-03-15
**Author:** Bridge Product Planner
**Purpose:** Map Snyk's architecture, feature surface, and go-to-market model onto Bridge's domain to surface actionable product opportunities.

---

## 1. Snyk Overview

### What Snyk Is

Snyk is a developer security platform whose core premise is identical in structure to Bridge's: move enforcement left in the development pipeline so violations are caught before production, not after. Their tagline is "shift-left security." Bridge's premise is shift-left design governance.

Snyk started as a dependency vulnerability scanner (SCA — Software Composition Analysis) and has expanded into a full-spectrum developer security platform covering four primary surfaces:

| Product | What It Scans | Bridge Analog |
|---|---|---|
| Snyk Code | Custom code (SAST) | Mithril Linter — scans JSX/TSX for design drift |
| Snyk Open Source | Third-party dependencies | (no current analog — future DBOM territory) |
| Snyk Container | Docker/OCI images | (no analog — out of scope) |
| Snyk IaC | Infrastructure-as-Code configs | (no analog — out of scope) |

The relevant Snyk surface for Bridge comparison is **Snyk Code** (their SAST product) and their governance/reporting infrastructure that sits above all four products.

### The 2025-2026 Expansion: Evo and AppRisk

Two major Snyk initiatives launched in late 2025/early 2026 are strategically significant:

**Snyk AppRisk Pro (ASPM):** Application Security Posture Management. A cross-project, org-wide risk scoring and dashboard layer that aggregates findings from all Snyk products into a single health posture view. Introduced the concept of "AppSec risk score" — a holistic rating of how secure an application is, factoring in severity, exploitability, business impact, and team ownership.

**Evo by Snyk (October 2025):** The world's first "Agentic Security Orchestration System." Evo operates on the OODA loop (Observe, Orient, Decide, Act) and includes: a Discovery Agent (maps all AI models, MCPs, datasets in use), a Threat Modeling Agent (auto-builds live threat models from code), a Red Teaming Agent (autonomous adversarial testing of LLM-native apps), and a Reporting Agent (generates insights across all agents). Evo positions Snyk not just as a linter but as an autonomous security team member — a direct parallel to Bridge's AI Orchestrator and Phase U Governance Engine.

**Snyk Studio:** Package health check integration for agentic development workflows, enabling AI agents to evaluate dependencies at the moment they are chosen. This is the "Secure at inception" pattern — governance applied at asset selection time, not after the fact.

---

## 2. Parallel Architecture

This is the core of the analysis. Snyk and Bridge are structurally identical systems operating in different domains.

### Side-by-Side Model

| Dimension | Snyk (Security) | Bridge (Design Governance) |
|---|---|---|
| **Primary Signal** | CVE vulnerability database | Mithril token registry + CIEDE2000 ΔE |
| **Analysis Method** | Static AST analysis (SAST) | Babel AST traversal + token matching |
| **Enforcement Point** | CI/CD pipeline gate (PR blocker) | Export Gate (blocks dirty exports) |
| **Real-Time Surface** | IDE plugin (VS Code, IntelliJ, Eclipse) | Bridge Glass canvas + Properties Panel amber glow |
| **Fix Mechanism** | Automated Fix PRs (dependency upgrades) | AST Auto-Fix + Git Transplants |
| **Policy Engine** | Custom security/license rules per org/team | Mithril rules (ΔE threshold, a11y rules) — currently non-configurable |
| **Reporting** | AppRisk dashboard (org-wide posture score) | Export Gate pre-flight (per-project, per-export) |
| **Artifact** | SBOM (Software Bill of Materials) | No equivalent exists yet |
| **Agentic Layer** | Evo — autonomous security orchestration | AI Orchestrator (Phase M) + Governance Engine (Phase U) |
| **Collaboration** | PR decoration (comments on PRs with findings) | Annotation system (COLLAB.1-4) |
| **Scope** | Cross-file, cross-repo, org-wide | Cross-file (Phase F), currently per-project |

### Where Bridge Is Ahead

- **Canvas-first UX**: Bridge's visual canvas + live preview has no Snyk equivalent. Snyk is a text-and-dashboard tool.
- **Git Transplant surgery**: Bridge's ability to surgically extract a specific AST node from git history and transplant it into live code is more sophisticated than Snyk's "upgrade the dependency" model.
- **Agentic constraint model**: Bridge's 16 Commandments and AST Tool Catalog is a more rigorous constraint system than Snyk's Evo. Snyk's Evo is orchestration-first; Bridge's model is constraint-first.
- **CIEDE2000 perceptual math**: Snyk uses binary pass/fail on vulnerability presence. Bridge uses a continuous perceptual distance metric (ΔE) with severity gradations (amber at 2.0, critical at 10.0). This is more nuanced.

### Where Bridge Is Behind

- **No CI/CD gate**: Snyk can block a GitHub PR. Bridge cannot. The Export Gate is powerful, but it only fires when a designer manually attempts an export. It does not block code from being pushed to a repo.
- **No IDE plugin**: Snyk warns developers in their text editor before they even open Bridge. Bridge has no presence in VS Code, Cursor, or any external IDE.
- **No org-wide dashboard**: Snyk AppRisk shows security posture across all repos in an organization. Bridge governance is per-project only. There is no fleet view.
- **No automated Fix PRs**: Snyk can open a pull request that fixes a vulnerability automatically. Bridge can auto-fix a Mithril violation on-canvas, but cannot push a branch or PR.
- **No SBOM equivalent**: Snyk generates a machine-readable inventory of every dependency and its compliance status. Bridge has no equivalent design artifact.
- **Policy is hardcoded**: Snyk lets organizations configure their own security policies (custom severity thresholds, rule exceptions, team-level overrides). Bridge's Mithril rules are hardcoded in MithrilLinter.ts.
- **No risk scoring**: Snyk AppRisk assigns a risk score to each project. Bridge has no equivalent health score per project (the governance dashboard added in V.1-gd shows a health ring, but it is not a persistent, comparable, org-level metric).

---

## 3. Features Bridge Should Steal

Listed in priority order based on impact-to-effort ratio and strategic fit.

### 3.1 The CI/CD Design Gate (Highest Priority)

**What Snyk does:** Integrates as a GitHub/GitLab/Bitbucket status check. Every PR that introduces a new vulnerability fails the CI check. The PR cannot be merged until violations are resolved or explicitly accepted.

**Bridge equivalent:** A `bridge-ci` CLI command (or GitHub Action) that runs MithrilLinter and A11yLinter against the changed files in a PR and reports results as a GitHub Check. PRs introducing new Mithril violations (ΔE > threshold) or new a11y violations fail the check.

**Why this matters for Bridge:** Today, a developer can take Bridge-generated code, push it to a repo, and have it merged without anyone running the Export Gate. The Export Gate only fires if someone manually opens Bridge and triggers an export. The CI gate closes this loophole and makes Bridge governance mandatory, not optional.

**Implementation surface:** A standalone `bridge-mcp` CLI invocation (the MCP server already exposes audit tooling) that reads a project's source files, runs auditAll(), and outputs results in SARIF format (the standard format that GitHub Checks understand).

### 3.2 The VS Code / Cursor Extension (High Priority)

**What Snyk does:** The Snyk VS Code extension highlights vulnerable code inline — a red squiggle with hover text showing the CVE, severity, and fix suggestion. This happens as you type, in the same IDE where you write code.

**Bridge equivalent:** A VS Code extension (or Cursor plugin) that:
- Reads the active project's design tokens from `bridge-manifest.json` (already exists via Phase O.3b)
- Runs Mithril lint rules against the active TSX file
- Shows amber squiggles on hardcoded color/spacing/typography values with hover text: "ΔE = 4.2 vs brand-primary. Suggested token: text-brand-primary."
- Provides a quick-fix code action that replaces the hardcoded value with the correct token

**Why this matters for Bridge:** This is Bridge governance without requiring Bridge Glass to be open. It makes Bridge a passive, always-present safety net in the developer's native environment — the exact same strategy that made Snyk ubiquitous. Snyk's IDE plugin is consistently cited as their strongest developer adoption driver.

### 3.3 Policy Engine — Configurable Rules (Medium-High Priority)

**What Snyk does:** Organizations define security policies as "if/then" rule sets (e.g., "if severity is Critical and CVSS score > 9.0, then fail build"). These can be applied at the org level or overridden at the team level. License policies work the same way.

**Bridge equivalent:** A `bridge.config.json` (or `.bridge/policy.json`) file per project that lets teams configure:
- Mithril ΔE threshold (default 2.0, but some teams may accept 3.5 for exploratory work)
- Which Mithril rule IDs are blocking vs. advisory (e.g., SPC-001 is advisory for this project)
- Which a11y rules are critical vs. warning
- Export gate severity floor (e.g., only block on Critical, let Amber through)

**Why this matters for Bridge:** The hardcoded ΔE = 2.0 threshold in MithrilLinter.ts means every Bridge project has the same tolerance. A marketing team doing bold experimental work has the same rules as a financial product requiring strict accessibility compliance. The policy engine enables Bridge to serve both without compromising either.

### 3.4 Design Bill of Materials — DBOM (Medium Priority)

**What Snyk does:** Generates an SBOM (Software Bill of Materials) in industry-standard formats (CycloneDX, SPDX). The SBOM is a machine-readable manifest of every dependency, version, license, and known vulnerability.

**Bridge equivalent:** A DBOM (Design Bill of Materials) — a machine-readable export that inventories:
- Every design token used in the project, its current value, and its compliance status
- Every component, its source (Figma, Bridge-generated, hand-written), and its Mithril audit result
- Every a11y violation with its severity and rule ID
- The overall design compliance posture (score, trend)

Format: JSON or CycloneDX-extended (CycloneDX has a formulation for any artifact, not just software).

**Why this matters for Bridge:** The DBOM can be ingested by procurement, legal, and brand teams who need to certify that a shipped product meets brand standards. It is also the foundation for the org-wide dashboard (3.5 below). Bridge already generates per-component audit data in `linterWarnings` and the Export Gate's pre-flight check — the DBOM is that data serialized into a shareable artifact.

### 3.5 Org-Wide Governance Dashboard (Medium Priority)

**What Snyk does:** Snyk AppRisk provides a dashboard that shows — across all repos in an org — total open vulnerabilities by severity, fix rate trends, most problematic projects, and team-level accountability. Executives see "our AppSec posture is 7.3/10" not just per-project but fleet-wide.

**Bridge equivalent:** An org-wide design health dashboard (web app or Electron window) that aggregates DBOM data from all Bridge projects under a team's workspace. Shows:
- Fleet-wide Mithril compliance rate (% of components with zero violations)
- Worst-offending projects (by violation count or ΔE severity)
- Token adoption rate (% of color/spacing values that use tokens vs. hardcoded)
- Trend over time (improving or regressing)
- Team-level breakdown

**Why this matters for Bridge:** This is the enterprise sales story. A VP of Design can show their CEO "our design system compliance went from 62% to 94% this quarter." That is a Board-level metric. Snyk built a $7B+ company in large part because they gave CISOs a number they could track. Bridge needs the same for design leaders.

### 3.6 Automated Fix PRs for Design Drift (Lower Priority — Advanced)

**What Snyk does:** When Snyk detects a vulnerability with a known fix, it opens a pull request on the SCM (GitHub, GitLab, etc.) with the fix applied. The PR contains the diff, a description of the vulnerability, and the fix rationale.

**Bridge equivalent:** When a CI gate fails due to Mithril violations, Bridge opens a "Design Fix PR" on the repository. The PR contains:
- AST-level token replacements (hardcoded `#6366f1` replaced with `text-brand-primary`)
- A PR description generated from the DBOM audit, listing every violation and its fix
- A link back to the Bridge Glass canvas for visual confirmation

**Why this matters for Bridge:** This closes the full loop. Today, Bridge finds design drift and can fix it on-canvas. But it cannot push that fix into the team's codebase automatically. Fix PRs make Bridge an autonomous design governance agent, not just a linting tool.

---

## 4. New Ideas Surfaced by This Comparison

### 4.1 "Secure at Inception" — Token Selection Governance in the Orchestrator

Snyk Studio's key insight: govern at asset selection time, not after. When an AI agent (Claude, Cursor) is about to use a package, Snyk checks if it is vulnerable before it is installed.

Bridge equivalent: When the AI Orchestrator is about to apply an `addClassName` mutation, Bridge should check — before committing the mutation — whether the class value resolves to a design token or is a hardcoded arbitrary value. If it is arbitrary and ΔE > 2.0 against the nearest token, the orchestrator should reject the mutation and substitute the correct token. This is "Secure at Inception" for design tokens. Bridge's Phase M orchestrator already has an in-memory TSC loop (Commandment 16) — adding a Mithril pre-commit check to that loop is architecturally natural.

### 4.2 "Snyk Delta" Pattern — Only Flag Net-New Violations

Snyk's `snyk-delta` CLI tool compares two scan results and only reports violations that are new (introduced by the current PR) versus violations that were already present in the baseline. This prevents "legacy debt noise" from overwhelming the signal of new problems.

Bridge equivalent: The Mithril linter currently reports all violations every time it runs. In a large codebase with 200 existing violations (accumulated before Bridge was adopted), every new scan looks like a disaster — discouraging adoption. A "delta mode" for the MithrilLinter would compare the current audit result against a stored baseline snapshot (e.g., the audit at the last export gate passage) and only surface net-new violations. Teams adopting Bridge mid-project could set a baseline and progressively reduce debt without being overwhelmed by existing violations.

### 4.3 Risk Scoring Per Component, Not Just Per Violation

Snyk AppRisk does not just count vulnerabilities. It assigns a risk score that factors in: severity, exploitability, business criticality of the affected service, and reachability (is the vulnerable code actually called?). This is a richer signal than raw violation count.

Bridge equivalent: A "design risk score" per component that factors in:
- Mithril violation count and severity (ΔE distance)
- Component usage rate (how many pages render this component)
- Export frequency (components exported more often carry higher risk)
- A11y violation presence (a11y violations are higher business risk than pure aesthetic drift)

A component that is used on 12 pages, exported weekly, and has two a11y violations is higher risk than a component used on one page with a cosmetic color drift. The current Bridge model treats all violations equally regardless of component impact.

### 4.4 "PR Decoration" — Mithril Comments on GitHub PRs

Snyk decorates pull requests with inline comments that describe exactly which line introduced a vulnerability, the severity, and the recommended fix. The PR author sees this feedback without leaving GitHub.

Bridge equivalent: The `bridge-ci` GitHub Action (see 3.1) could post a PR comment (via the GitHub API) with a formatted table showing every new Mithril or a11y violation introduced by the PR, the file and line number, the ΔE distance, and the recommended token. This is purely additive to the CI gate — the gate blocks merging; the comment explains why and what to do about it.

### 4.5 "OODA Loop" Governance — Bridge Autopilot as Evo Analog

Snyk's Evo operates on the Observe/Orient/Decide/Act framework. Bridge already has an Autopilot concept (daily Morning Reports mentioned in CLAUDE.md). The Evo parallel suggests formalizing Bridge Autopilot as a structured OODA governance loop:

- **Observe:** Scheduled nightly scan of all projects in the workspace, generating DBOM snapshots
- **Orient:** Diff against yesterday's DBOM — identify regressions and improvements
- **Decide:** Score the regressions by risk score and identify which warrant automated Fix PRs vs. advisory annotations
- **Act:** Post annotations (COLLAB.1-4 system), open Fix PRs, and update the org-wide dashboard

This transforms Bridge Autopilot from a reporting tool into an autonomous design governance agent — the direct design-domain analog of Evo.

---

## 5. Actionable Recommendations

Ranked by strategic impact and implementation feasibility given Bridge's current architecture.

### Rank 1 — Bridge CI Gate (CLI + GitHub Action)
**Effort:** Medium (2-3 sprint weeks)
**Strategic value:** Very high. Closes the loophole where Bridge-governed code gets merged without governance. Makes Bridge mandatory in the development workflow, not optional. This is the single highest-leverage feature Bridge does not have.
**Implementation path:** Extract MithrilLinter.ts and A11yLinter.ts into the bridge-mcp package (they are currently renderer-process-only — they need to run in Node.js context). Add a `bridge audit <path>` CLI command. Output SARIF. Publish a GitHub Action that calls the CLI and reports results as a PR check.
**Fits Bridge identity:** Protect. Accelerate (removes manual export-gate ceremony from the review process).

### Rank 2 — VS Code / Cursor Extension
**Effort:** High (4-6 sprint weeks, requires VS Code extension boilerplate)
**Strategic value:** Very high. This is Bridge's single strongest adoption driver for developers who never open Bridge Glass. Makes Bridge governance ambient and passive.
**Implementation path:** The extension reads `bridge-manifest.json` from the workspace root (already exists — Phase O.3b). It calls `bridge audit <activeFile>` via the CLI (Rank 1 prerequisite). It renders diagnostics using the VS Code Language Server Protocol diagnostic API. Quick-fix code actions call `bridge fix <activeFile> --token-only` to apply AST token substitutions.
**Fits Bridge identity:** Protect.

### Rank 3 — Configurable Policy Engine
**Effort:** Low-Medium (1-2 sprint weeks)
**Strategic value:** High. Unlocks enterprise sales where different teams have different tolerance levels. Removes the "your linter is too strict for our workflow" objection.
**Implementation path:** Add `.bridge/policy.json` schema. MithrilLinter reads it at runtime and uses it to configure ΔE threshold, blocking vs. advisory rules, and export gate severity floor. Export modal reads the policy for its hasCriticalMithril computation. A Bridge Glass settings panel exposes the policy as a UI form.
**Fits Bridge identity:** Protect (configurable protection is more adoptable than inflexible protection).

### Rank 4 — "Secure at Inception" Orchestrator Mithril Pre-Commit Check
**Effort:** Low (0.5-1 sprint weeks — extends existing Commandment 16 loop)
**Strategic value:** High. Prevents Mithril violations from entering the codebase through the AI Orchestrator. Today, the orchestrator validates TypeScript correctness (TSC loop). Adding a Mithril check to the same loop is architecturally trivial and closes a significant gap.
**Implementation path:** In `orchestrator.ts`, after the in-memory TSC validation loop, run `MithrilLinter.auditAll()` on the proposed mutation output. If any result has ΔE > policy threshold, reject the mutation and return a tool_result error with the nearest correct token substitution. This is the design-domain analog of Snyk Studio.
**Fits Bridge identity:** Protect. Accelerate (the fix is suggested immediately, no separate remediation cycle).

### Rank 5 — Design Bill of Materials (DBOM) Export
**Effort:** Low-Medium (1-2 sprint weeks)
**Strategic value:** Medium-High. Enables downstream workflows: procurement, brand certification, executive reporting, and is the data foundation for the org-wide dashboard.
**Implementation path:** New IPC channel `bridge:generate-dbom`. Aggregates `editorStore.linterWarnings`, `tokenStore.tokens`, `component_overrides` table, and a11y violations into a structured JSON payload. Follows a DTCG-extended schema. Export modal gains a "Export DBOM" button alongside the existing export gate. The DBOM JSON is also emitted by the `bridge audit` CLI command (Rank 1) for CI/CD consumption.
**Fits Bridge identity:** Protect (traceability and compliance artifact).

### Rank 6 — Mithril Delta Mode (Baseline Snapshotting)
**Effort:** Low (1 sprint week)
**Strategic value:** Medium. Dramatically improves adoption for teams adopting Bridge mid-project with existing legacy violations. Reduces noise and focuses attention on regressions.
**Implementation path:** New SQLite table `mithril_baseline` that stores the last accepted audit snapshot (keyed by file path + node bridge-id + rule id). MithrilLinter gains a `auditDelta(baseline)` method that returns only violations present in current results but absent from baseline. The Export Gate gains a "Set Baseline" button that stores the current audit as the new baseline. Delta violations surface in amber; baseline violations are tracked but do not block export.
**Fits Bridge identity:** Recover (recovering from accumulated legacy debt gracefully).

### Rank 7 — Org-Wide Governance Dashboard
**Effort:** High (4-6 sprint weeks — requires cloud infrastructure or local aggregation)
**Strategic value:** High for enterprise sales, lower for individual users.
**Note:** This requires the DBOM (Rank 5) to exist first. It also requires either a shared cloud backend (Phase C.1 PowerSync) or a local fleet aggregation mechanism (all projects on the same machine). Bridge's local-first architecture means the local version (aggregate across all projects in bridge-registry.db) is achievable without cloud infrastructure. The cloud version is Phase C.1 territory.
**Fits Bridge identity:** Protect (fleet-wide governance visibility).

---

## Research Sources

- [Snyk Products 2026 — Textify Analytics](https://textify.ai/snyk-devsecops-security-platform-guide/)
- [Snyk What's New — Official Docs](https://docs.snyk.io/discover-snyk/whats-new)
- [Evo by Snyk — Official Launch](https://snyk.io/news/snyk-launches-evo/)
- [Evo by Snyk — Labs](https://labs.snyk.io/resources/evo-by-snyk/)
- [Snyk CI/CD Integration — Official Docs](https://docs.snyk.io/implementation-and-setup/enterprise-implementation-guide/phase-6-rolling-out-the-prevention-stage/add-and-configure-snyk-in-your-ci-cd-pipeline)
- [Snyk IDE Plugins — Official](https://snyk.io/platform/ide-plugins/)
- [Snyk VS Code Extension — Docs](https://docs.snyk.io/developer-tools/snyk-ide-plugins-and-extensions/visual-studio-code-extension)
- [Snyk Automatic Fix PRs — Docs](https://docs.snyk.io/scan-with-snyk/pull-requests/snyk-pull-or-merge-requests/create-automatic-prs-for-new-fixes-fix-prs)
- [Snyk Policy Engine — Docs](https://docs.snyk.io/manage-risk/policies)
- [Snyk SBOM Generation — Blog](https://snyk.io/blog/creating-sboms-snyk-cli/)
- [Snyk AppRisk Pro Launch](https://snyk.io/news/snyk-launches-apprisk-pro-developer-first-aspm/)
- [Snyk Analytics — Docs](https://docs.snyk.io/manage-risk/analytics/redesigned-analytics)
- [Snyk vs SonarQube — Konvu](https://konvu.com/compare/snyk-vs-sonarqube)
- [Design System Governance — UXPin](https://www.uxpin.com/studio/blog/design-system-governance/)
- [Knapsack Enterprise Governance](https://www.knapsack.cloud/)
- [Design Token Management Tools 2025](https://cssauthor.com/design-token-management-tools/)
- [Design Tokens Governance — Substack](https://designtokens.substack.com/p/design-tokens-governance)
- [Best Design System Governance Tools — Replay](https://www.replay.build/blog/the-best-design-system-governance-tools-for-component-library-enforcement)
- [Snyk Studio Package Health](https://updates.snyk.io/)
- [Shift-Left Governance — Atlan](https://atlan.com/know/regovern-shift-left-governance-guide/)
