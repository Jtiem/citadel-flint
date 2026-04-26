import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Web mode detection ──────────────────────────────────────────────────────
// In WEB-MODE bundles (vite.config.web.ts defines __FLINT_WEB__=true), always
// install the HTTP/WS adapter. This bundle ships in two places:
//   1. `npm run dev:web` / hosted SPA — preload doesn't exist, so window.flintAPI
//      is undefined; we install the web adapter.
//   2. The packaged Electron desktop wrapper — Electron's preload eagerly sets
//      window.flintAPI to the Electron-IPC bridge BEFORE this code runs. We
//      MUST override it, otherwise the renderer talks to electron/main.ts
//      while the embedded Express server is the actual source of truth.
declare const __FLINT_WEB__: boolean | undefined
const isWebBuild = typeof __FLINT_WEB__ !== 'undefined' && __FLINT_WEB__
if (isWebBuild || !window.flintAPI) {
  const { createWebFlintAPI } = await import('./adapters/web-api.ts')
  ;(window as unknown as Record<string, unknown>).flintAPI = createWebFlintAPI()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
