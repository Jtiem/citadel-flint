# MINT.5 Phase 3 — UX Review (Scoped, Cheaper-Pilot Lever A)

**Reviewer:** flint-ux-critic
**Date:** 2026-04-20
**Round:** 1
**Scope:** UX surfaces only (8 files) — TokenHealthBar, EmitDropdown, ConfirmEmitDialog, SyncStalenessBanner, useEmitTokens, useSyncStaleness, useSyncActions, syncStalenessStore

## Verdict

`FIX-FORWARD` — no blocking findings; multiple warnings the team should fix forward but none gate ship.

## What I Tested

- EmitDropdown open/close, keyboard flow, menu item labels, spinner state
- ConfirmEmitDialog destructive-confirm bias, focus trap, copy
- SyncStalenessBanner render gating, copy, dismiss/pull CTAs, a11y
- TokenHealthBar composition with EmitDropdown + SyncActionCluster, persistent-error chip
- Hooks: emit serialization, staleness polling cleanup, dismissal auto-clear, store shape

## Findings

### WARN-1 — Write-mode emit has no confirmation dialog in the default path
**File:** src/hooks/useEmitTokens.ts:124-132; src/components/ui/mint/EmitDropdown.tsx:194-198
The EmitDropdown "write to disk" menu item calls `onEmit([platform], 'write')` which reaches `useEmitTokens.emit()`. The hook only invokes `confirmWrite` if the caller provided it. The comment at line 125-128 says the caller "is assumed to have handled confirmation" — but `EmitDropdown.handleItemSelect` fires `onEmit` immediately on Enter/click with no guard. If a wiring mistake at the TokenManager layer omits `confirmWrite`, a single Enter keystroke writes files to disk. Destructive actions should fail closed: the dropdown should invoke the confirm dialog itself for write-mode, or the hook should refuse write without a confirmWrite callback.

### WARN-2 — "Emit to disk" dialog does not name the files or file count
**File:** src/components/ui/mint/ConfirmEmitDialog.tsx:109-124
Dialog body says "The following platform files will be written to {outputDir}" and lists platforms as a comma list. It never states how many files, their names, or whether existing files will be overwritten. For a non-technical user, "Tailwind config (write to disk)" → Confirm is opaque — will it overwrite my `tailwind.config.js`? Add a file-count line ("3 files will be created/overwritten") and ideally the resolved filenames.

### WARN-3 — EmitDropdown menu item roles use `div` instead of `li` under `role="menu"` on a bare `div`
**File:** src/components/ui/mint/EmitDropdown.tsx:214, 229, 239
The parent is `<div role="menu">` (not `ul`), and children are `<div role="menuitem">`. The comment at line 90 says `menuRef = useRef<HTMLUListElement>` but the rendered element is a div. The `<span role="none">` section wrappers (line 222 — `<span>` used as block `px-3 py-1` label) mix inline/block semantics. Screen readers on Chromium+NVDA handle the explicit roles fine, but the type/markup mismatch is a code-smell and the section label span is not marked as a group header (`role="presentation"` with a sibling `aria-labelledby` would be cleaner). Low impact, fix when touched.

### WARN-4 — Staleness banner copy lacks a clear "why this matters"
**File:** src/components/ui/mint/SyncStalenessBanner.tsx:55-57
Copy: "Last synced 26 hours ago. Pull to refresh." This tells the user *what* but not *why it matters* or *what happens if they ignore it*. Per the plain-language directive in project memory, journey-phase copy should explain the consequence ("Your tokens may be out of date with Figma — pull to see recent changes."). One-line fix.

### SUG-1 — Success toast says "written to disk successfully" with a platform list that includes slugs
**File:** src/hooks/useEmitTokens.ts:179-187
`platformList = platforms.join(', ')` emits `"css, tailwind, react-native"` rather than the human labels defined in `ConfirmEmitDialog.PLATFORM_LABELS`. A non-technical user reading the toast sees raw slugs. Share the label map (hoist to a shared module) so toast + dialog agree.

### SUG-2 — EmitDropdown trigger `title="Emit tokens"` duplicates the visible "Emit" label without adding info
**File:** src/components/ui/mint/EmitDropdown.tsx:207
The `title` tooltip is redundant with the visible text. For a progressive-disclosure context, a tooltip that explains what "Emit" means to a designer ("Export tokens as code for a platform") would be higher value. Minor.

### SUG-3 — SyncStalenessBanner has no keyboard shortcut to dismiss
**File:** src/components/ui/mint/SyncStalenessBanner.tsx:72-80
Banner is `role="status"` (not focusable by default). Keyboard users must Tab through the page to reach the dismiss X. Not a blocker — status banners aren't expected to be modal — but an Escape-handler while banner is visible would help power users. Defer unless user signal emerges.

## Instrumentation

- **Files read (scoped):** 8 of 8 UX files listed in scope
- **Files read outside scope:** 1 (`shared/review-schema.ts` — required to emit the sibling .review.ts correctly)
- **Approximate bytes read:** TokenHealthBar 9,800 + EmitDropdown 10,900 + ConfirmEmitDialog 4,500 + SyncStalenessBanner 3,300 + useEmitTokens 8,100 + useSyncStaleness 6,700 + useSyncActions 14,600 + syncStalenessStore 2,100 + review-schema 11,800 ≈ **71.8 KB total** (~72,000 bytes)
- **File count read:** 9 total (8 scoped + 1 schema reference)
