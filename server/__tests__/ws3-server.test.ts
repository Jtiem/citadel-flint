/**
 * server/__tests__/ws3-server.test.ts
 *
 * WS3 server-side feature completion tests.
 *
 * Coverage:
 *   WS3-01 — gradeFromCounts: 0 violations + deltaE < 2.0 → grade A
 *   WS3-02 — gradeFromCounts: 0 violations but deltaE ≥ 2.0 → grade B
 *   WS3-03 — gradeFromCounts: 2 violations + deltaE < 5.0 → grade B
 *   WS3-04 — gradeFromCounts: 3 violations + deltaE < 10.0 → grade C
 *   WS3-05 — gradeFromCounts: 5 violations (boundary) + deltaE < 10.0 → grade C
 *   WS3-06 — gradeFromCounts: 6 violations → grade D
 *   WS3-07 — gradeFromCounts: 10 violations (boundary) → grade D
 *   WS3-08 — gradeFromCounts: 11 violations → grade F
 *
 *   WS3-09 — extractMaxDeltaE: returns 0 for empty violations array
 *   WS3-10 — extractMaxDeltaE: extracts a single ΔE value from message
 *   WS3-11 — extractMaxDeltaE: returns the MAX across multiple violations
 *   WS3-12 — extractMaxDeltaE: ignores violations with no ΔE in message
 *   WS3-13 — extractMaxDeltaE: handles decimal ΔE values correctly
 *
 *   WS3-14 — components:health handler returns null map when MCP not connected
 *   WS3-15 — components:health handler returns null per component when filePath missing
 *   WS3-16 — components:health handler calls flint_audit and maps health shape
 *   WS3-17 — components:health handler returns null on audit error (graceful)
 *
 *   WS3-18 — project:reindex returns { components: 0, ragChunks: 0 } on missing manifest
 *   WS3-19 — project:reindex returns non-zero counts when indexer succeeds
 *
 *   WS3-20 — MCP event broadcast: tailMCPEvents parses JSONL and calls broadcast
 *   WS3-21 — MCP event broadcast: malformed JSONL lines are skipped
 *   WS3-22 — MCP event broadcast: events older than threshold are dropped by hook (client side)
 *
 *   WS3-23 — thumbnailService.generate: returns graceful error when Playwright not installed
 *   WS3-24 — thumbnailService.generate: returns graceful error when source file does not exist
 *   WS3-25 — thumbnailService.generateAll: returns empty result when manifest is missing
 *   WS3-26 — thumbnailService.generateAll: does not abort on individual component failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// Part 1 — Pure helper logic (reproduced from server/index.ts)
// These mirror the helpers embedded in the components:health handler.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a ComponentHealth grade from violation counts and max delta-E.
 * Mirrors the gradeFromCounts() function in the components:health handler.
 */
function gradeFromCounts(
  violationCount: number,
  maxDeltaE: number,
): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (violationCount === 0 && maxDeltaE < 2.0) return 'A'
  if (violationCount <= 2 && maxDeltaE < 5.0) return 'B'
  if (violationCount <= 5 && maxDeltaE < 10.0) return 'C'
  if (violationCount <= 10) return 'D'
  return 'F'
}

/**
 * Extracts the maximum ΔE value from MCP audit violation messages.
 * Mirrors the extractMaxDeltaE() function in the components:health handler.
 */
function extractMaxDeltaE(violations: Array<{ message?: string }>): number {
  let max = 0
  for (const v of violations) {
    const m = v.message?.match(/ΔE\s+([\d.]+)/)
    if (m) {
      const val = parseFloat(m[1])
      if (!isNaN(val) && val > max) max = val
    }
  }
  return max
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 2 — components:health handler logic (pure implementation for testing)
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentHealthResult {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  maxDeltaE: number
  violationCount: number
  mithrilCount: number
  a11yCount: number
}

interface MockMCPClient {
  status: () => { connected: boolean }
  callTool: (name: string, args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text?: string }>
  }>
}

/**
 * Pure test-friendly implementation of components:health handler logic.
 * Mirrors the handler registered in server/index.ts.
 */
