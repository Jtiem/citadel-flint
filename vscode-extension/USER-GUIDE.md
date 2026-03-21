# Flint Governance — VS Code Extension User Guide

## Installation

### From .vsix (recommended)

```bash
cd vscode-extension
npm install && npx tsc -p tsconfig.json
npx @vscode/vsce package --allow-missing-repository
```

Then install the generated `.vsix`:

```bash
# VS Code
code --install-extension flint-governance-0.1.0.vsix

# Cursor
cursor --install-extension flint-governance-0.1.0.vsix

# Antigravity (or any VS Code fork — use its CLI name)
antigravity --install-extension flint-governance-0.1.0.vsix
```

Or install from the Extensions panel: `Cmd+Shift+P` > "Extensions: Install from VSIX..." > select the `.vsix` file.

### From source (development)

```bash
cd vscode-extension
npm install
npx tsc -p tsconfig.json
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Prerequisites

The extension communicates with the Flint MCP server. It auto-detects the server in these locations (in order):

1. `flint-mcp/` relative to workspace root
2. Custom path set in `flint.serverPath` setting

Make sure `flint-mcp` dependencies are installed:

```bash
cd flint-mcp && npm install
```

## Features

### Automatic Audit on Save

Every time you save a `.tsx` or `.jsx` file, Flint runs a governance audit and shows violations as editor diagnostics:

- **Red squiggles** — Critical a11y violations (export-blocking)
- **Yellow squiggles** — Mithril token drift, warnings
- **Blue squiggles** — Advisory findings

Violations appear in the **Problems** panel (`Cmd+Shift+M`).

### Quick Fixes

Hover over a violation squiggle and click the lightbulb (or press `Cmd+.`):

- **Mithril violations**: "Replace with design token `{tokenName}`" — substitutes the hardcoded value with the closest matching design token
- **Batch fix**: "Fix all Flint violations in file" — applies all fixable violations at once

### Status Bar

The bottom status bar shows a live violation count for the current file:

| Color | Meaning |
|-------|---------|
| Green | 0 violations |
| Yellow | Warnings only |
| Red | Has errors |

Click the status bar item to open the Problems panel.

### Commands

Open the Command Palette (`Cmd+Shift+P`) and type "Flint":

| Command | What it does |
|---------|-------------|
| **Flint: Audit Current File** | Run governance audit on the active file |
| **Flint: Audit Workspace** | Audit all `.tsx`/`.jsx` files in the workspace |
| **Flint: Fix Current File** | Auto-fix all fixable violations in the active file |

## Settings

Open Settings (`Cmd+,`) and search for "Flint":

| Setting | Default | Description |
|---------|---------|-------------|
| `flint.enabled` | `true` | Enable/disable the extension |
| `flint.auditOnSave` | `true` | Run audit automatically on file save |
| `flint.deltaEThreshold` | `2.0` | CIEDE2000 color distance threshold for token drift |
| `flint.conformanceLevel` | `AA` | WCAG conformance level: `A`, `AA`, or `AAA` |
| `flint.serverPath` | (auto-detect) | Custom path to flint-mcp directory |

## How It Works

```
Your Editor                    Flint MCP Server
+-----------+                  +------------------+
| .tsx file | --save-->        | audit_ui_component|
| save      |                  | (Mithril + A11y) |
+-----------+                  +------------------+
      |                               |
      | <-- diagnostics --            |
      |    (squiggles)                |
      |                               |
| Quick Fix | --fix-->         | flint_fix       |
| (Cmd+.)   |                 | (AST surgery)    |
+-----------+                  +------------------+
```

The extension spawns the Flint MCP server as a child process and communicates via JSON-RPC over stdio. The server runs Mithril (design token compliance) and A11y (WCAG 2.1 AA) audits using Babel AST analysis — no regex, fully deterministic.

## Troubleshooting

**No violations showing:**
- Check that `flint.enabled` is `true` in settings
- Verify `flint-mcp/` exists relative to your workspace root
- Run `Flint: Audit Current File` manually from the command palette
- Check the Output panel (`Cmd+Shift+U`) > select "Flint Governance" for server logs

**Extension not activating:**
- The extension activates on `.tsx`/`.jsx` files or when `.flint/` directory exists in the workspace
- Try reloading the window: `Cmd+Shift+P` > "Developer: Reload Window"

**Server connection failed:**
- Run `cd flint-mcp && npm install` to ensure dependencies are installed
- Set `flint.serverPath` explicitly if auto-detection fails
