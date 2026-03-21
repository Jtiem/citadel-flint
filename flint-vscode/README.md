# Flint Governance -- VS Code Extension

Runs Flint governance audits directly in VS Code / Cursor. Displays design drift as amber squiggles, accessibility violations as red squiggles, and provides quick-fix code actions.

## Features

- **Live Diagnostics**: Audit on file save and file open. Violations appear as squiggly underlines.
- **Hover Context**: Rule ID, Delta-E score (for color drift), suggested token, provenance authority.
- **Quick-Fix Actions**: "Fix: Replace with design token `{tokenName}`" for Mithril violations.
- **Workspace Audit**: Audit all `.tsx`, `.jsx`, `.ts`, `.js` files at once.

## How It Works

The extension spawns the Flint MCP server (`flint-mcp/dist/server.js`) as a child process and communicates via JSON-RPC over stdio. All governance logic lives in the MCP engine -- the extension is a thin diagnostic adapter.

## Prerequisites

1. Build the MCP server:
   ```bash
   cd flint-mcp && npm install && npm run build
   ```
2. Ensure your workspace contains `flint-manifest.json` or a `.flint/` directory.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `flint.serverPath` | (auto-detect) | Custom path to `server.js` |
| `flint.autoAuditOnSave` | `true` | Audit on file save |

## Commands

| Command | Description |
|---------|-------------|
| `Flint: Audit Current File` | Run audit on the active editor |
| `Flint: Audit Workspace` | Audit up to 100 files in the workspace |

## Development

```bash
cd flint-vscode
npm install
npm run build    # compile TypeScript
npm test         # run unit tests
```

## Architecture

```
VS Code Extension Host
  extension.ts          -- activation, wiring
  flintClient.ts       -- JSON-RPC stdio client
  diagnosticsProvider.ts -- violation -> Diagnostic mapping
  codeActionProvider.ts -- quick-fix code actions

      |  JSON-RPC stdio
      v

Flint MCP Server (child process)
  flint_audit   -- Mithril + A11y audit
  flint_fix     -- auto-fix token violations
```
