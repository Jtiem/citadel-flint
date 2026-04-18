# Active Swarm Territory Map

**Purpose:** Prevents concurrent swarms from creating merge conflicts by claiming file ownership.
**Protocol:** Before editing any file, check this map. If it's claimed, coordinate or wait.

---

## How to use this map

1. **Before starting a new swarm:** Read this file
2. **If your swarm needs a file in the MODIFY list:** Either wait for ACX to finish, or coordinate by adding your changes to a separate section of the file (e.g., append new IPC handlers, don't restructure existing ones)
3. **If your swarm creates new files:** Add them to this map under your own swarm section
4. **When a swarm completes:** Remove its section from this file

---

## Template for new swarm entry

```markdown
## Swarm: Phase [NAME]

**Status:** [CONTRACTS APPROVED / IN PROGRESS / COMPLETE]

### Files to CREATE
| File | Purpose |

### Files to MODIFY
| File | What changes |
```

---

## Swarm: Phase 2 — PostCSS Parser + CSS Modules + Tailwind v4 CSS-first

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-18)
**Scope:** Third and final phase of the CSS/styling governance expansion. Add PostCSS-based parsing for external `.css`/`.scss`/`.module.css` files so Flint can see styles declared outside JSX. Resolve CSS Modules (`import s from './x.module.css'` → `s.active`). Parse Tailwind v4 CSS-first `@theme {}` blocks. Build a per-project `:root`-scoped custom property map so bare `var(--x)` references resolve. Upgrades Phase 0 coverage verdicts: `external-stylesheet-imported`, `css-modules-reference`, `unresolvable-var`, and `tailwind-config-extension` (for v4 CSS-first case) flip from `partial` / `skipped-unsupported` → `parsed` when resolvable.

### Files to CREATE (anticipated)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/PHASE2-postcss-css-modules-contract.md` | Contract artifact |
| `.flint-context/contracts/PHASE2-postcss-css-modules.contract.ts` | Executable contract |
| `flint-mcp/src/core/cssStylesheetLoader.ts` | PostCSS parser for `.css`/`.scss`/`.module.css` files |
| `flint-mcp/src/core/cssModulesResolver.ts` | Resolves `import s from './x.module.css'` → class name map |
| `flint-mcp/src/core/cssCustomPropertyMap.ts` | Project-scoped `:root` custom property resolver |
| `flint-mcp/src/core/tailwindV4ThemeParser.ts` | Parses `@theme {}` blocks into `ResolvedTailwindTheme` |
| Plus test files + fixtures |

### Files to MODIFY (anticipated)
| File | What changes |
|------|--------------|
| `flint-mcp/src/core/coverageClassifier.ts` | Upgrade 4 reason paths when stylesheets/modules/v4-theme resolve |
| `flint-mcp/src/core/MithrilLinter.ts` | Accept stylesheet token map; `var(--x)` lookup against custom property map |
| `flint-mcp/package.json` | Add `postcss`, `postcss-scss` (optional), `postcss-modules` deps |

**Coordination note:** Phase 2 lives entirely in the MCP engine. No IPC changes, no Glass UI changes. Depends on Phase 1 committed (it is — `a5c09fb`). No overlap with MINT.5, RUNTIME.1, FIGMA-LINT.1, POS.1. Safe to run in parallel with all other active swarms.

---

## Swarm: RUNTIME.1 — axe-core Runtime Adapter

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-18)
**Scope:** Runtime adapter that boots LivePreview (or separate sandboxed BrowserWindow), runs axe-core, pipes findings into Warden SARIF with a new `runtime-dom` source authority. Closes competitive gap #3 — DOM-layer verification that static AST analysis cannot provide.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/RUNTIME.1-contract.md` | Contract artifact |
| `.flint-context/contracts/RUNTIME.1.contract.ts` | Executable contract |

### Files to MODIFY (Phase 2 — after contract approval)
| File | What changes |
|------|--------------|
| `electron/main.ts` | IPC handler `runtime:run-axe` (APPEND ONLY) |
| `electron/preload.ts` | Expose `window.flintAPI.runtime.runAxe` |
| `server/index.ts` | Web-parity mirror |
| `shared/ipc-validators.ts` | Zod schema for runtime IPC |
| `flint-mcp/src/core/A11yLinter.ts` | Accept `runtime-dom` sourceAuthority (APPEND ONLY) |
| `src/components/editor/StatusBar.tsx` | Runtime-mode toggle pill |
| `src/components/ui/GovernanceDashboard.tsx` | Merge AST-time + runtime findings |

**Coordination note:** Phase 2 implementation collides with Phase 0 on `A11yLinter.ts` and `StatusBar.tsx`. Coordinate before implementation — both are append-only changes, should compose cleanly but must be sequenced.

---

## Swarm: FIGMA-LINT.1 — Figma-side Mithril/Warden Lint

**Status:** CONTRACT DRAFTING (architect spawned 2026-04-18)
**Scope:** New MCP tool `flint_audit_figma_frame` using Universal AST (V.3) to run Mithril/Warden against Figma node trees pre-code. Closes competitive gap #2 — pre-code drift detection that Stark and FigmaLint currently own.

### Files to CREATE (contracts phase)
| File | Purpose |
|------|---------|
| `.flint-context/contracts/FIGMA-LINT.1-contract.md` | Contract artifact |
| `.flint-context/contracts/FIGMA-LINT.1.contract.ts` | Executable contract |

### Files to CREATE (Phase 2)
| File | Purpose |
|------|---------|
| `flint-mcp/src/core/universal-ast/FigmaNodeAdapter.ts` | Figma node tree → FlintNode adapter |
| `flint-mcp/src/tools/audit-figma-frame.ts` | New MCP tool handler |
| `flint-mcp/src/core/figmaFrameCache.ts` | Node-tree cache with TTL |
| `flint-mcp/src/**/__tests__/*` | Adapter + tool tests |

### Files to MODIFY (Phase 2)
| File | What changes |
|------|--------------|
| `flint-mcp/src/server.ts` | Register new tool (APPEND ONLY) |

**Coordination note:** No overlap with MINT.5 or Phase 0. Universal AST engines (MithrilLinter, A11yLinter) must NOT be modified — adapter-only pattern preserves the engine-agnostic contract.

---

## Swarm: POS.1 — Positioning Content

**Status:** RESEARCH IN PROGRESS (researcher spawned 2026-04-18)
**Scope:** Angle A positioning content ("The governance layer for AI-generated UI") — landing page copy, Mason generator-positioning doc, investor brief refresh. Closes competitive gap #1 via message positioning, not engineering.

### Files to CREATE
| File | Purpose |
|------|---------|
| `docs/strategy/MASON-POSITIONING.md` | Mason generator positioning ("generate against your design system") |
| `docs/strategy/INVESTOR-BRIEF-2026-Q2.md` | Investor brief refreshed with 2026-04-18 competitive findings |
| `docs/strategy/LANDING-PAGE-COPY.md` | Public-facing landing page copy draft |

### Files to MODIFY (low-priority, Justin approves)
| File | What changes |
|------|--------------|
| `README.md` | Angle A messaging in intro |

**Coordination note:** No code territory claimed. Pure content. Safe to run in parallel with all other swarms.

