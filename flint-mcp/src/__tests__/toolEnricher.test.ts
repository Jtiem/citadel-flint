/**
 * toolEnricher.test.ts — Phase ACX.3
 *
 * Tests for enrichToolCall():
 *   ACX-18: flint_ast_mutate enrichment returns ToolEnrichment shape
 *   ACX-19: flint_fix enrichment returns ToolEnrichment shape
 *   ACX-20: Non-enrichable tool returns null
 *   ACX-21: ctx=null returns null for all tools
 *   ACX-22: Missing nodeId in flint_ast_mutate args returns null
 *   Additional: preamble format, violation extraction, suggested ops, best-effort (never throws)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { enrichToolCall, enrichToolResult, isEnrichableTool } from '../../src/core/toolEnricher.js'
import type { SessionContext } from '../../src/core/sessionContext.js'

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<{
    mithrilCount: number
    a11yCount: number
    criticalCount: number
    affectedNodeIds: string[]
    hasFixableViolations: boolean
    activeFilePath: string | null
    tokenCount: number
}>): SessionContext {
    const {
        mithrilCount = 0,
        a11yCount = 0,
        criticalCount = 0,
        affectedNodeIds = [],
        hasFixableViolations = false,
        activeFilePath = '/tmp/test/src/Button.tsx',
        tokenCount = 0,
    } = overrides
    return {
        assembledAt: new Date().toISOString(),
        projectRoot: '/tmp/test',
        canvas: {
            activeFile: activeFilePath,
            selectedNodeId: null,
            canvasMode: 'design',
            figmaConnected: false,
            saveState: 'saved',
        },
        activeFileSource: null,
        activeFilePath,
        violations: {
            mithrilCount,
            a11yCount,
            amberCount: mithrilCount,
            criticalCount,
            affectedNodeIds,
            hasFixableViolations,
        },
        tokens: {
            totalCount: tokenCount,
            byType: {},
            top20: [],
        },
        recentMutations: [],
        healthScore: null,
        healthGrade: null,
        partial: false,
    }
}

// ── ACX-18: flint_ast_mutate enrichment ──────────────────────────────────────

describe('enrichToolCall — flint_ast_mutate (ACX-18)', () => {
    it('returns a ToolEnrichment for flint_ast_mutate with valid nodeId', () => {
        const ctx = makeCtx({})
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }],
            },
            ctx,
        )
        expect(result).not.toBeNull()
        expect(result?.toolName).toBe('flint_ast_mutate')
    })

    it('contextPreamble contains the target node ID', () => {
        const ctx = makeCtx({})
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }],
            },
            ctx,
        )
        expect(result?.contextPreamble).toContain('flint-btn-001')
        expect(result?.contextPreamble).toContain('Flint Context Preamble')
    })

    it('data contains nodeId, activeFile, and totalViolations', () => {
        const ctx = makeCtx({ mithrilCount: 3, a11yCount: 2, activeFilePath: '/tmp/Button.tsx' })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateProp', args: { nodeId: 'flint-card-002' } }],
            },
            ctx,
        )
        expect(result?.data['nodeId']).toBe('flint-card-002')
        expect(result?.data['activeFile']).toBe('/tmp/Button.tsx')
        expect(result?.data['totalViolations']).toBe(5)
    })

    it('reports node violations when nodeId is in affectedNodeIds', () => {
        const ctx = makeCtx({
            mithrilCount: 1,
            criticalCount: 0,
            affectedNodeIds: ['flint-btn-001'],
            hasFixableViolations: true,
        })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }],
            },
            ctx,
        )
        expect(result?.data['nodeViolations']).toHaveLength(1)
    })

    it('reports no violations when nodeId is NOT in affectedNodeIds', () => {
        const ctx = makeCtx({ affectedNodeIds: ['flint-other-node'] })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }],
            },
            ctx,
        )
        expect((result?.data['nodeViolations'] as unknown[]).length).toBe(0)
    })

    it('preamble mentions "none" for violations when node has none', () => {
        const ctx = makeCtx({ affectedNodeIds: [] })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-clean-node' } }],
            },
            ctx,
        )
        expect(result?.contextPreamble).toContain('none')
    })

    it('handles targetId as the node identifier (not nodeId)', () => {
        const ctx = makeCtx({ affectedNodeIds: ['flint-alt-id'] })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'moveNode', args: { targetId: 'flint-alt-id' } }],
            },
            ctx,
        )
        expect(result?.data['nodeId']).toBe('flint-alt-id')
    })

    it('severity is critical when criticalCount > 0 and node is in affectedNodeIds', () => {
        const ctx = makeCtx({ mithrilCount: 1, criticalCount: 1, affectedNodeIds: ['flint-btn-001'] })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }],
            },
            ctx,
        )
        const violations = result?.data['nodeViolations'] as Array<{ severity: string }>
        expect(violations[0].severity).toBe('critical')
    })

    it('severity is amber when criticalCount is 0 and node is in affectedNodeIds', () => {
        const ctx = makeCtx({ mithrilCount: 2, criticalCount: 0, affectedNodeIds: ['flint-btn-001'] })
        const result = enrichToolCall(
            'flint_ast_mutate',
            {
                mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }],
            },
            ctx,
        )
        const violations = result?.data['nodeViolations'] as Array<{ severity: string }>
        expect(violations[0].severity).toBe('amber')
    })
})

// ── ACX-19: flint_fix enrichment ─────────────────────────────────────────────

describe('enrichToolCall — flint_fix (ACX-19)', () => {
    it('returns a ToolEnrichment for flint_fix', () => {
        const ctx = makeCtx({ mithrilCount: 2, affectedNodeIds: ['node-1', 'node-2'] })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect(result).not.toBeNull()
        expect(result?.toolName).toBe('flint_fix')
    })

    it('contextPreamble contains file path and violation count', () => {
        const ctx = makeCtx({ mithrilCount: 3, affectedNodeIds: ['n1', 'n2', 'n3'] })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Card.tsx' }, ctx)
        expect(result?.contextPreamble).toContain('Flint Context Preamble')
        expect(result?.contextPreamble).toContain('/tmp/Card.tsx')
        expect(result?.contextPreamble).toContain('Total violations: 3')
    })

    it('data contains filePath, violationCount, and suggestedOpsCount', () => {
        const ctx = makeCtx({ mithrilCount: 2, affectedNodeIds: ['n1', 'n2'], hasFixableViolations: true })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect(result?.data).toHaveProperty('filePath')
        expect(result?.data).toHaveProperty('violationCount')
        expect(result?.data).toHaveProperty('suggestedOpsCount')
    })

    it('falls back to activeFilePath when filePath arg is not provided', () => {
        const ctx = makeCtx({ activeFilePath: '/tmp/Fallback.tsx', mithrilCount: 1, affectedNodeIds: ['n1'] })
        const result = enrichToolCall('flint_fix', {}, ctx)
        expect(result?.data['filePath']).toBe('/tmp/Fallback.tsx')
    })

    it('violations list matches affectedNodeIds length', () => {
        const ctx = makeCtx({ mithrilCount: 3, affectedNodeIds: ['n1', 'n2', 'n3'] })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect(result?.data['violationCount']).toBe(3)
    })

    it('includes up to 3 suggested ops when mithril violations exist and are fixable', () => {
        const ctx = makeCtx({
            mithrilCount: 5,
            affectedNodeIds: ['n1', 'n2', 'n3', 'n4', 'n5'],
            hasFixableViolations: true,
        })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect((result?.data['suggestedOpsCount'] as number)).toBeLessThanOrEqual(3)
        expect((result?.data['suggestedOpsCount'] as number)).toBeGreaterThan(0)
    })

    it('returns 0 suggested ops when no fixable violations', () => {
        const ctx = makeCtx({
            mithrilCount: 3,
            affectedNodeIds: ['n1', 'n2', 'n3'],
            hasFixableViolations: false,
        })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect(result?.data['suggestedOpsCount']).toBe(0)
    })

    it('preamble includes Violations section when violations exist', () => {
        const ctx = makeCtx({ mithrilCount: 2, affectedNodeIds: ['n1', 'n2'] })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect(result?.contextPreamble).toContain('Violations:')
    })

    it('preamble includes Suggested fixes section when fixable violations exist', () => {
        const ctx = makeCtx({
            mithrilCount: 2,
            affectedNodeIds: ['n1', 'n2'],
            hasFixableViolations: true,
        })
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, ctx)
        expect(result?.contextPreamble).toContain('Suggested fixes:')
    })
})

// ── ACX-20: non-enrichable tools return null ──────────────────────────────────

describe('enrichToolCall — non-enrichable tools (ACX-20)', () => {
    const ctx = makeCtx({})

    it('returns null for flint_audit', () => {
        expect(enrichToolCall('flint_audit', { filePath: '/tmp/Button.tsx' }, ctx)).toBeNull()
    })

    it('returns null for flint_status', () => {
        expect(enrichToolCall('flint_status', {}, ctx)).toBeNull()
    })

    it('returns null for flint_get_context', () => {
        expect(enrichToolCall('flint_get_context', {}, ctx)).toBeNull()
    })

    it('returns null for flint_assess_complexity', () => {
        expect(enrichToolCall('flint_assess_complexity', { taskDescription: 'test' }, ctx)).toBeNull()
    })

    it('returns null for an unknown tool name', () => {
        expect(enrichToolCall('unknown_tool_xyz', {}, ctx)).toBeNull()
    })

    it('returns null for empty string tool name', () => {
        expect(enrichToolCall('', {}, ctx)).toBeNull()
    })
})

// ── ACX-21: ctx=null returns null ─────────────────────────────────────────────

describe('enrichToolCall — ctx=null returns null (ACX-21)', () => {
    it('returns null for flint_ast_mutate when ctx is null', () => {
        const result = enrichToolCall(
            'flint_ast_mutate',
            { mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-btn-001' } }] },
            null,
        )
        expect(result).toBeNull()
    })

    it('returns null for flint_fix when ctx is null', () => {
        const result = enrichToolCall('flint_fix', { filePath: '/tmp/Button.tsx' }, null)
        expect(result).toBeNull()
    })

    it('does not throw when ctx is null and tool is flint_ast_mutate', () => {
        expect(() => enrichToolCall('flint_ast_mutate', { mutations: [] }, null)).not.toThrow()
    })

    it('does not throw when ctx is null and tool is flint_fix', () => {
        expect(() => enrichToolCall('flint_fix', {}, null)).not.toThrow()
    })
})

// ── ACX-22: Missing nodeId returns null ───────────────────────────────────────

describe('enrichToolCall — missing nodeId (ACX-22)', () => {
    const ctx = makeCtx({})

    it('returns null when mutations array is empty', () => {
        const result = enrichToolCall('flint_ast_mutate', { mutations: [] }, ctx)
        expect(result).toBeNull()
    })

    it('returns null when mutations is undefined', () => {
        const result = enrichToolCall('flint_ast_mutate', {}, ctx)
        expect(result).toBeNull()
    })

    it('returns null when first mutation has no args', () => {
        const result = enrichToolCall(
            'flint_ast_mutate',
            { mutations: [{ type: 'updateClassName' }] },
            ctx,
        )
        expect(result).toBeNull()
    })

    it('returns null when args has neither nodeId nor targetId', () => {
        const result = enrichToolCall(
            'flint_ast_mutate',
            { mutations: [{ type: 'updateClassName', args: { className: 'bg-blue-500' } }] },
            ctx,
        )
        expect(result).toBeNull()
    })

    it('returns null when nodeId is an empty string', () => {
        const result = enrichToolCall(
            'flint_ast_mutate',
            { mutations: [{ type: 'updateClassName', args: { nodeId: '' } }] },
            ctx,
        )
        expect(result).toBeNull()
    })
})

// ── Best-effort: never throws ─────────────────────────────────────────────────

describe('enrichToolCall — best-effort never-throw contract', () => {
    it('does not throw for completely malformed args', () => {
        const ctx = makeCtx({})
        expect(() => enrichToolCall('flint_ast_mutate', { mutations: 'not-an-array' as never }, ctx)).not.toThrow()
    })

    it('does not throw when args is an empty object', () => {
        const ctx = makeCtx({})
        expect(() => enrichToolCall('flint_fix', {}, ctx)).not.toThrow()
    })

    it('preamble includes separator lines (--- markers)', () => {
        const ctx = makeCtx({ affectedNodeIds: ['n1'] })
        const result = enrichToolCall(
            'flint_ast_mutate',
            { mutations: [{ type: 'updateClassName', args: { nodeId: 'n1' } }] },
            ctx,
        )
        expect(result?.contextPreamble).toContain('---')
    })

    it('contextPreamble is a non-empty string', () => {
        const ctx = makeCtx({})
        const result = enrichToolCall(
            'flint_ast_mutate',
            { mutations: [{ type: 'updateClassName', args: { nodeId: 'flint-x' } }] },
            ctx,
        )
        expect(typeof result?.contextPreamble).toBe('string')
        expect((result?.contextPreamble ?? '').length).toBeGreaterThan(10)
    })
})

// ── Helpers for enrichToolResult tests ───────────────────────────────────────

function createTempProject(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-enricher-test-'))
    fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
    return tmpDir
}

function cleanupDir(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
}

/** Minimal TSX with sibling nodes for AST extraction tests */
const FIXTURE_COMPONENT = `
import React from 'react'
export function Card() {
    return (
        <section data-flint-id="card-root" className="p-4 bg-white">
            <div data-flint-id="card-header" className="text-xl font-bold">
                <span data-flint-id="card-title" className="text-blue-500">Hello</span>
                <span data-flint-id="card-subtitle">World</span>
            </div>
            <p data-flint-id="card-body" data-testid="body-para" className="text-sm">
                Body text
            </p>
        </section>
    )
}
`

