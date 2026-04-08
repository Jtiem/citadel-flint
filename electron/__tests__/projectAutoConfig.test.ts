/**
 * projectAutoConfig.test.ts
 *
 * FORGE.2b — project:auto-configure IPC handler
 *
 * Coverage:
 *   - Returns { configured: false } when no project is open
 *   - Returns { configured: false } when MCP is not connected
 *   - Calls flint_set_library with the detected componentLibrary when present
 *   - Calls flint_reindex_registry unconditionally when MCP is connected
 *   - Returns { configured: true, library, reindexed: true } on success
 *   - Does NOT call flint_set_library when componentLibrary is null
 *   - Handles flint_set_library errors gracefully (still calls reindex)
 *   - Handles flint_reindex_registry errors gracefully (returns reindexed: false)
 *   - Handles malformed detected-environment.json gracefully
 *   - Does not throw when both MCP calls fail
 *
 * Architecture note:
 *   The IPC handler in main.ts reads from disk and calls mcpClient.callTool().
 *   Following the mirror-implementation pattern used throughout the electron test
 *   suite (see reindex.test.ts, ragSeeder.test.ts), we extract the handler logic
 *   into a pure function that accepts injectable collaborators. IPC wiring is
 *   validated by setupIpc.test.ts.
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AutoConfigResult {
    configured: boolean
    library: string | null
    reindexed: boolean
}

interface DetectedEnvironment {
    uiFramework: string
    cssFramework: string
    tokenFormat: string | null
    typescript: boolean
    componentLibrary: string | null
    detectedAt: string
}

interface MCPCallRecord {
    tool: string
    args: Record<string, unknown>
}

interface Collaborators {
    mcpConnected: () => boolean
    readFile: (p: string, enc: 'utf-8') => Promise<string>
    callTool: (tool: string, args: Record<string, unknown>) => Promise<unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror: autoConfigureProject (mirrors the handler body from main.ts)
// ─────────────────────────────────────────────────────────────────────────────

async function autoConfigureProject(
    activeProjectRoot: string | null,
    collab: Collaborators,
): Promise<AutoConfigResult> {
    if (!activeProjectRoot) {
        return { configured: false, library: null, reindexed: false }
    }

    if (!collab.mcpConnected()) {
        return { configured: false, library: null, reindexed: false }
    }

    const root = activeProjectRoot
    let library: string | null = null
    let librarySet = false
    let reindexed = false

    // Read the detected environment written by project:detect-environment
    try {
        const envPath = path.join(root, '.flint', 'detected-environment.json')
        const raw = await collab.readFile(envPath, 'utf-8')
        const env = JSON.parse(raw) as { componentLibrary?: string | null }
        library = env.componentLibrary ?? null
    } catch {
        // No detected-environment.json yet — proceed without library config
    }

    // Call flint_set_library if a component library was detected
    if (library) {
        try {
            await collab.callTool('flint_set_library', { library })
            librarySet = true
        } catch {
            // non-blocking
        }
    }

    // Always re-index the registry after configuring
    try {
        await collab.callTool('flint_reindex_registry', {})
        reindexed = true
    } catch {
        // non-blocking
    }

    const configured = librarySet || reindexed
    return { configured, library, reindexed }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/tmp/flint-test-autoconfig'

function makeDetectedEnv(overrides: Partial<DetectedEnvironment> = {}): DetectedEnvironment {
    return {
        uiFramework: 'React',
        cssFramework: 'Tailwind v4',
        tokenFormat: 'DTCG',
        typescript: true,
        componentLibrary: 'MUI',
        detectedAt: new Date().toISOString(),
        ...overrides,
    }
}

function makeCollaborators(overrides: Partial<Collaborators> & {
    calls?: MCPCallRecord[]
    envOverride?: Partial<DetectedEnvironment> | null
    setLibraryError?: boolean
    reindexError?: boolean
} = {}): Collaborators & { calls: MCPCallRecord[] } {
    const calls: MCPCallRecord[] = overrides.calls ?? []

    const env = overrides.envOverride === null
        ? null
        : makeDetectedEnv(overrides.envOverride ?? {})

    const defaults: Collaborators = {
        mcpConnected: () => true,
        readFile: async (_p, _enc) => {
            if (env === null) {
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
            }
            return JSON.stringify(env)
        },
        callTool: async (tool, args) => {
            calls.push({ tool, args })
            if (tool === 'flint_set_library' && overrides.setLibraryError) {
                throw new Error('flint_set_library: MCP error')
            }
            if (tool === 'flint_reindex_registry' && overrides.reindexError) {
                throw new Error('flint_reindex_registry: MCP error')
            }
            return { success: true }
        },
    }

    return {
        ...defaults,
        ...overrides,
        calls,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: guard conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('project:auto-configure — no active project', () => {
    it('returns { configured: false, library: null, reindexed: false } when activeProjectRoot is null', async () => {
        const collab = makeCollaborators()
        const result = await autoConfigureProject(null, collab)

        expect(result.configured).toBe(false)
        expect(result.library).toBeNull()
        expect(result.reindexed).toBe(false)
    })

    it('does not call any MCP tools when no project is open', async () => {
        const collab = makeCollaborators()
        await autoConfigureProject(null, collab)

        expect(collab.calls).toHaveLength(0)
    })
})

describe('project:auto-configure — MCP not connected', () => {
    it('returns { configured: false, library: null, reindexed: false } when MCP is disconnected', async () => {
        const collab = makeCollaborators({ mcpConnected: () => false })
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.configured).toBe(false)
        expect(result.library).toBeNull()
        expect(result.reindexed).toBe(false)
    })

    it('does not call any MCP tools when MCP is disconnected', async () => {
        const collab = makeCollaborators({ mcpConnected: () => false })
        await autoConfigureProject(PROJECT_ROOT, collab)

        expect(collab.calls).toHaveLength(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: flint_set_library
// ─────────────────────────────────────────────────────────────────────────────

describe('project:auto-configure — flint_set_library', () => {
    it('calls flint_set_library with the detected componentLibrary', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: 'MUI' } })
        await autoConfigureProject(PROJECT_ROOT, collab)

        const setLibCall = collab.calls.find(c => c.tool === 'flint_set_library')
        expect(setLibCall).toBeDefined()
        expect(setLibCall?.args.library).toBe('MUI')
    })

    it('does NOT call flint_set_library when componentLibrary is null', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: null } })
        await autoConfigureProject(PROJECT_ROOT, collab)

        const setLibCall = collab.calls.find(c => c.tool === 'flint_set_library')
        expect(setLibCall).toBeUndefined()
    })

    it('returns the detected library in the result', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: 'shadcn' } })
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.library).toBe('shadcn')
    })

    it('returns library: null when componentLibrary is null in detected env', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: null } })
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.library).toBeNull()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: flint_reindex_registry
// ─────────────────────────────────────────────────────────────────────────────

describe('project:auto-configure — flint_reindex_registry', () => {
    it('always calls flint_reindex_registry when MCP is connected', async () => {
        const collab = makeCollaborators()
        await autoConfigureProject(PROJECT_ROOT, collab)

        const reindexCall = collab.calls.find(c => c.tool === 'flint_reindex_registry')
        expect(reindexCall).toBeDefined()
    })

    it('calls flint_reindex_registry even when componentLibrary is null', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: null } })
        await autoConfigureProject(PROJECT_ROOT, collab)

        const reindexCall = collab.calls.find(c => c.tool === 'flint_reindex_registry')
        expect(reindexCall).toBeDefined()
    })

    it('returns reindexed: true on successful flint_reindex_registry call', async () => {
        const collab = makeCollaborators()
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.reindexed).toBe(true)
    })

    it('calls flint_set_library before flint_reindex_registry', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: 'MUI' } })
        await autoConfigureProject(PROJECT_ROOT, collab)

        const setLibIdx = collab.calls.findIndex(c => c.tool === 'flint_set_library')
        const reindexIdx = collab.calls.findIndex(c => c.tool === 'flint_reindex_registry')
        expect(setLibIdx).toBeGreaterThanOrEqual(0)
        expect(reindexIdx).toBeGreaterThan(setLibIdx)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: success result shape
// ─────────────────────────────────────────────────────────────────────────────

describe('project:auto-configure — success result', () => {
    it('returns configured: true when library is set and registry is reindexed', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: 'MUI' } })
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.configured).toBe(true)
        expect(result.library).toBe('MUI')
        expect(result.reindexed).toBe(true)
    })

    it('returns configured: true when only reindex succeeds (no library)', async () => {
        const collab = makeCollaborators({ envOverride: { componentLibrary: null } })
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        // reindexed=true makes configured=true even without a library
        expect(result.configured).toBe(true)
        expect(result.library).toBeNull()
        expect(result.reindexed).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: error resilience
// ─────────────────────────────────────────────────────────────────────────────

describe('project:auto-configure — error resilience', () => {
    it('does not throw when flint_set_library fails', async () => {
        const collab = makeCollaborators({
            envOverride: { componentLibrary: 'MUI' },
            setLibraryError: true,
        })

        await expect(autoConfigureProject(PROJECT_ROOT, collab)).resolves.not.toThrow()
    })

    it('still calls flint_reindex_registry when flint_set_library fails', async () => {
        const collab = makeCollaborators({
            envOverride: { componentLibrary: 'MUI' },
            setLibraryError: true,
        })

        await autoConfigureProject(PROJECT_ROOT, collab)

        const reindexCall = collab.calls.find(c => c.tool === 'flint_reindex_registry')
        expect(reindexCall).toBeDefined()
    })

    it('returns configured: true (via reindex) even when flint_set_library fails', async () => {
        const collab = makeCollaborators({
            envOverride: { componentLibrary: 'MUI' },
            setLibraryError: true,
        })

        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.configured).toBe(true)
        expect(result.reindexed).toBe(true)
    })

    it('does not throw when flint_reindex_registry fails', async () => {
        const collab = makeCollaborators({ reindexError: true })

        await expect(autoConfigureProject(PROJECT_ROOT, collab)).resolves.not.toThrow()
    })

    it('returns reindexed: false when flint_reindex_registry fails', async () => {
        const collab = makeCollaborators({ reindexError: true })
        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.reindexed).toBe(false)
    })

    it('returns configured: false when both MCP calls fail and no library set', async () => {
        const collab = makeCollaborators({
            envOverride: { componentLibrary: null },
            reindexError: true,
        })

        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        expect(result.configured).toBe(false)
        expect(result.reindexed).toBe(false)
    })

    it('handles malformed detected-environment.json gracefully', async () => {
        const collab = makeCollaborators()
        // Override readFile to return invalid JSON
        collab.readFile = async (_p, _enc) => '{ not valid json @@'

        await expect(autoConfigureProject(PROJECT_ROOT, collab)).resolves.not.toThrow()
    })

    it('proceeds to reindex even when detected-environment.json is missing', async () => {
        const collab = makeCollaborators({ envOverride: null })
        // envOverride: null causes readFile to throw ENOENT

        const result = await autoConfigureProject(PROJECT_ROOT, collab)

        // No library (file missing), but reindex should still run
        expect(result.library).toBeNull()
        const reindexCall = collab.calls.find(c => c.tool === 'flint_reindex_registry')
        expect(reindexCall).toBeDefined()
        expect(result.reindexed).toBe(true)
    })
})
