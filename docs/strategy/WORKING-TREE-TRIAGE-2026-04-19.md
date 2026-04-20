# Working Tree Triage — 2026-04-19

## The concern

The branch `feat/review-renderer-pilot` is the working branch for everything in flight. As of today it carries:

- **177 dirty files** (128 modified, 49 untracked)
- **13 commits ahead of `main`**
- Touches across [src/](src/) (104 files), [.flint-context/](.flint-context/) (18), [flint-mcp/](flint-mcp/) (15), [demos/](demos/) (13), [website/](website/) (6), [docs/](docs/) (6), and more

This is not "in-progress on a single feature." It's a single branch carrying **multiple unrelated workstreams** layered on top of each other. That makes three problems:

1. **Beta-checklist Gate 5 says "main is green" and "Beta tag cut from main, not a feature branch."** We can't cut a Beta tag from this branch — it bundles work of varying readiness.
2. **Every new commit (COUNSEL.1, FORGE.1) inherits this branch's history**, so even clean work is contextually entangled with unfinished work.
3. **Risk of accidental staging.** Today's commits stayed clean only because every git agent was given an explicit allowlist. One slip with `git add -A` would bundle half-finished work into a "done" commit.

## What's actually in the tree

Inferred from commit titles + file paths — not exhaustive, treat as a starting map:

| Workstream | Status | Files / area | Disposition |
|---|---|---|---|
| **COUNSEL.1** (health score) | Shipped today (`da5a9a0`) | engine + parity test | Already committed clean |
| **FORGE.1** (3-channel launch) | Shipped today (`235c5dd`) | LaunchScreen + smart-open IPC | Already committed clean |
| **FIXTURE.1 / Audit Context** | Shipped (`882343a`) | flint-mcp/audit context | Committed |
| **MINT.5.2 / 5.3** (sync polish) | Shipped (`8c1d448`, `1db3e7f`, `80d465c`) | sync surfaces | Committed |
| **PHASE 0 / 1 / 2** (coverage, Tailwind, CSS Modules) | Shipped (`42b9771`, `a5c09fb`, `4927572`) | coverage classifier, config loader | Committed |
| **Review renderer pilot** | Shipped (`7c28f67`) | `.review.ts` → `.md` | Committed |
| **MINT.5 phase3** | Untracked contracts in `.flint-context/` | tokens phase 3 contracts | Decide: ship, archive, or delete |
| **RUNTIME.1** | Untracked contracts + reviews + electron tests | runtime axe IPC | Decide: ship, archive, or delete |
| **FIGMA-LINT.1** | Untracked contract | figma lint | Decide: ship, archive, or delete |
| **mcpClient hardening** | Modified `electron/mcpClient.ts`, `server/mcpClient.ts`, `electron/__tests__/mcpClient.classification.test.ts`, `electron/__tests__/preload.mcp-validation.test.ts` | preload validation, classification | Decide: ship or revert |
| **A11yLinter / governance** | Modified `flint-mcp/src/core/A11yLinter.ts`, `governance/ruleProvenanceRegistry.ts`, `governance/types.ts`, `core/config.ts` | Warden updates | Decide: ship or revert |
| **Demo fixtures** | Modified `build-resources/demo-project/*`, `build-resources/demos/*`, `demos/*`, `electron/templates/flint-demo/*` | Lots of demo files touched — likely Sage/Mason iterations | Decide: ship or revert |
| **Glass UI churn** | Modified across `src/components/`, `src/store/`, `src/hooks/` | Many components touched (StatusBar, GovernanceDashboard, TokenManager, etc.) | Mixed — needs file-by-file triage |
| **Strategy docs** | Untracked `docs/strategy/COMPETITIVE-LANDSCAPE-2026-04-18.md`, `INVESTOR-BRIEF-2026-Q2.md`, `LANDING-PAGE-COPY.md`, `MASON-POSITIONING.md`, `WEEKEND-PLAN-2026-04-18.md` | Drafts | Move to `docs/strategy/drafts/` or delete |
| **Reviews + contracts** | 18 untracked files in `.flint-context/` | review artifacts from prior sessions | Most should commit alongside the work they reviewed |

## Three options for cleanup

You don't have to pick one — you can mix them per workstream.

### Option A — **Land it** (recommended for clean, reviewed work)
For workstreams that are done and reviewed (mcpClient hardening, A11yLinter updates, MINT.5 phase 3 if its contract is approved): give them the same Contract → Phase 2 → Review → Commit treatment we just gave COUNSEL.1 and FORGE.1. Each one becomes a small commit on the branch. Cost: a session per workstream. Risk: low if reviews come back clean.

### Option B — **Archive to a parking branch** (recommended for "interesting but not Beta-blocking")
For untracked contracts/reviews that explore directions we may not pursue (RUNTIME.1, FIGMA-LINT.1 if they're not part of Beta scope): create a `parking/<name>` branch, commit the work there, then `git restore` the files on the working branch. Nothing is lost; nothing pollutes the Beta path. Cost: 5 minutes per workstream. Risk: zero — fully recoverable.

### Option C — **Delete with intent** (recommended for sketches and dead drafts)
For untracked strategy drafts that have served their purpose (the brainstorming docs from 04-18), or modified files that are local experiments you don't want to keep: `git restore` (modified) or `rm` (untracked). Cost: zero. Risk: data loss if undocumented — so before deleting, copy any reusable text into a permanent doc (CONTENT-BIBLE, FEATURE-BUDGET, etc.).

## Recommended sequence (when you're ready)

1. **Audit pass.** One session that does nothing but classify every dirty file into A/B/C. Output: a checklist.
2. **Apply C first.** Delete the dead drafts and revert local experiments. Tree shrinks fastest, no review needed.
3. **Apply B next.** Park the speculative workstreams. Tree shrinks more.
4. **Apply A last.** The remaining workstreams are real and need the full Contract → Review → Commit pipeline. Run them one at a time, prioritizing whatever's a Beta-blocker.
5. **Then merge to `main`.** The branch is now coherent; all 13+ commits represent shipped, reviewed work. Open a PR, run CI, merge. `main` becomes the Beta-tag candidate.
6. **Cut the Beta tag from `main`.** Per Beta checklist Gate 5.

## Anti-patterns to avoid

- **`git add -A` or `git add .`** — has bundled half-finished work into "done" commits before; today we avoided it only by giving every git agent an explicit allowlist.
- **`git stash` as a triage strategy** — stashes accumulate, get forgotten, and become invisible technical debt. If something is worth keeping, branch it.
- **`git reset --hard`** — destructive, often used to "just clean up." Do not run unless every dirty file has been reviewed against this triage doc and explicitly disposed of.
- **Squashing the 13 commits before the audit.** Squashing loses the per-workstream history that makes triage possible.

## Why this matters for Beta

[Beta checklist Gate 5](BETA-READINESS-CHECKLIST.md) explicitly requires:
- `feat/review-renderer-pilot` merged or closed
- All in-flight contracts/reviews under `.flint-context/` resolved or archived
- `main` is green
- Beta tag cut from `main`, not a feature branch

We cannot tick any of these until the working tree is triaged. This is not optional — it's a sequencing dependency for the whole Beta.

## Estimated scope

Not giving time estimates (per standing rule), but in terms of complexity:

- **C (delete)**: trivial — 1 session
- **B (archive)**: cheap — 1 session for several parks
- **A (land)**: per-workstream cost equivalent to FORGE.1 today — Contract → Phase 2 → Review → Commit per item

The honest read: this is at least one focused triage session followed by a short series of land-it sprints. It is not "shippable in a day" if the goal is a clean `main`.
