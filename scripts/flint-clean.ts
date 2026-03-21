#!/usr/bin/env node
/**
 * flint-clean — scripts/flint-clean.ts
 *
 * CLI wrapper for `auditSnippet`. Applies Commandment 3 + the Mithril
 * perceptual colour gate to any raw JSX snippet.
 *
 * Usage:
 *   npm run flint-clean "<jsx snippet>"
 *   cat snippet.tsx | npm run flint-clean
 *   npm run flint-clean --tokens path/to/tokens.json "<jsx snippet>"
 *
 * --tokens <path>
 *   Path to a JSON file containing a DesignToken[] array (same shape as the
 *   Flint tokenStore export). When omitted, the colour gate is skipped —
 *   only Commandment 3 (index + data-flint-id injection) is enforced.
 *
 * Exit codes:
 *   0 — success, cleaned code written to stdout
 *   1 — MithrilViolationError or other failure (details on stderr)
 */

import { readFileSync } from 'node:fs'
import { auditSnippet, MithrilViolationError } from '../src/core/surgery/snippetAuditor.ts'

// ── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let snippetArg: string | undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokens: any[] = []

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tokens' && args[i + 1] !== undefined) {
        const raw = readFileSync(args[++i] as string, 'utf-8')
        tokens = JSON.parse(raw) as unknown[]
    } else {
        snippetArg = args[i]
    }
}

// Fall back to stdin when no inline snippet argument is provided
const snippet: string =
    snippetArg !== undefined
        ? snippetArg
        : readFileSync(0, 'utf-8') // fd 0 = stdin

// ── Run auditor ──────────────────────────────────────────────────────────────

try {
    const cleaned = auditSnippet(snippet, tokens)
    process.stdout.write(cleaned + '\n')
    process.exit(0)
} catch (err) {
    if (err instanceof MithrilViolationError) {
        process.stderr.write(`\nMithrilViolationError: ${err.message}\n\n`)
        for (const v of err.violations) {
            process.stderr.write(`  • ${v}\n`)
        }
        process.stderr.write('\n')
    } else {
        process.stderr.write(`Error: ${String(err)}\n`)
    }
    process.exit(1)
}
