/**
 * deferViolation.test.ts — Strategy 7: Breadcrumb Trail
 *
 * Tests for the flint_defer_violation MCP tool handler:
 *   - Happy path: defer a violation, verify JSON file is created
 *   - Missing params: file, ruleId, projectRoot
 *   - Duplicate deferral: upserts existing entry
 *   - Multiple violations: each gets its own entry
 *   - File I/O edge cases: missing .flint dir, malformed JSON
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handleDeferViolation } from '../deferViolation.js'

// ── Test helpers ─────────────────────────────────────────────────────────

function createTempProject(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-defer-test-'))
    const flintDir = path.join(tmpDir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    return tmpDir
}

function cleanup(projectRoot: string): void {
    try {
        fs.rmSync(projectRoot, { recursive: true, force: true })
    } catch {
        // Ignore cleanup errors
    }
}

function readDeferredFile(projectRoot: string): unknown[] {
    const filePath = path.join(projectRoot, '.flint', 'deferred-violations.json')
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('flint_defer_violation', () => {
    let projectRoot: string

    beforeEach(() => {
        projectRoot = createTempProject()
    })

    afterEach(() => {
        cleanup(projectRoot)
    })

    // ── Happy path ───────────────────────────────────────────────────────

    it('defers a violation and creates the JSON file', () => {
        const result = handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            projectRoot,
        })

        // Result should indicate success
        const text = result.content[0].text
        const parsed = JSON.parse(text)
        expect(parsed.deferred).toBe(true)
        expect(parsed.file).toBe('/src/Button.tsx')
        expect(parsed.ruleId).toBe('MITH-COL-001')
        expect(parsed.message).toContain('remind you next session')

        // JSON file should exist with one entry
        const entries = readDeferredFile(projectRoot)
        expect(entries).toHaveLength(1)
        expect((entries[0] as Record<string, unknown>).file).toBe('/src/Button.tsx')
        expect((entries[0] as Record<string, unknown>).ruleId).toBe('MITH-COL-001')
        expect((entries[0] as Record<string, unknown>).nodeId).toBeNull()
        expect((entries[0] as Record<string, unknown>).reason).toBeNull()
        expect((entries[0] as Record<string, unknown>).deferredAt).toBeTruthy()
    })

    it('defers a violation with nodeId and reason', () => {
        const result = handleDeferViolation({
            file: '/src/Card.tsx',
            ruleId: 'A11Y-001',
            nodeId: 'flint-card-root',
            reason: 'Will fix after design review',
            projectRoot,
        })

        const text = result.content[0].text
        const parsed = JSON.parse(text)
        expect(parsed.deferred).toBe(true)
        expect(parsed.nodeId).toBe('flint-card-root')
        expect(parsed.reason).toBe('Will fix after design review')

        const entries = readDeferredFile(projectRoot) as Array<Record<string, unknown>>
        expect(entries).toHaveLength(1)
        expect(entries[0].nodeId).toBe('flint-card-root')
        expect(entries[0].reason).toBe('Will fix after design review')
    })

    // ── Missing params ───────────────────────────────────────────────────

    it('returns error when file is missing', () => {
        const result = handleDeferViolation({
            file: '',
            ruleId: 'MITH-COL-001',
            projectRoot,
        })

        expect(result.content[0].text).toContain("'file' parameter is required")
    })

    it('returns error when ruleId is missing', () => {
        const result = handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: '',
            projectRoot,
        })

        expect(result.content[0].text).toContain("'ruleId' parameter is required")
    })

    it('returns error when projectRoot is missing', () => {
        const result = handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            projectRoot: '',
        })

        expect(result.content[0].text).toContain("'projectRoot' parameter is required")
    })

    // ── Duplicate deferral (upsert) ──────────────────────────────────────

    it('upserts when the same violation is deferred twice', () => {
        // First deferral
        handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            reason: 'First reason',
            projectRoot,
        })

        // Second deferral — same file + ruleId, different reason
        handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            reason: 'Updated reason',
            projectRoot,
        })

        // Should still have only 1 entry (upserted)
        const entries = readDeferredFile(projectRoot) as Array<Record<string, unknown>>
        expect(entries).toHaveLength(1)
        expect(entries[0].reason).toBe('Updated reason')
    })

    it('treats different nodeIds as distinct entries', () => {
        handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            nodeId: 'node-1',
            projectRoot,
        })

        handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            nodeId: 'node-2',
            projectRoot,
        })

        const entries = readDeferredFile(projectRoot)
        expect(entries).toHaveLength(2)
    })

    // ── Multiple violations ──────────────────────────────────────────────

    it('accumulates multiple distinct deferrals', () => {
        handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            projectRoot,
        })

        handleDeferViolation({
            file: '/src/Card.tsx',
            ruleId: 'A11Y-001',
            projectRoot,
        })

        handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-TYP-002',
            projectRoot,
        })

        const entries = readDeferredFile(projectRoot)
        expect(entries).toHaveLength(3)
    })

    // ── Edge cases ───────────────────────────────────────────────────────

    it('creates .flint directory if it does not exist', () => {
        const bareProject = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-bare-'))
        try {
            // No .flint directory — handler should create it
            handleDeferViolation({
                file: '/src/Button.tsx',
                ruleId: 'MITH-COL-001',
                projectRoot: bareProject,
            })

            const entries = readDeferredFile(bareProject)
            expect(entries).toHaveLength(1)
        } finally {
            cleanup(bareProject)
        }
    })

    it('recovers from malformed existing JSON file', () => {
        // Write invalid JSON
        fs.writeFileSync(
            path.join(projectRoot, '.flint', 'deferred-violations.json'),
            '{ bad json',
            'utf-8'
        )

        // Should not throw — starts fresh
        const result = handleDeferViolation({
            file: '/src/Button.tsx',
            ruleId: 'MITH-COL-001',
            projectRoot,
        })

        const parsed = JSON.parse(result.content[0].text)
        expect(parsed.deferred).toBe(true)

        const entries = readDeferredFile(projectRoot)
        expect(entries).toHaveLength(1)
    })
})
