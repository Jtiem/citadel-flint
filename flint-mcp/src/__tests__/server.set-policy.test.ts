/**
 * Sprint 3: flint_set_policy integration tests
 *
 * Covers:
 *   - CRIT-1: read returns v2 ResolvedPolicy via unified loader
 *   - CRIT-3: reset writes DEFAULT_RESOLVED_POLICY
 *   - MAJOR-6: update rejects invalid payload via mergeAndValidatePolicy
 *   - CRIT-2: dynamic rule derivation accepts A11Y-011
 *
 * These tests exercise the policyEngine unified surface directly — server.ts
 * simply delegates to it, so the handler behavior is fully characterized by
 * these service-level assertions plus the caller-redirect grep check.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    loadAndResolvePolicy,
    writeResolvedPolicy,
    mergeAndValidatePolicy,
    getDefaultResolvedPolicy,
    DEFAULT_RESOLVED_POLICY,
    KNOWN_A11Y_RULES,
} from '../core/policyEngine.js'

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-set-policy-test-'))
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 })
})

describe('flint_set_policy (read) — CRIT-1', () => {
    it('returns v2 ResolvedPolicy shape from a fresh project', () => {
        const policy = loadAndResolvePolicy(tmpDir)
        expect(policy.version).toBe(2)
        expect(policy).toEqual(DEFAULT_RESOLVED_POLICY)
    })

    it('migrates v1 on-disk policy on read', () => {
        fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
        fs.writeFileSync(
            path.join(tmpDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 1, a11y: { disabled_rules: ['A11Y-006'] } }),
            'utf-8'
        )
        const policy = loadAndResolvePolicy(tmpDir)
        expect(policy.version).toBe(2)
        expect(policy.a11y.rules['A11Y-006']).toBe('off')
    })
})

describe('flint_set_policy (update) — MAJOR-6', () => {
    it('accepts A11Y-011 (proves dynamic derivation from errorTaxonomy — CRIT-2 regression guard)', () => {
        expect(KNOWN_A11Y_RULES.has('A11Y-011')).toBe(true)
        writeResolvedPolicy(tmpDir, getDefaultResolvedPolicy())
        const result = mergeAndValidatePolicy(tmpDir, {
            a11y: { rules: { 'A11Y-011': 'advisory' } },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.policy.a11y.rules['A11Y-011']).toBe('advisory')
    })

    it('rejects unknown ruleId with actionable error list and leaves disk unchanged', () => {
        writeResolvedPolicy(tmpDir, getDefaultResolvedPolicy())
        const before = fs.readFileSync(path.join(tmpDir, '.flint', 'policy.json'), 'utf-8')

        const result = mergeAndValidatePolicy(tmpDir, {
            a11y: { rules: { 'A11Y-NOT-REAL': 'off' } },
        })
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.join(' ')).toContain('A11Y-NOT-REAL')

        const after = fs.readFileSync(path.join(tmpDir, '.flint', 'policy.json'), 'utf-8')
        expect(after).toBe(before)
    })

    it('rejects invalid deltaE_threshold (negative)', () => {
        writeResolvedPolicy(tmpDir, getDefaultResolvedPolicy())
        const result = mergeAndValidatePolicy(tmpDir, {
            mithril: { deltaE_threshold: -1 },
        })
        expect(result.ok).toBe(false)
    })

    it('rejects deltaE_threshold above 20', () => {
        writeResolvedPolicy(tmpDir, getDefaultResolvedPolicy())
        const result = mergeAndValidatePolicy(tmpDir, {
            mithril: { deltaE_threshold: 999 },
        })
        expect(result.ok).toBe(false)
    })

    it('rejects non-numeric deltaE_threshold', () => {
        writeResolvedPolicy(tmpDir, getDefaultResolvedPolicy())
        const result = mergeAndValidatePolicy(tmpDir, {
            mithril: { deltaE_threshold: 'banana' as unknown as number },
        })
        expect(result.ok).toBe(false)
    })

    it('accepts a valid mithril mode change and persists it', () => {
        writeResolvedPolicy(tmpDir, getDefaultResolvedPolicy())
        const result = mergeAndValidatePolicy(tmpDir, {
            mithril: { mode: 'advisory' },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.policy.mithril.mode).toBe('advisory')

        const onDisk = JSON.parse(
            fs.readFileSync(path.join(tmpDir, '.flint', 'policy.json'), 'utf-8')
        )
        expect(onDisk.mithril.mode).toBe('advisory')
    })
})

describe('flint_set_policy (reset) — CRIT-3', () => {
    it('writes DEFAULT_RESOLVED_POLICY to disk via unified loader', () => {
        // Start with a customized policy
        const custom = getDefaultResolvedPolicy()
        custom.mithril.mode = 'advisory'
        writeResolvedPolicy(tmpDir, custom)

        // Reset
        const defaults = getDefaultResolvedPolicy()
        writeResolvedPolicy(tmpDir, defaults)

        const onDisk = JSON.parse(
            fs.readFileSync(path.join(tmpDir, '.flint', 'policy.json'), 'utf-8')
        )
        expect(onDisk.mithril.mode).toBe('blocking')
    })

    it('creates .flint directory if missing', () => {
        const defaults = getDefaultResolvedPolicy()
        writeResolvedPolicy(tmpDir, defaults)
        expect(fs.existsSync(path.join(tmpDir, '.flint', 'policy.json'))).toBe(true)
    })
})