// ── isEnrichableTool ──────────────────────────────────────────────────────────

describe('isEnrichableTool', () => {
    it('returns true for flint_ast_mutate', () => {
        expect(isEnrichableTool('flint_ast_mutate')).toBe(true)
    })
    it('returns true for flint_fix', () => {
        expect(isEnrichableTool('flint_fix')).toBe(true)
    })
    it('returns true for flint_audit', () => {
        expect(isEnrichableTool('flint_audit')).toBe(true)
    })
    it('returns false for flint_status', () => {
        expect(isEnrichableTool('flint_status')).toBe(false)
    })
    it('returns false for flint_query_registry', () => {
        expect(isEnrichableTool('flint_query_registry')).toBe(false)
    })
    it('returns false for flint_get_context', () => {
        expect(isEnrichableTool('flint_get_context')).toBe(false)
    })
    it('returns false for empty string', () => {
        expect(isEnrichableTool('')).toBe(false)
    })
})

// ── enrichToolResult — mutation tool gets node context preamble (ACX-18 ext) ──

describe('enrichToolResult — mutation tool result gets context preamble', () => {
    let projectRoot: string
    let componentPath: string

    beforeEach(() => {
        projectRoot = createTempProject()
        componentPath = path.join(projectRoot, 'src', 'Card.tsx')
        fs.writeFileSync(componentPath, FIXTURE_COMPONENT, 'utf-8')
    })

    afterEach(() => { cleanupDir(projectRoot) })

    it('prepends Flint Context Preamble to flint_ast_mutate result', () => {
        const original = '{"mutationsApplied": 1, "batchId": "abc"}'
        const enriched = enrichToolResult(
            'flint_ast_mutate',
            {
                targetPath: componentPath,
                mutations: [{ type: 'updateClassName', args: { nodeId: 'card-body', className: 'text-base' } }],
            },
            original,
            projectRoot,
        )
        expect(enriched).toContain('Flint Context Preamble')
        expect(enriched).toContain('card-body')
        // Original content preserved after preamble
        expect(enriched).toContain('"mutationsApplied": 1')
    })

    it('extracts className from AST and includes it in preamble', () => {
        const enriched = enrichToolResult(
            'flint_ast_mutate',
            {
                targetPath: componentPath,
                mutations: [{ type: 'updateClassName', args: { nodeId: 'card-body', className: 'text-base' } }],
            },
            '{"ok": true}',
            projectRoot,
        )
        // card-body has className="text-sm" in the fixture
        expect(enriched).toContain('text-sm')
    })

    it('ACX-23: includes parent flint-id in preamble', () => {
        const enriched = enrichToolResult(
            'flint_ast_mutate',
            {
                targetPath: componentPath,
                mutations: [{ type: 'updateClassName', args: { nodeId: 'card-title', className: 'text-lg' } }],
            },
            '{"ok": true}',
            projectRoot,
        )
        // card-title's parent is card-header
        expect(enriched).toContain('card-header')
    })

    it('ACX-23: includes sibling node IDs in preamble', () => {
        const enriched = enrichToolResult(
            'flint_ast_mutate',
            {
                targetPath: componentPath,
                mutations: [{ type: 'updateText', args: { nodeId: 'card-title', text: 'Updated' } }],
            },
            '{"ok": true}',
            projectRoot,
        )
        // card-title's sibling is card-subtitle
        expect(enriched).toContain('card-subtitle')
    })

    it('ACX-23: includes additional props (non-className) in preamble', () => {
        const enriched = enrichToolResult(
            'flint_ast_mutate',
            {
                targetPath: componentPath,
                mutations: [{ type: 'updateProp', args: { nodeId: 'card-body', propName: 'id', value: 'x' } }],
            },
            '{"ok": true}',
            projectRoot,
        )
        // card-body has data-testid="body-para"
        expect(enriched).toContain('data-testid')
    })

    it('prepends context preamble to flint_fix result', () => {
        const original = '{"fixedSource": "...", "fixesApplied": 2}'
        const enriched = enrichToolResult(
            'flint_fix',
            { source: FIXTURE_COMPONENT, filePath: componentPath },
            original,
            projectRoot,
        )
        expect(enriched).toContain('Flint Context Preamble')
        expect(enriched).toContain('"fixesApplied": 2')
    })
})

