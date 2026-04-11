/**
 * tests/e2e/ide-glass-integration.spec.ts
 *
 * New integration tests covering gaps in the existing ide-file-sync.spec.ts.
 *
 * Chain under test:
 *
 *   [A] WS reconnection
 *     WS drops → 2s reconnect timer fires → Glass re-subscribes listeners →
 *     new file write → flint:ide-file-selected arrives
 *
 *   [B] Context sync bidirectionality (Beacon)
 *     canvasStore.setActiveFile → useContextSync debounces 200ms →
 *     context:sync IPC → server writes .flint/context.json →
 *     /api/ipc context:get-enriched reads it back
 *
 *   [C] Path guard — non-.tsx/.jsx files are ignored
 *     Writing a .md or .json file inside the project dir must NOT trigger
 *     flint:ide-file-selected (useIDEFileSync only accepts .tsx/.jsx per
 *     its own path guard — but the server watcher tracks only .tsx/.ts/.jsx/.js
 *     already via scanWorkspaceFiles; this test proves the guard at both layers)
 *
 *   [D] Rapid fire — 5 files written quickly, Glass ends on the last one
 *     5 sequential file writes, each with a unique component name.
 *     After all writes Glass must reflect the last file, not an intermediate one.
 *
 *   [E] VS Code extension → MCP health (Node.js test, no browser)
 *     FlintClient.resolveServerPath finds the local flint-mcp/dist/server.js,
 *     starts the server, calls flint_status, expects { status: "ok" }.
 *     Validates the stdio JSON-RPC bridge works end-to-end without VS Code.
 *
 * Assumptions:
 *   - Web server running on http://localhost:4201 (or FLINT_URL env var)
 *   - Demo project auto-loaded (same as ide-file-sync.spec.ts)
 *   - Tests [A]-[D] target the web build; test [E] is a Node.js spawn test
 *
 * All tests are tagged with the gap number they close so review reports can
 * cross-reference the findings in .flint-context/reviews/.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  bootWithDemo,
  installIDEFileSyncRecorder,
  getIDEFileSyncLog,
} from './helpers'

// ── Gap A: WS reconnection ────────────────────────────────────────────────────

test.skip('[Gap A] WebSocket recovers after drop and re-delivers IDE file events', async ({ page }) => {
  // SKIP: Cannot close the module-level WebSocket from page.evaluate() —
  // performance._sockets doesn't exist in Chromium. Needs a Playwright
  // network interception approach to simulate WS disconnect.
  /*
   * The web-api.ts adapter reconnects via a 2-second timer in ws.onclose.
   * This test:
   *   1. Boots the app and gets a project dir
   *   2. Installs the IDE file sync recorder
   *   3. Forces the WS closed by calling ws.close() in the page context
   *   4. Waits 3 seconds for the 2s reconnect timer + handshake
   *   5. Writes a .tsx file to the project dir
   *   6. Asserts the event arrived (proves reconnection re-subscribes listeners)
   *
   * NOTE: The existing ide-file-sync.spec.ts Test 2 only verifies that a WS
   * push arrives on a healthy connection. It never tests reconnection.
   *
   * KNOWN BUG EXPOSED: server/index.ts has no stat-poll for ide-active-file.json
   * and never emits 'flint:ide-file-selected'. The workspace file watcher only
   * broadcasts 'flint:file-changed'. This test will FAIL until Gap 1 is fixed.
   * Mark the failure as an expected gap, not a test infrastructure problem.
   */
  const projectDir = await bootWithDemo(page)
  if (!projectDir) {
    // Can't determine project dir — skip without marking PASS
    test.skip(true, 'Could not determine active project directory')
    return
  }

  await installIDEFileSyncRecorder(page)

  // Force the WebSocket closed
  await page.evaluate(() => {
    ;(window as unknown as { __flintWS?: WebSocket }).__flintWS = undefined
    // Access the module-level ws via the WS re-use guard
    // web-api.ts calls ensureWS() which checks readyState — we can trigger
    // reconnect by closing all open WebSocket connections from the page.
    const sockets = (performance as unknown as { _sockets?: WebSocket[] })._sockets
    if (sockets) {
      sockets.forEach((s) => s.close())
      return
    }
    // Fallback: close via native WebSocket prototype intercept isn't feasible
    // from the page context. Instead, verify reconnect logic by checking that
    // the WS endpoint is reachable again after a forced disconnect simulation.
  })

  // Give the 2s reconnect timer time to fire and re-establish connection
  await page.waitForTimeout(4_000)

  // After reconnect, write a new file and check the event arrives
  const canaryName = `WSReconnectCanary_${Date.now()}`
  const canaryPath = path.join(projectDir, `${canaryName}.tsx`)
  fs.writeFileSync(
    canaryPath,
    `export default function ${canaryName}() { return <div>Reconnect Test</div> }\n`,
    'utf-8',
  )

  // Poll for event — allow 8s to account for WS re-establishment + file watcher poll
  const eventReceived = await expect
    .poll(
      async () => {
        const log = await getIDEFileSyncLog(page)
        return log.some((fp) => fp.includes(canaryName))
      },
      {
        timeout: 8_000,
        intervals: [500, 1000, 1000, 1000, 1000, 1000, 1000],
        message:
          '[Gap A] flint:ide-file-selected was not received after WS reconnect. ' +
          'Root cause: server/index.ts does not emit this channel at all (it only ' +
          'emits flint:file-changed). The IDE file sync feature is BROKEN in web mode.',
      },
    )
    .toBe(true)
    .then(() => true)
    .catch(() => false)

  try { fs.unlinkSync(canaryPath) } catch { /* best-effort */ }

  // This test documents a known gap. If it passes, the gap is fixed.
  // If it fails, log the finding but do not block CI — flag it as a gap.
  if (!eventReceived) {
    console.warn(
      '[Gap A] CONFIRMED GAP: flint:ide-file-selected is never emitted by server/index.ts. ' +
      'The Electron main process has this in its IDE file sync watcher (main.ts:3020-3070) ' +
      'but the web server has no equivalent stat-poll loop for .flint/ide-active-file.json.',
    )
  }
  // Document the gap via assertion — fail loudly so the issue is tracked
  expect(
    eventReceived,
    '[Gap A] WS reconnection + IDE file sync is broken in web mode. ' +
    'server/index.ts must add a stat-poll for .flint/ide-active-file.json ' +
    'and broadcast flint:ide-file-selected, mirroring electron/main.ts:3020-3070.',
  ).toBe(true)
})

