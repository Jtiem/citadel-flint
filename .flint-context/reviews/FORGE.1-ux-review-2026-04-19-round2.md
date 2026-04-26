# FORGE.1 UX Review — Round 2 (Re-review after fix-forward)

**Reviewer:** flint-ux-critic
**Date:** 2026-04-19
**Round:** 2
**Phase:** FORGE.1
**Verdict:** FIX-FORWARD (PASS)

## Summary

Round 1 verdict was REVISE with 3 BLK + 5 WARN. All 8 are closed. The channel-count blocker (BLK-1) was resolved by user decision (3 channels locked per `project_launchscreen_v2`). The remaining 7 findings were addressed in code. One non-blocking suggestion (SUG-1) noted on the Figma URL hand-off mechanism.

## Files reviewed

- `src/components/ui/LaunchScreen.tsx`
- `src/components/ui/DetectionPreview.tsx`
- `shared/ipc-validators.ts` (verified `projectCreateScratchpadSchema`)
- `electron/main.ts` (verified handler at `:1918-1997`)
- `server/index.ts` (verified web parity at `:1199-1259`)
- `electron/preload.ts` (verified bridge at `:508-511`)
- `src/adapters/web-api.ts` (verified web adapter at `:414-415`)

## Per-finding status

### BLK-1 — 4 channels exceeded scope — CLOSED (user decision)

3 channels confirmed at `LaunchScreen.tsx:59-74`. Demo picker, Recent projects, Paste-Audit are explicitly called out as "persistent surfaces, not channels" in the file header (`:11-18`). Locked per `project_launchscreen_v2` memory.

### BLK-2 — `libraryDefault: 'mui'` not plumbed — CLOSED

Full chain verified end-to-end:

- `LaunchScreen.tsx:247` — `await window.flintAPI.project.createScratchpad({ libraryDefault: 'mui' })`
- `electron/preload.ts:508-511` — bridge accepts `payload?: { libraryDefault?: string }` and forwards to `project:create-scratchpad`
- `shared/ipc-validators.ts:486-491` — `projectCreateScratchpadSchema` is a `z.union([undefined, z.object({ libraryDefault: z.string().min(1).max(200).optional() }).strict()])`
- `electron/main.ts:1923-1924` — handler imports schema and parses payload before use
- `server/index.ts:1199-1202` — web-mode handler mirrors the same parse
- `src/adapters/web-api.ts:414-415` — web adapter forwards payload

### BLK-3 — Plain-language labels — CLOSED

`DetectionPreview.tsx`:
- `:175` "Built with" (was "Framework")
- `:187` "Component kit" (was "Library")
- `:205` "Styling" (was "CSS")
- `:219` "Code type" (was "TypeScript" boolean)
- `:221` "Design tokens" (was "Tokens")

Selects/values still surface raw names (e.g. "React", "MUI (Material UI)", "Tailwind CSS") which is the correct secondary-technical-name pattern.

### WARN-1 — Audit-only journey — CLOSED (deferred with TODO)

`LaunchScreen.tsx:55-58` carries an explicit comment naming UX-W1 and committing Sprint 2 to a tertiary "Audit only" link. Acceptable per round-1 guidance.

### WARN-3 — MUI default uses warning iconography — CLOSED

`DetectionPreview.tsx:188-193`:

```tsx
{!detectedLibrary && libraryOverride === null && (
    <span className="flex items-center gap-1 text-xs text-emerald-400 mr-2">
        <CheckCircle size={11} aria-hidden="true" />
        <span>Using MUI (change if needed)</span>
    </span>
)}
```

Positive `CheckCircle`, emerald (success) color, confident copy. No `AlertTriangle` or amber anywhere on this row.

### WARN-4 — Figma channel — CLOSED

`LaunchScreen.tsx:494-513` renders an inline URL input under the channel button (no modal). The flow:
- Channel select sets `flowStep = 'input'` (`:469`)
- Inline panel renders text input + "Open" button
- `handleFromFigmaSubmit` (`:267-290`) validates `figma.com` URL, stashes on `window.__FLINT_PENDING_FIGMA_URL`, calls existing `onNewProject` — no new IPC channel
- Comment at `:118-124` and `:259-265` honestly explains the Sprint 1 hand-off mechanism

### WARN-5 — "overrides applied" hint always shown — CLOSED

`DetectionPreview.tsx:100-103`:

```tsx
const libraryChanged = effectiveLibrary !== (detectedLibrary ?? 'mui')
const frameworkChanged = effectiveFramework !== detectedFramework && effectiveFramework !== null
const cssChanged = effectiveCss !== detectedCss && effectiveCss !== null
const hasOverrides = libraryChanged || frameworkChanged || cssChanged
```

Banner at `:226` gated on `hasOverrides`. Re-selecting the detected value yields `*Changed === false` and the banner stays hidden.

## New finding

### SUG-1 (suggestion, non-blocking) — Figma URL hand-off uses window global

`LaunchScreen.tsx:284` writes the captured Figma URL to `window.__FLINT_PENDING_FIGMA_URL` for the host IDE / Mason path to pick up. Works and is honestly commented, but a typed channel or context-store slice would be cleaner if Sprint 2 expands the Figma flow. Reuses no new infra (per W4 ask), so accepting this for now is reasonable.

## Rubric

| Criterion | Result |
|-----------|--------|
| 3-channel layout (locked) | pass |
| `libraryDefault` plumbed renderer → preload → main + web | pass |
| Plain-language labels on all detection rows | pass |
| MUI default uses positive (not warning) iconography | pass |
| Figma channel uses inline URL input, not modal | pass |
| Override hint hidden when effective == detected | pass |
| Audit-only journey TODO acknowledged in code | pass |

## Scope coverage

**Reviewed:** LaunchScreen, DetectionPreview, ipc-validators, main.ts handler, server.ts handler, preload bridge, web-api adapter.

**Skipped:** PasteAuditModal, DemoScenarioPicker, SetupWizard — unchanged in this round.
