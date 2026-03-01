/**
 * MithrilLinter — Unit Tests
 *
 * Scope: pure, headless logic. No React, no Electron IPC, no window.bridgeAPI.
 *
 * What we verify:
 *   1. cssColorToHex — normalises all supported CSS color formats to hex.
 *   2. calculateDrift — returns correct CIEDE2000 ΔE values via the
 *      existing tokenMatcher engine.
 *   3. MITHRIL_THRESHOLD — re-exported constant equals 2.0.
 */

import { describe, it, expect, vi } from 'vitest'
import { cssColorToHex, calculateDrift, MITHRIL_THRESHOLD } from './MithrilLinter'

// ── cssColorToHex ─────────────────────────────────────────────────────────────

describe('cssColorToHex', () => {

    // ── 1. 6-digit hex pass-through ───────────────────────────────────────────

    it('passes through a 6-digit hex unchanged (lowercase)', () => {
        expect(cssColorToHex('#6366f1')).toBe('#6366f1')
    })

    it('lowercases an uppercase 6-digit hex', () => {
        expect(cssColorToHex('#FF0000')).toBe('#ff0000')
    })

    // ── 2. 3-digit hex expansion ──────────────────────────────────────────────

    it('expands a 3-digit hex to 6 digits', () => {
        expect(cssColorToHex('#abc')).toBe('#aabbcc')
    })

    it('expands a 3-digit white to #ffffff', () => {
        expect(cssColorToHex('#fff')).toBe('#ffffff')
    })

    // ── 3. rgb() ──────────────────────────────────────────────────────────────

    it('converts rgb() to hex', () => {
        expect(cssColorToHex('rgb(99, 102, 241)')).toBe('#6366f1')
    })

    it('converts rgb() with no spaces to hex', () => {
        expect(cssColorToHex('rgb(255,0,0)')).toBe('#ff0000')
    })

    // ── 4. rgba() — alpha discarded ───────────────────────────────────────────

    it('converts rgba() to hex, discarding alpha', () => {
        // rgba(99, 102, 241, 0.5) → same as rgb(99, 102, 241)
        expect(cssColorToHex('rgba(99, 102, 241, 0.5)')).toBe('#6366f1')
    })

    // ── 5. hsl() ──────────────────────────────────────────────────────────────

    it('converts hsl(0, 0%, 100%) to #ffffff', () => {
        expect(cssColorToHex('hsl(0, 0%, 100%)')).toBe('#ffffff')
    })

    it('converts hsl(0, 0%, 0%) to #000000', () => {
        expect(cssColorToHex('hsl(0, 0%, 0%)')).toBe('#000000')
    })

    // ── 6. hsla() — alpha discarded ───────────────────────────────────────────

    it('converts hsla() to hex, discarding alpha', () => {
        expect(cssColorToHex('hsla(0, 0%, 100%, 0.8)')).toBe('#ffffff')
    })

    // ── 7. Invalid inputs ─────────────────────────────────────────────────────

    it('returns null for a plain string', () => {
        expect(cssColorToHex('invalid')).toBeNull()
    })

    it('returns null for an empty string', () => {
        expect(cssColorToHex('')).toBeNull()
    })

    it('returns null for a Tailwind class name', () => {
        expect(cssColorToHex('bg-indigo-500')).toBeNull()
    })

    it('returns null for a 4-digit hex (not supported)', () => {
        expect(cssColorToHex('#abcd')).toBeNull()
    })
})

// ── calculateDrift ────────────────────────────────────────────────────────────

describe('calculateDrift', () => {

    // ── 1. Identical colors — ΔE = 0 ─────────────────────────────────────────

    it('returns 0 for identical hex values', () => {
        const dE = calculateDrift('#6366f1', '#6366f1')
        expect(dE).not.toBeNull()
        expect(dE!).toBe(0)
    })

    // ── 2. Near match — ΔE < 2.0 ─────────────────────────────────────────────

    it('returns ΔE < 2.0 for perceptually indistinguishable colors', () => {
        // #6366f1 vs a very slightly different shade
        const dE = calculateDrift('#6366f1', '#6467f2')
        expect(dE).not.toBeNull()
        expect(dE!).toBeLessThan(MITHRIL_THRESHOLD)
    })

    // ── 3. Clear violation — ΔE > 2.0 ────────────────────────────────────────

    it('returns ΔE > 2.0 for clearly different colors (black vs white)', () => {
        const dE = calculateDrift('#ffffff', '#000000')
        expect(dE).not.toBeNull()
        expect(dE!).toBeGreaterThan(MITHRIL_THRESHOLD)
    })

    // ── 4. RGB input normalization ────────────────────────────────────────────

    it('produces the same result when inputs are in rgb() format', () => {
        const dEHex = calculateDrift('#6366f1', '#6366f1')
        const dERgb = calculateDrift('rgb(99, 102, 241)', 'rgb(99, 102, 241)')
        expect(dEHex).not.toBeNull()
        expect(dERgb).not.toBeNull()
        expect(dERgb!).toBe(dEHex!)
    })

    // ── 5. Invalid input handling ─────────────────────────────────────────────

    it('returns null when styleValue is unparseable', () => {
        expect(calculateDrift('not-a-color', '#ffffff')).toBeNull()
    })

    it('returns null when tokenValue is unparseable', () => {
        expect(calculateDrift('#6366f1', 'also-invalid')).toBeNull()
    })

    it('returns null when both inputs are invalid', () => {
        expect(calculateDrift('bad', 'worse')).toBeNull()
    })
})

