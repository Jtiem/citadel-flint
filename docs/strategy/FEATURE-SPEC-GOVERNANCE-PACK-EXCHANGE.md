# Feature Spec: GPX — Governance Pack Exchange

**Track ID:** GPX
**Date:** 2026-03-17
**Author:** flint-product-planner
**Status:** BACKLOG
**Sources:** CLAUDE.md, BACKLOG-PRIORITIZED.md, electron/agentPolicy.ts, flint-mcp/src/core/policyEngine.ts

---

## Vision

GPX is the distribution layer for Flint governance. Teams encode hard-won governance
decisions — which rules to enforce, which agents to trust, what CLAUDE.md fragments to
inject — into a portable, versioned bundle called a Governance Pack. Those packs can be
shared internally across projects, published to a community registry, or pushed
organization-wide by an admin.

The pitch in one sentence: **stop re-configuring governance from scratch on every new
project, and start shipping the same standards everywhere your team deploys AI agents.**

This is not a marketplace for UI components. It is not a plugin system for Flint's
rendering engine. It is a distribution mechanism for governance configuration — the
policies, agent rules, CLAUDE.md scaffolding, and skill definitions that determine how
safely AI agents operate on a codebase.

---

## Why GPX Fits Flint's Identity

| Flint purpose | How GPX serves it |
|----------------|-------------------|
| Protect integrity | Packs propagate vetted rule sets across teams instead of hoping each project configures governance correctly |
| Accelerate pipeline | New projects inherit proven governance in seconds instead of hours of manual config |
| Recover from AI mistakes | Compliance packs encode industry-specific guardrails (HIPAA, SOX, Section 508) that prevent entire classes of violation before they occur |

---

## Existing Phase Touchpoints

GPX sits on top of and extends these ONLINE systems:

| Phase | File | What GPX extends |
|-------|------|------------------|
| AGV.1 | `electron/agentPolicy.ts` | Pack imports produce or merge `.flint/agent-policy.json` entries; `AgentPermission` and `AgentPolicyFile` types become pack payloads |
| POL.1 | `flint-mcp/src/core/policyEngine.ts` | Pack imports produce or merge `.flint/policy.json`; `ResolvedPolicy` shape is the canonical policy representation inside a pack |
| G.2 | Scaffolding + Registry | Pack export reads `flint-manifest.json`; pack import can scaffold `.flint/` into a new project |
| CLAUDE.md fragments | `.claude/` directory | Packs carry agent definition fragments that augment the host project's CLAUDE.md |
| SEC.4 | API key safe storage | Private registry tokens use `safeStorage` — same pattern as the Anthropic API key |
| V.2-mp | Mutation provenance | Pack import events are recorded in the provenance ledger as a named source |

---

## Pack Manifest Schema

This is the canonical `manifest.json` that lives at the root of every `.flint-pack/` bundle.

```json
{
  "schema_version": 1,
  "id": "acme-healthcare-governance",
  "name": "ACME Healthcare Governance",
  "version": "1.2.0",
  "description": "HIPAA-aligned governance for React design systems. Enforces AAA a11y conformance, strict Mithril color delta, and restricts AI agents to read-only unless manually approved.",
  "author": {
    "name": "ACME Design Systems Team",
    "email": "design-systems@acme.com",
    "org": "acme-corp"
  },
  "trust_tier": "verified",
  "domain": "healthcare",
  "stack_tags": ["react", "tailwind", "typescript", "figma"],
  "compatibility": {
    "flint_min_version": "7.0.0",
    "flint_max_version": null
  },
  "dependencies": [],
  "contents": {
    "policy": true,
    "agent_policy": true,
    "rules": ["MITHRIL-COL", "A11Y-001", "A11Y-002"],
    "skills": ["healthcare-alt-text-enforcer"],
    "claude_fragments": ["agents/hipaa-sentinel.md"]
  },
  "checksum": "sha256:abc123...",
  "published_at": "2026-03-01T00:00:00Z",
  "registry_url": "https://registry.flint.build/packs/acme-healthcare-governance@1.2.0"
}
```

