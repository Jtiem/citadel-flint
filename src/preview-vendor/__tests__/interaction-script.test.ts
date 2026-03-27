/**
 * interaction-script.test.ts
 *
 * MFP.1 — Verifies that FLINT_INTERACTION_SCRIPT and FLINT_INTERACTION_STYLES
 * were correctly extracted from LivePreview.tsx and contain all required
 * message handlers and CSS classes.
 *
 * Tests:
 *   IS-01 — FLINT_INTERACTION_SCRIPT is a non-empty string
 *   IS-02 — FLINT_INTERACTION_SCRIPT contains all required message type handlers
 *   IS-03 — FLINT_INTERACTION_SCRIPT contains click-to-select handler
 *   IS-04 — FLINT_INTERACTION_SCRIPT contains hover handler
 *   IS-05 — FLINT_INTERACTION_SCRIPT contains ghost proxy setup
 *   IS-06 — FLINT_INTERACTION_SCRIPT contains drag threshold logic
 *   IS-07 — FLINT_INTERACTION_STYLES is a non-empty string
 *   IS-08 — FLINT_INTERACTION_STYLES contains .flint-selected class
 *   IS-09 — FLINT_INTERACTION_STYLES contains .flint-hovered class
 *   IS-10 — FLINT_INTERACTION_STYLES contains .flint-drop-before, .flint-drop-after, .flint-drop-inside classes
 *   IS-11 — FLINT_INTERACTION_STYLES contains #flint-ghost element style
 *   IS-12 — FLINT_INTERACTION_SCRIPT does NOT reference cdn.tailwindcss.com (C4 check)
 */

import { describe, it, expect } from 'vitest'
import {
  FLINT_INTERACTION_SCRIPT,
  FLINT_INTERACTION_STYLES,
} from '../flint-interaction'

// ── IS-01 & IS-07: Both exports are non-empty strings ─────────────────────────

describe('FLINT_INTERACTION_SCRIPT', () => {
  it('IS-01: is a non-empty string', () => {
    expect(typeof FLINT_INTERACTION_SCRIPT).toBe('string')
    expect(FLINT_INTERACTION_SCRIPT.length).toBeGreaterThan(0)
  })

  // ── IS-02: All required message type handlers are present ──────────────────
  it('IS-02: contains SET_INTERACT_MODE handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('SET_INTERACT_MODE')
  })

  it('IS-02: contains CLEAR_PREVIEW handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('CLEAR_PREVIEW')
  })

  it('IS-02: contains HIGHLIGHT handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('HIGHLIGHT')
  })

  it('IS-02: contains DRAG_OVER handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('DRAG_OVER')
  })

  it('IS-02: contains DRAG_CLEAR handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('DRAG_CLEAR')
  })

  it('IS-02: contains HOVER handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('HOVER')
  })

  it('IS-02: contains CLEAR_HOVER handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('CLEAR_HOVER')
  })

  it('IS-02: contains DRAG_MOVE handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('DRAG_MOVE')
  })

  it('IS-02: contains DRAG_END handler', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('DRAG_END')
  })

  it('IS-02: contains HIT_TEST_RESULT postMessage', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('HIT_TEST_RESULT')
  })

  // ── IS-03: Click-to-select ─────────────────────────────────────────────────
  it('IS-03: contains CANVAS_CLICK postMessage for click-to-select', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('CANVAS_CLICK')
  })

  it('IS-03: listens to document click events', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain("document.addEventListener('click'")
  })

  // ── IS-04: Hover handler ───────────────────────────────────────────────────
  it('IS-04: contains CANVAS_HOVER postMessage', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('CANVAS_HOVER')
  })

  it('IS-04: contains CANVAS_HOVER_CLEAR postMessage', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('CANVAS_HOVER_CLEAR')
  })

  it('IS-04: listens to mouseover events on body', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain("document.body.addEventListener('mouseover'")
  })

  it('IS-04: listens to mouseleave events on body', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain("document.body.addEventListener('mouseleave'")
  })

  // ── IS-05: Ghost proxy setup ───────────────────────────────────────────────
  it('IS-05: creates the flint-ghost element', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('flint-ghost')
  })

  it('IS-05: appends ghost to body', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('document.body.appendChild')
  })

  // ── IS-06: Drag threshold ──────────────────────────────────────────────────
  it('IS-06: contains CANVAS_DRAG_START postMessage', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('CANVAS_DRAG_START')
  })

  it('IS-06: contains drag threshold constant', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain('DRAG_THRESHOLD')
  })

  it('IS-06: listens to mousedown events', () => {
    expect(FLINT_INTERACTION_SCRIPT).toContain("addEventListener('mousedown'")
  })

  // ── IS-12: No CDN references (Commandment 4) ──────────────────────────────
  it('IS-12: does not reference cdn.tailwindcss.com (Commandment 4)', () => {
    expect(FLINT_INTERACTION_SCRIPT).not.toContain('cdn.tailwindcss.com')
  })

  it('IS-12: does not reference any external URLs', () => {
    expect(FLINT_INTERACTION_SCRIPT).not.toContain('https://')
    expect(FLINT_INTERACTION_SCRIPT).not.toContain('http://')
  })
})

// ── FLINT_INTERACTION_STYLES ──────────────────────────────────────────────────

describe('FLINT_INTERACTION_STYLES', () => {
  it('IS-07: is a non-empty string', () => {
    expect(typeof FLINT_INTERACTION_STYLES).toBe('string')
    expect(FLINT_INTERACTION_STYLES.length).toBeGreaterThan(0)
  })

  it('IS-08: contains .flint-selected class', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('.flint-selected')
  })

  it('IS-09: contains .flint-hovered class', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('.flint-hovered')
  })

  it('IS-10: contains .flint-drop-before class', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('.flint-drop-before')
  })

  it('IS-10: contains .flint-drop-after class', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('.flint-drop-after')
  })

  it('IS-10: contains .flint-drop-inside class', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('.flint-drop-inside')
  })

  it('IS-11: contains #flint-ghost element style', () => {
    expect(FLINT_INTERACTION_STYLES).toContain('#flint-ghost')
  })

  it('IS-12: does not reference any external URLs (Commandment 4)', () => {
    expect(FLINT_INTERACTION_STYLES).not.toContain('https://')
    expect(FLINT_INTERACTION_STYLES).not.toContain('http://')
  })
})
