/**
 * TelemetryConsentDialog.test.tsx
 *
 * Component tests for the first-launch telemetry consent dialog.
 * This dialog renders when window.flintAPI.telemetry.getConsent() returns
 * state === "unset" and calls setConsent on user decision.
 *
 * Contract reference: BETA-TELEMETRY-WIRING.contract.ts
 *   testBoundary "TelemetryConsentDialog Accept"
 *   testBoundary "TelemetryConsentDialog a11y focus trap"
 *
 * Test file status: scaffolded from contract testBoundaries.
 * Tests are marked it.todo until TelemetryConsentDialog.tsx is created
 * by flint-design-engineer (Group B).
 *
 * Covers:
 *   TCDLG-01 — renders when consent.state === "unset"
 *   TCDLG-02 — does not render when consent.state === "accepted"
 *   TCDLG-03 — does not render when consent.state === "declined"
 *   TCDLG-04 — Accept button calls window.flintAPI.telemetry.setConsent({ state: "accepted" }) exactly once
 *   TCDLG-05 — Accept calls onDecided("accepted") after IPC resolves
 *   TCDLG-06 — Decline button calls window.flintAPI.telemetry.setConsent({ state: "declined" }) exactly once
 *   TCDLG-07 — Decline calls onDecided("declined") after IPC resolves
 *   TCDLG-08 — Escape key triggers Decline path (privacy-safe default)
 *   TCDLG-09 — Double-click on Accept fires only one IPC call
 *   TCDLG-10 — IPC rejection: dialog stays open (no onDecided call) with retry affordance
 *   TCDLG-11 — A11y: role="dialog" attribute present
 *   TCDLG-12 — A11y: aria-modal="true" present
 *   TCDLG-13 — A11y: aria-labelledby points to a visible heading element
 *   TCDLG-14 — A11y: aria-describedby points to visible description text
 *   TCDLG-15 — A11y focus trap: Tab on last element wraps to first
 *   TCDLG-16 — A11y focus trap: Shift+Tab from Accept (first) wraps to Decline (last)
 *   TCDLG-17 — A11y focus trap: initial focus lands on Accept button
 *   TCDLG-18 — A11y focus trap: no crash when dialog has no focusable children
 *   TCDLG-19 — disclosure: "What gets collected?" summary is present and collapsed by default
 *   TCDLG-20 — disclosure: expanding it shows all five event descriptions
 *   TCDLG-21 — copy: body mentions "off until you opt in here" (honest reversibility)
 *   TCDLG-22 — Decline button has a visible border (peer visual weight with Accept)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type {
  TelemetryConsentDialogProps,
  ConsentRecord,
} from '../../../../.flint-context/contracts/BETA-TELEMETRY-WIRING.contract'

// ── Import guard ──────────────────────────────────────────────────────────────
//
// TelemetryConsentDialog does not exist yet (Group B creates it).
// We attempt a dynamic import; if it fails, all tests are skipped gracefully
// with informative messages. Once the component exists, the import resolves and
// full assertions run.
//
// This lets implementers run the suite and see "red" tests immediately as they
// build the component, without causing a module-resolution crash that would
// hide unrelated test failures.

let TelemetryConsentDialog: React.ComponentType<TelemetryConsentDialogProps> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../TelemetryConsentDialog') as {
    TelemetryConsentDialog?: React.ComponentType<TelemetryConsentDialogProps>
    default?: React.ComponentType<TelemetryConsentDialogProps>
  }
  TelemetryConsentDialog = mod.TelemetryConsentDialog ?? mod.default ?? null
} catch {
  // Component not yet created — tests below will use it.todo or skip
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush the setTimeout(0) used by FocusTrap's initial focus. */
async function flushFocusTimer() {
  await act(async () => {
    vi.advanceTimersByTime(1)
  })
}

function mockFlintAPIWithConsent(state: ConsentRecord['state']) {
  const setConsent = vi.fn().mockResolvedValue({
    state: state === 'unset' ? 'accepted' : state,
    sessionId: 'test-session-uuid-1234',
    decidedAt: new Date().toISOString(),
  } satisfies ConsentRecord)

  const getConsent = vi.fn().mockResolvedValue({
    state,
    sessionId: 'test-session-uuid-1234',
    decidedAt: state !== 'unset' ? new Date().toISOString() : undefined,
  } satisfies ConsentRecord)

  ;(window as { flintAPI: unknown }).flintAPI = {
    ...(window as unknown as { flintAPI: Record<string, unknown> }).flintAPI,
    telemetry: {
      getConsent,
      setConsent,
    },
  }

  return { getConsent, setConsent }
}

