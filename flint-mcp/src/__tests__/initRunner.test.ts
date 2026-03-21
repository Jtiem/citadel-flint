/**
 * initRunner tests — flint-mcp/src/__tests__/initRunner.test.ts
 *
 * Validates the Flint zero-config init orchestration. All collaborators
 * (stackDetector, tokenExtractor, componentIndexer, mcpConfigWriter) and
 * all Node fs calls are mocked so tests run disk-free and deterministically.
 *
 * Test map:
 *   1  — Full happy path: all steps succeed, audit runs
 *   2  — Skips token extraction when tokens already exist
 *   3  — Extracts tokens when forceTokens=true even if tokens exist
 *   4  — Handles zero components gracefully (audit skipped)
 *   5  — Handles zero tokens gracefully (audit skipped)
 *   6  — Creates .flint/ directory if missing
 *   7  — Health score calculation: critical=10, warning=1, advisory=0.5
 *   8  — Grade assignment: A/B/C/D/F thresholds
 *   9  — Top violations correctly aggregated across files
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock collaborator modules ─────────────────────────────────────────────────

vi.mock('../core/init/stackDetector.js', () => ({
    detectStack: vi.fn(),
}))

vi.mock('../core/init/tokenExtractor.js', () => ({
    extractTokens: vi.fn(),
}))

vi.mock('../core/init/componentIndexer.js', () => ({
    indexComponents: vi.fn(),
}))

vi.mock('../core/init/mcpConfigWriter.js', () => ({
    writeMcpConfig: vi.fn(),
}))

// Mock MithrilLinter.auditAll and A11yLinter.auditStructured
vi.mock('../core/MithrilLinter.js', () => ({
    auditAll: vi.fn(),
    MITHRIL_THRESHOLD: 2.0,
}))

vi.mock('../core/A11yLinter.js', () => ({
    A11yLinter: {
        auditStructured: vi.fn(),
    },
}))

// Mock @babel/parser so we don't need real source files
vi.mock('@babel/parser', () => ({
    parse: vi.fn(),
}))

// Mock node:fs
vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import fs from 'node:fs'
import { parse } from '@babel/parser'
import { detectStack } from '../core/init/stackDetector.js'
import { extractTokens } from '../core/init/tokenExtractor.js'
import { indexComponents } from '../core/init/componentIndexer.js'
import { writeMcpConfig } from '../core/init/mcpConfigWriter.js'
import { auditAll } from '../core/MithrilLinter.js'
import { A11yLinter } from '../core/A11yLinter.js'
import { runInit, computeInitHealthScore, scoreToGrade } from '../core/init/initRunner.js'
import type { StackDetectionResult, TokenExtractionResult } from '../core/init/types.js'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const MOCK_STACK: StackDetectionResult = {
    framework: 'tailwind-v3',
    configPath: 'tailwind.config.ts',
    cssFiles: [],
    tokenFiles: [],
    packageDeps: [],
    uiFramework: 'react',
    typescript: true,
}

const MOCK_TOKENS = [
    { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#3b82f6', description: null, collection_name: 'global', mode: 'default' },
    { id: 2, token_path: 'color.secondary', token_type: 'color', token_value: '#10b981', description: null, collection_name: 'global', mode: 'default' },
    { id: 3, token_path: 'spacing.base', token_type: 'dimension', token_value: '16px', description: null, collection_name: 'global', mode: 'default' },
]

const MOCK_EXTRACTION_RESULT: TokenExtractionResult = {
    tokens: MOCK_TOKENS,
    source: 'tailwind.config.ts',
    warnings: [],
}

const MOCK_COMPONENT_RESULT = {
    count: 5,
    components: {
        Button: { importPath: '@/components/Button', componentName: 'Button', propMap: {} },
        Input: { importPath: '@/components/Input', componentName: 'Input', propMap: {} },
    },
    filePaths: [
        '/proj/src/components/Button.tsx',
        '/proj/src/components/Input.tsx',
    ],
}

const MOCK_MCP_CONFIG = {
    written: true,
    path: '/proj/.claude/mcp.json',
    message: 'Flint MCP server registered',
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setupHappyPathMocks(): void {
    // detectStack
    vi.mocked(detectStack).mockResolvedValue(MOCK_STACK)

    // extractTokens
    vi.mocked(extractTokens).mockResolvedValue(MOCK_EXTRACTION_RESULT)

    // indexComponents
    vi.mocked(indexComponents).mockResolvedValue(MOCK_COMPONENT_RESULT as any)

    // writeMcpConfig
    vi.mocked(writeMcpConfig).mockReturnValue(MOCK_MCP_CONFIG)

    // fs: .flint/ does NOT exist yet (triggers mkdir)
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const s = String(p)
        if (s.endsWith('design-tokens.json')) return false
        if (s.endsWith('.flint')) return false
        if (s.endsWith('policy.json')) return false
        if (s.endsWith('flint-manifest.json')) return false
        return false
    })

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

    // @babel/parser — return a minimal AST object
    vi.mocked(parse).mockReturnValue({ type: 'File', program: { body: [] } } as any)

    // MithrilLinter — return empty violations by default
    vi.mocked(auditAll).mockReturnValue(new Map())

    // A11yLinter — return empty violations by default
    vi.mocked(A11yLinter.auditStructured).mockReturnValue({
        violations: [],
        filePath: 'unknown',
        totalViolations: 0,
    } as any)

    // fs.readFileSync for component files
    vi.mocked(fs.readFileSync).mockReturnValue('const x = 1' as any)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runInit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    // ── Test 1: Full happy path ───────────────────────────────────────────────

    it('full happy path: detects stack, extracts tokens, indexes components, configures MCP, runs audit', async () => {
        setupHappyPathMocks()

        const result = await runInit({ projectRoot: '/proj', quiet: true })

        expect(detectStack).toHaveBeenCalledWith('/proj')
        expect(extractTokens).toHaveBeenCalledWith('/proj', MOCK_STACK)
        expect(indexComponents).toHaveBeenCalledWith('/proj', undefined)
        expect(writeMcpConfig).toHaveBeenCalledWith('/proj')

        expect(result.stack).toEqual(MOCK_STACK)
        expect(result.tokensExtracted).toBe(3)
        expect(result.tokenSource).toBe('tailwind.config.ts')
        expect(result.componentsIndexed).toBe(5)
        expect(result.mcpConfigured).toBe(true)
        // Audit ran (tokens > 0, components > 0)
        expect(result.healthScore).not.toBeNull()
        expect(result.grade).not.toBeNull()
    })

    // ── Test 2: Skips extraction when tokens exist ────────────────────────────

    it('skips token extraction when .flint/design-tokens.json exists and is non-empty', async () => {
        setupHappyPathMocks()

        // Override fs to simulate tokens existing
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            const s = String(p)
            if (s.endsWith('design-tokens.json')) return true
            if (s.endsWith('policy.json')) return true
            return false
        })

        vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathLike | number, ...args: any[]) => {
            const s = String(p)
            if (s.endsWith('design-tokens.json')) {
                return JSON.stringify(MOCK_TOKENS) as any
            }
            return 'const x = 1' as any
        })

        const result = await runInit({ projectRoot: '/proj', quiet: true })

        expect(extractTokens).not.toHaveBeenCalled()
        expect(result.tokensExtracted).toBe(3)
        expect(result.tokenSource).toBe('existing')
    })

    // ── Test 3: forceTokens overrides existing tokens ─────────────────────────

    it('re-extracts tokens when forceTokens=true even if tokens exist', async () => {
        setupHappyPathMocks()

        // Override fs to simulate tokens existing
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            const s = String(p)
            if (s.endsWith('design-tokens.json')) return true
            if (s.endsWith('.flint')) return true
            if (s.endsWith('policy.json')) return true
            return false
        })

        vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathLike | number, ...args: any[]) => {
            const s = String(p)
            if (s.endsWith('design-tokens.json')) {
                return JSON.stringify(MOCK_TOKENS) as any
            }
            if (s.endsWith('flint-manifest.json')) {
                return JSON.stringify({ version: '2.0', resolvers: [], components: {} }) as any
            }
            return 'const x = 1' as any
        })

        const result = await runInit({ projectRoot: '/proj', forceTokens: true, quiet: true })

        expect(extractTokens).toHaveBeenCalledWith('/proj', MOCK_STACK)
        expect(result.tokensExtracted).toBe(3)
        expect(result.tokenSource).toBe('tailwind.config.ts')
    })

    // ── Test 4: Zero components — audit skipped ───────────────────────────────

    it('handles zero components gracefully and skips the governance audit', async () => {
        setupHappyPathMocks()

        vi.mocked(indexComponents).mockResolvedValue({
            count: 0,
            components: {},
            filePaths: [],
        } as any)

        const result = await runInit({ projectRoot: '/proj', quiet: true })

        expect(result.componentsIndexed).toBe(0)
        // Audit should be skipped when componentsIndexed === 0
        expect(result.healthScore).toBeNull()
        expect(result.grade).toBeNull()
        expect(auditAll).not.toHaveBeenCalled()
        expect(A11yLinter.auditStructured).not.toHaveBeenCalled()
    })

    // ── Test 5: Zero tokens — audit skipped ───────────────────────────────────

    it('handles zero tokens gracefully and skips the governance audit', async () => {
        setupHappyPathMocks()

        vi.mocked(extractTokens).mockResolvedValue({
            tokens: [],
            source: 'none',
            warnings: [],
        })

        const result = await runInit({ projectRoot: '/proj', quiet: true })

        expect(result.tokensExtracted).toBe(0)
        // Audit should be skipped when tokensExtracted === 0
        expect(result.healthScore).toBeNull()
        expect(result.grade).toBeNull()
    })

    // ── Test 6: Creates .flint/ directory if missing ─────────────────────────

    it('creates .flint/ directory if it does not exist before writing tokens', async () => {
        setupHappyPathMocks()

        // .flint/ dir does NOT exist
        vi.mocked(fs.existsSync).mockReturnValue(false)

        await runInit({ projectRoot: '/proj', quiet: true })

        expect(fs.mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('.flint'),
            { recursive: true },
        )
    })

    // ── Test 7: Health score calculation ─────────────────────────────────────

    it('computes health score correctly: critical*10 + warning*1 + advisory*0.5', () => {
        expect(computeInitHealthScore(0, 0, 0)).toBe(100)
        expect(computeInitHealthScore(1, 0, 0)).toBe(90)   // 100 - 10
        expect(computeInitHealthScore(0, 10, 0)).toBe(90)  // 100 - 10
        expect(computeInitHealthScore(0, 0, 20)).toBe(90)  // 100 - 10
        expect(computeInitHealthScore(2, 5, 10)).toBe(70)  // 100 - 20 - 5 - 5
        expect(computeInitHealthScore(10, 0, 0)).toBe(0)   // 100 - 100 = 0
        expect(computeInitHealthScore(20, 0, 0)).toBe(0)   // clamped to 0
        expect(computeInitHealthScore(0, 0, 4)).toBe(98)   // 100 - 2 rounded
    })

    // ── Test 8: Grade assignment ──────────────────────────────────────────────

    it('assigns correct letter grades: A>=90, B>=80, C>=70, D>=60, F<60', () => {
        expect(scoreToGrade(100)).toBe('A')
        expect(scoreToGrade(90)).toBe('A')
        expect(scoreToGrade(89)).toBe('B')
        expect(scoreToGrade(80)).toBe('B')
        expect(scoreToGrade(79)).toBe('C')
        expect(scoreToGrade(70)).toBe('C')
        expect(scoreToGrade(69)).toBe('D')
        expect(scoreToGrade(60)).toBe('D')
        expect(scoreToGrade(59)).toBe('F')
        expect(scoreToGrade(0)).toBe('F')
    })

    // ── Test 9: Top violations aggregated across files ────────────────────────

    it('aggregates top violations correctly across multiple component files', async () => {
        setupHappyPathMocks()

        // Three files with different violation patterns
        vi.mocked(indexComponents).mockResolvedValue({
            count: 3,
            components: { A: {}, B: {}, C: {} },
            filePaths: [
                '/proj/src/A.tsx',
                '/proj/src/B.tsx',
                '/proj/src/C.tsx',
            ],
        } as any)

        vi.mocked(fs.readFileSync).mockReturnValue('const x = 1' as any)

        // File A: 3 MITHRIL-COL violations
        vi.mocked(auditAll)
            .mockReturnValueOnce(new Map([
                ['el-1', { id: 'el-1', message: 'MITHRIL-COL: red', severity: 'amber', type: 'color-drift', value: 5, nearestToken: null, nearestTokenValue: null }],
                ['el-2', { id: 'el-2', message: 'MITHRIL-COL: blue', severity: 'amber', type: 'color-drift', value: 5, nearestToken: null, nearestTokenValue: null }],
                ['el-3', { id: 'el-3', message: 'MITHRIL-COL: green', severity: 'amber', type: 'color-drift', value: 5, nearestToken: null, nearestTokenValue: null }],
            ]))
            // File B: 2 A11Y-001 via mithril (no mithril hits), A11y linter handles these
            .mockReturnValueOnce(new Map())
            // File C: 1 MITHRIL-COL
            .mockReturnValueOnce(new Map([
                ['el-4', { id: 'el-4', message: 'MITHRIL-COL: purple', severity: 'amber', type: 'color-drift', value: 5, nearestToken: null, nearestTokenValue: null }],
            ]))

        vi.mocked(A11yLinter.auditStructured)
            // File A: no a11y
            .mockReturnValueOnce({ violations: [], filePath: 'A.tsx', totalViolations: 0 } as any)
            // File B: 2 A11Y-001 violations
            .mockReturnValueOnce({
                violations: [
                    { ruleId: 'A11Y-001', message: 'Missing alt', elementId: 'img-1', wcag: '1.1.1', severity: 'critical' },
                    { ruleId: 'A11Y-001', message: 'Missing alt', elementId: 'img-2', wcag: '1.1.1', severity: 'critical' },
                ],
                filePath: 'B.tsx',
                totalViolations: 2,
            } as any)
            // File C: no a11y
            .mockReturnValueOnce({ violations: [], filePath: 'C.tsx', totalViolations: 0 } as any)

        const result = await runInit({ projectRoot: '/proj', quiet: true })

        // MITHRIL-COL appears 4 times total (3 in A, 1 in C)
        // A11Y-001 appears 2 times (in B)
        expect(result.topViolations.length).toBeGreaterThan(0)

        const mithrilEntry = result.topViolations.find((v) => v.rule === 'MITHRIL-COL')
        const a11yEntry = result.topViolations.find((v) => v.rule === 'A11Y-001')

        expect(mithrilEntry).toBeDefined()
        expect(mithrilEntry?.count).toBe(4)

        expect(a11yEntry).toBeDefined()
        expect(a11yEntry?.count).toBe(2)

        // MITHRIL-COL should rank first
        expect(result.topViolations[0].rule).toBe('MITHRIL-COL')
        expect(result.topViolations[0].count).toBe(4)

        // Violation severity buckets
        // 3+1=4 amber (warning) from Mithril, 2 critical from A11y
        expect(result.violations.critical).toBe(2)
        expect(result.violations.warning).toBe(4)
    })

    // ── Console output: header is printed ────────────────────────────────────

    it('prints the init header to console when quiet=false', async () => {
        setupHappyPathMocks()
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

        await runInit({ projectRoot: '/proj', quiet: false })

        const calls = consoleSpy.mock.calls.map((c) => c[0])
        expect(calls.some((c: string) => c.includes('Flint'))).toBe(true)
        expect(calls.some((c: string) => c.includes('Zero-Config Init'))).toBe(true)

        consoleSpy.mockRestore()
    })

    // ── Console output: suppressed in quiet mode ──────────────────────────────

    it('suppresses all console output when quiet=true', async () => {
        setupHappyPathMocks()
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

        await runInit({ projectRoot: '/proj', quiet: true })

        expect(consoleSpy).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    // ── Passes srcDir to indexComponents ─────────────────────────────────────

    it('passes srcDir option through to indexComponents', async () => {
        setupHappyPathMocks()

        await runInit({ projectRoot: '/proj', srcDir: 'packages/ui/src', quiet: true })

        expect(indexComponents).toHaveBeenCalledWith('/proj', 'packages/ui/src')
    })
})
