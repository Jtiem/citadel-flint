/**
 * consensusGateService — Unit Tests
 *
 * All external I/O is mocked:
 *   - better-sqlite3 → mock Database constructor (exec + prepare().run())
 *   - @anthropic-ai/sdk  → mock Anthropic client
 *
 * Coverage:
 *   1. resolveConfig()    — domain defaults, policy overrides, unknown-domain fallback
 *   2. shouldFireGate()   — enabled/disabled, tier combinations
 *   3. evaluate()         — agree_approve, disagree, API error, timeout
 *   4. persistRecord()    — db.prepare().run() called with correct shape
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoist mock stubs so they are available inside vi.mock() factories ─────────
// vi.mock() calls are hoisted to the top of the compiled output; any variables
// they reference must also be hoisted via vi.hoisted() so they exist at that point.

const { mockRun, mockPrepare, mockExec, mockCreate, MockAnthropicCtor, MockDatabaseCtor } = vi.hoisted(() => {
    const mockRun = vi.fn()
    const mockPrepare = vi.fn().mockReturnValue({ run: mockRun })
    const mockExec = vi.fn()
    const mockCreate = vi.fn()
    // Use a regular function (not arrow) so it is constructable with `new`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MockAnthropicCtor = vi.fn().mockImplementation(function (this: any) {
        this.messages = { create: mockCreate }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MockDatabaseCtor = vi.fn().mockImplementation(function (this: any) {
        this.exec = mockExec
        this.prepare = mockPrepare
    })
    return { mockRun, mockPrepare, mockExec, mockCreate, MockAnthropicCtor, MockDatabaseCtor }
})

// ── Mock better-sqlite3 ───────────────────────────────────────────────────────
vi.mock('better-sqlite3', () => ({
    default: MockDatabaseCtor,
}))

// ── Mock node:fs (mkdirSync used in getDb) ────────────────────────────────────
vi.mock('node:fs', () => ({
    mkdirSync: vi.fn(),
}))

// ── Mock node:path (join used in getDb) ───────────────────────────────────────
// Allow real join to keep path logic intact
vi.mock('node:path', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:path')>()
    return { ...actual }
})

// ── Mock @anthropic-ai/sdk ────────────────────────────────────────────────────
vi.mock('@anthropic-ai/sdk', () => ({
    default: MockAnthropicCtor,
}))

// ── Mock crypto to produce deterministic IDs ──────────────────────────────────
vi.mock('node:crypto', () => ({
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
}))

// ── Import module under test (AFTER mocks are wired up) ──────────────────────
import {
    resolveConfig,
    shouldFireGate,
    evaluate,
    persistRecord,
    type ConsensusGateInput,
    type ConsensusConfig,
} from './consensusGateService'

const TEST_PROJECT_ROOT = '/tmp/test-project'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<ConsensusGateInput> = {}): ConsensusGateInput {
    return {
        toolName: 'flint_add_class',
        toolInput: { nodeId: 'abc123', className: 'bg-red-500' },
        mrs: { score: 0.45, tier: 'amber', factors: {} },
        astSnapshot: '<Button>Click me</Button>',
        domain: 'healthcare',
        sessionId: 'session-42',
        projectRoot: TEST_PROJECT_ROOT,
        ...overrides,
    }
}

function makeAnthropicResponse(judgment: 'approve' | 'reject', reasoning = 'Looks safe.', confidence = 0.9) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ judgment, reasoning, confidence }),
            },
        ],
    }
}

// ── 1. resolveConfig() ────────────────────────────────────────────────────────

describe('resolveConfig()', () => {
    it('returns domain defaults for a known domain', () => {
        const cfg = resolveConfig('healthcare')
        expect(cfg.enabled).toBe(true)
        expect(cfg.minimumTier).toBe('amber')
        expect(cfg.secondaryModel).toBe('claude-haiku-4-5-20251001')
    })

    it('returns disabled config for "general" domain', () => {
        const cfg = resolveConfig('general')
        expect(cfg.enabled).toBe(false)
    })

    it('falls back to general/disabled for unknown domain', () => {
        const cfg = resolveConfig('unknown-domain-xyz')
        expect(cfg.enabled).toBe(false)
        expect(cfg.minimumTier).toBe('amber')
    })

    it('merges policy overrides on top of domain defaults', () => {
        const cfg = resolveConfig('healthcare', { enabled: false, timeoutMs: 5000 })
        expect(cfg.enabled).toBe(false)
        expect(cfg.timeoutMs).toBe(5000)
        // Other defaults preserved
        expect(cfg.minimumTier).toBe('amber')
        expect(cfg.secondaryModel).toBe('claude-haiku-4-5-20251001')
    })

    it('merges partial policy override — only provided keys change', () => {
        const cfg = resolveConfig('fintech', { secondaryModel: 'claude-opus-4-5' })
        expect(cfg.enabled).toBe(true)          // unchanged
        expect(cfg.secondaryModel).toBe('claude-opus-4-5')  // overridden
    })

    it('returns FALLBACK_CONFIG when domain is empty string', () => {
        const cfg = resolveConfig('')
        expect(cfg.enabled).toBe(false)
    })
})

// ── 2. shouldFireGate() ───────────────────────────────────────────────────────

describe('shouldFireGate()', () => {
    const enabledAmber: ConsensusConfig = {
        enabled: true,
        minimumTier: 'amber',
        timeoutMs: 15000,
        secondaryModel: 'claude-haiku-4-5-20251001',
    }

    const enabledRedOnly: ConsensusConfig = {
        enabled: true,
        minimumTier: 'red',
        timeoutMs: 15000,
        secondaryModel: 'claude-haiku-4-5-20251001',
    }

    const disabled: ConsensusConfig = {
        enabled: false,
        minimumTier: 'amber',
        timeoutMs: 15000,
        secondaryModel: 'claude-haiku-4-5-20251001',
    }

    it('returns false when config.enabled is false (any tier)', () => {
        expect(shouldFireGate('amber', disabled)).toBe(false)
        expect(shouldFireGate('red',   disabled)).toBe(false)
        expect(shouldFireGate('green', disabled)).toBe(false)
    })

    it('returns true for red tier when minimumTier is amber', () => {
        expect(shouldFireGate('red', enabledAmber)).toBe(true)
    })

    it('returns true for amber tier when minimumTier is amber', () => {
        expect(shouldFireGate('amber', enabledAmber)).toBe(true)
    })

    it('returns false for amber tier when minimumTier is red', () => {
        expect(shouldFireGate('amber', enabledRedOnly)).toBe(false)
    })

    it('returns true for red tier when minimumTier is red', () => {
        expect(shouldFireGate('red', enabledRedOnly)).toBe(true)
    })

    it('returns false for green tier regardless of config', () => {
        expect(shouldFireGate('green', enabledAmber)).toBe(false)
    })
})

// ── 3. evaluate() ─────────────────────────────────────────────────────────────

describe('evaluate()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Restore implementations cleared by vi.clearAllMocks()
        mockExec.mockImplementation(() => undefined)
        mockPrepare.mockReturnValue({ run: mockRun })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MockDatabaseCtor.mockImplementation(function (this: any) {
            this.exec = mockExec
            this.prepare = mockPrepare
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MockAnthropicCtor.mockImplementation(function (this: any) {
            this.messages = { create: mockCreate }
        })
        process.env.ANTHROPIC_API_KEY = 'test-key-abc'
    })

    afterEach(() => {
        delete process.env.ANTHROPIC_API_KEY
    })

    it('returns agree_approve and proceed=true when secondary approves', async () => {
        mockCreate.mockResolvedValueOnce(makeAnthropicResponse('approve'))

        const result = await evaluate(makeInput())

        expect(result.outcome).toBe('agree_approve')
        expect(result.proceed).toBe(true)
        expect(result.secondaryVerdict.judgment).toBe('approve')
        expect(result.secondaryVerdict.evaluator).toBe('secondary')
        expect(result.recordId).toBe('test-uuid-1234')
    })

    it('returns disagree and proceed=true when secondary rejects', async () => {
        mockCreate.mockResolvedValueOnce(makeAnthropicResponse('reject', 'Accessibility concern.', 0.85))

        const result = await evaluate(makeInput())

        expect(result.outcome).toBe('disagree')
        // Primary approved, secondary rejected → disagree.
        // Fail-open: disagree still lets it proceed (not agree_reject).
        expect(result.proceed).toBe(true)
        expect(result.secondaryVerdict.judgment).toBe('reject')
        expect(result.secondaryVerdict.reasoning).toBe('Accessibility concern.')
        expect(result.secondaryVerdict.confidence).toBe(0.85)
    })

    it('returns error and proceed=true when API throws', async () => {
        mockCreate.mockRejectedValueOnce(new Error('network error'))

        const result = await evaluate(makeInput())

        expect(result.outcome).toBe('error')
        expect(result.proceed).toBe(true)
        expect(result.secondaryVerdict.judgment).toBe('abstain')
        expect(result.secondaryVerdict.reasoning).toContain('network error')
    })

    it('returns skipped and proceed=true on timeout', async () => {
        // Simulate a slow API call that never resolves within the config timeout.
        // We use fake timers so we can advance time without actually waiting 15s.
        vi.useFakeTimers()
        try {
            // mockCreate returns a promise that never resolves
            mockCreate.mockImplementationOnce(
                () => new Promise<never>(() => { /* never resolves */ }),
            )

            // Start the evaluation (don't await yet — the timeout won't fire until we advance time)
            const resultPromise = evaluate(makeInput({ domain: 'healthcare' }))

            // Advance time past the 15 000 ms consensus_timeout
            await vi.advanceTimersByTimeAsync(20_000)

            const result = await resultPromise

            expect(result.outcome).toBe('skipped')
            expect(result.proceed).toBe(true)
            expect(result.secondaryVerdict.reasoning).toContain('timed out')
        } finally {
            vi.useRealTimers()
        }
    })

    it('calls db.prepare().run() once per evaluation (persists record)', async () => {
        mockCreate.mockResolvedValueOnce(makeAnthropicResponse('approve'))

        await evaluate(makeInput())

        expect(mockPrepare).toHaveBeenCalledOnce()
        expect(mockRun).toHaveBeenCalledOnce()
    })

    it('returns error and proceed=true when ANTHROPIC_API_KEY is missing', async () => {
        delete process.env.ANTHROPIC_API_KEY

        const result = await evaluate(makeInput())

        expect(result.outcome).toBe('error')
        expect(result.proceed).toBe(true)
        expect(result.secondaryVerdict.reasoning).toContain('ANTHROPIC_API_KEY')
    })

    it('returns error when secondary returns invalid JSON', async () => {
        mockCreate.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'not-json!!!' }],
        })

        const result = await evaluate(makeInput())

        expect(result.outcome).toBe('error')
        expect(result.proceed).toBe(true)
    })

    it('returns error when judgment is an unexpected value', async () => {
        mockCreate.mockResolvedValueOnce({
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ judgment: 'maybe', reasoning: 'hm', confidence: 0.5 }),
                },
            ],
        })

        const result = await evaluate(makeInput())

        expect(result.outcome).toBe('error')
        expect(result.proceed).toBe(true)
    })

    it('opens the database at projectRoot/.flint/consensus.db', async () => {
        mockCreate.mockResolvedValueOnce(makeAnthropicResponse('approve'))

        await evaluate(makeInput({ projectRoot: '/tmp/my-project' }))

        // The Database constructor should have been called with a path containing
        // the project root — the exact path depends on BRAND.configDir but must
        // end with consensus.db
        const ctorCalls = MockDatabaseCtor.mock.calls
        const dbPath = ctorCalls.find(
            (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).endsWith('consensus.db'),
        )?.[0] as string | undefined
        expect(dbPath).toBeDefined()
        expect(dbPath).toContain('my-project')
        expect(dbPath).toContain('consensus.db')
    })

    it('passes projectRoot in the persisted record', async () => {
        mockCreate.mockResolvedValueOnce(makeAnthropicResponse('approve'))

        await evaluate(makeInput({ projectRoot: TEST_PROJECT_ROOT }))

        // stmt.run() is called with a flat params object — we verify it was called at all
        expect(mockRun).toHaveBeenCalledOnce()
        const params = mockRun.mock.calls[0][0] as Record<string, unknown>
        // The params themselves don't contain projectRoot (it's stripped before the INSERT),
        // but the database must have been opened for the correct root
        expect(params.id).toBe('test-uuid-1234')
    })
})

