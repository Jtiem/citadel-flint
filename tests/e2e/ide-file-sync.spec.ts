/**
 * e2e/ide-file-sync.spec.ts
 *
 * End-to-end test for the IDE→Glass file sync feature (IDE.2).
 *
 * Validates that writing a new .tsx file to the active project directory
 * causes Glass to switch to that file automatically — without any user action.
 *
 * Chain under test:
 *   fs.writeFileSync(projectDir/TestSync.tsx)
 *     → server/index.ts fsWatch fires
 *     → broadcast('flint:ide-file-selected', absolutePath)
 *     → WebSocket push to browser
 *     → web-api.ts subscribe('flint:ide-file-selected') fires
 *     → useIDEFileSync hook calls canvasStore.setActiveFile()
 *     → LivePreview re-renders the new component
 *
 * IMPORTANT: The test uses the app's own auto-load flow (not raw IPC) because
 * hydrateWorkspace() must run to set canvasStore.workspaceFiles — the path
 * guard in useIDEFileSync blocks events from files outside that root.
 *
 * Assumes the dev server is running on http://localhost:4201.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { bootWithDemo } from './helpers'

const TEST_COMPONENT_CONTENT = `export default function TestSync() {
  return (
    <div className="p-8 bg-white">
      <h1 className="text-2xl font-bold">File Sync Works!</h1>
      <p className="text-gray-600">This was written by the IDE and Glass loaded it automatically.</p>
    </div>
  )
}`

// ---------------------------------------------------------------------------
// Test 1 — Full IDE→Glass sync chain
// ---------------------------------------------------------------------------

test('IDE file write triggers Glass to load the new component', async ({ page }) => {
  // ── Step 1: Boot the app and explicitly load a demo project ───────────────
  const projectDir = await bootWithDemo(page)

  // Confirm the path looks like a demo project in /tmp
  expect(projectDir).toMatch(/flint-beta-demo/)

  // ── Step 4: Record current active file ────────────────────────────────────
  const srcdocBefore = await page.evaluate(() => {
    const el = document.querySelector('iframe[title="Live Preview"]') as HTMLIFrameElement | null
    return el?.srcdoc ?? ''
  })
  expect(srcdocBefore.length).toBeGreaterThan(50)

  // ── Step 5: Write TestSync.tsx to the project directory ───────────────────
  const testFilePath = path.join(projectDir, 'TestSync.tsx')
  fs.writeFileSync(testFilePath, TEST_COMPONENT_CONTENT, 'utf-8')

  // ── Step 6: Wait for sync to propagate ────────────────────────────────────
  // The IDE file watcher (fsWatch) has a 500ms debounce. The WS push adds
  // ~100ms latency. The React state update adds another render tick.
  // We allow 8 seconds total, polling every 500ms.
  const syncResult = await expect
    .poll(
      async () => {
        // Primary check: does LivePreview srcdoc contain the new component text?
        const srcdoc = await page.evaluate(() => {
          const el = document.querySelector(
            'iframe[title="Live Preview"]',
          ) as HTMLIFrameElement | null
          return el?.srcdoc ?? ''
        })
        if (srcdoc.includes('File Sync Works!')) return 'preview-updated'

        // Secondary check: did the active file indicator change to TestSync?
        const headerText = await page.locator('header').textContent().catch(() => '')
        if (headerText?.includes('TestSync')) return 'filename-updated'

        return null
      },
      {
        timeout: 8_000,
        intervals: [500, 1000, 1000, 1000, 1000, 1000, 1000],
        message:
          'Expected Glass to switch to TestSync.tsx within 8s of file being written. ' +
          'Possible failure modes: (1) fsWatch not firing in /tmp, ' +
          '(2) WebSocket not connected, ' +
          '(3) useIDEFileSync workspaceFiles.path guard rejected the path, ' +
          '(4) canvasStore.setActiveFile did not re-render LivePreview.',
      },
    )
    .not.toBeNull()
    .then(() => true)
    .catch(() => false)

  // Cleanup before assertion so /tmp doesn't accumulate
  try { fs.unlinkSync(testFilePath) } catch { /* best-effort */ }

  expect(
    syncResult,
    'Glass did not load TestSync.tsx after it was written to the project directory. ' +
    'This is a real IDE→Glass sync integration failure.',
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// Test 2 — WS push is received by the browser after project load
// ---------------------------------------------------------------------------

test('file watcher broadcasts to WebSocket after project is loaded', async ({ page }) => {
  // This test directly verifies the WS broadcast reaches the browser, isolating
  // the server-side portion of the chain from the React store update.
  const projectDir = await bootWithDemo(page)
  expect(projectDir).toBeTruthy()
  if (!projectDir) return

  // Register a listener for the WS broadcast BEFORE writing the file.
  // web-api.ts exposes onIDEFileSelected which subscribes to 'flint:ide-file-selected'.
  await page.evaluate(() => {
    if (!window.flintAPI?.onIDEFileSelected) return
    window.flintAPI.onIDEFileSelected((data: unknown) => {
      // WS payload is { path: string }, not a raw string
      const fp = typeof data === 'string' ? data : (data as { path?: string })?.path ?? ''
      if (fp.includes('WatcherCanary')) {
        ;(window as unknown as Record<string, boolean>).__testWatcherCanaryReceived = true
      }
    })
  })

  // Write the canary file
  const canaryPath = path.join(projectDir, 'WatcherCanary.tsx')
  fs.writeFileSync(
    canaryPath,
    `export default function WatcherCanary() { return <div>Watcher Canary</div> }\n`,
    'utf-8',
  )

  // Poll for the WS push to arrive in the browser
  const eventReceived = await expect
    .poll(
      () =>
        page.evaluate(
          () => !!(window as unknown as Record<string, boolean>).__testWatcherCanaryReceived,
        ),
      { timeout: 5_000, intervals: [500, 1000, 1000, 1000] },
    )
    .toBe(true)
    .then(() => true)
    .catch(() => false)

  try { fs.unlinkSync(canaryPath) } catch { /* best-effort */ }

  expect(
    eventReceived,
    'WS push for WatcherCanary.tsx was not received in the browser within 5s. ' +
    'This means either fsWatch is not firing or the WS broadcast is not reaching the client.',
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// Test 3 — Guard: sibling directory files are not broadcast
// ---------------------------------------------------------------------------

test('files written in a sibling directory are not broadcast', async ({ page }) => {
  // fsWatch is scoped to activeProjectRoot only. A file written to a sibling
  // directory (same parent, different folder) must NOT trigger the event.
  const projectDir = await bootWithDemo(page)
  expect(projectDir).toBeTruthy()
  if (!projectDir) return

  await page.evaluate(() => {
    if (!window.flintAPI?.onIDEFileSelected) return
    window.flintAPI.onIDEFileSelected((fp: string) => {
      if (fp.includes('OutsideProject')) {
        ;(window as unknown as Record<string, boolean>).__testOutsideEventReceived = true
      }
    })
  })

  // Write to the parent directory of the project — NOT inside the project
  const siblingPath = path.join(path.dirname(projectDir), 'OutsideProject.tsx')
  try {
    fs.writeFileSync(
      siblingPath,
      `export default function OutsideProject() { return <div /> }\n`,
      'utf-8',
    )
    await page.waitForTimeout(3_000)
  } finally {
    try { fs.unlinkSync(siblingPath) } catch { /* best-effort */ }
  }

  const outsideEventFired = await page.evaluate(
    () => !!(window as unknown as Record<string, boolean>).__testOutsideEventReceived,
  )
  expect(
    outsideEventFired,
    'A file in a sibling directory should not trigger flint:ide-file-selected — ' +
    'fsWatch is scoped to the active project root.',
  ).toBe(false)
})
