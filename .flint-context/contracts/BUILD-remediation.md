# BUILD Remediation Contract

**Phase:** Infrastructure
**Status:** PLANNED
**Author:** flint-architect
**Date:** 2026-03-27

---

## 1. Problem Statement

The Electron packaging pipeline has five systemic failures:

1. **`vite build` hangs** -- `vite-plugin-electron` enters watch mode instead of exiting.
2. **Dev dependencies ship in ASAR** -- `node_modules/**/*` inclusion overrides electron-builder's automatic production-only resolution, then a brittle exclusion list tries to claw back.
3. **Static import of dev-only `vite` module** -- `electron/preview/viteServer.ts` statically imports `vite` (now dynamic, but the design smell persists).
4. **`tsc -b` cache lies** -- stale `.tsbuildinfo` causes phantom errors.
5. **ASAR is 300MB+** -- dead packages (AI SDKs, Monaco, Sandpack, HuggingFace/ONNX) inflate the bundle.

All five share a single architectural root cause: **the dependency boundary between build-time and runtime was never drawn correctly**, and the `electron-builder.yml` files config compensates with a fragile exclusion list rather than fixing the source.

---

## 2. Dependency Audit Table

### Legend
- **Location:** Current placement in `package.json`
- **Correct:** Where it should be (`dep` = dependencies, `dev` = devDependencies, `REMOVE` = delete entirely)
- **Process:** Which Electron process uses it at runtime (`main` = Node.js main, `renderer` = bundled by Vite into `dist/`, `both`, `none`)
- **Size:** Approximate `node_modules` footprint (direct, not including transitive)

### A. Packages Currently in `dependencies`

