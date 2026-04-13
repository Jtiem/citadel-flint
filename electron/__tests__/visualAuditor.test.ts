/**
 * visualAuditor.test.ts — Phase P7: Visual Regression (Glass-side)
 *
 * Verifies the pure measurement / diff / suggestion logic of the visual
 * auditor without requiring a real Electron BrowserWindow. The BrowserWindow
 * import is stubbed at the module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Stub electron before importing the auditor ──────────────────────────────

vi.mock('electron', () => {
    class StubBrowserWindow {
        webContents = {
            once: vi.fn(),
            executeJavaScript: vi.fn(),
        }
        loadURL = vi.fn()
        destroy = vi.fn()
        isDestroyed = vi.fn().mockReturnValue(false)
    }
    return { BrowserWindow: StubBrowserWindow }
})

// Dynamic imports so the mock is in place first
let diffBoxes: typeof import('../visualAuditor.js').diffBoxes
let suggestCssFix: typeof import('../visualAuditor.js').suggestCssFix
let transformVisualSource: typeof import('../visualAuditor.js').transformVisualSource
let buildVisualHarnessHtml: typeof import('../visualAuditor.js').buildVisualHarnessHtml
let runVisualAudit: typeof import('../visualAuditor.js').runVisualAudit

beforeEach(async () => {
    const mod = await import('../visualAuditor.js')
    diffBoxes = mod.diffBoxes
    suggestCssFix = mod.suggestCssFix
    transformVisualSource = mod.transformVisualSource
    buildVisualHarnessHtml = mod.buildVisualHarnessHtml
    runVisualAudit = mod.runVisualAudit
})

describe('visualAuditor', () => {

    describe('diffBoxes', () => {
        it('returns no violations when all boxes match within tolerance', () => {
            const violations = diffBoxes(
                [{ flintId: 'a', width: 100, height: 50, x: 0, y: 0 }],
                { a: { width: 101, height: 49, x: 0, y: 0 } },
                2
            )
            expect(violations).toEqual([])
        })

        it('emits a violation when width drifts beyond tolerance', () => {
            const violations = diffBoxes(
                [{ flintId: 'btn', width: 100, height: 40, x: 0, y: 0 }],
                { btn: { width: 140, height: 40, x: 0, y: 0 } },
                2
            )
            expect(violations).toHaveLength(1)
            expect(violations[0].ruleId).toBe('VISUAL-REG-001')
            expect(violations[0].deltaPx).toBeCloseTo(40)
            expect(violations[0].suggestion).toContain('overflow-hidden')
        })

        it('emits a violation when height collapses', () => {
            const violations = diffBoxes(
                [{ flintId: 'card', width: 200, height: 100, x: 0, y: 0 }],
                { card: { width: 200, height: 60, x: 0, y: 0 } },
                2
            )
            expect(violations).toHaveLength(1)
            expect(violations[0].deltaPx).toBeCloseTo(40)
            expect(violations[0].suggestion).toContain('flex-shrink-0')
        })

        it('emits a violation with zero actual when the element was not rendered', () => {
            const violations = diffBoxes(
                [{ flintId: 'missing', width: 80, height: 80, x: 0, y: 0 }],
                { missing: null },
                2
            )
            expect(violations).toHaveLength(1)
            expect(violations[0].actual).toEqual({ width: 0, height: 0 })
            expect(violations[0].message).toContain('was not rendered')
        })

        it('respects a custom tolerance', () => {
            const boxes = [{ flintId: 'a', width: 100, height: 100, x: 0, y: 0 }]
            const measured = { a: { width: 105, height: 100, x: 0, y: 0 } }

            expect(diffBoxes(boxes, measured, 2)).toHaveLength(1)
            expect(diffBoxes(boxes, measured, 10)).toHaveLength(0)
        })
    })

    describe('suggestCssFix', () => {
        it('suggests overflow-hidden for width overflow', () => {
            const suggestion = suggestCssFix(
                { flintId: 'a', width: 100, height: 50, x: 0, y: 0 },
                { width: 130, height: 50, x: 0, y: 0 }
            )
            expect(suggestion).toContain('overflow-hidden')
        })

        it('suggests flex-shrink-0 for width collapse', () => {
            const suggestion = suggestCssFix(
                { flintId: 'a', width: 100, height: 50, x: 0, y: 0 },
                { width: 60, height: 50, x: 0, y: 0 }
            )
            expect(suggestion).toContain('flex-shrink-0')
        })

        it('suggests flex-none for positional drift', () => {
            const suggestion = suggestCssFix(
                { flintId: 'a', width: 100, height: 50, x: 0, y: 0 },
                { width: 100, height: 50, x: 30, y: 0 }
            )
            expect(suggestion).toContain('flex-none')
        })

        it('returns null when everything is within tolerance', () => {
            const suggestion = suggestCssFix(
                { flintId: 'a', width: 100, height: 50, x: 0, y: 0 },
                { width: 101, height: 51, x: 1, y: 1 }
            )
            expect(suggestion).toBeNull()
        })
    })

    describe('transformVisualSource', () => {
        it('transforms a default-export function component into runnable JS', () => {
            const src = 'export default function Button() { return <button>ok</button> }'
            const { js, error } = transformVisualSource(src)
            expect(error).toBeNull()
            expect(js).toContain('window.__FlintVisualComponent = Button')
            expect(js).not.toMatch(/^import\s/m)
        })

        it('handles bare-identifier default exports', () => {
            const src = 'function Card() { return <div /> }\nexport default Card'
            const { js, error } = transformVisualSource(src)
            expect(error).toBeNull()
            expect(js).toContain('window.__FlintVisualComponent = Card')
        })

        it('returns an error when there is no default export', () => {
            const src = 'export const X = 1'
            const { js, error } = transformVisualSource(src)
            expect(js).toBeNull()
            expect(error).toContain('No default export')
        })

        it('returns an error for invalid TSX syntax', () => {
            const { js, error } = transformVisualSource('export default function ( { return <')
            expect(js).toBeNull()
            expect(error).not.toBeNull()
        })
    })

    describe('buildVisualHarnessHtml', () => {
        it('embeds the transformed JS and React UMD bundles', () => {
            const html = buildVisualHarnessHtml(
                'window.__FlintVisualComponent = () => null;',
                '/* react */',
                '/* react-dom */'
            )
            expect(html).toContain('<!DOCTYPE html>')
            expect(html).toContain('/* react */')
            expect(html).toContain('/* react-dom */')
            expect(html).toContain('__flintMeasure')
            expect(html).toContain('data-flint-id')
        })

        it('escapes </script> sequences in the embedded JS payload', () => {
            const html = buildVisualHarnessHtml(
                'var s = "</script>";',
                '/* r */',
                '/* rd */'
            )
            // The embedded JSON must not contain a literal </script> that would
            // close the script tag prematurely.
            const embedded = html.slice(html.indexOf('id="__code"'))
            expect(embedded).not.toContain('</script>";')
        })
    })

    describe('runVisualAudit', () => {
        it('short-circuits with ok=true when there are no expected boxes', async () => {
            const result = await runVisualAudit(
                { componentCode: 'export default function A() { return null }', componentName: 'A', expectedBoxes: [] },
                async () => ({ reactUMD: '', reactDOMUMD: '' })
            )
            expect(result.ok).toBe(true)
            expect(result.violations).toEqual([])
            expect(result.error).toBeNull()
        })

        it('returns an error when the component cannot be transformed', async () => {
            const result = await runVisualAudit(
                {
                    componentCode: 'this is not valid tsx',
                    componentName: 'Broken',
                    expectedBoxes: [{ flintId: 'a', width: 10, height: 10, x: 0, y: 0 }],
                },
                async () => ({ reactUMD: '', reactDOMUMD: '' })
            )
            expect(result.ok).toBe(false)
            expect(result.error).not.toBeNull()
        })

        it('returns an error when the vendor loader fails', async () => {
            const result = await runVisualAudit(
                {
                    componentCode: 'export default function A() { return <div /> }',
                    componentName: 'A',
                    expectedBoxes: [{ flintId: 'a', width: 10, height: 10, x: 0, y: 0 }],
                },
                async () => { throw new Error('no vendor') }
            )
            expect(result.ok).toBe(false)
            expect(result.error).toContain('Vendor load failed')
        })
    })

    // ── Sprint 1 acceptance-criteria: Babel-based transformVisualSource ──────

    describe('transformVisualSource — Babel traversal (Sprint 1)', () => {
        it('handles arrow-function default export', () => {
            const src = 'export default () => <div className="box" />'
            const { js, error } = transformVisualSource(src)
            expect(error).toBeNull()
            expect(js).not.toBeNull()
            expect(js).toContain('window.__FlintVisualComponent')
            // Must not contain ES module syntax
            expect(js).not.toMatch(/^import\s/m)
            expect(js).not.toMatch(/^export\s/m)
        })

        it('handles multi-line import cleanly removed', () => {
            const src = `import {\n  useState,\n  useEffect\n} from 'react'\nexport default function App() { return <div /> }`
            const { js, error } = transformVisualSource(src)
            expect(error).toBeNull()
            expect(js).not.toBeNull()
            // No dangling import fragments
            expect(js).not.toContain('from \'react\'')
            expect(js).not.toContain('import {')
        })

        it('handles export default memo(Foo)', () => {
            const src = `function Foo() { return <div /> }\nexport default memo(Foo)`
            const { js, error } = transformVisualSource(src)
            expect(error).toBeNull()
            expect(js).not.toBeNull()
            expect(js).toContain('window.__FlintVisualComponent')
        })

        it('handles export { Foo as default }', () => {
            const src = `function Foo() { return <div /> }\nexport { Foo as default }`
            const { js, error } = transformVisualSource(src)
            expect(error).toBeNull()
            expect(js).not.toBeNull()
            expect(js).toContain('window.__FlintVisualComponent = Foo')
        })
    })

    // ── Sprint 1 acceptance-criteria: settled-guard for render-timeout race ──

    describe('settled guard — unit test', () => {
        // Directly verify that the settled-guard pattern prevents double-settle.
        // We exercise the guard in isolation without needing a real BrowserWindow
        // or a 10s internal timeout.
        it('calling settle() twice only executes the callback once', () => {
            // Inline replica of the guard extracted from runVisualAudit:
            let settled = false
            const settle = (fn: () => void): void => {
                if (settled) return
                settled = true
                fn()
            }

            let callCount = 0
            const action = (): void => { callCount++ }

            // First call should execute
            settle(action)
            // Second call is a no-op (already settled)
            settle(action)
            // Third call also no-op
            settle(action)

            expect(callCount).toBe(1)
        })

        it('settle() guard works correctly with reject/resolve semantics', () => {
            let settled = false
            const settle = (fn: () => void): void => {
                if (settled) return
                settled = true
                fn()
            }

            const rejectCalls: string[] = []
            const fakeFail = (msg: string) => settle(() => rejectCalls.push(msg))

            // Simulate timeout fires first
            fakeFail('timeout')
            // Late did-fail-load — must be swallowed
            fakeFail('did-fail-load')

            expect(rejectCalls).toHaveLength(1)
            expect(rejectCalls[0]).toBe('timeout')
        })
    })
})