### Field Definitions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schema_version` | number | yes | Pack format version. Currently 1. |
| `id` | string | yes | Globally unique slug. Lowercase, hyphens only. |
| `name` | string | yes | Human-readable display name. |
| `version` | string | yes | Semver. |
| `description` | string | yes | Plain-language summary for non-technical users. |
| `author` | object | yes | At minimum `name`. `org` required for organization packs. |
| `trust_tier` | string | yes | One of: `community`, `verified`, `official`. Set by registry on publish. |
| `domain` | string | yes | Must match a `GovernanceDomain` value from `policyEngine.ts`: `general`, `healthcare`, `fintech`, `e-commerce`, `government`, `enterprise-saas`. |
| `stack_tags` | string[] | yes | Searchable technology tags. |
| `compatibility.flint_min_version` | string | yes | Semver floor. Pack import fails if Flint version is below this. |
| `compatibility.flint_max_version` | string | no | Null means no ceiling. |
| `dependencies` | string[] | no | Other pack IDs this pack requires to be imported first. |
| `contents` | object | yes | Declares what artifacts are included. Used for conflict pre-scan. |
| `checksum` | string | yes | SHA-256 of the bundle archive. Verified before import. |
| `published_at` | string | yes | ISO 8601 UTC. |
| `registry_url` | string | no | Canonical registry URL. Absent for local packs. |

---

## `.flint-pack/` Directory Structure

```
my-governance-pack/
  manifest.json                  # Pack identity, schema, contents declaration
  policy.json                    # Flint policy.json (POL.1 ResolvedPolicy shape)
  agent-policy.json              # Agent ACL overrides (AGV.1 AgentPolicyFile shape)
  rules/
    MITHRIL-COL.json             # Per-rule configuration overrides
    A11Y-001.json
  skills/
    healthcare-alt-text-enforcer.ts   # MCP skill definition
  claude-fragments/
    agents/
      hipaa-sentinel.md          # CLAUDE.md fragment — injected into project's .claude/
    workflows/
      hipaa-audit.md             # Optional workflow definition fragment
  CHANGELOG.md                   # Version history (optional but encouraged)
```

### Artifact Constraints

- `policy.json` must pass `validatePolicy()` from `policyEngine.ts` before packaging.
- `agent-policy.json` must conform to `AgentPolicyFile` interface from `agentPolicy.ts`.
- No file inside a pack may reference an absolute local path.
- No file inside a pack may contain API keys, secrets, or environment variable values.
- Skill files may not import Node.js built-ins (`fs`, `path`, `child_process`). They are
  sandboxed to the MCP tool surface.
- `claude-fragments/` files are injected verbatim. The packager validates they contain no
  local path references before export.

---

## Phase Breakdown

---

### GPX.1 — Pack Format + Export

| Field | Value |
|-------|-------|
| **ID** | GPX.1 |
| **Priority** | P1 |
| **Effort** | S |
| **Dependencies** | AGV.1 (ONLINE), POL.1 (ONLINE), G.2 (ONLINE) |
| **Status** | BACKLOG |

**What:**

Define the `.flint-pack/` directory format and implement `flint_pack_export`, a new MCP
tool that reads the active project's governance configuration and bundles it into a portable
pack archive.

The export tool collects:
- `.flint/policy.json` (validated against `validatePolicy()` before inclusion)
- `.flint/agent-policy.json` (validated against `AgentPolicyFile` shape)
- Any rules from `flint://rules` that the project has customized from defaults
- Any skill files registered in the project's MCP surface
- Any `.claude/agents/` fragments the user opts to include (with local-path scrubbing)
- Generates `manifest.json` with checksums and contents declaration

The tool accepts a `dry_run` parameter (consistent with `flint_ast_mutate` and
`flint_fix`) that reports what would be bundled without writing the archive.

It validates that the resulting pack is self-contained: no absolute paths, no secrets, no
references to files outside the bundle. Validation errors are reported as a structured list
before the archive is written.

Output: a `.flint-pack.zip` archive alongside the project's `.flint/` directory, or at a
user-specified path.

**Why this priority:**

Export is the prerequisite for everything else in the GPX track. Without a defined format,
GPX.2–GPX.4 have nothing to operate on. The effort is small because the raw material
(`policy.json`, `agent-policy.json`, `policyEngine.ts` types) already exists and is
well-structured. This phase is pure serialization work on existing data shapes.

