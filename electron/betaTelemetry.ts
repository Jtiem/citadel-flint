/**
 * betaTelemetry.ts — Minimal telemetry pipeline for the closed beta.
 *
 * Design:
 *   - Consent-gated. If the user declined (or never decided), emit() is a no-op.
 *   - Consent state is persisted to <userData>/beta-consent.json.
 *   - Events are buffered in-memory and persisted to <userData>/telemetry-queue.json
 *     at flush time (60-second interval, before-quit, uncaughtException).
 *   - Offline-safe: the queue survives crashes via the uncaughtException handler.
 *   - Event payload is intentionally small. Tool *names* only — never args.
 *
 * Hardening (WARN-1..WARN-4, BETA.TEL):
 *   WARN-1: Queue lives in app.getPath('userData'), not ~/.flint/. Legacy
 *           ~/.flint/telemetry-queue.json is migrated once on first run.
 *   WARN-2: Events are buffered in-memory; disk is only written at flush / quit /
 *           uncaughtException — never on every emit() call.
 *   WARN-3: Stack traces in app.crashed payloads have absolute homedir paths
 *           replaced with <homedir>/ before queuing.
 *   WARN-4: emit() is a discriminated-union generic — callers cannot pass arbitrary
 *           payloads. The privacy guarantee is a TSC error, not a runtime check.
 */

import { app, net } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { BRAND } from '../shared/brand.js'

const TELEMETRY_URL    = process.env.FLINT_TELEMETRY_URL || ''
const TELEMETRY_SECRET = process.env.FLINT_TELEMETRY_SECRET || ''
const FLUSH_INTERVAL_MS = 60_000

// ─── Public Types (from BETA-TELEMETRY-WIRING.contract.ts) ───────────────────

export type ConsentState = 'unset' | 'accepted' | 'declined'

export interface ConsentRecord {
    state: ConsentState
    /** ISO 8601 timestamp; absent until first accept/decline. */
    decidedAt?: string
    /** UUID v4. Stable for the life of the install. */
    sessionId: string
}

export type TelemetryEvent =
    | { name: 'app.launched';    payload: { locale: string } }
    | { name: 'app.crashed';     payload: { message: string; stack: string } }
    | { name: 'mcp.tool_called'; payload: { toolName: string } }
    | { name: 'audit.completed'; payload: { fileCount: number; violationCount: number; durationMs: number } }
    | { name: 'session.ended';   payload: { durationMs: number } }

/**
 * WARN-4: Discriminated-union emit signature.
 * Callers cannot pass arbitrary keys — payload shape is enforced by TSC.
 * `mcp.tool_called` can only carry `{ toolName: string }`, never args.
 */
export interface EmitFunction {
    <E extends TelemetryEvent>(name: E['name'], payload: E['payload']): void
}

// ─── Internal wire format ─────────────────────────────────────────────────────

