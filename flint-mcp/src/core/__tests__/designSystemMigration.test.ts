/**
 * Tests for EXP.5: Design System Version Migration
 * flint-mcp/src/core/__tests__/designSystemMigration.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    computeTokenDiff,
    migrateFiles,
    generateMigrationReport,
    type TokenMigrationPlan,
} from '../designSystemMigration.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-migration-'))
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeJSON(name: string, data: unknown): string {
    const fp = path.join(tmpDir, name)
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8')
    return fp
}

function writeTSX(name: string, content: string): string {
    const fp = path.join(tmpDir, name)
    fs.writeFileSync(fp, content, 'utf-8')
    return fp
}

// ---------------------------------------------------------------------------
// Token diff tests
// ---------------------------------------------------------------------------

describe('computeTokenDiff', () => {
    it('detects renamed tokens (same value, different path)', () => {
        const oldPath = writeJSON('old.json', {
            colors: { primary: { $value: '#FF0000', $type: 'color' } },
        })
        const newPath = writeJSON('new.json', {
            colors: { brand: { $value: '#FF0000', $type: 'color' } },
        })
        const plan = computeTokenDiff(oldPath, newPath)
        expect(plan.renamed).toHaveLength(1)
        expect(plan.renamed[0].oldPath).toBe('colors.primary')
        expect(plan.renamed[0].newPath).toBe('colors.brand')
        expect(plan.renamed[0].value).toBe('#FF0000')
    })

    it('detects removed tokens', () => {
        const oldPath = writeJSON('old.json', {
            colors: {
                primary: { $value: '#FF0000', $type: 'color' },
                secondary: { $value: '#00FF00', $type: 'color' },
            },
        })
        const newPath = writeJSON('new.json', {
            colors: { primary: { $value: '#FF0000', $type: 'color' } },
        })
        const plan = computeTokenDiff(oldPath, newPath)
        expect(plan.removed).toHaveLength(1)
        expect(plan.removed[0].path).toBe('colors.secondary')
    })

    it('detects changed tokens with ΔE for colors', () => {
        const oldPath = writeJSON('old.json', {
            colors: { primary: { $value: '#FF0000', $type: 'color' } },
        })
        const newPath = writeJSON('new.json', {
            colors: { primary: { $value: '#FF5500', $type: 'color' } },
        })
        const plan = computeTokenDiff(oldPath, newPath)
        expect(plan.changed).toHaveLength(1)
        expect(plan.changed[0].path).toBe('colors.primary')
        expect(plan.changed[0].oldValue).toBe('#FF0000')
        expect(plan.changed[0].newValue).toBe('#FF5500')
        expect(plan.changed[0].deltaE).toBeTypeOf('number')
        expect(plan.changed[0].deltaE!).toBeGreaterThan(0)
    })

    it('detects added tokens', () => {
        const oldPath = writeJSON('old.json', {
            colors: { primary: { $value: '#FF0000', $type: 'color' } },
        })
        const newPath = writeJSON('new.json', {
            colors: {
                primary: { $value: '#FF0000', $type: 'color' },
                accent: { $value: '#0000FF', $type: 'color' },
            },
        })
        const plan = computeTokenDiff(oldPath, newPath)
        expect(plan.added).toHaveLength(1)
        expect(plan.added[0].path).toBe('colors.accent')
    })

    it('changed non-color tokens have null ΔE', () => {
        const oldPath = writeJSON('old.json', {
            spacing: { sm: { $value: '4px', $type: 'dimension' } },
        })
        const newPath = writeJSON('new.json', {
            spacing: { sm: { $value: '8px', $type: 'dimension' } },
        })
        const plan = computeTokenDiff(oldPath, newPath)
        expect(plan.changed).toHaveLength(1)
        expect(plan.changed[0].deltaE).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Migration tests
// ---------------------------------------------------------------------------

describe('migrateFiles', () => {
    it('replaces renamed tokens in className', () => {
        const plan: TokenMigrationPlan = {
            renamed: [{ oldPath: 'colors.primary', newPath: 'colors.brand', value: '#FF0000' }],
            removed: [],
            changed: [],
            added: [],
        }
        const fp = writeTSX('Button.tsx', `
export const Button = () => <div className="primary-500 p-4">Hello</div>;
`)
        // "primary" segment should match renamed token class segment
        // tokenPathToClassSegment("colors.primary") = "primary"
        // But the class is "primary-500" which includes "primary"
        const planWithSegment: TokenMigrationPlan = {
            renamed: [{ oldPath: 'colors.primary', newPath: 'colors.brand', value: '#FF0000' }],
            removed: [],
            changed: [],
            added: [],
        }
        const results = migrateFiles(planWithSegment, [fp])
        expect(results).toHaveLength(1)
        const renamedChanges = results[0].changes.filter(c => c.type === 'renamed')
        expect(renamedChanges.length).toBeGreaterThanOrEqual(1)
        expect(renamedChanges[0].tokenOld).toBe('primary-500')
        expect(renamedChanges[0].tokenNew).toBe('brand-500')
    })

    it('flags removed tokens as warnings without auto-fix', () => {
        const plan: TokenMigrationPlan = {
            renamed: [],
            removed: [{ path: 'colors.danger', type: 'color', value: '#FF0000' }],
            changed: [],
            added: [],
        }
        const fp = writeTSX('Alert.tsx', `
export const Alert = () => <div className="danger p-2">Warning</div>;
`)
        const results = migrateFiles(plan, [fp])
        expect(results[0].warnings.length).toBeGreaterThanOrEqual(1)
        expect(results[0].warnings[0]).toContain('removed token')
        expect(results[0].changes.some(c => c.type === 'removed')).toBe(true)
    })

    it('dry-run returns changes without modifying file', () => {
        const plan: TokenMigrationPlan = {
            renamed: [{ oldPath: 'colors.primary', newPath: 'colors.brand', value: '#FF0000' }],
            removed: [],
            changed: [],
            added: [],
        }
        const content = `export const X = () => <div className="primary">Hi</div>;`
        const fp = writeTSX('Comp.tsx', content)
        migrateFiles(plan, [fp], { dryRun: true })
        const after = fs.readFileSync(fp, 'utf-8')
        expect(after).toBe(content)
    })

    it('color changes include ΔE in warnings', () => {
        const plan: TokenMigrationPlan = {
            renamed: [],
            removed: [],
            changed: [{ path: 'colors.primary', oldValue: '#FF0000', newValue: '#FF5500', deltaE: 15.3 }],
            added: [],
        }
        const fp = writeTSX('Card.tsx', `
export const Card = () => <div className="primary text-white">Card</div>;
`)
        const results = migrateFiles(plan, [fp])
        expect(results[0].warnings.some(w => w.includes('ΔE=15.3'))).toBe(true)
    })

    it('empty migration plan produces no changes', () => {
        const plan: TokenMigrationPlan = {
            renamed: [],
            removed: [],
            changed: [],
            added: [],
        }
        const fp = writeTSX('Empty.tsx', `
export const Empty = () => <div className="p-4 m-2">Nothing</div>;
`)
        const results = migrateFiles(plan, [fp])
        expect(results[0].changes).toHaveLength(0)
        expect(results[0].warnings).toHaveLength(0)
    })

    it('handles template literal classNames', () => {
        const plan: TokenMigrationPlan = {
            renamed: [{ oldPath: 'colors.old-bg', newPath: 'colors.new-bg', value: '#000' }],
            removed: [],
            changed: [],
            added: [],
        }
        const fp = writeTSX('Dynamic.tsx', `
export const Dynamic = ({ active }: { active: boolean }) => (
  <div className={\`old-bg \${active ? 'p-4' : 'p-2'}\`}>Hi</div>
);
`)
        const results = migrateFiles(plan, [fp])
        const renamedChanges = results[0].changes.filter(c => c.type === 'renamed')
        expect(renamedChanges.length).toBeGreaterThanOrEqual(1)
    })
})

// ---------------------------------------------------------------------------
// Report generation tests
// ---------------------------------------------------------------------------

describe('generateMigrationReport', () => {
    it('produces markdown with correct sections', () => {
        const plan: TokenMigrationPlan = {
            renamed: [{ oldPath: 'colors.primary', newPath: 'colors.brand', value: '#FF0000' }],
            removed: [{ path: 'colors.danger', type: 'color', value: '#CC0000' }],
            changed: [{ path: 'colors.accent', oldValue: '#0000FF', newValue: '#0033FF', deltaE: 5.2 }],
            added: [{ path: 'colors.surface', type: 'color', value: '#FFFFFF' }],
        }
        const results = [
            {
                filePath: '/tmp/test.tsx',
                changes: [{ tokenOld: 'primary', tokenNew: 'brand', line: 5, type: 'renamed' as const }],
                warnings: ['Line 10: removed token used'],
            },
        ]
        const report = generateMigrationReport(plan, results)
        expect(report).toContain('# Design System Migration Report')
        expect(report).toContain('Renamed')
        expect(report).toContain('Removed')
        expect(report).toContain('Changed')
        expect(report).toContain('Added')
        expect(report).toContain('ΔE')
        expect(report).toContain('5.2')
        expect(report).toContain('/tmp/test.tsx')
    })

    it('handles empty results', () => {
        const plan: TokenMigrationPlan = { renamed: [], removed: [], changed: [], added: [] }
        const report = generateMigrationReport(plan, [])
        expect(report).toContain('Files scanned:** 0')
        expect(report).toContain('Total changes:** 0')
    })
})
