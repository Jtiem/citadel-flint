/**
 * reindex.test.ts
 *
 * CK.3 — Re-Index IPC
 *
 * Coverage:
 *   - reindex with no active project → returns { components: 0, ragChunks: 0 }
 *   - reindex updates flint-manifest.json with the new components map
 *   - reindex triggers RAG re-seed and returns the ingested chunk count
 *   - reindex merges new components into an existing manifest (preserves other keys)
 *   - reindex creates flint-manifest.json from scratch when it does not exist
 *
 * Architecture note:
 *   The `project:reindex` IPC handler in main.ts dynamically imports
 *   `indexComponents` from flint-mcp and `seedRAGFromProject` from ragSeeder.ts,
 *   both of which pull in sqlite / Electron context.  Following the mirror-
 *   implementation pattern from ragSeeder.test.ts and constrainedRegistry.test.ts
 *   we exercise the handler logic with injected collaborators rather than
 *   importing main.ts itself.  The IPC wiring is validated by setupIpc.test.ts.
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors the shapes used by the handler in main.ts)
// ─────────────────────────────────────────────────────────────────────────────

interface PropDefinition {
    type: string
    required: boolean
}

interface ComponentEntry {
    name: string
    importPath?: string
    props?: Record<string, PropDefinition>
}

interface ComponentIndexResult {
    count: number
    components: Record<string, ComponentEntry>
    filePaths: string[]
    totalFiles: number
    warnings: string[]
}

interface RAGResult {
    ingested: number
    sources: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror: reindexProject (mirrors the handler body from main.ts, injectable deps)
// ─────────────────────────────────────────────────────────────────────────────

interface IO {
    /** Reads a file; throws ENOENT-style error when missing. */
    readFile: (p: string, enc: 'utf-8') => Promise<string>
    /** Writes a file (atomic in production — here just a spy). */
    writeFile: (p: string, data: string, enc: 'utf-8') => Promise<void>
}

interface Collaborators {
    indexComponents: (projectRoot: string) => Promise<ComponentIndexResult>
    seedRAGFromProject: (projectRoot: string) => Promise<RAGResult>
    io: IO
}

