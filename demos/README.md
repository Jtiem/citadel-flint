# Flint MCP — Demo Fixtures

Runnable, repeatable demo scenarios for the Flint governance engine. Each subfolder is a self-contained story: an input file (or pair of files) that demonstrates one capability of Flint MCP, plus a `README.md` describing what to run and what to expect.

## Prerequisites

```sh
cd flint-mcp && npm install && npm run build
```

The demos assume Flint MCP is built and running. Connect a client (Claude Code, Cursor, or any MCP-compatible IDE) to the server before stepping through a demo.

---

## Demo Index

| # | Folder | One-line description |
|---|--------|----------------------|
| 01 | `01-rag-ui-builder/` | AI reads the component registry via RAG and rewrites a hardcoded notification panel to use semantic design tokens |
| 02 | `02-self-correcting/` | Flint's in-memory TSC loop catches three AI-hallucinated type errors before they reach the user as a diff |
| 03 | `03-mithril-shadow-audit/` | CIEDE2000 perceptual color diffing surfaces five drift violations on a pricing card whose author eyeballed colors from a Figma screenshot |
| 04 | `04-sentinel/` | The Flint Sentinel rejects an AI-generated order form for violating Hick's Law (10-button toolbar) and Miller's Law (16 always-visible fields) |
| 05 | `05-semantic-refactor/` | Legacy `<div className="box">` soup is surgically upgraded to typed design system primitives (`Box`, `Stack`, `TextField`) without changing rendered output |
| 06 | `06-macro-recovery/` | Git Time Machine identifies two deleted AST subtrees and transplants them back surgically — without reverting the surrounding refactor |
| 07 | _(planned)_ `07-figma-sync/` | Bidirectional token sync: Figma variables pushed via SDI webhook, Flint reconciles drift against the running design system |
| 08 | _(planned)_ `08-ci-gate/` | `flint audit` run as a CI step — SARIF output, exit code 1 on critical violations, PR blocked until resolved |
| 09 | _(planned)_ `09-a11y-expand/` | 30-rule A11Y expansion catches heading skips, missing landmark regions, and generic link text across a multi-component page |

---

## Running a Demo

Each demo is meant to be opened in a Flint-connected IDE session. The general pattern:

1. Point the MCP server at the demo directory as the working root.
2. Open the component file in the IDE.
3. Invoke the relevant MCP tool listed in the demo README (e.g. `audit_ui_component`, `flint_ast_mutate`, `flint_query_registry`).
4. Observe violations, auto-fixes, or recovered AST nodes in Flint Glass.

---

## Shared Token File

`demos/design-tokens.json` is the canonical W3C DTCG token file used across all demos. Individual demo subfolders may include a local copy for self-containment.

**Token summary:**

| Group | Tokens |
|-------|--------|
| `color.*` | `primary` (#0066FF), `surface` (#FFFFFF), `on-surface` (#111827), `on-surface-muted`, `border`, `danger`, `success`, `warning` |
| `spacing.*` | 4, 8, 12, 16, 20, 24, 32, 40, 48 px |
| `fontSize.*` | xs (12px), sm (14px), base (16px), lg (20px), xl (24px), 2xl (32px) |
| `fontFamily.*` | `sans` (Inter), `mono` (JetBrains Mono) |
| `borderRadius.*` | sm (4px), md (8px), lg (12px), full |
| `shadow.*` | sm, md, lg, xl |
