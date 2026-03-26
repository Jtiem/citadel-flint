/**
 * flint_set_library MCP tool — flint-mcp/src/tools/setLibrary.ts
 *
 * Phase LIB.1: Sets the active component library for a project.
 * Writes selectedLibrary to .flint/policy.json and seeds base tokens.
 *
 * Supports two modes:
 *   - Explicit: library="shadcn" → set and seed
 *   - Auto-detect: library="auto" → detect from existing tokens
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import fs from 'node:fs'
import path from 'node:path'
import { toolName, configPath } from '../brand.js'
import {
    getAdapter,
    getAvailableLibraries,
    getAdapterCatalog,
    hasAdapter,
    detectLibraryFromTokens,
} from '../core/libraryAdapters/index.js'
import type { LibraryTarget } from '../core/libraryAdapters/types.js'
import type { DesignToken } from '../types.js'

// ---------------------------------------------------------------------------
// Tool definition (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_SET_LIBRARY_TOOL = {
    name: toolName('set_library'),
    description:
        'Set the active component library for this project. Writes selectedLibrary to ' +
        '.flint/policy.json and seeds the project with the library\'s base design tokens ' +
        '(merge-with-preserve: existing tokens are never overwritten). ' +
        'Pass library="auto" to auto-detect from existing tokens. ' +
        'Pass library="list" to see available libraries. ' +
        'Supported: shadcn, mui, primeng, tailwind.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            library: {
                type: 'string',
                enum: ['shadcn', 'mui', 'primeng', 'tailwind', 'auto', 'list', 'none'],
                description:
                    'Target component library. Use "auto" to detect from existing tokens, ' +
                    '"list" to see available libraries, "none" to clear the selection.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root. Defaults to cwd.',
            },
        },
        required: ['library'],
    },
} as const

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export interface SetLibraryArgs {
    library: string
    projectRoot?: string
}

export function handleSetLibrary(args: SetLibraryArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    const projectRoot = args.projectRoot ?? process.cwd()

    // --- List mode ---
    if (args.library === 'list') {
        const catalog = getAdapterCatalog()
        const listing = catalog.map(a =>
            `  ${a.library.padEnd(10)} ${a.displayName} — ${a.description}`,
        ).join('\n')

        return {
            content: [{
                type: 'text',
                text: `Available libraries (${catalog.length}):\n\n${listing}\n\nUse library="auto" to detect from existing tokens.`,
            }],
        }
    }

    // --- Clear mode ---
    if (args.library === 'none') {
        const policy = readPolicy(projectRoot)
        delete policy.selectedLibrary
        writePolicy(projectRoot, policy)
        return {
            content: [{
                type: 'text',
                text: 'Active library cleared. AI generation will use generic constraints only.',
            }],
        }
    }

    // --- Auto-detect mode ---
    if (args.library === 'auto') {
        const tokens = readTokens(projectRoot)
        if (tokens.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: 'No tokens found in .flint/design-tokens.json. Import tokens first (flint_sync_pull or flint_ingest_figma), then run flint_set_library with library="auto".',
                }],
                isError: true,
            }
        }

        const detection = detectLibraryFromTokens(tokens)

        if (!detection.library) {
            const scoreList = Object.entries(detection.scores)
                .sort(([, a], [, b]) => b.score - a.score)
                .map(([lib, r]) => `  ${lib.padEnd(10)} score=${r.score}  ${r.reasons.slice(0, 2).join('; ')}`)
                .join('\n')

            return {
                content: [{
                    type: 'text',
                    text: `Auto-detection inconclusive (confidence=${detection.confidence}%, threshold=60%).\n\nScores:\n${scoreList}\n\nSpecify the library explicitly: flint_set_library library="shadcn"`,
                }],
            }
        }

        // Confident detection — fall through to set it
        args = { ...args, library: detection.library }

        // Continue to the explicit set logic below, but include detection info
        const detectionNote = `Auto-detected: ${detection.library} (confidence=${detection.confidence}%)\n\n`
        const result = setLibraryExplicit(args.library as LibraryTarget, projectRoot)
        if (result.isError) return result
        return {
            content: [{
                type: 'text',
                text: detectionNote + result.content[0].text,
            }],
        }
    }

    // --- Explicit set mode ---
    const libraryTarget = args.library as LibraryTarget
    if (!hasAdapter(libraryTarget)) {
        const available = getAvailableLibraries().join(', ')
        return {
            content: [{
                type: 'text',
                text: `Unknown library: "${args.library}". Available: ${available}. Pass library="list" for details.`,
            }],
            isError: true,
        }
    }

    return setLibraryExplicit(libraryTarget, projectRoot)
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function setLibraryExplicit(library: LibraryTarget, projectRoot: string): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // 1. Write selectedLibrary to policy.json
    const policy = readPolicy(projectRoot)
    const previousLibrary = policy.selectedLibrary
    policy.selectedLibrary = library
    writePolicy(projectRoot, policy)

    // 2. Seed tokens (merge-with-preserve)
    const adapter = getAdapter(library)
    const seedTokens = adapter.seedTokens()
    const { seeded, existing, total } = mergeTokens(projectRoot, seedTokens)

    // 3. Build response
    const lines: string[] = [
        `Active library set to: ${adapter.displayName} (${library})`,
    ]

    if (previousLibrary && previousLibrary !== library) {
        lines.push(`Previous library: ${previousLibrary}`)
        lines.push(`Note: ${previousLibrary} tokens remain in design-tokens.json. Run flint_audit to identify orphaned tokens.`)
    }

    lines.push('')
    lines.push(`Token seeding: ${seeded} new tokens added, ${existing} existing preserved (${total} total)`)

    if (seeded > 0) {
        lines.push('')
        lines.push('Next steps:')
        lines.push('  1. Run flint_sync_push to push tokens to Figma')
        lines.push('  2. Design with tokens in Figma')
        lines.push('  3. Run flint_sync_pull to import updates')
        lines.push(`  4. Run flint_map_tokens library="${library}" to generate theme file`)
    }

    return {
        content: [{ type: 'text', text: lines.join('\n') }],
    }
}

// ---------------------------------------------------------------------------
// Policy helpers
// ---------------------------------------------------------------------------

function readPolicy(projectRoot: string): Record<string, unknown> {
    const policyPath = path.join(projectRoot, configPath('policy.json'))
    try {
        if (fs.existsSync(policyPath)) {
            return JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
        }
    } catch { /* ignore parse errors */ }
    return {}
}

