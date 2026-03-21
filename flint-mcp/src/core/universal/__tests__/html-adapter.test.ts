import { describe, it, expect } from 'vitest'
import { HTMLAdapter } from '../adapters/html-adapter.js'
import { PluginRegistry } from '../registry.js'
import type { LinterPlugin, LintViolation } from '../linterPlugin.js'

const adapter = new HTMLAdapter()

// ── Parsing ──────────────────────────────────────────────────────────────────

describe('HTMLAdapter: parse', () => {
    it('parses a simple HTML element', () => {
        const doc = adapter.parse('<div>Hello</div>', 'test.html')
        expect(doc.language).toBe('html')
        expect(doc.root.children).toHaveLength(1)
        expect(doc.root.children[0].name).toBe('div')
        expect(doc.root.children[0].children).toHaveLength(1)
        expect(doc.root.children[0].children[0].metadata.value).toBe('Hello')
    })

    it('parses attributes', () => {
        const doc = adapter.parse('<button class="btn primary" disabled>Click</button>', 'test.html')
        const btn = doc.root.children[0]
        expect(btn.attributes.get('class')).toBe('btn primary')
        expect(btn.attributes.get('disabled')).toBe(true)
    })

    it('parses nested elements', () => {
        const doc = adapter.parse('<div><span>Inner</span></div>', 'test.html')
        const div = doc.root.children[0]
        expect(div.children).toHaveLength(1)
        expect(div.children[0].name).toBe('span')
        expect(div.children[0].children[0].metadata.value).toBe('Inner')
    })

    it('handles self-closing elements', () => {
        const doc = adapter.parse('<input type="text" /><br />', 'test.html')
        expect(doc.root.children).toHaveLength(2)
        expect(doc.root.children[0].name).toBe('input')
        expect(doc.root.children[0].attributes.get('type')).toBe('text')
        expect(doc.root.children[1].name).toBe('br')
    })

    it('handles void elements without explicit /', () => {
        const doc = adapter.parse('<img src="logo.png"><br><hr>', 'test.html')
        expect(doc.root.children).toHaveLength(3)
    })

    it('preserves Angular bindings as attributes', () => {
        const doc = adapter.parse('<button [class]="btnClass" (click)="handleClick()" *ngIf="visible">Go</button>', 'component.html')
        const btn = doc.root.children[0]
        expect(btn.attributes.get('[class]')).toBe('btnClass')
        expect(btn.attributes.get('(click)')).toBe('handleClick()')
        expect(btn.attributes.get('*ngIf')).toBe('visible')
    })

    it('preserves Vue directives as attributes', () => {
        const doc = adapter.parse('<div v-if="show" :class="dynamicClass" @click="onClick">Content</div>', 'App.vue')
        const div = doc.root.children[0]
        expect(div.attributes.get('v-if')).toBe('show')
        expect(div.attributes.get(':class')).toBe('dynamicClass')
        expect(div.attributes.get('@click')).toBe('onClick')
    })

    it('skips HTML comments', () => {
        const doc = adapter.parse('<!-- comment --><div>Visible</div><!-- another -->', 'test.html')
        expect(doc.root.children).toHaveLength(1)
        expect(doc.root.children[0].name).toBe('div')
    })

    it('parses a realistic Angular Material template', () => {
        const template = `
            <mat-card>
                <mat-card-header>
                    <mat-card-title>Product</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <p>Description here</p>
                </mat-card-content>
                <mat-card-actions>
                    <button mat-button color="primary">Buy</button>
                </mat-card-actions>
            </mat-card>
        `
        const doc = adapter.parse(template, 'product.component.html')
        const card = doc.root.children[0]
        expect(card.name).toBe('mat-card')
        expect(card.children.length).toBeGreaterThanOrEqual(1)
    })

    it('parses multiple sibling root elements', () => {
        const doc = adapter.parse('<header>Top</header><main>Content</main><footer>Bottom</footer>', 'test.html')
        expect(doc.root.children).toHaveLength(3)
        expect(doc.root.children[0].name).toBe('header')
        expect(doc.root.children[1].name).toBe('main')
        expect(doc.root.children[2].name).toBe('footer')
    })
})

// ── Generation ───────────────────────────────────────────────────────────────

describe('HTMLAdapter: generate', () => {
    it('round-trips simple HTML', () => {
        const source = '<div>Hello</div>'
        const doc = adapter.parse(source, 'test.html')
        const output = adapter.generate(doc)
        expect(output).toContain('<div>')
        expect(output).toContain('Hello')
        expect(output).toContain('</div>')
    })

    it('preserves attributes in output', () => {
        const doc = adapter.parse('<button class="primary" disabled>Click</button>', 'test.html')
        const output = adapter.generate(doc)
        expect(output).toContain('class="primary"')
        expect(output).toContain('disabled')
    })

    it('generates self-closing for void elements', () => {
        const doc = adapter.parse('<input type="email" />', 'test.html')
        const output = adapter.generate(doc)
        expect(output).toContain('<input')
        expect(output).toContain('/>')
    })
})

