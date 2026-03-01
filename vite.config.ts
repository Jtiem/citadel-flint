import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  // @babel/types (used by @babel/traverse and @babel/parser) references
  // process.env.NODE_ENV internally for validation guards. This global does
  // not exist in Electron's renderer (browser) context, so we polyfill it
  // here at bundle time. This is the canonical Vite fix for Node-targeting
  // CJS packages that assume process is available.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
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
            rollupOptions: {
              // Keep @babel/* packages external so rollup never tries to bundle
              // them. @babel/core uses dynamic require() for plugin resolution
              // internally; when bundled, rollup converts those requires to
              // static ESM imports which then fail if the target isn't installed.
              // Marking them external lets Node.js resolve them from node_modules
              // at runtime where CJS require() works correctly.
              external: (id) =>
                id === 'better-sqlite3' || id.startsWith('@babel/'),
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
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
})
