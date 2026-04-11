/**
 * Shared E2E test helpers for Flint Glass web mode.
 *
 * These helpers actively load a demo project via IPC rather than relying
 * on the app's auto-load flow, which has timing races when the browser
 * connects immediately after server startup.
 */

import { expect, type Page } from '@playwright/test'

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4201'

/**
 * Dismiss the onboarding overlay if it appears.
 */
export async function dismissOnboarding(page: Page): Promise<void> {
  await page.waitForTimeout(2_000)
  const skipButton = page.locator('button[aria-label="Skip onboarding"]')
  for (let i = 0; i < 3; i++) {
    const visible = await skipButton.isVisible().catch(() => false)
    if (visible) {
      await skipButton.click()
      await page.waitForTimeout(500)
      return
    }
    await page.waitForTimeout(1_000)
  }
}

/**
 * Wait until the LivePreview iframe has non-trivial srcdoc content.
 */
export async function waitForLivePreview(page: Page, timeoutMs = 35_000): Promise<void> {
  await expect(page.locator('iframe[title="Live Preview"]')).toBeVisible({ timeout: timeoutMs })
  await expect.poll(
    () =>
      page.evaluate(() => {
        const el = document.querySelector('iframe[title="Live Preview"]') as HTMLIFrameElement | null
        return el?.srcdoc?.length ?? 0
      }),
    { timeout: timeoutMs, intervals: [500, 1000, 2000] },
  ).toBeGreaterThan(50)
}

/**
 * Explicitly load a demo project via the browser's window.flintAPI.
 *
 * This bypasses the app's auto-load flow which has timing races when the
 * browser connects immediately after server startup. Triggers the same
 * code paths the app uses, so React state updates correctly.
 */
export async function loadDemoProject(page: Page): Promise<string> {
  // Use raw fetch() instead of window.flintAPI to avoid any WS/state deadlocks.
  // The server broadcasts flint:project-opened which Glass picks up via WS.
  const projectPath = await page.evaluate(async () => {
    const res = await fetch('/api/ipc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'beta:load-demo-project', args: [{ demoName: 'a11y-audit' }] }),
    })
    const json = await res.json() as { result?: { projectPath?: string } }
    return json.result?.projectPath ?? null
  })

  if (!projectPath) throw new Error('Failed to load demo project')

  // Open the project — server broadcasts flint:project-opened to WS clients
  const opened = await page.evaluate(async (demoPath: string) => {
    const res = await fetch('/api/ipc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'project:openPath', args: [demoPath] }),
    })
    const json = await res.json() as { result?: unknown }
    return !!json.result
  }, projectPath)

  if (!opened) throw new Error(`Failed to open project at ${projectPath}`)

  // Wait for Glass to process the flint:project-opened broadcast and hydrate
  await page.waitForTimeout(5000)

  return projectPath
}

/**
 * Full boot sequence: navigate, dismiss onboarding, load demo, wait for preview.
 */
export async function bootWithDemo(page: Page): Promise<string> {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  // Wait for the app to settle and WS to connect (needed for project-opened broadcast)
  await page.waitForTimeout(5000)

  // Check if demo auto-loaded (fast path)
  const autoLoaded = await page.evaluate(() => {
    const f = document.querySelector('iframe[title="Live Preview"]') as HTMLIFrameElement | null
    return !!f && (f.srcdoc?.length ?? 0) > 50
  })

  let projectDir: string

  if (autoLoaded) {
    // Auto-load worked — extract project dir from header
    const dir = await getProjectDirFromPage(page)
    if (!dir) throw new Error('Auto-load appeared to work but could not determine project dir')
    projectDir = dir
  } else {
    // Auto-load didn't work — explicitly load via IPC
    projectDir = await loadDemoProject(page)
    await waitForLivePreview(page, 35_000)
  }

  // Confirm layer tree is visible
  const layerTree = page.getByRole('tree', { name: /component layer tree/i })
  await expect(layerTree).toBeVisible({ timeout: 20_000 })

  return projectDir
}

/**
 * Extract the active project directory from the page header.
 */
export async function getProjectDirFromPage(page: Page): Promise<string | null> {
  // Primary: IPC call to project:getTree
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/ipc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'project:getTree', args: [] }),
      })
      if (!res.ok) return null
      const json = (await res.json()) as { result?: { path?: string } }
      return json?.result?.path ?? null
    } catch {
      return null
    }
  })
  if (result && typeof result === 'string' && result.startsWith('/')) return result

  // Fallback: scrape page for flint-beta-demo path
  const content = await page.content()
  const match = content.match(/\/(?:var\/folders|tmp|private\/tmp)[^"'\s]+flint-beta-demo\/demo-\d+/)
  if (match) return match[0].replace(/\/[^/]+\.(tsx|jsx|ts|js)$/, '')

  return null
}

/**
 * Install a WS message listener that records flint:ide-file-selected events.
 */
export async function installIDEFileSyncRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__ideFileSyncLog = []
    if (!window.flintAPI?.onIDEFileSelected) return
    window.flintAPI.onIDEFileSelected((data: unknown) => {
      // WS payload is { path: string }, Electron sends raw string
      const fp = typeof data === 'string' ? data : (data as { path?: string })?.path ?? ''
      ;((window as unknown as Record<string, string[]>).__ideFileSyncLog).push(fp)
    })
  })
}

export async function getIDEFileSyncLog(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    return ((window as unknown as Record<string, unknown[]>).__ideFileSyncLog ?? []) as string[]
  })
}
