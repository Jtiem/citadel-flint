/**
 * events.ts — Bridge MCP Event Bus (Phase W.1)
 *
 * Two responsibilities:
 *
 * 1. In-process EventEmitter (`bridgeEvents`) used by the MCP server itself to
 *    signal resource-list changes (TOKENS_UPDATED, INTENT_UPDATED).
 *
 * 2. `appendMCPEvent()` — writes structured MCPEvent records to the shared
 *    `.bridge/mcp-events.jsonl` file that the Electron main process tail-follows
 *    via fs.watch so Glass receives proactive push notifications.
 *
 * File rotation: once the JSONL file exceeds MAX_BYTES (256 KiB) the current
 * file is renamed to `mcp-events.jsonl.bak` (overwriting the previous backup)
 * and a fresh file is started. This caps disk usage at ~512 KiB and prevents
 * the tail-follow byte offset in the Electron watcher from drifting indefinitely.
 *
 * Truncated-write safety: each line is written with a single `fs.appendFileSync`
 * call so the kernel guarantees atomicity for writes ≤ PIPE_BUF (typically
 * 64 KiB on Linux/macOS). JSON event objects are well under that limit.
 */

import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

// ── In-process event bus ──────────────────────────────────────────────────────

export const EVENTS = {
    TOKENS_UPDATED: 'tokens:updated',
    INTENT_UPDATED: 'intent:updated',
    /** Phase ACX.2 — fired by ContextPushManager when a delta is emitted. */
    CONTEXT_DELTA: 'context:delta',
} as const

export const bridgeEvents = new EventEmitter()

// ── MCPEvent shape ────────────────────────────────────────────────────────────

export type MCPEventType = 'violation' | 'annotation' | 'mutation' | 'audit' | 'fix' | 'debt' | 'context-delta'
export type MCPEventSeverity = 'critical' | 'warning' | 'info'

export interface MCPEvent {
    /** Unix timestamp in milliseconds. */
    timestamp: number
    type: MCPEventType
    severity: MCPEventSeverity
    /** Human-readable one-line summary for the Glass notification toast. */
    summary: string
    /** Optional `data-bridge-id` of the affected JSX element. */
    nodeId?: string
    /** Absolute path to the affected source file. */
    filePath?: string
}

// ── File rotation constants ───────────────────────────────────────────────────

/** Rotate the JSONL file when it exceeds this size. 256 KiB. */
const MAX_BYTES = 256 * 1024

// ── appendMCPEvent ────────────────────────────────────────────────────────────

/**
 * Appends a single MCPEvent as a JSON line to `.bridge/mcp-events.jsonl`
 * inside `projectRoot`.
 *
 * Creates the `.bridge` directory and/or the file if they do not exist.
 * Rotates the file to `mcp-events.jsonl.bak` once it exceeds MAX_BYTES.
 *
 * Errors are swallowed — event emission must never crash the MCP tool handler.
 */
export function appendMCPEvent(projectRoot: string, event: MCPEvent): void {
    try {
        const bridgeDir = path.join(projectRoot, '.bridge')
        const filePath = path.join(bridgeDir, 'mcp-events.jsonl')
        const backupPath = path.join(bridgeDir, 'mcp-events.jsonl.bak')

        // Ensure the .bridge directory exists
        if (!fs.existsSync(bridgeDir)) {
            fs.mkdirSync(bridgeDir, { recursive: true })
        }

        // Rotate if the existing file is over the size threshold
        if (fs.existsSync(filePath)) {
            const { size } = fs.statSync(filePath)
            if (size > MAX_BYTES) {
                // Overwrite the previous backup (caps total disk usage at ~2×MAX_BYTES)
                fs.renameSync(filePath, backupPath)
            }
        }

        // Append the event as a single newline-terminated JSON line.
        // appendFileSync is atomic for writes ≤ PIPE_BUF, which covers all MCPEvent objects.
        const line = JSON.stringify({ ...event, timestamp: event.timestamp ?? Date.now() }) + '\n'
        fs.appendFileSync(filePath, line, 'utf-8')
    } catch {
        // Never throw — event emission is best-effort
    }
}