| Package | Location | Correct | Process | Size | Reasoning |
|---------|----------|---------|---------|------|-----------|
| `@anthropic-ai/sdk` | dep | dep | main | 4.9M | Imported by `orchestrator.ts`, `consensusGateService.ts`. Runs in main process. External from Vite bundle. Required at runtime. |
| `@babel/core` | dep | dep | main | (part of 12M) | `transformSync` imported by `main.ts` line 154. Externalized by `electronExternalMatcher`. Required at runtime in main process for preview compilation. |
| `@babel/generator` | dep | dep | main | (part of 12M) | Used by AST surgery pipeline. Externalized. |
| `@babel/parser` | dep | dep | both | (part of 12M) | Renderer: bundled into `dist/` by Vite (imported by `src/core/ASTService.ts`, `src/utils/astModifier.ts`). Main: externalized. Must ship for main process. |
| `@babel/plugin-transform-react-jsx` | dep | dep | main | (part of 12M) | Used by `injectFlintIdPlugin` in `main.ts`. Externalized. |
| `@babel/plugin-transform-typescript` | dep | dep | main | (part of 12M) | Used by preview compilation pipeline. Externalized. |
| `@babel/traverse` | dep | dep | both | (part of 12M) | Same pattern as `@babel/parser`. |
| `@babel/types` | dep | dep | both | (part of 12M) | Same pattern as `@babel/parser`. |
| `@codesandbox/sandpack-react` | dep | **REMOVE** | none | 67M | **Zero imports anywhere in the codebase.** Never used. Pure dead weight. |
| `@google/genai` | dep | **REMOVE** | none | 11M | **Zero imports.** Referenced only as a string literal in type union (`'gemini'`). The provider adapter doesn't exist yet. Remove; re-add when implemented. |
| `@huggingface/transformers` | dep | dep | main | 65M (+302M onnxruntime) | Imported dynamically by `ragService.ts` for offline embeddings. Runs in main process. **However: this is the single largest contributor to ASAR bloat.** See Section 8 for mitigation strategy. |
| `@monaco-editor/react` | dep | **REMOVE** | none | 412K (but pulls 73M `monaco-editor`) | **Zero imports anywhere.** Glass explicitly does NOT have a Monaco editor panel. Dead weight. |
| `@powersync/node` | dep | dep | main | 12M | Imported by `sync-schema.ts`, `powersync.worker.ts`, `PowerSyncConnector.ts`. Phase C.1 is PLANNED but code exists. Keep for now. |
| `@vue/compiler-sfc` | dep | dep | main | (part of 7.5M @vue) | Dynamic import in `vueCompiler.ts` line 79 and `VueLspClient.ts` line 45. Runs in main process for Vue SFC compilation. Externalized. |
| `@xyflow/react` | dep | dep | renderer | 4.6M | Canvas engine. Bundled into `dist/` by Vite. |
| `better-sqlite3` | dep | dep | main | 12M | Core database. Native module. Externalized + ASAR unpacked. |
| `bufferutil` | dep | dep | main | 604K | WebSocket native addon. Externalized + unpacked. |
| `electron-updater` | dep | dep | main | 1.2M | Auto-update delivery. Imported by `autoUpdater.ts`. |
| `highlight.js` | dep | dep | renderer | 9.1M | Imported by `AgentChatPanel.tsx` (CSS import for code highlighting). Bundled into `dist/` by Vite. **Note:** Only one CSS file is actually used -- Vite tree-shakes, but the full package ships in node_modules unnecessarily. Since it's bundled, it won't be in ASAR. Acceptable. |
| `lucide-react` | dep | dep | renderer | 45M | Icon library. Bundled into `dist/` by Vite (tree-shaken). |
| `openai` | dep | **REMOVE** | none | 13M | **Zero imports.** Referenced only as a string literal in type union. Provider adapter doesn't exist yet. Remove; re-add when implemented. |
| `react` | dep | dep | renderer | 252K | Core framework. Bundled. |
| `react-dom` | dep | dep | renderer | 7.1M | Core framework. Bundled. |
| `react-markdown` | dep | dep | renderer | 80K | Imported by `AgentChatPanel.tsx`. Bundled. |
| `rehype-highlight` | dep | dep | renderer | 52K | Imported by `AgentChatPanel.tsx`. Bundled. |
| `rehype-parse` | dep | dep | renderer | 48K | Imported by `HtmlAdapter.ts`. Bundled. |
| `rehype-stringify` | dep | dep | renderer | 44K | Imported by `HtmlAdapter.ts`. Bundled. |
| `sqlite-vec` | dep | dep | main | 20K + ~168K platform | Native extension. Externalized + unpacked. |
| `svelte` | dep | dep | main | 4.3M | Dynamic import in `svelteCompiler.ts`. Runs in main process for Svelte SFC compilation. Externalized. |
| `tailwindcss` | dep | **dev** | none (at runtime) | 856K | Used by `@tailwindcss/vite` plugin at BUILD time to compile `@import "tailwindcss"` in `src/index.css`. The CSS is compiled into `dist/` at build time. `tailwindcss` is NOT needed at runtime. The preview engine uses a vendored `tailwind-cdn.js` file. |
| `unist-util-visit` | dep | dep | renderer | 56K | Imported by `HtmlAdapter.ts`. Bundled. |
| `utf-8-validate` | dep | dep | main | 1.2M | WebSocket native addon. Externalized + unpacked. |
| `vite` | dep | **dev** | none (at runtime) | 2.2M (+ rollup transitive) | **The critical misplacement.** `vite` is a build tool. At runtime, `viteServer.ts` uses it only in dev mode (for live preview of user projects). In production, `loadVite()` returns `null` and the app falls back to srcdoc preview. Vite must NOT ship. |
| `vue` | dep | dep | main | 2.5M | The Vue runtime UMD is loaded as `?raw` text in `LivePreview.tsx` from `preview-vendor/vue.global.prod.txt` (bundled by Vite). However, `vueCompiler.ts` references `"vue"` in compiled output transformations. The actual `vue` npm module is needed by `@vue/compiler-sfc` as a peer. Keep it. |
| `yaml` | dep | dep | main | 1.2M | Config parsing. Imported by main process. |
| `zustand` | dep | dep | renderer | 252K | State management. Bundled. |

### B. Packages Currently in `devDependencies` (Already Correct)

All packages in `devDependencies` are correctly classified. No changes needed.

### C. Summary of Moves

| Action | Package | Savings |
|--------|---------|---------|
| **REMOVE** | `@codesandbox/sandpack-react` | ~67M |
| **REMOVE** | `@monaco-editor/react` (+ `monaco-editor`) | ~73M |
| **REMOVE** | `openai` | ~13M |
| **REMOVE** | `@google/genai` | ~11M |
| **dep -> dev** | `vite` | ~2.2M (+ avoids pulling rollup etc.) |
| **dep -> dev** | `tailwindcss` | ~856K |
| **Total saved from node_modules** | | **~167M** |

