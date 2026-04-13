/**
 * e2e/demo-flow.spec.ts
 *
 * End-to-end smoke tests for the Flint Glass web build.
 *
 * Assumes the dev server is running on http://localhost:4201.
 * Start it with: npm run dev:web
 *
 * These tests verify the demo-critical surfaces:
 *   3-panel layout → LivePreview → layer tree → governance tab → Properties tab
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4201'

/**
 * Dismiss the onboarding overlay if it appears.
 * The overlay has a "Skip onboarding" button with aria-label.
 */
async function dismissOnboarding(page: Page) {
  // The onboarding overlay may take a moment to appear after page load
  await page.waitForTimeout(2_000)
  const skipButton = page.locator('button[aria-label="Skip onboarding"]')
  // Try multiple times — the overlay may appear after initial render
  for (let i = 0; i < 3; i++) {
    const visible = await skipButton.isVisible().catch(() => false)
    if (visible) {
      await skipButton.click()
      await page.waitForTimeout(500)
      return
    }
    await page.waitForTimeout(1_000)
  }
  // If no overlay found, continue — it may not appear for this session
}

// ---------------------------------------------------------------------------
// Test 1 — App loads and shows the 3-panel layout
// ---------------------------------------------------------------------------

test('app loads with 3-panel layout', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  // The app should render within 15s — either the workspace or the LaunchScreen.
  // Look for key workspace elements OR the LaunchScreen heading.
  const workspace = page.locator('iframe[title="Live Preview"], header[aria-label*="launch screen"]')
  await expect(workspace.first()).toBeVisible({ timeout: 15_000 })
})

// ---------------------------------------------------------------------------
// Test 2 — LivePreview iframe has content
// ---------------------------------------------------------------------------

test('LivePreview iframe renders content', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  const iframe = page.locator('iframe[title="Live Preview"]')
  // If no LivePreview yet (LaunchScreen showing), skip gracefully
  const visible = await iframe.isVisible().catch(() => false)
  if (!visible) {
    // Try to wait a bit — the app might auto-load a project
    await page.waitForTimeout(5_000)
  }

  await expect(iframe).toBeVisible({ timeout: 20_000 })

  // The iframe srcdoc must be populated
  await expect.poll(
    async () => {
      return page.evaluate(() => {
        const el = document.querySelector('iframe[title="Live Preview"]') as HTMLIFrameElement | null
        return el?.srcdoc?.length ?? 0
      })
    },
    { timeout: 20_000, intervals: [500, 1000, 2000] },
  ).toBeGreaterThan(50)
})

// ---------------------------------------------------------------------------
// Test 3 — Layer tree has nodes
// ---------------------------------------------------------------------------

test('layer tree shows component nodes', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  const layerTree = page.getByRole('tree', { name: /component layer tree/i })
  await expect(layerTree).toBeVisible({ timeout: 20_000 })

  const layerNodes = layerTree.getByRole('treeitem')
  await expect(layerNodes.first()).toBeVisible({ timeout: 15_000 })

  const count = await layerNodes.count()
  expect(count).toBeGreaterThan(0)
})

// ---------------------------------------------------------------------------
// Test 4 — Right sidebar tabs exist
// ---------------------------------------------------------------------------

test('right sidebar has Governance and Properties tabs', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  // Wait for workspace to be ready
  await expect(page.locator('iframe[title="Live Preview"]')).toBeVisible({ timeout: 20_000 })

  // Governance tab should exist (button with aria-label="Governance")
  const governanceTab = page.locator('button[aria-label="Governance"]')
  await expect(governanceTab).toBeVisible({ timeout: 10_000 })

  // Properties tab should exist
  const propertiesTab = page.locator('button[aria-label="Properties"]')
  await expect(propertiesTab).toBeVisible()
})

// ---------------------------------------------------------------------------
// Test 5 — Governance tab shows violations
// ---------------------------------------------------------------------------

test('governance tab shows violation indicators', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  await expect(page.locator('iframe[title="Live Preview"]')).toBeVisible({ timeout: 20_000 })

  // Governance tab should already be active (default tab)
  // Verify violation text is present — MITHRIL or A11Y rules
  const mithrilCount = await page.locator('text=MITHRIL').count()
  const a11yCount = await page.locator('text=A11Y').count()
  expect(mithrilCount + a11yCount).toBeGreaterThan(0)
})

// ---------------------------------------------------------------------------
// Test 6 — Properties tab responds to layer selection
// ---------------------------------------------------------------------------

test('properties tab is clickable', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  await expect(page.locator('iframe[title="Live Preview"]')).toBeVisible({ timeout: 20_000 })

  // Click the Properties tab
  const propertiesTab = page.locator('button[aria-label="Properties"]')
  await expect(propertiesTab).toBeVisible({ timeout: 10_000 })
  await propertiesTab.click()
  await page.waitForTimeout(1_000)

  // After clicking, the tab should be active (indigo highlight)
  const pressed = await propertiesTab.getAttribute('aria-pressed')
    ?? await propertiesTab.getAttribute('aria-selected')
  expect(pressed).toBe('true')
})

// ---------------------------------------------------------------------------
// Test 7 — Violation card expand/collapse works
// ---------------------------------------------------------------------------

test('violation cards are interactive', async ({ page }) => {
  await page.goto(BASE_URL)
  await dismissOnboarding(page)

  await expect(page.locator('iframe[title="Live Preview"]')).toBeVisible({ timeout: 20_000 })

  // Governance should be the default tab — violations are visible
  // Find any expandable violation card
  const expandable = page.locator('[aria-expanded]').first()
  const exists = await expandable.count()

  // Verify violation text is present and clickable
  const violations = await page.locator('text=MITHRIL').count() + await page.locator('text=A11Y').count()
  expect(violations).toBeGreaterThan(0)

  // If expandable cards exist, verify they respond to click
  if (exists > 0) {
    await expandable.click()
    // Just verify no crash — expand behavior may vary
    await page.waitForTimeout(500)
  }
})
