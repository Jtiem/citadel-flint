/**
 * defer-ipc.test.ts — electron/__tests__/defer-ipc.test.ts
 *
 * COUNSEL.2.1 — governance:defer-violation IPC handler round-trip tests.
 *
 * Scope (Group B scaffolds — it.todo only):
 *   Tests the updated governance:defer-violation handler that accepts a 5th
 *   `duration` param, computes `expires_at` via computeExpiresAt, and persists
 *   both columns to the deferred_violations SQLite table.
 *
 * Full assertions are added in Group D after flint-electron-ipc completes:
 *   - shared/deferralUtils.ts (DeferDuration, durationToMs, computeExpiresAt)
 *   - electron/main.ts schema migration (duration + expires_at columns)
 *   - electron/main.ts updated upsert prepared statement
 *   - governance.deferViolation wired in electron/preload.ts
 *
 * Contract source: docs/contracts/counsel-2-1.contract.ts
 * testBoundaries target: 'governance:defer-violation IPC handler'
 */

import { describe, it } from 'vitest'

// ---------------------------------------------------------------------------
// governance:defer-violation IPC handler
// ---------------------------------------------------------------------------

describe('governance:defer-violation IPC handler — COUNSEL.2.1', () => {
    // testBoundary behavior: Accepts duration param, computes expires_at, stores both in SQLite
    // assertion: Row returned by get-deferred-violations includes duration and expires_at columns
    it.todo('invokes with duration and persists expires_at in SQLite row')

    // edgeCase: duration is "Manually" -- expires_at must be NULL
    it.todo('duration "Manually" results in expires_at NULL in persisted row')

    // edgeCase: duration is omitted (backward compat) -- expires_at must be NULL, duration must be NULL
    it.todo('omitting duration is backward compatible: duration and expires_at both NULL in persisted row')

    // edgeCase: Upsert same (file, ruleId, nodeId) with new duration updates expires_at
    it.todo('upserting same (filePath, ruleId, nodeId) with a new duration updates expires_at in place')

    // Extra boundary: invalid violationId / missing required fields returns error shape
    it.todo('returns error shape when filePath is missing or not a string')
})

// ---------------------------------------------------------------------------
// governance:get-deferred-violations — DeferredViolationRow shape
// ---------------------------------------------------------------------------

describe('governance:get-deferred-violations IPC handler — COUNSEL.2.1', () => {
    // Ensures returned rows carry the new duration and expires_at columns
    it.todo('returned rows include duration column matching what was submitted')
    it.todo('returned rows include expires_at column in ISO 8601 format')
    it.todo('returns empty array when no deferrals have been recorded')
})