// ── enrichToolResult — audit tool appends token context (ACX-19) ──────────────

describe('enrichToolResult — audit tool result gets token context appended', () => {
    let projectRoot: string

    beforeEach(() => { projectRoot = createTempProject() })
    afterEach(() => { cleanupDir(projectRoot) })

    it('appends Flint Token Context block when violations exist', () => {
        const auditResult = JSON.stringify({
            violations: [
                { ruleId: 'MITHRIL-COL', severity: 'amber', message: 'Color drift', type: 'color-drift' },
                { ruleId: 'MITHRIL-COL', severity: 'amber', message: 'Color drift 2', type: 'color-drift' },
                { ruleId: 'A11Y-001', severity: 'critical', message: 'Missing alt', type: 'a11y' },
            ],
            mithrilCount: 2,
            a11yCount: 1,
            policyMode: { mithril: 'warn', a11y: 'error' },
        })
        const enriched = enrichToolResult(
            'flint_audit',
            { source: '...', filePath: '/tmp/test.tsx' },
            auditResult,
            projectRoot,
        )
        expect(enriched).toContain('Flint Token Context')
        expect(enriched).toContain('Top violated categories')
        expect(enriched).toContain('Suggested fixes')
        // Original content preserved (compact JSON — no spaces)
        expect(enriched).toContain('"mithrilCount":2')
    })

    it('returns original result unchanged when no violations', () => {
        const auditResult = JSON.stringify({
            violations: [],
            mithrilCount: 0,
            a11yCount: 0,
            policyMode: { mithril: 'warn', a11y: 'error' },
        })
        const enriched = enrichToolResult('flint_audit', {}, auditResult, projectRoot)
        expect(enriched).toBe(auditResult)
    })

    it('uses token names from design-tokens.json in suggestions', () => {
        const tokens = [
            { id: 1, token_path: 'color/brand/primary', token_type: 'color', token_value: '#0062ff', description: null, collection_name: 'brand', mode: 'default' },
        ]
        fs.writeFileSync(
            path.join(projectRoot, '.flint', 'design-tokens.json'),
            JSON.stringify(tokens),
            'utf-8',
        )
        const auditResult = JSON.stringify({
            violations: [{ ruleId: 'MITHRIL-COL', severity: 'amber', message: 'Color drift', type: 'color-drift' }],
            mithrilCount: 1,
            a11yCount: 0,
            policyMode: { mithril: 'warn', a11y: 'error' },
        })
        const enriched = enrichToolResult('flint_audit', {}, auditResult, projectRoot)
        expect(enriched).toContain('color/brand/primary')
    })
})

