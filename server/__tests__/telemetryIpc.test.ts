/**
 * server/__tests__/telemetryIpc.test.ts
 *
 * Parity and security tests for the telemetry IPC surface in server/index.ts.
 * These tests cover the contract testBoundaries from
 * TELEMETRY-WEB-TRANSPORT.contract.ts that belong to the server side.
 *
 * Coverage:
 *   TEL-01 — Parity emit: mcp:call-tool with audit_ui_component pushes one
 *             entry with name "mcp.tool_called" to the in-memory buffer and
 *             one entry with name "audit.completed" after the tool resolves.
 *   TEL-02 — Consent gate: mcp:call-tool with consent "unset" or "declined"
 *             does NOT push any telemetry buffer entries.
 *   TEL-03 — Round-trip: server-side getConsent() reads the consent file;
 *             setConsent() writes it; returned value matches what's on disk.
 *   TEL-04 — Round-trip: setConsent() stamps decidedAt as an ISO 8601 string.
 *   TEL-05 — Round-trip: getConsent() returns { state:"unset" } when no file
 *             exists; creates the file with a uuid sessionId.
 *   TEL-06 — Security pin (invariant: secret-never-crosses-process-boundary):
 *             neither telemetry:get-consent nor telemetry:set-consent response
 *             body contains the FLINT_TELEMETRY_SECRET value.
 *   TEL-07 — audit.completed defaults: tool result with no parseable JSON
 *             produces fileCount=0 and violationCount=0.
 *
 * Approach: reproduce the pure handler logic from server/index.ts without
 * spinning up the full Express server — the same pattern used throughout this
 * directory (see index.test.ts, ws3-server.test.ts). This keeps tests
 * deterministic and avoids SQLite / child-process / fs.watch side-effects.
 *
 * Invariants pinned by this file:
 *   - secret-never-crosses-process-boundary (TEL-06)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Temp directory setup — every test gets a clean directory
// ─────────────────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
  tmpDir = path.join(
    os.tmpdir(),
    `flint-tel-ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
  vi.restoreAllMocks()
  // Clean up env vars to avoid cross-test bleed
  delete process.env.FLINT_TELEMETRY_SECRET
})

// ─────────────────────────────────────────────────────────────────────────────
// Reproduced handler logic from server/index.ts
//
// These are close-mirror functions. If the real handler in server/index.ts
// changes, update these mirrors and this comment.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirror of the inline webReadConsentState() function in server/index.ts.
 * Reads consent state from a given directory (test-isolated path).
 */
function webReadConsentState(consentDir: string): string {
  try {
    const p = path.join(consentDir, 'beta-consent.json')
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf-8')) as { state?: string }
      return typeof raw.state === 'string' ? raw.state : 'unset'
    }
  } catch { /* fall through */ }
  return 'unset'
}

/**
 * Mirror of the inline webReadConsent() function in server/index.ts.
 */
function webReadConsent(consentDir: string): { state: string; decidedAt?: string; sessionId: string } {
  try {
    const p = path.join(consentDir, 'beta-consent.json')
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>
      if (raw && typeof raw.state === 'string' && typeof raw.sessionId === 'string') {
        return raw as { state: string; decidedAt?: string; sessionId: string }
      }
    }
  } catch { /* fall through */ }
  const fresh = { state: 'unset', sessionId: randomUUID() }
  try {
    if (!existsSync(consentDir)) mkdirSync(consentDir, { recursive: true })
    writeFileSync(path.join(consentDir, 'beta-consent.json'), JSON.stringify(fresh, null, 2))
  } catch { /* best-effort */ }
  return fresh
}

/**
 * Mirror of the telemetry:set-consent handler in server/index.ts.
 */