interface QueuedEvent {
    id: string
    name: string
    ts: string
    sessionId: string
    buildId: string
    appVersion: string
    platform: string
    payload: Record<string, unknown>
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** WARN-1: Queue and consent live in userData/, not ~/.flint/. */
function userDataDir(): string {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
}

function consentPath(): string { return path.join(userDataDir(), 'beta-consent.json') }
function queuePath(): string   { return path.join(userDataDir(), 'telemetry-queue.json') }

/** Legacy queue path (pre-WARN-1). Used only during one-time migration. */
function legacyQueuePath(): string {
    return path.join(os.homedir(), BRAND.configDir, 'telemetry-queue.json')
}

// ─── Consent helpers ──────────────────────────────────────────────────────────

function readConsent(): ConsentRecord {
    try {
        if (existsSync(consentPath())) {
            const raw = JSON.parse(readFileSync(consentPath(), 'utf-8'))
            if (raw && typeof raw.state === 'string' && typeof raw.sessionId === 'string') {
                return raw as ConsentRecord
            }
        }
    } catch { /* fall through */ }
    const fresh: ConsentRecord = { state: 'unset', sessionId: randomUUID() }
    try { writeFileSync(consentPath(), JSON.stringify(fresh, null, 2)) } catch { /* best-effort */ }
    return fresh
}

export function getConsent(): ConsentRecord { return readConsent() }

export function setConsent(state: 'accepted' | 'declined'): ConsentRecord {
    const current = readConsent()
    const next: ConsentRecord = { ...current, state, decidedAt: new Date().toISOString() }
    writeFileSync(consentPath(), JSON.stringify(next, null, 2))
    return next
}

// ─── Queue helpers (in-memory buffer — WARN-2) ────────────────────────────────

/** In-memory event buffer. Disk is only written on flush / quit / crash. */
let memoryBuffer: QueuedEvent[] = []

function loadQueueFromDisk(): QueuedEvent[] {
    try {
        if (!existsSync(queuePath())) return []
        const raw = JSON.parse(readFileSync(queuePath(), 'utf-8'))
        return Array.isArray(raw) ? (raw as QueuedEvent[]) : []
    } catch { return [] }  // WARN-5: malformed queue recovers to []
}

function persistQueue(events: QueuedEvent[]): void {
    try { writeFileSync(queuePath(), JSON.stringify(events, null, 2)) } catch { /* best-effort */ }
}

// ─── Stack-trace redaction (WARN-3) ──────────────────────────────────────────

/**
 * Replace absolute homedir substrings in stack traces with <homedir>/.
 * Covers macOS (/Users/<name>/), Linux (/home/<name>/), Windows (C:\Users\<name>\).
 */
function redactHomedir(text: string): string {
    const home = os.homedir()
    if (!home) return text
    // Escape regex special chars in the homedir path
    const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match trailing separator so <homedir>/ replaces /Users/name/ not just /Users/name
    const re = new RegExp(escaped + '[\\/\\\\]?', 'g')
    return text.replace(re, '<homedir>/')
}

// ─── Build info ───────────────────────────────────────────────────────────────

let buildInfo: { buildId: string; appVersion: string; platform: string } | null = null
let sessionStartMs: number | null = null

function ensureBuildInfo(): { buildId: string; appVersion: string; platform: string } {
    if (!buildInfo) {
        buildInfo = {
            buildId: process.env.FLINT_BETA_BUILD_ID || 'dev-local',
            appVersion: app.getVersion(),
            platform: `${process.platform}-${process.arch}`,
        }
    }
    return buildInfo
}

// ─── emit() — discriminated-union signature (WARN-4) ─────────────────────────

/**
 * Emit a telemetry event. No-op if consent is not 'accepted'.
 *
 * Type parameter E is constrained to TelemetryEvent — TSC enforces that name
 * and payload are paired correctly. Adding a new event requires extending the
 * TelemetryEvent union, which forces explicit review.
 *
 * WARN-2: pushes to in-memory buffer only. Disk write happens in flush().
 */
export const emit: EmitFunction = function emit<E extends TelemetryEvent>(
    name: E['name'],
    payload: E['payload'],
): void {
    const consent = readConsent()
    if (consent.state !== 'accepted') return
    const info = ensureBuildInfo()
    const evt: QueuedEvent = {
        id: randomUUID(),
        name,
        ts: new Date().toISOString(),
        sessionId: consent.sessionId,
        ...info,
        payload: payload as Record<string, unknown>,
    }
    memoryBuffer.push(evt)
}

// ─── flush() ─────────────────────────────────────────────────────────────────

async function flush(): Promise<void> {
    if (!TELEMETRY_URL) return
    // Merge in-memory buffer with any events persisted from a previous run
    const diskEvents = loadQueueFromDisk()
    const combined = [...diskEvents, ...memoryBuffer]
    if (combined.length === 0) return
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (TELEMETRY_SECRET) headers['X-Flint-Secret'] = TELEMETRY_SECRET
        const res = await net.fetch(TELEMETRY_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ events: combined }),
        })
        if (res.ok) {
            // Clear both in-memory buffer and disk queue on success
            memoryBuffer = []
            persistQueue([])
        }
    } catch { /* keep queue for next flush — WARN-5 network failure path */ }
}

/** Persist the in-memory buffer to disk (called before quit and on crash). */
function persistBuffer(): void {
    if (memoryBuffer.length === 0) return
    const existing = loadQueueFromDisk()
    persistQueue([...existing, ...memoryBuffer])
}

// ─── WARN-1: One-time migration of legacy ~/.flint/telemetry-queue.json ───────

async function migrateLegacyQueue(): Promise<void> {
    const legacy = legacyQueuePath()
    const dest = queuePath()
    if (!existsSync(legacy)) return        // no legacy file — nothing to do
    if (existsSync(dest)) return           // userData already populated — skip
    try {
        await copyFile(legacy, dest)
        // Leave the legacy file in place (contract: "leaves the legacy file in place")
    } catch { /* best-effort — non-fatal */ }
}

// ─── startTelemetry() ────────────────────────────────────────────────────────

let flushTimer: NodeJS.Timeout | null = null

export function startTelemetry(): void {
    ensureBuildInfo()
    sessionStartMs = Date.now()

    // WARN-1: migrate legacy queue before loading the in-memory buffer
    void migrateLegacyQueue()

    // Seed in-memory buffer from any disk-persisted events from a prior session
    const seeded = loadQueueFromDisk()
    if (seeded.length > 0) {
        memoryBuffer = [...seeded, ...memoryBuffer]
    }

    // Emit launch event (consent-gated — if unset/declined this is a no-op)
    emit('app.launched', { locale: app.getLocale() })

    if (flushTimer) return  // already started
    flushTimer = setInterval(() => { void flush() }, FLUSH_INTERVAL_MS)

    // WARN-3 + uncaughtException registration
    process.on('uncaughtException', (err) => {
        const rawStack = String(err?.stack ?? '')
        const redactedStack = redactHomedir(rawStack).slice(0, 2000)
        emit('app.crashed', {
            message: String(err?.message ?? err),
            stack: redactedStack,
        })
        // WARN-2: persist buffer synchronously before async flush
        persistBuffer()
        void flush()
    })

    app.on('before-quit', () => {
        const durationMs = sessionStartMs != null ? Date.now() - sessionStartMs : 0
        emit('session.ended', { durationMs })
        persistBuffer()
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
        void flush()
    })
}

export function stopTelemetry(): void {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
}

// ─── Exported for tests ────────────────────────────────────────────────────────

/** Exposed for unit tests — clears the in-memory buffer without touching disk. */
export function _resetBufferForTests(): void { memoryBuffer = [] }

/** Exposed for unit tests — returns current in-memory buffer. */
export function _getBufferForTests(): QueuedEvent[] { return memoryBuffer }

/** Exposed for unit tests — allows injecting events directly into the buffer. */
export function _seedBufferForTests(events: QueuedEvent[]): void { memoryBuffer = [...events] }
