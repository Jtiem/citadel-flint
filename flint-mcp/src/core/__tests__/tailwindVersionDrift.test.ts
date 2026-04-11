/**
 * P1c: Tailwind Version Drift Governance tests
 *
 * Tests for visitTailwindVersionDrift and its integration with auditAll.
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import { visitTailwindVersionDrift, auditAll, type PolicyOptions, type AuditAllOptions } from '../MithrilLinter.js'
import type { TailwindVersion } from '../tailwindVersionResolver.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJSX(source: string): File {
    return parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
    })
}

const V4_PROJECT: TailwindVersion = { major: 4, full: '4.1.0', source: 'package.json' }
const V3_PROJECT: TailwindVersion = { major: 3, full: '3.4.1', source: 'package.json' }

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('visitTailwindVersionDrift', () => {
    it('flags flex-grow as MITHRIL-TW-001 in a v4 project and suggests grow', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex flex-grow items-center" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        const entries = [...warnings.values()]
        expect(entries).toHaveLength(1)
        expect(entries[0].ruleId).toBe('MITHRIL-TW-001')
        expect(entries[0].message).toContain('flex-grow')
        expect(entries[0].message).toContain('grow')
        expect(entries[0].type).toBe('tailwind-version-drift')
        expect(entries[0].fixable).toBe(true)
    })

    it('does not flag grow in a v4 project (valid v4 class)', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex grow items-center" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        expect(warnings.size).toBe(0)
    })

    it('does not flag deprecated v3 classes in a v3 project (they are valid)', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex flex-grow bg-opacity-50 bg-gradient-to-r" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V3_PROJECT)
        expect(warnings.size).toBe(0)
    })

    it('merges bg-opacity-50 with sibling bg-blue-500 into fix suggestion bg-blue-500/50', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="bg-blue-500 bg-opacity-50 p-4" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        const entries = [...warnings.values()]
        expect(entries).toHaveLength(1)
        expect(entries[0].ruleId).toBe('MITHRIL-TW-001')
        expect(entries[0].message).toContain('bg-blue-500/50')
    })

    it('returns no violations when policy is set to off', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex-grow bg-opacity-50" />
            )
        `)
        const options: PolicyOptions = {
            ruleModes: {
                'MITHRIL-TW-001': 'off',
                'MITHRIL-TW-002': 'off',
            },
        }
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT, options)
        expect(warnings.size).toBe(0)
    })

    it('downgrades severity to advisory when policy is set to advisory', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex-grow" />
            )
        `)
        const options: PolicyOptions = {
            ruleModes: { 'MITHRIL-TW-001': 'advisory' },
        }
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT, options)
        const entries = [...warnings.values()]
        expect(entries).toHaveLength(1)
        expect(entries[0].severity).toBe('advisory')
    })

    it('flags multiple deprecated classes in one element', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex-grow flex-shrink overflow-ellipsis bg-gradient-to-r" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        const entries = [...warnings.values()]
        // flex-grow, flex-shrink, overflow-ellipsis, bg-gradient-to-r → 4 violations
        expect(entries).toHaveLength(4)
        expect(entries.every(e => e.ruleId === 'MITHRIL-TW-001')).toBe(true)
    })

    it('flags v4-only classes in a v3 project as MITHRIL-TW-002', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="grow shrink text-ellipsis" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V3_PROJECT)
        const entries = [...warnings.values()]
        // grow, shrink, text-ellipsis are all v4 replacements that don't exist in v3
        expect(entries).toHaveLength(3)
        expect(entries.every(e => e.ruleId === 'MITHRIL-TW-002')).toBe(true)
        expect(entries[0].message).toContain('v4-only')
    })

    it('skips elements without data-flint-id', () => {
        const ast = parseJSX(`
            const App = () => (
                <div className="flex-grow" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        expect(warnings.size).toBe(0)
    })

    it('returns empty map when tailwindVersion is null (via auditAll)', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex-grow" />
            )
        `)
        // auditAll without tailwindVersion should not produce TW warnings
        const options: AuditAllOptions = {}
        const merged = auditAll(ast, [], options)
        const twWarnings = [...merged.values()].filter(w => w.ruleId?.startsWith('MITHRIL-TW'))
        expect(twWarnings).toHaveLength(0)
    })

    it('integrates with auditAll when tailwindVersion is provided', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="flex-grow" />
            )
        `)
        const options: AuditAllOptions = { tailwindVersion: V4_PROJECT }
        const merged = auditAll(ast, [], options)
        const twWarnings = [...merged.values()].filter(w => w.ruleId === 'MITHRIL-TW-001')
        expect(twWarnings).toHaveLength(1)
    })

    it('handles gradient renames correctly in v4 project', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="bg-gradient-to-r from-blue-500 to-purple-500" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        const entries = [...warnings.values()]
        expect(entries).toHaveLength(1)
        expect(entries[0].message).toContain('bg-linear-to-r')
    })

    it('does not flag identity-transform classes (key === value in map)', () => {
        // sr-only maps to sr-only (identity) — should NOT be flagged
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="node-1" className="sr-only truncate" />
            )
        `)
        const warnings = visitTailwindVersionDrift(ast, V4_PROJECT)
        expect(warnings.size).toBe(0)
    })
})
