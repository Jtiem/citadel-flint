# Project: Bridge

## The Identity
Bridge is a local-first, visual-first IDE specialized for building drift-proof UI components. It uses a secure Electron shell to bridge local design data (via a Figma plugin) to a React Flow canvas, outputting single-file HTML "Blobs" or standard React repositories.

## Tech Stack
* **Shell:** Electron (v29+)
* **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
* **Canvas Engine:** `@xyflow/react` (React Flow v12)
* **State Management:** Zustand
* **Local Data Core:** `better-sqlite3` (Main Process only)
* **Execution Sandbox:** Sandpack (Client-side evaluation)

## Critical AI Directives
1.  **Read the Architecture First:** For high-level system design, always consult `.bridge-context/architecture.md`. 
2.  **Strict Electron Security:** You MUST read and follow `.bridge-context/electron-rules.md`. Context Isolation is strictly enforced. Never attempt to use Node.js modules inside the `src/` directory.
3.  **Native Modules (better-sqlite3):** Because `better-sqlite3` is a native module, it MUST be rebuilt for Electron's Node version. You must install `electron-rebuild` and add `"postinstall": "electron-rebuild -f -w better-sqlite3"` to `package.json`.
4.  **AI Runtime Location:** The Anthropic SDK MUST be initialized and executed exclusively in the Main Process (`electron/main.ts`). The React frontend will only communicate with it via IPC.
5.  **TypeScript Rigor:** Do not use `any`. All component props, IPC payloads, and Zustand state must have explicit Interfaces or Types.
6.  **Stop and Ask:** If you encounter persistent IPC errors or port conflicts, DO NOT guess. Stop and ask the user to consult the Lead Architect (Gemini).