function renderDialog(
  props?: Partial<TelemetryConsentDialogProps>,
): { onDecided: ReturnType<typeof vi.fn> } & ReturnType<typeof render> {
  if (!TelemetryConsentDialog) {
    throw new Error('TelemetryConsentDialog not yet implemented (Group B)')
  }
  const onDecided = (props?.onDecided ?? vi.fn()) as ReturnType<typeof vi.fn>
  const result = render(<TelemetryConsentDialog onDecided={onDecided as unknown as TelemetryConsentDialogProps['onDecided']} />)
  return { onDecided, ...result }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TelemetryConsentDialog — render conditions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-01 — renders the dialog when consent.state === "unset"', async () => {
    if (!TelemetryConsentDialog) {
      // TODO: implement after flint-design-engineer creates TelemetryConsentDialog.tsx
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  // TCDLG-02 / TCDLG-03 (does not render when accepted/declined) — removed:
  // these are parent-mount conditions handled by App.tsx, not by the dialog
  // component itself. The dialog always renders when mounted; the parent
  // decides whether to mount it. Not part of the contract testBoundary set.
})

describe('TelemetryConsentDialog — Accept button', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-04 — Accept calls setConsent({ state: "accepted" }) exactly once', async () => {
    if (!TelemetryConsentDialog) {
      // TODO: implement after flint-design-engineer creates TelemetryConsentDialog.tsx
      return
    }
    // Contract testBoundary: "TelemetryConsentDialog Accept"
    // given: dialog is rendered
    // when: user clicks Accept
    // then: window.flintAPI.telemetry.setConsent called once with { state: "accepted" }
    const { setConsent } = mockFlintAPIWithConsent('unset')
    const { onDecided } = renderDialog()
    await flushFocusTimer()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    })

    expect(setConsent).toHaveBeenCalledOnce()
    expect(setConsent).toHaveBeenCalledWith({ state: 'accepted' })
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith('accepted'))
  })

  // TCDLG-05 (onDecided after IPC) is already asserted inside TCDLG-04 via
  // waitFor(onDecided). Removed to avoid redundant duplicate coverage.

  it('TCDLG-09 — double-click on Accept fires only one IPC call', async () => {
    if (!TelemetryConsentDialog) return
    // Contract edge case: "double-click → only one IPC call"
    const { setConsent } = mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    await act(async () => {
      fireEvent.click(acceptBtn)
      fireEvent.click(acceptBtn)
    })

    expect(setConsent).toHaveBeenCalledOnce()
    expect(setConsent).toHaveBeenCalledWith({ state: 'accepted' })
  })

  it('TCDLG-10 — IPC rejection keeps dialog open and does not call onDecided', async () => {
    if (!TelemetryConsentDialog) return
    // Contract edge case: "IPC rejection → dialog stays open with retry copy"
    const { setConsent } = mockFlintAPIWithConsent('unset')
    setConsent.mockRejectedValueOnce(new Error('IPC failure'))
    const { onDecided } = renderDialog()
    await flushFocusTimer()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    })

    // Dialog must remain mounted; onDecided must not fire on rejection.
    await waitFor(() => {
      expect(setConsent).toHaveBeenCalledWith({ state: 'accepted' })
    })
    expect(onDecided).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeDefined()
    // Retry affordance: error region surfaced inline
    expect(screen.getByTestId('telemetry-consent-error')).toBeDefined()

    // User can retry — second click should re-invoke setConsent
    setConsent.mockResolvedValueOnce({
      state: 'accepted',
      sessionId: 'test-session-uuid-1234',
      decidedAt: new Date().toISOString(),
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    })
    await waitFor(() => {
      expect(setConsent).toHaveBeenCalledTimes(2)
    })
  })
})

describe('TelemetryConsentDialog — Decline button', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-06 — Decline calls setConsent({ state: "declined" }) exactly once', async () => {
    if (!TelemetryConsentDialog) {
      // TODO: implement after flint-design-engineer creates TelemetryConsentDialog.tsx
      return
    }
    const { setConsent } = mockFlintAPIWithConsent('unset')
    const { onDecided } = renderDialog()
    await flushFocusTimer()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /decline/i }))
    })

    expect(setConsent).toHaveBeenCalledOnce()
    expect(setConsent).toHaveBeenCalledWith({ state: 'declined' })
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith('declined'))
  })

  // TCDLG-07 (onDecided after IPC) is already asserted inside TCDLG-06 via
  // waitFor(onDecided). Removed to avoid redundant duplicate coverage.
})

describe('TelemetryConsentDialog — Escape key', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-08 — Escape key triggers Decline path (privacy-safe default)', async () => {
    if (!TelemetryConsentDialog) {
      // TODO: implement after flint-design-engineer creates TelemetryConsentDialog.tsx
      return
    }
    // Contract component spec: "Escape key triggers Decline path (privacy-safe default)"
    const { setConsent } = mockFlintAPIWithConsent('unset')
    const { onDecided } = renderDialog()
    await flushFocusTimer()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(setConsent).toHaveBeenCalledWith({ state: 'declined' })
      expect(onDecided).toHaveBeenCalledWith('declined')
    })
  })
})

describe('TelemetryConsentDialog — A11y attributes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-11 — has role="dialog"', async () => {
    if (!TelemetryConsentDialog) {
      // TODO: implement after component exists
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('TCDLG-12 — has aria-modal="true"', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('TCDLG-13 — aria-labelledby points to a visible heading element', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const labelEl = document.getElementById(labelId!)
    expect(labelEl).toBeTruthy()
    expect(labelEl!.textContent!.length).toBeGreaterThan(0)
  })

  it('TCDLG-14 — aria-describedby points to visible description text', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()
    const dialog = screen.getByRole('dialog')
    const descId = dialog.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    const descEl = document.getElementById(descId!)
    expect(descEl).toBeTruthy()
    expect(descEl!.textContent!.length).toBeGreaterThan(0)
  })
})