// ── Mutations ────────────────────────────────────────────────────────────────

describe('HTMLAdapter: mutate', () => {
    it('sets an attribute', () => {
        const doc = adapter.parse('<div>Content</div>', 'test.html')
        const nodeId = doc.root.children[0].id
        adapter.mutate(doc, { type: 'setAttribute', targetId: nodeId, args: { key: 'class', value: 'container' } })
        expect(doc.root.children[0].attributes.get('class')).toBe('container')
    })

    it('removes an attribute', () => {
        const doc = adapter.parse('<div class="old">Content</div>', 'test.html')
        const nodeId = doc.root.children[0].id
        adapter.mutate(doc, { type: 'removeAttribute', targetId: nodeId, args: { key: 'class' } })
        expect(doc.root.children[0].attributes.has('class')).toBe(false)
    })

    it('renames an element', () => {
        const doc = adapter.parse('<div>Content</div>', 'test.html')
        const nodeId = doc.root.children[0].id
        adapter.mutate(doc, { type: 'rename', targetId: nodeId, args: { name: 'section' } })
        expect(doc.root.children[0].name).toBe('section')
    })

    it('throws for unknown node ID', () => {
        const doc = adapter.parse('<div>Content</div>', 'test.html')
        expect(() => adapter.mutate(doc, { type: 'setAttribute', targetId: 'nope', args: { key: 'x', value: 'y' } })).toThrow()
    })
})

// ── Registry Integration ─────────────────────────────────────────────────────

describe('HTMLAdapter: registry integration', () => {
    it('resolves .html files to the HTML adapter', () => {
        const registry = new PluginRegistry()
        registry.registerAdapter(adapter)
        expect(registry.getAdapterForFile('component.html')).toBe(adapter)
        expect(registry.getAdapterForFile('template.htm')).toBe(adapter)
    })

    it('resolves .vue files to the HTML adapter', () => {
        const registry = new PluginRegistry()
        registry.registerAdapter(adapter)
        expect(registry.getAdapterForFile('App.vue')).toBe(adapter)
    })

    it('resolves Angular component templates', () => {
        const registry = new PluginRegistry()
        registry.registerAdapter(adapter)
        expect(registry.getAdapterForFile('product.component.html')).toBe(adapter)
    })

    it('runs a linter plugin against parsed HTML', () => {
        const registry = new PluginRegistry()
        registry.registerAdapter(adapter)

        // Simple plugin: flag any element with hardcoded style attribute
        const stylePlugin: LinterPlugin = {
            id: 'no-inline-style',
            rules: [
                {
                    id: 'STYLE-001',
                    visit(node) {
                        if (node.attributes.has('style')) {
                            return {
                                ruleId: 'STYLE-001',
                                nodeId: node.id,
                                nodeName: node.name,
                                message: 'Inline styles are not allowed — use CSS classes',
                                severity: 'warning',
                            }
                        }
                        return null
                    },
                },
            ],
        }
        registry.registerPlugin(stylePlugin)

        const result = registry.audit(
            '<div style="color: red"><p>Text</p></div>',
            'test.html',
        )

        expect(result.violations).toHaveLength(1)
        expect(result.violations[0].ruleId).toBe('STYLE-001')
        expect(result.violations[0].nodeName).toBe('div')
    })

    it('runs the hardcoded class detector on Angular templates', () => {
        const registry = new PluginRegistry()
        registry.registerAdapter(adapter)

        // Plugin: detect hardcoded hex colors in class attribute
        const hexPlugin: LinterPlugin = {
            id: 'no-hardcoded-hex',
            rules: [
                {
                    id: 'HEX-001',
                    visit(node) {
                        const cls = node.attributes.get('class')
                        if (typeof cls === 'string' && /#[0-9A-Fa-f]{6}/.test(cls)) {
                            return {
                                ruleId: 'HEX-001',
                                nodeId: node.id,
                                nodeName: node.name,
                                message: `Hardcoded hex color found in class: ${cls}`,
                                severity: 'warning',
                            }
                        }
                        return null
                    },
                },
            ],
        }
        registry.registerPlugin(hexPlugin)

        const result = registry.audit(
            '<mat-toolbar class="bg-[#FF0000] text-white">Title</mat-toolbar>',
            'toolbar.component.html',
        )

        expect(result.violations).toHaveLength(1)
        expect(result.violations[0].ruleId).toBe('HEX-001')
    })
})
