import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for Flint demo validation.
 *
 * demo-smoke — Node.js tests that call the MCP audit engine directly.
 *   Validates that the demo fixtures produce the exact violation counts
 *   the script claims. Run this before any live demo.
 *
 *   npm run test:demo
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  reporter: [
    ['html', { outputFolder: 'tests/demo/playwright-report', open: 'never' }],
    ['line'],
  ],
  projects: [
    {
      name: 'demo-smoke',
      testMatch: 'tests/demo/**/*.spec.ts',
    },
  ],
})
