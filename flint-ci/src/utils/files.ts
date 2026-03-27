/**
 * File collection utilities — shared across audit, fix, and github-action.
 */

import fs from 'node:fs'
import path from 'node:path'

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

/**
 * Recursively collects all source files under a directory.
 * Skips node_modules, dist, .git, and hidden directories.
 */
export function collectSourceFiles(dir: string): string[] {
    const results: string[] = []

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
                results.push(fullPath)
            }
        }
    }

    walk(dir)
    return results
}
