import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Flint demo validation and visual e2e tests.
 *
 * demo-smoke — Node.js tests that call the MCP audit engine directly.
 *   npm run test:demo
 *
 * web-e2e — Browser tests against the live web server.
 *   Start the server first:  npm run dev:web
 *   Then run:               npx playwright test --project=web-e2e
 *
 *   Or let playwright start it automatically (slower cold start):
 *   npx playwright test --project=web-e2e  (webServer block handles it)
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // globalSetup: './tests/e2e/global-setup.ts',
  workers: 1, // E2E tests share a single server — sequential only
  reporter: [
    ['html', { outputFolder: 'tests/playwright-report', open: 'never' }],
    ['line'],
  ],

  use: {
    baseURL: process.env.FLINT_URL ?? 'http://localhost:4201',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'demo-smoke',
      testMatch: 'tests/demo/**/*.spec.ts',
    },
    {
      name: 'web-e2e',
      testMatch: 'tests/e2e/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      // Sequential execution — tests share a single web server and
      // write to the same demo project directory, so parallelism
      // causes state interference between tests.
      fullyParallel: false,
    },
  ],

  // Auto-start the web server when running web-e2e if nothing is already listening.
  // Comment this out and run `npm run dev:web` manually for faster iteration.
  webServer: {
    command: 'npx tsx server/cli.ts --no-open --demo',
    url: 'http://localhost:4201',
    reuseExistingServer: true,   // if already running, skip startup
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
