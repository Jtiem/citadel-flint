/**
 * flint_defer_violation tool handler — flint-mcp/src/tools/deferViolation.ts
 *
 * Strategy 7: Breadcrumb Trail — allows users to explicitly defer a
 * governance violation to a later session. The violation is recorded in
 * `.flint/deferred-violations.json` so the Context-First Briefing
 * (Strategy 4) can re-surface it at the start of the next session.
 *
 * The Electron side also stores deferrals in the `deferred_violations`
 * SQLite table via IPC. This file-based approach ensures the headless
 * MCP server (which has no access to Electron's SQLite) can both write
 * and read deferrals independently.
 */

import fs from 'node:fs'
import path from 'node:path'
import { toolName, configPath, logTag } from '../brand.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface DeferViolationParams {
    file: string
    ruleId: string
    nodeId?: string
    reason?: string
    projectRoot: string
}

export interface DeferredViolationEntry {
    file: string
    ruleId: string
    nodeId: string | null
    reason: string | null
    deferredAt: string
}

// ── Tool definition ──────────────────────────────────────────────────────

export const FLINT_DEFER_VIOLATION_TOOL = {
    name: toolName('defer_violation'),
    description:
        'Defer a governance violation to a later session. ' +
        'The violation will be re-surfaced at the start of the next session ' +
        'so nothing falls through the cracks. Use this when you want to ' +
        'acknowledge a violation but fix it later.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            file: {
                type: 'string',
                description: 'Absolute path to the file containing the violation.',
            },
            ruleId: {
                type: 'string',
                description: 'Rule ID of the violation to defer (e.g. "MITH-COL-001", "A11Y-001").',
            },
            nodeId: {
                type: 'string',
                description: 'Optional: data-flint-id of the specific element with the violation.',
            },
            reason: {
                type: 'string',
                description: 'Optional: why the violation is being deferred.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root (must contain a .flint directory).',
            },
        },
        required: ['file', 'ruleId', 'projectRoot'],
    },
} as const

// ── File I/O helpers ─────────────────────────────────────────────────────

function getDeferredViolationsPath(projectRoot: string): string {
    return path.join(projectRoot, configPath('deferred-violations.json'))
}

function readDeferredViolations(projectRoot: string): DeferredViolationEntry[] {
    const filePath = getDeferredViolationsPath(projectRoot)
    try {
        if (!fs.existsSync(filePath)) return []
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
    } catch {
        return []
    }
}

function writeDeferredViolations(projectRoot: string, entries: DeferredViolationEntry[]): void {
    const filePath = getDeferredViolationsPath(projectRoot)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8')
}

// ── Handler ──────────────────────────────────────────────────────────────

export function handleDeferViolation(
    params: DeferViolationParams,
): { content: Array<{ type: string; text: string }> } {
    const { file, ruleId, projectRoot, nodeId, reason } = params

    // Validate required params
    if (!file || typeof file !== 'string') {
        return {
            content: [{
                type: 'text',
                text: `${toolName('defer_violation')}: 'file' parameter is required and must be a string.`,
            }],
        }
    }
    if (!ruleId || typeof ruleId !== 'string') {
        return {
            content: [{
                type: 'text',
                text: `${toolName('defer_violation')}: 'ruleId' parameter is required and must be a string.`,
            }],
        }
    }
    if (!projectRoot || typeof projectRoot !== 'string') {
        return {
            content: [{
                type: 'text',
                text: `${toolName('defer_violation')}: 'projectRoot' parameter is required and must be a string.`,
            }],
        }
    }

    const nId = typeof nodeId === 'string' ? nodeId : null
    const r = typeof reason === 'string' ? reason : null
    const now = new Date().toISOString()

    // Read existing deferrals
    const existing = readDeferredViolations(projectRoot)

    // Upsert: find by (file, ruleId, nodeId) composite key
    const existingIndex = existing.findIndex(
        (e) => e.file === file && e.ruleId === ruleId && e.nodeId === nId
    )

    const entry: DeferredViolationEntry = {
        file,
        ruleId,
        nodeId: nId,
        reason: r,
        deferredAt: now,
    }

    if (existingIndex >= 0) {
        existing[existingIndex] = entry
    } else {
        existing.push(entry)
    }

    // Write back
    writeDeferredViolations(projectRoot, existing)

    console.log(`${logTag('S7')} Deferred violation: ${ruleId} in ${file}`)

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                deferred: true,
                file,
                ruleId,
                nodeId: nId,
                reason: r,
                message: "Violation deferred. I'll remind you next session.",
            }, null, 2),
        }],
    }
}
