/**
 * Vite config for the WEB build of Flint Glass.
 *
 * Strips all Electron plugins so the React app builds as a standard SPA.
 * The backend is provided by server/index.ts (Express + WebSocket)
 * instead of Electron's main process.
 *
 * Usage:
 *   npm run dev:web     — Vite dev server + API proxy to server/index.ts
 *   npm run build:web   — Production SPA build to dist-web/
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    // Signal to the React app that it's running in web mode
    '__FLINT_WEB__': JSON.stringify(true),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4200,
    // Prevent Vite from triggering HMR when the server writes to
    // .flint/context.json, .flint/flint.db, mcp-events.jsonl, etc.
    watch: {
      ignored: [
        '**/.flint/**',
        '**/dist-electron/**',
        '**/.git/**',
        '**/node_modules/**',
        '**/*.db',
        '**/*.db-journal',
        '**/*.db-wal',
        '**/server/**',
      ],
    },
    // Proxy API and WebSocket calls to the backend server
    proxy: {
      '/api': {
        target: 'http://localhost:4201',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4201',
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist-web',
    // top-level await in src/main.tsx (web-api adapter import) requires esnext
    target: 'esnext',
    rollupOptions: {
      // Exclude Node.js / Electron modules that might be transitively referenced
      external: [
        'electron',
        'better-sqlite3',
        'sqlite-vec',
        'node-pty',
        'fsevents',
        'bufferutil',
        'utf-8-validate',
      ],
    },
  },
})
