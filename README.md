# Bridge Glass — Agentic UI Operating System

> **The first IDE built for AI agents, not just assisted by them.**

Bridge Glass is a desktop application that acts as a strict "containment field" for high-velocity AI-driven UI development. Instead of letting LLMs generate raw code strings that break your design system, Bridge Glass enforces brand alignment, accessibility, and codebase integrity at the **AST level** — deterministically, before any change touches a file.

**If it isn't in the AST, it doesn't exist.**

---

## What Makes Bridge Different

Most AI coding tools hand you a diff and hope for the best. Bridge Glass operates on a fundamentally different contract:

| Conventional AI Coding | Bridge Glass |
|------------------------|-------------|
| LLM generates raw code strings | LLM emits structured AST ops from a constrained Tool Catalog |
| Brand drift discovered in review | CIEDE2000 ΔE perceptual drift caught in real-time |
| Accessibility issues found in QA | 10 WCAG 2.1 AA rules enforced at parse time |
| Undo = Ctrl+Z in a text editor | Undo = atomic AST inversion across multiple files |
| AI changes are invisible until done | Every AI mutation requires explicit user confirmation |

---

## Core Architecture

Bridge Glass is a **three-process Electron application** designed for agentic surgery at scale.

```
┌─────────────────────────────────────────────────┐
│  Main Process (Node.js / Electron)               │
│  · FileTransactionManager  atomic .tmp→rename    │
│  · SQLite WAL + PowerSync  CRDT persistence      │
│  · GitManager              shadow commits        │
│  · Orchestrator            Claude AI + TSC loop  │
│  · IngestionServer         Figma plugin bridge   │
│  · LSP Clients             TS + Vue intelligence │
├─────────────────────────────────────────────────┤
│  Renderer Process (React 19 / Vite)              │
│  · XYCanvas      infinite canvas (React Flow)    │
│  · LivePreview   srcdoc iframe, 100% offline     │
│  · AgentChat     streaming AI orchestrator UI    │
│  · ExportModal   pre-flight audit gate           │
├─────────────────────────────────────────────────┤
│  Preload (contextBridge)                         │
│  · window.bridgeAPI  typed IPC surface           │
└─────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 40+ |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 7 |
| Canvas | `@xyflow/react` v12 (React Flow) |
| State | Zustand v5 |
| Persistence | SQLite (`better-sqlite3`) + PowerSync SDK |
| AST Engine | Babel (TSX ↔ Visual Tree) |
| AI | Anthropic Claude (streaming, Tool Use mode) |
| Vector Search | `sqlite-vec` (design system RAG) |
| Sync | PowerSync CRDT (multiplayer presence) |

---

## Modules

### Module A — AST Canvas
An infinite whiteboard powered by React Flow. Your live preview runs inside a draggable node on the canvas. Select, drag, and reorder components using ID-indestructible `data-bridge-id` attributes — elements survive any AST transformation without losing their identity.

### Module B — Mithril Safety System
The design system enforcement engine. Every component is audited against your token library on every keystroke:

- **Color Guard** — CIEDE2000 ΔE perceptual drift calculations. Amber warning at ΔE > 2.0, Critical at ΔE > 10.0
- **Typography Guard** — 5 AST visitors for font-size, weight, family, line-height, and tracking
- **Accessibility Gate** — 10 WCAG 2.1 AA rules (images, buttons, links, inputs, tables, heading order, lang attribute, tabIndex)
- **Export Gate** — Pre-flight audit blocks export when critical violations exist

### Module C — Sync Layer (Multiplayer)
PowerSync CRDT partitioning across three namespaces: Global Tokens, Project Overrides, and User Presence. Remote cursors overlay directly in the LivePreview. The AST Conflict Arbiter locks nodes held by remote collaborators — no silent overwrites.

### Module D — Recovery Engine
Git Time Machine meets AST surgery. Every file save triggers a shadow commit. The Recovery Panel lets you revert any individual component node to any previous commit state — not the whole file, just that node — via surgical AST transplantation.

### Module E — Persistence
`FileTransactionManager` — atomic `.tmp` → `rename` writes, serialized per path, concurrent across paths. Auto-save is debounced and IPC-driven. Nothing is ever half-written.

### Module F/G/H — Cross-File Operations
Multi-file undo/redo with full inversion tracking. `astBufferStore.crossFileMove` is an 11-step atomic operation. Cross-file redo uses a `RedoPlan` schema with an `isRecovery` flag to prevent history duplication.

### Module M — AI Orchestrator
Claude integration with hard constraints:

- **Constrained Tool Catalog** — AI can only emit 7 operations: `updateProps`, `updateText`, `insertNode`, `wrapNode`, `deleteNode`, `addClassName`, `removeClassName`. Raw code strings are prohibited.
- **In-Memory TSC Validation Loop** — Every AI-proposed mutation is TypeScript type-checked in memory before the user sees a confirmation dialog. Hallucinations feed back as invisible prompts — never broken diffs.
- **Design System RAG** — `sqlite-vec` vector search injects relevant component interfaces into every AI context window.
- **Confirmation Required** — Every AI mutation requires explicit user approval before touching the AST.

### Module O — Figma Ingestion
A loopback HTTP server (port 4545) receives Figma Variables, tokens, and AST payloads from the companion Figma plugin. `normalizer.ts` maps Figma Variables to W3C DTCG format for direct PowerSync ingestion.

### Module P — LSP Integration
TypeScript and Vue Language Server clients for cross-file intellisense, diagnostics, and go-to-definition — fully integrated with the Electron main process.

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Install & Run

```bash
git clone https://github.com/Jtiem/lunar-elevator-bridge.git
cd lunar-elevator-bridge
npm install
npm run dev
```

### Commands

```bash
npm run dev          # Launch Bridge Glass (Vite + Electron)
npm test             # Run Vitest suite (160 tests)
npx tsc --noEmit     # Strict TypeScript check
npm run bridge-clean # Clean workspace artifacts
```

---

## Branch Structure

| Branch | Purpose |
|--------|---------|
| `main` | Stable, all modules online |
| `feature/mcp-pivot` | MCP server integration — active development |
| `claude/zen-mcnulty` | AI agent experimental branch |
| `swarm/ui-hardening-chat-panel` | Swarm agent UI hardening work |

---

## Module Status

All core modules are **ONLINE** as of v6.9:

| Phase | Module | Status |
|-------|--------|--------|
| A | AST Canvas (Infinite Whiteboard) | ✅ ONLINE |
| B | Mithril Safety + Export Gate | ✅ ONLINE |
| B.3 | Accessibility Gate (WCAG 2.1 AA) | ✅ ONLINE |
| C.1 | Multiplayer Presence | ✅ ONLINE |
| C.2 | AST Conflict Arbiter | ✅ ONLINE |
| D.1 | Code-First Recovery | ✅ ONLINE |
| D.2 | Git Time Machine UI | ✅ ONLINE |
| E.1 | Batch Mutation Engine | ✅ ONLINE |
| E.2 | FileTransactionManager | ✅ ONLINE |
| F.1 | canvasStore + Auto-Save | ✅ ONLINE |
| F.2 | Cross-File Move (11-step atomic) | ✅ ONLINE |
| G.1 | Global Recovery Engine | ✅ ONLINE |
| G.2 | Scaffolding & Registry | ✅ ONLINE |
| H | Cross-File Redo | ✅ ONLINE |
| I | Interaction Modes (Design/Interact) | ✅ ONLINE |
| J | Native OS Menu | ✅ ONLINE |
| M | AI Orchestrator Hardening | ✅ ONLINE |
| N.1 | Designer Experience (Figma-grade Layout) | ✅ ONLINE |
| O | Figma Ingestion & Sync | ✅ ONLINE |
| P | LSP Integration (TS + Vue) | ✅ ONLINE |

---

## Philosophy

Bridge Glass is built on the **Mithril Philosophy** — the idea that AI agents are most powerful when they operate within a deterministic constraint system. An unconstrained LLM will eventually drift from your design system, break your accessibility guarantees, and generate code that passes review but fails production.

Bridge Glass inverts that dynamic. The AI is a powerful engine operating inside a precision machine. Every output is validated, every change is reversible, and every deviation from your design system is surfaced immediately — not in a PR review, not in QA, but at the moment of creation.

---

## Repository

Private repository — access by invitation only.
**Owner:** Justin Tiemann
**GitHub:** [github.com/Jtiem/lunar-elevator-bridge](https://github.com/Jtiem/lunar-elevator-bridge)