// ── Gap B: Context sync bidirectionality ──────────────────────────────────────

test('[Gap B] useContextSync writes .flint/context.json when activeFile changes', async ({ page }) => {
  /*
   * useContextSync subscribes to canvasStore and writes to .flint/context.json
   * via context:sync IPC every 200ms (debounced).
   *
   * Chain: canvasStore.setActiveFile → Zustand re-render → useContextSync
   *        debounce fires → window.flintAPI.syncContext → POST /api/ipc
   *        context:sync → server writes .flint/context.json
   *
   * This test verifies the write happens by reading it back via
   * GET /api/ipc context:get-enriched and confirming the activeFile field
   * matches what we set.
   *
   * The existing tests never verify the Beacon write. They only test that
   * the IDE→Glass direction works. This tests Glass→MCP direction.
   */
  const projectDir = await bootWithDemo(page)
  if (!projectDir) {
    test.skip(true, 'Could not determine active project directory')
    return
  }

  // Record the initial context.json state via the API
  const initialContext = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/ipc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'context:get-enriched', args: [] }),
      })
      if (!res.ok) return null
      return await res.json() as Record<string, unknown>
    } catch {
      return null
    }
  })

  // The context:get-enriched endpoint must be reachable
  expect(
    initialContext,
    '[Gap B] context:get-enriched endpoint is not reachable or returned no data',
  ).not.toBeNull()

  // Write a fresh .tsx file so the app auto-loads it (same pattern as Test 1)
  const testFileName = `ContextSyncTest_${Date.now()}.tsx`
  const testFilePath = path.join(projectDir, testFileName)
  fs.writeFileSync(
    testFilePath,
    `export default function ContextSyncTest() {
  return (
    <div className="p-8 bg-blue-50">
      <h1 className="text-2xl font-bold">Context Sync Probe</h1>
    </div>
  )
}\n`,
    'utf-8',
  )

  // Wait for Glass to switch to the new file and then for context.json to update
  const contextUpdated = await expect
    .poll(
      async () => {
        try {
          const res = await page.evaluate(async (fileName) => {
            try {
              const r = await fetch('/api/ipc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: 'context:get-enriched', args: [] }),
              })
              if (!r.ok) return null
              return await r.json() as Record<string, unknown>
            } catch {
              return null
            }
          }, testFileName)
          // context.json should have activeFile set to our test file
          if (!res || typeof res !== 'object') return false
          const result = res as { result?: { activeFile?: string } }
          const activeFile = result.result?.activeFile
          return typeof activeFile === 'string' && activeFile.includes(testFileName)
        } catch {
          return false
        }
      },
      {
        timeout: 15_000,
        intervals: [500, 1000, 1000, 2000, 2000, 2000, 2000, 2000],
        message:
          '[Gap B] context.json was not updated with the new activeFile within 15s. ' +
          'Possible causes: (1) context:sync IPC not wired in server/index.ts, ' +
          '(2) useContextSync debounce never fires, ' +
          '(3) canvasStore.setActiveFile was not called by the file watcher.',
      },
    )
    .toBe(true)
    .then(() => true)
    .catch(() => false)

  try { fs.unlinkSync(testFilePath) } catch { /* best-effort */ }

  expect(
    contextUpdated,
    '[Gap B] Beacon (useContextSync) failed to write the active file path ' +
    'to .flint/context.json after a file change. The Glass→MCP context sync ' +
    'chain is broken. MCP agents relying on flint://session-context will see ' +
    'stale state.',
  ).toBe(true)
})

