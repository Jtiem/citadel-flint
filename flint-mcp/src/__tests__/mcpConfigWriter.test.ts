/**
 * mcpConfigWriter tests
 * flint-mcp/src/__tests__/mcpConfigWriter.test.ts
 *
 * Phase INIT.1: Test suite for the .mcp.json configuration writer.
 *
 * All filesystem operations are mocked with vi.mock('node:fs').
 *
 * Test map:
 *   1  — Creates .mcp.json when none exists
 *   2  — Adds Flint to existing .mcp.json with other servers already present
 *   3  — Skips when Flint is already configured (no-op, returns written:false)
 *   4  — Handles invalid JSON gracefully (written:false + helpful message)
 *   5  — Sets FLINT_PROJECT_ROOT to the correct absolute projectRoot
 *   6  — Uses correct command / args format ("npx" / ["flint-mcp", "serve"])
 *   7  — Creates mcpServers key when it is missing from existing JSON
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Filesystem mock — uses a shared state object so the closure in vi.mock()
// always references the current values (not a snapshot).
// ---------------------------------------------------------------------------

const mockState = {
    existingFiles: new Map<string, string>(),
    writtenFiles: new Map<string, string>(),
}

vi.mock('node:fs', () => {
    return {
        default: {
            existsSync: (p: string) => mockState.existingFiles.has(p),
            readFileSync: (p: string, _enc?: unknown): string => {
                const content = mockState.existingFiles.get(p)
                if (content !== undefined) return content
                throw Object.assign(new Error(`ENOENT: no such file: ${p}`), { code: 'ENOENT' })
            },
            writeFileSync: (p: string, content: string, _enc?: unknown): void => {
                mockState.writtenFiles.set(p, content)
            },
        },
        existsSync: (p: string) => mockState.existingFiles.has(p),
        readFileSync: (p: string, _enc?: unknown): string => {
            const content = mockState.existingFiles.get(p)
            if (content !== undefined) return content
            throw Object.assign(new Error(`ENOENT: no such file: ${p}`), { code: 'ENOENT' })
        },
        writeFileSync: (p: string, content: string, _enc?: unknown): void => {
            mockState.writtenFiles.set(p, content)
        },
    }
})

beforeEach(() => {
    mockState.existingFiles.clear()
    mockState.writtenFiles.clear()
})

// ---------------------------------------------------------------------------
// Import module under test (static — mock is already hoisted by Vitest)
// ---------------------------------------------------------------------------

import { writeMcpConfig } from '../core/init/mcpConfigWriter.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = '/Users/jane/my-project'
const MCP_JSON_PATH = path.join(PROJECT_ROOT, '.mcp.json')

function seedFile(p: string, content: string) {
    mockState.existingFiles.set(p, content)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writeMcpConfig — file creation', () => {
    it('1. creates .mcp.json when none exists', () => {
        // No seed — existsSync returns false

        const result = writeMcpConfig(PROJECT_ROOT)

        expect(result.written).toBe(true)
        expect(result.path).toBe(MCP_JSON_PATH)
        expect(result.message).toBe('Flint MCP server added to .mcp.json')
        expect(mockState.writtenFiles.has(MCP_JSON_PATH)).toBe(true)

        const written = JSON.parse(mockState.writtenFiles.get(MCP_JSON_PATH)!) as Record<string, unknown>
        expect(written).toHaveProperty('mcpServers')
        const servers = written.mcpServers as Record<string, unknown>
        expect(servers).toHaveProperty('flint')
    })

    it('6. uses correct command / args format', () => {
        const result = writeMcpConfig(PROJECT_ROOT)

        expect(result.written).toBe(true)
        const written = JSON.parse(mockState.writtenFiles.get(MCP_JSON_PATH)!) as Record<string, unknown>
        const flint = (written.mcpServers as Record<string, unknown>).flint as Record<string, unknown>

        expect(flint.command).toBe('npx')
        expect(flint.args).toEqual(['flint-mcp', 'serve'])
    })
})

describe('writeMcpConfig — merging into existing file', () => {
    it('2. adds Flint to existing .mcp.json with other servers', () => {
        const existing = {
            mcpServers: {
                'claude-flow': {
                    command: 'npx',
                    args: ['-y', '@claude-flow/cli@latest', 'mcp', 'start'],
                },
            },
        }
        seedFile(MCP_JSON_PATH, JSON.stringify(existing, null, 2))

        const result = writeMcpConfig(PROJECT_ROOT)

        expect(result.written).toBe(true)
        expect(result.message).toBe('Flint MCP server added to .mcp.json')

        const written = JSON.parse(mockState.writtenFiles.get(MCP_JSON_PATH)!) as Record<string, unknown>
        const servers = written.mcpServers as Record<string, unknown>
        expect(servers).toHaveProperty('flint')
        expect(servers).toHaveProperty('claude-flow')
    })

    it('7. creates mcpServers key when it is missing from existing JSON', () => {
        const existing = { someOtherKey: true }
        seedFile(MCP_JSON_PATH, JSON.stringify(existing, null, 2))

        const result = writeMcpConfig(PROJECT_ROOT)

        expect(result.written).toBe(true)

        const written = JSON.parse(mockState.writtenFiles.get(MCP_JSON_PATH)!) as Record<string, unknown>
        expect(written).toHaveProperty('mcpServers')
        expect((written.mcpServers as Record<string, unknown>)).toHaveProperty('flint')
        // Original keys preserved
        expect(written).toHaveProperty('someOtherKey', true)
    })
})

describe('writeMcpConfig — idempotency', () => {
    it('3. skips when Flint is already configured', () => {
        const existing = {
            mcpServers: {
                flint: {
                    command: 'node',
                    args: ['./dist/server.js'],
                },
            },
        }
        seedFile(MCP_JSON_PATH, JSON.stringify(existing, null, 2))

        const result = writeMcpConfig(PROJECT_ROOT)

        expect(result.written).toBe(false)
        expect(result.message).toBe('Flint already configured in .mcp.json')
        // No write should have happened
        expect(mockState.writtenFiles.has(MCP_JSON_PATH)).toBe(false)
    })
})

describe('writeMcpConfig — error handling', () => {
    it('4. handles invalid JSON gracefully', () => {
        seedFile(MCP_JSON_PATH, '{ this is not valid json !!!')

        const result = writeMcpConfig(PROJECT_ROOT)

        expect(result.written).toBe(false)
        expect(result.path).toBe(MCP_JSON_PATH)
        expect(result.message).toContain('not valid JSON')
        // No write should have happened
        expect(mockState.writtenFiles.has(MCP_JSON_PATH)).toBe(false)
    })
})

describe('writeMcpConfig — env configuration', () => {
    it('5. sets FLINT_PROJECT_ROOT to correct absolute project root', () => {
        // No seed — creates fresh file

        writeMcpConfig(PROJECT_ROOT)

        const written = JSON.parse(mockState.writtenFiles.get(MCP_JSON_PATH)!) as Record<string, unknown>
        const flint = (written.mcpServers as Record<string, unknown>).flint as Record<string, unknown>
        const env = flint.env as Record<string, unknown>

        expect(env.FLINT_PROJECT_ROOT).toBe(PROJECT_ROOT)
    })
})
