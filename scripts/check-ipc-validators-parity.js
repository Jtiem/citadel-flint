#!/usr/bin/env node
/**
 * scripts/check-ipc-validators-parity.js
 *
 * Asserts that shared/ipc-validators.js and shared/ipc-validators.ts expose
 * the same named exports. The .js file is the runtime module loaded by the
 * server (Node ESM); the .ts file is the compile-time source for the renderer.
 * If they drift, the server throws at runtime on a missing schema import while
 * TSC stays clean.
 *
 * Run: node scripts/check-ipc-validators-parity.js
 * CI:  npm run validators:check
 *
 * Exit 0 — exports match.
 * Exit 1 — exports differ — lists missing/extra on each side.
 *
 * Detection strategy: parse both files with a regex that extracts
 * `export const <name>` declarations. This is intentionally simple and
 * sufficient for the ipc-validators files which only export `const` and
 * `function` named values.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const tsSource = readFileSync(resolve(root, 'shared/ipc-validators.ts'), 'utf-8')
const jsSource = readFileSync(resolve(root, 'shared/ipc-validators.js'), 'utf-8')

/**
 * Extract all `export const <name>` and `export function <name>` identifiers
 * from a source string.
 */
function extractExports(source) {
  const matches = [...source.matchAll(/^export\s+(?:const|function)\s+(\w+)/gm)]
  return new Set(matches.map((m) => m[1]))
}

const tsExports = extractExports(tsSource)
const jsExports = extractExports(jsSource)

const inTsNotJs = [...tsExports].filter((e) => !jsExports.has(e))
const inJsNotTs = [...jsExports].filter((e) => !tsExports.has(e))

if (inTsNotJs.length === 0 && inJsNotTs.length === 0) {
  console.log(
    `[validators:check] OK — ${tsExports.size} exports match between .ts and .js`,
  )
  process.exit(0)
} else {
  console.error('[validators:check] FAIL — ipc-validators.ts and .js are out of sync.\n')
  if (inTsNotJs.length > 0) {
    console.error(
      `  In .ts but NOT in .js (${inTsNotJs.length}):\n` +
        inTsNotJs.map((e) => `    - ${e}`).join('\n'),
    )
  }
  if (inJsNotTs.length > 0) {
    console.error(
      `\n  In .js but NOT in .ts (${inJsNotTs.length}):\n` +
        inJsNotTs.map((e) => `    - ${e}`).join('\n'),
    )
  }
  console.error(
    '\nAdd the missing export(s) to the other file and re-run `npm run validators:check`.',
  )
  process.exit(1)
}
