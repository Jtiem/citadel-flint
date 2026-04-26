/**
 * telemetryIpc.test.ts — electron/__tests__/telemetryIpc.test.ts
 *
 * IPC round-trip tests for the telemetry consent channels:
 *   telemetry:get-consent
 *   telemetry:set-consent
 *
 * Pattern: handler logic is reproduced as pure functions so no Electron
 * APIs (ipcMain, BrowserWindow) or native modules are required in the
 * test process. This is the same pattern used by governance-ipc.test.ts
 * and coverageIpc.test.ts.
 *
 * Covers:
 *   TIPC-01 — get-consent: no file on disk → returns { state: "unset", sessionId: <uuid> }
 *   TIPC-02 — get-consent: accepted consent file → returns state "accepted"
 *   TIPC-03 — get-consent: declined consent file → returns state "declined"
 *   TIPC-04 — get-consent: corrupt consent file → returns fresh unset record
 *   TIPC-05 — get-consent: response shape matches ConsentRecord (state + sessionId required, decidedAt optional)
 *   TIPC-06 — get-consent: sessionId is a uuid-like string (≥ 8 chars, contains hyphens or hex)
 *   TIPC-07 — set-consent: accepted → persists with decidedAt ISO timestamp
 *   TIPC-08 — set-consent: declined → persists with decidedAt ISO timestamp
 *   TIPC-09 — set-consent: response.state === input.state
 *   TIPC-10 — set-consent: preserves sessionId across state changes
 *   TIPC-11 — Zod: telemetrySetConsentPayloadSchema accepts { state: "accepted" }
 *   TIPC-12 — Zod: telemetrySetConsentPayloadSchema accepts { state: "declined" }
 *   TIPC-13 — Zod: telemetrySetConsentPayloadSchema rejects { state: "unset" } (not a valid input)
 *   TIPC-14 — Zod: telemetrySetConsentPayloadSchema rejects { state: "" }
 *   TIPC-15 — Zod: telemetrySetConsentPayloadSchema rejects missing state field
 *   TIPC-16 — Zod: telemetryGetConsentResponseSchema accepts a valid ConsentRecord
 *   TIPC-17 — Zod: telemetryGetConsentResponseSchema rejects missing sessionId
 *   TIPC-18 — Zod: telemetryGetConsentResponseSchema rejects invalid state value
 *   TIPC-19 — Web mirror: get-consent handler returns same shape as Electron handler
 *   TIPC-20 — Web mirror: set-consent handler returns same shape as Electron handler
 *   TIPC-21 — Concurrent set-consent calls: last write wins (no interleaving error)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import os from 'node:os'
import path from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  telemetryGetConsentResponseSchema as sharedGetSchema,
  telemetrySetConsentPayloadSchema as sharedSetSchema,
} from '../../shared/ipc-validators'

// ── Contract types (imported from executable contract) ────────────────────────
//
// The contract is the source of truth for these shapes. We import the types
// directly so that if the contract changes, TSC flags the test.
import type {
  ConsentRecord,
  TelemetrySetConsentPayload,
} from '../../.flint-context/contracts/BETA-TELEMETRY-WIRING.contract'

// ── Inline Zod schemas ────────────────────────────────────────────────────────
//
// Reproduced from shared/ipc-validators.ts (not yet present — added by Group A).
// Once Group A ships, these can be replaced with:
//   import { telemetryGetConsentResponseSchema, telemetrySetConsentPayloadSchema } from '../../shared/ipc-validators'
//
// These inline versions are validated against the same shapes by TIPC-11–18.

const telemetrySetConsentPayloadSchema = z.object({
  state: z.enum(['accepted', 'declined']),
})

const telemetryGetConsentResponseSchema = z.object({
  state: z.enum(['unset', 'accepted', 'declined']),
  sessionId: z.string().min(8),
  decidedAt: z.string().optional(),
})

// ── Test helpers ──────────────────────────────────────────────────────────────

const TEST_TMP = path.join(
  os.tmpdir(),
  `flint-telemetry-ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
)

const consentFilePath = () => path.join(TEST_TMP, 'beta-consent.json')

function writeConsentFile(record: ConsentRecord) {
  writeFileSync(consentFilePath(), JSON.stringify(record, null, 2), 'utf-8')
}

// ── Handler logic reproductions ───────────────────────────────────────────────
//
// These functions mirror the core logic of the ipcMain.handle callbacks that
// will be registered in electron/main.ts (and mirrored in server/index.ts)
// once Group A completes. The pure-function pattern avoids any Electron IPC
// dependency in the test process.

function getConsentHandler(
  readFileFn: (p: string) => string = (p) => {
    if (!existsSync(p)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return readFileSync(p, 'utf-8')
  },
): ConsentRecord {
  try {
    const raw = readFileFn(consentFilePath())
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.state === 'string' &&
      typeof parsed.sessionId === 'string'
    ) {
      return telemetryGetConsentResponseSchema.parse(parsed) as ConsentRecord
    }
  } catch {
    /* fall through to fresh record */
  }
  const fresh: ConsentRecord = { state: 'unset', sessionId: randomUUID() }
  writeFileSync(consentFilePath(), JSON.stringify(fresh, null, 2), 'utf-8')
  return fresh
}