---

## 3. electron-builder.yml -- Corrected Config

### Root Cause of the Current Problem

The current config includes `node_modules/**/*` explicitly (line 14), which tells electron-builder to include the ENTIRE `node_modules` tree. It then tries to exclude packages with `!` patterns (lines 26-46). This approach is:

1. **Inverted** -- it includes everything then carves out exceptions, missing transitive dependencies.
2. **Brittle** -- every new dev dependency requires a new exclusion line.
3. **Wrong** -- electron-builder's default behavior (when `node_modules` is NOT listed in `files`) is to automatically include only production dependencies. By listing `node_modules/**/*` explicitly, this default behavior is overridden.

### The Correct Approach

**Remove `node_modules/**/*` from the files list entirely.** Let electron-builder resolve production dependencies automatically from `package.json`. This is the documented and intended behavior.

The only exception is `flint-mcp/node_modules/**/*`, which must be included because flint-mcp is a child process with its own dependency tree.

### Corrected electron-builder.yml

```yaml
appId: com.flint.glass
productName: Flint Glass
copyright: Copyright 2026 Flint

directories:
  buildResources: build-resources
  output: release

# -- Source files to include ------------------------------------------------
# electron-builder automatically includes production `node_modules` when
# node_modules is NOT listed here. This is the correct default behavior.
# Only compiled output and the MCP child process are listed explicitly.
files:
  - dist/**/*
  - dist-electron/**/*
  - package.json
  # MCP server is spawned as a child process (ELECTRON_RUN_AS_NODE=1).
  # It has its own package.json and node_modules.
  - flint-mcp/dist/**/*
  - flint-mcp/package.json
  - flint-mcp/node_modules/**/*
  # Exclude source code and build artifacts
  - "!src/**"
  - "!electron/**"
  - "!flint-mcp/src/**"
  - "!flint-vscode/**"
  - "!vscode-extension/**"
  - "!demos/**"
  - "!docs/**"
  - "!website/**"
  - "!.flint-context/**"
  - "!.claude/**"
  - "!.claude-flow/**"
  - "!.git/**"
  - "!**/*.ts"
  - "!**/*.tsx"
  - "!**/*.map"
  - "!**/*.test.*"
  - "!**/__tests__/**"
  - "!**/vitest.config.*"
  - "!**/tsconfig.*"
  - "!scripts/**"
  - "!CLAUDE.md"
  - "!HANDOFF.md"

# -- Extra resources --------------------------------------------------------
extraResources:
  - from: build-resources/demo-project
    to: build-resources/demo-project
    filter:
      - "**/*"

# -- ASAR -------------------------------------------------------------------
asar: true
asarUnpack:
  # Native .node binaries must live outside the ASAR (dlopen requirement)
  - "**/*.node"
  # sqlite-vec distributes as .dylib on macOS
  - "**/*.dylib"
  # MCP server is a child process -- cannot read from ASAR
  - "flint-mcp/**"
  # Native modules need full unpacking (JS wrapper + package.json for ESM)
  - "node_modules/better-sqlite3/**"
  - "node_modules/sqlite-vec/**"
  - "node_modules/sqlite-vec-darwin-arm64/**"
  - "node_modules/sqlite-vec-darwin-x64/**"
  - "node_modules/sqlite-vec-linux-x64/**"
  - "node_modules/sqlite-vec-windows-x64/**"
  - "node_modules/bufferutil/**"
  - "node_modules/utf-8-validate/**"

# -- Native modules ---------------------------------------------------------
npmRebuild: true

# -- macOS ------------------------------------------------------------------
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build-resources/entitlements.mac.plist
  entitlementsInherit: build-resources/entitlements.mac.plist
  notarize: false

# -- Windows ----------------------------------------------------------------
win:
  target:
    - target: nsis
      arch:
        - x64

# -- Linux ------------------------------------------------------------------
linux:
  target:
    - target: AppImage
      arch:
        - x64
  category: Development

# -- GitHub Releases publish ------------------------------------------------
publish:
  provider: github
  owner: Jtiem
  repo: lunar-elevator-flint

# -- DMG layout -------------------------------------------------------------
dmg:
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

### Key Differences from Current Config

1. **Removed:** `- node_modules/**/*` -- lets electron-builder auto-resolve production deps.
2. **Removed:** All 20+ `!node_modules/<pkg>/**` exclusion lines -- no longer needed.
3. **Kept:** `flint-mcp/node_modules/**/*` -- MCP child process needs its own deps.
4. **Kept:** All `asarUnpack` entries unchanged -- native modules still need unpacking.

---

## 4. package.json Changes

### Exact Moves

```diff
  "dependencies": {
    "@anthropic-ai/sdk": "^0.78.0",
    "@babel/core": "^7.29.0",
    "@babel/generator": "^7.29.0",
    "@babel/parser": "^7.29.0",
    "@babel/plugin-transform-react-jsx": "^7.28.6",
    "@babel/plugin-transform-typescript": "^7.28.6",
    "@babel/traverse": "^7.29.0",
    "@babel/types": "^7.29.0",
-   "@codesandbox/sandpack-react": "^2.20.0",
-   "@google/genai": "^1.44.0",
    "@huggingface/transformers": "^3.8.1",
-   "@monaco-editor/react": "^4.7.0",
    "@powersync/node": "^0.18.0",
    "@vue/compiler-sfc": "^3.5.31",
    "@xyflow/react": "^12.10.1",
    "better-sqlite3": "^12.6.2",
    "bufferutil": "^4.1.0",
    "electron-updater": "^6.8.3",
    "highlight.js": "^11.11.1",
    "lucide-react": "^0.575.0",
-   "openai": "^6.25.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-markdown": "^10.1.0",
    "rehype-highlight": "^7.0.2",
    "rehype-parse": "^9.0.1",
    "rehype-stringify": "^10.0.1",
    "sqlite-vec": "^0.1.7-alpha.2",
    "svelte": "^5.55.0",
-   "tailwindcss": "^4.2.0",
    "unist-util-visit": "^5.1.0",
    "utf-8-validate": "^6.0.6",
-   "vite": "^7.3.1",
    "vue": "^3.5.31",
    "yaml": "^2.7.1",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@tailwindcss/vite": "^4.2.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "electron": "35.7.5",
    "electron-builder": "^26.8.1",
    "electron-rebuild": "^3.2.9",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "jsdom": "^28.1.0",
+   "tailwindcss": "^4.2.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.48.0",
+   "vite": "^7.3.1",
    "vite-plugin-electron": "^0.29.0",
    "vite-plugin-electron-renderer": "^0.14.6",
    "vitest": "^4.0.18"
  }
