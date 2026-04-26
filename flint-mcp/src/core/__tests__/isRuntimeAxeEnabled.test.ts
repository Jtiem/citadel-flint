/**
 * Tests for the runtime.axe feature-flag resolver.
 * flint-mcp/src/core/__tests__/isRuntimeAxeEnabled.test.ts
 *
 * RUNTIME.1 — validates the first-ship hidden posture:
 *   - flag absent       → false (safe default)
 *   - flag explicit true → true
 *   - anything else     → false
 *
 * Contract testBoundaries:
 *   - isRuntimeAxeEnabled default false
 *   - isRuntimeAxeEnabled true when flag set
 */

import { describe, it, expect } from 'vitest'
import { isRuntimeAxeEnabled } from '../config.js'
import type { FlintProjectConfig } from '../config.js'

describe('isRuntimeAxeEnabled', () => {
    // ── Default false (contract testBoundary) ──────────────────────────────

    describe('returns false when flag is absent', () => {
        it('returns false for a config with no rules block', () => {
            const config: FlintProjectConfig = { project: 'demo' }
            expect(isRuntimeAxeEnabled(config)).toBe(false)
        })

        it('returns false for a config with rules but no runtime block', () => {
            const config: FlintProjectConfig = {
                project: 'demo',
                rules: {
                    mithril: { mode: 'coercive' },
                },
            }
            expect(isRuntimeAxeEnabled(config)).toBe(false)
        })

        it('returns false for a config with runtime block but no axe subkey', () => {
            const config = {
                project: 'demo',
                rules: { runtime: {} },
            } as FlintProjectConfig
            expect(isRuntimeAxeEnabled(config)).toBe(false)
        })

        it('returns false when axe.enabled === undefined', () => {
            const config = {
                project: 'demo',
                rules: { runtime: { axe: {} } },
            } as FlintProjectConfig
            expect(isRuntimeAxeEnabled(config)).toBe(false)
        })

        it('returns false when axe.enabled === false', () => {
            const config: FlintProjectConfig = {
                project: 'demo',
                rules: { runtime: { axe: { enabled: false } } },
            }
            expect(isRuntimeAxeEnabled(config)).toBe(false)
        })
    })

    // ── True when flag set (contract testBoundary) ─────────────────────────

    describe('returns true when flag is explicitly enabled', () => {
        it('returns true for rules.runtime.axe.enabled === true', () => {
            const config: FlintProjectConfig = {
                project: 'demo',
                rules: { runtime: { axe: { enabled: true } } },
            }
            expect(isRuntimeAxeEnabled(config)).toBe(true)
        })

        it('works with partial shape (lightweight callers)', () => {
            expect(
                isRuntimeAxeEnabled({ rules: { runtime: { axe: { enabled: true } } } })
            ).toBe(true)
        })
    })

    // ── Strict boolean behaviour ──────────────────────────────────────────

    describe('only strict boolean true enables', () => {
        it('returns false for "true" string', () => {
            expect(
                isRuntimeAxeEnabled({
                    rules: { runtime: { axe: { enabled: 'true' as unknown as boolean } } },
                })
            ).toBe(false)
        })

        it('returns false for 1 numeric', () => {
            expect(
                isRuntimeAxeEnabled({
                    rules: { runtime: { axe: { enabled: 1 as unknown as boolean } } },
                })
            ).toBe(false)
        })

        it('returns false for {} empty object', () => {
            expect(
                isRuntimeAxeEnabled({
                    rules: { runtime: { axe: { enabled: {} as unknown as boolean } } },
                })
            ).toBe(false)
        })
    })

    // ── Defensive edge cases ──────────────────────────────────────────────

    describe('defensive edge cases', () => {
        it('returns false for null', () => {
            expect(isRuntimeAxeEnabled(null)).toBe(false)
        })

        it('returns false for undefined', () => {
            expect(isRuntimeAxeEnabled(undefined)).toBe(false)
        })

        it('returns false for empty object', () => {
            expect(isRuntimeAxeEnabled({} as FlintProjectConfig)).toBe(false)
        })

        it('returns false when rules is not an object', () => {
            const config = { project: 'demo', rules: 'invalid' as unknown as FlintProjectConfig['rules'] }
            expect(isRuntimeAxeEnabled(config as FlintProjectConfig)).toBe(false)
        })

        it('returns false when runtime is not an object', () => {
            const config = {
                project: 'demo',
                rules: { runtime: 'invalid' as unknown as FlintProjectConfig['rules']['runtime'] },
            } as unknown as FlintProjectConfig
            expect(isRuntimeAxeEnabled(config)).toBe(false)
        })
    })
})