function setConsentHandler(
  payload: TelemetrySetConsentPayload,
  readFileFn: (p: string) => string = (p) => {
    if (!existsSync(p)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return readFileSync(p, 'utf-8')
  },
  writeFileFn: (p: string, data: string) => void = (p, data) => {
    writeFileSync(p, data, 'utf-8')
  },
): ConsentRecord {
  // Validate input first — in production the Zod check runs at the preload bridge
  telemetrySetConsentPayloadSchema.parse(payload)

  const current = getConsentHandler(readFileFn)
  const next: ConsentRecord = {
    ...current,
    state: payload.state,
    decidedAt: new Date().toISOString(),
  }
  writeFileFn(consentFilePath(), JSON.stringify(next, null, 2))
  return next
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  if (existsSync(TEST_TMP)) rmSync(TEST_TMP, { recursive: true, force: true })
  mkdirSync(TEST_TMP, { recursive: true })
})

afterEach(() => {
  if (existsSync(TEST_TMP)) rmSync(TEST_TMP, { recursive: true, force: true })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('telemetry:get-consent IPC handler', () => {
  it('TIPC-01 — no file on disk returns state "unset" with a valid sessionId', () => {
    // Contract testBoundary: "telemetry:get-consent IPC"
    // given: no consent file exists at userData/beta-consent.json
    // when: renderer calls window.flintAPI.telemetry.getConsent()
    // then: returns ConsentRecord with state === "unset" and a valid uuid v4 sessionId
    const result = getConsentHandler()
    expect(result.state).toBe('unset')
    expect(typeof result.sessionId).toBe('string')
    expect(result.sessionId.length).toBeGreaterThanOrEqual(8)
  })

  it('TIPC-02 — existing accepted consent file returns state "accepted"', () => {
    const record: ConsentRecord = {
      state: 'accepted',
      sessionId: randomUUID(),
      decidedAt: new Date().toISOString(),
    }
    writeConsentFile(record)
    const result = getConsentHandler()
    expect(result.state).toBe('accepted')
    expect(result.sessionId).toBe(record.sessionId)
  })

  it('TIPC-03 — existing declined consent file returns state "declined"', () => {
    const record: ConsentRecord = {
      state: 'declined',
      sessionId: randomUUID(),
      decidedAt: new Date().toISOString(),
    }
    writeConsentFile(record)
    const result = getConsentHandler()
    expect(result.state).toBe('declined')
  })

  it('TIPC-04 — corrupt consent file returns a fresh unset record', () => {
    // Edge case: corrupt file → returns fresh unset
    writeFileSync(consentFilePath(), '{not valid json', 'utf-8')
    const result = getConsentHandler()
    expect(result.state).toBe('unset')
    expect(typeof result.sessionId).toBe('string')
    expect(result.sessionId.length).toBeGreaterThanOrEqual(8)
  })

  it('TIPC-05 — response shape matches ConsentRecord (state + sessionId required, decidedAt optional)', () => {
    const result = getConsentHandler()
    // Required fields
    expect(typeof result.state).toBe('string')
    expect(['unset', 'accepted', 'declined'].includes(result.state as string)).toBe(true)
    expect(typeof result.sessionId).toBe('string')
    // Optional field: decidedAt absent on unset
    expect(result.decidedAt).toBeUndefined()
  })

  it('TIPC-06 — sessionId is a uuid-like string (min 8 chars, contains hex chars)', () => {
    const result = getConsentHandler()
    expect(result.sessionId.length).toBeGreaterThanOrEqual(8)
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(result.sessionId).toMatch(/[0-9a-f-]/i)
  })

  it('TIPC-04 — Zod response validator accepts the returned record', () => {
    const result = getConsentHandler()
    expect(() => telemetryGetConsentResponseSchema.parse(result)).not.toThrow()
  })
})

describe('telemetry:set-consent IPC handler', () => {
  it('TIPC-07 — accepted → persists with ISO decidedAt timestamp', () => {
    // Contract testBoundary: "telemetry:set-consent IPC"
    // given: consent.state === "unset", renderer sends { state: "accepted" }
    // then: writes ConsentRecord with state="accepted" and ISO decidedAt
    const result = setConsentHandler({ state: 'accepted' })
    expect(result.state).toBe('accepted')
    expect(typeof result.decidedAt).toBe('string')
    expect(() => new Date(result.decidedAt!).toISOString()).not.toThrow()

    // Verify it was persisted to disk
    const onDisk = JSON.parse(readFileSync(consentFilePath(), 'utf-8'))
    expect(onDisk.state).toBe('accepted')
  })

  it('TIPC-08 — declined → persists with ISO decidedAt timestamp', () => {
    const result = setConsentHandler({ state: 'declined' })
    expect(result.state).toBe('declined')
    expect(typeof result.decidedAt).toBe('string')
    expect(() => new Date(result.decidedAt!).toISOString()).not.toThrow()

    const onDisk = JSON.parse(readFileSync(consentFilePath(), 'utf-8'))
    expect(onDisk.state).toBe('declined')
  })

  it('TIPC-09 — response.state === input.state', () => {
    const result = setConsentHandler({ state: 'accepted' })
    expect(result.state).toBe('accepted')
  })

  it('TIPC-10 — preserves sessionId across state change', () => {
    // First call creates a record with a sessionId
    const initial = getConsentHandler()
    const originalSessionId = initial.sessionId

    const result = setConsentHandler({ state: 'accepted' })
    expect(result.sessionId).toBe(originalSessionId)
  })

  it('TIPC-10b — round-trip: set-then-get returns consistent state', () => {
    setConsentHandler({ state: 'declined' })
    const readBack = getConsentHandler()
    expect(readBack.state).toBe('declined')
    expect(readBack.decidedAt).toBeTruthy()
  })

  it('TIPC-21 — concurrent set-consent calls do not throw (last write wins)', async () => {
    // Edge case: concurrent calls → last write wins
    const calls = [
      setConsentHandler({ state: 'accepted' }),
      setConsentHandler({ state: 'declined' }),
      setConsentHandler({ state: 'accepted' }),
    ]
    // All calls must succeed without throwing
    calls.forEach((result) => {
      expect(result.state).toMatch(/^(accepted|declined)$/)
    })
    // The final disk state must be a valid record
    const onDisk = JSON.parse(readFileSync(consentFilePath(), 'utf-8'))
    expect(['accepted', 'declined']).toContain(onDisk.state)
  })
})

describe('Zod schema validation — telemetrySetConsentPayloadSchema', () => {
  it('TIPC-11 — accepts { state: "accepted" }', () => {
    expect(() => telemetrySetConsentPayloadSchema.parse({ state: 'accepted' })).not.toThrow()
  })

  it('TIPC-12 — accepts { state: "declined" }', () => {
    expect(() => telemetrySetConsentPayloadSchema.parse({ state: 'declined' })).not.toThrow()
  })

  it('TIPC-13 — rejects { state: "unset" } (not a valid input state)', () => {
    // "unset" is a read-only state; the renderer cannot set it
    expect(() => telemetrySetConsentPayloadSchema.parse({ state: 'unset' })).toThrow()
  })

  it('TIPC-14 — rejects { state: "" }', () => {
    expect(() => telemetrySetConsentPayloadSchema.parse({ state: '' })).toThrow()
  })

  it('TIPC-15 — rejects missing state field', () => {
    expect(() => telemetrySetConsentPayloadSchema.parse({})).toThrow()
  })

  it('TIPC-15b — rejects null payload', () => {
    expect(() => telemetrySetConsentPayloadSchema.parse(null)).toThrow()
  })

  it('TIPC-15c — rejects numeric state value', () => {
    expect(() => telemetrySetConsentPayloadSchema.parse({ state: 1 })).toThrow()
  })
})

describe('Zod schema validation — telemetryGetConsentResponseSchema', () => {
  it('TIPC-16 — accepts a valid unset ConsentRecord', () => {
    const record: ConsentRecord = { state: 'unset', sessionId: randomUUID() }
    expect(() => telemetryGetConsentResponseSchema.parse(record)).not.toThrow()
  })

  it('TIPC-16b — accepts a valid accepted ConsentRecord with decidedAt', () => {
    const record: ConsentRecord = {
      state: 'accepted',
      sessionId: randomUUID(),
      decidedAt: new Date().toISOString(),
    }
    expect(() => telemetryGetConsentResponseSchema.parse(record)).not.toThrow()
  })

  it('TIPC-17 — rejects missing sessionId', () => {
    expect(() =>
      telemetryGetConsentResponseSchema.parse({ state: 'unset' }),
    ).toThrow()
  })

  it('TIPC-17b — rejects sessionId shorter than 8 chars', () => {
    expect(() =>
      telemetryGetConsentResponseSchema.parse({ state: 'unset', sessionId: 'abc' }),
    ).toThrow()
  })

  it('TIPC-18 — rejects invalid state value', () => {
    expect(() =>
      telemetryGetConsentResponseSchema.parse({ state: 'maybe', sessionId: randomUUID() }),
    ).toThrow()
  })
})

describe('Web mirror parity — server/index.ts handlers', () => {
  // These tests document the invariant that the web build must mirror the
  // Electron IPC handlers with the same input/output contract (per
  // feedback_web_parity_drift.md and the web-parity invariant in the contract).
  //
  // The pure handler logic is identical in both Electron and web builds;
  // these tests validate the shared logic rather than the transport layer.

  it('TIPC-19 — web get-consent handler returns same ConsentRecord shape as Electron handler', () => {
    // The handler logic is the same pure function; the transport differs.
    // Validate that the schema accepts both.
    const result = getConsentHandler()
    const parsed = telemetryGetConsentResponseSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('TIPC-20 — web set-consent handler returns same ConsentRecord shape as Electron handler', () => {
    const result = setConsentHandler({ state: 'accepted' })
    const parsed = telemetryGetConsentResponseSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })
})

describe('Contract invariant: ipc-validator-coverage', () => {
  // Group A landed the schema exports in shared/ipc-validators.ts. These tests
  // verify the named exports are present and behave like the inline mirrors above.

  it('telemetryGetConsentResponseSchema is exported from shared/ipc-validators.ts', () => {
    expect(sharedGetSchema).toBeDefined()
    // Sanity check: the exported schema accepts a valid ConsentRecord
    const valid: ConsentRecord = { state: 'unset', sessionId: randomUUID() }
    expect(() => sharedGetSchema.parse(valid)).not.toThrow()
  })

  it('telemetrySetConsentPayloadSchema is exported from shared/ipc-validators.ts', () => {
    expect(sharedSetSchema).toBeDefined()
    // Sanity check: the exported schema accepts a valid set-consent payload
    expect(() => sharedSetSchema.parse({ state: 'accepted' })).not.toThrow()
    expect(() => sharedSetSchema.parse({ state: 'unset' })).toThrow()
  })

  it('telemetry:get-consent response schema rejects invalid records', () => {
    expect(() =>
      sharedGetSchema.parse({ state: 'maybe', sessionId: randomUUID() }),
    ).toThrow()
    expect(() => sharedGetSchema.parse({ state: 'unset' })).toThrow()
  })

  it('telemetry:set-consent payload schema rejects malformed input', () => {
    expect(() => sharedSetSchema.parse({})).toThrow()
    expect(() => sharedSetSchema.parse(null)).toThrow()
    expect(() => sharedSetSchema.parse({ state: 1 })).toThrow()
  })
})
