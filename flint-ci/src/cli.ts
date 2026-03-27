#!/usr/bin/env node
/**
 * CLI -- flint-ci/src/cli.ts
 *
 * Commander-based CLI for the Flint Governance Gate.
 * Thin shell that delegates all governance logic to the Flint MCP engine.
 *
 * Subcommands:
 *   audit [paths...]  -- Scan files for governance violations (default)
 *   debt  [paths...]  -- Generate design debt report
 *   sync              -- Check token sync health
 *   dbom              -- Generate Design Bill of Materials
 *   fix   [paths...]  -- Auto-fix violations (dry-run by default)
 *   init              -- Generate starter flint.config.yaml
 *
 * Exit codes:
 *   0 -- Pass
 *   1 -- Blocked (violations found)
 *   2 -- Usage error
 *   3 -- Config error
 */

import { Command } from 'commander'
import { auditCommand } from './commands/audit.js'
import { debtCommand } from './commands/debt.js'
import { syncCheckCommand } from './commands/sync-check.js'
import { dbomCommand } from './commands/dbom.js'
import { fixCommand } from './commands/fix.js'
import { initCommand } from './commands/init.js'
import { baselineCommand } from './commands/baseline.js'

const program = new Command()

program
    .name('flint-gate')
    .description('Flint Governance Gate -- CI/CD governance checks powered by the Flint MCP engine')
    .version('2.0.0')

// ── audit (default command) ──────────────────────────────────────────────────

program
    .command('audit [paths...]', { isDefault: true })
    .description('Scan source files for governance violations')
    .option('-c, --changed', 'Scan only git-changed files (vs merge base)')
    .option('--fix', 'Auto-fix violations after audit (applies fixes in one pass)')
    .option('--format <format>', 'Output format (terminal|json|sarif)', 'terminal')
    .option('--sarif <file>', 'Write SARIF 2.1.0 report to FILE')
    .option('--fail-on-warning', 'Exit 1 on amber-level violations too')
    .option('--baseline', 'Suppress known violations from .flint/baseline.json')
    .option('--cache', 'Skip files unchanged since last audit (uses content hash)')
    .option('--tokens <file>', 'Path to design tokens JSON', '.flint/design-tokens.json')
    .option('--policy <file>', 'Path to legacy policy JSON (overrides flint.config.yaml)')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (paths: string[], opts) => {
        try {
            const exitCode = await auditCommand(paths, opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── debt ─────────────────────────────────────────────────────────────────────

program
    .command('debt [paths...]')
    .description('Generate design debt report with health score')
    .option('--format <format>', 'Output format (markdown|json)', 'json')
    .option('--track', 'Append snapshot to .flint/debt-history.json')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (paths: string[], opts) => {
        try {
            const exitCode = await debtCommand(paths, opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── sync ─────────────────────────────────────────────────────────────────────

program
    .command('sync')
    .description('Check token sync health (detects drift from Figma)')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (opts) => {
        try {
            const exitCode = await syncCheckCommand(opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── dbom ─────────────────────────────────────────────────────────────────────

program
    .command('dbom')
    .description('Generate Design Bill of Materials')
    .option('--format <format>', 'Output format (json|markdown|cyclonedx)', 'json')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (opts) => {
        try {
            const exitCode = await dbomCommand(opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── fix ──────────────────────────────────────────────────────────────────────

program
    .command('fix [paths...]')
    .description('Auto-fix governance violations (dry-run by default)')
    .option('--dry-run', 'Print what would change without modifying files', true)
    .option('--no-dry-run', 'Actually apply fixes')
    .option('--tokens <file>', 'Path to design tokens JSON', '.flint/design-tokens.json')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (paths: string[], opts) => {
        try {
            const exitCode = await fixCommand(paths, opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── baseline ────────────────────────────────────────────────────────────────

program
    .command('baseline [paths...]')
    .description('Generate .flint/baseline.json from current violations (enables incremental adoption)')
    .option('--update', 'Merge with existing baseline instead of replacing')
    .option('--tokens <file>', 'Path to design tokens JSON', '.flint/design-tokens.json')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (paths: string[], opts) => {
        try {
            const exitCode = await baselineCommand(paths, opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── init ────────────────────────────────────────────────────────────────────

program
    .command('init')
    .description('Generate a starter flint.config.yaml for your project')
    .option('--force', 'Overwrite existing flint.config.yaml')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (opts) => {
        try {
            const exitCode = await initCommand(opts)
            process.exit(exitCode)
        } catch (err) {
            printError(err)
            process.exit(3)
        }
    })

// ── Error helper ─────────────────────────────────────────────────────────────

function printError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`\x1b[31mError: ${message}\x1b[0m`)
    if (err instanceof Error && err.stack) {
        console.error(`\x1b[2m${err.stack}\x1b[0m`)
    }
}

// ── Parse & run ──────────────────────────────────────────────────────────────

program.parse()
