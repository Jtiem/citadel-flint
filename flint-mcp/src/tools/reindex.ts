/**
 * flint_reindex_registry tool handler — CK.3
 *
 * Re-scans the project's source tree for components, merges the
 * result into flint-manifest.json, and returns a summary so the caller
 * knows the registry is current.
 *
 * RAG re-seeding is NOT performed here because the RAG store lives in
 * Electron's user-data directory and is not accessible from the MCP
 * server process.  Flint Glass triggers seedRAGFromProject() on project
 * open, so the RAG store will be fresh the next time the project loads.
 * For immediate RAG refresh, invoke `window.flintAPI.project.reindex()`
 * from the renderer instead.
 */

import fs from 'node:fs'
import path from 'node:path'
import { indexComponents } from '../core/init/componentIndexer.js'

// ── Tool definition (for ListToolsRequestSchema) ─────────────────────────────

export const FLINT_REINDEX_REGISTRY_TOOL = {
    name: 'flint_reindex_registry',
    description:
        'CK.3: Re-scans the project source tree for components and updates ' +
        'flint-manifest.json with the latest component inventory. ' +
        'Use this after adding, renaming, or removing components so the registry ' +
        'stays in sync and flint_query_registry returns up-to-date results. ' +
        'Returns the number of components indexed and a list of any warnings.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root (must contain flint-manifest.json or src/).',
            },
            srcDir: {
                type: 'string',
                description:
                    'Optional subdirectory to scan relative to projectRoot. Defaults to "src".',
            },
        },
        required: ['projectRoot'],
    },
} as const

// ── Handler ───────────────────────────────────────────────────────────────────

export interface ReindexResult {
    components: number
    warnings: string[]
    manifestUpdated: boolean
    error?: string
}

export async function handleReindexRegistry(args: {
    projectRoot: string
    srcDir?: string
}): Promise<ReindexResult> {
    const { projectRoot, srcDir } = args

    if (!projectRoot || typeof projectRoot !== 'string') {
        return { components: 0, warnings: [], manifestUpdated: false, error: 'projectRoot is required' }
    }

    const resolvedRoot = path.resolve(projectRoot)
    if (!fs.existsSync(resolvedRoot)) {
        return {
            components: 0,
            warnings: [],
            manifestUpdated: false,
            error: `projectRoot does not exist: ${resolvedRoot}`,
        }
    }

    // 1. Run Babel AST component scanner (Commandment 13)
    let indexResult: Awaited<ReturnType<typeof indexComponents>>
    try {
        indexResult = await indexComponents(resolvedRoot, srcDir)
    } catch (err) {
        return {
            components: 0,
            warnings: [],
            manifestUpdated: false,
            error: `indexComponents failed: ${err instanceof Error ? err.message : String(err)}`,
        }
    }

    // 2. Read existing manifest (or start fresh)
    const manifestPath = path.join(resolvedRoot, 'flint-manifest.json')
    let manifest: Record<string, unknown> = {}
    try {
        const raw = fs.readFileSync(manifestPath, 'utf-8')
        manifest = JSON.parse(raw) as Record<string, unknown>
    } catch {
        // Missing or malformed manifest — will be created below
    }

    // 3. Merge components into manifest and write back (atomic: tmp → rename, Commandment 12)
    manifest.components = indexResult.components
    const tmpPath = manifestPath + '.tmp'
    let manifestUpdated = false
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
        fs.renameSync(tmpPath, manifestPath)
        manifestUpdated = true
    } catch (err) {
        try { fs.rmSync(tmpPath, { force: true }) } catch { /* ignore cleanup error */ }
        return {
            components: indexResult.count,
            warnings: indexResult.warnings,
            manifestUpdated: false,
            error: `Failed to write manifest: ${err instanceof Error ? err.message : String(err)}`,
        }
    }

    return {
        components: indexResult.count,
        warnings: indexResult.warnings,
        manifestUpdated,
    }
}
