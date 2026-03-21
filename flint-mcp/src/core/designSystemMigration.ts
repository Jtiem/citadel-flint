/**
 * designSystemMigration — flint-mcp/src/core/designSystemMigration.ts
 *
 * EXP.5: Design System Version Migration.
 *
 * Computes diffs between two DTCG token files and surgically migrates
 * consuming source files via Babel AST visitors (Commandment 13: no regex).
 *
 * Exports:
 *   computeTokenDiff(oldTokensPath, newTokensPath)   — token diff plan
 *   migrateFiles(plan, filePaths, options?)           — AST migration
 *   generateMigrationReport(plan, results)            — markdown report
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import fs from 'node:fs'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as { default: typeof _traverse }).default

// @ts-ignore -- CJS/ESM interop for @babel/generator default export
const generate = (_generate as { default: typeof _generate }).default ?? _generate

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenEntry {
    path: string
    type: string
    value: string
}

export interface RenamedToken {
    oldPath: string
    newPath: string
    value: string
}

export interface ChangedToken {
    path: string
    oldValue: string
    newValue: string
    /** CIEDE2000 ΔE for color tokens, null otherwise. */
    deltaE: number | null
}

export interface TokenMigrationPlan {
    renamed: RenamedToken[]
    removed: TokenEntry[]
    changed: ChangedToken[]
    added: TokenEntry[]
}

export interface FileChange {
    tokenOld: string
    tokenNew: string
    line: number
    type: 'renamed' | 'removed' | 'changed'
}

export interface FileMigrationResult {
    filePath: string
    changes: FileChange[]
    warnings: string[]
    migratedSource?: string
}

export interface MigrateFilesOptions {
    dryRun?: boolean
}

// ---------------------------------------------------------------------------
// CIEDE2000 (inlined — MithrilLinter keeps its copy private)
// ---------------------------------------------------------------------------

function hexToLab(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
    if (!m) return null
    let r = parseInt(m[1].slice(0, 2), 16) / 255
    let g = parseInt(m[1].slice(2, 4), 16) / 255
    let b = parseInt(m[1].slice(4, 6), 16) / 255
    r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92
    g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92
    b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883
    x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116
    y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116
    z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

const RAD = Math.PI / 180

function deltaE2000(
    lab1: [number, number, number],
    lab2: [number, number, number],
): number {
    const [L1, a1, b1] = lab1
    const [L2, a2, b2] = lab2
    const avgL = (L1 + L2) / 2
    const C1 = Math.sqrt(a1 * a1 + b1 * b1)
    const C2 = Math.sqrt(a2 * a2 + b2 * b2)
    const avgC = (C1 + C2) / 2
    const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)))
    const a1p = a1 * (1 + G)
    const a2p = a2 * (1 + G)
    const C1p = Math.sqrt(a1p * a1p + b1 * b1)
    const C2p = Math.sqrt(a2p * a2p + b2 * b2)
    const avgCp = (C1p + C2p) / 2
    let h1p = Math.atan2(b1, a1p) * (180 / Math.PI)
    if (h1p < 0) h1p += 360
    let h2p = Math.atan2(b2, a2p) * (180 / Math.PI)
    if (h2p < 0) h2p += 360
    let avgHp: number
    if (Math.abs(h1p - h2p) > 180) avgHp = (h1p + h2p + 360) / 2
    else avgHp = (h1p + h2p) / 2
    const T =
        1 -
        0.17 * Math.cos((avgHp - 30) * RAD) +
        0.24 * Math.cos(2 * avgHp * RAD) +
        0.32 * Math.cos((3 * avgHp + 6) * RAD) -
        0.2 * Math.cos((4 * avgHp - 63) * RAD)
    let dhp = h2p - h1p
    if (Math.abs(dhp) > 180) {
        dhp += h2p <= h1p ? 360 : -360
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD)
    const dLp = L2 - L1
    const dCp = C2p - C1p
    const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2)
    const SC = 1 + 0.045 * avgCp
    const SH = 1 + 0.015 * avgCp * T
    const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2))
    const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7))
    const RT = -Math.sin(2 * dTheta * RAD) * RC
    return Math.sqrt(
        (dLp / SL) ** 2 +
        (dCp / SC) ** 2 +
        (dHp / SH) ** 2 +
        RT * (dCp / SC) * (dHp / SH),
    )
}

