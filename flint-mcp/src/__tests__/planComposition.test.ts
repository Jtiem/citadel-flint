/**
 * planComposition.test.ts — CK.2
 *
 * Tests for the component-composition intent type added to planService.ts.
 *
 * Coverage:
 *   - Intent classification (3 positive cases)
 *   - Template structure (6 steps)
 *   - suggestedComponents population from manifest
 *   - Graceful fallback when no manifest exists
 *   - Regression guard for existing 3 intent types
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    classifyIntent,
    generatePlan,
} from '../../src/core/planService.js'
import type { ToolStep, DecisionStep } from '../../src/core/planService.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-composition-test-'))
}

function setupManifest(dir: string, components: Record<string, object>): void {
    fs.writeFileSync(
        path.join(dir, 'flint-manifest.json'),
        JSON.stringify({ components }),
    )
}

// ── Intent Classification ─────────────────────────────────────────────────────

describe('classifyIntent — component-composition (CK2-01 to CK2-03)', () => {
    it('CK2-01: classifies "Build a login form with email and password" as component-composition', () => {
        const result = classifyIntent('Build a login form with email and password')
        expect(result.type).toBe('component-composition')
    })

    it('CK2-02: classifies "Create a card component with title and body" as component-composition', () => {
        const result = classifyIntent('Create a card component with title and body')
        expect(result.type).toBe('component-composition')
    })

    it('CK2-03: classifies "Make a navigation bar with links" as component-composition', () => {
        const result = classifyIntent('Make a navigation bar with links')
        expect(result.type).toBe('component-composition')
    })

    it('CK2-04: classifies "Compose a modal dialog with confirm and cancel buttons" as component-composition', () => {
        const result = classifyIntent('Compose a modal dialog with confirm and cancel buttons')
        expect(result.type).toBe('component-composition')
    })

    it('CK2-05: classifies "Scaffold a sidebar navigation component" as component-composition', () => {
        const result = classifyIntent('Scaffold a sidebar navigation component')
        expect(result.type).toBe('component-composition')
    })

    it('CK2-06: classifies "Design a header with logo and nav links" as component-composition', () => {
        const result = classifyIntent('Design a header with logo and nav links')
        expect(result.type).toBe('component-composition')
    })
})

// ── Template Structure ────────────────────────────────────────────────────────

describe('generatePlan — component-composition template (CK2-07 to CK2-10)', () => {
    it('CK2-07: component-composition template has exactly 6 steps', () => {
        const plan = generatePlan('Build a login form with email and password')
        expect(plan.intent.type).toBe('component-composition')
        expect(plan.steps).toHaveLength(6)
    })

    it('CK2-08: step 1 is a tool call to flint_query_registry', () => {
        const plan = generatePlan('Build a login form with email and password')
        const step1 = plan.steps[0] as ToolStep
        expect(step1.kind).toBe('tool')
        expect(step1.tool).toBe('flint_query_registry')
    })

    it('CK2-09: step 2 is a decision (component selection)', () => {
        const plan = generatePlan('Build a login form with email and password')
        const step2 = plan.steps[1] as DecisionStep
        expect(step2.kind).toBe('decision')
        expect(Array.isArray(step2.suggestedOptions)).toBe(true)
        expect(step2.suggestedOptions.length).toBeGreaterThan(0)
    })

    it('CK2-10: step 4 is a tool call to flint_ast_mutate and step 5 calls audit_ui_component', () => {
        const plan = generatePlan('Build a signup form with username and email fields')
        const step4 = plan.steps[3] as ToolStep
        const step5 = plan.steps[4] as ToolStep
        expect(step4.kind).toBe('tool')
        expect(step4.tool).toBe('flint_ast_mutate')
        expect(step5.kind).toBe('tool')
        expect(step5.tool).toBe('audit_ui_component')
    })

    it('CK2-11: step 6 is a decision (review audit results)', () => {
        const plan = generatePlan('Build a login form with email and password')
        const step6 = plan.steps[5] as DecisionStep
        expect(step6.kind).toBe('decision')
        expect(step6.step).toBe(6)
    })

    it('CK2-12: riskLevel is "medium" for component-composition', () => {
        const plan = generatePlan('Create a card component with title and body')
        expect(plan.riskLevel).toBe('medium')
    })

    it('CK2-13: successCriteria contains 4 entries', () => {
        const plan = generatePlan('Build a form component')
        expect(plan.intent.type).toBe('component-composition')
        expect(plan.successCriteria).toHaveLength(4)
        expect(plan.successCriteria[0]).toMatch(/registry/i)
        expect(plan.successCriteria[1]).toMatch(/Mithril/i)
        expect(plan.successCriteria[2]).toMatch(/accessibility/i)
        expect(plan.successCriteria[3]).toMatch(/props/i)
    })

    it('CK2-14: step numbers are sequential 1-6', () => {
        const plan = generatePlan('Build a login form')
        plan.steps.forEach((step, idx) => {
            expect(step.step).toBe(idx + 1)
        })
    })
})

// ── suggestedComponents: populated from manifest ──────────────────────────────

describe('generatePlan — suggestedComponents from manifest (CK2-15 to CK2-18)', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('CK2-15: suggestedComponents is populated when manifest has matching components', () => {
        setupManifest(tmpDir, {
            LoginForm: {
                importPath: 'src/components/LoginForm.tsx',
                description: 'Email and password login form component',
            },
            EmailInput: {
                importPath: 'src/components/EmailInput.tsx',
                description: 'Email input field',
            },
            Button: {
                importPath: 'src/components/Button.tsx',
                description: 'Primary action button',
            },
        })

        const plan = generatePlan('Build a login form with email and password', {
            projectRoot: tmpDir,
        })

        expect(plan.intent.type).toBe('component-composition')
        expect(Array.isArray(plan.suggestedComponents)).toBe(true)
        expect((plan.suggestedComponents ?? []).length).toBeGreaterThan(0)
    })

    it('CK2-16: suggestedComponents contains names from registry (not paths)', () => {
        setupManifest(tmpDir, {
            SignupForm: {
                importPath: 'src/components/SignupForm.tsx',
                description: 'User registration signup form',
            },
        })

        const plan = generatePlan('Build a signup form', {
            projectRoot: tmpDir,
        })

        // Names should be strings (component names), not import paths
        const suggested = plan.suggestedComponents ?? []
        for (const name of suggested) {
            expect(typeof name).toBe('string')
            expect(name).not.toContain('src/')
        }
    })

    it('CK2-17: suggestedComponents capped at 5 results', () => {
        const manyComponents: Record<string, object> = {}
        for (let i = 1; i <= 20; i++) {
            manyComponents[`Form${i}`] = {
                importPath: `src/Form${i}.tsx`,
                description: `Form component number ${i}`,
            }
        }
        setupManifest(tmpDir, manyComponents)

        const plan = generatePlan('Build a form component', {
            projectRoot: tmpDir,
        })

        const suggested = plan.suggestedComponents ?? []
        expect(suggested.length).toBeLessThanOrEqual(5)
    })

    it('CK2-18: suggestedComponents from query_registry step reflects the intent text', () => {
        setupManifest(tmpDir, {
            NavigationBar: {
                importPath: 'src/components/NavigationBar.tsx',
                description: 'Top navigation bar with links and logo',
            },
            Sidebar: {
                importPath: 'src/components/Sidebar.tsx',
                description: 'Left sidebar navigation component',
            },
            LoginForm: {
                importPath: 'src/components/LoginForm.tsx',
                description: 'Login form with email and password',
            },
        })

        // Query specifically for navigation
        const navPlan = generatePlan('Make a navigation bar with links', {
            projectRoot: tmpDir,
        })

        // NavigationBar should score higher than LoginForm for nav intent
        const navSuggested = navPlan.suggestedComponents ?? []
        expect(navSuggested.length).toBeGreaterThan(0)
        // The navigation-related component should appear
        expect(navSuggested.some(n => n.toLowerCase().includes('navigation') || n.toLowerCase().includes('nav') || n.toLowerCase().includes('sidebar'))).toBe(true)
    })
})

// ── Graceful fallback: no manifest ───────────────────────────────────────────

describe('generatePlan — component-composition fallback (CK2-19 to CK2-21)', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('CK2-19: suggestedComponents is empty array when no manifest exists', () => {
        // tmpDir has no flint-manifest.json
        const plan = generatePlan('Build a login form with email and password', {
            projectRoot: tmpDir,
        })

        expect(plan.intent.type).toBe('component-composition')
        expect(Array.isArray(plan.suggestedComponents)).toBe(true)
        expect(plan.suggestedComponents).toHaveLength(0)
    })

    it('CK2-20: suggestedComponents is empty array when no projectRoot provided', () => {
        const plan = generatePlan('Build a login form with email and password')

        expect(plan.intent.type).toBe('component-composition')
        expect(Array.isArray(plan.suggestedComponents)).toBe(true)
        expect(plan.suggestedComponents).toHaveLength(0)
    })

    it('CK2-21: no throw when manifest has empty components object', () => {
        setupManifest(tmpDir, {})

        expect(() =>
            generatePlan('Build a card component', { projectRoot: tmpDir })
        ).not.toThrow()

        const plan = generatePlan('Build a card component', { projectRoot: tmpDir })
        expect(plan.suggestedComponents).toHaveLength(0)
    })
})

// ── Non-composition plans do not have suggestedComponents ────────────────────

describe('generatePlan — suggestedComponents absent for other intents (CK2-22)', () => {
    it('CK2-22: suggestedComponents is undefined for non-composition intent types', () => {
        const nonCompositionIntents = [
            'Migrate all hardcoded colors to design tokens',
            'Run an accessibility sweep on all components',
            'Audit the entire codebase for governance compliance',
            'Sync tokens from Figma',
            'Reduce design debt and improve health score',
        ]

        for (const intent of nonCompositionIntents) {
            const plan = generatePlan(intent)
            expect(plan.suggestedComponents).toBeUndefined()
        }
    })
})

// ── Placeholder substitution in component-composition ────────────────────────

describe('generatePlan — component-composition placeholder substitution (CK2-23 to CK2-24)', () => {
    it('CK2-23: no {{...}} placeholders survive in component-composition plan', () => {
        const plan = generatePlan('Build a login form with email and password', {
            glob: 'src/components/**/*.tsx',
            projectRoot: '/tmp/test-project',
        })

        const serialized = JSON.stringify(plan)
        expect(serialized).not.toContain('{{')
        expect(serialized).not.toContain('}}')
    })

    it('CK2-24: flint_query_registry step query param contains the actual intent text', () => {
        const intent = 'Build a signup form with username and email'
        const plan = generatePlan(intent)

        const step1 = plan.steps[0] as ToolStep
        expect(step1.tool).toBe('flint_query_registry')
        expect(step1.params.query).toBe(intent)
    })
})