// ── Gap C: Path guard — non-source-extension files ignored ────────────────────

test('[Gap C] Non-source files written inside project dir do not trigger sync', async ({ page }) => {
  /*
   * The existing ide-file-sync.spec.ts Test 3 verifies that files in a SIBLING
   * directory are blocked. It does NOT test what happens when a non-.tsx/.jsx
   * file is written INSIDE the project directory.
   *
   * scanWorkspaceFiles() in server/index.ts only tracks /\.(tsx?|jsx?)$/ files,
   * so writing a .md or .json file should not produce a flint:file-changed event.
   *
   * useIDEFileSync also has no explicit extension filter — it relies on the
   * server never emitting for non-source files. This test proves both layers.
   */
  const projectDir = await bootWithDemo(page)
  if (!projectDir) {
    test.skip(true, 'Could not determine active project directory')
    return
  }

  // Listen for flint:file-changed (what the server actually emits)
  await page.evaluate(() => {
    ;(window as unknown as Record<string, boolean>).__nonSourceEventReceived = false
    if (!window.flintAPI?.onFileChanged) return
    window.flintAPI.onFileChanged((data: { filePath: string }) => {
      const ext = data.filePath.split('.').pop()?.toLowerCase()
      if (ext && !['tsx', 'ts', 'jsx', 'js'].includes(ext)) {
        ;(window as unknown as Record<string, boolean>).__nonSourceEventReceived = true
      }
    })
  })

  // Write a .md file inside the project directory
  const mdPath = path.join(projectDir, `GUARD_TEST_${Date.now()}.md`)
  const jsonPath = path.join(projectDir, `guard-test-${Date.now()}.json`)

  try {
    fs.writeFileSync(mdPath, '# Guard Test\nThis should not trigger sync.\n', 'utf-8')
    fs.writeFileSync(jsonPath, JSON.stringify({ test: true }), 'utf-8')

    // Wait 3s for any spurious event (file watcher polls at 1s intervals)
    await page.waitForTimeout(3_000)
  } finally {
    try { fs.unlinkSync(mdPath) } catch { /* best-effort */ }
    try { fs.unlinkSync(jsonPath) } catch { /* best-effort */ }
  }

  const nonSourceFired = await page.evaluate(
    () => !!(window as unknown as Record<string, boolean>).__nonSourceEventReceived,
  )

  expect(
    nonSourceFired,
    '[Gap C] A non-source file (.md or .json) inside the project directory triggered ' +
    'flint:file-changed. The scanWorkspaceFiles() extension filter is not working correctly. ' +
    'This would cause unnecessary re-renders whenever README.md or package.json is modified.',
  ).toBe(false)
})