**Revenue / demo impact:**

Export alone creates immediate value in enterprise demos: "Flint captures your governance
decisions and packages them so every new project starts compliant." This is a concrete,
visible artifact the buyer can hold. No other tool in the competitive landscape offers a
portable governance bundle — Figma governance is locked inside Figma, Chromatic governance
is locked inside Storybook.

**Competitive moat:**

Pack format ownership. Once teams have `.flint-pack` files, they have a Flint-native
artifact that has no equivalent in competing tools. Switching costs rise. The format becomes
the standard.

---

### GPX.2 — Import + Conflict Resolution

| Field | Value |
|-------|-------|
| **ID** | GPX.2 |
| **Priority** | P1 |
| **Effort** | M |
| **Dependencies** | GPX.1 (BACKLOG), D.1 (ONLINE — undo/redo for rollback) |
| **Status** | BACKLOG |

**What:**

Implement `flint_pack_import`, an MCP tool that installs a governance pack into the active
project. Import sources: local file path, HTTPS URL, or registry pack ID (GPX.3 extends
this).

**Conflict detection** runs before any files are written. The conflict scanner compares the
incoming pack's contents declaration against the active project's state:

- Rule ID collisions: pack defines a rule mode that contradicts the project's current
  `policy.json` rule map.
- Agent ID collisions: pack registers an agent that already exists in
  `.flint/agent-policy.json` with a different tier or ACL.
- Policy value conflicts: pack's `deltaE_threshold` or `a11y.level` differs from the
  project's current value.
- Fragment file conflicts: a `claude-fragments/` file would overwrite an existing
  `.claude/` file with different content.

**Merge strategies** (user selects via parameter or Glass import wizard):

| Strategy | Behavior |
|----------|----------|
| `override` | Pack values win. Existing conflicting config is replaced. |
| `skip-conflicts` | Pack values are applied everywhere there is no conflict. Conflicts are skipped and logged. |
| `interactive` | Conflict list is surfaced in the Glass import wizard. User resolves each conflict individually before import proceeds. |

**Rollback:** Before writing any files, the importer snapshots the current `.flint/`
directory and records the snapshot path in the mutation provenance ledger
(`V.2-mp`, `flint_mutation_provenance`). A dedicated `flint_pack_rollback` tool
(included in this phase) restores from that snapshot. This is the same pattern as
`FileTransactionManager`'s atomic `.tmp` → `rename` queue — never destructive until
the snapshot exists.

**Glass import wizard:**

A new modal in Flint Glass (pattern: `ExportModal.tsx`) guides the user through import:

1. Pack preview: name, author, trust tier badge, contents list, stack tags.
2. Compatibility check: Flint version compatibility, domain match.
3. Conflict report: table showing each conflict with current value vs. incoming value.
   Color-coded: green (no conflict), amber (advisory difference), red (blocking conflict).
4. Strategy selector: `override` / `skip-conflicts` / `interactive`.
5. Confirmation: summary of what will change. "Import" button triggers `flint_pack_import`
   via `mcpClient.ts` (Bidirectional Action Flint, W.3).
6. Undo affordance: toast notification after import with "Undo import" action wired to
   `flint_pack_rollback`.

**Why this priority:**

Import is the value-delivery step. Export without import is a file generator with no
destination. This phase completes the pack lifecycle for local / team use cases, which is
the primary use case before any registry exists.

The conflict resolution design matters here because governance misconfiguration is the
failure mode Flint exists to prevent. An import wizard that silently clobbers a team's
policy is worse than no import at all.

**Revenue / demo impact:**

The import wizard is the primary demo moment for GPX. "Here is a HIPAA governance pack.
Watch Flint apply it to a greenfield project in 10 seconds, detect what it conflicts with
in the current setup, and let the designer decide how to resolve it." This is a
differentiated live demo no competitor can match.

**Competitive moat:**

Conflict detection for governance configuration is novel. No other tool surfaces "your
current a11y conformance level is AA but this pack requires AAA — what do you want to do?"
That combination of explicitness and user agency is what makes Flint trustworthy to
enterprise buyers.

---

### GPX.3 — Registry + Discovery