// ---------------------------------------------------------------------------
// Token file loading (DTCG format: nested objects with $value / $type)
// ---------------------------------------------------------------------------

interface DTCGNode {
    $value?: string
    $type?: string
    [key: string]: unknown
}

function flattenDTCG(obj: DTCGNode, prefix = ''): TokenEntry[] {
    const entries: TokenEntry[] = []
    for (const [key, val] of Object.entries(obj)) {
        if (key.startsWith('$')) continue
        const child = val as DTCGNode
        const path = prefix ? `${prefix}.${key}` : key
        if (child && typeof child === 'object' && '$value' in child) {
            entries.push({
                path,
                type: (child.$type as string) ?? 'unknown',
                value: String(child.$value),
            })
        } else if (child && typeof child === 'object') {
            entries.push(...flattenDTCG(child, path))
        }
    }
    return entries
}

function loadTokenFile(filePath: string): TokenEntry[] {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return flattenDTCG(parsed)
}

// ---------------------------------------------------------------------------
// computeTokenDiff
// ---------------------------------------------------------------------------

export function computeTokenDiff(oldTokensPath: string, newTokensPath: string): TokenMigrationPlan {
    const oldTokens = loadTokenFile(oldTokensPath)
    const newTokens = loadTokenFile(newTokensPath)

    const oldByPath = new Map(oldTokens.map(t => [t.path, t]))
    const newByPath = new Map(newTokens.map(t => [t.path, t]))

    // Build value -> path maps for rename detection
    const oldByValue = new Map<string, TokenEntry[]>()
    for (const tok of oldTokens) {
        const arr = oldByValue.get(tok.value) ?? []
        arr.push(tok)
        oldByValue.set(tok.value, arr)
    }

    const renamed: RenamedToken[] = []
    const removed: TokenEntry[] = []
    const changed: ChangedToken[] = []
    const added: TokenEntry[] = []
    const matchedOldPaths = new Set<string>()
    const matchedNewPaths = new Set<string>()

    // 1. Same path, same or different value
    for (const [path, oldTok] of oldByPath) {
        const newTok = newByPath.get(path)
        if (newTok) {
            matchedOldPaths.add(path)
            matchedNewPaths.add(path)
            if (oldTok.value !== newTok.value) {
                let de: number | null = null
                if (oldTok.type === 'color' || newTok.type === 'color') {
                    const oldLab = hexToLab(oldTok.value)
                    const newLab = hexToLab(newTok.value)
                    if (oldLab && newLab) {
                        de = Math.round(deltaE2000(oldLab, newLab) * 100) / 100
                    }
                }
                changed.push({ path, oldValue: oldTok.value, newValue: newTok.value, deltaE: de })
            }
        }
    }

    // 2. Tokens in old but not in new — check for renames (matched by value)
    for (const [path, oldTok] of oldByPath) {
        if (matchedOldPaths.has(path)) continue
        // Look for a new token with the same value that isn't already matched
        let foundRename = false
        for (const [newPath, newTok] of newByPath) {
            if (matchedNewPaths.has(newPath)) continue
            if (newTok.value === oldTok.value && newTok.type === oldTok.type) {
                renamed.push({ oldPath: path, newPath, value: oldTok.value })
                matchedOldPaths.add(path)
                matchedNewPaths.add(newPath)
                foundRename = true
                break
            }
        }
        if (!foundRename) {
            removed.push(oldTok)
            matchedOldPaths.add(path)
        }
    }

    // 3. Tokens in new but not matched — added
    for (const [path, newTok] of newByPath) {
        if (!matchedNewPaths.has(path)) {
            added.push(newTok)
        }
    }

    return { renamed, removed, changed, added }
}