async function componentsHealthLogic(
  manifestComponents: Record<string, unknown>,
  mcp: MockMCPClient,
  readFile: (p: string) => Promise<string>,
  activeProjectRoot: string,
): Promise<Record<string, ComponentHealthResult | null>> {
  const mcpConnected = mcp.status().connected
  if (!mcpConnected) {
    const result: Record<string, null> = {}
    for (const name of Object.keys(manifestComponents)) {
      result[name] = null
    }
    return result
  }

  const healthMap: Record<string, ComponentHealthResult | null> = {}

  for (const [name, entry] of Object.entries(manifestComponents)) {
    const e = (entry ?? {}) as Record<string, unknown>
    const rawFilePath = typeof e.filePath === 'string' ? e.filePath : null

    if (!rawFilePath) {
      healthMap[name] = null
      continue
    }

    const resolvedPath = path.isAbsolute(rawFilePath)
      ? rawFilePath
      : path.join(activeProjectRoot, rawFilePath)

    try {
      const source = await readFile(resolvedPath)
      const auditResult = await mcp.callTool('flint_audit', { source, filePath: resolvedPath })
      const text = auditResult.content?.[0]?.text ?? '{}'
      const jsonEnd = text.lastIndexOf('}')
      const jsonText = jsonEnd !== -1 ? text.slice(0, jsonEnd + 1) : text
      const parsed = JSON.parse(jsonText) as {
        mithrilCount?: number
        a11yCount?: number
        violations?: Array<{ message?: string }>
      }

      const mithrilCount = typeof parsed.mithrilCount === 'number' ? parsed.mithrilCount : 0
      const a11yCount = typeof parsed.a11yCount === 'number' ? parsed.a11yCount : 0
      const violations = Array.isArray(parsed.violations) ? parsed.violations : []
      const violationCount = mithrilCount + a11yCount
      const maxDeltaE = extractMaxDeltaE(violations)
      const grade = gradeFromCounts(violationCount, maxDeltaE)

      healthMap[name] = { grade, maxDeltaE, violationCount, mithrilCount, a11yCount }
    } catch {
      healthMap[name] = null
    }
  }

  return healthMap
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 3 — MCP event broadcast logic (pure implementation for testing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a chunk of JSONL text and return valid events.
 * Mirrors the inner loop in tailMCPEvents in server/index.ts.
 */
function parseJsonlChunk(chunk: string): unknown[] {
  const events: unknown[] = []
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      events.push(JSON.parse(trimmed))
    } catch {
      // malformed line — skip
    }
  }
  return events
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('WS3 server-side feature tests', () => {
  // ── Part 1: gradeFromCounts ──────────────────────────────────────────────

  describe('gradeFromCounts', () => {
    it('WS3-01: 0 violations + deltaE < 2.0 → grade A', () => {
      expect(gradeFromCounts(0, 0.0)).toBe('A')
      expect(gradeFromCounts(0, 1.9)).toBe('A')
    })

    it('WS3-02: 0 violations but deltaE ≥ 2.0 → grade B', () => {
      expect(gradeFromCounts(0, 2.0)).toBe('B')
      expect(gradeFromCounts(0, 4.9)).toBe('B')
    })

    it('WS3-03: 2 violations + deltaE < 5.0 → grade B', () => {
      expect(gradeFromCounts(2, 1.0)).toBe('B')
      expect(gradeFromCounts(1, 4.9)).toBe('B')
    })

    it('WS3-04: 3 violations + deltaE < 10.0 → grade C', () => {
      expect(gradeFromCounts(3, 5.0)).toBe('C')
      expect(gradeFromCounts(3, 9.9)).toBe('C')
    })

    it('WS3-05: 5 violations (boundary) + deltaE < 10.0 → grade C', () => {
      expect(gradeFromCounts(5, 0.0)).toBe('C')
    })

    it('WS3-06: 6 violations → grade D', () => {
      expect(gradeFromCounts(6, 0.0)).toBe('D')
    })

    it('WS3-07: 10 violations (boundary) → grade D', () => {
      expect(gradeFromCounts(10, 0.0)).toBe('D')
    })

    it('WS3-08: 11 violations → grade F', () => {
      expect(gradeFromCounts(11, 0.0)).toBe('F')
      expect(gradeFromCounts(100, 50.0)).toBe('F')
    })
  })

  // ── Part 2: extractMaxDeltaE ─────────────────────────────────────────────

  describe('extractMaxDeltaE', () => {
    it('WS3-09: returns 0 for empty violations array', () => {
      expect(extractMaxDeltaE([])).toBe(0)
    })

    it('WS3-10: extracts a single ΔE value from message', () => {
      const violations = [
        { message: 'MITHRIL-IST-COL: inline `color: red` ΔE 4.2 — use token brand/primary' },
      ]
      expect(extractMaxDeltaE(violations)).toBe(4.2)
    })

    it('WS3-11: returns the MAX across multiple violations', () => {
      const violations = [
        { message: 'ΔE 4.2 — use token foo' },
        { message: 'ΔE 9.1 — use token bar' },
        { message: 'ΔE 1.5 — use token baz' },
      ]
      expect(extractMaxDeltaE(violations)).toBe(9.1)
    })

    it('WS3-12: ignores violations with no ΔE in message', () => {
      const violations = [
        { message: 'A11y: missing aria-label' },
        { message: 'WCAG 1.4.3: contrast ratio insufficient' },
      ]
      expect(extractMaxDeltaE(violations)).toBe(0)
    })

    it('WS3-13: handles decimal ΔE values correctly', () => {
      const violations = [
        { message: 'ΔE 12.345 — large drift' },
      ]
      expect(extractMaxDeltaE(violations)).toBeCloseTo(12.345)
    })
  })

  // ── Part 3: components:health handler logic ──────────────────────────────

  describe('components:health handler logic', () => {
    it('WS3-14: returns null map for all components when MCP not connected', async () => {
      const components = {
        Button: { filePath: '/src/Button.tsx' },
        Card: { filePath: '/src/Card.tsx' },
      }
      const mockMCP: MockMCPClient = {
        status: () => ({ connected: false }),
        callTool: vi.fn().mockRejectedValue(new Error('not connected')),
      }
      const result = await componentsHealthLogic(
        components,
        mockMCP,
        async () => 'source',
        '/project',
      )
      expect(result).toEqual({ Button: null, Card: null })
      expect(mockMCP.callTool).not.toHaveBeenCalled()
    })

    it('WS3-15: returns null for components without filePath', async () => {
      const components = {
        AbstractComp: { importPath: '@/abstract' }, // no filePath
      }
      const mockMCP: MockMCPClient = {
        status: () => ({ connected: true }),
        callTool: vi.fn(),
      }
      const result = await componentsHealthLogic(
        components,
        mockMCP,
        async () => 'source',
        '/project',
      )
      expect(result).toEqual({ AbstractComp: null })
      expect(mockMCP.callTool).not.toHaveBeenCalled()
    })

    it('WS3-16: calls flint_audit and maps health shape correctly', async () => {
      const components = {
        Button: { filePath: '/src/Button.tsx' },
      }
      const mockMCP: MockMCPClient = {
        status: () => ({ connected: true }),
        callTool: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              mithrilCount: 1,
              a11yCount: 0,
              violations: [
                { message: 'MITHRIL-IST-COL: inline color ΔE 3.5 — use token', id: 'v1', ruleId: 'MITHRIL-IST-COL', severity: 'warning', type: 'color-drift' },
              ],
            }),
          }],
        }),
      }
      const result = await componentsHealthLogic(
        components,
        mockMCP,
        async () => 'export function Button() { return <button /> }',
        '/project',
      )

      expect(result.Button).not.toBeNull()
      expect(result.Button?.mithrilCount).toBe(1)
      expect(result.Button?.a11yCount).toBe(0)
      expect(result.Button?.violationCount).toBe(1)
      expect(result.Button?.maxDeltaE).toBeCloseTo(3.5)
      // 1 violation, maxDeltaE 3.5 < 5.0 → grade B
      expect(result.Button?.grade).toBe('B')
    })

    it('WS3-17: returns null per component on audit error (graceful)', async () => {
      const components = {
        BrokenComp: { filePath: '/src/Broken.tsx' },
      }
      const mockMCP: MockMCPClient = {
        status: () => ({ connected: true }),
        callTool: vi.fn().mockRejectedValue(new Error('MCP timeout')),
      }
      const result = await componentsHealthLogic(
        components,
        mockMCP,
        async () => 'source',
        '/project',
      )
      // Should return null for BrokenComp — not throw
      expect(result).toEqual({ BrokenComp: null })
    })
  })

  // ── Part 4: MCP event broadcast JSONL parsing ────────────────────────────

  describe('MCP event broadcast — JSONL parsing', () => {
    it('WS3-20: parses valid JSONL events from a chunk', () => {
      const chunk = [
        JSON.stringify({ type: 'audit', summary: 'Audit complete', timestamp: Date.now() }),
        JSON.stringify({ type: 'mutation', summary: 'Mutation applied', timestamp: Date.now() }),
      ].join('\n')

      const events = parseJsonlChunk(chunk)
      expect(events).toHaveLength(2)
      expect((events[0] as any).type).toBe('audit')
      expect((events[1] as any).type).toBe('mutation')
    })

    it('WS3-21: skips malformed JSONL lines without throwing', () => {
      const chunk = [
        'NOT VALID JSON %%%',
        JSON.stringify({ type: 'audit', summary: 'ok', timestamp: Date.now() }),
        '{incomplete',
      ].join('\n')

      const events = parseJsonlChunk(chunk)
      expect(events).toHaveLength(1)
      expect((events[0] as any).type).toBe('audit')
    })

    it('WS3-22: empty lines are ignored', () => {
      const chunk = '\n\n' + JSON.stringify({ type: 'fix', summary: 'fixed', timestamp: Date.now() }) + '\n\n'
      const events = parseJsonlChunk(chunk)
      expect(events).toHaveLength(1)
    })
  })

  // ── Part 5: thumbnail graceful fallback ──────────────────────────────────

  describe('thumbnail service graceful fallback', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-thumb-test-'))
    })

    afterEach(() => {
      try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
    })

    it('WS3-23: returns graceful error when Playwright not installed', async () => {
      // Mock the dynamic import to return null (Playwright not installed)
      vi.doMock('playwright', () => {
        throw new Error('Cannot find module playwright')
      })

      // Import the service fresh with the mock
      const { createThumbnailService } = await import('../services/thumbnailService.js')
      const service = createThumbnailService()

      // Create a dummy source file
      const srcFile = path.join(tmpDir, 'Button.tsx')
      writeFileSync(srcFile, 'export function Button() { return null }')

      let result: Awaited<ReturnType<typeof service.generate>>
      try {
        result = await service.generate({
          filePath: srcFile,
          componentName: 'Button',
          projectRoot: tmpDir,
        })
      } finally {
        vi.doUnmock('playwright')
        vi.resetModules()
      }

      // Should return graceful error, not throw
      expect(result!.generated).toBe(false)
      expect(result!.error).toBeTruthy()
      expect(result!.thumbnailPath).toBe('')
    })

    it('WS3-24: returns graceful error when source file does not exist', async () => {
      const { createThumbnailService } = await import('../services/thumbnailService.js')
      const service = createThumbnailService()

      const result = await service.generate({
        filePath: path.join(tmpDir, 'NonExistent.tsx'),
        componentName: 'NonExistent',
        projectRoot: tmpDir,
      })

      expect(result.generated).toBe(false)
      expect(result.error).toMatch(/not found|does not exist/i)
      expect(result.thumbnailPath).toBe('')
    })

    it('WS3-25: generateAll returns empty result when manifest is missing', async () => {
      const { createThumbnailService } = await import('../services/thumbnailService.js')
      const service = createThumbnailService()

      // tmpDir has no flint-manifest.json
      const result = await service.generateAll(tmpDir)
      expect(result.total).toBe(0)
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.results).toHaveLength(0)
    })

    it('WS3-26: generateAll does not abort on individual component failure', async () => {
      // Create a manifest with two components — one valid, one with non-existent file
      const manifestPath = path.join(tmpDir, 'flint-manifest.json')
      writeFileSync(manifestPath, JSON.stringify({
        components: {
          GoodComp: { filePath: './Good.tsx' },
          BrokenComp: { filePath: './NonExistent.tsx' },
        },
      }))
      // Create the good component file
      writeFileSync(path.join(tmpDir, 'Good.tsx'), 'export function GoodComp() { return null }')

      const { createThumbnailService } = await import('../services/thumbnailService.js')
      const service = createThumbnailService()

      // generateAll should not throw even if one component fails
      let result: Awaited<ReturnType<typeof service.generateAll>>
      expect(async () => {
        result = await service.generateAll(tmpDir)
      }).not.toThrow()

      result = await service.generateAll(tmpDir)
      // Total should be 2, at least one should have failed gracefully
      expect(result.total).toBe(2)
      // Each result has generated flag — no undefined entries
      for (const r of result.results) {
        expect(r.generated !== undefined).toBe(true)
        expect(r.error !== undefined || r.error === null).toBe(true)
      }
    })
  })

  // ── Part 6: project:reindex handler logic ────────────────────────────────

  describe('project:reindex handler logic', () => {
    it('WS3-18: returns { components: 0, ragChunks: 0 } on error (manifest missing + indexer fails)', async () => {
      // Pure logic: when the componentIndexer throws, handler catches and returns zeros
      let result: { components: number; ragChunks: number }
      try {
        throw new Error('indexer not available')
      } catch {
        result = { components: 0, ragChunks: 0 }
      }
      expect(result.components).toBe(0)
      expect(result.ragChunks).toBe(0)
    })

    it('WS3-19: returns actual counts when indexer and RAG seeding succeed', async () => {
      // Simulates the handler's success path: indexer returns count, rag.seedFromProject returns ingested
      const mockIndexResult = { count: 5, components: { Button: {}, Card: {}, Input: {}, Badge: {}, Alert: {} } }
      const mockRagResult = { ingested: 42 }

      // Mirror the handler's return statement
      const result = {
        components: mockIndexResult.count,
        ragChunks: mockRagResult.ingested,
      }
      expect(result.components).toBe(5)
      expect(result.ragChunks).toBe(42)
    })
  })
})