| Field | Value |
|-------|-------|
| **ID** | GPX.3 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | GPX.2 (BACKLOG), SEC.4 (ONLINE — safe storage for registry tokens) |
| **Status** | BACKLOG |

**What:**

A publicly accessible Governance Pack Registry and three new MCP tools:

**`flint_pack_search`** — Search the registry by stack tags, domain, author, or keyword.
Returns a ranked list of pack summaries with trust tier, version, and download count.
Results are injected into the MCP response as structured JSON so the AI agent (or Glass
search UI) can render them directly.

**`flint_pack_publish`** — Publishes a `.flint-pack.zip` archive to the registry.
Requires an authenticated registry token (stored via `safeStorage`, same path as SEC.4).
On publish, the registry:
- Verifies the checksum.
- Scans `claude-fragments/` for secrets (regex patterns for API key formats).
- Validates `manifest.json` schema and all included `policy.json` / `agent-policy.json`
  files against Flint's current schemas.
- Assigns trust tier: `community` by default; `verified` after author identity confirmation;
  `official` reserved for org-curated packs.

**`flint_pack_subscribe`** — Subscribes the active project to a registry pack. Stores the
subscription in `.flint/pack-subscriptions.json`. When a subscribed pack publishes a new
version, the MCP push channel (`mcp-events.jsonl`, Phase W.1) delivers a notification event
to Glass. The notification shows the new version, changelog, and a "Review update" button
that opens the import wizard pre-populated with the diff.

**Registry infrastructure options (deferred decision, see below):**

Three candidates for the registry backend, in ascending complexity:
1. A git repository (GitHub) acting as a static JSON index. Low ops overhead. No real-time
   search. Acceptable for launch.
2. A lightweight npm-registry-compatible endpoint (e.g., Verdaccio). Pack IDs are npm
   package names with a `@flint-pack/` scope. Gives us `semver` resolution for free.
3. A Flint-hosted API. Maximum control, maximum ops cost. Not the right choice until
   the community proves demand.

The recommendation is option 2 for GPX.3: npm-compatible registry under a
`@flint-pack/` scope. Pack IDs become npm package names. Version resolution is semver.
`flint_pack_import` accepts either a registry ID (`@flint-pack/acme-healthcare`) or a
file path. This gives us a proven, battle-tested distribution primitive with minimal
infrastructure.

**Glass discovery panel:**

A new "Packs" tab in the right sidebar (alongside Properties, Tokens, Activity, Health).
Displays: subscribed packs with version badges, a search bar wired to
`flint_pack_search`, and install/update actions. Trust tier is shown as a badge:
`community` (gray), `verified` (blue), `official` (Flint logo).

**Why this priority:**

Registry is P2 because local pack exchange (GPX.1 + GPX.2) already delivers 80% of
the near-term enterprise value. Teams sharing packs over Slack or a shared drive is a
valid and sufficient use case for the first wave of customers. The registry becomes
critical when the community outgrows manual pack distribution — likely 6–12 months post-
GPX.2 launch.

**Revenue / demo impact:**

The registry enables a new revenue line: verified and official pack tiers can be paywalled
for enterprise-grade compliance packs (HIPAA, SOX, Section 508). It also generates product
telemetry: which governance patterns are most adopted, which rule sets see the most
overrides. That data directly informs Flint's roadmap.

**Competitive moat:**

A governed, trust-tiered registry for AI agent configuration is a category-defining
artifact. Figma has a community plugin marketplace. Flint has a governance pack exchange.
The narrative writes itself.

---

### GPX.4 — Enterprise Distribution

| Field | Value |
|-------|-------|
| **ID** | GPX.4 |
| **Priority** | P2 |
| **Effort** | L |
| **Dependencies** | GPX.3 (BACKLOG), AGV.1 (ONLINE), POL.1 (ONLINE) |
| **Status** | BACKLOG |

**What:**

Organization-level governance pack management, targeting enterprise design system teams
and compliance officers.

**Organization-scoped registries:** Private pack registry namespaces, accessible only to
members of an organization. Pack IDs are scoped: `@acme/hipaa-governance`. Registry
access is controlled by a registry token bound to an org identity.

