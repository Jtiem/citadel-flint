# Pre-existing a11y debt in 3 Glass components — 2026-04-25

Surfaced by Flint's own Warden during the dead-code comment-cleanup pass. None
introduced by today's edits — these are existing violations the dogfood-flint
hook caught when files were touched. Filing rather than fixing inline because
they're out of scope for a comment-only cleanup.

## src/components/editor/GhostCodeSnippet.tsx — 5 violations

- A11Y-090 (×2): `<button>` with `transition-colors` lacks prefers-reduced-motion guard
- A11Y-021: `<div>` has `onMouseDown` without keyboard equivalent (`onKeyDown`)
- A11Y-100: same `<div>` is interactive but lacks role + tabIndex
- A11Y-033: `role="separator"` missing required `aria-valuenow`

Fix shape: small. Wrap motion classes in `motion-safe:`, add keyboard handlers
to the drag region, give the interactive div `role="button"` + `tabIndex={0}`,
add `aria-valuenow` to the separator.

## src/components/ui/ExportModal.tsx — 22 violations + 1 amber

The big one. Pre-existing tech debt:
- A11Y-090 (×16): unguarded `transition-colors` on every button
- A11Y-112 + A11Y-116: fixed/sticky positioning may obscure focused elements
- A11Y-010: heading skips from h0 to h2
- A11Y-090 (1 div): `transition-all duration-300` unguarded
- A11Y-050: missing `<main>` landmark
- A11Y-051: missing `<nav>` landmark
- MOTION-001 (amber): `duration-300` not backed by a motion token

Fix shape: medium. Mostly motion-safe wrapping (16 buttons + 1 div). Heading
skip is a one-line fix. Landmarks are easy adds. The fixed-positioning
obscure-focus warnings need a structural review of the modal stack.

## src/components/ui/__tests__/ExportModal.govfix2.test.tsx — 8 violations

All 8 are A11Y-101 reports against `ExportModal` itself (the component the
test imports), flagging missing `aria-modal="true"` / `role="dialog"`. This is
the same root cause as the ExportModal violations above — fix the component,
the test file's audit goes green.

## Why these matter for beta

ExportModal is the Gate — the export pre-flight audit. A beta tester will hit
this every time they try to export. Shipping the export flow with 22 a11y
violations in a tool that *enforces a11y* is the same credibility gap as the
StatusBar Disconnect button issue we just fixed (commit `cbca625`). This
should land before beta tester invitations go out.

## Recommended sequence

Spin a `flint-design-engineer` pass scoped to ExportModal.tsx. Run Flint's
own Warden `audit_ui_component` after each fix to confirm clean. ~half-day.

GhostCodeSnippet is a smaller follow-up — same pattern, less scope, can
land in the same session or a separate one.
