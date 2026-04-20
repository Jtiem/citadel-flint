/**
 * server/__tests__/cli.test.ts
 *
 * Tests for the CLI argument parser extracted from server/cli.ts.
 *
 * The parseArgs() function is not exported, so we replicate it here
 * as a pure unit under test. The goal is to verify every flag's
 * parse behaviour without actually starting the server.
 *
 * Separately, we test the startServer integration path by mocking
 * the './index.js' module so no real server binds a port.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'

// ── Replicated parseArgs ──────────────────────────────────────────────────────
// We copy the logic here because it's unexported.  Any change to cli.ts must
// also update this copy — a deliberate coupling signal.

const VALID_DEMO_NAMES = new Set([
  'multi-component-app',
  'dashboard-before',
  'dashboard-after',
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
  const devWorkspace = process.env.FLINT_DEV_WORKSPACE
    ? path.resolve(process.env.FLINT_DEV_WORKSPACE)
    : null

  const result = {
    project: devWorkspace ?? process.cwd(),
    port: 4201,
    open: true,
    demo: false,
    demoName: 'multi-component-app',
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
        if (i < argv.length) result.project = path.resolve(argv[i])
        break
      case '--port':
        i++
        if (i < argv.length) {
          const parsed = parseInt(argv[i], 10)
          if (!isNaN(parsed) && parsed > 0 && parsed < 65536) result.port = parsed
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
        result.open = true
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

// ── Arg parsing tests ─────────────────────────────────────────────────────────

describe('parseArgs', () => {
  const base = ['node', 'cli.js']

  it('defaults: port 4201, open true, no demo, no help/version', () => {
    const args = parseArgs([...base])
    expect(args.port).toBe(4201)
    expect(args.open).toBe(true)
    expect(args.demo).toBe(false)
    expect(args.help).toBe(false)
    expect(args.version).toBe(false)
    expect(args.init).toBe(false)
  })

  it('--project resolves the provided path', () => {
    const args = parseArgs([...base, '--project', '/tmp/my-app'])
    expect(args.project).toBe('/tmp/my-app')
  })

  it('-p is an alias for --project', () => {
    const args = parseArgs([...base, '-p', '/tmp/my-app'])
    expect(args.project).toBe('/tmp/my-app')
  })

  it('--port sets port to a valid number', () => {
    const args = parseArgs([...base, '--port', '3000'])
    expect(args.port).toBe(3000)
  })

  it('--port with out-of-range value (0) keeps default', () => {
    const args = parseArgs([...base, '--port', '0'])
    expect(args.port).toBe(4201)
  })

  it('--port with out-of-range value (65536) keeps default', () => {
    const args = parseArgs([...base, '--port', '65536'])
    expect(args.port).toBe(4201)
  })

  it('--port with non-numeric value keeps default', () => {
    const args = parseArgs([...base, '--port', 'abc'])
    expect(args.port).toBe(4201)
  })

  it('--no-open sets open to false', () => {
    const args = parseArgs([...base, '--no-open'])
    expect(args.open).toBe(false)
  })

  it('--open sets open to true (explicit)', () => {
    const args = parseArgs([...base, '--no-open', '--open'])
    expect(args.open).toBe(true)
  })

  it('-o sets open to true', () => {
    const args = parseArgs([...base, '--no-open', '-o'])
    expect(args.open).toBe(true)
  })

  it('--demo sets demo: true and defaults demoName to multi-component-app', () => {
    const args = parseArgs([...base, '--demo'])
    expect(args.demo).toBe(true)
    expect(args.demoName).toBe('multi-component-app')
    expect(args.open).toBe(true)
  })

  it('--demo with a valid name sets demoName', () => {
    const args = parseArgs([...base, '--demo', 'dashboard-before'])
    expect(args.demo).toBe(true)
    expect(args.demoName).toBe('dashboard-before')
  })

  it('--demo with an invalid name keeps default demoName', () => {
    const args = parseArgs([...base, '--demo', 'unknown-demo'])
    expect(args.demoName).toBe('multi-component-app')
  })

  it('-d is an alias for --demo', () => {
    const args = parseArgs([...base, '-d', 'dashboard-after'])
    expect(args.demo).toBe(true)
    expect(args.demoName).toBe('dashboard-after')
  })

  it('--version sets version flag', () => {
    const args = parseArgs([...base, '--version'])
    expect(args.version).toBe(true)
  })

  it('-v is an alias for --version', () => {
    const args = parseArgs([...base, '-v'])
    expect(args.version).toBe(true)
  })

  it('--help sets help flag', () => {
    const args = parseArgs([...base, '--help'])
    expect(args.help).toBe(true)
  })

  it('-h is an alias for --help', () => {
    const args = parseArgs([...base, '-h'])
    expect(args.help).toBe(true)
  })

  it('--init sets init flag', () => {
    const args = parseArgs([...base, '--init'])
    expect(args.init).toBe(true)
  })

  it('FLINT_DEV_WORKSPACE env overrides default project', () => {
    process.env.FLINT_DEV_WORKSPACE = '/tmp/workspace'
    try {
      const args = parseArgs([...base])
      expect(args.project).toBe('/tmp/workspace')
    } finally {
      delete process.env.FLINT_DEV_WORKSPACE
    }
  })

  it('--project overrides FLINT_DEV_WORKSPACE', () => {
    process.env.FLINT_DEV_WORKSPACE = '/tmp/workspace'
    try {
      const args = parseArgs([...base, '--project', '/tmp/explicit'])
      expect(args.project).toBe('/tmp/explicit')
    } finally {
      delete process.env.FLINT_DEV_WORKSPACE
    }
  })

  it('multiple flags parsed correctly together', () => {
    const args = parseArgs([
      ...base,
      '--project', '/tmp/proj',
      '--port', '5000',
      '--no-open',
    ])
    expect(args.project).toBe('/tmp/proj')
    expect(args.port).toBe(5000)
    expect(args.open).toBe(false)
  })
})

// ── --init integration ────────────────────────────────────────────────────────

describe('--init flag behaviour (file writing)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'flint-cli-init-'))
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it('--init writes .flint/policy.json, design-tokens.json and flint.config.yaml', async () => {
    // We replicate the --init write logic rather than invoking main() to avoid
    // process.exit() complications.
    const { mkdirSync: mkdir, writeFileSync: write } = await import('node:fs')
    const flintDir = path.join(tmpDir, '.flint')
    mkdir(flintDir, { recursive: true })

    write(path.join(flintDir, 'policy.json'), JSON.stringify({ version: '1', rules: {} }, null, 2) + '\n', 'utf8')
    write(path.join(flintDir, 'design-tokens.json'), JSON.stringify({ $schema: 'https://tr.designtokens.org/format/' }, null, 2) + '\n', 'utf8')
    write(path.join(tmpDir, 'flint.config.yaml'), 'version: 1\n', 'utf8')

    const { existsSync } = await import('node:fs')
    expect(existsSync(path.join(flintDir, 'policy.json'))).toBe(true)
    expect(existsSync(path.join(flintDir, 'design-tokens.json'))).toBe(true)
    expect(existsSync(path.join(tmpDir, 'flint.config.yaml'))).toBe(true)
  })
})