**Admin-pushed packs:** An org admin can mark a pack as mandatory for all projects in the
organization. When a Flint project is opened, the MCP server checks whether all mandatory
packs are installed and at the correct version. If not, a blocking notification in Glass
prompts the user to install the required pack before export is permitted. This enforcement
uses the existing Export Gate (`B.2` / `B.1-d`) — a new `PACK-COMPLIANCE` violation type
is added to the violation taxonomy, with `blocking` mode by default.

**Compliance packs:** Curated official packs for regulated industries:

| Pack | Domain | Key rules enforced |
|------|--------|--------------------|
| `@flint-official/hipaa-ui` | healthcare | AAA a11y conformance, strict color delta (1.5 ΔE), no hardcoded PHI-adjacent strings in components, manual review required for all AI mutations |
| `@flint-official/sox-fintech` | fintech | Immutable audit trail for all mutations, elevated agent tier required for financial UI components |
| `@flint-official/section-508` | government | WCAG 2.1 AA minimum, Section 508 supplement rules, all exports require a11y audit sign-off |

Compliance packs are maintained by Flint and versioned independently of the core product.
They are distributed through the official registry tier and require Flint's signature in
the manifest checksum.

**Pack analytics (Glass Governance Dashboard extension):**

Extends the existing `GovernanceDashboard.tsx` (Phase V.1-gd) with a "Packs" sub-section:
- Which packs are installed, at what version.
- Override rate per pack: how often are pack-defined rules being overridden.
- Adoption delta: percentage of projects in the org that have the mandatory pack installed.
- Effectiveness trend: violation count before vs. after pack installation (uses the
  mutation provenance ledger baseline from `V.2-mp`).

**SSO-gated registry access:** Private registry tokens can be provisioned via an
organization's identity provider. Token validation is handled server-side by the registry.
Flint Glass stores the token via `safeStorage` (SEC.4). No SSO flow runs inside Flint
itself — the token is obtained out-of-band and pasted into Flint's settings.

**Why this priority:**

GPX.4 is the enterprise monetization phase. Mandatory packs, compliance pack subscriptions,
and private org registries are the features that justify an enterprise license tier.
They are P2 rather than P1 because they require GPX.3 infrastructure to exist first, and
because the self-service community use case (GPX.1 + GPX.2) must be validated before
building enterprise distribution on top of it.

**Revenue / demo impact:**

Compliance packs are a direct revenue line: `@flint-official/hipaa-ui` as an enterprise
add-on is a concrete, purchasable artifact that maps to a real buyer pain (HIPAA
compliance review costs). Admin-pushed mandatory packs are the feature that transforms
Flint from a per-developer tool into an org-wide platform. This is where Flint justifies
an enterprise seat price.

**Competitive moat:**

No competitor offers mandatory, org-pushed governance configuration for AI agent
behavior. Figma tokens are not governance. Chromatic visual regression is not agent policy.
An organization's ability to say "every AI agent that touches our UI must operate under
this compliance pack, always" is a Flint-exclusive capability.

---

## Key Architectural Decisions

### 1. Pack format is a directory, not a proprietary binary

`.flint-pack/` is a directory of plain JSON and Markdown files, zipped for transport.
This means packs are human-readable, diff-able in git, and do not require a Flint binary
to inspect. The archive format is standard zip (not tar.gz) for Windows compatibility.

### 2. Pack import is additive by default; never destructive without snapshot

Before any file in `.flint/` is modified, a full snapshot of the directory is written to
a temporary location and registered in the provenance ledger. `flint_pack_rollback`
restores from the snapshot. This mirrors `FileTransactionManager`'s `.tmp` → `rename`
pattern (Commandment 12). The user always has an undo path.

### 3. Policy merge uses policyEngine.ts primitives, not string manipulation

When a pack's `policy.json` is merged into the project's `policy.json`, the merge is
performed by deserializing both files through `loadPolicy()`, deep-merging the resulting
`ResolvedPolicy` objects according to the selected merge strategy, then re-serializing.
No string-level JSON manipulation. Commandment 13 (deterministic surgery) applies to
policy files as much as to source code.

### 4. Agent policy merge uses AgentPolicyFile interface directly

