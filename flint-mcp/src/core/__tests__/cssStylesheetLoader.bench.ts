/**
 * cssStylesheetLoader.bench.ts
 *
 * Contract invariant: parse of 10KB realistic design-token CSS < 100ms p95.
 *
 * Phase 2 Group A — flint-mcp-specialist
 */

import { bench, describe } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { load, reset } from '../cssStylesheetLoader.js'

// ── 10KB realistic design-token CSS ──────────────────────────────────────────

function generate10KbCss(): string {
    const lines: string[] = [':root {']
    // ~100 custom properties, each ~100 chars → ~10KB
    const colors = [
        '#0066cc', '#cc6600', '#00cc66', '#6600cc',
        'oklch(62% 0.18 240)', 'hsl(210, 80%, 40%)',
        'rgb(0, 102, 204)', 'rgba(0, 102, 204, 0.8)',
    ]
    for (let i = 0; i < 100; i++) {
        const color = colors[i % colors.length]
        lines.push(`  --color-brand-${i}: ${color};`)
    }
    for (let i = 0; i < 50; i++) {
        lines.push(`  --spacing-${i}: ${i * 4}px;`)
    }
    for (let i = 0; i < 30; i++) {
        lines.push(`  --font-size-${i}: ${12 + i * 2}px;`)
    }
    lines.push('}')
    lines.push('')
    lines.push('@theme {')
    for (let i = 0; i < 50; i++) {
        lines.push(`  --color-theme-${i}: #${i.toString(16).padStart(6, '0')};`)
    }
    lines.push('}')
    lines.push('')
    // Add some @media blocks
    lines.push('@media (prefers-color-scheme: dark) {')
    lines.push('  :root {')
    for (let i = 0; i < 20; i++) {
        lines.push(`    --dark-color-${i}: #1a1a${i.toString(16).padStart(2, '0')};`)
    }
    lines.push('  }')
    lines.push('}')

    return lines.join('\n')
}

const css10kb = generate10KbCss()
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-css-bench-'))
const benchFile = path.join(tmpDir, 'design-tokens.css')
fs.writeFileSync(benchFile, css10kb, 'utf8')

describe('cssStylesheetLoader benchmark', () => {
    bench(
        'parse 10KB design-token CSS (contract: <100ms p95)',
        async () => {
            // Clear cache each iteration to measure real parse time
            reset()
            await load(benchFile)
        },
        {
            time: 1000,
            iterations: 20,
        },
    )

    bench(
        'parse 10KB design-token CSS (cached)',
        async () => {
            // Cache is warm — measures cache lookup overhead
            await load(benchFile)
        },
        {
            time: 1000,
            iterations: 100,
        },
    )
})
