# JTBD Gap-Fill Plan — Flint 7.5 → 9.0

**Date:** 2026-03-14 (last updated: 2026-03-14)
**Authors:** Product Planner + Architect joint review
**Baseline:** Glass 7.5 | MCP Chat 8.5 | Cross-Channel Coherence 6.5 | **Composite: 7.5/10**
**Current:** Glass 8.5 | MCP Chat 8.7 | Cross-Channel Coherence 8.0 | **Composite: 8.4/10**
**Status:** Waves 1-2 COMPLETE. Wave 3 REMAINING.

---

## Executive Summary

Flint's two surfaces — Glass (Electron observability UI) and MCP Chat (AI governance in the host IDE) — each score well independently but lose ~1.5 points on cross-channel coherence. The primary gap: **information flows MCP → Glass weakly**, and **Glass cannot trigger MCP actions at all**. Closing these gaps moves the JTBD score from 7.5 to 9.0+.

### What's Working (Why We're at 7.5)

**Glass strengths:**
- 43 production modules ONLINE, 41 React components, 9 Zustand stores
- Infinite canvas with live preview, governance overlays, spatial badges
- Export Gate blocks non-compliant code (Mithril + A11y pre-flight)
- Undo/redo with surgical Git recovery (single-file + cross-file)
- 48 IPC channels powering the full process boundary surface

**MCP Chat strengths:**
- 10 MCP tools (audit, fix, mutate, ingest, sync, query)
- 4 MCP resources (tokens, manifest, rules, violations)
- 2 MCP prompts (sentinel persona, intent composer)
- 11 AI Orchestrator tools in constrained catalog
- Context Flint syncs Glass state to MCP via `.flint/context.json`

### What Was Missing (Why We Were at 7.5)

1. ~~**Annotations invisible in Glass**~~ — SOLVED (COLLAB.4): `annotationStore`, `AnnotationList`, LayerTree dots, `fs.watch` push sync
2. ~~**No governance dashboard**~~ — SOLVED (V.1-gd): Health score ring, grade letter, top-5 rules, "health" tab
3. ~~**Activity tab shows legacy chat panel**~~ — SOLVED (V.2-af): ActivityFeed embedded in AgentChatPanel with filter bar, search, error view
4. **No MCP-to-Glass push** — REMAINING (W.1): MCP events don't proactively surface in Glass
5. **Glass is read-only** — REMAINING (W.3): No way to trigger audit, fix, or approve from the canvas
6. ~~**Figma connection is a dead modal**~~ — SOLVED (W.2): StatusBar popover with staleness colors
7. ~~**Governance is sidebar-only**~~ — SOLVED (U.1): Ghost Canvas severity heat tints, ViolationTooltip, viewport culling

---

## Priority Stack

| Rank | Phase | Feature | JTBD Gain | Size | Wave | Status |
|------|-------|---------|-----------|------|------|--------|
| 1 | COLLAB.4 | Annotation Rendering in Glass | +0.6 | M | 2 | **DONE** |
| 2 | V.1-gd | Governance Health Dashboard | +0.4 | M | 2 | **DONE** |
| 3 | V.2-af | Activity Feed Upgrade | +0.3 | S | 1 | **DONE** |
| 4 | W.1 | MCP-to-Glass Push Channel | +0.3 | L | 3 | REMAINING |
| 5 | W.2 | Figma Connection Status | +0.15 | S | 1 | **DONE** |
| 6 | U.1 | Ghost Canvas (Spatial Overlays) | +0.25 | M | 1 | **DONE** |
| 7 | W.3 | Bidirectional Action Flint | — | XL | 3 | REMAINING |
| 8 | — | MCP Tool Discoverability | +0.1 | S | 1 | **DONE** |

**Sum: ~2.1 points** — sufficient margin to reach 9.0 even with partial completions.

---

## Implementation Waves

```
Wave 1 — Foundation (parallel, no inter-gap dependencies):
  ├── V.2   Activity Feed Upgrade
  ├── W.2   Figma Connection Status
  ├── U.1   Ghost Canvas — extend ShieldOverlay
  └── MCP   Tool Discoverability (flint://capabilities)

Wave 2 — Data Layer (new IPC infrastructure):
  ├── COLLAB.4  Annotation rendering in Glass
  └── V.1       Governance Dashboard panel

Wave 3 — Action Layer (requires MCP client):
  ├── W.1   MCP-to-Glass Push Channel
  └── W.3   Bidirectional Action Flint
```

