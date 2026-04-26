# Follow-up: Settings → Privacy panel needed

**Filed:** 2026-04-25
**Triggered by:** UX review WARN-1 on TelemetryConsentDialog

## What happened

The UX review on BETA-TELEMETRY-WIRING noted that the consent dialog should
tell users their choice is reversible ("You can change this any time in
Settings → Privacy"). A Settings → Privacy panel does not exist anywhere in
the codebase. Searching `src/components/settings/`, `src/components/preferences/`,
and all component files for `privacy`, `setConsent`, and `telemetry.*setting`
returned no results.

## What was shipped instead

The dialog copy was updated to: "Telemetry is **off until you opt in here.**"
The word "here" is load-bearing — it correctly signals that this dialog is the
only place to opt in, without promising a settings page that doesn't exist.

## What needs to be built

A Settings → Privacy section (or tab) where users can:

1. See their current telemetry consent state (`accepted` / `declined`).
2. Toggle consent at any time via `window.flintAPI.telemetry.setConsent`.
3. The toggle must call the same IPC handler the consent dialog uses — no new
   backend work is needed, only a UI surface.

## Where it should live

Likely: a Settings panel reachable from the StatusBar or a keyboard shortcut
(⌘,). The Privacy section can be a subsection of a broader Settings panel.
If a Settings panel already exists when this is implemented, add Privacy as a
new section. If not, build the minimum: a modal or drawer with just the Privacy
toggle.

## Once built

Update `TelemetryConsentDialog.tsx` body copy to read:

> "Telemetry is **off until you opt in.** You can change this any time in
> Settings → Privacy."

And add a corresponding test asserting the copy string is present.

## Priority

This is a GDPR posture improvement and a designer-trust item. It is not a
blocker for closed beta but should be completed before public beta.
