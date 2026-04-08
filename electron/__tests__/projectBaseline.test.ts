/**
 * projectBaseline.test.ts
 *
 * FORGE.2c — project:run-baseline IPC handler
 *
 * Coverage:
 *   - Returns null when no project is open (activeProjectRoot is null)
 *   - Returns null when MCP is not connected
 *   - Calls flint_swarm_audit_fix with correct arguments
 *   - Calls flint_debt_report with correct arguments
 *   - Writes debt-snapshot.json to .flint/ with the expected shape
 *   - Emits progress events: auditing(20), auditing(50), scoring(70), scoring(80), done(100)
 *   - Returns partial results when flint_swarm_audit_fix throws
 *   - Returns partial results when flint_debt_report throws
 *   - Handles non-JSON MCP response text gracefully
 *   - Handles missing content array gracefully
 *   - Reads grade/score from nested summary object when top-level keys are absent
 *   - Reads filesAudited from nested summary object when top-level key is absent
 */

import { describe, it, expect } from 'vitest'
import * as nodePath from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror the shapes used by the handler in main.ts
// ─────────────────────────────────────────────────────────────────────────────

interface MCPToolResult {
    content?: Array<{ text?: string }>
}

interface BaselineResult {
    violations: number
    grade: string
    score: number
    filesAudited: number
}

interface ProgressEvent {
    phase: string
    percent: number
}

