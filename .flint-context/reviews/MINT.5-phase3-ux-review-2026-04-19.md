# MINT.5-phase3 UX Review

- **Phase:** MINT.5-phase3
- **Dimension:** ux
- **Reviewer:** flint-ux-critic
- **Date:** 2026-04-19
- **Round:** 1
- **Scope:** EmitDropdown + ConfirmEmitDialog + SyncStalenessBanner (3 new presentational components); TokenHealthBar.tsx Phase 3 additions (emit cluster, lines ~120-295); TokenManager.tsx Phase 3 additions (emit + staleness wiring, lines 220-600, 820-855, 1047-1054); UX coverage scan of test files (not for code style)

## Verdict

**FIX-FORWARD** — 0 blocking · 1 warnings · 2 suggestions

## Findings

### WARN-1 — Invalid <li>-inside-<li> HTML nesting in EmitDropdown menu structure

**Severity:** warning · **Scope:** one-file · **Status:** open · **Commandment:** 5

**Evidence:**
- `src/components/ui/mint/EmitDropdown.tsx:261` — Outer <li role="none"> is the platform-group wrapper.
- `src/components/ui/mint/EmitDropdown.tsx:274` — Nested <li role="menuitem"> child for preview mode.
- `src/components/ui/mint/EmitDropdown.tsx:297` — Nested <li role="menuitem"> child for write mode.

**Observed:** The menu renders <ul role="menu"> → <li role="none"> (platform group wrapper) → nested <li role="menuitem"> children. <li> inside <li> without an intervening <ul>/<ol> is invalid HTML.

**Rationale:** Some screen readers (NVDA, JAWS) treat invalid list nesting inconsistently. Focus order works because tabIndex is managed manually, but assistive-tech announcement of "list with N items" can become "list with 5 items" instead of "menu with 10 items." Commandment 5 (Accessibility is a Compiler Error) treats this as a fail.

**Proposed fix:** Replace the outer <li role="none" key={platform}> with <React.Fragment key={platform}> so the menuitem children are direct children of the parent <ul role="menu">. Alternatively switch the parent to <div role="menu"> and use <div role="none"> wrappers throughout.

### SUG-1 — EmitDropdown trigger label "Emit" is engineer vocabulary, not designer vocabulary

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `src/components/ui/mint/EmitDropdown.tsx:237` — Button text is the bare word "Emit"; only the title="Emit tokens" tooltip clarifies.

**Observed:** Designers reading the TokenHealthBar see "Pull / Push / Resolve / Emit". The first three are sync verbs they recognize. "Emit" is engineer/compiler vocabulary ("emit JSON", "emit tokens to disk"). The tooltip helps hover users but not first-glance scannability.

**Rationale:** Plain-language-output principle. Phase 2 already removed Citadel/jargon copy ("Alliance OAuth"); Phase 3 reintroduces low-level vocabulary at the visible button label. Contract meta declares audience: 'designer'. "Export" or "Hand off" reads more naturally to that audience.

**Proposed fix:** Change visible label to "Export" (verb parity with Pull/Push) or "Hand off"; keep the menu items as-is.

### SUG-2 — SyncStalenessBanner has redundant action vocabulary ("Pull to refresh." body + "Pull now" CTA)

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `src/components/ui/mint/SyncStalenessBanner.tsx:56` — Body reads "Pull to refresh."
- `src/components/ui/mint/SyncStalenessBanner.tsx:68` — CTA reads "Pull now".

**Observed:** Two near-identical phrasings 30px apart. The body sentence is descriptive ("Pull to refresh"), the button says "Pull now". Mild redundancy; a designer scanning the banner reads the same verb twice with slightly different surface forms.

**Rationale:** Copy density matters in narrow sidebars. Either drop the trailing "Pull to refresh." from the body (let the button carry the action) or change the CTA to a non-redundant label like "Refresh now."

**Proposed fix:** Trim the body to "Last synced 26 hours ago." and let the "Pull now" button be the only action vocabulary.

## Rubric

| Criterion | Result | Evidence / Related findings |
|-----------|--------|-----------------------------|
| EmitDropdown has role="menu" + ARIA labelling + keyboard nav + outside-click + Escape close | pass | EmitDropdown.tsx:96-133, 156-196 |
| ConfirmEmitDialog has FocusTrap + role="dialog" + aria-modal + Escape cancels + asymmetric initial focus on Cancel | pass | ConfirmEmitDialog.tsx:58, 84-94 |
| ConfirmEmitDialog confirm button telegraphs consequence ("Emit to disk", not "Confirm") | pass | ConfirmEmitDialog.tsx:143 |
| SyncStalenessBanner has role="status" + aria-live="polite" | pass | SyncStalenessBanner.tsx:49-50 |
| Banner returns null when !isStale \|\| isDismissed | pass | SyncStalenessBanner.tsx:40 |
| Asymmetric confirm flow for emit (preview fires immediately, write opens confirm) | pass | TokenManager.tsx:572-580 |
| No Citadel codenames in user-visible copy (no "Scout", "Envoy") | pass |  |
| No MCP/OAuth jargon in user-visible copy | **fail** | EmitDropdown trigger label "Emit" is engineer vocabulary |
| Staleness copy reads naturally, no "stale" jargon, no thresholds exposed | pass | SyncStalenessBanner.tsx:56 — "Last synced 26 hours ago" |
| Phase 2 SyncActionCluster layout/spacing not regressed | pass | TokenHealthBar.tsx:284-292 emit cluster appended trailing with ml-auto fallback |
| Menu HTML structure is valid + ARIA-conformant | **fail** | Invalid <li>-inside-<li> nesting at EmitDropdown.tsx:261/274/297 |
| EmitDropdown trigger keyboard activation (Space + Enter open menu) | pass | EmitDropdown.tsx:144 |

## Scope Coverage

**Reviewed:**
- src/components/ui/mint/EmitDropdown.tsx
- src/components/ui/mint/ConfirmEmitDialog.tsx
- src/components/ui/mint/SyncStalenessBanner.tsx
- src/components/ui/TokenHealthBar.tsx (Phase 3 additions only)
- src/components/ui/TokenManager.tsx (Phase 3 additions only)
- src/components/ui/mint/__tests__/EmitDropdown.test.tsx (UX coverage scan)
- src/components/ui/mint/__tests__/ConfirmEmitDialog.test.tsx (UX coverage scan)
- src/components/ui/mint/__tests__/SyncStalenessBanner.test.tsx (UX coverage scan)

**Skipped:**
- src/hooks/* — code reviewer scope
- src/store/* — code reviewer scope
- shared/ipc-validators.ts + electron/preload.ts + electron/mcpClient.ts + server/* — security reviewer scope
- shared/syncStaleness.ts + shared/mcp-classification.ts — code reviewer scope (pure helpers)