---

## Phase V.2 — Activity Feed Upgrade

### Problem
Activity Feed (`src/components/ui/ActivityFeed.tsx`) shows MCP tool calls but is read-only — no filtering, search, or actions. Worse, the 'activity' tab in `App.tsx:374` renders the legacy `AgentChatPanel` instead of `ActivityFeed`. Per CLAUDE.md: "Chat lives in the host IDE via MCP — there is no chat panel inside Flint Glass."

### Success Criteria
- 'activity' tab renders `ActivityFeed`, not `AgentChatPanel`
- Filter by outcome (success / error / blocked) with one click
- Search by tool name or input summary
- Error entries show "View" button → navigates to affected file
- Header shows outcome count badges (errors, blocked)

### Architecture

**Changed files:**
| File | Change |
|------|--------|
| `src/App.tsx:374` | Swap `<AgentChatPanel />` → `<ActivityFeed />` |
| `src/components/ui/ActivityFeed.tsx` | Add filter bar, search input, "View" button on error rows |

**No new stores, IPC channels, or modules needed.** All changes are local component state (filter/search are transient UI state, reset on mount). Polling loop (3s interval, reads `.flint/activity-log.jsonl` via `window.flintAPI.readFile`) unchanged.

**Scope boundary:** Filtering + search + view button ship now. "Retry" and "Approve/Reject" buttons depend on Phase W.3 (Bidirectional Action Flint) and will be added after Wave 3.

**Risk:** Low. Primarily a UI enhancement.

---

## Phase W.2 — Figma Connection Status

### Problem
"Connect Figma" on LaunchScreen is a dead notice modal. StatusBar shows only a green dot. No last-sync timestamp, token counts by type, or ingestion server health.

### Success Criteria
- StatusBar Figma area clickable → popover with server status, last sync, token breakdown
- Figma dot color: emerald (synced <24h), amber (24–72h stale), zinc (never / server down)
- LaunchScreen "Connect Figma" links to setup docs instead of notice modal

### Architecture

**Implementation note:** The Figma status popover was implemented inline in `StatusBar.tsx` rather than as a separate component. No `FigmaStatusPanel.tsx` file exists.

**Changed files:**
| File | Change |
|------|--------|
| `electron/ingestion-server.ts` | Expose `getFigmaStatus()` → `{ running, lastWebhookAt, tokenCounts }` |
| `electron/preload.ts` | Add `flintAPI.figma.status()` IPC channel |
| `electron/main.ts` | Register IPC handler for `figma:status` |
| `src/components/editor/StatusBar.tsx` | onClick handler for Figma area, staleness color logic |
| `src/components/ui/LaunchScreen.tsx` | Replace `figmaNotice` modal with docs link |

**Risk:** Low. Self-contained UI + one new IPC channel.

---

## Phase U.1 — Ghost Canvas (Spatial Governance Overlays)

### Problem
Governance is sidebar-only. Violations should be a first-class visual layer on the canvas, not just a list in the right panel.

### Success Criteria
- Toggle governance view shows severity heat on nodes (green = clean, amber = warnings, red = criticals)
- Hover violation badge → tooltip with violation summary and count
- Click violation badge → select node + switch right sidebar to Properties tab

### Architecture

**Extend `ShieldOverlay.tsx`, do not create a separate layer.** ShieldOverlay already renders badges at node positions via `nodeLayouts` from `canvasStore`. It already handles violation outlines and lock icons. Adding a parallel layer would create z-index conflicts and fragment click interception.

Enhancements to ShieldOverlay:
1. **Severity heat tint** — node background color based on cumulative violation severity from `canvasStore.mithrilViolations` + `canvasStore.a11yViolations`
2. **Hover tooltip** — new `ViolationTooltip.tsx` component showing rule IDs, severity, descriptions
3. **Click-to-properties** — clicking a badge calls `setActiveSelection(nodeId)` + sets `rightTab` to 'properties'
4. **Viewport culling** — only render badges for nodes within the visible ReactFlow viewport (performance)
5. **Badge cap** — max 100 badges to prevent layout thrash

**New files:**
| File | Type |
|------|------|
| `src/components/editor/ViolationTooltip.tsx` | Hover popover for violation details |

**Changed files:**
| File | Change |
|------|--------|
| `src/components/editor/ShieldOverlay.tsx` | Heat tint, hover tooltips, click handler, viewport culling |

**No new store needed.** All data already in `canvasStore.mithrilViolations`, `canvasStore.a11yViolations`, `editorStore.linterWarnings`.