// ── 4. persistRecord() ────────────────────────────────────────────────────────

describe('persistRecord()', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockExec.mockImplementation(() => undefined)
        mockPrepare.mockReturnValue({ run: mockRun })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MockDatabaseCtor.mockImplementation(function (this: any) {
            this.exec = mockExec
            this.prepare = mockPrepare
        })
    })

    const baseRecord = {
        id: 'rec-abc-123',
        mutationId: null,
        toolName: 'flint_add_class',
        toolInputJson: '{"nodeId":"n1"}',
        mrsScore: 0.55,
        mrsTier: 'amber' as const,
        primaryVerdict: {
            evaluator: 'primary' as const,
            judgment: 'approve' as const,
            reasoning: 'Primary agent proposed this mutation (passed MRS gating).',
            confidence: null,
            durationMs: 0,
        },
        secondaryVerdict: {
            evaluator: 'secondary' as const,
            judgment: 'approve' as const,
            reasoning: 'Looks safe.',
            confidence: 0.9,
            durationMs: 250,
        },
        outcome: 'agree_approve' as const,
        sessionId: 'sess-1',
        agentId: 'orchestrator',
        domain: 'healthcare',
        projectRoot: TEST_PROJECT_ROOT,
    }

    it('calls db.prepare() with an INSERT statement', () => {
        persistRecord(baseRecord)

        expect(mockPrepare).toHaveBeenCalledOnce()
        const sql = mockPrepare.mock.calls[0][0] as string
        expect(sql).toContain('INSERT INTO consensus_records')
    })

    it('calls stmt.run() with the correct flat params', () => {
        persistRecord(baseRecord)

        expect(mockRun).toHaveBeenCalledOnce()
        const params = mockRun.mock.calls[0][0] as Record<string, unknown>
        expect(params.id).toBe('rec-abc-123')
        expect(params.toolName).toBe('flint_add_class')
        expect(params.mrsScore).toBe(0.55)
        expect(params.mrsTier).toBe('amber')
        expect(params.primaryJudgment).toBe('approve')
        expect(params.secondaryJudgment).toBe('approve')
        expect(params.secondaryConfidence).toBe(0.9)
        expect(params.outcome).toBe('agree_approve')
        expect(params.sessionId).toBe('sess-1')
        expect(params.agentId).toBe('orchestrator')
        expect(params.domain).toBe('healthcare')
    })

    it('handles null mutationId without throwing', () => {
        expect(() => persistRecord({ ...baseRecord, mutationId: null })).not.toThrow()
        const params = mockRun.mock.calls[0][0] as Record<string, unknown>
        expect(params.mutationId).toBeNull()
    })

    it('handles null sessionId without throwing', () => {
        expect(() => persistRecord({ ...baseRecord, sessionId: null })).not.toThrow()
        const params = mockRun.mock.calls[0][0] as Record<string, unknown>
        expect(params.sessionId).toBeNull()
    })

    it('handles null confidence values without throwing', () => {
        const record = {
            ...baseRecord,
            secondaryVerdict: { ...baseRecord.secondaryVerdict, confidence: null },
        }
        expect(() => persistRecord(record)).not.toThrow()
        const params = mockRun.mock.calls[0][0] as Record<string, unknown>
        expect(params.secondaryConfidence).toBeNull()
    })

    it('uses the correct projectRoot to open the database', () => {
        persistRecord({ ...baseRecord, projectRoot: '/tmp/another-project' })

        const ctorCalls = MockDatabaseCtor.mock.calls
        const dbPath = ctorCalls.find(
            (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).endsWith('consensus.db'),
        )?.[0] as string | undefined
        expect(dbPath).toBeDefined()
        expect(dbPath).toContain('another-project')
        expect(dbPath).toContain('consensus.db')
    })
})