function writePolicy(projectRoot: string, policy: Record<string, unknown>): void {
    const configDir = path.join(projectRoot, configPath(''))
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }
    const policyPath = path.join(configDir, 'policy.json')
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n', 'utf-8')
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function readTokens(projectRoot: string): DesignToken[] {
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    try {
        if (fs.existsSync(tokensPath)) {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            return Array.isArray(raw) ? raw : []
        }
    } catch { /* ignore */ }
    return []
}

/**
 * Merge seed tokens into existing tokens with preserve semantics.
 * Existing token paths are never overwritten.
 */
function mergeTokens(projectRoot: string, seedTokens: DesignToken[]): {
    seeded: number
    existing: number
    total: number
} {
    const currentTokens = readTokens(projectRoot)
    const existingPaths = new Set(currentTokens.map(t => t.token_path))

    let seeded = 0
    const merged = [...currentTokens]
    let nextId = currentTokens.length > 0
        ? Math.max(...currentTokens.map(t => t.id)) + 1
        : 1

    for (const seed of seedTokens) {
        if (!existingPaths.has(seed.token_path)) {
            merged.push({ ...seed, id: nextId++ })
            seeded++
        }
    }

    // Write merged tokens
    const configDir = path.join(projectRoot, configPath(''))
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }
    const tokensPath = path.join(configDir, 'design-tokens.json')
    fs.writeFileSync(tokensPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

    return {
        seeded,
        existing: existingPaths.size,
        total: merged.length,
    }
}
