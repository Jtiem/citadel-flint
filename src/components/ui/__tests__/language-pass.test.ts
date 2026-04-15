/**
 * language-pass.test.ts — Sprint CLARITY Item 1
 *
 * Guard test: ensures no user-rendered "violation" strings exist in Glass
 * component files. Code identifiers, comments, and MCP/CLI output are exempt.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/** Recursively collect .tsx files under a directory */
function collectTsx(dir: string): string[] {
    const results: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
            results.push(...collectTsx(full))
        } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
            results.push(full)
        }
    }
    return results
}

/**
 * Checks if a line contains a user-visible "violation" string (rendered to DOM).
 * Skips: comments, code identifiers (camelCase/snake_case), type literals,
 * store keys, IPC channels, variable declarations, and function calls.
 */
function isUserVisibleViolation(line: string): boolean {
    const trimmed = line.trim()

    // Skip comments (including JSX comments like {/* ... */} and multi-line continuations)
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*')) return false
    // Skip lines ending with */} (multi-line JSX comment continuation)
    if (/\*\/\}?\s*$/.test(trimmed) && !/</.test(trimmed)) return false
    // Skip lines that are clearly inside a multi-line JSX comment (no JSX tags, ends with period or text)
    if (/^\s*[A-Z].*violation/i.test(line) && !/[<>'"`:{}]/.test(trimmed.replace(/violation/gi, ''))) return false

    // Skip error throws (developer-facing, not rendered)
    if (/throw\s+new\s+Error/.test(trimmed)) return false

    // Must contain "violation" (case-insensitive)
    if (!/violation/i.test(trimmed)) return false

    // Skip code identifiers: camelCase (xViolation), snake_case (x_violation), or PascalCase
    // These are variable names, store keys, function names, type names
    if (/[a-z]Violation|Violation[A-Z]|_violation|violation_|mithrilViolation|hasA11yViolation|hasSeenViolation|expandedViolation|pinnedViolation|toggleViolation|setExpandedViolation|violationsSectionRef|deferViolation/i.test(trimmed)) return false

    // Skip type literals like type: 'violation'
    if (/type:\s*['"]violation['"]/.test(trimmed)) return false
    // Skip TypeScript union type members like `type?: 'x' | 'violation' | 'y'`
    if (/\|\s*['"]violation['"]/.test(trimmed)) return false
    // Skip filter expressions like n.type === 'violation'
    if (/\.type\s*===?\s*['"]violation['"]/.test(trimmed)) return false
    // Skip data-testid attributes containing "violation"
    if (/data-testid.*violation/.test(trimmed)) return false
    // Skip targetTestId
    if (/targetTestId.*violation/.test(trimmed)) return false

    // What remains should be user-visible strings — JSX text, title=, aria-label=, template literals
    return true
}

describe('Sprint CLARITY — Language Pass guard', () => {
    it('no Glass component renders the word "violation" to users', () => {
        const componentsDir = path.resolve(__dirname, '../../..')
        const srcComponents = path.join(componentsDir, 'components')
        const files = collectTsx(srcComponents)

        const hits: { file: string; line: number; text: string }[] = []
        for (const file of files) {
            const lines = fs.readFileSync(file, 'utf-8').split('\n')
            let inBlockComment = false
            lines.forEach((line, i) => {
                // Track multi-line comment state ({/* ... */} or /* ... */)
                if (/\{?\/\*/.test(line) && !/\*\/\}?/.test(line)) {
                    inBlockComment = true
                }
                if (inBlockComment) {
                    if (/\*\/\}?/.test(line)) inBlockComment = false
                    return // skip lines inside block comments
                }
                if (isUserVisibleViolation(line)) {
                    hits.push({ file: path.relative(componentsDir, file), line: i + 1, text: line.trim() })
                }
            })
        }

        if (hits.length > 0) {
            const report = hits.map((h) => `  ${h.file}:${h.line} → ${h.text}`).join('\n')
            expect.fail(`Found ${hits.length} user-visible "violation" string(s):\n${report}`)
        }
    })
})
