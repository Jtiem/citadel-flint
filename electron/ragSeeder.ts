/**
 * ragSeeder.ts — electron/ragSeeder.ts
 *
 * CK.1: RAG Auto-Seeding
 *
 * Populates the sqlite-vec RAG store from three sources in the active project:
 *   1. flint-manifest.json — component documentation chunks (name, import,
 *      props table, variants, consumed tokens)
 *   2. .flint/design-tokens.json — token groups by type
 *   3. .flint/docs/*.md — any hand-authored markdown documentation files
 *
 * Runs async on project open, does not block UI. All errors are caught and
 * logged so that a broken manifest or missing file never crashes the session.
 */

import * as fs from 'fs/promises'
import * as path from 'path'

import { clearRAG, ingestChunks } from './ragService.js'
import type { IngestPayload } from './ragService.js'

// ── Types ─────────────────────────────────────────────────────────────────────

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
    /** CK.4: Human-authored usage example (TSX snippet). */
    usageExample?: string
    /** CK.4: Composition notes — do's, don'ts, patterns. */
    compositionNotes?: string
    /** CK.4: Accessibility implementation notes. */
    a11yNotes?: string
    /** CK.4: Names of related components. */
    relatedComponents?: string[]
}

interface FlintManifest {
    components?: Record<string, ComponentEntry>
}

interface DesignToken {
    token_path: string
    token_type: string
    token_value: string
}

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Produce a markdown documentation chunk for a single component entry.
 * Similar in spirit to registryService.formatShadowStorybook() but defined
 * locally to avoid a cross-package import from flint-mcp.
 */
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

    if (entry.usageExample) {
        lines.push('**Usage example:**')
        lines.push('```tsx')
        lines.push(entry.usageExample)
        lines.push('```')
        lines.push('')
    }

    if (entry.compositionNotes) {
        lines.push(`**Composition notes:** ${entry.compositionNotes}`)
        lines.push('')
    }

    if (entry.a11yNotes) {
        lines.push(`**Accessibility notes:** ${entry.a11yNotes}`)
        lines.push('')
    }

    if (entry.relatedComponents && entry.relatedComponents.length > 0) {
        lines.push(`**Related components:** ${entry.relatedComponents.join(', ')}`)
        lines.push('')
    }

    return lines.join('\n').trim()
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Seed the RAG store from the given project root.
 *
 * Reads flint-manifest.json, .flint/design-tokens.json, and
 * .flint/docs/*.md, then calls clearRAG() followed by ingestChunks().
 *
 * @param projectRoot - Absolute path to the project directory.
 * @returns { ingested: number; sources: string[] }
 *   `ingested` — total chunks written to the vector store.
 *   `sources`  — list of source labels that contributed at least one chunk.
 *
 * Never throws. All errors are logged as warnings and the seeder continues
 * with the remaining sources.
 */
export async function seedRAGFromProject(
    projectRoot: string,
): Promise<{ ingested: number; sources: string[] }> {
    const chunks: IngestPayload[] = []
    const sources: string[] = []

    // ── 1. flint-manifest.json — component documentation ──────────────────

    const manifestPath = path.join(projectRoot, 'flint-manifest.json')

    try {
        const raw = await fs.readFile(manifestPath, 'utf-8')
        const manifest: FlintManifest = JSON.parse(raw)
        const components = manifest.components ?? {}

        const entries = Object.values(components)

        if (entries.length > 0) {
            for (const entry of entries) {
                const content = formatComponentChunk(entry)
                if (content.length > 0) {
                    chunks.push({
                        content,
                        source: 'manifest',
                        chunkType: 'component',
                    })
                }
            }
            sources.push('manifest')
        }
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            // Missing manifest is not an error — project may not have one yet
            console.warn('[Flint CK.1] flint-manifest.json not found, skipping component chunks')
        } else {
            console.warn('[Flint CK.1] Could not read flint-manifest.json:', err)
        }
    }

    // ── 2. .flint/design-tokens.json — token groups by type ───────────────

    const tokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')

    try {
        const raw = await fs.readFile(tokensPath, 'utf-8')
        const tokens: DesignToken[] = JSON.parse(raw)

        if (Array.isArray(tokens) && tokens.length > 0) {
            // Group tokens by token_type
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
                const tokenList = group
                    .map((t) => `${t.token_path} = ${t.token_value}`)
                    .join('\n')
                const content = `Design Tokens — ${typeLabel}:\n${tokenList}`

                chunks.push({
                    content,
                    source: 'tokens',
                    chunkType: 'tokens',
                })
            }

            if (groups.size > 0) {
                sources.push('tokens')
            }
        }
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            console.warn('[Flint CK.1] .flint/design-tokens.json not found, skipping token chunks')
        } else {
            console.warn('[Flint CK.1] Could not read design-tokens.json:', err)
        }
    }

    // ── 3. .flint/docs/*.md — hand-authored documentation ─────────────────

    const docsDir = path.join(projectRoot, '.flint', 'docs')

    try {
        const entries = await fs.readdir(docsDir)
        const mdFiles = entries.filter((f) => f.endsWith('.md'))

        for (const filename of mdFiles) {
            const filePath = path.join(docsDir, filename)
            try {
                // Symlink guard: skip symlinks to prevent directory traversal
                const stat = await fs.lstat(filePath)
                if (stat.isSymbolicLink()) {
                    console.warn(`[Flint CK.1] Skipping symlink: docs/${filename}`)
                    continue
                }
                const content = (await fs.readFile(filePath, 'utf-8')).trim()
                if (content.length > 0) {
                    chunks.push({
                        content,
                        source: `docs/${filename}`,
                        chunkType: 'documentation',
                    })
                    sources.push(`docs/${filename}`)
                }
            } catch (err) {
                console.warn(`[Flint CK.1] Could not read docs/${filename}:`, err)
            }
        }
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            // .flint/docs/ is optional — silently skip
        } else {
            console.warn('[Flint CK.1] Could not read .flint/docs/:', err)
        }
    }

    // ── 4. Ingest ──────────────────────────────────────────────────────────

    if (chunks.length === 0) {
        return { ingested: 0, sources: [] }
    }

    clearRAG()
    const { ingested } = await ingestChunks(chunks)

    console.log(`[Flint CK.1] RAG seeded: ${ingested} chunks from [${sources.join(', ')}]`)

    return { ingested, sources }
}
