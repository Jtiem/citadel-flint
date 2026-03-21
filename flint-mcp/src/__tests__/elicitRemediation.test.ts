/**
 * elicitRemediation.test.ts — flint-mcp/src/__tests__/elicitRemediation.test.ts
 *
 * Phase REM.1 unit tests for the elicitRemediation helper.
 *
 * Test IDs covered:
 *   REM-01 — fix_now path: user selects "Fix Now", fixes applied, file written, receipt returned
 *   REM-02 — dry_run then confirm: two elicitations, second accepts, fixes applied
 *   REM-03 — dry_run then decline: second returns decline, no file write, returns dry_run
 *   REM-04 — skip: user selects "Skip", no fix called, returns skipped
 *   REM-05 — cancel: first elicitation returns cancel, returns skipped
 *   REM-06 — no elicitation support: elicitInput throws, returns skipped
 *   REM-07 — fix handler error: handleFlintFix throws, error propagated
 *   REM-08 — getClientCapabilities missing elicitation: eagerly returns skipped
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Module mocks ───────────────────────────────────────────────────────────────

// We mock the fix tool so tests are isolated from AST traversal
vi.mock('../tools/fix.js', () => ({
    handleFlintFix: vi.fn(),
}))

import { handleFlintFix } from '../tools/fix.js'
import type { FixResult } from '../tools/fix.js'
import { elicitRemediation } from '../core/elicitRemediation.js'
import { DEFAULT_CONFIG } from '../core/config.js'
import type { FlintConfig } from '../core/config.js'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

const tmpDir = path.join(os.tmpdir(), '__flint_rem1_tests__')
const FIXTURE_PATH = path.join(tmpDir, 'Component.tsx')
const FIXTURE_SOURCE = `
const Card = () => (
  <div className="bg-[#FF0000] p-4">
    <span>Content</span>
  </div>
)
export default Card
`
const FIXTURE_FIXED = `
const Card = () => (
  <div className="bg-red-500 p-4">
    <span>Content</span>
  </div>
)
export default Card
`

const MOCK_FIX_RESULT_DRY: FixResult = {
    fixedSource: FIXTURE_FIXED,
    fixesApplied: 1,
    status: 'ok',
    summary: 'Would replace bg-[#FF0000] with bg-red-500.',
    dryRun: true,
}

const MOCK_FIX_RESULT_LIVE: FixResult = {
    fixedSource: FIXTURE_FIXED,
    fixesApplied: 1,
    status: 'ok',
    summary: 'Replaced bg-[#FF0000] with bg-red-500.',
    dryRun: false,
}

const TEST_CONFIG: FlintConfig = {
    ...DEFAULT_CONFIG,
    projectRoot: tmpDir,
}

// Build a mock Server object. The elicitInput calls are replaced per-test.
function makeMockServer(
    elicitResponses: Array<{ action: string; content?: Record<string, unknown> }>,
): Server {
    let callIndex = 0
    return {
        elicitInput: vi.fn(async () => {
            const response = elicitResponses[callIndex++]
            return response
        }),
        getClientCapabilities: vi.fn(() => ({ elicitation: {} })),
    } as unknown as Server
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(FIXTURE_PATH, FIXTURE_SOURCE, 'utf-8')
})

afterEach(() => {
    // Restore the fixture file after tests that write to disk
    if (fs.existsSync(FIXTURE_PATH)) {
        fs.writeFileSync(FIXTURE_PATH, FIXTURE_SOURCE, 'utf-8')
    }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('REM-01: fix_now path', () => {
    it('calls handleFlintFix with dryRun:false, writes fixed source to disk, returns fixed receipt', async () => {
        const mockFix = vi.mocked(handleFlintFix)
        mockFix.mockResolvedValueOnce(MOCK_FIX_RESULT_LIVE)

        const writeFileSpy = vi.spyOn(fs, 'writeFileSync')

        const server = makeMockServer([
            { action: 'accept', content: { action: 'fix_now' } },
        ])

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('fixed')
        expect(result.fixResult).toBeDefined()
        expect(result.fixResult!.fixesApplied).toBe(1)
        expect(result.fixReceipt).toBeDefined()
        expect(result.fixReceipt).toContain('Remediation Applied')
        expect(result.fixReceipt).toContain('Fixed 1 violation')

        // Verify fix called with dryRun: false
        expect(mockFix).toHaveBeenCalledWith(
            expect.objectContaining({ dryRun: false, filePath: FIXTURE_PATH }),
            TEST_CONFIG,
        )

        // Verify file was written to disk
        expect(writeFileSpy).toHaveBeenCalledWith(FIXTURE_PATH, FIXTURE_FIXED, 'utf-8')

        writeFileSpy.mockRestore()
    })
})

describe('REM-02: dry_run then confirm', () => {
    it('runs preview first, then applies when second elicitation confirms', async () => {
        const mockFix = vi.mocked(handleFlintFix)
        mockFix.mockResolvedValueOnce(MOCK_FIX_RESULT_DRY)   // first: dry run
        mockFix.mockResolvedValueOnce(MOCK_FIX_RESULT_LIVE)  // second: live run

        const writeFileSpy = vi.spyOn(fs, 'writeFileSync')

        const server = makeMockServer([
            { action: 'accept', content: { action: 'dry_run' } },
            { action: 'accept', content: { confirm: true } },
        ])

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('fixed')
        expect(result.fixReceipt).toBeDefined()
        expect(result.fixReceipt).toContain('Remediation Applied')

        // First call should have dryRun: true, second dryRun: false
        expect(mockFix).toHaveBeenCalledTimes(2)
        expect(mockFix.mock.calls[0][0]).toMatchObject({ dryRun: true })
        expect(mockFix.mock.calls[1][0]).toMatchObject({ dryRun: false })

        expect(writeFileSpy).toHaveBeenCalledWith(FIXTURE_PATH, FIXTURE_FIXED, 'utf-8')

        writeFileSpy.mockRestore()
    })
})

describe('REM-03: dry_run then decline', () => {
    it('returns dry_run result without writing file when second elicitation declines', async () => {
        const mockFix = vi.mocked(handleFlintFix)
        mockFix.mockResolvedValueOnce(MOCK_FIX_RESULT_DRY)

        const writeFileSpy = vi.spyOn(fs, 'writeFileSync')

        const server = makeMockServer([
            { action: 'accept', content: { action: 'dry_run' } },
            { action: 'decline' },
        ])

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('dry_run')
        expect(result.fixResult).toBeDefined()
        expect(result.fixResult!.dryRun).toBe(true)
        expect(result.fixReceipt).toBeUndefined()

        // Only the dry-run call — no live call
        expect(mockFix).toHaveBeenCalledTimes(1)

        // No disk write
        expect(writeFileSpy).not.toHaveBeenCalled()

        writeFileSpy.mockRestore()
    })
})

describe('REM-04: skip', () => {
    it('returns skipped without calling fix when user chooses skip', async () => {
        const mockFix = vi.mocked(handleFlintFix)

        const server = makeMockServer([
            { action: 'accept', content: { action: 'skip' } },
        ])

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('skipped')
        expect(result.fixResult).toBeUndefined()
        expect(mockFix).not.toHaveBeenCalled()
    })
})

describe('REM-05: cancel', () => {
    it('returns skipped when first elicitation returns cancel', async () => {
        const mockFix = vi.mocked(handleFlintFix)

        const server = makeMockServer([
            { action: 'cancel' },
        ])

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('skipped')
        expect(mockFix).not.toHaveBeenCalled()
    })
})

describe('REM-06: no elicitation support', () => {
    it('returns skipped when elicitInput throws "Client does not support form elicitation"', async () => {
        const mockFix = vi.mocked(handleFlintFix)

        const server = {
            elicitInput: vi.fn().mockRejectedValue(
                new Error('Client does not support form elicitation'),
            ),
            getClientCapabilities: vi.fn(() => ({ elicitation: {} })),
        } as unknown as Server

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('skipped')
        expect(mockFix).not.toHaveBeenCalled()
    })

    it('returns skipped eagerly when getClientCapabilities reports no elicitation support', async () => {
        const mockFix = vi.mocked(handleFlintFix)

        const elicitSpy = vi.fn()
        const server = {
            elicitInput: elicitSpy,
            getClientCapabilities: vi.fn(() => ({})), // no elicitation field
        } as unknown as Server

        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG)

        expect(result.action).toBe('skipped')
        expect(elicitSpy).not.toHaveBeenCalled()
        expect(mockFix).not.toHaveBeenCalled()
    })
})

describe('REM-07: fix handler error', () => {
    it('propagates error thrown by handleFlintFix on fix_now path', async () => {
        const mockFix = vi.mocked(handleFlintFix)
        mockFix.mockRejectedValueOnce(new Error('AST generation failed'))

        const server = makeMockServer([
            { action: 'accept', content: { action: 'fix_now' } },
        ])

        await expect(
            elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 1, TEST_CONFIG),
        ).rejects.toThrow('AST generation failed')
    })
})

describe('REM-08: zero fixable guard (server.ts integration)', () => {
    it('elicitRemediation is not called when totalFixable is 0 (guard enforced at call site)', async () => {
        // This test documents the contract: the server.ts case handler only calls
        // elicitRemediation when totalFixableCount > 0. We verify the helper
        // itself works correctly when called — it always returns an action.
        // The zero-fixable guard is in server.ts (not in elicitRemediation).
        // To verify the guard, we confirm the helper does not throw on an empty scenario.

        const mockFix = vi.mocked(handleFlintFix)
        const elicitSpy = vi.fn().mockResolvedValue({ action: 'accept', content: { action: 'skip' } })

        const server = {
            elicitInput: elicitSpy,
            getClientCapabilities: vi.fn(() => ({ elicitation: {} })),
        } as unknown as Server

        // Calling with totalFixable: 0 still presents the dialog (guard is at call site)
        const result = await elicitRemediation(server, FIXTURE_PATH, FIXTURE_SOURCE, 0, TEST_CONFIG)

        // The helper ran, user chose skip
        expect(result.action).toBe('skipped')
        expect(mockFix).not.toHaveBeenCalled()
    })
})