interface SnapshotData {
    grade: string
    score: number
    violations: number
    filesAudited: number
    timestamp: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror: runBaseline (mirrors the handler body from main.ts, injectable deps)
// ─────────────────────────────────────────────────────────────────────────────

interface IO {
    existsSync: (p: string) => boolean
    mkdir: (p: string, opts: { recursive: boolean }) => Promise<void>
    writeFile: (p: string, data: string, enc: 'utf-8') => Promise<void>
}

interface MCPClient {
    status: () => { connected: boolean }
    callTool: (tool: string, args: Record<string, unknown>) => Promise<MCPToolResult>
}

interface Collaborators {
    activeProjectRoot: string | null
    mcpClient: MCPClient
    io: IO
    emitProgress: (phase: string, percent: number) => void
}

async function runBaseline(
    collab: Collaborators,
): Promise<BaselineResult | null> {
    if (!collab.activeProjectRoot) return null
    if (!collab.mcpClient.status().connected) return null

    const root = collab.activeProjectRoot
    const flintDir = nodePath.join(root, '.flint')

    let violations = 0
    let filesAudited = 0
    let grade = 'N/A'
    let score = 0

    // Phase 1 — full swarm audit
    try {
        collab.emitProgress('auditing', 20)
        const swarmResult = await collab.mcpClient.callTool('flint_swarm_audit_fix', {
            glob: 'src/**/*.tsx',
            autoFix: false,
        })
        collab.emitProgress('auditing', 50)
        if (swarmResult?.content?.[0]?.text) {
            try {
                const swarmData = JSON.parse(swarmResult.content[0].text) as {
                    totalViolations?: number
                    filesAudited?: number
                    summary?: { totalViolations?: number; filesAudited?: number }
                }
                violations = swarmData.totalViolations
                    ?? swarmData.summary?.totalViolations
                    ?? 0
                filesAudited = swarmData.filesAudited
                    ?? swarmData.summary?.filesAudited
                    ?? 0
            } catch {
                // Swarm result was not valid JSON — skip
            }
        }
    } catch {
        // non-blocking
    }

    // Phase 2 — debt report
    try {
        collab.emitProgress('scoring', 70)
        const debtResult = await collab.mcpClient.callTool('flint_debt_report', {
            glob: 'src/**/*.tsx',
            format: 'json',
        })
        collab.emitProgress('scoring', 80)
        if (debtResult?.content?.[0]?.text) {
            try {
                const debtData = JSON.parse(debtResult.content[0].text) as {
                    grade?: string
                    score?: number
                    healthScore?: number
                    summary?: { grade?: string; score?: number; healthScore?: number }
                }
                grade = debtData.grade ?? debtData.summary?.grade ?? 'N/A'
                score = debtData.score
                    ?? debtData.healthScore
                    ?? debtData.summary?.score
                    ?? debtData.summary?.healthScore
                    ?? 0

                try {
                    if (!collab.io.existsSync(flintDir)) {
                        await collab.io.mkdir(flintDir, { recursive: true })
                    }
                    await collab.io.writeFile(
                        nodePath.join(flintDir, 'debt-snapshot.json'),
                        JSON.stringify({
                            grade, score, violations, filesAudited,
                            timestamp: new Date().toISOString(),
                        }, null, 2),
                        'utf-8',
                    )
                } catch {
                    // write failure is non-blocking
                }
            } catch {
                // Debt result was not valid JSON — skip
            }
        }
    } catch {
        // non-blocking
    }

    collab.emitProgress('done', 100)
    return { violations, grade, score, filesAudited }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/tmp/flint-test-baseline'

function makeIO(overrides: Partial<IO> = {}): IO & { written: Array<{ path: string; data: string }> } {
    const written: Array<{ path: string; data: string }> = []
    const defaults: IO = {
        existsSync: () => true,
        mkdir: async () => undefined,
        writeFile: async (p, data) => { written.push({ path: p, data }) },
    }
    return { ...defaults, ...overrides, written }
}

function makeMCPClient(overrides: Partial<MCPClient> = {}): MCPClient {
    return {
        status: () => ({ connected: true }),
        callTool: async () => ({ content: [] }),
        ...overrides,
    }
}

function makeCollaborators(overrides: {
    activeProjectRoot?: string | null
    mcpClient?: Partial<MCPClient>
    io?: Partial<IO>
    emitProgress?: (phase: string, percent: number) => void
} = {}): Collaborators & { io: ReturnType<typeof makeIO>; progressEvents: ProgressEvent[] } {
    const progressEvents: ProgressEvent[] = []
    const io = makeIO(overrides.io)
    return {
        activeProjectRoot: overrides.activeProjectRoot !== undefined ? overrides.activeProjectRoot : PROJECT_ROOT,
        mcpClient: makeMCPClient(overrides.mcpClient),
        io,
        emitProgress: overrides.emitProgress ?? ((phase, percent) => { progressEvents.push({ phase, percent }) }),
        progressEvents,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: guard clauses
// ─────────────────────────────────────────────────────────────────────────────

describe('project:run-baseline — guard clauses', () => {
    it('returns null when activeProjectRoot is null', async () => {
        const collab = makeCollaborators({ activeProjectRoot: null })
        const result = await runBaseline(collab)
        expect(result).toBeNull()
    })

    it('does not call any MCP tool when no project is open', async () => {
        let called = false
        const collab = makeCollaborators({
            activeProjectRoot: null,
            mcpClient: { callTool: async () => { called = true; return { content: [] } } },
        })
        await runBaseline(collab)
        expect(called).toBe(false)
    })

    it('returns null when MCP is not connected', async () => {
        const collab = makeCollaborators({
            mcpClient: { status: () => ({ connected: false }) },
        })
        const result = await runBaseline(collab)
        expect(result).toBeNull()
    })

    it('does not call any MCP tool when MCP is not connected', async () => {
        let called = false
        const collab = makeCollaborators({
            mcpClient: {
                status: () => ({ connected: false }),
                callTool: async () => { called = true; return { content: [] } },
            },
        })
        await runBaseline(collab)
        expect(called).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: MCP tool invocations
// ─────────────────────────────────────────────────────────────────────────────

describe('project:run-baseline — MCP tool calls', () => {
    it('calls flint_swarm_audit_fix with glob and autoFix: false', async () => {
        let capturedTool: string | null = null
        let capturedArgs: Record<string, unknown> | null = null

        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool, args) => {
                    if (tool === 'flint_swarm_audit_fix') {
                        capturedTool = tool
                        capturedArgs = args
                    }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        expect(capturedTool).toBe('flint_swarm_audit_fix')
        expect(capturedArgs).toMatchObject({ glob: 'src/**/*.tsx', autoFix: false })
    })

    it('calls flint_debt_report with glob and format: json', async () => {
        let capturedTool: string | null = null
        let capturedArgs: Record<string, unknown> | null = null

        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool, args) => {
                    if (tool === 'flint_debt_report') {
                        capturedTool = tool
                        capturedArgs = args
                    }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        expect(capturedTool).toBe('flint_debt_report')
        expect(capturedArgs).toMatchObject({ glob: 'src/**/*.tsx', format: 'json' })
    })

    it('calls flint_swarm_audit_fix before flint_debt_report', async () => {
        const callOrder: string[] = []

        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    callOrder.push(tool)
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        const swarmIdx = callOrder.indexOf('flint_swarm_audit_fix')
        const debtIdx = callOrder.indexOf('flint_debt_report')
        expect(swarmIdx).toBeGreaterThanOrEqual(0)
        expect(debtIdx).toBeGreaterThanOrEqual(0)
        expect(swarmIdx).toBeLessThan(debtIdx)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: result parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('project:run-baseline — result parsing', () => {
    it('extracts violations and filesAudited from swarm result top-level keys', async () => {
        const swarmPayload = JSON.stringify({ totalViolations: 14, filesAudited: 8 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_swarm_audit_fix') return { content: [{ text: swarmPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        expect(result?.violations).toBe(14)
        expect(result?.filesAudited).toBe(8)
    })

    it('extracts violations and filesAudited from nested summary object', async () => {
        const swarmPayload = JSON.stringify({ summary: { totalViolations: 5, filesAudited: 3 } })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_swarm_audit_fix') return { content: [{ text: swarmPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        expect(result?.violations).toBe(5)
        expect(result?.filesAudited).toBe(3)
    })

    it('extracts grade and score from debt report top-level keys', async () => {
        const debtPayload = JSON.stringify({ grade: 'B', score: 72 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        expect(result?.grade).toBe('B')
        expect(result?.score).toBe(72)
    })

    it('extracts grade and score from nested summary object', async () => {
        const debtPayload = JSON.stringify({ summary: { grade: 'C', score: 55 } })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        expect(result?.grade).toBe('C')
        expect(result?.score).toBe(55)
    })

    it('falls back to healthScore field when score is absent', async () => {
        const debtPayload = JSON.stringify({ grade: 'A', healthScore: 91 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        expect(result?.score).toBe(91)
    })

    it('returns grade: N/A and score: 0 when debt report content is empty', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async () => ({ content: [] }),
            },
        })

        const result = await runBaseline(collab)
        expect(result?.grade).toBe('N/A')
        expect(result?.score).toBe(0)
    })

    it('returns violations: 0 and filesAudited: 0 when swarm content is empty', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async () => ({ content: [] }),
            },
        })

        const result = await runBaseline(collab)
        expect(result?.violations).toBe(0)
        expect(result?.filesAudited).toBe(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: debt-snapshot.json write
// ─────────────────────────────────────────────────────────────────────────────

describe('project:run-baseline — writes debt-snapshot.json', () => {
    it('writes debt-snapshot.json with the expected path', async () => {
        const debtPayload = JSON.stringify({ grade: 'A', score: 90 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        const expectedPath = nodePath.join(PROJECT_ROOT, '.flint', 'debt-snapshot.json')
        expect(collab.io.written.some((w) => w.path === expectedPath)).toBe(true)
    })

    it('writes valid JSON to debt-snapshot.json', async () => {
        const debtPayload = JSON.stringify({ grade: 'B+', score: 78 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        const written = collab.io.written.find((w) => w.path.endsWith('debt-snapshot.json'))
        expect(written).toBeDefined()
        expect(() => JSON.parse(written!.data)).not.toThrow()
    })

    it('snapshot contains grade, score, violations, filesAudited, and timestamp', async () => {
        const swarmPayload = JSON.stringify({ totalViolations: 3, filesAudited: 7 })
        const debtPayload = JSON.stringify({ grade: 'A', score: 88 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_swarm_audit_fix') return { content: [{ text: swarmPayload }] }
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        const written = collab.io.written.find((w) => w.path.endsWith('debt-snapshot.json'))
        const snapshot = JSON.parse(written!.data) as SnapshotData
        expect(snapshot.grade).toBe('A')
        expect(snapshot.score).toBe(88)
        expect(snapshot.violations).toBe(3)
        expect(snapshot.filesAudited).toBe(7)
        expect(typeof snapshot.timestamp).toBe('string')
        expect(snapshot.timestamp.length).toBeGreaterThan(0)
    })

    it('creates the .flint directory when it does not exist', async () => {
        let mkdirCalled = false
        const debtPayload = JSON.stringify({ grade: 'C', score: 50 })
        const collab = makeCollaborators({
            io: {
                existsSync: () => false,
                mkdir: async () => { mkdirCalled = true },
            },
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)
        expect(mkdirCalled).toBe(true)
    })

    it('does not write snapshot when debt report content is empty', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async () => ({ content: [] }),
            },
        })

        await runBaseline(collab)
        expect(collab.io.written.filter((w) => w.path.endsWith('debt-snapshot.json'))).toHaveLength(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: progress events
// ─────────────────────────────────────────────────────────────────────────────

describe('project:run-baseline — progress streaming', () => {
    it('emits auditing(20), auditing(50), scoring(70), scoring(80), done(100)', async () => {
        const debtPayload = JSON.stringify({ grade: 'B', score: 70 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        await runBaseline(collab)

        const expected: ProgressEvent[] = [
            { phase: 'auditing', percent: 20 },
            { phase: 'auditing', percent: 50 },
            { phase: 'scoring', percent: 70 },
            { phase: 'scoring', percent: 80 },
            { phase: 'done', percent: 100 },
        ]
        expect(collab.progressEvents).toEqual(expected)
    })

    it('always emits done(100) even when both MCP calls fail', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async () => { throw new Error('MCP unavailable') },
            },
        })

        await runBaseline(collab)

        const doneEvents = collab.progressEvents.filter((e) => e.phase === 'done')
        expect(doneEvents).toHaveLength(1)
        expect(doneEvents[0].percent).toBe(100)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: error resilience
// ─────────────────────────────────────────────────────────────────────────────

describe('project:run-baseline — error resilience', () => {
    it('returns partial result when flint_swarm_audit_fix throws', async () => {
        const debtPayload = JSON.stringify({ grade: 'B', score: 70 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_swarm_audit_fix') throw new Error('swarm failed')
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        // Still returns a result — not null
        expect(result).not.toBeNull()
        // Swarm data defaults to zeros
        expect(result?.violations).toBe(0)
        expect(result?.filesAudited).toBe(0)
        // Debt data is intact
        expect(result?.grade).toBe('B')
        expect(result?.score).toBe(70)
    })

    it('returns partial result when flint_debt_report throws', async () => {
        const swarmPayload = JSON.stringify({ totalViolations: 9, filesAudited: 4 })
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_swarm_audit_fix') return { content: [{ text: swarmPayload }] }
                    if (tool === 'flint_debt_report') throw new Error('debt failed')
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        expect(result).not.toBeNull()
        // Swarm data is intact
        expect(result?.violations).toBe(9)
        expect(result?.filesAudited).toBe(4)
        // Debt data defaults
        expect(result?.grade).toBe('N/A')
        expect(result?.score).toBe(0)
    })

    it('returns partial result when both MCP calls throw', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async () => { throw new Error('MCP down') },
            },
        })

        const result = await runBaseline(collab)
        expect(result).not.toBeNull()
        expect(result?.violations).toBe(0)
        expect(result?.filesAudited).toBe(0)
        expect(result?.grade).toBe('N/A')
        expect(result?.score).toBe(0)
    })

    it('handles non-JSON text in swarm response without throwing', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_swarm_audit_fix') return { content: [{ text: 'not json {{{' }] }
                    return { content: [] }
                },
            },
        })

        await expect(runBaseline(collab)).resolves.not.toBeNull()
    })

    it('handles non-JSON text in debt response without throwing', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: 'plain text response' }] }
                    return { content: [] }
                },
            },
        })

        await expect(runBaseline(collab)).resolves.not.toBeNull()
    })

    it('handles missing content array on MCP result without throwing', async () => {
        const collab = makeCollaborators({
            mcpClient: {
                callTool: async () => ({} as MCPToolResult),
            },
        })

        await expect(runBaseline(collab)).resolves.not.toBeNull()
    })

    it('handles write failure for debt-snapshot.json without throwing', async () => {
        const debtPayload = JSON.stringify({ grade: 'D', score: 30 })
        const collab = makeCollaborators({
            io: {
                existsSync: () => true,
                writeFile: async () => { throw new Error('disk full') },
            },
            mcpClient: {
                callTool: async (tool) => {
                    if (tool === 'flint_debt_report') return { content: [{ text: debtPayload }] }
                    return { content: [] }
                },
            },
        })

        const result = await runBaseline(collab)
        // Write failure must not propagate — handler still returns the result
        expect(result).not.toBeNull()
        expect(result?.grade).toBe('D')
        expect(result?.score).toBe(30)
    })
})
