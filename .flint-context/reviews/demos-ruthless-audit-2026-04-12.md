# Flint Demos — Ruthless Dogfood Audit
**Date:** 2026-04-12
**Auditor:** /review (Flint quality gate)
**Question:** Do Flint's own demos pass Flint's own governance rules — and do they actually show what the demo script claims?

---

## TL;DR — Overall Grade: **D+**

The demo fixtures are **functionally broken in ways that would humiliate us in front of a technical audience**. Individual "violating" files are well-crafted (they contain real, pedagogically valid violations). But the surrounding narrative layer — READMEs, the shared demo script, the before/after pair at the repo root, and Demo 6's corrupted file — **contradicts itself, invents violations that don't exist in the code, and in one case ships a byte-identical "before"/"after" pair**. If a prospect opened the folder and read carefully, they'd stop trusting us in under five minutes.

**Pass:** Demo 2 (self-correcting), Demo 3 drift file, Demo 4 violating-ux.tsx.
**Fail:** Demo 5 (README is fiction), Demo 6 (corrupted file won't compile + A11y claim fabricated), repo-root `demo-before.tsx` / `demo-after.tsx` (identical), Demo 1 (two different stories depending on which doc you read).

---

## Ground Rules Applied

Intentional violations (in files clearly marked as fixtures that are supposed to fail audit) are NOT bugs — that's pedagogy. The bar is:
1. Do the violations the file claims to contain actually exist?
2. Do the counts, ΔE values, and rule IDs match across README, demo script, and source?
3. Does the "after"/"compliant" version actually demonstrate a fix?
4. Does the file type-check under strict TSC (the same standard Flint enforces on AI output)?
5. Is the narrative internally consistent?

---

## Per-File Findings

### /Users/tiemann/Lunar-Elevator-Bridge/demos/demo-before.tsx and /demos/demo-after.tsx — **Grade: F (CRITICAL)**

**`demo-before.tsx` and `demo-after.tsx` are byte-identical.**

Both files contain the same 10 intentional violations (A11Y-001 through A11Y-008, MITHRIL-001, MITHRIL-002), the same `#1d4ed8` hardcoded button color, the same `#b91c1c` error text, the same missing `role="alert"`, the same unlabeled inputs. The file literally named `demo-after.tsx` demonstrates **zero remediation**.

This is a kill-shot finding. If any reviewer opens `demo-after.tsx` expecting to see what "fixed" looks like, they see the same broken code with a different filename. It also breaks Demo 1's claim ("Flint wouldn't approve — five Mithril violations, three A11y failures") because the repo-root before/after pair advertises a different count (10) and different rule IDs (A11Y-001..008, MITHRIL-001/002) than Demo 1's story.

**Required fix:** Either rewrite `demo-after.tsx` to actually apply the 10 fixes (label associations, `role="alert"`, brand tokens, `aria-label` on icon button, etc.) or delete both files and let the demo 01–06 scenarios carry the story.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/05-semantic-refactor/legacy-divs.tsx + README.md — **Grade: F (CRITICAL)**

The README is **fiction**. It says:
- "every layout primitive is a bare `<div>` with a BEM-inspired className (`box`, `stack`, `flex-row`)"
- "every text node is a `<span>` with an ad-hoc className (`text-label`, `text-body`, `text-caption`)"
- "every interactive control is built from scratch with inline styles rather than the canonical `TextField`, `SelectField`, and `Button` primitives"
- "AI issues `flint_ast_mutate` operations to swap each raw HTML element for its design system equivalent — `<div className="stack">` becomes `<Stack>`, `<span className="text-label">` becomes `<Text variant=\"label\">`, `<button className=\"btn-primary\">` becomes `<Button variant=\"primary\">`"

**None of that is in the file.** The actual `legacy-divs.tsx`:
- Uses Tailwind utility classes (`max-w-2xl mx-auto p-8`, not BEM)
- Uses real `<input type="text">`, `<select>`, `<option>` elements (not "raw divs pretending to be inputs")
- Text is in `<div>` (not `<span>`) with `text-xl`/`text-sm` Tailwind
- Has zero `<div className="box">` / `<span className="text-label">` / `<button className="btn-primary">` anywhere
- Internally the file's own JSDoc (lines 12–13) contradicts itself claiming "Every 'input' is a raw `<div>` with no role, tabIndex, or label" — but the code renders real HTML inputs.

There IS no component registry exposing `<Stack>`, `<Text variant="label">`, or `<Button variant="primary">` in `demos/`, so even if we ran the demo, `flint_query_registry` would not return those primitives.

**Real violations present in the file (good):** two `<div onClick>` in the action bar (Cancel/Save), `<div>` used as heading instead of `<h*>`, missing `<form>` wrapper, no `htmlFor`/`id` label association on inputs, no `<fieldset>/<legend>`, mutable global `_savedProfile`. That's a credible ~6–8 violation demo. But the README oversells by 3x and points at structures that don't exist.

**Required fix:** Rewrite the README to describe what the file actually contains, OR rewrite the file to match the README (divs-for-inputs div-soup pattern with BEM classes), OR both. Pick one reality.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/06-macro-recovery/corrupted-card.tsx + README.md — **Grade: F (CRITICAL)**

Two independent critical issues:

**1. The corrupted file does not type-check under strict TSC.** It declares `useState` for `starred` and `watching` but never reads them or updates them. It declares `formatCount` and `timeAgo` and never calls them. It declares `onStar`, `onFork`, `onWatch` props and never uses them. Under `noUnusedLocals`/`noUnusedParameters` (the strictness bar Flint brags about in Demo 2's "in-memory TSC loop"), this file fails compilation — which means Flint's own demo fixture would be rejected by Flint's own orchestrator. Ironic dogfood failure.

**2. The A11y story in the README is fabricated.** README claims "triggering three `A11Y-002` violations" and "governance health score drops from 94 to 61". But `A11Y-002` rules fire on *present* elements that are broken, not on *absent* elements. The corrupted file removed the metrics row and the action footer — removed elements cannot trigger a11y violations. The remaining code still has `aria-label` on the link, `aria-hidden` on svg, and `role="img"` on the language bar. The 94→61 score and "three A11Y-002" numbers are made up.

The actual value of this demo — "Git Time Machine transplants missing AST nodes without doing `git checkout` on the whole file" — is a real and powerful story. It just isn't an *a11y* story, it's a structural-loss recovery story.

**Required fix:**
- Remove unused imports/locals/props from `corrupted-card.tsx` so it compiles under strict TSC.
- Rewrite the README to drop the fake a11y claim. Frame this as a debt/completeness regression (lost functionality → lower health score from reduced component surface coverage) OR actually break a11y in the corruption (e.g., remove the `aria-label` from the star button and replace the action footer with `<div onClick>`).

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/03-mithril-shadow-audit/README.md — **Grade: D (CRITICAL)**

The file itself (`drift-component.tsx`) is clean and well-crafted (Grade A — see below). The README that describes it is **factually wrong on every quantitative claim**.

README says:
- "**five violations**" — Demo script says "three MITHRIL-IST-COL violations". File header JSDoc lists exactly three drift hexes. Pick one count.
- "`#FF3333` (bright red badge, ΔE ≈ **58** from `color.primary`)" — File header and demo script say "ΔE 8.1 from `color.danger` (#DC2626)". `#FF3333` vs `color.primary` (#0066FF) is the *wrong nearest token match* — the linter picks nearest, which is `color.danger`, not `color.primary`. README is comparing to the wrong token AND inventing a ΔE of 58 when the real value is 8.1.
- "`#00AAFF` (sky-blue icon, ΔE ≈ **19**)" — The file does contain `#00AAFF` on line 98 for the check icon, but neither the file header JSDoc nor the demo script lists it as a drift. The ΔE 19 number is unsourced.
- "a 1px font-size drift (`15px` vs. the `14px` token) that would be invisible in a code review but is caught deterministically by `MITHRIL-TYP-002`" — **There is no `15px` anywhere in `drift-component.tsx`.** The file uses Tailwind classes (`text-lg`, `text-xs`, `text-5xl`, `text-sm`). The 15px drift lives in `banner-broken.tsx` on line 39, a totally different file in a totally different demo.

**Required fix:** Rewrite the README to exactly match the file's own JSDoc and the demo script. Three drifts. `#0055EE` (×2) → `color.primary-hover` ΔE 4.6. `#FF3333` → `color.danger` ΔE 8.1. No font-size drift. No `#00AAFF` drift unless you also list it in the demo script and file header.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/04-sentinel/violating-ux.tsx + README.md — **Grade: C (MAJOR)**

The file itself is a credible Hick/Miller fixture (Grade B+). But the counts don't line up and there's a dead field.

**Discrepancies:**
- Demo script says "**eighteen** fields". README says "**sixteen** fields". Actual file has **17** renderable controls (16 inputs + 1 textarea). Three different numbers for one file.
- `OrderFormState.shipToCountry` is declared in state with default `'US'` but never rendered in the JSX. That's a dead field. Either render it or remove it.
- Demo script says "31 violations: 18 critical, 13 warnings" but the counts are unsourced — I could not verify without running `audit_ui_component` against the file. If the script is going to put exact numbers on stage, somebody has to run the tool and bake those numbers in from the actual output, not from memory.
- Demo script claim "every input on the form is invisible to a screen reader" is *mostly* right but imprecise: the labels are siblings-in-divs, not wrappers, so yes the association is broken — but saying "invisible" is stronger than the linter actually reports.

**Required fix:** Run `audit_ui_component demos/04-sentinel/violating-ux.tsx` once, record the exact count, and update the script + README to match. Remove or render `shipToCountry`. Unify the field count across all three sources.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/01-rag-ui-builder/ — **Grade: C (MAJOR)**

Three files (`banner-compliant.tsx`, `banner-broken.tsx`, `broken-layout.tsx`) and two mutually exclusive stories for "what Demo 1 shows".

**Story A** (demos/README.md row 01): "AI reads the component registry via RAG and rewrites a hardcoded notification panel to use semantic design tokens" — this points at `broken-layout.tsx` (the notification panel with `bg-blue-500`, `text-[15px]` etc.).

**Story B** (demos/DEMO-SCRIPT.md Demo 1): "The Governance Definition of Compliant — open `banner-compliant.tsx`, audit, get five Mithril + three A11y violations" — this points at `banner-compliant.tsx`.

These are two completely different demos using two completely different files and two completely different narratives. The folder contains three files with no README explaining which is the "canonical" Demo 1.

**Intentional violations are valid** — `banner-compliant.tsx` is supposed to be ironically non-compliant (the name is the joke), and the file delivers on that: every hex is hardcoded in a Tailwind arbitrary value, which is exactly the kind of pattern Mithril catches. `banner-broken.tsx` differs only in one hex (`#0055EE` vs `#0066FF`) and two font sizes (15px/13px vs 16px/14px) so the demo can show a ΔE hit and a typography drift. Pedagogically these are fine.

**Problems:**
- Three files, zero folder README explaining which one is Demo 1.
- `broken-layout.tsx` is a whole different component (notification panel) with its own violation story that appears nowhere in DEMO-SCRIPT.md.
- The top-level `demos/README.md` index table contradicts `demos/DEMO-SCRIPT.md` on what Demo 1 even is.

**Required fix:** Either delete `broken-layout.tsx` and commit to the banner story, OR add a folder README that says "Demo 1 has two acts — Act 1: banner-compliant.tsx (ironic naming). Act 2: broken-layout.tsx (RAG rewrite)" and update `demos/README.md` row 01 to match `DEMO-SCRIPT.md`.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/02-self-correcting/buggy-component.tsx — **Grade: A–**

The file does what it advertises. Three real type errors:
- Line 35: `const DEFAULT_PAGE_SIZE: number = "25"` — TS2322 string→number. ✓
- Line 37: `function handleRowClick(row: Row, index: string)` — extra parameter not in prop signature. ✓
- Line 48: `useState<keyof Row>("created_by")` — `"created_by"` not in the `keyof Row` union. ✓ (TS2322)

Demo script claim "Flint ran a type check in memory before surfacing this as a diff" is the one place where the demo and the underlying commandment (C16: In-Memory Validation) actually align. Good.

**Minor:** The `handleRowClick` function is declared but never called in the component — it's a stray that could mislead a reader. Either delete it or wire it to a row handler as an "additional violation" the linter can catch.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/03-mithril-shadow-audit/drift-component.tsx — **Grade: A**

The fixture itself is the best-crafted file in the whole demos/ tree. The file header JSDoc clearly declares which hex values are intentional drift and documents the expected ΔE values. Inline `backgroundColor` string literals are used instead of ternaries so the linter can extract them. Spacing is Tailwind standard scale to avoid masking the color violations. This is how all the demo fixtures should be written.

The only problem is the README *describing* this file is wrong (see above). Fix the README, not the file.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/_preview/DemoPreview.tsx — **Grade: C (MAJOR)**

This is the demo preview shell — it renders each fixture in an iframe with an error boundary and a nav bar. It is Flint source code, not a demo fixture, so it should follow Flint's own rules.

**Violations of Flint's own Mithril rules:**
- Line 18–27: inline hex everywhere — `#2a1215`, `#f87171`, `#fca5a5`, `#888`, `#60a5fa`
- Line 165–167: `BADGE_STYLES` object with `#7f1d1d`, `#fca5a5`, `#991b1b`, `#451a03`, `#fcd34d`, `#78350f`, `#052e16`, `#86efac`, `#166534`
- Line 175: `background: '#0f0f0f', color: '#fff'`
- Line 176: `borderBottom: '1px solid #222'`
- Line 186–191: `border: '1px solid #0066FF'`, `background: '#0066FF'`, `color: '#fff'`, `background: '#1a1a1a'`, `border: '1px solid #333'`

All of these are hardcoded hex in inline styles — the exact pattern Flint tells customers to stop doing. This file would fail its own Mithril audit with dozens of `MITHRIL-IST-COL` hits.

**Why it matters:** The preview shell is the first thing a prospect sees when they run the demo. If they open the file, they see the exact anti-pattern Flint is supposed to prevent. This is the single highest-credibility-risk file in the demos folder because it's **not a fixture** — it's production support code.

**Required fix:** Convert all inline hexes to token references via a small local token file, or to Tailwind classes (`bg-zinc-950`, `border-zinc-800`, `text-red-400`, etc.). This file was called out in `feedback_dev_project_self_hosting.md` as shell infrastructure — it should be held to Flint's standards.

**Note:** `demos/_preview/main.tsx` is a duplicate of `demos/demo-before.tsx` — same 10 intentional violations, same content. If `main.tsx` is an entry point, it should be importing `DemoPreview`, not cloning the before/after file. This is dead code that should be deleted.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/_preview/compliance-map-concept.html — **Grade: Informational**

This is a standalone HTML concept mockup using literal `bg-[#1e293b]` and `text-[#94a3b8]` strings — but these appear inside `<strong>` tags as *violation reports* being demonstrated in a mockup of a governance UI. Intended pedagogy, not a real violation. OK.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/Unique-mui-style.js — **Grade: Informational**

A token definition file (hex values in a `colors` object). This is how design tokens are *defined*. Hex values in a DTCG-style token source file are not violations — they're the definition. OK.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/figma-d2c/AccountSettings.tsx — **Grade: B**

Mason pipeline output — imports shadcn primitives, uses `htmlFor`/`id` label pairing correctly, uses semantic tokens like `bg-primary/10` and `text-muted-foreground`. This is actually the best example in the whole folder of what "compliant" looks like. One note: `w-[640px]` is a hardcoded arbitrary value; `bg-emerald-500/12` is not a standard Tailwind alpha stop — these are minor. Consider showcasing this file more prominently as a "what compliant looks like" reference.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/DEMO-SCRIPT.md — **Grade: C+ (MAJOR)**

The script is well-structured and the narrative beats are strong. The problems are numerical and pointer-level:
1. Demo 1 points at `banner-compliant.tsx` but `demos/README.md` says Demo 1 is the `broken-layout.tsx` notification panel story. Reconcile.
2. Demo 3 says "three MITHRIL-IST-COL violations"; the `03` README says "five". Reconcile.
3. Demo 4 says "eighteen fields" / "31 violations: 18 critical, 13 warnings". README says "sixteen". File has 17. Run the audit tool once and lock in the real number.
4. Demo 7 refers to `/sweep` and `/report` slash commands and promises "Files scanned: six. Violations fixed across the board. Health score climbs significantly." — those numbers are unverified and the script should either produce the real numbers from a dry run or be more qualitative.
5. Line 4: "Total time: ~24 minutes" but adding the timing guide rows gives 24:00 — OK, that checks out.

**Required fix:** Run every audit command the script invokes, paste the real output into the script as the expected numbers, and update the three READMEs (`demos/README.md`, `03/README.md`, `04/README.md`) to match.

---

### /Users/tiemann/Lunar-Elevator-Bridge/demos/README.md — **Grade: C (MAJOR)**

Index table rows contradict the demo script:
- Row 01: "AI reads the component registry via RAG and rewrites a hardcoded notification panel" ≠ demo script's banner-compliant story.
- Row 03: "five drift violations on a pricing card" — file has 3 drift hexes; demo script says 3.
- Row 04: "Hick's Law (10-button toolbar) and Miller's Law (16 always-visible fields)" — demo script says 18.
- Row 05: "Legacy `<div className=\"box\">` soup is surgically upgraded to typed design system primitives (`Box`, `Stack`, `TextField`)" — the actual file uses Tailwind classes and real `<input>`/`<select>`, and there are no `Box`/`Stack`/`TextField` primitives registered anywhere in the demos tree.

---

## Commandment Compliance Summary

| # | Commandment | Status in demos/ |
|---|---|---|
| C2 | No Hallucinated Styling | **FAILS in `_preview/DemoPreview.tsx`** (production shell code with hardcoded hex inline styles) |
| C13 | Deterministic Surgery | Pass — no regex source surgery found in demos |
| C16 | In-Memory Validation | **FAILS via `06-macro-recovery/corrupted-card.tsx`** — corrupted fixture has unused locals/props/functions that fail strict TSC, meaning Flint's own fixture would be rejected by Flint's own orchestrator |
| C5 | Accessibility is a Compiler Error | Mostly upheld in the fixture files; violated in the README narratives that invent a11y counts that don't exist in the code |

---

## Severity-Ranked Finding List

### CRITICAL (must fix before any external demo)
1. `demos/demo-before.tsx` and `demos/demo-after.tsx` are byte-identical. "After" demonstrates zero fixing. **Rewrite or delete both.**
2. `demos/06-macro-recovery/corrupted-card.tsx` fails strict TSC (unused `useState`, `formatCount`, `timeAgo`, `onStar`/`onFork`/`onWatch` props). Flint's own fixture gets rejected by Flint's own type check. **Clean up imports or make the unused declarations load-bearing.**
3. `demos/05-semantic-refactor/README.md` describes a file that does not exist. Every structural claim (`<div className="box">`, `<span className="text-label">`, raw divs as inputs, `<Stack>`/`<Text>`/`<Button>` primitives) is invented. **Rewrite README or rewrite file.**
4. `demos/06-macro-recovery/README.md` fabricates "three A11Y-002 violations" and "health score 94→61". The corrupted file has no a11y regressions — removed elements do not fail a11y rules. **Drop the a11y framing or actually break a11y in the corruption.**
5. `demos/03-mithril-shadow-audit/README.md` has the wrong ΔE (58 instead of 8.1), the wrong nearest token (primary instead of danger), an invented `#00AAFF` drift, and a `15px` font-size drift that exists in a *different demo's file*. **Rewrite to match the file's own JSDoc.**
6. `demos/_preview/DemoPreview.tsx` — the production shell that wraps all demos — has dozens of hardcoded hex values in inline styles. Violates Flint's own Mithril rules. Highest credibility risk because prospects see this file when they run the demo. **Convert to tokens or Tailwind classes.**

### MAJOR (fix before the next confident external demo run)
7. Demo 1 has two incompatible stories. `demos/README.md` row 01 points at `broken-layout.tsx` (notification panel). `DEMO-SCRIPT.md` Demo 1 points at `banner-compliant.tsx`. **Pick one.**
8. Demo 4 field count disagrees across three sources (demo script: 18, README: 16, actual file: 17). `OrderFormState.shipToCountry` is in state but never rendered. **Unify the number and kill the dead field.**
9. Demo 4 "31 violations: 18 critical, 13 warnings" number is unverified. **Run the audit tool and bake the real numbers in.**
10. `demos/_preview/main.tsx` is a stale clone of `demo-before.tsx`. Dead code. **Delete or rewrite.**
11. `demos/02-self-correcting/buggy-component.tsx` has a stray `handleRowClick` that's never called. **Wire it up or delete it.**

### MINOR (cosmetic / hygiene)
12. `demos/figma-d2c/AccountSettings.tsx` has one hardcoded `w-[640px]` — not a critical drift but worth fixing if this is positioned as the "compliant reference" file.
13. `demos/01-rag-ui-builder/` folder has no README explaining which file is the canonical Demo 1 fixture.
14. Demo 7 claims "Health score climbs significantly" without a before/after number. **Add real numbers.**

---

## What Actually Works (Credit Where Due)

- `demos/03-mithril-shadow-audit/drift-component.tsx` — well-crafted fixture with clear self-documentation. Template for how every demo fixture should be written.
- `demos/02-self-correcting/buggy-component.tsx` — three real TS errors, all verifiable, all map to the commandment it illustrates. Grade A–.
- `demos/04-sentinel/violating-ux.tsx` — real Hick/Miller fixture. Counts are wrong but the file itself is a credible demo.
- `demos/figma-d2c/AccountSettings.tsx` — actual shadcn-based output with real `htmlFor`/`id` label pairing and semantic tokens. This file should be used as "what compliant actually looks like" in Demo 1.
- `DEMO-SCRIPT.md` narrative structure — the opening, the transition beats, the close, and the fallback notes ("If Demo 9 breaks…") are all well-written. The numbers and pointers need fact-checking; the prose does not.

---

## Recommended Fix Order

1. **Same-day:** Delete or regenerate `demo-before.tsx`/`demo-after.tsx`. This is a single-look-and-you're-done credibility kill.
2. **Same-day:** Fix `_preview/DemoPreview.tsx` hardcoded hex. Token-ize the shell.
3. **Before next external demo:** Rewrite the three lying READMEs (03, 05, 06) to match reality.
4. **Before next external demo:** Fix `corrupted-card.tsx` TSC compile or redesign the corruption.
5. **Before next external demo:** Run every audit command in `DEMO-SCRIPT.md` once and bake the real numbers into the script and READMEs. Unify Demo 4's field count.
6. **Cleanup pass:** Delete dead files (`demos/_preview/main.tsx` duplicate, Demo 1 ambiguity).
7. **Polish:** Unified folder READMEs for 01, 02.

---

## Final Verdict

The demo fixtures themselves are mostly fine. The **narrative layer** (READMEs, scripts, the before/after pair) is where the rot lives. A prospect who only runs the commands will get a good demo. A prospect who reads the files and READMEs will catch us making things up. Fix the narrative layer before the next external demo — this is a two-to-four-hour cleanup job that has out-of-proportion credibility impact.