```

**4 packages removed entirely, 2 moved to devDependencies.**

### Post-Move Verification

After these changes, run `npm install` to regenerate `package-lock.json`. Then verify:

1. `npm run dev` still works (Vite resolves `tailwindcss` and `vite` from devDependencies during development -- this is normal, devDependencies ARE installed in the project root).
2. `npm run build` still works (same -- build tools run from project root, not from ASAR).
3. `npm test` and `npm run test:react` still pass.
4. `npx tsc --noEmit` still passes.

The key insight: **devDependencies are only excluded from the packaged ASAR.** They are fully available during `npm run dev`, `npm run build`, and `npm test` because those commands run in the project directory, not inside the Electron package.

---

## 5. vite.config.ts -- Fix the Build Exit Issue

### Root Cause

`vite-plugin-electron` v0.29.0 has a known behavior where the `watch` config is evaluated at plugin initialization time, not at build time. Setting `watch: isProduction ? null : { ... }` depends on `NODE_ENV` being set BEFORE Vite starts. The current `build` script does set `NODE_ENV=production`, but there are edge cases:

1. If `NODE_ENV` is not set (e.g., calling `vite build` directly), the plugin enters watch mode.
2. `vite-plugin-electron` uses Vite's internal `build.watch` option. Setting the plugin's `watch` to `null` may not propagate correctly to the underlying Vite build call.

### Correct Fix

Use Vite's `mode` parameter (which `vite build` sets to `'production'` by default) instead of relying on `NODE_ENV`. Additionally, explicitly set `build.watch` to `null` at the top-level Vite config to ensure the renderer build also exits.

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

const electronExternalMatcher = (id: string) => {
  if (
    id === 'vite' ||
    id === 'node-pty' ||
    id === 'better-sqlite3' ||
    id === 'sqlite-vec' ||
    id === 'bufferutil' ||
    id === 'utf-8-validate' ||
    id === 'fsevents' ||
    id.includes('lightningcss') ||
    id.includes('@powersync/node') ||
    id.startsWith('node:') ||
    id === 'worker_threads' ||
    id.includes('node:worker_threads')
  ) {
    return true
  }
  if (id.startsWith('@babel/')) return true
  if (id.startsWith('@huggingface/')) return true
  if (id.startsWith('onnxruntime')) return true
  if (id === '../pkg' || id === './pkg') return true
  return false
}

// Patterns that Electron writes at runtime -- must be excluded from all watchers
const watchExclude = [
  '**/.flint/**',
  '**/dist-electron/**',
  '**/.git/**',
  '**/node_modules/**',
  '**/*.db',
  '**/*.db-journal',
  '**/*.db-wal',
]

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      watch: {
        ignored: watchExclude,
        usePolling: true,
        interval: 1000,
      },
    },
    // Explicitly disable watch mode for production builds.
    // This is the authoritative setting -- overrides any plugin-level watch config.
    build: {
      watch: isProduction ? null : undefined,
      rollupOptions: {
        external: ['better-sqlite3', 'fsevents'],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              // In production: watch is null (exit after build).
              // In dev: watch with exclusions (rebuild on change).
              watch: isProduction ? null : { exclude: watchExclude },
              rollupOptions: {
                external: electronExternalMatcher,
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(args) {
            args.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              watch: isProduction ? null : { exclude: watchExclude },
              rollupOptions: {
                external: ['better-sqlite3', 'fsevents'],
              },
            },
          },
        },
        {
          entry: 'electron/powersync.worker.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              watch: isProduction ? null : { exclude: watchExclude },
              rollupOptions: {
                external: electronExternalMatcher,
              },
            },
          },
        },
      ]),
      renderer(),
    ],
  }
})
```

