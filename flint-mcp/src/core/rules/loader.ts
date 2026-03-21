/**
 * Rules Loader — flint-mcp/src/core/rules/loader.ts
 *
 * Loads governance rules from a directory of JSON files.
 * Each JSON file defines one or more rules.
 *
 * This file satisfies the import in server.ts:
 *   import { loadRulesFromDirectory } from "./core/rules/loader.js"
 */

import fs from 'node:fs'
import path from 'node:path'

export interface GovernanceRule {
    id: string
    name: string
    severity: 'critical' | 'warning' | 'info'
    category: string
    description: string
    enabled: boolean
}

/**
 * Loads all JSON rule files from a directory.
 * Each file may contain a single rule object or an array of rules.
 * Returns an empty array if the directory does not exist.
 */
export async function loadRulesFromDirectory(dirPath: string): Promise<GovernanceRule[]> {
    if (!fs.existsSync(dirPath)) {
        return []
    }

    const rules: GovernanceRule[] = []
    const entries = fs.readdirSync(dirPath)

    for (const entry of entries) {
        if (!entry.endsWith('.json')) continue
        const filePath = path.join(dirPath, entry)
        try {
            const raw = fs.readFileSync(filePath, 'utf-8')
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                rules.push(...parsed)
            } else {
                rules.push(parsed)
            }
        } catch {
            // Skip malformed files
        }
    }

    return rules
}