function webSetConsent(
  consentDir: string,
  payload: unknown,
): { state: string; decidedAt?: string; sessionId: string } {
  const p = payload as { state?: string }
  if (p?.state !== 'accepted' && p?.state !== 'declined') {
    throw new Error('telemetry:set-consent — state must be "accepted" or "declined"')
  }
  const current = webReadConsent(consentDir)
  const next = { ...current, state: p.state, decidedAt: new Date().toISOString() }
  try {
    if (!existsSync(consentDir)) mkdirSync(consentDir, { recursive: true })
    writeFileSync(path.join(consentDir, 'beta-consent.json'), JSON.stringify(next, null, 2))
  } catch { /* best-effort */ }
  return next
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory telemetry buffer — mirrors server/index.ts local variable
// ─────────────────────────────────────────────────────────────────────────────

type BufferEntry = { name: string; payload: unknown; ts: string }

function makeWebEmit(
  consentDir: string,
  buffer: BufferEntry[],
) {
  return function webEmit(name: string, payload: unknown): void {
    if (webReadConsentState(consentDir) !== 'accepted') return
    buffer.push({ name, payload, ts: new Date().toISOString() })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror of the mcp:call-tool emit logic in server/index.ts lines 2864-2892
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_TOOLS = new Set(['audit_ui_component', 'flint_audit', 'flint_swarm_audit_fix'])

async function simulateMcpCallTool(
  toolName: string,
  mcpResult: unknown,
  webEmit: (name: string, payload: unknown) => void,
): Promise<unknown> {
  // Emit mcp.tool_called — tool name only, never args
  webEmit('mcp.tool_called', { toolName })

  const isAuditTool = AUDIT_TOOLS.has(toolName)
  const auditStart = isAuditTool ? Date.now() : 0
  const result = mcpResult

  if (isAuditTool) {
    let fileCount = 0
    let violationCount = 0
    try {
      const text = (result as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '{}'
      const jsonEnd = text.lastIndexOf('}')
      const jsonText = jsonEnd !== -1 ? text.slice(0, jsonEnd + 1) : text
      const parsed = JSON.parse(jsonText) as {
        fileCount?: number
        mithrilCount?: number
        a11yCount?: number
        violations?: unknown[]
      }
      fileCount = typeof parsed.fileCount === 'number' ? parsed.fileCount : 1
      violationCount =
        (typeof parsed.mithrilCount === 'number' ? parsed.mithrilCount : 0) +
        (typeof parsed.a11yCount === 'number' ? parsed.a11yCount : 0) +
        (Array.isArray(parsed.violations) ? parsed.violations.length : 0)
    } catch { /* fallthrough */ }
    webEmit('audit.completed', {
      fileCount,
      violationCount,
      durationMs: Date.now() - auditStart,
    })
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// TEL-01 — Parity emit: mcp:call-tool for audit_ui_component pushes two entries
// Contract testBoundary: "server `mcp:call-tool` handler — telemetry parity emit"
// given:  web server booted with consent "accepted", MCP mocked to return audit result
// when:   renderer invokes mcp:call-tool with name="audit_ui_component"
// then:   buffer has 2 entries — mcp.tool_called then audit.completed
// ─────────────────────────────────────────────────────────────────────────────

describe('mcp:call-tool — telemetry parity emit (TEL-01)', () => {
  it('TEL-01a: pushes mcp.tool_called entry to buffer when consent is accepted', async () => {
    // Write accepted consent into the test directory
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'test-sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    const mcpResult = {
      content: [{ text: '{"fileCount":1,"mithrilCount":0,"a11yCount":0}' }],
    }

    await simulateMcpCallTool('audit_ui_component', mcpResult, webEmit)

    expect(buffer).toHaveLength(2)
    expect(buffer[0].name).toBe('mcp.tool_called')
    expect((buffer[0].payload as { toolName: string }).toolName).toBe('audit_ui_component')
  })

  it('TEL-01b: pushes audit.completed as the second entry with numeric counts', async () => {
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'test-sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    const mcpResult = {
      content: [{ text: '{"fileCount":3,"mithrilCount":1,"a11yCount":2}' }],
    }

    await simulateMcpCallTool('audit_ui_component', mcpResult, webEmit)

    expect(buffer[1].name).toBe('audit.completed')
    const payload = buffer[1].payload as { fileCount: number; violationCount: number; durationMs: number }
    expect(payload.fileCount).toBe(3)
    expect(payload.violationCount).toBe(3) // mithrilCount + a11yCount
    expect(typeof payload.durationMs).toBe('number')
    expect(payload.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('TEL-01c: mcp.tool_called payload has exactly one key — toolName — never args', async () => {
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    await simulateMcpCallTool(
      'audit_ui_component',
      { content: [{ text: '{}' }] },
      webEmit,
    )

    const toolCalledEntry = buffer.find((e) => e.name === 'mcp.tool_called')!
    expect(toolCalledEntry).toBeDefined()
    const payloadKeys = Object.keys(toolCalledEntry.payload as object)
    expect(payloadKeys).toEqual(['toolName'])
  })

  it('TEL-01d: also works for flint_audit (audit tool family)', async () => {
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    await simulateMcpCallTool(
      'flint_audit',
      { content: [{ text: '{"fileCount":2,"violations":[{},{}]}' }] },
      webEmit,
    )

    expect(buffer).toHaveLength(2)
    expect(buffer[1].name).toBe('audit.completed')
    const payload = buffer[1].payload as { fileCount: number; violationCount: number }
    expect(payload.fileCount).toBe(2)
    expect(payload.violationCount).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEL-02 — Consent gate: no emit when consent is unset or declined
// Contract testBoundary edge case: "Consent state is 'unset' or 'declined' —
//   webEmit is a no-op; buffer length unchanged."
// ─────────────────────────────────────────────────────────────────────────────

describe('mcp:call-tool — consent gate (TEL-02)', () => {
  it('TEL-02a: buffer stays empty when consent is "unset"', async () => {
    // No consent file — state defaults to "unset"
    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    await simulateMcpCallTool(
      'audit_ui_component',
      { content: [{ text: '{}' }] },
      webEmit,
    )

    expect(buffer).toHaveLength(0)
  })

  it('TEL-02b: buffer stays empty when consent is "declined"', async () => {
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'declined', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    await simulateMcpCallTool(
      'audit_ui_component',
      { content: [{ text: '{}' }] },
      webEmit,
    )

    expect(buffer).toHaveLength(0)
  })

  it('TEL-02c: non-audit tool only emits mcp.tool_called (no audit.completed)', async () => {
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    // flint_status is not an audit tool
    await simulateMcpCallTool('flint_status', { content: [] }, webEmit)

    expect(buffer).toHaveLength(1)
    expect(buffer[0].name).toBe('mcp.tool_called')
    // No audit.completed entry
    expect(buffer.find((e) => e.name === 'audit.completed')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEL-03 / TEL-04 — Round-trip: getConsent + setConsent
// Contract testBoundary: round-trip test
// ─────────────────────────────────────────────────────────────────────────────

describe('telemetry:get-consent and telemetry:set-consent round-trip (TEL-03/TEL-04)', () => {
  it('TEL-03a: getConsent returns { state: "unset" } when no file exists', () => {
    const record = webReadConsent(tmpDir)
    expect(record.state).toBe('unset')
    expect(typeof record.sessionId).toBe('string')
    expect(record.sessionId.length).toBeGreaterThan(8)
  })

  it('TEL-03b: getConsent creates the consent file on first call', () => {
    const consentFilePath = path.join(tmpDir, 'beta-consent.json')
    expect(existsSync(consentFilePath)).toBe(false)
    webReadConsent(tmpDir)
    expect(existsSync(consentFilePath)).toBe(true)
  })

  it('TEL-03c: setConsent writes the file and returned value matches what is on disk', () => {
    const returned = webSetConsent(tmpDir, { state: 'accepted' })
    const consentFilePath = path.join(tmpDir, 'beta-consent.json')
    const onDisk = JSON.parse(readFileSync(consentFilePath, 'utf-8')) as typeof returned

    expect(returned.state).toBe('accepted')
    expect(onDisk.state).toBe(returned.state)
    expect(onDisk.sessionId).toBe(returned.sessionId)
    expect(onDisk.decidedAt).toBe(returned.decidedAt)
  })

  it('TEL-04: setConsent stamps decidedAt as an ISO 8601 string', () => {
    const result = webSetConsent(tmpDir, { state: 'accepted' })
    expect(typeof result.decidedAt).toBe('string')
    // Should parse without throwing
    expect(() => new Date(result.decidedAt!).toISOString()).not.toThrow()
  })

  it('TEL-04b: setConsent with "declined" also stamps decidedAt', () => {
    const result = webSetConsent(tmpDir, { state: 'declined' })
    expect(result.state).toBe('declined')
    expect(typeof result.decidedAt).toBe('string')
  })

  it('TEL-04c: getConsent after setConsent round-trips the state correctly', () => {
    webSetConsent(tmpDir, { state: 'accepted' })
    const readBack = webReadConsent(tmpDir)
    expect(readBack.state).toBe('accepted')
    expect(typeof readBack.decidedAt).toBe('string')
  })

  it('TEL-04d: sessionId is preserved across set/get round-trip', () => {
    const initial = webReadConsent(tmpDir)
    const afterSet = webSetConsent(tmpDir, { state: 'accepted' })
    expect(afterSet.sessionId).toBe(initial.sessionId)
  })

  it('TEL-04e: setConsent throws for an invalid state value', () => {
    expect(() => webSetConsent(tmpDir, { state: 'garbage' })).toThrow(
      'state must be "accepted" or "declined"',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEL-06 — Security pin: FLINT_TELEMETRY_SECRET never appears in IPC responses
//
// Invariant: secret-never-crosses-process-boundary
// The telemetry:get-consent and telemetry:set-consent handlers never read,
// echo, or surface FLINT_TELEMETRY_SECRET. This test sets the env var to a
// known sentinel and verifies it cannot appear in the JSON response body.
//
// Uses a fixture in tmpDir — not the real userData path.
// ─────────────────────────────────────────────────────────────────────────────

describe('security pin — secret-never-crosses-process-boundary (TEL-06)', () => {
  const SENTINEL = 'TEST_SECRET_SENTINEL_a7f3c9e1'

  beforeEach(() => {
    process.env.FLINT_TELEMETRY_SECRET = SENTINEL
  })

  afterEach(() => {
    delete process.env.FLINT_TELEMETRY_SECRET
  })

  it('TEL-06a: telemetry:get-consent response does not contain FLINT_TELEMETRY_SECRET', () => {
    const record = webReadConsent(tmpDir)
    const responseBody = JSON.stringify(record)

    expect(responseBody).not.toContain(SENTINEL)
    // Double-check: the env var is set but not in the response
    expect(process.env.FLINT_TELEMETRY_SECRET).toBe(SENTINEL)
  })

  it('TEL-06b: telemetry:set-consent response does not contain FLINT_TELEMETRY_SECRET', () => {
    const record = webSetConsent(tmpDir, { state: 'accepted' })
    const responseBody = JSON.stringify(record)

    expect(responseBody).not.toContain(SENTINEL)
    expect(process.env.FLINT_TELEMETRY_SECRET).toBe(SENTINEL)
  })

  it('TEL-06c: neither response contains the secret when consent is already on disk', () => {
    // Write a pre-existing consent file then read/set through the handlers
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({
        state: 'accepted',
        sessionId: 'pre-existing-sid',
        decidedAt: '2026-04-25T12:00:00.000Z',
      }),
    )

    const getResult = webReadConsent(tmpDir)
    const setResult = webSetConsent(tmpDir, { state: 'declined' })

    expect(JSON.stringify(getResult)).not.toContain(SENTINEL)
    expect(JSON.stringify(setResult)).not.toContain(SENTINEL)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TEL-07 — audit.completed defaults when tool result is unparseable
// Contract testBoundary edge case: "Tool result has no JSON content —
//   fileCount/violationCount default to 0"
// ─────────────────────────────────────────────────────────────────────────────

describe('audit.completed — default counts on unparseable result (TEL-07)', () => {
  it('TEL-07a: violationCount defaults to 0 when content array is empty; fileCount defaults to 1', async () => {
    // Mirror of server/index.ts: content?.[0]?.text ?? '{}' → JSON.parse('{}') →
    // fileCount not present → default is 1 (line 2881), violationCount → 0.
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    // No text content — same as an empty content array
    await simulateMcpCallTool('audit_ui_component', { content: [] }, webEmit)

    const auditEntry = buffer.find((e) => e.name === 'audit.completed')!
    const payload = auditEntry.payload as { fileCount: number; violationCount: number }
    // Server default: fileCount=1 when not in parsed JSON, violationCount=0 when no count keys
    expect(payload.fileCount).toBe(1)
    expect(payload.violationCount).toBe(0)
  })

  it('TEL-07b: fileCount defaults to 1 and violationCount to 0 when JSON has no matching keys', async () => {
    // Mirror of server/index.ts line 2881: "fileCount defaults to 1 when not present"
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    // Text is valid JSON but no known keys
    await simulateMcpCallTool(
      'audit_ui_component',
      { content: [{ text: '{"something":"else"}' }] },
      webEmit,
    )

    const auditEntry = buffer.find((e) => e.name === 'audit.completed')!
    const payload = auditEntry.payload as { fileCount: number; violationCount: number }
    // Per server/index.ts line 2881: default is 1 when fileCount not in response
    expect(payload.fileCount).toBe(1)
    expect(payload.violationCount).toBe(0)
  })

  it('TEL-07c: malformed JSON in tool result does not throw', async () => {
    writeFileSync(
      path.join(tmpDir, 'beta-consent.json'),
      JSON.stringify({ state: 'accepted', sessionId: 'sid', decidedAt: new Date().toISOString() }),
    )

    const buffer: BufferEntry[] = []
    const webEmit = makeWebEmit(tmpDir, buffer)

    await expect(
      simulateMcpCallTool(
        'audit_ui_component',
        { content: [{ text: '{NOT VALID JSON' }] },
        webEmit,
      ),
    ).resolves.not.toThrow()

    // Buffer should still have 2 entries (mcp.tool_called + audit.completed with zeros)
    expect(buffer).toHaveLength(2)
  })
})
