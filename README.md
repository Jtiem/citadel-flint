# Flint

**Prerequisites:** Node.js 22+

Flint is a governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance at the AST level — deterministically, before code reaches production. Flint is the type checker for design systems: the same shift-left move TypeScript made for runtime errors, applied to brand drift and accessibility violations in AI-generated code.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Flint MCP (headless governance engine)                     │
│  13 tools · 6 resources · runs in Claude Code, Cursor, CI   │
│                                                              │
│  MithrilLinter   CIEDE2000 color drift + typography/spacing  │
│  A11yLinter      10 WCAG 2.1 AA rules                       │
│  ASTService      Babel mutation engine — no raw code strings  │
│  registryService Component registry RAG                      │
└────────────────────────────┬─────────────────────────────────┘
                             │ MCP Resources + Tools
┌────────────────────────────▼─────────────────────────────────┐
│  Flint Glass (Electron observability layer)                  │
│                                                              │
│  ┌──────────────────────┬──────────────────────────┐        │
│  │  Infinite Canvas     │  Right Sidebar            │        │
│  │  XYCanvas.tsx        │  Violations, Properties,  │        │
│  │  LivePreview iframe  │  Governance HUDs          │        │
│  └──────────────────────┴──────────────────────────┘        │
│                                                              │
│  Electron main: FileTransactionManager · SQLite · GitManager │
└──────────────────────────────────────────────────────────────┘
```

Glass is a read-only consumer of the MCP engine. All business logic lives in Flint MCP.

---

## Quick Start

```bash
# Install
git clone https://github.com/Jtiem/lunar-elevator-flint.git
cd lunar-elevator-flint
npm install

# Launch Flint Glass
unset ELECTRON_RUN_AS_NODE && npm run dev

# Run tests (366 MCP engine tests)
cd flint-mcp && npm test

# Type check
npx tsc --noEmit
```

> `ELECTRON_RUN_AS_NODE` must be unset before launching. Claude Code sets this variable in its shell environment, which causes Electron to boot headless with no window.

---

## MCP Integration

Add Flint MCP to your Claude Code or Cursor MCP config:

### Local dev (repo clone)

```json
{
  "mcpServers": {
    "flint": {
      "command": "npx",
      "args": ["tsx", "flint-mcp/src/server.ts"]
    }
  }
}
```

> Run `cd flint-mcp && npm run build` once first if you prefer using the compiled path (`node flint-mcp/dist/server.js`).

### Installed package (`npm install flint-glass`)

```json
{
  "mcpServers": {
    "flint": {
      "command": "node",
      "args": ["node_modules/flint-glass/flint-mcp/dist/server.js"]
    }
  }
}
```

Once connected, Flint tools are available to any MCP-compatible agent:

| Tool | What it does |
|------|-------------|
| `audit_ui_component` | Run full Mithril + a11y audit on a component file |
| `apply_ast_mutations` | Apply constrained AST ops (no raw code strings) |
| `flint_query_registry` | Keyword search over component registry |
| `read_design_intent` | Route Figma SDI payload to an Atomic Sync Plan |
| `flint_annotate` | Create governance annotations on AST nodes |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 35.7.5 |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite |
| Canvas | `@xyflow/react` v12 |
| State | Zustand v5 |
| Persistence | SQLite (`better-sqlite3`) + PowerSync SDK |
| AST Engine | Babel (TSX parse, traverse, generate) |
| Color Science | CIEDE2000 perceptual distance |
| Distribution | Model Context Protocol (MCP) |

---

## License

Private repository. Access by invitation only.
**Owner:** Justin Tiemann — [github.com/Jtiem](https://github.com/Jtiem)
