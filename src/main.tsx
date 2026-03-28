import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Web mode detection ──────────────────────────────────────────────────────
// When running outside Electron (no preload.ts), assign the HTTP/WS adapter
// so the React app works identically in a browser.
if (!window.flintAPI) {
  const { createWebFlintAPI } = await import('./adapters/web-api.ts')
  ;(window as Record<string, unknown>).flintAPI = createWebFlintAPI()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