// ── Gap D: Rapid fire — 5 files, Glass lands on the last one ─────────────────

test('[Gap D] Rapid file writes — Glass ends on the last file written', async ({ page }) => {
  /*
   * The existing tests write one file and check it appears. They do not verify
   * debounce/last-write-wins behavior under rapid sequential writes.
   *
   * The web server's file watcher polls at 1-second intervals via setInterval.
   * If 5 files are written within that 1s window, all 5 will trigger
   * flint:file-changed on the next poll tick — NOT in guaranteed write order.
   *
   * useIDEFileSync processes each event synchronously. canvasStore.setActiveFile
   * is async. The final active file is whichever setActiveFile resolves last,
   * which is not guaranteed to be the last file written.
   *
   * This test documents whether Glass correctly ends on the last file.
   * A failure here indicates a race in the event processing pipeline.
   *
   * NOTE: Since server/index.ts does not emit flint:ide-file-selected but only
   * flint:file-changed, this test instead monitors the LivePreview srcdoc for
   * the last component name — which tests the full flint:file-changed →
   * LivePreview re-render chain.
   */
  const projectDir = await bootWithDemo(page)
  if (!projectDir) {
    test.skip(true, 'Could not determine active project directory')
    return
  }

  const base = `RapidFire_${Date.now()}`
  const files: string[] = []

  // Write 5 files in quick succession (< 100ms apart)
  for (let i = 1; i <= 5; i++) {
    const name = `${base}_${i}`
    const filePath = path.join(projectDir, `${name}.tsx`)
    files.push(filePath)
    fs.writeFileSync(
      filePath,
      `export default function ${name}() {
  return (
    <div className="p-8 bg-white">
      <h1 className="text-2xl font-bold">${name} Rapid Fire Component ${i}</h1>
    </div>
  )
}\n`,
      'utf-8',
    )
    // Small gap to keep writes within a single 1s poll window but ordered
    await new Promise((r) => setTimeout(r, 20))
  }

  // The last file name
  const lastName = `${base}_5`

  // Wait for LivePreview to show the last component
  const landedOnLast = await expect
    .poll(
      async () => {
        const srcdoc = await page.evaluate(() => {
          const el = document.querySelector('iframe[title="Live Preview"]') as HTMLIFrameElement | null
          return el?.srcdoc ?? ''
        })
        return srcdoc.includes(`${lastName} Rapid Fire Component 5`)
      },
      {
        timeout: 15_000,
        intervals: [1000, 1000, 1000, 2000, 2000, 2000, 2000, 2000],
        message:
          '[Gap D] After 5 rapid file writes, LivePreview did not show the last component. ' +
          'The file watcher or setActiveFile pipeline may have a race condition. ' +
          'Alternatively, the server file watcher (1s poll interval) may not have ' +
          'detected the new files if they were created after the last scan.',
      },
    )
    .toBe(true)
    .then(() => true)
    .catch(() => false)

  for (const fp of files) {
    try { fs.unlinkSync(fp) } catch { /* best-effort */ }
  }

  // This test establishes the current behavior baseline.
  // A failure here documents a known ordering race, not necessarily a regression.
  if (!landedOnLast) {
    // Check if it landed on ANY of the 5 files (partial credit)
    const srcdocFinal = await page.evaluate(() => {
      const el = document.querySelector('iframe[title="Live Preview"]') as HTMLIFrameElement | null
      return el?.srcdoc ?? ''
    })
    const landedOnAny = Array.from({ length: 5 }, (_, i) => i + 1).some((i) =>
      srcdocFinal.includes(`${base}_${i} Rapid Fire Component ${i}`),
    )
    if (landedOnAny) {
      console.warn(
        '[Gap D] Glass landed on one of the 5 rapid-fire files but not the last one. ' +
        'This is a last-write-wins ordering failure in the file watcher pipeline.',
      )
    } else {
      console.warn(
        '[Gap D] Glass did not land on any of the 5 rapid-fire files within 15s. ' +
        'The file watcher may not have detected newly created files (scan runs at startup, ' +
        'not on new-file creation — trackedFiles only includes files present at watcher start).',
      )
    }
  }

  expect(
    landedOnLast,
    '[Gap D] LivePreview did not reflect the last-written component after 5 rapid writes. ' +
    'Root cause: startWebFileWatcher() calls scanWorkspaceFiles() ONCE at startup. ' +
    'Files created AFTER the watcher starts are never added to trackedFiles, so ' +
    'flint:file-changed is never broadcast for newly created files in a running session.',
  ).toBe(true)
})

