/**
 * Shared token file I/O and helpers for the sync module.
 *
 * File reads and writes are injectable so callers can route through
 * FileTransactionManager when running inside Electron (Commandment 12).
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Injectable file I/O interface for Commandment 12 compliance. */
export interface TokenFileIO {
    readFile(filePath: string): string | null
    writeFile(filePath: string, content: string): void
}

/** Default implementation using raw fs (for headless MCP / tests). */
export const defaultFileIO: TokenFileIO = {
    readFile(filePath: string): string | null {
        if (!fs.existsSync(filePath)) return null
        return fs.readFileSync(filePath, 'utf-8')
    },
    writeFile(filePath: string, content: string): void {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(filePath, content)
    },
}

// ---------------------------------------------------------------------------
// Flatten tokens
// ---------------------------------------------------------------------------

/**
 * Flatten a DTCG token object into name/value pairs.
 * Nodes with `$value` are treated as leaf tokens.
 */
export function flattenTokens(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
    const result = new Map<string, string>()
    for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            if ('$value' in (val as Record<string, unknown>)) {
                result.set(fullKey, JSON.stringify((val as Record<string, unknown>).$value))
            } else {
                for (const [k, v] of flattenTokens(val as Record<string, unknown>, fullKey)) {
                    result.set(k, v)
                }
            }
        } else {
            result.set(fullKey, JSON.stringify(val))
        }
    }
    return result
}

// ---------------------------------------------------------------------------
// Read / write local tokens
// ---------------------------------------------------------------------------

export function readLocalTokens(projectRoot: string, io: TokenFileIO = defaultFileIO): Map<string, string> {
    const tokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')
    try {
        const raw = io.readFile(tokensPath)
        if (raw === null) return new Map()
        return flattenTokens(JSON.parse(raw))
    } catch {
        return new Map()
    }
}

export function writeLocalTokens(
    projectRoot: string,
    tokens: Map<string, string>,
    io: TokenFileIO = defaultFileIO,
): void {
    const tokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')
    const obj: Record<string, unknown> = {}

    for (const [name, value] of tokens) {
        const parts = name.split('.')
        let current: Record<string, unknown> = obj
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current)) current[parts[i]] = {}
            current = current[parts[i]] as Record<string, unknown>
        }
        try {
            current[parts[parts.length - 1]] = { $value: JSON.parse(value) }
        } catch {
            current[parts[parts.length - 1]] = { $value: value }
        }
    }

    io.writeFile(tokensPath, JSON.stringify(obj, null, 2))
}