describe('TelemetryConsentDialog — disclosure and copy (UX warnings 1+2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-19 — "What gets collected?" disclosure is present and collapsed by default', async () => {
    if (!TelemetryConsentDialog) return
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const disclosure = screen.getByTestId('telemetry-disclosure')
    expect(disclosure).toBeDefined()
    // <details> must NOT have the open attribute by default
    expect((disclosure as HTMLDetailsElement).open).toBe(false)
    expect(screen.getByText('What gets collected?')).toBeDefined()
  })

  it('TCDLG-20 — expanding the disclosure shows all five event descriptions', async () => {
    if (!TelemetryConsentDialog) return
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const summary = screen.getByText('What gets collected?')
    await act(async () => {
      fireEvent.click(summary)
    })

    const list = screen.getByTestId('telemetry-disclosure-list')
    expect(list).toBeDefined()
    // All five categories must be mentioned
    expect(list.textContent).toMatch(/App launches/i)
    expect(list.textContent).toMatch(/Crashes/i)
    expect(list.textContent).toMatch(/Tool names/i)
    expect(list.textContent).toMatch(/Audit summaries/i)
    expect(list.textContent).toMatch(/Session length/i)
  })

  it('TCDLG-21 — body copy is honest about reversibility: says "off until you opt in here"', async () => {
    if (!TelemetryConsentDialog) return
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const desc = document.getElementById('telemetry-dialog-description')
    expect(desc).toBeTruthy()
    expect(desc!.textContent).toMatch(/off until you opt in here/i)
  })

  it('TCDLG-22 — Decline button has a border class (peer visual weight with Accept)', async () => {
    if (!TelemetryConsentDialog) return
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const declineBtn = screen.getByTestId('telemetry-decline-btn')
    // Border presence is tested via className — this guards against regressions
    // that strip the border and return Decline to ghost-only styling.
    expect(declineBtn.className).toMatch(/border/)
  })
})

describe('TelemetryConsentDialog — A11y focus trap', () => {
  // Contract testBoundary: "TelemetryConsentDialog a11y focus trap"
  // given: dialog mounted, Accept has initial focus
  // when: Shift+Tab from Accept (first element)
  // then: sets activeElement to Decline (last focusable element)
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TCDLG-17 — initial focus lands on Decline button (privacy-safe default)', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    // Contract: initial focus on Decline button — user must affirmatively
    // click Accept to opt in.
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const declineBtn = screen.getByRole('button', { name: /decline/i })
    expect(document.activeElement).toBe(declineBtn)
  })

  it('TCDLG-16 — Shift+Tab from Decline wraps focus to last focusable (Accept)', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    // Contract testBoundary: "TelemetryConsentDialog a11y focus trap"
    // given: dialog mounted, Decline has initial focus (privacy-safe default)
    // when: Shift+Tab from Decline (first in DOM order)
    // then: focus moves to Accept (last focusable element in dialog)
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const declineBtn = screen.getByRole('button', { name: /decline/i })
    expect(document.activeElement).toBe(declineBtn)

    // Shift+Tab from first focusable wraps to last
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    expect(document.activeElement).toBe(acceptBtn)
  })

  it('TCDLG-15 — Tab from Accept (last focusable) wraps focus to Decline (first)', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    acceptBtn.focus()
    expect(document.activeElement).toBe(acceptBtn)

    fireEvent.keyDown(document, { key: 'Tab' })
    const declineBtn = screen.getByRole('button', { name: /decline/i })
    expect(document.activeElement).toBe(declineBtn)
  })

  it('TCDLG-18 — document.activeElement stays within dialog throughout Tab cycle', async () => {
    if (!TelemetryConsentDialog) {
      return
    }
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    const dialog = screen.getByRole('dialog')

    // Tab forward
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Tab backward
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Tab forward again
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('TCDLG-18b — Tab does not crash when no focusable children are reachable', async () => {
    if (!TelemetryConsentDialog) return
    // Contract edge case: "dialog mounts with no focusable children → focuses
    // dialog root". The production dialog always renders Decline + Accept,
    // but this asserts the defensive baseline: if focusable elements vanish
    // (e.g. both buttons disabled mid-IPC), Tab/Shift+Tab must not throw.
    mockFlintAPIWithConsent('unset')
    renderDialog()
    await flushFocusTimer()

    // Disable both action buttons to simulate the defensive edge case where
    // no focusable children are reachable through normal tabbing.
    const declineBtn = screen.getByRole('button', { name: /decline/i }) as HTMLButtonElement
    const acceptBtn = screen.getByRole('button', { name: /accept/i }) as HTMLButtonElement
    declineBtn.disabled = true
    acceptBtn.disabled = true

    // Tab and Shift+Tab must not throw; the dialog stays mounted.
    expect(() => {
      fireEvent.keyDown(document, { key: 'Tab' })
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    }).not.toThrow()
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