// ---------------------------------------------------------------------------
// Token path to class name helpers
// ---------------------------------------------------------------------------

/**
 * Convert a DTCG token path like "colors.primary.500" to potential Tailwind
 * class segments like "primary-500". We strip common group prefixes.
 */
function tokenPathToClassSegment(tokenPath: string): string {
    const parts = tokenPath.split('.')
    // Strip common top-level group names
    const skip = new Set(['colors', 'color', 'spacing', 'typography', 'sizing', 'tokens'])
    const filtered = parts.filter(p => !skip.has(p.toLowerCase()))
    return filtered.join('-')
}

// ---------------------------------------------------------------------------
// migrateFiles — Babel AST visitor
// ---------------------------------------------------------------------------

export function migrateFiles(
    plan: TokenMigrationPlan,
    filePaths: string[],
    options: MigrateFilesOptions = {},
): FileMigrationResult[] {
    const { dryRun = true } = options

    // Build lookup maps: old class segment -> new class segment
    const renameMap = new Map<string, string>()
    for (const r of plan.renamed) {
        renameMap.set(tokenPathToClassSegment(r.oldPath), tokenPathToClassSegment(r.newPath))
    }

    const removedSet = new Set(plan.removed.map(r => tokenPathToClassSegment(r.path)))

    const changedMap = new Map<string, ChangedToken>()
    for (const c of plan.changed) {
        changedMap.set(tokenPathToClassSegment(c.path), c)
    }

    const results: FileMigrationResult[] = []

    for (const filePath of filePaths) {
        let source: string
        try {
            source = fs.readFileSync(filePath, 'utf-8')
        } catch {
            results.push({ filePath, changes: [], warnings: [`Could not read file: ${filePath}`] })
            continue
        }

        const fileChanges: FileChange[] = []
        const fileWarnings: string[] = []

        let ast: t.File
        try {
            ast = parse(source, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                errorRecovery: true,
            })
        } catch {
            results.push({ filePath, changes: [], warnings: [`Parse error: ${filePath}`] })
            continue
        }

        function processClassString(raw: string, line: number): string {
            const tokens = raw.split(/(\s+)/)
            return tokens.map(token => {
                if (/^\s+$/.test(token) || token === '') return token

                // Check renamed
                for (const [oldSeg, newSeg] of renameMap) {
                    if (token === oldSeg || token.includes(oldSeg)) {
                        const replaced = token.replace(oldSeg, newSeg)
                        fileChanges.push({ tokenOld: token, tokenNew: replaced, line, type: 'renamed' })
                        return replaced
                    }
                }

                // Check removed
                for (const seg of removedSet) {
                    if (token === seg || token.includes(seg)) {
                        fileWarnings.push(`Line ${line}: removed token '${seg}' used in class '${token}' — needs manual resolution`)
                        fileChanges.push({ tokenOld: token, tokenNew: token, line, type: 'removed' })
                        return token // don't auto-fix removals
                    }
                }

                // Check changed
                for (const [seg, info] of changedMap) {
                    if (token === seg || token.includes(seg)) {
                        const msg = info.deltaE !== null
                            ? `Line ${line}: token '${seg}' value changed (${info.oldValue} → ${info.newValue}, ΔE=${info.deltaE})`
                            : `Line ${line}: token '${seg}' value changed (${info.oldValue} → ${info.newValue})`
                        fileWarnings.push(msg)
                        fileChanges.push({ tokenOld: token, tokenNew: token, line, type: 'changed' })
                        return token // don't auto-fix value changes, just flag
                    }
                }

                return token
            }).join('')
        }

        traverse(ast, {
            JSXAttribute(path) {
                const { node } = path
                if (!t.isJSXIdentifier(node.name, { name: 'className' })) return

                const value = node.value
                if (!value) return
                const line = node.loc ? node.loc.start.line : 0

                if (t.isStringLiteral(value)) {
                    const migrated = processClassString(value.value, line)
                    if (migrated !== value.value) {
                        value.value = migrated
                    }
                } else if (t.isJSXExpressionContainer(value)) {
                    const expr = value.expression
                    if (t.isStringLiteral(expr)) {
                        const migrated = processClassString(expr.value, line)
                        if (migrated !== expr.value) {
                            expr.value = migrated
                        }
                    } else if (t.isTemplateLiteral(expr)) {
                        for (const quasi of expr.quasis) {
                            const qLine = quasi.loc ? quasi.loc.start.line : 0
                            const migrated = processClassString(quasi.value.raw, qLine)
                            if (migrated !== quasi.value.raw) {
                                quasi.value.raw = migrated
                                quasi.value.cooked = migrated
                            }
                        }
                    }
                }
            },
        })

        let migratedSource = source
        const hasRealChanges = fileChanges.some(c => c.type === 'renamed')
        if (hasRealChanges) {
            try {
                const output = generate(ast, { retainLines: false, concise: false }, source)
                migratedSource = output.code
            } catch {
                results.push({ filePath, changes: fileChanges, warnings: [...fileWarnings, 'Code generation failed'] })
                continue
            }

            if (!dryRun) {
                fs.writeFileSync(filePath, migratedSource, 'utf-8')
            }
        }

        results.push({ filePath, changes: fileChanges, warnings: fileWarnings, migratedSource })
    }

    return results
}