// ── enrichToolResult — read-only tools pass through (ACX-20) ─────────────────

describe('enrichToolResult — read-only tools pass through unchanged', () => {
    let projectRoot: string
    beforeEach(() => { projectRoot = createTempProject() })
    afterEach(() => { cleanupDir(projectRoot) })

    const READ_ONLY = [
        'flint_status',
        'flint_query_registry',
        'flint_get_context',
        'flint_assess_complexity',
        'flint_debt_report',
    ]

    for (const toolName of READ_ONLY) {
        it(`returns original string unchanged for ${toolName}`, () => {
            const original = `{"result": "data-for-${toolName}"}`
            expect(enrichToolResult(toolName, {}, original, projectRoot)).toBe(original)
        })
    }
})

// ── enrichToolResult — missing file graceful degradation (ACX-21) ─────────────

describe('enrichToolResult — missing file returns graceful result', () => {
    let projectRoot: string
    beforeEach(() => { projectRoot = createTempProject() })
    afterEach(() => { cleanupDir(projectRoot) })

    it('does not throw when targetPath does not exist', () => {
        expect(() => {
            enrichToolResult(
                'flint_ast_mutate',
                { targetPath: '/nonexistent/Component.tsx', mutations: [{ type: 'updateClassName', args: { nodeId: 'x' } }] },
                '{"ok": true}',
                projectRoot,
            )
        }).not.toThrow()
    })

    it('does not throw when .flint directory is absent', () => {
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-no-flint-'))
        try {
            expect(() => {
                enrichToolResult('flint_fix', { filePath: '/tmp/test.tsx', source: '' }, '{"ok": true}', emptyDir)
            }).not.toThrow()
        } finally {
            cleanupDir(emptyDir)
        }
    })

    it('returns original audit result unchanged when audit JSON is malformed', () => {
        const malformed = 'not valid json {{{'
        const result = enrichToolResult('flint_audit', {}, malformed, projectRoot)
        expect(result).toBe(malformed)
    })

    it('returns original audit result unchanged when audit JSON is empty', () => {
        const result = enrichToolResult('flint_audit', {}, '', projectRoot)
        expect(result).toBe('')
    })
})