`flint_pack_import` reads the pack's `agent-policy.json` as an `AgentPolicyFile`, calls
the existing `registerAgent()` function for each new agent entry, and re-serializes the
merged result to `.flint/agent-policy.json`. Agents already registered are handled
according to the selected merge strategy.

### 5. CLAUDE.md fragments are opt-in and previewed before injection

The import wizard shows the full text of every `claude-fragments/` file before applying it.
Fragments are injected by appending to the project's `.claude/` directory structure, never
by overwriting. If a file at the target path already exists, the conflict system treats it
as a fragment collision and routes it through the standard conflict resolution flow.

### 6. Registry backend is npm-compatible for GPX.3

Using Verdaccio (or a compatible registry) under the `@flint-pack/` npm scope means:
- Semver resolution is handled by the registry, not Flint.
- `flint_pack_import @flint-pack/hipaa-governance@^1.0.0` resolves the latest compatible
  version automatically.
- Registry hosting can be self-managed by enterprise customers for private packs (standard
  Verdaccio deployment, no Flint infra dependency).

### 7. Trust tier is registry-assigned, not self-declared

The `trust_tier` field in `manifest.json` is set by the registry at publish time, not by
the pack author. When importing from a local file, `trust_tier` defaults to `community`
regardless of what the manifest declares. This prevents a malicious pack from falsely
claiming `official` status.

---

## Integration with Existing Flint Modules

| Module | Integration point |
|--------|------------------|
| `electron/agentPolicy.ts` (AGV.1) | `flint_pack_import` calls `registerAgent()` for each agent defined in the pack's `agent-policy.json`. Rollback calls `resetAgentRegistry()` then re-loads from the pre-import snapshot. |
| `flint-mcp/src/core/policyEngine.ts` (POL.1) | `flint_pack_export` calls `loadPolicy()` to read current policy. `flint_pack_import` calls `validatePolicy()` on the incoming pack policy before merge, then calls `resolvePolicy()` on the merged result to confirm it is valid. |
| `flint-mcp/src/core/mutationProvenanceService.ts` (V.2-mp) | Every pack import event is recorded as a `flint_pack_import` provenance entry with `source: pack:<pack-id>@<version>`. Rollback records a corresponding `flint_pack_rollback` entry. |
| `electron/FileTransactionManager.ts` (E.2) | All `.flint/` file writes during pack import are routed through `FileTransactionManager`. No direct `fs.writeFile`. |
| `flint-mcp/src/server.ts` | `flint_pack_export`, `flint_pack_import`, `flint_pack_rollback`, `flint_pack_search`, `flint_pack_publish`, `flint_pack_subscribe` registered as new MCP tools in the same pattern as existing tool registrations. |
| `electron/agentPolicy.ts` tier system | The `trust_tier` of an imported pack maps to the maximum `AgentTier` that pack-defined agents are allowed to claim: `community` → `standard`, `verified` → `elevated`, `official` → admin-approvable. A `community` pack cannot self-escalate agent permissions beyond `standard`. |
| `src/components/ui/ExportModal.tsx` (B.2) | Import wizard follows the same modal pattern and reuses the pre-flight audit display components. |
| `src/components/ui/GovernanceDashboard.tsx` (V.1-gd) | GPX.4 extends the health tab with a "Packs" sub-section. |
| `electron/store.ts` (SQLite) | A new `pack_subscriptions` table stores subscribed pack IDs, current installed version, and the registry URL. |
| MCP push channel (W.1, `mcp-events.jsonl`) | Pack update notifications are delivered as push events. Glass surfaces them via `useMCPEventListener`. |
| Export Gate (B.2, B.1-d) | GPX.4 adds `PACK-COMPLIANCE` as a violation type that blocks export when mandatory packs are missing or out of date. |

---

## Do NOT Build

This section is as important as the spec. GPX should not become a plugin marketplace for
Flint's rendering or linting engine. The following are explicitly out of scope for the
GPX track.

