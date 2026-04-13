/**
 * flint_import_tokens MCP tool — flint-mcp/src/tools/importTokens.ts
 *
 * Import design tokens from any common format (JS, JSON, CSS variables) and
 * normalize them into W3C DTCG format, writing to .flint/design-tokens.json.
 *
 * Supports:
 *   - JS object literals (export const TOKENS = { ... })
 *   - Plain JSON (flat or nested)
 *   - JSON with existing $type fields (DTCG passthrough)
 *   - CSS custom properties (--token-name: value;)
 *
 * Parameters:
 *   file        — path to token file (required)
 *   merge       — merge with existing tokens (default: true)
 *   dry_run     — preview without writing (default: false)
 *   projectRoot — absolute path to project root (defaults to cwd)
 */

import fs from 'node:fs'
import path from 'node:path'
import { toolName } from '../brand.js'
import {
    importTokensFromFile,
    deepMergePreserve,
    countConflicts,
} from '../core/tokenImporter.js'
import type { ImportResult } from '../core/tokenImporter.js'

// ---------------------------------------------------------------------------
// Tool definition (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_IMPORT_TOKENS_TOOL = {
    name: toolName('import_tokens'),
    description:
        'Import design tokens from a JS, JSON, or CSS custom-property file and normalize ' +
        'them into W3C DTCG format, writing to .flint/design-tokens.json. ' +
        'Supports JS object literals (export const TOKENS = {...}), plain JSON, ' +
        'pre-formatted DTCG JSON (passed through unchanged), and CSS --custom-properties. ' +
        'Use dry_run=true to preview the import without writing. ' +
        'Use merge=false to replace the existing token file entirely.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            file: {
                type: 'string',
                description:
                    'Path to the token file to import. Accepts .js, .mjs, .json, or .css. ' +
                    'Relative paths are resolved from projectRoot.',
            },
            merge: {
                type: 'boolean',
                description:
                    'When true (default), deep-merge with existing design-tokens.json. ' +
                    'Existing token paths are never overwritten. ' +
                    'When false, the existing file is replaced.',
            },
            dry_run: {
                type: 'boolean',
                description:
                    'When true, return the import summary without writing to disk. Default: false.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to cwd.',
            },
        },
        required: ['file'],
    },
} as const

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

export interface ImportTokensArgs {
    file: string
    merge?: boolean
    dry_run?: boolean
    projectRoot?: string
}

export interface ImportTokensOutput {
    imported: number
    by_type: Record<string, number>
    skipped: string[]
    conflicts: number
    dry_run: boolean
    written: boolean
    output_path: string
    summary: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function handleImportTokens(args: ImportTokensArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // Validate required param
    if (!args.file || typeof args.file !== 'string' || args.file.trim() === '') {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Missing required parameter: file. Provide a path to a token file (.js, .json, or .css).',
                }),
            }],
            isError: true,
        }
    }

    const projectRoot = args.projectRoot ?? process.cwd()
    const merge = args.merge !== false // default: true
    const dryRun = args.dry_run === true // default: false

    // Resolve file path
    const resolvedFile = path.isAbsolute(args.file)
        ? args.file
        : path.resolve(projectRoot, args.file)

    // Validate file extension
    const ext = path.extname(resolvedFile).toLowerCase()
    const supported = ['.js', '.mjs', '.cjs', '.ts', '.json', '.css']
    if (!supported.includes(ext)) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: `Unsupported file extension: "${ext}". Supported: ${supported.join(', ')}.`,
                    file: resolvedFile,
                }),
            }],
            isError: true,
        }
    }

    // Run import
    let importResult: ImportResult
    try {
        importResult = importTokensFromFile(resolvedFile, projectRoot)
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Token import failed.',
                    detail: err instanceof Error ? err.message : String(err),
                    file: resolvedFile,
                }),
            }],
            isError: true,
        }
    }

    // Read existing tokens if merging
    const configDir = path.join(projectRoot, '.flint')
    const tokensPath = path.join(configDir, 'design-tokens.json')
    let existingTree: Record<string, unknown> = {}
    let conflicts = 0

    if (merge) {
        try {
            if (fs.existsSync(tokensPath)) {
                const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
                // design-tokens.json may be an array (DesignToken[]) or a DTCG tree
                // If it's an array, wrap it in a legacy key to preserve
                if (Array.isArray(raw)) {
                    existingTree = { _legacy: raw }
                } else if (typeof raw === 'object' && raw !== null) {
                    existingTree = raw as Record<string, unknown>
                }
            }
        } catch {
            // If we can't read existing tokens, proceed without merge
        }

        conflicts = countConflicts(existingTree, importResult.tokens)
    }

    // Compute final token tree
    const finalTree = merge
        ? deepMergePreserve(existingTree, importResult.tokens)
        : importResult.tokens

    // Write to disk (unless dry_run)
    let written = false
    if (!dryRun) {
        try {
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true })
            }
            fs.writeFileSync(tokensPath, JSON.stringify(finalTree, null, 2) + '\n', 'utf-8')
            written = true
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        error: 'Failed to write design-tokens.json.',
                        detail: err instanceof Error ? err.message : String(err),
                        output_path: tokensPath,
                    }),
                }],
                isError: true,
            }
        }
    }

    // Build summary
    const typeLines = Object.entries(importResult.summary.by_type)
        .map(([t, n]) => `  ${n} ${t} token${n !== 1 ? 's' : ''}`)
        .join('\n')

    const summaryLines: string[] = [
        `Token import ${dryRun ? 'preview' : 'complete'}:`,
        `  ${importResult.summary.imported} token${importResult.summary.imported !== 1 ? 's' : ''} imported from ${path.basename(resolvedFile)}`,
        typeLines || '  (no tokens classified)',
    ]
    if (importResult.summary.skipped.length > 0) {
        summaryLines.push(`  ${importResult.summary.skipped.length} value${importResult.summary.skipped.length !== 1 ? 's' : ''} skipped (unrecognised type)`)
    }
    if (merge && conflicts > 0) {
        summaryLines.push(`  ${conflicts} conflict${conflicts !== 1 ? 's' : ''} (existing tokens preserved — no overwrites)`)
    }
    if (!dryRun && written) {
        summaryLines.push(`  Written to: ${tokensPath}`)
    }
    if (dryRun) {
        summaryLines.push(`  Dry run — no files written. Remove dry_run=true to apply.`)
    }

    const output: ImportTokensOutput = {
        imported: importResult.summary.imported,
        by_type: importResult.summary.by_type,
        skipped: importResult.summary.skipped,
        conflicts,
        dry_run: dryRun,
        written,
        output_path: tokensPath,
        summary: summaryLines.join('\n'),
    }

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    }
}