### Key Changes

1. **`defineConfig` now takes a function** receiving `{ mode }` -- `vite build` sets mode to `'production'` by default.
2. **Top-level `build.watch: null`** in production -- this is the authoritative kill switch for watch mode. Even if the plugin misbehaves, Vite's own build will exit.
3. **Removed `process.env.NODE_ENV` dependency** for the production check. `mode` is more reliable because it's set by Vite itself, not by the shell environment.
4. **`rollupOptions.external` moved out of the inline object** for the top-level renderer build.

---

## 6. Build Script Changes

### Current Problem

```json
"build": "tsc -b && NODE_ENV=production vite build"
```

Issues:
1. `tsc -b` uses incremental compilation with `.tsbuildinfo` cache. If the cache is stale, it reports phantom errors.
2. `NODE_ENV=production` is fragile -- if anything in the pipeline unsets it, vite hangs.

### Corrected Scripts

```json
{
  "scripts": {
    "dev": "unset ELECTRON_RUN_AS_NODE && vite",
    "build": "npm run build:clean-tsc && vite build --mode production",
    "build:clean-tsc": "rm -f node_modules/.tmp/tsconfig.*.tsbuildinfo && tsc -b",
    "build:mac": "npm run build && npx electron-builder --mac --config electron-builder.yml",
    "build:win": "npm run build && npx electron-builder --win --config electron-builder.yml",
    "build:linux": "npm run build && npx electron-builder --linux --config electron-builder.yml",
    "build:all": "npm run build && npx electron-builder -mwl --config electron-builder.yml",
    "build:beta": "npm run build && FLINT_BETA_EXPIRY=$(node -p \"new Date(Date.now()+(${FLINT_BETA_DAYS:-90})*864e5).toISOString().split('T')[0]+'T00:00:00Z'\") FLINT_BETA_BUILD_ID=beta-$(node -p \"require('./package.json').version\")-$(node -p \"new Date().toISOString().split('T')[0].replace(/-/g,'')\") electron-builder --config electron-builder.yml",
    "build:beta:mac": "npm run build && FLINT_BETA_EXPIRY=$(node -p \"new Date(Date.now()+(${FLINT_BETA_DAYS:-90})*864e5).toISOString().split('T')[0]+'T00:00:00Z'\") FLINT_BETA_BUILD_ID=beta-$(node -p \"require('./package.json').version\")-$(node -p \"new Date().toISOString().split('T')[0].replace(/-/g,'')\") electron-builder --mac --config electron-builder.yml",
    "build:beta:quick": "npm run build && FLINT_BETA_EXPIRY=$(node -p \"new Date(Date.now()+(${FLINT_BETA_DAYS:-90})*864e5).toISOString().split('T')[0]+'T00:00:00Z'\") FLINT_BETA_BUILD_ID=beta-$(node -p \"require('./package.json').version\")-$(node -p \"new Date().toISOString().split('T')[0].replace(/-/g,'')\") electron-builder --mac --dir --config electron-builder.yml && codesign --deep --force --sign - --entitlements build-resources/entitlements.mac.plist 'release/mac-arm64/Flint Glass.app'",
    "build:zip": "bash scripts/build-zip.sh",
    "release:beta": "npm run build && FLINT_BETA_EXPIRY=$(node -p \"new Date(Date.now()+(${FLINT_BETA_DAYS:-90})*864e5).toISOString().split('T')[0]+'T00:00:00Z'\") FLINT_BETA_BUILD_ID=beta-$(node -p \"require('./package.json').version\")-$(date +%Y%m%d) npx electron-builder --publish always --config electron-builder.yml"
  }
}
```

