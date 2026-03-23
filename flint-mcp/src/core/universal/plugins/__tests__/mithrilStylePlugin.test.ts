/**
 * mithrilStylePlugin — Universal AST inline style governance tests
 * flint-mcp/src/core/universal/plugins/__tests__/mithrilStylePlugin.test.ts
 *
 * Test map:
 *   Group A — HTML static style attributes
 *     A1  — hardcoded hex color → MITHRIL-IST-COL violation
 *     A2  — hex color within ΔE threshold → no violation
 *     A3  — hardcoded fontSize (hyphenated) → MITHRIL-IST-TYP
 *     A4  — hardcoded marginTop → MITHRIL-IST-SPC
 *     A5  — marginTop: 0 → skipped
 *     A6  — no style attr → no violation
 *     A7  — style attr with only token-equivalent values → no violation
 *
 *   Group B — Vue :style binding (object literal)
 *     B1  — :style with quoted hex color → MITHRIL-IST-COL
 *     B2  — :style with dynamic ref (no quotes) → skipped
 *     B3  — :style with quoted spacing → MITHRIL-IST-SPC
 *
 *   Group C — No tokens → plugin is a no-op
 *     C1  — no tokens in config → no violation even with hardcoded values
 *
 *   Group D — Policy modes
 *     D1  — MITHRIL-IST-COL 'off' → no violation
 *     D2  — MITHRIL-IST-TYP 'advisory' → severity: 'warning' (mapped)
 *
 *   Group E — Integration with PluginRegistry (HTML audit)
 *     E1  — registry.audit on HTML with style attr → violation returned
 *     E2  — registry.audit on HTML without style attr → no violations from plugin
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PluginRegistry } from '../../registry.js'
import { HTMLAdapter } from '../../adapters/html-adapter.js'
import { createMithrilStylePlugin } from '../mithrilStylePlugin.js'
import { createNode, resetIdCounter } from '../../flintNode.js'
import type { LintContext } from '../../linterPlugin.js'
import type { DesignToken } from '../../../../types.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COLOR_TOKENS: DesignToken[] = [
    { id: 1, token_path: 'color.brand.primary', token_type: 'color', token_value: '#0066cc', description: null, collection_name: 'default', mode: 'default' },
    { id: 2, token_path: 'color.surface.base', token_type: 'color', token_value: '#ffffff', description: null, collection_name: 'default', mode: 'default' },
]

const DIMENSION_TOKENS: DesignToken[] = [
    { id: 10, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8', description: null, collection_name: 'default', mode: 'default' },
    { id: 11, token_path: 'type.size.sm', token_type: 'dimension', token_value: '14', description: null, collection_name: 'default', mode: 'default' },
]

const ALL_TOKENS = [...COLOR_TOKENS, ...DIMENSION_TOKENS]

function makeContext(tokens: DesignToken[], policyOptions?: object): LintContext {
    return {
        document: { root: createNode({ type: 'root', name: 'root' }), filePath: 'test.html', language: 'html', parseTimestamp: 0 },
        config: { tokens, ...(policyOptions ? { policyOptions } : {}) },
    }
}

beforeEach(() => resetIdCounter())

// ── Group A: HTML static style attributes ─────────────────────────────────────

describe('mithrilStylePlugin — HTML static style', () => {
    const plugin = createMithrilStylePlugin()
    const rule = plugin.rules[0]!

    it('A1: hex color not in token set → MITHRIL-IST-COL', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'color: #ff0000']]) })
        const ctx = makeContext(COLOR_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-COL')
        expect(result?.message).toContain('#ff0000')
    })

    it('A2: hex color within ΔE threshold → no violation', () => {
        // #ffffff is color.surface.base
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'color: #ffffff']]) })
        const ctx = makeContext(COLOR_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).toBeNull()
    })

    it('A3: hardcoded font-size (hyphenated CSS) → MITHRIL-IST-TYP', () => {
        // 20px is NOT in dimension tokens (only 14 and 8 are)
        const node = createNode({ type: 'element', name: 'p', attributes: new Map([['style', 'font-size: 20px']]) })
        const ctx = makeContext(DIMENSION_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-TYP')
    })

    it('A4: hardcoded margin-top → MITHRIL-IST-SPC', () => {
        // 12px is NOT in dimension tokens
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'margin-top: 12px']]) })
        const ctx = makeContext(DIMENSION_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-SPC')
    })

    it('A5: margin-top: 0 → skipped (zero always valid)', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'margin-top: 0']]) })
        const ctx = makeContext(DIMENSION_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).toBeNull()
    })

    it('A6: no style attr → no violation', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['class', 'btn']]) })
        const ctx = makeContext(ALL_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).toBeNull()
    })

    it('A7: style with token-equivalent value → no violation', () => {
        // spacing.sm is 8, so margin-top: 8px should match
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'margin-top: 8px']]) })
        const ctx = makeContext(DIMENSION_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).toBeNull()
    })
})

// ── Group B: Vue :style binding ───────────────────────────────────────────────

describe('mithrilStylePlugin — Vue :style binding', () => {
    const plugin = createMithrilStylePlugin()
    const rule = plugin.rules[0]!

    it('B1: :style with quoted hex color → MITHRIL-IST-COL', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([[':style', "{ color: '#ff0000' }"]]) })
        const ctx = makeContext(COLOR_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-COL')
    })

    it('B2: :style with dynamic reference (no quotes) → skipped', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([[':style', '{ color: themeColor }']]) })
        const ctx = makeContext(COLOR_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).toBeNull() // can't statically evaluate
    })

    it('B3: :style with quoted spacing → MITHRIL-IST-SPC', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([[':style', "{ marginTop: '12px' }"]]) })
        const ctx = makeContext(DIMENSION_TOKENS)
        const result = rule.visit(node, ctx)
        expect(result).not.toBeNull()
        expect(result?.ruleId).toBe('MITHRIL-IST-SPC')
    })
})

// ── Group C: no tokens ────────────────────────────────────────────────────────

describe('mithrilStylePlugin — no tokens in config', () => {
    it('C1: no tokens → plugin is a no-op', () => {
        const plugin = createMithrilStylePlugin()
        const rule = plugin.rules[0]!
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'color: #ff0000; font-size: 20px']]) })
        const ctx = makeContext([]) // empty tokens
        const result = rule.visit(node, ctx)
        expect(result).toBeNull()
    })
})

// ── Group D: policy modes ─────────────────────────────────────────────────────

describe('mithrilStylePlugin — policy modes', () => {
    const plugin = createMithrilStylePlugin()
    const rule = plugin.rules[0]!

    it('D1: MITHRIL-IST-COL off → no violation', () => {
        const node = createNode({ type: 'element', name: 'div', attributes: new Map([['style', 'color: #ff0000']]) })
        const ctx = makeContext(COLOR_TOKENS, { ruleModes: { 'MITHRIL-IST-COL': 'off' } })
        const result = rule.visit(node, ctx)
        expect(result).toBeNull()
    })

    it('D2: MITHRIL-IST-TYP advisory → severity: warning (mapped from advisory → warning)', () => {
        // 'advisory' in MithrilLinter maps to 'warning' severity in LintViolation
        const node = createNode({ type: 'element', name: 'p', attributes: new Map([['style', 'font-size: 20px']]) })
        const ctx = makeContext(DIMENSION_TOKENS, { ruleModes: { 'MITHRIL-IST-TYP': 'advisory' } })
        const result = rule.visit(node, ctx)
        expect(result).not.toBeNull()
        expect(result?.severity).toBe('warning')
    })
})

// ── Group E: PluginRegistry integration ──────────────────────────────────────

describe('mithrilStylePlugin — PluginRegistry integration', () => {
    let registry: PluginRegistry

    beforeEach(() => {
        registry = new PluginRegistry()
        registry.registerAdapter(new HTMLAdapter())
        registry.registerPlugin(createMithrilStylePlugin())
    })

    it('E1: audit HTML with bad inline color → plugin fires', () => {
        const html = `<div style="color: #ff0000">Hello</div>`
        const result = registry.audit(html, 'test.html', { tokens: COLOR_TOKENS })
        const violation = result.violations.find((v) => v.ruleId === 'MITHRIL-IST-COL')
        expect(violation).toBeDefined()
        expect(violation?.message).toContain('#ff0000')
    })

    it('E2: audit HTML with no style attr → no violations from plugin', () => {
        const html = `<div class="text-primary">Hello</div>`
        const result = registry.audit(html, 'test.html', { tokens: COLOR_TOKENS })
        const pluginViolations = result.violations.filter((v) => v.ruleId?.startsWith('MITHRIL-IST'))
        expect(pluginViolations).toHaveLength(0)
    })
})
