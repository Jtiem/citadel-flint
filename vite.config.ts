import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import { createRequire } from 'node:module'
import type { ChildProcess } from 'node:child_process'

const _require = createRequire(import.meta.url)

// ── Custom Electron launcher ────────────────────────────────────────────────
// vite-plugin-electron 0.29 + Vite 7: the plugin's `startup()` function uses
// `await import('electron')` which returns a Vite-intercepted module namespace
// where `.default` is undefined, causing spawn() to receive an Object instead
// of a string path. Using createRequire() bypasses Vite's module interception.
let _startupTimer: ReturnType<typeof setTimeout> | null = null

function debouncedStartup() {
  if (_startupTimer) clearTimeout(_startupTimer)
  _startupTimer = setTimeout(() => {
    _startupTimer = null
    void launchElectron()
  }, 300)
}

async function launchElectron(): Promise<void> {
  const { spawn } = await import('node:child_process')
  const existing = process.electronApp as ChildProcess | undefined
  if (existing && !existing.killed) {
    await new Promise<void>((resolve) => {
      existing.removeAllListeners()
      existing.once('exit', resolve)
      existing.kill('SIGTERM')
    })
  }
  process.electronApp = null

  const electronPath = _require('electron') as string
  const child = spawn(electronPath, ['.', '--no-sandbox'], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })
  process.electronApp = child as never
  child.once('exit', () => process.exit())
}

// ── Rollup externals ────────────────────────────────────────────────────────
const electronExternalMatcher = (id: string) => {
  if (
    id === 'vite' ||
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
  // @huggingface/transformers uses onnxruntime-node which dynamically require()s
  // platform-specific .node binaries. Rollup replaces require() with a CJS shim
  // that cannot load native binaries. Keep external so Node resolves at runtime.
  if (id.startsWith('@huggingface/')) return true
  if (id.startsWith('onnxruntime')) return true
  if (id === '../pkg' || id === './pkg') return true
  return false
}

// ── Watch exclusions ────────────────────────────────────────────────────────
// Electron writes to .flint/ at runtime (context.json, mcp-events.jsonl,
// annotations.json). Without exclusions, Rollup's watchers detect those writes
// and trigger a rebuild → Electron restart → more writes → infinite loop.
const watchExclude = [
  'dist-electron/**',
  '.flint/**',
  '.flint-context/**',
  '.git/**',
  'node_modules/**',
  '**/*.db',
  '**/*.jsonl',
  'release/**',
  'build-resources/**',
]

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // Prevent Vite's dev server from picking up Electron's runtime writes
      ignored: ['**/.flint/**', '**/dist-electron/**', '**/*.db', '**/*.jsonl'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart: debouncedStartup,
        vite: {
          build: {
            outDir: 'dist-electron',
            watch: { exclude: watchExclude },
            rollupOptions: {
              external: electronExternalMatcher,
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart({ reload }) {
          // reload() sends HMR to renderer if Electron is running, but falls
          // back to vite-plugin-electron's broken startup() if it isn't.
          // Guard: only reload when Electron is alive; otherwise debounce-start.
          if (process.electronApp) {
            reload()
          } else {
            debouncedStartup()
          }
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            watch: { exclude: watchExclude },
            rollupOptions: {
              external: ['better-sqlite3', 'fsevents'],
            },
          },
        },
      },
      {
        entry: 'electron/powersync.worker.ts',
        onstart: debouncedStartup,
        vite: {
          build: {
            outDir: 'dist-electron',
            watch: { exclude: watchExclude },
            rollupOptions: {
              external: electronExternalMatcher,
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'fsevents'],
    },
  },
})
