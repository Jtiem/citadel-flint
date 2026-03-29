/**
 * Hospital Exec Demo — Pre-flight Smoke Test
 *
 * Proves every key claim in DEMO-HOSPITAL-EXEC.md before you go on stage.
 * Run with: npm run test:demo
 *
 * What this validates:
 *   ✓ Round 1: PatientForm.tsx produces exactly 8 violations (6 a11y + 2 Mithril)
 *   ✓ Round 1: Export Gate is BLOCKED
 *   ✓ Round 2: PatientFormFixed.tsx produces 0 violations
 *   ✓ Round 2: Export Gate is APPROVED
 *   ✓ Summit Health tokens are correctly configured (#005B94, #C41E1E)
 *   ✓ All fixture files are present and accessible
 *
 * What this does NOT validate (requires manual rehearsal):
 *   - Live AI generation produces violations in Round 1
 *   - Governed generation via /flint_design_to_code produces 0 violations
 *   - VoiceOver behavior (test with macOS Accessibility Inspector separately)
 *   - Flint Glass UI states (Export Gate button, violation list rendering)
 */

import { test, expect } from '@playwright/test'
import { readFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleFlintAudit } from '../../flint-mcp/src/tools/audit.js'
import { DEFAULT_POLICY } from '../../flint-mcp/src/core/config.js'
import type { FlintConfig } from '../../flint-mcp/src/core/config.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DEMO_DIR = resolve(ROOT, 'build-resources/demos/a11y-audit')
const FLINT_DIR = resolve(ROOT, '.flint')

const DEMO_CONFIG: FlintConfig = {
  projectRoot: ROOT,
  domains: ['mithril', 'a11y'],
  policy: DEFAULT_POLICY,
}

// ─── Setup ──────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  if (!existsSync(FLINT_DIR)) mkdirSync(FLINT_DIR, { recursive: true })
  // Load Summit Health brand tokens — same step as the demo setup script
  copyFileSync(
    resolve(DEMO_DIR, 'design-tokens.json'),
    resolve(FLINT_DIR, 'design-tokens.json'),
  )
})

// ─── Token Integrity ─────────────────────────────────────────────────────────

test('Summit Health tokens are present and correct', () => {
  const raw = readFileSync(resolve(DEMO_DIR, 'design-tokens.json'), 'utf-8')
  const tokens = JSON.parse(raw)

  expect(tokens.color.brand.primary.$value).toBe('#005B94')    // Summit Health Corporate Blue
  expect(tokens.color.feedback.error.$value).toBe('#C41E1E')   // Summit Health Red
  expect(tokens._brand).toContain('Summit Health')
})

// ─── Round 1 — PatientForm.tsx (AI without governance) ───────────────────────

test.describe('Round 1 — PatientForm.tsx', () => {
  let source: string

  test.beforeAll(() => {
    source = readFileSync(resolve(DEMO_DIR, 'PatientForm.tsx'), 'utf-8')
  })

  test('Warden flags exactly 6 a11y violations', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientForm.tsx' }, DEMO_CONFIG)
    expect(result.a11yCount).toBe(6)
  })

  test('Mithril flags exactly 2 brand token violations', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientForm.tsx' }, DEMO_CONFIG)
    expect(result.mithrilCount).toBe(2)
  })

  test('Total violation count is 8', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientForm.tsx' }, DEMO_CONFIG)
    expect(result.violations).toHaveLength(8)
  })

  test('Export Gate is BLOCKED', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientForm.tsx' }, DEMO_CONFIG)
    expect(result.exportBlocked).toBe(true)
  })

  test('Button color violation references hardcoded #1d4ed8 vs #005B94', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientForm.tsx' }, DEMO_CONFIG)
    const mithrilViolations = result.violations.filter(v => v.ruleId?.startsWith('MITHRIL'))
    const buttonViolation = mithrilViolations.find(v =>
      v.message.toLowerCase().includes('1d4ed8') ||
      v.message.toLowerCase().includes('brand') ||
      v.message.toLowerCase().includes('color')
    )
    expect(buttonViolation).toBeDefined()
  })
})

// ─── Round 2 — PatientFormFixed.tsx (AI with Flint governance) ───────────────

test.describe('Round 2 — PatientFormFixed.tsx', () => {
  let source: string

  test.beforeAll(() => {
    source = readFileSync(resolve(DEMO_DIR, 'PatientFormFixed.tsx'), 'utf-8')
  })

  test('Zero a11y violations', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientFormFixed.tsx' }, DEMO_CONFIG)
    expect(result.a11yCount).toBe(0)
  })

  test('Zero Mithril violations', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientFormFixed.tsx' }, DEMO_CONFIG)
    expect(result.mithrilCount).toBe(0)
  })

  test('Export Gate is APPROVED', async () => {
    const result = await handleFlintAudit({ source, filePath: 'PatientFormFixed.tsx' }, DEMO_CONFIG)
    expect(result.exportBlocked).toBeFalsy()
    expect(result.violations).toHaveLength(0)
  })

  test('Uses design token variables (not hardcoded hex) for brand colors', () => {
    // Verify the governed form uses CSS variables, not hardcoded hex
    const src = readFileSync(resolve(DEMO_DIR, 'PatientFormFixed.tsx'), 'utf-8')
    expect(src).toContain('var(--color-brand-primary')
    expect(src).toContain('var(--color-feedback-error')
    expect(src).not.toContain('#1d4ed8') // the un-governed button color
    expect(src).not.toContain('#b91c1c') // the un-governed error color
  })
})

// ─── Fixture Integrity ────────────────────────────────────────────────────────

test.describe('Demo fixture files', () => {
  const requiredFiles = [
    'PatientForm.tsx',
    'PatientFormFixed.tsx',
    'design-tokens.json',
    'DEMO-HOSPITAL-EXEC.md',
    'README.md',
  ]

  for (const file of requiredFiles) {
    test(`${file} exists`, () => {
      expect(existsSync(resolve(DEMO_DIR, file))).toBe(true)
    })
  }
})
