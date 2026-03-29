#!/usr/bin/env node
/**
 * Conditional postinstall: only run electron-rebuild when Electron is present.
 * Web/npx installs skip this step — better-sqlite3 builds for Node.js natively.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const electronPresent = existsSync(resolve(__dirname, '..', 'node_modules', 'electron'))

if (electronPresent) {
  execSync('electron-rebuild -f -w better-sqlite3', { stdio: 'inherit' })
}