// ── Performance budget < 20ms (ACX-22) ───────────────────────────────────────

describe('enrichToolResult — performance budget < 20ms', () => {
    let projectRoot: string
    let componentPath: string

    beforeEach(() => {
        projectRoot = createTempProject()
        componentPath = path.join(projectRoot, 'src', 'Card.tsx')
        fs.writeFileSync(componentPath, FIXTURE_COMPONENT, 'utf-8')
    })

    afterEach(() => { cleanupDir(projectRoot) })

    it('completes flint_ast_mutate enrichment in < 20ms', () => {
        const start = performance.now()
        enrichToolResult(
            'flint_ast_mutate',
            { targetPath: componentPath, mutations: [{ type: 'updateClassName', args: { nodeId: 'card-body', className: 'text-base' } }] },
            '{"mutationsApplied": 1}',
            projectRoot,
        )
        expect(performance.now() - start).toBeLessThan(20)
    })

    it('completes flint_fix enrichment in < 20ms', () => {
        const start = performance.now()
        enrichToolResult(
            'flint_fix',
            { source: FIXTURE_COMPONENT, filePath: componentPath },
            '{"fixedSource": "...", "fixesApplied": 0}',
            projectRoot,
        )
        expect(performance.now() - start).toBeLessThan(20)
    })

    it('completes flint_audit enrichment in < 20ms', () => {
        const tokens = Array.from({ length: 50 }, (_, i) => ({
            id: i, token_path: `color/brand/${i}`, token_type: 'color',
            token_value: `#${i.toString(16).padStart(6, '0')}`, description: null,
            collection_name: 'brand', mode: 'default',
        }))
        fs.writeFileSync(path.join(projectRoot, '.flint', 'design-tokens.json'), JSON.stringify(tokens), 'utf-8')
        const auditResult = JSON.stringify({
            violations: Array.from({ length: 10 }, (_, i) => ({
                ruleId: 'MITHRIL-COL', severity: 'amber', message: `Drift ${i}`, type: 'color-drift',
            })),
            mithrilCount: 10, a11yCount: 0,
            policyMode: { mithril: 'warn', a11y: 'error' },
        })
        const start = performance.now()
        enrichToolResult('flint_audit', {}, auditResult, projectRoot)
        expect(performance.now() - start).toBeLessThan(20)
    })

    it('completes enrichToolCall with real AST file in < 20ms', () => {
        const ctx = makeCtx({ activeFilePath: componentPath })
        const start = performance.now()
        enrichToolCall(
            'flint_ast_mutate',
            { targetPath: componentPath, mutations: [{ type: 'updateClassName', args: { nodeId: 'card-title', className: 'text-lg' } }] },
            ctx,
        )
        expect(performance.now() - start).toBeLessThan(20)
    })
})