### Key Changes

1. **`build` script:** Replaced `NODE_ENV=production vite build` with `vite build --mode production`. The `--mode` flag is Vite's official way to set the build mode. No environment variable needed.
2. **`build:clean-tsc` script:** Deletes `.tsbuildinfo` cache before running `tsc -b`. This eliminates phantom errors from stale caches. The cost is minimal (~2-3s for a clean type-check vs. ~1s incremental).
3. **Removed `NODE_ENV=production` prefix** from the build command entirely.

---

## 7. viteServer.ts Fix -- Proper Dead Code Elimination

### Current State

`viteServer.ts` uses a dynamic `import('vite')` wrapped in a try/catch (`loadVite()`). This is the correct runtime pattern. However, the module is still statically imported by `main.ts` line 162:

```typescript
import { startViteServer, stopViteServer, getPreviewUrl } from './preview/viteServer.js'
```

This means `viteServer.js` is always loaded by the main process, and its top-level `import net from 'node:net'` executes. The dynamic `import('vite')` inside `loadVite()` correctly fails gracefully in production. **The current code is functionally correct but has two issues:**

1. The `net` module is imported even when the preview server is never started.
2. The `vite` package is listed in `electronExternalMatcher` and externalized, so the `require('vite')` in the compiled `dist-electron/main.js` will fail at runtime if `vite` is not in `node_modules`. The dynamic import's try/catch handles this.

### Assessment

**The dynamic import pattern is actually correct.** Once `vite` moves to `devDependencies`, it won't be in the packaged `node_modules`. The dynamic `import('vite')` will throw, the catch returns `null`, and `startViteServer()` returns `null` -- falling back to srcdoc preview. This is the intended behavior.

### Recommended Improvement

Add an explicit `app.isPackaged` guard to avoid even attempting the dynamic import in production:

```typescript
async function loadVite(): Promise<typeof import('vite') | null> {
    // In packaged builds, vite is not available (devDependency).
    // Skip the import attempt entirely to avoid console noise.
    if ('isPackaged' in (await import('electron')).app &&
        (await import('electron')).app.isPackaged) {
        return null
    }
    try {
        return await import('vite')
    } catch {
        return null
    }
}
```

Actually, since `main.ts` already has `app` imported, a simpler approach is to pass a flag:

```typescript
// In viteServer.ts
let _isPackaged = false

export function setPackaged(isPackaged: boolean): void {
    _isPackaged = isPackaged
}

async function loadVite(): Promise<typeof import('vite') | null> {
    if (_isPackaged) return null
    try {
        return await import('vite')
    } catch {
        return null
    }
}
```

And in `main.ts`, call `setPackaged(app.isPackaged)` early in initialization.

**Priority: LOW.** The current code works. This is a polish improvement.

---

## 8. The HuggingFace/ONNX Problem (367M)

### The Elephant in the Room

| Package | Size |
|---------|------|
| `@huggingface/transformers` | 65M |
| `onnxruntime-node` | 211M |
| `onnxruntime-web` | 91M |
| `onnxruntime-common` | 1.1M |
| **Total** | **~368M** |