// ---------------------------------------------------------------------------
// generateMigrationReport
// ---------------------------------------------------------------------------

export function generateMigrationReport(plan: TokenMigrationPlan, results: FileMigrationResult[]): string {
    const lines: string[] = []
    lines.push('# Design System Migration Report\n')

    // Summary
    lines.push('## Token Diff Summary\n')
    lines.push(`| Category | Count |`)
    lines.push(`|----------|-------|`)
    lines.push(`| Renamed  | ${plan.renamed.length} |`)
    lines.push(`| Removed  | ${plan.removed.length} |`)
    lines.push(`| Changed  | ${plan.changed.length} |`)
    lines.push(`| Added    | ${plan.added.length} |`)
    lines.push('')

    if (plan.renamed.length > 0) {
        lines.push('### Renamed Tokens\n')
        lines.push('| Old Path | New Path | Value |')
        lines.push('|----------|----------|-------|')
        for (const r of plan.renamed) {
            lines.push(`| ${r.oldPath} | ${r.newPath} | ${r.value} |`)
        }
        lines.push('')
    }

    if (plan.removed.length > 0) {
        lines.push('### Removed Tokens (Manual Resolution Required)\n')
        for (const r of plan.removed) {
            lines.push(`- \`${r.path}\` (was: \`${r.value}\`)`)
        }
        lines.push('')
    }

    if (plan.changed.length > 0) {
        lines.push('### Changed Tokens\n')
        lines.push('| Path | Old Value | New Value | ΔE |')
        lines.push('|------|-----------|-----------|-----|')
        for (const c of plan.changed) {
            lines.push(`| ${c.path} | ${c.oldValue} | ${c.newValue} | ${c.deltaE !== null ? c.deltaE : 'N/A'} |`)
        }
        lines.push('')
    }

    // File results
    lines.push('## File Migration Results\n')
    const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0)
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)
    lines.push(`**Files scanned:** ${results.length}  `)
    lines.push(`**Total changes:** ${totalChanges}  `)
    lines.push(`**Total warnings:** ${totalWarnings}\n`)

    for (const r of results) {
        if (r.changes.length === 0 && r.warnings.length === 0) continue
        lines.push(`### ${r.filePath}\n`)
        if (r.changes.length > 0) {
            lines.push('| Old | New | Line | Type |')
            lines.push('|-----|-----|------|------|')
            for (const c of r.changes) {
                lines.push(`| ${c.tokenOld} | ${c.tokenNew} | ${c.line} | ${c.type} |`)
            }
        }
        if (r.warnings.length > 0) {
            lines.push('\n**Warnings:**')
            for (const w of r.warnings) {
                lines.push(`- ${w}`)
            }
        }
        lines.push('')
    }

    return lines.join('\n')
}