async function reindexProject(
    activeProjectRoot: string | null,
    projectRoot: string,
    collab: Collaborators,
): Promise<{ components: number; ragChunks: number }> {
    if (!activeProjectRoot) return { components: 0, ragChunks: 0 }

    const root = projectRoot

    // 1. Component index
    const indexResult = await collab.indexComponents(root)

    // 2. Merge into flint-manifest.json
    const manifestPath = path.join(root, 'flint-manifest.json')
    let manifest: Record<string, unknown> = {}
    try {
        const raw = await collab.io.readFile(manifestPath, 'utf-8')
        manifest = JSON.parse(raw) as Record<string, unknown>
    } catch {
        // Missing or malformed — start fresh
    }
    manifest.components = indexResult.components
    await collab.io.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

    // 3. Re-seed RAG
    const ragResult = await collab.seedRAGFromProject(root)

    return { components: indexResult.count, ragChunks: ragResult.ingested }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/tmp/flint-test-reindex'

const BUTTON_COMPONENT: ComponentEntry = {
    name: 'Button',
    importPath: '@/components/ui/Button',
    props: {
        variant: { type: "'primary' | 'secondary'", required: true },
        size: { type: 'string', required: false },
    },
}

const CARD_COMPONENT: ComponentEntry = {
    name: 'Card',
    importPath: '@/components/ui/Card',
    props: {
        title: { type: 'string', required: false },
    },
}

const TWO_COMPONENT_RESULT: ComponentIndexResult = {
    count: 2,
    components: {
        Button: BUTTON_COMPONENT,
        Card: CARD_COMPONENT,
    },
    filePaths: [
        'src/components/ui/Button.tsx',
        'src/components/ui/Card.tsx',
    ],
    totalFiles: 2,
    warnings: [],
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeIO(overrides: Partial<IO> = {}): IO & { written: Array<{ path: string; data: string }> } {
    const written: Array<{ path: string; data: string }> = []

    const defaults: IO = {
        readFile: async (_p, _enc) => {
            const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
            throw err
        },
        writeFile: async (p, data, _enc) => {
            written.push({ path: p, data })
        },
    }

    return { ...defaults, ...overrides, written }
}

function makeCollaborators(
    overrides: Partial<Omit<Collaborators, 'io'>> & { io?: Partial<IO> } = {},
): Collaborators & { io: ReturnType<typeof makeIO> } {
    const io = makeIO(overrides.io)

    return {
        indexComponents: overrides.indexComponents ?? (async () => TWO_COMPONENT_RESULT),
        seedRAGFromProject: overrides.seedRAGFromProject ?? (async () => ({ ingested: 5, sources: ['manifest', 'tokens'] })),
        io,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: no-project guard
// ─────────────────────────────────────────────────────────────────────────────

describe('project:reindex — no active project', () => {
    it('returns { components: 0, ragChunks: 0 } when activeProjectRoot is null', async () => {
        const collab = makeCollaborators()
        const result = await reindexProject(null, PROJECT_ROOT, collab)

        expect(result.components).toBe(0)
        expect(result.ragChunks).toBe(0)
    })

    it('does not call indexComponents or seedRAGFromProject when no project is open', async () => {
        let indexCalled = false
        let seedCalled = false

        const collab = makeCollaborators({
            indexComponents: async () => { indexCalled = true; return TWO_COMPONENT_RESULT },
            seedRAGFromProject: async () => { seedCalled = true; return { ingested: 1, sources: [] } },
        })

        await reindexProject(null, PROJECT_ROOT, collab)

        expect(indexCalled).toBe(false)
        expect(seedCalled).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: manifest update
// ─────────────────────────────────────────────────────────────────────────────

describe('project:reindex — updates flint-manifest.json', () => {
    it('writes the indexed components into flint-manifest.json', async () => {
        const collab = makeCollaborators()
        await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(collab.io.written).toHaveLength(1)

        const { path: writtenPath, data } = collab.io.written[0]
        expect(writtenPath).toBe(path.join(PROJECT_ROOT, 'flint-manifest.json'))

        const parsed = JSON.parse(data) as Record<string, unknown>
        const components = parsed.components as Record<string, unknown>
        expect(Object.keys(components)).toContain('Button')
        expect(Object.keys(components)).toContain('Card')
    })

    it('preserves existing non-components keys in flint-manifest.json', async () => {
        const existingManifest = {
            schemaVersion: '1.0',
            projectName: 'my-project',
            tokens: ['color.primary'],
            components: { OldComponent: { name: 'OldComponent', importPath: './OldComponent' } },
        }

        const collab = makeCollaborators({
            io: {
                readFile: async (_p, _enc) => JSON.stringify(existingManifest),
            },
        })

        await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        const { data } = collab.io.written[0]
        const parsed = JSON.parse(data) as Record<string, unknown>

        // Non-component keys should be preserved
        expect(parsed.schemaVersion).toBe('1.0')
        expect(parsed.projectName).toBe('my-project')
        expect(parsed.tokens).toEqual(['color.primary'])

        // Components should be replaced with fresh index result
        const components = parsed.components as Record<string, unknown>
        expect(Object.keys(components)).toContain('Button')
        expect(Object.keys(components)).not.toContain('OldComponent')
    })

    it('creates flint-manifest.json from scratch when it does not exist', async () => {
        const collab = makeCollaborators({
            io: {
                readFile: async (_p, _enc) => {
                    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                    throw err
                },
            },
        })

        await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(collab.io.written).toHaveLength(1)
        const { data } = collab.io.written[0]
        const parsed = JSON.parse(data) as Record<string, unknown>
        expect(parsed.components).toBeDefined()
    })

    it('writes valid JSON ending with a newline', async () => {
        const collab = makeCollaborators()
        await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        const { data } = collab.io.written[0]
        // Must parse without throwing
        expect(() => JSON.parse(data)).not.toThrow()
        // Must end with a trailing newline (convention matches the rest of main.ts)
        expect(data.endsWith('\n')).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: RAG re-seed
// ─────────────────────────────────────────────────────────────────────────────

describe('project:reindex — triggers RAG re-seed', () => {
    it('calls seedRAGFromProject with the project root after indexing', async () => {
        let seededRoot: string | null = null

        const collab = makeCollaborators({
            seedRAGFromProject: async (root) => {
                seededRoot = root
                return { ingested: 8, sources: ['manifest'] }
            },
        })

        await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(seededRoot).toBe(PROJECT_ROOT)
    })

    it('returns the ragChunks count from seedRAGFromProject', async () => {
        const collab = makeCollaborators({
            seedRAGFromProject: async () => ({ ingested: 12, sources: ['manifest', 'tokens'] }),
        })

        const result = await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(result.ragChunks).toBe(12)
    })

    it('RAG is seeded after the manifest write (ordering)', async () => {
        const callOrder: string[] = []

        const collab = makeCollaborators({
            io: {
                writeFile: async (_p, _data, _enc) => {
                    callOrder.push('write-manifest')
                },
            },
            seedRAGFromProject: async () => {
                callOrder.push('seed-rag')
                return { ingested: 3, sources: ['manifest'] }
            },
        })

        await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(callOrder.indexOf('write-manifest')).toBeLessThan(
            callOrder.indexOf('seed-rag'),
        )
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests: return shape
// ─────────────────────────────────────────────────────────────────────────────

describe('project:reindex — return shape', () => {
    it('returns the component count from indexComponents', async () => {
        const collab = makeCollaborators({
            indexComponents: async () => TWO_COMPONENT_RESULT,
        })

        const result = await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(result.components).toBe(2)
    })

    it('returns components: 0 and ragChunks: 0 when indexer finds no components and RAG is empty', async () => {
        const emptyResult: ComponentIndexResult = {
            count: 0,
            components: {},
            filePaths: [],
            totalFiles: 0,
            warnings: [],
        }

        const collab = makeCollaborators({
            indexComponents: async () => emptyResult,
            seedRAGFromProject: async () => ({ ingested: 0, sources: [] }),
        })

        const result = await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        expect(result.components).toBe(0)
        expect(result.ragChunks).toBe(0)
    })

    it('correctly propagates warning-laden index results without throwing', async () => {
        const warningResult: ComponentIndexResult = {
            count: 1,
            components: { Button: BUTTON_COMPONENT },
            filePaths: ['src/components/ui/Button.tsx', 'src/Broken.tsx'],
            totalFiles: 2,
            warnings: ['Parse error in src/Broken.tsx: Unexpected token — skipped.'],
        }

        const collab = makeCollaborators({
            indexComponents: async () => warningResult,
        })

        const result = await reindexProject(PROJECT_ROOT, PROJECT_ROOT, collab)

        // Warnings don't affect the return count — only valid components are counted
        expect(result.components).toBe(1)
    })
})
