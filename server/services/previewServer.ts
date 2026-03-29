/**
 * server/services/previewServer.ts — Component Preview Server (Web Mode)
 *
 * Wraps Vite's programmatic API to start a dev server for live component
 * preview. The URL produced by this service is consumed by LivePreview.tsx
 * as the iframe src.
 *
 * This replaces the Electron BrowserWindow approach with a standard Vite
 * dev server that can serve the user's project in any browser.
 *
 * Key design decisions:
 *   - Vite is imported dynamically so the service gracefully degrades if
 *     Vite is not installed in the user's project.
 *   - The server runs on a random available port to avoid conflicts with
 *     the main web server (port 4201) and ingestion server (port 4545).
 *   - A minimal Vite config is created with React plugin support. The
 *     user's own vite.config is NOT loaded to avoid interference.
 */

import path from 'node:path'
import { existsSync } from 'node:fs'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PreviewServerService {
  start(projectRoot: string): Promise<{ url: string } | { error: string }>
  stop(): Promise<void>
  getUrl(): string | null
}

// Vite types — kept inline to avoid a hard dependency on vite's type exports
interface ViteDevServer {
  listen(): Promise<ViteDevServer>
  close(): Promise<void>
  config: { server: { port?: number } }
  resolvedUrls: {
    local: string[]
    network: string[]
  } | null
  httpServer: import('node:http').Server | null
}

// ── Constants ──────────────────────────────────────────────────────────────

const LOG_PREFIX = '[Flint]'

// ── Factory ────────────────────────────────────────────────────────────────

export function createPreviewServer(): PreviewServerService {
  let viteServer: ViteDevServer | null = null
  let serverUrl: string | null = null
  let activeRoot: string | null = null

  return {
    async start(projectRoot: string): Promise<{ url: string } | { error: string }> {
      // Idempotency guard: if the server is already running at the same root,
      // return the existing URL immediately. This prevents the start/stop loop
      // that occurs when LivePreview.tsx calls start() on re-mount or Strict Mode
      // double-invoke while the server is healthy.
      if (viteServer && serverUrl && activeRoot === projectRoot) {
        return { url: serverUrl }
      }

      // If already running at a different root, stop first
      if (viteServer) {
        await this.stop()
      }

      // Verify the project directory exists
      if (!existsSync(projectRoot)) {
        return { error: `Project root does not exist: ${projectRoot}` }
      }

      // Dynamically import Vite — if not installed, return a helpful error
      let createServer: (config: Record<string, unknown>) => Promise<ViteDevServer>

      try {
        const vite = await import('vite')
        createServer = vite.createServer as unknown as typeof createServer
      } catch {
        return {
          error:
            'Vite is not available. Install it with `npm install vite` in your project, ' +
            'or use srcdoc preview mode instead.',
        }
      }

      // Try to load the React plugin — optional but recommended
      let reactPlugin: unknown = null
      try {
        const reactModule = await import('@vitejs/plugin-react')
        const pluginFactory = reactModule.default ?? reactModule
        if (typeof pluginFactory === 'function') {
          reactPlugin = pluginFactory()
        }
      } catch {
        console.warn(`${LOG_PREFIX} @vitejs/plugin-react not found — preview will work without JSX transform`)
      }

      // Build a minimal Vite config
      const plugins: unknown[] = []
      if (reactPlugin) {
        plugins.push(reactPlugin)
      }

      try {
        const server = await createServer({
          root: projectRoot,
          configFile: false,
          plugins,
          server: {
            port: 0, // Let the OS assign an available port
            strictPort: false,
            host: '127.0.0.1',
            // Allow the main web server origin to embed the preview in an iframe
            cors: true,
            hmr: true,
          },
          // Resolve .tsx/.ts/.jsx/.js files
          resolve: {
            extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
            alias: {
              '@': path.join(projectRoot, 'src'),
            },
          },
          // Suppress the Vite banner and most logs
          logLevel: 'warn',
          // Optimize dependencies for faster startup
          optimizeDeps: {
            include: ['react', 'react-dom'],
          },
        })

        await server.listen()
        viteServer = server

        // Extract the resolved URL
        const urls = server.resolvedUrls
        if (urls && urls.local.length > 0) {
          serverUrl = urls.local[0]
        } else if (server.httpServer) {
          // Fallback: read port from the http server
          const addr = server.httpServer.address()
          if (addr && typeof addr === 'object') {
            serverUrl = `http://127.0.0.1:${addr.port}`
          }
        }

        if (!serverUrl) {
          await server.close()
          viteServer = null
          activeRoot = null
          return { error: 'Vite server started but could not determine URL' }
        }

        activeRoot = projectRoot
        console.log(`${LOG_PREFIX} Preview server running at ${serverUrl}`)
        return { url: serverUrl }
      } catch (err) {
        viteServer = null
        serverUrl = null
        activeRoot = null
        const message = err instanceof Error ? err.message : String(err)
        console.error(`${LOG_PREFIX} Preview server failed to start:`, message)
        return { error: `Failed to start preview server: ${message}` }
      }
    },

    async stop(): Promise<void> {
      if (!viteServer) return

      try {
        await viteServer.close()
        console.log(`${LOG_PREFIX} Preview server stopped.`)
      } catch (err) {
        console.error(`${LOG_PREFIX} Error stopping preview server:`, err)
      } finally {
        viteServer = null
        serverUrl = null
        activeRoot = null
      }
    },

    getUrl(): string | null {
      return serverUrl
    },
  }
}