These packages power the offline RAG embedding pipeline (`ragService.ts`). They are legitimate runtime dependencies -- the embeddings run in the main process using the `all-MiniLM-L6-v2` model.

### Mitigation Options (Ordered by Impact)

**Option A: Exclude `onnxruntime-web` (immediate, -91M)**

`onnxruntime-web` is the WebAssembly/WebGPU variant. Electron runs Node.js, which uses `onnxruntime-node`. The `-web` variant is pulled as a transitive dependency but never used in the main process. Add to `electron-builder.yml`:

```yaml
files:
  # ... existing entries ...
  - "!node_modules/onnxruntime-web/**"
```

This is safe because `@huggingface/transformers` detects the runtime environment and loads `onnxruntime-node` in Node.js contexts.

**Option B: Exclude platform-irrelevant onnxruntime-node binaries (medium effort, ~-140M)**

`onnxruntime-node` bundles binaries for all platforms (linux-x64, win-x64, darwin-arm64, darwin-x64). Each platform build only needs its own binary. This requires a `beforeBuild` or `afterPack` hook that deletes the other platform's binaries.

**Option C: Move RAG to the MCP server child process (architectural, longer-term)**

The MCP server (`flint-mcp/`) already has its own dependency tree. Moving the embedding pipeline there means the 368M stays in `flint-mcp/node_modules` (already unpacked) and is NOT duplicated in the root ASAR. This aligns with the architecture: MCP does the work, Glass observes.

**Recommendation:** Implement Option A immediately (-91M). Evaluate Option C as part of a future MCP consolidation phase.

---

## 9. Expected Results

### ASAR Size Reduction

| Category | Current | After Remediation |
|----------|---------|-------------------|
| Dead packages (Sandpack, Monaco, OpenAI, Google AI) | ~164M | 0 |
| Build tools in ASAR (vite, tailwindcss) | ~3M | 0 |
| onnxruntime-web (Option A) | ~91M | 0 |
| **Total reduction** | | **~258M** |
| **Estimated remaining ASAR** | ~300M+ | **~50-80M** |

The remaining ~50-80M is dominated by:
- `@huggingface/transformers` + `onnxruntime-node` (~276M, but much of this is platform-specific and only the relevant arch ships)
- `@babel/*` (~12M)
- `better-sqlite3` (~12M, unpacked)
- `highlight.js` (~9M, but tree-shaken by Vite; only CSS ships)
- `@vue/*` + `vue` (~10M)
- `lucide-react` (~45M, but tree-shaken by Vite)
- Other small packages

Note: Renderer dependencies (`react`, `zustand`, `@xyflow/react`, `lucide-react`, etc.) are bundled by Vite into `dist/`. They do NOT need to be in `node_modules` at runtime. electron-builder should auto-detect this if they have no import from the main process. However, since `@babel/*` and other packages are BOTH bundled (renderer) AND externalized (main), they must remain in `node_modules`.

### Build Time

- `tsc -b` clean: ~3-5s (no stale cache issues)
- `vite build`: exits cleanly (no hang)
- `electron-builder`: faster ASAR packing with smaller `node_modules`

### No More Hangs

- `vite build --mode production` uses Vite's official mode flag
- Top-level `build.watch: null` in production mode
- `vite-plugin-electron` sub-builds also set `watch: null`
- Three redundant safeguards against watch mode

---

## 10. Implementation Order

### Phase 1: Safe Changes (No Risk)

These changes are purely subtractive and cannot break anything:

| Step | Change | Risk |
|------|--------|------|
| 1a | Remove `@codesandbox/sandpack-react` from dependencies | None -- zero imports |
| 1b | Remove `@monaco-editor/react` from dependencies | None -- zero imports |
| 1c | Remove `openai` from dependencies | None -- zero imports |
| 1d | Remove `@google/genai` from dependencies | None -- zero imports |

**Verification:** `npm install && npm run dev && npm test && npm run test:react && npx tsc --noEmit`

### Phase 2: Dependency Reclassification

| Step | Change | Risk |
|------|--------|------|
| 2a | Move `vite` from dependencies to devDependencies | Low -- only used at build time and by `viteServer.ts` dynamic import |
| 2b | Move `tailwindcss` from dependencies to devDependencies | Low -- only used by `@tailwindcss/vite` at build time |

**Verification:** Same as Phase 1, plus `npm run build` to confirm production build works.

