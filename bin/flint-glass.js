#!/usr/bin/env node
/**
 * Flint Glass CLI entrypoint.
 *
 * Runs the pre-compiled server bundle (dist-server/cli.mjs).
 * Build it first:  npm run build:server
 *
 * Usage:
 *   flint-glass [options]
 *   npx flint-glass [options]
 */

import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compiled = resolve(__dirname, '..', 'dist-server', 'cli.mjs')

if (!existsSync(compiled)) {
  console.error(
    '[flint-glass] Server bundle not found at dist-server/cli.mjs\n' +
    '             Run `npm run build:server` first, then try again.'
  )
  process.exit(1)
}

await import(compiled)
