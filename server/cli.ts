#!/usr/bin/env node
/**
 * Flint Glass Web Server CLI — server/cli.ts
 *
 * Usage:
 *   flint-glass [options]
 *
 * Options:
 *   --project <path>   Project directory to open (default: cwd)
 *   --port <number>    Server port (default: 4201)
 *   --open             Open browser automatically (default: true)
 *   --no-open          Suppress automatic browser launch
 *   --demo             Load demo project (no --project required)
 *   --init             Write default config files to --project path and exit
 *   --version, -v      Print version and exit
 *   --help             Show this help message
 */

import path from 'node:path'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startServer } from './index.js'

function readVersion(): string {
  try {
    const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

// ── Argument Parsing ─────────────────────────────────────────────────────────
// Simple argv parser — no external dependency needed for these flags.

const VALID_DEMO_NAMES = new Set([
  'token-drift',
  'a11y-audit',
  'design-system-migration',
  'multi-component-app',
])

function parseArgs(argv: string[]): {
  project: string
  port: number
  open: boolean
  demo: boolean
  demoName: string
  help: boolean
  version: boolean
  init: boolean
} {
  const result = {
    project: process.cwd(),
    port: 4201,
    open: true,   // default: auto-open browser
    demo: false,
    demoName: 'token-drift',  // default demo name
    help: false,
    version: false,
    init: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--project':
      case '-p':
        i++
        if (i < argv.length) {
          result.project = path.resolve(argv[i])
        }
        break
      case '--port':
        i++
        if (i < argv.length) {
          const parsed = parseInt(argv[i], 10)
          if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
            result.port = parsed
          }
        }
        break
      case '--open':
      case '-o':
        result.open = true
        break
      case '--no-open':
        result.open = false
        break
      case '--demo':
      case '-d': {
        result.demo = true
        result.open = true  // --demo implies --open
        // Peek at the next arg — if it's a known demo name (not a flag), use it
        const next = argv[i + 1]
        if (next && !next.startsWith('-') && VALID_DEMO_NAMES.has(next)) {
          result.demoName = next
          i++
        }
        break
      }
      case '--version':
      case '-v':
        result.version = true
        break
      case '--help':
      case '-h':
        result.help = true
        break
      case '--init':
        result.init = true
        break
    }
  }

  return result
}

// ── Banner ───────────────────────────────────────────────────────────────────

function printBanner(projectRoot: string, port: number): void {
  const lines = [
    '',
    '  ┌─────────────────────────────────────────┐',
    '  │         Flint Glass Web Server           │',
    '  │                                          │',
    `  │  Local:   http://localhost:${String(port).padEnd(14)}│`,
    `  │  WS:      ws://localhost:${String(port).padEnd(13)}/ws │`,
    '  │                                          │',
    `  │  Project: ${projectRoot.length > 28 ? '...' + projectRoot.slice(-25) : projectRoot.padEnd(28)}│`,
    '  │                                          │',
    '  │  Press Ctrl+C to stop                    │',
    '  └─────────────────────────────────────────┘',
    '',
  ]
  console.log(lines.join('\n'))
}

function printHelp(): void {
  console.log(`
Flint Glass Web Server

Runs the Flint Glass observability layer in any browser,
replacing the Electron main process with an Express server.

Usage:
  flint-glass [options]
  npx flint-glass [options]

Options:
  --project, -p <path>   Project directory to open (default: cwd)
  --port <number>        Server port (default: 4201)
  --open, -o             Open browser automatically (default: true)
  --no-open              Suppress automatic browser launch
  --demo, -d [name]      Load demo project (skips --project requirement)
                         Valid names: token-drift (default), a11y-audit,
                           design-system-migration, multi-component-app
  --init                 Write default config files to --project path and exit
  --version, -v          Print version and exit
  --help, -h             Show this help message

Examples:
  npx flint-glass --demo
  npx flint-glass --demo a11y-audit
  npx flint-glass --demo design-system-migration
  npx flint-glass --project ~/my-app
  npx flint-glass --project ./my-project --port 3000 --no-open
`)
}

// ── Open Browser ─────────────────────────────────────────────────────────────

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process')
  const platform = process.platform

  let cmd: string
  if (platform === 'darwin') {
    cmd = `open "${url}"`
  } else if (platform === 'win32') {
    cmd = `start "${url}"`
  } else {
    cmd = `xdg-open "${url}"`
  }

  exec(cmd, (err) => {
    if (err) {
      console.warn(`[Flint] Could not open browser automatically: ${err.message}`)
      console.warn(`[Flint] Open ${url} in your browser manually.`)
    }
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  if (args.version) {
    console.log(readVersion())
    process.exit(0)
  }

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (args.init) {
    const initRoot = args.project  // defaults to cwd() when --project not provided
    const flintDir = path.join(initRoot, '.flint')
    mkdirSync(flintDir, { recursive: true })

    writeFileSync(
      path.join(flintDir, 'policy.json'),
      JSON.stringify({ version: '1', rules: {} }, null, 2) + '\n',
      'utf8',
    )

    writeFileSync(
      path.join(flintDir, 'design-tokens.json'),
      JSON.stringify({ $schema: 'https://tr.designtokens.org/format/' }, null, 2) + '\n',
      'utf8',
    )

    writeFileSync(
      path.join(initRoot, 'flint.config.yaml'),
      [
        'version: 1',
        'governance:',
        '  mithril:',
        '    deltaE_threshold: 2.0',
        '  accessibility:',
        '    mode: "strict"',
        '',
      ].join('\n'),
      'utf8',
    )

    console.log(`Flint initialized in ${initRoot}. Edit .flint/policy.json to customize governance rules.`)
    process.exit(0)
  }

  // Validate project path (skip when --demo is set — app auto-loads the demo)
  if (!args.demo && !existsSync(args.project)) {
    console.error(`[Flint] Error: Project directory does not exist: ${args.project}`)
    console.error(`[Flint] Tip: run with --demo to open the built-in demo project`)
    process.exit(1)
  }

  try {
    const instance = await startServer({
      projectRoot: args.demo ? process.cwd() : args.project,
      port: args.port,
    })

    printBanner(args.demo ? '(demo)' : args.project, args.port)

    // --demo opens the browser with ?demo=<name> so App.tsx force-loads the demo.
    // The name is passed so App.tsx can forward it to beta:load-demo-project.
    const browserUrl = args.demo
      ? `http://localhost:${args.port}/?demo=${encodeURIComponent(args.demoName)}`
      : `http://localhost:${args.port}`

    if (args.open) {
      await openBrowser(browserUrl)
    }

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n[Flint] Shutting down...')
      await instance.close()
      console.log('[Flint] Server stopped.')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (err) {
    console.error('[Flint] Failed to start server:', err)
    process.exit(1)
  }
}

main()