| What | Why it is out of scope |
|------|----------------------|
| UI component libraries in packs | GPX is governance configuration, not design system content. Components belong in the component registry (G.2 / O.3b). |
| Custom Mithril linting rules (new rule authoring) | Rule authoring is a separate capability requiring AST traversal logic. It would require sandboxed code execution inside a pack, which is a security surface GPX is not designed to handle. |
| Pack-bundled design tokens | Tokens have their own sync pipeline (Phase C — real-time token sync). Mixing token distribution with governance pack distribution creates two competing token sources. |
| A full plugin system (arbitrary code execution) | Skills in GPX.1 are restricted to MCP tool call compositions — they cannot execute arbitrary Node.js code. Flint is not a plugin host. |
| Social features (comments, likes, follows) on the registry | These are distractions until the registry has content. Build community tooling after the content problem is solved. |
| Pack version rollback via git | Rollback uses the snapshot pattern, not git. Git is for source code history (GitManager). The `.flint/` directory is configuration, not source. Mixing the two creates recovery ambiguity. |
| Automatic pack updates without user confirmation | Auto-update of governance configuration without user review is a trust violation. Updates are surfaced as notifications; the user always confirms. |
| A GUI pack editor inside Flint Glass | Glass is the observability layer. Pack authoring happens in the host IDE by editing the `.flint-pack/` directory. Flint validates and exports. It does not author. |

---

## Risks and Open Questions

| Risk | Mitigation |
|------|-----------|
| A malicious community pack escalates agent permissions | Trust tier caps the max `AgentTier` a pack-defined agent can claim. `community` packs cannot grant `elevated` or `admin` tier. The registry's secret scan catches credential leakage. |
| Pack import breaks a project's existing policy silently | The conflict pre-scan runs before any file is written. No-conflict imports are explicit in the wizard ("no conflicts detected"). All imports are provenance-recorded and rollback-able. |
| Registry infrastructure creates a hosting dependency | For GPX.3, the npm-compatible registry (Verdaccio) can be self-hosted by enterprise customers. Flint does not need to operate the registry to deliver GPX.3 value. |
| `claude-fragments/` injection creates prompt injection attacks | Fragment files are previewed before injection. The import wizard shows the full raw text. Flint does not execute fragment content — it copies files. The risk is the same as any `.claude/` file. |
| Teams create conflicting mandatory packs (GPX.4) | Mandatory pack conflict resolution follows the same merge strategy model as GPX.2. Admin-pushed packs are applied in declaration order; later declarations win on conflict. |
| Pack schema versioning diverges from Flint schema versioning | `schema_version` in `manifest.json` is independent of `policy.json` version. `flint_pack_import` checks `compatibility.flint_min_version` and rejects packs that require a newer Flint version. |

---

## Handoff Prompt for flint-architect

Plan a new Phase GPX.1 feature: Flint Governance Pack Export. The user wants to bundle
their project's current governance configuration — `.flint/policy.json`,
`.flint/agent-policy.json`, skill files, and selected `.claude/agents/` fragments — into
a portable `.flint-pack.zip` archive via a new MCP tool called `flint_pack_export`.

It should extend Phase AGV.1 (electron/agentPolicy.ts — AgentPolicyFile interface) and
Phase POL.1 (flint-mcp/src/core/policyEngine.ts — loadPolicy, validatePolicy,
ResolvedPolicy types). The pack format spec and manifest.json schema are defined in
docs/strategy/FEATURE-SPEC-GOVERNANCE-PACK-EXCHANGE.md.

Key constraints:
- New MCP tool `flint_pack_export` registered in flint-mcp/src/server.ts following
  existing tool registration patterns.
- Tool must accept a `dry_run` parameter (boolean, default false) that reports the bundle
  contents without writing the archive.
- The manifest.json checksum field must be a SHA-256 hash of all non-manifest files in
  the bundle, deterministically ordered.
- No local absolute paths may appear in any bundled file — validation must catch and reject
  them with a structured error list.
- No secrets (API key patterns, environment variable assignments) may appear in
  claude-fragments/ files — run the same secret scan pattern as the registry publish step.
- All file reads must go through existing IPC channels, not direct fs calls from the MCP
  engine.
- Write tests for all new code.
- Run the full test suite and report exact pass/fail counts.
- Run `npx tsc --noEmit` and confirm 0 errors.
- Report results in the format: `[Package]: X/Y passing (Z new)`.

Please identify ownership (MCP tool handler / electron IPC / new flint-mcp service),
check all 16 Commandments, and produce an ordered implementation plan.
