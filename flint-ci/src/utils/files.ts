/**
 * File collection utilities — shared across audit, fix, and github-action.
 * Includes .flintignore support and content-hash caching.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js'])

export const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'dist-electron',
    '.git',
    '.flint',
    'coverage',
    '__pycache__',
])

export function isSourceFile(filePath: string): boolean {
    for (const ext of SOURCE_EXTENSIONS) {
        if (filePath.endsWith(ext)) return true
    }
    return false
}

// ── .flintignore ────────────────────────────────────────────────────────────

/**
 * Loads .flintignore patterns from the project root.
 * Format: one glob-like pattern per line. Lines starting with # are comments.
 * Supports simple patterns: exact paths, directory prefixes, and * wildcards.
 */
export function loadFlintIgnore(projectRoot: string): string[] {
    const ignorePath = path.join(projectRoot, '.flintignore')
    if (!fs.existsSync(ignorePath)) return []
    try {
        return fs.readFileSync(ignorePath, 'utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))
    } catch {
        return []
    }
}

/**
 * Tests whether a relative file path matches any .flintignore pattern.
 * Supports: exact match, directory prefix (pattern/), and simple * glob.
 */
export function isIgnored(relPath: string, patterns: string[]): boolean {
    const normalized = relPath.replace(/\\/g, '/')
    for (const pattern of patterns) {
        // Exact match
        if (normalized === pattern) return true
        // Directory prefix: "src/legacy/" matches "src/legacy/Foo.tsx"
        if (pattern.endsWith('/') && normalized.startsWith(pattern)) return true
        // Simple glob: "*.test.ts" or "**/*.stories.tsx"
        if (pattern.includes('*')) {
            const regex = new RegExp(
                '^' + pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*\*/g, '@@GLOBSTAR@@')
                    .replace(/\*/g, '[^/]*')
                    .replace(/@@GLOBSTAR@@/g, '.*')
                + '$'
            )
            if (regex.test(normalized)) return true
        }
    }
    return false
}

/**
 * Recursively collects all source files under a directory.
 * Skips node_modules, dist, .git, hidden directories, and .flintignore patterns.
 */
export function collectSourceFiles(dir: string, ignorePatterns?: string[]): string[] {
    const results: string[] = []
    const patterns = ignorePatterns ?? []

    function walk(currentDir: string): void {
        let entries: string[]
        try {
            entries = fs.readdirSync(currentDir)
        } catch {
            return
        }

        for (const entry of entries) {
            if (entry.startsWith('.') && entry !== '.') continue
            if (SKIP_DIRS.has(entry)) continue

            const fullPath = path.join(currentDir, entry)
            let stat: fs.Stats
            try {
                stat = fs.statSync(fullPath)
            } catch {
                continue
            }

            if (stat.isDirectory()) {
                walk(fullPath)
            } else if (stat.isFile() && isSourceFile(entry)) {
                // Check .flintignore patterns
                if (patterns.length > 0) {
                    const relPath = path.relative(dir, fullPath)
                    if (isIgnored(relPath, patterns)) continue
                }
                results.push(fullPath)
            }
        }
    }

    walk(dir)
    return results
}

// ── Audit cache ─────────────────────────────────────────────────────────────

export interface AuditCacheEntry {
    hash: string
    mithrilCount: number
    a11yCount: number
    ruleIds: string[]
}

export type AuditCache = Record<string, AuditCacheEntry>

const CACHE_FILE = '.flint/audit-cache.json'

/** Computes a SHA-256 content hash for a string. */
export function contentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/** Loads the audit cache from .flint/audit-cache.json. */
export function loadAuditCache(projectRoot: string): AuditCache {
    const cachePath = path.join(projectRoot, CACHE_FILE)
    if (!fs.existsSync(cachePath)) return {}
    try {
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    } catch {
        return {}
    }
}

/** Saves the audit cache to .flint/audit-cache.json. */
export function saveAuditCache(projectRoot: string, cache: AuditCache): void {
    const cachePath = path.join(projectRoot, CACHE_FILE)
    const dir = path.dirname(cachePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf-8')
}
