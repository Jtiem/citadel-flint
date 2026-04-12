/**
 * Dark Mode Safety Tests — flint-mcp/src/core/__tests__/darkModeSafety.test.ts
 *
 * P1d: Tests for the Dark Mode Safety Checker visitor.
 *
 * Test inventory:
 *   1.  bg-gray-900 without dark: sibling → flags MITHRIL-DARK-001
 *   2.  bg-white dark:bg-gray-900 → no flag (has dark variant)
 *   3.  Semantic token (with modes.dark) → no flag
 *   4.  No dark mode tokens in set → visitor skips entirely
 *   5.  text-gray-900 without dark: variant → flags
 *   6.  border-gray-300 without dark: variant → flags
 *   7.  Arbitrary value bg-[#fff] without dark: → flags
 *   8.  Policy requiresDarkMode false → advisory severity
 *   9.  Policy requiresDarkMode true → blocking severity (critical)
 *  10.  Multiple color utilities, mixed compliance → correct per-property flagging
 *  11.  projectHasDarkMode returns true for tokens with mode='dark'
 *  12.  projectHasDarkMode returns true for tokens with modes.dark field
 *  13.  projectHasDarkMode returns false for light-only tokens
 *  14.  Rule mode 'off' → no warnings
 *  15.  auditAll integration — dark mode warnings appear in merged results
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    visitDarkModeSafety,
    projectHasDarkMode,
    type DesignTokenWithModes,
} from '../darkModeSafety.js'
import { auditAll } from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

/** Light-only token set — no dark mode support at all. */
const LIGHT_ONLY_TOKENS: DesignToken[] = [
    { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#0066FF', description: null, collection_name: 'default', mode: 'default' },
    { id: 2, token_path: 'color.surface', token_type: 'color', token_value: '#FFFFFF', description: null, collection_name: 'default', mode: 'default' },
]

/** Token set with dark mode support via mode field. */
const DARK_MODE_TOKENS: DesignToken[] = [
    { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#0066FF', description: null, collection_name: 'default', mode: 'default' },
    { id: 2, token_path: 'color.surface', token_type: 'color', token_value: '#FFFFFF', description: null, collection_name: 'default', mode: 'default' },
    { id: 3, token_path: 'color.surface', token_type: 'color', token_value: '#0F0F0F', description: null, collection_name: 'default', mode: 'dark' },
    { id: 4, token_path: 'color.on-surface', token_type: 'color', token_value: '#111827', description: null, collection_name: 'default', mode: 'default' },
    { id: 5, token_path: 'color.on-surface', token_type: 'color', token_value: '#F9FAFB', description: null, collection_name: 'default', mode: 'dark' },
]

/** Token set with dark mode support via extended modes field. */
const DARK_MODE_TOKENS_EXTENDED: (DesignToken & { modes?: Record<string, string> })[] = [
    { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#0066FF', description: null, collection_name: 'default', mode: 'default', modes: { dark: '#3388FF' } },
    { id: 2, token_path: 'color.surface', token_type: 'color', token_value: '#FFFFFF', description: null, collection_name: 'default', mode: 'default', modes: { dark: '#0F0F0F' } },
    { id: 3, token_path: 'color.on-surface', token_type: 'color', token_value: '#111827', description: null, collection_name: 'default', mode: 'default', modes: { dark: '#F9FAFB' } },
]

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('projectHasDarkMode', () => {
    it('returns false for light-only tokens', () => {
        expect(projectHasDarkMode(LIGHT_ONLY_TOKENS)).toBe(false)
    })

    it('returns true for tokens with mode="dark"', () => {
        expect(projectHasDarkMode(DARK_MODE_TOKENS)).toBe(true)
    })

    it('returns true for tokens with modes.dark field', () => {
        expect(projectHasDarkMode(DARK_MODE_TOKENS_EXTENDED as DesignToken[])).toBe(true)
    })

    it('returns true for tokens with /dark/ in path', () => {
        const tokens: DesignToken[] = [
            { id: 1, token_path: 'color.dark.surface', token_type: 'color', token_value: '#0F0F0F', description: null, collection_name: 'default', mode: 'default' },
        ]
        expect(projectHasDarkMode(tokens)).toBe(true)
    })
})

describe('visitDarkModeSafety', () => {
    // Test 1: bg-gray-900 without dark: sibling → flags MITHRIL-DARK-001
    it('flags bg-gray-900 without dark: sibling', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900 p-4" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-DARK-001')
        expect(w.message).toContain('bg-gray-900')
    })

    // Test 2: bg-white dark:bg-gray-900 → no flag (has dark variant)
    it('does not flag when dark: variant exists for same property', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-white dark:bg-gray-900" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(0)
    })

    // Test 3: Semantic token with modes.dark → no flag
    it('does not flag semantic token with dark mode support', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-surface" />
            )
        `)
        // The color part "surface" matches token_path "color.surface" which has modes.dark
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS_EXTENDED as DesignToken[])
        expect(warnings.size).toBe(0)
    })

    // Test 4: No dark mode tokens → visitor skips entirely
    it('skips entirely when no dark mode tokens exist', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900 text-white" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, LIGHT_ONLY_TOKENS)
        expect(warnings.size).toBe(0)
    })

    // Test 5: text-gray-900 without dark: variant → flags
    it('flags text-gray-900 without dark: variant', () => {
        const ast = parseJSX(`
            const App = () => (
                <p data-flint-id="n1" className="text-gray-900" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-DARK-001')
        expect(w.message).toContain('text-gray-900')
    })

    // Test 6: border-gray-300 without dark: variant → flags
    it('flags border-gray-300 without dark: variant', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="border border-gray-300" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.message).toContain('border-gray-300')
    })

    // Test 7: Arbitrary value bg-[#fff] without dark: → flags
    it('flags arbitrary value bg-[#fff] without dark: variant', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-[#fff]" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.message).toContain('bg-[#fff]')
    })

    // Test 8: Policy requiresDarkMode false → advisory severity
    it('uses advisory severity when requiresDarkMode is false', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS, { requiresDarkMode: false })
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.severity).toBe('advisory')
    })

    // Test 9: Policy requiresDarkMode true → blocking severity (critical)
    it('uses critical severity when requiresDarkMode is true', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS, { requiresDarkMode: true })
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.severity).toBe('critical')
    })

    // Test 10: Multiple color utilities, mixed compliance → correct per-property flagging
    it('flags per-property with mixed compliance', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-white dark:bg-gray-900 text-gray-900 border-gray-200" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        // bg is covered (has dark: variant), text and border are not
        expect(warnings.size).toBe(2)
        const ids = [...warnings.keys()]
        expect(ids).toContain('dark-n1-text')
        expect(ids).toContain('dark-n1-border')
        // bg should NOT be flagged
        expect(ids.find(id => id === 'dark-n1-bg')).toBeUndefined()
    })

    // Test 11: Rule mode 'off' → no warnings
    it('produces no warnings when rule mode is off', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900 text-white" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS, {
            ruleModes: { 'MITHRIL-DARK-001': 'off' },
        })
        expect(warnings.size).toBe(0)
    })

    // Test 12: Rule mode 'advisory' downgrades severity even when requiresDarkMode is true
    it('advisory rule mode downgrades severity regardless of requiresDarkMode', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS, {
            requiresDarkMode: true,
            ruleModes: { 'MITHRIL-DARK-001': 'advisory' },
        })
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.severity).toBe('advisory')
    })

    // Test 13: Node without data-flint-id is skipped
    it('skips nodes without data-flint-id', () => {
        const ast = parseJSX(`
            const App = () => (
                <div className="bg-gray-900 text-white" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(0)
    })

    // Test 14: Non-color classes are not flagged
    it('does not flag non-color utility classes', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="p-4 flex items-center rounded-lg" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        expect(warnings.size).toBe(0)
    })

    // Test 15: hover: prefixed color without dark: is still flagged (only dark: exempts)
    it('flags hover-prefixed color without dark: variant', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900 hover:bg-gray-800" />
            )
        `)
        const warnings = visitDarkModeSafety(ast, DARK_MODE_TOKENS)
        // bg-gray-900 is base (no dark:), hover:bg-gray-800 is not base → only bg-gray-900 flagged
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.message).toContain('bg-gray-900')
    })
})

describe('auditAll integration — dark mode', () => {
    it('includes dark mode warnings in merged results', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900 text-white" />
            )
        `)
        const allWarnings = auditAll(ast, DARK_MODE_TOKENS)
        const darkWarnings = [...allWarnings.values()].filter(
            w => w.ruleId === 'MITHRIL-DARK-001',
        )
        expect(darkWarnings.length).toBeGreaterThan(0)
    })

    it('does not include dark mode warnings for light-only projects', () => {
        const ast = parseJSX(`
            const App = () => (
                <div data-flint-id="n1" className="bg-gray-900 text-white" />
            )
        `)
        const allWarnings = auditAll(ast, LIGHT_ONLY_TOKENS)
        const darkWarnings = [...allWarnings.values()].filter(
            w => w.ruleId === 'MITHRIL-DARK-001',
        )
        expect(darkWarnings.length).toBe(0)
    })
})
