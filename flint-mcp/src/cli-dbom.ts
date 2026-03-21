#!/usr/bin/env node
/**
 * flint-dbom CLI — flint-mcp/src/cli-dbom.ts
 *
 * Command-line interface for generating a Design Bill of Materials (DBOM).
 *
 * Usage:
 *   npx flint-dbom                           # Generate DBOM as JSON to stdout
 *   npx flint-dbom --output dbom.json        # Write JSON to file
 *   npx flint-dbom --format markdown         # Human-readable Markdown to stdout
 *   npx flint-dbom --format markdown --output dbom.md
 *   npx flint-dbom --project-root /path/to/project
 *
 * Options:
 *   --project-root <path>   Absolute path to the project root (default: cwd).
 *   --format <json|markdown>  Output format (default: json).
 *   --output <file>           Write output to file instead of stdout.
 *   --help                  Show this help message.
 *
 * Exit codes:
 *   0 — Success (project is compliant or non-compliant; DBOM generated OK).
 *   1 — Fatal error (project root not found, parse failure, etc.).
 *   2 — Non-compliant exit (when --strict flag is set and violations exist).
 */

import fs from 'node:fs'
import path from 'node:path'
import { generateDBOM } from './core/dbom/generator.js'
import { formatDBOMAsMarkdown } from './core/dbom/formatter.js'

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
    projectRoot: string
    format: 'json' | 'markdown'
    output: string | null
    strict: boolean
    help: boolean
} {
    const args = argv.slice(2) // drop 'node' and script path
    let projectRoot = process.cwd()
    let format: 'json' | 'markdown' = 'json'
    let output: string | null = null
    let strict = false
    let help = false

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '--help' || arg === '-h') {
            help = true
        } else if (arg === '--project-root' && args[i + 1]) {
            projectRoot = path.resolve(args[++i]!)
        } else if (arg === '--format' && args[i + 1]) {
            const fmt = args[++i]
            if (fmt === 'json' || fmt === 'markdown') {
                format = fmt
            } else {
                stderr(`Unknown format '${fmt}'. Use 'json' or 'markdown'.`)
                process.exit(1)
            }
        } else if (arg === '--output' && args[i + 1]) {
            output = path.resolve(args[++i]!)
        } else if (arg === '--strict') {
            strict = true
        }
    }

    return { projectRoot, format, output, strict, help }
}

function stderr(msg: string): void {
    process.stderr.write(msg + '\n')
}

function showHelp(): void {
    process.stdout.write(`
flint-dbom — Design Bill of Materials generator

USAGE
  npx flint-dbom [options]

OPTIONS
  --project-root <path>     Project root (default: current directory)
  --format <json|markdown>  Output format (default: json)
  --output <file>           Write to file instead of stdout
  --strict                  Exit code 2 when compliance status is non-compliant
  --help                    Show this help

EXAMPLES
  npx flint-dbom
  npx flint-dbom --output dbom.json
  npx flint-dbom --format markdown
  npx flint-dbom --format markdown --output dbom.md
  npx flint-dbom --project-root /path/to/my-project --format json --output dbom.json
  npx flint-dbom --strict  # exits 2 if project is non-compliant

OUTPUT
  JSON output: full DesignBillOfMaterials schema (version 1.0)
  Markdown output: human-readable report with component table, token inventory,
                   dead token list, active overrides, and baseline delta.
`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const { projectRoot, format, output, strict, help } = parseArgs(process.argv)

    if (help) {
        showHelp()
        process.exit(0)
    }

    // Validate project root
    if (!fs.existsSync(projectRoot)) {
        stderr(`Error: project root not found: ${projectRoot}`)
        process.exit(1)
    }

    stderr(`[flint-dbom] Scanning ${projectRoot}…`)

    let dbom
    try {
        dbom = await generateDBOM(projectRoot)
    } catch (err) {
        stderr(`Error: DBOM generation failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
    }

    const text = format === 'markdown' ? formatDBOMAsMarkdown(dbom) : JSON.stringify(dbom, null, 2)

    if (output !== null) {
        const dir = path.dirname(output)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(output, text, 'utf-8')
        stderr(`[flint-dbom] DBOM written to ${output}`)
        stderr(`[flint-dbom] Health: ${dbom.summary.healthScore}/100 (Grade ${dbom.summary.grade}) — ${dbom.summary.complianceStatus}`)
    } else {
        process.stdout.write(text + '\n')
        stderr(`[flint-dbom] Health: ${dbom.summary.healthScore}/100 (Grade ${dbom.summary.grade}) — ${dbom.summary.complianceStatus}`)
    }

    // --strict: exit 2 when the project is non-compliant
    if (strict && dbom.summary.complianceStatus === 'non-compliant') {
        stderr(`[flint-dbom] --strict: project is non-compliant. Exiting with code 2.`)
        process.exit(2)
    }
}

main().catch((err) => {
    process.stderr.write(`[flint-dbom] Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
})
