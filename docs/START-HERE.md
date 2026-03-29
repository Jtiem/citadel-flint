# Getting Started with Flint Glass

**Prerequisites:** Node.js 22+. Check: `node --version`

## Quick Start (Web Mode)

Run Flint Glass instantly in your browser — no installation required:

```bash
# Try the demo (no project needed):
npx flint-glass --demo

# Or point at your own project:
npx flint-glass --project ./your-app
```

Browser opens at `http://localhost:4201`. Governance violations appear on the canvas within 10 seconds.

---

## What You'll See

1. **Canvas** — your components laid out as inspectable cards
2. **Governance Overlay** — color, typography, and accessibility violations flagged in-place
3. **Health Score** — A–F grade for your design system compliance

---

## Connect Your AI Assistant

Once Flint is running, add the MCP server to your IDE so your AI can audit and fix your code:

### Local dev (repo clone)

**Claude Code:**
```bash
claude mcp add flint -- npx tsx flint-mcp/src/server.ts
```

**Cursor / VS Code (`mcp.json`):**
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

> Note: Run `cd flint-mcp && npm run build` once first if you prefer using the compiled path (`node flint-mcp/dist/server.js`) instead of `npx tsx`.

### Installed package (`npm install flint-glass`)

**Claude Code:**
```bash
claude mcp add flint -- npx flint-mcp
```

**Cursor / VS Code (`mcp.json`):**
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

Then say: `"audit my component"` or `"fix it"` in your AI assistant.

---

## Common Commands

| Command | What it does |
|---------|-------------|
| `npx flint-glass --demo` | Open browser with built-in demo project |
| `npx flint-glass --project ./app` | Open browser with your project |
| `npx flint-glass --port 3000` | Use a different port |
| `npm run dev` | Launch full Electron desktop app |
| `npm run dev:web` | Launch web mode in dev (hot reload) |

---

## Electron Desktop App

For the full experience with native OS menus and file dialogs:

```bash
npm install
npm run dev
```

Requires Node.js 22+ and a macOS/Windows/Linux desktop environment.