**Commandment compliance:**
- C7 (ID Preservation): ShieldOverlay keys everything by `data-flint-id` ✓
- C9 (CIEDE2000): Severity heat derives from existing linter severity, no new color logic ✓

**Risk:** Medium. The `nodeLayouts` map is populated by `NODE_LAYOUT` postMessages from the iframe. If the iframe doesn't report layout for nodes outside its visible scroll area, some badges will be missing. This is a pre-existing limitation.

---

## MCP Tool Discoverability

### Problem
New users (and AI agents) don't know what Flint MCP can do. No structured catalog of tools, parameters, or example invocations.

### Architecture
Purely MCP-side — no Glass changes needed.

**New files:**
| File | Type |
|------|------|
| `flint-mcp/src/core/capabilities/index.ts` | `flint://capabilities` resource handler |
| `flint-mcp/src/prompts/workflow-guide.ts` | Multi-tool sequence composition prompt |

**Changed files:**
| File | Change |
|------|--------|
| `flint-mcp/src/server.ts` | Register new resource + prompt |

**Risk:** Low. Additive and self-contained.

---

## Phase COLLAB.4 — Annotation Rendering in Glass

### Problem
Annotations created via MCP chat (notes, decisions, approvals, handoffs) are invisible in Glass. The data model (COLLAB.1), MCP resource (COLLAB.2), and MCP tool (COLLAB.3) are all built and tested. But Glass has zero rendering for them.

### Success Criteria
- Unresolved annotations for the active file appear in the Properties panel
- Nodes with annotations show a pin indicator in LayerTree
- Clicking an annotation selects the anchored node on the canvas
- Annotations can be resolved from Glass (writes back via IPC → annotation store)

### Architecture

**Key decision: IPC push via `fs.watch`, not polling.** The Activity Feed's 3-second poll model already shows scaling issues. Annotations originate in the MCP/main process (written to `.flint/annotations.json`). Glass should be notified immediately when they change.

**Data flow:**
```
MCP tool (flint_annotate) → writes .flint/annotations.json
  → main process fs.watch detects change
  → fires flint:annotations-changed IPC event to renderer
  → annotationStore.fetchAnnotations() re-reads via IPC invoke
  → React components re-render
```

**New files:**
| File | Type | Specialist |
|------|------|-----------|
| `src/store/annotationStore.ts` | New Zustand store | flint-state-architect |
| `src/components/ui/AnnotationList.tsx` | Properties sub-section | flint-design-engineer |
| `src/components/ui/AnnotationBadge.tsx` | ShieldOverlay integration | flint-design-engineer |

**Changed files:**
| File | Change | Specialist |
|------|--------|-----------|
| `electron/preload.ts` | Add `annotations` namespace (readAll, onChanged) | flint-electron-ipc |
| `electron/main.ts` | IPC handlers + `fs.watch` on `.flint/annotations.json` | flint-electron-ipc |
| `src/components/editor/ShieldOverlay.tsx` | Render AnnotationBadge at node positions | flint-design-engineer |
| `src/components/ui/PropertiesPanel.tsx` | Embed AnnotationList when node has annotations | flint-design-engineer |
| `src/components/ui/LayerTree.tsx` | Indigo dot next to nodes with unresolved annotations | flint-design-engineer |
| `src/App.tsx` | Register `flint:annotations-changed` listener on mount | flint-electron-ipc |
| `src/types/flint-api.ts` | Mirror `FlintAnnotation` type from flint-mcp | flint-state-architect |

**Store shape (`annotationStore`):**
```typescript
interface AnnotationState {
  annotations: FlintAnnotation[]
  annotationsForNode: (nodeId: string) => FlintAnnotation[]  // derived selector
  fetchAnnotations: () => Promise<void>
  resolveAnnotation: (id: string) => Promise<void>
}
```

New store is justified — annotation state is orthogonal to all 9 existing stores. Embedding it in `canvasStore` or `editorStore` would violate single-responsibility.

**Commandment compliance:**
- C4 (Local-First): Reads from local `.flint/` directory ✓
- C12 (Atomic Queuing): Annotation file writes use tmp-rename in MCP's AnnotationStore ✓
- Process Boundary Law: New IPC channels through preload.ts, no direct fs in renderer ✓

**Edge cases:**
- Annotation references a deleted node → show annotation with "node not found" in muted text
- `visibility: 'private'` from another author → filter out (single-user for now)
- Concurrent MCP write + Glass resolve → route through Sync Layer arbiter (Module C)