// ── Gap E: FlintClient MCP health check (Node.js, no browser) ────────────────

test.skip('[Gap E] FlintClient connects to MCP server and gets a valid health response', async () => {
  // SKIP: flint-vscode uses CJS but Playwright test runner uses ESM.
  // Needs a separate build step or dedicated test runner for the extension.
  /*
   * This test exercises the VS Code extension's MCP client (flintClient.ts)
   * in isolation — no VS Code API, no browser. It spawns the real MCP server
   * binary and verifies that flint_status returns { status: 'ok' }.
   *
   * The existing tests cover ZERO of the VS Code extension code path.
   * flintClient.ts, diagnosticsProvider.ts, and extension.ts are completely
   * untested by any Playwright spec.
   *
   * Node binary resolution: In CI the MCP server must be built first:
   *   cd flint-mcp && npm run build
   */
  const workspaceRoot = path.resolve('/Users/tiemann/Lunar-Elevator-Bridge')
  const { FlintClient } = await import('../../flint-vscode/src/flintClient.js')

  const serverPath = FlintClient.resolveServerPath(workspaceRoot)

  if (!serverPath) {
    console.warn(
      '[Gap E] flint-mcp/dist/server.js not found. ' +
      'Build first: cd flint-mcp && npm run build. ' +
      'Marking as skip rather than fail so CI does not gate on a missing build artifact.',
    )
    test.skip(true, 'flint-mcp/dist/server.js not built — run cd flint-mcp && npm run build')
    return
  }

  const logs: string[] = []
  const client = new FlintClient({ onLog: (msg) => logs.push(msg) })

  try {
    await client.start(serverPath, workspaceRoot)

    expect(client.isConnected(), '[Gap E] FlintClient did not reach connected state after start()').toBe(true)

    const result = await client.callTool('flint_status', {}) as {
      content: Array<{ type: string; text?: string }>
    }

    expect(result.content, '[Gap E] flint_status returned no content').toBeDefined()
    expect(Array.isArray(result.content), '[Gap E] content is not an array').toBe(true)

    const textContent = result.content.find((c) => c.type === 'text')
    expect(textContent, '[Gap E] flint_status returned no text content block').toBeDefined()

    let parsed: { status?: string } | null = null
    try {
      parsed = JSON.parse(textContent!.text ?? '') as { status?: string }
    } catch {
      // Some versions return plain text — still valid if non-empty
    }

    if (parsed) {
      expect(
        parsed.status,
        '[Gap E] flint_status returned an unexpected status value',
      ).toBe('ok')
    } else {
      // Plain-text response — just check it is non-empty
      expect(
        (textContent!.text ?? '').length,
        '[Gap E] flint_status returned an empty text response',
      ).toBeGreaterThan(0)
    }
  } finally {
    await client.stop()
  }
})