### Phase 3: Build Config Fixes

| Step | Change | Risk |
|------|--------|------|
| 3a | Update `vite.config.ts` to function form with `mode` parameter | Low -- same behavior, better detection |
| 3b | Update `build` script to use `--mode production` | Low -- equivalent to `NODE_ENV=production` |
| 3c | Add `build:clean-tsc` script | None -- additive |

**Verification:** `npm run build` completes without hanging. `npm run dev` still starts correctly.

### Phase 4: electron-builder.yml Rewrite

| Step | Change | Risk |
|------|--------|------|
| 4a | Replace `electron-builder.yml` with corrected config | **Medium** -- this is the most impactful change |
| 4b | Add `!node_modules/onnxruntime-web/**` exclusion | Low |

**Verification:** `npm run build:beta:quick` produces a working `.app` bundle. Launch it. Verify:
- SQLite database works (open a project)
- Preview renders (srcdoc iframe)
- MCP child process spawns (check Activity Feed)
- AI orchestrator responds (send a chat message)

### Phase 5: Polish (Optional)

| Step | Change | Risk |
|------|--------|------|
| 5a | Add `app.isPackaged` guard to `viteServer.ts` | None -- defensive improvement |
| 5b | Investigate platform-specific ONNX binary stripping | Medium -- needs per-platform testing |

---

## 11. Impact Map

| File | Change Type | Owner Agent |
|------|-------------|-------------|
| `package.json` | Dependency moves + removals | `flint-electron-ipc` |
| `electron-builder.yml` | Full rewrite | `flint-electron-ipc` |
| `vite.config.ts` | Refactor to function form + mode detection | `flint-electron-ipc` |
| `electron/preview/viteServer.ts` | Optional: add isPackaged guard | `flint-electron-ipc` |

All changes are in the build/packaging infrastructure layer. No store, component, or IPC changes needed.

---

## 12. Commandment Checklist

| # | Commandment | Applies? | Status |
|---|-------------|----------|--------|
| 4 | Local-First Only | YES | No external URLs introduced. Preview vendor files remain in `dist/`. Offline embeddings (`@huggingface/transformers`) preserved. |
| 12 | Atomic Queuing | NO | No file write changes. |
| 14 | Bypass Prohibition | YES | No direct `fs` or `git` calls introduced. Build scripts use npm/vite/electron-builder. |

No other commandments are affected by build pipeline changes.

---

## 13. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| electron-builder auto-resolution misses a transitive dependency needed at runtime | HIGH | 4 (offline) | Test the built `.app` thoroughly: SQLite, preview, MCP, AI chat. If a module is missing at runtime, add it to an explicit `files` include. |
| `@huggingface/transformers` fails to find `onnxruntime-node` after `onnxruntime-web` exclusion | MEDIUM | 4 (offline) | Test RAG pipeline in packaged build. The library's runtime detection should prefer `-node` in Node.js. |
| MCP child process loses access to a dependency after ASAR changes | MEDIUM | -- | flint-mcp has its own `node_modules` and is fully unpacked. Should be unaffected. Verify with `flint_status` tool call. |
| `tsc -b` clean build takes longer than incremental | LOW | -- | ~2-3s vs ~1s. Acceptable for correctness. |
| Future provider SDKs (openai, google) need re-adding | LOW | -- | Documented in this contract. Re-add to `dependencies` when the provider adapter is actually implemented. |

---

## 14. Validation Protocol

After all changes are applied, run this exact sequence:

```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Type check
npx tsc --noEmit

# 3. Tests
npm test
npm run test:react

# 4. Dev mode (should start without hanging)
# Manually verify: Electron window opens, preview works, HMR works
npm run dev

# 5. Production build (should exit cleanly, no hang)
npm run build

# 6. Package (the real test)
npm run build:beta:quick

# 7. Launch the packaged app and verify:
#    - App starts without crash
#    - Open a project (SQLite works)
#    - Preview renders (srcdoc iframe works)
#    - Activity Feed shows MCP connection (child process works)
#    - Send an AI chat message (Anthropic SDK works)
#    - Check console for "onnxruntime" or "huggingface" errors

# 8. Measure ASAR size
du -sh "release/mac-arm64/Flint Glass.app/Contents/Resources/app.asar"
# Target: < 80MB (down from 300MB+)
```
