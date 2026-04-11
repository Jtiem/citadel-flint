/**
 * Playwright global setup — kills stale processes on ports 4201 and 4545
 * before launching tests. Prevents "port in use" and WebSocket 503 errors
 * from zombie server processes left by previously crashed test runs.
 */
import { execSync } from 'node:child_process'

export default function globalSetup(): void {
  for (const port of [4201, 4545]) {
    try {
      const pids = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf-8' }).trim()
      if (pids) {
        execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null`)
        console.log(`[e2e setup] Killed stale processes on port ${port}: ${pids.replace(/\n/g, ', ')}`)
      }
    } catch {
      // No processes on this port — expected
    }
  }
}