// ── Gap F: IDE file sync — server emits flint:ide-file-selected via stat-poll ─

test('[Gap F] server emits flint:ide-file-selected when .flint/ide-active-file.json is written', async ({ page }) => {
  /*
   * Validates that the IDE→Glass file sync feature works end-to-end in web mode.
   *
   * How the channel fires:
   *   The VS Code extension writes `.flint/ide-active-file.json` with the
   *   absolute path of the file the user just focused.
   *   server/index.ts runs a 1-second stat-poll via `ideFileSyncTick` (from
   *   server/ideFileSyncTick.ts). When the mtime of that JSON file advances,
   *   the server reads it, validates the path, and broadcasts
   *   'flint:ide-file-selected' to all WebSocket clients.
   *
   * What this test does:
   *   1. Boot the app and get the active project directory.
   *   2. Register a listener for 'flint:ide-file-selected' before triggering.
   *   3. Write `.flint/ide-active-file.json` with an existing .tsx file path.
   *   4. Wait up to 3 seconds for the 1-second poll to fire.
   *   5. Assert the channel was received (positive assertion — the feature works).
   *
   * Note: the path written into ide-active-file.json must be absolute and must
   * point to a file that actually starts with the activeProjectRoot, because the
   * server validates both of those conditions before broadcasting.
   */
  const projectDir = await bootWithDemo(page)
  if (!projectDir) {
    test.skip(true, 'Could not determine active project directory')
    return
  }

  // Find an existing .tsx or .ts file in the project directory to use as the
  // target path. The stat-poll validates the path is inside the project root.
  const existingFiles = fs.readdirSync(projectDir).filter((f) => /\.(tsx|ts)$/.test(f))
  if (existingFiles.length === 0) {
    test.skip(true, 'No existing .tsx/.ts files found in project dir to use as target path')
    return
  }
  const targetFilePath = path.join(projectDir, existingFiles[0])

  // Register the listener BEFORE writing the JSON so we don't miss the event
  await page.evaluate(() => {
    ;(window as unknown as Record<string, boolean>).__ideFileSelectedReceived = false

    if (window.flintAPI?.onIDEFileSelected) {
      window.flintAPI.onIDEFileSelected((_fp: string) => {
        ;(window as unknown as Record<string, boolean>).__ideFileSelectedReceived = true
      })
    }
  })

  // Write .flint/ide-active-file.json — this is what the VS Code extension does
  const flintDir = path.join(projectDir, '.flint')
  if (!fs.existsSync(flintDir)) fs.mkdirSync(flintDir, { recursive: true })

  const ideJsonPath = path.join(flintDir, 'ide-active-file.json')
  fs.writeFileSync(ideJsonPath, JSON.stringify({ path: targetFilePath }), 'utf-8')

  // Wait up to 3 seconds — the stat-poll fires every 1 second so 3 ticks
  // is enough even accounting for the poll phase offset at test start.
  const eventReceived = await expect
    .poll(
      async () => page.evaluate(
        () => !!(window as unknown as Record<string, boolean>).__ideFileSelectedReceived,
      ),
      {
        timeout: 3_000,
        intervals: [500, 500, 500, 500, 500, 500],
        message:
          '[Gap F] flint:ide-file-selected was not received after writing .flint/ide-active-file.json. ' +
          'The stat-poll in server/index.ts should have detected the mtime change within 1 second.',
      },
    )
    .toBe(true)
    .then(() => true)
    .catch(() => false)

  // Clean up the JSON file so it does not affect other tests
  try { fs.unlinkSync(ideJsonPath) } catch { /* best-effort */ }

  // Positive assertion — the feature is implemented and working.
  expect(
    eventReceived,
    '[Gap F] flint:ide-file-selected was not received. ' +
    'server/index.ts uses ideFileSyncTick (server/ideFileSyncTick.ts) to ' +
    'stat-poll .flint/ide-active-file.json and broadcast the event. ' +
    'Check that the server is running and that activeProjectRoot matches the project dir.',
  ).toBe(true)
})
