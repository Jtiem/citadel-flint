import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

const isProduction = process.env.NODE_ENV === 'production'

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

// Patterns that Electron writes at runtime — must be excluded from all watchers
// to prevent Vite rebuild → Electron restart → file write → rebuild loops.
const watchExclude = [
  '**/.flint/**',
  '**/dist-electron/**',
  '**/.git/**',
  '**/node_modules/**',
  '**/*.db',
  '**/*.db-journal',
  '**/*.db-wal',
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
      // Prevent the CLIENT Vite dev server from triggering HMR when
      // Electron writes .flint/context.json, .flint/mcp-events.jsonl, etc.
      ignored: watchExclude,
      // Use polling instead of native fsevents to prevent SIGABRT crash
      // during Electron environment teardown on macOS 26.
      usePolling: true,
      interval: 1000,
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
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'fsevents'],
    },
  },
})