// ── Regression: existing intent classifications unchanged ─────────────────────

describe('classifyIntent — regression guard (CK2-25 to CK2-27)', () => {
    it('CK2-25: "migrate tokens" still classifies as token-migration', () => {
        const result = classifyIntent('Migrate all hardcoded colors in src/components/ to design tokens')
        expect(result.type).toBe('token-migration')
    })

    it('CK2-26: "fix accessibility" still classifies as accessibility-sweep', () => {
        const result = classifyIntent('Run an accessibility sweep on all components')
        expect(result.type).toBe('accessibility-sweep')
    })

    it('CK2-27: "audit governance" still classifies as full-governance-audit', () => {
        const result = classifyIntent('Audit the entire codebase for governance compliance')
        expect(result.type).toBe('full-governance-audit')
    })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('generatePlan — component-composition edge cases (CK2-28 to CK2-30)', () => {
    it('CK2-28: dry_run=true works correctly for component-composition', () => {
        const plan = generatePlan('Build a login form', { dryRun: true })
        expect(plan.dryRun).toBe(true)
        expect(plan.intent.type).toBe('component-composition')
    })

    it('CK2-29: summary contains "Component Composition" label', () => {
        const plan = generatePlan('Build a signup form with email and password')
        expect(plan.summary).toContain('Component Composition')
    })

    it('CK2-30: component-composition classification is deterministic across multiple calls', () => {
        const intent = 'Build a card component with title and body'
        const result1 = classifyIntent(intent)
        const result2 = classifyIntent(intent)
        expect(result1.type).toBe(result2.type)
        expect(result1.type).toBe('component-composition')
    })
})
