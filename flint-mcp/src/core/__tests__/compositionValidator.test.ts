/**
 * Composition Validator Tests — P2.5 Composition & Slot Governance
 *
 * Tests MITHRIL-COMP-001 (forbidden child / allowed children),
 * MITHRIL-COMP-002 (missing required parent), and
 * MITHRIL-COMP-003 (max nesting depth exceeded).
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import type { ComponentEntry } from '../registryService.js'
import { validateComposition } from '../compositionValidator.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

function buildRegistry(entries: Record<string, Partial<ComponentEntry>>): Record<string, ComponentEntry> {
    const result: Record<string, ComponentEntry> = {}
    for (const [name, partial] of Object.entries(entries)) {
        result[name] = {
            name,
            importPath: `@/components/ui/${name.toLowerCase()}`,
            ...partial,
        } as ComponentEntry
    }
    return result
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('compositionValidator', () => {

    // 1. Card inside Button → MITHRIL-COMP-001
    it('flags Card inside Button as MITHRIL-COMP-001 (forbidden child)', () => {
        const code = `
            const App = () => (
                <Button>
                    <Card>Content</Card>
                </Button>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Button: { compositionRules: { forbiddenChildren: ['Card', 'Table', 'Dialog'] } },
            Card: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-001')
        expect(violations[0].type).toBe('composition')
        expect(violations[0].message).toContain('Card')
        expect(violations[0].message).toContain('forbidden')
        expect(violations[0].message).toContain('Button')
    })

    // 2. Text inside Button → no flag (allowed, not forbidden)
    it('does not flag Text inside Button when Text is not forbidden', () => {
        const code = `
            const App = () => (
                <Button>
                    <Text>Click me</Text>
                </Button>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Button: { compositionRules: { forbiddenChildren: ['Card', 'Table'] } },
            Text: {},
        })

        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })

    // 3. DialogFooter outside Dialog → MITHRIL-COMP-002
    it('flags DialogFooter outside Dialog as MITHRIL-COMP-002 (missing required parent)', () => {
        const code = `
            const App = () => (
                <div>
                    <DialogFooter>Actions</DialogFooter>
                </div>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            DialogFooter: { compositionRules: { requiredParent: 'Dialog' } },
            Dialog: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-002')
        expect(violations[0].message).toContain('DialogFooter')
        expect(violations[0].message).toContain('Dialog')
        expect(violations[0].message).toContain('parent')
    })

    // 4. TabPanel outside Tabs → MITHRIL-COMP-002
    it('flags TabPanel outside Tabs as MITHRIL-COMP-002', () => {
        const code = `
            const App = () => (
                <Container>
                    <TabPanel>Content</TabPanel>
                </Container>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            TabPanel: { compositionRules: { requiredParent: 'Tabs' } },
            Container: {},
            Tabs: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-002')
        expect(violations[0].message).toContain('TabPanel')
        expect(violations[0].message).toContain('Tabs')
    })

    // 5. Card in Card in Card → MITHRIL-COMP-003 (depth exceeded at maxDepth=2)
    it('flags Card nested 3 deep as MITHRIL-COMP-003 (depth exceeded)', () => {
        const code = `
            const App = () => (
                <Card>
                    <Card>
                        <Card>Too deep</Card>
                    </Card>
                </Card>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Card: { compositionRules: { maxDepth: 2 } },
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-003')
        expect(violations[0].message).toContain('3')
        expect(violations[0].message).toContain('2')
    })

    // 6. No registry → validator skips, returns empty
    it('returns empty map when registry is empty', () => {
        const code = `
            const App = () => (
                <Button><Card>test</Card></Button>
            )
        `
        const ast = parseJSX(code)
        const warnings = validateComposition(ast, {})
        expect(warnings.size).toBe(0)
    })

    // 7. Component without compositionRules → no check
    it('skips components without compositionRules', () => {
        const code = `
            const App = () => (
                <Container>
                    <Header>Title</Header>
                    <Footer>End</Footer>
                </Container>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Container: {},
            Header: {},
            Footer: {},
        })

        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })

    // 8. Multiple violations in one tree
    it('catches multiple violations in a single component tree', () => {
        const code = `
            const App = () => (
                <div>
                    <Button>
                        <Card>Bad</Card>
                        <Table>Also bad</Table>
                    </Button>
                    <DialogFooter>Orphaned</DialogFooter>
                </div>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Button: { compositionRules: { forbiddenChildren: ['Card', 'Table'] } },
            Card: {},
            Table: {},
            DialogFooter: { compositionRules: { requiredParent: 'Dialog' } },
            Dialog: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        // Card inside Button, Table inside Button, DialogFooter outside Dialog
        expect(violations.length).toBe(3)

        const ruleIds = violations.map(v => v.ruleId)
        expect(ruleIds.filter(r => r === 'MITHRIL-COMP-001').length).toBe(2)
        expect(ruleIds.filter(r => r === 'MITHRIL-COMP-002').length).toBe(1)
    })

    // 9. Empty JSX tree → no violations
    it('returns empty map for an empty file', () => {
        const code = `export const nothing = 42`
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Button: { compositionRules: { forbiddenChildren: ['Card'] } },
        })

        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })

    // 10. allowedChildren enforcement — child not in whitelist
    it('flags child not in allowedChildren list as MITHRIL-COMP-001', () => {
        const code = `
            const App = () => (
                <Toolbar>
                    <Badge>Count</Badge>
                </Toolbar>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Toolbar: { compositionRules: { allowedChildren: ['Button', 'Separator', 'IconButton'] } },
            Badge: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-001')
        expect(violations[0].message).toContain('Badge')
        expect(violations[0].message).toContain('not an allowed child')
        expect(violations[0].message).toContain('Toolbar')
    })

    // 11. allowedChildren — child in whitelist passes
    it('does not flag child that is in the allowedChildren list', () => {
        const code = `
            const App = () => (
                <Toolbar>
                    <Button>Click</Button>
                </Toolbar>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Toolbar: { compositionRules: { allowedChildren: ['Button', 'Separator'] } },
            Button: {},
        })

        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })

    // 12. requiredParent satisfied → no violation
    it('does not flag DialogFooter when it is inside Dialog', () => {
        const code = `
            const App = () => (
                <Dialog>
                    <DialogFooter>Actions</DialogFooter>
                </Dialog>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Dialog: {},
            DialogFooter: { compositionRules: { requiredParent: 'Dialog' } },
        })

        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })

    // 13. Card nested 2 deep is OK when maxDepth=2
    it('does not flag Card nested 2 deep when maxDepth=2', () => {
        const code = `
            const App = () => (
                <Card>
                    <Card>Two levels is fine</Card>
                </Card>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Card: { compositionRules: { maxDepth: 2 } },
        })

        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })

    // 14. Default composition rules kick in (Button defaults)
    it('uses default composition rules when registry entry has no compositionRules', () => {
        const code = `
            const App = () => (
                <Button>
                    <Dialog>Forbidden by defaults</Dialog>
                </Button>
            )
        `
        const ast = parseJSX(code)
        // Button has no compositionRules in registry — defaults should apply
        const registry = buildRegistry({
            Button: {},
            Dialog: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-001')
        expect(violations[0].message).toContain('Dialog')
        expect(violations[0].message).toContain('Button')
    })

    // 15. Per-rule mode 'off' suppresses violations
    it('suppresses MITHRIL-COMP-001 when ruleModes sets it to off', () => {
        const code = `
            const App = () => (
                <Button>
                    <Card>Should be suppressed</Card>
                </Button>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Button: { compositionRules: { forbiddenChildren: ['Card'] } },
            Card: {},
        })

        const warnings = validateComposition(ast, registry, {
            ruleModes: { 'MITHRIL-COMP-001': 'off' },
        })
        expect(warnings.size).toBe(0)
    })

    // 16. Per-rule mode 'advisory' downgrades severity
    it('downgrades severity to advisory when ruleModes sets advisory', () => {
        const code = `
            const App = () => (
                <Button>
                    <Card>Advisory</Card>
                </Button>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Button: { compositionRules: { forbiddenChildren: ['Card'] } },
            Card: {},
        })

        const warnings = validateComposition(ast, registry, {
            ruleModes: { 'MITHRIL-COMP-001': 'advisory' },
        })
        const violations = [...warnings.values()]

        expect(violations.length).toBe(1)
        expect(violations[0].severity).toBe('advisory')
    })

    // ── Sprint 1 acceptance-criteria tests ───────────────────────────────────

    // 17. mode003 'off' with deeply-nested Cards → zero warnings, no depth drift
    it('MITHRIL-COMP-003=off: no warnings and depthStack stays clean across sibling trees', () => {
        // Two sibling Card trees that would each trigger depth violations if mode003
        // were active. With mode='off', no warnings should fire AND the depth
        // counter must not leak between the two trees (regression guard).
        const code = `
            const App = () => (
                <div>
                    <Card>
                        <Card>
                            <Card>Too deep tree 1</Card>
                        </Card>
                    </Card>
                    <Card>
                        <Card>
                            <Card>Too deep tree 2</Card>
                        </Card>
                    </Card>
                </div>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({ Card: { compositionRules: { maxDepth: 2 } } })

        const warnings = validateComposition(ast, registry, {
            ruleModes: { 'MITHRIL-COMP-003': 'off' },
        })
        expect(warnings.size).toBe(0)
    })

    // 18. isPascalCase tightened — HTML/URL/SVG must NOT match
    it('does not treat ALLCAPS names as PascalCase design-system components', () => {
        // If <HTML/>, <URL/>, <SVG/> were treated as PascalCase components they
        // would be pushed onto the parentStack and could generate false comp-002
        // violations. With the tightened regex they are ignored.
        const code = `
            const App = () => (
                <HTML>
                    <URL>text</URL>
                    <SVG />
                </HTML>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            HTML: { compositionRules: { requiredParent: 'Document' } },
            URL: {},
            SVG: {},
        })

        const warnings = validateComposition(ast, registry)
        // None of these all-caps names should trigger violations
        expect(warnings.size).toBe(0)
    })

    // 19. No duplicate comp-001 when both forbiddenChildren + allowedChildren fire
    it('emits only one comp-001 when child matches both forbiddenChildren and allowedChildren', () => {
        // A parent that lists Card in forbiddenChildren AND has an allowedChildren
        // list that does not include Card. Before the fix, this would produce two
        // comp-001 warnings for the same node.
        const code = `
            const App = () => (
                <Panel>
                    <Card>Content</Card>
                </Panel>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({
            Panel: {
                compositionRules: {
                    forbiddenChildren: ['Card'],
                    allowedChildren: ['Button', 'Text'],
                },
            },
            Card: {},
        })

        const warnings = validateComposition(ast, registry)
        const violations = [...warnings.values()]
        // Exactly one violation — forbiddenChildren wins, allowedChildren is short-circuited
        expect(violations.length).toBe(1)
        expect(violations[0].ruleId).toBe('MITHRIL-COMP-001')
        expect(violations[0].message).toContain('forbidden')
    })

    // 20. Sibling Card trees do not cross-contaminate depth (regression guard)
    it('sibling Card trees have independent depth counters', () => {
        // Card maxDepth=2. Two independent trees each with depth=2 should produce
        // no violations. If depth leaked across siblings the second tree would
        // see depth=3 and fire incorrectly.
        const code = `
            const App = () => (
                <div>
                    <Card><Card>level2</Card></Card>
                    <Card><Card>level2</Card></Card>
                </div>
            )
        `
        const ast = parseJSX(code)
        const registry = buildRegistry({ Card: { compositionRules: { maxDepth: 2 } } })
        const warnings = validateComposition(ast, registry)
        expect(warnings.size).toBe(0)
    })
})