**Scope boundary:** Read + resolve in Glass. Creating new annotations from Glass is COLLAB.5 (future, depends on W.3).

**Risk:** Medium. ShieldOverlay already renders violation badges and lock icons. Adding annotation pins is a third visual layer — cap at 3 per node with "+N more" overflow.

---

## Phase V.1 — Governance Health Dashboard

### Problem
`flint://dashboard` returns health score (0–100), grade (A–F), top violated files/rules, override telemetry — but users must ask the AI to see project health. No persistent visual surface in Glass.

### Success Criteria
- Health score, grade letter, and top 5 violated rules visible without typing
- Debt trend sparkline shows last 10 snapshots
- Clicking a violated file navigates to that file on the canvas
- Auto-refreshes every 30 seconds or on file change

### Architecture

**Location:** New right sidebar tab "Health" (tab #6). Dashboard is persistent monitoring, unlike GovernancePanel which is configuration. These are distinct concerns and must remain separate.

**Key decision: Synthesize from local `.flint/` files, not MCP server.** The dashboard data can be assembled from sources already available to the Electron main process:
- Linter warnings from renderer (already computed in `editorStore`)
- `.flint/activity-log.jsonl` for recent mutations
- `.flint/rule-overrides.json` for override count
- Run audit on open files (cached per file, invalidate on `flint:file-changed`)

This keeps Glass fully local-first (C4) and does not require the MCP server to be running.

**New files:**
| File | Type | Specialist |
|------|------|-----------|
| `src/components/ui/GovernanceDashboard.tsx` | New panel | flint-design-engineer |
| `electron/dashboardService.ts` | Main process data aggregation | flint-electron-ipc |

**Changed files:**
| File | Change |
|------|--------|
| `electron/preload.ts` | Add `governance.getDashboard` IPC channel |
| `electron/main.ts` | Register IPC handler |
| `src/App.tsx` | Add 'health' to `rightTab` union type (line 53), render GovernanceDashboard |

**Visual design:**
- Large grade letter (A–F) colored emerald/amber/red
- Health score 0–100 as progress ring
- 10-point sparkline SVG of debt history
- Top-5 rules list with severity badges + counts
- Top-5 files list (clickable → navigate)
- Override count chip linking to GovernancePanel

**Risk:** Auditing all workspace files on every refresh is expensive. Mitigation: cache audit results per file, invalidate only on `flint:file-changed` events.

---

## Phase W.1 — MCP-to-Glass Push Channel

### Problem
MCP produces events continuously (governance violations, annotation changes, debt snapshots) but Glass learns about them only through user-initiated actions. No proactive push.

### Success Criteria
- Critical governance event → Glass bell notification within 5 seconds
- Annotation resolved in MCP → LayerTree pin disappears without manual refresh
- Debt report with `track: true` → dashboard sparkline updates within 10 seconds

### Architecture

**Event bus via filesystem:**
```
MCP server (after tool completion)
  → appends to .flint/mcp-events.jsonl
  → Electron main process fs.watch (10s poll fallback for NFS/NAS)
  → tail-follow from stored byte offset
  → emits flint:mcp-event IPC event to renderer
  → useMCPEventListener hook dispatches to stores
```

**New files:**
| File | Type |
|------|------|
| `flint-mcp/src/core/events.ts` | `appendMCPEvent()` + file rotation (200 lines) |
| `src/hooks/useMCPEventListener.ts` | Renderer-side event dispatcher |

**Changed files:**
| File | Change |
|------|--------|
| `electron/main.ts` | fs.watch + tail-follow + `flint:mcp-event` push |
| `electron/preload.ts` | Expose `flintAPI.mcp.onEvent(callback)` |
| `src/store/notificationStore.ts` | Receives critical/warning governance events |
| `src/store/annotationStore.ts` | `.refresh()` on annotation events |

**Debouncing:** Batch events within 500ms into grouped notifications (prevents 50 bells from a bulk audit).

**Catch-up on Glass open:** Only notify for events newer than 60 seconds (prevents storm on startup).

**Risk:** Medium. File rotation and byte-offset tracking add complexity. Must handle truncated writes.

---

## Phase W.3 — Bidirectional Action Flint

### Problem
Glass can observe MCP activity but cannot trigger MCP tools. Users can't run audits, request fixes, or approve mutations from the canvas.

### Success Criteria
- Glass button "Run Audit" invokes `flint_audit` MCP tool and displays result
- Glass button "Auto-Fix" invokes `flint_fix` MCP tool on selected violations
- Activity Feed gains "Retry" and "Approve" action buttons

### Architecture

**Recommendation: Option A — Electron main process as MCP client.**

```
Renderer
  → IPC invoke 'flint:mcp-call-tool'
  → Main process
  → MCP client (@modelcontextprotocol/sdk/client)
  → stdio
  → MCP server child process
  → result
  → back up the chain
```

This is the correct long-term architecture because:
- Respects the process boundary law completely
- Allows Glass to invoke any MCP tool without per-tool IPC boilerplate
- MCP server is designed to be a standalone process — making Electron its client is the intended pattern
- Same client connection works for future Cloud PowerSync (Phase C.1)

**New files:**
| File | Type |
|------|------|
| `electron/mcpClient.ts` | MCP client + child process lifecycle management |

**Changed files:**
| File | Change |
|------|--------|
| `electron/preload.ts` | Add `flintAPI.mcp.callTool(name, args)`, `.readResource(uri)`, `.status()` |
| `electron/main.ts` | Start/stop MCP client on project open/close, register IPC handlers |
| `src/types/flint-api.ts` | Add `mcp` namespace types |

**Unlocks after shipping:**
- Activity Feed "Retry" / "Approve" buttons
- Dashboard "Fix" affordances
- Canvas right-click → "Run Audit" / "Auto-Fix"
- Any future Glass-initiated MCP tool invocation

**Commandment compliance:**
- C4 (Local-First): MCP server is a local process ✓
- C8 (Audit-First): Tool calls from Glass go through the same governance pipeline ✓
- C15 (AST Catalog Only): Glass-initiated mutations still use versioned tool catalog ✓
- Process Boundary Law: renderer → preload → main → MCP via stdio ✓

**Risk: HIGH.** This is the most complex gap:
- Child process management (spawn, crash recovery, graceful shutdown)
- MCP server needs `projectRoot` set correctly — must restart when user opens different project
- Stdio transport buffering can cause message fragmentation
- Testing requires mocking the MCP server process

---

## Commandment Compliance Matrix

| Phase | C4 Local | C6 Gate | C7 ID | C8 Audit | C12 Atomic | C13 Babel | C15 Catalog |
|-------|:--------:|:-------:|:-----:|:--------:|:----------:|:---------:|:-----------:|
| V.2   | ✓ | — | — | — | — | — | — |
| W.2   | ✓ | — | — | — | — | — | — |
| U.1   | ✓ | — | ✓ | — | — | — | — |
| MCP   | ✓ | — | — | — | — | — | — |
| COLLAB.4 | ✓ | — | ✓ | — | ✓ | — | — |
| V.1   | ✓ | ✓ | — | — | — | — | — |
| W.1   | ✓ | — | — | — | ✓ | — | — |
| W.3   | ✓ | ✓ | — | ✓ | — | — | ✓ |

All phases pass. No Commandment violations identified.

---

## Critical Path

```
Wave 1 (parallel) ·················· ✅ COMPLETE
  V.2-af  Activity Feed ··········· S ── ✅
  W.2     Figma Status ············ S ── ✅
  U.1     Ghost Canvas ············ M ── ✅
  MCP     Discoverability ········· S ── ✅

Wave 2 (parallel) ·················· ✅ COMPLETE
  COLLAB.4  Annotations ··········· M ── ✅
  V.1-gd    Dashboard ············· M ── ✅

Wave 3 (sequential) ················ ⬜ REMAINING
  W.1   Push Channel ············ L ──→ W.3   Action Flint ·· XL ──→ 9.0
```

**Critical path gate:** W.3 (Bidirectional Action Flint) must ship before Glass can trigger any MCP tool. All "action" affordances (fix buttons, approve buttons, canvas context menus) are blocked on W.3.

---

## Scorecard

| Milestone | Glass | MCP Chat | Cross-Channel | Composite | Status |
|-----------|:-----:|:--------:|:-------------:|:---------:|--------|
| Baseline | 7.5 | 8.5 | 6.5 | **7.5** | — |
| After Wave 1 | 8.0 | 8.7 | 7.0 | **7.9** | DONE |
| **After Wave 2** | **8.5** | **8.7** | **8.0** | **8.4** | **CURRENT** |
| After Wave 3 | 9.0 | 9.0 | 9.0 | **9.0** | TARGET |
