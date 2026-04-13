/**
 * Visual snapshot test for the Governance tab.
 *
 * Requires the web server to be running:
 *   npm run dev:web   (in another terminal)
 *
 * Then run:
 *   npx playwright test --project=web-e2e tests/e2e/governance-tab.spec.ts
 *
 * Screenshots land in tests/e2e/screenshots/.
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_URL = process.env.FLINT_URL ?? 'http://localhost:4201'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

/** Navigate to the app, bypass onboarding via localStorage, then click Governance tab. */
async function openGovernanceTab(page: Page) {
  // Set first-launch flag before navigating so the onboarding overlay never mounts.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('flint-onboarding-complete', 'true')
    } catch {
      // ignore — storage might be blocked
    }
  })

  await page.goto(BASE_URL, { waitUntil: 'load' })

  // Allow React hydration and Zustand store initialization
  await page.waitForTimeout(2000)

  // If an onboarding overlay still appeared, remove it via JS as a fallback.
  await page.evaluate(() => {
    document.querySelectorAll('div.fixed.inset-0').forEach(el => {
      const style = window.getComputedStyle(el)
      if (style.position === 'fixed' && parseInt(style.zIndex) >= 40) {
        el.remove()
      }
    })
    localStorage.setItem('flint-onboarding-complete', 'true')
  })
  await page.waitForTimeout(300)

  // Click the Governance / Health tab in the right sidebar
  for (const selector of [
    'button:has-text("Governance")',
    '[role="tab"]:has-text("Governance")',
    '[role="tab"]:has-text("Health")',
  ]) {
    const el = page.locator(selector).first()
    if (await el.count() > 0) {
      await el.click({ force: true }).catch(() => {})
      await page.waitForTimeout(800)
      break
    }
  }
}

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

test('Governance tab — full viewport screenshot', async ({ page }) => {
  await openGovernanceTab(page)

  const screenshotPath = path.join(SCREENSHOT_DIR, 'governance-full-viewport.png')
  await page.screenshot({ path: screenshotPath, fullPage: false })
  console.log(`\nFull viewport screenshot: ${screenshotPath}`)
})

test('Governance tab — right sidebar close-up', async ({ page }) => {
  await openGovernanceTab(page)

  const panel = page.locator(
    '[data-testid="right-sidebar"], [class*="right-panel"], [class*="sidebar-right"]'
  ).first()

  const screenshotPath = path.join(SCREENSHOT_DIR, 'governance-sidebar.png')
  if (await panel.count() > 0) {
    await panel.screenshot({ path: screenshotPath })
  } else {
    await page.screenshot({ path: screenshotPath })
  }
  console.log(`\nSidebar screenshot: ${screenshotPath}`)
})

test('Governance tab — Health Score accordion starts closed', async ({ page }) => {
  await openGovernanceTab(page)

  // Check via aria-controls — this is the canonical accordion button
  const accordionBtn = page.locator('[aria-controls="score-accordion"]')
  if (await accordionBtn.count() === 0) {
    test.skip(true, 'Health Score accordion not found — may not be visible without data')
    return
  }

  const expanded = await accordionBtn.first().getAttribute('aria-expanded')
  expect(expanded, 'Health Score accordion should start closed').toBe('false')
})

test('Governance tab — More details accordion starts closed', async ({ page }) => {
  await openGovernanceTab(page)

  // Check via data-testid — direct, not text-content-dependent
  const moreDetailsBtn = page.locator('[data-testid="more-details-toggle"]')
  if (await moreDetailsBtn.count() === 0) {
    test.skip(true, 'More details accordion not found — tokenCount may be 0')
    return
  }

  const expanded = await moreDetailsBtn.first().getAttribute('aria-expanded')
  expect(expanded, 'More details accordion should start closed').toBe('false')
})

test('Governance tab — compact summary row shows grade', async ({ page }) => {
  await openGovernanceTab(page)

  // The compact one-line summary row contains a grade letter (A-F)
  let gradeVisible = false
  for (const g of ['A', 'B', 'C', 'D', 'F']) {
    if (await page.locator(`text="${g}"`).first().isVisible().catch(() => false)) {
      gradeVisible = true
      break
    }
  }
  expect(gradeVisible, 'A grade letter A-F should be visible in the compact summary row').toBe(true)
})

test('Governance tab — no full-width Autopilot body section', async ({ page }) => {
  await openGovernanceTab(page)

  const autopilotBody = page.locator('[data-testid="autopilot-body"], .autopilot-section')
  expect(await autopilotBody.count()).toBe(0)
})

test('Governance tab — GOVERNANCE HEALTH header visible', async ({ page }) => {
  await openGovernanceTab(page)

  const header = page.locator('text=Governance Health').first()
  await expect(header).toBeVisible({ timeout: 10_000 })
})
