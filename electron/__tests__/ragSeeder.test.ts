/**
 * ragSeeder.test.ts
 *
 * CK.1 — RAG Auto-Seeding
 *
 * Coverage:
 *   - seed from a mock manifest with two components
 *   - seed from design tokens (groups by type)
 *   - seed from .flint/docs/*.md files
 *   - missing flint-manifest.json → returns { ingested: 0, sources: [] } (no throw)
 *   - empty components map → skips manifest chunks, continues with tokens
 *   - clearRAG is called before ingestChunks
 *
 * Architecture note:
 *   seedRAGFromProject() imports clearRAG and ingestChunks from ragService.ts
 *   at module level. ragService.ts requires better-sqlite3 and the Electron
 *   app context. We therefore follow the mirror-implementation pattern used by
 *   constrainedRegistry.test.ts and complexityRouter.test.ts: the filesystem
 *   interactions and content-formatting logic are re-implemented here as pure
 *   functions mirroring what ragSeeder.ts does. The IPC wiring in main.ts is
 *   covered by setupIpc.test.ts.
 *
 *   When ragSeeder.ts is eventually safe to import directly (e.g., if the
 *   sqlite dependency is extracted), the mirrors below can be replaced with a
 *   single import statement and the mocks removed.
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors ragSeeder.ts internal types)
// ─────────────────────────────────────────────────────────────────────────────

interface PropDef {
    type: string
    required: boolean
    default?: string
}

interface ComponentEntry {
    name: string
    importPath?: string
    description?: string
    props?: Record<string, PropDef>
    variants?: string[]
    tokens?: string[]
}

interface FlintManifest {
    components?: Record<string, ComponentEntry>
}

interface DesignToken {
    token_path: string
    token_type: string
    token_value: string
}

interface IngestPayload {
    content: string
    source: string
    chunkType: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror: formatComponentChunk (must stay identical to ragSeeder.ts)
// ─────────────────────────────────────────────────────────────────────────────

function formatComponentChunk(entry: ComponentEntry): string {
    const lines: string[] = []

    lines.push(`## Component: ${entry.name}`)
    lines.push('')

    if (entry.description) {
        lines.push(entry.description)
        lines.push('')
    }

    if (entry.importPath) {
        lines.push(`**Import:** \`import { ${entry.name} } from '${entry.importPath}'\``)
        lines.push('')
    }

    if (entry.props && Object.keys(entry.props).length > 0) {
        lines.push('**Props:**')
        lines.push('')
        lines.push('| Prop | Type | Required |')
        lines.push('|------|------|----------|')
        for (const [propName, def] of Object.entries(entry.props)) {
            const req = def.required ? 'yes' : 'no'
            const defVal = def.default ? ` (default: ${def.default})` : ''
            lines.push(`| ${propName} | ${def.type}${defVal} | ${req} |`)
        }
        lines.push('')
    }

    if (entry.variants && entry.variants.length > 0) {
        lines.push(`**Variants:** ${entry.variants.join(', ')}`)
        lines.push('')
    }

    if (entry.tokens && entry.tokens.length > 0) {
        lines.push(`**Design tokens:** ${entry.tokens.join(', ')}`)
        lines.push('')
    }

    return lines.join('\n').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror: seedRAGFromProject (mirrors ragSeeder.ts but uses injected I/O fns)
// ─────────────────────────────────────────────────────────────────────────────
//
// This version accepts injected io and rag fns so we can test all logic paths
// without touching the filesystem or the sqlite database.

interface IO {
    readFileSync: (p: string, enc: 'utf-8') => string
    readdirSync: (p: string) => string[]
}

interface RAG {
    clearRAG: () => void
    ingestChunks: (chunks: IngestPayload[]) => Promise<{ ingested: number }>
}

async function seedRAGFromProjectPure(
    projectRoot: string,
    io: IO,
    rag: RAG,
): Promise<{ ingested: number; sources: string[] }> {
    const chunks: IngestPayload[] = []
    const sources: string[] = []

    // 1. flint-manifest.json
    try {
        const raw = io.readFileSync(path.join(projectRoot, 'flint-manifest.json'), 'utf-8')
        const manifest: FlintManifest = JSON.parse(raw)
        const components = manifest.components ?? {}
        const entries = Object.values(components)

        if (entries.length > 0) {
            for (const entry of entries) {
                const content = formatComponentChunk(entry)
                if (content.length > 0) {
                    chunks.push({ content, source: 'manifest', chunkType: 'component' })
                }
            }
            sources.push('manifest')
        }
    } catch (err: unknown) {
        // missing or malformed manifest → skip silently
        void err
    }

    // 2. .flint/design-tokens.json
    try {
        const raw = io.readFileSync(path.join(projectRoot, '.flint', 'design-tokens.json'), 'utf-8')
        const tokens: DesignToken[] = JSON.parse(raw)

        if (Array.isArray(tokens) && tokens.length > 0) {
            const groups = new Map<string, DesignToken[]>()
            for (const token of tokens) {
                if (
                    typeof token.token_path === 'string' &&
                    typeof token.token_type === 'string' &&
                    typeof token.token_value === 'string'
                ) {
                    const group = groups.get(token.token_type) ?? []
                    group.push(token)
                    groups.set(token.token_type, group)
                }
            }

            for (const [type, group] of groups) {
                const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
                const tokenList = group.map((t) => `${t.token_path} = ${t.token_value}`).join('\n')
                chunks.push({
                    content: `Design Tokens — ${typeLabel}:\n${tokenList}`,
                    source: 'tokens',
                    chunkType: 'tokens',
                })
            }

            if (groups.size > 0) sources.push('tokens')
        }
    } catch (err: unknown) {
        void err
    }

    // 3. .flint/docs/*.md
    try {
        const entries = io.readdirSync(path.join(projectRoot, '.flint', 'docs'))
        const mdFiles = entries.filter((f) => f.endsWith('.md'))

        for (const filename of mdFiles) {
            try {
                const content = io.readFileSync(
                    path.join(projectRoot, '.flint', 'docs', filename),
                    'utf-8',
                ).trim()
                if (content.length > 0) {
                    chunks.push({ content, source: `docs/${filename}`, chunkType: 'documentation' })
                    sources.push(`docs/${filename}`)
                }
            } catch {
                // skip unreadable file
            }
        }
    } catch {
        // .flint/docs/ is optional
    }

    if (chunks.length === 0) return { ingested: 0, sources: [] }

    rag.clearRAG()
    const { ingested } = await rag.ingestChunks(chunks)
    return { ingested, sources }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_MANIFEST: FlintManifest = {
    components: {
        Button: {
            name: 'Button',
            importPath: '@ds/button',
            description: 'Primary action button',
            props: {
                variant: { type: 'string', required: true },
                size: { type: 'string', required: false, default: 'md' },
            },
            variants: ['primary', 'secondary', 'ghost'],
            tokens: ['color.primary', 'color.surface'],
        },
        Card: {
            name: 'Card',
            importPath: '@ds/card',
            props: {
                title: { type: 'string', required: false },
            },
            variants: ['default', 'outlined'],
        },
    },
}

const MOCK_TOKENS: DesignToken[] = [
    { token_path: 'color.primary.500', token_type: 'color', token_value: '#2563EB' },
    { token_path: 'color.neutral.100', token_type: 'color', token_value: '#F5F5F5' },
    { token_path: 'spacing.4', token_type: 'spacing', token_value: '4px' },
    { token_path: 'spacing.8', token_type: 'spacing', token_value: '8px' },
    { token_path: 'typography.heading-lg', token_type: 'typography', token_value: '24/32 Inter 700' },
]

const PROJECT_ROOT = '/tmp/flint-test-project'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeIO(overrides: Partial<IO> = {}): IO {
    const defaults: IO = {
        readFileSync: (_p, _enc) => {
            const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
            throw err
        },
        readdirSync: (_p) => {
            const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
            throw err
        },
    }
    return { ...defaults, ...overrides }
}

function makeRAG(): RAG & { clearCount: number; ingestedChunks: IngestPayload[] } {
    const clearCount = { value: 0 }
    const ingestedChunks: IngestPayload[] = []

    return {
        get clearCount() { return clearCount.value },
        get ingestedChunks() { return ingestedChunks },
        clearRAG: () => { clearCount.value++ },
        ingestChunks: async (chunks: IngestPayload[]) => {
            ingestedChunks.push(...chunks)
            return { ingested: chunks.length }
        },
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('seedRAGFromProject — manifest seeding', () => {
    it('produces one chunk per component from the manifest', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('flint-manifest.json')) return JSON.stringify(MOCK_MANIFEST)
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        // 2 components → 2 chunks
        expect(result.ingested).toBe(2)
        expect(result.sources).toContain('manifest')
    })

    it('manifest chunk for Button contains name, import path, props, variants, and tokens', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('flint-manifest.json')) return JSON.stringify(MOCK_MANIFEST)
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        const buttonChunk = rag.ingestedChunks.find((c) => c.content.includes('Button'))
        expect(buttonChunk).toBeDefined()
        expect(buttonChunk!.content).toContain('## Component: Button')
        expect(buttonChunk!.content).toContain('@ds/button')
        expect(buttonChunk!.content).toContain('variant')
        expect(buttonChunk!.content).toContain('yes') // required
        expect(buttonChunk!.content).toContain('primary, secondary, ghost')
        expect(buttonChunk!.content).toContain('color.primary')
        expect(buttonChunk!.chunkType).toBe('component')
        expect(buttonChunk!.source).toBe('manifest')
    })

    it('empty components map skips manifest chunks but continues to read tokens', async () => {
        const emptyManifest: FlintManifest = { components: {} }
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('flint-manifest.json')) return JSON.stringify(emptyManifest)
                if (p.endsWith('design-tokens.json')) return JSON.stringify(MOCK_TOKENS)
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        expect(result.sources).not.toContain('manifest')
        expect(result.sources).toContain('tokens')
        expect(result.ingested).toBeGreaterThan(0)
    })
})

describe('seedRAGFromProject — token seeding', () => {
    it('groups tokens by type and produces one chunk per type', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('design-tokens.json')) return JSON.stringify(MOCK_TOKENS)
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        // MOCK_TOKENS has 3 types: color, spacing, typography → 3 chunks
        expect(result.ingested).toBe(3)
        expect(result.sources).toContain('tokens')

        const colorChunk = rag.ingestedChunks.find((c) => c.content.includes('Color'))
        expect(colorChunk).toBeDefined()
        expect(colorChunk!.content).toContain('color.primary.500 = #2563EB')
        expect(colorChunk!.content).toContain('color.neutral.100 = #F5F5F5')
        expect(colorChunk!.chunkType).toBe('tokens')

        const spacingChunk = rag.ingestedChunks.find((c) => c.content.includes('Spacing'))
        expect(spacingChunk).toBeDefined()
        expect(spacingChunk!.content).toContain('spacing.4 = 4px')
    })

    it('missing design-tokens.json skips token chunks without throwing', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (_p, _enc) => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)
        expect(result.ingested).toBe(0)
        expect(result.sources).toHaveLength(0)
    })
})

describe('seedRAGFromProject — docs seeding', () => {
    it('reads .flint/docs/*.md files and produces one chunk per file', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('design-tokens.json')) return '[]'
                if (p.endsWith('getting-started.md')) return '# Getting Started\n\nWelcome to Flint.'
                if (p.endsWith('tokens-guide.md')) return '# Token Guide\n\nUse color.primary for buttons.'
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: (p) => {
                if (p.endsWith('docs')) return ['getting-started.md', 'tokens-guide.md']
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        expect(result.ingested).toBe(2)
        expect(result.sources).toContain('docs/getting-started.md')
        expect(result.sources).toContain('docs/tokens-guide.md')

        const docChunk = rag.ingestedChunks.find((c) => c.source === 'docs/getting-started.md')
        expect(docChunk).toBeDefined()
        expect(docChunk!.content).toContain('Getting Started')
        expect(docChunk!.chunkType).toBe('documentation')
    })

    it('missing .flint/docs/ directory is silently skipped', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('flint-manifest.json')) return JSON.stringify(MOCK_MANIFEST)
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        // manifest succeeded, docs gracefully absent
        expect(result.ingested).toBe(2)
        expect(result.sources).not.toContain('docs')
    })

    it('non-.md files in .flint/docs/ are ignored', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('design-tokens.json')) return '[]'
                if (p.endsWith('readme.md')) return '# Readme'
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: (p) => {
                if (p.endsWith('docs')) return ['readme.md', 'data.json', 'image.png']
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        // Only readme.md is a .md file
        expect(result.ingested).toBe(1)
        expect(result.sources).toContain('docs/readme.md')
        expect(result.sources).not.toContain('docs/data.json')
    })
})

describe('seedRAGFromProject — missing manifest', () => {
    it('returns { ingested: 0, sources: [] } when flint-manifest.json does not exist and no other sources', async () => {
        const rag = makeRAG()
        const io = makeIO() // all reads throw ENOENT

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        expect(result.ingested).toBe(0)
        expect(result.sources).toHaveLength(0)
    })

    it('does not throw when flint-manifest.json does not exist', async () => {
        const rag = makeRAG()
        const io = makeIO()

        await expect(seedRAGFromProjectPure(PROJECT_ROOT, io, rag)).resolves.toBeDefined()
    })
})

describe('seedRAGFromProject — clearRAG ordering', () => {
    it('calls clearRAG() before ingestChunks() when there are chunks to ingest', async () => {
        const callOrder: string[] = []
        const rag: RAG = {
            clearRAG: () => { callOrder.push('clear') },
            ingestChunks: async (chunks) => {
                callOrder.push('ingest')
                return { ingested: chunks.length }
            },
        }

        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('flint-manifest.json')) return JSON.stringify(MOCK_MANIFEST)
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: () => {
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        expect(callOrder[0]).toBe('clear')
        expect(callOrder[1]).toBe('ingest')
    })

    it('does NOT call clearRAG or ingestChunks when no sources produce chunks', async () => {
        const rag: RAG & { clearCount: number; ingestCount: number } = {
            clearCount: 0,
            ingestCount: 0,
            clearRAG: function() { this.clearCount++ },
            ingestChunks: async function(chunks) { this.ingestCount++; return { ingested: chunks.length } },
        }

        const io = makeIO() // all reads throw

        await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        expect(rag.clearCount).toBe(0)
        expect(rag.ingestCount).toBe(0)
    })
})

describe('seedRAGFromProject — combined sources', () => {
    it('seeds from manifest + tokens + docs and returns all three in sources', async () => {
        const rag = makeRAG()
        const io = makeIO({
            readFileSync: (p, _enc) => {
                if (p.endsWith('flint-manifest.json')) return JSON.stringify(MOCK_MANIFEST)
                if (p.endsWith('design-tokens.json')) return JSON.stringify(MOCK_TOKENS)
                if (p.endsWith('guide.md')) return '# Token Guide\n\nUse tokens correctly.'
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
            readdirSync: (p) => {
                if (p.endsWith('docs')) return ['guide.md']
                const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
                throw err
            },
        })

        const result = await seedRAGFromProjectPure(PROJECT_ROOT, io, rag)

        // 2 component chunks + 3 token-type chunks + 1 doc chunk = 6
        expect(result.ingested).toBe(6)
        expect(result.sources).toContain('manifest')
        expect(result.sources).toContain('tokens')
        expect(result.sources).toContain('docs/guide.md')
    })
})