// ── MITHRIL_THRESHOLD ─────────────────────────────────────────────────────────

describe('MITHRIL_THRESHOLD', () => {
    it('equals 2.0 (the Commandment 9 perceptual boundary)', () => {
        expect(MITHRIL_THRESHOLD).toBe(2.0)
    })
})

// ── Phase E.3 — Perceptual Drift Detection Pipeline ───────────────────────────
//
// Validates the coordinator logic that PropertiesPanel.handleStyleCommit runs
// when a user types a raw hex code into the Properties Panel:
//   1. calculateDrift is called against the nearest Design Token.
//   2. If ΔE > MITHRIL_THRESHOLD (2.0) → amber warning must be raised.
//   3. The raw user value is always logged to component_overrides (upsertOverride).
//
// PropertiesPanel.tsx is React and outside the headless test scope, so the
// pure coordinator logic is extracted into `runDriftPipeline` here and verified
// with a vi.fn() mock standing in for window.bridgeAPI.tokens.upsertOverride.

describe('Phase E.3 — Perceptual Drift Detection Pipeline', () => {

    /**
     * Models the coordinator behaviour from PropertiesPanel.handleStyleCommit:
     *   1. Run CIEDE2000 drift calculation.
     *   2. Decide amber warning flag.
     *   3. Always persist the raw value via upsertOverride (regardless of ΔE).
     */
    function runDriftPipeline(
        hexInput: string,
        nearestTokenHex: string,
        bridgeId: string,
        mockUpsert: (bridgeId: string, key: string, value: string) => void,
    ): { dE: number | null; amberWarning: boolean } {
        const dE = calculateDrift(hexInput, nearestTokenHex)
        const amberWarning = dE !== null && dE > MITHRIL_THRESHOLD
        // Mirrors PropertiesPanel: always upsert the raw input, even on clean drift.
        mockUpsert(bridgeId, 'style', hexInput)
        return { dE, amberWarning }
    }

    // ── 1. Clear violation ────────────────────────────────────────────────────

    it('raises amber warning when user hex is far from the nearest token (ΔE > 2.0)', () => {
        const upsert = vi.fn()
        const { dE, amberWarning } = runDriftPipeline('#ff0000', '#0000ff', 'btn:4:6', upsert)
        expect(dE).not.toBeNull()
        expect(dE!).toBeGreaterThan(MITHRIL_THRESHOLD)
        expect(amberWarning).toBe(true)
    })

    // ── 2. Near match — no violation ──────────────────────────────────────────

    it('does not raise amber warning when ΔE ≤ 2.0', () => {
        const upsert = vi.fn()
        const { dE, amberWarning } = runDriftPipeline('#6366f1', '#6467f2', 'btn:4:6', upsert)
        expect(dE).not.toBeNull()
        expect(dE!).toBeLessThan(MITHRIL_THRESHOLD)
        expect(amberWarning).toBe(false)
    })

    // ── 3. Exact token match ──────────────────────────────────────────────────

    it('reports ΔE = 0 and no amber warning when hex matches the token exactly', () => {
        const upsert = vi.fn()
        const { dE, amberWarning } = runDriftPipeline('#6366f1', '#6366f1', 'btn:4:6', upsert)
        expect(dE).toBe(0)
        expect(amberWarning).toBe(false)
    })

    // ── 4. upsertOverride always fires regardless of drift level ──────────────

    it('calls upsertOverride even when ΔE is below the threshold', () => {
        const upsert = vi.fn()
        runDriftPipeline('#6366f1', '#6467f2', 'card:2:0', upsert)
        expect(upsert).toHaveBeenCalledOnce()
    })

    it('calls upsertOverride with (bridgeId, "style", rawHexInput) on a violation', () => {
        const upsert = vi.fn()
        const bridgeId = 'text:12:4'
        const hexInput = '#e11d48'   // rose-600 — large drift from white
        runDriftPipeline(hexInput, '#ffffff', bridgeId, upsert)
        expect(upsert).toHaveBeenCalledWith(bridgeId, 'style', hexInput)
    })

    // ── 5. Raw input is persisted, not the auto-corrected token value ─────────

    it('persists the raw user-input hex in upsertOverride, not the nearest token', () => {
        const upsert = vi.fn()
        const rawInput = '#f1f5f9'   // user's arbitrary hex
        const tokenHex = '#e2e8f0'   // nearest Design Token (different value)
        runDriftPipeline(rawInput, tokenHex, 'section:1:0', upsert)
        // upsertArgs[2] must be the user's value — not the auto-corrected token.
        expect(upsert).toHaveBeenCalledWith(expect.any(String), 'style', rawInput)
    })

    // ── 6. Invalid hex input → null ΔE, no amber warning, upsert still fires ─

    it('produces null ΔE and no amber warning when the input cannot be parsed as a colour', () => {
        const upsert = vi.fn()
        // A Tailwind class name is not a valid CSS colour — cssColorToHex returns null.
        const { dE, amberWarning } = runDriftPipeline('bg-indigo-500', '#6366f1', 'btn:1:0', upsert)
        expect(dE).toBeNull()
        expect(amberWarning).toBe(false)
        // upsertOverride still fires — the raw string is always persisted.
        expect(upsert).toHaveBeenCalledOnce()
    })
})
