# Bridge

Bridge is a governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance at the AST level — deterministically, before code reaches production. Bridge is the type checker for design systems: the same shift-left move TypeScript made for runtime errors, applied to brand drift and accessibility violations in AI-generated code.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Bridge MCP (headless governance engine)                     │
│  13 tools · 6 resources · runs in Claude Code, Cursor, CI   │
│                                                              │
│  MithrilLinter   CIEDE2000 color drift + typography/spacing  │
│  A11yLinter      10 WCAG 2.1 AA rules                       │
│  ASTService      Babel mutation engine — no raw code strings  │
│  registryService Component registry RAG                      │
└────────────────────────────┬─────────────────────────────────┘
                             │ MCP Resources + Tools
┌────────────────────────────▼─────────────────────────────────┐
│  Bridge Glass (Electron observability layer)                  │
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

Glass is a read-only consumer of the MCP engine. All business logic lives in Bridge MCP.

---

## Quick Start

```bash
# Install
git clone https://github.com/Jtiem/lunar-elevator-bridge.git
cd lunar-elevator-bridge
npm install

# Launch Bridge Glass
unset ELECTRON_RUN_AS_NODE && npm run dev

# Run tests (366 MCP engine tests)
cd bridge-mcp && npm test

# Type check
npx tsc --noEmit
```

> `ELECTRON_RUN_AS_NODE` must be unset before launching. Claude Code sets this variable in its shell environment, which causes Electron to boot headless with no window.

---

## MCP Integration

Add Bridge MCP to your Claude Code or Cursor MCP config:

```json
{
  "mcpServers": {
    "bridge": {
      "command": "node",
      "args": ["/absolute/path/to/bridge-mcp/dist/server.js"]
    }
  }
}
```

Once connected, Bridge tools are available to any MCP-compatible agent:

| Tool | What it does |
|------|-------------|
| `audit_ui_component` | Run full Mithril + a11y audit on a component file |
| `apply_ast_mutations` | Apply constrained AST ops (no raw code strings) |
| `bridge_query_registry` | Keyword search over component registry |
| `read_design_intent` | Route Figma SDI payload to an Atomic Sync Plan |
| `bridge_annotate` | Create governance annotations on AST nodes |

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
